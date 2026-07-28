/**
 * Realm Browser - 右键菜单管理模块
 *
 * 构建标签页和网页右键菜单模板，处理菜单项 click 动作。
 * 按 D-02 决策在主进程统一管理所有菜单逻辑，通过 IPC 与渲染进程通信。
 *
 * 模块职责：
 * - buildTabMenu(tabInfo, mainWindow) — 构建标签页右键菜单
 * - buildWebMenu(contextInfo, mainWindow) — 构建网页右键菜单（通用/图片/链接）
 * - closedTabsStack — 已关闭标签栈（LIFO，最多 10 条）
 * - pushClosedTab(info) / hasClosedTabs() — 栈管理方法
 *
 * 菜单使用 Electron 原生 Menu API（D-01），在鼠标位置弹出（D-04）。
 */

const { Menu, clipboard, nativeImage, webContents, dialog } = require('electron');
const fs = require('fs');

// ==================== 已关闭标签栈 ====================

/**
 * 已关闭标签信息栈（LIFO，最多 10 条）
 * 每条记录包含 { containerId, url, title }
 * 用于"重新打开已关闭标签页"功能
 * @type {Array<{containerId: string, url: string, title: string}>}
 */
const closedTabsStack = [];
const CLOSED_TABS_MAX = 10;

/**
 * 将关闭的标签信息压入已关闭栈
 * 超出上限时移除最早的记录
 * @param {Object} tabInfo - 标签信息
 * @param {string} tabInfo.containerId - 容器 ID
 * @param {string} tabInfo.url - 标签 URL
 * @param {string} tabInfo.title - 标签标题
 */
function pushClosedTab(tabInfo) {
  if (!tabInfo || !tabInfo.url) return;
  closedTabsStack.push({
    containerId: tabInfo.containerId || 'default',
    url: tabInfo.url,
    title: tabInfo.title || tabInfo.url,
  });
  if (closedTabsStack.length > CLOSED_TABS_MAX) {
    closedTabsStack.shift();
  }
}

/**
 * 检查是否有已关闭标签可恢复
 * @returns {boolean} 栈是否非空
 */
function hasClosedTabs() {
  return closedTabsStack.length > 0;
}

/**
 * 弹出最近关闭的标签信息
 * @returns {Object|undefined} 标签信息或 undefined
 */
function popClosedTab() {
  return closedTabsStack.pop();
}

// ==================== 辅助函数 ====================

/**
 * 获取 webview guest 的 webContents 对象
 * @param {number} guestContentsId - guest webContents ID
 * @returns {Electron.WebContents|null} webContents 对象，无效时返回 null
 */
function getGuestWebContents(guestContentsId) {
  if (!guestContentsId) return null;
  try {
    const contents = webContents.fromId(guestContentsId);
    if (contents && !contents.isDestroyed()) {
      return contents;
    }
  } catch (err) {
    console.error('[Realm] 获取 guest webContents 失败:', err.message);
  }
  return null;
}

/**
 * 下载图片数据（支持 http/https URL 和 data: URL）
 * @param {string} imageURL - 图片 URL
 * @param {Electron.Session} [session] - 用于继承容器 cookie/referer 的 session
 * @returns {Promise<{buffer: Buffer, mimeType: string}>} 图片二进制数据与 MIME 类型
 */
async function fetchImageBuffer(imageURL, session) {
  if (imageURL.startsWith('data:')) {
    // data: URL：直接 base64 解码
    const matches = imageURL.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('无效的 data: URL 格式');
    }
    return { buffer: Buffer.from(matches[2], 'base64'), mimeType: matches[1] };
  }

  // http/https URL：使用 Electron net 模块下载（传入 session 继承 cookie）
  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const request = net.request(session ? { url: imageURL, session } : imageURL);
    const chunks = [];
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const contentType = response.headers['content-type'] || '';
      const mimeType = contentType.split(';')[0].trim() || 'image/png';
      response.on('data', (chunk) => { chunks.push(chunk); });
      response.on('end', () => { resolve({ buffer: Buffer.concat(chunks), mimeType }); });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

/**
 * 通过隐藏 offscreen 窗口的 Chromium 解码图片为 PNG nativeImage
 * 用于 webp/avif/gif 等 nativeImage.createFromBuffer 不支持的格式
 * @param {Buffer} imageBuffer - 图片二进制数据
 * @param {string} mimeType - 图片 MIME 类型
 * @returns {Promise<Electron.NativeImage>} 解码后的 PNG 图像
 */
async function decodeImageViaChromium(imageBuffer, mimeType) {
  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });
  try {
    await win.loadURL('about:blank');
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    // about:blank 无 CSP，data: URL 图片不污染 canvas，可安全 toDataURL
    const pngDataUrl = await win.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (!img.naturalWidth || !img.naturalHeight) {
            reject(new Error('图片尺寸为空'));
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('图片解码失败'));
        img.src = ${JSON.stringify(dataUrl)};
      });
    `);
    const image = nativeImage.createFromDataURL(pngDataUrl);
    if (image.isEmpty()) {
      throw new Error('图片解码失败');
    }
    return image;
  } finally {
    win.destroy();
  }
}

/**
 * 复制图片到剪贴板
 * 支持 http/https URL 和 data: URL
 * @param {string} imageURL - 图片 URL
 * @param {Electron.WebContents} hostWebContents - 用于发送 toast 的 host webContents
 * @param {Electron.Session} [session] - 用于继承容器 cookie 的 session
 */
async function copyImageToClipboard(imageURL, hostWebContents, session) {
  try {
    const { buffer, mimeType } = await fetchImageBuffer(imageURL, session);
    let image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) {
      // webp/avif 等格式 nativeImage 不支持，走 Chromium 解码转 PNG
      image = await decodeImageViaChromium(buffer, mimeType);
    }
    clipboard.writeImage(image);
    sendToast(hostWebContents, '已复制');
  } catch (err) {
    console.error('[Realm] 复制图片失败:', err.message);
    sendToast(hostWebContents, '复制失败');
  }
}

/**
 * 发送 toast 通知给渲染进程
 * @param {Electron.WebContents} hostWebContents - 主窗口 webContents
 * @param {string} message - toast 消息
 */
function sendToast(hostWebContents, message) {
  if (hostWebContents && !hostWebContents.isDestroyed()) {
    hostWebContents.send('context-menu:toast', { message });
  }
}

// ==================== 通用菜单模板 ====================

/**
 * 构建通用网页菜单项（导航 + 页面操作 + 开发者工具 + 文本编辑）
 * 可独立使用，也可追加到图片/链接菜单之后
 *
 * @param {Object} contextInfo - 上下文信息
 * @param {boolean} contextInfo.canGoBack - 是否可后退
 * @param {boolean} contextInfo.canGoForward - 是否可前进
 * @param {boolean} contextInfo.isLoading - 页面是否加载中
 * @param {string} contextInfo.pageURL - 当前页面 URL
 * @param {Object} contextInfo.editFlags - 编辑能力标志
 * @param {boolean} contextInfo.editFlags.canCut - 是否可剪切
 * @param {boolean} contextInfo.editFlags.canCopy - 是否可复制
 * @param {boolean} contextInfo.editFlags.canPaste - 是否可粘贴
 * @param {Electron.WebContents} guestWebContents - guest webContents
 * @param {Electron.WebContents} hostWebContents - 主窗口 webContents
 * @returns {Array<Object>} Electron 菜单模板数组
 */
function buildGeneralMenuItems(contextInfo, guestWebContents, hostWebContents) {
  const editFlags = contextInfo.editFlags || {};
  return [
    // 导航分组
    {
      label: '后退',
      accelerator: 'CmdOrCtrl+[',
      enabled: !!contextInfo.canGoBack,
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.goBack();
        }
      },
    },
    {
      label: '前进',
      accelerator: 'CmdOrCtrl+]',
      enabled: !!contextInfo.canGoForward,
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.goForward();
        }
      },
    },
    {
      label: '刷新',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.reload();
        }
      },
    },
    {
      label: '停止加载',
      enabled: !!contextInfo.isLoading,
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.stop();
        }
      },
    },
    { type: 'separator' },
    // 页面操作分组
    {
      label: '另存为…',
      accelerator: 'CmdOrCtrl+S',
      click: async () => {
        if (!guestWebContents || guestWebContents.isDestroyed()) return;
        try {
          const pageTitle = (guestWebContents.getTitle() || 'page').replace(/[\\/:*?"<>|]/g, '_');
          const { filePath, canceled } = await dialog.showSaveDialog({
            defaultPath: `${pageTitle}.html`,
          });
          if (canceled || !filePath) return;
          await guestWebContents.savePage(filePath, 'HTMLComplete');
          sendToast(hostWebContents, '已保存');
        } catch (err) {
          console.error('[Realm] 页面另存为失败:', err.message);
          sendToast(hostWebContents, '保存失败');
        }
      },
    },
    {
      label: '打印…',
      accelerator: 'CmdOrCtrl+P',
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.print();
        }
      },
    },
    {
      label: '添加到收藏夹',
      accelerator: 'CmdOrCtrl+D',
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:add-to-favorites', {
            url: contextInfo.pageURL || '',
            title: contextInfo.pageTitle || contextInfo.pageURL || '',
          });
        }
      },
    },
    { type: 'separator' },
    // 开发者工具分组
    {
      label: '查看页面源代码',
      accelerator: 'CmdOrCtrl+U',
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:open-in-new-tab', {
            url: `view-source:${contextInfo.pageURL || ''}`,
          });
        }
      },
    },
    {
      label: '检查元素',
      accelerator: 'CmdOrCtrl+Shift+C',
      click: () => {
        if (guestWebContents && !guestWebContents.isDestroyed()) {
          guestWebContents.openDevTools({ mode: 'detach' });
        }
      },
    },
    { type: 'separator' },
    // 文本编辑分组（per D-16）
    {
      label: '剪切',
      accelerator: 'CmdOrCtrl+X',
      enabled: !!editFlags.canCut,
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:text-action', { action: 'cut' });
        }
      },
    },
    {
      label: '复制',
      accelerator: 'CmdOrCtrl+C',
      enabled: !!editFlags.canCopy,
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:text-action', { action: 'copy' });
        }
      },
    },
    {
      label: '粘贴',
      accelerator: 'CmdOrCtrl+V',
      enabled: !!editFlags.canPaste,
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:text-action', { action: 'paste' });
        }
      },
    },
    {
      label: '全选',
      accelerator: 'CmdOrCtrl+A',
      click: () => {
        if (hostWebContents && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:text-action', { action: 'selectAll' });
        }
      },
    },
  ];
}

// ==================== 标签页右键菜单 ====================

/**
 * 构建标签页右键菜单
 *
 * 菜单项顺序（per UI-SPEC.md Tab Context Menu）：
 * 1. 关闭标签页（CmdOrCtrl+W）
 * 2. 关闭其他标签页（tabCount > 1 时启用）
 * 3. 关闭左侧标签页（tabIndex > 0 时启用）
 * 4. 关闭右侧标签页（tabIndex < tabCount - 1 时启用）
 * 5. separator
 * 6. 重新打开已关闭标签页（CmdOrCtrl+Shift+T，hasClosedTabs 时启用）
 * 7. separator
 * 8. 固定/取消固定标签页（根据 isPinned 动态切换 label）
 *
 * @param {Object} tabInfo - 标签上下文信息
 * @param {string} tabInfo.tabId - 右键点击的标签 ID
 * @param {number} tabInfo.tabCount - 总标签数
 * @param {number} tabInfo.tabIndex - 右键标签的索引
 * @param {boolean} tabInfo.isPinned - 是否已固定
 * @param {boolean} tabInfo.hasClosedTabs - 是否有已关闭标签可恢复
 * @param {Electron.BrowserWindow} mainWindow - 主窗口
 * @returns {Electron.Menu} 构建好的菜单对象
 */
function buildTabMenu(tabInfo, mainWindow) {
  if (!mainWindow) return null;
  const hostWebContents = mainWindow.webContents;

  const template = [
    {
      label: '关闭标签页',
      accelerator: 'CmdOrCtrl+W',
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:close-tab', { tabId: tabInfo.tabId });
        }
      },
    },
    {
      label: '关闭其他标签页',
      enabled: tabInfo.tabCount > 1,
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:close-other-tabs', { tabId: tabInfo.tabId });
        }
      },
    },
    {
      label: '关闭左侧标签页',
      enabled: tabInfo.tabIndex > 0,
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:close-left-tabs', { tabId: tabInfo.tabId });
        }
      },
    },
    {
      label: '关闭右侧标签页',
      enabled: tabInfo.tabIndex < tabInfo.tabCount - 1,
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:close-right-tabs', { tabId: tabInfo.tabId });
        }
      },
    },
    { type: 'separator' },
    {
      label: '重新打开已关闭标签页',
      accelerator: 'CmdOrCtrl+Shift+T',
      enabled: hasClosedTabs(),
      click: () => {
        const closedTab = popClosedTab();
        if (closedTab && !hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:reopen-tab', closedTab);
        }
      },
    },
    { type: 'separator' },
    {
      label: tabInfo.isPinned ? '取消固定' : '固定标签页',
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:toggle-pin', { tabId: tabInfo.tabId });
        }
      },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
  return menu;
}

// ==================== 网页右键菜单 ====================

/**
 * 构建网页右键菜单
 *
 * 根据 contextInfo.type 动态生成不同菜单：
 * - 'image' — 图片专属菜单（4 项）+ 通用菜单
 * - 'link' — 链接专属菜单（4 项 + 容器子菜单）+ 通用菜单
 * - 'general' — 仅通用菜单
 *
 * @param {Object} contextInfo - 上下文信息
 * @param {string} contextInfo.type - 元素类型：'image' | 'link' | 'general'
 * @param {string} contextInfo.linkURL - 链接 URL（type=link 时有值）
 * @param {string} contextInfo.srcURL - 图片/媒体 URL（type=image 时有值）
 * @param {string} contextInfo.mediaType - 媒体类型
 * @param {string} contextInfo.selectionText - 选中文本
 * @param {boolean} contextInfo.canGoBack - 是否可后退
 * @param {boolean} contextInfo.canGoForward - 是否可前进
 * @param {boolean} contextInfo.isLoading - 页面是否加载中
 * @param {string} contextInfo.pageURL - 当前页面 URL
 * @param {Object} contextInfo.editFlags - 编辑能力标志
 * @param {number} contextInfo.guestContentsId - guest webContents ID
 * @param {Array<Object>} contextInfo.containers - 容器列表（用于链接菜单的容器子菜单）
 * @param {Electron.BrowserWindow} mainWindow - 主窗口
 * @returns {Electron.Menu} 构建好的菜单对象
 */
function buildWebMenu(contextInfo, mainWindow) {
  if (!mainWindow) return null;
  const hostWebContents = mainWindow.webContents;
  const guestWebContents = getGuestWebContents(contextInfo.guestContentsId);

  let specificItems = [];

  // 图片菜单（per D-17 + UI-SPEC.md Image Context Menu）
  if (contextInfo.type === 'image' && contextInfo.srcURL) {
    specificItems = [
      {
        label: '在新标签页中打开图片',
        click: () => {
          if (!hostWebContents.isDestroyed()) {
            hostWebContents.send('context-menu:open-in-new-tab', { url: contextInfo.srcURL });
          }
        },
      },
      {
        label: '将图片另存为…',
        click: async () => {
          if (!guestWebContents || guestWebContents.isDestroyed()) return;
          try {
            const url = contextInfo.srcURL;
            const urlPath = url.split('?')[0];
            const ext = (urlPath.match(/\.([a-zA-Z0-9]{2,5})$/) || [])[1] || 'png';
            const { filePath, canceled } = await dialog.showSaveDialog({
              defaultPath: `image.${ext}`,
            });
            if (canceled || !filePath) return;
            // 用 guest session 下载（继承容器 cookie/referer，bilibili 等防盗链图片可正常下载）
            const { buffer } = await fetchImageBuffer(url, guestWebContents.session);
            fs.writeFileSync(filePath, buffer);
            sendToast(hostWebContents, '已保存');
          } catch (err) {
            console.error('[Realm] 图片另存为失败:', err.message);
            sendToast(hostWebContents, '保存失败');
          }
        },
      },
      {
        label: '复制图片',
        click: () => {
          // 传 guest session（与另存为一致，防盗链图片可正常下载）
          copyImageToClipboard(
            contextInfo.srcURL,
            hostWebContents,
            guestWebContents && !guestWebContents.isDestroyed() ? guestWebContents.session : undefined
          );
        },
      },
      {
        label: '复制图片地址',
        click: () => {
          clipboard.writeText(contextInfo.srcURL);
          sendToast(hostWebContents, '已复制');
        },
      },
      { type: 'separator' },
    ];
  }

  // 链接菜单（per D-18 + UI-SPEC.md Link Context Menu）
  if (contextInfo.type === 'link' && contextInfo.linkURL) {
    // 构建容器子菜单
    const containers = contextInfo.containers || [];
    const containerSubmenu = containers.map((container) => ({
      label: `${container.icon || ''} ${container.name || container.id}`,
      click: () => {
        if (!hostWebContents.isDestroyed()) {
          hostWebContents.send('context-menu:open-in-container', {
            url: contextInfo.linkURL,
            containerId: container.id,
          });
        }
      },
    }));

    specificItems = [
      {
        label: '在新标签页中打开链接',
        click: () => {
          if (!hostWebContents.isDestroyed()) {
            hostWebContents.send('context-menu:open-in-new-tab', { url: contextInfo.linkURL });
          }
        },
      },
      {
        label: '在后台标签页中打开',
        click: () => {
          if (!hostWebContents.isDestroyed()) {
            hostWebContents.send('context-menu:open-in-bg-tab', { url: contextInfo.linkURL });
          }
        },
      },
      { type: 'separator' },
      {
        label: '在新容器标签页中打开',
        submenu: containerSubmenu.length > 0
          ? containerSubmenu
          : [{ label: '无可用容器', enabled: false }],
      },
      { type: 'separator' },
      {
        label: '复制链接地址',
        click: () => {
          clipboard.writeText(contextInfo.linkURL);
          sendToast(hostWebContents, '已复制');
        },
      },
      { type: 'separator' },
    ];
  }

  // 通用菜单项
  const generalItems = buildGeneralMenuItems(contextInfo, guestWebContents, hostWebContents);

  const template = [...specificItems, ...generalItems];
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
  return menu;
}

// ==================== 导出 ====================

module.exports = {
  buildTabMenu,
  buildWebMenu,
  pushClosedTab,
  hasClosedTabs,
  popClosedTab,
};
