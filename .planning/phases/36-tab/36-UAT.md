---
status: testing
phase: 36-tab
source: [36-01-PLAN.md, 36-02-PLAN.md, 36-03-PLAN.md]
started: 2026-08-16T10:00:00.000Z
updated: 2026-08-16T12:00:00.000Z
---

## Current Test

number: 4
name: 窗口内 Tab 拖拽排序（修复后重测）
expected: |
  创建 3 个以上 Tab，拖拽第一个 Tab 到第三个 Tab 右侧，验证第一次点击即可拖拽
awaiting: user response

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
result: issue
reported: "可以移动位置。但也有个问题，经常第一次点击拖动tab不生效，需要再次点击，移动时才能看到另外两个标签中的亮线"
severity: major

### 5. Tab 拖拽边界处理
expected: 拖拽 Tab 到 Tab 栏之外，验证不显示指示器；拖拽 Tab 到原位置，验证不显示指示器
result: pass

### 6. 跨窗口拖拽创建新窗口
expected: 拖拽 Tab 出标签栏，验证浮动预览显示，在窗口内松手验证新窗口创建
result: issue
reported: "没有新建窗口"
severity: major

### 7. 跨窗口 Tab 移动
expected: 创建两个窗口，拖拽窗口 A 的 Tab 到窗口 B 的 Tab 栏，验证 Tab 移动成功
result: issue
reported: "没有成功移动"
severity: major

### 8. 源窗口自动销毁
expected: 跨窗口移动 Tab 后，如果源窗口仅剩一个 Tab，验证源窗口自动销毁
result: skipped
reason: 跨窗口拖拽功能未实现，无法测试

## Summary

total: 8
passed: 4
issues: 0
pending: 3
skipped: 1
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
  reason: "用户报告: 经常第一次点击拖动tab不生效"
  severity: major
  test: 4
  root_cause: "mousedown 设置 crossDragTabId 后，dragstart 不阻止 HTML5 DnD"
  artifacts:
    - path: "src/renderer.js"
      issue: "dragstart 只检查 state.crossDrag.active，不检查 crossDragTabId"
  fix: "添加 isCrossDragPending() 函数，dragstart 中同时检查 active 和 pending 状态"

- truth: "拖拽 Tab 出标签栏后松手创建新窗口"
  status: fixed
  reason: "用户报告: 没有新建窗口"
  severity: major
  test: 6
  root_cause: "createMainWindow 没有使用 offsetPosition 选项"
  artifacts:
    - path: "drag-coordinator.js"
      issue: "endDrag 中 createMainWindow 调用没有 offsetPosition 选项"
  fix: "添加 { offsetPosition: true } 选项"

- truth: "跨窗口拖拽 Tab 可以移动到另一个窗口"
  status: fixed
  reason: "用户报告: 没有成功移动"
  severity: major
  test: 7
  root_cause: "updateTab 不支持 windowId 字段"
  artifacts:
    - path: "tab-manager.js"
      issue: "updateTab 没有处理 windowId 字段"
  fix: "添加 if (updates.windowId !== undefined) tab.windowId = updates.windowId"
