---
status: investigating
trigger: "vim-keys-no-response: Phase 39 vimium 所有 Vim 快捷键（f hint mode、/ search）在 npm run dev 真实应用中完全无响应"
created: 2026-08-08
updated: 2026-08-08
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: investigating
---

## Current Focus

hypothesis: 【已确认】shortcut-manager.js 从错误的 electron-store 文件读取 vimium.enabled —— 永远得到 false，所有 Vim 按键在 before-input-event 被静默丢弃
test: 代码链路比对 + 磁盘数据文件验证
expecting: realm-config.json 有 vimium.enabled=true 而 settings.json 不存在 —— 已验证
next_action: 返回 ROOT CAUSE FOUND（find_root_cause_only 模式）

## Symptoms

expected: 在任意网页按 f，所有可见链接上出现黄色 hint 标签（#FFB800 背景黑字），输入标签字母后跳转；按 / 页面底部出现搜索栏，输入关键词实时高亮匹配并显示"第 n/N 个匹配"。
actual: 用户原话 "按键没有反应"、"也没有反应，后边估计都不行" —— f 和 / 都没有任何可见效果，疑似整条 Vim 按键链路未生效。
errors: None reported（用户未提供控制台报错，需要主动排查）
reproduction: Test 1 and Test 2 in UAT（npm run dev 启动应用，打开任意网页，按 f 或 /）
started: Discovered during UAT（Phase 39 代码今日刚提交，commits 11517fe/a62acbf/c090681/2aea3ef）

## Eliminated

## Evidence

- timestamp: 2026-08-08
  checked: src/settings-page.js 开关写入路径（saveSettings → settingsApi('update') POST /api/settings/update）
  found: 设置页通过 HTTP API 写设置；main.js:988 `configStore.set('settings.vimium.enabled', value)`，configStore = `new Store({ name: 'realm-config' })`（main.js:50）
  implication: 开关状态落在 realm-config.json 的 `settings.vimium.enabled` 键
- timestamp: 2026-08-08
  checked: shortcut-manager.js Vim 启用检查
  found: line 34 `settingsStore = new Store({ name: 'settings' })`；line 273 `isVimEnabled(settingsStore)`；vimium-manager.js:241 `store.get('vimium.enabled', false)` 默认 false。全仓库仅 shortcut-manager.js 使用 name:'settings' 的 store
  implication: 读取的是另一个文件 settings.json 的另一个键 `vimium.enabled` —— 永远读不到设置页写入的值，恒为 false
- timestamp: 2026-08-08
  checked: 磁盘数据文件 ~/Library/Application Support/realm-dev/
  found: settings.json 文件不存在；realm-config.json 中 `settings.vimium.enabled = true`（用户确实已在设置页打开开关）
  implication: 实证确认 store 文件错配 —— 开关已开但 shortcut-manager 读到 false
- timestamp: 2026-08-08
  checked: 静默丢弃点
  found: shortcut-manager.js:275 `if (!isInternalPage && !isInInput && vimEnabled)` —— vimEnabled=false 时整个 Vim 分支被跳过，按键落到优先级 4 的 Accelerator 匹配，f// 均不命中 → 完全不拦截、无任何动作
  implication: 与"按键没有反应"症状完全吻合（f、/、j/k、yy 等全部失效，无报错）
- timestamp: 2026-08-08
  checked: node --check 全部 Phase 39 相关文件（vimium-manager/shortcut-manager/webview-preload/preload/renderer/settings-page）
  found: ALL_SYNTAX_OK，无加载/语法错误
  implication: 排除假设 5（加载错误）；AND-gate = no，单一根因足以解释全部症状

## Resolution

root_cause: shortcut-manager.js:34 用 `new Store({ name: 'settings' })`（独立文件 settings.json，键 `vimium.enabled`）读取 Vim 开关，而设置页实际写入 main.js 的 configStore（realm-config.json，键 `settings.vimium.enabled`，main.js:988）。两个 store 文件/键路径错配，isVimEnabled 恒为 false，shortcut-manager.js:275 的 Vim 分支永不进入，所有 Vim 按键在 before-input-event 被静默跳过。
fix: （建议方向，未实施）shortcut-manager.js 改为读取与 main.js 相同的 store：`new Store({ name: 'realm-config' })` + 键 `settings.vimium.enabled`（或 vimium-manager.js 的 isVimEnabled/VIM_ENABLED_KEY 同步调整）；注意 dev/test/prod 三环境 userData 隔离不影响此修复
verification: 代码链路 + 磁盘数据双重验证（settings.json 不存在 & realm-config.json enabled=true）
files_changed: []
