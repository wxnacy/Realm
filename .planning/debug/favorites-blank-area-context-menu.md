---
status: fixed
trigger: "收藏夹页面（realm://favorites）中，右键点击收藏列表/文件夹面板的空白区域时，显示的是网页默认右键菜单，而非应用自定义的上下文菜单（新建文件夹/粘贴/按名称排序），导致无法在空白区域粘贴已剪切的收藏项。"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:30:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — 空白区域 contextmenu 监听绑在 #favoritesContent（favorites-page.js:1347），该元素无 CSS 规则、作为 flex 子项高度坍缩为内容高度，列表下方大面积空白实际属于父容器 .favorites-content-area；事件冒泡路径不经过 #favoritesContent，处理器永不触发 → 无 preventDefault → webview context-menu 事件透传到主进程弹出 Phase-13 网页通用菜单。左侧面板 #folderTree 则根本没有绑定空白区域监听
test: 静态全链路追踪（DOM 结构 + CSS 几何 + 事件冒泡路径 + Electron preventDefault 语义）
expecting: 与观察一致（已确认）；可证伪预测：空文件夹中右键空状态图标区域（在 #favoritesContent 内）会弹自定义菜单，而其下方区域不会
next_action: 已诊断（goal: find_root_cause_only）— 返回 ROOT CAUSE FOUND 给编排层

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: 右键点击收藏列表空白区域显示新建菜单（新建文件夹/粘贴/按名称排序）；剪切收藏项后，在目标文件夹空白区域右键可选择"粘贴"完成移动
actual: 右键点击空白区域出现的是正常网页空白处的默认右键菜单；粘贴只能在文件夹节点上右键触发，空白区域无法粘贴
errors: None reported
reproduction: Test 5 and Test 7 in UAT (.planning/phases/15-ui/15-UAT.md) — 打开 realm://favorites，右键点击右侧收藏列表的空白区域（非收藏项、非文件夹节点）
started: Discovered during UAT of Phase 15 (ui) — 2026-07-28

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: 空白区域监听未绑定（绑定缺失）
  evidence: favorites-page.js:1347-1349 存在 elements.favoritesContent.addEventListener('contextmenu', showEmptyContextMenu)；showEmptyContextMenu(:858) 实现完整（新建文件夹/粘贴/按名称排序 + preventDefault）
  timestamp: 2026-07-29T00:10:00Z

- hypothesis: showEmptyContextMenu 的 closest('.favorite-item') 守卫误判空白点击
  evidence: 空白区域 target 不可能是 .favorite-item 后代；守卫逻辑本身正确。且若是守卫误判，表现应为"无任何菜单"，而用户看到的是网页菜单 —— 说明 preventDefault 根本没被调用（处理器未触发）
  timestamp: 2026-07-29T00:12:00Z

- hypothesis: main.js 遗留 5 项旧菜单 handler 抢占（web-context-menu-wrong-items 同根因）
  evidence: grep main.js 'context-menu'：旧 webContents 级 handler 已移除（该 debug 会话的修复已落地），当前仅剩新管线 ipcMain 'show-web-context-menu'（main.js:1094）→ contextMenuManager.buildWebMenu。用户看到的"正常网页空白菜单"= Phase-13 通用网页菜单（13 项），非旧 5 项菜单
  timestamp: 2026-07-29T00:18:00Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-29T00:05:00Z
  checked: 相关知识库 + 活跃 debug 会话 web-context-menu-wrong-items.md
  found: 无 knowledge-base.md；web-context-menu-wrong-items（status: fixed）记录了 Electron 语义：guest 页面 contextmenu 事件 preventDefault 后 webview context-menu 事件不再透传主进程 —— 这解释了为何收藏项/文件夹节点右键正常（两处处理器都调用了 preventDefault + stopPropagation）
  implication: 空白区域显示网页菜单 ⇔ guest 页面没有处理器调用 preventDefault ⇔ 空白区域 contextmenu 处理器未触发

- timestamp: 2026-07-29T00:10:00Z
  checked: favorites-page.js 全部 contextmenu 绑定（grep）
  found: 仅 3 处：:364 收藏项 → showFavoriteContextMenu；:438 文件夹节点 → showFolderContextMenu；:1347 #favoritesContent → showEmptyContextMenu。#folderTree / .favorites-content-area / document 上均无空白区域监听
  implication: 左侧文件夹面板空白区完全没有处理器；右侧面板处理器只绑在 #favoritesContent

- timestamp: 2026-07-29T00:14:00Z
  checked: favorites.html:46-60 DOM 结构 + main.css 几何
  found: 结构为 .favorites-content-area(flex column, overflow-y:auto, padding:16px) > #breadcrumb + #actionsBar + #favoritesContent。#favoritesContent 在 main.css 中【无任何规则】→ flex 子项默认 flex:0 1 auto → 高度坍缩为内容高度。列表下方所有可见空白 + 16px padding 环均属于父容器 .favorites-content-area。.favorites-empty 仅 padding:64px 24px，也不铺满面板
  implication: 右键点击列表下方空白 → target = .favorites-content-area → 冒泡路径（content-area → favorites-main → favorites-page → body）不经过 #favoritesContent → :1347 监听永不触发。事件只向上冒泡到祖先，兄弟/父级区域不在 #favoritesContent 子树内

- timestamp: 2026-07-29T00:18:00Z
  checked: 主进程当前菜单来源（grep main.js context-menu）+ renderer.js:833-851
  found: 旧 5 项 handler 已移除。新管线：webview 'context-menu' DOM 事件（renderer.js:833，无内部页面过滤）→ realmAPI.showWebContextMenu → main.js:1094 → buildWebMenu 弹出通用网页菜单（后退/前进/刷新/...检查元素）
  implication: 完整失败链确认：空白右键 → guest 无 preventDefault → Chromium 通知 embedder → renderer 无差别转发 → 主进程弹"正常网页"菜单。收藏页是 http://localhost:PORT/favorites 的 webview guest，与正常网页走同一条管线

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: 空白区域右键菜单的事件覆盖缺口（双重）：(1) 右侧面板 — 空白区域 contextmenu 监听绑在 #favoritesContent（favorites-page.js:1347），但该元素无 CSS 规则、作为 .favorites-content-area（flex column）的子项高度坍缩为内容高度，列表下方大面积可见空白 + 16px padding 环实际属于父容器；contextmenu 事件只向祖先冒泡，点击父容器区域时传播路径不经过 #favoritesContent，处理器永不触发。(2) 左侧文件夹面板 — #folderTree 虽有 flex:1 铺满面板，但从未绑定任何空白区域 contextmenu 监听。两处空白点击都没有 preventDefault，Chromium 遂将右键透传给 embedder：webview 'context-menu' 事件（renderer.js:833，不过滤内部页面）→ IPC show-web-context-menu → 主进程弹出 Phase-13 通用网页菜单 —— 即用户看到的"正常网页空白出现的菜单"。Test 5（右侧空白无新建菜单）与 Test 7（无法在空白处粘贴）同根因
fix: （未修复 — goal: find_root_cause_only）方向：把空白区域监听提升到能覆盖可见空白的层级 — 推荐在 setupEventListeners 改为 document（或 .favorites-main）级 contextmenu 委托路由（收藏项/文件夹节点处理器已有 stopPropagation，不会冲突；showEmptyContextMenu 的 closest 守卫需相应补 .folder-tree-item）；或在 .favorites-content-area 和 #folderTree 上分别绑定并确保 preventDefault。CSS 辅助方案：#favoritesContent 加 flex:1 可覆盖列表下方空白，但 16px padding 环仍需委托方案才能覆盖
verification: （未验证 — 诊断模式）
files_changed: []
