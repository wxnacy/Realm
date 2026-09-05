#!/usr/bin/env node
/**
 * 视觉专用模型（Vision Bridge）核心模块测试
 *
 * 覆盖：
 * - modelSupportsImage：input 含 image / 自定义供应商 ID 正则兜底 / null
 * - resolveVisionModel：正常解析 / 未配置 / 供应商禁用 / text-only 复核拦截
 * - describeImages：单图/多图调用结构、拼接格式、部分失败、失败降级（永不 throw）
 * - 缓存：同 key 命中 / userRequest 参与键 / FIFO 淘汰
 * - 25MB 守卫：超限图跳过计入 failedCount
 *
 * 用法: node tests/test-ai-vision-bridge.js
 *
 * vision-describer.js 仅依赖 crypto（无 electron 依赖链），直接注入 fake
 * models/configStore 即可，无需 Module._load stub。
 */

const assert = require('node:assert');
const test = require('node:test');

const {
  modelSupportsImage,
  VisionDescriber,
  VISION_IMAGE_MAX_BYTES,
  CACHE_MAX_ENTRIES,
} = require('../vision-describer');

// ==================== fake 依赖 ====================

/**
 * 构造 fake configStore（内存 map 语义）
 */
function fakeConfigStore(initial = {}) {
  const data = JSON.parse(JSON.stringify(initial));
  return {
    get: (key, fallback) => (key in data ? data[key] : fallback),
    set: (key, value) => { data[key] = value; },
    delete: (key) => { delete data[key]; },
    _data: data,
  };
}

/**
 * 构造 fake models：getModel 按注册表解析；completeSimple 可编程行为
 */
function fakeModels({ modelTable = {}, completeImpl } = {}) {
  const calls = [];
  return {
    calls,
    getModel(provider, id) {
      return modelTable[`${provider}/${id}`] || null;
    },
    async completeSimple(model, context, options) {
      calls.push({ model, context, options });
      if (completeImpl) return completeImpl(model, context, options);
      return {
        stopReason: 'stop',
        content: [{ type: 'text', text: '【画面概述】测试图' }],
      };
    },
  };
}

const IMG_PNG = { data: 'aGVsbG8=', mimeType: 'image/png', name: 'shot.png', bytes: 1024 };
const IMG_JPG = { data: 'Zm9vYmFy', mimeType: 'image/jpeg', name: 'chart.jpg', bytes: 2048 };

// ==================== modelSupportsImage ====================

test('modelSupportsImage: input 含 image 判真', () => {
  assert.equal(modelSupportsImage({ input: ['text', 'image'], id: 'gpt-4o' }), true);
});

test('modelSupportsImage: text-only + ID 含 -vl- 兜底判真', () => {
  assert.equal(modelSupportsImage({ input: ['text'], id: 'qwen-vl-max' }), true);
  assert.equal(modelSupportsImage({ input: ['text'], id: 'glm-4v-vision' }), true);
});

test('modelSupportsImage: text-only 普通 ID 判假', () => {
  assert.equal(modelSupportsImage({ input: ['text'], id: 'gpt-4o-mini' }), false);
});

test('modelSupportsImage: null / 缺 input 判假', () => {
  assert.equal(modelSupportsImage(null), false);
  assert.equal(modelSupportsImage({ id: 'x' }), false);
  assert.equal(modelSupportsImage({ input: 'text' }), false);
});

// ==================== resolveVisionModel ====================

const VISION_MODEL = { id: 'qwen-vl-max', input: ['text', 'image'] };
const PROVIDERS = { openai: { apiKey: 'sk-x', enabled: true } };
const VISION_CFG = { provider: 'openai', model: 'qwen-vl-max' };

function describerWith(models, store) {
  return new VisionDescriber({ models, configStore: store });
}

test('resolveVisionModel: 配置存在且可解析 → Model 对象', () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);
  assert.equal(d.resolveVisionModel(), VISION_MODEL);
  assert.equal(d.isConfigured(), true);
});

test('resolveVisionModel: 未配置键 → null', () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);
  assert.equal(d.resolveVisionModel(), null);
  assert.equal(d.isConfigured(), false);
});

test('resolveVisionModel: 指向不存在供应商 → null', () => {
  const models = fakeModels({ modelTable: {} });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);
  assert.equal(d.resolveVisionModel(), null);
});

test('resolveVisionModel: 供应商被禁用 → null（运行时实时判定）', () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({
    'ai.visionModel': VISION_CFG,
    'ai.providers': { openai: { apiKey: 'sk-x', enabled: false } },
  });
  const d = describerWith(models, store);
  assert.equal(d.resolveVisionModel(), null);
});

test('resolveVisionModel: 指向 text-only 模型 → 能力复核拦截', () => {
  const models = fakeModels({ modelTable: { 'openai/gpt-4o-mini': { id: 'gpt-4o-mini', input: ['text'] } } });
  const store = fakeConfigStore({
    'ai.visionModel': { provider: 'openai', model: 'gpt-4o-mini' },
    'ai.providers': PROVIDERS,
  });
  const d = describerWith(models, store);
  assert.equal(d.resolveVisionModel(), null);
});

// ==================== describeImages: 单图 ====================

test('describeImages 单图: completeSimple 收到 image + text block，输出 image-descriptions 块', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const result = await d.describeImages([IMG_PNG], '帮我看看这个报错');
  assert.equal(result.ok, true);
  assert.equal(result.failedCount, 0);
  assert.ok(result.text.startsWith('<image-descriptions>'));
  assert.ok(result.text.includes('[图片 1/1: shot.png]'));
  assert.ok(result.text.includes('【画面概述】'));

  const call = models.calls[0];
  assert.equal(models.calls.length, 1);
  const content = call.context.messages[0].content;
  assert.equal(content[0].type, 'image');
  assert.equal(content[0].data, IMG_PNG.data);
  assert.equal(content[0].mimeType, 'image/png');
  assert.equal(content[1].type, 'text');
  assert.ok(content[1].text.includes('帮我看看这个报错'));
  assert.equal(call.context.systemPrompt.length > 0, true);
});

test('describeImages: 空 images 列表 → ok 且无描述块', async () => {
  const d = describerWith(fakeModels(), fakeConfigStore());
  const result = await d.describeImages([], 'x');
  assert.equal(result.ok, true);
  assert.equal(result.text, '');
});

// ==================== describeImages: 多图与部分失败 ====================

test('describeImages 多图: 逐张串行调用、拼接格式 [图片 N/M]', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const result = await d.describeImages([IMG_PNG, IMG_JPG], '看图');
  assert.equal(models.calls.length, 2);
  assert.ok(result.text.includes('[图片 1/2: shot.png]'));
  assert.ok(result.text.includes('[图片 2/2: chart.jpg]'));
  assert.equal(result.failedCount, 0);
});

test('describeImages 多图: 第二张失败 → 第一张仍返回 + failedCount=1，不 throw', async () => {
  let n = 0;
  const models = fakeModels({
    modelTable: { 'openai/qwen-vl-max': VISION_MODEL },
    completeImpl: async () => {
      n += 1;
      if (n === 2) throw new Error('LLM_RATE_LIMITED 429');
      return { stopReason: 'stop', content: [{ type: 'text', text: '第一张描述' }] };
    },
  });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const result = await d.describeImages([IMG_PNG, IMG_JPG], '看图');
  assert.equal(result.ok, true);
  assert.equal(result.failedCount, 1);
  assert.ok(result.text.includes('第一张描述'));
  assert.ok(result.error.includes('429'));
});

test('describeImages 全部失败: ok=false、无描述块、error 保留、不 throw', async () => {
  const models = fakeModels({
    modelTable: { 'openai/qwen-vl-max': VISION_MODEL },
    completeImpl: async () => { throw new Error('connect ETIMEDOUT'); },
  });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const result = await d.describeImages([IMG_PNG], '看图');
  assert.equal(result.ok, false);
  assert.equal(result.text, '');
  assert.equal(result.failedCount, 1);
  assert.ok(result.error.includes('ETIMEDOUT'));
});

test('describeImages: stopReason=error / 空返回 → 降级计数', async () => {
  for (const resp of [
    { stopReason: 'error', errorMessage: 'bad request', content: [] },
    { stopReason: 'stop', content: [{ type: 'text', text: '   ' }] },
  ]) {
    const models = fakeModels({
      modelTable: { 'openai/qwen-vl-max': VISION_MODEL },
      completeImpl: async () => resp,
    });
    const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
    const d = describerWith(models, store);
    const result = await d.describeImages([IMG_PNG], '看图');
    assert.equal(result.ok, false);
    assert.equal(result.failedCount, 1);
  }
});

// ==================== 缓存 ====================

test('缓存: 同图同请求二次调用 completeSimple 只调 1 次', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  await d.describeImages([IMG_PNG], '看图');
  await d.describeImages([IMG_PNG], '看图');
  assert.equal(models.calls.length, 1);
});

test('缓存: 不同 userRequest 不命中（请求参与缓存键）', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  await d.describeImages([IMG_PNG], '看图');
  await d.describeImages([IMG_PNG], '换个问题');
  assert.equal(models.calls.length, 2);
});

test('缓存: 超过 CACHE_MAX_ENTRIES FIFO 淘汰', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const imgs = [];
  for (let i = 0; i < CACHE_MAX_ENTRIES + 1; i++) {
    imgs.push({ ...IMG_PNG, data: Buffer.from(`img-${i}`).toString('base64') });
  }
  await d.describeImages(imgs, '批量');
  assert.equal(models.calls.length, CACHE_MAX_ENTRIES + 1);
  assert.equal(d._cache.size, CACHE_MAX_ENTRIES);

  // 第一张（最早插入）已被淘汰：单独重发应重新调用
  const first = { ...IMG_PNG, data: Buffer.from('img-0').toString('base64') };
  await d.describeImages([first], '批量');
  assert.equal(models.calls.length, CACHE_MAX_ENTRIES + 2);
});

// ==================== 25MB 守卫 ====================

test('25MB 守卫: 超限图跳过不计入 completeSimple，计入 failedCount', async () => {
  const models = fakeModels({ modelTable: { 'openai/qwen-vl-max': VISION_MODEL } });
  const store = fakeConfigStore({ 'ai.visionModel': VISION_CFG, 'ai.providers': PROVIDERS });
  const d = describerWith(models, store);

  const big = { ...IMG_PNG, bytes: VISION_IMAGE_MAX_BYTES + 1, name: 'huge.png' };
  const result = await d.describeImages([big, IMG_PNG], '看图');
  assert.equal(models.calls.length, 1); // 只有第二张小图真正调了
  assert.equal(result.failedCount, 1);
  assert.ok(result.text.includes('[图片 2/2: shot.png]'));
  assert.ok(result.error.includes('25MB'));
});
