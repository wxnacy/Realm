/**
 * 视觉专用模型描述器（Vision Bridge）
 *
 * 主模型不支持图片输入（pi-ai Model.input 不含 'image'）时，把图片附件
 * 先发给单独配置的视觉模型转写为文字描述，回注消息正文，主模型不必具备
 * vision 能力。参考 openhanako VisionBridge / oh-my-pi image-vision-fallback。
 *
 * 设计要点：
 * - 纯 CJS，不顶层 import pi-ai：completeSimple 经注入的 models 对象调用，保持可测
 * - 永不 throw：单图失败降级为通告文本（借鉴 oh-my-pi），不阻断主对话
 * - 配置：configStore 键 ai.visionModel = { provider, model }，复用已配置供应商凭证
 */

const crypto = require('crypto');

/** 视觉转写单图上限（字节）：超过跳过并计入 failedCount（与聊天气泡内联渲染上限一致） */
const VISION_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** 单图转写超时（毫秒） */
const VISION_TIMEOUT_MS = 60 * 1000;

/** 用户请求上下文截断长度 */
const USER_REQUEST_MAX_CHARS = 500;

/** 描述文本单图上限（字符） */
const MAX_DESC_CHARS = 3000;

/** 缓存容量上限（条，FIFO 淘汰） */
const CACHE_MAX_ENTRIES = 50;

/** 视觉模型系统提示词（5 段式，中文场景） */
const VISION_SYSTEM_PROMPT =
  '你是视觉描述助手。用户的主对话模型无法看到图片，你负责把图片转写为详尽的文字描述，' +
  '让主模型仅凭你的文字就能理解图片。请用中文，按以下结构输出纯文本（小节标题用【】，不要使用 Markdown 代码块包裹整体）：\n' +
  '【画面概述】一两句话说明这是什么图、整体内容\n' +
  '【可见文字】原样转录图中的所有文字（含代码、UI 文案、报错信息，保持换行与格式）\n' +
  '【内容与布局】主要对象、区块结构、空间关系（从上到下/从左到右）\n' +
  '【图表与数据】若含图表/表格，转录坐标轴、图例、关键数值与趋势结论；无则写「无」\n' +
  '【与用户请求的关联】结合用户请求，点出图中最可能相关的部分\n' +
  `总长度上限约 ${MAX_DESC_CHARS} 字符。不要臆造图里不存在的内容；看不清的部分明确说明「无法辨认」。`;

/**
 * 判定模型是否支持图片输入
 *
 * pi-ai Model.input 含 'image' 为主判据；自定义供应商模型在 ai-manager
 * 注册时硬编码 input:['text']，按模型 ID 正则兜底（与 src/model-family.js
 * resolveModel 的 vision 口径一致：词典位之外补 /-vl-|vision/i）。
 *
 * @param {Object|null} model - pi-ai Model 对象（须含 input/id 字段）
 * @returns {boolean} 是否支持图片输入
 */
function modelSupportsImage(model) {
  if (!model || !Array.isArray(model.input)) return false;
  if (model.input.includes('image')) return true;
  return typeof model.id === 'string' && /-vl-|vision/i.test(model.id);
}

/**
 * 视觉描述器：把图片附件经视觉模型转写为文字描述
 *
 * 依赖注入（models/configStore 由 ai-manager 传入），便于测试 stub。
 */
class VisionDescriber {
  /**
   * @param {Object} deps
   * @param {Object} deps.models - pi-ai Models 实例（ai-manager 的 this.models，
   *   须提供 getModel(provider, modelId) 与 completeSimple(model, context, options)）
   * @param {Object} deps.configStore - electron-store 实例（读写 ai.visionModel）
   */
  constructor({ models, configStore }) {
    this.models = models;
    this.configStore = configStore;
    /** 描述缓存：key = sha256(mimeType+base64+userRequest+模型签名) → 描述文本 */
    this._cache = new Map();
  }

  /**
   * 读取视觉模型配置引用
   * @private
   * @returns {{provider: string, model: string}|null}
   */
  _getConfig() {
    if (!this.configStore) return null;
    const cfg = this.configStore.get('ai.visionModel', null);
    if (!cfg || typeof cfg !== 'object') return null;
    if (typeof cfg.provider !== 'string' || !cfg.provider) return null;
    if (typeof cfg.model !== 'string' || !cfg.model) return null;
    // 运行时禁用是后置变化：供应商被禁用即视同未配置
    const providers = this.configStore.get('ai.providers', {});
    const saved = providers[cfg.provider];
    if (!saved || saved.enabled === false) return null;
    return { provider: cfg.provider, model: cfg.model };
  }

  /**
   * 解析视觉模型对象
   *
   * configStore 读 ai.visionModel → models.getModel() 解析 →
   * modelSupportsImage 复核（防配置指向 text-only 模型后被 SDK
   * downgradeUnsupportedImages 静默降级出占位符描述的假成功）。
   *
   * @returns {Object|null} pi-ai Model 或 null（未配置/供应商已删/模型不存在/无 image 能力）
   */
  resolveVisionModel() {
    const cfg = this._getConfig();
    if (!cfg || !this.models) return null;
    let model = null;
    try {
      model = this.models.getModel(cfg.provider, cfg.model);
    } catch {
      return null;
    }
    if (!model) return null;
    // 复核兜底：自定义供应商模型 ID 正则（modelSupportsImage 内含此逻辑）
    if (!modelSupportsImage(model)) return null;
    return model;
  }

  /**
   * 是否已配置且当前可用的视觉模型
   * @returns {boolean}
   */
  isConfigured() {
    return this.resolveVisionModel() !== null;
  }

  /**
   * 缓存键（内容 + 请求 + 模型签名）
   * @private
   * @param {{mimeType: string, data: string}} image
   * @param {string} userRequest
   * @param {Object} visionModel
   * @returns {string}
   */
  _cacheKey(image, userRequest, visionModel) {
    return crypto
      .createHash('sha256')
      .update(`${image.mimeType}|${image.data}|${userRequest}|${visionModel.provider || ''}/${visionModel.id || ''}`)
      .digest('hex');
  }

  /**
   * 缓存读取 + FIFO 淘汰写入
   * @private
   */
  _cacheGet(key) {
    return this._cache.get(key);
  }

  _cacheSet(key, value) {
    if (this._cache.has(key)) this._cache.delete(key);
    this._cache.set(key, value);
    while (this._cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
  }

  /**
   * 单图转写：一次 completeSimple 非流式调用
   * @private
   * @param {Object} visionModel - pi-ai Model
   * @param {{data: string, mimeType: string, name?: string}} image - base64 图片
   * @param {string} userRequest - 用户请求上下文
   * @returns {Promise<string>} 描述文本（失败 throw，由 describeImages 捕获）
   */
  async _describeOne(visionModel, image, userRequest) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
    try {
      const assistant = await this.models.completeSimple(visionModel, {
        systemPrompt: VISION_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          timestamp: Date.now(),
          content: [
            { type: 'image', data: image.data, mimeType: image.mimeType },
            { type: 'text', text: `用户请求：\n${userRequest}` },
          ],
        }],
      }, { signal: controller.signal });
      const text = (assistant.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()
        .slice(0, MAX_DESC_CHARS);
      if (assistant.stopReason === 'error' || assistant.stopReason === 'aborted' || !text) {
        throw new Error(assistant.errorMessage || '视觉模型返回为空');
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 描述一批图片（逐张串行，带用户请求上下文；永不 throw）
   *
   * @param {Array<{data: string, mimeType: string, name: string, bytes?: number}>} images
   *   base64 图片列表（data 为 base64 字符串；bytes 为原始字节数，超限跳过）
   * @param {string} userRequest - 用户消息原文（截断作为转写上下文）
   * @returns {Promise<{ok: boolean, text: string, failedCount: number, error?: string}>}
   *   ok=false 仅当全部失败；部分失败时 text 含成功部分且 failedCount>0
   */
  async describeImages(images, userRequest) {
    const result = { ok: false, text: '', failedCount: 0, error: undefined };
    const list = Array.isArray(images) ? images : [];
    if (list.length === 0) {
      result.ok = true;
      return result;
    }
    const visionModel = this.resolveVisionModel();
    if (!visionModel) {
      result.failedCount = list.length;
      result.error = '视觉模型未配置或不可用';
      return result;
    }
    const request = typeof userRequest === 'string'
      ? userRequest.trim().slice(0, USER_REQUEST_MAX_CHARS)
      : '';
    const sections = [];
    let lastError = '';

    for (let i = 0; i < list.length; i++) {
      const image = list[i];
      const label = `[图片 ${i + 1}/${list.length}: ${image.name || 'image'}]`;
      if (typeof image.bytes === 'number' && image.bytes > VISION_IMAGE_MAX_BYTES) {
        result.failedCount += 1;
        lastError = '图片超过 25MB 上限';
        continue;
      }
      const key = this._cacheKey(image, request, visionModel);
      const cached = this._cacheGet(key);
      if (cached) {
        sections.push(`${label}\n${cached}`);
        continue;
      }
      try {
        const desc = await this._describeOne(visionModel, image, request || '（无明确文字请求）');
        this._cacheSet(key, desc);
        sections.push(`${label}\n${desc}`);
      } catch (err) {
        result.failedCount += 1;
        lastError = (err && err.message) ? err.message : String(err);
      }
    }

    if (sections.length > 0) {
      result.ok = true;
      result.text = '<image-descriptions>\n' + sections.join('\n\n') + '\n</image-descriptions>';
    }
    if (result.failedCount > 0) {
      result.error = lastError;
    }
    return result;
  }

  /** 清空缓存（测试用） */
  _resetCacheForTest() {
    this._cache.clear();
  }
}

module.exports = {
  modelSupportsImage,
  VisionDescriber,
  VISION_SYSTEM_PROMPT,
  VISION_IMAGE_MAX_BYTES,
  VISION_TIMEOUT_MS,
  CACHE_MAX_ENTRIES,
};
