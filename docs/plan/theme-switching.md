# 浅色主题和主题切换功能

> 2026-08-16 · Realm Browser v0.1.10

## 需求

- 添加浅色主题支持
- 在设置中提供主题切换功能
- 支持三个选项：浅色 / 深色 / 跟随系统
- 默认使用浅色主题
- DevTools 主题跟随应用主题切换

## 实现方案

### 1. CSS 变量系统改造

**文件**: `src/styles/main.css`

将硬编码的深色主题改为 `[data-theme]` 选择器切换：

```css
:root, [data-theme="dark"] {
  /* 深色主题 */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --text-primary: #f0f0f0;
  /* ... */
}

[data-theme="light"] {
  /* 浅色主题 */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  /* ... */
}
```

### 2. 设置页面 UI

**文件**: `src/settings.html`

在通用设置页面的"外观"设置组中添加主题选择：

```html
<div class="settings-group">
  <h3 class="settings-group-title">外观</h3>
  <div class="settings-item">
    <label for="themeSelect">主题</label>
    <select class="settings-select" id="themeSelect">
      <option value="light">浅色</option>
      <option value="dark">深色</option>
      <option value="system">跟随系统</option>
    </select>
  </div>
</div>
```

### 3. 设置页面逻辑

**文件**: `src/settings-page.js`

- 添加 `applyTheme()` 函数
- 在 `loadSettings()` 中应用主题
- 在 `setupEventListeners()` 中绑定主题选择事件
- 监听系统主题变化（跟随系统时）

### 4. 主窗口渲染进程同步

**文件**: `src/renderer.js`

- 添加 `applyTheme()` 函数
- 初始化时应用主题
- 监听 `settings:updated` 事件，主题变更时实时应用
- 监听 `prefers-color-scheme` 变化（跟随系统时）

### 5. DevTools 主题同步

**文件**: `main.js`

- 导入 `nativeTheme`
- 应用启动时初始化 `nativeTheme.themeSource`
- 设置更新时同步更新 `nativeTheme.themeSource`

### 6. 设置默认值

**文件**: `main.js` 和 `ipc-handlers.js`

在 settings API 的默认值中添加 `theme: 'light'`。

## 修复过程

### 问题 1：主窗口主题不生效

**现象**: 启动后还是深色主题，但设置里显示的是浅色。

**原因**: 主窗口渲染进程没有应用主题逻辑，只有设置页面有 `applyTheme()` 函数。

**修复**: 在 `src/renderer.js` 中添加 `applyTheme()` 函数和初始化逻辑。

### 问题 2：主题设置不生效

**现象**: 手动切换主题没有反应，刷新页面后设置丢失。

**原因**: `elements` 对象中缺少 `themeSelect` 的定义，导致事件绑定和值读取失败。

**修复**: 在 `src/settings-page.js` 的 `elements` 对象中添加 `themeSelect` 引用。

### 问题 3：跟随系统时主窗口不自动切换

**现象**: 系统主题变化时，设置页面自动切换，但主窗口 UI 不变。

**原因**: 主窗口渲染进程没有监听 `prefers-color-scheme` 变化。

**修复**: 在 `src/renderer.js` 中添加 `matchMedia('(prefers-color-scheme: dark)')` 监听。

### 问题 4：DevTools 主题不跟随

**现象**: DevTools 主题始终是深色，不跟随应用主题。

**原因**: 没有同步设置 `nativeTheme.themeSource`。

**修复**: 在 `main.js` 中导入 `nativeTheme`，并在设置更新时同步 `themeSource`。

### 问题 5：启动崩溃

**现象**: `ReferenceError: nativeTheme is not defined`

**原因**: 使用 `nativeTheme` 前没有从 Electron 导入。

**修复**: 在 `main.js` 的 Electron 导入中添加 `nativeTheme`。

## 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `src/styles/main.css` | CSS 变量重构为 `[data-theme]` 选择器 |
| `src/settings.html` | 新增"外观"设置组 |
| `src/settings-page.js` | 添加主题切换逻辑 |
| `src/renderer.js` | 主窗口主题同步 |
| `main.js` | nativeTheme 导入和同步 |
| `ipc-handlers.js` | 添加 theme 默认值 |

## 验证方式

1. **默认主题**: 启动应用后确认默认为浅色主题
2. **设置切换**: 在设置中切换主题，确认 UI 立即变化
3. **持久化**: 重启应用后确认主题设置被保留
4. **跟随系统**: 选择"跟随系统"后，切换系统深色/浅色模式，确认应用和 DevTools 都跟随变化
5. **多窗口**: 打开多个窗口，切换主题后确认所有窗口同步更新
