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
  { id: 'default', name: '默认', color: '#6B7280', icon: '🌐' },
  { id: 'work', name: '工作', color: '#3B82F6', icon: '💼' },
  { id: 'personal', name: '个人', color: '#10B981', icon: '👤' },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦' },
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
 * 初始化容器
 * 从 electron-store 加载容器配置并创建 Session partition
 */
function initContainers() {
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);

  savedContainers.forEach(container => {
    const partition = `persist:container-${container.id}`;
    const ses = session.fromPartition(partition);

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
 * @returns {Array<{id: string, name: string, color: string, icon: string}>}
 */
function getContainers() {
  return Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
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
 * @param {string} [config.icon='📌'] - 容器图标
 * @returns {Object} 创建的容器配置
 * @throws {Error} 名称为空时抛出错误
 */
function createContainer({ name, color = '#6B7280', icon = '📌' }) {
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
  };

  // 保存到配置
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers.push(container);
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
 * @returns {Object|undefined} 更新后的容器配置或 undefined
 */
function updateContainer(id, { name, color, icon }) {
  const container = containers.get(id);
  if (!container) {
    console.error(`[Realm] 容器不存在: ${id}`);
    return undefined;
  }

  // 更新容器属性
  if (name !== undefined) container.name = name;
  if (color !== undefined) container.color = color;
  if (icon !== undefined) container.icon = icon;

  // 更新 Map
  containers.set(id, container);

  // 持久化到配置
  const savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  const index = savedContainers.findIndex(c => c.id === id);
  if (index !== -1) {
    savedContainers[index] = {
      id: container.id,
      name: container.name,
      color: container.color,
      icon: container.icon,
    };
  }
  configStore.set('containers', savedContainers);

  console.log(`[Realm] 更新容器: ${id}`);
  return {
    id: container.id,
    name: container.name,
    color: container.color,
    icon: container.icon,
  };
}

/**
 * 删除容器
 * @param {string} id - 容器 ID
 * @returns {{success: boolean, message?: string}} 操作结果
 */
function deleteContainer(id) {
  // 拒绝删除默认容器
  if (id === 'default') {
    return { success: false, message: '无法删除默认容器' };
  }

  const container = containers.get(id);
  if (!container) {
    return { success: false, message: '容器不存在' };
  }

  // 清理容器 session 数据
  container.session.clearStorageData();
  containers.delete(id);

  // 删除容器的 Cookie 文件和 Session 数据（D-01, D-02）
  cookieManager.deleteCookies(id);

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

module.exports = {
  initContainers,
  getContainers,
  getContainer,
  createContainer,
  updateContainer,
  deleteContainer,
  getContainerCookies,
  clearContainerCookies,
};
