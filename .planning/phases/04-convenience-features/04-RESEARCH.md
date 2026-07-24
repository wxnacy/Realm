# Phase 04: Convenience Features - Research

**Researched:** 2026-07-24
**Domain:** Electron 应用内快捷键 + 容器分配规则增强
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CNV-01 | 用户可以设置容器分配规则，指定网站自动在特定容器打开 | 已有 assignment-rules.js 实现基础 CRUD 和 URL 匹配，需增强排序、启用/禁用、导入导出 |
| CNV-02 | 用户可以使用快捷键进行常用操作（新建 Tab、关闭 Tab、切换容器） | 需从 globalShortcut 重构为应用内快捷键（Menu 加速键或 before-input-event） |
</phase_requirements>

## Summary

Phase 04 的核心交付包含两部分：(1) 容器分配规则的功能增强（启用/禁用切换、拖拽排序、导入导出），(2) 快捷键从全局注册（globalShortcut）重构为应用内生效（Menu 加速键或 before-input-event）。

现有代码已实现基础的分配规则 CRUD 和 URL 匹配（assignment-rules.js）、全局快捷键注册（shortcut-manager.js）、以及渲染进程的规则和快捷键管理 UI（renderer.js）。本次工作主要是增强和重构，而非从零构建。

**Primary recommendation:** 快捷键使用 Electron Menu 加速键（accelerator）实现应用内生效，规则排序使用 HTML5 Drag and Drop API，导入导出使用 Electron 原生对话框 + Node.js fs 模块。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 快捷键注册与触发 | Main Process (Menu) | Renderer (IPC handler) | Menu 模板在主进程创建，触发后通过 IPC 通知渲染进程执行操作 |
| 规则 CRUD | Main Process (assignment-rules.js) | — | 规则持久化在主进程的 electron-store 中 |
| 规则排序 | Main Process (持久化) | Renderer (拖拽 UI) | 拖拽交互在渲染进程，排序结果通过 IPC 同步到主进程持久化 |
| 规则导入导出 | Main Process (dialog + fs) | Renderer (触发) | 文件对话框和文件读写必须在主进程（Electron 安全模型） |
| 规则匹配 | Main Process | — | will-navigate 事件在主进程的 webContents 上拦截 |
| Toggle UI | Renderer | — | 纯 UI 组件，状态变化通过 IPC 同步 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron Menu | 32.x (内置) | 应用内快捷键（accelerator） | 项目已使用 Electron 32，Menu 是官方推荐的应用内快捷键方案 |
| HTML5 Drag and Drop API | 浏览器内置 | 规则拖拽排序 | Chromium 原生支持，无需额外依赖 |
| Electron dialog | 32.x (内置) | 文件选择/保存对话框 | 项目已有使用（cookie:export/import） |
| Node.js fs | 内置 | 文件读写 | 导入导出 JSON 文件 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.1.0+ (已有) | 规则和快捷键持久化 | 项目已有依赖，直接复用 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Menu accelerator | before-input-event | before-input-event 更灵活但需要手动管理 webContents 焦点状态；Menu accelerator 更简单且与系统菜单集成 |
| HTML5 Drag and Drop | 第三方拖拽库（如 sortablejs） | 原生 API 零依赖，功能足够；第三方库增加包体积和维护成本 |

**Installation:**
无需新增依赖。所有功能使用 Electron 和 Chromium 内置 API。

## Package Legitimacy Audit

> 本阶段不引入任何外部包。所有功能使用项目已有依赖（electron, electron-store）和浏览器内置 API。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (无新增) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### 快捷键架构：Menu Accelerator 方案

**What:** 使用 Electron Menu 模板的 accelerator 属性注册应用内快捷键，快捷键仅在应用窗口获得焦点时生效。

**When to use:** 需要应用内快捷键且不想与系统快捷键冲突时。

**工作原理：**
1. 主进程创建隐藏的 Menu 模板，每个菜单项对应一个快捷键操作
2. Menu.accelerator 在窗口获得焦点时自动捕获按键
3. 触发后通过 menu item 的 click 回调发送 IPC 到渲染进程
4. 渲染进程收到 IPC 后执行对应操作（与现有 shortcut:triggered 事件兼容）

**优势：**
- 不与系统快捷键冲突（D-05/D-07）
- 不需要 globalShortcut 注册/注销逻辑
- 窗口失焦时自动失效
- 与现有 shortcut:triggered IPC 事件完全兼容

### 规则排序架构

**What:** 使用 HTML5 Drag and Drop API 实现规则列表拖拽排序，排序结果持久化到 electron-store。

**When to use:** 需要用户自定义列表顺序时。

**工作原理：**
1. 渲染进程为规则项设置 draggable="true" 和拖拽手柄
2. 监听 dragstart/dragover/drop 事件
3. drop 后计算新顺序，通过 IPC 发送 rule:reorder 请求
4. 主进程更新 rules Map 的顺序并持久化

### 规则导入导出架构

**What:** 使用 Electron dialog 和 Node.js fs 实现规则的 JSON 文件导入导出。

**When to use:** 需要备份、分享或迁移配置时。

**工作原理：**
1. 导出：主进程收集所有规则，生成 JSON，通过 dialog.showSaveDialog 选择保存路径
2. 导入：主进程通过 dialog.showOpenDialog 选择文件，解析 JSON，验证格式，合并到现有规则

### Recommended Project Structure

现有结构无需调整。所有变更集中在现有文件中：

```
assignment-rules.js    # 新增 reorderRules(), importRules(), exportRules()
shortcut-manager.js    # 重构：globalShortcut -> Menu accelerator
ipc-handlers.js        # 新增 rule:reorder, rule:import, rule:export
src/preload.js         # 新增 reorderRules, importRules, exportRules
src/renderer.js        # 新增 toggle/drag-drop/import-export UI
src/styles/main.css    # 新增 toggle-switch, drag-handle 样式
src/index.html         # 新增导入导出按钮、toggle 开关 HTML
main.js                # 微调：移除 globalShortcut 注册，改用 Menu
```

### Anti-Patterns to Avoid

- **不要使用 globalShortcut：** D-06 明确禁止全局注册，改用 Menu accelerator 或 before-input-event
- **不要在渲染进程直接操作文件系统：** 导入导出必须通过主进程的 IPC 处理器
- **不要使用 innerHTML 渲染用户输入数据：** 项目已有 WR-13 规范，规则 pattern 和容器名称必须使用 textContent
- **不要引入第三方拖拽库：** HTML5 Drag and Drop API 足够满足需求

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 应用内快捷键 | 自定义 keydown 监听 + 按键映射 | Electron Menu accelerator | 官方 API，自动处理平台差异、焦点状态、按键冲突 |
| 文件选择对话框 | 自定义文件选择 UI | Electron dialog | 原生体验，自动处理权限和路径 |
| 拖拽排序 | 自定义 mousedown/mousemove/mouseup 逻辑 | HTML5 Drag and Drop API | 浏览器内置，自动处理拖拽预览和放置目标检测 |

## Common Pitfalls

### Pitfall 1: Menu accelerator 与 webview 快捷键冲突

**What goes wrong:** webview 内部页面可能拦截 Cmd+T/Cmd+W 等快捷键，导致 Menu accelerator 无法触发。

**Why it happens:** Chromium 的 webview 有独立的快捷键处理优先级。

**How to avoid:** 在 webview 的 webpreferences 中设置 `navigateOnDragDrop=false`，并确保主窗口的 Menu 优先级高于 webview。如果 webview 仍拦截，考虑在 will-navigate 事件中处理。

**Warning signs:** 快捷键在某些网站上不生效。

### Pitfall 2: 拖拽排序后规则匹配顺序变化

**What goes wrong:** 用户拖拽排序后，规则匹配顺序改变，导致之前匹配的规则不再匹配。

**Why it happens:** D-03 规定第一个匹配的规则生效，排序直接影响匹配结果。

**How to avoid:** 在 UI 中明确提示"排在前面的规则优先匹配"，并在拖拽完成后自动刷新规则列表。

**Warning signs:** 用户反馈"规则突然不生效了"。

### Pitfall 3: 导入规则时 containerId 不存在

**What goes wrong:** 导入的规则引用了不存在的容器 ID，导致规则无法生效。

**Why it happens:** 导出时的容器可能已被删除。

**How to avoid:** 导入时验证 containerId 是否存在，不存在的规则标记为禁用并提示用户。

**Warning signs:** 导入成功但规则不生效。

### Pitfall 4: before-input-event 在 webview 中的行为

**What goes wrong:** 如果选择 before-input-event 方案，在主窗口 webContents 上注册的事件不会捕获 webview 内部的按键。

**Why it happens:** before-input-event 只监听注册所在 webContents 的输入事件。

**How to avoid:** 使用 Menu accelerator 方案（推荐），它在窗口级别工作，不受 webview 焦点影响。

**Warning signs:** 快捷键在 webview 获得焦点时失效。

## Code Examples

### Menu Accelerator 快捷键实现

```javascript
// Source: Electron 官方文档 https://www.electronjs.org/docs/latest/api/menu
const { Menu, MenuItem } = require('electron');

/**
 * 创建应用内快捷键菜单
 * @param {BrowserWindow} window - 主窗口
 * @param {Object} shortcuts - 快捷键配置
 */
function createShortcutMenu(window, shortcuts) {
  const template = Object.entries(shortcuts).map(([action, accelerator]) => ({
    label: action,
    accelerator: accelerator,
    visible: false, // 隐藏菜单项，仅保留快捷键
    click: () => {
      window.webContents.send('shortcut:triggered', action);
    }
  }));

  const menu = Menu.buildFromTemplate([{ submenu: template }]);
  Menu.setApplicationMenu(menu);
}
```

### HTML5 Drag and Drop 规则排序

```javascript
// Source: MDN Web Docs - HTML Drag and Drop API
// 为规则列表容器添加拖拽排序
let draggedItem = null;

ruleList.addEventListener('dragstart', (e) => {
  draggedItem = e.target.closest('.rule-item');
  draggedItem.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
});

ruleList.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.target.closest('.rule-item');
  if (target && target !== draggedItem) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      target.parentNode.insertBefore(draggedItem, target);
    } else {
      target.parentNode.insertBefore(draggedItem, target.nextSibling);
    }
  }
});

ruleList.addEventListener('dragend', (e) => {
  draggedItem.style.opacity = '1';
  // 收集新顺序并同步到主进程
  const newOrder = Array.from(ruleList.querySelectorAll('.rule-item'))
    .map(item => item.dataset.ruleId);
  window.realmAPI.reorderRules(newOrder);
});
```

### 规则导入导出

```javascript
// 主进程 IPC 处理器
const { dialog } = require('electron');
const fs = require('fs');

// 导出规则
ipcMain.handle('rule:export', async (event) => {
  const rules = assignmentRules.getRules();
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出规则',
    defaultPath: `realm-rules-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false, message: '已取消' };
  
  fs.writeFileSync(filePath, JSON.stringify({ rules, exportedAt: Date.now() }, null, 2));
  return { success: true, count: rules.length };
});

// 导入规则
ipcMain.handle('rule:import', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入规则',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { success: false, message: '已取消' };
  
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  if (!data.rules || !Array.isArray(data.rules)) {
    return { success: false, message: '文件格式不正确' };
  }
  
  let imported = 0;
  for (const rule of data.rules) {
    if (rule.containerId && rule.pattern) {
      assignmentRules.createRule(rule.containerId, rule.pattern);
      imported++;
    }
  }
  return { success: true, count: imported };
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| globalShortcut 全局注册 | Menu accelerator 应用内生效 | Phase 04 (本次) | 避免与系统快捷键冲突，窗口失焦时自动失效 |
| 规则无排序 | 拖拽排序控制匹配优先级 | Phase 04 (本次) | 用户可自定义规则匹配顺序 |
| 规则无启用/禁用 | Toggle 开关快速切换 | Phase 04 (本次) | 无需删除规则即可临时禁用 |
| 规则无导入导出 | JSON 文件导入导出 | Phase 04 (本次) | 支持备份、分享、迁移规则配置 |

**Deprecated/outdated:**
- globalShortcut：D-06 明确废弃，改用 Menu accelerator

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 快捷键/文件对话框/拖拽 | ✓ | 32.x | — |
| Node.js | 主进程运行时 | ✓ | (系统) | — |
| electron-store | 规则持久化 | ✓ | 8.1.0+ | — |
| HTML5 Drag and Drop | 规则排序 | ✓ | Chromium 内置 | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

## Validation Architecture

> workflow.nyquist_validation is enabled (true).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置 — 项目当前没有测试框架 |
| Config file | none — see Wave 0 |
| Quick run command | `npm test` (需先配置) |
| Full suite command | `npm test` (需先配置) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CNV-01 | 规则 CRUD + 排序 + 启用/禁用 + 导入导出 | manual-only | — | — |
| CNV-02 | 应用内快捷键触发 | manual-only | — | — |

### Sampling Rate

- **Per task commit:** 无自动化测试
- **Per wave merge:** 无自动化测试
- **Phase gate:** 手动 UAT 验证

### Wave 0 Gaps

- [ ] 无测试框架 — 本阶段不引入（项目规模小，手动验证足够）
- [ ] 无测试文件 — 本阶段不创建

**说明：** 本阶段为功能增强，所有验证通过手动 UAT 完成。项目当前无测试框架，不在本阶段引入。

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 规则 pattern 输入验证（已有 assignment-rules.js 中的验证逻辑） |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + 规则/快捷键

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 导入恶意 JSON 文件 | Tampering | 验证 JSON 格式，限制导入规则数量，验证 containerId 存在性 |
| 规则 pattern 注入 | Tampering | pattern 已做 trim().toLowerCase() 处理，仅用于 hostname 匹配 |
| 快捷键劫持 | Spoofing | 使用 Menu accelerator（应用内生效），不使用 globalShortcut |

## Assumptions Log

> 所有技术方案均基于 Electron 32.x 官方文档和项目已有代码模式，无假设性声明。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (无) | — | — | — |

## Open Questions

1. **Menu accelerator 是否会在 webview 获得焦点时失效？**
   - What we know: Electron Menu accelerator 在窗口级别工作
   - What's unclear: webview 内部页面是否能拦截 accelerator
   - Recommendation: 实现后测试，如果失效则在 webview 的 before-input-event 中补充处理

2. **拖拽排序在大量规则（>20条）时的性能？**
   - What we know: HTML5 Drag and Drop 在 DOM 节点多时可能卡顿
   - What's unclear: 实际用户场景中规则数量
   - Recommendation: 初期不做限制，后续如性能有问题再加虚拟滚动

## Sources

### Primary (HIGH confidence)
- Electron Menu 文档 — https://www.electronjs.org/docs/latest/api/menu
- Electron before-input-event 文档 — https://www.electronjs.org/docs/latest/api/web-contents#event-before-input-event
- MDN HTML Drag and Drop API — https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- 项目已有代码 — assignment-rules.js, shortcut-manager.js, renderer.js

### Secondary (MEDIUM confidence)
- 项目 CLAUDE.md — 编码规范和架构约束

### Tertiary (LOW confidence)
- (无)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有方案使用 Electron 内置 API 和浏览器原生 API
- Architecture: HIGH — 基于项目已有模式和 Electron 官方推荐
- Pitfalls: MEDIUM — webview 快捷键冲突需实际测试验证

**Research date:** 2026-07-24
**Valid until:** 2026-08-24 (30 days — Electron API 稳定)
