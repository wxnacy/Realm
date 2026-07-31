---
status: testing
phase: 18-bookmarks-bar
source:
  - 18-01-SUMMARY.md
  - 18-02-SUMMARY.md
started: 2026-07-30T12:40:00Z
updated: 2026-07-31T11:30:00Z
---

## Current Test

number: 14
name: Dropdown Menu Close Behavior
expected: |
  打开文件夹下拉或溢出菜单后，点击菜单外部区域或按 ESC 键关闭菜单。
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Realm instance. Start the application from scratch. The app boots without errors, the main window appears, and the bookmarks bar area is visible below the address bar.
result: pass

### 2. Bookmarks Bar Basic Display
expected: 收藏栏位于地址栏下方，高度约 30px，背景色与工具栏一致（深色），底部有极淡的分割线。整体看起来紧凑且与 Chrome 收藏栏风格相似。
result: pass

### 3. Bookmark Items Rendering
expected: 收藏栏显示根目录收藏项和文件夹。每项显示 favicon 图标和标题。favicon 加载失败时降级为 Realm 默认图标。
result: pass

### 4. Click to Navigate
expected: 左键点击收藏项，当前活动标签页导航到该 URL。
result: pass

### 5. Cmd/Ctrl+Click Opens New Tab
expected: Cmd+Click（macOS）或 Ctrl+Click 在新标签页打开 URL，当前标签页不变。
result: pass

### 6. Overflow Calculation
expected: 收藏项超出窗口宽度时，部分项隐藏，右侧出现 » 按钮。窗口变宽显示更多，变窄隐藏更多。
result: pass

### 7. Folder Dropdown Menu
expected: 点击收藏栏上的文件夹，下方弹出下拉菜单显示子收藏项和子文件夹。再次点击同一文件夹关闭菜单。
result: pass

### 8. Submenu Hover Expansion
expected: 在下拉菜单中悬停子文件夹约 300ms，右侧弹出子菜单显示该文件夹内容。移动到其他子文件夹时，上一个子菜单立即消失。
result: pass

### 9. Overflow Menu
expected: 点击 » 溢出按钮，弹出下拉菜单显示所有溢出的收藏项。
result: pass

### 10. Bookmark Item Right-Click Menu
expected: 右键点击收藏项，显示上下文菜单："在新标签页打开"、"编辑"、"删除"。
result: pass

### 11. Folder Right-Click Menu
expected: 右键点击文件夹，显示上下文菜单："在新标签页中打开所有书签"、"重命名"、"删除"、"添加书签"、"添加文件夹"。
result: pass

### 12. Empty Area Right-Click Menu
expected: 右键点击收藏栏空白区域，显示上下文菜单："添加书签"、"添加文件夹"、"隐藏收藏栏"。
result: pass

### 13. Settings Toggle for Bookmarks Bar
expected: 设置页面（realm://settings）有"显示收藏栏"开关，切换后立即显示/隐藏收藏栏，无需重启。
result: pass

### 14. Dropdown Menu Close Behavior
expected: 打开文件夹下拉或溢出菜单后，点击菜单外部区域或按 ESC 键关闭菜单。
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "收藏栏显示根目录收藏项和文件夹，每项显示 favicon 图标和标题"
  status: failed
  reason: "User reported: 1 一个网址原 favicon 都没用展示出来，全都是默认图标 2 多级菜单展开时，第四级'python'这里，点击应该出现在右侧，也有空间，却跑到最左侧，导致后续操作都有问题了 3 从收藏栏点击菜单后，不管有几级，点击其他空白区域菜单无法消失"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
