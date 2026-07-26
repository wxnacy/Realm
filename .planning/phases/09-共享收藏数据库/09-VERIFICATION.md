---
phase: 09-共享收藏数据库
verified: 2026-07-26T03:07:37Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "现有按容器分表（favorites_work、favorites_default 等）的收藏数据自动迁移合并到全局表"
    reason: "用户锁定决策 D-01（09-CONTEXT.md）：不迁移旧数据，现有 per-container 收藏直接丢弃全新开始。migrateToGlobal() 仅 drop 旧表 + create 全局表，不 copy 数据。ROADMAP SC 4 的『迁移合并』措辞与规划期锁定决策冲突，以 D-01 为准"
    accepted_by: "user (locked decision D-01, 09-CONTEXT.md)"
    accepted_at: "2026-07-25T00:00:00Z"
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "BLOCKER: ipc-handlers.js 8 个 favorites:* handler 从 Phase 7 per-container 旧签名重构为 Phase 9 全局新签名（gaps.missing 全部 10 项代码修复落地，运行时冒烟测试 8/8 PASS）"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "npm run dev 启动后在任意容器（如 default）打开 https://example.com，点击工具栏星标收藏；随后刷新页面"
    expected: "弹出『已收藏』toast（而非『收藏失败，请重试』），星标变为已收藏态；刷新后星标保持已收藏态（favorites:check 链路）"
    why_human: "toast 渲染与星标 DOM 状态更新是 UI 行为，冒烟测试桩掉了真实 DOM 与 Electron ipcMain 往返；09-03 Task 2 检查点按 human_verify_mode: end-of-phase 推迟至此"
  - test: "切换到另一个容器（如 work）打开同一 URL，观察星标；随后在该页再次点击星标尝试重复收藏"
    expected: "星标直接显示已收藏（跨容器共享的用户可感证据，FAV-09/FAV-10）；重复收藏提示『已收藏过该页面』（SC 3）"
    why_human: "跨容器导航后的真实 UI 状态无法由静态检查或 Node 冒烟测试覆盖；数据层机制已验证（单一全局表 + 全链路无 containerId），但端到端用户可感行为需真实应用确认"
  - test: "点击星标取消收藏，切回第一个容器刷新确认同样未收藏；再收藏一次后打开 realm://favorites，编辑标题、搜索、删除；全程观察 Console"
    expected: "取消后两个容器星标均恢复未收藏态；管理页列表/编辑/搜索/删除正常；Console 不再出现『检查收藏状态失败』『收藏失败』『无效的参数』报错"
    why_human: "管理页 HTTP 路径此前已验证，此步为真实环境回归；Console 无报错是 IPC 修复的用户侧最终证据"
---

# Phase 9: 共享收藏数据库 — 复验报告（gap closure 后）

**Phase Goal:** 收藏功能从按容器隔离改为全局共享，所有容器看到同一份收藏列表
**Verified:** 2026-07-26T03:07:37Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure（plan 09-03 修复前轮唯一 BLOCKER：ipc-handlers.js 收藏夹区段旧签名）

> 前轮报告（2026-07-25T16:42:53Z）判定 gaps_found（2/5）：数据层目标达成，但星标按钮（唯一收藏入口）在 IPC 层 100% 断裂。本轮复验确认 plan 09-03 已消除该根因：8 个 favorites:* handler 全部重构为全局新签名，新增的运行时冒烟测试 8/8 PASS——前轮「5/5 通道全部 THROW 无效的参数」的决定性证据被同一手法的反向证据（8/8 不抛异常 + 签名精确匹配）推翻。**代码层目标已全部达成；真实应用星标流程 UAT 按项目配置（human_verify_mode: end-of-phase）待人工执行。**

## Goal Achievement

### Observable Truths（ROADMAP Success Criteria）

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | 收藏数据存储在单一全局表，所有容器读写同一份数据 | ✓ VERIFIED | 存储层：`ensureTable()` 无参数固定建全局 `favorites` 表（favorites-manager.js:62-77）；HTTP 路径：`handleFavoritesApi` 7 端点无 containerId；**星标写入路径（前轮断裂点）**：`favorites:add` handler（ipc-handlers.js:753-763）校验仅留 data 对象基线检查，调用 `addRecord({url,title,faviconUrl})`——冒烟测试以 preload 真实 payload 实测不抛异常、签名精确匹配 |
| 2 | 用户在容器 A 收藏的页面，在容器 B 中也能看到并标记为已收藏 | ✓ VERIFIED | 读链路全层无容器维度：`checkBookmarkStatus(url)`（renderer.js:218）→ `favoritesCheck(url)`（preload.js:340，payload `{url}`）→ `favorites:check` handler（ipc-handlers.js:737-743）→ `checkUrl(data.url \|\| '')` 查全局表。冒烟测试行为性覆盖该链路（不抛异常 + 恰好 1 个实参 = url）。星标 DOM 渲染（updateStarButton）在真实应用中的端到端确认移交人工验证 #1/#2 |
| 3 | 同一 URL 全局唯一去重，跨容器收藏同一 URL 返回重复提示 | ✓ VERIFIED | `UNIQUE(url)` 约束保留（favorites-manager.js:70）；`INSERT OR IGNORE` + `lastInsertRowid===0` 返回 `{error:'duplicate', message:'已收藏过该页面'}`（:117-127）；renderer.js:320-322 处理 duplicate toast；**可达性恢复**：`favorites:add` IPC 不再在 addRecord 执行前被验证层抛出（冒烟测试实测）。真实 toast 确认移交人工验证 #2 |
| 4 | 旧分表数据自动迁移合并到全局表，迁移后旧表被清理 | ⚠ PASSED (override) | Override 前轮已接受并沿用：旧表清理 ✓（`migrateToGlobal()` drop 全部 `favorites_%` 表 + create 全局表，main.js:664-665 启动时调用，前轮 UAT Cold Start 人工确认）；『数据迁移合并』与用户锁定决策 D-01 冲突，按 D-01 丢弃旧数据 — accepted by user (09-CONTEXT.md) |
| 5 | 删除容器时不再清空该容器的收藏数据 | ✓ VERIFIED | `container-manager.js` 全文件零 favorites 引用（grep 实测）；`dropTable()`/`sanitizeContainerId()` 模块导出实测 undefined；收藏与容器生命周期完全解耦 |

**Score:** 5/5 truths verified（4 verified + 1 override；前轮 2/5 → 本轮 5/5）

### Gap Closure 明细（前轮 gaps.missing 10 项代码修复 + 1 项 UAT）

| # | 前轮 missing 项 | 状态 | 证据 |
|---|----------------|------|------|
| 1 | 删除 8 个 handler 中 `typeof data.containerId !== 'string'` 验证条件 | ✓ DONE | 收藏夹区段（:729 注释行至文件尾）containerId grep 计数 **0**；每 handler 仅留 `!data \|\| typeof data !== 'object'` 基线校验 |
| 2 | favorites:check → `checkUrl(data.url \|\| '')` | ✓ DONE | ipc-handlers.js:742 |
| 3 | favorites:add → `addRecord({url,title,faviconUrl})` | ✓ DONE | ipc-handlers.js:758-762 |
| 4 | favorites:update → `updateRecord(data.id, {title})` | ✓ DONE | ipc-handlers.js:777 |
| 5 | favorites:delete → `deleteRecord(data.id)` | ✓ DONE | ipc-handlers.js:791 |
| 6 | favorites:delete-batch → `deleteRecords(data.ids \|\| [])` | ✓ DONE | ipc-handlers.js:805 |
| 7 | favorites:list → `listRecords({offset,limit})` | ✓ DONE | ipc-handlers.js:820-823 |
| 8 | favorites:search → `searchRecords({keyword,offset,limit})` | ✓ DONE | ipc-handlers.js:839-843 |
| 9 | favorites:count → `getCount()` | ✓ DONE | ipc-handlers.js:856 |
| 10 | 删除 8 个 handler JSDoc 中 `@param data.containerId` 行 | ✓ DONE | 区段 containerId 计数 0；favorites:count 摘要已改为「获取收藏记录总数」（:847） |
| 11 | UAT 补充真实星标流程用例 | ⏳ DEFERRED | 09-03 Task 2 checkpoint 按 `workflow.auto_advance=true` + `human_verify_mode: end-of-phase` 自动批准并推迟；9 步清单已转入本报告 human_verification（3 项归并） |

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `favorites-manager.js` | 全局单表 CRUD + migrateToGlobal | ✓ VERIFIED（回归） | 导出实测：migrateToGlobal=function，dropTable/sanitizeContainerId=undefined；新签名形参数 addRecord=1, checkUrl=1, getCount=0, updateRecord=2, deleteRecords=1 |
| `main.js` | API 端点去 containerId + 启动迁移 | ✓ VERIFIED（回归） | `handleFavoritesApi` 区段 containerId 零匹配；:664 `initDatabase()` → :665 `migrateToGlobal()` 顺序正确 |
| `src/preload.js` | 8 个收藏 IPC 接口去 containerId | ✓ VERIFIED（回归） | :340-397 全部不含 containerId；payload 形状与 handler 期望逐通道对齐 |
| `src/renderer.js` | 星标逻辑与容器解耦 | ✓ VERIFIED（回归） | checkBookmarkStatus(url) 单参（:218/:228）；saveBookmark 无 state.currentContainer（:309/:314-318）；removeBookmark(bookmarkId)（:357）；favoritesBtn 全局唯一 Tab 仅按 URL 匹配（:2309）。`createTab(containerId, 'realm://favorites')`（:2317）为 webview partition 渲染所需，Plan 02 已记录保留决定 |
| `src/favorites-page.js` | 移除容器感知 | ✓ VERIFIED（回归） | containerId 计数 0；pageParams/apiToken 保留 |
| `ipc-handlers.js` | 8 个 favorites:* handler 全局新签名 | ✓ VERIFIED（**本轮修复**） | 前轮 ✗ STALE → 本轮：区段 containerId 0 处、`node --check` 语法通过、冒烟测试 8/8 PASS；区段外 66 处 containerId（history:* 等）原样保留——改动范围精确 |
| `scripts/test-ipc-favorites.js` | IPC 运行时冒烟测试（新增护栏） | ✓ VERIFIED | 186 行实质实现：Module._load 打桩 electron/window-manager/favorites-manager + 6 个 noop manager；逐通道断言「不抛异常 + 实参个数精确 + 深度相等 + 返回值一致」；已入 git（787acbd/f72858b） |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| renderer.js 星标 → preload.js → **ipc-handlers.js** → favoritesManager | check/add/update/delete | IPC `favorites:*` | ✓ WIRED（**本轮修复**） | 前轮 ✗ NOT_WIRED → 本轮运行时实证：冒烟测试以 preload 真实 payload 逐通道调用 handler，8/8 不抛异常、manager 调用签名（含实参个数）精确匹配新签名、返回值透传一致 |
| favorites-page.js | handleFavoritesApi → favoritesManager | HTTP `/api/favorites/*` + token | ✓ WIRED（回归） | 全链路参数对齐，无 containerId |
| main.js 启动 | favoritesManager.migrateToGlobal() | :664 initDatabase → :665 migrateToGlobal | ✓ WIRED（回归） | 前轮 UAT Cold Start 人工确认 |
| container-manager.deleteContainer | favorites 数据 | （应为无连接） | ✓ WIRED (correctly absent)（回归） | 容器删除与收藏完全解耦 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| favorites-page.js 列表 | `state.records` | HTTP `/api/favorites/list` → `listRecords()` SQL | ✓（`SELECT * FROM favorites ORDER BY created_at DESC`） | ✓ FLOWING（回归） |
| renderer.js 星标状态 | `state.isCurrentPageBookmarked` | `favoritesCheck` IPC → `checkUrl()` 全局表查询 | ✓ 链路恢复：handler 不再抛异常，冒烟测试实证返回透传 | ✓ FLOWING（**本轮修复**：前轮 ✗ DISCONNECTED） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| IPC 冒烟测试：8 通道 preload 真实 payload × handler × manager 签名 | `node scripts/test-ipc-favorites.js` | **8/8 PASS，exit 0**（check/add/update/delete/delete-batch/list/search/count 全部不抛异常 + 实参个数精确 + 深度相等 + 返回值一致） | ✓ PASS（决定性证据，直接推翻前轮 5/5 THROW） |
| 改动范围精确性 | `sed -n '/==================== 收藏夹/,$p' ipc-handlers.js \| grep -c containerId` → 0；文件级 `grep -c containerId` → 66 | 收藏夹区段 0 处；history:* 等区段 66 处原样保留（history:count :723 仍强制 `typeof data.containerId !== 'string'`，Phase 6 按容器隔离设计不受影响） | ✓ PASS |
| ipc-handlers.js 语法可解析 | `node --check ipc-handlers.js` | SYNTAX OK | ✓ PASS |
| 模块导出契约（回归） | `node -e "require('./favorites-manager')…"` | migrateToGlobal:function, dropTable:undefined, sanitizeContainerId:undefined, 形参数全对 | ✓ PASS |
| TDD 提交链 | `git log --oneline -- ipc-handlers.js scripts/test-ipc-favorites.js` | 787acbd test(09-03) RED → f72858b feat(09-03) GREEN | ✓ PASS |
| 真实应用星标流程（收藏→跨容器→重复提示→取消） | 需真实 Electron 应用 + 人工点击 | 09-03 Task 2 按 human_verify_mode: end-of-phase 推迟 | ? SKIP → 人工验证 #1-3 |

### Probe Execution

无声明式 probe（非 migration/tooling 阶段）。最接近的运行时检查为上方冒烟测试（已执行，8/8 PASS）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| FAV-07 | 09-01, 09-02 | ~~收藏按容器隔离~~（已重新设计为全局共享，由 FAV-09 替代） | ✓ SATISFIED | 全局单表落地；per-container 分表机制在存储/HTTP/IPC/UI 全层移除（本轮含 IPC 层） |
| FAV-09 | 09-01, 09-02, 09-03 | 收藏数据全局共享，所有容器看到同一份收藏列表 | ✓ SATISFIED | 前轮 ✗ BLOCKED（写入路径断裂）→ 本轮：读（check/list/search）写（add/update/delete）全链路贯通，冒烟测试实证；用户可感确认待 end-of-phase UAT |
| FAV-10 | 09-01, 09-02, 09-03 | 切换容器时收藏列表保持一致，无需按容器过滤 | ✓ SATISFIED | favorites 页全局唯一 Tab；全部数据访问无容器过滤；容器删除不动收藏 |

无 ORPHANED 需求（REQUIREMENTS.md 映射到 Phase 9 的 FAV-07/09/10 均被计划认领；FAV-08 全局唯一由 SC 3 覆盖）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （前轮 Blocker）ipc-handlers.js 8 个 handler 旧签名 | 729-857 | — | ✅ 已消除 | 本轮修复并运行时实证 |
| src/favorites-page.js | 13 | 过时注释『容器 ID 和 API token 由渲染进程…注入 URL 查询参数』 | ℹ️ Info（沿用） | 页面已不再读取 container 参数，注释误导 |
| src/renderer.js | 164, 603 | `realmUrlToHttp` 仍为 favorites 页 URL 注入 `?container=` 死参数 | ℹ️ Info（沿用） | 页面侧零引用（favorites-page.js containerId 计数 0），无功能影响 |

无 TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 债务标记（phase 修改文件全量扫描）。

09-REVIEW.md（advisory）3 项 Warning 均为输入校验健壮性建议（如 data.id 类型校验），非功能性断裂；handler 基线校验保留是 09-03 计划内决策（threat T-09-05 accept 边界），不构成本验证的 gap。

### Human Verification Required

status 为 human_needed 的唯一原因：真实星标流程 UAT（09-03 Task 2 按 `human_verify_mode: end-of-phase` 推迟，frontmatter `human_verification` 3 项）。清单与 09-03 SUMMARY「待人工验证」9 步一一对应：

1. **收藏与状态回显**（原 9 步之 1-4）：收藏 → 成功 toast → 星标已收藏 → 刷新保持
2. **跨容器共享与重复提示**（原 9 步之 5-6）：切换容器星标已收藏 → 重复收藏提示『已收藏过该页面』
3. **取消收藏与管理页回归**（原 9 步之 7-9）：取消后两容器同步 → 管理页列表/编辑/搜索/删除 → Console 无『无效的参数』

### Gaps Summary

无 gap。前轮唯一 BLOCKER（ipc-handlers.js 收藏夹区段旧签名）已被 plan 09-03 消除，并以新增的运行时冒烟测试（scripts/test-ipc-favorites.js，已入 git）作为 IPC 层持久回归护栏——前轮流程备注 ①「静态 grep 无法发现 IPC 运行时断裂」的制度化回应。全部 5 项 ROADMAP 成功标准在代码层达成（SC 4 经已接受 override）；3 项需求全部 SATISFIED；无回归、无债务标记。阶段收尾仅剩 end-of-phase 人工 UAT 闸口。

---

_Verified: 2026-07-26T03:07:37Z_
_Verifier: Claude (gsd-verifier)_
