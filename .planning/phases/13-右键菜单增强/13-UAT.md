---
status: testing
phase: 13-右键菜单增强
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md]
started: 2026-07-28T00:00:00Z
updated: 2026-07-28T06:00:00Z
---

## Current Test

number: 7
name: 网页通用右键菜单（重验）
expected: |
  在网页空白处右键，菜单应包含：后退/前进/重新加载/强制刷新、复制页面地址、添加到收藏、
  在新标签页打开、在后台打开、查看页面源代码、检查元素、撤销/剪切/复制/粘贴/全选
  （部分项按上下文禁用）—— 不再是只有 5 项的旧菜单。
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出应用后重启，主窗口正常加载，容器列表和 Tab 列表显示正常，控制台无启动错误
result: pass

### 2. Tab 栏右键菜单显示
expected: 在任意 Tab 上右键，弹出原生菜单，包含：关闭标签页、关闭其他标签页、关闭左侧标签页、关闭右侧标签页、重新打开已关闭标签页（无可关闭项时禁用）、固定标签页/取消固定
result: pass

### 3. 通过右键菜单关闭标签页
expected: Tab 右键 → 关闭标签页，该 Tab 立即被关闭，相邻 Tab 自动激活
result: pass

### 4. 关闭其他/左侧/右侧标签页
expected: 在有 3+ 个 Tab 的情况下，右键菜单选择"关闭其他标签页"仅保留当前 Tab；"关闭左侧/右侧标签页"分别关闭对应方向所有 Tab，当前 Tab 保留
result: pass

### 5. 重新打开已关闭标签页
expected: 先关闭一个或多个 Tab，右键其他 Tab → "重新打开已关闭标签页"，每次恢复最近关闭的一个（LIFO，Chrome 风格）；批量关闭的 Tab 可通过连续恢复逐个全部找回
result: pass
resolved-by-decision: 方案 A（原报告"批量关闭后只恢复最右侧一个"系逐条 LIFO 设计的预期行为；2026-07-28 产品决策维持逐条 LIFO，行为符合设计，期望已修正）

### 6. 固定/取消固定标签页（三次重验）
expected: Tab 右键 → 固定标签页，Tab 移到最左侧并显示网站 favicon；再次右键取消固定，标题恢复；**重启应用后仍显示为固定 Tab（40px 宽 + favicon），不是普通 Tab**
result: pass
fix-commit: 7da6df0, 7b5dac3

### 7. 网页通用右键菜单（重验）
expected: 在网页空白处右键，菜单应为：后退/前进/刷新/停止加载（加载中可用）→ 另存为…/打印…/添加到收藏夹 → 查看页面源代码/检查元素 → 剪切/复制/粘贴/全选（按 editFlags 上下文禁用）。另存为可正常保存页面，添加到收藏夹可正常收藏（2026-07-28 用户确认实际菜单结构符合浏览器需求，期望已按实际修正）
result: [pending]
previous-issue: "右键只有检查元素/后退/前进/刷新/复制。差距很大"
fix-commit: 62693d9, a485061

### 8. 图片右键菜单（重验）
expected: 在网页中的图片上右键，菜单顶部应显示图片专属项：图片另存为、复制图片、复制图片地址、在新标签页打开图片；下方为通用菜单项 —— 应与空白处右键菜单明显不同
result: [pending]
previous-issue: "图片右击和空白页右键出现的内容相同，不符合讨论内容"
fix-commit: 62693d9

### 9. 链接右键菜单 + 容器中打开（重验）
expected: 在链接上右键，菜单应含：在新标签页打开链接、在后台标签页打开链接、复制链接地址、添加到收藏、"在容器中打开"子菜单（列出所有容器，选择后链接在指定容器新 Tab 打开）—— 应与空白处右键菜单明显不同
result: [pending]
previous-issue: "链接右击和空白页右键出现的内容相同，不符合讨论内容"
fix-commit: 62693d9

### 10. 文本编辑操作（输入框右键，重验）
expected: 在网页输入框中选中文字后右键，剪切/复制/粘贴/全选按 editFlags 正确启用；未选中文字时剪切/复制应禁用；空输入框粘贴应禁用
result: [pending]
recheck-reason: "editFlags 接线改动（commit a485061）影响此测试路径，需确认未引入回归"

## Summary

total: 10
passed: 6
issues: 0
pending: 4
skipped: 0
blocked: 0
retest-of: [7, 8, 9, 10]

## Gaps

- truth: "重新打开已关闭标签页按 LIFO 逐条恢复最近关闭的 Tab（Chrome 风格，符合设计）"
  status: resolved
  reason: "User reported: 点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
  severity: major
  test: 5
  root_cause: "需求/设计层偏差，非实现缺陷：Phase 13 全部设计文档（DISCUSSION-LOG/UI-SPEC/PLAN/VERIFICATION）定义的恢复语义均为逐条 LIFO（Chrome 风格），实现与设计精确一致。批量关闭的每个 Tab 都正确入栈，剩余 N-1 个仍在栈中，连续恢复可全部找回。2026-07-28 产品决策：方案 A 维持逐条 LIFO，仅修正 UAT 期望，无代码改动"
  resolution: "2026-07-28 决策：方案 A 维持逐条 LIFO，行为符合设计，期望已修正"
  artifacts:
    - path: "src/renderer.js:1182-1200"
      issue: "批量关闭循环 + 单条 pop 恢复（实现正确，符合设计）"
    - path: "context-menu-manager.js:26-63,367-377"
      issue: "主进程栈与单条 pop 恢复（实现正确，符合设计）"
  missing:
    - "无代码改动（方案 A 已决策）；仅需在修复计划中更新 UAT test 5 期望描述为逐条 LIFO 语义"
  debug_session: ".planning/debug/reopen-closed-tabs-batch.md"

- truth: "固定标签页应显示网站图标（favicon）而非仅一个小点"
  status: failed
  reason: "User reported: 固定后样式不好看，标题没有了，只有底部一个小点，应该显示下网站图标"
  severity: major
  test: 6
  root_cause: "favicon 功能从未实现（功能缺失非 regression）：.tab-pinned CSS（commit 186429b）按 DOM 存在 .tab-favicon 元素设计（隐藏标题），但 renderer.js 三处 Tab DOM 创建点均不创建 favicon 元素，webview 无 page-favicon-updated 监听，tab state 不维护 faviconUrl。固定后标题被隐藏、40px 内无内容，唯一可见的是 ::after 伪元素的 4px 底部圆点"
  artifacts:
    - path: "src/renderer.js:380-407,1090-1117,1324-1351"
      issue: "三处 Tab DOM 创建点均无 .tab-favicon 元素；createWebviewForTab 缺 page-favicon-updated 监听"
    - path: "src/styles/main.css:1119-1143"
      issue: ".tab-pinned 规则假设 favicon 存在；无基础 .tab-favicon 样式"
  missing:
    - "createWebviewForTab 添加 page-favicon-updated 监听，存 tab.faviconUrl 并同步 img.src"
    - "三处 DOM 创建点统一加 <img class=\"tab-favicon\">（建议抽公共创建函数）"
    - "补基础 .tab-favicon CSS（16px、flex-shrink:0），.tab-pinned .tab-content 居中"
    - "确认主进程 Tab 持久化透传 faviconUrl（重启后不丢失）"
    - "决定 .tab-pinned .tab-close 策略（Chrome 固定 Tab 无关闭按钮）"
  debug_session: ".planning/debug/pinned-tab-favicon.md"

- truth: "网页通用右键菜单应包含全部 13 项通用菜单项（导航/页面操作/开发者工具/文本编辑）"
  status: failed
  reason: "User reported: 右键只有检查元素/后退/前进/刷新/复制。差距很大"
  severity: major
  test: 7
  root_cause: "main.js:167-178 存在 Phase 13 之前遗留的 webContents 级 context-menu handler（commit 884a58f，经 web-contents-created 注册到所有 webview guest）。右键时旧 handler（主进程同步，直接弹 5 项菜单）与新管线（renderer IPC 往返，buildWebMenu 13+ 项）竞争，旧菜单先弹出，用户永远只看到旧菜单。tests 7/8/9 同根因。新管线本身接线完整无缺陷"
  artifacts:
    - path: "main.js:166-178"
      issue: "遗留 context-menu handler 与新管线竞争，需删除"
    - path: "src/renderer.js:784-799"
      issue: "潜伏缺陷：contextInfo 未发送 editFlags（移除旧 handler 后剪切/复制/粘贴恒禁用）和 pageURL（查看页面源代码会打开空 view-source:）"
  missing:
    - "删除 main.js:166-178 遗留 handler（检查元素功能已被新菜单覆盖）"
    - "renderer.js contextInfo 补发 editFlags（e.params.editFlags 透传 canCut/canCopy/canPaste）和 pageURL（webview.getURL()）"
    - "修复后重验 UAT tests 7/8/9/10"
  debug_session: ".planning/debug/web-context-menu-wrong-items.md"

- truth: "图片上右键应显示图片专属菜单项（图片另存为/复制图片/复制图片地址/在新标签页打开图片）"
  status: failed
  reason: "User reported: 图片右击和空白页右键出现的内容相同，不符合讨论内容"
  severity: major
  test: 8
  root_cause: "同 test 7 根因：main.js:166-178 遗留 handler 不读 mediaType/linkURL，所有类型右键均弹同一 5 项菜单，抢先于新管线。删除遗留 handler 后 buildWebMenu 的 image 分支即可生效"
  artifacts:
    - path: "main.js:166-178"
      issue: "遗留 handler 不区分 mediaType，菜单恒定"
  missing:
    - "删除 main.js:166-178 遗留 handler（随 test 7 修复一并解决）"
  debug_session: ".planning/debug/web-context-menu-wrong-items.md"

- truth: "链接上右键应显示链接专属菜单项（新标签页打开/后台打开/复制链接地址/添加到收藏/在容器中打开子菜单）"
  status: failed
  reason: "User reported: 链接右击和空白页右键出现的内容相同，不符合讨论内容"
  severity: major
  test: 9
  root_cause: "同 test 7 根因：main.js:166-178 遗留 handler 不读 linkURL，链接右键与空白处菜单相同。删除遗留 handler 后 buildWebMenu 的 link 分支（含容器子菜单）即可生效"
  artifacts:
    - path: "main.js:166-178"
      issue: "遗留 handler 不区分 linkURL，菜单恒定"
  missing:
    - "删除 main.js:166-178 遗留 handler（随 test 7 修复一并解决）"
  debug_session: ".planning/debug/web-context-menu-wrong-items.md"
