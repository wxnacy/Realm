---
status: fixed
trigger: "AI 当前标签页打开链接有成功回复但网页实际未加载（幽灵 Tab）"
created: 2026-08-02T08:11:00.000Z
updated: 2026-08-02T08:11:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 【已确认】navigate 工具幽灵 Tab + newTab 参数被忽略 + 系统提示词工具职责重叠导致 AI 误选
test: 全部验证完成
expecting: —
next_action: 返回 ROOT CAUSE FOUND 结构化诊断（goal: find_root_cause_only，不修复）

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: AI 调用打开链接工具后，目标网页在当前标签页（或新标签页）真实加载，用户可看到页面内容
actual: 用户输入「当前标签打开 baidu.com」，AI 回复「已成功打开百度首页。现在我可以在新的标签页中浏览百度了」，但页面实际未打开。主进程日志显示：AI 先调 get_tabs，随后调用 navigate {"url":"https://www.baidu.com"} → 主进程输出 [Realm] Tab 创建: tab-469 (容器: default) → navigate 工具返回 {"success": true, "tabId": "tab-469", "url": "https://www.baidu.com", "containerId": "default"}。但渲染进程未创建对应 webview，URL 从未加载（无 did-navigate 日志）。
errors: None reported
reproduction: Test 4 in UAT（.planning/phases/22-cdp/22-UAT.md）
started: Discovered during Phase 22 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-29T00:05:00.000Z
  checked: .planning/debug/knowledge-base.md（Phase 0 已知模式检查）
  found: 知识库文件不存在，无历史模式可匹配
  implication: 按开放调查流程进行

- timestamp: 2026-07-29T00:06:00.000Z
  checked: .planning/phases/22-cdp/22-UAT.md Test 4 与 Gaps 段
  found: Test 4 result=issue（severity major）：AI 调 navigate {"url":"https://www.baidu.com"} → 主进程 [Realm] Tab 创建: tab-469 (容器: default) → 返回 success，渲染进程未创建 webview，URL 从未加载。UAT 期望是 open_link 双模式（newTab=true/false）均正常
  implication: 与症状描述一致；AI 选择了 navigate 而非 open_link

- timestamp: 2026-07-29T00:08:00.000Z
  checked: ai-manager.js:748-790 navigate 工具 execute 实现
  found: execute 解构 { url, containerId = 'default', newTab = false } 后，注释「使用 tabManager.createTab 创建新标签页」，直接 const tab = tabManager.createTab(containerId, url)，返回 {success:true, tabId:tab.id, url, containerId}。newTab 参数被解构但从未使用——无论 true/false 都创建新 tab 记录，从不执行当前标签导航。无任何 webContents.send / loadURL 调用
  implication: 【双重缺陷确认】① 幽灵 Tab：主进程直接 createTab 不经渲染进程；② 语义缺陷：description 宣称「支持在当前标签页或新标签页中打开」且 newTab 默认 false（当前标签），实现却永远新建 tab 记录——与用户「当前标签打开」诉求完全相反

- timestamp: 2026-07-29T00:09:00.000Z
  checked: ai-manager.js:1166-1270 open_link 工具实现（Phase 22 修复后版本，对照组）
  found: newTab=true 分支有详细注释（1213-1218 行）：「webview 只能由渲染进程创建 —— 复用 window.open 拦截同款 open-url-in-tab 通道，渲染进程走完整 createTab 链路（DOM + webview + URL 加载），主进程直接 tabManager.createTab 只会产生无 webview 的幽灵 Tab」；实现为 mainWindow.webContents.send('open-url-in-tab', {url, containerId, guestId: undefined})。newTab=false 分支：tabManager.getActiveTab() + getActiveWebviewContentsIdLazy() + webContents.fromId + wc.loadURL(url) 真导航
  implication: open_link 两个模式均为正确实现；navigate 是 Phase 20 遗留的同款缺陷未修复版本。代码注释本身就证明项目已认知「主进程直接 tabManager.createTab = 幽灵 Tab」这一模式

- timestamp: 2026-07-29T00:10:00.000Z
  checked: ai-manager.js:86-104 REALM_SYSTEM_PROMPT
  found: 工具列表同时列出 navigate（「在指定容器中打开网页」）与 open_link（「在指定容器中打开一个链接，支持在当前标签页或新标签页中打开。默认使用当前活跃容器和新标签页」）。使用指南仅一条相关：「当用户要求打开某个链接时，使用 open_link」。两个工具 description 高度雷同（都宣称支持当前/新标签页两种模式）
  implication: 工具职责重叠 + 描述雷同。用户说「当前标签打开 baidu.com」时，navigate 的 newTab 默认 false（当前标签语义）与用户措辞更匹配，AI 有充分理由选 navigate——系统提示词的「打开链接用 open_link」指引不足以消除歧义，因为用户输入的是域名/网址而非「链接」，且 navigate 描述也声称支持当前标签页模式

- timestamp: 2026-08-02T08:12:00.000Z
  checked: tab-manager.js:102-125 createTab 实现
  found: 仅执行 tabs.set(tabId, tab)（内存 Map）+ activeTabId = tabId（活跃指针被劫持到幽灵 tab）+ saveTabs()（持久化）+ console.log('[Realm] Tab 创建: ...')。无任何 webContents.send / IPC 通知渲染进程。症状日志「[Realm] Tab 创建: tab-469 (容器: default)」正是 tab-manager.js:122 输出行
  implication: 幽灵 Tab 机制确认：主进程记录+持久化完成，渲染进程零感知。且产生两个次生危害：① 主进程活跃 tab 指针指向幽灵，与渲染进程实际活跃 tab 失同步——后续 getActiveTab() 解析的工具（read_page_content/extract_links/open_link newTab=false）会拿到幽灵 tab 配旧 webview，数据错乱或报错；② saveTabs() 持久化幽灵，重启后 restoreTabs 流程可能把幽灵物化为真实 tab

- timestamp: 2026-08-02T08:13:00.000Z
  checked: 正常 Tab 创建链路（对照）：renderer.js:483 createTab → realmAPI.createTab → ipc-handlers.js:260 tabManager.createTab → renderer 建 DOM → createWebviewForTab（webview+URL 加载）→ switchTab；handleOpenUrlInTab（renderer.js:1946-1972）经 createTab 走同一全链路
  found: tabManager.createTab 设计上只是「渲染进程驱动流程的记录保持半区」，正常链路中由渲染进程经 IPC 调用。navigate 在主进程直接调用 = 只跑了记录半区。正常链路渲染进程会输出「[Realm Renderer] Tab 创建: ...」并触发 did-navigate——症状中两者均缺失，与主进程单独建记录的推断完全吻合
  implication: 根因三重确认：① navigate 实现 = Phase 22 已在 open_link 修复并留有注释的同款幽灵 Tab 缺陷；② newTab 参数被解构但从未使用，宣称的「当前标签导航」语义完全未实现；③ REALM_SYSTEM_PROMPT 工具职责重叠致 AI 在用户要求「当前标签打开」时误选 navigate

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  三重根因叠加（按贡献度排序）：
  1.【核心缺陷】navigate 工具（ai-manager.js:748-790）execute 直接调用 tabManager.createTab(containerId, url)（ai-manager.js:776），该函数仅写主进程内存记录 + saveTabs 持久化 + 日志（tab-manager.js:102-125），从不通知渲染进程——webview 只能由渲染进程创建，故产生「主进程有记录、UI 无 Tab/webview、URL 从未加载」的幽灵 Tab。这是 Phase 22 在 open_link 中已修复的同款缺陷（修复注释见 ai-manager.js:1213-1218），Phase 20 遗留的 navigate 未同步修复。
  2.【语义缺陷】navigate 的 newTab 参数（默认 false，宣称「当前标签页导航」）被 execute 解构后从未使用——无论 true/false 永远创建新 tab 记录，从不执行当前标签导航。用户「当前标签打开 baidu.com」的诉求被双重辜负：既未在当前标签导航，也未真实创建新标签。
  3.【工具选择歧义】REALM_SYSTEM_PROMPT（ai-manager.js:86-104）同时列出职责重叠的 navigate 与 open_link，description 几乎雷同（均宣称支持当前/新标签页两种模式），仅有一句「打开链接用 open_link」指引。对用户「当前标签打开 <域名>」的输入，newTab 默认 false 的 navigate 反而是表面上更匹配的工具，AI 误选是可预见结果。
fix: （find_root_cause_only 模式，未实施）建议方向：navigate 复用 open_link 的正确实现（newTab=true 走 open-url-in-tab IPC 渲染进程全链路；newTab=false 走活跃 webview wc.loadURL），或彻底去重——移除 navigate 仅保留 open_link 并同步更新 REALM_SYSTEM_PROMPT 消除选择歧义
verification: （未实施修复，无需验证）证据链：症状日志行与 tab-manager.js:122 输出逐一对应；缺失的 [Realm Renderer] Tab 创建 + did-navigate 与「渲染进程零感知」推断吻合
files_changed: []
