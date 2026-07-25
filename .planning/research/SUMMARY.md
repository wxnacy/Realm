# Project Research Summary

**Project:** Realm Browser v1.1
**Domain:** Electron 多容器隔离浏览器 -- 容器属性增强 + 收藏历史 + 常用网站 + 设置页面
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

Realm Browser 是一个基于 Electron 32.x 的多容器隔离浏览器，v1.1 目标是在已有容器 CRUD、Tab 管理、Cookie 持久化基础上，新增容器属性扩展、收藏夹、浏览历史、常用网站推荐和设置页面五个功能模块。研究表明，所有新增功能均可在现有技术栈内实现，**不需要引入任何新的 npm 依赖**，核心存储继续使用 electron-store（JSON 文件），历史记录和收藏夹通过扩展 electron-store schema 完成。

架构分析确认现有模块化设计（container-manager、tab-manager、cookie-manager + ipc-handlers 集中注册 + preload contextBridge 暴露）可以直接扩展，无需重构。建议按依赖关系分 5 个 Wave 构建：先做无依赖的容器属性扩展和历史记录（后者是常用网站推荐的前置依赖），再做收藏夹、常用网站推荐，最后做独立的设置页面。

主要风险集中在三个方面：(1) electron-store 作为历史记录存储引擎的性能上限约在万级数据量，需要设置每容器 10000 条上限和 FIFO 淘汰机制；(2) macOS 默认浏览器注册依赖代码签名和系统权限，开发阶段无法完整测试；(3) 容器属性 Schema 扩展必须处理旧数据兼容（读取时填充默认值），否则旧用户升级会崩溃。

## Key Findings

### Recommended Stack

v1.1 不引入任何新依赖。所有数据持久化通过扩展现有 electron-store schema 完成，浏览历史通过 webview 内置导航事件采集，默认浏览器注册使用 Electron 内置 API。

**Core technologies (existing, unchanged):**
- **Electron 32.x**: 桌面应用框架，提供 Session 隔离、webview、IPC 通信
- **electron-store 8.x**: 容器配置、收藏、历史、设置的持久化存储（JSON 文件）
- **Electron Session API**: 容器隔离核心机制（`persist:container-{id}`）

**Anti-Stack (explicitly NOT introducing):**
- better-sqlite3: 万级数据量下 electron-store 性能足够，原生编译依赖增加构建复杂度
- lodash/underscore: 原生 JS 方法足以处理排序、过滤、聚合
- uuid/fuse.js/date-fns: 内置 API 或简单实现即可替代

> 详见 `.planning/research/STACK.md`

### Expected Features

**Must have (table stakes, v1.1):**
- 容器属性扩展（phone/email/notes）-- 多账号管理场景的基本需求
- 收藏夹管理（添加/删除/列表/搜索）-- 所有浏览器标配
- 浏览历史记录（自动记录/按容器隔离/搜索/清理）-- 所有浏览器标配
- 常用网站推荐（新标签页 frecency 算法网格）-- Chrome/Firefox/Safari 新标签页标配
- 设置页面（通用设置 + 默认浏览器引导）-- macOS 偏好设置标准位置

**Should have (differentiators):**
- 收藏按容器隔离 -- Firefox MAC 不支持，是显著差异化点
- 常用网站域名聚合 -- 同一域名下多个页面合并为一个卡片
- 收藏全局选项 -- 允许用户选择"仅此容器"或"所有容器"

**Defer (v2+):**
- 收藏文件夹分类、收藏栏显示
- 收藏智能分类建议
- 容器属性自动填充（DOM 注入）
- 历史记录跨 Tab 关联

> 详见 `.planning/research/FEATURES.md`

### Architecture Approach

现有架构采用模块化设计，新功能沿用同一模式扩展即可。核心集成点是 electron-store 持久化层和 IPC 通信层。需要新增 3 个主进程模块（bookmark-manager.js、history-manager.js、settings-manager.js），扩展 ipc-handlers.js 注册新通道，扩展 preload.js 暴露新 API。

**Major components to add:**
1. **history-manager.js** -- 浏览历史 CRUD、按容器隔离查询、frecency 算法、自动清理
2. **bookmark-manager.js** -- 收藏夹 CRUD、URL 归一化去重、容器隔离 + 全局收藏
3. **settings-manager.js** -- 应用设置管理、默认浏览器检测与引导

**IPC 通道命名规范（沿用现有 `模块:动作` 格式）:**
- `bookmark:list`, `bookmark:add`, `bookmark:update`, `bookmark:delete`
- `history:list`, `history:add`, `history:delete`, `history:clear`, `history:search`, `history:frequent`
- `settings:get`, `settings:update`, `settings:is-default`, `settings:set-default`

> 详见 `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **electron-store 存储膨胀（陷阱1）** -- 历史记录高频写入，JSON 全量序列化性能随数据增长急剧下降。缓解措施：设置每容器 10000 条上限 + FIFO 淘汰 + 启动时清理过期数据。如果未来性能不足，可单独将 history 迁移到 better-sqlite3。

2. **容器属性 Schema 迁移（陷阱2）** -- 旧配置中没有 phone/email/notes 字段，直接访问会抛 TypeError。缓解措施：在 `getContainers()` 中用 `{ ...DEFAULT_CONTAINER, ...c }` 填充默认值。

3. **历史记录未按容器隔离（陷阱3）** -- 如果不记录 container_id，所有容器历史混在一起，破坏核心价值。缓解措施：数据库设计时就将 container_id 作为必填字段。

4. **常用网站 frecency 算法不准（陷阱4）** -- 纯频率排序导致过时网站始终排前面。缓解措施：使用 `log2(visitCount+1) * recencyMultiplier` 复合算法。

5. **macOS 默认浏览器注册（陷阱5）** -- 开发模式下 `setAsDefaultProtocolClient` 静默失败，打包后行为不一致。缓解措施：以打开系统偏好设置引导用户手动设置为主，API 调用为辅。

> 详见 `.planning/research/PITFALLS.md`

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: 容器属性扩展 + Schema 兼容

**Rationale:** 最轻量的变更，仅修改现有模块，无新模块依赖。同时验证 electron-store 字段扩展模式和 Schema 兼容机制，为后续功能打基础。

**Delivers:** 容器支持 phone/email/notes 三个可选字段，旧数据自动兼容。

**Addresses:** 容器属性扩展（表单编辑 UI + 数据持久化）

**Avoids:** 陷阱2（Schema 迁移缺失）-- 在本阶段建立 `{ ...DEFAULT, ...saved }` 的合并读取模式。

### Phase 2: 浏览历史记录

**Rationale:** 历史记录是 Phase 3（常用网站推荐）的前置依赖，且是浏览器的 table stakes 功能。先实现历史记录，积累数据后再做推荐。

**Delivers:** 自动记录页面导航、按容器隔离存储、历史列表展示、搜索、清理机制。

**Addresses:** 浏览历史记录（自动记录/容器隔离/搜索/清理/自动过期）

**Avoids:** 陷阱1（存储膨胀，设上限+FIFO）、陷阱3（容器隔离，container_id 必填）、陷阱9（数据增长，启动清理+定时清理）

### Phase 3: 收藏夹管理

**Rationale:** 与 Phase 2 共享 IPC 注册模式和 UI 模式（模态框列表），紧随其后实现效率最高。独立于历史记录，无数据依赖。

**Delivers:** 收藏当前页面、收藏列表展示、编辑/删除、搜索、容器隔离 + 全局收藏选项。

**Addresses:** 收藏夹管理（CRUD/容器隔离/全局收藏）

**Avoids:** 陷阱6（URL 去重，归一化函数）、陷阱10（跨容器 UX，提供全局收藏选项）

### Phase 4: 常用网站推荐 + 新标签页

**Rationale:** 依赖 Phase 2 的 history-manager.js 提供数据。在历史数据积累后实现推荐算法，可立即验证效果。

**Delivers:** 新标签页常用网站网格（frecency 算法）、域名聚合、favicon 展示。

**Addresses:** 常用网站推荐（新标签页网格/frecency/域名聚合/按容器过滤）

**Avoids:** 陷阱4（frecency 算法，log2+时间衰减）、陷阱7（新标签页性能，并行请求+缓存）、陷阱12（favicon 缓存，Google Favicon API）

### Phase 5: 设置页面

**Rationale:** 完全独立于其他功能，可随时插入。放在最后是因为默认浏览器注册需要打包后验证，且设置页面的 IPC 设计需要参考前面模块的经验。

**Delivers:** 设置模态框（默认浏览器引导、启动行为、搜索引擎、历史保留天数）。

**Addresses:** 设置页面（通用设置/默认浏览器/设置持久化）

**Avoids:** 陷阱5（默认浏览器，以系统设置引导为主）、陷阱8（IPC 通道爆炸，统一 key-value 模式）

### Phase Ordering Rationale

- **Phase 1 先行**：最轻量，验证 electron-store 扩展模式，建立 Schema 兼容基础
- **Phase 2 在 Phase 3/4 之前**：历史记录是常用网站推荐的数据依赖，必须先有数据
- **Phase 3 紧跟 Phase 2**：共享 IPC 注册模式和 UI 模式，学习曲线最低
- **Phase 4 在 Phase 2 之后**：依赖 history-manager.js 的 getFrequentlyVisited() 方法
- **Phase 5 最后**：完全独立，且默认浏览器注册需要打包后验证

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (历史记录):** webview `did-navigate` 事件不提供页面 title，需要异步获取；electron-store 性能边界需要实际测试验证
- **Phase 4 (常用网站):** frecency 算法参数需要实际使用数据调优
- **Phase 5 (设置页面):** macOS 默认浏览器注册行为需要打包后实际测试

Phases with standard patterns (skip research-phase):
- **Phase 1 (容器属性):** 纯 schema 扩展，模式清晰，无技术不确定性
- **Phase 3 (收藏夹):** 标准 CRUD 模式，与现有模块一致

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 明确不引入新依赖，所有功能在现有栈内可实现，官方文档验证 |
| Features | MEDIUM-HIGH | 竞品分析充分，功能优先级清晰，但 UI 设计需结合项目风格 |
| Architecture | HIGH | 现有模块化设计可直接扩展，集成点明确，代码结构已验证 |
| Pitfalls | MEDIUM | 基于 Electron 文档和领域知识，部分陷阱（如 electron-store 性能边界）需要实际测试 |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **electron-store 性能边界**: 万级数据量下的实际写入耗时和启动加载时间需要基准测试，建议 Phase 2 开始时先做性能基准
- **webview title 获取**: `did-navigate` 事件不提供 title，需要 `executeJavaScript('document.title')` 异步获取，实际效果需验证
- **macOS 默认浏览器**: 开发阶段无法完整测试，需要在打包后验证完整流程
- **favicon 获取策略**: Google Favicon API 可用性需要验证，备选方案是 webContents 获取并本地缓存

## Sources

### Primary (HIGH confidence)
- Electron 官方文档 -- webview 事件、app API、shell API、electron-store
- 项目现有代码库 -- container-manager.js、ipc-handlers.js、src/renderer.js、src/preload.js

### Secondary (MEDIUM confidence)
- Firefox Multi-Account Containers 扩展源码 -- 容器隔离模式参考
- Chrome/Firefox/Safari 新标签页实现 -- frecency 算法和 UI 模式参考
- macOS Info.plist CFBundleURLTypes 规范 -- 默认浏览器注册限制

### Tertiary (LOW confidence)
- electron-store GitHub Issues -- 性能边界讨论，需要实际验证
- macOS 15 (Sequoia) 安全策略变更 -- 默认浏览器注册可能有新限制

---
*Research completed: 2026-07-25*
*Ready for roadmap: yes*
