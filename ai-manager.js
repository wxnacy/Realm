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
const { webContents } = require('electron');
const tabManager = require('./tab-manager');
const historyManager = require('./history-manager');
const favoritesManager = require('./favorites-manager');
const windowManager = require('./window-manager');
const cdpManager = require('./cdp-manager');

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

你的能力：
- get_tabs: 获取当前所有标签页列表
- search_history: 搜索浏览历史记录
- manage_favorites: 管理收藏夹（添加、查看、删除）
- search_favorites_fulltext: 使用全文检索搜索收藏夹中的页面，支持中文分词。当用户说"搜索收藏 XXX"或"找收藏 XXX"时使用此工具。
- switch_container: 切换当前容器
- read_page_content: 读取当前标签页的页面内容，包括标题、正文、元信息和 Open Graph 数据。用于理解用户正在浏览的网页。
- extract_links: 提取当前页面的所有有效链接，自动过滤非 HTTP 协议和锚点链接。用于收集页面中的所有可导航链接。
- open_link: 在指定容器中打开一个链接，支持在当前标签页或新标签页中打开。默认使用当前活跃容器和新标签页。
- fill_form: 自动填写网页表单。参数格式为 fields 数组，每个元素包含 field（字段名称）和 value（填写值）。低风险操作自动执行，文件上传需要用户确认。执行前会自动检测 CAPTCHA/2FA 验证码，检测到时暂停并提示用户手动完成验证。
- execute_action: 在当前页面执行操作（点击、滚动、提交等）。参数格式为 action + target + options。低风险操作自动执行，表单提交、文件上传、脚本执行、支付操作需要用户确认。执行前会自动检测 CAPTCHA/2FA 验证码，检测到时暂停并提示用户手动完成验证。
- generate_script: 根据自然语言描述生成可执行的自动化脚本。脚本由步骤序列组成，每个步骤复用 execute_action 的操作能力（click/type/scroll/wait 等）。生成的脚本会经过安全验证，包含危险操作的脚本会被拦截。
- suggest_tab_groups: 分析当前标签页并生成智能分组建议。支持按域名、语义或混合策略分组。当用户说"整理标签页"、"帮我分组标签页"、"归类标签页"时使用此工具。
- apply_tab_groups: 提交结构化的标签分组结果。完成语义分组后必须调用此工具提交分组，分组会以卡片形式展示给用户确认，用户点击「应用分组」后标签页才会实际重排。

使用指南：
- 当用户询问"当前页面是什么"、"读取页面内容"等，使用 read_page_content
- 当用户询问"页面有哪些链接"、"提取链接"等，使用 extract_links
- 当用户要求打开链接或网址时，一律使用 open_link：默认新标签页打开（newTab 省略或为 true）；用户明确要求"在当前标签页打开"时设 newTab 为 false；containerId 省略时使用当前活跃容器
- 当用户要求搜索收藏时，使用 search_favorites_fulltext 进行全文检索
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
- execute_action 支持的操作类型：click、scroll、type、select、check、uncheck、focus、blur、submit、upload、drag、hover、keydown、keyup、execute_script、screenshot、wait_for_element（其中 screenshot、execute_script 无需 target）
- 当用户描述一个自动化任务（如"每天早上打开新闻网站"、"帮我自动填写这个表单"、"生成一个脚本做 XXX"）时，使用 generate_script
- generate_script 的步骤格式为 {action, target, options, waitFor}，action 仅支持 navigate/click/type/scroll/wait/select/check/uncheck/focus/blur/submit/keydown/keyup
- generate_script 返回的脚本会在聊天中渲染为预览卡片，用户可以编辑每个步骤后再执行
- 当用户要求整理标签页、分组标签页时，使用 suggest_tab_groups 分析标签页。默认使用 semantic 策略；用户要求按域名分组时使用 domain 策略。若返回的是待分组标签数据而非分组结果（semantic/mixed 策略），完成分组后必须调用 apply_tab_groups 提交结构化分组（groups 数组，每组 { name, tabs: [{ id }] }，id 取自返回的 tabs 数据），分组卡片会展示给用户确认
- 你不需要也不能直接移动标签页——实际重排由用户在分组卡片上点击「应用分组」后执行，你的职责是完成分组并调用 apply_tab_groups 提交，不要认为或声称自己没有整理标签页的权限

请用简洁、专业的语气回答用户问题。当需要执行操作时，使用提供的工具函数。`;

/** 上下文裁剪：保留最近的消息数量 */
const MAX_CONTEXT_MESSAGES = 20;

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
  // 页面未加载（新建 tab url 为空 / realm:// 内部页）：按 22-UI-SPEC 文案报错
  if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
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
    const configuredIds = Object.keys(providersCfg).filter(
      id => providersCfg[id] && providersCfg[id].apiKey
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

      // 创建凭证存储并注入所有已配置提供商的 API Key
      // CredentialStore 是 pi-ai 的标准认证机制：每个 provider 一个凭证条目
      const credentialStore = new InMemoryCredentialStore();
      for (const providerId of configuredIds) {
        await credentialStore.modify(providerId, async () => ({
          type: 'api_key',
          key: providersCfg[providerId].apiKey,
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
          systemPrompt: REALM_SYSTEM_PROMPT,
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

      this.isInitialized = true;
      this.activeProvider = activeProvider;
      this.activeModelId = model.id;

      // 设置事件广播（per D-05~D-08）
      this._setupEventBroadcasting();

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
   * @param {string} message - 用户输入的消息
   * @returns {Promise<void>}
   */
  async prompt(message) {
    if (!this.isInitialized || !this.agent) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      // 广播错误事件：否则渲染进程流式占位符会永久卡住，且 aiStreaming 锁死后续发送
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
        timestamp: Date.now(),
      }]);
      return;
    }

    // 防止并发调用
    if (this.isProcessing) {
      console.warn('[Realm AI] 正在处理中，请等待完成');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 正在处理上一条消息，请稍候再试',
        timestamp: Date.now(),
      }]);
      return;
    }

    this.isProcessing = true;
    console.log(`[Realm AI] 发送消息: ${message}`);

    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // 指数退避：1s, 2s, 4s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.agent.prompt(message);
        await this.agent.waitForIdle();
        this.isProcessing = false;
        return;
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
          return;
        }

        console.warn(`[Realm AI] 第 ${attempt + 1} 次尝试失败，${retryDelays[attempt]}ms 后重试:`, err.message);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }

  /**
   * 发送带上下文引用的用户消息给 AI Agent
   *
   * 将引用的标签页内容注入到用户消息中，让 AI 能够理解引用页面的内容。
   * 内容以 XML 格式的 <referenced-tab> 块注入到消息前缀。
   *
   * @param {string} message - 用户输入的消息
   * @param {Array} referencedTabs - 引用的标签页列表，每项包含 {tabId, title, url, content}
   * @returns {Promise<void>}
   */
  async promptWithContext(message, referencedTabs) {
    if (!this.isInitialized || !this.agent) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 助手未初始化，请先在「设置 → AI 助手」中配置提供商和 API Key',
        timestamp: Date.now(),
      }]);
      return;
    }

    // 防止并发调用
    if (this.isProcessing) {
      console.warn('[Realm AI] 正在处理中，请等待完成');
      this._sendEventsBatch([{
        type: 'error',
        message: 'AI 正在处理上一条消息，请稍候再试',
        timestamp: Date.now(),
      }]);
      return;
    }

    this.isProcessing = true;
    console.log(`[Realm AI] 发送带上下文消息: ${message}，引用 ${referencedTabs.length} 个标签页`);

    try {
      // 构建增强消息
      const enhancedMessage = this._buildMessageWithContext(message, referencedTabs);

      // 调用 agent.prompt
      await this.agent.prompt(enhancedMessage);
      await this.agent.waitForIdle();
      this.isProcessing = false;
    } catch (err) {
      console.error('[Realm AI] 带上下文消息处理失败:', err.message);
      this.isProcessing = false;

      // 广播错误事件到渲染进程
      this._sendEventsBatch([{
        type: 'error',
        message: err.message,
        timestamp: Date.now(),
      }]);
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
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '\'');
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

    const sendNow = (uiEvent) => {
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

    // __keep__ 哨兵值：用户未输入新 Key。
    // 优先级：环境变量 > 已保存的 Key——设置页提示「环境变量已自动使用」，
    // 若此时保留旧的已保存 Key（可能已失效），保存后 Agent 仍用旧 Key 导致 401。
    if (apiKey === '__keep__') {
      const envResult = this.detectEnvVar(provider, envVarName);
      if (envResult && envResult.found) {
        apiKey = envResult.value;
        console.log(`[Realm AI] 从环境变量 ${envResult.name} 检测到 API Key（覆盖已保存）`);
      } else {
        const existing = this.configStore ? this.configStore.get(`ai.providers.${provider}`) : null;
        if (existing && existing.apiKey) {
          apiKey = existing.apiKey;
        } else {
          throw new Error('未找到已保存的 API Key，请手动输入');
        }
      }
    }

    if (!apiKey) {
      // 如果没有 apiKey，尝试从环境变量检测
      if (this.configStore && provider) {
        const envResult = this.detectEnvVar(provider, envVarName);
        if (envResult && envResult.found) {
          apiKey = envResult.value;
          console.log(`[Realm AI] 从环境变量 ${envResult.name} 检测到 API Key`);
        }
      }
    }

    // 自定义供应商允许首次创建时无 apiKey（用户稍后填写）
    if (!apiKey && isBuiltin === false) {
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

    if (!apiKey) {
      throw new Error('API Key 不能为空，请在输入框填写或设置环境变量');
    }

    // 校验提供商存在（内置供应商），自定义供应商跳过校验
    // 可选模型集合优先使用 customModels（用户检测/删减后的列表），
    // 请求未携带时回退已保存的 existing.customModels（如下拉切换模型只传 model），
    // 否则回退 catalog 默认列表——检测到的新模型可能不在 catalog 中
    const existingProviders = this.configStore ? this.configStore.get('ai.providers', {}) : {};
    const existingCfg = existingProviders[provider] || {};
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
      const apiKey = saved && saved.apiKey ? saved.apiKey : '';
      const customModels = saved && saved.customModels ? saved.customModels : [];
      // customModels 非空时视为用户确认过的列表（检测/删减后的结果），
      // 优先于 catalog 默认列表回显；名称尽量从 catalog 补全
      const catalogModels = p.getModels();
      const models = customModels.length > 0
        ? customModels.map(id => {
            const cm = catalogModels.find(m => m.id === id);
            return { id, name: cm ? cm.name : id };
          })
        : catalogModels.map(m => ({ id: m.id, name: m.name }));
      return {
        id: p.id,
        name: saved && saved.displayName ? saved.displayName : p.name,
        configured: Boolean(apiKey),
        keyPreview: apiKey ? `…${apiKey.slice(-4)}` : null,
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
        const apiKey = saved.apiKey || '';
        providers.push({
          id,
          name: saved.displayName || id,
          configured: Boolean(apiKey),
          keyPreview: apiKey ? `…${apiKey.slice(-4)}` : null,
          activeModel: saved.model || null,
          models: saved.customModels ? saved.customModels.map(m => ({ id: m, name: m })) : [],
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
   * 重置 Agent 的对话状态：清空消息 transcript、流式状态和排队消息，
   * 保留 systemPrompt/模型/工具配置。用户在聊天面板点击「新对话」时调用。
   */
  newConversation() {
    if (this.agent) {
      this.agent.reset();
      console.log('[Realm AI] 对话状态已重置（新对话）');
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

    console.log(`[Realm AI] 供应商已删除: ${providerId}`);

    // 重新初始化（如有其他已配置供应商）
    const remainingIds = Object.keys(providers).filter(id => providers[id] && providers[id].apiKey);
    if (remainingIds.length > 0) {
      await this.init(this.configStore);
    } else {
      this.isInitialized = false;
      this.agent = null;
      this.models = null;
    }
  }

  /**
   * 获取 AI Manager 当前状态
   *
   * 返回初始化状态、当前模型和工具数量等信息。
   * 用于 UI 显示 AI 助手的连接状态。
   *
   * @returns {{initialized: boolean, model: string|null, toolsCount: number, activeProvider: string|null}} 状态信息
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
    };
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
        description: '获取当前所有标签页列表，返回每个标签页的 ID、标题、URL 和所属容器',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        execute: async () => {
          const tabs = tabManager.getTabs();
          const tabList = tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            containerId: tab.containerId,
          }));
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(tabList, null, 2),
            }],
            details: { count: tabList.length },
          };
        },
      },
      {
        name: 'search_history',
        label: '搜索历史记录',
        description: '在指定容器的浏览历史中搜索记录，支持按 URL 和标题模糊匹配',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
            containerId: {
              type: 'string',
              description: '容器 ID（可选，默认使用 default 容器）',
            },
            limit: {
              type: 'number',
              description: '返回结果数量上限（可选，默认 10）',
            },
          },
          required: ['query'],
        },
        execute: async (toolCallId, params) => {
          const { query, containerId = 'default', limit = 10 } = params;
          if (!query) {
            throw new Error('搜索关键词不能为空');
          }
          const results = historyManager.searchRecords(containerId, {
            keyword: query,
            limit,
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
              }, null, 2),
            }],
            details: { count: results.length },
          };
        },
      },
      {
        name: 'manage_favorites',
        label: '管理收藏夹',
        description: '管理收藏夹：添加收藏、查看收藏列表、删除收藏',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: '操作类型：add（添加）、get（查看列表）、delete（删除）',
              enum: ['add', 'get', 'delete'],
            },
            url: {
              type: 'string',
              description: '添加收藏时的页面 URL',
            },
            title: {
              type: 'string',
              description: '添加收藏时的页面标题（可选）',
            },
            id: {
              type: 'number',
              description: '删除收藏时的记录 ID',
            },
          },
          required: ['action'],
        },
        execute: async (toolCallId, params) => {
          const { action, url, title, id } = params;

          if (action === 'add') {
            if (!url) {
              throw new Error('添加收藏时 URL 不能为空');
            }
            const result = favoritesManager.addRecord({ url, title: title || '' });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
              details: result,
            };
          }

          if (action === 'get') {
            const records = favoritesManager.listRecords({ limit: 50 });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  favorites: records.map(r => ({
                    id: r.id,
                    url: r.url,
                    title: r.title,
                    createdAt: r.created_at,
                  })),
                  count: records.length,
                }, null, 2),
              }],
              details: { count: records.length },
            };
          }

          if (action === 'delete') {
            if (!id) {
              throw new Error('删除收藏时 ID 不能为空');
            }
            const success = favoritesManager.deleteRecord(id);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success, id }, null, 2),
              }],
              details: { success, id },
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
            containerId = (mainWindow && windowManager.getCurrentContainer(mainWindow.id)) || 'default';
          }

          // 验证容器存在（container-manager 内存权威数据：initContainers 以
          // DEFAULT_CONTAINERS 兜底且从不写回 store，全新 profile 下 store
          // 无 containers 键，空数组兜底读取会误判 default 不存在）
          const container = getContainersLazy().find(c => c.id === containerId);
          if (!container) {
            throw new Error('指定容器不存在或已删除');
          }

          if (newTab) {
            // D-11：新标签页打开（不影响当前页面）
            // webview 只能由渲染进程创建 —— 复用 window.open 拦截同款
            // open-url-in-tab 通道，渲染进程走完整 createTab 链路
            // （DOM + webview + URL 加载），主进程直接 tabManager.createTab
            // 只会产生无 webview 的幽灵 Tab。
            // tabId 由渲染进程异步创建，主进程无法同步得知（返回 null，
            // 可随后经 get_tabs 按 URL 查询）。
            if (!mainWindow || mainWindow.isDestroyed()) {
              throw new Error('无法在容器中打开链接，请检查容器状态');
            }
            try {
              mainWindow.webContents.send('open-url-in-tab', { url, containerId, guestId: undefined });
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
        description: '在当前页面执行操作，如点击按钮、滚动页面、填写输入框等。低风险操作自动执行，表单提交、文件上传、脚本执行需要用户确认。',
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
                key: { type: 'string', description: 'keydown/keyup 操作的键名' },
                code: { type: 'string', description: 'keydown/keyup 操作的键码' },
                keyCode: { type: 'number', description: 'keydown/keyup 操作的虚拟键码' },
                format: { type: 'string', description: 'screenshot 操作的图片格式' },
                quality: { type: 'number', description: 'screenshot 操作的图片质量' },
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
    ];
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

module.exports = AIManager;
module.exports.executeScript = executeScript;
module.exports.sanitizeInput = sanitizeInput;
module.exports.validateScriptForSteps = validateScriptForSteps;
