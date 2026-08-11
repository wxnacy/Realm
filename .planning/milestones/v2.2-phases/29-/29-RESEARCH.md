# Phase 29: 多媒体播放器设置控制 - Research

**Researched:** 2026-08-08
**Domain:** Electron 设置页面、功能开关、域名白名单、资源释放
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | 设置页面新增"多媒体"侧边栏选项，包含播放器功能开关和域名白名单配置 | settings.html 侧边栏模式 + settings-page.js 页面切换模式已验证 |
| SC-2 | 播放器功能开关默认关闭，控制视频探测、m3u8 播放、播放按钮的显示 | electron-store 默认值机制 + devMode toggle 模式已验证 |
| SC-3 | 域名白名单区域支持添加/删除域名，默认为"全部" | devMode 域名管理模式已验证，需改为标签式 UI |
| SC-4 | 功能关闭时 MediaSniffer 完全停止、媒体列表清空、播放器按钮隐藏 | webRequest 回调早返模式 + clearMediaList 已实现 |
| SC-5 | 功能关闭时页面恢复正常行为：视频文件正常下载、文本正常展示 | Chromium 原生行为：mp4/webm 自动播放，m3u8 显示文本 |
</phase_requirements>

## Summary

Phase 29 在设置页面新增"多媒体"功能开关和域名白名单配置。核心挑战在于即时生效的开关控制：webRequest 监听器无法移除（Electron API 限制），需在回调中检查状态并早返；脚本注入点在渲染进程，需在注入前检查开关状态；媒体面板和按钮需在开关关闭时隐藏。

项目已有完整的设置页面基础设施（electron-store + HTTP API + IPC），以及 devMode 功能开关的成熟模式可复用。域名白名单 UI 需从 devMode 的列表式改为标签式（chip），但数据流和验证逻辑完全一致。

**Primary recommendation:** 复用 devMode toggle 模式实现功能开关，复用 devMode 域名管理的数据流实现白名单 CRUD，仅改 UI 从列表式为标签式。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 设置持久化 | Main Process (electron-store) | — | configStore 是唯一设置存储源 |
| 设置 UI | Renderer (settings-page.js) | — | 设置页在 webview guest 中运行 |
| 功能开关检查 | Main Process (webRequest callback) | Renderer (script injection) | 两个检查点分布在主进程和渲染进程 |
| 媒体列表清空 | Main Process (MediaSniffer) | — | mediaMap 在主进程维护 |
| 面板/按钮隐藏 | Renderer (renderer.js) | — | DOM 操作在渲染进程 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-store | 8.1.0+ | 设置持久化 | 项目已使用，无需新增依赖 |
| Electron Session API | 32.x | webRequest 拦截 | 项目已使用，内置 API |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 无新增依赖 | — | — | 本阶段纯功能增强，不引入新库 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 回调内早返 | 移除/重建监听器 | Electron webRequest API 不支持移除，不可行 |
| 标签式 UI | 列表式 UI | 标签式更紧凑，符合 UI-SPEC 设计规范 |

## Package Legitimacy Audit

> 本阶段不安装任何外部包。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户操作（设置页 toggle / 白名单输入）
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Settings Page (webview guest)                  │
│  settings-page.js                               │
│  ├─ toggle click → settingsApi('update')        │
│  └─ whitelist CRUD → settingsApi('update')      │
└─────────────────────────────────────────────────┘
        │ HTTP POST /api/settings/update
        ▼
┌─────────────────────────────────────────────────┐
│  Main Process                                   │
│  main.js: handleSettingsApi                     │
│  ├─ configStore.set('settings.mediaPlayer.*')   │
│  └─ 返回 {success: true}                        │
└─────────────────────────────────────────────────┘
        │
        ▼ (即时生效路径)
┌─────────────────────────────────────────────────┐
│  生效检查点                                      │
│  1. main.js:420 — webRequest 回调检查开关        │
│  2. renderer.js:847 — 脚本注入前检查开关         │
│  3. renderer.js — 媒体面板/按钮显示状态          │
└─────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── settings.html        # 新增多媒体侧边栏选项和内容区域
├── settings-page.js     # 新增多媒体设置逻辑
├── styles/main.css      # 新增白名单标签样式
├── renderer.js          # 修改：脚本注入前检查开关
├── preload.js           # 无需修改（mediaAPI 已暴露）
main.js                  # 修改：webRequest 回调检查开关
media-sniffer.js         # 修改：新增 clearAll() 方法
ipc-handlers.js          # 无需修改（settings:* 通道已通用）
```

### Pattern 1: 功能开关即时生效

**What:** 切换开关后无需重启应用，所有检查点立即响应新状态
**When to use:** 所有需要即时生效的功能开关
**Example:**
```javascript
// main.js: webRequest 回调内检查开关（per D-09）
ses.webRequest.onResponseStarted(
  { urls: ['*://*/*'] },
  (details) => {
    // 即时生效：每次回调都读取最新开关状态
    const enabled = configStore.get('settings.mediaPlayer.enabled', false);
    if (!enabled) return;  // 早返，不处理
    mediaSniffer.handleNetworkResponse(details);
  }
);
```
**Source:** [VERIFIED: 代码库 main.js:420-425]

### Pattern 2: 设置页面扩展

**What:** 在设置页面新增侧边栏选项和内容区域
**When to use:** 新增设置分类
**Example:**
```html
<!-- settings.html: 新增侧边栏选项（复用现有模式） -->
<div class="sidebar-item" data-page="multimedia">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <!-- 播放器图标 -->
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
  <span>多媒体</span>
</div>
```
```javascript
// settings-page.js: 页面切换时加载数据（复用现有模式）
if (pageName === 'multimedia') {
  loadMultimediaSettings();
}
```
**Source:** [VERIFIED: 代码库 settings.html:19-69, settings-page.js:185-220]

### Pattern 3: 标签式域名输入

**What:** 输入框 + 回车添加 + 标签式显示，每个域名一个标签
**When to use:** 域名白名单配置
**Example:**
```javascript
// 复用 devMode 域名管理的数据流，改 UI 为标签式
async function addWhitelistDomain(domain) {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) { showToast('请输入域名'); return; }
  if (/[^\w.-]/.test(trimmed)) { showToast('域名格式不合法'); return; }
  if (state.mediaPlayer.whitelist.includes(trimmed)) { showToast('域名已存在'); return; }

  const newList = [...state.mediaPlayer.whitelist, trimmed];
  await saveSettings('mediaPlayer.whitelist', newList);
  state.mediaPlayer.whitelist = newList;
  renderWhitelistTags();
}
```
**Source:** [VERIFIED: 代码库 settings-page.js:1187-1229 (devMode 域名管理模式)]

### Anti-Patterns to Avoid

- **移除 webRequest 监听器:** Electron webRequest API 不支持移除已注册的监听器，只能在回调内早返
- **在渲染进程存储开关状态:** 开关状态必须从 electron-store 读取，确保跨窗口/进程一致
- **强制关闭已打开的播放器窗口:** per D-11，已打开的播放器继续播放直到用户手动关闭
- **在 renderer.js 硬编码默认值:** 默认值应由 configStore.get() 的第二个参数提供

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 设置持久化 | 自定义 JSON 文件读写 | electron-store | 项目已使用，原子写入，跨平台 |
| 设置 HTTP API | 自定义路由 | 现有 handleSettingsApi | 已有通用 settings/get 和 settings/update 路由 |
| 域名验证 | 复杂正则 | 简单格式检查 + 去重 | 域名格式多样，过度验证会误杀合法域名 |

## Common Pitfalls

### Pitfall 1: 开关状态不同步

**What goes wrong:** 切换开关后，webRequest 回调仍使用旧状态
**Why it happens:** 在回调外缓存了开关状态值
**How to avoid:** 每次回调都从 configStore 实时读取，不缓存
**Warning signs:** 切换开关后嗅探行为未变化

### Pitfall 2: 白名单子域名匹配

**What goes wrong:** 白名单包含 example.com 但未匹配 www.example.com
**Why it happens:** 简单字符串相等比较
**How to avoid:** 使用域名后缀匹配：`requestDomain === whitelistDomain || requestDomain.endsWith('.' + whitelistDomain)`
**Warning signs:** 添加域名后子域名视频未被检测

### Pitfall 3: 媒体面板隐藏不完整

**What goes wrong:** 开关关闭后媒体按钮仍显示或可点击
**Why it happens:** 只隐藏了面板但未隐藏工具栏按钮
**How to avoid:** 同时隐藏 mediaPanelBtn 和 mediaPanel
**Warning signs:** 用户能看到媒体按钮但点击无效

### Pitfall 4: 设置页 webview 无法读取 electron-store

**What goes wrong:** settings-page.js 直接调用 configStore 失败
**Why it happens:** 设置页运行在 webview guest 中，无 Node.js 访问权限
**How to avoid:** 通过 HTTP API (`/api/settings/get` 和 `/api/settings/update`) 访问设置
**Warning signs:** 控制台报错 "configStore is not defined"

## Code Examples

Verified patterns from official sources:

### 功能开关检查（webRequest 回调）

```javascript
// Source: 代码库 main.js:420-425 + D-09 决策
// webRequest 回调内实时读取开关状态
ses.webRequest.onResponseStarted(
  { urls: ['*://*/*'] },
  (details) => {
    const enabled = configStore.get('settings.mediaPlayer.enabled', false);
    if (!enabled) return;  // 开关关闭，跳过所有嗅探
    mediaSniffer.handleNetworkResponse(details);
  }
);
```

### 脚本注入前检查开关

```javascript
// Source: 代码库 renderer.js:847-935 + D-10 决策
webview.addEventListener('dom-ready', () => {
  // 开关检查：关闭时跳过注入
  const enabled = window.state?.mediaPlayerEnabled ?? true;  // 从主进程同步
  if (!enabled) return;

  const mediaSnifferScript = `...`;
  webview.executeJavaScript(mediaSnifferScript).catch(() => {});
});
```

### 标签式白名单 UI

```html
<!-- Source: UI-SPEC.md -->
<div class="whitelist-tags" id="whitelistTags">
  <span class="whitelist-tag">
    <span class="whitelist-tag-text">example.com</span>
    <button class="whitelist-tag-remove" data-domain="example.com" title="移除">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </span>
</div>
```

### 域名白名单匹配逻辑

```javascript
// Source: D-06/D-07 决策
function isDomainWhitelisted(url, whitelist) {
  if (whitelist.length === 0) return true;  // 空白名单 = 全部允许
  try {
    const hostname = new URL(url).hostname;
    return whitelist.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无功能开关 | 单一总开关 + 域名白名单 | Phase 29 | 用户可控制多媒体功能 |
| 始终嗅探 | 按开关状态嗅探 | Phase 29 | 关闭时恢复正常浏览器行为 |

**Deprecated/outdated:**
- 无（本阶段是新增功能，不涉及废弃）

## Assumptions Log

> 所有决策均来自用户在 CONTEXT.md 中的明确选择，无假设性声明。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions (RESOLVED)

1. **开关状态如何同步到渲染进程？** [RESOLVED]
   - What we know: 渲染进程通过 IPC 或 HTTP API 获取设置
   - What's unclear: 是否需要新增 IPC 通道 `media:set-enabled` 推送状态变化
   - Resolution: 复用现有 `settings:get` IPC 通道（realmAPI.getSettings），渲染进程在初始化和 visibilitychange 时读取；开关变化时通过轮询机制检测（per Plan 02 Task 2）

2. **白名单过滤在哪个层级实现？** [RESOLVED]
   - What we know: webRequest 回调和脚本注入是两个独立的嗅探路径
   - What's unclear: 白名单过滤是在 MediaSniffer 内部还是回调入口
   - Resolution: 在 main.js webRequest 回调入口处检查（per D-06/D-07），开关开启后读取白名单，调用 isDomainWhitelisted(url, whitelist) 过滤；白名单为空时全部通过，非空时仅白名单域名通过（含子域名后缀匹配）。详见 Plan 02 Task 1。

## Environment Availability

> 本阶段无外部依赖。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 应用框架 | ✓ | 32.x | — |
| electron-store | 设置持久化 | ✓ | 8.1.0+ | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none -- see Wave 0 |
| Quick run command | `npm test` (未配置) |
| Full suite command | `npm test` (未配置) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | 设置页面显示多媒体选项 | manual-only | — | — |
| SC-2 | 开关默认关闭 | manual-only | — | — |
| SC-3 | 白名单添加/删除域名 | manual-only | — | — |
| SC-4 | 关闭时嗅探停止、列表清空 | manual-only | — | — |
| SC-5 | 关闭时恢复正常行为 | manual-only | — | — |

### Sampling Rate

- **Per task commit:** N/A (无自动化测试)
- **Per wave merge:** N/A
- **Phase gate:** 手动 UAT 验证

### Wave 0 Gaps

- [ ] 项目当前无测试框架，本阶段不引入（手动验证为主）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 域名输入验证：格式检查 + 去重 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + 设置页

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via domain input | Tampering | textContent 赋值，禁止 innerHTML 拼接用户输入 |
| 设置页 token 泄露 | Elevation of Privilege | token 仅在 URL 查询参数中，不写入 DOM |

## Sources

### Primary (HIGH confidence)
- 代码库 media-sniffer.js — MediaSniffer 类完整实现
- 代码库 settings-page.js — 设置页面逻辑、devMode 模式
- 代码库 settings.html — 侧边栏导航结构
- 代码库 main.js:420-425 — webRequest 注册点
- 代码库 renderer.js:847-935 — 脚本注入逻辑
- 代码库 ipc-handlers.js:1504-1527 — settings IPC 通道
- 代码库 .planning/phases/29-/29-CONTEXT.md — 用户决策
- 代码库 .planning/phases/29-/29-UI-SPEC.md — UI 设计规范

### Secondary (MEDIUM confidence)
- Context7: electron-store 嵌套键访问模式
- Context7: Electron webRequest API 限制（不可移除监听器）

### Tertiary (LOW confidence)
- WebSearch: 标签式 UI 最佳实践（已通过 UI-SPEC.md 验证）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 项目已有完整基础设施，无需新增依赖
- Architecture: HIGH — 复用现有 devMode 模式，代码路径清晰
- Pitfalls: HIGH — 基于代码库实际 API 限制分析

**Research date:** 2026-08-08
**Valid until:** 2026-09-08 (30 days -- 项目处于活跃开发期)
