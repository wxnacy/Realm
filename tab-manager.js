/**
 * Realm Browser - Tab 管理器
 *
 * 管理浏览器 Tab 的生命周期、状态和持久化
 * 与 container-manager.js 架构一致（模块导出函数，不互相 require）
 */

const Store = require('electron-store');

// Tab 存储实例
const store = new Store({ name: 'tabs' });

// Tab 运行时状态
const tabs = new Map();
let activeTabId = null;
let tabCounter = 0;

// Tab 上限（D-07）
const TAB_MAX_COUNT = 20;

// 回收提示文案（WR-4：回收策略单点实现于主进程，渲染进程经事件获取文案）
const TAB_RECYCLE_MESSAGE = '已自动关闭最久未使用的标签页以释放资源';

// 回收通知回调（WR-4）：由 ipc-handlers 注入，回收发生时向渲染进程推送事件
let recycleListener = null;

/**
 * 设置 Tab 回收通知回调
 * @param {Function|null} listener - 回调函数，参数为 { recycledTabId, message }
 */
function setRecycleListener(listener) {
  recycleListener = typeof listener === 'function' ? listener : null;
}

/**
 * 初始化 Tab 管理器
 * 从 electron-store 恢复上次保存的 Tab 列表
 */
function initTabs() {
  // 损坏数据防御（WR-10）：store.get 仅在 key 不存在时回落默认值；
  // store 文件被手工编辑或损坏导致类型不符时，直接使用会抛 TypeError，
  // 主进程将在 app.whenReady 中崩溃，应用无法启动
  const savedTabs = store.get('tabs', []);
  const savedCounter = store.get('tabCounter', 0);
  const savedActiveTabId = store.get('activeTabId', null);

  // 恢复 Tab 列表（逐项校验形状，跳过非法条目）
  if (Array.isArray(savedTabs)) {
    savedTabs.forEach(tab => {
      if (tab && typeof tab === 'object' && typeof tab.id === 'string') {
        tabs.set(tab.id, tab);
      }
    });
  } else {
    console.warn('[Realm] 持久化 Tab 数据损坏（tabs 非数组），已忽略');
  }

  // 恢复计数器（类型校验，损坏时归零）
  tabCounter = Number.isInteger(savedCounter) && savedCounter >= 0 ? savedCounter : 0;

  // 恢复活动 Tab（类型校验）
  if (typeof savedActiveTabId === 'string' && tabs.has(savedActiveTabId)) {
    activeTabId = savedActiveTabId;
  } else if (tabs.size > 0) {
    activeTabId = tabs.keys().next().value;
  }

  console.log(`[Realm] Tab 管理器初始化，恢复 ${tabs.size} 个 Tab`);
}

/**
 * 获取所有 Tab
 * @returns {Array} Tab 数组
 */
function getTabs() {
  return Array.from(tabs.values());
}

/**
 * 获取指定 Tab
 * @param {string} tabId - Tab ID
 * @returns {Object|null} Tab 对象或 null
 */
function getTab(tabId) {
  return tabs.get(tabId) || null;
}

/**
 * 获取当前活动 Tab
 * @returns {Object|null} 活动 Tab 对象或 null
 */
function getActiveTab() {
  return activeTabId ? tabs.get(activeTabId) : null;
}

/**
 * 创建新 Tab
 * @param {string} containerId - 容器 ID
 * @param {string} url - 初始 URL
 * @returns {Object} 新创建的 Tab 对象
 */
function createTab(containerId, url = '') {
  // 如果超过上限，回收最久未使用的 Tab
  if (tabs.size >= TAB_MAX_COUNT) {
    recycleOldestTab();
  }

  const tabId = `tab-${++tabCounter}`;
  const tab = {
    id: tabId,
    containerId,
    url: url || '',
    title: '新标签页',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  tabs.set(tabId, tab);
  activeTabId = tabId;
  saveTabs();

  console.log(`[Realm] Tab 创建: ${tabId} (容器: ${containerId})`);

  return tab;
}

/**
 * 切换到指定 Tab
 * @param {string} tabId - Tab ID
 * @returns {boolean} 是否成功切换
 */
function switchTab(tabId) {
  if (!tabs.has(tabId)) {
    return false;
  }

  activeTabId = tabId;
  const tab = tabs.get(tabId);
  tab.lastActiveAt = Date.now();
  saveTabs();

  return true;
}

/**
 * 更新 Tab 信息
 * @param {string} tabId - Tab ID
 * @param {Object} updates - 更新的字段
 * @returns {boolean} 是否成功更新
 */
function updateTab(tabId, updates) {
  const tab = tabs.get(tabId);
  if (!tab) {
    return false;
  }

  // 合并更新
  if (updates.url !== undefined) tab.url = updates.url;
  if (updates.title !== undefined) tab.title = updates.title;
  if (updates.lastActiveAt !== undefined) tab.lastActiveAt = updates.lastActiveAt;

  saveTabs();

  return true;
}

/**
 * 关闭 Tab
 * @param {string} tabId - Tab ID
 * @returns {Object} 关闭结果，包含新的活动 Tab ID
 */
function closeTab(tabId) {
  if (!tabs.has(tabId)) {
    return { success: false, message: 'Tab 不存在' };
  }

  // 获取 Tab 数组，找到被关闭 Tab 的索引
  const tabArray = Array.from(tabs.keys());
  const closedIndex = tabArray.indexOf(tabId);

  // 删除 Tab
  tabs.delete(tabId);

  // 确定新的活动 Tab（CR-5 修复）：
  // 仅当被关闭的就是活动 Tab 时才重选；关闭后台 Tab 必须保持 activeTabId 不变，
  // 否则主进程与渲染进程的活动 Tab 状态分裂，且错误状态会被持久化
  let newActiveTabId = activeTabId;
  if (tabId === activeTabId) {
    newActiveTabId = null;
    if (tabs.size > 0) {
      // 切换到右侧 Tab，无右侧则左侧
      if (closedIndex < tabArray.length - 1) {
        newActiveTabId = tabArray[closedIndex + 1];
      } else if (closedIndex > 0) {
        newActiveTabId = tabArray[closedIndex - 1];
      } else {
        newActiveTabId = tabs.keys().next().value;
      }
    }
  }

  activeTabId = newActiveTabId;
  saveTabs();

  console.log(`[Realm] Tab 关闭: ${tabId}`);

  return {
    success: true,
    closedTabId: tabId,
    newActiveTabId: activeTabId,
  };
}

/**
 * 回收最久未使用的 Tab
 * @returns {Object|null} 回收结果，如果没有可回收的 Tab 则返回 null
 */
function recycleOldestTab() {
  // 找到 lastActiveAt 最小的非活动 Tab
  let oldestTab = null;
  let oldestTime = Infinity;

  tabs.forEach((tab, id) => {
    if (id !== activeTabId && tab.lastActiveAt < oldestTime) {
      oldestTime = tab.lastActiveAt;
      oldestTab = tab;
    }
  });

  if (!oldestTab) {
    return null;
  }

  console.log(`[Realm] Tab 回收: ${oldestTab.id} (最久未使用)`);

  // 关闭该 Tab
  const result = closeTab(oldestTab.id);

  // 通知渲染进程移除对应 DOM/webview（WR-4）：主进程静默回收会产生幽灵 Tab
  if (recycleListener) {
    recycleListener({ recycledTabId: oldestTab.id, message: TAB_RECYCLE_MESSAGE });
  }

  return {
    recycledTabId: oldestTab.id,
    message: TAB_RECYCLE_MESSAGE,
    ...result,
  };
}

/**
 * 保存 Tab 列表到 electron-store
 */
function saveTabs() {
  store.set('tabs', Array.from(tabs.values()));
  store.set('tabCounter', tabCounter);
  store.set('activeTabId', activeTabId);
}

/**
 * 清空所有 Tab（含持久化）
 * 用于启动时用户选择"不恢复"或设置 restoreTabsOnLaunch='never'：
 * 主进程 initTabs 已从磁盘加载旧 Tab 到内存 Map，若不清空，
 * 后续新建 Tab 会 append 到旧列表后一起被 saveTabs 写回磁盘，
 * 导致下次启动把已放弃的旧会话一并恢复
 */
function clearAllTabs() {
  tabs.clear();
  activeTabId = null;
  saveTabs();
  console.log('[Realm] 已清空所有 Tab（启动时不恢复旧会话）');
}

// 模块导出
module.exports = {
  initTabs,
  getTabs,
  getTab,
  getActiveTab,
  createTab,
  switchTab,
  updateTab,
  closeTab,
  recycleOldestTab,
  setRecycleListener,
  saveTabs,
  clearAllTabs,
  TAB_MAX_COUNT,
  TAB_RECYCLE_MESSAGE,
};
