/**
 * Realm Browser - 容器管理模块
 *
 * 管理所有容器的生命周期，包括：
 * - 从 electron-store 加载和保存容器配置
 * - 容器的 CRUD 操作
 * - Session partition 的创建和管理
 */

const { session } = require('electron');
const Store = require('electron-store');
const crypto = require('crypto');
const cookieManager = require('./cookie-manager');

// 配置存储实例
const configStore = new Store({ name: 'realm-config' });

// 容器实例存储
const containers = new Map();

/**
 * 默认容器配置
 */
const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: 'fingerprint', phone: '', email: '', notes: '', envVars: [] },
  { id: 'work', name: '工作', color: '#3B82F6', icon: 'briefcase', phone: '', email: '', notes: '', envVars: [] },
  { id: 'personal', name: '个人', color: '#10B981', icon: 'user', phone: '', email: '', notes: '', envVars: [] },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: 'bank', phone: '', email: '', notes: '', envVars: [] },
];

/**
 * 生成容器 ID
 * 支持中文字符，确保唯一性
 * @param {string} name - 容器名称
 * @returns {string} 生成的容器 ID
 */
function generateContainerId(name) {
  // 基础 ID：转小写，非字母数字中文字符替换为连字符
  let baseId = name
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // 如果 ID 为空，使用随机 ID
  if (!baseId) {
    baseId = 'container';
  }

  // 检查唯一性，如果已存在则追加 UUID 后缀
  let id = baseId;
  if (containers.has(id)) {
    const uuid = crypto.randomUUID().slice(0, 8);
    id = `${baseId}-${uuid}`;
  }

  return id;
}

/**
 * 序列化容器为持久化格式（剥离 session/partition 等运行时字段）
 * 所有写盘路径统一走此函数，新增容器字段时只需改这里
 * @param {Object} c - 内存中的容器对象
 * @returns {Object} 可持久化的纯数据对象
 */
function toPlainContainer(c) {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    envVars: c.envVars,
  };
}

/**
 * 初始化容器
 * 从 electron-store 加载容器配置并创建 Session partition
 */
function initContainers() {
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);

  // 数据迁移：将旧的 emoji 图标转换为 symbol ID
  const EMOJI_TO_SYMBOL = {
    '🌐': 'fingerprint',
    '💼': 'briefcase',
    '👤': 'user',
    '🏦': 'bank',
    '🎮': 'game',
    '📚': 'book',
    '🛒': 'cart',
    '💰': 'dollar',
    '🏠': 'home',
    '📧': 'mail',
    '🔬': 'science',
    '🎵': 'music',
    '📱': 'phone',
    '✈️': 'plane',
    '🎨': 'palette',
    '🔧': 'wrench',
    '📊': 'chart',
    '🏢': 'building',
    '🎯': 'target',
    '🛡️': 'shield',
    '📌': 'fingerprint',
  };

  let needsMigration = false;
  savedContainers.forEach(container => {
    if (EMOJI_TO_SYMBOL[container.icon]) {
      container.icon = EMOJI_TO_SYMBOL[container.icon];
      needsMigration = true;
    }
  });

  if (needsMigration) {
    configStore.set('containers', savedContainers);
    console.log('[Realm] 已将 emoji 图标迁移为 symbol 图标');
  }

  savedContainers.forEach(container => {
    const partition = `persist:container-${container.id}`;
    const ses = session.fromPartition(partition);

    // 实时监听 cookie 变更，阻止 .www cookie 在 session 中累积
    // 服务端（Keycloak）会在浏览过程中往 .www 域设 cookie，
    // 导致请求头翻倍触发 nginx 400 Bad Request
    ses.cookies.on('changed', (event, cookie, cause, removed) => {
      if (removed || !cookie.domain.startsWith('.www.')) return;
      // 异步删除，避免阻塞 cookie 变更回调
      const bareDomain = cookie.domain.slice(1);
      const protocol = cookie.secure ? 'https' : 'http';
      const url = `${protocol}://${bareDomain}${cookie.path || '/'}`;
      ses.cookies.set({
        url,
        name: cookie.name,
        value: '',
        domain: cookie.domain,
        path: cookie.path || '/',
        expirationDate: 0,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
      }).then(() => {
        console.log(`[Realm] 实时去重: 移除 ${cookie.domain}|${cookie.name}`);
      }).catch(() => {});
    });

    containers.set(container.id, {
      ...container,
      session: ses,
      partition,
    });

    console.log(`[Realm] 初始化容器: ${container.name} (${partition})`);
  });
}

/**
 * 获取所有容器配置（不含 session 对象）
 * 惰性填充 phone/email/notes 字段，兼容旧版本数据（per D-09, D-10）
 * @returns {Array<{id: string, name: string, color: string, icon: string, phone: string, email: string, notes: string}>}
 */
function getContainers() {
  return Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    phone: c.phone || '',
    email: c.email || '',
    notes: c.notes || '',
    envVars: c.envVars || [],
  }));
}

/**
 * 获取单个容器配置
 * @param {string} id - 容器 ID
 * @returns {Object|undefined} 容器配置或 undefined
 */
function getContainer(id) {
  return containers.get(id);
}

/**
 * 创建新容器
 * @param {Object} config - 容器配置
 * @param {string} config.name - 容器名称（必填）
 * @param {string} [config.color='#6B7280'] - 容器颜色
 * @param {string} [config.icon='fingerprint'] - 容器图标（symbol ID）
 * @param {string} [config.phone=''] - 手机号（可选）
 * @param {string} [config.email=''] - 邮箱（可选）
 * @param {string} [config.notes=''] - 备注（可选）
 * @returns {Object} 创建的容器配置
 * @throws {Error} 名称为空时抛出错误
 */
function createContainer({ name, color = '#6B7280', icon = 'fingerprint', phone = '', email = '', notes = '', envVars = [] }) {
  // 验证名称非空
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('容器名称不能为空');
  }

  const id = generateContainerId(name.trim());
  const container = {
    id,
    name: name.trim(),
    color,
    icon,
    phone: phone || '',
    email: email || '',
    notes: notes || '',
    envVars: Array.isArray(envVars) ? envVars : [],
  };

  // 保存到配置
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers.push(toPlainContainer(container));
  configStore.set('containers', savedContainers);

  // 初始化容器 session
  const partition = `persist:container-${id}`;
  const ses = session.fromPartition(partition);

  containers.set(id, {
    ...container,
    session: ses,
    partition,
  });

  console.log(`[Realm] 新建容器: ${name} (${partition})`);
  return container;
}

/**
 * 更新容器配置
 * @param {string} id - 容器 ID
 * @param {Object} updates - 更新内容
 * @param {string} [updates.name] - 新名称
 * @param {string} [updates.color] - 新颜色
 * @param {string} [updates.icon] - 新图标
 * @param {string} [updates.phone] - 新手机号
 * @param {string} [updates.email] - 新邮箱
 * @param {string} [updates.notes] - 新备注
 * @returns {Object|undefined} 更新后的容器配置或 undefined
 */
function updateContainer(id, { name, color, icon, phone, email, notes, envVars }) {
  const container = containers.get(id);
  if (!container) {
    console.error(`[Realm] 容器不存在: ${id}`);
    return undefined;
  }

  // 更新容器属性
  if (name !== undefined) container.name = name;
  if (color !== undefined) container.color = color;
  if (icon !== undefined) container.icon = icon;
  if (phone !== undefined) container.phone = phone;
  if (email !== undefined) container.email = email;
  if (notes !== undefined) container.notes = notes;
  if (envVars !== undefined) container.envVars = Array.isArray(envVars) ? envVars : [];

  // 更新 Map
  containers.set(id, container);

  // 持久化到配置
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  const index = savedContainers.findIndex(c => c.id === id);
  if (index !== -1) {
    savedContainers[index] = toPlainContainer(container);
  }
  configStore.set('containers', savedContainers);

  console.log(`[Realm] 更新容器: ${id}`);
  return toPlainContainer(container);
}

/**
 * 删除容器
 * 异步流程：先 await 清空 session 存储（停止写入并刷盘），
 * 再删除 Cookie JSON 与 Partitions 目录，避免清理未完成时 rmSync 竞态
 * @param {string} id - 容器 ID
 * @returns {Promise<{success: boolean, message?: string}>} 操作结果
 */
async function deleteContainer(id) {
  // 拒绝删除默认容器
  if (id === 'default') {
    return { success: false, message: '无法删除默认容器' };
  }

  const container = containers.get(id);
  if (!container) {
    return { success: false, message: '容器不存在' };
  }

  // 清空容器 session 数据（必须 await：异步刷盘未完成时删目录会被重建）
  try {
    await container.session.clearStorageData();
  } catch (error) {
    console.error(`[Realm] 清空容器 session 数据失败: ${id}`, error);
  }
  containers.delete(id);

  // 删除容器的 Cookie 文件和 Session 数据（D-01, D-02）
  await cookieManager.deleteCookies(id);

  // 删除容器的 AI 记忆文件（D-05 容器生命周期联动，T-43-05 残留防护）
  // 惰性 require：避开 electron-store 顶层依赖链（纯 Node 环境语法检查可加载本模块）；
  // 必须 await：删除方保证原子性，不能靠懒读取兜底（清盘未完成时用户可能立即
  // memory_read 到已删容器记忆，或进程退出时清理中断）。日志由 manager 内记录。
  await require('./ai-memory-manager').deleteContainerMemory(id);

  // 从配置中移除
  let savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers = savedContainers.filter(c => c.id !== id);
  configStore.set('containers', savedContainers);

  console.log(`[Realm] 删除容器: ${id}`);
  return { success: true };
}

/**
 * 获取容器的 Cookie
 * @param {string} containerId - 容器 ID
 * @returns {Promise<Array>} Cookie 数组
 */
async function getContainerCookies(containerId) {
  const container = containers.get(containerId);
  if (!container || !container.session) {
    return [];
  }

  try {
    const cookies = await container.session.cookies.get({});
    return cookies;
  } catch (error) {
    console.error(`[Realm] 获取容器 Cookie 失败: ${containerId}`, error);
    return [];
  }
}

/**
 * 清除容器的所有 Cookie
 * @param {string} containerId - 容器 ID
 * @returns {Promise<boolean>} 是否成功清除
 */
async function clearContainerCookies(containerId) {
  const container = containers.get(containerId);
  if (!container || !container.session) {
    return false;
  }

  try {
    await container.session.clearStorageData({ storages: ['cookies'] });
    console.log(`[Realm] 已清除容器 Cookie: ${containerId}`);
    return true;
  } catch (error) {
    console.error(`[Realm] 清除容器 Cookie 失败: ${containerId}`, error);
    return false;
  }
}

/**
 * 重排容器顺序
 * @param {string[]} orderedIds - 新的容器 ID 顺序数组
 * @returns {{success: boolean}} 操作结果
 * @throws {Error} 容器 ID 不存在时抛出错误
 */
function reorderContainers(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('orderedIds 必须是非空数组');
  }

  // 验证所有 ID 都存在
  for (const id of orderedIds) {
    if (!containers.has(id)) {
      throw new Error(`容器不存在: ${id}`);
    }
  }

  // 按新顺序重建 Map
  const newMap = new Map();
  for (const id of orderedIds) {
    newMap.set(id, containers.get(id));
  }
  containers.clear();
  newMap.forEach((value, key) => containers.set(key, value));

  // 持久化（剥离 session 字段）
  const plainContainers = orderedIds.map(id => toPlainContainer(containers.get(id)));
  configStore.set('containers', plainContainers);

  console.log(`[Realm] 容器排序已更新: ${orderedIds.join(', ')}`);
  return { success: true };
}

module.exports = {
  initContainers,
  getContainers,
  getContainer,
  createContainer,
  updateContainer,
  deleteContainer,
  getContainerCookies,
  clearContainerCookies,
  reorderContainers,
};
