# Phase 2: Browser Core - URL Navigation + Multi-Tab - Research

**Researched:** 2026-07-23
**Domain:** Electron webview, 多 Tab 架构, URL 导航, 浏览器 UI
**Confidence:** MEDIUM

## Summary

Phase 2 的核心目标是在现有容器管理基础上，实现基于 webview 的网页渲染和多 Tab 浏览功能。研究发现：

1. **webview 标签状态**：Electron 官方正在逐步废弃 `<webview>` 标签，推荐使用 `WebContentsView`（Electron 36+）。但用户已明确决定使用 webview（D-01），且 Electron 32.x 仍完全支持 webview，因此按计划执行。[ASSUMED]

2. **多 Tab 架构**：推荐采用"保留实例 + 显示/隐藏"模式（D-06 决策），每个 webview 使用独立的 `partition` 实现容器隔离。切换 Tab 时通过 CSS `visibility` 或 `display` 控制显隐，避免重新加载。

3. **安全配置**：必须严格遵循 `nodeintegration="false"` + `contextIsolation="true"` 配置，webview 中的网页不应访问 Node.js API。[CITED: electronjs.org/docs/latest/tutorial/security]

4. **内存优化**：可通过 `webContents.discard()` 卸载非活动 Tab、`setBackgroundThrottling(true)` 暂停后台 JS 执行、设置进程数量限制等方式优化内存。[ASSUMED]

5. **UI 设计**：Tab 栏采用 36px 紧凑设计，每个 Tab 顶部有 3px 容器颜色指示线，悬停显示关闭按钮，标题超长用省略号截断。[CITED: 02-UI-SPEC.md]

**主要建议：** 按照已批准的 UI-SPEC 和 CONTEXT 决策执行，重点关注 webview 安全配置和内存管理。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 使用 webview 标签渲染网页内容
- **D-02:** 单个 webview 动态切换（修改 src 和 partition 属性）
- **D-03:** 标准安全模式（nodeintegration="false"，禁止网页访问 Node.js API）
- **D-04:** 通过 preload 注入实现网页与主进程通信
- **D-05:** 轻量级 Tab 模型（每个 Tab 仅记录 containerId 和 url）
- **D-06:** 保留 webview 实例，切换时显示/隐藏
- **D-07:** 自动回收最久未使用的 Tab（超过上限时）
- **D-08:** 关闭 Tab 时立即销毁 webview
- **D-09:** 同窗口多容器 Tab
- **D-10:** 回车导航 + 显示完整 URL
- **D-11:** 智能补全协议（自动补全 https://）
- **D-12:** 内置新标签页
- **D-13:** 地址栏加载动画 + 刷新/停止按钮切换
- **D-14:** 固定位置 + 自适应宽度 Tab 栏
- **D-15:** Tab 顶部细线显示容器颜色（2-3px）
- **D-16:** 悬停显示关闭按钮
- **D-17:** 标题 + 省略号截断

### Claude's Discretion
无 — 所有决策均已由用户明确选择

### Deferred Ideas (OUT OF SCOPE)
- 白名单安全模式（Phase 3 或后续阶段）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROW-01 | 用户可以在容器中输入 URL 并导航到网页 | webview loadURL/goBack/goForward API |
| BROW-02 | 用户可以使用前进、后退、刷新按钮进行导航 | webview navigation API |
| BROW-03 | 用户可以在同一窗口内打开多个 Tab，每个 Tab 属于不同容器 | partition 隔离 + Tab 管理模型 |
| BROW-04 | 用户可以关闭 Tab | webview destroy + DOM 移除 |
| BROW-05 | 用户可以看到 Tab 标签页标题和容器颜色标识 | Tab UI 组件 + 容器颜色属性 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | ^32.0.0 | 桌面应用框架 | 项目已选定，不可更改 |
| electron-store | ^8.1.0 | 容器配置持久化 | 项目已集成，Phase 1 验证 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 无新增依赖 | — | — | Phase 2 不需要额外依赖 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| webview 标签 | WebContentsView | webview 更简单但可能被废弃；WebContentsView 更现代但需要主进程管理 |
| 显示/隐藏切换 | 销毁/重建 | 显示/隐藏保留页面状态；销毁/重建更省内存但丢失状态 |

**安装：**
```bash
# 无新增依赖，Phase 1 已安装
npm install electron-store
```

## Package Legitimacy Audit

> Phase 2 不安装新外部包。仅使用项目已有的 electron-store。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| electron-store | npm | 8+ years | 986,998/week | github.com/sindresorhus/electron-store | [OK] | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
用户输入 URL
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  Tab Manager                     │   │
│  │  - Tab 创建/切换/关闭                            │   │
│  │  - Tab UI 渲染（标题、颜色、关闭按钮）            │   │
│  │  - Tab 状态管理（active/inactive）                │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                              │
│                         ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Webview Container                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ webview1 │ │ webview2 │ │ webview3 │ ...    │   │
│  │  │ (visible)│ │ (hidden) │ │ (hidden) │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Tab Manager Module                  │   │
│  │  - Tab 数据模型（id, containerId, url, title）   │   │
│  │  - Tab 持久化（electron-store）                   │   │
│  │  - Tab 回收策略                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                              │
│                         ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Container Manager (Phase 1)              │   │
│  │  - Session partition 管理                         │   │
│  │  - 容器 CRUD                                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── tab-manager.js        # Tab 生命周期管理（主进程）
├── tab-model.js          # Tab 数据模型
├── webview-manager.js    # webview 实例管理（渲染进程）
├── url-handler.js        # URL 解析和验证
├── renderer.js           # 渲染进程主逻辑（扩展）
├── preload.js            # IPC 桥接（扩展）
└── styles/
    └── main.css          # 样式（扩展 Tab 栏样式）
```

### Pattern 1: Tab 生命周期管理
**What:** 管理 Tab 的创建、切换、关闭和回收
**When to use:** 每次用户操作 Tab 时
**Example:**
```javascript
// tab-manager.js（主进程）
class TabManager {
  constructor() {
    this.tabs = new Map(); // tabId -> TabModel
    this.activeTabId = null;
    this.maxTabs = 20; // D-07: Tab 上限
  }

  createTab(containerId, url = 'about:blank') {
    const tabId = crypto.randomUUID();
    const tab = new TabModel(tabId, containerId, url);
    this.tabs.set(tabId, tab);

    // D-07: 超过上限时回收最久未使用的 Tab
    if (this.tabs.size > this.maxTabs) {
      this.recycleOldestTab();
    }

    this.activeTabId = tabId;
    return tab;
  }

  switchTab(tabId) {
    if (!this.tabs.has(tabId)) return false;
    this.activeTabId = tabId;
    return true;
  }

  closeTab(tabId) {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      // 切换到相邻 Tab
      this.activeTabId = this.tabs.keys().next().value || null;
    }
  }
}
```

### Pattern 2: Webview 显示/隐藏切换
**What:** 通过 CSS 控制 webview 的显示和隐藏，保留页面状态
**When to use:** 切换 Tab 时
**Example:**
```javascript
// webview-manager.js（渲染进程）
class WebviewManager {
  constructor(container) {
    this.container = container; // DOM 容器元素
    this.webviews = new Map(); // tabId -> webview element
  }

  createWebview(tabId, containerId, url) {
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('partition', `persist:container-${containerId}`);
    webview.setAttribute('nodeintegration', 'false');
    webview.setAttribute('disablewebsecurity', 'false');
    webview.setAttribute('allowpopups', 'false');
    webview.setAttribute('webpreferences', 'contextIsolation=yes');

    // 初始隐藏
    webview.style.visibility = 'hidden';
    webview.style.position = 'absolute';
    webview.style.width = '100%';
    webview.style.height = '100%';

    this.container.appendChild(webview);
    this.webviews.set(tabId, webview);
    return webview;
  }

  showWebview(tabId) {
    // 隐藏所有
    this.webviews.forEach((wv, id) => {
      wv.style.visibility = id === tabId ? 'visible' : 'hidden';
    });
  }

  destroyWebview(tabId) {
    const webview = this.webviews.get(tabId);
    if (webview) {
      webview.remove();
      this.webviews.delete(tabId);
    }
  }
}
```

### Pattern 3: URL 导航和状态管理
**What:** 处理 URL 输入、协议补全、前进后退、加载状态
**When to use:** 用户在地址栏输入 URL 或点击导航按钮时
**Example:**
```javascript
// url-handler.js
function normalizeUrl(input) {
  input = input.trim();

  // 已有协议
  if (/^https?:\/\//.test(input)) {
    return input;
  }

  // 看起来像域名
  if (/^[\w-]+(\.[\w-]+)+/.test(input)) {
    return `https://${input}`;
  }

  // 当作搜索查询
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

// 渲染进程中的导航控制
function setupNavigation(webview, elements) {
  // D-10: 回车导航
  elements.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const url = normalizeUrl(elements.urlInput.value);
      webview.loadURL(url);
    }
  });

  // D-13: 加载状态
  webview.addEventListener('did-start-loading', () => {
    elements.reloadBtn.classList.add('loading');
  });

  webview.addEventListener('did-stop-loading', () => {
    elements.reloadBtn.classList.remove('loading');
  });

  // 更新 URL 显示
  webview.addEventListener('did-navigate', (e) => {
    elements.urlInput.value = e.url;
  });
}
```

### Anti-Patterns to Avoid
- **在 webview 中启用 nodeintegration：** 允许远程代码访问系统资源，严重安全风险
- **使用 innerHTML 设置 Tab 标题：** 可能导致 XSS 攻击，应使用 textContent
- **销毁/重建 webview 切换 Tab：** 丢失页面状态，用户体验差
- **不限制 Tab 数量：** 可能导致内存溢出，必须有回收机制（D-07）

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL 协议检测 | 正则表达式解析 | URL 构造函数 + 简单判断 | 边界情况多，容易出错 |
| Tab 持久化 | 自定义文件存储 | electron-store | 已有成熟方案，Phase 1 已验证 |
| Session 隔离 | 手动管理 Cookie | Electron Session partition | 内置机制，自动隔离 |

## Common Pitfalls

### Pitfall 1: webview 安全配置遗漏
**What goes wrong:** 忘记设置 `nodeintegration="false"` 或 `contextIsolation="true"`
**Why it happens:** 配置项多，容易遗漏
**How to avoid:** 使用常量定义安全配置，所有 webview 创建时统一应用
**Warning signs:** 安全扫描工具报警，或网页能访问 Node.js API

### Pitfall 2: 内存泄漏
**What goes wrong:** 关闭 Tab 后 webview 未正确销毁，内存持续增长
**Why it happens:** 仅从 DOM 移除元素，未清理事件监听器和引用
**How to avoid:** 使用 `webview.remove()` 并确保从 Map 中删除引用
**Warning signs:** 应用内存使用持续增长，长时间运行后变慢

### Pitfall 3: Tab 切换闪烁
**What goes wrong:** 切换 Tab 时出现白屏闪烁
**Why it happens:** webview 重新加载或渲染延迟
**How to avoid:** 使用 `visibility` 而非 `display` 控制显隐，保留页面状态
**Warning signs:** 用户反馈切换 Tab 时有闪烁

### Pitfall 4: URL 输入框与 webview 状态不同步
**What goes wrong:** 用户在网页内点击链接后，地址栏 URL 未更新
**Why it happens:** 未监听 webview 的导航事件
**How to avoid:** 监听 `did-navigate` 和 `did-navigate-in-page` 事件
**Warning signs:** 地址栏显示旧 URL，与实际页面不一致

## Code Examples

Verified patterns from official sources:

### webview 安全配置
```html
<!-- Source: 02-UI-SPEC.md 安全规格 -->
<webview
  src="about:blank"
  partition="persist:container-{containerId}"
  nodeintegration="false"
  disablewebsecurity="false"
  allowpopups="false"
  webpreferences="contextIsolation=yes"
></webview>
```

### Tab 数据模型
```javascript
// 轻量级 Tab 模型（D-05）
class TabModel {
  constructor(id, containerId, url) {
    this.id = id;
    this.containerId = containerId;
    this.url = url;
    this.title = '新标签页';
    this.favicon = null;
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
  }
}
```

### 加载进度条动画
```css
/* Source: 02-UI-SPEC.md 加载进度条规格 */
.loading-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  background-color: var(--accent-color);
  animation: loading-progress 2s ease-in-out infinite;
}

@keyframes loading-progress {
  0% { width: 0%; }
  50% { width: 90%; }
  100% { width: 100%; opacity: 0; }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BrowserView | WebContentsView | Electron 36+ (2025) | BrowserView 被废弃，但 Electron 32 仍支持 webview |
| webview nodeintegration=true | nodeintegration=false | Electron 5+ | 默认禁用，提高安全性 |
| 手动管理 Cookie | Session partition | Electron 内置 | 自动隔离，无需手动管理 |

**Deprecated/outdated:**
- BrowserView: 被 WebContentsView 替代，但 Electron 32 仍支持
- webview 标签: 官方建议逐步迁移，但 Electron 32 仍完全支持

## Assumptions Log

> 所有基于 WebSearch 获取的信息标记为 [ASSUMED]，因为 WebSearch 未返回实际搜索结果。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron 32.x 完全支持 webview 标签 | Standard Stack | 如果 webview 在 32.x 被禁用，需要改用其他方案 |
| A2 | webContents.discard() 可用于卸载非活动 Tab | Common Pitfalls | 如果 API 不存在，需要其他内存优化方案 |
| A3 | setBackgroundThrottling(true) 可暂停后台 Tab 的 JS 执行 | Summary | 如果 API 行为不同，后台 Tab 可能继续消耗资源 |
| A4 | 20 个 Tab 是合理的上限 | Code Examples | 实际上限取决于用户机器内存 |

**如果此表为空：** 所有声明均已验证或引用 — 无需用户确认。

## Open Questions (RESOLVED)

1. **webview 在 Electron 32.x 中的确切废弃状态** ✅ RESOLVED
   - What we know: 官方建议逐步迁移，但 32.x 仍支持
   - What's unclear: 是否有明确的废弃时间表
   - Resolution: 继续使用 webview（D-01 决策），但关注 Electron 更新日志

2. **Tab 上限的最佳值** ✅ RESOLVED
   - What we know: D-07 决策需要设定上限
   - What's unclear: 20 个 Tab 是否是最佳值
   - Resolution: 先设为 20，后续根据用户反馈调整

## Environment Availability

> Phase 2 依赖 Electron 32.x 运行时，无需额外外部依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron 运行时 | ✓ | — | — |
| npm | 包管理 | ✓ | — | — |
| Electron | 应用框架 | ✓ | ^32.0.0 | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（Phase 1 未引入测试框架） |
| Config file | none |
| Quick run command | `npm test` (待配置) |
| Full suite command | `npm test` (待配置) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROW-01 | URL 导航 | manual | — | ❌ |
| BROW-02 | 前进/后退/刷新 | manual | — | ❌ |
| BROW-03 | 多 Tab 管理 | manual | — | ❌ |
| BROW-04 | 关闭 Tab | manual | — | ❌ |
| BROW-05 | Tab UI 显示 | manual | — | ❌ |

### Sampling Rate
- **Per task commit:** 无自动化测试
- **Per wave merge:** 无自动化测试
- **Phase gate:** 手动 UAT 验证

### Wave 0 Gaps
- [ ] 测试框架配置（可选，Phase 2 以手动验证为主）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | yes | Electron Session partition 隔离 |
| V4 Access Control | no | — |
| V5 Input Validation | yes | URL 输入验证和清理 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron webview

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 远程代码执行 | Elevation of Privilege | nodeintegration="false" + contextIsolation="true" |
| XSS 攻击 | Tampering | 使用 textContent 而非 innerHTML |
| Session 劫持 | Information Disclosure | 独立的 Session partition |
| 导航劫持 | Tampering | 监听 will-navigate 事件，限制跳转 |

## Sources

### Primary (MEDIUM confidence)
- [ASSUMED] Electron 官方文档 — webview 标签 API
- [CITED: 02-UI-SPEC.md] UI 设计规格
- [CITED: 02-CONTEXT.md] 实现决策

### Secondary (LOW confidence)
- [ASSUMED] WebSearch — Electron webview 安全最佳实践
- [ASSUMED] WebSearch — 多 Tab 架构设计

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM — Electron 版本和依赖已确认，webview 支持状态基于假设
- Architecture: MEDIUM — 架构设计基于已批准的决策和 Electron 文档
- Pitfalls: LOW — 网络搜索结果有限，部分基于训练知识

**Research date:** 2026-07-23
**Valid until:** 2026-08-23（30 天，Electron 生态变化较快）
