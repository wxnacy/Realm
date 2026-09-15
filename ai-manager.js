/**
 * Realm Browser - AI Manager
 *
 * 管理 AI Agent 的生命周期，包括 LLM 连接、工具注册和对话状态。
 * 基于 pi-agent-core SDK 实现，使用 pi-ai 作为统一 LLM API 层。
 *
 * 注意：pi-ai 和 pi-agent-core 是 ESM-only 包，需要通过动态 import() 加载。
 * Electron 32 内置 Node.js 20.18.x，ESM 动态 import 可用，但版本低于
 * pi-agent-core 要求的 22.19.0。如遇兼容性问题，需评估升级 Electron 或
 * 采用子进程方案（见 D-03 决策）。
 *
 * API Key 通过 CredentialStore 注入（per pi-ai 的认证模型），
 * 按提供商存储在 electron-store 的 `ai.providers` 路径下：
 * { [providerId]: { apiKey, model } }，激活提供商在 `ai.activeProvider`。
 *
 * @module ai-manager
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { webContents, BrowserWindow } = require('electron');
const tabManager = require('./tab-manager');
const historyManager = require('./history-manager');
const favoritesManager = require('./favorites-manager');
const windowManager = require('./window-manager');
const assignmentRules = require('./assignment-rules');
const cdpManager = require('./cdp-manager');
const searchManager = require('./search-manager');
const conversationStore = require('./ai-conversations-manager');
const aiAttachments = require('./ai-attachments-manager');
const { modelSupportsImage, VisionDescriber } = require('./vision-describer');

// ==================== Readability 库缓存 ====================

/**
 * Mozilla Readability minified IIFE（lib/readability-bundle.js，Phase 22-01 打包）
 * read_page_content 工具经 Runtime.evaluate 注入 webview 后在页面上下文执行。
 * 模块加载时读取一次并缓存，避免每次工具调用都读盘。
 */
let READABILITY_SCRIPT = '';
try {
  READABILITY_SCRIPT = fs.readFileSync(path.join(__dirname, 'lib/readability-bundle.js'), 'utf8');
} catch (err) {
  console.error('[Realm AI] Readability 库加载失败:', err.message);
}

/**
 * 获取当前活跃标签页的 webview guest webContents ID
 *
 * 主进程 tab 对象不维护 webContentsId（tab↔webview 关联由渲染进程
 * state.webviews 持有），活跃 guest ID 的唯一权威来源是渲染进程经
 * webview:set-active 上报到 ipc-handlers 的值。
 *
 * 惰性 require 的原因：纯 Node 环境（语法检查/注册验证）下 ipc-handlers
 * 依赖链（cookie-manager 顶层 app.getPath）不可加载；Electron 主进程
 * 运行时 main.js 已完成加载，此处直接命中模块缓存，无循环依赖风险。
 *
 * @returns {number|null} webContents ID，未上报时返回 null
 */
function getActiveWebviewContentsIdLazy() {
  return require('./ipc-handlers').getActiveWebviewContentsId();
}

/**
 * 获取全部容器配置列表（纯配置字段，不含 session 对象）
 *
 * 容器列表的权威来源是 container-manager 的内存 Map：
 * initContainers() 以 DEFAULT_CONTAINERS 为兜底值读入内存且从不写回
 * store，因此全新 profile（realm-config.json 无 containers 键）下从
 * store 以空数组兜底读取会返回 []，导致 open_link / switch_container
 * 误判「default」容器不存在。getContainers() 返回纯配置字段
 * {id,name,color,icon,phone,email,notes}，与原 store 数据形状一致。
 *
 * 惰性 require 的原因与上方 ipc-handlers 一致：纯 Node 环境（语法
 * 检查/注册验证）下 container-manager 依赖链（electron-store 构造时
 * app.getPath 为 undefined）不可加载；Electron 主进程运行时直接命中
 * 模块缓存，无循环依赖风险。
 *
 * @returns {Array<{id: string, name: string, color: string, icon: string, phone: string, email: string, notes: string}>}
 */
function getContainersLazy() {
  return require('./container-manager').getContainers();
}

/**
 * 惰性 require AI 记忆管理模块
 *
 * ai-memory-manager 内部对 electron app 的依赖本身是惰性获取的（纯 Node
 * 测试环境可加载），此处仍按 getContainersLazy 同款惰性模式引用：避开
 * 模块加载顺序问题，Electron 主进程运行时直接命中模块缓存，无循环依赖风险。
 *
 * @returns {object} ai-memory-manager 模块导出
 */
function getAiMemoryManagerLazy() {
  return require('./ai-memory-manager');
}

/**
 * 惰性 require AI 工作区模块（agent 根目录 + 沙箱 env）
 *
 * agent-workspace 内部对 electron app 的依赖是惰性获取的，此处按同款惰性
 * 模式引用（与 getAiMemoryManagerLazy 一致），避开模块加载顺序问题。
 *
 * @returns {object} agent-workspace 模块导出
 */
function getAgentWorkspaceLazy() {
  return require('./agent-workspace');
}

/**
 * 惰性 require AI 技能管理模块（技能集唯一数据权威）
 *
 * ai-skills-manager 无 electron 依赖、无顶层 SDK import（SDK 在 refreshSkills
 * 内动态 import），纯 Node 环境下可直接加载与测试。此处按同款惰性模式引用
 * （与 getAgentWorkspaceLazy 一致），避开模块加载顺序问题。
 *
 * @returns {object} ai-skills-manager 模块导出
 */
function getAiSkillsManagerLazy() {
  return require('./ai-skills-manager');
}

/**
 * 导入面错误码表（`IMPORT_SKILL_ERROR`）—— 转发层**不得手抄码值**
 *
 * 与 `manage_skill` / 设置页同一条纪律：码表是**单源**（住 `ai-skills-manager.js`），
 * `main.js` 的 handler 与前端只按 code 查文案。这里手抄一份字符串就会让
 * 「后端多一个前端没文案的码」再次可能发生。
 */
function importSkillErrors() {
  return getAiSkillsManagerLazy().IMPORT_SKILL_ERROR;
}

/**
 * 惰性 require 内置技能播种模块（seeded 身份的唯一数据源，48 D-14）
 *
 * builtin-skills-seeder 经 agent-workspace 间接依赖 electron（`app.isPackaged`），
 * 纯 Node 环境下 `require('electron')` 返回字符串、解构出的 `app` 为 undefined
 * → `getSeededSkillNames()` 抛 TypeError（`48-RESEARCH.md` 事实 4）。因此调用方
 * **必须**走 getSeededSkillNamesSafe() 的 try/catch 降级，不得直接调用本模块的该方法。
 *
 * @returns {object} builtin-skills-seeder 模块导出
 */
function getBuiltinSkillsSeederLazy() {
  return require('./builtin-skills-seeder');
}

/** `/` 面板与技能调用共用的纯逻辑模型（双模式导出，main 侧取同一份规则） */
const skillPickerModel = require('./src/skill-picker-model');

// Bash 三档权限策略（纯函数零依赖，可直接顶层 require）
const bashPolicy = require('./ai-bash-policy');

/**
 * `manage_skill` 失败态原因码的**词缀正则**（Phase 49 / WR-02）—— encode / decode 两侧的**唯一来源**
 *
 * **为什么需要词缀**：SDK 在工具 `throw` 时走 `createErrorToolResult(message)`
 * （`agent-loop.js:519-524`），产出的 `result.details` 恒为 `{}` —— 失败态的机器可读原因码
 * 只有**消息文本**这一条能跨过持久化边界（消息落进 `tool_results` 的文本列）。UI-SPEC 硬约束 3
 * 要求「两条链路键集合逐字相等」，失败行因此必须把原因码编码进消息、重载时再解码回来
 * （不能按当前磁盘状态重算 —— 那会随技能被删除 / 改名而漂移）。
 *
 * **锚定消息起始**（`^`）是「成功文案永不误命中」的机械保证：成功文案以「已创建技能「…」」开头，
 * 不可能以 `[code] ` 起始。词表域 `[a-z_]+` 与九码（`MANAGE_SKILL_ERROR`）及沙箱兜底
 * `unknown` 的字符集一致 —— 不含被拒内容原文，只含白名单形态的原因码。
 *
 * **不可加 `/g`**：本常量同时用于 `.test()`（写入侧的幂等判定）与 `.exec()`（重载侧的解析），
 * 带 `g` 会让 `lastIndex` 在两次调用间残留而产出间歇性假阴性。
 *
 * 写入侧与解析侧**必须逐字引用这一个标识符**（源码门禁按此断言），另起名字会让门禁转红。
 */
const MANAGE_SKILL_CODE_TAG = /^\[([a-z_]+)\]\s/;

// ==================== 安全辅助函数 ====================

/**
 * 输入消毒函数（per D-13 输入消毒层）
 *
 * 对所有字符串参数执行消毒，防止 Runtime.evaluate 注入攻击。
 * 在调用 cdpManager.fillForm/executeAction 之前必须先调用此函数。
 *
 * 消毒规则：
 * 1. 转义反引号（` → \`）防止模板字符串注入
 * 2. 移除 ${...} 模板字面量表达式
 * 3. 转义单引号和双引号防止字符串逃逸
 * 4. 过滤 null 字节（\x00）
 *
 * @param {Object} params - 原始参数对象
 * @returns {Object} 消毒后的参数副本
 */
function sanitizeInput(params) {
  if (!params || typeof params !== 'object') return params;

  /**
   * 对单个字符串值执行消毒
   * 注意：不做引号/反引号转义 —— 下游注入点（_buildFieldLookupScript 等）
   * 各自负责 JS 字符串转义；execute_script 等内容作为 CDP 参数传递（非字符串
   * 嵌入），转义只会破坏合法输入（如 CSS 选择器 input[type='submit']）。
   * @param {string} str - 原始字符串
   * @returns {string} 消毒后的字符串
   */
  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    let result = str;
    // 1. 过滤 null 字节
    result = result.replace(/\x00/g, '');
    // 2. 移除 ${...} 模板字面量表达式
    result = result.replace(/\$\{[^}]*\}/g, '');
    return result;
  }

  /**
   * 递归消毒对象的所有字符串值
   * @param {*} value - 要消毒的值
   * @returns {*} 消毒后的值
   */
  function deepSanitize(value) {
    if (typeof value === 'string') return sanitizeString(value);
    if (Array.isArray(value)) return value.map(deepSanitize);
    if (value && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = deepSanitize(value[key]);
      }
      return result;
    }
    return value;
  }

  return deepSanitize(params);
}

/**
 * 脚本静态分析（per D-16 白名单脚本安全）
 *
 * 检测 execute_script 参数中的危险调用，包括 eval、Function、import、
 * require、fs/net/http 模块访问、child_process、process 等。
 *
 * @param {string} script - 要检查的脚本内容
 * @returns {{safe: boolean, reason?: string}} 检查结果
 */
function validateScript(script) {
  if (!script || typeof script !== 'string') {
    return { safe: false, reason: '脚本内容为空' };
  }

  /** 危险模式列表（与 cdp-manager.js DANGEROUS_SCRIPT_PATTERNS 一致） */
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/, name: 'eval' },
    { pattern: /\bnew\s+Function\s*\(/, name: 'new Function' },
    { pattern: /\bimport\s*\(/, name: 'import()' },
    { pattern: /\brequire\s*\(/, name: 'require()' },
    { pattern: /\bfs\./, name: 'fs 模块' },
    { pattern: /\bnet\./, name: 'net 模块' },
    { pattern: /\bhttp\./, name: 'http 模块' },
    { pattern: /\bhttps\./, name: 'https 模块' },
    { pattern: /\bchild_process\b/, name: 'child_process' },
    { pattern: /\bprocess\./, name: 'process 对象' },
    { pattern: /\bexec\s*\(/, name: 'exec' },
    { pattern: /\bspawn\s*\(/, name: 'spawn' },
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(script)) {
      return { safe: false, reason: `检测到危险调用: ${name}` };
    }
  }

  return { safe: true };
}

/**
 * 脚本步骤级静态分析验证（per D-10 严格白名单静态分析）
 *
 * 对 generate_script 工具生成的脚本对象进行步骤级安全验证：
 * 1. 校验 script.steps 存在且为数组
 * 2. 遍历每个 step，验证 step.action 在 SCRIPT_ALLOWED_ACTIONS 白名单中
 * 3. 对 step.target 和 step.options 中的所有字符串值执行危险模式检测
 *
 * 与 validateScript（字符串级检测）不同，此函数操作结构化步骤数组，
 * 在 action 白名单之外还检测嵌入的 JS 危险模式（fetch/XMLHttpRequest/
 * 路径遍历/window/document 访问等）。
 *
 * @param {Object} script - 脚本对象，包含 steps 数组
 * @returns {{safe: boolean, reason?: string, details?: {stepIndex: number, pattern: string}}} 验证结果
 */
function validateScriptForSteps(script) {
  if (!script || !Array.isArray(script.steps)) {
    return { safe: false, reason: '脚本 steps 不存在或不是数组' };
  }

  /** 扩展危险模式列表（覆盖 fetch/XMLHttpRequest/路径遍历/window/document 访问） */
  const dangerousPatterns = [
    // 继承 validateScript 的基础模式
    { pattern: /\beval\s*\(/, name: 'eval' },
    { pattern: /\bnew\s+Function\s*\(/, name: 'new Function' },
    { pattern: /\bimport\s*\(/, name: 'import()' },
    { pattern: /\brequire\s*\(/, name: 'require()' },
    { pattern: /\bfs\./, name: 'fs 模块' },
    { pattern: /\bnet\./, name: 'net 模块' },
    { pattern: /\bhttp\./, name: 'http 模块' },
    { pattern: /\bhttps\./, name: 'https 模块' },
    { pattern: /\bchild_process\b/, name: 'child_process' },
    { pattern: /\bprocess\./, name: 'process 对象' },
    { pattern: /\bexec\s*\(/, name: 'exec' },
    { pattern: /\bspawn\s*\(/, name: 'spawn' },
    // 脚本步骤专用扩展模式
    { pattern: /\bfetch\s*\(/, name: 'fetch 网络请求' },
    { pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
    { pattern: /\.\.\//, name: '路径遍历' },
    { pattern: /\bwindow\.\b/, name: 'window 对象访问' },
    { pattern: /\bdocument\.\b/, name: 'document 对象访问' },
  ];

  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i];

    // 1. 验证 action 在白名单中
    if (!step.action || !SCRIPT_ALLOWED_ACTIONS.includes(step.action)) {
      return {
        safe: false,
        reason: '不允许的操作: ' + (step.action || '(空)'),
        details: { stepIndex: i, pattern: 'action-whitelist' },
      };
    }

    // 2. 对 step.target 和 step.options 中的字符串执行危险模式检测
    const stringsToCheck = [];
    if (typeof step.target === 'string') {
      stringsToCheck.push(step.target);
    }
    if (step.options && typeof step.options === 'object') {
      for (const value of Object.values(step.options)) {
        if (typeof value === 'string') {
          stringsToCheck.push(value);
        }
      }
    }

    for (const str of stringsToCheck) {
      for (const { pattern, name } of dangerousPatterns) {
        if (pattern.test(str)) {
          return {
            safe: false,
            reason: '步骤 ' + (i + 1) + ' 包含危险调用: ' + name,
            details: { stepIndex: i, pattern: name },
          };
        }
      }
    }
  }

  return { safe: true };
}

/**
 * 请求高风险操作确认（per D-05/D-06/D-07）
 *
 * 委托给主进程注入的确认通道（main.js 的 pendingActions 方案，
 * 与渲染端 actionConfirm/actionCancel → action:confirm/cancel IPC 对接）。
 * 未注入时 fail-closed：确认通道未接线，拒绝执行高风险操作而非静默放行。
 *
 * @param {Object} data - 确认请求数据
 * @param {string} data.actionId - 操作唯一 ID
 * @param {string} data.type - 操作类型（submit/upload/execute_script/payment/click）
 * @param {string} data.title - 确认卡片标题
 * @param {string} data.description - 确认卡片描述
 * @param {string} data.url - 目标页面 URL
 * @param {string} data.containerId - 容器 ID
 * @param {string} data.riskLevel - 风险等级（medium/high/critical）
 * @returns {Promise<{confirmed: boolean, reason?: string}>} 用户确认结果
 */
/** @type {null | function(Object): Promise<{confirmed: boolean, reason?: string}>} */
let _actionConfirmationHandler = null;

function requestActionConfirmation(data) {
  if (_actionConfirmationHandler) {
    return _actionConfirmationHandler(data);
  }
  console.error('[Realm AI] 操作确认通道未注入，拒绝高风险操作');
  return Promise.resolve({ confirmed: false, reason: 'no-handler' });
}

/**
 * 通知渲染进程确认操作已完结（驱动确认卡片状态机到终态）
 *
 * 确认卡片在用户点击后停在 executing，需要执行侧在完成后推送终态
 * （success/error）；超时取消由 main.js 推送 cancelled。
 *
 * @param {string|null} actionId - 操作唯一 ID（为空则跳过）
 * @param {'success'|'error'|'cancelled'} state - 终态
 * @param {string} [message] - 结果消息（error 时展示）
 */
function notifyActionSettled(actionId, state, message) {
  if (!actionId) return;
  const mainWindow = windowManager.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('action:settle', { actionId, state, message });
  }
}

// ==================== 常量 ====================

/**
 * 脚本生成系统允许的操作类型白名单
 *
 * 脚本步骤仅允许以下安全的页面交互操作，不包含 screenshot/upload/execute_script
 * 等高风险操作。此白名单独立于 execute_action 的 action enum（execute_action
 * 有 screenshot/upload 等额外操作，脚本中不允许）。
 */
const SCRIPT_ALLOWED_ACTIONS = [
  'navigate', 'click', 'type', 'scroll', 'wait',
  'select', 'check', 'uncheck', 'focus', 'blur',
  'submit', 'keydown', 'keyup',
];

/**
 * 提供商 → 环境变量映射表
 * 基于 pi-ai SDK env-api-keys.js，覆盖 15+ 提供商的约定环境变量名。
 * detectEnvVar() 优先使用用户自定义环境变量名，其次查此映射表。
 */
const PROVIDER_ENV_MAP = {
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  together: 'TOGETHER_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  xiaomi: 'XIAOMI_API_KEY',
  'azure-openai-responses': 'AZURE_OPENAI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  cohere: 'COHERE_API_KEY',
  baseten: 'BASETEN_API_KEY',
  'qwen-token-plan-individual': 'QWEN_TOKEN_PLAN_API_KEY',
};

// ==================== 脚本执行引擎 ====================

/**
 * 页面 load 事件等待超时（毫秒）
 * navigate 操作或 step.waitFor === 'load' 时，等待页面 loadEventFired 事件，
 * 超时后继续执行下一步（per D-04 自动等待 load 事件）
 */
const SCRIPT_LOAD_WAIT_TIMEOUT = 5000;

/**
 * 脚本执行引擎：逐步执行脚本步骤
 *
 * 遍历 script.steps，对每个步骤：
 * 1. 调用 onStepUpdate 通知渲染进程当前步骤状态
 * 2. 对步骤参数执行 sanitizeInput 消毒
 * 3. 调用 cdpManager.executeAction 执行操作
 * 4. navigate 操作或 waitFor === 'load' 时等待页面 load 事件
 * 5. 步骤失败时自动停止，返回错误信息
 *
 * 支持 abortSignal 中断：用户可通过 script:stop IPC 随时停止执行。
 *
 * @param {Object} script - 脚本对象，包含 steps 数组
 * @param {number} webContentsId - 活跃标签页的 webview guest webContents ID
 * @param {function} onStepUpdate - 步骤状态回调，参数为 { index, status, step?, result?, error? }
 * @param {AbortSignal} [abortSignal] - 中断信号
 * @returns {Promise<{success: boolean, results?: Array, stoppedAt?: number, error?: string, aborted?: boolean}>}
 */
async function executeScript(script, webContentsId, onStepUpdate, abortSignal) {
  const results = [];

  for (let i = 0; i < script.steps.length; i++) {
    // 检查中断信号
    if (abortSignal && abortSignal.aborted) {
      onStepUpdate({ index: i, status: 'aborted', error: '用户已停止执行' });
      return { success: false, stoppedAt: i, error: '用户已停止执行', aborted: true, results };
    }

    const step = script.steps[i];

    // 通知渲染进程：当前步骤开始执行
    onStepUpdate({ index: i, status: 'executing', step });

    try {
      // 输入消毒（per D-13）
      const sanitizedStep = sanitizeInput(step);

      // 调用 cdpManager.executeAction 执行步骤
      const result = await cdpManager.executeAction(
        webContentsId,
        sanitizedStep.action,
        sanitizedStep.target,
        sanitizedStep.options
      );

      if (!result.success) {
        // 步骤失败：通知渲染进程并停止执行
        onStepUpdate({ index: i, status: 'error', error: result.error || '操作执行失败' });
        return { success: false, stoppedAt: i, error: result.error || '操作执行失败', results };
      }

      // 步骤成功
      results.push(result);
      onStepUpdate({ index: i, status: 'success', result });

      // navigate 操作或 waitFor === 'load' 时，等待页面加载稳定（per D-04）
      // 使用 setTimeout 兜底超时，避免阻塞执行流程
      if (sanitizedStep.action === 'navigate' || sanitizedStep.waitFor === 'load') {
        console.log(`[Realm AI] 脚本步骤 ${i + 1}: 等待页面加载 (${SCRIPT_LOAD_WAIT_TIMEOUT}ms)`);
        await new Promise(resolve => setTimeout(resolve, SCRIPT_LOAD_WAIT_TIMEOUT));
      }
    } catch (err) {
      // 异常捕获：通知渲染进程并停止执行
      console.error(`[Realm AI] 脚本步骤 ${i + 1} 执行异常:`, err.message);
      onStepUpdate({ index: i, status: 'error', error: err.message });
      return { success: false, stoppedAt: i, error: err.message, results };
    }
  }

  return { success: true, results };
}

/**
 * AI 助手系统提示词
 * 定义 AI 在 Realm Browser 中的角色和能力边界
 */
const REALM_SYSTEM_PROMPT = `你是 Realm Browser 的 AI 助手。你可以帮助用户管理浏览器标签页、查看当前状态、读取网页内容、提取链接等。

关于「技能（Skill）」：技能与工具（Tool）是两个不同的概念 —— 工具是你可直接调用的函数；技能是一份按需读取的指令文档 / 工作流。可用技能的清单里只有它的 name、description 与 location（SKILL.md 的绝对路径），**正文不在提示词里**，需要你用 read 工具打开该 location 才能看到。未被用户显式调用（/skill:名字）时，你不会自动获得任何技能的正文；当用户的请求与某个技能的 description 匹配时，请先 read 它的 location 读取正文，再按正文的指引行事。

你的能力：
- get_tabs: 获取当前所有标签页列表
- search_history: 搜索浏览历史记录，支持按 URL 和标题模糊匹配，支持时间范围筛选。默认使用当前活跃容器，也可通过 containerId 参数指定特定容器。
- list_history: 列出浏览历史记录，支持分页和时间范围筛选。当用户说"查看历史记录"、"列出今天的历史"、"查看昨天的浏览记录"时使用此工具。支持按页码和每页条数分页，也支持按日期筛选（date 参数格式 YYYY-MM-DD）。默认使用当前活跃容器，也可通过 containerId 参数指定特定容器。
- delete_history: 删除历史记录，支持删除单条或批量删除。当用户说"删除这条历史记录"、"删除选中的历史记录"、"清空今天的浏览记录"时使用此工具。默认使用当前活跃容器，也可通过 containerId 参数指定特定容器。
- manage_favorites: 管理收藏夹（添加、查看[支持按文件夹筛选和分页]、删除[单条/批量]、修改标题、移动收藏到文件夹、重排文件夹内顺序、文件夹增删改查[创建/重命名/删除/列表/树]、查找空文件夹）
- search_favorites_fulltext: 使用全文检索搜索收藏夹中的页面，支持中文分词。当用户说"搜索收藏 XXX"或"找收藏 XXX"时使用此工具。
- organize_favorites: 整理收藏夹。生成归类方案（domain 按域名 / category AI 语义分类 / flat 移入单文件夹），支持 scope 指定仅根目录或含子文件夹。方案以卡片展示给用户确认，用户点击「应用整理」后收藏才会实际移动。当用户说"整理收藏夹"、"归类收藏"、"按域名/类别整理收藏"时使用此工具。
- switch_container: 切换当前容器
- read_page_content: 读取当前标签页的页面内容，包括标题、正文、元信息和 Open Graph 数据。用于理解用户正在浏览的网页。
- extract_links: 提取当前页面的所有有效链接，自动过滤非 HTTP 协议和锚点链接。用于收集页面中的所有可导航链接。
- open_link: 在指定容器中打开一个链接，支持在当前标签页或新标签页中打开。默认使用当前活跃容器和新标签页。
- fill_form: 自动填写网页表单。参数格式为 fields 数组，每个元素包含 field（字段名称）和 value（填写值）。低风险操作自动执行，文件上传需要用户确认。执行前会自动检测 CAPTCHA/2FA 验证码，检测到时暂停并提示用户手动完成验证。
- execute_action: 在当前页面执行操作（点击、滚动、提交等）。参数格式为 action + target + options。低风险操作自动执行，表单提交、文件上传、脚本执行、支付操作需要用户确认。执行前会自动检测 CAPTCHA/2FA 验证码，检测到时暂停并提示用户手动完成验证。
- generate_script: 根据自然语言描述生成可执行的自动化脚本。脚本由步骤序列组成，每个步骤复用 execute_action 的操作能力（click/type/scroll/wait 等）。生成的脚本会经过安全验证，包含危险操作的脚本会被拦截。
- suggest_tab_groups: 分析当前标签页并生成智能分组建议。支持按域名、语义或混合策略分组。当用户说"整理标签页"、"帮我分组标签页"、"归类标签页"时使用此工具。
- apply_tab_groups: 提交结构化的标签分组结果。完成语义分组后必须调用此工具提交分组，分组会以卡片形式展示给用户确认，用户点击「应用分组」后标签页才会实际重排。
- close_tab: 关闭指定 ID 的标签页。先用 get_tabs 获取标签页 ID，再调用此工具关闭。
- close_tabs: 批量关闭标签页。action=list 按 tabIds 列表关闭（可跨窗口）；action=others/left/right 以 tabId 为锚点关闭同窗口内其他/左侧/右侧全部标签页（如"关闭其他标签页"、"关闭右侧所有标签页"）。
- switch_tab: 切换到指定 ID 的已打开标签页。先用 get_tabs 获取标签页 ID，再调用此工具切换；目标是其他窗口的标签页时，该窗口会被带到前台。

使用指南：
- 当用户询问"当前页面是什么"、"读取页面内容"等，使用 read_page_content
- 当用户询问"页面有哪些链接"、"提取链接"等，使用 extract_links
- 当用户要求打开链接或网址时，一律使用 open_link：默认新标签页打开（newTab 省略或为 true）；用户明确要求"在当前标签页打开"时设 newTab 为 false；containerId 省略时使用当前活跃容器
- 当用户要求搜索收藏时，使用 search_favorites_fulltext 进行全文检索
- 当用户要求查看历史记录时，使用 list_history。默认使用当前活跃容器；如果用户指定了特定容器，通过 containerId 参数传入
- 当用户要求搜索历史记录时，使用 search_history。默认使用当前活跃容器；如果用户指定了特定容器，通过 containerId 参数传入
- 当用户要求删除历史记录时，使用 delete_history。默认使用当前活跃容器；如果用户指定了特定容器，通过 containerId 参数传入
- 历史记录相关工具（search_history、list_history、delete_history）的 containerId 参数是可选的：省略时自动使用当前活跃容器，用户明确指定容器时传入该参数
- 当用户要求填写表单（如"帮我填邮箱"、"填写注册表单"）时，使用 fill_form
- 当用户要求执行页面操作（如"点击提交按钮"、"滚动到底部"）时，使用 execute_action
- 用户消息中可能附带 <referenced-tab> 块：这是用户通过 @ 显式引用的标签页内容（含标题、URL、正文）。请直接基于这些已提供的内容回答，不要再调用 read_page_content 读取当前页面
- 【禁止】不得为了读取某个页面的内容而调用 open_link 打开它、或把当前标签页导航到该 URL——这会破坏用户正在浏览的页面。若 <referenced-tab> 块的内容为空，直接告知用户「该页面内容提取失败」，建议用户切换到该标签页后重试，而不是自行打开
- open_link 的 newTab:false（在当前标签页打开）仅在用户明确要求「在当前标签页打开」时使用；其余情况一律新标签页
- 这些工具需要访问页面的调试器，如果提示"DevTools 已打开"，请让用户关闭开发者工具后重试
- read_page_content 返回内容若包含截断标记，回复时明确告知用户内容已截断及原始长度
- fill_form 的 field 参数支持 label 文本、placeholder、aria-label、name、id 或 CSS 选择器
- 用户常用口语化字段名（如"邮箱"、"用户名"、"密码"），而页面实际是英文 label（如 "Username or email address"）。调用 fill_form 前应先根据页面语境推断真实字段标识；若 fill_form 返回字段未找到，必须查看返回结果中的 availableFields 列表，挑出语义最接近的字段名立即重试（例如用户说"邮箱"，列表中有 "Username or email address"，就用它重试），不要直接报错放弃
- 当 fill_form/execute_action 返回 cancelled（用户取消或确认超时）时，确认只能由用户在确认卡片上完成，不要口头二次询问"是否确认"。直接告知用户操作未执行的原因（已取消/确认超时），并按用户指示重新发起操作
- execute_action 支持的操作类型：click、scroll、type、select、check、uncheck、focus、blur、submit、upload、drag、hover、keydown、keyup、execute_script、screenshot、wait_for_element（其中 screenshot、execute_script、keydown、keyup 无需 target，scroll 无需 target 时默认滚动整页，也可传 target:"window" 或 "page"）
- keydown 是一次完整按键（keydown+keypress+keyup，与真实按键一致，事件保证送达页面）。在输入框发送消息：先 focus 输入框再 keydown Enter；若站点要求 Ctrl+Enter，传 options.ctrl: true
- screenshot 操作支持 fullPage 参数：当用户要求"完整页面截图"、"整个网页截图"、"滚动截图"、"全页面截图"等类似表述时，设置 options.fullPage 为 true；普通截图（如"截图"、"当前屏幕截图"）不需要设置此参数
- 当用户描述一个自动化任务（如"每天早上打开新闻网站"、"帮我自动填写这个表单"、"生成一个脚本做 XXX"）时，使用 generate_script
- generate_script 的步骤格式为 {action, target, options, waitFor}，action 仅支持 navigate/click/type/scroll/wait/select/check/uncheck/focus/blur/submit/keydown/keyup
- generate_script 返回的脚本会在聊天中渲染为预览卡片，用户可以编辑每个步骤后再执行
- 当用户要求整理标签页、分组标签页时，使用 suggest_tab_groups 分析标签页。默认使用 semantic 策略；用户要求按域名分组时使用 domain 策略。若返回的是待分组标签数据而非分组结果（semantic/mixed 策略），完成分组后必须调用 apply_tab_groups 提交结构化分组（groups 数组，每组 { name, tabs: [{ id }] }，id 取自返回的 tabs 数据），分组卡片会展示给用户确认
- 你不需要也不能直接移动标签页——实际重排由用户在分组卡片上点击「应用分组」后执行，你的职责是完成分组并调用 apply_tab_groups 提交，不要认为或声称自己没有整理标签页的权限
- 当用户要求关闭标签页（如"关掉这个页面"、"关闭 XX 网站的标签页"、"把多余的标签页都关了"）时，使用 close_tab：先用 get_tabs 核对目标标签页的 id 再关闭。仅关闭用户明确要求关闭的标签页，不要自行批量关闭；若用户按网站/主题描述目标，先列出匹配的标签页让用户确认再关闭
- 当用户要求批量关闭（如"关闭其他标签页"、"关闭右侧全部"、"把这两个页面都关了"）时，使用 close_tabs："关闭其他"用 action=others；"关闭左侧/右侧全部"用 action=left/right（锚点 tabId 为用户所指的那个标签页）；用户明确列出多个标签页时用 action=list。锚点式批量关闭会波及大量标签页，若用户未明确范围（如只说"关掉一些"），先确认范围再执行
- 批量关闭必须收敛为一次 close_tabs 调用：把全部待关标签页放进一次请求（tabIds 一次列全，或一次 others/left/right），不要拆成多次 close_tab/close_tabs 分批关闭。close_tabs 会自动弹出确认卡片列出全部待关标签页，用户在卡片上点「确认执行」才会关闭——不要在聊天里打字询问确认，也不要确认后二次确认；用户取消时告知操作未执行即可。若用户未明确范围（如只说"关掉一些"），先在聊天里问清范围再调用
- 当用户要求切换标签页（如"切到 XX 网站那个标签页"、"回到刚才打开的页面"）时，使用 switch_tab：先用 get_tabs 按标题/URL 匹配目标标签页，再切换；用户描述模糊且有多个候选时，列出候选让用户选择
- 当用户要求整理收藏夹、归类收藏时，使用 organize_favorites。默认 root 范围 + domain 策略可由工具直接生成方案；category 策略会返回收藏数据（bookmarks），你必须根据标题和 URL 语义分类，完成后调用 organize_favorites(action=apply) 提交 plan（数组，每组 { folderName, parentId: 0, bookmarkIds: [收藏id] }，id 取自返回数据）
- 收藏整理的实际移动由用户在整理卡片上点击「应用整理」后执行，你的职责是生成并提交方案，不要声称自己没有整理收藏夹的权限
- 删除整个收藏夹文件夹（其中收藏和子文件夹会被一并删除）前会弹出确认卡片，必须由用户在确认卡片上确认，确认被取消时不要口头二次询问
- 删除多个文件夹（如整理后的空文件夹清理）时，必须用 delete-folder 的 ids 参数一次性批量提交，多个文件夹只弹一次确认；查找空文件夹用 find-empty-folders 一次查询即可，不要逐个 folderId 调 get 判断是否为空
- 当用户要求调整收藏顺序（如"把 XX 移到最前面"、"按访问时间排序"）时，使用 manage_favorites(action=reorder)：先用 get(folderId=X) 获取该文件夹当前列表，再把全部收藏 id 按目标顺序作为 ids 数组一次性提交。排序不能跨文件夹，不同文件夹需分别调用

请用简洁、专业的语气回答用户问题。当需要执行操作时，使用提供的工具函数。`;

/**
 * 构建 agent 工作区 system prompt 段（文件/Bash 工具的使用边界说明）
 *
 * 白名单具体内容不进 prompt（实时变化会破坏 prompt 冻结语义，确认卡片
 * /拒绝消息本身就是反馈通道）。同步函数，Agent 创建时冻结拼入。
 *
 * @returns {string} workspace 段文本
 */
function buildWorkspacePrompt() {
  const workspaceDir = getAgentWorkspaceLazy().getWorkspaceDir();
  return [
    '## 文件与命令工具（agent 工作区）',
    `- 你的专属工作目录（agent 根目录）：${workspaceDir}`,
    '- read/write/edit 工具只能访问该目录内的文件，访问外部路径会被直接拒绝（硬沙箱），不要尝试访问工作区外的路径',
    '- bash 命令的工作目录固定为该目录；命中白名单的命令自动执行，其余命令会向用户弹出确认卡片；危险命令（rm/sudo 等）即使描述得再安全也会弹确认',
    '- 安全责任边界：涉及 rm 等危险命令时，直接调用 bash 工具发起请求即可——系统会弹出确认卡片、由用户点击决策，不要因为命令危险就拒绝调用工具或用文字代替执行；也不要替用户预设确认结果（确认被拒时工具结果会告诉你）',
    '- 确认被用户拒绝时，不要反复重试同一命令，改用其他方案或询问用户',
    '- 约定：所有落盘数据（导出、抓取结果、生成的文件）一律写入工作目录内，用相对路径或该绝对路径',
    '- ai-memory 与 .tmp 子目录由系统使用，bash 操作时避免改动 .tmp',
    '- attachments 子目录存放用户在聊天框拖入/粘贴的附件快照，可直接 read；消息里的 [attached_file: 路径] / [attached_image: 路径] marker 指向这些快照',
  ].join('\n');
}

/**
 * 构建完整 system prompt（REALM_SYSTEM_PROMPT + workspace 段 + 全局两层记忆冻结快照 + 技能段）
 *
 * 快照在 Agent 创建时一次性拼入（D-04 冻结语义：会话内不变，保前缀缓存）。
 * buildGlobalSnapshot / buildSkillsPrompt 均为同步函数——Agent 创建路径上
 * 不可异步化（G-42-4 实录）。
 * init() 与 _recreateAgent() 两处 Agent 创建点都必须经此函数（漏一处即
 * 部分会话无记忆快照 / 无技能段）。
 *
 * 段顺序（D-01）：技能段**固定在末段**，前三段全静态——技能集变更只影响
 * 末尾，冻结记忆段的前缀缓存边界不受影响。空技能集时整段不追加（D-02：
 * 不产生空标签、不留多余空行）。技能段文本原样使用 SDK
 * formatSkillsForSystemPrompt 的返回值，不加中文前缀。
 *
 * @returns {string} 完整 system prompt
 */
function buildSystemPrompt() {
  const base = REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot();
  const skillsBlock = getAiSkillsManagerLazy().buildSkillsPrompt();
  return skillsBlock ? base + '\n\n' + skillsBlock : base;
}

/** 上下文裁剪：保留最近的消息数量 */
const MAX_CONTEXT_MESSAGES = 20;

/** /compact 摘要生成的系统提示（LLM 只输出摘要本身，不续写对话） */
const SUMMARY_SYSTEM_PROMPT = '你是对话上下文压缩助手。阅读一段用户与 AI 助手的对话记录，输出一份结构化摘要，供另一个 LLM 在后续对话中作为上下文使用。不要续写对话，不要回答对话中的任何问题，只输出摘要本身。';

/** /compact 保留原文的最近轮数（一轮 = 一条 user 消息及其后所有回复） */
const COMPACT_RECENT_TURNS = 4;

/**
 * read_page_content 正文截断阈值
 * D-07：覆盖 99%+ 网页。单位按 JS string.length（UTF-16 code unit）计数字符而非字节
 */
const MAX_CONTENT_SIZE = 100 * 1024;

/**
 * 解析工具目标标签页并定位其 webview guest webContents ID
 *
 * 主进程 tab 对象不维护 webContentsId，仅活跃标签页的 guest ID 可经
 * 渲染进程上报值定位；指定非活跃 tabId 时明确报错（后续版本建立
 * tabId→guestId 映射后可扩展支持）。
 *
 * @param {string|undefined} requestedTabId - 工具参数中的 tabId（可选）
 * @returns {{tab: Object, webContentsId: number}} 目标 tab 与 guest ID
 * @throws {Error} 标签页不存在、非活跃或 webview 未就绪时抛出
 * @private
 */
function resolveToolTargetTab(requestedTabId) {
  const activeTab = tabManager.getActiveTab();
  const tabId = requestedTabId || (activeTab && activeTab.id);
  const tab = tabId ? tabManager.getTab(tabId) : null;
  if (!tab) {
    throw new Error('标签页不存在');
  }
  if (!activeTab || tab.id !== activeTab.id) {
    throw new Error('暂仅支持当前活跃标签页，非活跃标签页的页面内容无法定位');
  }
  // 页面未加载（新建 tab url 为空）：按 22-UI-SPEC 文案报错
  if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://') && !tab.url.startsWith('file://') && !tab.url.startsWith('realm://'))) {
    throw new Error('当前标签页未加载页面，请先打开网页');
  }
  const webContentsId = getActiveWebviewContentsIdLazy();
  if (!webContentsId) {
    throw new Error('标签页 webview 尚未就绪，请稍后重试');
  }
  return { tab, webContentsId };
}

// ==================== AI Manager ====================

/**
 * AI Manager - 管理 AI Agent 实例和 LLM 连接
 *
 * 负责：
 * - 初始化 pi-ai Models 实例（连接 LLM 提供商）
 * - 创建 pi-agent-core Agent 实例（管理对话和工具执行）
 * - 注册 Realm 工具（get_tabs 等）
 * - 处理用户消息和取消操作
 *
 * 初始化流程（init 方法）：
 * 1. 从 configStore 读取 OpenAI API Key
 * 2. 创建 InMemoryCredentialStore 并写入 API Key
 * 3. 创建 builtinModels 实例（注册所有内置提供商）
 * 4. 构建 Realm 工具列表（get_tabs）
 * 5. 创建 Agent 实例（绑定 systemPrompt、model、tools、streamFn）
 */
class AIManager {
  /**
   * 注入主进程的操作确认处理函数（避免 ai-manager → main 循环依赖）
   * @param {function(Object): Promise<{confirmed: boolean, reason?: string}>} fn - main.js 的 requestActionConfirmation
   */
  static setActionConfirmationHandler(fn) {
    _actionConfirmationHandler = fn;
  }

  constructor() {
    /** @type {Object|null} pi-ai Models 实例 */
    this.models = null;
    /** @type {Object|null} pi-agent-core Agent 实例 */
    this.agent = null;
    /** @type {Array} 已注册的工具列表 */
    this.tools = [];
    /** @type {Object|null} electron-store 配置实例 */
    this.configStore = null;
    /** @type {boolean} 是否已成功初始化 */
    this.isInitialized = false;
    /** @type {boolean} 是否正在处理消息（防止并发调用） */
    this.isProcessing = false;
    /** @type {string|null} 当前激活提供商 ID */
    this.activeProvider = null;
    /** @type {string|null} 当前激活模型 ID */
    this.activeModelId = null;
    /** @type {string|null} 当前对话 ID */
    this.currentConversationId = null;
    /** @type {Object} 当前对话元数据 */
    this.conversationMeta = {};
    /** @type {Object|null} SDK 内置工具工厂（init 动态 import 后缓存） */
    this._sdkFileTools = null;
    /** @type {Object|null} 沙箱 ExecutionEnv（文件/Bash 工具共用） */
    this.sandboxEnv = null;
    /**
     * @type {Map<string, {dir: string, srcDir: string, preview: object, createdAt: number, origin: string}>}
     *
     * 技能导入的两阶段句柄表（Phase 51 D-02）—— **不透明 `importId` 而非路径**：
     * 客户端永远不能指定落点，这是接口设计边界（镜像 ARCHITECTURE Anti-Pattern 1，
     * 沙箱兜不住后续任何一处疏漏）。preview 阶段建临时目录并登记，commit 阶段只收
     * `importId`。TTL 清扫与并发上限由 51-04 消费 `IMPORT_LIMITS` 落地。
     */
    this._skillImports = new Map();
    /**
     * @type {boolean} 忙时收到的技能集变更标记（D-03）
     *
     * 流式处理中不得改写 system prompt（当前轮的 createContextSnapshot 已取值，
     * 改写对当前轮无效且让状态机难以推理）。此时只置脏，由延迟补刷的**唯一实现**
     * `_flushDeferredSkillsPrompt()` 消费 —— `prompt()` 与 `promptWithContext()`
     * 两个**成功出口**各共用一次（含纯文本轮）；打开面板（`refreshSkillsForPanel`）
     * 与 Agent 创建或重建各走自己的同步入口。
     */
    this._skillsPromptDirty = false;
    /**
     * @type {string} 上一次**已应用**的技能集摘要（getSkillsSnapshot().digest）
     *
     * 作「技能集是否变化」的快速判定主键；仅当它与当前 digest 相同**且**
     * buildSystemPrompt() 与 agent.state.systemPrompt 逐字符相同才早退
     * （不写、不广播），以保 provider 的前缀缓存。
     */
    this._skillsPromptDigest = '';
    /**
     * @type {Map<string, {action: string, name: string, tier?: string, code?: string, promptIncluded?: boolean}>}
     * `manage_skill` 一次工具执行的**短期**元数据（Phase 49 D-02），键 = `toolCallId`
     *
     * **为什么需要它**：SDK 在工具 `throw` 时走 `createErrorToolResult(message)`
     * （`agent-loop.js:519-524`），产出的 `result.details` **恒为 `{}`** —— 失败态的
     * `code` / `tier` 若经 `details` 传递等于永远丢给渲染端（RESEARCH Pitfall 3 /
     * UI-SPEC 硬约束 2）。故两条路径**统一**从本 Map 取标记输入：
     * `_buildManageSkillTool` 的 `execute` 在成功与失败**两个出口**各写一次，
     * `tool_execution_end` 经 `_resolveManageSkillTerminal()` **读后即删** ——
     * 不跨轮累积、不越过一次工具执行的生命周期。
     */
    this._manageSkillMeta = new Map();
    /** @type {Object|null} SDK compaction 工具缓存（calculateContextTokens/estimateTokens，init 动态 import） */
    this._contextUsageFns = null;
  }

  /**
   * 初始化 AI Manager
   *
   * 流程：
   * 1. 迁移旧版单 OpenAI 配置（ai.apiKey → ai.providers.openai）
   * 2. 读取 ai.providers 中所有已配置提供商，注入各自的 API Key
   * 3. 创建 pi-ai Models 实例（builtinModels，注册全部内置提供商）
   * 4. 按 ai.activeProvider + 提供商的 model 配置确定使用模型
   * 5. 构建 Realm 工具列表并创建 Agent 实例
   *
   * 注意：builtinModels 从 '@earendil-works/pi-ai/providers/all' 导出，
   * 包根入口不导出该函数（曾导致初始化必败的隐性 bug）。
   *
   * @param {Object} configStore - electron-store 实例，用于读取 AI 配置
   * @returns {Promise<void>}
   */
  async init(configStore) {
    this.configStore = configStore;

    // 迁移旧版配置
    this._migrateLegacyConfig();

    const providersCfg = configStore.get('ai.providers', {});
    // 已配置判定含环境变量回退：存储无 Key 但环境变量可解析的供应商也可用
    const configuredIds = Object.keys(providersCfg).filter(
      id => this._isProviderConfigured(id, providersCfg[id])
    );

    if (configuredIds.length === 0) {
      console.log('[Realm AI] 未配置任何提供商 API Key，跳过初始化');
      this.isInitialized = false;
      return;
    }


    try {
      // 动态导入 ESM-only 的 pi 包
      // pi-ai 和 pi-agent-core 的 package.json 声明 "type": "module"，
      // CommonJS 的 require() 无法加载，必须用动态 import()
      const { builtinModels } = await import('@earendil-works/pi-ai/providers/all');
      const { InMemoryCredentialStore, createProvider, envApiKeyAuth } = await import('@earendil-works/pi-ai');
      // openAICompletionsApi 不从主入口导出，需从子路径导入（同内置 provider 的用法）
      const { openAICompletionsApi } = await import('@earendil-works/pi-ai/api/openai-completions.lazy');
      const { Agent } = await import('@earendil-works/pi-agent-core');
      // 上下文用量统计工具（compaction 模块导出，getContextUsage 同步用，init 缓存）
      const { calculateContextTokens, estimateTokens } = await import('@earendil-works/pi-agent-core');
      this._contextUsageFns = { calculateContextTokens, estimateTokens };
      // SDK 内置文件/Bash 工具工厂（AgentHarnessTool，经 _adaptHarnessTool 适配）
      const { createReadTool, createWriteTool, createEditTool, createBashTool } =
        await import('@earendil-works/pi-agent-core');
      this._sdkFileTools = { createReadTool, createWriteTool, createEditTool, createBashTool };

      // 创建凭证存储并注入所有已配置提供商的 API Key
      // CredentialStore 是 pi-ai 的标准认证机制：每个 provider 一个凭证条目
      // Key 经 _resolveProviderKey 动态解析：环境变量 > 已保存 Key
      const credentialStore = new InMemoryCredentialStore();
      for (const providerId of configuredIds) {
        await credentialStore.modify(providerId, async () => ({
          type: 'api_key',
          key: this._resolveProviderKey(providerId, providersCfg[providerId]),
        }));
      }

      // 创建 Models 实例（注册所有内置提供商）
      this.models = builtinModels({
        credentials: credentialStore,
      });

      // 注册自定义供应商：pi-ai 内置目录不含这些 id，
      // 按 OpenAI 兼容协议动态构造 provider 注册进 Models，
      // 否则 getModel 返回 undefined，Agent 初始化失败报「AI 助手未初始化」。
      // 判定按「id 是否在内置目录」（getProvider 查不到即自定义），
      // 不依赖 configStore 的 isBuiltin 字段——该字段可能被历史数据写坏
      for (const providerId of configuredIds) {
        const cfg = providersCfg[providerId];
        if (!cfg) continue;
        if (this.models.getProvider(providerId)) continue;  // 内置已注册
        if (!cfg.baseURL) {
          console.warn(`[Realm AI] 自定义供应商 ${providerId} 缺少 baseURL，跳过注册`);
          continue;
        }
        const customModels = Array.isArray(cfg.customModels) ? cfg.customModels : [];
        const providerModels = customModels.map(id => ({
          id,
          name: id,
          api: 'openai-completions',
          provider: providerId,
          baseUrl: cfg.baseURL,
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 8192,
        }));
        this.models.setProvider(createProvider({
          id: providerId,
          name: cfg.displayName || providerId,
          baseUrl: cfg.baseURL,
          auth: { apiKey: envApiKeyAuth(cfg.displayName || providerId, cfg.envVarName ? [cfg.envVarName] : []) },
          models: providerModels,
          api: openAICompletionsApi(),
        }));
        console.log(`[Realm AI] 自定义供应商已注册: ${providerId} (${providerModels.length} 个模型)`);
      }

      // 视觉专用模型描述器（Vision Bridge）：主模型不支持图片时把附件图片
      // 经 ai.visionModel 指向的视觉模型转写为文字描述。每次 init 重建
      // （持有 this.models 引用，供应商/模型集合可能已变化）
      this.visionDescriber = new VisionDescriber({ models: this.models, configStore });

      // 确定激活提供商：优先 ai.activeProvider，须已配置且未禁用；否则取第一个可用项
      // 禁用的供应商保留存储记录（ai.activeProvider 不改写），仅在运行时被跳过，
      // 重新启用后自动恢复为激活供应商
      const enabledIds = configuredIds.filter(id => providersCfg[id].enabled !== false);
      const savedActive = configStore.get('ai.activeProvider');
      const activeProvider = savedActive && enabledIds.includes(savedActive)
        ? savedActive
        : enabledIds[0];

      if (!activeProvider) {
        console.log('[Realm AI] 已配置供应商均被禁用，跳过初始化');
        this.isInitialized = false;
        return;
      }

      // 确定模型：提供商配置中的 model，否则取该提供商目录中的第一个模型
      const providerCfg = providersCfg[activeProvider];
      const providerModels = this.models.getModels(activeProvider);
      const modelId = providerCfg.model || (providerModels[0] && providerModels[0].id);

      const model = modelId ? this.models.getModel(activeProvider, modelId) : null;
      if (!model) {
        console.error(`[Realm AI] 未找到模型 ${activeProvider}/${modelId}`);
        this.isInitialized = false;
        return;
      }

      // 创建沙箱 ExecutionEnv（文件/Bash 工具共用；cwd = agent 工作区根目录）
      this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();

      // 刷新技能集（D-04：每次 Agent 创建前无条件重扫；managed 先、user 后）
      // configStore 注入式读取（manager 侧零 configStore 依赖）
      await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
        disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
        rootDirs: [
          getAgentWorkspaceLazy().getManagedSkillsDir(),
          getAgentWorkspaceLazy().getSkillsDir(),
        ],
      });

      // 构建工具列表
      this.tools = this._buildRealmTools();

      // 创建 Agent 实例
      // Agent 需要：
      // - streamFn: 绑定 Models 的 streamSimple 方法（流式 LLM 调用）
      // - initialState.systemPrompt: 系统提示词
      // - initialState.model: 使用的 LLM 模型
      // - initialState.tools: 可用工具列表
      // - convertToLlm: 消息格式转换（过滤非 user/assistant/toolResult 角色）
      // - transformContext: 上下文裁剪（保留最近消息）
      this.agent = new Agent({
        initialState: {
          systemPrompt: buildSystemPrompt(),
          model,
          tools: this.tools,
        },
        streamFn: this.models.streamSimple.bind(this.models),
        convertToLlm: (messages) => {
          // 过滤消息，只保留 LLM 能理解的角色类型
          return messages.filter(msg =>
            msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult'
          );
        },
        transformContext: this._compactContext.bind(this),
      });

      // 新 Agent 的 systemPrompt 已包含当前技能段 —— 记录对应 digest，使首次
      // syncAgentSystemPrompt() 走「无变化」早退，不做无意义的改写与广播（WR-03）
      this._skillsPromptDigest = getAiSkillsManagerLazy().getSkillsSnapshot().digest;

      this.isInitialized = true;
      this.activeProvider = activeProvider;
      this.activeModelId = model.id;

      // 设置事件广播（per D-05~D-08）
      this._setupEventBroadcasting();

      // 初始化对话存储（per D-01）
      try {
        conversationStore.initDatabase();
      } catch (err) {
        console.error('[Realm AI] 对话存储初始化失败:', err.message);
      }

      // 不再启动时急切创建默认对话（per D-06 修订 / G-42-1）：
      // 对话行仅在首条用户消息（_ensureConversation 惰性建行）或
      // 用户显式点「新对话」时产生，启动零对话行，「暂无对话」空状态可达。

      console.log(`[Realm AI] AI Manager 初始化完成: ${activeProvider}/${model.id}`);
    } catch (err) {
      console.error('[Realm AI] 初始化失败:', err.message);
      this.isInitialized = false;
    }
  }

  /**
   * 迁移旧版单 OpenAI 配置到多提供商结构
   * ai.apiKey → ai.providers.openai.apiKey（模型默认 gpt-4o-mini）
   * @private
   */
  _migrateLegacyConfig() {
    const legacyKey = this.configStore.get('ai.apiKey');
    if (!legacyKey) return;

    const providers = this.configStore.get('ai.providers', {});
    if (!providers.openai) {
      providers.openai = {
        apiKey: legacyKey,
        model: 'gpt-4o-mini',
        isBuiltin: true,
        envVarName: 'OPENAI_API_KEY',
        customModels: [],
      };
      this.configStore.set('ai.providers', providers);
      if (!this.configStore.get('ai.activeProvider')) {
        this.configStore.set('ai.activeProvider', 'openai');
      }
      console.log('[Realm AI] 已迁移旧版 OpenAI 配置到 ai.providers');
    }
    this.configStore.delete('ai.apiKey');
  }

  /**
   * 获取（或惰性创建）用于枚举提供商/模型的目录实例
   * 目录枚举不依赖初始化状态——设置页在任何时刻都需要完整提供商列表。
   * 注意：catalog 必须是纯净的内置目录（独立实例），不能复用 this.models——
   * init 会把自定义供应商 setProvider 注册进 this.models，
   * 复用会导致 getAvailableModels 把自定义供应商误判为内置（isBuiltin: true）。
   * @returns {Promise<Object>} pi-ai Models 实例
   * @private
   */
  async _getCatalog() {
    if (!this._catalogPromise) {
      this._catalogPromise = (async () => {
        const { builtinModels } = await import('@earendil-works/pi-ai/providers/all');
        const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');
        return builtinModels({ credentials: new InMemoryCredentialStore() });
      })().catch(err => {
        this._catalogPromise = null;  // 允许重试，避免永久缓存拒绝状态
        throw err;
      });
    }
    return this._catalogPromise;
  }

  /**
   * 发送用户消息给 AI Agent
   *
   * 调用 agent.prompt() 触发一轮对话，Agent 可能会调用工具（如 get_tabs），
   * 然后基于工具结果生成回复。事件通过 _setupEventBroadcasting() 统一广播到渲染进程。
   *
   * 错误处理策略（per D-10~D-12）：
   * - 自动重试 3 次，指数退避（1s, 2s, 4s）
   * - 错误事件广播到渲染进程（per D-11）
   * - 使用 isProcessing 标志防止并发调用
   *
   * 技能调用（48-01 D-19）：`message` 是完整语法文本（`/skill:name args`），解析与
   * 实时读盘由 `_resolveSkillInvocation` 完成后把技能块置为 `agent.prompt` 的实参；
   * 普通消息 `enhanced === message`，逐字节不变。`_ensureConversation` **仍收原始文本**
   * —— 对话标题因此派生为 `/skill:find-skills …` 而非退化（D-19）。
   *
   * @param {string} message - 用户输入的消息
   * @returns {Promise<{conversationId: string|null, skillInvocation: object|null, skillError?: object}>}
   *   48-01 起统一为对象契约（技能调用经 `skillInvocation` 回传本次实际注入的正文；技能解析失败经 `skillError` 回传）
   */
  async prompt(message) {
    if (!this.isInitialized) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      // 广播错误事件：否则渲染进程流式占位符会永久卡住，且 aiStreaming 锁死后续发送
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    // Agent 保证（per G-42-1）：删除对话等路径会经 _cleanupCurrentAgent() 置空
    // this.agent，此处重建而非直接早退——空状态（无任何对话）后直接发送消息
    // 仍可恢复。惰性建行的对话无历史需要注入，全新 Agent 恰好正确（per D-09）。
    if (!this.agent) {
      await this._recreateAgent();
      if (!this.agent) {
        console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
        this._sendEventsBatch([{
          type: 'error',
          message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
          timestamp: Date.now(),
        }]);
        return { conversationId: this.currentConversationId || null, skillInvocation: null };
      }
    }

    // 防止并发调用
    if (this.isProcessing) {
      console.warn('[Realm AI] 正在处理中，请等待完成');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 正在处理上一条消息，请稍候再试',
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    this.isProcessing = true;

    // 技能调用解析（D-19 / D-05）：命中语法时当场读盘并组装技能块；普通消息零成本早退
    //（不触达 SDK、不做 IO）。失败时**不调用** agent.prompt，直接回结构化错误 ——
    // renderer 据此回滚刚推送的气泡并给出 system-note（D-13 推论：不留半截历史）。
    const resolved = await this._resolveSkillInvocation(message);
    if (resolved.skillError) {
      this.isProcessing = false;
      console.warn(`[Realm AI] 技能调用被拒：${resolved.skillError.code}`);
      return {
        conversationId: this.currentConversationId || null,
        skillInvocation: null,
        skillError: resolved.skillError,
      };
    }

    // 惰性对话生命周期（per G-42-2 / D-04）：首条消息创建（或认领）对话，
    // 标题自动取首条用户消息前 30 字符。**必须传原始文本**（D-19：不退化）
    try {
      this._ensureConversation(message);
    } catch (err) {
      console.error('[Realm AI] 惰性创建对话失败:', err.message);
      this.isProcessing = false;
      this._sendEventsBatch([{
        type: 'error',
        message: '创建对话失败: ' + err.message,
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    console.log(`[Realm AI] 发送消息: ${message}`);

    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // 指数退避：1s, 2s, 4s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 技能调用发送增强文本（技能块 = `<skill>` + provenance + args）；普通消息
        // `enhanced === message`，逐字节不变
        const enhanced = resolved.skillBlock || message;
        await this.agent.prompt(enhanced);
        await this.agent.waitForIdle();
        this.isProcessing = false;

        // 延迟补刷（G-48-18）：renderer 只在「有 @ 引用或附件」时才走 promptWithContext()，
        // 常规 /skill:<name>、重新生成、错误重试都走本方法 —— 这里是延迟回写在纯文本通道上的
        // 落地点。补刷自身检脏早退，故普通消息零成本。
        await this._flushDeferredSkillsPrompt();

        return {
          conversationId: this.currentConversationId || null,
          skillInvocation: resolved.skill || null,
        };
      } catch (err) {
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          console.error('[Realm AI] 消息处理失败（已重试 3 次）:', err.message);
          this.isProcessing = false;

          // 广播错误事件到渲染进程（per D-11）
          // 注意 payload 形状：渲染端 handleAIStream 读取 event.message
          this._sendEventsBatch([{
            type: 'error',
            message: err.message,
            timestamp: Date.now(),
          }]);
          return { conversationId: this.currentConversationId || null, skillInvocation: null };
        }

        console.warn(`[Realm AI] 第 ${attempt + 1} 次尝试失败，${retryDelays[attempt]}ms 后重试:`, err.message);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }

  /**
   * 发送带上下文引用与聊天附件的用户消息给 AI Agent
   *
   * 将引用的标签页内容注入到用户消息中，让 AI 能够理解引用页面的内容。
   * 内容以 XML 格式的 <referenced-tab> 块注入到消息前缀。
   *
   * 附件链路（per plan quantum-thunder-einstein）：attachmentIds 经登记表
   * 反查快照元数据 → buildAttachmentMarkers 生成 [attached_file/image: 路径]
   * marker 置于消息最前（先于 tab XML 块）；图片附件按主模型能力分两通道：
   * ① 视觉桥（Vision Bridge，主模型无 image 能力且已配置 ai.visionModel）：
   *    图片经视觉模型转写为 <image-descriptions> 文字块并入正文，原图不直发；
   * ② 原生直发（其余情况）：prompt(text, images)，含「判定不支持但未配置
   *    视觉模型」的回退——元数据可能误判，真不支持时 SDK 降级占位符兜底。
   * 附件元数据挂到 transcript 的 user 消息对象上，saveCurrentConversation
   * 落库时随行持久化。
   *
   * @param {string} message - 用户输入的消息（可为空串——仅附件发送）
   * @param {Array} referencedTabs - 引用的标签页列表，每项包含 {tabId, title, url, content}
   * @param {string[]} [attachmentIds] - 附件登记 ID 列表（ai:attach-files/attach-blob 返回的 id）
   * @param {boolean} [supportsVision=true] - @deprecated 已忽略：能力判定内聚主进程（vision 桥）
   * @returns {Promise<{conversationId: string|null, skillInvocation: object|null, skillError?: object}>}
   *   48-01 起统一为对象契约（同 prompt()）
   */
  async promptWithContext(message, referencedTabs, attachmentIds = [], supportsVision = true) {
    if (!this.isInitialized) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    // Agent 保证（per G-42-1）：同 prompt()——删除对话后直接发送可恢复
    if (!this.agent) {
      await this._recreateAgent();
      if (!this.agent) {
        console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
        this._sendEventsBatch([{
          type: 'error',
          message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
          timestamp: Date.now(),
        }]);
        return { conversationId: this.currentConversationId || null, skillInvocation: null };
      }
    }

    // 防止并发调用
    if (this.isProcessing) {
      console.warn('[Realm AI] 正在处理中，请等待完成');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 正在处理上一条消息，请稍候再试',
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    this.isProcessing = true;

    // 技能调用解析（D-19 / D-05）：与 prompt() 共用同一份实现；失败时不进对话
    const resolved = await this._resolveSkillInvocation(message);
    if (resolved.skillError) {
      this.isProcessing = false;
      console.warn(`[Realm AI] 技能调用被拒：${resolved.skillError.code}`);
      return {
        conversationId: this.currentConversationId || null,
        skillInvocation: null,
        skillError: resolved.skillError,
      };
    }

    // 解析附件登记：renderer 只持 attachmentId，主进程登记表反查快照元数据
    //（杜绝 renderer 伪造路径指向 attachments 目录之外的文件）；未知 id 跳过
    const resolvedAttachments = (Array.isArray(attachmentIds) ? attachmentIds : [])
      .map((id) => aiAttachments.getAttachment(id))
      .filter(Boolean);
    const missingCount = (Array.isArray(attachmentIds) ? attachmentIds.length : 0) - resolvedAttachments.length;
    if (missingCount > 0) {
      console.warn(`[Realm AI] ${missingCount} 个附件登记已失效，已跳过`);
    }

    // 惰性对话生命周期（per G-42-2 / D-04）：必须传注入前的原始文本。
    // 纯附件发送（正文为空）时标题回落为附件文件名拼接，避免标题失去区分度
    const titleSource = message
      || (resolvedAttachments.length > 0 ? resolvedAttachments.map((a) => a.name).join(' ') : '');
    try {
      this._ensureConversation(titleSource);
    } catch (err) {
      console.error('[Realm AI] 惰性创建对话失败:', err.message);
      this.isProcessing = false;
      this._sendEventsBatch([{
        type: 'error',
        message: '创建对话失败: ' + err.message,
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }

    console.log(`[Realm AI] 发送带上下文消息: ${message}，引用 ${referencedTabs.length} 个标签页，附件 ${resolvedAttachments.length} 个`);

    try {
      // 主模型图片能力判定（Vision Bridge 触发条件，决策内聚主进程）：
      // 判定支持图片 → 原图直发；判定不支持且已配置视觉模型（ai.visionModel）
      // → 转写为文字描述再发送；判定不支持且未配置 → 仍原生直发
      // （元数据可能误判；真不支持时 SDK 降级占位符兜底，见下方通道注释）
      const mainModel = this.agent && this.agent.state ? this.agent.state.model : null;
      const mainSupportsImage = modelSupportsImage(mainModel);
      const imageAtts = resolvedAttachments.filter((a) => a && a.isImage && !a.isDirectory);

      // 图片附件通道（二选一）：
      // ① 视觉桥：主模型被判不支持图片（Model.input 无 image 且 ID 正则不中）
      //    且已配置视觉模型（ai.visionModel）→ 逐图读快照经 vision-describer
      //    转写，描述块并入正文，images 保持为空（不直发）
      // ② 原生直发（其余全部情况）：主模型判定支持图片，或判定不支持但未
      //    配置视觉模型。后者保留直发是因为目录元数据可能误判——实测 mimo
      //    系列支持视觉但 pi-ai 目录 input:['text']；真不支持时 SDK
      //    downgradeUnsupportedImages 会把图片块降级为「图片被省略」占位符，
      //    模型至少收到明确信号，能如实回答看不到图（而谎称「已附于消息」
      //    的 marker 会诱发编造图片内容，2026-09-05 image.png 幻觉事故）
      const images = [];
      let visionNotice = '';
      let visionBlock = '';
      let imageMode = 'inline';
      if (imageAtts.length > 0) {
        if (!mainSupportsImage && this.visionDescriber && this.visionDescriber.isConfigured()) {
          imageMode = 'described';
          const imagesForVision = [];
          for (const att of imageAtts) {
            try {
              imagesForVision.push({
                data: fs.readFileSync(att.path).toString('base64'),
                mimeType: att.mimeType || 'image/png',
                name: att.name,
                bytes: fs.statSync(att.path).size,
              });
            } catch (err) {
              console.warn(`[Realm AI] 读取图片附件失败（跳过视觉转写）: ${att.path}`, err.message);
            }
          }
          // describeImages 永不 throw；部分失败时描述块与失败通告并存
          const visionResult = await this.visionDescriber.describeImages(imagesForVision, message || '');
          if (visionResult.text) {
            visionBlock = visionResult.text;
          }
          if (visionResult.failedCount > 0) {
            visionNotice = `（提示：${visionResult.failedCount} 张图片未能转为文字描述——${visionResult.error || '原因未知'}。本轮消息不包含这些图片的内容，请明确告知用户你没有看到图片。）`;
          }
          console.log(`[Realm AI] 图片经视觉模型转写: ${imageAtts.length} 张，成功 ${imageAtts.length - visionResult.failedCount} 张`);
        } else {
          if (!mainSupportsImage) {
            imageMode = 'fallback';
            console.log(`[Realm AI] 主模型被判不支持图片但未配置视觉模型，图片仍原生直发（元数据可能误判，SDK 占位符兜底）`);
          }
          for (const att of imageAtts) {
            try {
              images.push({
                type: 'image',
                data: fs.readFileSync(att.path).toString('base64'),
                mimeType: att.mimeType || 'image/png',
              });
            } catch (err) {
              console.warn(`[Realm AI] 读取图片附件失败（降级为纯文件引用）: ${att.path}`, err.message);
            }
          }
        }
      }

      // 构建增强消息：attachment marker 置于最前（先于 tab XML 块——模型先
      // 看到「有附件及路径」再看引用内容），marker 与正文之间空行分隔。
      // 图片措辞按通道条件化（inline=原生直发 / fallback=直发但模型可能看不到 /
      // described=桥接转写），避免「声称已附于消息」却看不到图诱发幻觉
      const markerBlock = aiAttachments.buildAttachmentMarkers(resolvedAttachments, { imageMode });
      const contextBlock = this._buildMessageWithContext(message, referencedTabs);
      // 技能块置增强消息最前（D-07）：显式调用时技能是这次请求的「程序说明」，
      // 附件与 @ 引用是它的输入。其余四段的**相对顺序逐字节不变**；无技能调用时
      // `resolved.skillBlock` 为 ''，被 filter(Boolean) 剔除 → 输出与改动前逐字符相同。
      const enhancedMessage = [resolved.skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]
        .filter(Boolean)
        .join('\n\n');

      // 调用 agent.prompt（images 为空数组时传 undefined，避免 SDK 端歧义）
      await this.agent.prompt(enhancedMessage, images.length > 0 ? images : undefined);
      await this.agent.waitForIdle();

      // 附件元数据挂到 transcript 最后一条 user 消息对象上（同一对象引用，
      // 落库时随行持久化；挂前判空防重复挂）。必须在此处显式补一次落库——
      // agent idle 事件触发的 saveCurrentConversation 先于本挂载执行
      //（waitForIdle 之后才挂），只靠 idle 落库附件列会丢
      try {
        const messages = this.agent.state.messages || [];
        const lastUser = [...messages].reverse().find((m) => m && m.role === 'user');
        if (lastUser && !lastUser.attachments && resolvedAttachments.length > 0) {
          lastUser.attachments = resolvedAttachments.map((a) => ({
            id: a.id,
            name: a.name,
            path: a.path,
            mimeType: a.mimeType,
            isImage: a.isImage,
            isDirectory: a.isDirectory,
            size: a.size,
          }));
          this.saveCurrentConversation();
        }
      } catch (err) {
        console.warn('[Realm AI] 附件元数据挂载失败（不影响消息收发）:', err.message);
      }

      this.isProcessing = false;

      // 延迟补刷（G-48-18）：唯一实现见 _flushDeferredSkillsPrompt()；**成功出口**是唯一的补刷点
      // （错误出口与 _cleanupCurrentAgent() 不补，避免同一次运行双刷）。补刷自身检脏早退。
      await this._flushDeferredSkillsPrompt();

      return {
        conversationId: this.currentConversationId || null,
        skillInvocation: resolved.skill || null,
      };
    } catch (err) {
      console.error('[Realm AI] 带上下文消息处理失败:', err.message);
      this.isProcessing = false;

      // 广播错误事件到渲染进程
      this._sendEventsBatch([{
        type: 'error',
        message: err.message,
        timestamp: Date.now(),
      }]);
      return { conversationId: this.currentConversationId || null, skillInvocation: null };
    }
  }

  /**
   * 惰性确保当前对话存在（per G-42-2 / D-04，D-06 修订）
   *
   * 两条路径：
   * a. 无当前对话（启动后首次发送、删除最后一个对话后再次发送）：
   *    创建对话行，标题按 D-04 派生（首条用户消息前 30 字符）。
   * b. 已有对话但标题仍为默认值「新对话」（用户尚未显式重命名）：
   *    更新标题为派生标题——显式「新对话」按钮建的行在首条消息落地时
   *    也获得真实标题。
   *
   * @param {string} userMessageText - 原始用户消息文本（未注入 XML 引用块）
   * @returns {string} 当前对话 ID
   * @throws {Error} 数据库操作失败时抛出（调用方负责广播错误并复位 isProcessing）
   * @private
   */
  _ensureConversation(userMessageText) {
    const derivedTitle = this._deriveConversationTitle(userMessageText);

    // 路径 a：无当前对话 → 惰性建行
    if (!this.currentConversationId) {
      const conv = conversationStore.createConversation({
        title: derivedTitle,
        model: this.activeModelId,
        provider: this.activeProvider,
      });
      this.currentConversationId = conv.id;
      this.conversationMeta = { model: this.activeModelId, provider: this.activeProvider };
      console.log('[Realm AI] 首条消息惰性创建对话: ' + conv.id + ' (' + derivedTitle + ')');
      return this.currentConversationId;
    }

    // 路径 b：已有对话且标题仍为默认值 → 自动改为派生标题（用户重命名过则不动）
    const existing = conversationStore.getConversation(this.currentConversationId);
    if (existing && existing.title === '新对话' && derivedTitle !== '新对话') {
      conversationStore.updateConversation(this.currentConversationId, { title: derivedTitle });
      console.log('[Realm AI] 对话标题按首条消息自动命名: ' + derivedTitle);
    }

    return this.currentConversationId;
  }

  /**
   * 从首条用户消息派生对话标题（per D-04）
   * 截取 trim 后的前 30 字符；空串时保持默认「新对话」
   * @param {string} userMessageText - 原始用户消息文本
   * @returns {string} 派生标题
   * @private
   */
  _deriveConversationTitle(userMessageText) {
    const trimmed = typeof userMessageText === 'string' ? userMessageText.trim() : '';
    return trimmed ? trimmed.substring(0, 30) : '新对话';
  }

  /**
   * 解析一次显式技能调用并**当场从磁盘读取正文**（D-05 / D-13 / 用户 2026-09-11 硬约束）
   *
   * `prompt()` 与 `promptWithContext()` **共用**本方法 —— 解析与读盘只有一份实现。
   * 普通消息（不含技能语法）在此零成本早退（不触达 SDK、不做任何 IO）。
   *
   * 失败时不调用 `agent.prompt`，直接把结构化错误交给调用方（D-13 推论：
   * 被 `refreshSkills()` 整条跳过的技能与「不存在」同形处理）。
   *
   * **缓存未命中的一次性重扫（G-48-12）**：
   * 1. 读盘口的存在性判据取自模块级缓存 —— 缓存未命中即 `not_found`，读盘路径根本不会执行。
   *    而该缓存只由显式重扫刷新（Agent 创建 / 本类的同步入口 / Agent 重建），常规触发点只有
   *    「打开 `/` 面板」；全仓无 fs watcher、无定时器、无写工具钩子，因此**运行期新增**的
   *    技能目录永不自动进缓存，与「调用瞬间实时读盘」的硬约束冲突（UAT test 12 实测：
   *    主进程连请求日志都没有，手工补一次重扫后原样重发即成功 —— 失效点确实在主进程缓存门）。
   * 2. 故判定为「不存在」时，经**唯一权威入口** `syncAgentSystemPrompt()` 重扫**一次**后当场
   *    **重试读盘**。该入口的函数体逐字未改，重扫仍由同一条加载管线产出三字段 ——
   *    `shadowed`（46 D-06）/ `disabled`（46 D-09、D-10，注入式禁用清单）/ `tier`（D-14，
   *    `sourceTierOf` + seeded 集合）。本方法**不**新增第二套遮蔽 / 禁用判定，也**不**按目录
   *    直读绕过契约布局过滤、description 可用性过滤与 `SKILL.md` 64 KiB 字节闸。
   * 3. 重试**至多一次**，不得写成循环：真不存在仍是 `not_found`（返回值域仍只有
   *    `not_found | disabled` 两个码）。**重扫抛错**或**重试读盘抛错**都在各自独立的 `try` 内
   *    就地 catch + 告警后**沿用原判定** —— 不赋 `result`、不逃逸、不升级成第三码；重扫抛错时
   *    **不再执行**重试读盘（整批失败会回滚缓存三件套 ⇒ 重读必然与首次同形）。告警取值一律用
   *    `err && err.message ? err.message : String(err)`，故 `throw null` / 抛原始值不会二次抛错。
   * 4. **忙时只置脏**：`prompt()` / `promptWithContext()` 在调用本方法**之前**即置
   *    `isProcessing = true`，故重扫必然落到同步入口的忙分支 —— 重扫落地、脏标记置真，但
   *    **不改写** `agent.state.systemPrompt`、**不广播**。prompt 回写与 `skills:changed`
   *    广播的落地时机 = **任一轮成功出口**（`prompt()` 与 `promptWithContext()` 各一处，
   *    **含纯文本轮**）/ 打开面板（`refreshSkillsForPanel`）/ Agent 创建或重建。
   *
   * @param {string} rawMessage - 用户原始消息（完整语法文本）
   * @returns {Promise<{skillBlock: string, skill: {name: string, tier: string, content: string}|null,
   *                    skillError?: {code: string, message: string}}>}
   * @private
   */
  async _resolveSkillInvocation(rawMessage) {
    const parsed = parseSkillInvocationText(rawMessage);
    if (!parsed) return { skillBlock: '', skill: null };

    const skillsManager = getAiSkillsManagerLazy();
    let result = await skillsManager.readSkillForInvocation(this.sandboxEnv, parsed.name);

    // G-48-12：缓存未命中 → 经唯一权威入口 syncAgentSystemPrompt() 重扫**一次**后重试读盘。
    // ① UAT test 12 实测（2026-09-12）：运行期新增技能目录 + 从未打开过 `/` 面板时，14ms 内
    //    就出 system-note、主进程连 `发送消息: /skill:…` 日志都没有；手工补一次重扫后原样重发
    //    即成功 —— 失效点确实在主进程的缓存存在性门，与「调用瞬间实时读盘」的硬约束冲突。
    // ② 根因：读盘口的存在性判据取自模块级缓存（命中才读盘，未命中直接 not_found），而缓存只由
    //    显式重扫刷新；全仓无 fs watcher、无定时器、无写工具钩子，运行期新增的目录永不自动进缓存。
    // ③ 重扫走与 Agent 创建 / 打开面板完全相同的入口，其内部调用的加载管线是 shadowed（46 D-06）、
    //    disabled（46 D-09 / D-10）、tier（D-14）三字段的唯一产出口 —— 本块不新增第二套遮蔽 /
    //    禁用判定，也不用单目录直读绕过契约布局过滤与字节闸。
    // ④ 重试**至多一次**，禁止写成循环：重试后仍失败即走同一条失败出口，真不存在的技能仍是
    //    not_found；误诊一个技能名的成本固定为一次全量重扫（与打开 `/` 面板同款）。
    // 忙时语义：显式调用路径恒处于「正在处理」，重扫必然落到忙分支 —— 只置脏，不改写 prompt、
    // 不广播，回写与广播延后到下一次非忙同步点。
    if (result && result.ok !== true && result.reason === 'not_found') {
      // ① 重扫与重试读盘**各自独立兜底**：重试读盘是 48-07 新增的调用点，原先落在 try 之外，
      //    一旦抛错就直接逃逸出本方法 —— 而调用点恒处于「正在处理」，逃逸会让该状态永不复位，
      //    后续消息会被「AI 正在处理上一条消息」拒绝，直到重建 Agent。
      // ② 重扫抛错时**不执行**重试读盘（用 `rescanned` 局部标志）：整批加载失败会回滚缓存三件套
      //    ⇒ 缓存未变 ⇒ 重读必然得到与首次**同形**的判定，白付一次 IO。取舍已注明：若日后调用点
      //    改成非忙，重扫可能「缓存已更新但后续步骤抛错」，此时跳过重读会退回 not_found —— 代价是
      //    一次调用退化（下一次调用缓存已命中即恢复），有界且自愈，换取「沿用原判定」在字面上成立。
      // ③ 判定**至多一次**，不得写成循环（任何循环关键字都会让「有界」失效）。
      // ④ 两个 catch 都**不赋 `result`、不逃逸**：判定沿用原值，返回值域仍只有
      //    `not_found | disabled`（`skillErrorFromReason` 是唯一来源）。告警取值一律用
      //    `err && err.message ? err.message : String(err)`（与 ai-skills-manager 同形）——
      //    `throw null` / 抛原始值是合法 JS 形态，裸读 `err.message` 会在 catch 体内二次抛
      //    `TypeError`，恰好把「绝不升级为异常」反转。两条告警文案必须**可判别**。
      let rescanned = false;
      try {
        await this.syncAgentSystemPrompt();
        rescanned = true;
      } catch (err) {
        console.warn(
          '[Realm AI] 技能缓存未命中后的重扫失败（沿用原判定，不重复读盘）:',
          err && err.message ? err.message : String(err)
        );
      }
      if (rescanned) {
        try {
          result = await skillsManager.readSkillForInvocation(this.sandboxEnv, parsed.name);
        } catch (err) {
          console.warn(
            '[Realm AI] 技能缓存未命中后的重试读盘失败（沿用原判定）:',
            err && err.message ? err.message : String(err)
          );
        }
      }
    }

    if (!result || result.ok !== true) {
      const reason = result && result.reason ? result.reason : 'not_found';
      return { skillBlock: '', skill: null, skillError: skillErrorFromReason(reason, parsed.name) };
    }

    // SDK 为 ESM-only，动态 import 后把 formatSkillInvocation 注入纯函数（避免顶层 import）
    const { formatSkillInvocation } = await import('@earendil-works/pi-agent-core');
    const skillBlock = buildSkillInvocationBlock(
      { skill: result.skill, name: parsed.name },
      parsed.args,
      formatSkillInvocation
    );
    const tier = skillsManager.sourceTierOf(
      { skill: result.skill, source: result.source },
      this.getSeededSkillNamesSafe()
    );
    // 返回契约只有三个键：{name, tier, content}（content = 技能块体，气泡折叠块的 N 来源）。
    // args **不进返回体** —— 气泡正文由渲染侧按同一份 token 规则算出（D-06）。
    return {
      skillBlock,
      skill: { name: parsed.name, tier, content: result.skill.content },
    };
  }

  /**
   * 同步读取随包内置技能名集合（seeded 身份，48 D-14）—— **fail-safe 降级为空集合**
   *
   * `builtin-skills-seeder.getSeededSkillNames()` 经 agent-workspace 间接依赖 electron：
   * 纯 Node 环境下 `require('electron')` 返回字符串 → `app` 为 undefined → TypeError
   *（`48-RESEARCH.md` 事实 4）。降级为空集合的后果是内置技能被标成「托管」（错标），
   * 因此必须 `console.warn` 留下痕迹（禁止静默失败）。
   *
   * @returns {string[]} 随包内置技能名数组；不可判定时为空数组
   */
  getSeededSkillNamesSafe() {
    try {
      const names = getBuiltinSkillsSeederLazy().getSeededSkillNames();
      return Array.isArray(names) ? names : [];
    } catch (err) {
      console.warn('[Realm AI] 读取随包内置技能名失败（seeded 判定降级为空集合）:', err.message);
      return [];
    }
  }

  /**
   * `/` 面板数据源（同步、零 IO）—— 经 `ai:get-skills` 通道交给 renderer
   *
   * seeded 集合在此注入（`ai-skills-manager` 保持零 electron 依赖纪律）。
   * 返回的是**收窄投影**（无正文 / 无 filePath / 无诊断），见 `toUISkillEntry`。
   *
   * @returns {{skills: Array<object>, refreshedAt: number, digest: string}}
   */
  getSkillsForUI() {
    return getAiSkillsManagerLazy().getSkillsForUI(this.getSeededSkillNamesSafe());
  }

  /**
   * 设置页「技能管理」区的数据源投影（Phase 50 D-13）—— **同步、零 IO** 的转发层
   *
   * 与 `getSkillsForUI()` 同款形状的转发：判定 / 分组 / 排序 / 尺寸全部住在
   * `ai-skills-manager.js`（技能集的单一数据权威，零 electron 依赖），本方法只做
   * **seeded 集合注入**（`ai-skills-manager` 不自行解析随包目录，见 `sourceTierOf`）
   * 与转发。**不在这里做任何加工** —— 加工一份就等于第二份实现。
   *
   * `getSkillsForUI()` 与 `getSkillsForManagement()` **并列共存、不得合并**：
   * 前者是 `/` 面板的有意收窄投影，后者多带 `bytes` / `fileCount` /
   * `statsUnavailable` / `diagnostics` 与分组结构。理由详见
   * `ai-skills-manager.getSkillsForManagement()` 的 JSDoc。
   *
   * @returns {{groups: Array<object>, errors: Array<object>, refreshedAt: number,
   *            digest: string, limits: object}} 管理面投影
   */
  getSkillsForManagement() {
    return getAiSkillsManagerLazy().getSkillsForManagement(this.getSeededSkillNamesSafe());
  }

  /**
   * 启用 / 禁用单个技能（Phase 50 D-05 / USER-02）—— 管理写路径的收口点之一
   *
   * ## 语义
   *
   * 禁用只写 `settings.aiSkills.disabled`（名字数组）并过滤，**文件仍在盘上**
   * （46 D-09）；重新启用即从名单移除并恢复。禁用后该技能不进 system prompt
   * （`refreshSkills` 的禁用标记）与 `/` 面板（`filterPickerItems` 跳过
   * `disabled === true`，该过滤已存在、本方法不重判）。禁用的技能**仍可卸载**。
   *
   * ## 载荷形状取增量 `{name, disabled}` 而非全量 `{disabled: [...]}`
   *
   * 读-改-写（`configStore.get` → 算新数组 → `configStore.set`）**全程在主进程内
   * 同步完成、中间无 `await`** ⇒ 两个并发的设置页操作不会互相覆盖；全量载荷会在
   * 并发下丢更新（最后一次写会抹掉前一次的改动）。
   *
   * @param {string} name - 技能名（目录名，46 D-08 的权威）
   * @param {boolean} disabled - true = 禁用（写进名单）；false = 启用（从名单移除）
   * @returns {Promise<object>} 操作后的最新管理面投影（响应体即最新投影 ⇒ 设置页零二次请求）
   * @throws {Error} name 非法（带 `code = invalid_name`）
   */
  async setSkillDisabled(name, disabled) {
    // ① 名称谓词**单源**在 ai-skills-manager（管理面安全超集，OQ-2）。
    //    本文件不得另造一份校验正则（第二份必然与第一份漂移）。
    const nameCheck = getAiSkillsManagerLazy().validateSkillNameForManagement(name);
    if (!nameCheck.ok) {
      const err = new Error(nameCheck.reason);
      err.code = nameCheck.code;
      throw err;
    }
    const skillName = nameCheck.value;

    // ② 读-改-写名单：同步、无 await（并发安全，见 JSDoc）
    const list = this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [];
    const current = Array.isArray(list) ? list.slice() : [];
    const next = disabled
      ? [...new Set([...current, skillName])]
      : current.filter((n) => n !== skillName);
    if (this.configStore) this.configStore.set('settings.aiSkills.disabled', next);

    // ③ 重扫**恰一次**（D-18）：有 Agent 时 ensureSkillsFresh 内部走
    //    syncAgentSystemPrompt()（其函数体内**已含**恰一次重扫），无 Agent 时直接重扫。
    //    不得在这一句之外再调 syncAgentSystemPrompt() —— 那是两次全量重扫。
    await this.ensureSkillsFresh();

    // ④ 调用侧补播**恰一次**。理由**不是**「prompt 不变 ⇒ 不广播」（那条推不出来：
    //    摘要逐条含 disabled / overLimit / shadowed ⇒ 禁用任何在缓存里的技能都会改摘要
    //    ⇒ 会广播），而是覆盖 syncAgentSystemPrompt() 的 `isProcessing || streaming`
    //    分支「只置脏、return、**不广播**」：设置页点开关**不经过 Agent 轮次**，
    //    用户若不再发消息，`/` 面板会一直显示已被禁用的技能。
    //    补播幂等（renderer 侧监听已改成无条件重拉快照）⇒ 多播一次零副作用。
    //    **禁止**把这行挪进 syncAgentSystemPrompt() 的函数体（46-04 的方法体源码扫描
    //    断言与 48 的广播次数断言同时钉着它）。
    windowManager.broadcast('skills:changed');

    // ⑤ 返回最新投影
    return this.getSkillsForManagement();
  }

  /**
   * 卸载**用户**技能（Phase 50 D-07 / USER-06）—— 管理写路径的收口点之二
   *
   * 判据 / 校验 / 删除全部住 `ai-skills-manager.deleteUserSkill()`（技能集单一数据
   * 权威），本方法只是**转发 + 失效链收口 + D-09 派生不变式**；**不得**吞掉或改写
   * 它抛出的 `code`（设置页按 `code` 查表，不解析 message）。
   *
   * ## D-09 派生不变式：卸载成功后必须清理禁用名单
   *
   * 否则残留名单会随技能名复用而误伤 —— 同名新技能一装上就被静默禁用，属「静默失效」。
   * 清理**只在删盘成功之后**执行（`deleteUserSkill` 失败即 throw，后续代码不会跑到）；
   * 失败路径**不得**清名单。启用 / 禁用单条时无需清理（技能仍在盘上）。
   *
   * @param {string} name - 技能名
   * @returns {Promise<object>} `{name, filePath, action, management}`（management = 最新投影）
   * @throws {Error} 三态拒绝（`not_found` / `not_user_owned` / `invalid_name`）或删除失败（`unknown`）
   */
  async uninstallUserSkill(name) {
    // ① 沙箱 env 惰性建立（createSandboxEnv 与 provider 配置无关）
    const env = this.sandboxEnv || (this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv());

    // ② 删盘：判据全在 manager（仅 user 可删的三态拒绝面），失败原样抛出
    const result = await getAiSkillsManagerLazy().deleteUserSkill(env, { name });
    const removed = result && typeof result.name === 'string' ? result.name : name;

    // ③ D-09 派生不变式（**只在删盘成功之后**）：同步读-改-写，无 await
    const list = this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [];
    const current = Array.isArray(list) ? list.slice() : [];
    const next = current.filter((n) => n !== removed);
    if (this.configStore) this.configStore.set('settings.aiSkills.disabled', next);

    // ④ 收口与补播：与 setSkillDisabled 同一套次数账（重扫恰一次 + 补播恰一次）
    await this.ensureSkillsFresh();
    windowManager.broadcast('skills:changed');

    // ⑤ 返回删除结果 + 最新投影
    return { ...result, management: this.getSkillsForManagement() };
  }

  /**
   * 清掉 `_skillImports` 里**已过期**的句柄（TTL）—— preview / commit 共用的一处实现
   *
   * 每条：从 Map 删除 + 删掉它名下的临时目录（失败只告警，不遮蔽主流程）。
   * 不是定时器 —— 只在 preview 入口顺带跑一次（D-02 的「提交时顺带清扫过期项」）。
   *
   * @param {object} env - 沙箱 ExecutionEnv
   * @returns {Promise<number>} 清掉的条数
   * @private
   */
  async _purgeExpiredSkillImports(env) {
    const ttl = getAiSkillsManagerLazy().IMPORT_LIMITS.IMPORT_TTL_MS;
    const now = Date.now();
    const expired = [];
    for (const [id, rec] of this._skillImports) {
      if (rec && now - (rec.createdAt || 0) > ttl) expired.push([id, rec]);
    }
    for (const [id, rec] of expired) {
      this._skillImports.delete(id);
      try {
        await env.remove(rec.dir, { recursive: true, force: true });
      } catch (err) {
        console.warn('[Realm AI] 清理过期技能导入临时目录失败:', err && err.message ? err.message : err);
      }
    }
    return expired.length;
  }

  /**
   * 技能导入 **preview 阶段**（Phase 51 D-02）—— 解压 + 校验 + 六字段预览
   *
   * ## 转发层纪律（零判定）
   *
   * 解压 / 校验 / 技能根定位 / 预览组装 / 限额全部住 `ai-skills-manager.js`
   * （技能集单一数据权威，零 electron 依赖）。本方法只做三件事：建临时目录、
   * 把包落到 `<importDir>/pkg.zip`、登记句柄。**在这里加工一份就是第二份实现**。
   *
   * ## 为什么上传路径也要写盘（D-01 / D-07）
   *
   * 三种来源（zip 上传 / 网络 zipball / 直链 SKILL.md 包装包）**必须共用同一条解压
   * 入口**（`extractAndValidatePackage`）。上传分支改走 `yauzl.fromBufferPromise`
   * 能省一次 ≤ 32 MiB 的临时写，但会让「三条来源共用一条解压入口」这条判据**结构上
   * 不成立**（源码扫描 `yauzl.openPromise(` 恰 1 处会失效），且 32 MiB Buffer 要在
   * 内存里存两份。代价换来的是把「只有一个落盘实现」从口号变成代码形状。
   *
   * ## 失败即清理
   *
   * preview 任何一步失败都要把 `importDir` 整个删掉（否则 `.tmp/` 会随每次失败解压
   * 累积垃圾）。**用户可见的失败文案里不得出现临时路径** —— 错误消息由
   * `ai-skills-manager` 给出，本方法只做清理与转发。
   *
   * ## 网络来源（51-05）的三条纪律
   *
   * ① **生产调用点走缺省依赖**：`downloadPackage(undefined, { … })` 的首参**恒为逐字
   *    `undefined`** ⇒ 走 `ai-skills-manager` 的参数默认值里接的**真实实现**
   *    （`net.fetch` / `search-manager.isPrivateHost` / `HOST_WHITELIST`）。**不得**
   *    在这里传依赖对象 —— 那等于把 https 强制 / 白名单 / 逐跳私网校验整条关掉
   *    （源码门禁以正命题断言本文件出现 `fetchImpl` / `isPrivateHost` / `hostWhitelist`
   *    各 **0** 次）。
   * ② **magic bytes 校验在状态码分类之后**：codeload 的 404 是 14 字节 `text/plain`，
   *    先判 magic 会让用户拿到「不是 zip」而不是「地址 / ref 不存在」。
   * ③ **公共后段一段代码**：两条来源的 `pkgRoot` 之后是**同一段**「技能根定位 → 预览 →
   *    登记句柄」；直链 SKILL.md 由 `prepareFromRawFile` 只负责产出同一个 `pkgRoot` 形状。
   *
   * @param {{kind: 'zip'|'url', buffer?: Buffer, url?: string}} params
   * @returns {Promise<{importId: string, preview: object}>}
   * @throws {Error} 分类 / 下载 / 解压 / 校验失败（带 `code`，取值见 `IMPORT_SKILL_ERROR`）
   */
  async previewSkillImport({ kind, buffer, url } = {}) {
    // ⓪ 入参分支（**唯一允许的解析层**）。`url` 来源先跑 URL 分类器 —— 它是**纯函数、
    //    零磁盘零网络**，`unsupported` 立即给显式码与可读原因（白名单外主机 / 非 https /
    //    无载荷语义的来源），不让任何临时目录被建出来。
    let cls = null;
    if (kind === 'url') {
      cls = getAiSkillsManagerLazy().classifyImportUrl(url);
      if (cls.kind === 'unsupported') {
        const err = new Error(cls.message);
        err.code = cls.code;
        throw err;
      }
    } else if (kind !== 'zip') {
      const err = new Error('不支持的导入来源');
      err.code = importSkillErrors().UNSUPPORTED_URL;
      throw err;
    } else if (!Buffer.isBuffer(buffer)) {
      const err = new Error('上传内容为空或不是二进制数据');
      err.code = importSkillErrors().NOT_A_ZIP;
      throw err;
    }

    const workspace = getAgentWorkspaceLazy();
    const env = this.sandboxEnv || (this.sandboxEnv = await workspace.createSandboxEnv());

    // ① TTL 清扫（顺带做，不是定时器）：过期句柄 ⇒ 删 Map 项 + 删临时目录。
    //    这是**兜底**（正常路径由 commit / cancel / 启动清扫覆盖）——
    //    「预览已过期」必须是**明确码 + 可读原因**，不得静默失败。
    await this._purgeExpiredSkillImports(env);

    // ② 并发待确认导入上限（防内存 / 磁盘堆积，D-02）
    const importLimits = getAiSkillsManagerLazy().IMPORT_LIMITS;
    if (this._skillImports.size >= importLimits.MAX_PENDING_IMPORTS) {
      const err = new Error(
        `同时待确认的导入过多（上限 ${importLimits.MAX_PENDING_IMPORTS} 个），请先完成或取消上一个预览`
      );
      err.code = importSkillErrors().TOO_MANY_PENDING;
      throw err;
    }

    // 临时根**只在这里建一次**（`importDir` 契约：调用方建根并写 `<importDir>/pkg.zip`，
    // `extractAndValidatePackage` 不得自建第二个临时根）。zip 上传与网络下载**共用这一处** ——
    // 源码判据：`mkdtempSync(` 在本文件恰 1 处。
    const importDir = fs.mkdtempSync(path.join(workspace.getTmpDir(), 'skill-import-'));

    const skillsManager = getAiSkillsManagerLazy();

    try {
      // ① **准备段**：每个来源一个准备器，**都只产出 `pkgRoot`**。
      //    ⚠️ 直链 SKILL.md **不是**第二条落盘路径（P9 明令禁止的形态）—— 它只把单文件
      //    写成与 zip 解压结果**同一形状**的 `pkgRoot`，其后走 ② 的同一段代码。
      let prepared;
      if (kind === 'zip') {
        fs.writeFileSync(path.join(importDir, 'pkg.zip'), buffer);
        prepared = await skillsManager.extractAndValidatePackage(env, {
          importDir,
          scopeRel: null,
        });
      } else if (cls.kind === 'zipball') {
        const destPath = path.join(importDir, 'pkg.zip');
        const maxBytes = importLimits.MAX_TOTAL_BYTES;
        let meta;
        try {
          meta = await downloadPackage(undefined, {
            url: cls.target,
            destPath,
            maxBytes,
            kind: 'zipball',
          });
        } catch (err) {
          // ref 缺省策略：仓库地址（无 tree/blob 段）的默认分支先试 main，404 ⇒ 用
          // master 重试**恰一次**。两次都 404 ⇒ 把「已尝试 main / master」写进失败原因。
          if (!(err && err.httpStatus === 404 && cls.fallbackRef && cls.refBase)) throw err;
          try {
            meta = await downloadPackage(undefined, {
              url: cls.refBase + cls.fallbackRef,
              destPath,
              maxBytes,
              kind: 'zipball',
            });
          } catch (retryErr) {
            if (retryErr && retryErr.httpStatus === 404) {
              retryErr.message = `未找到默认分支（已按 main / master 依次尝试）：${retryErr.message}`;
            }
            throw retryErr;
          }
        }
        skillsManager.verifyPackageBytes(destPath, 'zipball', meta.contentType);
        prepared = await skillsManager.extractAndValidatePackage(env, {
          importDir,
          scopeRel: cls.scopeRel,
        });
      } else {
        // 直链 SKILL.md：下载 → 校验形态 → 定名 → 包装成单文件包。
        // **不做 magic bytes 校验**（实测 raw 的 content-type 是 text/plain）：改判
        // 「非空 + 前 512 字节无 NUL」，见 `verifyPackageBytes` 的 raw 分支。
        const destPath = path.join(importDir, 'raw.tmp');
        const meta = await downloadPackage(undefined, {
          url: cls.target,
          destPath,
          maxBytes: importLimits.MAX_TOTAL_BYTES,
          kind: 'raw-skill',
        });
        skillsManager.verifyPackageBytes(destPath, 'raw-skill', meta.contentType);
        const text = fs.readFileSync(destPath, 'utf8');
        const fm = skillsManager.parseSkillFrontmatter(text);
        if (!fm.ok) {
          const err = new Error(fm.reason);
          err.code = fm.code;
          throw err;
        }
        // 定名：frontmatter 的 name 优先，回落 URL 的**父目录名**（与 zip 来源的
        // `deriveImportName(fm, rootRel)` 同一份校验器）
        const urlParentDir = path.posix.basename(path.posix.dirname(new URL(cls.target).pathname));
        const derived = skillsManager.deriveImportName(fm, urlParentDir);
        if (!derived.ok) {
          const err = new Error(derived.reason);
          err.code = derived.code;
          throw err;
        }
        prepared = await skillsManager.prepareFromRawFile({
          importDir,
          name: derived.name,
          text,
        });
      }

      // ② **公共后段**（一段代码，三条来源共用）：技能根定位 → 六字段预览 → 登记句柄。
      //    源码判据：`locateSkillRoot(` / `buildImportPreview(` 在本文件各恰 1 处调用。
      const origin = kind === 'url' ? 'url' : 'zip';
      const located = skillsManager.locateSkillRoot(prepared.pkgRoot, cls ? cls.scopeRel : null);
      const preview = await skillsManager.buildImportPreview(env, {
        pkgRoot: prepared.pkgRoot,
        rootRel: located.rootRel,
        origin,
        seededNames: this.getSeededSkillNamesSafe(),
      });

      const importId = crypto.randomUUID();
      this._skillImports.set(importId, {
        dir: importDir,
        srcDir: located.skillRootAbs,
        preview,
        createdAt: Date.now(),
        origin,
      });
      return { importId, preview };
    } catch (err) {
      try {
        await env.remove(importDir, { recursive: true, force: true });
      } catch {
        /* 清理失败不遮蔽原始错误 */
      }
      throw err;
    }
  }

  /**
   * 技能导入 **commit 阶段**（Phase 51 D-02 / D-19）—— 落盘 + 重扫 + 补播
   *
   * ## 落盘是唯一实现（`ai-skills-manager.importUserSkill`）
   *
   * 本方法**不含任何落盘 / 落点校验逻辑**（源码判据：`importUserSkill(` 在
   * `ai-manager.js` 恰 1 处，`main.js` 与前端各 0 处）。
   *
   * ## 收口次数账（与 `uninstallUserSkill` / `setSkillDisabled` 同一套）
   *
   * `await this.ensureSkillsFresh()` **恰一次** + **调用侧**
   * `windowManager.broadcast('skills:changed')` **恰一次**。补播的理由覆盖
   * `syncAgentSystemPrompt()` 的 `isProcessing || streaming` 分支「只置脏、return、
   * 不广播」：设置页点「导入确认」**不经过 Agent 轮次**，用户若不再发消息，
   * `/` 面板会一直显示旧技能集。**禁止**把这行挪进 `syncAgentSystemPrompt()` 的
   * 函数体（46-04 的方法体源码扫描断言与 48 的广播次数断言同时钉着它）。
   *
   * ## 句柄未命中 / 过期 / 失败保留
   *
   * `importId` 不在表里 ⇒ `import_not_found`（「预览已失效，请重新选择文件」）；
   * `createdAt` 超 `IMPORT_TTL_MS` ⇒ 删 Map 项 + 删临时目录 + `import_expired`
   * （「预览已过期，请重新选择文件」）—— 两条都是**明确码 + 可读原因**，不静默失败。
   *
   * ⚠️ **失败路径保留临时目录与 Map 项**：落盘失败（`importUserSkill` 抛错）时**不清理**，
   * 用户可以**就地重试同一次预览**（UI-SPEC 状态机 `提交失败` 行的实现前提）。
   * 只有 `import_expired` / `import_not_found` / 显式 `cancel` / **成功**才清。
   *
   * @param {{importId: string, conflict?: string, newName?: string}} params
   * @returns {Promise<object>} 导入报告 + `management`（最新管理面投影）
   * @throws {Error} 句柄失效 / 过期 / 任一拒绝路径（带 `code`，由调用方按 code 查文案表）
   */
  async commitSkillImport({ importId, conflict, newName } = {}) {
    const record = this._skillImports.get(importId);
    if (!record) {
      const err = new Error('导入预览已失效，请重新选择文件');
      err.code = importSkillErrors().IMPORT_NOT_FOUND;
      throw err;
    }

    const env = this.sandboxEnv || (this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv());

    // TTL 到期：删 Map 项 + 删临时目录 + **明确码**（不静默失败）
    const ttl = getAiSkillsManagerLazy().IMPORT_LIMITS.IMPORT_TTL_MS;
    if (Date.now() - (record.createdAt || 0) > ttl) {
      this._skillImports.delete(importId);
      try {
        await env.remove(record.dir, { recursive: true, force: true });
      } catch (err) {
        console.warn('[Realm AI] 清理过期技能导入临时目录失败:', err && err.message ? err.message : err);
      }
      const err = new Error('预览已过期，请重新选择文件');
      err.code = importSkillErrors().IMPORT_EXPIRED;
      throw err;
    }

    // 显式取消（D-08 的三选一之一）：**不落盘、不重扫、不补播** —— 没有变更就没有广播
    if (conflict === 'cancel') {
      this._skillImports.delete(importId);
      try {
        await env.remove(record.dir, { recursive: true, force: true });
      } catch (err) {
        console.warn('[Realm AI] 清理技能导入临时目录失败:', err && err.message ? err.message : err);
      }
      return { cancelled: true, management: this.getSkillsForManagement() };
    }

    // 落盘：判据 / 校验 / 两段 rename / 回读验证全在 manager。
    // ⚠️ 此处**不包 try**：失败时保留句柄与临时目录，用户可以就地重试同一预览。
    const report = await getAiSkillsManagerLazy().importUserSkill(
      env,
      {
        srcDir: record.srcDir,
        name: record.preview && record.preview.name,
        conflict,
        newName,
      },
      { seededNames: this.getSeededSkillNamesSafe() }
    );

    // 成功出口收口：重扫恰一次 + 调用侧补播恰一次
    await this.ensureSkillsFresh();
    windowManager.broadcast('skills:changed');

    // 成功后立刻清句柄与临时目录（D-02 的生命周期要求）
    this._skillImports.delete(importId);
    try {
      await env.remove(record.dir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[Realm AI] 清理技能导入临时目录失败:', err && err.message ? err.message : err);
    }

    return { ...report, management: this.getSkillsForManagement() };
  }

  /**
   * 取消一次待确认的导入（Phase 51 D-02）—— **幂等，不抛**
   *
   * 命中 ⇒ 删 Map 项 + 删临时目录 + `{ cancelled: true }`；
   * 不命中（未知 / 已被消费 / 已取消）⇒ `{ cancelled: false }` ——
   * 取消路径**不应**因「已经没了」而报错（用户点两次「取消」是合法操作）。
   *
   * @param {{importId: string}} params
   * @returns {Promise<{cancelled: boolean}>}
   */
  async cancelSkillImport({ importId } = {}) {
    const record = this._skillImports.get(importId);
    if (!record) return { cancelled: false };

    this._skillImports.delete(importId);
    const env = this.sandboxEnv || (this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv());
    try {
      await env.remove(record.dir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[Realm AI] 清理技能导入临时目录失败:', err && err.message ? err.message : err);
    }
    return { cancelled: true };
  }

  /**
   * 清扫技能导入的临时区残留（Phase 51 D-02）—— **两种模式语义不同、不得混淆**
   *
   * ## `mode === 'own'`：只删**本进程 Map 里登记**的目录（清空 Map）
   * 精确、**无跨实例风险** —— 用于**应用退出**。
   *
   * ## `mode === 'stale'`：扫 `.tmp/` 下匹配 `IMPORT_TMP_PREFIXES` 的残留，
   * ## **只删 mtime 早于 `2 × IMPORT_TTL_MS` 的**
   * 用于**启动**与兜底。⚠️ **陈旧性判据是硬要求**：缺它就会重演 `WR-05` 的历史缺陷
   * （`dev` 与 `debug` 共享 userData 且无单实例锁 ⇒ 并发实例会**互删进行中的预览**）。
   * 一个「刚刚」产生的残留可能正是另一个实例正在预览的包 —— 必须放过。
   *
   * 两种模式都返回 `{ removed: N }` 供日志与用例断言，**都不抛**（清扫失败只 `console.warn`）。
   *
   * ⚠️ **不得**把清扫接进 `syncAgentSystemPrompt()` / `ensureSkillsFresh()` ——
   * 那两个函数的职责是技能集，不是临时区（且前者的函数体逐字不得改）。
   *
   * @param {{mode?: 'own'|'stale'}} params
   * @returns {Promise<{removed: number}>}
   */
  async sweepSkillImports({ mode } = {}) {
    let removed = 0;
    try {
      const workspace = getAgentWorkspaceLazy();
      const env = this.sandboxEnv || (this.sandboxEnv = await workspace.createSandboxEnv());

      if (mode === 'own') {
        for (const [, rec] of this._skillImports) {
          if (!rec || !rec.dir) continue;
          try {
            const res = await env.remove(rec.dir, { recursive: true, force: true });
            if (res && res.ok === true) removed += 1;
          } catch (err) {
            console.warn('[Realm AI] 清扫导入临时目录失败:', err && err.message ? err.message : err);
          }
        }
        this._skillImports.clear();
        return { removed };
      }

      // mode === 'stale'：陈旧性判据 = mtime 早于 2 × TTL
      const skillsManager = getAiSkillsManagerLazy();
      const tmpDir = workspace.getTmpDir();
      const cutoff = Date.now() - 2 * skillsManager.IMPORT_LIMITS.IMPORT_TTL_MS;

      let entries = [];
      try {
        entries = fs.readdirSync(tmpDir, { withFileTypes: true });
      } catch {
        return { removed };
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!skillsManager.isImportResidueName(entry.name)) continue;
        const full = path.join(tmpDir, entry.name);
        let stat = null;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        // 不够陈旧 ⇒ 可能是另一个实例正在预览的包（WR-05 的教训）—— 放过
        if (!(stat.mtimeMs < cutoff)) continue;
        try {
          const res = await env.remove(full, { recursive: true, force: true });
          if (res && res.ok === true) removed += 1;
        } catch (err) {
          console.warn('[Realm AI] 清扫导入残留目录失败:', err && err.message ? err.message : err);
        }
      }
    } catch (err) {
      console.warn('[Realm AI] 清扫技能导入残留失败:', err && err.message ? err.message : err);
    }
    return { removed };
  }

  /**
   * 由技能文件路径求 tier（重载路径的元数据还原）—— 唯一的 `matchSkillByPath` 调用点
   *
   * @param {string} location - 技能文件绝对路径（入库存的是 `skill.filePath`）
   * @returns {string|null} tier；技能已被删除 / 改名时返回 null（气泡照常渲染）
   * @private
   */
  _skillTierByLocation(location) {
    const hit = getAiSkillsManagerLazy().matchSkillByPath(location, this.getSeededSkillNamesSafe());
    return hit ? hit.tier : null;
  }

  /**
   * 装饰一条入库的 user 行：还原气泡正文（args）与技能元数据（48 D-09 / D-06）
   *
   * 装饰失败**只告警不丢消息**（与 48-03 的 assistant 行装饰同款容错）。
   *
   * @param {string} text - 入库的 user 行 `content`
   * @returns {{content: string, skillInvocation: object}|null} 非技能调用消息返回 null
   * @private
   */
  _decorateSkillUserMessage(text) {
    try {
      return parseStoredSkillInvocation(text, (location) => this._skillTierByLocation(location));
    } catch (err) {
      console.warn('[Realm AI] 技能调用消息装饰失败（原样透传）:', err.message);
      return null;
    }
  }

  /**
   * 获取缓存的 Readability 库源码
   * 供渲染进程经 IPC 拉取后内联注入 webview，提取 @ 引用标签页内容
   *
   * @returns {string} Readability bundle 源码（加载失败为空字符串）
   */
  getReadabilityScript() {
    return READABILITY_SCRIPT || '';
  }

  /**
   * 构建带上下文的消息
   *
   * 将引用的标签页内容以 XML 格式注入到用户消息前缀。
   * 每个标签页内容最多 102,400 字符（per D-07）。
   *
   * @param {string} message - 原始用户消息
   * @param {Array} referencedTabs - 引用的标签页列表
   * @returns {string} 增强后的消息
   * @private
   */
  _buildMessageWithContext(message, referencedTabs) {
    if (!referencedTabs || referencedTabs.length === 0) {
      return message;
    }

    const MAX_CONTENT_SIZE = 102400; // 100KB per D-07

    // 构建 XML 格式的上下文块
    const contextBlocks = referencedTabs.map((tab, index) => {
      let content = tab.content || '';

      // 截断内容
      if (content.length > MAX_CONTENT_SIZE) {
        content = content.substring(0, MAX_CONTENT_SIZE) +
          `\n[截断：原始长度 ${tab.content.length} 字符，已截断至 ${MAX_CONTENT_SIZE} 字符]`;
      }

      return `<referenced-tab index="${index + 1}" title="${this._escapeXml(tab.title || '')}" url="${this._escapeXml(tab.url || '')}">
${content}
</referenced-tab>`;
    }).join('\n\n');

    return `${contextBlocks}\n\n用户消息：${message}`;
  }

  /**
   * 转义 XML 特殊字符
   * @param {string} str - 原始字符串
   * @returns {string} 转义后的字符串
   * @private
   */
  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 取消当前正在进行的 AI 操作
   */
  abort() {
    if (this.agent) {
      this.agent.abort();
      this.isProcessing = false;
      console.log('[Realm AI] 操作已取消');
    }
  }

  /**
   * 判定一次 `read` 工具调用是否在读取某个技能的正文（48 DISC-05 / D-15）
   *
   * **判定只在工具事件生成侧完成**（`_setupEventBroadcasting` 的 `tool_execution_start`）——
   * renderer 在 `file://` 主窗口、没有 `sandboxEnv`，拿不到技能目录的权威路径，按路径字符串
   * 包含猜就是第二份判定实现（T-48-10 的根因）。重载链路（`getConversationMessages`）**复用同一个**
   * 方法，使两条链路判据相同。
   *
   * 判定顺序严格如下，任一不满足即 `return null`（接口契约：**缺失 / 非法一律零回归**，
   * 渲染为普通 `read` 卡片）：
   * 1. 只认 `read` 工具；`args` 为假值 / `args.path` 非字符串 → null
   *    （SDK `read` 的参数键是 `path`，不是 `filePath`）
   * 2. 取 `this.sandboxEnv.cwd` 作解析基准（AI 未初始化时不得抛错）
   * 3. **纯词法** `path.resolve` 归一化（与 SDK `env.absolutePath` 同规则）；**不**额外展开
   *    `~` / `file://` —— 那类路径解析后落在工作区外、沙箱会拒绝，标 null 是与之一致的正确行为
   * 4. basename 必须是 `SKILL.md`（技能目录下的 `references/*.md` 同样不算「使用技能」）
   * 5. 命中判定走 `ai-skills-manager.matchSkillByPath`（与缓存 `filePath` 做规范化全等比较，
   *    **不按目录前缀猜、不重新扫盘**）
   *
   * 可靠性边界（如实写入产品文档）：极端 Unicode 文件名（NFD / 窄空格 / 弯引号变体）下标记
   * 可能不命中 —— 后果**仅**是显示为普通 `read` 卡片，技能正文仍被正常读取。
   *
   * @param {string} toolName - 工具名
   * @param {object|undefined} args - 工具参数（`read` 的路径在 `args.path`）
   * @returns {{name: string, tier: string}|null} 命中返回标记，否则 null
   * @private
   */
  _resolveSkillMarker(toolName, args) {
    if (toolName !== 'read' || !args || typeof args.path !== 'string') return null;
    const root = this.sandboxEnv && this.sandboxEnv.cwd;
    if (!root) return null;
    const abs = path.isAbsolute(args.path) ? path.resolve(args.path) : path.resolve(root, args.path);
    if (path.basename(abs) !== 'SKILL.md') return null;
    return getAiSkillsManagerLazy().matchSkillByPath(abs, this.getSeededSkillNamesSafe());
  }

  /**
   * 判定一次 `manage_skill` 调用的**基础标记**（Phase 49 D-02 / UI-SPEC 数据契约）
   *
   * 与 `_resolveSkillMarker` 同款约束：**同步、零 IO**。本函数只在
   * `tool_execution_start` 的同步上下文里跑 —— 那是**唯一**携带 `params` 的时点
   * （`tool_execution_end` 不带 params），错过就没有第二次机会。
   *
   * **`tier` 不在此判定**：`create` 的目标在调用前并不存在，磁盘判定只能等执行之后
   * （UI-SPEC 的两时点分工）。渲染端**不**自行判定任何东西（硬约束 4），只查白名单表。
   *
   * 判定顺序：非字符串 / trim 后为空 → `null`；`action` 不在三值白名单内 → `null`。
   * 任一不满足即「**整个技能变体不成立**」→ 渲染端回落既有普通卡片（标题 = 工具名），
   * 零回归（照抄 48-03 的非法标记回落口径）。
   *
   * @param {string} action - 工具参数 `action`
   * @param {string} name - 工具参数 `name`
   * @returns {{action: string, name: string}|null} 成立返回基础标记，否则 null
   * @private
   */
  _resolveManageSkillMarker(action, name) {
    if (typeof name !== 'string' || !name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (action !== 'create' && action !== 'update' && action !== 'delete') return null;
    return { action, name: trimmed };
  }

  /**
   * 构造 `manage_skill` 卡片标记的**唯一实现**（Phase 49 UI-SPEC 硬约束 3）
   *
   * 两条链路共用本函数，因此**不可能**出现「实时链路给一套键、重载链路给另一套键」的漂移：
   * - 实时链路：`terminal` 传工具执行期写入的**内存元数据**（经 `_resolveManageSkillTerminal`）；
   * - 重载链路：`terminal` 传从**已持久化**的 toolExecution 行还原的对象
   *   （经 `_manageSkillTerminalFromStored`）。
   *
   * 键的形状固定为 `{action, name, tier?, code?, promptIncluded?}` —— **不可判定时省略该键**
   * （宁缺勿猜：省略 ⇒ 渲染端跳过徽标 / 标注，不产出 `undefined` 字面量）。
   *
   * @param {object|undefined} params - 工具参数（`{action, name}` 的来源）
   * @param {object|null} terminal - 终态元数据（`{tier?, code?, promptIncluded?}`）
   * @returns {{action: string, name: string, tier?: string, code?: string, promptIncluded?: boolean}|null}
   * @private
   */
  _buildManageSkillDecoration(params, terminal) {
    const marker = this._resolveManageSkillMarker(
      params && params.action,
      params && params.name
    );
    if (!marker) return null;
    const decoration = { action: marker.action, name: marker.name };
    const src = terminal || {};
    if (typeof src.tier === 'string' && src.tier) decoration.tier = src.tier;
    if (typeof src.code === 'string' && src.code) decoration.code = src.code;
    // `promptIncluded === false` 是有意义的值（超预算标注），故按 boolean 判定存在性
    if (typeof src.promptIncluded === 'boolean') decoration.promptIncluded = src.promptIncluded;
    return decoration;
  }

  /**
   * 取**并清除**一次 `manage_skill` 执行的终态元数据（Phase 49 D-02 / UI-SPEC 硬约束 2）
   *
   * 失败态的原因码 / 档位**不经** `result.details`（SDK 的 `createErrorToolResult` 产出
   * `details` 恒为 `{}`），而经 `this._manageSkillMeta` 的按 `toolCallId` 短期元数据。
   *
   * 产出经 `_buildManageSkillDecoration` 过滤后**只投影出终态三键** —— 渲染端的「已存在条目」
   * 合并分支把它并入 start 事件给的 `{action, name}`（`tool_execution_end` 不带 params，
   * 故这里无法也不应该重复 action / name）。
   *
   * **读后即删**：同一 `toolCallId` 若被重复发送 end 事件，第二次得 `null` 是**正确**行为
   * —— 标记已在第一次完整给出，Map 不累积、不跨轮残留。
   *
   * @param {string} toolCallId - 工具调用 ID
   * @returns {{tier?: string, code?: string, promptIncluded?: boolean}|null}
   * @private
   */
  _resolveManageSkillTerminal(toolCallId) {
    const meta = this._manageSkillMeta.get(toolCallId);
    if (!meta) return null;
    this._manageSkillMeta.delete(toolCallId);
    const decoration = this._buildManageSkillDecoration(meta, meta);
    if (!decoration) return null;
    const terminal = {};
    if (decoration.tier) terminal.tier = decoration.tier;
    if (decoration.code) terminal.code = decoration.code;
    if (typeof decoration.promptIncluded === 'boolean') {
      terminal.promptIncluded = decoration.promptIncluded;
    }
    return Object.keys(terminal).length > 0 ? terminal : null;
  }

  /**
   * 重载链路：从**已持久化**的 toolExecution 行还原 `manage_skill` 终态元数据
   *
   * 可还原的三项：
   * - `promptIncluded` —— 取 `tool_results` 列回填的 `details.promptIncluded`（**历史真值**，
   *   即该次调用当时给模型的答复；不重算，因为「当时是否进提示词」事后无法复现）；
   * - `code` —— 从持久化**文本**（失败消息）起始处的 `[code] ` 词缀解析还原（WR-02）。
   *   失败态的原因码没有别的通道：SDK 的 `createErrorToolResult(message)` 产出的 `details`
   *   恒为 `{}`，而工具失败出口把 `[code] ` 写进了**被抛出的消息**（该消息即落进
   *   `tool_results` 的文本）。三条边界：
   *   ① **不重算** —— 按当前磁盘状态重判「当时为什么失败」会随技能被删除 / 改名而漂移；
   *   ② 改动前落库的旧失败消息**没有**词缀 ⇒ 解析失败即**不设键**（宁缺勿猜，与既有
   *      `tier` 口径一致）—— 旧历史卡片表现为「只有失败、没有短原因」，与改动前一致，零回归；
   *   ③ 解析**只认消息起始**（`MANAGE_SKILL_CODE_TAG` 锚定 `^`）—— 成功文案不可能误命中。
   * - `tier` —— 按 `name` 查**当前**技能集的收窄投影（与实时链路同一份 `getSkillsForUI`）；
   *   技能事后被删除 / 改名 → 查不到 ⇒ 省略该键（跳过徽标，不猜）。
   *
   * @param {object} t - 已持久化的 toolExecution 显示形状行
   * @returns {object} 终态元数据（可为 `{}`）
   * @private
   */
  _manageSkillTerminalFromStored(t) {
    const terminal = {};
    const details = t && t.details;
    if (details && typeof details.promptIncluded === 'boolean') {
      terminal.promptIncluded = details.promptIncluded;
    }
    // 失败态原因码：`t.error` 优先（失败行的完整文案）、`t.result` 回退（两条通道都可能是
    // 载体）；两者都不是非空字符串则不解析。用与写入侧**同一个常量**解析（单源）。
    const storedText = typeof (t && t.error) === 'string' && t.error
      ? t.error
      : (typeof (t && t.result) === 'string' ? t.result : '');
    const codeMatch = storedText ? MANAGE_SKILL_CODE_TAG.exec(storedText) : null;
    if (codeMatch) terminal.code = codeMatch[1];
    const name = t && t.params && typeof t.params.name === 'string' ? t.params.name.trim() : '';
    if (name) {
      const hit = this.getSkillsForUI().skills.find((e) => e.name === name);
      if (hit && hit.tier) terminal.tier = hit.tier;
    }
    return terminal;
  }

  /**
   * 设置事件广播机制（per D-05~D-08）
   *
   * 订阅 Agent 事件，翻译为渲染端 UI 契约后广播：
   * - SDK message_update {message, assistantMessageEvent} → {content}（提取 text 块累积全文）
   * - SDK tool_execution_start/update/end → {tool_execution_id, tool_name, status, params, result, error}
   * - SDK turn_end（每轮）→ 仅同步文本（一轮 run 可能多轮，工具调用后还有后续轮）
   * - SDK agent_end（run 结束）→ 最终文本 + turn_end 信号
   * - 高频事件（message_update, tool_execution_update）debounce 16ms 批量合并（per D-06）
   *
   * @private
   */
  _setupEventBroadcasting() {
    if (!this.agent) return;

    /** @type {Array} 高频事件批次 */
    let eventBatch = [];
    /** @type {NodeJS.Timeout|null} 批量发送定时器 */
    let batchTimer = null;

    const enqueue = (uiEvent) => {
      eventBatch.push({ ...uiEvent, timestamp: Date.now() });
      if (!batchTimer) {
        batchTimer = setTimeout(() => {
          this._sendEventsBatch(eventBatch);
          eventBatch = [];
          batchTimer = null;
        }, 16);
      }
    };

    // 立即事件发送前先刷出积压的批量事件——否则时序倒挂：
    // bash 的 onUpdate 流式 running 事件走 16ms 批量通道，而
    // tool_execution_end（completed）走立即通道，end 先发出、
    // 积压的 running 后刷出，渲染端状态被回改成「正在执行」
    const flushPending = () => {
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
        if (eventBatch.length > 0) {
          this._sendEventsBatch(eventBatch);
          eventBatch = [];
        }
      }
    };

    const sendNow = (uiEvent) => {
      flushPending();
      this._sendEventsBatch([{ ...uiEvent, timestamp: Date.now() }]);
    };

    this.agent.subscribe((event) => {
      switch (event.type) {
        case 'message_update': {
          // SDK: { message, assistantMessageEvent } → UI: { content }
          enqueue({ type: 'message_update', content: this._extractText(event.message) });
          break;
        }

        case 'tool_execution_start': {
          console.log(`[Realm AI] 工具调用: ${event.toolName}`, JSON.stringify(event.args || {}));
          sendNow({
            type: 'tool_execution_update',
            tool_execution_id: event.toolCallId,
            tool_name: event.toolName,
            status: 'running',
            params: event.args,
            // 48-03（D-15）：read 工具读取技能正文时的展示标记。只能在这里打 ——
            // 本处是**同步**上下文而匹配可同步完成（缓存 filePath 是内存数据）；
            // tool_execution_end 不带 params，标记错过 start 就没有第二次机会；
            // renderer 的更新分支用 ...spread 保留既有字段，标记在后续状态更新中自然留存。
            // 非技能 read / 非 read 工具 / 非法参数 → null（渲染普通卡片，零回归）。
            skill_invocation: this._resolveSkillMarker(event.toolName, event.args),
            // Phase 49（D-02）的第一时点：`manage_skill` 的**基础标记**（action + name）。
            // 与 `skill_invocation` 同款命名法（snake_case → 渲染端 camelCase）。
            // 只有本时点携带 `params`，且标题必须**在运行中即可见**；`tier` / `code` /
            // `promptIncluded` **只在 end 给出**（`create` 的目标在调用前并不存在，
            // 磁盘判定只能等执行之后）。非 `manage_skill` 工具 / 非法参数 → null。
            manage_skill: event.toolName === 'manage_skill'
              ? this._resolveManageSkillMarker(event.args && event.args.action, event.args && event.args.name)
              : null,
          });
          break;
        }

        case 'tool_execution_update': {
          enqueue({
            type: 'tool_execution_update',
            tool_execution_id: event.toolCallId,
            tool_name: event.toolName,
            status: 'running',
            result: event.partialResult,
          });
          break;
        }

        case 'tool_execution_end': {
          const status = event.isError ? 'failed' : 'completed';
          const resultText = this._safePreview(event.result);
          console.log(`[Realm AI] 工具${status === 'failed' ? '失败' : '完成'}: ${event.toolName} → ${resultText}`);
          sendNow({
            type: 'tool_execution_update',
            tool_execution_id: event.toolCallId,
            tool_name: event.toolName,
            status,
            result: event.result,
            error: event.isError ? resultText : undefined,
            // Phase 49（D-02）的第二时点：并入终态三键 `{tier?, code?, promptIncluded?}`。
            // 来源是工具执行期按 toolCallId 写入的短期元数据（成功与失败**两个出口**各写一次）
            // —— **不是** `result.details`：SDK 的 `createErrorToolResult()` 产出 details
            // 恒为 `{}`，失败态的原因码经它传递等于永远丢给渲染端（RESEARCH Pitfall 3 /
            // UI-SPEC 硬约束 2）。读取后即删（同一 toolCallId 重复发 end 得 null 是正确行为）。
            manage_skill: event.toolName === 'manage_skill'
              ? this._resolveManageSkillTerminal(event.toolCallId)
              : null,
          });
          break;
        }

        case 'turn_end': {
          // 一轮结束（一轮 run 可能有多轮：工具调用后还有后续轮）
          // 只同步该轮文本，不发终止信号
          const text = this._extractText(event.message);
          if (text) {
            console.log(`[Realm AI] 本轮回复: ${this._truncate(text)}`);
            sendNow({ type: 'message_update', content: text });
          }
          break;
        }

        case 'agent_end': {
          // 整个 run 结束：取最后一条 assistant 消息的文本作为最终内容
          const lastAssistant = [...(event.messages || [])].reverse()
            .find(m => m && m.role === 'assistant');

          // LLM 级错误（401/403/限流/网络等）：SDK 不抛异常，而是产出
          // 带 errorMessage 的 AssistantMessage——必须转为 error 事件，
          // 否则渲染端只会留下一个空气泡，没有错误提示
          const errorMessage = lastAssistant && lastAssistant.errorMessage;
          if (errorMessage) {
            console.error(`[Realm AI] 模型返回错误: ${errorMessage}`);
            sendNow({ type: 'error', message: errorMessage });
            break;
          }

          const finalText = this._extractText(lastAssistant);
          console.log(`[Realm AI] 回复完成: ${this._truncate(finalText) || '(无文本内容)'}`);
          // 空文本不覆盖气泡（避免清掉中间轮已渲染的内容）
          if (finalText) {
            sendNow({ type: 'message_update', content: finalText });
          }
          sendNow({ type: 'turn_end' });

          // 回复结束后推送最新上下文用量（圆环按钮实时刷新）
          sendNow({ type: 'context_usage', usage: this.getContextUsage() });

          // 保存当前对话消息到数据库（per D-11）
          try {
            this.saveCurrentConversation();
          } catch (err) {
            console.error('[Realm AI] 保存对话消息失败:', err.message);
          }
          break;
        }

        default:
          // agent_start / turn_start / message_start / message_end：UI 无需感知
          break;
      }
    });
  }

  /**
   * 从 AgentMessage 中提取文本内容
   * AssistantMessage.content 为内容块数组：[{type:'text',text}, {type:'thinking',...}, ToolCall]
   * @param {Object} message - Agent 消息对象
   * @returns {string} 拼接后的文本
   * @private
   */
  _extractText(message) {
    if (!message || !Array.isArray(message.content)) return '';
    return message.content
      .filter(block => block && block.type === 'text')
      .map(block => block.text || '')
      .join('');
  }

  /**
   * 截断长文本用于日志输出
   * @param {string} text - 原始文本
   * @param {number} [max=1000] - 最大长度
   * @returns {string} 截断后的文本
   * @private
   */
  _truncate(text, max = 1000) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + `…（共 ${text.length} 字）` : text;
  }

  /**
   * 安全地将工具结果转为日志可读的短文本
   * @param {*} result - 工具执行结果
   * @returns {string} 预览文本（截断 200 字符）
   * @private
   */
  _safePreview(result) {
    try {
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      return this._truncate(text || '(空)', 200);
    } catch {
      return '(无法序列化)';
    }
  }

  /**
   * 批量发送事件到渲染进程（per D-07, D-08）
   *
   * 使用 webContents.send() 将事件推送到主窗口的渲染进程。
   * 事件通道为 ai:events-batch，渲染进程通过 ipcRenderer.on() 接收。
   *
   * @param {Array} events - 事件数组
   * @private
   */
  _sendEventsBatch(events) {
    const win = windowManager.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ai:events-batch', { events });
    }
  }

  /**
   * 判断供应商是否可用（已保存 Key 或环境变量可解析）
   *
   * 与搜索配置语义对齐：环境变量可用即视为已配置，
   * 存储层不物化环境变量值（保存时不写入 Key）。
   *
   * @param {string} providerId - 提供商 ID
   * @param {Object|null} cfg - configStore 中该提供商的配置
   * @returns {boolean}
   */
  _isProviderConfigured(providerId, cfg) {
    if (!cfg) return false;
    if (cfg.apiKey) return true;
    const envResult = this.detectEnvVar(providerId, cfg.envVarName);
    return Boolean(envResult && envResult.found);
  }

  /**
   * 解析供应商运行时 API Key
   *
   * 优先级：环境变量 > configStore 已保存的 Key（与搜索配置一致）。
   * 环境变量的值从不落盘，每次运行时动态解析，改环境变量重启即生效。
   *
   * @param {string} providerId - 提供商 ID
   * @param {Object|null} cfg - configStore 中该提供商的配置
   * @returns {string} 解析到的 Key，两者都无时为空字符串
   */
  _resolveProviderKey(providerId, cfg) {
    if (!cfg) return '';
    const envResult = this.detectEnvVar(providerId, cfg.envVarName);
    if (envResult && envResult.found && envResult.value) return envResult.value;
    return cfg.apiKey || '';
  }

  /**
   * 配置 AI 提供商
   *
   * 保存指定提供商的 API Key 和模型，设为激活提供商并重新初始化 Agent。
   * 当用户在设置页面更新配置时调用。
   *
   * @param {Object} config - 配置对象
   * @param {string} config.provider - 提供商 ID（如 'openai'、'xiaomi'）
   * @param {string} config.apiKey - API Key
   * @param {string} [config.model] - 模型 ID（可选，默认取提供商目录第一个模型）
   * @returns {Promise<{success: boolean}>} 操作结果
   */
  async configureProviders(config) {
    const { provider, model, envVarName, customModels, isBuiltin, baseURL, displayName, enabled } = config;
    let { apiKey } = config;

    if (!provider) {
      throw new Error('提供商不能为空');
    }

    // Key 写入策略（与搜索配置一致）：
    // - 手动输入了 Key → 新 Key 落盘
    // - 未输入（__keep__ 哨兵或空）→ 不物化环境变量值，保留已存 Key（可为空）；
    //   环境变量由运行时 _resolveProviderKey 动态解析（优先级：环境变量 > 已保存 Key）
    const existingProviders = this.configStore ? this.configStore.get('ai.providers', {}) : {};
    const existingCfg = existingProviders[provider] || {};
    if (apiKey === '__keep__' || !apiKey) {
      apiKey = existingCfg.apiKey || '';
      if (!apiKey && isBuiltin !== false) {
        const envResult = this.detectEnvVar(provider, envVarName);
        if (!envResult.found) {
          throw new Error('未找到已保存的 API Key 或环境变量，请手动输入');
        }
      }
    }

    // 自定义供应商允许首次创建时无 apiKey（用户稍后填写）；
    // 环境变量可用的自定义供应商不走 pending，按正常路径保存（运行时动态解析）
    if (!apiKey && isBuiltin === false && !this.detectEnvVar(provider, envVarName).found) {
      // 保存配置但不初始化 Agent
      if (this.configStore) {
        const providers = this.configStore.get('ai.providers', {});
        const existing = providers[provider] || {};
        providers[provider] = {
          ...existing,
          apiKey: '',
          model: existing.model || null,
          envVarName: envVarName !== undefined ? envVarName : existing.envVarName,
          customModels: customModels !== undefined ? customModels : existing.customModels,
          isBuiltin: false,
          baseURL: baseURL !== undefined ? baseURL : existing.baseURL,
          displayName: displayName !== undefined ? displayName : existing.displayName,
          enabled: enabled !== undefined ? enabled : existing.enabled,
        };
        this.configStore.set('ai.providers', providers);
        console.log(`[Realm AI] 自定义供应商已保存（待填写 API Key）: ${provider}`);
      }
      return { success: true, pending: true };
    }

    // 校验提供商存在（内置供应商），自定义供应商跳过校验
    // 可选模型集合优先使用 customModels（用户检测/删减后的列表），
    // 请求未携带时回退已保存的 existing.customModels（如下拉切换模型只传 model），
    // 否则回退 catalog 默认列表——检测到的新模型可能不在 catalog 中
    let validModel = model || null;
    const customList = (Array.isArray(customModels) && customModels.length > 0 && customModels)
      || (Array.isArray(existingCfg.customModels) && existingCfg.customModels.length > 0 && existingCfg.customModels)
      || null;
    if (isBuiltin !== false) {
      const catalog = await this._getCatalog();
      const catalogProvider = catalog.getProviders().find(p => p.id === provider);
      if (!catalogProvider) {
        throw new Error(`未知提供商: ${provider}`);
      }
      const providerModels = catalogProvider.getModels();
      const availableIds = customList || providerModels.map(m => m.id);
      validModel = model && availableIds.includes(model)
        ? model
        : (availableIds[0] || null);
    } else if (!validModel && customList) {
      validModel = customList[0];
    }

    // 更新 configStore
    if (this.configStore) {
      const providers = this.configStore.get('ai.providers', {});
      const existing = providers[provider] || {};
      providers[provider] = {
        ...existing,
        apiKey,
        model: validModel || existing.model,
        envVarName: envVarName !== undefined ? envVarName : existing.envVarName,
        customModels: customModels !== undefined ? customModels : existing.customModels,
        isBuiltin: isBuiltin !== undefined ? isBuiltin : (existing.isBuiltin !== undefined ? existing.isBuiltin : true),
        baseURL: baseURL !== undefined ? baseURL : existing.baseURL,
        displayName: displayName !== undefined ? displayName : existing.displayName,
        enabled: enabled !== undefined ? enabled : existing.enabled,
      };
      this.configStore.set('ai.providers', providers);
      // setActive=false 时（如启用/停用开关）不劫持当前激活供应商
      if (config.setActive !== false) {
        this.configStore.set('ai.activeProvider', provider);
      }

      console.log(`[Realm AI] 供应商已保存: ${provider} (builtin: ${isBuiltin !== undefined ? isBuiltin : true})`);

      // 重新初始化 Agent
      await this.init(this.configStore);

      // 同步当前对话的元数据（否则对话切换模型后 DB model 列仍停留在
      // 建行时的旧值，误导后续排查——2026-09-05 ScreenShot 对话事故）
      if (this.currentConversationId && this.isInitialized) {
        this.conversationMeta = { model: this.activeModelId, provider: this.activeProvider };
      }
    }

    return { success: true };
  }

  /**
   * 获取可用的 AI 提供商和模型目录
   *
   * 返回 pi-ai 全部内置提供商（37+）及其模型列表，
   * 附带每个提供商的配置状态（是否已保存 Key、Key 尾号预览）。
   * 目录枚举不依赖初始化状态，设置页在任何时刻都可获取。
   *
   * @returns {Promise<{providers: Array, activeProvider: string|null, activeModel: string|null}>}
   */
  async getAvailableModels() {
    const catalog = await this._getCatalog();
    const providersCfg = this.configStore ? this.configStore.get('ai.providers', {}) : {};
    const activeProvider = this.configStore ? this.configStore.get('ai.activeProvider', null) : null;

    const providers = catalog.getProviders().map(p => {
      const saved = providersCfg[p.id];
      // 配置状态含环境变量回退（存储不物化环境变量值）
      const savedKey = saved && saved.apiKey ? saved.apiKey : '';
      const hasKey = this._isProviderConfigured(p.id, saved);
      const customModels = saved && saved.customModels ? saved.customModels : [];
      // customModels 非空时视为用户确认过的列表（检测/删减后的结果），
      // 优先于 catalog 默认列表回显；名称尽量从 catalog 补全
      const catalogModels = p.getModels();
      const models = customModels.length > 0
        ? customModels.map(id => {
            const cm = catalogModels.find(m => m.id === id);
            // cm 缺失（检测到的 catalog 外模型）时按 ID 正则兜底
            return { id, name: cm ? cm.name : id, imageCapable: cm ? modelSupportsImage(cm) : modelSupportsImage({ input: ['text'], id }) };
          })
        : catalogModels.map(m => ({ id: m.id, name: m.name, imageCapable: modelSupportsImage(m) }));
      return {
        id: p.id,
        name: saved && saved.displayName ? saved.displayName : p.name,
        configured: hasKey,
        keyPreview: savedKey ? `…${savedKey.slice(-4)}` : null,
        activeModel: saved && saved.model ? saved.model : null,
        models,
        envVarName: saved && saved.envVarName ? saved.envVarName : null,
        isBuiltin: true,
        customModels,
        baseURL: p.baseURL || p.baseUrl || null,
        enabled: saved && saved.enabled === false ? false : true,
      };
    });

    // 附加自定义供应商（不在 catalog 中的）
    for (const [id, saved] of Object.entries(providersCfg)) {
      if (saved && !catalog.getProviders().find(p => p.id === id)) {
        const savedKey = saved.apiKey || '';
        const hasKey = this._isProviderConfigured(id, saved);
        providers.push({
          id,
          name: saved.displayName || id,
          configured: hasKey,
          keyPreview: savedKey ? `…${savedKey.slice(-4)}` : null,
          activeModel: saved.model || null,
          models: saved.customModels
            ? saved.customModels.map(id => ({ id, name: id, imageCapable: modelSupportsImage({ input: ['text'], id }) }))
            : [],
          envVarName: saved.envVarName || null,
          isBuiltin: false,
          customModels: saved.customModels || [],
          baseURL: saved.baseURL || null,
          enabled: saved.enabled === false ? false : true,
        });
      }
    }

    return {
      providers,
      activeProvider,
      activeModel: activeProvider && providersCfg[activeProvider]
        ? providersCfg[activeProvider].model
        : null,
    };
  }

  /**
   * 读取视觉专用模型配置（Vision Bridge）
   *
   * @returns {{visionModel: {provider: string, model: string}|null, resolved: boolean}}
   *   resolved = 配置当前可解析出可用的视觉模型（供设置页回显有效性警示）
   */
  getVisionModel() {
    const visionModel = this.configStore ? this.configStore.get('ai.visionModel', null) : null;
    const resolved = !!(visionModel && this.visionDescriber && this.visionDescriber.isConfigured());
    return { visionModel: visionModel || null, resolved };
  }

  /**
   * 设置视觉专用模型（Vision Bridge）
   *
   * 校验通过后写 configStore 键 ai.visionModel = { provider, model }；
   * 传 { provider: null } 清除配置。
   *
   * @param {Object|null} config - { provider, model } 或 null/{provider:null} 清除
   * @returns {Promise<{success: boolean}>}
   * @throws {Error} 校验失败（供应商未配置/被禁用/模型不可用）
   */
  async setVisionModel(config) {
    if (!this.configStore) {
      throw new Error('AI Manager 未初始化');
    }
    const provider = config && typeof config.provider === 'string' ? config.provider : null;
    if (!provider) {
      this.configStore.delete('ai.visionModel');
      return { success: true };
    }
    const model = config && typeof config.model === 'string' ? config.model : null;
    if (!model) {
      throw new Error('视觉模型 ID 不能为空');
    }

    // 供应商须已配置、Key 可解析（含环境变量回退）且未禁用
    const providers = this.configStore.get('ai.providers', {});
    const saved = providers[provider];
    if (!saved) {
      throw new Error(`供应商 ${provider} 未配置`);
    }
    if (saved.enabled === false) {
      throw new Error(`供应商 ${provider} 已被禁用，请先启用`);
    }
    if (!this._isProviderConfigured(provider, saved)) {
      throw new Error(`供应商 ${provider} 的 API Key 未配置`);
    }

    // 模型须在该供应商可解析集合内且具备图片输入能力
    const available = await this.getAvailableModels();
    const providerEntry = available.providers.find(p => p.id === provider);
    const modelEntry = providerEntry && providerEntry.models.find(m => m.id === model);
    if (!modelEntry) {
      throw new Error(`模型 ${model} 不在供应商 ${provider} 的可用模型列表中`);
    }
    if (!modelEntry.imageCapable) {
      throw new Error(`模型 ${model} 不支持图片输入，请选择带视觉能力的模型`);
    }

    this.configStore.set('ai.visionModel', { provider, model });
    console.log(`[Realm AI] 视觉模型已配置: ${provider}/${model}`);
    return { success: true };
  }

  /**
   * 检测环境变量（per D-07/D-08）
   *
   * 按提供商约定自动检测环境变量名。优先使用用户自定义环境变量名，
   * 否则查 PROVIDER_ENV_MAP 映射表。只读访问 process.env，不修改。
   *
   * @param {string} providerId - 提供商 ID（如 'openai'、'deepseek'）
   * @param {string|null} [customEnvVarName] - 用户自定义环境变量名
   * @returns {{found: boolean, name: string|null, value: string|null}}
   */
  detectEnvVar(providerId, customEnvVarName) {
    const envName = customEnvVarName || PROVIDER_ENV_MAP[providerId] || null;
    if (envName && process.env[envName]) {
      return { found: true, name: envName, value: process.env[envName] };
    }
    return { found: false, name: envName, value: null };
  }

  /**
   * 检测模型列表（per D-16/D-17）
   *
   * 调用提供商的 /models 端点获取可用模型列表。对内置供应商使用默认端点，
   * 对自定义供应商使用传入的 baseURL。
   *
   * @param {string} providerId - 提供商 ID
   * @param {string} apiKey - API Key
   * @param {string|null} [baseURL] - 自定义端点 URL
   * @returns {Promise<{models?: Array<{id: string, name: string}>, error?: string}>}
   */
  async detectModels(providerId, apiKey, baseURL) {
    if (!apiKey) {
      return { error: 'API Key 不能为空' };
    }

    let modelsURL;
    if (baseURL) {
      modelsURL = `${baseURL.replace(/\/$/, '')}/models`;
    } else {
      // 从内置目录获取默认端点
      try {
        const catalog = await this._getCatalog();
        const provider = catalog.getProviders().find(p => p.id === providerId);
        const providerBaseURL = provider && (provider.baseURL || provider.baseUrl);
        if (providerBaseURL) {
          modelsURL = `${providerBaseURL.replace(/\/$/, '')}/models`;
        } else if (providerId === 'openai') {
          modelsURL = 'https://api.openai.com/v1/models';
        } else if (providerId === 'deepseek') {
          modelsURL = 'https://api.deepseek.com/v1/models';
        } else if (providerId === 'anthropic') {
          modelsURL = 'https://api.anthropic.com/v1/models';
        } else if (providerId === 'google') {
          modelsURL = 'https://generativelanguage.googleapis.com/v1beta/models';
        } else if (providerId === 'groq') {
          modelsURL = 'https://api.groq.com/openai/v1/models';
        } else if (providerId === 'xai') {
          modelsURL = 'https://api.x.ai/v1/models';
        } else if (providerId === 'mistral') {
          modelsURL = 'https://api.mistral.ai/v1/models';
        } else {
          return { error: `提供商 ${providerId} 没有默认端点，请手动指定 base URL` };
        }
      } catch {
        return { error: `提供商 ${providerId} 端点解析失败` };
      }
    }

    try {
      console.log(`[Realm AI] 检测模型: ${providerId} → ${modelsURL}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(modelsURL, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { error: 'API Key 无效' };
        }
        return { error: `HTTP ${res.status}` };
      }

      const data = await res.json();
      const models = (data.data || data.models || []).map(m => ({
        id: m.id,
        name: m.id,
      }));

      console.log(`[Realm AI] 检测模型: ${providerId} → ${models.length} 个模型`);
      return { models };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { error: '请求超时（10秒）' };
      }
      return { error: `网络连接失败: ${err.message}` };
    }
  }

  /**
   * 获取指定供应商已保存的完整 API Key
   *
   * 供设置页输入框回显/显隐切换查看使用。
   * 与 env-var 端点不同：这是用户已保存到 configStore 的自有数据，按需返回。
   *
   * @param {string} providerId - 提供商 ID
   * @returns {string|null} 完整 API Key，未保存时返回 null
   */
  getProviderApiKey(providerId) {
    if (!this.configStore) return null;
    const cfg = this.configStore.get(`ai.providers.${providerId}`);
    return cfg && cfg.apiKey ? cfg.apiKey : null;
  }

  /**
   * 开始新对话
   *
   * 创建新的对话记录并重置 Agent 的对话状态。
   * 用户在聊天面板点击「新对话」时调用。
   */
  newConversation() {
    this.createNewConversation();
  }

  // ==================== 对话管理方法 ====================

  /**
   * 切换对话（per D-09 一对话一实例模式）
   *
   * 核心逻辑：
   * a. 保存当前消息到数据库
   * b. 销毁旧 Agent 实例
   * c. 从数据库加载目标对话消息（AgentMessage 注入形状，getAgentMessages）
   * d. await 创建新 Agent 实例（_recreateAgent 为异步——动态 import 后
   *    才赋值 this.agent，必须等待完成再注入，否则注入守卫恒 false，
   *    历史消息从不进入上下文，per G-42-4 根因）
   * e. 通过 agent.state.messages 直接注入历史消息
   * f. 设置 currentConversationId
   *
   * @param {string} conversationId - 目标对话 ID
   * @returns {Promise<Object>} 切换后的对话对象
   */
  async switchConversation(conversationId) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }

    // 获取目标对话
    const targetConversation = conversationStore.getConversation(conversationId);
    if (!targetConversation) {
      throw new Error('对话不存在: ' + conversationId);
    }

    // 保存当前对话消息
    if (this.currentConversationId && this.agent) {
      try {
        this.saveCurrentConversation();
      } catch (err) {
        console.warn('[Realm AI] 保存当前对话失败:', err.message);
      }
    }

    // 清理旧 Agent 实例
    this._cleanupCurrentAgent();

    // 从数据库加载目标对话消息（AgentMessage 形状，供上下文注入）
    const agentMessages = conversationStore.getAgentMessages(conversationId);

    // 创建新 Agent 实例（必须 await：this.agent 在动态 import 之后的
    // 微任务中才赋值，同步帧内恒为 null——per G-42-4）
    await this._recreateAgent();

    // 注入历史消息（per RESEARCH Pitfall 2，直接赋值不触发 LLM；
    // 守卫覆盖模型缺失等重建失败分支，此时保持空上下文而非报错）
    if (this.agent && agentMessages.length > 0) {
      this.agent.state.messages = agentMessages;
      console.log(`[Realm AI] 已注入 ${agentMessages.length} 条历史消息到 Agent 上下文`);
    }

    // 更新状态
    this.currentConversationId = conversationId;
    this.conversationMeta = {
      model: targetConversation.model,
      provider: targetConversation.provider,
    };

    console.log('[Realm AI] 已切换对话: ' + conversationId + ' (' + targetConversation.title + ')');

    return targetConversation;
  }

  /**
   * 保存当前对话消息到数据库（per D-11）
   *
   * 获取 agent.state.messages，提取元数据，调用 conversationStore.saveMessages()
   */
  saveCurrentConversation() {
    if (!this.currentConversationId || !this.agent) return;

    try {
      const messages = this.agent.state.messages || [];
      if (messages.length === 0) return;

      // 保存消息到数据库
      conversationStore.saveMessages(this.currentConversationId, messages);

      // 更新对话元数据（per D-12）
      // 注意：updated_at 由 conversationStore.updateConversation 自动设置为当前时间，
      // 此处传入的值会被忽略，仅作为语义标记
      const updates = {
        updated_at: Date.now(),
      };
      if (this.conversationMeta.model) {
        updates.model = this.conversationMeta.model;
      }
      if (this.conversationMeta.provider) {
        updates.provider = this.conversationMeta.provider;
      }
      conversationStore.updateConversation(this.currentConversationId, updates);
    } catch (err) {
      console.error('[Realm AI] 保存对话消息失败:', err.message);
    }
  }

  /**
   * 创建新对话（per D-04 标题默认截取首条用户消息前 30 字符）
   *
   * a. 调用 conversationStore.createConversation()
   * b. 清理旧 Agent 实例
   * c. await 创建新 Agent 实例（与 switchConversation 一致——_recreateAgent
   *    为异步，不等待则同步帧内 this.agent 恒为 null，创建后快速发送消息
   *    会触发 prompt 守卫二次重建，产生双 Agent/双重订阅竞态，per WR-05）
   * d. 设置 currentConversationId
   *
   * @returns {Promise<Object>} 创建的对话对象
   */
  async createNewConversation() {
    // 保存当前对话
    if (this.currentConversationId && this.agent) {
      try {
        this.saveCurrentConversation();
      } catch (err) {
        console.warn('[Realm AI] 保存当前对话失败:', err.message);
      }
    }

    // 获取当前模型配置
    const modelId = this.activeModelId || null;
    const provider = this.activeProvider || null;

    // 创建新对话记录
    const conversation = conversationStore.createConversation({
      title: '新对话',
      model: modelId,
      provider: provider,
    });

    // 清理旧 Agent 实例
    this._cleanupCurrentAgent();

    // 创建新 Agent 实例（必须 await：理由同 switchConversation，per WR-05）
    await this._recreateAgent();

    // 更新状态
    this.currentConversationId = conversation.id;
    this.conversationMeta = { model: modelId, provider: provider };

    console.log('[Realm AI] 创建新对话: ' + conversation.id);

    return conversation;
  }

  /**
   * 压缩当前对话上下文（/compact）
   *
   * LLM 摘要压缩点前的全部历史 + 回注最近 COMPACT_RECENT_TURNS 轮原文，
   * 替换 agent.state.messages 并经 saveMessages 全量替换事务落库
   * （压缩点前旧行自动清除，重开对话后上下文同为压缩态）。
   *
   * 失败安全：LLM 摘要失败发生在任何赋值/落库之前，原上下文原数据原状，
   * 无需回滚代码；落库为单事务原子生效。
   *
   * @param {Object} [options]
   * @param {string} [options.focus] - 用户指定的摘要重点（/compact 的参数）
   * @returns {Promise<{success: boolean, skipped?: boolean, message?: string,
   *   before: number, after: number, tokensBefore: number, tokensAfter: number}>}
   * @throws {Error} 未初始化 / 无可压缩对话 / 正在处理消息 / 摘要生成失败
   */
  async compactConversation(options = {}) {
    // ---- 守卫（全部 throw，不做任何状态变更）----
    if (!this.isInitialized || !this.models) {
      throw new Error('AI 助手未初始化，请先在设置中配置模型');
    }
    if (!this.agent || !this.currentConversationId) {
      throw new Error('没有可压缩的对话');
    }
    if (this.isProcessing) {
      throw new Error('AI 正在处理消息，请稍后再压缩');
    }

    // ---- 取全量上下文（system 提示独立存于 initialState，正常不存在，防御性过滤）----
    const messages = (this.agent.state.messages || []).filter(m => m.role !== 'system');
    const before = messages.length;
    const tokensBefore = this._estimateMessagesTokens(messages);

    // ---- 切分最近轮次：反向找最近 N 条 user 消息，取最早一条为切点 ----
    // 切点必取 user 行起点，保证 recent 不拆轮、toolCall/toolResult 配对完整
    let cutIdx = messages.length;
    let userCount = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userCount++;
        if (userCount >= COMPACT_RECENT_TURNS) {
          cutIdx = i;
          break;
        }
      }
    }

    // 对话不足 N 轮：无压缩价值，整体跳过（此时 cutIdx 未命中，
    // 若不在此拦截会把全部历史压缩掉、一条原文都不保留）
    if (userCount < COMPACT_RECENT_TURNS) {
      return {
        success: true,
        skipped: true,
        message: `对话不足 ${COMPACT_RECENT_TURNS} 轮，无需压缩`,
        before, after: before, tokensBefore, tokensAfter: tokensBefore,
      };
    }

    const oldMessages = messages.slice(0, cutIdx);
    const recentMessages = messages.slice(cutIdx);

    // 兜底：恰好 N 轮时切点为最早一条 user，旧消息为空
    if (oldMessages.length === 0) {
      return {
        success: true,
        skipped: true,
        message: '对话较短，无需压缩',
        before, after: before, tokensBefore, tokensAfter: tokensBefore,
      };
    }

    // ---- 构造摘要 prompt 并调 LLM（唯一有失败风险的一步）----
    const conversationText = this._serializeMessagesForSummary(oldMessages);
    let summaryRequest = '以下是对话记录，请将其压缩为结构化摘要。\n\n' +
      '<conversation>\n' + conversationText + '\n</conversation>\n\n' +
      '请按以下四个小节输出纯文本摘要（小节标题用【】，不要使用 Markdown 代码块包裹整体）：\n\n' +
      '【任务目标】用户要完成的一件或多件事\n' +
      '【关键决策】过程中确定的重要决策及其理由\n' +
      '【当前状态】已完成的事项、进行中的事项、被阻塞的事项\n' +
      '【注意事项】后续继续工作必须知晓的细节：文件路径、报错信息原文、关键参数、遗留风险等，原样保留\n\n' +
      '摘要要自包含：只读摘要就能接续工作，不需要回看原对话。';
    const focus = typeof options.focus === 'string' ? options.focus.trim().slice(0, 500) : '';
    if (focus) {
      summaryRequest += `\n\n用户特别要求：${focus}。摘要应重点覆盖该方面的内容。`;
    }

    const model = this.models.getModel(this.activeProvider, this.activeModelId);
    if (!model) {
      throw new Error('未找到当前激活模型，请检查 AI 设置');
    }

    const assistant = await this.models.completeSimple(model, {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: summaryRequest, timestamp: Date.now() }],
    }, {});

    const text = (assistant.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    if (assistant.stopReason === 'error' || assistant.stopReason === 'aborted' || !text) {
      throw new Error(assistant.errorMessage || '摘要生成失败或结果为空');
    }

    // ---- 组装并替换上下文（此后均为纯内存/单事务操作）----
    const summaryMsg = {
      role: 'user',
      content: '<context-summary>\n' + text + '\n</context-summary>',
      timestamp: Date.now(),
    };
    const newMessages = [summaryMsg, ...recentMessages];
    this.agent.state.messages = newMessages;

    // ---- 落库：全量替换事务自动删掉压缩点前的旧行 ----
    conversationStore.saveMessages(this.currentConversationId, newMessages);

    const after = newMessages.length;
    const tokensAfter = this._estimateMessagesTokens(newMessages);
    console.log(`[Realm AI] 上下文已压缩: ${before} 条 → ${after} 条 (${this.currentConversationId})`);

    return { success: true, before, after, tokensBefore, tokensAfter };
  }

  /**
   * 估算一组 AgentMessage 的 token 总量（estimateTokens 保守字符启发式）
   * @private
   * @param {Array} messages - AgentMessage 形状消息
   * @returns {number} 估算 token 总数（estimateTokens 不可用时退化为按字符数 /4）
   */
  _estimateMessagesTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += this._estimateMessageTokens(msg);
    }
    return total;
  }

  /**
   * 估算单条 AgentMessage 的 token 量
   * @private
   * @param {Object} msg - AgentMessage 形状消息
   * @returns {number} 估算 token 数
   */
  _estimateMessageTokens(msg) {
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') text += block.text || '';
        else if (block.type === 'toolCall') text += JSON.stringify(block.arguments || {});
      }
    }
    return Math.ceil(text.length / 4);
  }

  /**
   * 将旧消息序列化为纯文本对话记录（供 /compact 摘要 prompt 使用）
   *
   * user → [用户] 文本；assistant → [助手] 文本 + 工具调用标注；
   * toolResult → [工具结果] 文本截断。已存在的旧 <context-summary> 消息
   * 剥壳保留内容继续参与摘要（二次压缩语义）。
   *
   * @private
   * @param {Array} oldMessages - 压缩点前的 AgentMessage 消息
   * @returns {string} 纯文本对话记录
   */
  _serializeMessagesForSummary(oldMessages) {
    const MAX_TOOL_RESULT_CHARS = 500;
    const lines = [];

    for (const msg of oldMessages) {
      if (msg.role === 'user') {
        let text = typeof msg.content === 'string' ? msg.content : '';
        // 二次压缩：旧摘要消息剥掉 XML 壳，内容原样参与新摘要
        const m = text.match(/^<context-summary>\n?([\s\S]*?)\n?<\/context-summary>$/);
        lines.push(m ? '[历史摘要] ' + (m[1] || '') : '[用户] ' + text);
      } else if (msg.role === 'assistant') {
        let text = '';
        const toolNames = [];
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'text') text += block.text || '';
            else if (block.type === 'toolCall') toolNames.push(block.name || '');
          }
        } else if (typeof msg.content === 'string') {
          text = msg.content;
        }
        let line = '[助手] ' + text;
        if (toolNames.length > 0) {
          line += ' (调用工具 ' + toolNames.join(', ') + ')';
        }
        lines.push(line);
      } else if (msg.role === 'toolResult') {
        let text = '';
        if (Array.isArray(msg.content)) {
          text = msg.content.filter(b => b.type === 'text').map(b => b.text || '').join('');
        } else if (typeof msg.content === 'string') {
          text = msg.content;
        }
        if (text.length > MAX_TOOL_RESULT_CHARS) {
          text = text.slice(0, MAX_TOOL_RESULT_CHARS) + '…（已截断）';
        }
        lines.push('[工具结果' + (msg.toolName ? ' ' + msg.toolName : '') + '] ' + text);
      }
    }

    return lines.join('\n');
  }

  /**
   * 删除对话（per D-16 仅手动删除，无自动清理）
   *
   * 删除当前对话时清理 Agent 并置空 currentConversationId，不再自动补建
   * （per D-06 修订 / G-42-1：允许到达「暂无对话」空状态，删除最后一个
   * 对话后系统到达空状态；空状态后直接发送消息由 prompt 守卫重建 Agent
   * 并经 _ensureConversation 惰性建行恢复）。
   *
   * @param {string} conversationId - 要删除的对话 ID
   * @returns {boolean} 是否删除成功
   */
  deleteConversation(conversationId) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }

    // 删除当前对话：清理 Agent 并置空当前对话引用，允许到达空状态（per G-42-1）
    if (conversationId === this.currentConversationId) {
      this._cleanupCurrentAgent();
      this.currentConversationId = null;
      this.conversationMeta = {};
    }

    const success = conversationStore.deleteConversation(conversationId);
    if (success) {
      console.log('[Realm AI] 删除对话: ' + conversationId);
    }
    return success;
  }

  /**
   * 重命名对话
   *
   * @param {string} conversationId - 对话 ID
   * @param {string} newTitle - 新标题
   * @returns {boolean} 是否更新成功
   */
  renameConversation(conversationId, newTitle) {
    if (!conversationId || typeof conversationId !== 'string') {
      throw new Error('对话 ID 不能为空');
    }
    if (!newTitle || typeof newTitle !== 'string') {
      throw new Error('标题不能为空');
    }

    return conversationStore.updateConversation(conversationId, { title: newTitle });
  }

  /**
   * 获取对话列表
   *
   * @param {number} [limit=50] - 返回数量上限
   * @returns {Array} 对话列表
   */
  getConversations(limit = 50) {
    return conversationStore.getConversations(limit);
  }

  /**
   * 获取指定对话的消息列表（renderer 显示形状）
   *
   * 透传 conversationStore.getMessages：assistant 行带 toolExecutions
   * 工具卡片结构，无独立 toolResult 行，可直接赋 renderer state.aiMessages。
   * 上下文注入请用 conversationStore.getAgentMessages（switchConversation 内部使用）。
   *
   * @param {string} conversationId - 对话 ID
   * @returns {Array} 显示形状消息列表
   */
  getConversationMessages(conversationId) {
    const messages = conversationStore.getMessages(conversationId);
    if (!Array.isArray(messages)) return messages;
    // 展示层装饰（**不落存储** —— conversationStore 保持「只懂存储」的单一职责，技能域知识不进它）：
    // (a) user 行的技能调用装饰（48-01 D-09 / D-06）：入库的是完整增强消息，此处把气泡还原为
    //     {content: args, skillInvocation:{name, tier, content}}。
    // (b) assistant 行 toolExecutions 的 read 标记重建（48-03 D-15 / DISC-05）：用与实时链路
    //     **同一个** _resolveSkillMarker 判定，使两条链路产出的形状逐字一致；技能已删除 / 改名时
    //     静默不标（不挂键，与实时链路「匹配不到就是普通卡片」一致）。
    // (c) assistant 行 toolExecutions 的 manage_skill 标记重建（49-02 D-02 / 硬约束 3）：与实时
    //     链路共用同一个 _buildManageSkillDecoration 构造；终态元数据从**已持久化**的
    //     `details`（promptIncluded）与当前技能集投影（tier）还原，不可还原的 code 省略键。
    // **不做**的替代方案：把标记写进 `tool_calls` 列 —— 会污染 getAgentMessages 读同一列的
    // LLM 上下文重建路径。
    // 整段包 try/catch：装饰失败只告警并返回未装饰结果，**不因元数据缺失丢消息**（与 48-01 的
    // user 行装饰同款容错）。
    try {
      return messages.map((msg) => {
        if (!msg) return msg;
        if (msg.role === 'user') {
          const decorated = this._decorateSkillUserMessage(msg.content);
          return decorated
            ? { ...msg, content: decorated.content, skillInvocation: decorated.skillInvocation }
            : msg;
        }
        if (Array.isArray(msg.toolExecutions)) {
          const rebuilt = msg.toolExecutions.map((t) => {
            const marker = this._resolveSkillMarker(t.name, t.params);
            // 49-02（Phase 49 D-02 / UI-SPEC 硬约束 3）：`manage_skill` 卡片的标记重建 ——
            // 与**实时链路共用同一个** `_buildManageSkillDecoration` 构造，两条链路的键集合
            // 因此逐字相等（参数已持久化在 `t.params`，终态元数据从持久化行还原）。
            // 只对 `manage_skill` 行求值 ⇒ 其它工具零成本、`read` 行的既有行为逐字不变。
            const decoration = t.name === 'manage_skill'
              ? this._buildManageSkillDecoration(t.params, this._manageSkillTerminalFromStored(t))
              : null;
            if (!marker && !decoration) return t;
            const next = { ...t };
            if (marker) next.skillInvocation = marker;
            if (decoration) next.manageSkill = decoration;
            return next;
          });
          return { ...msg, toolExecutions: rebuilt };
        }
        return msg;
      });
    } catch (err) {
      console.warn('[Realm AI] 对话消息技能装饰失败（原样透传，不丢消息）:', err.message);
      return messages;
    }
  }

  /**
   * 清理当前 Agent 实例
   * abort + unsubscribe + nullify
   * @private
   */
  _cleanupCurrentAgent() {
    if (this.agent) {
      try {
        this.agent.abort();
      } catch (err) {
        // 忽略 abort 错误
      }
      this.agent = null;
    }
    this.isProcessing = false;
  }

  /**
   * 刷新技能集并把新的 system prompt 落到**当前 Agent 实例**上（D-03 / SKILL-04）
   *
   * **不重建 Agent** —— 直接改写 `agent.state.systemPrompt`，保留 `state.messages`
   * 的引用链与当前对话的上下文连续性。
   *
   * SDK 契约（`@earendil-works/pi-agent-core@0.84.3`，源码直读 + 最小实例实测）：
   * `Agent.get state()` 返回内部 `_state` 本体（非快照）；`systemPrompt` 是
   * `createMutableAgentState` 里赋的普通属性（不在 `get`/`set` 访问器列表内，
   * `tools`/`messages` 才是）；`createContextSnapshot()` 每次 `prompt()` /
   * `promptContinue()` 都重读 —— 因此改写**下一轮即生效**，且对**正在进行中**
   * 的那一轮不生效（这也是忙时必须置脏而非直接改写的原因）。
   *
   * 三处早退/降级：
   * - Agent 或沙箱未就绪 → 直接返回
   * - 忙时（`isProcessing` 或 `agent.state.isStreaming`）→ 只置 `_skillsPromptDirty`，
   *   不改 prompt、不广播；由延迟补刷的唯一实现 `_flushDeferredSkillsPrompt()`（`prompt()` 与
   *   `promptWithContext()` 两个成功出口共用）在轮结束后消费
   * - 无变化（digest 相同**且** prompt 逐字符相同）→ 直接返回，不触碰
   *   `agent.state`、不广播，保 provider 前缀缓存
   *
   * @returns {Promise<void>}
   */
  async syncAgentSystemPrompt() {
    if (!this.agent || !this.sandboxEnv) return;

    // 重新扫描两个技能目录（磁盘可能被模型经 write/bash 直接改写）
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
      disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
      rootDirs: [
        getAgentWorkspaceLazy().getManagedSkillsDir(),
        getAgentWorkspaceLazy().getSkillsDir(),
      ],
    });

    if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
      this._skillsPromptDirty = true;
      return;
    }

    const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
    const next = buildSystemPrompt();
    // digest 是快速判定主键、逐字符比对是二次确认 —— 两者一致才认定「无变化」
    if (snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next) return;

    // 先记录已应用的摘要，再改写 prompt（顺序不可调换：中途抛错时摘要不应超前）
    this._skillsPromptDigest = snap.digest;
    this.agent.state.systemPrompt = next;

    // 只在真正改写了 prompt 的路径上广播（本阶段只发事件，消费方在 Phase 48/50）
    windowManager.broadcast('skills:changed');
  }

  /**
   * `/` 面板的后台刷新入口（48 D-17 / P8 失效链的**读侧**生产调用方）
   *
   * 复用既有失效链：`syncAgentSystemPrompt()`（重扫两个技能目录 → 必要的 prompt 回写与
   * 广播）→ 返回刷新后的收窄投影。**不重建 Agent**、不新增第二条刷新路径。
   *
   * **只加调用方，`syncAgentSystemPrompt()` 的函数体逐字未改**（46-04 的方法体源码扫描
   * 断言是硬约束）。语义上与 Phase 49/50/51 的「写成功后回写」区分：本入口是
   * 「打开面板时重扫 + 回写」，不是技能写路径的收口。
   *
   * **早退边界**：`syncAgentSystemPrompt()` 在 `!this.agent || !this.sandboxEnv` 时直接
   * 返回（AI 未初始化 / 未创建过 Agent）→ 此时面板拿到的是**旧投影**。这是唯一诚实的降级：
   * 没有 Agent 就没有可用的读盘环境（`sandboxEnv` 亦未建立），无从重扫。
   *
   * @returns {Promise<{skills: Array<object>, refreshedAt: number, digest: string}>} 刷新后的面板投影
   */
  async refreshSkillsForPanel() {
    await this.syncAgentSystemPrompt();
    return this.getSkillsForUI();
  }

  /**
   * 管理读路径的**初始化**（Phase 50 D-19）—— 不依赖 Agent 的兜底重扫
   *
   * ## 为什么必须存在（否则设置页判据 1 在无 provider 用户处**整体空白**）
   *
   * `init()` 有**两条**早退，都在 `createSandboxEnv()` 与首次 `refreshSkills()` **之前**：
   * - 无任何 provider API Key（`if (configuredIds.length === 0) return;`）
   * - 已配置但模型名解析不到（`if (!model) return;`）
   *
   * 两条早退都会让 `this.sandboxEnv` 与模块级技能缓存一起**永远停在初始态**
   * （`skills: []` / `refreshedAt: 0`），而 `builtinSkillsSeeder.seedBuiltinSkills()`
   * 在 `main.js` 的 whenReady 里是**无条件**执行 ⇒ 内置技能**早已在盘上**。
   * 此时 `syncAgentSystemPrompt()` 首行 `if (!this.agent || !this.sandboxEnv) return;`
   * 连重扫都不执行 ⇒ 用户看到空列表且**无法自查原因**（属「静默失败」反模式）。
   *
   * ## 判据是「Agent 存在与否」—— **不得**按「有没有 provider」判
   *
   * 上面那两条早退是**并列**的，按 provider 判会漏掉第二条（配了 Key 但模型名写错 ⇒
   * 管理区又空白）。而 `createSandboxEnv()` 只依赖 `agent-workspace` + SDK，
   * **与 provider 配置无关** ⇒ 无 Agent 时直接建沙箱再重扫这条路完全可行。
   *
   * ## 三条约束
   *
   * ① **恰一次重扫**（次数账）：有 Agent 时走 `syncAgentSystemPrompt()`（其函数体内**已含**
   *    恰一次 `refreshSkills()`）；无 Agent 时直接 `refreshSkills()`。
   *    **不得两条都执行** —— 那是两次全量重扫（49-01 的 L 组断言付过这个代价）。
   * ② **不进 `syncAgentSystemPrompt()` 的函数体**（46-04 的方法体源码扫描断言 +
   *    48 的广播次数断言同时钉着它）。
   * ③ 它**不是写路径**（读侧 / 兜底）⇒ **不并入** `syncAgentSystemPrompt()` 的写侧份额账
   *    （OQ-5：`STATE.md` 与产品文档的读写两个数**分别记**，读侧不并入「6 个触发点」分子）。
   *
   * @returns {Promise<void>}
   */
  async ensureSkillsFresh() {
    if (!this.sandboxEnv) {
      this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();
    }

    if (this.agent) {
      await this.syncAgentSystemPrompt();
      return;
    }

    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
      disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
      rootDirs: [
        getAgentWorkspaceLazy().getManagedSkillsDir(),
        getAgentWorkspaceLazy().getSkillsDir(),
      ],
    });
  }

  /**
   * 延迟补刷技能 system prompt（D-03 / G-48-18）—— 延迟补刷的**唯一实现**
   *
   * `_skillsPromptDirty` 的检脏 / 复位 / 同步调用 / 失败恢复四件事**只允许存在于本方法体内**；
   * `prompt()` 与 `promptWithContext()` 的两个**成功**出口各只留一行对本方法的 `await` 调用
   * （全仓恰 2 处 —— 源码门禁按方法体区域断言，禁止出现第二份内联实现）。此前内联块只挂在
   * `promptWithContext()` 上，而 renderer 只在「有 @ 引用或附件」时才走该通道，常规
   * `/skill:<name>`、重新生成、错误重试都走 `prompt()`
   * —— 于是「缓存已含新技能、system prompt 不含」的持续不一致成了默认态。
   *
   * 四条契约：
   * 1. **单一权威实现**：两个成功出口共用本方法，不得再内联第二份检脏 / 复位 / 同步 / 失败恢复。
   * 2. **首行检脏早退 = 零成本**：无待补刷时立即返回、不做任何 IO。漏掉这一步会让**每一条普通
   *    消息**都在成功出口多付一次全量重扫（两个技能目录 + 逐技能读 `SKILL.md`）—— 这是本机制
   *    最大的性能回归面。
   * 3. **只由成功出口调用**：错误出口（重试耗尽的 `catch`）与 `_cleanupCurrentAgent()` 一律不调 ——
   *    同一次运行补刷两次既无意义（错误轮已作废）又让「变更何时落地」难以推理。
   * 4. **失败恢复脏标记**：同步失败时把标记恢复为「待回写」，语义 = **下一次成功出口重试**，
   *    变更绝不静默丢弃；同时 `console.warn` 明示，不静默。
   *
   * @returns {Promise<void>}
   * @private
   */
  async _flushDeferredSkillsPrompt() {
    if (!this._skillsPromptDirty) return;

    this._skillsPromptDirty = false;
    try {
      await this.syncAgentSystemPrompt();
    } catch (err) {
      // 失败恢复脏标记：下一次成功出口重试，避免变更被静默丢弃（WR-04）
      this._skillsPromptDirty = true;
      console.warn(
        '[Realm AI] 延迟刷新技能 prompt 失败（将于下次成功出口重试）:',
        err && err.message ? err.message : String(err)
      );
    }
  }

  /**
   * 重新创建 Agent 实例
   * 复用现有 init 逻辑中的 Agent 创建代码
   * @private
   */
  async _recreateAgent() {
    if (!this.models || !this.isInitialized) {
      console.warn('[Realm AI] 无法重建 Agent：Models 未初始化');
      return;
    }

    try {
      const { Agent } = await import('@earendil-works/pi-agent-core');

      // 获取当前模型
      const modelId = this.activeModelId;
      const providerId = this.activeProvider;
      const model = modelId && providerId
        ? this.models.getModel(providerId, modelId)
        : null;

      if (!model) {
        console.error('[Realm AI] 无法重建 Agent：模型不存在');
        return;
      }

      // D-04：每次重建都无条件重扫两个技能目录 —— 这是覆盖「模型经 write / bash
      // 工具直接改写 skills/foo/SKILL.md」这条无事件可挂失效路径的唯一自动兜底。
      // rootDirs 顺序 managed → user 不是装饰（D-06 遮蔽判定依赖输入顺序）。
      // configStore 注入式读取（manager 侧零 configStore 依赖）
      await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
        disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
        rootDirs: [
          getAgentWorkspaceLazy().getManagedSkillsDir(),
          getAgentWorkspaceLazy().getSkillsDir(),
        ],
      });

      this.agent = new Agent({
        initialState: {
          systemPrompt: buildSystemPrompt(),
          model,
          tools: this.tools,
        },
        streamFn: this.models.streamSimple.bind(this.models),
        convertToLlm: (messages) => {
          return messages.filter(msg =>
            msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult'
          );
        },
        transformContext: this._compactContext.bind(this),
      });

      // 新 Agent 的 systemPrompt 已包含当前技能段 —— 记录对应 digest（同 init()），
      // 使首次 syncAgentSystemPrompt() 走「无变化」早退（WR-03）
      this._skillsPromptDigest = getAiSkillsManagerLazy().getSkillsSnapshot().digest;

      // 重新设置事件广播
      this._setupEventBroadcasting();
    } catch (err) {
      console.error('[Realm AI] 重建 Agent 失败:', err.message);
    }
  }

  /**
   * 删除供应商配置（per D-05）
   *
   * 从 configStore 中彻底清除指定供应商的配置。如果被删除的供应商
   * 是当前激活供应商，同时清除 activeProvider 设置。
   *
   * @param {string} providerId - 要删除的提供商 ID
   * @returns {Promise<void>}
   */
  async removeProvider(providerId) {
    if (!this.configStore) return;

    const providers = this.configStore.get('ai.providers', {});
    if (!providers[providerId]) {
      console.warn(`[Realm AI] 供应商 ${providerId} 不存在，跳过删除`);
      return;
    }

    delete providers[providerId];
    this.configStore.set('ai.providers', providers);

    // 清除激活供应商（如果是被删供应商）
    if (this.configStore.get('ai.activeProvider') === providerId) {
      this.configStore.delete('ai.activeProvider');
    }

    // 清除视觉模型引用（如果是被删供应商）
    const visionCfg = this.configStore.get('ai.visionModel', null);
    if (visionCfg && visionCfg.provider === providerId) {
      this.configStore.delete('ai.visionModel');
      console.log(`[Realm AI] 视觉模型引用已随供应商删除清除: ${providerId}`);
    }

    console.log(`[Realm AI] 供应商已删除: ${providerId}`);

    // 重新初始化（如有其他已配置供应商；判定含环境变量回退）
    const remainingIds = Object.keys(providers).filter(
      id => this._isProviderConfigured(id, providers[id])
    );
    if (remainingIds.length > 0) {
      await this.init(this.configStore);
    } else {
      this.isInitialized = false;
      this.agent = null;
      this.models = null;
      this.visionDescriber = null;
    }
  }

  /**
   * 获取 AI Manager 当前状态
   *
   * 返回初始化状态、当前模型和工具数量等信息。
   * 用于 UI 显示 AI 助手的连接状态。
   *
   * conversationId 为 prompt 响应之外的兜底通道（per G-42-2）：
   * renderer 由此得知主进程的当前对话 id（无对话时为 null）。
   *
   * @returns {{initialized: boolean, model: string|null, toolsCount: number, activeProvider: string|null, conversationId: string|null}} 状态信息
   */
  getState() {
    let model = null;
    if (this.agent && this.agent.state) {
      model = this.agent.state.model ? this.agent.state.model.id : null;
    }

    return {
      initialized: this.isInitialized,
      model,
      toolsCount: this.tools.length,
      activeProvider: this.activeProvider || null,
      conversationId: this.currentConversationId || null,
    };
  }

  /**
   * 获取当前对话的上下文用量统计（聊天框圆环按钮 + 弹框数据源）
   *
   * 口径：
   * - contextWindow：当前模型上下文窗口（模型元数据缺失时兜底 128000）
   * - usedTokens：优先取最近一条 assistant 消息的 provider usage
   *   （calculateContextTokens = input + cacheRead + cacheWrite，即下次请求的
   *   上下文占用近似值）；无 usage（新对话/纯本地操作）时退化为消息字符启发式估算
   * - breakdown 四类（估算值，有真实 usage 时按比例归一化到 usedTokens）：
   *   系统提示词 / 工具定义 / 对话消息 / 附件（消息内 image 内容块，1200 tokens/图）
   *
   * @returns {{contextWindow: number, usedTokens: number, percent: number,
   *   breakdown: Array<{key: string, label: string, tokens: number, percent: number}>}} 用量统计
   */
  getContextUsage() {
    const contextWindow = (this.agent && this.agent.state && this.agent.state.model
      && this.agent.state.model.contextWindow) || 128000;

    const { estimateTokens } = this._contextUsageFns || {};
    const messages = (this.agent && this.agent.state && this.agent.state.messages) || [];

    // ---- 真实用量：最近一条带 usage 的 assistant 消息 ----
    let usedTokens = 0;
    let hasRealUsage = false;
    const calculateContextTokens = this._contextUsageFns && this._contextUsageFns.calculateContextTokens;
    if (calculateContextTokens) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg && msg.role === 'assistant' && msg.usage) {
          usedTokens = calculateContextTokens(msg.usage);
          hasRealUsage = usedTokens > 0;
          break;
        }
      }
    }

    // ---- 分类估算（字符启发式，≈ tokens）----
    // 系统提示词
    const systemTokens = Math.ceil(buildSystemPrompt().length / 4);
    // 工具定义（name + description + 参数 schema）
    let toolChars = 0;
    for (const tool of (this.tools || [])) {
      toolChars += (tool.name || '').length + (tool.description || '').length
        + JSON.stringify(tool.parameters || {}).length;
    }
    const toolTokens = Math.ceil(toolChars / 4);
    // 附件：user 消息中 image 内容块（SDK 估算口径 4800 chars = 1200 tokens/图）
    const IMAGE_TOKENS = 1200;
    let imageCount = 0;
    for (const msg of messages) {
      if (msg && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && block.type === 'image') imageCount++;
        }
      }
    }
    const attachmentTokens = imageCount * IMAGE_TOKENS;
    // 对话消息：逐条估算后扣除附件部分（estimateTokens 已把 image 计入 user 消息，不重复计）
    let messageTokens = 0;
    if (estimateTokens) {
      for (const msg of messages) {
        if (msg && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult')) {
          messageTokens += estimateTokens(msg);
        }
      }
    } else {
      // SDK 工具不可用时退化为自有字符估算
      messageTokens = this._estimateMessagesTokens(messages);
    }
    messageTokens = Math.max(0, messageTokens - attachmentTokens);

    const breakdownRaw = [
      { key: 'system', label: '系统提示词', tokens: systemTokens },
      { key: 'tools', label: '工具定义', tokens: toolTokens },
      { key: 'messages', label: '对话消息', tokens: messageTokens },
      { key: 'attachments', label: '附件', tokens: attachmentTokens },
    ];

    // ---- 归一化：有真实 usage 时把估算分类缩放到真实总量 ----
    const estimateTotal = breakdownRaw.reduce((sum, b) => sum + b.tokens, 0);
    const scale = hasRealUsage && estimateTotal > 0 ? usedTokens / estimateTotal : 1;
    if (!hasRealUsage) {
      usedTokens = estimateTotal;
    }
    const breakdown = breakdownRaw.map(b => {
      const tokens = Math.round(b.tokens * scale);
      return {
        key: b.key,
        label: b.label,
        tokens,
        // 百分比口径 = 占总上下文窗口（明细总和 ≈ usedTokens percent，对齐 WorkBuddy）
        percent: contextWindow > 0 ? Math.round((tokens / contextWindow) * 1000) / 10 : 0,
      };
    });

    const percent = contextWindow > 0
      ? Math.min(100, Math.round((usedTokens / contextWindow) * 1000) / 10)
      : 0;

    return { contextWindow, usedTokens, percent, breakdown };
  }

  /**
   * 构建 Realm Browser 工具列表
   *
   * Phase 19 注册 get_tabs 工具，Phase 20 扩展其他工具。
   * 工具定义遵循 pi-agent-core 的 AgentTool 接口：
   * - name: 工具名称（LLM 调用时的标识符）
   * - description: 工具描述（LLM 用于理解工具用途）
   * - parameters: TypeBox schema（工具参数定义，无参数用空 object）
   * - label: 人类可读标签（UI 显示用）
   * - execute: 异步执行函数，签名为 (toolCallId, params, signal?, onUpdate?)
   *   返回 { content: [...], details: any }
   *
   * @returns {Array} 工具定义数组
   * @private
   */
  _buildRealmTools() {
    return [
      {
        name: 'get_tabs',
        label: '获取标签页',
        description: '获取当前所有标签页列表，返回每个标签页的 ID、标题、URL 和所属容器，以及当前活跃标签页 ID',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        execute: async () => {
          const tabs = tabManager.getTabs();
          const activeTab = tabManager.getActiveTab();
          const activeTabId = activeTab ? activeTab.id : null;
          const activeContainerId = activeTab ? activeTab.containerId : null;
          const tabList = tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            containerId: tab.containerId,
            active: tab.id === activeTabId,
          }));
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                tabs: tabList,
                activeTabId,
                activeContainerId,
                count: tabList.length,
              }, null, 2),
            }],
            details: { count: tabList.length, activeTabId, activeContainerId },
          };
        },
      },
      {
        name: 'search_history',
        label: '搜索历史记录',
        description: '搜索浏览历史记录，支持按 URL 和标题模糊匹配，支持时间范围筛选。默认使用当前活跃容器，也可指定特定容器。',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
            containerId: {
              type: 'string',
              description: '容器 ID（可选，默认使用当前活跃容器）',
            },
            limit: {
              type: 'number',
              description: '返回结果数量上限（可选，默认 10）',
            },
            startDate: {
              type: 'number',
              description: '开始时间戳（毫秒，可选）',
            },
            endDate: {
              type: 'number',
              description: '结束时间戳（毫秒，可选）',
            },
            date: {
              type: 'string',
              description: '筛选某一天（格式：YYYY-MM-DD，可选）',
            },
          },
          required: ['query'],
        },
        execute: async (toolCallId, params) => {
          const { query, limit = 10, date } = params;
          let { containerId, startDate, endDate } = params;

          // 如果未指定容器，自动获取当前活跃容器
          if (!containerId) {
            const activeTab = tabManager.getActiveTab();
            if (!activeTab || !activeTab.containerId) {
              throw new Error('无法获取当前容器，请先打开一个标签页');
            }
            containerId = activeTab.containerId;
          }

          // 处理某一天筛选
          if (date) {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            startDate = dayStart.getTime();
            endDate = dayEnd.getTime();
          }

          if (!query) {
            throw new Error('搜索关键词不能为空');
          }
          const results = historyManager.searchRecords(containerId, {
            keyword: query,
            limit,
            startDate,
            endDate,
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                results: results.map(r => ({
                  id: r.id,
                  url: r.url,
                  title: r.title,
                  visitedAt: r.visited_at,
                })),
                count: results.length,
                containerId,
              }, null, 2),
            }],
            details: { count: results.length, containerId },
          };
        },
      },

      // ==================== list_history 工具 ====================
      {
        name: 'list_history',
        label: '列出历史记录',
        description: '列出浏览历史记录，支持分页和时间范围筛选。默认使用当前活跃容器，也可指定特定容器。',
        parameters: {
          type: 'object',
          properties: {
            containerId: {
              type: 'string',
              description: '容器 ID（可选，默认使用当前活跃容器）',
            },
            page: {
              type: 'number',
              description: '页码（从 1 开始，可选，默认 1）',
            },
            pageSize: {
              type: 'number',
              description: '每页条数（可选，默认 20）',
            },
            startDate: {
              type: 'number',
              description: '开始时间戳（毫秒，可选）',
            },
            endDate: {
              type: 'number',
              description: '结束时间戳（毫秒，可选）',
            },
            date: {
              type: 'string',
              description: '筛选某一天（格式：YYYY-MM-DD，可选）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { page = 1, pageSize = 20, date } = params;
          let { containerId, startDate, endDate } = params;

          // 如果未指定容器，自动获取当前活跃容器
          if (!containerId) {
            const activeTab = tabManager.getActiveTab();
            if (!activeTab || !activeTab.containerId) {
              throw new Error('无法获取当前容器，请先打开一个标签页');
            }
            containerId = activeTab.containerId;
          }

          // 处理某一天筛选
          if (date) {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            startDate = dayStart.getTime();
            endDate = dayEnd.getTime();
          }

          const offset = (page - 1) * pageSize;
          const results = historyManager.listRecords(containerId, {
            offset,
            limit: pageSize,
            startDate,
            endDate,
          });

          const totalCount = historyManager.getCount(containerId);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                results: results.map(r => ({
                  id: r.id,
                  url: r.url,
                  title: r.title,
                  visitedAt: r.visited_at,
                })),
                pagination: {
                  page,
                  pageSize,
                  totalCount,
                  totalPages: Math.ceil(totalCount / pageSize),
                },
                containerId,
              }, null, 2),
            }],
            details: { count: results.length, page, pageSize, containerId },
          };
        },
      },

      // ==================== delete_history 工具 ====================
      {
        name: 'delete_history',
        label: '删除历史记录',
        description: '删除单个或批量删除历史记录。默认使用当前活跃容器，也可指定特定容器。',
        parameters: {
          type: 'object',
          properties: {
            containerId: {
              type: 'string',
              description: '容器 ID（可选，默认使用当前活跃容器）',
            },
            id: {
              type: 'number',
              description: '单条记录 ID（删除单条时使用）',
            },
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: '批量删除的记录 ID 数组（批量删除时使用）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { id, ids } = params;
          let { containerId } = params;

          // 如果未指定容器，自动获取当前活跃容器
          if (!containerId) {
            const activeTab = tabManager.getActiveTab();
            if (!activeTab || !activeTab.containerId) {
              throw new Error('无法获取当前容器，请先打开一个标签页');
            }
            containerId = activeTab.containerId;
          }

          // 单条删除
          if (id) {
            const success = historyManager.deleteRecord(containerId, id);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success,
                  deletedCount: success ? 1 : 0,
                  message: success ? '删除成功' : '记录不存在',
                  containerId,
                }, null, 2),
              }],
              details: { deletedCount: success ? 1 : 0, containerId },
            };
          }

          // 批量删除
          if (Array.isArray(ids) && ids.length > 0) {
            const deletedCount = historyManager.deleteRecords(containerId, ids);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  deletedCount,
                  message: `成功删除 ${deletedCount} 条记录`,
                  containerId,
                }, null, 2),
              }],
              details: { deletedCount, containerId },
            };
          }

          throw new Error('请提供要删除的记录 ID（单条删除使用 id，批量删除使用 ids 数组）');
        },
      },

      {
        name: 'manage_favorites',
        label: '管理收藏夹',
        description: '管理收藏夹：添加收藏、查看收藏列表（支持按文件夹和分页）、删除收藏（单条/批量）、修改标题、移动收藏到文件夹、重排文件夹内收藏顺序、文件夹增删改查（批量删除文件夹只弹一次确认）、查找空文件夹',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: '操作类型',
              enum: [
                'add', 'get', 'delete', 'batch-delete', 'update-title', 'move', 'reorder',
                'add-folder', 'rename-folder', 'delete-folder', 'list-folders', 'get-folder-tree',
                'find-empty-folders',
              ],
            },
            url: {
              type: 'string',
              description: 'add：页面 URL',
            },
            title: {
              type: 'string',
              description: 'add：页面标题（可选）；update-title：新标题（必填）',
            },
            id: {
              type: 'number',
              description: 'delete/update-title/move：收藏记录 ID；rename-folder/delete-folder：文件夹 ID',
            },
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: 'delete/batch-delete：收藏记录 ID 数组（批量删除）；delete-folder：文件夹 ID 数组（批量删除，只弹一次确认）；reorder：目标顺序的收藏 ID 完整列表（须属于同一文件夹且覆盖其全部收藏）',
            },
            folderId: {
              type: 'number',
              description: 'get：仅列出该文件夹内收藏（0=根目录，省略=全部）；move：目标文件夹 ID',
            },
            offset: {
              type: 'number',
              description: 'get：分页偏移（默认 0）',
            },
            limit: {
              type: 'number',
              description: 'get：每页条数（默认 50）',
            },
            name: {
              type: 'string',
              description: 'add-folder/rename-folder：文件夹名称',
            },
            parentId: {
              type: 'number',
              description: 'add-folder：父文件夹 ID（0=根目录，默认 0）',
            },
          },
          required: ['action'],
        },
        execute: async (toolCallId, params) => {
          const sanitized = sanitizeInput(params) || {};
          const {
            action, url, title, id, ids, folderId, offset, limit, name, parentId,
          } = sanitized;

          // 写操作成功后统一广播收藏栏刷新（AI 直调 favoritesManager 不经过 IPC 层，
          // 不会触发既有广播，必须在此显式补发）
          const broadcastRefresh = () => windowManager.broadcast('bookmarks-bar:refresh');

          if (action === 'add') {
            if (!url) {
              throw new Error('添加收藏时 URL 不能为空');
            }
            const result = favoritesManager.addRecord({ url, title: title || '' });
            if (result.id) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result.error
                  ? { ...result, message: '该 URL 已在收藏夹中' }
                  : result, null, 2),
              }],
              details: result,
            };
          }

          if (action === 'get') {
            const records = favoritesManager.listRecords({
              offset: Number(offset) || 0,
              limit: Number(limit) || 50,
              folderId: folderId === undefined ? undefined : (Number(folderId) || 0),
            });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  favorites: records.map(r => ({
                    id: r.id,
                    url: r.url,
                    title: r.title,
                    folderId: r.folder_id,
                    createdAt: r.created_at,
                  })),
                  count: records.length,
                }, null, 2),
              }],
              details: { count: records.length },
            };
          }

          if (action === 'delete' || action === 'batch-delete') {
            // 单条传 id，批量传 ids；delete 兼容两种传法
            const targetIds = Array.isArray(ids) && ids.length > 0
              ? ids.map(Number).filter(n => Number.isInteger(n) && n > 0)
              : (id ? [Number(id)] : []);
            if (targetIds.length === 0) {
              throw new Error('删除收藏时需提供 id（单条）或 ids 数组（批量）');
            }
            const deleted = favoritesManager.deleteRecords(targetIds);
            if (deleted > 0) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: deleted > 0, deleted, requested: targetIds.length }, null, 2),
              }],
              details: { deleted, requested: targetIds.length },
            };
          }

          if (action === 'update-title') {
            if (!id || typeof title !== 'string' || !title.trim()) {
              throw new Error('修改标题时需提供 id 和新 title');
            }
            const success = favoritesManager.updateRecord(Number(id), { title: title.trim() });
            if (success) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success, id, title: title.trim() }, null, 2),
              }],
              details: { success, id },
            };
          }

          if (action === 'move') {
            if (!id || folderId === undefined) {
              throw new Error('移动收藏时需提供 id 和 folderId（0 表示根目录）');
            }
            const success = favoritesManager.moveFavoriteInto(Number(id), { folderId: Number(folderId) || 0 });
            if (success) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success, id, folderId: Number(folderId) || 0 }, null, 2),
              }],
              details: { success, id },
            };
          }

          if (action === 'reorder') {
            if (!Array.isArray(ids) || ids.length === 0) {
              throw new Error('排序时需提供目标顺序的 ids 数组（须覆盖同一文件夹内的全部收藏）');
            }
            const result = favoritesManager.reorderFavorites(ids);
            if (result.success) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result.error ? {
                  ...result,
                  message: `${result.error}。可先调用 manage_favorites(action=get, folderId=X) 获取该文件夹当前顺序`,
                } : result, null, 2),
              }],
              details: { success: result.success, count: result.count },
            };
          }

          if (action === 'add-folder') {
            if (!name || !String(name).trim()) {
              throw new Error('创建文件夹时需提供 name');
            }
            const result = favoritesManager.createFolder({
              name: String(name).trim(),
              parentId: Number(parentId) || 0,
            });
            if (result.id) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
              details: result,
            };
          }

          if (action === 'rename-folder') {
            if (!id || !name || !String(name).trim()) {
              throw new Error('重命名文件夹时需提供 id 和新 name');
            }
            const success = favoritesManager.renameFolder(Number(id), { name: String(name).trim() });
            if (success) {
              broadcastRefresh();
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success, id, name: String(name).trim() }, null, 2),
              }],
              details: { success, id },
            };
          }

          if (action === 'delete-folder') {
            // 单个传 id，批量传 ids（批量只弹一次确认，避免逐个文件夹弹确认框）
            const targetIds = Array.isArray(ids) && ids.length > 0
              ? ids.map(Number).filter(n => Number.isInteger(n) && n > 0)
              : (id ? [Number(id)] : []);
            if (targetIds.length === 0) {
              throw new Error('删除文件夹时需提供 id（单个）或 ids 数组（批量）');
            }

            // 收集文件夹名称用于确认文案（getFolderTree 遍历全树）
            const tree = favoritesManager.getFolderTree();
            const nameMap = new Map();
            const walkTree = (nodes) => {
              for (const node of nodes) {
                nameMap.set(node.id, node.name);
                walkTree(node.children || []);
              }
            };
            walkTree(tree);
            const folderNames = targetIds.map(fid => nameMap.get(fid) || `#${fid}`);

            // 级联删除：文件夹内所有收藏和子文件夹会被一并删除，必须用户确认
            const actionId = `del_folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const description = targetIds.length === 1
              ? `确认删除文件夹「${folderNames[0]}」？其中所有收藏和子文件夹将被一并删除，不可恢复。`
              : `确认删除以下 ${targetIds.length} 个文件夹？\n${folderNames.map(n => `・${n}`).join('\n')}\n其中所有收藏和子文件夹将被一并删除，不可恢复。`;
            const confirmation = await requestActionConfirmation({
              actionId,
              type: 'delete',
              title: targetIds.length === 1 ? '删除文件夹确认' : `批量删除文件夹确认（${targetIds.length} 个）`,
              description,
              riskLevel: 'high',
            });
            if (!confirmation.confirmed) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    cancelled: true,
                    message: `用户取消了删除文件夹操作（${confirmation.reason || '已取消'}）`,
                  }, null, 2),
                }],
                details: { cancelled: true },
              };
            }

            // 逐个删除（单次确认已覆盖全部），汇总结果
            const results = [];
            let deletedCount = 0;
            for (const fid of targetIds) {
              const result = favoritesManager.deleteFolder(fid);
              if (result.success) deletedCount++;
              results.push({ id: fid, name: nameMap.get(fid) || `#${fid}`, ...result });
            }
            const success = deletedCount > 0;
            if (success) {
              broadcastRefresh();
              notifyActionSettled(actionId, 'success', `已删除 ${deletedCount} 个文件夹`);
            } else {
              notifyActionSettled(actionId, 'error', '文件夹删除失败');
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success,
                  deletedCount,
                  requestedCount: targetIds.length,
                  results,
                }, null, 2),
              }],
              details: { success, deletedCount, requestedCount: targetIds.length },
            };
          }

          if (action === 'find-empty-folders') {
            const emptyFolders = favoritesManager.listEmptyFolders();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  emptyFolders,
                  count: emptyFolders.length,
                  message: emptyFolders.length > 0
                    ? '以上文件夹不含任何收藏且不含子文件夹。删除多个空文件夹时请用 delete-folder 的 ids 参数一次性提交（只弹一次确认），不要逐个删除。'
                    : '没有空文件夹。',
                }, null, 2),
              }],
              details: { count: emptyFolders.length },
            };
          }

          if (action === 'list-folders') {
            const folders = favoritesManager.listFolders(Number(parentId) || 0);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  folders: folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    parentId: f.parent_id,
                  })),
                  count: folders.length,
                }, null, 2),
              }],
              details: { count: folders.length },
            };
          }

          if (action === 'get-folder-tree') {
            const tree = favoritesManager.getFolderTree();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ tree }, null, 2),
              }],
              details: { count: tree.length },
            };
          }

          throw new Error(`未知操作: ${action}`);
        },
      },
      {
        name: 'search_favorites_fulltext',
        label: '全文搜索收藏',
        description: '使用全文检索搜索收藏夹中的页面，支持中文分词。返回匹配的收藏列表，包含标题和 URL。',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词，支持中文',
            },
            limit: {
              type: 'number',
              description: '返回结果数量（可选，默认 50）',
            },
          },
          required: ['query'],
        },
        execute: async (toolCallId, params) => {
          const { query, limit = 50 } = params;
          if (!query) {
            throw new Error('搜索关键词不能为空');
          }
          const results = favoritesManager.searchFulltext({ keyword: query, limit });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                results: results.map(r => ({
                  id: r.id,
                  url: r.url,
                  title: r.title,
                  createdAt: r.created_at,
                })),
                count: results.length,
              }, null, 2),
            }],
            details: { count: results.length },
          };
        },
      },
      // ==================== organize_favorites 工具 ====================
      /**
       * 收藏夹整理工具
       *
       * 生成收藏归类方案（strategy: domain/flat 由主进程直接归类，
       * category 由 AI 语义分组后提交），方案以卡片形式展示给用户确认，
       * 用户点击「应用整理」后收藏才会实际移动（渲染端 favorites:apply-organize IPC）。
       *
       * 防幻觉校验：apply 提交的收藏 id 必须存在于 favoritesManager.listRecords()
       * 权威列表，不存在的 id 丢弃并记录 droppedBookmarkIds；条目以主进程权威数据
       * 重建，不信 AI 提交值（与 apply_tab_groups 的 T-25-12 策略一致）。
       */
      {
        name: 'organize_favorites',
        label: '整理收藏夹',
        description: '整理收藏夹：生成归类方案（按域名/语义分类/移入单文件夹），方案以卡片展示给用户确认，用户点击「应用整理」后收藏才会实际移动',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['plan', 'apply'],
              description: 'plan=生成整理方案；apply=提交语义分类后的结构化方案（category 策略第二步）',
            },
            strategy: {
              type: 'string',
              enum: ['domain', 'category', 'flat'],
              description: '归类策略（仅 plan 需要）：domain=按域名；category=AI 语义分类；flat=移入单个文件夹',
            },
            scope: {
              type: 'string',
              enum: ['root', 'all'],
              description: '整理范围（仅 plan 需要）：root=仅根目录收藏（默认）；all=含所有子文件夹内的收藏',
            },
            folderName: {
              type: 'string',
              description: 'flat 策略的目标文件夹名（默认「整理收藏」）',
            },
            instruction: {
              type: 'string',
              description: '用户的自定义整理指令（category 策略时作为分类参考）',
            },
            plan: {
              type: 'array',
              description: 'apply 时必填：[{ folderName: 文件夹名, parentId: 父文件夹ID(默认0), bookmarkIds: [收藏ID] }]',
              items: {
                type: 'object',
                properties: {
                  folderName: { type: 'string', description: '文件夹名' },
                  parentId: { type: 'number', description: '父文件夹 ID（0=根目录，默认 0）' },
                  bookmarkIds: {
                    type: 'array',
                    items: { type: 'number' },
                    description: '组内收藏 ID（取自 plan 返回的 bookmarks 数据）',
                  },
                },
                required: ['folderName', 'bookmarkIds'],
              },
            },
          },
          required: ['action'],
        },
        execute: async (toolCallId, params) => {
          const sanitized = sanitizeInput(params) || {};
          const { action, strategy = 'domain', scope = 'root', folderName, instruction } = sanitized;

          // 收藏规模上限（防卡片 DOM 爆炸与 LLM 上下文溢出）
          const MAX_BOOKMARKS = 500;
          const MAX_GROUPS = 50;
          const CATEGORY_HINT_THRESHOLD = 300;

          const fetchBookmarks = () => {
            const all = favoritesManager.listRecords({ limit: 100000 });
            return scope === 'all' ? all : all.filter(r => !r.folder_id);
          };

          const toEntry = r => ({
            id: r.id,
            title: r.title || r.url,
            url: r.url,
            folderId: r.folder_id || 0,
          });

          // ==================== plan：生成方案 ====================
          if (action === 'plan') {
            const records = fetchBookmarks();
            if (records.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    plan: [],
                    message: scope === 'all'
                      ? '收藏夹为空，没有可整理的收藏'
                      : '根目录下没有可整理的收藏（子文件夹内仍有收藏时可用 scope=all）',
                  }, null, 2),
                }],
                details: { totalBookmarks: 0, folderCount: 0 },
              };
            }

            // domain 策略：主进程按 hostname 直接归类
            if (strategy === 'domain') {
              const domainMap = new Map();
              for (const record of records) {
                let hostname = '';
                try {
                  hostname = new URL(record.url).hostname;
                } catch {
                  hostname = '(无效 URL)';
                }
                if (!domainMap.has(hostname)) {
                  domainMap.set(hostname, []);
                }
                domainMap.get(hostname).push(record);
              }
              const plan = [];
              for (const [hostname, groupRecords] of domainMap) {
                // 单域名组不单独建文件夹，归入「其他」
                const target = groupRecords.length === 1 ? '其他' : hostname;
                let group = plan.find(g => g.folderName === target);
                if (!group) {
                  group = { folderName: target, parentId: 0, bookmarks: [] };
                  plan.push(group);
                }
                group.bookmarks.push(...groupRecords.map(toEntry));
              }
              plan.sort((a, b) => b.bookmarks.length - a.bookmarks.length);

              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    plan,
                    message: '整理方案已生成，将以卡片形式展示给用户确认，用户点击「应用整理」后收藏才会实际移动。请告知用户方案已就绪，等待确认。',
                  }, null, 2),
                }],
                details: {
                  totalBookmarks: records.length,
                  folderCount: plan.length,
                  strategy,
                },
              };
            }

            // flat 策略：全部移入单个文件夹
            if (strategy === 'flat') {
              const targetName = (typeof folderName === 'string' && folderName.trim())
                ? folderName.trim() : '整理收藏';
              const plan = [{
                folderName: targetName,
                parentId: 0,
                bookmarks: records.map(toEntry),
              }];
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    plan,
                    message: '整理方案已生成，将以卡片形式展示给用户确认，用户点击「应用整理」后收藏才会实际移动。请告知用户方案已就绪，等待确认。',
                  }, null, 2),
                }],
                details: {
                  totalBookmarks: records.length,
                  folderCount: 1,
                  strategy,
                },
              };
            }

            // category 策略：返回数据，由 AI 语义分组后提交 apply
            const bookmarkData = records.map(toEntry);
            const hint = records.length > CATEGORY_HINT_THRESHOLD
              ? `当前待整理收藏共 ${records.length} 条，数量较大，建议用户缩小整理范围（如仅整理某类网站）后再继续。`
              : '';
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  bookmarks: bookmarkData,
                  instruction: instruction || '',
                  message: `请根据以下收藏的标题和 URL 进行语义分类（如开发工具、文档、社交媒体、购物等）${instruction ? `，并参考用户指令：「${instruction}」` : ''}。每组给一个简短的中文文件夹名。完成分类后必须调用 organize_favorites 工具（action=apply）提交结构化方案（plan 数组，每组 { folderName, parentId: 0, bookmarkIds: [收藏id] }，id 取自上面的 bookmarks 数据），提交后会渲染卡片给用户确认，未经 apply 提交的分类不会生效。${hint}`,
                }, null, 2),
              }],
              details: { totalBookmarks: records.length, folderCount: 0, strategy },
            };
          }

          // ==================== apply：提交方案（防幻觉校验） ====================
          if (action === 'apply') {
            const { plan } = sanitized;

            if (!Array.isArray(plan) || plan.length === 0
              || plan.some(g => !g || typeof g.folderName !== 'string' || !g.folderName.trim()
                || !Array.isArray(g.bookmarkIds))) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: '参数不合法：plan 必须是非空数组，每组需包含非空 folderName 和 bookmarkIds 数组。请按 { plan: [{ folderName, parentId: 0, bookmarkIds: [id] }] } 格式重试。',
                  }, null, 2),
                }],
                details: { totalBookmarks: 0, folderCount: 0, droppedBookmarkIds: [], droppedGroups: 0 },
              };
            }

            if (plan.length > MAX_GROUPS) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `分组数超过上限（${plan.length} > ${MAX_GROUPS}），请合并同类组后重新提交。`,
                  }, null, 2),
                }],
                details: { totalBookmarks: 0, folderCount: 0 },
              };
            }

            // 权威收藏列表：构建有效 id 集合和 id → 收藏数据映射
            const allRecords = favoritesManager.listRecords({ limit: 100000 });
            const validIds = new Set(allRecords.map(r => r.id));
            const recordById = new Map(allRecords.map(r => [r.id, r]));

            // 逐组清洗：丢弃幻觉 id，以权威数据重建条目
            const droppedBookmarkIds = [];
            let droppedGroups = 0;
            const seenIds = new Set();
            const normalizedPlan = [];
            for (const group of plan) {
              const validBookmarks = [];
              for (const rawId of group.bookmarkIds) {
                const id = Number(rawId);
                if (!Number.isInteger(id) || !validIds.has(id)) {
                  if (rawId !== null && rawId !== undefined) {
                    droppedBookmarkIds.push(rawId);
                  }
                  continue;
                }
                if (seenIds.has(id)) continue;
                seenIds.add(id);
                const record = recordById.get(id);
                validBookmarks.push({
                  id: record.id,
                  title: record.title || record.url,
                  url: record.url,
                });
              }
              if (validBookmarks.length === 0) {
                droppedGroups += 1;
                continue;
              }
              normalizedPlan.push({
                folderName: group.folderName.trim(),
                parentId: Number(group.parentId) || 0,
                bookmarks: validBookmarks,
              });
            }

            // 全部无效：返回错误说明，不抛出异常中断对话
            if (normalizedPlan.length === 0) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    plan: [],
                    message: '所有提交的收藏 id 均无效，方案未提交。请先调用 organize_favorites(action=plan) 核对收藏 id 后重试。',
                  }, null, 2),
                }],
                details: { totalBookmarks: 0, folderCount: 0, droppedBookmarkIds, droppedGroups },
              };
            }

            const totalBookmarks = normalizedPlan.reduce((sum, g) => sum + g.bookmarks.length, 0);
            if (totalBookmarks > MAX_BOOKMARKS) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `收藏总数超过上限（${totalBookmarks} > ${MAX_BOOKMARKS}），请拆分为多次整理或缩小范围后重新提交。`,
                  }, null, 2),
                }],
                details: { totalBookmarks, folderCount: normalizedPlan.length },
              };
            }

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  plan: normalizedPlan,
                  message: '整理方案已提交，将以卡片形式展示给用户确认，用户点击「应用整理」后收藏才会实际移动。请告知用户方案已就绪，等待用户确认。',
                }, null, 2),
              }],
              details: {
                totalBookmarks,
                folderCount: normalizedPlan.length,
                droppedBookmarkIds,
                droppedGroups,
              },
            };
          }

          throw new Error(`未知操作: ${action}（应为 plan 或 apply）`);
        },
      },
      {
        name: 'switch_container',
        label: '切换容器',
        description: '切换当前窗口到指定容器，后续新标签页将在该容器中打开',
        parameters: {
          type: 'object',
          properties: {
            containerId: {
              type: 'string',
              description: '目标容器 ID',
            },
          },
          required: ['containerId'],
        },
        execute: async (toolCallId, params) => {
          const { containerId } = params;
          if (!containerId) {
            throw new Error('容器 ID 不能为空');
          }

          // 获取当前主窗口
          const mainWindow = windowManager.getMainWindow();
          if (!mainWindow) {
            throw new Error('未找到主窗口');
          }

          // 获取容器配置（container-manager 内存权威数据，含 DEFAULT_CONTAINERS）
          const container = getContainersLazy().find(c => c.id === containerId);
          if (!container) {
            throw new Error(`容器不存在: ${containerId}`);
          }

          // 调用 windowManager 切换容器
          const success = windowManager.switchContainer(mainWindow.id, containerId, container);
          if (!success) {
            throw new Error(`切换容器失败: ${containerId}`);
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                containerId,
                containerName: container.name,
              }, null, 2),
            }],
            details: { containerId },
          };
        },
      },
      {
        name: 'read_page_content',
        label: '读取页面内容',
        description: '读取当前标签页的页面内容，包括标题、正文、元信息和 Open Graph 数据。用于理解当前正在浏览的网页内容。仅支持当前活跃标签页。',
        parameters: {
          type: 'object',
          properties: {
            tabId: {
              type: 'string',
              description: '标签页 ID（可选，默认使用当前活跃标签页；暂仅支持活跃标签页）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { tab, webContentsId } = resolveToolTargetTab(params && params.tabId);

          if (!READABILITY_SCRIPT) {
            throw new Error('Readability 库未加载，无法提取页面内容');
          }

          // 按需附加调试器（D-01），用完即卸（D-03）
          const attachResult = await cdpManager.attachForAI(webContentsId, ['Runtime']);
          if (!attachResult.success) {
            throw new Error(attachResult.error);
          }

          try {
            // 注入 Readability 提取可读内容（D-05）+ 全部元信息（D-06）
            const extractScript = `
              (function() {
                ${READABILITY_SCRIPT}
                const doc = document.cloneNode(true);
                const reader = new Readability(doc);
                const article = reader.parse();
                const meta = {
                  description: document.querySelector('meta[name="description"]')?.content || '',
                  keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                  author: document.querySelector('meta[name="author"]')?.content || ''
                };
                const og = {
                  title: document.querySelector('meta[property="og:title"]')?.content || '',
                  description: document.querySelector('meta[property="og:description"]')?.content || '',
                  image: document.querySelector('meta[property="og:image"]')?.content || ''
                };
                const properties = {
                  canonical: document.querySelector('link[rel="canonical"]')?.href || '',
                  language: document.documentElement.lang || '',
                  charset: document.characterSet || ''
                };
                return JSON.stringify({
                  title: document.title,
                  url: window.location.href,
                  favicon: document.querySelector('link[rel="icon"]')?.href || '',
                  meta, og, properties,
                  content: article ? article.textContent : ''
                });
              })()
            `;

            const cmdResult = await cdpManager.executeCommand(
              webContentsId,
              'Runtime.evaluate',
              { expression: extractScript, returnByValue: true }
            );
            if (!cmdResult.success) {
              throw new Error(cmdResult.error);
            }

            const evalResult = cmdResult.result || {};
            if (evalResult.exceptionDetails) {
              throw new Error(`页面脚本执行失败: ${evalResult.exceptionDetails.text || '未知错误'}`);
            }
            if (!evalResult.result || typeof evalResult.result.value !== 'string') {
              throw new Error('页面内容提取失败：未返回有效结果');
            }

            const data = JSON.parse(evalResult.result.value);

            // 100KB 截断（D-07）
            if (data.content && data.content.length > MAX_CONTENT_SIZE) {
              data.content = data.content.substring(0, MAX_CONTENT_SIZE) +
                `\n[截断：原始长度 ${data.content.length} 字符，已截断至 102400 字符]`;
            }

            // 空状态契约文案（22-UI-SPEC）：正文为空是合法结果而非错误，
            // 不 throw；与截断互斥（空内容不可能超 100KB），顺序无干扰
            if (!data.content) {
              data.message = '页面无可读内容，可能是纯应用页面或空白页';
            }

            return {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
              details: { title: data.title, contentLength: (data.content || '').length },
            };
          } finally {
            cdpManager.detachForAI(webContentsId);
          }
        },
      },
      {
        name: 'extract_links',
        label: '提取页面链接',
        description: '提取当前页面的所有有效链接，自动过滤非 HTTP 协议和锚点链接，返回去重后的链接列表。用于收集页面中的所有可导航链接。仅支持当前活跃标签页。',
        parameters: {
          type: 'object',
          properties: {
            tabId: {
              type: 'string',
              description: '标签页 ID（可选，默认使用当前活跃标签页；暂仅支持活跃标签页）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { tab, webContentsId } = resolveToolTargetTab(params && params.tabId);

          const attachResult = await cdpManager.attachForAI(webContentsId, ['Runtime']);
          if (!attachResult.success) {
            throw new Error(attachResult.error);
          }

          try {
            // D-08 过滤规则：仅 http/https、过滤本页锚点链接、过滤空文本、URL 去重
            // D-09 返回字段：URL + 链接文本（截取 200 字符）
            const extractScript = `
              (function() {
                const links = Array.from(document.querySelectorAll('a[href]'))
                  .map(a => {
                    try {
                      const url = new URL(a.href, window.location.origin);
                      return {
                        url: url.href,
                        text: (a.textContent || '').trim().substring(0, 200)
                      };
                    } catch {
                      return null;
                    }
                  })
                  .filter(link => {
                    if (!link) return false;
                    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                      return false;
                    }
                    if (link.url.includes('#') &&
                        link.url.split('#')[0] === window.location.href.split('#')[0]) {
                      return false;
                    }
                    if (!link.text) return false;
                    return true;
                  });
                const seen = new Set();
                const uniqueLinks = links.filter(link => {
                  if (seen.has(link.url)) return false;
                  seen.add(link.url);
                  return true;
                });
                return JSON.stringify({
                  total: uniqueLinks.length,
                  links: uniqueLinks
                });
              })()
            `;

            const cmdResult = await cdpManager.executeCommand(
              webContentsId,
              'Runtime.evaluate',
              { expression: extractScript, returnByValue: true }
            );
            if (!cmdResult.success) {
              throw new Error(cmdResult.error);
            }

            const evalResult = cmdResult.result || {};
            if (evalResult.exceptionDetails) {
              throw new Error(`页面脚本执行失败: ${evalResult.exceptionDetails.text || '未知错误'}`);
            }
            if (!evalResult.result || typeof evalResult.result.value !== 'string') {
              throw new Error('链接提取失败：未返回有效结果');
            }

            const data = JSON.parse(evalResult.result.value);

            // 空状态契约文案（22-UI-SPEC）：0 链接是合法结果而非错误，
            // 不 throw、不改变 return 结构（details.totalLinks 逻辑不变）
            if (data.total === 0) {
              data.message = '未找到有效链接（仅保留 http/https 协议）';
            }

            return {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
              details: { totalLinks: data.total },
            };
          } finally {
            cdpManager.detachForAI(webContentsId);
          }
        },
      },
      {
        name: 'open_link',
        label: '打开链接',
        description: '在指定容器中打开一个链接，支持在当前标签页或新标签页中打开。默认使用当前活跃容器和新标签页。',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '要打开的 URL 地址',
            },
            containerId: {
              type: 'string',
              description: '目标容器 ID（可选，默认使用当前活跃容器）',
            },
            newTab: {
              type: 'boolean',
              description: '是否在新标签页中打开（可选，默认 true）',
            },
          },
          required: ['url'],
        },
        execute: async (toolCallId, params) => {
          const { url, newTab = true } = params;

          // URL 白名单校验（与导航入口统一，仅 http/https）
          if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            throw new Error('无效的 URL，仅支持 http/https 协议');
          }

          // D-10：默认使用当前活跃容器，跟随用户操作上下文
          const mainWindow = windowManager.getMainWindow();
          let containerId = params.containerId;
          if (!containerId) {
            // 分配规则优先：URL 命中规则且容器仍存在时，打开到匹配容器
            // （与其他导航入口语义统一，见 docs/product/navigation-entry-points.md）
            const matchedContainer = assignmentRules.matchUrl(url);
            if (matchedContainer &&
                getContainersLazy().find(c => c.id === matchedContainer)) {
              containerId = matchedContainer;
            }
          }
          if (!containerId) {
            containerId = (mainWindow && windowManager.getCurrentContainer(mainWindow.id)) || 'default';
          }

          // 验证容器存在（container-manager 内存权威数据：initContainers 以
          // DEFAULT_CONTAINERS 兜底且从不写回 store，全新 profile 下 store
          // 无 containers 键，空数组兜底读取会误判 default 不存在）
          const container = getContainersLazy().find(c => c.id === containerId);
          if (!container) {
            throw new Error('指定容器不存在或已删除');
          }

          // 多窗口归属：AI 面板所在窗口通常是聚焦窗口；聚焦窗口不是受管窗口
          // （如焦点在播放器等辅助窗口）时回落主窗口
          const focusedWin = BrowserWindow.getFocusedWindow();
          const targetWindow = (focusedWin && windowManager.isManagedWindow(focusedWin.id))
            ? focusedWin
            : mainWindow;

          if (newTab) {
            // D-11：新标签页打开（不影响当前页面）
            // webview 只能由渲染进程创建 —— 复用 window.open 拦截同款
            // open-url-in-tab 通道，渲染进程走完整 createTab 链路
            // （DOM + webview + URL 加载），主进程直接 tabManager.createTab
            // 只会产生无 webview 的幽灵 Tab。
            // tabId 由渲染进程异步创建，主进程无法同步得知（返回 null，
            // 可随后经 get_tabs 按 URL 查询）。
            if (!targetWindow || targetWindow.isDestroyed()) {
              throw new Error('无法在容器中打开链接，请检查容器状态');
            }
            try {
              targetWindow.webContents.send('open-url-in-tab', { url, containerId, guestId: undefined });
            } catch (err) {
              console.warn('[Realm AI] open_link 发送打开请求失败:', err.message);
              throw new Error('无法在容器中打开链接，请检查容器状态');
            }
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  tabId: null,
                  url,
                  containerId,
                  isNewTab: true,
                }, null, 2),
              }],
              details: { tabId: null, url },
            };
          }

          // newTab === false：当前标签页内导航
          const activeTab = tabManager.getActiveTab();
          if (!activeTab) {
            throw new Error('没有活跃的标签页');
          }

          // 分配规则：命中其他容器时不发起当前 tab 的加载（当前 webview
          // partition 绑定来源容器），改在匹配容器新建 tab——与主进程
          // will-navigate 的规则重定向语义一致
          const matchedContainer = assignmentRules.matchUrl(url);
          if (matchedContainer && matchedContainer !== activeTab.containerId) {
            if (!targetWindow || targetWindow.isDestroyed()) {
              throw new Error('无法在容器中打开链接，请检查容器状态');
            }
            targetWindow.webContents.send('open-url-in-tab', {
              url,
              containerId: matchedContainer,
              guestId: undefined,
            });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  tabId: null,
                  url,
                  containerId: matchedContainer,
                  isNewTab: true,
                  redirected: true,
                }, null, 2),
              }],
              details: { tabId: null, url, redirected: true },
            };
          }

          const activeWcId = getActiveWebviewContentsIdLazy();
          const wc = activeWcId ? webContents.fromId(activeWcId) : null;
          if (!wc || wc.isDestroyed()) {
            throw new Error('标签页已关闭');
          }
          // fire-and-forget：不等待页面加载完成，导航结果经渲染进程
          // did-navigate 事件链路自动回写 tab.url 并持久化
          wc.loadURL(url).catch(err => {
            console.warn('[Realm AI] open_link 导航失败:', err.message);
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tabId: activeTab.id,
                url,
                containerId,
                isNewTab: false,
              }, null, 2),
            }],
            details: { tabId: activeTab.id, url },
          };
        },
      },

      // ==================== fill_form 工具 ====================
      {
        name: 'fill_form',
        label: '填写表单',
        description: '自动填写网页表单字段。支持 input/textarea/select/checkbox/radio 等类型。低风险操作自动执行，文件上传需要用户确认。',
        parameters: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              description: '要填写的字段列表，每个元素包含 field（字段名称/label/placeholder）和 value（填写值）',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: '字段名称（label 文本、placeholder、aria-label、name 或 id）' },
                  value: { type: 'string', description: '要填写的值' },
                },
                required: ['field', 'value'],
              },
            },
          },
          required: ['fields'],
        },
        execute: async (toolCallId, params) => {
          // 1. 获取当前活跃标签页
          const { tab, webContentsId } = resolveToolTargetTab();

          // 2. CAPTCHA 预检（per D-14/D-15）
          const captchaCheck = await this._preCheckCaptcha(webContentsId, tab.url);
          if (captchaCheck.captchaDetected) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  captchaDetected: true,
                  captchaType: captchaCheck.captchaType,
                  confidence: captchaCheck.confidence,
                  message: captchaCheck.message,
                }, null, 2),
              }],
              details: { captchaDetected: true, captchaType: captchaCheck.captchaType },
            };
          }

          // 3. 输入消毒（per D-13）
          const sanitized = sanitizeInput(params);
          const fields = sanitized.fields || [];

          if (!Array.isArray(fields) || fields.length === 0) {
            throw new Error('fields 参数不能为空，请提供要填写的字段列表');
          }

          // 4. 风险评估（per D-07）：检查是否包含 file 类型字段
          let uploadActionId = null;
          const hasFileField = fields.some(f => {
            const fieldLower = (f.field || '').toLowerCase();
            return fieldLower.includes('file') || fieldLower.includes('upload') ||
                   fieldLower.includes('文件') || fieldLower.includes('上传');
          });

          if (hasFileField) {
            // 高风险：文件上传，需要用户确认
            const actionId = `fill_form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const fieldNames = fields.map(f => f.field).join(', ');
            const confirmation = await requestActionConfirmation({
              actionId,
              type: 'upload',
              title: '文件上传确认',
              description: `确认上传文件？字段: ${fieldNames}`,
              url: tab.url,
              containerId: tab.containerId,
              riskLevel: 'high',
            });

            if (!confirmation.confirmed) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    cancelled: true,
                    message: '用户取消了文件上传操作',
                  }, null, 2),
                }],
                details: { cancelled: true },
              };
            }
            uploadActionId = actionId;
          }

          // 4. 调用 cdpManager.fillForm 执行填写
          const result = await cdpManager.fillForm(webContentsId, fields);

          // 确认卡片终态推送（upload 场景）
          if (uploadActionId) {
            notifyActionSettled(uploadActionId, result.success ? 'success' : 'error',
              result.success ? '表单填写完成' : (result.failed?.[0]?.error || '表单填写失败'));
          }

          // 5. CAPTCHA 检测处理（per D-14/D-15）
          if (result.captchaDetected) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  captchaDetected: true,
                  captchaType: result.captchaType,
                  message: `检测到验证码（${result.captchaType || 'unknown'}），请手动完成验证后重试`,
                  filled: result.filled,
                  failed: result.failed,
                }, null, 2),
              }],
              details: { captchaDetected: true, captchaType: result.captchaType },
            };
          }

          // 6. 字段未找到处理（per D-04）
          if (!result.success && result.failed && result.failed.length > 0) {
            const notFoundFields = result.failed.filter(f => f.error === '字段未找到');
            if (notFoundFields.length > 0) {
              const allAvailable = notFoundFields.reduce((acc, f) => {
                if (f.availableFields) acc.push(...f.availableFields);
                return acc;
              }, []);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    filled: result.filled,
                    failed: result.failed,
                    availableFields: [...new Set(allAvailable)],
                    message: `部分字段未找到，已填写 ${result.filled.length} 个字段，${result.failed.length} 个失败。可用字段列表已返回，请根据可用字段重新指定。`,
                  }, null, 2),
                }],
                details: { filled: result.filled.length, failed: result.failed.length },
              };
            }
          }

          // 7. 返回结果
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                filled: result.filled,
                failed: result.failed,
                message: result.success
                  ? `成功填写 ${result.filled.length} 个字段`
                  : `填写完成，${result.filled.length} 个成功，${result.failed.length} 个失败`,
              }, null, 2),
            }],
            details: { filled: result.filled.length, failed: result.failed.length },
          };
        },
      },

      // ==================== execute_action 工具 ====================
      {
        name: 'execute_action',
        label: '执行操作',
        description: '在当前页面执行操作，如点击按钮、滚动页面、填写输入框等。低风险操作自动执行，表单提交、文件上传、脚本执行需要用户确认。screenshot 操作支持 fullPage 参数截取完整页面。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: '操作类型',
              enum: ['click', 'scroll', 'type', 'select', 'check', 'uncheck', 'focus', 'blur', 'submit', 'upload', 'drag', 'hover', 'keydown', 'keyup', 'execute_script', 'screenshot', 'wait_for_element'],
            },
            target: {
              type: 'string',
              description: '目标元素描述（文本内容或 CSS 选择器）',
            },
            options: {
              type: 'object',
              description: '操作参数（如 type 的文本内容、scroll 的距离、execute_script 的脚本内容等）',
              properties: {
                text: { type: 'string', description: 'type 操作的文本内容' },
                value: { type: 'string', description: 'select 操作的选项值，或 upload 操作的文件路径' },
                script: { type: 'string', description: 'execute_script 操作的脚本内容' },
                x: { type: 'number', description: 'scroll 操作的横向距离' },
                y: { type: 'number', description: 'scroll 操作的纵向距离' },
                key: { type: 'string', description: 'keydown/keyup 操作的键名（如 Enter、Tab、Escape、ArrowDown，无需传 keyCode）' },
                ctrl: { type: 'boolean', description: 'keydown/keyup 是否按住 Ctrl（如 Ctrl+Enter 发送消息）' },
                shift: { type: 'boolean', description: 'keydown/keyup 是否按住 Shift' },
                alt: { type: 'boolean', description: 'keydown/keyup 是否按住 Alt' },
                meta: { type: 'boolean', description: 'keydown/keyup 是否按住 Cmd/Win' },
                format: { type: 'string', description: 'screenshot 操作的图片格式' },
                quality: { type: 'number', description: 'screenshot 操作的图片质量' },
                fullPage: { type: 'boolean', description: 'screenshot 操作是否截取完整页面（true=截取整个可滚动区域，false=仅截取当前视口，默认 false）' },
                timeout: { type: 'number', description: 'wait_for_element 操作的超时毫秒数' },
                clearFirst: { type: 'boolean', description: 'type 操作是否先清空输入框' },
                filePath: { type: 'string', description: 'upload 操作的文件路径' },
                toX: { type: 'number', description: 'drag 操作的目标 X 坐标' },
                toY: { type: 'number', description: 'drag 操作的目标 Y 坐标' },
              },
            },
          },
          required: ['action'],
        },
        execute: async (toolCallId, params) => {
          // 1. 获取当前活跃标签页
          const { tab, webContentsId } = resolveToolTargetTab();

          // 2. CAPTCHA 预检（per D-14/D-15）
          const captchaCheck = await this._preCheckCaptcha(webContentsId, tab.url);
          if (captchaCheck.captchaDetected) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  captchaDetected: true,
                  captchaType: captchaCheck.captchaType,
                  confidence: captchaCheck.confidence,
                  message: captchaCheck.message,
                }, null, 2),
              }],
              details: { captchaDetected: true, captchaType: captchaCheck.captchaType },
            };
          }

          // 3. 输入消毒（per D-13）
          const sanitized = sanitizeInput(params);
          const { action, target, options } = sanitized;

          if (!action) {
            throw new Error('操作类型不能为空');
          }

          // 4. 风险评估（per D-07）
          const highRiskActions = ['submit', 'upload', 'execute_script'];
          let isHighRisk = highRiskActions.includes(action);

          // click 语义升级（D-07 补漏，按用户决策改为元素类型判定）：
          // click 目标是按钮类元素（button/input[submit|button|image|reset]/[role=button]）
          // 一律需用户确认 —— 文字/语义判定不可靠，按钮可能触发任意不可逆行为
          let clickIsSubmit = false;
          let clickIsButton = false;
          let clickButtonDesc = target || '';
          if (!isHighRisk && action === 'click' && target) {
            const inspection = await cdpManager.inspectClickTarget(webContentsId, target);
            clickIsSubmit = inspection.isSubmit === true;
            clickIsButton = inspection.isButton === true;
            if (inspection.description) clickButtonDesc = inspection.description;
            console.log(`[Realm AI] click 目标元素检查: "${target}" → isButton=${clickIsButton}, isSubmit=${clickIsSubmit} (found=${inspection.found ?? '?'}, desc="${clickButtonDesc}")`);
            if (clickIsSubmit || clickIsButton) isHighRisk = true;
          }

          // 支付检测逻辑：检查 target 或页面 URL 是否包含支付关键词
          const paymentKeywords = ['pay', 'payment', '付款', '支付', 'confirm order', 'place order', '下单', '结算'];
          let isPayment = false;

          if (action === 'submit' || clickIsSubmit || clickIsButton) {
            const targetLower = (clickButtonDesc || '').toLowerCase();
            const urlLower = (tab.url || '').toLowerCase();
            isPayment = paymentKeywords.some(kw =>
              targetLower.includes(kw) || urlLower.includes(kw)
            );
            if (isPayment) isHighRisk = true;
          }

          // 4. 高风险操作确认
          let confirmedActionId = null;
          if (isHighRisk) {
            const actionId = `execute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            let confirmTitle, confirmDesc, riskLevel;

            if (isPayment) {
              confirmTitle = '支付操作';
              confirmDesc = `确认在 ${tab.url} 执行支付？请仔细核对金额。`;
              riskLevel = 'critical';
            } else if (action === 'submit' || clickIsSubmit) {
              confirmTitle = '提交表单';
              confirmDesc = clickIsSubmit
                ? `点击「${clickButtonDesc}」将向 ${tab.url} 提交数据，此操作不可撤销。`
                : `确认向 ${tab.url} 提交数据？此操作不可撤销。`;
              riskLevel = 'high';
            } else if (clickIsButton) {
              confirmTitle = '点击按钮';
              confirmDesc = `确认在 ${tab.url} 点击「${clickButtonDesc}」？按钮操作可能改变页面状态或触发不可逆行为。`;
              riskLevel = 'medium';
            } else if (action === 'upload') {
              confirmTitle = '上传文件';
              confirmDesc = `确认向 ${tab.url} 上传文件？`;
              riskLevel = 'high';
            } else if (action === 'execute_script') {
              confirmTitle = '执行脚本';
              confirmDesc = '确认在页面中执行脚本？';
              riskLevel = 'high';
            }

            const confirmation = await requestActionConfirmation({
              actionId,
              type: isPayment ? 'payment' : (clickIsSubmit ? 'submit' : (clickIsButton ? 'click' : action)),
              title: confirmTitle,
              description: confirmDesc,
              url: tab.url,
              containerId: tab.containerId,
              riskLevel,
            });

            if (!confirmation.confirmed) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    cancelled: true,
                    message: `用户取消了${confirmTitle}操作`,
                  }, null, 2),
                }],
                details: { cancelled: true, action },
              };
            }
            confirmedActionId = actionId;
          }

          // 5. execute_script 安全检查（per D-13/D-16）
          if (action === 'execute_script') {
            const script = options?.script || options?.value || '';
            const validation = validateScript(script);
            if (!validation.safe) {
              notifyActionSettled(confirmedActionId, 'error', `脚本安全检查未通过: ${validation.reason}`);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    blocked: true,
                    message: `脚本安全检查未通过: ${validation.reason}`,
                    reason: validation.reason,
                  }, null, 2),
                }],
                details: { blocked: true, action, reason: validation.reason },
              };
            }
          }

          // 6. 调用 cdpManager.executeAction 执行操作
          const result = await cdpManager.executeAction(webContentsId, action, target, options);

          // 确认卡片终态推送：用户点击后卡片停在 executing，需执行侧推送 success/error
          notifyActionSettled(confirmedActionId, result.success ? 'success' : 'error',
            result.success ? `${action} 操作执行成功` : (result.error || '操作执行失败'));

          // 7. 返回操作结果 + 页面变化信息（per D-12）

          // 截图操作特殊处理：返回图片类型，让 AI 模型能真正"看到"图片内容
          if (action === 'screenshot' && result.success) {
            return {
              content: [
                { type: 'image', data: result.result, mimeType: 'image/png' },
                { type: 'text', text: '截图已完成，请分析图片内容。' },
              ],
              details: {
                action,
                success: true,
                pageChanges: result.pageChanges,
              },
            };
          }

          // 其他操作返回文本结果
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                result: result.result,
                pageChanges: result.pageChanges,
                message: result.success
                  ? `${action} 操作执行成功`
                  : `操作执行失败: ${result.error}`,
                error: result.error,
              }, null, 2),
            }],
            details: {
              action,
              success: result.success,
              pageChanges: result.pageChanges,
            },
          };
        },
      },

      // ==================== generate_script 工具 ====================
      {
        name: 'generate_script',
        label: '生成脚本',
        description: '根据自然语言描述生成可执行的自动化脚本。脚本由步骤序列组成，每个步骤复用 execute_action 的操作能力（click/type/scroll/wait 等）。生成的脚本会经过安全验证，包含危险操作的脚本会被拦截。',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: '用户任务的自然语言描述',
            },
            containerId: {
              type: 'string',
              description: '目标容器 ID（可选，默认使用当前活跃容器）',
            },
            steps: {
              type: 'array',
              description: '脚本步骤数组，每步包含 action/target/options/waitFor',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  target: { type: 'string' },
                  options: { type: 'object' },
                  waitFor: { type: 'number' },
                },
              },
            },
          },
          required: ['description'],
        },
        execute: async (toolCallId, params) => {
          const { description, containerId: requestedContainerId, steps: inputSteps } = params;

          if (!description) {
            throw new Error('任务描述不能为空');
          }

          // 确定目标容器：优先使用参数指定，否则取当前活跃容器
          let containerId = requestedContainerId;
          if (!containerId) {
            const mainWindow = windowManager.getMainWindow();
            containerId = (mainWindow && windowManager.getCurrentContainer(mainWindow.id)) || 'default';
          }

          // 验证容器存在
          const container = getContainersLazy().find(c => c.id === containerId);
          if (!container) {
            throw new Error(`指定容器不存在或已删除: ${containerId}`);
          }

          // 构造脚本骨架 —— 若 AI 传入 steps 则直接使用，否则返回空骨架供后续填充
          const script = {
            name: description.substring(0, 50),
            description,
            steps: Array.isArray(inputSteps) ? inputSteps : [],
            containerId,
          };

          // 静态分析验证
          const validation = validateScriptForSteps(script);
          if (!validation.safe) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  blocked: true,
                  message: `脚本安全检查未通过: ${validation.reason}`,
                  reason: validation.reason,
                  details: validation.details,
                }, null, 2),
              }],
              details: { safe: false, reason: validation.reason },
            };
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(script, null, 2),
            }],
            details: {
              scriptName: script.name,
              stepCount: script.steps.length,
              safe: true,
            },
          };
        },
      },

      // ==================== suggest_tab_groups 工具 ====================
      /**
       * 标签分组建议工具
       *
       * 分析当前所有标签页并生成智能分组建议。
       * 支持三种分组策略：
       * - domain: 按 URL 域名分组（execute 函数内部完成）
       * - semantic: AI 根据页面标题和 URL 进行语义分组（execute 返回原始数据供 AI 判断）
       * - mixed: 先按域名分组，AI 可在此基础上进一步语义细分
       *
       * 基于 D-13~D-16 标签分组决策实现。
       */
      {
        name: 'suggest_tab_groups',
        label: '标签分组建议',
        description: '分析当前标签页并生成智能分组建议，按主题或域名对标签页进行分组',
        parameters: {
          type: 'object',
          properties: {
            strategy: {
              type: 'string',
              description: '分组策略：domain（按域名分组）、semantic（按语义主题分组）、mixed（先按域名再语义细分）',
              enum: ['domain', 'semantic', 'mixed'],
            },
            containerId: {
              type: 'string',
              description: '仅分析指定容器的标签页（可选，默认分析所有容器）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { strategy = 'semantic', containerId } = params || {};

          // 获取当前所有标签页
          const allTabs = tabManager.getTabs();

          // 空标签页处理
          if (!allTabs || allTabs.length === 0) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  groups: [],
                  ungrouped: [],
                  message: '当前没有打开的标签页',
                }, null, 2),
              }],
              details: { totalTabs: 0, groupCount: 0, strategy },
            };
          }

          // 按容器过滤（如果指定）
          const tabs = containerId
            ? allTabs.filter(tab => tab.containerId === containerId)
            : allTabs;

          if (tabs.length === 0) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  groups: [],
                  ungrouped: [],
                  message: `容器 ${containerId} 中没有打开的标签页`,
                }, null, 2),
              }],
              details: { totalTabs: 0, groupCount: 0, strategy },
            };
          }

          // 标准化标签页数据（仅保留分组所需字段）
          const tabData = tabs.map(tab => ({
            id: tab.id,
            title: tab.title || '(无标题)',
            url: tab.url || '',
            containerId: tab.containerId,
            faviconUrl: tab.faviconUrl || '',
            pinned: Boolean(tab.pinned),
          }));

          // ==================== domain 策略：按 URL 域名分组 ====================
          if (strategy === 'domain') {
            const domainMap = new Map();
            for (const tab of tabData) {
              let hostname = '';
              try {
                hostname = new URL(tab.url).hostname;
              } catch {
                hostname = '(无效 URL)';
              }
              if (!domainMap.has(hostname)) {
                domainMap.set(hostname, []);
              }
              domainMap.get(hostname).push(tab);
            }

            const groups = [];
            for (const [hostname, groupTabs] of domainMap) {
              groups.push({ name: hostname, tabs: groupTabs });
            }

            // 按组内标签页数量降序排列
            groups.sort((a, b) => b.tabs.length - a.tabs.length);

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ groups, ungrouped: [] }, null, 2),
              }],
              details: { totalTabs: tabData.length, groupCount: groups.length, strategy },
            };
          }

          // ==================== semantic 策略：返回数据供 AI 语义分组 ====================
          // execute 函数将标签页数据格式化后返回给 AI，
          // AI 根据页面标题和 URL 语义进行分组判断。
          if (strategy === 'semantic') {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  tabs: tabData,
                  message: '请根据以下标签页的标题和 URL 进行语义分组。按主题（如新闻、社交媒体、工作、开发工具、购物等）对标签页进行归类，每组给一个简短的中文组名。完成分组后必须调用 apply_tab_groups 工具提交结构化结果（groups 数组，每组 { name, tabs: [{ id }] }，id 取自上面的 tabs 数据），提交后会渲染卡片给用户确认，未经 apply_tab_groups 提交的分组不会生效。',
                }, null, 2),
              }],
              details: { totalTabs: tabData.length, groupCount: 0, strategy },
            };
          }

          // ==================== mixed 策略：域名分组 + AI 语义细分 ====================
          // 先按域名分组，再对域名数量 >= 3 的组提供给 AI 进行语义细分
          const domainMap = new Map();
          for (const tab of tabData) {
            let hostname = '';
            try {
              hostname = new URL(tab.url).hostname;
            } catch {
              hostname = '(无效 URL)';
            }
            if (!domainMap.has(hostname)) {
              domainMap.set(hostname, []);
            }
            domainMap.get(hostname).push(tab);
          }

          // 将域名组分为「可细分」和「保持不变」两类
          const stableGroups = [];  // 标签页数 < 3 的组，无需细分
          const refineableGroups = [];  // 标签页数 >= 3 的组，可供 AI 细分

          for (const [hostname, groupTabs] of domainMap) {
            if (groupTabs.length >= 3) {
              refineableGroups.push({ name: hostname, tabs: groupTabs });
            } else {
              stableGroups.push({ name: hostname, tabs: groupTabs });
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                stableGroups,
                refineableGroups,
                message: '以下按域名分组的标签页中，stableGroups 已按域名归类无需调整；refineableGroups 中每个域名组包含 3 个以上标签页，请根据标题和 URL 语义进一步细分为更小的主题组。细分完成后将 stableGroups 与细分结果合并为最终分组，并调用 apply_tab_groups 工具提交（groups 数组，每组 { name, tabs: [{ id }] }，id 取自上面的 tabs 数据），提交后会渲染卡片给用户确认，未经 apply_tab_groups 提交的分组不会生效。',
              }, null, 2),
            }],
            details: {
              totalTabs: tabData.length,
              groupCount: stableGroups.length + refineableGroups.length,
              strategy,
            },
          };
        },
      },

      // ==================== apply_tab_groups 工具 ====================
      /**
       * 应用标签分组工具
       *
       * AI 完成语义分组（suggest_tab_groups 的 semantic/mixed 策略）后，
       * 通过本工具提交结构化分组结果。分组将以卡片形式展示给用户确认，
       * 用户点击「应用分组」后标签页才会实际重排（渲染端 tab:reorder IPC）。
       *
       * 防幻觉校验：AI 提交的 tab id 必须存在于 tabManager.getTabs() 权威列表，
       * 不存在的 id 丢弃并记录 droppedTabIds；tab 元数据以主进程权威数据重建，
       * 不信 AI 提交值（per T-25-12）。
       */
      {
        name: 'apply_tab_groups',
        label: '应用标签分组',
        description: '提交语义分组后的结构化分组结果。分组将以卡片形式展示给用户确认，用户点击「应用分组」后标签页才会实际重排',
        parameters: {
          type: 'object',
          properties: {
            groups: {
              type: 'array',
              description: '分组数组，每项为 { name: 组名（必填）, tabs: 标签页对象数组（每项至少含 id: 标签页 id） }',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '组名' },
                  tabs: {
                    type: 'array',
                    description: '组内标签页，每项至少含 id 字段（取自 suggest_tab_groups 返回的 tabs 数据）',
                    items: { type: 'object' },
                  },
                },
                required: ['name', 'tabs'],
              },
            },
          },
          required: ['groups'],
        },
        execute: async (toolCallId, params) => {
          const sanitized = sanitizeInput(params) || {};
          const { groups } = sanitized;

          // 基础校验：groups 必须是非空数组，每项必须有非空 name 和 tabs 数组
          if (!Array.isArray(groups) || groups.length === 0
            || groups.some(g => !g || typeof g.name !== 'string' || !g.name.trim() || !Array.isArray(g.tabs))) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: '参数不合法：groups 必须是非空数组，每项需包含非空 name 和 tabs 数组。请按 { groups: [{ name, tabs: [{ id }] }] } 格式重试。',
                }, null, 2),
              }],
              details: { totalTabs: 0, groupCount: 0, droppedTabIds: [], droppedGroups: 0 },
            };
          }

          // 权威标签列表：构建有效 tab id 集合和 id → tab 数据映射
          const allTabs = tabManager.getTabs() || [];
          const validTabIds = new Set(allTabs.map(tab => tab.id));
          const tabById = new Map(allTabs.map(tab => [tab.id, tab]));

          // 逐组清洗：丢弃幻觉 id，以权威数据重建 tab 条目
          const droppedTabIds = [];
          let droppedGroups = 0;
          const normalizedGroups = [];
          for (const group of groups) {
            const validTabs = [];
            for (const entry of group.tabs) {
              const id = entry && typeof entry.id === 'string' ? entry.id : null;
              if (!id || !validTabIds.has(id)) {
                if (id) droppedTabIds.push(id);
                continue;
              }
              const tab = tabById.get(id);
              validTabs.push({
                id: tab.id,
                title: tab.title || '(无标题)',
                url: tab.url || '',
                containerId: tab.containerId,
                faviconUrl: tab.faviconUrl || '',
                pinned: Boolean(tab.pinned),
              });
            }
            if (validTabs.length === 0) {
              droppedGroups += 1;
              continue;
            }
            normalizedGroups.push({ name: group.name.trim(), tabs: validTabs });
          }

          // 全部无效：返回错误说明，不抛出异常中断对话
          if (normalizedGroups.length === 0) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  groups: [],
                  message: '所有提交的 tab id 均无效，分组未提交。请先调用 get_tabs 核对当前标签页 id 后重试。',
                }, null, 2),
              }],
              details: { totalTabs: 0, groupCount: 0, droppedTabIds, droppedGroups },
            };
          }

          const totalTabs = normalizedGroups.reduce((sum, g) => sum + g.tabs.length, 0);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                groups: normalizedGroups,
                message: '分组已提交，将以卡片形式展示给用户确认，用户点击「应用分组」后标签页才会实际重排。请告知用户分组已就绪，等待用户确认。',
              }, null, 2),
            }],
            details: {
              totalTabs,
              groupCount: normalizedGroups.length,
              droppedTabIds,
              droppedGroups,
            },
          };
        },
      },

      // ==================== close_tab 工具 ====================
      /**
       * 关闭指定标签页工具
       *
       * AI 传入 tabId 关闭对应标签页。webview 由渲染进程创建持有，
       * 主进程直接 tabManager.closeTab 只删元数据会留幽灵 webview，
       * 故向 tab 所属窗口发送 tab:ai-close 事件，渲染进程走完整
       * closeTab 生命周期（入已关闭栈、清媒体列表、销毁 webview、切换活动 tab）。
       * 关闭结果异步生效，AI 可随后经 get_tabs 确认。
       */
      {
        name: 'close_tab',
        label: '关闭标签页',
        description: '关闭指定 ID 的标签页。先用 get_tabs 获取标签页列表及其 ID，再调用此工具关闭。',
        parameters: {
          type: 'object',
          properties: {
            tabId: {
              type: 'string',
              description: '要关闭的标签页 ID（取自 get_tabs 返回的 id）',
            },
          },
          required: ['tabId'],
        },
        execute: async (toolCallId, params) => {
          const { tabId } = params;
          if (!tabId || typeof tabId !== 'string') {
            throw new Error('tabId 不能为空');
          }

          const tab = tabManager.getTab(tabId);
          if (!tab) {
            throw new Error('标签页不存在或已关闭，请先调用 get_tabs 核对当前标签页 ID');
          }

          const win = windowManager.getWindow(tab.windowId);
          if (!win) {
            throw new Error('标签页所属窗口不存在或已销毁，无法关闭');
          }

          try {
            win.webContents.send('tab:ai-close', { tabId });
          } catch (err) {
            console.warn('[Realm AI] close_tab 发送关闭请求失败:', err.message);
            throw new Error('关闭标签页失败，请检查窗口状态');
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tabId,
                title: tab.title || '',
                url: tab.url || '',
                containerId: tab.containerId,
                message: '已请求关闭该标签页，可通过 get_tabs 确认结果',
              }, null, 2),
            }],
            details: { tabId },
          };
        },
      },

      // ==================== close_tabs 批量关闭工具 ====================
      /**
       * 批量关闭标签页工具
       *
       * 两种模式：
       * - list：显式 tabIds 列表（可跨窗口），主进程按窗口分组后向各窗口发送
       * - others / left / right：以 tabId 为锚点，关闭其同窗口内其他/左侧/右侧全部标签页。
       *   窗口内顺序的权威在渲染端（state.tabs 插入序），主进程只转发锚点与动作，
       *   渲染端 handleAiCloseTab 复用右键菜单同款切分逻辑计算实际关闭列表。
       * 关闭结果异步生效，AI 可随后经 get_tabs 确认。
       */
      {
        name: 'close_tabs',
        label: '批量关闭标签页',
        description: '批量关闭标签页。action=list 时按 tabIds 列表关闭（可跨窗口）；action=others/left/right 时以 tabId 为锚点关闭同窗口内其他/左侧/右侧全部标签页。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: '关闭方式：list 显式列表（默认）；others 关闭锚点之外同窗口全部；left 关闭锚点左侧全部；right 关闭锚点右侧全部',
            },
            tabId: {
              type: 'string',
              description: '锚点标签页 ID（action 为 others/left/right 时必填，取自 get_tabs 返回的 id）',
            },
            tabIds: {
              type: 'array',
              items: { type: 'string' },
              description: '要关闭的标签页 ID 列表（action=list 时必填，取自 get_tabs 返回的 id）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          const { action = 'list', tabId, tabIds } = params;
          const allTabs = tabManager.getTabs() || [];
          const tabById = new Map(allTabs.map(t => [t.id, t]));

          // 1. 计算待关清单（用于确认卡片预览；锚点式的实际关闭列表
          //    仍由渲染端按权威顺序切分，主进程顺序仅用于预览）
          let targetTabs = [];
          if (action === 'others' || action === 'left' || action === 'right') {
            if (!tabId || typeof tabId !== 'string') {
              throw new Error(`action=${action} 时必须提供锚点 tabId`);
            }
            const anchorTab = tabManager.getTab(tabId);
            if (!anchorTab) {
              throw new Error('锚点标签页不存在或已关闭，请先调用 get_tabs 核对当前标签页 ID');
            }
            const windowTabIds = allTabs.filter(t => t.windowId === anchorTab.windowId).map(t => t.id);
            const anchorIndex = windowTabIds.indexOf(anchorTab.id);
            let scopeIds = [];
            if (action === 'others') {
              scopeIds = windowTabIds.filter(id => id !== anchorTab.id);
            } else if (action === 'left') {
              scopeIds = windowTabIds.slice(0, anchorIndex);
            } else {
              scopeIds = windowTabIds.slice(anchorIndex + 1);
            }
            targetTabs = scopeIds.map(id => tabById.get(id)).filter(Boolean);
            if (targetTabs.length === 0) {
              const nothing = action === 'others' ? '锚点所在窗口没有其他标签页'
                : action === 'left' ? '锚点左侧没有标签页' : '锚点右侧没有标签页';
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: false, message: nothing }, null, 2),
                }],
                details: { action, tabId, nothingToClose: true },
              };
            }
          } else if (action === 'list') {
            if (!Array.isArray(tabIds) || tabIds.length === 0) {
              throw new Error('tabIds 必须是非空字符串数组（action=list 时）');
            }
            const invalidIds = [];
            for (const id of tabIds) {
              if (typeof id === 'string' && tabById.has(id)) {
                targetTabs.push(tabById.get(id));
              } else {
                invalidIds.push(id);
              }
            }
            if (targetTabs.length === 0) {
              throw new Error('所有 tabId 均无效，请先调用 get_tabs 核对当前标签页 ID');
            }
          } else {
            throw new Error(`未知 action: ${action}（应为 list/others/left/right）`);
          }

          // 2. 确认卡片：列出待关清单，用户点「确认执行」才真正关闭
          const actionId = `close_tabs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const MAX_PREVIEW = 8;
          const previewLines = targetTabs.slice(0, MAX_PREVIEW)
            .map((t, i) => `${i + 1}. ${t.title || '(无标题)'}${t.url ? ` — ${t.url}` : ''}`);
          if (targetTabs.length > MAX_PREVIEW) {
            previewLines.push(`……等共 ${targetTabs.length} 个标签页`);
          }
          const confirmation = await requestActionConfirmation({
            actionId,
            type: 'close_tab',
            title: '批量关闭标签页',
            description: `即将关闭 ${targetTabs.length} 个标签页：\n${previewLines.join('\n')}`,
            riskLevel: 'medium',
          });

          if (!confirmation.confirmed) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  cancelled: true,
                  message: '用户取消了批量关闭操作',
                }, null, 2),
              }],
              details: { cancelled: true, action },
            };
          }

          // 3. 执行：锚点式转发动作与锚点（渲染端切分）；list 按窗口分组发送
          const closedTabIds = [];
          try {
            if (action === 'others' || action === 'left' || action === 'right') {
              const anchorTab = tabManager.getTab(tabId);
              const win = anchorTab ? windowManager.getWindow(anchorTab.windowId) : null;
              if (!win) {
                throw new Error('标签页所属窗口不存在或已销毁，无法关闭');
              }
              win.webContents.send('tab:ai-close', { action, tabId });
            } else {
              const byWindow = new Map();
              for (const t of targetTabs) {
                if (!byWindow.has(t.windowId)) byWindow.set(t.windowId, []);
                byWindow.get(t.windowId).push(t.id);
              }
              for (const [winId, ids] of byWindow) {
                const win = windowManager.getWindow(winId);
                if (!win) continue;
                win.webContents.send('tab:ai-close', { tabIds: ids });
                closedTabIds.push(...ids);
              }
              if (closedTabIds.length === 0) {
                throw new Error('批量关闭失败，所有标签页所属窗口均不可用');
              }
            }
          } catch (err) {
            notifyActionSettled(actionId, 'error', err.message);
            throw err;
          }

          // 4. 卡片终态 + 返回结果（关闭异步生效，AI 可经 get_tabs 确认）
          notifyActionSettled(actionId, 'success',
            `已请求关闭 ${action === 'list' ? closedTabIds.length : targetTabs.length} 个标签页`);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                action,
                anchorTabId: action !== 'list' ? tabId : undefined,
                requested: targetTabs.length,
                closed: action === 'list' ? closedTabIds.length : targetTabs.length,
                invalidIds: action === 'list'
                  ? tabIds.filter(id => !targetTabs.some(t => t.id === id))
                  : [],
                message: '已请求批量关闭，可通过 get_tabs 确认结果',
              }, null, 2),
            }],
            details: { action, closed: closedTabIds.length },
          };
        },
      },

      // ==================== switch_tab 工具 ====================
      /**
       * 切换到指定标签页工具
       *
       * AI 传入 tabId 激活对应已打开标签页。主进程先 tabManager.switchTab
       * 更新权威活动 Tab 表（含 lastActiveAt 持久化），再向 tab 所属窗口发送
       * tab:ai-switch 事件，渲染端走完整 switchTab 链路（webview 显隐、
       * Vim 状态清理、容器指示器跟随等）；跨窗口时把目标窗口带到前台。
       */
      {
        name: 'switch_tab',
        label: '切换标签页',
        description: '切换到指定 ID 的已打开标签页。先用 get_tabs 获取标签页列表及其 ID，再调用此工具切换。',
        parameters: {
          type: 'object',
          properties: {
            tabId: {
              type: 'string',
              description: '要切换到的标签页 ID（取自 get_tabs 返回的 id）',
            },
          },
          required: ['tabId'],
        },
        execute: async (toolCallId, params) => {
          const { tabId } = params;
          if (!tabId || typeof tabId !== 'string') {
            throw new Error('tabId 不能为空');
          }

          const tab = tabManager.getTab(tabId);
          if (!tab) {
            throw new Error('标签页不存在或已关闭，请先调用 get_tabs 核对当前标签页 ID');
          }

          if (!tabManager.switchTab(tabId)) {
            throw new Error('切换标签页失败');
          }

          const win = windowManager.getWindow(tab.windowId);
          if (win) {
            // 跨窗口场景：目标窗口不是当前聚焦窗口时带到前台，
            // 让用户能看到切换结果
            const focusedWin = BrowserWindow.getFocusedWindow();
            if (!focusedWin || focusedWin.id !== win.id) {
              win.show();
              win.focus();
            }
            try {
              win.webContents.send('tab:ai-switch', { tabId });
            } catch (err) {
              console.warn('[Realm AI] switch_tab 发送切换请求失败:', err.message);
              throw new Error('切换标签页失败，请检查窗口状态');
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tabId,
                title: tab.title || '',
                url: tab.url || '',
                containerId: tab.containerId,
                windowId: tab.windowId,
              }, null, 2),
            }],
            details: { tabId },
          };
        },
      },

      // ==================== web_search 工具 ====================
      /**
       * 网络搜索工具
       *
       * 搜索互联网获取实时信息。当需要最新新闻、技术文档、当前事件或任何不在记忆中的外部知识时使用。
       * 委托 search-manager.js 执行搜索，支持多个 Provider 和智能 Fallback。
       */
      {
        name: 'web_search',
        label: '网络搜索',
        description: '搜索互联网获取实时信息。当需要最新新闻、技术文档、当前事件或任何不在记忆中的外部知识时使用。',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
            maxResults: {
              type: 'number',
              description: '返回结果数量（可选，默认 10）',
            },
          },
          required: ['query'],
        },
        execute: async (toolCallId, params) => {
          const { query, maxResults = 10 } = params;
          if (!query || !query.trim()) {
            throw new Error('搜索关键词不能为空');
          }

          try {
            const searchPayload = await searchManager.doSearch(query, maxResults);
            const { results, provider } = searchPayload;

            if (results.length === 0) {
              // 检查是否为 all_failed 场景（所有 Provider 都失败）
              const diagnostics = searchPayload.diagnostics;
              if (diagnostics?.status === 'all_failed' && diagnostics.attempts?.length > 0) {
                const attemptsDetail = diagnostics.attempts.map((a, i) =>
                  `  ${i + 1}. ${a.provider || '未知'}: ${a.error_type || 'error'} - ${a.message || '无详情'}`
                ).join('\n');
                return {
                  content: [{
                    type: 'text',
                    text: `搜索「${query}」失败：所有 Provider 均不可用（共尝试 ${diagnostics.attempts.length} 个）。\n\n失败详情：\n${attemptsDetail}\n\n请检查网络连接或在设置中配置搜索 API Key。`,
                  }],
                  details: searchPayload,
                };
              }

              // 通用空结果消息（Provider 返回了0条结果，但不是全部失败）
              return {
                content: [{
                  type: 'text',
                  text: `未找到「${query}」的搜索结果。已尝试 Provider: ${provider}。请尝试换个关键词搜索。`,
                }],
                details: searchPayload,
              };
            }

            const displayLimit = searchManager.clampResultsToRange(maxResults, {
              defaultValue: 10,
              max: 100,
            });
            const formatted = searchManager.formatSearchResults(results, displayLimit);

            // 检查是否有 API Key 无效的 Provider
            const diagnostics = searchPayload.diagnostics;
            const invalidKeyProviders = diagnostics?.api_key_invalid_providers || [];
            let warning = '';
            if (invalidKeyProviders.length > 0) {
              warning = `\n\n⚠️ 注意：以下搜索 Provider 的 API Key 可能无效：${invalidKeyProviders.join('、')}。已自动切换到免费 Provider。请在设置中检查并更新 API Key。`;
            }

            return {
              content: [{
                type: 'text',
                text: formatted + warning,
              }],
              details: {
                provider,
                resultCount: results.length,
                api_key_invalid_providers: invalidKeyProviders.length > 0 ? invalidKeyProviders : undefined,
              },
            };
          } catch (err) {
            // 错误处理：返回包含诊断信息的错误文本
            const attempts = err.attempts || [];
            const attemptsInfo = attempts.length > 0
              ? `已尝试 ${attempts.length} 个 Provider，均不可用。`
              : '';
            return {
              content: [{
                type: 'text',
                text: `搜索失败：${err.message}。${attemptsInfo}请检查网络连接或在设置中配置搜索 API Key。`,
              }],
              details: { error: err.message },
            };
          }
        },
      },

      // ==================== web_fetch 工具 ====================
      /**
       * 网页内容抓取工具
       *
       * 抓取指定 URL 的网页全文内容并返回可读的 Markdown 文本。
       * 用于读取搜索结果中的文章全文、文档页面等。
       * 委托 search-manager.js 执行抓取，支持 SSRF 防护和内容截断。
       */
      {
        name: 'web_fetch',
        label: '抓取网页',
        description: '抓取指定 URL 的网页内容并返回可读的 Markdown 文本。用于读取搜索结果中的文章全文、文档页面等。',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '要抓取的网页 URL（必须包含 https:// 或 http://）',
            },
            maxLength: {
              type: 'number',
              description: '返回内容最大字符数（可选，默认 12000）',
            },
          },
          required: ['url'],
        },
        execute: async (toolCallId, params) => {
          const { url, maxLength = 12000 } = params;
          if (!url) {
            throw new Error('URL 不能为空');
          }

          try {
            const result = await searchManager.fetchUrl(url, maxLength);
            return {
              content: [{
                type: 'text',
                text: result.markdown,
              }],
              details: {
                url: result.finalUrl,
                format: result.format,
                truncated: result.truncated,
              },
            };
          } catch (err) {
            throw new Error(`抓取失败: ${err.message}`);
          }
        },
      },

      // ==================== memory 工具 ====================
      /**
       * 记忆写入工具（Phase 43 AI 记忆 MVP）
       *
       * 向三层持久记忆写入条目，委托 ai-memory-manager.write 执行。
       * target:'container' 按当时活跃容器解析（D-02 调用时解析语义）；
       * executionMode:'sequential' 防同批次并发写同一 md 文件。
       * 业务校验失败（参数组合/威胁扫描/预算超限）由 manager throw →
       * SDK 转 isError:true toolResult，LLM 可见并自行修正。
       */
      {
        name: 'memory',
        label: '写入记忆',
        description: '向持久记忆写入条目。action: add(新增)/replace(按编号改写)/remove(按编号删除)；'
          + 'target: user(用户画像)/global(全局记忆)/container(当前活跃容器的记忆)。'
          + 'replace/remove 必须传 entryId（memory_read 返回的条目编号，如 "M3"）；add/replace 必须传 content，content 必须是单行文本（不含换行，多行内容拆成多条 add）。'
          + '每层记忆有字符预算，写满时请先用 remove 整理旧条目再 add，不要静默放弃。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'replace', 'remove'],
              description: '写入操作类型',
            },
            target: {
              type: 'string',
              enum: ['user', 'global', 'container'],
              description: '写入哪一层记忆；container 按当时活跃容器解析',
            },
            entryId: {
              type: 'string',
              pattern: '^M[0-9]+$',
              description: 'replace/remove 必填，条目编号如 "M3"',
            },
            content: {
              type: 'string',
              description: 'add/replace 必填，条目正文；必须为单行文本（不含换行），受该层字符预算限制，写满时先 remove 整理旧条目',
            },
          },
          required: ['action', 'target'],
        },
        executionMode: 'sequential',
        execute: async (toolCallId, params) => {
          const { action, target } = params;

          // target:'container' 在 execute 内按当时活跃容器解析（D-02 方案 A）
          let resolvedContainerId;
          if (target === 'container') {
            const activeTab = tabManager.getActiveTab();
            if (!activeTab || !activeTab.containerId) {
              throw new Error('无法获取当前容器，请先打开一个标签页');
            }
            resolvedContainerId = activeTab.containerId;
          }

          const result = getAiMemoryManagerLazy().write({
            action,
            target,
            content: params.content,
            entryId: params.entryId,
            containerId: resolvedContainerId,
          });

          const layerLabel = target === 'user' ? '用户画像'
            : target === 'global' ? '全局记忆'
              : `容器 ${resolvedContainerId} 记忆`;
          const actionLabel = { add: '新增', replace: '更新', remove: '删除' }[action] || action;
          return {
            content: [{
              type: 'text',
              text: `已${actionLabel}${layerLabel}条目 ${result.entryId}。该层剩余预算 ${result.remaining}/${result.budget} 字符。`,
            }],
            details: {
              budget: result.budget,
              remaining: result.remaining,
              entryId: result.entryId,
              target,
              containerId: resolvedContainerId,
            },
          };
        },
      },

      // ==================== memory_read 工具 ====================
      /**
       * 容器记忆读取工具（Phase 43 AI 记忆 MVP）
       *
       * 容器记忆不进 system prompt（D-03），只经此工具按需读取。
       * containerId 省略时读当前活跃容器（search_history 同款解析模式）。
       * 文件不存在返回友好空态而非 throw——全链路唯一不 throw 例外（D-05）。
       */
      {
        name: 'memory_read',
        label: '读取容器记忆',
        description: '读取指定容器的持久记忆（工作记忆：项目惯例、登录状态、站点注意事项）。'
          + 'containerId 省略时读当前活跃容器；处理容器相关任务前先调用此工具。',
        parameters: {
          type: 'object',
          properties: {
            containerId: {
              type: 'string',
              description: '容器 ID（可选，默认当前活跃容器）',
            },
          },
        },
        execute: async (toolCallId, params) => {
          let { containerId } = params;
          if (!containerId) {
            const activeTab = tabManager.getActiveTab();
            if (!activeTab || !activeTab.containerId) {
              throw new Error('无法获取当前容器，请先打开一个标签页');
            }
            containerId = activeTab.containerId;
          }
          const text = getAiMemoryManagerLazy().readContainer(containerId);
          return {
            content: [{
              type: 'text',
              text: text || '该容器暂无记忆',
            }],
            details: { containerId, empty: !text },
          };
        },
      },

      // ==================== manage_skill 工具（Phase 49：技能集的 AI 写入路径） ====================
      this._buildManageSkillTool(),

      // ==================== SDK 内置文件/Bash 工具（agent 工作区沙箱） ====================
      ...this._buildFilesystemTools(),
    ];
  }

  /**
   * `manage_skill` 工具项（Phase 49 的 create / update / delete 三动作）
   *
   * **形状照 `memory` 工具**（`:5813`）：`action` enum + `executionMode: 'sequential'`
   * + 委托 manager + 中文 label/description + `details` 回传可操作信息。
   *
   * 三条硬约束（改本方法前必须复核）：
   * 1. `parameters.properties` 的顶层键集合**恰为** `{action, name, content, description}`
   *    —— **绝不出现 `path`**。路径由 `ai-skills-manager` 用 `path.join` 计算：沙箱在
   *    这里提供不了保护，接口设计才是边界（ARCHITECTURE Anti-Pattern 1）。
   * 2. 本方法内**不得**调用 `requestActionConfirmation` —— 三个动作一律自动（D-01：
   *    破坏面已被硬沙箱限定在 AI 专用数据区，且 AI 本就能用 `write` 直写同一路径，
   *    单独加确认会被轻易绕道，成为只在合作路径上生效的虚假安全感）。
   * 3. 成功后**恰一次** `await this.syncAgentSystemPrompt()` —— 该方法的函数体内**已含**
   *    `refreshSkills()` 重扫，**不得**再写第二行，那是三次全量重扫（D-13）。忙碌时它
   *    只置 `_skillsPromptDirty`，真正的 prompt 回写与 `skills:changed` 广播由
   *    `_flushDeferredSkillsPrompt()` 在本轮成功出口落地 ⇒ 「下一条消息起可用」。
   *
   * @returns {Object} manage_skill 工具定义
   * @private
   */
  _buildManageSkillTool() {
    return {
      name: 'manage_skill',
      label: '创建/更新/删除技能',
      description: '把一套可复用的流程或经验沉淀为技能，或修改、删除已创建的技能。'
        + 'action: create(新建技能)/update(全量覆写正文)/delete(删除技能)。'
        + 'name: 技能名，只能用小写字母、数字与连字符（例如 my-workflow）。'
        + 'description: 一句话说明这个技能做什么、什么时候用（模型靠它判断何时使用该技能），必填。'
        + 'content: 技能正文（Markdown），必填，只写正文、不要写 frontmatter（frontmatter 由本工具生成）。'
        + '仅在用户明确要求把某套流程或经验沉淀为技能时调用，不要主动推断用户想沉淀技能。'
        + '优先增强已有技能，而非创建近乎重复的新技能：同一主题请先 read 现有技能再用 update 补充。'
        + 'update 是整体覆写：要先 read 当前正文、改好后传入完整新正文；只改几行也可以直接用 edit 工具。'
        + '不支持改名（技能名就是目录名）：要改名请先 delete 再 create。'
        + '写入成功后，新技能从下一条消息起对模型可见。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update', 'delete'],
            description: '操作类型',
          },
          name: {
            type: 'string',
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
            description: '技能名（小写字母、数字、连字符；不能以连字符开头结尾，不能有连续连字符）',
          },
          content: {
            type: 'string',
            description: '技能正文（Markdown），只含正文不含 frontmatter；create / update 必填',
          },
          description: {
            type: 'string',
            description: '技能用途与适用时机的说明；create / update 必填，模型靠它判断何时使用该技能',
          },
        },
        required: ['action', 'name'],
      },
      executionMode: 'sequential',
      execute: async (toolCallId, params) => {
        const action = params && params.action;
        const rawName = params && params.name;
        const name = typeof rawName === 'string' ? rawName.trim() : '';
        const seededNames = this.getSeededSkillNamesSafe();
        const skillsManager = getAiSkillsManagerLazy();

        if (action !== 'create' && action !== 'update' && action !== 'delete') {
          // 九码是闭合白名单，不新增第十码：action 非法属参数不合法
          const err = new Error(
            `未知的 manage_skill action: ${action}（合法值：create / update / delete）`
          );
          err.code = 'invalid_name';
          throw err;
        }

        /**
         * 按 name 查**当前**技能集的档位（消费 `toUISkillEntry` 的既有输出）。
         *
         * **不**在工具层重新实现来源判定（Phase 47 D-11 的 `sourceTierOf` 是唯一判据）。
         * 目标不存在时（create 之前 / delete 之后 / 被拒）→ `undefined` ⇒ 标记省略该键
         * ⇒ 渲染端跳过徽标（宁缺勿猜）。
         */
        const tierOf = (targetName) => {
          if (!targetName) return undefined;
          const hit = skillsManager.getSkillsForUI(seededNames).skills
            .find((e) => e.name === targetName);
          return hit ? hit.tier : undefined;
        };

        // 业务失败**照常向外 throw**（49-01 的语义不变，LLM 照常收到 `isError: true`
        // 的 toolResult）；包一层只为把原因码 / 档位转存到**按 toolCallId 的短期元数据**。
        // **绝不能**改走 `result.details`：SDK 的 `createErrorToolResult(message)`
        // （`agent-loop.js:519-524`）产出的 `details` 恒为 `{}` —— 失败态的原因码经它
        // 传递等于永远丢给渲染端（RESEARCH Pitfall 3 / UI-SPEC 硬约束 2）。
        // 两条路径（成功 / 失败）的标记来源与形状因此**逐字一致**（单一读法）。
        try {
          // 参数只做解析与转发，判定与写入全在 ai-skills-manager（校验器只有一份实现，
          // Phase 50/51 可直接 require 同一份）。
          let result;
          if (action === 'create') {
            result = await skillsManager.createManagedSkill(this.sandboxEnv, {
              name,
              content: params.content,
              description: params.description,
              seededNames,
            });
          } else if (action === 'update') {
            result = await skillsManager.updateManagedSkill(this.sandboxEnv, {
              name,
              content: params.content,
              description: params.description,
              seededNames,
            });
          } else {
            result = await skillsManager.deleteManagedSkill(this.sandboxEnv, {
              name,
              seededNames,
            });
          }

          // 三动作共用同一句刷新链：该方法的函数体内已含 refreshSkills 重扫，
          // 忙碌时只置脏标记，回写与广播由本轮成功出口的补刷落地（D-13）。
          await this.syncAgentSystemPrompt();

          // 终态元数据**写在重扫之后**：`syncAgentSystemPrompt()` 的首行就是技能目录重扫，
          // 故此刻缓存必定已含本次改动 —— create 的新技能因此能查到 `managed` 档位
          // （写在重扫之前会因缓存陈旧而省略 tier，徽标会永远不出现）。
          //
          // `getSkillPromptIncluded` 自 49-04 起是**三态**：命中可用 `true` / 命中但被滤
          // （超预算 · 禁用 · 被遮蔽）`false` / **未命中（该 name 不在当前技能集快照里）
          // `undefined`**。消费侧必须按三态收口：只有 **boolean** 才写进短期元数据与
          // `details`（`undefined` 一律**不写该键** —— 写 `undefined` 值只会依赖 JSON
          // 序列化把它丢掉这种隐式行为，不得依赖）。把「技能不存在」与「预算已满」合并回
          // 一个值，等于把 49-04 的修复作废（VERIFICATION Gap 1 的失实文案根因）。
          const promptIncludedRaw = action === 'delete'
            ? undefined
            : skillsManager.getSkillPromptIncluded(result.name, seededNames);
          const promptIncluded = typeof promptIncludedRaw === 'boolean' ? promptIncludedRaw : undefined;
          const meta = {
            action,
            name: result.name,
            tier: tierOf(result.name),
          };
          if (typeof promptIncluded === 'boolean') meta.promptIncluded = promptIncluded;
          this._manageSkillMeta.set(toolCallId, meta);

          const details = {
            action: result.action,
            name: result.name,
            filePath: result.filePath,
          };
          // description / promptIncluded 只对会落盘正文的两个动作有意义
          if (action !== 'delete') {
            details.description = result.description;
            if (typeof promptIncluded === 'boolean') details.promptIncluded = promptIncluded;
          }

          const actionText = action === 'create' ? '创建' : action === 'update' ? '更新' : '删除';
          const whenText = action === 'delete'
            ? '它从下一条消息起不再可用。'
            : '它从下一条消息起对模型可见。';
          let text = `已${actionText}技能「${result.name}」。${whenText}`;
          // **严格等于 `false`** 才追加：`undefined` 表示「该技能不在当前技能集里」，此时
          // **不能**断言「预算已满」（预算可能远未满），也**不能**声称「仍可用 /skill:{name}
          // 手动调用」（该调用同样解析不到）。两句都失实，故一律不加。
          if (promptIncluded === false) {
            // 不说明会被读成「AI 建的技能没用」（48 D-12：超预算技能仍可显式调用）
            text += `该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:${result.name} 手动调用。`;
          }

          return { content: [{ type: 'text', text }], details };
        } catch (err) {
          // 失败出口（顺序不可调换）：
          // ① **先**给错误消息加 `[code] ` 词缀（WR-02）。失败态的原因码没有别的持久化通道
          //    —— `result.details` 在 throw 路径上恒为 `{}`，而这条消息本身会落进 `tool_results`
          //    的文本列，重载链路因此能用**同一个常量** `MANAGE_SKILL_CODE_TAG` 解析还原它。
          //    幂等判定必须用同一个常量做起始匹配（不得另写一份字面量正则，也不得用
          //    `startsWith('[')` 这类近似判据 —— 近似判据会把「已经带词缀」判成「没带」
          //    而加出 `[a] [b] msg`）。保持同一个 Error 实例：`code` 与栈不变。
          //    仅当 `err` 是 Error、`code` 是非空字符串时才加 —— 不得把「意外错误」标成某个码。
          // ② **再**照原样写元数据（字段与取值一字不动）。
          // ③ **最后**照原样 `throw err`。
          // 这个顺序是有约束的：既有的 M2 源码门禁要求 `_manageSkillMeta.set(...)` 与随后的
          // `throw err;` 相邻（它断言的是「失败出口仍然 throw」这条 LLM 语义）。把加词缀放在
          // 元数据写入**之前**，那条护栏即可逐字不变。
          if (err instanceof Error && typeof err.code === 'string' && err.code
            && !MANAGE_SKILL_CODE_TAG.test(err.message)) {
            err.message = `[${err.code}] ${err.message}`;
          }
          // 失败出口：把业务错误对象上的 `code`（九码之一）与目标档位转存为本次工具执行的
          // 元数据；**仍然原样 throw**（不 catch 成返回值，LLM 语义零变化）。
          this._manageSkillMeta.set(toolCallId, {
            action,
            name,
            tier: tierOf(name),
            code: err && err.code ? err.code : undefined,
          });
          throw err;
        }
      },
    };
  }

  /**
   * 将 SDK AgentHarnessTool 适配为 Realm 低层 Agent 工具
   *
   * 唯一差异：AgentHarnessTool.execute 第 5 参为 { env: ExecutionEnv }，
   * 低层 Agent loop 只传 4 参——包装 execute 注入沙箱 env。同时：
   * - 覆盖 label/description 为中文（与 Realm 工具风格一致；name 保留 SDK
   *   原值 read/write/edit/bash，LLM 训练先验对这些名字最熟）
   * - 强制 executionMode: 'sequential'（memory 工具同款先例）：SDK 的
   *   file-mutation-queue 只串行化 write/edit 之间的文件写，不约束 bash，
   *   全串行消除「bash 改文件同时 edit 改同一文件」的竞态
   *
   * @param {Object} harnessTool - SDK createXxxTool() 产出的工具
   * @param {{label: string, description: string}} overrides - 中文 label/描述覆盖
   * @returns {Object} 适配后的 Realm 工具
   * @private
   */
  _adaptHarnessTool(harnessTool, overrides) {
    return {
      ...harnessTool,
      ...overrides,
      executionMode: 'sequential',
      execute: (toolCallId, params, signal, onUpdate) =>
        harnessTool.execute(toolCallId, params, signal, onUpdate, { env: this.sandboxEnv }),
    };
  }

  /**
   * 构建 SDK 内置文件/Bash 工具组（read/write/edit/bash）
   *
   * read/write/edit 在硬沙箱内自动执行（路径校验由 SandboxExecutionEnv 强制，
   * 破坏面已被限定在 AI 专用工作区内，不加确认）。bash 经三档权限执行流
   * （_createBashToolWithPolicy）。
   *
   * @returns {Array} 工具定义数组
   * @private
   */
  _buildFilesystemTools() {
    if (!this._sdkFileTools || !this.sandboxEnv) {
      console.warn('[Realm AI] SDK 文件工具工厂未初始化，跳过注册 read/write/edit/bash');
      return [];
    }
    const { createReadTool, createWriteTool, createEditTool } = this._sdkFileTools;
    const workspaceDir = getAgentWorkspaceLazy().getWorkspaceDir();
    return [
      this._adaptHarnessTool(createReadTool(), {
        label: '读取文件',
        description: `读取 AI 工作区（${workspaceDir}）内的文件内容。支持文本按行分段读取（offset 从 1 开始 / limit 限制行数）与图片读取。只能访问工作区内的路径，越界会被拒绝`,
      }),
      this._adaptHarnessTool(createWriteTool(), {
        label: '写入文件',
        description: `将完整内容写入 AI 工作区（${workspaceDir}）内的文件（覆盖语义，父目录自动创建）。只能访问工作区内的路径，越界会被拒绝`,
      }),
      this._adaptHarnessTool(createEditTool(), {
        label: '编辑文件',
        description: `精确编辑 AI 工作区（${workspaceDir}）内的文件：edits 数组中每个 oldText 必须在原文件中唯一且互不重叠，替换为 newText。无需先 read，但 oldText 不唯一会失败。只能访问工作区内的路径`,
      }),
      this._createBashToolWithPolicy(),
    ];
  }

  /**
   * 构建带三档权限执行流的 bash 工具
   *
   * 执行流：实时读 settings.aiBashWhitelist（不缓存，设置页即改即存后
   * 下一条命令即生效）→ evaluateBashCommand 三档裁决：
   * - allow   ：直接执行
   * - confirm ：弹确认卡片（危险命令 riskLevel=high，普通命令 medium）；
   *   白名单对危险段无效（rm/sudo 等进白名单也弹确认）
   * 未确认不 throw，返回 cancelled 正常结果（与现有确认链路约定一致）。
   * 执行终态经 notifyActionSettled 推送确认卡片状态机。
   *
   * @returns {Object} 适配后的 bash 工具
   * @private
   */
  _createBashToolWithPolicy() {
    const workspaceDir = getAgentWorkspaceLazy().getWorkspaceDir();
    const inner = this._adaptHarnessTool(this._sdkFileTools.createBashTool(), {
      label: '执行 Bash 命令',
      description: `在 AI 工作区（${workspaceDir}）内执行 bash 命令，工作目录固定为工作区根目录。`
        + '输出超过 2000 行或 50KB 会截断（全量输出存临时文件）。'
        + '命中白名单的命令自动执行；其余命令需用户在确认卡片上确认；'
        + '危险命令（rm/sudo/kill 等）与包管理器安装命令（npx/npm i/pip install/brew install 等）即使加入白名单也必须确认。'
        + '命令失败（非零退出码、超时）会直接报错，可用较短超时试探性执行',
    });

    return {
      ...inner,
      execute: async (toolCallId, params, signal, onUpdate) => {
        const whitelist = this.configStore
          ? this.configStore.get('settings.aiBashWhitelist', [])
          : [];
        const verdict = bashPolicy.evaluateBashCommand(params && params.command, whitelist);

        let confirmedActionId = null;
        if (verdict.level === 'confirm') {
          const isDanger = verdict.reason === 'danger';
          const isInstall = verdict.reason === 'install';
          const actionId = `bash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const dangerHint = isDanger
            ? `检测到高危操作（${verdict.dangerNames.join('、')}），白名单对本命令无效`
            : isInstall
              ? `检测到包管理器安装（${verdict.installNames.join('、')}）：`
                + '将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认'
              : '该命令未命中白名单';
          const confirmation = await requestActionConfirmation({
            actionId,
            type: 'execute_script',
            title: isDanger
              ? 'AI 请求执行高危 Bash 命令'
              : isInstall
                ? 'AI 请求安装第三方软件包'
                : 'AI 请求执行 Bash 命令',
            description: `${dangerHint}\n\n$ ${params.command}`,
            riskLevel: (isDanger || isInstall) ? 'high' : 'medium',
            timeoutMs: 120000, // bash 命令需要用户读完再决策，30s 默认值容易误取消
          });
          if (!confirmation.confirmed) {
            return {
              content: [{
                type: 'text',
                text: '已取消：用户未确认执行该命令。不要反复重试同一命令，可调整命令或请用户在设置中将可靠命令前缀加入白名单。',
              }],
              details: { cancelled: true, command: params.command, verdict },
            };
          }
          confirmedActionId = actionId;
        }

        try {
          const result = await inner.execute(toolCallId, params, signal, onUpdate);
          if (confirmedActionId) {
            notifyActionSettled(confirmedActionId, 'success', 'Bash 命令执行完成');
          }
          return result;
        } catch (err) {
          // bash 工具对非零退出码/超时/中止 throw（SDK 编码为 isError toolResult）
          if (confirmedActionId) {
            notifyActionSettled(confirmedActionId, 'error', err.message || 'Bash 命令执行失败');
          }
          throw err;
        }
      },
    };
  }

  /**
   * CAPTCHA 预检（per D-14/D-15）
   *
   * 在 fill_form/execute_action 执行前调用 detectCaptcha 进行预检。
   * 检测到 CAPTCHA 时返回特殊结果，暂停当前任务。
   *
   * @param {number} webContentsId - webContents ID
   * @param {string} tabUrl - 当前标签页 URL（用于错误信息）
   * @returns {Promise<{captchaDetected: boolean, captchaType?: string|null, confidence?: string, message?: string}>}
   * @private
   */
  async _preCheckCaptcha(webContentsId, tabUrl) {
    try {
      const result = await cdpManager.detectCaptcha(webContentsId);
      if (result.detected && (result.confidence === 'high' || result.confidence === 'medium')) {
        const typeLabel = {
          'recaptcha': 'reCAPTCHA',
          'hcaptcha': 'hCaptcha',
          'turnstile': 'Turnstile',
          '2fa': '双重认证',
          'keyword-detected': '安全验证',
        }[result.type] || result.type || '验证码';

        return {
          captchaDetected: true,
          captchaType: result.type,
          confidence: result.confidence,
          message: `检测到${typeLabel}验证，请在页面中完成验证后重试。`,
        };
      }
      return { captchaDetected: false };
    } catch (err) {
      // 预检失败不阻塞操作，仅记录日志
      console.warn('[Realm AI] CAPTCHA 预检异常:', err.message);
      return { captchaDetected: false };
    }
  }

  /**
   * 等待 CAPTCHA 验证完成（per D-14/D-15）
   *
   * 轮询 detectCaptcha 检测 CAPTCHA 是否已消失。
   * 每 3 秒检测一次，最多等待 120 秒。
   *
   * @param {number} webContentsId - webContents ID
   * @returns {Promise<{captchaCleared: boolean, message?: string}>}
   */
  async wait_for_captcha_completion(webContentsId) {
    const POLL_INTERVAL = 3000; // 3 秒
    const MAX_WAIT = 120000; // 120 秒
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

      try {
        const result = await cdpManager.detectCaptcha(webContentsId);
        if (!result.detected) {
          console.log('[Realm AI] CAPTCHA 已消失，任务可恢复');
          return { captchaCleared: true };
        }
      } catch (err) {
        console.warn('[Realm AI] CAPTCHA 轮询检测异常:', err.message);
      }
    }

    return {
      captchaCleared: false,
      message: '验证码等待超时，请手动完成后重试',
    };
  }

  /**
   * 上下文裁剪：保留最近 N 条消息
   *
   * 当对话历史过长时，截断旧消息以控制 token 消耗。
   * 保留最近 MAX_CONTEXT_MESSAGES 条消息。
   *
   * @param {Array} messages - 完整消息历史
   * @returns {Promise<Array>} 裁剪后的消息数组
   * @private
   */
  async _compactContext(messages) {
    if (!Array.isArray(messages)) return [];
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  }
}

// ==================== 技能调用（48-01）—— 模块级纯函数 ====================

/**
 * 解析显式技能调用（D-19 的权威解析）
 *
 * 与 `src/skill-picker-model.js` 共用**同一份** token 取值与边界实现（本函数直接委派），
 * 因此 renderer 与 main 不可能漂移。main 侧不判本地命令（本地命令优先由 renderer 侧保证）。
 *
 * @param {string} text - renderer 发来的完整语法文本（`/skill:name args` 或 `/name args`）
 * @returns {{name: string, args: string, syntax: 'skill-colon'|'bare'} | null}
 */
function parseSkillInvocationText(text) {
  return skillPickerModel.parseSkillInvocationText(text);
}

/** 显式技能调用的 provenance 行（D-05 的唯一模板，重载还原时按同一模板锚定） */
function skillProvenanceLine(name) {
  return '用户显式调用了技能「' + name + '」';
}

/**
 * 由 `readSkillForInvocation` 的失败 reason 映射为结构化错误（DISC-06 / D-13 推论）
 *
 * **错误码与文案的唯一来源** —— `_resolveSkillInvocation` 只调它、不在方法体内硬写文案，
 * 因此「两个码 + 两条文案」可被测试直接打表。
 *
 * 返回值域**只有两个码**：`readSkillForInvocation` 的失败码域就是
 * `not_found | disabled`（SDK `loadSkills` 读盘失败只产诊断 + 空技能集、不抛错），
 * D-13 推论也要求「被整条跳过的技能」与「不存在」同形 —— **不得**声明第三个码。
 *
 * @param {'not_found'|'disabled'} reason - 读盘失败原因
 * @param {string} name - 技能名
 * @returns {{code: 'skill_not_found'|'skill_disabled', message: string}}
 */
function skillErrorFromReason(reason, name) {
  if (reason === 'disabled') {
    return {
      code: 'skill_disabled',
      message: '技能「' + name + '」已被禁用，可在 设置 → AI → 技能管理 重新启用',
    };
  }
  return {
    code: 'skill_not_found',
    message: '未找到技能「' + name + '」，输入 / 查看可用技能',
  };
}

/**
 * 组装技能调用块（D-05）：SDK `<skill>` 块 + provenance 行 + args 原文
 *
 * 一次 `formatSkillInvocation` 调用完成，段间分隔符由 SDK 决定（不自行拼模板 ——
 * 自拼等于复制 SDK 的转义与缩进，SDK 升级即漂移）。
 *
 * `formatSkillInvocation` 由调用处以参数注入（SDK 为 ESM-only，本模块不得顶层 import）。
 *
 * @param {{skill: object, name: string}} resolved - `{skill, name}`
 * @param {string} args - args 原文（可为空串）
 * @param {(skill: object, additionalInstructions?: string) => string} formatSkillInvocation
 *   SDK 的 `formatSkillInvocation`（调用处动态 import 后注入）
 * @returns {string} `<skill …>…</skill>\n\n<provenance>\n\n<args>`
 */
function buildSkillInvocationBlock({ skill, name }, args, formatSkillInvocation) {
  if (typeof formatSkillInvocation !== 'function') {
    throw new TypeError('buildSkillInvocationBlock 需要注入 formatSkillInvocation');
  }
  const provenance = skillProvenanceLine(name);
  const instructions = [provenance, args].filter(Boolean).join('\n\n');
  return formatSkillInvocation(skill, instructions);
}

/**
 * 在 `R` 的某个位置尝试取「技能语法 token」（`/skill:{name}` 或 `/{name}`）
 *
 * 边界规则与 `extractArgs` 的 token 取值**同源**：token 之后必须紧接空白或串尾 ——
 * `/alphax` 不得命中 `alpha`。
 *
 * @param {string} rest - 以候选位置为起点的剩余串
 * @param {string} name - 技能名
 * @returns {string|null} 命中的 token（含前导 `/`）或 null
 */
function skillTokenAt(rest, name) {
  const candidates = ['/' + skillPickerModel.SKILL_PREFIX + name, '/' + name];
  for (const token of candidates) {
    if (!rest.startsWith(token)) continue;
    const next = rest.charAt(token.length);
    if (next === '' || /\s/.test(next)) return token;
  }
  return null;
}

/**
 * 从**入库的增强消息**还原用户气泡的 args 正文 —— **唯一规则**（D-06 / D-19）
 *
 * **为什么需要它**：入库的是 main 的 `agent.state.messages`（完整增强消息），而 D-06 要求
 * 气泡正文 = **args 原文**（不含 `/skill:name` 前缀、不含 provenance 行、不含技能正文，
 * 也不含附件 marker / `<referenced-tab>` 引用 XML / `用户消息：` 收尾标记）。
 *
 * **术语**：`P` = provenance 行文本；`R` = `P` 之后的剩余内容（并剥掉紧邻的一个 `\n\n`，
 * 即增强段分隔符本身）。两条路径下 `R` 的语义：
 * - `prompt()` 路径：增强消息到 provenance 行之后即 args 原文 → `R` 恰为 args（无 args 时为空串）
 * - `promptWithContext()` 路径：`R` = `args + '\n\n' + 尾段区`，或 args 为空时的 `尾段区`
 *   （**args 为空不是「没有 R」**，而是「R 从尾段区第一段开始」）
 *
 * **锚点依据**：`contextBlock` 恒为增强消息**末段**，且 `_buildMessageWithContext`
 * 恒以 `message`（用户原文 = 完整语法文本）收尾 —— 无 `@` 引用时 `contextBlock === message`，
 * 有引用时为 `…</referenced-tab>\n\n用户消息：${message}`。因此 args 恒可从**末段的语法文本**
 * 经 `extractArgs` 精确取得。锚点必须挂在 provenance 行上，才能天然排除技能块体中的同名文本。
 *
 * **两趟扫描顺序不可颠倒**：第一趟只接受「非空 args 且通过前缀式」的候选；扫到 `R` 起点
 * 都没有这样的候选时，第二趟才接受「空 args 且 `after.trim() === ''`」的候选。理由：
 * 语法文本可能出现在 args 内部（args 含空行、且其中再出现一次带空行前缀的
 * `/skill:{name}`，如 `/skill:alpha 第一段\n\n/skill:alpha`），串尾那个**假**候选的 `a`
 * 恰好为空；若不分两趟、按「第一个通过的候选」取值，假候选会先命中并给出错误的 `''`。
 * 两趟顺序保证「真 args 非空」时永远以真 args 为准。
 *
 * **回落**（两趟均无候选）分两种情形：`R` 内**一次候选都没出现过** → `args = R`
 * （`prompt()` 路径：无 args 时 `R === ''`，有 args 时 `R` 恰为 args 原文）；
 * **出现过候选但都没锚中** → `args = ''`（保守降级：宁可少显示 args，也绝不把附件 marker /
 * `<referenced-tab>` / `用户消息：` 当正文显示）。
 *
 * **已知且不可避免的歧义**（不另加分支）：`/skill:{name} /skill:{name}`（args 字面等于裸语法
 * token 且无附件无引用）与「args 为空的 `promptWithContext()` 形态」产生**逐字符相同**的增强串，
 * 任何规则都无法区分；本规则按后者解释为 `''`。这是 D-19（发完整语法文本、由主进程重解析）
 * 带来的固有歧义，只影响该病态输入的 args 显示，不影响消息内容与注入。
 *
 * @param {string} enhancedContent - 入库的 user 行 `content`（完整增强消息）
 * @param {string} name - 技能名
 * @returns {string|null} args 原文（可为空串）；不是该技能的调用消息时返回 null
 */
function resolveSkillBubbleArgs(enhancedContent, name) {
  if (typeof enhancedContent !== 'string' || typeof name !== 'string' || !name) return null;
  const provenance = skillProvenanceLine(name);
  const p = enhancedContent.indexOf(provenance);
  if (p < 0) return null;
  let R = enhancedContent.slice(p + provenance.length);
  if (R.startsWith('\n\n')) R = R.slice(2);

  const USER_MARKER = '用户消息：';
  let sawCandidate = false;
  let nonEmpty = null;
  let empty = null;

  for (let j = R.length; j >= 0; j -= 1) {
    const rest = R.slice(j);
    const token = skillTokenAt(rest, name);
    if (!token) continue;
    // 尾段边界：R 起点（紧跟 provenance 行）/ 增强段分隔符之后 / `用户消息：` 之后
    const atStart = j === 0;
    const afterSeparator = j >= 2 && R.slice(j - 2, j) === '\n\n';
    const afterUserMarker =
      j >= USER_MARKER.length && R.slice(j - USER_MARKER.length, j) === USER_MARKER;
    if (!atStart && !afterSeparator && !afterUserMarker) continue;
    sawCandidate = true;

    const a = skillPickerModel.extractArgs(rest);
    const after = rest.slice(token.length);
    if (nonEmpty === null && a !== '' && (R === a || R.startsWith(a + '\n\n'))) {
      nonEmpty = a;
      break; // 第一趟命中即终局（两趟顺序的第一优先级）
    }
    if (empty === null && a === '' && after.trim() === '') empty = '';
  }

  if (nonEmpty !== null) return nonEmpty;
  if (empty !== null) return empty;
  return sawCandidate ? '' : R;
}

/**
 * 解析**入库的**技能调用 user 行（重载路径，48 D-09）
 *
 * 与 live 路径产出的 `skillInvocation` 形状**逐字一致**（`{name, tier?, content}`）——
 * 两条路径同一形状是「重开对话气泡与实时一致」的可失败判据。
 *
 * 块体边界用**固定模板锚定**（`<skill …>` 行 + `References are relative to ….` 行 + 空行
 * + 正文 + **最后一个** `\n</skill>`），不做「最后一个空行」之类的位置猜测。
 *
 * @param {string} content - 入库的 user 行 `content`
 * @param {(location: string) => (string|null|undefined)} [resolveTier]
 *   由 `matchSkillByPath` 求 tier 的注入闭包；返回假值时**省略 `tier` 键**（气泡照常渲染）
 * @returns {{content: string, skillInvocation: {name: string, tier?: string, content: string}}|null}
 */
function parseStoredSkillInvocation(content, resolveTier) {
  if (typeof content !== 'string') return null;
  const head = content.match(/^<skill name="([^"]+)" location="([^"]+)">\n/);
  if (!head) return null;
  const name = head[1];
  const location = head[2];

  const afterHead = content.slice(head[0].length);
  const refLine = afterHead.match(/^References are relative to .*\n\n/);
  if (!refLine) return null;

  const bodyAndRest = afterHead.slice(refLine[0].length);
  const closeMark = '\n</skill>';
  const closeIdx = bodyAndRest.lastIndexOf(closeMark);
  if (closeIdx < 0) return null;

  const body = bodyAndRest.slice(0, closeIdx);
  const after = bodyAndRest.slice(closeIdx + closeMark.length);
  // 块体之后必须只剩 provenance 行与 args（其余 → 不是技能调用消息，原样透传）
  if (after !== '' && !after.startsWith('\n\n' + skillProvenanceLine(name))) return null;

  const args = resolveSkillBubbleArgs(content, name);
  if (args === null) return null;

  const skillInvocation = { name, content: body };
  const tier = typeof resolveTier === 'function' ? resolveTier(location) : null;
  if (tier) skillInvocation.tier = tier;
  return { content: args, skillInvocation };
}

module.exports = AIManager;
module.exports.executeScript = executeScript;
module.exports.sanitizeInput = sanitizeInput;
module.exports.validateScriptForSteps = validateScriptForSteps;
module.exports.buildSystemPrompt = buildSystemPrompt;
// 48-01：技能调用的模块级纯函数（供测试直接打表；parseStoredSkillInvocation /
// resolveSkillBubbleArgs 是重载还原的唯一规则，skillErrorFromReason 是错误码与文案的唯一来源）
module.exports.parseSkillInvocationText = parseSkillInvocationText;
module.exports.buildSkillInvocationBlock = buildSkillInvocationBlock;
module.exports.skillErrorFromReason = skillErrorFromReason;
module.exports.parseStoredSkillInvocation = parseStoredSkillInvocation;
module.exports.resolveSkillBubbleArgs = resolveSkillBubbleArgs;
