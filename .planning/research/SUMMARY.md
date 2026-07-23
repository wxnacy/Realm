# 项目研究总结

**项目:** Realm Browser — 多容器隔离浏览器
**领域:** Electron 桌面应用
**研究日期:** 2026-07-23
**置信度:** HIGH

---

## 执行摘要

Realm Browser 是一款基于 Electron 的多容器隔离浏览器，定位为「Firefox Multi-Account Containers 的独立桌面应用版本」。研究结论明确：必须升级到 Electron 36+ 并采用 `BaseWindow + WebContentsView` 架构，而非继续使用已废弃的 BrowserView。容器隔离的核心机制（`session.fromPartition('persist:container-xxx')`）已被验证为正确且稳定，但当前代码存在多个架构缺陷——包括容器切换未真正生效、缺少多 Tab 支持、以及所有逻辑集中在单一文件中。

基于竞品分析（Firefox MAC、Ghost Browser、Multilogin、GoLogin），Realm 的差异化定位应聚焦于：简单易用的个人多容器浏览器，不追求反检测/指纹伪装，不追求团队协作，预留 AI Agent 接口但不在 v1 实现。MVP 范围明确：容器 CRUD + 完整数据隔离 + URL 导航 + 多 Tab 支持。

最大的技术风险是：Session 隔离泄漏（容器间 Cookie 渗透）、Cookie domain 前导点号处理不当、以及多 WebContents 内存泄漏。这些陷阱在 Phase 1 和 Phase 2 必须严格验证，否则后续所有功能都建立在错误的隔离基础上。

---

## 关键发现

### 推荐技术栈

详见 [STACK.md](./STACK.md)

**核心技术：**
- **Electron 36.3.1**：当前 32.x 已结束支持，36 是 LTS 版本，Chromium 136 + Node 22.14
- **BaseWindow + WebContentsView**：BrowserView 已废弃（Electron 30 起），WebContentsView 是官方推荐替代，原生支持多视图
- **Electron Session API**：`session.fromPartition('persist:container-xxx')` 实现完全隔离，无需第三方库
- **electron-store ^11.0.0**：容器配置持久化，从 8.x 升级（注意 breaking changes）

**关键决策：** BrowserView → WebContentsView 迁移是不可回避的架构变更。每个 Tab 对应一个独立的 WebContentsView，通过 `addChildView()` 添加到 BaseWindow，通过 `setVisible()` 控制显示/隐藏。

### 预期功能

详见 [FEATURES.md](./FEATURES.md)

**必须有（MVP v1）：**
- 容器 CRUD（创建/编辑/删除）— 用户管理自己的容器
- 容器自定义（名称/颜色/图标）— 视觉区分是基本需求
- 完整数据隔离（Cookie/Session/LocalStorage/IndexedDB/HTTP 缓存）— 核心价值
- URL 导航 + 基础导航（前进/后退/刷新）— 浏览器基本功能
- 多 Tab 支持 — 同一窗口内多个容器的 Tab
- 容器管理 UI — 下拉面板显示容器列表

**应该有（v1.x 验证后添加）：**
- Cookie 文件持久化（JSON 导出/导入）— 备份和迁移
- 容器分配规则（URL 自动归类）— Firefox MAC 的杀手功能
- 快捷键支持 — 效率用户需求
- 容器颜色标识 Tab UI — 视觉区分当前容器

**推迟到 v2+：**
- 每容器独立代理 — 需要代理基础设施
- 团队协作 — 需要云同步和权限系统
- AI Agent 集成 — 预留架构，等待市场成熟
- 浏览器扩展支持 — 技术复杂度高

### 架构方案

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)

**四层架构：**
1. **窗口层（Window Layer）**：BaseWindow 管理多个 WebContentsView，每个 Tab 是独立视图
2. **容器层（Container Layer）**：ContainerManager 负责 CRUD 和配置管理，SessionManager 负责 partition 创建
3. **Session 层（Session Layer）**：每个容器独立的 Session（persist:container-xxx），实现完全隔离
4. **持久化层（Persistence Layer）**：electron-store 存储容器配置，Cookie JSON 作为导入导出

**推荐项目结构：** 从当前的单一 `main.js` 拆分为：`main/index.js`（入口）、`main/container-manager.js`（容器管理）、`main/tab-manager.js`（Tab 管理）、`main/session-manager.js`（Session 管理）、`main/cookie-manager.js`（Cookie 持久化）、`main/ipc-handlers.js`（IPC 处理器）。

**关键数据流：** 渲染进程通过 `realmAPI`（preload.js 暴露）调用主进程方法，主进程执行 Session/Container/Tab 操作后返回结果。所有 Session 操作必须在主进程执行，渲染进程不能直接操作 Session 对象。

### 关键陷阱

详见 [PITFALLS.md](./PITFALLS.md)

1. **Session 隔离泄漏** — partition 命名冲突、默认 Session 渗透、UI 视图与 Tab 视图 Session 不一致都会导致跨容器 Cookie 渗透。必须在 Phase 1 严格验证。
2. **Cookie domain 前导点号** — 持久化时必须保留原始 domain（含前导点号），否则恢复后部分站点登录状态丢失。
3. **多 WebContents 内存泄漏** — 事件监听器未清理、引用未释放、DOM 节点泄漏都会导致内存持续增长。Tab 关闭时必须完整清理。
4. **BrowserView 已废弃** — 必须迁移到 WebContentsView，否则未来 Electron 版本可能移除支持。
5. **容器 ID 碰撞和注入** — 当前 ID 生成策略存在碰撞风险，需要 UUID 或唯一性检查。

---

## 路标建议

基于研究发现，建议分为 4 个阶段：

### Phase 1: 基础架构重构 + 核心容器

**理由：** 当前所有逻辑集中在 main.js，必须先拆分为独立模块。同时实现容器 CRUD 和 Session 隔离机制，这是所有后续功能的基础。

**交付：**
- Electron 升级到 36+
- main.js 拆分为 ContainerManager、SessionManager、IPCHandlers 等独立模块
- 容器 CRUD（创建/编辑/删除）+ 容器配置持久化（electron-store）
- 完整 Session 隔离验证（Cookie/Session/LocalStorage/IndexedDB）
- 容器管理 UI（下拉面板）

**覆盖功能：** 容器 CRUD、容器自定义、容器管理 UI、完整数据隔离

**必须避免：** Session 隔离泄漏、容器 ID 碰撞、XSS 注入、事件监听累积

---

### Phase 2: 多 Tab 架构 + URL 导航

**理由：** 依赖 Phase 1 的模块化架构和容器隔离机制。多 Tab 是产品核心体验，URL 导航是浏览器基本功能。

**交付：**
- BrowserView → WebContentsView 迁移（BaseWindow + 多 WebContentsView）
- TabManager 实现（创建/切换/关闭 Tab）
- URL 导航（地址栏输入、前进/后退/刷新）
- 窗口 resize 布局管理
- Tab 栏 UI（显示容器颜色标识）

**覆盖功能：** 多 Tab 支持、URL 导航、基础导航、容器颜色标识 Tab

**必须避免：** 多 WebContents 内存泄漏、Tab 切换时 Session 不同步、窗口关闭时资源清理不完整

---

### Phase 3: Cookie 持久化 + 容器分配规则

**理由：** 依赖 Phase 2 的 Tab 系统和容器隔离。Cookie 持久化增强用户信任，容器分配规则是 Firefox MAC 的杀手功能。

**交付：**
- CookieManager 实现（JSON 导出/导入、定时备份、启动恢复）
- Cookie domain 前导点号正确处理
- 容器分配规则（URL 自动归类到指定容器）
- 容器间数据导入导出
- 快捷键支持

**覆盖功能：** Cookie 文件持久化、容器分配规则、快捷键支持、数据导入导出

**必须避免：** Cookie domain 前导点号处理不当、Session 存储路径不可控

---

### Phase 4: 体验优化 + 性能调优

**理由：** 前三阶段完成后，产品已具备核心功能。此阶段聚焦用户体验和性能。

**交付：**
- Tab discarding（后台 Tab 释放内存）
- 延迟加载非默认容器
- 容器分组和搜索
- 关闭 Tab 动画
- 删除容器确认对话框
- 性能监控和优化

**覆盖功能：** Tab discarding、容器分组、性能优化

---

### 阶段排序理由

- Phase 1 是所有后续工作的基础：没有模块化架构和容器隔离，其他功能都无法正确实现
- Phase 2 依赖 Phase 1 的 ContainerManager 和 SessionManager：Tab 需要绑定到容器的 Session
- Phase 3 依赖 Phase 2 的 TabManager：Cookie 持久化需要在 Tab 关闭/应用退出时触发
- Phase 4 是锦上添花：前三阶段完成后产品已可用，此阶段优化体验

### 研究标记

需要深入研究的阶段：
- **Phase 2：** WebContentsView 多 Tab 架构的具体实现细节，特别是 BaseWindow 与 BrowserWindow 的差异（如 preload.js 行为变化）

标准模式（可跳过研究）的阶段：
- **Phase 1：** Electron 模块拆分和 ContainerManager 模式非常成熟
- **Phase 3：** Cookie 持久化和 JSON 导出有成熟的参考实现（AutoBrowser）

---

## 置信度评估

| 领域 | 置信度 | 说明 |
|------|--------|------|
| 技术栈 | HIGH | Electron 官方文档明确：36.x 是当前 LTS，WebContentsView 是官方推荐替代 |
| 功能定义 | MEDIUM | 基于 5 个竞品的一手信息，但未经过用户验证 |
| 架构设计 | HIGH | 官方迁移指南完整，Session 隔离机制成熟，代码模式清晰 |
| 陷阱识别 | HIGH | 基于官方文档、RFC 6265 规范、Chromium 源码和实际项目经验 |

**总体置信度：HIGH**

### 待解决的差距

- **electron-store 8.x → 11.x breaking changes：** 需要在 Phase 1 升级时实际测试，可能有 API 变更
- **BaseWindow 的 preload.js 行为：** BaseWindow 本身不加载 preload.js，需要通过 WebContentsView 的 webContents 交互，具体实现模式需要在 Phase 2 验证
- **用户对容器分配规则的需求强度：** Firefox MAC 的杀手功能，但 Realm 用户是否需要待验证

---

## 来源

### 主要来源（HIGH 置信度）
- Electron 官方文档：WebContentsView API、BaseWindow API、Session API、Cookies API
- Electron 30+ 弃用公告：BrowserView → WebContentsView 迁移指南
- RFC 6265：HTTP State Management Mechanism（Cookie domain 规范）

### 次要来源（MEDIUM 置信度）
- Firefox Multi-Account Containers 官方扩展页面
- Ghost Browser 官方网站
- Multilogin 官方网站
- GoLogin 官方网站
- AutoBrowser 项目 Cookie 持久化实现

### 参考来源
- npm registry 版本信息（electron@43.2.0, electron-store@11.0.2, electron-builder@26.15.3）
- Chromium 源码：Cookie 存储和匹配逻辑
- 项目代码库分析：main.js、src/preload.js、src/renderer.js

---

*研究完成日期：2026-07-23*
*可进入路标规划：是*
