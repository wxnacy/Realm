---
status: diagnosed
phase: 27-media-panel
source: [27-VERIFICATION.md]
started: "2026-08-07T18:25:00.000Z"
updated: "2026-08-07T19:00:00.000Z"
---

## Current Test

[testing paused - fixing gaps first]

## Tests

### 1. 浮动面板打开/关闭交互
expected: 点击工具栏媒体按钮时，面板应打开/关闭切换；点击外部关闭；按钮 active 样式正确
result: issue
reported: "1 按钮在面板打开时没有 active 样式。 2 面板打开后，点击网页其他地方没有关闭，只有点击按钮或者关闭才可以关闭"
severity: major

### 2. 媒体列表渲染（类型颜色编码）
expected: 媒体列表正确显示媒体资源；类型徽标（m3u8/mp4/flv/webm）有不同颜色编码；空状态显示提示文字
result: issue
reported: "await window.mediaAPI.getMediaList('xiao') 可以返回数据，但是面板中显示 当前页面未检测到媒体资源"
severity: major

### 3. 播放按钮（新标签页打开）
expected: 点击播放按钮时，在新标签页打开对应媒体 URL
result: blocked
blocked_by: other
reason: "先修复前面的问题吧，后续没法测试（列表无数据，无可播放项）"

### 4. 复制按钮（剪贴板 + 视觉反馈）
expected: 点击复制按钮时，URL 复制到剪贴板；按钮显示勾号 1.5 秒后恢复
result: blocked
blocked_by: other
reason: "先修复前面的问题吧，后续没法测试（列表无数据，无可复制项）"

### 5. 实时徽标更新 + 容器切换重置
expected: 新检测到媒体时，工具栏徽标数量更新；切换容器时，面板重置并重新加载新容器的媒体
result: blocked
blocked_by: other
reason: "先修复前面的问题吧，后续没法测试（依赖列表渲染修复后验证）"

## Summary

total: 5
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 3

## Gaps

- gap_id: G-27-1a
  truth: "按钮在面板打开时应显示 active 样式"
  status: failed
  reason: "User reported: 按钮在面板打开时没有 active 样式"
  severity: major
  test: 1
  root_cause: "CSS 规则缺失：renderer.js:5119 的 classList.toggle('active') 正常执行，但 main.css 中 .media-panel-btn 唯一规则（main.css:5932）只有 position:relative，全文件无 .media-panel-btn.active 变体；对照组 #aiPanelBtn.active（main.css:4766-4769）存在，媒体按钮漏写激活态"
  artifacts:
    - path: "src/styles/main.css:5932"
      issue: ".media-panel-btn 缺 .active 样式规则"
  missing:
    - "仿照 #aiPanelBtn.active（main.css:4766）补 #mediaPanelBtn.active 规则"
  debug_session: .planning/debug/media-panel-interaction.md
- gap_id: G-27-1b
  truth: "点击面板外部应自动关闭面板"
  status: failed
  reason: "User reported: 面板打开后，点击网页其他地方没有关闭，只有点击按钮或者关闭才可以关闭"
  severity: major
  test: 1
  root_cause: "监听目标进程不可达：outside-click 监听挂在宿主 document（renderer.js:3785-3791），但网页内容跑在 <webview> guest 进程（renderer.js:761），guest 内点击事件不冒泡到宿主 document，监听器永远收不到网页区域点击"
  artifacts:
    - path: "src/renderer.js:3785-3791"
      issue: "outside-click 监听器对 webview 内点击静默"
  missing:
    - "换机制：宿主 window blur 时关闭面板，或 webview preload 监听 guest click 经 sendToHost 转发关闭"
  debug_session: .planning/debug/media-panel-interaction.md
- gap_id: G-27-2
  truth: "面板应正确渲染媒体列表（数据存在时）"
  status: failed
  reason: "User reported: await window.mediaAPI.getMediaList('xiao') 可以返回数据，但是面板中显示 当前页面未检测到媒体资源"
  severity: major
  test: 2
  root_cause: "写读容器键不一致：loadMediaList 调 getMediaList() 无参（renderer.js:5133），主进程回退 windowContainerMap（ipc-handlers.js:1296-1299）——该 map 只在建窗和显式切容器时写入，switchTab 跨容器切换不同步（ipc-handlers.js:344-350），缺省返回 'default'（window-manager.js:66-68）→ 查错容器返回 []。写入侧按 webview partition 正确存 'xiao'（renderer.js:928-934）。次生：notifyRenderer（media-sniffer.js:314-333）按同一 stale map 过滤推送，'xiao' 的实时 media:list-updated 也推不到窗口"
  artifacts:
    - path: "src/renderer.js:5133"
      issue: "loadMediaList 调 getMediaList() 缺 containerId 实参"
    - path: "src/ipc-handlers.js:1291-1300"
      issue: "media:get-list 无参回退到不可靠窗口级解析"
    - path: "src/media-sniffer.js:314-333"
      issue: "notifyRenderer 按 stale 窗口容器过滤推送"
    - path: "src/window-manager.js:66-68"
      issue: "getCurrentContainer 缺省返回 default 掩盖 stale"
  missing:
    - "读取侧：loadMediaList 传 state.currentContainer（与写入侧 tab 级语义对齐）"
    - "推送侧：notifyRenderer 广播所有窗口，渲染端按当前容器过滤 payload.containerId；或 tab 切换时同步 windowContainerMap"
  debug_session: .planning/debug/media-panel-empty-list.md
