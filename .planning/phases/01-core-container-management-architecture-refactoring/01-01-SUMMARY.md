---
phase: 01-core-container-management-architecture-refactoring
plan: 01
subsystem: container-management
tags: [refactoring, modularization, ui, container-panel]
dependency_graph:
  requires: []
  provides: [container-manager, window-manager, ipc-handlers, container-panel]
  affects: [main.js, preload.js, renderer.js, index.html, main.css]
tech_stack:
  added: []
  patterns: [module-extraction, event-delegation, ipc-naming-convention]
key_files:
  created:
    - container-manager.js
    - window-manager.js
    - ipc-handlers.js
  modified:
    - main.js
    - src/preload.js
    - src/renderer.js
    - src/index.html
    - src/styles/main.css
decisions:
  - D-01: 从 main.js 提取容器管理逻辑到独立模块
  - D-02: 模块导出函数，不互相 require
  - D-03: 使用 container:* 新格式 IPC 通道命名
  - D-04: 添加容器下拉面板 UI
  - D-05: 使用事件委托模式处理面板交互
metrics:
  duration: ~15 minutes
  completed_date: 2026-07-23
  tasks_completed: 10
  files_created: 3
  files_modified: 5
status: complete
---

# Phase 01 Plan 01: Walking Skeleton Summary

**模块化架构重构 + 容器下拉面板（Popover）+ 容器切换功能**

## 实现内容

### 核心模块拆分

1. **container-manager.js** - 容器管理模块
   - 从 main.js 提取容器 CRUD 逻辑
   - 管理 electron-store 配置持久化
   - 处理 Session partition 创建和清理
   - 导出：initContainers, getContainers, getContainer, createContainer, updateContainer, deleteContainer

2. **window-manager.js** - 窗口管理模块
   - 管理 BrowserWindow 实例
   - 维护 windowContainerMap 映射关系
   - 处理容器切换通知
   - 导出：createMainWindow, getCurrentContainer, switchContainer

3. **ipc-handlers.js** - IPC 处理器模块
   - 集中注册所有 IPC 处理器
   - 使用 container:* 新格式命名
   - 包含参数验证逻辑
   - 导出：registerHandlers

4. **main.js** - 简化为入口文件
   - 从 ~273 行减少到 ~50 行
   - 仅包含应用生命周期和模块组装

### 容器下拉面板功能

1. **UI 结构**
   - 在 toolbar-center 区域添加容器指示器
   - 点击指示器弹出 280px 宽的下拉面板
   - 面板头部显示"容器列表"标题和新建按钮
   - 面板列表显示所有容器（颜色圆点 + emoji + 名称）

2. **交互逻辑**
   - 使用事件委托模式处理面板点击
   - 当前活跃容器以高亮背景 + ✓ 标识
   - 点击容器切换成功后关闭面板
   - 点击面板外部区域关闭面板
   - Escape 键关闭面板

3. **样式设计**
   - position: fixed 定位
   - 深色主题配色
   - hover 时显示编辑/删除按钮
   - 平滑过渡动画

## 技术决策

### IPC 通道命名规范
- 旧格式：get-containers, switch-container
- 新格式：container:list, container:switch
- 原因：更清晰的命名空间划分，便于扩展

### 事件委托模式
- 为 panelContainerList 绑定一次 click 监听器
- 通过 event.target.closest('[data-container-id]') 路由
- 避免为每个容器项单独绑定事件

### XSS 防护
- 容器名称使用 textContent 渲染
- 避免使用 innerHTML 插入用户输入

## 验证结果

- [x] 所有文件语法验证通过
- [x] container-manager.js 正确导出 6 个函数
- [x] window-manager.js 正确导出 3 个函数
- [x] ipc-handlers.js 正确导出 registerHandlers
- [x] main.js 简化为入口文件
- [x] preload.js 使用 container:* 新格式
- [x] index.html 添加容器面板 HTML
- [x] main.css 添加面板样式
- [x] renderer.js 实现面板交互逻辑

## 遗留项目

- 容器编辑功能（TODO）
- 容器删除功能（TODO）
- URL 导航功能（TODO）

## 文件清单

| 文件 | 操作 | 行数 |
|------|------|------|
| container-manager.js | 新建 | ~180 |
| window-manager.js | 新建 | ~90 |
| ipc-handlers.js | 新建 | ~120 |
| main.js | 重写 | ~45 |
| src/preload.js | 重写 | ~70 |
| src/renderer.js | 重写 | ~290 |
| src/index.html | 重写 | ~165 |
| src/styles/main.css | 追加 | +100 |

## Self-Check: PASSED

所有文件创建和修改已完成，语法验证通过。
