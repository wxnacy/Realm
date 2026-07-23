# Realm Browser

## What This Is

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie、Session、LocalStorage、IndexedDB 和缓存隔离。用户可以通过工具栏按钮管理容器，在同一窗口内以多 Tab 形式运行不同容器的页面，实现类似 Firefox Multi-Account Containers 的隔离体验。

## Core Value

容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。

## Requirements

### Validated

<!-- 从现有代码推断的已实现能力 -->

- ✓ Electron 应用基础框架 — 现有
- ✓ 基于 Session partition 的容器隔离机制 — 现有
- ✓ 容器配置持久化（electron-store）— 现有
- ✓ IPC 通信架构（contextBridge）— 现有
- ✓ 基础 UI 框架（HTML/CSS/JS）— 现有

### Active

<!-- 当前需要构建的功能 -->

- [ ] **容器管理下拉面板** — 工具栏按钮点击弹出下拉面板，显示容器列表
- [ ] **容器 CRUD** — 创建、查看、编辑、删除容器
- [ ] **容器自定义** — 每个容器支持自定义名称、颜色、图标
- [ ] **容器切换** — 点击容器进入该容器，后续新 Tab 在该容器中打开
- [ ] **多容器 Tab** — 点击不同容器在新 Tab 中打开，所有容器在同一窗口
- [ ] **完整数据隔离** — Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存完全隔离
- [ ] **Cookie 文件持久化** — 每个容器的 Cookie 自动保存到独立 JSON 文件
- [ ] **Cookie 自动加载** — 应用启动时自动加载各容器的 Cookie

### Out of Scope

- **AI Agent 集成** — 预留架构但本期不实现
- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）

## Context

**技术环境：**
- Electron 32.x + Node.js
- 主进程管理 Session 和窗口
- 渲染进程通过 contextBridge 暴露 IPC 接口
- electron-store 持久化容器配置

**参考实现：**
- Firefox Multi-Account Containers 的交互模式
- AutoBrowser 项目的 Cookie 持久化方案（JSON 文件格式，支持 domain 前缀点号保留）

**代码库状态：**
- 已有基础框架，包含容器管理、Session 隔离、IPC 通信
- 需要增强 UI 交互（下拉面板）和 Cookie 持久化功能

## Constraints

- **Tech Stack**: Electron 32.x — 项目已选定，不可更改
- **Platform**: macOS — 主要开发和测试平台
- **Compatibility**: Chromium 内核 — 需兼容主流网站
- **Performance**: 容器切换不能有明显延迟

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用 Electron Session partition 实现隔离 | Electron 原生支持，成熟稳定 | — Pending |
| Cookie 持久化使用 JSON 文件格式 | 参考 AutoBrowser 实现，便于调试和迁移 | — Pending |
| 单窗口多 Tab 架构 | 参考 Firefox Multi-Account Containers 体验 | — Pending |
| 下拉面板而非侧边栏 | 减少屏幕占用，交互更直接 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-23 after initialization*
