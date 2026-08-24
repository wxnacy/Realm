---
status: diagnosed
phase: 39-vimium
source: [39-01-SUMMARY.md, 39-02-SUMMARY.md, 39-03-SUMMARY.md]
started: 2026-08-24T03:49:35Z
updated: 2026-08-24T04:06:17Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 4 items outstanding, 2 issues reported, 用户要求先排查根因]

## Tests

### 1. Hint Mode 链接跟随（f/F/yf）
expected: 在任意网页按 f，所有可见链接上出现黄色 hint 标签（#FFB800 背景黑字）；输入标签字母后跳转到该链接；F 在新标签打开；yf 复制链接 URL 到剪贴板。（前置：npm run dev 启动，设置页开启 Vim 模式）
result: issue
reported: "按键没有反应"
severity: major

### 2. 搜索模式（/n/N）
expected: 按 / 页面底部出现搜索栏；输入关键词实时高亮匹配并显示"第 n/N 个匹配"；Enter 确认后按 n 跳到下一个、N 跳到上一个匹配；Esc 退出搜索模式。
result: issue
reported: "也没有反应，后边估计都不行，先排查下吧"
severity: major

### 3. 复制当前 URL（yy）
expected: 在任意网页按 yy，当前页面 URL 被复制到剪贴板，粘贴验证内容正确。
result: [pending]

### 4. 标签增强命令（yt/W/gs）
expected: 按 yt 复制当前标签（出现一个相同的新标签）；按 W 将当前标签移动到新窗口；按 gs 打开页面源码视图。
result: [pending]

### 5. Hint 命令回传通路（sendVimCommand 桥接）
expected: Hint Mode 中输入 hint 字母后页面实际发生跳转/新标签打开/复制动作，证明 webview guest → renderer 的命令回传链路工作（ rationale: 39-02 D5，桥接无独立自动化验证）。
result: [pending]

### 6. searchActive 状态同步
expected: 搜索模式激活时 n/N 执行匹配跳转；按 Esc 退出搜索后再按 n，不再触发搜索导航（n 恢复无映射），证明 renderer ↔ 主进程 VimStateMachine 的 searchActive 双向同步正确（rationale: 39-02 D6）。
result: [pending]

### 7. Vim 状态机和命令映射（VimStateMachine）
expected: Vim 状态机和命令映射（VimStateMachine）
result: pass
source: automated
coverage_id: 39-01-D1

### 8. 页面滚动命令（j/k/h/l/d/u/gg/G）
expected: 页面滚动命令（j/k/h/l/d/u/gg/G）
result: pass
source: automated
coverage_id: 39-01-D2

### 9. 标签管理命令（x/X/t/gt/gT/g0/g$/^）
expected: 标签管理命令（x/X/t/gt/gT/g0/g$/^）
result: pass
source: automated
coverage_id: 39-01-D3

### 10. 浏览导航命令（H/L/r/R）
expected: 浏览导航命令（H/L/r/R）
result: pass
source: automated
coverage_id: 39-01-D4

### 11. 焦点检测（输入框中禁用 Vim 快捷键）
expected: 焦点检测（输入框中禁用 Vim 快捷键）
result: pass
source: automated
coverage_id: 39-01-D5

### 12. Alt+P 固定标签
expected: Alt+P 固定标签
result: pass
source: automated
coverage_id: 39-01-D6

### 13. Settings 页面 Vim 模式配置（侧边栏入口、启用开关、快捷键说明表格）
expected: Settings 页面 Vim 模式配置（侧边栏入口、启用开关、快捷键说明表格）
result: pass
source: automated
coverage_id: 39-03-D1

### 14. 快捷键帮助对话框（按 ? 显示、Escape 关闭、分类展示所有快捷键）
expected: 快捷键帮助对话框（按 ? 显示、Escape 关闭、分类展示所有快捷键）
result: pass
source: automated
coverage_id: 39-03-D2

## Summary

total: 14
passed: 8
issues: 2
pending: 4
skipped: 0

## Gaps

- gap_id: G-39-1
  truth: "在任意网页按 f，所有可见链接上出现黄色 hint 标签；输入标签字母后跳转；F 新标签打开；yf 复制链接 URL"
  status: failed
  reason: "User reported: 按键没有反应"
  severity: major
  test: 1
  root_cause: "vimium.enabled 读写两侧 store 错配：设置页写入 realm-config.json 的 settings.vimium.enabled（main.js:988），而 shortcut-manager.js:34 读独立 settings.json 的 vimium.enabled（恒 false），before-input-event 在 :275 静默丢弃所有 Vim 按键"
  artifacts:
    - path: "shortcut-manager.js"
      issue: ":34 store 实例 name:'settings' 错误；:273 读取点；:275 静默丢弃点"
    - path: "src/vimium/vimium-manager.js"
      issue: ":21 VIM_ENABLED_KEY='vimium.enabled' 与实际存储键 settings.vimium.enabled 不匹配，:241 默认 false"
    - path: "main.js"
      issue: ":50,:988 实际写入位置 realm-config.json settings.vimium.enabled（正确侧参照）"
  missing:
    - "shortcut-manager 改读 realm-config store 且键为 settings.vimium.enabled"
    - "Alt+P 分支（shortcut-manager.js:253）与 vim:get-enabled IPC（:418）共用读取一并修复"
    - "修复后真实环境复核下游链路（hint 注入、vim:focus-state guestId 上报）"
  debug_session: .planning/debug/vim-keys-no-response.md
- gap_id: G-39-2
  truth: "按 / 页面底部出现搜索栏；输入关键词实时高亮匹配并显示计数；Enter 后 n/N 跳转匹配；Esc 退出"
  status: failed
  reason: "User reported: 也没有反应，后边估计都不行，先排查下吧"
  severity: major
  test: 2
  root_cause: "同 G-39-1 单根因：shortcut-manager.js:275 vimEnabled 恒 false 导致所有 Vim 按键（含 /）在 before-input-event 被静默跳过"
  artifacts:
    - path: "shortcut-manager.js"
      issue: ":34 store 实例 name:'settings' 错误；:275 静默丢弃点"
    - path: "src/vimium/vimium-manager.js"
      issue: ":241 isVimEnabled 默认 false 且键路径错配"
  missing:
    - "同 G-39-1 的 store/键路径修复"
  debug_session: .planning/debug/vim-keys-no-response.md
