/**
 * 模型家族分组与图标解析（依赖 ai-brand-map.js 先加载）
 *
 * 暴露 window.ModelFamily：
 *   resolveModel(id)        → { brand, series, groupKey, title, icon, color, caps, type, releaseDate }
 *   groupModels(models)     → [{ key, title, icon, color, models: [...] }]（保持首次出现顺序）
 *   latestPerGroup(models)  → 每个分组取最新一个模型（releaseDate → 版本号 → 原始顺序）
 *   getProviderIcon(pid)    → { icon, color } | null
 *   iconUrl(iconKey)        → 图标文件相对路径
 *
 * 图标用法：color=true 用 <img src>；color=false 用 CSS mask（自动适配明暗主题，
 * 因为 lobehub 单色 SVG 使用 fill="currentColor"）。
 */
(function () {
  'use strict';

  const DATA = window.AI_BRAND_DATA || {};
  const BRANDS = DATA.AI_BRANDS || {};
  const ALIASES = DATA.AI_BRAND_ALIASES || [];
  const PROVIDER_ICONS = DATA.AI_PROVIDER_ICONS || {};
  const META = DATA.AI_MODEL_META || {};

  const CAPS_VISION = 1, CAPS_REASONING = 2, CAPS_TOOLS = 4;
  const MOD_TEXT = 1, MOD_IMAGE = 2, MOD_AUDIO = 4, MOD_VIDEO = 8;

  /** 图标文件相对路径（settings 页经 /settings/ 静态路由、主窗口经 file:// 均可解析） */
  function iconUrl(iconKey) {
    return 'assets/ai-icons/' + iconKey + '.svg';
  }

  /**
   * 生成图标 HTML。图标统一带白色圆角底板（见 CSS .ai-icon）；
   * darkTile=true 的图标（如 kimi，字形主体为白色）用深色底板。
   * @param {string|null} iconKey - lobehub 图标基础名
   * @param {boolean} hasColor - 是否有彩色版
   * @param {string} [fallbackText] - 无图标时的兜底字母
   * @param {boolean} [darkTile] - 字形为白色的暗色设计图标
   * @returns {string} HTML 字符串
   */
  function iconHtml(iconKey, hasColor, fallbackText, darkTile) {
    if (!iconKey) {
      const ch = (fallbackText || '?').trim().charAt(0).toUpperCase();
      return `<span class="ai-icon ai-icon-fallback">${escapeHtml(ch)}</span>`;
    }
    const tileCls = darkTile ? ' ai-icon-dark-tile' : '';
    if (hasColor) {
      return `<img class="ai-icon${tileCls}" src="${iconUrl(iconKey + '-color')}" alt="">`;
    }
    return `<img class="ai-icon${tileCls}" src="${iconUrl(iconKey)}" alt="">`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** 规范化模型 ID：小写、分隔符统一为 - */
  function normalizeId(id) {
    return String(id || '').toLowerCase().replace(/[/_\s]+/g, '-');
  }

  /**
   * 品牌匹配：先查元数据快照，再按别名最长前缀匹配
   * @param {string} id - 模型 ID
   * @returns {{brand:string|null, rest:string}} brand 与去除品牌前缀后的剩余串
   */
  function matchBrandDetailed(id) {
    const norm = normalizeId(id);
    // 匹配候选：斜杠后部分优先（聚合网关的供应商前缀不参与品牌判定，
    // 如 ZHIPU/GLM-5.3、kimi/kimi-k3、vanchin/deepseek-v3）
    const raw = String(id || '');
    const candidates = raw.includes('/')
      ? [normalizeId(raw.slice(raw.lastIndexOf('/') + 1)), norm]
      : [norm];
    // ID 前缀别名优先于元数据 family：deepseek-r1-distill-qwen 这类蒸馏模型
    // family 是被蒸馏方（qwen），但用户认知属于 deepseek
    for (const cand of candidates) {
      for (const [alias, brand] of ALIASES) {
        if (cand === alias) return { brand, rest: '' };
        if (cand.startsWith(alias)) {
          const next = cand[alias.length];
          if (next === '-' || (next >= '0' && next <= '9')) {
            return { brand, rest: cand.slice(alias.length).replace(/^-/, '') };
          }
        }
      }
    }
    const meta = META[String(id || '').toLowerCase()] || META[norm];
    if (meta && meta[0]) {
      return { brand: meta[0], rest: norm };
    }
    // 启发式兜底：取首段字母作为品牌键（无图标）
    const first = candidates[0];
    const m = first.match(/^([a-z][a-z0-9]*?)(?:-|$)/);
    return { brand: m ? m[1] : null, rest: m ? first.slice(m[1].length).replace(/^-/, '') : first };
  }

  function matchBrand(id) {
    return matchBrandDetailed(id).brand;
  }

  /** 子产品线泛化词（这些词不作为分组依据） */
  const GENERIC_TOKENS = new Set(['latest', 'preview', 'instruct', 'chat', 'base', 'alpha', 'beta', 'exp', 'free', 'it', 'gguf', 'fp8', 'int4', 'awq', 'api']);

  /**
   * 提取系列标识：
   * - 剩余串以字母开头 → 首个非泛化词作为子产品线（qwen-image-3.0 → 'image'，claude-opus-4-5 → 'opus'）
   * - 以数字开头 → 第一个合理版本号（先剥离参数量 235b/8x7b 与日期 2026-02-13/-1106）
   * @param {string} rest - 去除品牌前缀后的串
   * @returns {{series:string|null, sub:string|null}}
   */
  function extractSeriesFromRest(rest) {
    if (!rest) return { series: null, sub: null };

    // 字母开头：产品线优先（版本号属于产品线内部演进，不参与分组）
    if (/^[a-z]/i.test(rest)) {
      const tokens = rest.split('-');
      for (const t of tokens) {
        if (/^\d/.test(t)) break; // 遇到数字段停止（避免把日期后的词当产品线）
        if (/^[a-z][a-z0-9.]*$/i.test(t) && !GENERIC_TOKENS.has(t.toLowerCase())) {
          return { series: null, sub: t };
        }
      }
      return { series: null, sub: null };
    }

    // 数字开头：剥离参数量与日期后取版本号
    const cleaned = rest
      .replace(/(?:19|20)\d{2}([-/.]\d{1,2}){0,2}/g, '-')     // 日期 2026-02-13
      .replace(/-\d{4}(?=-|$)/g, '-')                          // MMDD 后缀 -1106
      .replace(/(^|-)[a-z]?\d+(\.\d+)?x\d+b(?=-|$)/gi, '$1')   // 8x7b 类 MoE 参数
      .replace(/(^|-)[a-z]?\d+(\.\d+)?b(?=-|$)/gi, '$1');      // 235b / a22b / 70b 类参数
    const m = cleaned.match(/(\d+)(?:[-.](\d{1,2}))?/);
    if (!m || parseInt(m[1], 10) >= 100) return { series: null, sub: null };
    return { series: m[2] ? `${m[1]}.${m[2]}` : m[1], sub: null };
  }

  /**
   * 版本号比较：提取 ID 中全部数字段做数值比较（用于同组内"最新"判定）
   * @returns {number[]} 数字数组，如 'qwen2-5-vl-7b' → [2,5,7]
   */
  function versionVector(id) {
    const norm = normalizeId(id);
    const nums = [];
    const re = /(\d+)(?:[-.](\d+))?/g;
    let m;
    while ((m = re.exec(norm)) !== null) {
      nums.push(parseInt(m[1], 10));
      if (m[2]) nums.push(parseInt(m[2], 10));
      if (nums.length >= 4) break;
    }
    return nums;
  }

  function compareVersion(a, b) {
    const va = versionVector(a), vb = versionVector(b);
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      const x = va[i] || 0, y = vb[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  /** releaseDate '2025-09' → 202509（可比较整数），空为 0 */
  function rdScore(rd) {
    if (!rd) return 0;
    const n = String(rd).replace(/-/g, '');
    return parseInt(n, 10) || 0;
  }

  /**
   * 模型类型（获取模型弹框的类型 tab）：
   * 重排 > 嵌入 > 视频 > 音频 > 图片 > 文本
   */
  function modelType(id, meta) {
    const norm = normalizeId(id);
    if (/rerank/i.test(norm)) return 'rerank';
    if (/embed|(^|-)bge-/i.test(norm)) return 'embedding';
    const im = meta ? meta[3] : 0, om = meta ? meta[4] : 0;
    if ((im & MOD_VIDEO) || (om & MOD_VIDEO) || /(^|-)(video|veo|kling|hailuo|vidu|wan\d)/i.test(norm)) return 'video';
    if ((im & MOD_AUDIO) || (om & MOD_AUDIO) || /whisper|tts|speech|audio|voice/i.test(norm)) return 'audio';
    if ((im & MOD_IMAGE) || (om & MOD_IMAGE) || /dall-e|imagen|flux|sdxl|stable-diffusion|kolors|cogview|seedream|-vl-|vision/i.test(norm)) return 'image';
    return 'text';
  }

  /**
   * 解析模型：品牌/系列/分组/能力/类型
   * @param {string} id - 模型 ID
   * @returns {Object}
   */
  function resolveModel(id) {
    const norm = normalizeId(id);
    const meta = META[String(id || '').toLowerCase()] || META[norm];
    const { brand, rest } = matchBrandDetailed(id);
    const brandDef = brand ? BRANDS[brand] : null;
    let series = null, sub = null;
    if (brandDef && brandDef.split && !norm.startsWith('text-embedding')) {
      ({ series, sub } = extractSeriesFromRest(rest));
    }
    const qualifier = series || sub;
    const groupKey = qualifier ? `${brand}@${qualifier}` : (brand || 'other');
    const subTitle = sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : null;
    const title = brandDef
      ? (qualifier ? `${brandDef.name} ${series || subTitle}` : brandDef.name)
      : (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '其他');
    const caps = meta ? meta[2] : 0;
    return {
      brand,
      series,
      groupKey,
      title,
      icon: brandDef ? brandDef.icon : null,
      color: brandDef ? brandDef.color : false,
      darkTile: brandDef ? !!brandDef.dark : false,
      releaseDate: meta ? meta[1] : '',
      caps: {
        vision: !!(caps & CAPS_VISION) || /-vl-|vision/i.test(norm),
        reasoning: !!(caps & CAPS_REASONING) || /reason|think/i.test(norm),
        tools: !!(caps & CAPS_TOOLS),
      },
      type: modelType(id, meta),
    };
  }

  /**
   * 按家族分组（保持模型原始顺序，组按首次出现排序）
   * @param {Array<{id:string,name?:string}>} models
   * @returns {Array<{key:string,title:string,icon:string|null,color:boolean,models:Array}>}
   */
  function groupModels(models) {
    const groups = new Map();
    for (const m of models || []) {
      const r = resolveModel(m.id);
      let g = groups.get(r.groupKey);
      if (!g) {
        g = { key: r.groupKey, title: r.title, icon: r.icon, color: r.color, dark: r.darkTile, models: [] };
        groups.set(r.groupKey, g);
      }
      g.models.push({ ...m, _resolved: r });
    }
    return [...groups.values()];
  }

  /**
   * 每个分组取最新模型（releaseDate → 版本号 → 原始顺序）
   * @param {Array<{id:string,name?:string}>} models
   * @returns {Array<{id:string,name?:string}>} 保持组首次出现顺序
   */
  function latestPerGroup(models) {
    const groups = groupModels(models);
    const picked = [];
    for (const g of groups) {
      let best = g.models[0];
      let bestRd = rdScore(best._resolved.releaseDate);
      for (let i = 1; i < g.models.length; i++) {
        const cur = g.models[i];
        const curRd = rdScore(cur._resolved.releaseDate);
        if (curRd > bestRd) {
          best = cur; bestRd = curRd;
        } else if (curRd === bestRd && compareVersion(cur.id, best.id) > 0) {
          best = cur;
        }
      }
      picked.push({ id: best.id, name: best.name || best.id });
    }
    return picked;
  }

  /**
   * 供应商图标
   * @param {string} providerId
   * @returns {{icon:string,color:boolean}|null}
   */
  function getProviderIcon(providerId) {
    return PROVIDER_ICONS[providerId] || null;
  }

  window.ModelFamily = {
    resolveModel,
    groupModels,
    latestPerGroup,
    getProviderIcon,
    iconUrl,
    iconHtml,
  };
})();
