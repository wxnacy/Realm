---
status: diagnosed
phase: 34-multi-window
source: 34-01-SUMMARY.md, 34-02-SUMMARY.md
started: 2026-08-15T15:40:00Z
updated: 2026-08-15T15:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 应用启动无崩溃
expected: 应用正常启动，不出现闪退或错误弹窗。侧边栏显示容器列表，工具栏正常显示。
result: pass

### 2. 现有 Tab 和容器功能正常
expected: 点击容器切换正常，打开新 Tab 正常，URL 导航正常，页面加载正常。
result: pass

### 3. 现有快捷键仍正常工作
expected: Cmd+T 新建 Tab、Cmd+W 关闭 Tab、Cmd+L 聚焦地址栏等现有快捷键正常响应。
result: issue
reported: "Cmd+L 聚焦地址栏 没有反应"
severity: major

### 4. Cmd+W 关闭最后一个 Tab 时窗口关闭
expected: 当窗口只有一个 Tab 时，按 Cmd+W 关闭该 Tab 后窗口正常关闭（或保留窗口显示新标签页，取决于现有行为）。
result: pass

### 5. Cmd+N 新建窗口（Plan 03 未完成）
expected: 按 Cmd+N 创建新窗口，新窗口加载完整界面，使用默认容器，显示新标签页。
result: blocked
blocked_by: prior-phase
reason: "Plan 03 (Dock 菜单 + main.js 集成) 尚未执行，newWindow 快捷键未接通实际窗口创建逻辑"

### 6. Cmd+Shift+W 关闭窗口（Plan 03 未完成）
expected: 按 Cmd+Shift+W 关闭当前焦点窗口，不影响其他窗口。
result: blocked
blocked_by: prior-phase
reason: "Plan 03 (Dock 菜单 + main.js 集成) 尚未执行，closeWindow 快捷键未接通实际窗口关闭逻辑"

### 7. Dock 右键"新建窗口"（Plan 03 未完成）
expected: 右键点击 Dock 图标，选择"新建窗口"创建第二个窗口。
result: blocked
blocked_by: prior-phase
reason: "Plan 03 (Dock 菜单 + main.js 集成) 尚未执行，Dock 菜单未添加"

### 8. App Menu 新建/关闭窗口（Plan 03 未完成）
expected: File 菜单显示"新建窗口 ⌘N"和"关闭窗口 ⇧⌘W"选项，点击可执行对应操作。
result: blocked
blocked_by: prior-phase
reason: "Plan 03 (Dock 菜单 + main.js 集成) 尚未执行，App Menu 未更新"

### 9. 多窗口焦点切换（Plan 03 未完成）
expected: 多个窗口存在时，点击不同窗口切换焦点，工具栏和 Tab 栏正确响应。
result: blocked
blocked_by: prior-phase
reason: "Plan 03 (Dock 菜单 + main.js 集成) 尚未执行，无法创建多窗口"

### 10. 首次启动 Cmd+W 关闭标签时窗口异常关闭
expected: 有多个标签时，Cmd+W 只关闭当前标签，窗口保持打开。
result: issue
reported: "每次第一次启动，cmd+w 关闭标签时，即使还有很多标签，窗口也会自动关闭。再次从dock点开应用时所有标签会自动打开，再次关闭标签就正常了。"
severity: blocker

## Summary

total: 10
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 5

## Gaps

- truth: "Cmd+L 聚焦地址栏正常响应"
  status: failed
  reason: "User reported: Cmd+L 聚焦地址栏 没有反应"
  severity: major
  test: 3
  root_cause: "focusUrl 快捷键 (Cmd+L) 从未在 shortcut-manager.js DEFAULT_SHORTCUTS 中定义，也未在 renderer.js initShortcuts 中添加处理逻辑。这是缺失功能，非 Phase 34 回归。"
  artifacts:
    - path: "shortcut-manager.js"
      issue: "DEFAULT_SHORTCUTS 缺少 'focusUrl': 'CmdOrCtrl+L' 定义"
    - path: "src/renderer.js"
      issue: "initShortcuts 缺少 case 'focusUrl' 处理逻辑"
  missing:
    - "在 shortcut-manager.js DEFAULT_SHORTCUTS 添加 'focusUrl': 'CmdOrCtrl+L'"
    - "在 src/renderer.js initShortcuts 添加 case 'focusUrl': elements.urlInput.focus(); elements.urlInput.select(); break;"

- truth: "首次启动时 Cmd+W 只关闭当前标签，窗口保持打开"
  status: failed
  reason: "User reported: 每次第一次启动，cmd+w 关闭标签时，即使还有很多标签，窗口也会自动关闭。再次从dock点开应用时所有标签会自动打开，再次关闭标签就正常了。"
  severity: blocker
  test: 10
  root_cause: "初始化顺序错误：main.js 中 createMainWindow() 在 shortcutManager.registerShortcuts() 之前调用。registerShortcuts() 设置的 web-contents-created 监听器只对之后创建的 webContents 生效，导致首次启动时主窗口没有快捷键监听器，Electron 默认的 Cmd+W 关闭窗口行为触发。"
  artifacts:
    - path: "main.js"
      issue: "第2510行 createMainWindow() 在第2519行 registerShortcuts() 之前调用，主窗口 webContents 未挂载快捷键监听器"
    - path: "shortcut-manager.js"
      issue: "ensureAppListener() 只监听 web-contents-created 事件，不影响已存在的 webContents"
  missing:
    - "将 shortcutManager.registerShortcuts() 移到 createMainWindow() 之前，或者在 createMainWindow() 之后手动对主窗口 webContents 调用 attachInputListener()"
    - "或者在 registerShortcuts() 中添加对已存在窗口的处理逻辑"
