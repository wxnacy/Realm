#!/usr/bin/env node
/**
 * 生成 AI 品牌词典与图标子集
 *
 * 数据源（均为 MIT License）：
 *   - models.dev api.json（模型 family / release_date / capabilities / modalities）
 *     下载: curl -sL https://models.dev/api.json -o /tmp/realm-modelsdev.json
 *   - @lobehub/icons-static-svg（品牌 SVG 图标）
 *     解包: npm pack @lobehub/icons-static-svg && tar xzf *.tgz -C /tmp/realm-icons
 *
 * 产出：
 *   - src/ai-brand-map.js      品牌词典 + 模型元数据快照（渲染进程直接使用）
 *   - src/assets/ai-icons/     引用到的 SVG 图标子集
 *
 * 用法: node scripts/generate-ai-brand-map.js [modelsdev.json 路径] [icons 目录]
 */

const fs = require('fs');
const path = require('path');

const MODELS_JSON = process.argv[2] || '/tmp/realm-modelsdev.json';
const ICONS_DIR = process.argv[3] || '/tmp/realm-icons/package/icons';
const OUT_JS = path.join(__dirname, '..', 'src', 'ai-brand-map.js');
const OUT_ICONS = path.join(__dirname, '..', 'src', 'assets', 'ai-icons');

// ==================== 品牌词典 ====================
// brandKey: { icon(lobehub 基础名), name(显示名), aliases(模型 ID 前缀小写), split(是否按版本号细分组) }
const BRANDS = {
  qwen:       { icon: 'qwen',         name: 'Qwen',       aliases: ['qwen', 'qwq', 'qvq', 'tongyi', 'text-embedding'], split: true },
  deepseek:   { icon: 'deepseek',     name: 'DeepSeek',   aliases: ['deepseek'] },
  glm:        { icon: 'chatglm',      name: 'GLM',        aliases: ['glm', 'chatglm', 'zhipu', 'codegeex', 'cogview', 'cogvideo', 'autoglm'], split: true },
  kimi:       { icon: 'kimi',         name: 'Kimi',       aliases: ['kimi', 'moonshot'] },
  minimax:    { icon: 'minimax',      name: 'MiniMax',    aliases: ['minimax', 'hailuo', 'abab'] },
  gpt:        { icon: 'openai',       name: 'GPT',        aliases: ['gpt', 'openai', 'chatgpt', 'o1', 'o3', 'o4'], split: true },
  claude:     { icon: 'claude',       name: 'Claude',     aliases: ['claude'], split: true },
  gemini:     { icon: 'gemini',       name: 'Gemini',     aliases: ['gemini'], split: true },
  gemma:      { icon: 'gemma',        name: 'Gemma',      aliases: ['gemma'] },
  grok:       { icon: 'grok',         name: 'Grok',       aliases: ['grok'], split: true },
  llama:      { icon: 'meta',         name: 'Llama',      aliases: ['llama', 'codellama'], split: true },
  mistral:    { icon: 'mistral',      name: 'Mistral',    aliases: ['mistral', 'mixtral', 'ministral', 'codestral', 'devstral', 'magistral', 'voxtral', 'pixtral'], split: true },
  doubao:     { icon: 'doubao',       name: 'Doubao',     aliases: ['doubao', 'seed', 'seedance', 'seedream', 'skylark'], split: true },
  hunyuan:    { icon: 'hunyuan',      name: 'Hunyuan',    aliases: ['hunyuan'], split: true },
  ernie:      { icon: 'wenxin',       name: '文心',        aliases: ['ernie', 'wenxin'] },
  baichuan:   { icon: 'baichuan',     name: 'Baichuan',   aliases: ['baichuan'] },
  yi:         { icon: 'yi',           name: 'Yi',         aliases: ['yi', 'zeroone'] },
  spark:      { icon: 'spark',        name: '星火',        aliases: ['spark', 'iflytek'] },
  sensenova:  { icon: 'sensenova',    name: 'SenseNova',  aliases: ['sensenova', 'sense'] },
  internlm:   { icon: 'internlm',     name: 'InternLM',   aliases: ['internlm', 'intern'] },
  skywork:    { icon: 'skywork',      name: 'Skywork',    aliases: ['skywork'] },
  stepfun:    { icon: 'stepfun',      name: 'Step',       aliases: ['step'] },
  longcat:    { icon: 'longcat',      name: 'LongCat',    aliases: ['longcat'] },
  mimo:       { icon: 'xiaomimimo',   name: 'MiMo',       aliases: ['mimo'] },
  ling:       { icon: 'antgroup',     name: '百灵',        aliases: ['ling', 'bailing'] },
  nemotron:   { icon: 'nvidia',       name: 'Nemotron',   aliases: ['nemotron'] },
  phi:        { icon: 'microsoft',    name: 'Phi',        aliases: ['phi'] },
  nova:       { icon: 'nova',         name: 'Nova',       aliases: ['nova'] },
  command:    { icon: 'cohere',       name: 'Command',    aliases: ['command', 'cohere', 'aya'] },
  jamba:      { icon: 'ai21',         name: 'Jamba',      aliases: ['jamba'] },
  solar:      { icon: 'upstage',      name: 'Solar',      aliases: ['solar'] },
  sonar:      { icon: 'perplexity',   name: 'Sonar',      aliases: ['sonar'] },
  whisper:    { icon: 'openai',       name: 'Whisper',    aliases: ['whisper'] },
  dalle:      { icon: 'dalle',        name: 'DALL·E',     aliases: ['dall-e', 'dalle'] },
  flux:       { icon: 'flux',         name: 'FLUX',       aliases: ['flux'] },
  imagen:     { icon: 'google',       name: 'Imagen',     aliases: ['imagen'] },
  veo:        { icon: 'google',       name: 'Veo',        aliases: ['veo'] },
  voyage:     { icon: 'voyage',       name: 'Voyage',     aliases: ['voyage'] },
  granite:    { icon: 'ibm',          name: 'Granite',    aliases: ['granite'] },
  hermes:     { icon: 'nousresearch', name: 'Hermes',     aliases: ['hermes'] },
  rwkv:       { icon: 'rwkv',         name: 'RWKV',       aliases: ['rwkv'] },
  tiangong:   { icon: 'tiangong',     name: '天工',        aliases: ['tiangong'] },
  xuanyuan:   { icon: 'xuanyuan',     name: '轩辕',        aliases: ['xuanyuan'] },
  kolors:     { icon: 'kolors',       name: '可图',        aliases: ['kolors'] },
  kling:      { icon: 'kling',        name: '可灵',        aliases: ['kling'] },
  jimeng:     { icon: 'jimeng',       name: '即梦',        aliases: ['jimeng'] },
  vidu:       { icon: 'vidu',         name: 'Vidu',       aliases: ['vidu'] },
  stability:  { icon: 'stability',    name: 'Stability',  aliases: ['stable-diffusion', 'sdxl', 'sd3'] },
  runway:     { icon: 'runway',       name: 'Runway',     aliases: ['runway', 'gen-3', 'gen-4'] },
  suno:       { icon: 'suno',         name: 'Suno',       aliases: ['suno', 'chirp'] },
  elevenlabs: { icon: 'elevenlabs',   name: 'ElevenLabs', aliases: ['elevenlabs', 'eleven'] },
  ideogram:   { icon: 'ideogram',     name: 'Ideogram',   aliases: ['ideogram'] },
  recraft:    { icon: 'recraft',      name: 'Recraft',    aliases: ['recraft'] },
  midjourney: { icon: 'midjourney',   name: 'Midjourney', aliases: ['midjourney', 'mj'] },
  luma:       { icon: 'luma',         name: 'Luma',       aliases: ['luma', 'ray'] },
  pika:       { icon: 'pika',         name: 'Pika',       aliases: ['pika'] },
  jina:       { icon: 'jina',         name: 'Jina',       aliases: ['jina'] },
  palm:       { icon: 'palm',         name: 'PaLM',       aliases: ['palm'] },
  yuanbao:    { icon: 'yuanbao',      name: '元宝',        aliases: ['yuanbao'] },
  bge:        { icon: 'baai',         name: 'BGE',        aliases: ['bge'] },
  titan:      { icon: 'aws',          name: 'Titan',      aliases: ['titan'] },
  zimage:     { icon: 'qwen',         name: 'Z-Image',    aliases: ['z-image'] },
  wan:        { icon: 'qwen',         name: 'Wan',        aliases: ['wan'] },
  funasr:     { icon: 'qwen',         name: 'FunASR',     aliases: ['fun-asr', 'funasr', 'paraformer', 'sensevoice'] },
  codeqwen:   { icon: 'qwen',         name: 'CodeQwen',   aliases: ['codeqwen'] },
};

// models.dev family → brandKey（family 与别名不一致时的显式映射）
const FAMILY_TO_BRAND = {
  'claude-opus': 'claude', 'claude-sonnet': 'claude', 'claude-haiku': 'claude', 'claude-fable': 'claude',
  'kimi-k2': 'kimi', 'kimi-k3': 'kimi', 'kimi-thinking': 'kimi',
  'deepseek-thinking': 'deepseek', 'deepseek-flash': 'deepseek',
  'glm-flash': 'glm', 'glm-air': 'glm',
  'gpt-mini': 'gpt', 'gpt-nano': 'gpt', 'gpt-codex': 'gpt', 'gpt-oss': 'gpt',
  'gpt-image': 'gpt', 'gpt-pro': 'gpt', 'gpt-sol': 'gpt', 'gpt-luna': 'gpt',
  'gpt-terra': 'gpt', 'text-embedding': 'gpt', 'o': 'gpt', 'o-mini': 'gpt', 'o-pro': 'gpt',
  'gemini-flash': 'gemini', 'gemini-flash-lite': 'gemini', 'gemini-pro': 'gemini',
  'grok-build': 'grok',
  'mistral-small': 'mistral', 'mistral-medium': 'mistral', 'mistral-large': 'mistral',
  'mistral-nemo': 'mistral', 'ministral': 'mistral', 'devstral': 'mistral', 'codestral': 'mistral',
  'command-a': 'cohere-command', // 占位：下方规范化为 command
  'qwen3.5': 'qwen', 'qwen3.6': 'qwen',
  'mimo-v2.5-pro': 'mimo',
  'solar-pro': 'solar',
};
FAMILY_TO_BRAND['cohere-command'] = 'command';
FAMILY_TO_BRAND['command-a'] = 'command';
FAMILY_TO_BRAND['command-r'] = 'command';
FAMILY_TO_BRAND['seed'] = 'doubao';
FAMILY_TO_BRAND['mimo'] = 'mimo';
FAMILY_TO_BRAND['ling'] = 'ling';
FAMILY_TO_BRAND['muse'] = 'ling';
FAMILY_TO_BRAND['ernie'] = 'ernie';
FAMILY_TO_BRAND['hunyuan'] = 'hunyuan';
FAMILY_TO_BRAND['qvq'] = 'qwen';
FAMILY_TO_BRAND['mixtral'] = 'mistral';
FAMILY_TO_BRAND['magistral'] = 'mistral';
FAMILY_TO_BRAND['pixtral'] = 'mistral';
FAMILY_TO_BRAND['voxtral'] = 'mistral';
FAMILY_TO_BRAND['gpt-codex-mini'] = 'gpt';
FAMILY_TO_BRAND['sonar-deep-research'] = 'sonar';
FAMILY_TO_BRAND['sonar-reasoning'] = 'sonar';
FAMILY_TO_BRAND['sonar-pro'] = 'sonar';
FAMILY_TO_BRAND['nova-pro'] = 'nova';
FAMILY_TO_BRAND['nova-micro'] = 'nova';
FAMILY_TO_BRAND['nova-lite'] = 'nova';
FAMILY_TO_BRAND['step'] = 'stepfun';
FAMILY_TO_BRAND['glmv'] = 'glm';
FAMILY_TO_BRAND['glm-free'] = 'glm';
FAMILY_TO_BRAND['minimax-free'] = 'minimax';
FAMILY_TO_BRAND['mimo-v2.5'] = 'mimo';
FAMILY_TO_BRAND['qwen3.5'] = 'qwen';
FAMILY_TO_BRAND['qwen3.6'] = 'qwen';
FAMILY_TO_BRAND['bge'] = 'bge';
FAMILY_TO_BRAND['titan-embed'] = 'titan';

// pi-ai 内置供应商 ID → lobehub 图标基础名（null = 无图标，用字母头像兜底）
const PROVIDER_ICONS = {
  'amazon-bedrock': 'bedrock',
  'ant-ling': 'antgroup',
  'anthropic': 'anthropic',
  'azure-openai-responses': 'azureai',
  'cerebras': 'cerebras',
  'cloudflare-ai-gateway': 'cloudflare',
  'cloudflare-auth': 'cloudflare',
  'cloudflare-stream': 'cloudflare',
  'cloudflare-workers-ai': 'workersai',
  'deepseek': 'deepseek',
  'faux': null,
  'fireworks': 'fireworks',
  'github-copilot': 'githubcopilot',
  'google': 'google',
  'google-vertex': 'vertexai',
  'groq': 'groq',
  'huggingface': 'huggingface',
  'kimi-coding': 'kimi',
  'minimax': 'minimax',
  'minimax-cn': 'minimax',
  'mistral': 'mistral',
  'moonshotai': 'moonshot',
  'moonshotai-cn': 'moonshot',
  'nvidia': 'nvidia',
  'openai': 'openai',
  'openai-codex': 'codex',
  'opencode': 'opencode',
  'opencode-go': 'opencode',
  'openrouter': 'openrouter',
  'openrouter-images': 'openrouter',
  'qwen-token-plan': 'qwen',
  'qwen-token-plan-cn': 'qwen',
  'radius': null,
  'radius-config': null,
  'together': 'together',
  'vercel-ai-gateway': 'v0',
  'xai': 'xai',
  'xiaomi': 'xiaomimimo',
  'xiaomi-token-plan-ams': 'xiaomimimo',
  'xiaomi-token-plan-cn': 'xiaomimimo',
  'xiaomi-token-plan-sgp': 'xiaomimimo',
  'zai': 'zai',
  'zai-coding-cn': 'zai',
};

// 额外可用的供应商图标（添加自定义供应商时的常见选择，供 UI 按 baseURL 启发匹配）
const EXTRA_PROVIDER_ICONS = {
  'alibaba': 'bailian', 'siliconflow': 'siliconcloud', 'modelscope': 'modelscope',
  '302ai': 'ai302', 'aihubmix': 'aihubmix', 'qiniu': 'qiniu', 'tencent': 'tencentcloud',
  'volcengine': 'volcengine', 'baidu': 'baiducloud', 'huawei': 'huaweicloud',
  'ollama': 'ollama', 'lmstudio': 'lmstudio', 'ppio': 'ppio', 'deepinfra': 'deepinfra',
  'novita': 'novita', 'nebius': 'nebius', 'sambanova': 'sambanova', 'lambda': 'lambda',
  'vllm': 'vllm', 'xinference': 'xinference', 'openrouter-alt': 'openrouter',
};

// 纳入元数据快照的 models.dev 供应商（按优先级排序，模型 ID 去重先到先得）
const META_PROVIDERS = [
  'openai', 'anthropic', 'google', 'deepseek', 'xai', 'mistral', 'groq', 'cerebras',
  'alibaba', 'alibaba-cn', 'zhipuai', 'moonshotai-cn', 'minimax-cn', 'zai',
  'qwen-token-plan-cn', 'kimi-for-coding', 'alibaba-coding-plan-cn', 'zhipuai-coding-plan',
  'minimax-cn-coding-plan', 'xiaomi-token-plan-cn', 'tencent-coding-plan', 'stepfun-ai',
  'siliconflow-cn', 'siliconflow', 'modelscope', '302ai', 'aihubmix', 'qiniu-ai',
  'openrouter', 'amazon-bedrock', 'google-vertex', 'azure', 'github-copilot',
  'cloudflare-workers-ai', 'huggingface', 'togetherai', 'fireworks-ai', 'deepinfra',
  'novita-ai', 'cohere', 'perplexity', 'upstage', 'sakana', 'inception', 'morph',
  'arcee', 'abacus', 'poe', 'vercel', 'nvidia', 'ollama-cloud', 'lmstudio', 'iflowcn',
  'longcat', 'stepfun', 'tencent-tokenhub', 'xiaomi', 'minimax', 'moonshotai',
  'zai-coding-plan', 'alibaba-token-plan-cn', 'opencode', 'opencode-go',
];

// ==================== 生成逻辑 ====================

const data = JSON.parse(fs.readFileSync(MODELS_JSON, 'utf8'));

const MOD_BITS = { text: 1, image: 2, audio: 4, video: 8 };
const CAPS_ATTACHMENT = 1, CAPS_REASONING = 2, CAPS_TOOLS = 4;

function modMask(list) {
  let m = 0;
  for (const x of list || []) m |= MOD_BITS[x] || 0;
  return m;
}

// 别名 → brandKey，按别名长度降序（最长前缀优先）
const aliasRows = [];
for (const [brand, def] of Object.entries(BRANDS)) {
  for (const a of def.aliases) aliasRows.push([a, brand]);
}
aliasRows.sort((a, b) => b[0].length - a[0].length);

function brandFromId(id) {
  const norm = id.toLowerCase().replace(/[/_\s]+/g, '-');
  for (const [alias, brand] of aliasRows) {
    if (norm === alias) return brand;
    if (norm.startsWith(alias)) {
      const next = norm[alias.length];
      if (next === '-' || (next >= '0' && next <= '9')) return brand;
    }
  }
  return null;
}

const meta = {};
const missingBrand = new Set();
for (const pid of META_PROVIDERS) {
  const p = data[pid];
  if (!p || !p.models) continue;
  for (const [mid, m] of Object.entries(p.models)) {
    const key = mid.toLowerCase();
    if (meta[key]) continue;
    let brand = (m.family && FAMILY_TO_BRAND[m.family]) || (m.family && BRANDS[m.family] ? m.family : null) || brandFromId(mid);
    if (!brand && m.family) {
      // family 未映射：以 family 作为品牌键（无图标，UI 字母兜底）
      brand = m.family;
      missingBrand.add(m.family);
    }
    if (!brand) {
      brand = brandFromId(mid) || null;
      if (!brand) continue; // 无法归类的模型不入表，运行时走启发式
    }
    const caps = (m.attachment ? CAPS_ATTACHMENT : 0) | (m.reasoning ? CAPS_REASONING : 0) | (m.tool_call ? CAPS_TOOLS : 0);
    meta[key] = [brand, m.release_date || '', caps, modMask(m.modalities && m.modalities.input), modMask(m.modalities && m.modalities.output)];
  }
}

// 校验图标存在性并收集需复制的文件
const usedIcons = new Set();
// 字形主体为白色的暗色设计图标（白底板上会隐身，需配深色底板）
const DARK_TILE_ICONS = new Set(['kimi']);
function resolveIcon(base) {
  if (!base) return null;
  const color = fs.existsSync(path.join(ICONS_DIR, base + '-color.svg'));
  const mono = fs.existsSync(path.join(ICONS_DIR, base + '.svg'));
  if (!mono && !color) return null;
  if (color) usedIcons.add(base + '-color.svg');
  if (mono) usedIcons.add(base + '.svg');
  return { icon: base, color, dark: DARK_TILE_ICONS.has(base) };
}

const brandOut = {};
for (const [brand, def] of Object.entries(BRANDS)) {
  const r = resolveIcon(def.icon);
  if (!r) { console.warn(`[warn] 品牌 ${brand} 图标缺失: ${def.icon}`); }
  brandOut[brand] = { icon: def.icon, name: def.name, color: r ? r.color : false, dark: r ? r.dark : false, split: !!def.split };
}

const providerOut = {};
for (const [pid, base] of Object.entries({ ...PROVIDER_ICONS, ...EXTRA_PROVIDER_ICONS })) {
  if (!base) { providerOut[pid] = null; continue; }
  const r = resolveIcon(base);
  if (!r) { console.warn(`[warn] 供应商 ${pid} 图标缺失: ${base}`); providerOut[pid] = null; continue; }
  providerOut[pid] = r;
}

// 复制图标
fs.mkdirSync(OUT_ICONS, { recursive: true });
let copied = 0;
for (const f of usedIcons) {
  fs.copyFileSync(path.join(ICONS_DIR, f), path.join(OUT_ICONS, f));
  copied++;
}

// 别名表导出（长度降序，运行时直接使用）
const aliasOut = aliasRows.map(([a, b]) => [a, b]);

const header = `/**
 * AI 品牌词典与模型元数据快照 — 由 scripts/generate-ai-brand-map.js 生成，请勿手改
 *
 * 数据源（MIT License）：
 *   - models.dev（模型 family / release_date / capabilities / modalities）
 *   - @lobehub/icons-static-svg（品牌图标，文件位于 src/assets/ai-icons/）
 *
 * 生成时间: ${new Date().toISOString().slice(0, 10)}
 *
 * 数据结构：
 *   AI_BRANDS:    brandKey → { icon, name, color, split }  color=是否有彩色版，split=是否按版本号细分组
 *   AI_BRAND_ALIASES: [别名(小写), brandKey][] 按长度降序，用于模型 ID 最长前缀匹配
 *   AI_PROVIDER_ICONS: 供应商 ID → { icon, color } | null（null 时 UI 用字母头像兜底）
 *   AI_MODEL_META: 模型 ID(小写) → [brandKey, releaseDate, caps, inputMod, outputMod]
 *     caps: 1=视觉(attachment) 2=推理(reasoning) 4=工具调用(tool_call)
 *     mod:  1=text 2=image 4=audio 8=video
 */
`;
const body = `window.AI_BRAND_DATA = {
  AI_BRANDS: ${JSON.stringify(brandOut)},
  AI_BRAND_ALIASES: ${JSON.stringify(aliasOut)},
  AI_PROVIDER_ICONS: ${JSON.stringify(providerOut)},
  AI_MODEL_META: ${JSON.stringify(meta)},
};
`;

fs.writeFileSync(OUT_JS, header + body, 'utf8');

const kb = (fs.statSync(OUT_JS).size / 1024).toFixed(1);
console.log(`[done] ${OUT_JS} (${kb} KB), 模型元数据 ${Object.keys(meta).length} 条, 图标 ${copied} 个`);
if (missingBrand.size) {
  console.log('[info] 未映射 family（保留原样、无图标）:', [...missingBrand].slice(0, 40).join(', '));
}
