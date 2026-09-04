#!/usr/bin/env node
/**
 * Realm Browser - AI 记忆场景评估 harness（AI-SPEC §5 中间层：场景 harness）
 *
 * fixture 驱动的真实模型评估：每个 fixture 描述用户消息与机器可断言的终态
 * （落盘文件内容 / 工具调用序列 / 工具报错 / 助手答复文本），harness 在
 * 隔离临时目录中驱动 pi-agent-core Agent 循环（复用 ai-manager 的完整
 * 工具链与 systemPrompt 组装），对落盘终态做断言。
 *
 * 用法：
 *   npm run eval:memory                 # 全量真实模型评估（需已配置模型 Key）
 *   node test/memory/scenario-harness.js --dry-run   # 秒级 fixture 结构自检，不调模型
 *
 * 隔离保证：
 * - 记忆落盘走 ai-memory-manager.setBaseDir(临时目录)，每场景独立 mkdtemp，
 *   绝不触碰真实 userData 记忆（AI-SPEC fixture 隔离要求）
 * - electron / electron-store / tab-manager 经 Module._load 拦截注入 stub
 *   （手法同 tests/test-ai-conversations.js），活跃容器由 mock tabManager
 *   固定为 fixture 指定容器
 * - AI 配置只读探测（NODE_ENV 对应环境的 realm-config.json），configStore
 *   包装为只读（set/delete 为 no-op），绝不写回用户真实配置
 *
 * 门禁语义（AI-SPEC §5）：真实模型评估耗 token，不设为提交门禁；
 * 提交级反馈用 --dry-run；无可用模型 Key 时全量跑自动 skip 并退出 0。
 *
 * expect 断言语义（AI-SPEC §5 fixture 格式的实现细化）：
 * - toolCalls: 每个期望项 { name, params? } 须被至少一次实际调用匹配
 *   （params 子集相等），跨该场景全部回合累积匹配（LLM 工具时序不保证）
 * - fileState: 每回合结束后立即评估（该时点的落盘状态）；路径相对记忆基目录
 * - throws: 每个子串须出现在某次工具调用错误消息中（fail-closed 路径）
 * - assistantSays: 正则（source 形式），对该场景助手全部回复文本做 match
 * - anyOf: 备选断言组，至少一组完全通过（用于「拒绝写入或明确告知」类
 *   二择一行为——安全性不变式（如文件不含恶意内容）放在 anyOf 之外的
 *   顶层键上恒成立）
 * - setup(fixture 可选): 场景前置钩子（seed 记忆 / 模拟人工编辑），
 *   接收 ai-memory-manager 模块（此时基目录已指向场景临时目录）
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// ==================== fixture 加载与结构校验 ====================

/**
 * 加载 fixtures 目录下全部场景（按文件名排序，保证输出稳定）
 * @returns {Array<{file: string, fixture: object}>}
 */
function loadFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(file => {
      try {
        return { file, fixture: require(path.join(FIXTURES_DIR, file)) };
      } catch (err) {
        return { file, fixture: null, loadError: err.message };
      }
    });
}

/**
 * 校验单个正则 source 可编译
 * @param {string} source - 正则 source
 * @returns {string|null} 错误消息或 null
 */
function regexError(source) {
  try { new RegExp(source, 'm'); return null; } catch (err) { return `非法正则 ${source}: ${err.message}`; }
}

/**
 * 校验 expect 对象形状（dry-run 与加载期共用；递归展开 anyOf）
 * @param {object} expect - fixture turn 的 expect
 * @param {string} where - 错误消息定位前缀
 * @param {string[]} errors - 累积错误数组
 */
function validateExpect(expect, where, errors) {
  if (!expect || typeof expect !== 'object' || Array.isArray(expect)) {
    errors.push(`${where}: expect 必须是对象`);
    return;
  }
  const keys = ['toolCalls', 'fileState', 'throws', 'assistantSays', 'anyOf'];
  if (!keys.some(k => expect[k] !== undefined)) {
    errors.push(`${where}: expect 至少含 toolCalls/fileState/throws/assistantSays/anyOf 其一`);
  }

  if (expect.toolCalls !== undefined) {
    if (!Array.isArray(expect.toolCalls) || expect.toolCalls.length === 0) {
      errors.push(`${where}: expect.toolCalls 须为非空数组`);
    } else {
      expect.toolCalls.forEach((tc, i) => {
        if (!tc || typeof tc.name !== 'string' || !tc.name) {
          errors.push(`${where}: expect.toolCalls[${i}].name 缺失`);
        }
        if (tc.params !== undefined && (typeof tc.params !== 'object' || tc.params === null)) {
          errors.push(`${where}: expect.toolCalls[${i}].params 须为对象`);
        }
      });
    }
  }

  if (expect.fileState !== undefined) {
    if (typeof expect.fileState !== 'object' || expect.fileState === null) {
      errors.push(`${where}: expect.fileState 须为对象`);
    } else {
      for (const [rel, spec] of Object.entries(expect.fileState)) {
        if (!spec || typeof spec !== 'object') {
          errors.push(`${where}: fileState["${rel}"] 须为断言对象`);
          continue;
        }
        if (spec.exists !== undefined && typeof spec.exists !== 'boolean') {
          errors.push(`${where}: fileState["${rel}"].exists 须为布尔`);
        }
        for (const key of ['includes', 'notIncludes']) {
          if (spec[key] !== undefined && (!Array.isArray(spec[key]) || spec[key].some(s => typeof s !== 'string'))) {
            errors.push(`${where}: fileState["${rel}"].${key} 须为字符串数组`);
          }
        }
        if (spec.match !== undefined) {
          const err = regexError(spec.match);
          if (err) errors.push(`${where}: fileState["${rel}"].match ${err}`);
        }
      }
    }
  }

  if (expect.throws !== undefined) {
    if (!Array.isArray(expect.throws) || expect.throws.length === 0 || expect.throws.some(s => typeof s !== 'string' || !s)) {
      errors.push(`${where}: expect.throws 须为非空字符串数组`);
    }
  }

  if (expect.assistantSays !== undefined) {
    if (typeof expect.assistantSays !== 'string') {
      errors.push(`${where}: expect.assistantSays 须为正则 source 字符串`);
    } else {
      const err = regexError(expect.assistantSays);
      if (err) errors.push(`${where}: expect.assistantSays ${err}`);
    }
  }

  if (expect.anyOf !== undefined) {
    if (!Array.isArray(expect.anyOf) || expect.anyOf.length === 0) {
      errors.push(`${where}: expect.anyOf 须为非空数组`);
    } else {
      expect.anyOf.forEach((alt, i) => validateExpect(alt, `${where}.anyOf[${i}]`, errors));
    }
  }
}

/**
 * 校验单个 fixture 结构合法性
 * @param {object} fx - fixture 导出对象
 * @returns {string[]} 错误列表（空数组 = 合法）
 */
function validateFixture(fx) {
  const errors = [];
  if (!fx || typeof fx !== 'object') {
    return ['fixture 须为导出对象'];
  }
  if (typeof fx.name !== 'string' || !fx.name) errors.push('name 缺失或为空');
  if (!Array.isArray(fx.turns) || fx.turns.length === 0) {
    errors.push('turns 须为非空数组');
    return errors;
  }
  fx.turns.forEach((turn, i) => {
    const where = `turns[${i}]`;
    if (!turn || typeof turn.user !== 'string' || !turn.user) {
      errors.push(`${where}: user 缺失或为空`);
    }
    validateExpect(turn && turn.expect, where, errors);
  });
  if (fx.setup !== undefined && typeof fx.setup !== 'function') {
    errors.push('setup 须为函数（接收 ai-memory-manager 模块）');
  }
  if (fx.activeContainer !== undefined && (typeof fx.activeContainer !== 'string' || !/^[\w-]+$/.test(fx.activeContainer))) {
    errors.push('activeContainer 须为合法容器 ID（/^[\w-]+$/）');
  }
  return errors;
}

// ==================== dry-run 模式（提交级反馈，秒级） ====================

/**
 * dry-run：仅加载并校验全部 fixture 结构，不触发任何模型调用
 * @returns {number} 退出码
 */
function runDryRun() {
  const fixtures = loadFixtures();
  if (fixtures.length === 0) {
    console.error('[eval:memory] 未找到任何 fixture（test/memory/fixtures/ 为空）');
    return 1;
  }
  let failed = 0;
  for (const { file, fixture, loadError } of fixtures) {
    if (loadError) {
      console.log(`[FAIL] ${file}: 模块加载失败 — ${loadError}`);
      failed++;
      continue;
    }
    const errors = validateFixture(fixture);
    if (errors.length === 0) {
      console.log(`[OK]   ${file} — ${fixture.name}（${fixture.turns.length} turn）`);
    } else {
      failed++;
      console.log(`[FAIL] ${file} — ${fixture.name || '(无名)'}`);
      for (const err of errors) console.log(`       - ${err}`);
    }
  }
  console.log(`\n[dry-run] ${fixtures.length - failed}/${fixtures.length} fixture 结构合法`);
  return failed > 0 ? 1 : 0;
}

// ==================== 模型可用性探测（只读） ====================

/**
 * 解析当前环境对应的真实 userData 目录（与 main.js 环境隔离逻辑一致）
 * @returns {string} userData 绝对路径
 */
function resolveRealUserData() {
  const name = process.env.NODE_ENV === 'nightly' ? 'realm-nightly'
    : (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') ? 'realm-dev'
      : 'realm';
  return path.join(os.homedir(), 'Library', 'Application Support', name);
}

/**
 * 只读解析真实 AI 供应商配置（ai-manager provider 配置存储的环境等价物）
 * @returns {{providers: object, activeProvider: string}|null} 配置；文件缺失返回 null
 */
function loadRealAiConfig() {
  try {
    const raw = fs.readFileSync(path.join(resolveRealUserData(), 'realm-config.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const ai = parsed && parsed.ai ? parsed.ai : {};
    return { providers: ai.providers || {}, activeProvider: ai.activeProvider || null };
  } catch {
    return null;
  }
}

/**
 * 是否存在可用的模型 Key（镜像 ai-manager._isProviderConfigured 语义：
 * 已保存 Key 或环境变量可解析；enabled !== false）
 * @param {{providers: object}} cfg - 真实配置
 * @returns {boolean}
 */
function hasUsableModelKey(cfg) {
  return Object.entries(cfg.providers).some(([, p]) => {
    if (!p || p.enabled === false) return false;
    if (p.apiKey) return true;
    return Boolean(p.envVarName && process.env[p.envVarName]);
  });
}

// ==================== 纯 Node 环境下的 electron / tab-manager stub ====================

/**
 * 构建并安装 Module._load 拦截（必须在 require('../ai-manager') 之前调用）
 * 手法同 tests/test-ai-conversations.js；额外拦截 './tab-manager' 返回
 * 可设置活跃容器的 mock（fixture 的 activeContainer 由此生效）。
 * @returns {{mockTabManager: object, stubUserData: string, restore: function}}
 */
function installStubs() {
  const stubUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ai-memory-eval-'));
  /** 活跃容器 mock：fixture 指定容器（memory 工具 target:'container' 据此解析） */
  const mockTabManager = {
    _containerId: 'work',
    setActiveContainer(id) { this._containerId = id; },
    getActiveTab() {
      return { id: 1, containerId: this._containerId, url: 'https://example.com/', title: 'eval-mock-tab' };
    },
    getTabs() { return [this.getActiveTab()]; },
    getTab(tabId) { return tabId === 1 ? this.getActiveTab() : null; },
  };

  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath: () => stubUserData,
          whenReady: () => Promise.resolve(),
          setName() {},
          on() {},
          quit() {},
        },
        webContents: { getAllWebContents: () => [], fromId: () => null },
        ipcMain: { handle() {}, on() {}, once() {}, removeAllListeners() {} },
        BrowserWindow: class BrowserWindowStub { static getAllWindows() { return []; } },
        screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }), getAllDisplays: () => [] },
        net: { fetch: () => Promise.reject(new Error('eval stub: net.fetch 不可用')) },
        session: { fromPartition: () => ({}) },
        dialog: { showMessageBox: async () => ({ response: 0 }) },
        nativeTheme: {},
        clipboard: {},
        shell: { openExternal: async () => {} },
      };
    }
    if (request === 'electron-store') {
      return class FakeStore {
        constructor(opts = {}) {
          this._data = {};
          this.path = path.join(stubUserData, (opts.name || 'config') + '.json');
        }
        get(_key, fallback) { return fallback; }
        set() {}
        has() { return false; }
        delete() {}
        clear() {}
      };
    }
    if (request === './tab-manager') {
      return mockTabManager;
    }
    return origLoad.apply(this, arguments);
  };

  return {
    mockTabManager,
    stubUserData,
    restore() {
      Module._load = origLoad;
      fs.rmSync(stubUserData, { recursive: true, force: true });
    },
  };
}

// ==================== 断言求值器 ====================

/**
 * params 子集相等匹配（期望 params 的每个键值对都须在实际 params 中出现）
 */
function paramsSubsetMatch(expected, actual) {
  if (!expected) return true;
  if (!actual || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([k, v]) => actual[k] === v);
}

/**
 * 评估 fileState 断言（针对当前落盘状态）
 * @param {string} baseDir - 记忆基目录
 * @param {object} fileState - { 相对路径: { exists?, includes?, notIncludes?, match? } }
 * @returns {string[]} 失败描述（空 = 通过）
 */
function evalFileState(baseDir, fileState) {
  const failures = [];
  for (const [rel, spec] of Object.entries(fileState || {})) {
    const abs = path.join(baseDir, rel);
    const exists = fs.existsSync(abs);
    const content = exists ? fs.readFileSync(abs, 'utf8') : '';
    const label = `fileState["${rel}"]`;
    if (spec.exists === true && !exists) failures.push(`${label}: 文件应存在但不存在`);
    if (spec.exists === false && exists) failures.push(`${label}: 文件应不存在但存在`);
    for (const inc of spec.includes || []) {
      if (!content.includes(inc)) failures.push(`${label}: 应包含「${inc}」但未找到`);
    }
    for (const inc of spec.notIncludes || []) {
      if (content.includes(inc)) failures.push(`${label}: 不应包含「${inc}」但出现了`);
    }
    if (spec.match !== undefined && !new RegExp(spec.match, 'm').test(content)) {
      failures.push(`${label}: 应匹配 /${spec.match}/m 但未命中`);
    }
  }
  return failures;
}

/**
 * 评估整个 expect（toolCalls/throws/assistantSays 对场景累积数据；
 * fileState 由调用方按回合时点求值后传入；anyOf 至少一组通过）
 * @param {object} expect - 断言对象
 * @param {{baseDir: string, fileState: string[], calls: Array, errors: string[], assistantText: string}} ctx
 * @returns {string[]} 失败描述（空 = 通过）
 */
function evalExpect(expect, ctx) {
  const failures = [...(ctx.fileState || [])];

  if (expect.toolCalls !== undefined) {
    const pool = [...ctx.calls];
    for (const exp of expect.toolCalls) {
      const idx = pool.findIndex(c => c.name === exp.name && paramsSubsetMatch(exp.params, c.params));
      if (idx === -1) {
        failures.push(`toolCalls: 缺少匹配的调用 ${exp.name} ${JSON.stringify(exp.params || {})}`);
      } else {
        pool.splice(idx, 1);
      }
    }
  }

  for (const sub of expect.throws || []) {
    if (!ctx.errors.some(msg => msg.includes(sub))) {
      failures.push(`throws: 无工具错误消息包含「${sub}」`);
    }
  }

  if (expect.assistantSays !== undefined && !new RegExp(expect.assistantSays, 'm').test(ctx.assistantText)) {
    failures.push(`assistantSays: 助手回复未匹配 /${expect.assistantSays}/m`);
  }

  if (expect.anyOf !== undefined) {
    const altResults = expect.anyOf.map(alt => evalExpect(alt, ctx));
    if (altResults.some(r => r.length === 0)) {
      // 任一备选通过即清空 anyOf 范畴的失败（顶层 failures 保留）
      return failures;
    }
    failures.push(`anyOf: 全部 ${expect.anyOf.length} 个备选断言均未通过:`);
    altResults.forEach((r, i) => r.forEach(f => failures.push(`  [备选${i + 1}] ${f}`)));
  }

  return failures;
}

// ==================== 全量真实模型评估 ====================

/**
 * 提取场景助手回复文本（conversationStore 显示形状，D-08 归一化后 content）
 * @param {object} conversationStore - ai-conversations-manager 模块
 * @param {string|null} conversationId - 当前对话 ID
 * @returns {string} 全部 assistant 文本拼接
 */
function collectAssistantText(conversationStore, conversationId) {
  if (!conversationId) return '';
  try {
    const msgs = conversationStore.getMessages(conversationId) || [];
    return msgs.filter(m => m.role === 'assistant' && m.content)
      .map(m => (typeof m.content === 'string' ? m.content : String(m.content)))
      .join('\n');
  } catch {
    return '';
  }
}

/**
 * 全量真实模型评估
 * @returns {Promise<number>} 退出码
 */
async function runRealEval() {
  const cfg = loadRealAiConfig();
  if (!cfg || !hasUsableModelKey(cfg)) {
    console.log('eval:memory 跳过——未配置模型 Key（在设置页 AI 分区配置后重跑）');
    return 0;
  }

  const fixtures = loadFixtures().filter(f => !f.loadError);
  if (fixtures.length === 0) {
    console.error('[eval:memory] 未找到任何 fixture');
    return 1;
  }

  const aiMemoryManager = require('../../ai-memory-manager');
  const stubs = installStubs();
  // stub 安装后再加载（ai-manager 顶层 require('./tab-manager') 命中 mock）
  const AIManager = require('../../ai-manager');
  const conversationStore = require('../../ai-conversations-manager');

  // 只读 configStore 包装：读真实配置（探测已确认有 Key），写一律 no-op，
  // 绝不写回用户真实 realm-config.json（_migrateLegacyConfig 的 set/delete 被吞掉）
  const readonlyConfigStore = {
    get(key, fallback) {
      const segs = key.split('.');
      let cur = { ai: cfg };
      for (const seg of segs) {
        cur = cur && cur[seg];
        if (cur === undefined) return fallback;
      }
      return cur;
    },
    set() {},
    delete() {},
    has() { return false; },
  };

  const results = [];
  for (const { file, fixture } of fixtures) {
    const scenarioTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ai-memory-scenario-'));
    aiMemoryManager.setBaseDir(scenarioTmp);
    let outcome = { status: 'PASS', failures: [] };

    try {
      stubs.mockTabManager.setActiveContainer(fixture.activeContainer || 'work');
      if (typeof fixture.setup === 'function') fixture.setup(aiMemoryManager);

      const am = new AIManager();
      await am.init(readonlyConfigStore);
      if (!am.isInitialized || !am.agent) {
        results.push({ file, name: fixture.name, status: 'SKIP', failures: ['AIManager 初始化未成功（探测有 Key 但运行时初始化失败）'] });
        continue;
      }

      // 包装工具 execute 记录调用与错误（agent 持有同一工具对象引用，原地生效）
      const calls = [];
      const toolErrors = [];
      for (const tool of am.tools) {
        const origExecute = tool.execute.bind(tool);
        tool.execute = async (toolCallId, params) => {
          const rec = { name: tool.name, params: params || {} };
          calls.push(rec);
          try {
            return await origExecute(toolCallId, params);
          } catch (err) {
            rec.error = err.message;
            toolErrors.push(`${tool.name}: ${err.message}`);
            throw err;
          }
        };
      }

      const perTurnFileState = [];
      const assistantTexts = [];
      for (const turn of fixture.turns) {
        await am.prompt(turn.user);
        assistantTexts.push(collectAssistantText(conversationStore, am.currentConversationId));
        // fileState 在每回合结束后立即评估（该时点落盘状态）
        if (turn.expect && turn.expect.fileState) {
          perTurnFileState.push(...evalFileState(scenarioTmp, turn.expect.fileState));
        }
      }

      const ctx = {
        baseDir: scenarioTmp,
        fileState: perTurnFileState,
        calls,
        errors: toolErrors,
        assistantText: assistantTexts.join('\n'),
      };
      // 任一回合的 expect 整体不通过即场景 FAIL（fileState 失败已在 ctx 内合并）
      for (const turn of fixture.turns) {
        if (!turn.expect) continue;
        const failures = evalExpect({ ...turn.expect, fileState: undefined }, ctx);
        if (failures.length > 0) {
          outcome = { status: 'FAIL', failures };
          break;
        }
      }
    } catch (err) {
      outcome = { status: 'FAIL', failures: [`场景执行异常: ${err.message}`] };
    } finally {
      aiMemoryManager.setBaseDir(null);
      try { fs.rmSync(scenarioTmp, { recursive: true, force: true }); } catch { /* 清理失败不阻塞 */ }
    }

    results.push({ file, name: fixture.name, ...outcome });
  }

  stubs.restore();

  // 摘要输出
  let pass = 0, fail = 0, skip = 0;
  for (const r of results) {
    console.log(`[${r.status}] ${r.file} — ${r.name}`);
    if (r.status === 'FAIL') {
      fail++;
      for (const f of r.failures) console.log(`       - ${f}`);
    } else if (r.status === 'SKIP') {
      skip++;
      for (const f of r.failures) console.log(`       - ${f}`);
    } else {
      pass++;
    }
  }
  console.log(`\n[eval:memory] 共 ${results.length} 场景：PASS ${pass} / FAIL ${fail} / SKIP ${skip}`);
  return fail > 0 ? 1 : 0;
}

// ==================== 入口 ====================

(async () => {
  const code = DRY_RUN ? runDryRun() : await runRealEval();
  // 批量发送定时器等悬挂句柄不阻塞退出
  process.exit(code);
})();
