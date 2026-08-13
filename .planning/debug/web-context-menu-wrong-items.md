---
status: fixed
trigger: "网页空白处右键菜单只有 5 项（检查元素/后退/前进/刷新/复制），与 Phase 13 规格（13 项通用菜单）差距很大；图片/链接右键也显示相同菜单"
created: 2026-07-29T00:00:00.000Z
updated: 2026-07-29T00:10:00.000Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — main.js:167-178 遗留 webContents 级 context-menu handler（commit 884a58f 引入）在 Phase 13 接入新管线时未被移除；它在主进程同步抢先弹出旧 5 项菜单，新管线（完整接线无静态缺陷）的 popup 经渲染进程往返后到达时已无菜单可取代，用户永远只见旧菜单
test: 静态全链路追踪 + git 历史 + 截图菜单内容与旧模板逐项比对
expecting: 与观察一致（已确认）
next_action: 已诊断（goal: find_root_cause_only）— 返回 ROOT CAUSE FOUND 给编排层

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: 空白处右键 = 13 项通用菜单（后退/前进/重新加载/强制刷新/复制页面地址/添加到收藏/在新标签页打开/在后台打开/检查元素/查看页面源代码/撤销/剪切/复制/粘贴/全选，按 UI-SPEC 分组分隔）；图片右键 = 图片专属 4 项 + 通用菜单；链接右键 = 链接专属 4 项（含"在容器中打开"子菜单）+ 通用菜单
actual: 用户报告（截图确认）空白处右键只有：检查元素、后退、前进、刷新、复制 —— 5 项；图片右键和链接右键内容与空白处完全相同
errors: None reported
reproduction: Tests 7/8/9 in Phase 13 UAT：网页空白/图片/链接上分别右键观察菜单
started: Discovered during Phase 13 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: webview 的 context-menu 事件未绑定/未触发（管线断在起点）
  evidence: renderer.js:784 addEventListener('context-menu') 存在，bindWebviewEvents 在 :656 对每个新建 webview 调用；'context-menu' 是 Electron webview 标签文档化事件
  timestamp: 2026-07-29T00:04:00Z

- hypothesis: contextInfo 提取失败导致走了别的分支（image/link 判断失效）
  evidence: 截图 5 项菜单（检查元素开头、无 accelerator、无停止加载/另存为/打印等）与 buildWebMenu 任何 type 的输出结构都不匹配（general 也有 13+ 项且后退开头）；与 main.js:168 旧模板逐项一致。旧 handler 根本不读 mediaType/linkURL —— 这正解释了 tests 8/9"图片/链接右键与空白完全相同"
  timestamp: 2026-07-29T00:04:00Z

- hypothesis: IPC/preload 链路断裂（新菜单请求从未到达主进程）
  evidence: preload.js:535 暴露 showWebContextMenu；main.js:1045 注册 ipcMain 监听（与 UAT 已验证可用的 tab 菜单同一注册块，证明该块在启动时执行）；containerManager（main.js:23）和 getActiveWebviewContentsId（main.js:53）均在作用域内，handler 不会抛异常
  timestamp: 2026-07-29T00:07:00Z

- hypothesis: 存在第三处菜单来源（如 renderer 里的 contextmenu DOM 监听直接构建菜单）
  evidence: 全库 grep '检查元素'/'buildFromTemplate'/'contextmenu'：仅 main.js:168（旧 web 菜单）、main.js:1117（应用菜单栏）、context-menu-manager.js:389/519（新）、renderer.js:2273（Tab 栏 DOM 右键，走 show-tab-context-menu，tests 2-6 已验证正常）
  timestamp: 2026-07-29T00:05:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-29T00:01:00Z
  checked: .planning/debug/knowledge-base.md
  found: Knowledge base file does not exist — no known-pattern candidates
  implication: Proceed with open-ended investigation

- timestamp: 2026-07-29T00:03:00Z
  checked: grep '检查元素' 全代码库 + 读 main.js:166-178 + context-menu-manager.js 全文
  found: 存在两套右键菜单实现！(1) main.js:167-178 旧实现直接监听 webContents 级 'context-menu' 事件，模板为 [检查元素, sep, 后退, 前进, sep, 刷新, 复制] —— 与截图 5 项完全一致（顺序、组合、无 accelerator 都吻合）。(2) context-menu-manager.js buildWebMenu 新实现以 后退/前进/刷新/停止加载 开头、检查元素排第 9、带 accelerator，与截图不符
  implication: 用户看到的是 main.js 旧 handler 弹出的菜单。新问题：新管线（renderer webview context-menu → IPC show-web-context-menu → buildWebMenu）是否接线？若接线了为何没生效/没竞争过旧菜单？

- timestamp: 2026-07-29T00:04:00Z
  checked: 新管线三环节：renderer.js:784-799（webview context-menu 监听）、preload.js:535（showWebContextMenu 暴露）、main.js:1045-1059（ipcMain 'show-web-context-menu' → buildWebMenu）
  found: 三个环节全部存在且接线正确。bindWebviewEvents 在 renderer.js:656 每个 webview 创建时调用；main.js:1045 与已验证可用的 tab 菜单（UAT tests 2-6 pass）在同一 ipcMain 注册块内
  implication: 新管线无缺失环节。两个 handler 同时注册在同一个右键事件上 —— 竞争结构成立

- timestamp: 2026-07-29T00:05:00Z
  checked: main.js:123-124 web-contents-created 过滤条件；全库 grep contextmenu/buildFromTemplate/检查元素
  found: 旧 handler 过滤条件 `contents.getType() !== 'webview'` return —— 即作用于所有 webview guest（每个网页 tab）。全库不存在第三个菜单来源：buildFromTemplate 仅 4 处（main.js:168 旧 web 菜单 / main.js:1117 应用菜单 / context-menu-manager.js:389 tab 菜单 / :519 web 菜单）
  implication: 网页右键 = 两个 handler 竞争：旧（主进程同步）vs 新（renderer→IPC 往返）

- timestamp: 2026-07-29T00:06:00Z
  checked: git 历史（git log -S、git show --stat 0aa582f）+ Phase 13 全部文档 grep 遗留/旧/检查元素
  found: 旧 handler 由早期 commit 884a58f（"feat: 添加 webview DevTools 支持、右键菜单..."）引入。Phase 13 的 main.js 提交 0aa582f 是纯新增 45 行（+45/-0），未删除旧 handler。Phase 13 所有规划文档（13-CONTEXT/13-RESEARCH/13-01-PLAN/13-02-PLAN）从未提及该遗留 handler；13-VERIFICATION.md:88 仅静态审查即标 SATISFIED（"webview context-menu event wired"），未运行验证
  implication: 根因 = 实施疏漏：新管线叠加在遗留 handler 之上，规划/实现/验证三个环节都没发现旧实现的存在

- timestamp: 2026-07-29T00:07:00Z
  checked: main.js:23（containerManager 导入）、main.js:53（getActiveWebviewContentsId 导入）— 排除新 handler 运行时抛异常的可能
  found: 两个依赖均在作用域内，新 handler 不会因 ReferenceError 静默失败
  implication: 新菜单的 popup 确实会被调用，但发生在旧菜单已打开之后（时序：guest 右键 → 主进程 webContents 'context-menu' 同步派发 → 旧 popup 先行；embedder renderer 的 webview DOM 事件 + IPC 往返严格更晚）。观察结果（用户只见旧菜单）与"macOS 上菜单跟踪中第二次 popup 不取代前者"一致

- timestamp: 2026-07-29T00:08:00Z
  checked: 新管线数据契约比对：renderer.js:789-798 发送字段 vs context-menu-manager.js buildGeneralMenuItems 读取字段
  found: 潜伏缺陷（当前被旧 handler 掩盖，移除旧 handler 后会暴露）：(1) renderer 未发送 editFlags，buildGeneralMenuItems 读 contextInfo.editFlags.canCut/canCopy/canPaste → 剪切/复制/粘贴将恒为禁用（UI-SPEC IPC 契约同样漏了 editFlags）；(2) renderer 未发送 pageURL，"查看页面源代码"会打开空的 "view-source:"
  implication: 修复不能只删旧 handler —— 还需补 editFlags/pageURL 才能通过 UAT test 7/10

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: main.js:167-178 遗留 webContents 级 context-menu handler（早期 commit 884a58f 引入，作用于所有 webview guest）在 Phase 13 接入新菜单管线时未被移除（Phase 13 提交 0aa582f 纯新增 +45/-0）。webview 右键时两个 handler 同时触发：旧 handler 在主进程同步弹出 5 项旧菜单（检查元素/后退/前进/刷新/复制，与 UAT 截图逐项一致，且不读 mediaType/linkURL —— 故空白/图片/链接菜单全同，tests 7/8/9 同根因）；新管线（renderer.js:784 → preload.js:535 → main.js:1045 → context-menu-manager.buildWebMenu）接线完整无静态缺陷，但其 popup 需渲染进程 IPC 往返，到达时旧菜单已打开，macOS 上后到的 popup 不取代正在跟踪的菜单 —— 用户永远只看到旧菜单。规划/实现/静态验证（13-VERIFICATION.md 仅代码审查）三个环节都未发现遗留 handler 的存在
fix: （未修复 — goal: find_root_cause_only）方向：删除 main.js:166-178 遗留 handler；并补两个被掩盖的潜伏缺陷 —— renderer.js:789 contextInfo 缺 editFlags（否则剪切/复制/粘贴恒禁用）和 pageURL（否则查看页面源代码 URL 为空）
verification: （未验证 — 诊断模式）
files_changed: []
