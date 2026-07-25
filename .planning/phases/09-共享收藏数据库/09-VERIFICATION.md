---
phase: 09-共享收藏数据库
verified: 2026-07-25T16:42:53Z
status: gaps_found
score: 2/5 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "现有按容器分表（favorites_work、favorites_default 等）的收藏数据自动迁移合并到全局表"
    reason: "用户锁定决策 D-01（09-CONTEXT.md）：不迁移旧数据，现有 per-container 收藏直接丢弃全新开始。migrateToGlobal() 仅 drop 旧表 + create 全局表，不 copy 数据。ROADMAP SC 4 的『迁移合并』措辞与规划期锁定决策冲突，以 D-01 为准；plan-checker 亦记录『数据丢失 — D-01 接受，用户明确接受丢弃旧数据』"
    accepted_by: "user (locked decision D-01, 09-CONTEXT.md)"
    accepted_at: "2026-07-25T00:00:00Z"
gaps:
  - truth: "用户在容器 A 收藏的页面，在容器 B 中也能看到并标记为已收藏（SC 2）；并波及 SC 1『所有容器读写同一份数据』的写入路径与 SC 3 的重复提示可达性"
    status: failed
    reason: "ipc-handlers.js 未被任何计划纳入 files_modified，8 个 favorites:* IPC handler 仍是 per-container 旧签名：参数验证强制要求 typeof data.containerId === 'string'，而更新后的 preload.js 所有收藏调用均不再发送 containerId，导致验证 100% 抛出 Error('无效的参数')；即使绕过验证，handler 仍把 data.containerId 作为第一个位置参数传给已改为单参数新签名的 favoritesManager 函数。星标按钮的 check/add/update/delete 四条链路全部断裂：无法收藏任何页面（toast『收藏失败，请重试』）、星标永远不显示已收藏状态、无法编辑/移除收藏。favorites 页面无新增 UI，星标是唯一收藏入口，整个收藏写入功能在用户层面不可用"
    artifacts:
      - path: "ipc-handlers.js"
        issue: "行 740/757/777/792/807/823/843/861 参数验证强制要求 data.containerId；行 743/760/780/795/810/826/846/864 以 data.containerId 为第一位置参数调用 favoritesManager 新签名函数"
      - path: "src/preload.js"
        issue: "（无过错方）行 340-397 已按计划移除 containerId，与 ipc-handlers.js 旧验证逻辑产生不可调和矛盾"
      - path: "src/renderer.js"
        issue: "（无过错方）行 228/309/314/357 星标四调用全部经由断裂的 IPC 链路"
    missing:
      - "ipc-handlers.js：删除 8 个 favorites:* handler 中 typeof data.containerId !== 'string' 验证条件"
      - "ipc-handlers.js：favorites:check 改为 favoritesManager.checkUrl(data.url || '')"
      - "ipc-handlers.js：favorites:add 改为 favoritesManager.addRecord({ url, title, faviconUrl })"
      - "ipc-handlers.js：favorites:update 改为 favoritesManager.updateRecord(data.id, { title: data.title })"
      - "ipc-handlers.js：favorites:delete 改为 favoritesManager.deleteRecord(data.id)"
      - "ipc-handlers.js：favorites:delete-batch 改为 favoritesManager.deleteRecords(data.ids || [])"
      - "ipc-handlers.js：favorites:list 改为 favoritesManager.listRecords({ offset, limit })"
      - "ipc-handlers.js：favorites:search 改为 favoritesManager.searchRecords({ keyword, offset, limit })"
      - "ipc-handlers.js：favorites:count 改为 favoritesManager.getCount()"
      - "ipc-handlers.js：同步删除 8 个 handler JSDoc 中的 @param data.containerId 行"
      - "UAT 补充真实星标流程用例（收藏→跨容器标记→重复提示→取消），当前 8/8 通过全部基于 grep 静态检查，未覆盖 IPC 运行时链路"
---

# Phase 9: 共享收藏数据库 — 执行验证报告

**Phase Goal:** 收藏功能从按容器隔离改为全局共享，所有容器看到同一份收藏列表
**Verified:** 2026-07-25T16:42:53Z
**Status:** gaps_found
**Re-verification:** No — initial execution verification（覆盖原 plan-checker 计划期报告）

> ⚠️ 本报告推翻 SUMMARY/UAT 的『全部通过』叙事。SUMMARY 的 automated coverage 与 UAT 7/8 用例均为 grep 静态检查，从未验证 IPC 接收端；UAT 唯一的人工用例（Cold Start）只覆盖启动迁移，不覆盖星标流程。**数据层目标已达成，但星标按钮（唯一收藏入口）在 IPC 层 100% 断裂，收藏功能的用户可用性目标未达成。**

## Goal Achievement

### Observable Truths（ROADMAP Success Criteria）

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | 收藏数据存储在单一全局表，所有容器读写同一份数据 | ✗ FAILED | 存储层 ✓（favorites-manager.js `ensureTable()` 无参数固定建全局 `favorites` 表）；HTTP 路径读写 ✓（favorites-page → handleFavoritesApi 7 端点无 containerId）；**星标写入路径 ✗**——`favoritesAdd` 经 IPC 必抛『无效的参数』，favorites 页面无新增 UI，用户无法通过任何界面写入新收藏 |
| 2 | 用户在容器 A 收藏的页面，在容器 B 中也能看到并标记为已收藏 | ✗ FAILED | 星标标记依赖 `checkBookmarkStatus` → `favoritesCheck(url)` → IPC `favorites:check` → ipc-handlers.js:740 验证 `typeof data.containerId !== 'string'` → payload 无 containerId → **必抛异常**（renderer.js:233 catch 后仅 console.error，星标保持未收藏态）。跨容器『标记为已收藏』永远不可能发生 |
| 3 | 同一 URL 全局唯一去重，跨容器收藏同一 URL 返回重复提示 | ✗ FAILED | 机制层 ✓：`UNIQUE(url)` 约束保留（favorites-manager.js:70）、`INSERT OR IGNORE` + `lastInsertRowid===0` 返回 `{error:'duplicate', message:'已收藏过该页面'}`（:117-127）、renderer.js:320-321 处理 duplicate toast；**但 UI 不可达**——`favorites:add` IPC 在 addRecord 执行前即被验证层抛出，重复提示永远触发不了 |
| 4 | 旧分表数据自动迁移合并到全局表，迁移后旧表被清理 | ⚠ PASSED (override) | Override: 旧表清理 ✓（`migrateToGlobal()` drop 全部 `favorites_%` 表 + create 全局表，main.js:664-665 启动时调用，UAT Cold Start 人工确认）；『数据迁移合并』与用户锁定决策 D-01 冲突，按 D-01 丢弃旧数据 — accepted by user (09-CONTEXT.md) |
| 5 | 删除容器时不再清空该容器的收藏数据 | ✓ VERIFIED | `container-manager.js deleteContainer()`（:220-249）仅清理 session/cookies/config，无任何 favorites 操作；`dropTable()`/`sanitizeContainerId()` 已从 favorites-manager.js 删除（模块导出实测 undefined）；main.js 全文件无 favorites 相关容器清理调用 |

**Score:** 2/5 truths verified（1 verified + 1 override；3 failed，同一根因：ipc-handlers.js 漏改）

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `favorites-manager.js` | 全局单表 CRUD + migrateToGlobal | ✓ VERIFIED | 251 行实质实现；8 个 CRUD 函数签名全部无 containerId（实测 addRecord.length=1, checkUrl.length=1, getCount.length=0）；UNIQUE(url) + 双索引保留；导出实测 `migrateToGlobal: function, dropTable: undefined, sanitizeContainerId: undefined` |
| `main.js` | API 端点去 containerId + 启动迁移 | ✓ VERIFIED | `handleFavoritesApi`（:304-364）7 端点全部不读/不传 containerId，token 鉴权保留；:664-665 `initDatabase()` → `migrateToGlobal()` 顺序正确 |
| `src/preload.js` | 8 个收藏 IPC 接口去 containerId | ✓ VERIFIED | :340-397 check/add/update/delete/deleteBatch/list/search/count 全部不含 containerId |
| `src/renderer.js` | 星标逻辑与容器解耦 | ✓ VERIFIED（自身）/ ✗ 下游断裂 | `checkBookmarkStatus(url)`/`saveBookmark()`/`removeBookmark()` 均无 containerId；favoritesBtn 全局唯一 Tab（:2303-2319）；**但其全部 4 个 realmAPI.favorites* 调用的 IPC 对端已断裂** |
| `src/favorites-page.js` | 移除容器感知 | ✓ VERIFIED | `container`（含 containerId）零匹配；state 无 containerId；update body `{id,title}`、delete-batch body `{ids}`、list/search query 均无 containerId；pageParams/apiToken 保留 |
| `ipc-handlers.js` | （计划遗漏，未列入任何 files_modified） | ✗ STALE | **8 个 favorites:* handler 仍是 Phase 7 per-container 旧实现，与 preload/manager 新签名双重不兼容（验证层 + 位置参数层）** |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| favorites-page.js | handleFavoritesApi → favoritesManager | HTTP `/api/favorites/*` + token | ✓ WIRED | list/search/update/delete-batch 全链路参数对齐，管理页（查看/搜索/改标题/删除）可用 |
| main.js 启动 | favoritesManager.migrateToGlobal() | :664 initDatabase → :665 migrateToGlobal | ✓ WIRED | UAT Cold Start 人工确认旧表删除、全局表创建 |
| container-manager.deleteContainer | favorites 数据 | （应为无连接） | ✓ WIRED (correctly absent) | 容器删除与收藏完全解耦 |
| renderer.js 星标 → preload.js → **ipc-handlers.js** → favoritesManager | check/add/update/delete | IPC `favorites:*` | ✗ NOT_WIRED | **BLOCKER**：preload payload 无 containerId ↔ handler 验证强制要求 containerId；handler 位置参数签名与 manager 新签名不匹配。Node 精确复现验证逻辑：5/5 通道全部 THROW『无效的参数』 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| favorites-page.js 列表 | `state.records` | HTTP `/api/favorites/list` → `listRecords()` SQL | ✓（`SELECT * FROM favorites ORDER BY created_at DESC`） | ✓ FLOWING |
| renderer.js 星标状态 | `state.isCurrentPageBookmarked` | `favoritesCheck` IPC → ipc-handlers.js:738 | ✗ handler 抛异常，catch 后 state 保持旧值 | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 模块导出契约（migrateToGlobal 存在 / dropTable、sanitizeContainerId 移除 / 新签名参数数） | `node -e "require('./favorites-manager')…"` | migrateToGlobal:function, dropTable:undefined, sanitizeContainerId:undefined, addRecord.length=1, getCount.length=0 | ✓ PASS |
| Manager CRUD + 迁移（内存 DB） | node + better-sqlite3 `:memory:` | better-sqlite3 按 Electron ABI 128 编译，系统 node ABI 127，`NATIVE_LOAD_FAIL` | ? SKIP（由 UAT Cold Start 人工覆盖真实迁移） |
| IPC handler 验证逻辑 × preload 实际 payload | node 精确复现 :740 验证 × 5 通道真实 payload | **5/5 全部 THROW『无效的参数』** | ✗ FAIL（决定性证据） |
| 启动迁移（真实应用） | UAT Cold Start Smoke Test（人工，`npm run dev`） | 旧 favorites_* 表被删除，全局表创建成功 | ✓ PASS（UAT 已记录） |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FAV-07 | 09-01, 09-02 | ~~收藏按容器隔离~~（已重新设计为全局共享，由 FAV-09 替代） | ✓ SATISFIED（数据层） | 全局单表落地；per-container 分表机制整体移除 |
| FAV-09 | 09-01, 09-02 | 收藏数据全局共享，所有容器看到同一份收藏列表 | ✗ BLOCKED | 列表共享 ✓（favorites 页全局唯一）；**写入/星标共享 ✗**（IPC 断裂，见 gaps） |
| FAV-10 | 09-01, 09-02 | 切换容器时收藏列表保持一致，无需按容器过滤 | ✓ SATISFIED | favorites 页全局唯一 Tab，全部数据访问无容器过滤；容器删除不动收藏 |

无 ORPHANED 需求（REQUIREMENTS.md 映射到 Phase 9 的 FAV-07/09/10 均已被计划认领）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ipc-handlers.js | 738-865 | 8 个 handler 旧签名未随 Phase 9 重构（计划遗漏文件） | 🛑 Blocker | 星标全部操作断裂，见 gaps |
| src/favorites-page.js | 13 | 过时注释『容器 ID 和 API token 由渲染进程…注入 URL 查询参数』 | ℹ️ Info | 页面已不再读取 container 参数，注释误导 |
| src/renderer.js | 164,603 | `realmUrlToHttp` 仍为 favorites 页注入 `?container=` 死参数（Plan 02 Task 2 item 7 字面未执行；SUMMARY 已记录保留决定，页面侧零引用，无功能影响） | ℹ️ Info | URL 携带无效参数 |

无 TBD/FIXME/XXX 债务标记。

### Human Verification Required

无（status 为 gaps_found，gap 修复后需重跑验证 + 补充真实星标流程 UAT：收藏 → 跨容器星标已收藏 → 重复收藏提示 → 编辑标题 → 取消收藏）。

### Gaps Summary

**唯一根因：ipc-handlers.js 被两个计划同时遗漏。** Plan 01 改了 manager 与 HTTP API，Plan 02 改了 preload/renderer/favorites-page，但连接 preload 与 manager 的 IPC handler 层（8 个 `favorites:*` 通道）不在任何计划的 files_modified 中，至今仍是 Phase 7 的 per-container 旧实现。由此产生双重不兼容：

1. **验证层**：每个 handler 强制 `typeof data.containerId === 'string'`，而新 preload 一律不传 → 全部调用抛『无效的参数』
2. **参数层**：handler 以 `data.containerId` 为第一位置参数调用已改为单参数签名的 manager 新函数

后果（可用 Node 确定性复现）：星标 check/add/update/delete 四链路 100% 失败。由于 favorites 页面没有新增 UI，星标是唯一收藏入口——**用户实际上无法收藏任何页面**，Phase 目标中『收藏功能…全局共享』的用户可用部分未交付。管理页（HTTP 路径）与数据层重构本身质量良好，修复仅需改造 ipc-handlers.js 一个文件。

流程备注：① UAT 8/8 通过中 7 项为 grep 静态检查、1 项人工 Cold Start 不含星标操作，静态验证无法发现 IPC 运行时断裂，建议 gap 修复后补充真实星标流程 UAT 用例；② plan-checker 的架构层级合规表（SQLite/Main/Preload/Renderer-webview/Renderer-main-window）漏掉了 IPC handler 层，同类遗漏可在后续阶段的计划检查中防范。

---

_Verified: 2026-07-25T16:42:53Z_
_Verifier: Claude (gsd-verifier)_
