/**
 * Realm Browser - 分配规则管理模块
 *
 * 管理容器分配规则，实现 URL 匹配和自动容器切换
 */

const Store = require('electron-store');
const { URL } = require('url');

// 规则存储实例
const store = new Store({ name: 'assignment-rules' });

// 规则运行时状态
const rules = new Map();
let ruleCounter = 0;

/**
 * 初始化规则管理器
 */
function initRules() {
  const savedRules = store.get('rules', []);
  const savedCounter = store.get('ruleCounter', 0);

  // 恢复规则列表
  savedRules.forEach(rule => {
    rules.set(rule.id, rule);
  });

  // 恢复计数器
  ruleCounter = savedCounter;

  console.log(`[Realm] 规则管理器初始化，恢复 ${rules.size} 个规则`);
}

/**
 * 获取所有规则
 * @returns {Array} 规则数组
 */
function getRules() {
  return Array.from(rules.values());
}

/**
 * 获取指定规则
 * @param {string} ruleId - 规则 ID
 * @returns {Object|null} 规则对象或 null
 */
function getRule(ruleId) {
  return rules.get(ruleId) || null;
}

/**
 * 创建新规则
 * @param {string} containerId - 目标容器 ID
 * @param {string} pattern - 匹配模式（域名或通配符）
 * @returns {Object} 创建的规则对象
 */
function createRule(containerId, pattern) {
  // 验证 pattern 非空
  if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
    throw new Error('匹配模式不能为空');
  }

  // 验证 containerId 存在
  if (!containerId || typeof containerId !== 'string') {
    throw new Error('容器 ID 不能为空');
  }

  const ruleId = `rule-${++ruleCounter}`;
  const rule = {
    id: ruleId,
    containerId,
    pattern: pattern.trim().toLowerCase(),
    enabled: true,
    createdAt: Date.now(),
  };

  rules.set(ruleId, rule);
  saveRules();

  console.log(`[Realm] 创建规则: ${ruleId} (${pattern} -> ${containerId})`);

  return rule;
}

/**
 * 更新规则
 * @param {string} ruleId - 规则 ID
 * @param {Object} updates - 更新内容
 * @returns {Object|null} 更新后的规则对象
 */
function updateRule(ruleId, updates) {
  const rule = rules.get(ruleId);
  if (!rule) {
    return null;
  }

  // 合并更新
  if (updates.pattern !== undefined) {
    rule.pattern = updates.pattern.trim().toLowerCase();
  }
  if (updates.enabled !== undefined) {
    rule.enabled = updates.enabled;
  }
  if (updates.containerId !== undefined) {
    rule.containerId = updates.containerId;
  }

  rules.set(ruleId, rule);
  saveRules();

  console.log(`[Realm] 更新规则: ${ruleId}`);

  return rule;
}

/**
 * 删除规则
 * @param {string} ruleId - 规则 ID
 * @returns {boolean} 是否成功删除
 */
function deleteRule(ruleId) {
  if (!rules.has(ruleId)) {
    return false;
  }

  rules.delete(ruleId);
  saveRules();

  console.log(`[Realm] 删除规则: ${ruleId}`);

  return true;
}

/**
 * 匹配 URL
 * @param {string} url - 要匹配的 URL
 * @returns {string|null} 匹配的容器 ID 或 null
 */
function matchUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    const allRules = getRules().filter(r => r.enabled);

    for (const rule of allRules) {
      if (matchPattern(hostname, rule.pattern)) {
        console.log(`[Realm] URL 匹配规则: ${url} -> ${rule.containerId}`);
        return rule.containerId;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 匹配模式
 * @param {string} hostname - 主机名
 * @param {string} pattern - 匹配模式
 * @returns {boolean} 是否匹配
 */
function matchPattern(hostname, pattern) {
  // 精确匹配
  if (hostname === pattern) {
    return true;
  }

  // 通配符匹配（*.example.com）
  if (pattern.startsWith('*.')) {
    const domain = pattern.slice(2);
    return hostname.endsWith('.' + domain) || hostname === domain;
  }

  // 子域名匹配（example.com 匹配 www.example.com）
  return hostname.endsWith('.' + pattern);
}

/**
 * 保存规则到 electron-store
 */
function saveRules() {
  store.set('rules', Array.from(rules.values()));
  store.set('ruleCounter', ruleCounter);
}

/**
 * 重新排序规则
 * 按照 orderedIds 数组的顺序重建 rules Map（Map 保持插入顺序）
 * @param {Array<string>} orderedIds - 规则 ID 的有序数组
 * @returns {boolean} 是否成功
 */
function reorderRules(orderedIds) {
  if (!Array.isArray(orderedIds)) {
    throw new Error('orderedIds 必须是数组');
  }

  // 验证所有 ID 必须存在于 rules Map 中
  for (const id of orderedIds) {
    if (!rules.has(id)) {
      throw new Error(`规则 ID 不存在: ${id}`);
    }
  }

  // 按照 orderedIds 顺序重建 rules Map
  const newRules = new Map();
  orderedIds.forEach(id => {
    newRules.set(id, rules.get(id));
  });

  // 替换原有 rules Map
  rules.clear();
  newRules.forEach((value, key) => {
    rules.set(key, value);
  });

  saveRules();

  console.log(`[Realm] 规则排序完成，共 ${orderedIds.length} 条规则`);

  return true;
}

/**
 * 导出规则
 * @returns {Object} 包含规则数组和导出时间戳的对象
 */
function exportRules() {
  return {
    rules: Array.from(rules.values()),
    exportedAt: Date.now(),
  };
}

/**
 * 归一化规则导入 payload
 *
 * 接受裸规则数组或任意层级的 { rules: ... } 包裹（含导出产物
 * { rules, exportedAt }），逐层解包后返回规则数组；无法得到数组时返回 null。
 * 用于消除客户端/服务端在 body 形状上的隐式耦合：裸数组（零次解包）、单层
 * 包裹（一次）、旧版客户端的多层包裹（多次）均被接受。
 *
 * @param {*} payload - 客户端提交的原始 body 或磁盘文件解析结果
 * @returns {Array|null} 规则数组，或 null（输入无法归一化为数组）
 */
function normalizeRulesPayload(payload) {
  let current = payload;
  while (!Array.isArray(current) && current !== null && typeof current === 'object' && 'rules' in current) {
    current = current.rules;
  }
  return Array.isArray(current) ? current : null;
}

/**
 * 导入规则
 * @param {Array} rulesData - 解析后的规则数组
 * @returns {Object} 导入结果
 */
function importRules(rulesData) {
  if (!Array.isArray(rulesData)) {
    return { success: false, message: '规则数据格式不正确' };
  }

  // 已存在的 (containerId, pattern) 组合，用于去重
  const existingKeys = new Set(
    Array.from(rules.values()).map(r => `${r.containerId}::${r.pattern}`)
  );

  let imported = 0;
  let skipped = 0;

  for (const rule of rulesData) {
    // 验证每条规则必须有 containerId 和 pattern
    if (!rule.containerId || !rule.pattern) {
      continue; // 跳过无效规则
    }

    const normalizedPattern = rule.pattern.trim().toLowerCase();
    const key = `${rule.containerId}::${normalizedPattern}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue; // 跳过重复规则
    }

    try {
      createRule(rule.containerId, rule.pattern);
      existingKeys.add(key);
      imported++;
    } catch (error) {
      console.error(`[Realm] 导入规则失败: ${error.message}`);
    }
  }

  if (imported > 0) {
    console.log(`[Realm] 成功导入 ${imported} 条规则${skipped > 0 ? `，跳过 ${skipped} 条重复` : ''}`);
    return { success: true, count: imported, skipped };
  }

  if (skipped > 0) {
    return { success: false, message: `所有 ${skipped} 条规则均已存在，未导入`, skipped };
  }

  return { success: false, message: '没有有效的规则可导入' };
}

// 模块导出
module.exports = {
  initRules,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  matchUrl,
  matchPattern,
  reorderRules,
  exportRules,
  normalizeRulesPayload,
  importRules,
};
