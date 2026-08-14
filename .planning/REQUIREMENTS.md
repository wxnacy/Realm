# Milestone v2.4 Requirements

**Milestone:** v2.4 多窗口支持
**Goal:** 支持多窗口操作，提升多任务处理效率
**Created:** 2026-08-14

## v1 Requirements

### 窗口管理基础

- [ ] **MW-01**: 用户可以通过 Dock 右击菜单新建窗口
- [ ] **MW-08**: 用户可以使用 Cmd+N 快捷键新建窗口
- [ ] **MW-09**: 用户可以使用 Cmd+Shift+W 关闭当前窗口
- [ ] **MW-10**: 多窗口时窗口间焦点切换正常工作

### Tab 窗口关联

- [ ] **MW-05**: 关闭窗口时，窗口内所有 Tab 一起关闭；如果是最后一个窗口则退出应用
- [ ] **MW-06**: Tab 拖拽过程中保留 URL、容器、标题、favicon 等状态
- [ ] **MW-07**: 新建窗口时继承源窗口的容器上下文

### Tab 拖拽排序（窗口内）

- [ ] **MW-04**: 用户可以拖拽 Tab 在同一窗口内改变顺序，实时显示插入位置指示器

### Tab 跨窗口移动

- [ ] **MW-02**: 用户可以拖拽 Tab 出标签栏，创建包含该 Tab 的新窗口
- [ ] **MW-03**: 用户可以拖拽 Tab 到另一个窗口的标签栏，Tab 从源窗口移动到目标窗口；如果源窗口仅剩一个 Tab，源窗口自动销毁

### 差异化功能

- [ ] **MW-11**: 窗口位置和大小在重启后恢复（electron-store 持久化）
- [ ] **MW-12**: 窗口标题栏显示当前容器名称
- [ ] **MW-13**: 右键菜单添加"在新窗口中打开"选项
- [ ] **MW-14**: 窗口标题栏/工具栏显示容器颜色标识

## Future Requirements

<!-- 下一里程碑可能包含的功能 -->

- 窗口合并（多窗口合并为一个）
- 跨窗口 Tab 搜索
- 窗口分屏/平铺
- 窗口状态持久化（所有窗口布局跨重启保留）

## Out of Scope

- **macOS 原生 Tab 集成** — 与自定义 Tab 栏冲突，行为不可控
- **窗口透明/毛玻璃** — 非浏览器标准行为
- **窗口置顶/悬浮** — 非浏览器标准行为

## Traceability

<!-- 由 roadmap 填充，记录每个需求被哪个 Phase 覆盖 -->

| Requirement | Phase | Status |
|-------------|-------|--------|
| MW-01 | — | Pending |
| MW-02 | — | Pending |
| MW-03 | — | Pending |
| MW-04 | — | Pending |
| MW-05 | — | Pending |
| MW-06 | — | Pending |
| MW-07 | — | Pending |
| MW-08 | — | Pending |
| MW-09 | — | Pending |
| MW-10 | — | Pending |
| MW-11 | — | Pending |
| MW-12 | — | Pending |
| MW-13 | — | Pending |
| MW-14 | — | Pending |
