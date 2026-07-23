# Technology Stack — 多容器隔离浏览器

**Project:** Realm Browser
**Researched:** 2026-07-23
**Mode:** Ecosystem

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | ^36.0.0 (推荐 36.3.1) | 桌面应用框架 | **必须升级**：当前 ^32.0.0 已结束支持。Electron 30 起 BrowserView 被标记为 Deprecated，WebContentsView 成为官方推荐。Electron 36 是当前受支持的 LTS 版本，Chromium 136 + Node 22.14 |
| Node.js | 22.x | 主进程运行时 | Electron 36 内置 Node 22.14.0，与 LTS 对齐 |

**关键决策：BrowserView vs WebContentsView**

当前代码使用 `BrowserWindow`（隐式使用 Browser 模式）。要实现多 Tab 多容器架构，必须迁移到 `BaseWindow + WebContentsView`：

| 特性 | BrowserView (已废弃) | WebContentsView (推荐) |
|------|---------------------|----------------------|
| 状态 | Electron 30 起 Deprecated | 官方推荐替代 |
| 多视图 | 不支持，一个窗口只能一个 BrowserView | 原生支持多个 addChildView() |
| 基类 | 独立类 | 继承自 View，可组合 |
| 自动缩放 | setAutoResize() | 需手动实现 resize 监听 |
| 默认背景 | 透明 | 白色（需手动设为透明） |

**迁移代码模式：**
```javascript
// 旧模式（当前）
const win = new BrowserWindow({ ... });
win.loadFile('src/index.html');

// 新模式（推荐）
const { BaseWindow, WebContentsView } = require('electron');
const win = new BaseWindow({ width: 1400, height: 900 });

// UI 层作为根视图
const uiView = new WebContentsView();
win.contentView.addChildView(uiView);
uiView.setBounds({ x: 0, y: 0, width: 1400, height: 900 });
uiView.webContents.loadFile('src/index.html');

// 每个 Tab 是独立的 WebContentsView
const tabView = new WebContentsView({
  webPreferences: { session: containerSession }
});
win.contentView.addChildView(tabView);
tabView.setBounds({ x: 0, y: 100, width: 1400, height: 800 });
```

### Session & Cookie Management

| Technology | Purpose | Why |
|------------|---------|-----|
| Electron Session API (内置) | 容器隔离核心 | 使用 `session.fromPartition('persist:container-xxx')` 实现完全隔离，稳定可靠 |
| session.cookies (内置) | Cookie 读写 | 提供 get/set/remove/changed 事件，无需第三方库 |
| electron-store ^11.0.0 | 容器配置持久化 | 当前 ^8.1.0 可用，但 11.x 有更好的 TypeScript 支持和性能 |

**Session 隔离机制（当前实现已正确）：**
```javascript
// 每个容器独立 partition，persist: 前缀确保跨重启持久化
const partition = `persist:container-${containerId}`;
const ses = session.fromPartition(partition);

// Cookie 持久化由 Electron 自动管理（30秒或512次操作后刷盘）
// 手动触发刷盘：ses.cookies.flushStore()
```

**Cookie 持久化策略（两种方案对比）：**

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| Electron 内置 persist: 原生持久化 | 零代码、自动管理、高性能 | 数据格式不可读、迁移困难 | **推荐作为主方案** |
| 自定义 JSON 文件导出 | 可读、便于备份迁移 | 需手动同步、性能开销 | 作为辅助功能（导入/导出） |

**建议：** 使用 Electron 内置持久化作为主方案，JSON 文件作为导入/导出功能。

### Tab Management Architecture

| Technology | Purpose | Why |
|------------|---------|-----|
| BaseWindow + WebContentsView | 多 Tab 容器 | 原生支持多视图，每个 Tab 是独立 WebContentsView |
| 自定义 Tab Manager | Tab 生命周期管理 | 无成熟第三方库，需自建 |

**Tab 管理核心模式：**
```javascript
class TabManager {
  constructor(baseWindow) {
    this.win = baseWindow;
    this.tabs = new Map(); // tabId -> { view, containerId, url }
    this.activeTabId = null;
    this.uiView = null; // 工具栏和 Tab 栏
  }

  /**
   * 创建新 Tab
   * @param {string} containerId - 容器 ID
   * @param {string} url - 初始 URL
   */
  createTab(containerId, url = 'about:blank') {
    const tabId = `tab-${Date.now()}`;
    const container = containers.get(containerId);

    const view = new WebContentsView({
      webPreferences: {
        session: container.session,
        contextIsolation: true,
      }
    });

    // 设置 Tab 区域（工具栏下方）
    const winBounds = this.win.getBounds();
    view.setBounds({
      x: 0,
      y: 48, // 工具栏高度
      width: winBounds.width,
      height: winBounds.height - 48
    });

    view.webContents.loadURL(url);
    this.win.contentView.addChildView(view);

    this.tabs.set(tabId, { view, containerId, url });
    this.switchToTab(tabId);

    return tabId;
  }

  /**
   * 切换到指定 Tab
   */
  switchToTab(tabId) {
    // 隐藏当前 Tab
    if (this.activeTabId) {
      const current = this.tabs.get(this.activeTabId);
      if (current) current.view.setVisible(false);
    }

    // 显示目标 Tab
    const target = this.tabs.get(tabId);
    if (target) {
      target.view.setVisible(true);
      this.activeTabId = tabId;
    }
  }

  /**
   * 关闭 Tab
   */
  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(tabId);

    // 切换到相邻 Tab
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      if (this.activeTabId) this.switchToTab(this.activeTabId);
    }
  }
}
```

### Build & Distribution

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-builder | ^26.0.0 | 应用打包 | 当前 ^24.13.0 可用，26.x 支持 Electron 36+ |
| electron-store | ^11.0.0 | 配置存储 | 当前 ^8.1.0 可用，11.x 性能更好 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | ^11.0.0 | 容器配置持久化 | 始终使用，存储容器列表和配置 |
| electron-log | ^5.0.0 | 日志管理 | 可选，当前 console.log 可满足需求 |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| 视图架构 | BaseWindow + WebContentsView | BrowserWindow + BrowserView | BrowserView 已废弃，不支持多视图 |
| Tab 管理 | 自定义 TabManager | electron-tabs (1.0.4) | 库已3年未更新，不支持 WebContentsView |
| Cookie 持久化 | Electron 内置 persist: | 自定义 JSON 文件 | 内置方案零维护，JSON 作为导入导出辅助 |
| 配置存储 | electron-store | lowdb / better-sqlite3 | electron-store 已满足需求，无需引入新依赖 |

---

## Installation

```bash
# 升级核心依赖
npm install electron@^36.0.0
npm install electron-store@^11.0.0
npm install -D electron-builder@^26.0.0

# 如果需要日志
npm install electron-log@^5.0.0
```

---

## Migration Path

### Phase 1: Electron 版本升级（优先级最高）
1. 升级 electron 到 ^36.0.0
2. 测试现有功能是否正常
3. 修复任何 breaking changes

### Phase 2: BrowserView → WebContentsView 迁移
1. 将 BrowserWindow 改为 BaseWindow
2. UI 层作为 WebContentsView
3. 实现 Tab 视图管理
4. 处理窗口 resize 事件

### Phase 3: 多 Tab 多容器架构
1. 实现 TabManager 类
2. 每个 Tab 绑定独立 Session
3. Tab 切换时保持容器隔离
4. 实现 Tab 栏 UI

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Electron 版本决策 | HIGH | 官方文档明确：32.x 已结束支持，36.x 是当前 LTS |
| WebContentsView 迁移 | HIGH | 官方迁移指南完整，API 稳定 |
| Session 隔离 | HIGH | 当前实现正确，persist: 前缀是官方推荐方案 |
| Tab 管理模式 | MEDIUM | 无成熟第三方库，需自建，但模式清晰 |
| electron-store 升级 | MEDIUM | 8.x 到 11.x 可能有 breaking changes，需测试 |

---

## Sources

- [Electron WebContentsView 官方文档](https://www.electronjs.org/docs/latest/api/web-contents-view) — HIGH confidence
- [Electron BaseWindow 官方文档](https://www.electronjs.org/docs/latest/api/base-window) — HIGH confidence
- [Electron Session 官方文档](https://www.electronjs.org/docs/latest/api/session) — HIGH confidence
- [Electron Cookies 官方文档](https://www.electronjs.org/docs/latest/api/cookies) — HIGH confidence
- [BrowserView → WebContentsView 迁移指南](https://www.electronjs.org/blog/migrate-to-webcontentsview) — HIGH confidence
- [Electron 36 发布说明](https://www.electronjs.org/blog/electron-36-0) — HIGH confidence
- npm registry — electron@43.2.0, electron-store@11.0.2, electron-builder@26.15.3 — HIGH confidence
