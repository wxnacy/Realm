# Walking Skeleton — Realm Browser

**Phase:** 1
**Generated:** 2026-07-23

## Capability Proven End-to-End

用户可以通过工具栏下拉面板查看所有容器列表，点击容器切换当前活跃容器，工具栏指示器实时更新显示当前容器名称和颜色。

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Electron 32.x | 项目已选定，不可更改（CLAUDE.md 约束） |
| Data layer | electron-store + Session partition | 已集成，原子写入，容器隔离原生支持 |
| Auth | 不适用（本地单用户应用） | 无认证需求 |
| Deployment target | 本地 macOS 桌面应用 | npm run dev 开发模式，npm run build:mac 生产构建 |
| Directory layout | 根目录模块文件 + src/ 前端资源 | container-manager.js, ipc-handlers.js 在根目录；renderer.js, index.html, main.css 在 src/ |

## Stack Touched in Phase 1

- [x] 项目 scaffold — 现有 Electron 项目已具备，main.js 入口、preload.js 桥接、renderer.js 渲染
- [ ] 模块化重构 — main.js 拆分为 container-manager.js + ipc-handlers.js + main.js（入口）
- [x] Data layer — electron-store 读写容器配置（已有，Phase 1 扩展 CRUD）
- [x] UI — 容器下拉面板（Popover）+ 容器创建/编辑 Modal + 删除确认弹窗
- [ ] 运行命令 — `npm run dev` 启动完整 Electron 应用

## Out of Scope (Deferred to Later Slices)

- URL 导航和网页加载（Phase 2: BROW-01, BROW-02）
- 多 Tab 支持和 WebContentsView 迁移（Phase 2: BROW-03, BROW-04, BROW-05）
- 完整数据隔离验证 — LocalStorage, IndexedDB, HTTP 缓存（Phase 3: ISO-01~04）
- Cookie 文件持久化和自动加载（Phase 3: PST-01~03）
- 容器分配规则和快捷键（Phase 4: CNV-01, CNV-02）
- 测试框架配置（可在后续 Phase 补充）

## Subsequent Slice Plan

每个后续 Phase 在此骨架基础上添加一个垂直切片，不改变架构决策：

- Phase 2: 用户可以在容器中输入 URL 导航网页，多 Tab 浏览不同容器页面
- Phase 3: 完整数据隔离 + Cookie 文件持久化，应用重启后自动恢复登录状态
- Phase 4: 容器分配规则 + 快捷键提升多容器浏览效率
