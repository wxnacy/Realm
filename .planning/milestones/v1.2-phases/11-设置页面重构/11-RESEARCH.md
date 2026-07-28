---
phase: 11
slug: 设置页面重构
status: complete
created: 2026-07-27
---

# Phase 11 Research: 设置页面重构 — 左侧边栏 + 规则/快捷键页面化

## Research Summary

Phase 11 重构设置页面为带左侧边栏导航的多页面布局，将分配规则和快捷键设置从弹窗（`<dialog>` 模态框）迁入设置页面内。本研究分析现有代码结构、迁移路径、技术约束和实现策略。

---

## 1. 现有架构分析

### 1.1 设置页面当前状态

**文件结构：**
- `src/settings.html` — 设置页面 HTML（~74 行），简单线性布局
- `src/settings-page.js` — 设置页面逻辑（~251 行），通过 HTTP API 通信

**关键约束：**
设置页面运行在 webview guest 中（`realm://settings` 协议），**不能直接调用 IPC**（`assertTrustedSender` 会拒绝）。数据访问必须通过本地 HTTP 服务器的 `/api/settings/*` 端点。

```javascript
// settings-page.js:12 — API token 从 URL 查询参数获取
const apiToken = pageParams.get('token') || '';

// settings-page.js:41-48 — 所有数据通过 HTTP API
async function settingsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/settings/${route}?${params.toString()}`, options);
  return res.json();
}
```

### 1.2 规则管理当前状态

**实现位置：** `src/renderer.js` 第 855-1118 行（~260 行）

**关键函数：**
| 函数 | 行号 | 功能 |
|------|------|------|
| `showRulesModal()` | 860 | 加载容器选项，刷新规则列表，显示模态框 |
| `refreshRulesList()` | 881 | 调用 `window.realmAPI.getRules()` 获取规则 |
| `renderRulesList(rules)` | 890 | DOM 构建规则列表（WR-13 安全：textContent） |
| `handleDragStart/Over/Drop/End` | 995-1053 | HTML5 拖拽排序 |
| `importRules()` | 1095 | 通过 `window.realmAPI.importRules()` 导入 |
| `exportRules()` | 1110 | 通过 `window.realmAPI.exportRules()` 导出 |

**HTML 结构（`src/index.html:390-413`）：**
```html
<dialog class="modal" id="rulesModal">
  <div class="modal-content modal-large">
    <h2>容器分配规则</h2>
    <div class="rules-toolbar">
      <div class="rule-form">
        <select id="ruleContainerSelect">
        <input id="rulePatternInput" placeholder="输入域名...">
        <button id="addRuleBtn">添加规则</button>
      </div>
      <div class="rules-actions">
        <button id="importRulesBtn">导入规则</button>
        <button id="exportRulesBtn">导出规则</button>
      </div>
    </div>
    <div class="rules-list" id="rulesList">
    </div>
  </div>
</dialog>
```

### 1.3 快捷键设置当前状态

**实现位置：** `src/renderer.js` 第 1120-1320 行（~200 行）

**关键函数：**
| 函数 | 行号 | 功能 |
|------|------|------|
| `showShortcutsModal()` | 1140 | 刷新快捷键列表，显示模态框 |
| `refreshShortcutsList()` | 1148 | 调用 `window.realmAPI.getShortcuts()` |
| `renderShortcutsList(shortcuts)` | 1157 | DOM 构建快捷键列表（WR-13 安全） |
| `editShortcut(action)` | 1259 | 打开按键捕获对话框 |
| `acceleratorFromEvent(e)` | 1223 | keydown → Electron accelerator 转换 |
| `handleKeyCaptureKeydown(e)` | 1275 | 捕获对话框内按键处理 |
| `saveCapturedShortcut()` | 1297 | 保存捕获的快捷键 |
| `resetShortcut(action)` | 1312 | 恢复默认快捷键 |

**HTML 结构（`src/index.html:416-441`）：**
- `shortcutsModal` — 快捷键列表对话框
- `shortcutCaptureModal` — 按键捕获对话框

### 1.4 IPC 通道现状

**规则相关（`ipc-handlers.js`）：**
- `rule:list` — 获取所有规则
- `rule:create` — 创建规则
- `rule:update` — 更新规则
- `rule:delete` — 删除规则
- `rule:match` — URL 匹配
- `rule:reorder` — 重新排序
- `rule:export` — 导出规则
- `rule:import` — 导入规则

**快捷键相关（`ipc-handlers.js`）：**
- `shortcut:list` — 获取快捷键配置
- `shortcut:set` — 设置快捷键
- `shortcut:reset` — 重置快捷键

**设置相关（`ipc-handlers.js`）：**
- `settings:get` — 获取设置
- `settings:set` — 设置单个配置项

---

## 2. 迁移策略分析

### 2.1 核心架构决策：设置页面如何访问规则/快捷键数据

**问题：** 设置页面运行在 webview guest 中，不能直接调用 IPC。规则和快捷键数据当前通过 `window.realmAPI.*`（IPC）访问。

**方案 A：扩展 HTTP API（推荐）**

在本地 HTTP 服务器上新增 `/api/rules/*` 和 `/api/shortcuts/*` 端点，设置页面通过 HTTP 访问。

**优点：**
- 与现有设置页面架构一致（`settings-page.js` 已使用 HTTP API）
- 安全模型不变（token 验证）
- 无需修改 webview 安全策略

**缺点：**
- 需要在 `main.js` 中添加新的 HTTP 路由
- 需要同步 IPC 功能到 HTTP 端点

**实现位置：** `main.js` 中的 `internalServer`（本地 HTTP 服务器）

**方案 B：在主窗口渲染进程中实现设置页面**

将设置页面从 webview 迁移到主窗口渲染进程（`src/renderer.js`），直接使用 `window.realmAPI`。

**优点：**
- 无需新增 HTTP API
- 直接复用现有 IPC 接口

**缺点：**
- 需要重构设置页面的加载机制（从 webview 改为主窗口内嵌）
- 与现有 `realm://` 协议架构不一致
- 设置页面 CSS 可能与主窗口样式冲突

**决策：采用方案 A**，扩展 HTTP API。理由：
1. 与现有架构一致（`settings-page.js` 已经通过 HTTP API 工作）
2. 保持 webview 隔离的安全模型
3. 改动范围可控

### 2.2 规则管理迁移路径

**当前流程：**
1. 用户点击工具栏"规则"按钮 → `showRulesModal()` 显示 `<dialog>` 模态框
2. 规则数据通过 `window.realmAPI.getRules()`（IPC `rule:list`）获取
3. 规则操作通过 `window.realmAPI.createRule/updateRule/deleteRule`（IPC）

**目标流程：**
1. 用户点击设置页面侧边栏"分配规则" → 右侧内容区显示规则管理
2. 规则数据通过 HTTP API `/api/rules/list` 获取
3. 规则操作通过 HTTP API `/api/rules/*`

**迁移步骤：**
1. 在 `main.js` HTTP 服务器中添加 `/api/rules/*` 路由
2. 在 `settings-page.js` 中添加规则管理逻辑（从 `renderer.js` 迁移）
3. 在 `settings.html` 中添加规则管理 HTML（从 `index.html` 迁移）
4. 保留 `index.html` 中的规则模态框（兼容性）或移除

### 2.3 快捷键设置迁移路径

**当前流程：**
1. 用户点击工具栏"快捷键"按钮 → `showShortcutsModal()` 显示 `<dialog>` 模态框
2. 快捷键数据通过 `window.realmAPI.getShortcuts()`（IPC `shortcut:list`）获取
3. 修改快捷键通过 `window.realmAPI.setShortcut()`（IPC `shortcut:set`）
4. 按键捕获在 `shortcutCaptureModal`（`<dialog>`）中进行

**目标流程：**
1. 用户点击设置页面侧边栏"快捷键设置" → 右侧内容区显示快捷键列表
2. 快捷键数据通过 HTTP API `/api/shortcuts/list` 获取
3. 修改快捷键通过 HTTP API `/api/shortcuts/set`
4. 按键捕获复用现有 `shortcutCaptureModal`（在设置页面 webview 内）

**特殊考虑：**
- 按键捕获需要在设置页面 webview 内实现 `<dialog>` 模态框
- 设置页面 webview 内的 `keydown` 事件可以正常工作
- 需要在 `settings.html` 中添加 `shortcutCaptureModal` 的 HTML

---

## 3. 技术约束和注意事项

### 3.1 Webview 安全模型

设置页面运行在 webview guest 中，受以下约束：
- **不能直接调用 IPC**（`assertTrustedSender` 会拒绝）
- **CSP 限制**：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http: data:`
- **API token**：通过 URL 查询参数传递，用于验证 HTTP API 请求

### 3.2 现有代码复用

**可直接复用的代码：**
- `renderRulesList()` — 规则列表渲染逻辑（DOM 构建 + textContent）
- `handleDragStart/Over/Drop/End` — 拖拽排序逻辑
- `renderShortcutsList()` — 快捷键列表渲染逻辑
- `acceleratorFromEvent()` — 按键转换函数
- `handleKeyCaptureKeydown()` — 按键捕获逻辑
- `SHORTCUT_NAMES` — 快捷键中文名称映射

**需要修改的代码：**
- 数据获取方式：从 `window.realmAPI.*`（IPC）改为 `fetch('/api/*')`（HTTP）
- DOM 元素引用：从 `elements.*`（index.html）改为新的设置页面元素

### 3.3 CSS 样式系统

**现有 CSS 变量（`src/styles/main.css`）：**
```css
--bg-primary: #1a1a1a;
--bg-secondary: #2a2a2a;
--bg-tertiary: #3a3a3a;
--text-primary: #f0f0f0;
--text-secondary: #a0a0a0;
--text-muted: #6b7280;
--border-color: #404040;
--accent-color: #3B82F6;
--danger-color: #EF4444;
```

**UI-SPEC.md 定义的颜色（需更新）：**
UI-SPEC.md 中定义的颜色值（如 `#1a1a2e`、`#16213e`）与实际 CSS 变量值不同。实现时应使用 CSS 变量，而非硬编码颜色值。

### 3.4 拖拽排序实现

现有拖拽排序使用 HTML5 原生拖拽 API（`dragstart`、`dragover`、`drop`、`dragend`）。迁移到设置页面时，逻辑完全相同，只需修改 DOM 元素引用。

---

## 4. 文件修改清单

### 4.1 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/settings.html` | 重构为带侧边栏的多页面布局，添加规则/快捷键/关于页面 HTML |
| `src/settings-page.js` | 扩展支持页面切换、规则管理、快捷键设置逻辑 |
| `src/styles/main.css` | 添加设置页面侧边栏、规则列表、快捷键列表样式 |
| `main.js` | 在 HTTP 服务器中添加 `/api/rules/*` 和 `/api/shortcuts/*` 路由 |

### 4.2 可能需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/index.html` | 移除规则/快捷键模态框 HTML（如果完全迁移到设置页面） |
| `src/renderer.js` | 移除规则/快捷键相关函数（如果完全迁移） |
| `ipc-handlers.js` | 无需修改（IPC 通道保持不变，HTTP API 调用现有 IPC） |

### 4.3 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `shortcut-manager.js` | 快捷键管理逻辑不变，设置页面通过 HTTP API 调用 |
| `assignment-rules.js` | 规则管理逻辑不变，设置页面通过 HTTP API 调用 |
| `src/preload.js` | IPC 接口不变，HTTP API 在主进程中实现 |

---

## 5. 实现策略

### 5.1 推荐实现顺序

1. **HTTP API 扩展**（`main.js`）
   - 添加 `/api/rules/*` 路由（list、create、update、delete、reorder、import、export）
   - 添加 `/api/shortcuts/*` 路由（list、set、reset）

2. **设置页面 HTML 重构**（`src/settings.html`）
   - 添加侧边栏导航结构
   - 添加通用设置、分配规则、快捷键设置、关于四个内容区域
   - 添加规则列表、快捷键列表的 HTML 结构
   - 添加按键捕获对话框

3. **设置页面逻辑扩展**（`src/settings-page.js`）
   - 添加页面切换逻辑
   - 添加规则管理函数（从 `renderer.js` 迁移）
   - 添加快捷键设置函数（从 `renderer.js` 迁移）
   - 添加拖拽排序逻辑

4. **样式扩展**（`src/styles/main.css`）
   - 添加侧边栏样式
   - 添加规则列表样式
   - 添加快捷键列表样式

5. **清理（可选）**
   - 移除 `index.html` 中的规则/快捷键模态框
   - 移除 `renderer.js` 中的规则/快捷键相关函数

### 5.2 关键技术点

**HTTP API 路由设计：**
```
GET    /api/rules/list        — 获取所有规则
POST   /api/rules/create      — 创建规则 {containerId, pattern}
POST   /api/rules/update      — 更新规则 {ruleId, updates}
POST   /api/rules/delete      — 删除规则 {ruleId}
POST   /api/rules/reorder     — 重新排序 {orderedIds}
GET    /api/rules/export      — 导出规则
POST   /api/rules/import      — 导入规则

GET    /api/shortcuts/list    — 获取快捷键配置
POST   /api/shortcuts/set     — 设置快捷键 {action, accelerator}
POST   /api/shortcuts/reset   — 重置快捷键 {action}
```

**页面切换实现：**
```javascript
// 侧边栏点击 → 切换内容区域
function switchSettingsPage(pageName) {
  // 隐藏所有内容页面
  document.querySelectorAll('.settings-section').forEach(el => {
    el.style.display = 'none';
  });
  // 显示目标页面
  document.getElementById(`settings-${pageName}`).style.display = 'block';
  // 更新侧边栏选中状态
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageName);
  });
}
```

---

## 6. 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| HTTP API 路由冲突 | 规则/快捷键 API 与现有设置 API 冲突 | 使用 `/api/rules/*` 和 `/api/shortcuts/*` 前缀，避免与 `/api/settings/*` 冲突 |
| 拖拽排序在 webview 内不工作 | 规则排序功能失效 | HTML5 拖拽 API 在 webview 内正常工作，无需特殊处理 |
| 按键捕获在 webview 内不工作 | 快捷键修改功能失效 | `keydown` 事件在 webview 内正常工作，现有 `shortcutCaptureModal` 可直接复用 |
| 设置页面 CSS 与主窗口冲突 | 样式错乱 | 设置页面运行在独立的 webview 中，CSS 隔离，不会冲突 |
| 规则/快捷键模态框移除后兼容性问题 | 现有用户习惯被打破 | 保留工具栏按钮，点击后跳转到设置页面对应区域 |

---

## 7. 测试要点

1. **页面切换**：点击侧边栏各项，右侧内容区正确切换
2. **通用设置**：默认浏览器、历史保留天数、默认容器、启动行为设置正常
3. **规则管理**：添加、删除、启用/禁用、拖拽排序、导入/导出功能正常
4. **快捷键设置**：查看、修改、重置、重置全部功能正常
5. **按键捕获**：在设置页面 webview 内按键捕获正常工作
6. **数据同步**：设置页面修改后，主窗口立即生效

---

## RESEARCH COMPLETE

**研究完成时间：** 2026-07-27
**研究范围：** 现有架构分析、迁移策略、技术约束、文件修改清单、实现策略
**关键发现：**
1. 设置页面运行在 webview guest 中，不能直接调用 IPC，需要扩展 HTTP API
2. 规则/快捷键管理逻辑可从 `renderer.js` 迁移到 `settings-page.js`，数据访问方式从 IPC 改为 HTTP
3. 现有拖拽排序、按键捕获逻辑可直接复用
4. 推荐实现顺序：HTTP API → HTML 重构 → 逻辑扩展 → 样式扩展 → 清理
