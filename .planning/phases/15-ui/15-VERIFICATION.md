---
phase: 15-ui
verified: 2026-07-28T13:22:40Z
status: gaps_found
score: 3/9 must-haves verified
behavior_unverified: 5
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - "Truth #5（新建文件夹 Enter 确认 / Escape 取消）：初次验证判 VERIFIED（结构在）；事后代码审查 CR-01 证实行为缺陷——Enter 双创建、Escape 非空仍创建。本次结构复核独立确认该缺陷链成立，改判 FAILED"
gaps:
  - truth: "新建文件夹通过内联输入框完成，Enter 确认，Escape 取消"
    status: failed
    reason: "CR-01（15-REVIEW.md）：startNewFolder 的 keydown(Enter) 与 blur 两个处理器各自独立调用 createFolderApi，无 settled 守卫。Enter 路径 await createFolderApi（第 1 次创建）→ refreshFolderTree → renderFolderTree 在 level 0 执行 innerHTML=''（favorites-page.js:384-386）→ 聚焦中的 input 被移除 → blur 触发 → blur 处理器读到 detached input 残留 value → 第 2 次 createFolderApi → 同名文件夹创建两个。Escape 路径输入非空时 inputRow.remove() 同样触发 blur → 照样创建文件夹，取消失效。后端 createFolder 对 (parent_id, name) 无唯一约束，两行均落库。startRenameFolder 同根因（WR-01，Enter 重复 rename、Escape 改过的文本仍被应用）"
    artifacts:
      - path: "src/favorites-page.js:968-1011"
        issue: "startNewFolder Enter/blur 双处理器独立调用 createFolderApi，无 settled 守卫（HEAD 提交态）"
      - path: "src/favorites-page.js:1047-1093"
        issue: "startRenameFolder 同根因双触发（WR-01）"
      - path: "src/favorites-page.js:384-386"
        issue: "renderFolderTree level 0 清空 innerHTML，是 Enter 路径 blur 触发的直接来源"
    missing:
      - "为 startNewFolder / startRenameFolder 添加 settled（submitted）守卫：Enter/Escape/blur 任一路径先置位，其余路径短路（修复模式见 15-REVIEW.md CR-01 建议代码）"
      - "注意：工作树未提交的 Phase 16 改动已为两个函数实现 submitted 守卫（submitFolder/submitRename + Escape 置位），缺口关闭可直接落地并提交该修复后复核"
    related_uat: "UAT Test 6 标记 pass 与此不矛盾——预期项只验证『新文件夹出现在列表中』（出现了，但是两个）；Escape 若用空输入测试不会触发创建"
behavior_unverified_items:
  - truth: "右键菜单（收藏项/文件夹/空白区域）显示对应菜单项（原 must-have #4 的空白区域部分）"
    test: "运行 npm run dev，打开 realm://favorites，右键点击右侧收藏列表空白区域与左侧文件夹树面板空白区域"
    expected: "显示自定义新建菜单（新建文件夹/粘贴/按名称排序），而非「后退/前进/刷新/检查元素」网页菜单"
    why_human: "菜单是否实际弹出是运行时行为；初次验证曾在结构在场的情况下漏掉几何坍缩缺陷（#favoritesContent 无 CSS 规则），结构证据对这类几何/事件链问题被证明不充分"
  - truth: "右键点击右侧收藏列表任意空白区域（列表下方、空文件夹空状态、padding 环）显示自定义新建菜单（15-02 truth 1，UAT Test 5）"
    test: "右侧列表有内容时右键列表下方大面积空白；空文件夹时右键空状态图标区域及其下方"
    expected: "均显示自定义新建菜单"
    why_human: "15-02 Task 3（checkpoint:human-verify）被 orchestrator AUTO_MODE 自动批准，真人复测未执行；结构验证（委托路由+守卫+preventDefault）只能证明代码路径在场，不能证明运行时菜单弹出"
  - truth: "右键点击左侧文件夹树面板空白区域显示同一新建菜单（15-02 truth 2）"
    test: "右键点击左侧文件夹树面板节点下方空白区域"
    expected: "显示自定义新建菜单"
    why_human: "同上——左侧面板此前从未绑定监听，本次由 .favorites-main 委托覆盖，运行时未获人工确认"
  - truth: "剪切收藏项后进入目标文件夹，在其空白区域右键选择粘贴可完成移动，原文件夹不再显示该项（15-02 truth 3，UAT Test 7）"
    test: "右键某收藏项 → 剪切（该项变半透明）→ 左侧点击进入另一个文件夹 → 右侧空白区域右键 → 选择「粘贴」"
    expected: "收藏项移动到该文件夹，原文件夹中不再显示"
    why_human: "纯运行时交互链路（剪切 → 导航 → 空白菜单 → 粘贴 → move-favorites API → 列表刷新），无自动化覆盖，Task 3 自动批准未执行"
  - truth: "右键搜索输入框仍显示默认编辑菜单；收藏项/文件夹节点右键菜单行为不变；菜单打开时在另一空白处右键可移动菜单而非闪关（15-02 truth 4，回归项）"
    test: "右键顶部搜索输入框；右键收藏项；右键文件夹节点；菜单打开时点击其他区域；菜单打开时在另一处空白右键"
    expected: "搜索框显示默认编辑菜单（剪切/复制/粘贴等）；收藏项/文件夹菜单不变；点击其他区域菜单关闭；另一处空白右键菜单移动到新位置不闪关"
    why_human: "回归行为需运行时确认；守卫二与 stopPropagation 顺序的结构正确性已验证，但实际交互效果（尤其菜单移位不闪关）只能在运行中观察"
human_verification:
  - test: "运行 npm run dev 启动应用，打开收藏夹页面（realm://favorites）【15-02 Task 3 步骤 1】"
    expected: "应用正常启动，页面无报错"
    why_human: "Electron GUI 应用，无法在自动化环境运行"
  - test: "【UAT Test 5 复测】右侧列表有内容时，右键点击列表下方大面积空白区域；空文件夹的空状态图标区域及其下方同样验证一次【步骤 2】"
    expected: "显示自定义菜单（新建文件夹/粘贴/按名称排序），而不是网页通用菜单"
    why_human: "菜单实际弹出是运行时行为，初次验证的结构判据曾在此漏掉几何缺陷"
  - test: "右键点击左侧文件夹树面板节点下方的空白区域【步骤 3】"
    expected: "同样显示自定义新建菜单"
    why_human: "同上"
  - test: "【UAT Test 7 复测】右键某收藏项 → 剪切（该项变半透明）→ 左侧点击进入另一个文件夹 → 在右侧空白区域右键 → 选择「粘贴」【步骤 4】"
    expected: "收藏项移动到该文件夹，原文件夹中不再显示"
    why_human: "纯运行时交互链路，无自动化覆盖"
  - test: "【守卫回归】右键顶部搜索输入框；右键收藏项；右键文件夹节点【步骤 5】"
    expected: "搜索框显示默认编辑菜单；收藏项菜单不变；文件夹菜单不变"
    why_human: "回归行为需运行时确认"
  - test: "【菜单交互回归】菜单打开时点击其他区域；菜单打开时在另一处空白右键【步骤 6】"
    expected: "点击其他区域菜单关闭；另一处空白右键菜单移动到新位置（不会闪一下消失）"
    why_human: "闪关与否是同一事件分发内的运行时行为，只能在运行中观察"
---

# Phase 15: 收藏夹文件夹 - UI 交互 Verification Report（再验证）

**Phase Goal:** 实现收藏夹页面的文件夹 UI 交互功能
**Verified:** 2026-07-28T13:22:40Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure 15-02
**验证基准:** 已提交状态 HEAD（`5d832aa`）；工作树中 Phase 16 未提交改动不计入本阶段交付物（已用 `git show HEAD:<file>` 隔离）

## Gap Closure Re-Verification

本节针对 UAT 发现的两条缺口（15-UAT.md Test 5 / Test 7）及 15-02 修复的核查结论。

### UAT Test 5 缺口（空白区域右键显示网页通用菜单）

**结构核查（HEAD：783e10d + c975877）：全部通过**

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 旧失效绑定已删除 | ✓ | `favoritesContent.addEventListener` 在 HEAD 文件中出现 0 次（15-02 Task 1 负向 grep 复核一致） |
| `.favorites-main` 委托路由存在 | ✓ | `favorites-page.js:1355-1373`（HEAD）：`document.querySelector('.favorites-main')` 判空后注册 contextmenu 监听 |
| 守卫一（节点防御） | ✓ | `e.target.closest('.favorite-item, .folder-tree-item')` → return（委托处理器内，:1359） |
| 守卫二（交互元素放行） | ✓ | `closest('input, textarea, select, button, a, dialog, .context-menu, [contenteditable]')` → return——搜索框默认编辑菜单所依赖的 webview 透传管线不被阻断 |
| stopPropagation 顺序正确 | ✓ | `e.stopPropagation()` 在 `showEmptyContextMenu(e)` 之前执行，且有块注释说明理由（避开 showContextMenu 在 document 级注册的隐藏监听，:672-685，防菜单闪关） |
| showEmptyContextMenu 守卫扩展 | ✓ | :854 守卫选择器已扩为 `'.favorite-item, .folder-tree-item'`，与委托守卫一一致；`e.preventDefault()` 保持不动（:856）——关键不变量成立 |
| `.favorites-main` 是两面板公共祖先 | ✓ | `favorites.html:30-61`（HEAD）：`.favorites-main > .favorites-folder-panel + .favorites-content-area`，委托单点覆盖左右两栏所有空白 |
| CSS 几何兜底 | ✓ | `main.css:2135-2137`（HEAD）：`.favorites-content-area` 规则块后新增 `#favoritesContent { flex: 1 }` + 中文注释 |
| 语法检查 | ✓ | `node --check`（HEAD 版本）通过 |
| 节点处理器不冲突 | ✓ | `showFavoriteContextMenu`(:703-704) 与 `showFolderContextMenu`(:783-784) 均有 `preventDefault + stopPropagation`，事件不会冒泡到委托层 |

**行为核查：未获人工确认。** 15-02 Task 3（checkpoint:human-verify，UAT Test 5/7 复测 6 步）被 orchestrator AUTO_MODE 策略自动批准，真人复测未执行（15-02-SUMMARY.md 已透明声明）。吸取初次验证的教训——上次结构在场但几何坍缩导致菜单弹不出——本次修复的行为效果（菜单在各类空白区域实际弹出）**必须**由真人按下方 human_verification 6 步确认后才能视为关闭。

**结论：结构修复正确且完整（根因修复而非症状修补），行为待人工复测 → ⚠️ PRESENT_BEHAVIOR_UNVERIFIED**

### UAT Test 7 缺口（剪切后无法在目标文件夹空白处粘贴）

与 Test 5 同根因、同修复。结构上：空白菜单「粘贴」项 → `pasteFromClipboard()` → `favoritesApi('move-favorites', { ids, folderId: state.currentFolderId })` → 刷新列表与文件夹树，链路完整在场（HEAD :862-867, :887-918）。粘贴入口现在几何上可达（委托覆盖所有空白路径）。但整条「剪切 → 导航 → 空白右键 → 粘贴 → 移动生效」交互链路是纯运行时行为，无自动化覆盖，Task 3 未真人执行。

**结论：结构链路完整，行为待人工复测 → ⚠️ PRESENT_BEHAVIOR_UNVERIFIED**

### 新发现问题（与两条 UAT 缺口无关，来自 15-REVIEW.md CR-01）

再验证对原 must-have #5 做回归时，结合代码审查发现复核了 `startNewFolder` 实现，**独立确认 CR-01 缺陷链在 HEAD 提交态成立**：

1. Enter 处理器 `await createFolderApi(name, parentId)` —— 第 1 次创建（:976）
2. `await refreshFolderTree()` → `renderFolderTree` 在 level 0 执行 `elements.folderTree.innerHTML = ''`（:384-386）→ 聚焦中的 input 随 inputRow 被移除 → **blur 事件触发**（Enter 处理器末尾的 `inputRow.remove()` 是另一条等效触发路径）
3. blur 处理器中 `input.value` 仍保留输入文本（detached 节点状态保留）→ 名称非空 → **第 2 次 `createFolderApi(name, parentId)`**（:997-1006）→ 同名文件夹创建两个

Escape 路径：输入文本后按 Escape → `inputRow.remove()`（:991）→ blur → 名称非空 → **照样创建文件夹**（取消失效）。无任何 settled 守卫。`startRenameFolder`（:1047-1093）同根因（WR-01）：Enter 重复调用 rename API，Escape 在修改过文本后仍静默应用重命名。

**值得注意：** 工作树中未提交的 Phase 16 改动已为两个函数实现 `submitted` 守卫（`submitFolder`/`submitRename`，Escape 路径亦置位）——即审查建议的修复模式。但该修复 (a) 未提交、(b) 属于 Phase 16 交付物、(c) Phase 16 在 ROADMAP 中的目标（拖拽排序/排序持久化/批量操作，FOLDER-07）未显式覆盖此缺陷，按 Step 9b 保守规则不可记为 deferred。缺口关闭动作：落地并提交该守卫修复（或等效实现），然后复核。

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 文件夹树面板在左侧 200-240px 固定宽度，收藏列表在右侧 flex:1 | ✓ VERIFIED | （回归）`main.css:1986-1989` width:220px/min:200px/max:240px；`main.css:2124-2126` `.favorites-content-area` flex:1；`favorites.html:30-61` 分栏结构在 HEAD 保持 |
| 2 | 点击文件夹 = 展开/收起 + 导航（一步完成） | ✓ VERIFIED | （回归）`favorites-page.js:424-434`（HEAD）click handler 同一函数内 `expandedFolders.add/delete` + `navigateToFolder(folder.id)`；UAT Test 3 已人工 pass |
| 3 | 面包屑显示当前路径，点击任意节点可跳转 | ✓ VERIFIED | （回归）`favorites-page.js:499-515+`（HEAD）`renderBreadcrumb()` 中间节点绑定 `navigateToFolder` 点击事件；UAT Test 4 已人工 pass |
| 4 | 右键菜单（收藏项/文件夹/空白区域）显示对应菜单项 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 收藏项菜单（:702+）与文件夹菜单（:781+）在原 UAT Test 5 中已人工确认；空白区域菜单由 15-02 结构性修复（见上方 Gap Closure 节）但运行时弹出未获人工复测 |
| 5 | 新建文件夹通过内联输入框完成，Enter 确认，Escape 取消 | ✗ FAILED | CR-01：Enter 双创建 + Escape 非空仍创建，结构复核独立确认（见上方「新发现问题」）；无 settled 守卫 |
| 6 | 【15-02】右键右侧收藏列表任意空白区域显示自定义新建菜单，而非网页通用菜单 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构全链路确认（委托+守卫+preventDefault+CSS 兜底，见 Gap Closure 节）；Task 3 人工复测被 AUTO_MODE 自动批准未执行 |
| 7 | 【15-02】右键左侧文件夹树面板空白区域显示同一新建菜单 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 同上——`.favorites-main` 委托覆盖左侧面板；运行时未确认 |
| 8 | 【15-02】剪切后进入目标文件夹，空白区域右键粘贴完成移动，原文件夹不再显示 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 结构链路完整（空白菜单「粘贴」→ pasteFromClipboard → move-favorites API）；纯运行时行为未确认 |
| 9 | 【15-02】搜索框默认编辑菜单保留；收藏项/文件夹菜单不变；菜单移位不闪关 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 守卫二放行交互元素、节点处理器自带 preventDefault+stopPropagation 不到达委托层、stopPropagation 先于 showEmptyContextMenu——结构均正确；回归效果需运行时观察 |

**Score:** 3/9 truths verified（5 项结构与行为分离，present + wired 但行为未行使；1 项 FAILED）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/favorites-page.js` | .favorites-main 委托路由 + showEmptyContextMenu 守卫扩展 | ✓ VERIFIED（结构） | 委托路由 :1355-1373 含双守卫 + stopPropagation + 块注释；守卫扩展 :854；旧绑定 0 残留 |
| `src/styles/main.css` | #favoritesContent flex:1 几何兜底 | ✓ VERIFIED | :2135-2137 位于 `.favorites-content-area` 规则块后，注释完整 |
| `src/favorites.html` | 左右分栏布局（回归） | ✓ VERIFIED | `.favorites-main` 公共祖先结构保持 |
| `favorites-manager.js` | listRecords 支持 folder_id（回归） | ✓ VERIFIED | 初次验证已核，本次无改动 |
| `main.js` | list 路由支持 folder_id（回归） | ✓ VERIFIED | 初次验证已核，本次无改动 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| .favorites-main contextmenu 委托 | showEmptyContextMenu | e.preventDefault() 阻断 Chromium 向 webview context-menu（renderer.js:833）透传 | ✓ WIRED（结构） | 委托处理器调用链在场；preventDefault 位于 showEmptyContextMenu :856；运行时「主进程菜单不再弹出」待人工确认 |
| 委托处理器 | document 级隐藏监听隔离 | e.stopPropagation() | ✓ WIRED | :1367 stopPropagation 先于 showEmptyContextMenu；showContextMenu 的 document 隐藏监听（:672-685）不会在同一事件分发中闪关新菜单 |
| 空白菜单「粘贴」项 | move-favorites API | pasteFromClipboard → favoritesApi('move-favorites') | ✓ WIRED（结构） | :862-867 菜单项 → :887-918 粘贴逻辑 → API 调用 + 列表/树刷新；运行时移动效果待人工确认 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| favorites-page.js | state.folderTree | fetchFolderTree() → favoritesApi('folder-tree') | Yes | ✓ FLOWING（回归，初次已核） |
| favorites-page.js | state.records | loadFavorites() → favoritesApi('list', {folder_id}) | Yes | ✓ FLOWING（回归，初次已核） |

### Behavioral Spot-Checks

Step 7b: SKIPPED（Electron GUI 应用，无 GUI 环境无法运行；无可独立运行的入口点——这正是 15-02 truths 路由给人工验证的原因）

### Probe Execution

Step 7c: SKIPPED（项目无 probe 脚本；15-02 的自动化验证命令已作为结构核查直接执行并记录于 Gap Closure 节）

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOLDER-05 | PLAN.md | 文件夹树状导航 | ✓ SATISFIED | 回归确认 + UAT Test 3 人工 pass |
| FOLDER-06 | PLAN.md | 面包屑导航 | ✓ SATISFIED | 回归确认 + UAT Test 4 人工 pass |
| FOLDER-08 | PLAN.md / 15-02-PLAN.md | 右键菜单（收藏夹页面）— 收藏项/文件夹/空白区域菜单 | ? NEEDS HUMAN | 收藏项/文件夹菜单已人工确认；空白区域菜单结构修复完成但运行时行为未获人工复测（15-02 Task 3 自动批准） |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | HEAD 版本 favorites-page.js / main.css 无 TBD/FIXME/XXX/TODO/HACK/占位符/空实现；旧绑定删除未留墓碑注释（符合 15-02 Task 1 要求） |

### Human Verification Required

以下 6 项即 15-02-PLAN.md Task 3 的 how-to-verify 步骤（被 AUTO_MODE 自动批准、真人未执行），同时也是 5 项 ⚠️ PRESENT_BEHAVIOR_UNVERIFIED truths 的补验路径。**在 gaps_found 状态解除前，这些人工项同样需要完成**——缺口不变量「guest 页面任何空白右键路径上都有处理器调用 e.preventDefault()，主进程通用网页菜单不再出现」的最终确认依赖运行时观察。

1. **冷启动** — 运行 npm run dev 启动应用，打开收藏夹页面（realm://favorites）。预期：应用正常启动，页面无报错。
2. **UAT Test 5 复测** — 右侧列表有内容时右键列表下方大面积空白区域；空文件夹的空状态图标区域及其下方同样验证。预期：显示自定义菜单（新建文件夹/粘贴/按名称排序），而非「后退/前进/刷新/检查元素」网页菜单。
3. **左侧面板空白** — 右键点击左侧文件夹树面板节点下方的空白区域。预期：同样显示自定义新建菜单。
4. **UAT Test 7 复测** — 右键某收藏项 → 剪切（该项变半透明）→ 左侧点击进入另一个文件夹 → 在右侧空白区域右键 → 选择「粘贴」。预期：收藏项移动到该文件夹，原文件夹中不再显示。
5. **守卫回归** — 右键顶部搜索输入框；右键收藏项；右键文件夹节点。预期：搜索框显示默认编辑菜单（剪切/复制/粘贴等），不显示新建菜单；收藏项菜单不变；文件夹菜单不变。
6. **菜单交互回归** — 菜单打开时点击其他区域；菜单打开时在另一处空白右键。预期：点击其他区域菜单关闭；另一处空白右键菜单移动到新位置（不会闪一下消失）。

另建议（来自 CR-01 复核）：新建文件夹时输入名称按 Enter 后，数文件夹树中同名节点数量——修复落地前应为 2 个（缺陷），修复后应为 1 个；输入文本后按 Escape 不应创建任何文件夹。

### Gaps Summary

**1 条 FAILED truth（阻塞），5 项行为待人工确认。**

**缺口（gaps_found 的直接原因）：** 原 must-have #5「新建文件夹 Enter 确认 / Escape 取消」在 HEAD 提交态行为缺陷——CR-01 的 blur/Enter 双触发链经本次独立结构复核确认成立：Enter 创建两个同名文件夹，Escape 在输入非空时仍创建（取消失效）；`startRenameFolder` 同根因（WR-01）。初次验证判 VERIFIED 是结构性误判（函数在场 ≠ 行为正确），与 UAT Test 5/7 漏掉几何缺陷同类教训。缺口关闭动作明确：为两个函数落地 settled（submitted）守卫——**工作树未提交的 Phase 16 改动已实现该修复**，提交后复核即可。

**15-02 缺口修复本身的评价：** 修复方案正确、完整、对症（根因修复），结构核查 10/10 通过，无代码级问题。但 UAT Test 5/7 描述的是运行时行为，且 15-02 Task 3 的真人复测被 AUTO_MODE 自动批准而未执行——按「结构证据对几何/事件链问题不充分」的既定教训，这两条 UAT 缺口记为「结构修复完成、行为待人工复测」，不计入已关闭。

**与 15-REVIEW.md 的关系：** 本报告将 CR-01 升级为阶段级 BLOCKER（审查为 advisory，未阻塞）；WR-01 随同一缺口关闭（同修复模式）；其余 10 项 Warning 不在本阶段 must-haves 范围内，不阻塞本阶段，但建议在 Phase 16 或后续阶段处理。

---

_Verified: 2026-07-28T13:22:40Z_
_Verifier: Claude (gsd-verifier)_
