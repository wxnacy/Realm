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

// ==================== 常量 ====================

/**
 * AI 助手系统提示词
 * 定义 AI 在 Realm Browser 中的角色和能力边界
 */
const REALM_SYSTEM_PROMPT = `你是 Realm Browser 的 AI 助手。你可以帮助用户管理浏览器标签页、查看当前状态等。

你的能力：
- get_tabs: 获取当前所有标签页列表

请用简洁、专业的语气回答用户问题。当需要执行操作时，使用提供的工具函数。`;

/** 上下文裁剪：保留最近的消息数量 */
const MAX_CONTEXT_MESSAGES = 20;

/** read_page_content 正文截断阈值（100KB，D-07：覆盖 99%+ 网页） */
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
      const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');
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

      // 确定激活提供商：优先 ai.activeProvider，须已配置；否则取第一个已配置项
      const savedActive = configStore.get('ai.activeProvider');
      const activeProvider = savedActive && configuredIds.includes(savedActive)
        ? savedActive
        : configuredIds[0];

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
      providers.openai = { apiKey: legacyKey, model: 'gpt-4o-mini' };
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
   * 目录枚举不依赖初始化状态——设置页在任何时刻都需要完整提供商列表
   * @returns {Promise<Object>} pi-ai Models 实例
   * @private
   */
  async _getCatalog() {
    if (this.models) return this.models;
    if (!this._catalogPromise) {
      this._catalogPromise = (async () => {
        const { builtinModels } = await import('@earendil-works/pi-ai/providers/all');
        const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');
        return builtinModels({ credentials: new InMemoryCredentialStore() });
      })();
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
    const { provider, apiKey, model } = config;

    if (!provider || !apiKey) {
      throw new Error('提供商和 API Key 不能为空');
    }

    // 校验提供商存在，并解析有效模型 ID
    const catalog = await this._getCatalog();
    const catalogProvider = catalog.getProviders().find(p => p.id === provider);
    if (!catalogProvider) {
      throw new Error(`未知提供商: ${provider}`);
    }
    const providerModels = catalogProvider.getModels();
    const validModel = model && providerModels.some(m => m.id === model)
      ? model
      : (providerModels[0] && providerModels[0].id);

    // 更新 configStore
    if (this.configStore) {
      const providers = this.configStore.get('ai.providers', {});
      providers[provider] = { apiKey, model: validModel };
      this.configStore.set('ai.providers', providers);
      this.configStore.set('ai.activeProvider', provider);

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
      return {
        id: p.id,
        name: p.name,
        configured: Boolean(apiKey),
        keyPreview: apiKey ? `…${apiKey.slice(-4)}` : null,
        activeModel: saved && saved.model ? saved.model : null,
        models: p.getModels().map(m => ({ id: m.id, name: m.name })),
      };
    });

    return {
      providers,
      activeProvider,
      activeModel: activeProvider && providersCfg[activeProvider]
        ? providersCfg[activeProvider].model
        : null,
    };
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
        name: 'navigate',
        label: '导航到网址',
        description: '在指定容器中打开一个网页，支持在当前标签页或新标签页中打开',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '要导航到的 URL 地址',
            },
            containerId: {
              type: 'string',
              description: '目标容器 ID（可选，默认使用当前容器）',
            },
            newTab: {
              type: 'boolean',
              description: '是否在新标签页中打开（可选，默认 false）',
            },
          },
          required: ['url'],
        },
        execute: async (toolCallId, params) => {
          const { url, containerId = 'default', newTab = false } = params;
          if (!url) {
            throw new Error('URL 不能为空');
          }
          // 使用 tabManager.createTab 创建新标签页
          const tab = tabManager.createTab(containerId, url);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tabId: tab.id,
                url: tab.url,
                containerId: tab.containerId,
              }, null, 2),
            }],
            details: { tabId: tab.id },
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

          // 获取容器配置（通过 configStore）
          const containers = this.configStore ? this.configStore.get('containers', []) : [];
          const container = containers.find(c => c.id === containerId);
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
                `\n[截断：原始大小 ${data.content.length} bytes，已截断至 100KB]`;
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

            return {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
              details: { totalLinks: data.total },
            };
          } finally {
            cdpManager.detachForAI(webContentsId);
          }
        },
      },
    ];
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
