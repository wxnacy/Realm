---
status: complete
phase: 36-tab
source: [36-01-PLAN.md, 36-02-PLAN.md, 36-03-PLAN.md]
started: 2026-08-16T10:00:00.000Z
updated: 2026-08-16T14:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. 窗口位置持久化
expected: 启动应用，移动窗口到非默认位置，关闭并重启，验证窗口位置恢复
result: pass

### 2. 越界窗口恢复
expected: 将窗口移动到屏幕边缘，断开外接显示器（如果有），重启应用，验证窗口居中到主显示器
result: pass

### 3. 右键菜单"在新窗口中打开"
expected: 创建多个 Tab，右键点击某个 Tab，选择"在新窗口中打开"，验证新窗口创建并包含该 Tab
result: pass

### 4. 窗口内 Tab 拖拽排序
expected: 创建 3 个以上 Tab，拖拽第一个 Tab 到第三个 Tab 右侧，验证指示器显示和顺序更新
result: pass
verified: "自动化验证：首次拖拽指示器即显示（early/mid 均 true），排序生效（tab 从 0 → 2）"
severity: major

### 5. Tab 拖拽边界处理
expected: 拖拽 Tab 到 Tab 栏之外，验证不显示指示器；拖拽 Tab 到原位置，验证不显示指示器
result: pass

### 6. 跨窗口拖拽创建新窗口
expected: 拖拽 Tab 出标签栏，验证浮动预览显示，在窗口内松手验证新窗口创建
result: pass
verified: "自动化验证：动作=new-window，窗口数 1 → 2，源窗口已移除该 Tab"
severity: major

### 7. 跨窗口 Tab 移动
expected: 创建两个窗口，拖拽窗口 A 的 Tab 到窗口 B 的 Tab 栏，验证 Tab 移动成功
result: pass
verified: "自动化验证：动作=move-to-window，A 2 → 1，B 1 → 2，B 包含该 Tab"
severity: major

### 8. 源窗口自动销毁
expected: 跨窗口移动 Tab 后，如果源窗口仅剩一个 Tab，验证源窗口自动销毁
result: pass
verified: "自动化验证：A 最后 Tab 移出后日志'源窗口 1 已无 Tab，自动销毁'，窗口 A 销毁，B 最终 3 Tab"

### 9. 多窗口关尽 Tab 销毁窗口
expected: 多窗口时关闭某窗口全部 Tab，验证该窗口销毁；单窗口时关尽 Tab 应保持窗口并新建 Tab（回归）
result: pass
verified: "自动化验证：B 关尽 Tab 后'窗口 2 已关闭（含所有 Tab）'，窗口数 2 → 1；单窗口关尽后新建 Tab，窗口数保持 1"

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "右键菜单'在新窗口中打开'只打开指定的 Tab，不复制其他 Tab"
  status: fixed
  reason: "用户报告: 不光复制了指定的标签，全部标签页都复制了"
  severity: major
  test: 3
  root_cause: "tab:list IPC 返回所有窗口的 Tab，且时序问题导致 restoreTabs 创建额外 Tab"
  artifacts:
    - path: "ipc-handlers.js"
      issue: "tab:list 处理器调用 getTabs() 返回所有 Tab; tab:open-in-new-window 时序问题"
  fix: "1. tab:list 改用 getTabsByWindowId(win.id) 2. 等待 did-finish-load 后关闭 restoreTabs 创建的 Tab 再创建源 Tab"

- truth: "新窗口位置与原窗口有错位，不完全重合"
  status: fixed
  reason: "用户报告: 新建的窗口应该和原窗口位置有一定错位"
  severity: minor
  test: 3
  root_cause: "createMainWindow 没有位置偏移逻辑"
  artifacts:
    - path: "window-manager.js"
      issue: "createMainWindow 没有 offsetPosition 选项"
  fix: "添加 offsetPosition 选项，新窗口相对于当前活动窗口偏移 30px"

- truth: "Tab 拖拽排序第一次点击即可生效"
  status: fixed
  reason: "用户报告: 第一次点击拖动tab不生效，需要第二次才行"
  severity: major
  test: 4
  root_cause: "HTML5 DnD 与自定义 mousedown/mousemove/mouseup 两套拖拽机制竞争：dragstart 触发时机与 5px 激活阈值存在竞争，且 HTML5 拖拽会话期间 mousemove 停发导致跨窗口管线饿死，两套机制互相干扰"
  artifacts:
    - path: "src/renderer.js"
      issue: "createTabElement 的 dragstart/dragend 与 initTabDragAndDrop 的 mousedown 管线冲突"
  fix: "方案 A：移除 Tab 的 HTML5 DnD（draggable），窗口内排序并入自定义鼠标事件统一管线——激活后按 clientY 判断在 Tab 栏内显示插入指示器（computeInsertTarget/reorderTabLocal），栏外显示浮动预览；mouseup 按位置执行排序/新窗口/跨窗口移动；拖拽后抑制一次 click 防误切换"

- truth: "拖拽 Tab 出标签栏后松手创建新窗口"
  status: fixed
  reason: "用户报告: 没有新建窗口"
  severity: major
  test: 6
  root_cause: "双层根因：① preload.js 中 startDrag/updateDragPosition/endDrag/cancelDrag/onDragStateChanged 被错误嵌套进 addressAPI 对象，window.realmAPI.startDrag 为 undefined，跨窗口管线从未真正激活；② mousemove 位置上报有 50ms 节流，快速拖出松手时末尾移动被丢弃，outOfTabBar 停留在过期的 false"
  artifacts:
    - path: "src/preload.js"
      issue: "拖拽 API 嵌套在 addressAPI 内（1134-1176 行），realmAPI 顶层无这些方法"
    - path: "src/renderer.js"
      issue: "onCrossDragMouseUp 依赖节流残留的 state.crossDrag.outOfTabBar"
  fix: "① preload 拖拽 API 上移至 realmAPI 顶层；② mouseup 时先强制 updateDragPosition 补报最终位置再判断动作（drag-coordinator 侧此前的 offsetPosition 修复保留）"

- truth: "跨窗口拖拽 Tab 可以移动到另一个窗口"
  status: fixed
  reason: "用户报告: 没有成功移动"
  severity: major
  test: 7
  root_cause: "同问题 6 根因①：preload API 嵌套错误导致 endDrag 从未可达（updateTab windowId 支持此前已修复）"
  artifacts:
    - path: "src/preload.js"
      issue: "endDrag 嵌套在 addressAPI 内"
  fix: "同问题 6 修复①②"

- truth: "源窗口最后 Tab 移出后自动销毁"
  status: fixed
  reason: "跨窗口移动修复后可测，暴露 windowId 归属问题"
  severity: major
  test: 8
  root_cause: "tab:create IPC 未传 windowId，所有 renderer 创建的 Tab windowId=null，getTabsByWindowId 严格匹配导致：tab:list 漏算、move-to-window 后'源窗口剩余 Tab 数'误判为 0，还有 Tab 的窗口被提前销毁"
  artifacts:
    - path: "ipc-handlers.js"
      issue: "tab:create 调用 tabManager.createTab(containerId, url) 缺 windowId 参数"
    - path: "tab-manager.js"
      issue: "历史 windowId=null 数据无迁移路径"
  fix: "① tab:create 从 event.sender 取窗口 ID 传入；② tab-manager 新增 migrateWindowlessTabs，main.js 创建主窗口后调用，将历史 null 窗口 Tab 归属主窗口（避免正式环境升级后旧 Tab 消失）"

- truth: "多窗口时关闭某窗口全部 Tab 应销毁该窗口"
  status: fixed
  reason: "用户报告: 有多个窗口时，将一个窗口的标签都关闭后没有关闭这个窗口"
  severity: major
  test: 9
  root_cause: "renderer closeTab 在窗口无剩余 Tab 时无条件 createTab 兜底，从未考虑多窗口场景"
  artifacts:
    - path: "src/renderer.js"
      issue: "closeTab 无 Tab 时总是 createTab"
    - path: "ipc-handlers.js"
      issue: "tab:close 未处理 lastInWindow 的多窗口语义"
  fix: "tab:close 在 lastInWindow 且窗口数 > 1 时标记 windowClosed 并 setImmediate 销毁窗口（先回响应再销毁）；renderer 据 windowClosed 跳过 createTab 兜底；单窗口行为不变（仍新建 Tab）。同时修复迁移漏洞：migrateWindowlessTabs 扩展收编 windowId 指向已失效窗口的 Tab——上次会话多窗口 Tab 残留 store，重启后窗口 ID 复用会被新窗口'撞号'认领（测试中发现 B 窗口多出尸体 Tab）"
