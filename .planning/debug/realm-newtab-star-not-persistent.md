---
status: fixed
trigger: "正常地址收藏显示正常，realm://newtab 这类内置的可以收藏，列表也可以看到，但是页面刷新星标不是实心的"
created: 2025-12-06T00:00:00.000Z
updated: 2025-12-06T00:01:00.000Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — checkBookmarkStatus (renderer.js:219) early-returns for realm:// URLs, never querying DB
test: direct code trace of save path vs check path for both external URL and realm://newtab
expecting: N/A (confirmed)
next_action: Return ROOT CAUSE FOUND to orchestrator (goal: find_root_cause_only — no fix)

reasoning_checkpoint:
  hypothesis: "checkBookmarkStatus 的 realm:// 早退守卫使内部页面永不查询收藏表，星标恒为空心；保存路径无此守卫，故收藏可写入但状态不回显"
  confirming_evidence:
    - "renderer.js:219 `if (!url || url.startsWith('realm://') || url === 'about:blank')` → updateStarButton(false), return"
    - "保存链路（star click 2265-2282 → saveBookmark 297-343 → favorites:add ipc-handlers.js:753 → addRecord favorites-manager.js:113）全程无 realm:// 过滤"
    - "git log -S: 守卫源自 93778ab (Phase 07-02)，早于 Phase 09 全局表重构与 UAT truth"
    - "favorites-page.js:226-228 直接渲染 record.url，无 scheme 过滤 → 列表可见（与用户报告一致）"
  falsification_test: "若 checkBookmarkStatus 对 realm:// URL 实际执行了 favoritesCheck 且返回了记录，则假设被证伪 — 代码路径证明不可能到达该调用"
  fix_rationale: "移除守卫中的 url.startsWith('realm://') 分支，让内部页面走与外部 URL 相同的 favoritesCheck → checkUrl 精确匹配路径；存/查 URL 均为 httpUrlToRealm 归一化后的 'realm://newtab'（查询参数已剥离），字符串完全一致"
  blind_spots: "未运行时复现（纯代码证据，但路径确定性 100%）；favorites 列表双击打开 realm:// 条目会被 handleOpenUrlInTab 拒绝（renderer.js:1761 仅放行 http(s)）— 属相邻问题，非本 bug 根因"

## Symptoms

<!-- Written during gathering, then IMMUTABLE (prefilled from UAT test 9) -->

expected: |
  在任意容器打开一个未收藏页面，点击工具栏星标 → 出现「已收藏」toast，星标立即变为实心；
  刷新页面后星标仍保持实心（checkBookmarkStatus 读取全局 favorites 表）；
  DevTools Console 不出现「无效的参数」错误。
actual: |
  正常地址收藏显示正常，realm://newtab 这类内置的可以收藏，列表也可以看到，但是页面刷新星标不是实心的。
  External URLs (https://...) work correctly — star stays filled after refresh.
  The favorite IS in the database (visible in realm://favorites list).
errors: None reported
reproduction: |

  - Open realm://newtab in any container
  - Click star → toast「已收藏」appears, star fills
  - Refresh page → star returns to hollow (expected: stays filled)

started: Discovered during UAT (post 09-03 gap closure); possibly introduced by Phase 09 favorites refactor (per-container → global table)

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: URL normalization mismatch (save path vs check path use different URL strings)
  evidence: 两条路径使用同一字符串 — did-navigate 设 tab.url = httpUrlToRealm(e.url) = 'realm://newtab'（renderer.js:654-655）；star click 用 activeTab.url（2267）；刷新后 checkBookmarkStatus(displayUrl) 用同一归一化形式（665）。且守卫在任何查询之前拦截，归一化无关紧要
  timestamp: 2025-12-06T00:01:00.000Z
- hypothesis: URL timing — webContents.getURL() returns different values at check time vs click time
  evidence: checkBookmarkStatus 不由 getURL() 驱动；它接收 did-navigate 的 displayUrl（665）或 switchTab 的 tab.url（473）。realm:// 守卫在查询前必触发，时序无关
  timestamp: 2025-12-06T00:01:00.000Z
- hypothesis: did-navigate vs did-finish-load event order differs for internal pages
  evidence: checkBookmarkStatus 仅由 did-navigate（665）与 switchTab（473）调用，无 did-finish-load 监听。事件顺序不影响结果 — 守卫对 realm:// 100% 触发
  timestamp: 2025-12-06T00:01:00.000Z
- hypothesis: DB stores realm:// URL in a form that doesn't match the query (storage-format mismatch)
  evidence: addRecord 原样存 url（favorites-manager.js:117-120, 仅 INSERT OR IGNORE + UNIQUE(url)）；checkUrl 为精确匹配（219-223）。存储无变换 — 且因守卫，查询根本不会发生
  timestamp: 2025-12-06T00:01:00.000Z
- hypothesis: IPC payload/validation rejects realm:// (「无效的参数」class error swallowing the check)
  evidence: favorites:check（ipc-handlers.js:737-743）仅校验 data 为 object；favorites:add（753-763）同样。无 scheme 校验，无 containerId 位置参数残留（09-03 已清）。用户也未观察到 console 错误
  timestamp: 2025-12-06T00:01:00.000Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2025-12-06T00:00:30.000Z
  checked: src/renderer.js checkBookmarkStatus (218-236)
  found: 第 219 行 `if (!url || url.startsWith('realm://') || url === 'about:blank')` 早退：清空收藏 state 并 updateStarButton(false)，注释「内部页面不显示收藏状态」。对任何 realm:// URL 永不执行 favoritesCheck
  implication: 刷新后 did-navigate → checkBookmarkStatus('realm://newtab') 必走此分支 → 星标恒为空心。直接解释用户症状
- timestamp: 2025-12-06T00:00:30.000Z
  checked: 保存链路 — star click handler (2265-2282) → showBookmarkEditPanel → saveBookmark (297-343)
  found: star click 仅检查 activeTab.url truthy（realm://newtab 为 truthy，面板正常打开）；saveBookmark 从 bookmarkUrlDisplay.textContent 取 url，无 realm:// 过滤，直接 favoritesAdd
  implication: 保存路径与检查路径不对称 — 可写不可读。这正是「可以收藏、列表可见、刷新后星标空心」三现象并存的原因
- timestamp: 2025-12-06T00:00:30.000Z
  checked: 检查链路的 URL 来源 — did-navigate (650-666) 与 switchTab (473)
  found: displayUrl = httpUrlToRealm(e.url)，将 http://localhost:PORT/newtab?container&token 转回 'realm://newtab' 并剥离查询参数（177-182）；存储端亦为此形式
  implication: 存/查 URL 字符串完全一致（'realm://newtab'），若移除守卫，checkUrl 精确匹配即可命中，无需额外归一化
- timestamp: 2025-12-06T00:00:45.000Z
  checked: favorites-manager.js (addRecord 113-128, checkUrl 216-223, ensureTable 62-77) 与 ipc-handlers.js (favorites:check 737-743, favorites:add 753-763)
  found: 表结构无 scheme 约束（UNIQUE(url) 之外无限制）；IPC 校验仅查 data 为 object；无 containerId 残留。后端全链路对 realm:// 透明
  implication: 后端无问题；唯一的 realm:// 特判点在渲染进程 checkBookmarkStatus
- timestamp: 2025-12-06T00:00:45.000Z
  checked: src/favorites-page.js 渲染逻辑 (224-242)
  found: 列表直接 escapeHtml(record.url) 渲染，无 scheme 过滤
  implication: 与「列表也可以看到」一致；佐证记录确已写入全局 favorites 表
- timestamp: 2025-12-06T00:01:00.000Z
  checked: git log -S "url.startsWith('realm://')" -- src/renderer.js
  found: 守卫由 93778ab (2026-07-25, "feat(07-02): 添加工具栏星标按钮、收藏夹按钮和收藏编辑面板") 引入
  implication: 该「内部页面不显示收藏状态」决策早于 Phase 09；09-UAT.md:100 的 truth（内置 URL 与外部行为一致）已将其推翻 — 守卫是过时设计残留，非有意为之的当前规范
- timestamp: 2025-12-06T00:01:00.000Z
  checked: renderer.js handleOpenUrlInTab (1760-1764) + favorites-page.js:282 (window.open(record.url))
  found: 收藏列表双击 realm:// 条目 → window.open('realm://...') → 主进程拦截转 open-url-in-tab → handleOpenUrlInTab 以非 http(s) 拒绝
  implication: 相邻问题（内置收藏条目无法从列表打开），非本 bug 根因；修复内置页面收藏时应一并考虑

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: |
  保存路径与检查路径对 realm:// URL 的处理不对称。checkBookmarkStatus（src/renderer.js:219）
  含 `url.startsWith('realm://')` 早退守卫（注释「内部页面不显示收藏状态」，源自 Phase 07-02
  commit 93778ab），对内部页面永不查询 favorites 表并强制星标为空心；而保存链路
  （star click handler → saveBookmark → favorites:add → addRecord）无任何 scheme 过滤，
  收藏可正常写入全局 favorites 表（故列表可见、toast 正常、点击后星标临时变实心）。
  刷新后 did-navigate 以归一化的 'realm://newtab' 调用 checkBookmarkStatus → 守卫触发 →
  星标回到空心。09-UAT.md:100 的 truth 要求内置 URL 与外部行为一致，该守卫为过时设计残留。
fix: (未应用 — goal: find_root_cause_only；建议方向：移除 renderer.js:219 守卫中的 realm:// 分支，保留 !url / about:blank 排除)
verification: (未验证 — 修复由 plan-phase --gaps 处理；存/查 URL 均为 httpUrlToRealm 归一化形式 'realm://newtab'，字符串一致，精确匹配可命中)
files_changed: []
