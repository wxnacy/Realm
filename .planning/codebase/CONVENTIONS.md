# 编码规范

**分析日期:** 2026-07-23

## 命名规范

**文件名:**
- 使用 kebab-case（小写 + 连字符）：`main.js`、`preload.js`、`renderer.js`
- CSS 文件：`main.css`
- HTML 文件：`index.html`

**变量:**
- 使用 camelCase：`containerId`、`windowContainerMap`、`state.selectedColor`
- DOM 元素引用：`elements.containerList`、`elements.urlInput`
- 布尔值：不加 `is/has` 前缀，直接描述状态

**函数:**
- 使用 camelCase：`initContainers()`、`createMainWindow()`、`switchContainer()`
- 动词开头：`get`、`set`、`create`、`delete`、`load`、`render`、`update`、`show`、`hide`
- 异步函数：使用 `async/await`，不使用 `.then()` 链式调用

**常量:**
- 使用 UPPER_SNAKE_CASE：`DEFAULT_CONTAINERS`
- 配置对象：`configStore`
- 放在文件顶部，函数定义之前

**类/构造函数:**
- 使用 PascalCase（当前代码未使用类，但规范要求）

**CSS 类名:**
- 使用 kebab-case：`container-item`、`sidebar-header`、`btn-icon`
- BEM 风格的变体：`container-list`、`container-item`、`container-dot`

## 代码风格

**缩进:**
- 使用 2 个空格
- 不使用 Tab

**字符串:**
- 使用单引号：`'default'`、`'persist:container-${containerId}'`
- 模板字符串用于插值：`` `persist:container-${container.id}` ``

**分号:**
- 语句末尾使用分号

**括号:**
- 控制语句的大括号与语句同行
- 函数定义使用 `function` 关键字（不使用箭头函数作为顶层函数）

**注释:**
- 文件顶部：文件描述注释（多行 `/** */`）
- 函数上方：JSDoc 注释，包含功能描述和参数说明
- 行内注释：使用 `//`，用于解释复杂逻辑
- 分隔符：使用 `// ====================` 分隔代码区域

```javascript
/**
 * Realm Browser - 主进程入口
 *
 * 基于 Electron 的多容器隔离浏览器
 * 每个容器对应独立的 Session，实现完全隔离的 Cookie、缓存和存储
 */

// ==================== IPC 通信处理 ====================

/**
 * 获取所有容器列表
 */
ipcMain.handle('get-containers', () => {
  // ...
});
```

## 导入组织

**顺序:**
1. Electron 模块：`{ app, BrowserWindow, ipcMain, session }`
2. Node.js 内置模块：`path`
3. 第三方模块：`electron-store`
4. 本地模块（无，当前为单文件架构）

**模式:**
```javascript
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');
```

## 错误处理

**模式:**
- 容器不存在时返回 `false` 或空数组
- 删除默认容器时返回 `{ success: false, message: '无法删除默认容器' }`
- 使用 `console.error` 记录错误
- 不使用 try-catch（当前代码）

```javascript
// 容器不存在时的处理
if (!container) {
  console.error(`[Realm] 容器不存在: ${containerId}`);
  return false;
}

// 删除保护
if (containerId === 'default') {
  return { success: false, message: '无法删除默认容器' };
}
```

## 日志规范

**格式:**
- 使用 `[Realm]` 前缀标识主进程日志
- 使用 `[Realm Renderer]` 前缀标识渲染进程日志
- 包含操作描述和关键信息

```javascript
console.log(`[Realm] 初始化容器: ${container.name} (${partition})`);
console.log(`[Realm] 新建容器: ${name} (${partition})`);
console.log(`[Realm Renderer] 初始化...`);
```

## 状态管理

**渲染进程:**
- 使用全局 `state` 对象存储应用状态
- 状态更新后调用对应的渲染函数

```javascript
const state = {
  containers: [],
  currentContainer: 'default',
  selectedColor: '#3B82F6',
};
```

**主进程:**
- 使用 `Map` 存储运行时状态：`containers`、`windowContainerMap`
- 使用 `electron-store` 持久化配置

## DOM 操作

**元素引用:**
- 集中在 `elements` 对象中管理
- 使用 `document.getElementById` 和 `document.querySelector`

```javascript
const elements = {
  containerList: document.getElementById('containerList'),
  urlInput: document.getElementById('urlInput'),
  // ...
};
```

**事件监听:**
- 在 `setupEventListeners()` 函数中集中绑定
- 使用 `addEventListener`，不使用内联事件

## IPC 通信

**通道命名:**
- 使用 kebab-case：`get-containers`、`switch-container`
- 动词-名词格式：`get-xxx`、`set-xxx`、`create-xxx`、`delete-xxx`

**暴露 API:**
- 通过 `contextBridge.exposeInMainWorld` 暴露
- 挂载在 `window.realmAPI` 下

```javascript
// preload.js
contextBridge.exposeInMainWorld('realmAPI', {
  getContainers: () => ipcRenderer.invoke('get-containers'),
  // ...
});

// renderer.js
const containers = await window.realmAPI.getContainers();
```

---

*规范分析: 2026-07-23*
