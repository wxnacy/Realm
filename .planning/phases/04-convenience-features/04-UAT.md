---
status: complete
phase: 04-convenience-features
source:
  - .planning/phases/04-convenience-features/04-01-SUMMARY.md
  - .planning/phases/04-convenience-features/04-02-SUMMARY.md
  - .planning/phases/04-convenience-features/04-03-SUMMARY.md
started: 2026-07-24T14:30:00Z
updated: 2026-07-25T00:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 快捷键功能测试
expected: |
  1. 按 Cmd+T（macOS）或 Ctrl+T（Windows/Linux）新建一个 Tab
  2. 按 Cmd+W（macOS）或 Ctrl+W（Windows/Linux）关闭当前 Tab
result: pass
fix: "已添加 before-input-event 处理器拦截快捷键 (commit 7d27521)，复测通过"

### 2. 快捷键设置立即生效
expected: |
  1. 打开快捷键设置模态框
  2. 修改任意快捷键（如新建 Tab 的快捷键）
  3. 保存后，Toast 消息显示"快捷键已更新"
  4. 立即使用新设置的快捷键，确认功能正常触发
result: pass
fix: "已修复箭头键映射问题 (commit afb4b2a)，复测通过"

### 3. 规则 Toggle 启用/禁用
expected: |
  1. 打开规则管理模态框
  2. 添加一条测试规则（如 google.com → default）
  3. 点击规则右侧的 toggle 开关
  4. toggle 动画切换（关闭态灰蓝色，开启态蓝色）
  5. 刷新页面后，toggle 状态保持
result: pass

### 4. 规则拖拽排序
expected: |
  1. 添加多条测试规则（如 google.com、github.com、stackoverflow.com）
  2. 按住规则左侧的拖拽手柄（⋮⋮ 图标）
  3. 拖拽到其他位置，观察放置指示线（蓝色线条）
  4. 释放后规则顺序更新
  5. 导航到匹配的网站，验证匹配优先级按新顺序执行
result: pass

### 5. 规则导出功能
expected: |
  1. 打开规则管理模态框，确保有至少一条规则
  2. 点击"导出规则"按钮
  3. 系统弹出保存文件对话框
  4. 选择保存位置，确认导出
  5. Toast 提示"已导出 X 条规则"
  6. 检查导出的 JSON 文件，包含所有规则数据
result: pass

### 6. 规则导入功能
expected: |
  1. 准备一个包含规则的 JSON 文件
  2. 打开规则管理模态框
  3. 点击"导入规则"按钮
  4. 选择准备好的 JSON 文件
  5. Toast 提示"已导入 X 条规则"
  6. 规则列表刷新，显示导入的规则
result: pass
fix: "importRules 增加 (containerId, pattern) 去重，renderer Toast 显示跳过数；复测通过"

### 7. 规则导入错误处理
expected: |
  1. 准备一个格式错误的 JSON 文件（如包含无效 containerId）
  2. 打开规则管理模态框
  3. 点击"导入规则"按钮
  4. 选择格式错误的文件
  5. Toast 显示错误提示"导入失败：文件格式不正确"
  6. 现有规则不受影响
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "快捷键 Cmd+T 新建 Tab，Cmd+W 关闭 Tab，自定义快捷键立即生效"
  status: fixed
  reason: "Menu.accelerator 和 before-input-event 方案有兼容性问题，改用 globalShortcut"
  severity: blocker
  test: 1, 2
  artifacts:
    - path: "shortcut-manager.js"
      issue: "Menu.accelerator 在 webview 中不工作，before-input-event 干扰系统快捷键"
  missing:
    - "已修复：改用 globalShortcut 实现全局快捷键"

- truth: "URL 输入框支持粘贴和全选"
  status: fixed
  reason: "before-input-event 处理器干扰了系统快捷键，改用 globalShortcut 后不再需要"
  severity: major
  test: (用户反馈)
  artifacts:
    - path: "shortcut-manager.js"
      issue: "已移除 before-input-event 处理器"
  missing:
    - "已修复：改用 globalShortcut，不再干扰系统快捷键"

- truth: "导入规则时应当对重复规则去重（按 pattern + containerId 判定）"
  status: fixed
  reason: "User reported: 可以导入成功，但是重复的规则没有去重"
  severity: major
  test: 6
  artifacts:
    - path: "assignment-rules.js"
      issue: "importRules 调用 createRule 时不检查 (containerId, pattern) 是否已存在"
    - path: "src/renderer.js"
      issue: "Toast 未区分新增/重复数量"
  missing:
    - "已修复：importRules 内置 existingKeys Set 按 containerId::pattern 去重，返回 skipped 字段；renderer 在 Toast 中显示 '跳过 X 条重复'"
