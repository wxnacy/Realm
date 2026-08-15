/**
 * Realm Browser - Tab 管理器
 *
 * 管理浏览器 Tab 的生命周期、状态和持久化
 * 与 container-manager.js 架构一致（模块导出函数，不互相 require）
 *
 * 多窗口支持（Phase 35）：
 * - 每个 Tab 对象包含 windowId 字段，标识其所属窗口
 * - activeTabs: Map<windowId, tabId> 按窗口维护活动 Tab
 * - getTabsByWindowId/closeTabsByWindowId 支持按窗口操作
 */

const Store = require('electron-store');

// Tab 存储实例
const store = new Store({ name: 'tabs' });

// Tab 运行时状态
const tabs = new Map();
// 活动 Tab 映射：Map<windowId, tabId>，按窗口维护当前活动 Tab（Phase 35 D-22）
const activeTabs = new Map();
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
 * 支持新版 activeTabs Map 格式和旧版单一 activeTabId 格式的兼容回落
 */
function initTabs() {
  // 损坏数据防御（WR-10）：store.get 仅在 key 不存在时回落默认值；
  // store 文件被手工编辑或损坏导致类型不符时，直接使用会抛 TypeError，
  // 主进程将在 app.whenReady 中崩溃，应用无法启动
  const savedTabs = store.get('tabs', []);
  const savedCounter = store.get('tabCounter', 0);
  const savedActiveTabId = store.get('activeTabId', null);
  const savedActiveTabs = store.get('activeTabs', null);

  // 恢复 Tab 列表（逐项校验形状，跳过非法条目）
  if (Array.isArray(savedTabs)) {
    savedTabs.forEach(tab => {
      if (tab && typeof tab === 'object' && typeof tab.id === 'string') {
        // 兼容旧数据：无 windowId 的 Tab 默认归属主窗口（null）
        if (tab.windowId === undefined) {
          tab.windowId = null;
        }
        tabs.set(tab.id, tab);
      }
    });
  } else {
    console.warn('[Realm] 持久化 Tab 数据损坏（tabs 非数组），已忽略');
  }

  // 恢复计数器（类型校验，损坏时归零）
  tabCounter = Number.isInteger(savedCounter) && savedCounter >= 0 ? savedCounter : 0;

  // 恢复活动 Tab 映射
  // 优先使用新版 activeTabs Map 格式
  if (savedActiveTabs && typeof savedActiveTabs === 'object' && !Array.isArray(savedActiveTabs)) {
    for (const [windowId, tabId] of Object.entries(savedActiveTabs)) {
      if (typeof tabId === 'string' && tabs.has(tabId)) {
        // windowId 从 JSON 恢复后是字符串，转回数字（null 保持 null）
        const wid = windowId === 'null' ? null : Number(windowId);
        activeTabs.set(wid, tabId);
      }
    }
  }

  // 兼容旧版单一 activeTabId 格式：如果新版 Map 为空且旧版 activeTabId 存在
  if (activeTabs.size === 0 && typeof savedActiveTabId === 'string' && tabs.has(savedActiveTabId)) {
    const tab = tabs.get(savedActiveTabId);
    activeTabs.set(tab.windowId || null, savedActiveTabId);
  }

  // 兜底：如果仍然为空但有 Tab，选第一个
  if (activeTabs.size === 0 && tabs.size > 0) {
    const firstTab = tabs.values().next().value;
    activeTabs.set(firstTab.windowId || null, firstTab.id);
  }

  console.log(`[Realm] Tab 管理器初始化，恢复 ${tabs.size} 个 Tab，${activeTabs.size} 个活动映射`);
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
 * 获取指定窗口的活动 Tab
 * @param {number|null} [windowId] - 窗口 ID，不传时返回第一个活动 Tab（兼容旧逻辑）
 * @returns {Object|null} 活动 Tab 对象或 null
 */
function getActiveTab(windowId) {
  if (windowId !== undefined) {
    const tabId = activeTabs.get(windowId);
    return tabId ? tabs.get(tabId) || null : null;
  }
  // 兼容旧逻辑：不传 windowId 时返回第一个活动 Tab
  for (const tabId of activeTabs.values()) {
    return tabs.get(tabId) || null;
  }
  return null;
}

/**
 * 创建新 Tab
 * @param {string} containerId - 容器 ID
 * @param {string} url - 初始 URL
 * @param {number|null} [windowId=null] - 所属窗口 ID
 * @returns {Object} 新创建的 Tab 对象
 */
function createTab(containerId, url = '', windowId = null) {
  // 如果超过上限，回收最久未使用的 Tab
  if (tabs.size >= TAB_MAX_COUNT) {
    recycleOldestTab();
  }

  const tabId = `tab-${++tabCounter}`;
  const tab = {
    id: tabId,
    containerId,
    windowId: windowId || null,
    url: url || '',
    title: '新标签页',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  tabs.set(tabId, tab);
  activeTabs.set(tab.windowId, tabId);
  saveTabs();

  console.log(`[Realm] Tab 创建: ${tabId} (容器: ${containerId}, 窗口: ${tab.windowId})`);

  return tab;
}

/**
 * 切换到指定 Tab
 * 根据 tab.windowId 更新对应窗口的活动 Tab
 * @param {string} tabId - Tab ID
 * @returns {boolean} 是否成功切换
 */
function switchTab(tabId) {
  if (!tabs.has(tabId)) {
    return false;
  }

  const tab = tabs.get(tabId);
  activeTabs.set(tab.windowId, tabId);
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
  if (updates.faviconUrl !== undefined) tab.faviconUrl = updates.faviconUrl;
  if (updates.pinned !== undefined) tab.pinned = updates.pinned;

  saveTabs();

  return true;
}

/**
 * 关闭 Tab
 * @param {string} tabId - Tab ID
 * @returns {Object} 关闭结果，包含新的活动 Tab ID 和 lastInWindow 标识
 */
function closeTab(tabId) {
  if (!tabs.has(tabId)) {
    return { success: false, message: 'Tab 不存在' };
  }

  const tab = tabs.get(tabId);
  const tabWindowId = tab.windowId;

  // 获取同一窗口的 Tab 数组，找到被关闭 Tab 的索引
  const windowTabArray = Array.from(tabs.values())
    .filter(t => t.windowId === tabWindowId)
    .map(t => t.id);
  const closedIndex = windowTabArray.indexOf(tabId);

  // 删除 Tab
  tabs.delete(tabId);

  // 检查该窗口是否还有剩余 Tab
  const lastInWindow = !Array.from(tabs.values()).some(t => t.windowId === tabWindowId);

  // 确定新的活动 Tab（CR-5 修复）：
  // 仅当被关闭的就是活动 Tab 时才重选；关闭后台 Tab 必须保持活动 Tab 不变，
  // 否则主进程与渲染进程的活动 Tab 状态分裂，且错误状态会被持久化
  const currentActiveId = activeTabs.get(tabWindowId) || null;
  let newActiveTabId = currentActiveId;

  if (tabId === currentActiveId) {
    newActiveTabId = null;
    if (!lastInWindow && windowTabArray.length > 1) {
      // 在同一窗口内切换：优先右侧，其次左侧
      if (closedIndex < windowTabArray.length - 1) {
        newActiveTabId = windowTabArray[closedIndex + 1];
      } else if (closedIndex > 0) {
        newActiveTabId = windowTabArray[closedIndex - 1];
      }
    }
  }

  if (newActiveTabId) {
    activeTabs.set(tabWindowId, newActiveTabId);
  } else {
    activeTabs.delete(tabWindowId);
  }

  saveTabs();

  console.log(`[Realm] Tab 关闭: ${tabId}`);

  return {
    success: true,
    closedTabId: tabId,
    newActiveTabId: newActiveTabId,
    lastInWindow: lastInWindow,
  };
}

/**
 * 回收最久未使用的 Tab
 * @returns {Object|null} 回收结果，如果没有可回收的 Tab 则返回 null
 */
function recycleOldestTab() {
  // 收集所有窗口的活动 Tab ID（这些不可回收）
  const activeTabIds = new Set(activeTabs.values());

  // 找到 lastActiveAt 最小的非活动 Tab
  let oldestTab = null;
  let oldestTime = Infinity;

  tabs.forEach((tab, id) => {
    if (!activeTabIds.has(id) && tab.lastActiveAt < oldestTime) {
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
 * 同时保存 activeTabs Map（多窗口格式）和 activeTabId（兼容旧版读取）
 */
function saveTabs() {
  store.set('tabs', Array.from(tabs.values()));
  store.set('tabCounter', tabCounter);

  // 保存新版 activeTabs Map（Object 格式，JSON 可序列化）
  const activeTabsObj = {};
  for (const [windowId, tabId] of activeTabs) {
    activeTabsObj[String(windowId)] = tabId;
  }
  store.set('activeTabs', activeTabsObj);

  // 兼容旧版：保存第一个活动 Tab ID
  const firstActive = activeTabs.values().next().value || null;
  store.set('activeTabId', firstActive);
}

/**
 * 获取指定窗口的所有 Tab
 * @param {number|null} windowId - 窗口 ID
 * @returns {Array} 该窗口的 Tab 数组
 */
function getTabsByWindowId(windowId) {
  return Array.from(tabs.values()).filter(tab => tab.windowId === windowId);
}

/**
 * 关闭指定窗口的所有 Tab
 * 用于窗口关闭级联（D-16）
 * @param {number|null} windowId - 窗口 ID
 * @returns {Array<string>} 关闭的 Tab ID 列表
 */
function closeTabsByWindowId(windowId) {
  const tabsToClose = getTabsByWindowId(windowId);
  const closedTabIds = [];

  for (const tab of tabsToClose) {
    tabs.delete(tab.id);
    closedTabIds.push(tab.id);
  }

  // 清除该窗口的活动 Tab 映射
  activeTabs.delete(windowId);

  if (closedTabIds.length > 0) {
    saveTabs();
    console.log(`[Realm] 窗口 ${windowId} 的 ${closedTabIds.length} 个 Tab 已关闭`);
  }

  return closedTabIds;
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
  activeTabs.clear();
  saveTabs();
  console.log('[Realm] 已清空所有 Tab（启动时不恢复旧会话）');
}

// 模块导出
module.exports = {
  initTabs,
  getTabs,
  getTab,
  getActiveTab,
  getTabsByWindowId,
  createTab,
  switchTab,
  updateTab,
  closeTab,
  closeTabsByWindowId,
  recycleOldestTab,
  setRecycleListener,
  saveTabs,
  clearAllTabs,
  TAB_MAX_COUNT,
  TAB_RECYCLE_MESSAGE,
};
