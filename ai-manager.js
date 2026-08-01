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
 * 存储在 electron-store 的 `ai.apiKey` 路径下。
 *
 * @module ai-manager
 */

const tabManager = require('./tab-manager');
const historyManager = require('./history-manager');
const favoritesManager = require('./favorites-manager');
const windowManager = require('./window-manager');

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
  }

  /**
   * 初始化 AI Manager
   *
   * 流程：
   * 1. 从 configStore 读取 API Key
   * 2. 创建 pi-ai CredentialStore 并注入 OpenAI API Key
   * 3. 创建 pi-ai Models 实例（builtinModels，注册所有内置提供商）
   * 4. 构建 Realm 工具列表
   * 5. 创建 pi-agent-core Agent 实例
   *
   * API Key 通过 CredentialStore 机制注入（pi-ai 的标准认证方式），
   * 而非直接传入 builtinModels 参数。builtinModels 的 options 参数
   * 仅接受 { credentials, modelsStore, authContext }。
   *
   * @param {Object} configStore - electron-store 实例，用于读取 AI 配置
   * @returns {Promise<void>}
   */
  async init(configStore) {
    this.configStore = configStore;

    // 检查 API Key
    const apiKey = configStore.get('ai.apiKey');
    if (!apiKey) {
      console.log('[Realm AI] 未配置 API Key，跳过初始化');
      this.isInitialized = false;
      return;
    }

    try {
      // 动态导入 ESM-only 的 pi 包
      // pi-ai 和 pi-agent-core 的 package.json 声明 "type": "module"，
      // CommonJS 的 require() 无法加载，必须用动态 import()
      const { builtinModels } = await import('@earendil-works/pi-ai');
      const { Agent } = await import('@earendil-works/pi-agent-core');
      const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');

      // 创建凭证存储并注入 OpenAI API Key（per pi-ai 认证模型）
      // CredentialStore 是 pi-ai 的标准认证机制：每个 provider 一个凭证条目
      const credentialStore = new InMemoryCredentialStore();
      await credentialStore.modify('openai', async () => ({
        type: 'api_key',
        key: apiKey,
      }));

      // 创建 Models 实例（注册所有内置提供商，初始支持 OpenAI per D-14）
      // builtinModels 的 options 仅接受 { credentials, modelsStore, authContext }
      this.models = builtinModels({
        credentials: credentialStore,
      });

      // 构建工具列表
      this.tools = this._buildRealmTools();

      // 获取 OpenAI 模型（per D-14：初始使用 gpt-4o-mini）
      const model = this.models.getModel('openai', 'gpt-4o-mini');
      if (!model) {
        console.error('[Realm AI] 未找到 openai/gpt-4o-mini 模型');
        this.isInitialized = false;
        return;
      }

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
      console.log('[Realm AI] AI Manager 初始化完成');
    } catch (err) {
      console.error('[Realm AI] 初始化失败:', err.message);
      this.isInitialized = false;
    }
  }

  /**
   * 发送用户消息给 AI Agent
   *
   * 调用 agent.prompt() 触发一轮对话，Agent 可能会调用工具（如 get_tabs），
   * 然后基于工具结果生成回复。回复结果输出到主进程控制台（per D-06）。
   *
   * @param {string} message - 用户输入的消息
   * @returns {Promise<void>}
   */
  async prompt(message) {
    if (!this.isInitialized || !this.agent) {
      console.error('[Realm AI] AI Manager 未初始化，无法处理消息');
      return;
    }

    console.log(`[Realm AI] 发送消息: ${message}`);

    try {
      // 订阅 Agent 事件以输出回复到控制台（per D-06）
      const unsubscribe = this.agent.subscribe((event) => {
        if (event.type === 'message') {
          const msg = event.message;
          if (msg.role === 'assistant' && msg.content) {
            // 提取文本内容输出到控制台
            const textParts = msg.content
              .filter(c => c.type === 'text')
              .map(c => c.text);
            if (textParts.length > 0) {
              console.log('[Realm AI] Agent 回复:', textParts.join(''));
            }
          }
        }
        if (event.type === 'tool_execution_start') {
          console.log(`[Realm AI] 调用工具: ${event.toolName}`);
        }
        if (event.type === 'tool_execution_end') {
          console.log(`[Realm AI] 工具执行完成: ${event.toolName}`);
        }
      });

      await this.agent.prompt(message);
      await this.agent.waitForIdle();

      // 取消订阅
      unsubscribe();
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
