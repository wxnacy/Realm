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
 * @module ai-manager
 */

const tabManager = require('./tab-manager');

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

// ==================== AI Manager ====================

/**
 * AI Manager - 管理 AI Agent 实例和 LLM 连接
 *
 * 负责：
 * - 初始化 pi-ai Models 实例（连接 LLM 提供商）
 * - 创建 pi-agent-core Agent 实例（管理对话和工具执行）
 * - 注册 Realm 工具（get_tabs 等）
 * - 处理用户消息和取消操作
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
  }

  /**
   * 初始化 AI Manager
   *
   * 流程：
   * 1. 从 configStore 读取 API Key
   * 2. 创建 pi-ai Models 实例
   * 3. 构建 Realm 工具列表
   * 4. 创建 pi-agent-core Agent 实例
   *
   * @param {Object} configStore - electron-store 实例，用于读取 AI 配置
   * @returns {Promise<void>}
   */
  async init(configStore) {
    this.configStore = configStore;

    // 检查 API Key
    const apiKey = configStore.get('ai.apiKey');
    if (!apiKey) {
      console.log('[Realm AI] 未配置 API Key，请在设置中配置');
      this.isInitialized = false;
      return;
    }

    try {
      // 动态导入 ESM-only 的 pi 包
      const { builtinModels } = await import('@earendil-works/pi-ai');
      const { Agent } = await import('@earendil-works/pi-agent-core');

      // 创建 Models 实例（初始支持 OpenAI，per D-14）
      this.models = builtinModels({
        openai: { apiKey },
      });

      // 构建工具列表
      this.tools = this._buildRealmTools();

      // 创建 Agent 实例
      this.agent = new Agent({
        systemPrompt: REALM_SYSTEM_PROMPT,
        model: this.models.defaultModel,
        tools: this.tools,
      });

      this.isInitialized = true;
      console.log('[Realm AI] AI Manager 初始化完成');
    } catch (err) {
      console.error('[Realm AI] 初始化失败:', err.message);
      this.isInitialized = false;
    }
  }

  /**
   * 发送用户消息给 AI Agent
   *
   * @param {string} message - 用户输入的消息
   * @returns {Promise<void>}
   */
  async prompt(message) {
    if (!this.isInitialized || !this.agent) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      return;
    }

    console.log(`[Realm AI] 发送消息: ${message.substring(0, 50)}...`);

    try {
      const result = await this.agent.prompt(message);
      console.log('[Realm AI] Agent 回复:', result);
    } catch (err) {
      console.error('[Realm AI] 消息处理失败:', err.message);
    }
  }

  /**
   * 取消当前正在进行的 AI 操作
   */
  abort() {
    if (this.agent) {
      this.agent.abort();
      console.log('[Realm AI] 操作已取消');
    }
  }

  /**
   * 构建 Realm Browser 工具列表
   *
   * Phase 19 注册 get_tabs 工具，Phase 20 扩展其他工具。
   * 工具定义遵循 pi-agent-core 的 AgentTool 接口。
   *
   * @returns {Array} 工具定义数组
   * @private
   */
  _buildRealmTools() {
    return [
      {
        name: 'get_tabs',
        description: '获取当前所有标签页列表',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
        execute: async () => {
          const tabs = tabManager.getTabs();
          return JSON.stringify(tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            containerId: tab.containerId,
            isActive: tab.isActive,
          })));
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
   * @returns {Array} 裁剪后的消息数组
   * @private
   */
  _compactContext(messages) {
    if (!Array.isArray(messages)) return [];
    return messages.slice(-MAX_CONTEXT_MESSAGES);
  }
}

module.exports = AIManager;
