---
status: diagnosed
phase: 13-右键菜单增强
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md]
started: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:35:00Z
---

## Current Test

[testing complete]

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
expected: 先关闭一个 Tab（记住其 URL），再右键其他 Tab → "重新打开已关闭标签页"，关闭的 Tab 在原容器中以原 URL 恢复
result: issue
reported: "点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
severity: major

### 6. 固定/取消固定标签页
expected: Tab 右键 → 固定标签页，该 Tab 移到 Tab 栏最左侧（带 .tab-pinned class 标识）；再次右键 → 取消固定，Tab 回到普通位置
result: issue
reported: "固定后样式不好看，标题没有了，只有底部一个小点，应该显示下网站图标"
severity: major

### 7. 网页通用右键菜单
expected: 在网页空白处右键，弹出菜单含：后退/前进/重新加载/强制刷新、复制页面地址、添加到收藏、在新标签页打开、在后台打开、检查元素、查看页面源代码、撤销/剪切/复制/粘贴/全选（部分项按上下文禁用）
result: issue
reported: "右键只有检查元素/后退/前进/刷新/复制。差距很大"
severity: major

### 8. 图片右键菜单
expected: 在网页中的图片上右键，菜单顶部显示图片专属项：图片另存为、复制图片、复制图片地址、在新标签页打开图片；下方为通用菜单项
result: issue
reported: "图片右击和空白页右键出现的内容相同，不符合讨论内容"
severity: major

### 9. 链接右键菜单 + 容器中打开
expected: 在链接上右键，菜单含：在新标签页打开链接、在后台标签页打开链接、复制链接地址、添加到收藏、"在容器中打开"子菜单（列出所有容器，选择后链接在指定容器的新 Tab 中打开）
result: issue
reported: "链接右击和空白页右键出现的内容相同，不符合讨论内容"
severity: major

### 10. 文本编辑操作（输入框右键）
expected: 在网页输入框中选中文字后右键，剪切/复制/粘贴/全选可用并正常工作（使用 execCommand 白名单）
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "重新打开已关闭标签页应恢复所有刚被批量关闭的标签页"
  status: failed
  reason: "User reported: 点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
  severity: major
  test: 5
  root_cause: "需求/设计层偏差，非实现缺陷：Phase 13 全部设计文档（DISCUSSION-LOG/UI-SPEC/PLAN/VERIFICATION）定义的恢复语义均为逐条 LIFO（Chrome 风格），实现与设计精确一致。批量关闭的每个 Tab 都正确入栈，剩余 N-1 个仍在栈中，连续恢复可全部找回。UAT gap truth 与设计文档冲突，需产品决策：A) 维持逐条 LIFO 仅修正 UAT truth；B) 栈条目加 batchId 实现整批恢复"
  artifacts:
    - path: "src/renderer.js:1182-1200"
      issue: "批量关闭循环 + 单条 pop 恢复（实现正确，符合设计）"
    - path: "context-menu-manager.js:26-63,367-377"
      issue: "主进程栈与单条 pop 恢复（实现正确，符合设计）"
  missing:
    - "产品决策：逐条 LIFO（方案A）vs 整批恢复（方案B，栈条目加 batchId）"
    - "若选方案A：修正 UAT gap truth，无代码改动"
    - "若选方案B：栈条目加批次标记 + 整批恢复 IPC + 更新 UI-SPEC/PLAN/VERIFICATION"
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
