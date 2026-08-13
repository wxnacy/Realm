---
status: fixed
trigger: "Investigate issue: reopen-closed-tabs-batch — \"关闭右侧标签页\"批量关闭多个 Tab 后，\"重新打开已关闭标签页\"只恢复了最右侧一个，未一次性恢复多个"
created: 2026-07-29T00:00:00Z
updated: 2026-07-29T00:05:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 【已确认】非实现缺陷——实现与 Phase 13 全部设计文档（DISCUSSION-LOG/UI-SPEC/PLAN/VERIFICATION）一致：每次恢复仅 pop 一条（LIFO 逐条）；UAT gap truth 要求"一次性恢复整批"是 UAT 阶段新引入的、与设计文档冲突的需求
test: 静态追踪 close-right-tabs → forEach closeTab → closedTabsStackPush（同步，在首个 await 前）；reopen-tab → 主进程 popClosedTab + 渲染进程 pop 各一条；Node 最小复现模拟
expecting: 批量关闭后栈含全部 N 条，每次恢复取栈顶一条（最右侧先恢复）——模拟输出 ["C","D"] → 恢复 D → 恢复 C，与假设一致 ✓
next_action: 诊断完成，返回 ROOT CAUSE FOUND（find_root_cause_only 模式，不修复）

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: 使用"关闭右侧标签页"批量关闭的多个 Tab，通过"重新打开已关闭标签页"可以恢复（LIFO 连续恢复，或一次性恢复整批——以 Phase 13 讨论结论 UI-SPEC/PLAN 为准）
actual: 用户报告"点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
errors: None reported
reproduction: Test 5 in Phase 13 UAT：开 3+ Tab → 右键中间 Tab → 关闭右侧标签页 → 右键 → 重新打开已关闭标签页
started: Discovered during Phase 13 UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: 批量关闭（close-right-tabs 等）未将每个被关闭的 Tab 逐个 push 进 closedTabsStack，导致栈里只有一条可恢复
  evidence: renderer.js:1182-1190 close-right-tabs 对每个右侧 tab 调用 closeTab；closeTab（:510-518）在首个 await 之前同步执行 closedTabsStackPush（:494-504，push 本身无 await）；主进程经 notifyClosedTab → context-menu:closed-tab（main.js:1066-1068）→ pushClosedTab 同步入栈。Node 最小复现确认批量关闭 2 个 tab 后栈为 ["C","D"]，两条都在
  timestamp: 2026-07-29T00:04:00Z

- hypothesis: 双栈（主进程/渲染进程）不同步导致恢复条目丢失
  evidence: push 路径（renderer closedTabsStackPush + notifyClosedTab→main pushClosedTab）与 pop 路径（菜单 click 中 main popClosedTab 一次 + renderer 收到 reopen-tab 后自身 pop 一次）每次操作两边各执行一次，计数始终一致；Cmd+Shift+T 仅存在于 popup 菜单模板 accelerator（context-menu-manager.js:369），无 shortcut-manager 全局注册、无第二条 pop 路径
  timestamp: 2026-07-29T00:04:30Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-29T00:00:00Z
  checked: 13-UAT.md Test 5 + Gaps
  found: UAT gap 记录 truth="重新打开已关闭标签页应恢复所有刚被批量关闭的标签页" status=failed severity=major，root_cause 为空
  implication: 这是一个已确认的功能缺口，需要定位 closedTabsStack 双维护实现中批量关闭未入栈或恢复逻辑仅取单条的位置

- timestamp: 2026-07-29T00:00:00Z
  checked: 13-UI-SPEC.md Tab Context Menu 第 5 项
  found: UI-SPEC 写 "重新打开已关闭标签页 | Cmd+Shift+T | closedTabs stack non-empty | Reopens last closed tab" —— 仅描述"恢复最后关闭的一个"，未明确批量关闭场景的恢复语义
  implication: 设计文档本身对批量关闭恢复语义可能未明确，需要查 DISCUSSION-LOG 的 D-xx 决策确认预期（逐条 LIFO vs 整批）

- timestamp: 2026-07-29T00:01:00Z
  checked: 设计预期——13-DISCUSSION-LOG.md / 13-CONTEXT.md / 13-01-PLAN.md / 13-02-PLAN.md / 13-VERIFICATION.md
  found: 全部设计文档均为"单条 LIFO 恢复"语义：DISCUSSION-LOG:64 "重新打开最近关闭的标签页"；13-02-PLAN:170 "reopen-tab → 从 closedTabsStack pop 出最后关闭的标签信息，调用 createTab"；13-VERIFICATION.md:130 Test 5 预期明确写 "连续关闭多个后可逐个恢复（LIFO 顺序）"。栈条目结构为 {containerId, url, title}，无 batchId/批次标记
  implication: 设计预期 = 逐条 LIFO 恢复（Chrome Cmd+Shift+T 风格）；UAT gap truth 的"一次性恢复整批"与设计文档冲突，属 UAT 阶段新引入的需求

- timestamp: 2026-07-29T00:02:00Z
  checked: 实现——src/renderer.js:129,494-544,1152-1200,2272-2292；context-menu-manager.js:26-63,325-392；main.js:1066-1068；preload.js:556,582
  found: ①批量关闭：close-right-tabs（renderer.js:1182-1190）forEach 调用 closeTab，closeTab 在首个 await 前同步 closedTabsStackPush（:515→:494-498），每个被关 tab 都入栈（左→右顺序），并 notifyClosedTab 同步主进程栈。②恢复：菜单 click（context-menu-manager.js:371-376）主进程 popClosedTab() 弹出【一条】并 send；renderer 处理器（:1192-1200）忽略 payload，自身栈再 pop【一条】，createTab 恢复单个 tab。③无其他任何 pop/clear 路径；Cmd+Shift+T 仅菜单 accelerator，无全局快捷键注册
  implication: 实现精确符合设计：每次恢复操作只恢复栈顶一条。批量关闭后首次恢复 = 最后关闭者 = 最右侧 tab（close-right 场景），与用户观测完全一致

- timestamp: 2026-07-29T00:04:00Z
  checked: Node 最小复现（mock state.tabs + 精确复刻 close-right-tabs forEach + closeTab 同步 push + reopen pop）
  found: 4 tab [A,B,C,D] 右键 B 关闭右侧 → 栈 = ["C","D"]；第 1 次恢复 = D（最右侧），第 2 次恢复 = C，随后栈空
  implication: 直接观测确认：批量关闭的 N 个 tab 全部在栈中，连续 N 次恢复可全部找回（LIFO）；"只恢复了最右侧的"是单次恢复语义的必然结果，不是数据丢失

- timestamp: 2026-07-29T00:04:30Z
  checked: 偏差定位——UAT gap truth（13-UAT.md:76）vs 设计文档
  found: gap truth "应恢复所有刚被批量关闭的标签页"（一次性整批恢复）在设计文档中无任何依据；UI-SPEC:69、DISCUSSION-LOG:64、13-02-PLAN:170、VERIFICATION:130 全部为单条 LIFO。UAT Test 5 原始 expected（:32）也只描述单 tab 恢复
  implication: 根因在需求层：UAT 用户报告引入了新的"整批恢复"期望，与 Phase 13 既定设计冲突。实现无缺陷——需要一个产品决策（保持逐条 LIFO / 改为整批恢复），由 plan-phase --gaps 处理

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 需求/设计层偏差，非实现缺陷。Phase 13 全部设计文档（DISCUSSION-LOG、UI-SPEC、13-02-PLAN、VERIFICATION）定义的恢复语义为"每次操作恢复最近关闭的一个（LIFO 逐条）"；实现与此精确一致：批量关闭时每个 tab 均同步入栈（renderer.js:515→494-498，在首个 await 前；主进程经 notifyClosedTab 镜像），恢复时主进程 popClosedTab() 与渲染进程 closedTabsStack.pop() 各取一条（context-menu-manager.js:372 + renderer.js:1197），栈条目 {containerId,url,title} 无批次标记，也无整批恢复的 IPC 路径。因此批量关闭 N 个后首次恢复只得到最后关闭者（close-right 场景即最右侧 tab）——正是用户观测到的行为。剩余 N-1 个仍在栈中，连续恢复 N 次可全部找回（Node 复现验证）。UAT gap truth"一次性恢复整批"是 UAT 阶段新引入、与设计文档冲突的期望。
fix: （find_root_cause_only 模式，不修复）需产品决策：A) 维持 Chrome 风格逐条 LIFO（现状，符合设计文档）→ 修正 UAT gap truth；B) 改为整批恢复 → 需给栈条目加批次标记（如 batchId，批量关闭时打标），恢复时弹出栈顶同批次全部条目并逐个 createTab，同步更新 UI-SPEC/PLAN
verification: Node 最小复现直接观测：批量关闭 2 tab 后栈=["C","D"]，恢复 1=D、恢复 2=C，LIFO 逐条恢复机制完整无数据丢失
files_changed: []
