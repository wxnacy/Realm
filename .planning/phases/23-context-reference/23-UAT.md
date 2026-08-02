---
status: complete
phase: 23-context-reference
source: [23-01-SUMMARY.md, 23-02-SUMMARY.md]
started: 2026-08-02T09:38:32Z
updated: "2026-08-02T12:45:14Z"
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. 冷启动冒烟测试

expected: 完全退出应用，重新 `npm run dev` 启动。应用正常启动无报错（终端无 nodejieba 原生模块加载错误、无 FTS5 索引构建错误），收藏功能正常，AI 面板可打开。
result: pass

### 2. @ 触发标签页选择面板

expected: 在 AI 聊天输入框输入 `@`，浮动面板出现在输入框上方，列出所有容器的所有打开标签页（每行：容器颜色圆点 + 容器名 + 标签页标题），面板内搜索框自动获得焦点。
result: pass
note: "初次失败（G-23-2 CSS 定位），修复后用户确认列表可出现"

### 3. 面板搜索过滤

expected: 面板打开时在搜索框输入关键词，标签页列表实时过滤（匹配标题和 URL）；输入无匹配的关键词时显示「未找到匹配的标签页」空状态。
result: pass

### 4. 多选标签页生成 Pill

expected: 点击多个标签页行可切换选中（选中行蓝色高亮 + 勾选图标），输入框上方出现对应 Pill（容器颜色圆点 + 标题 + × 关闭按钮）。
result: pass
note: "初次发现 @ 残留（G-23-4），修复后复测通过：@ 自动清除，多选与 Pill 正常"

### 5. 面板关闭与 Pill 移除

expected: 按 Escape 或点击面板外部可关闭面板；点击 Pill 上的 × 按钮可移除该引用，Pill 行即时更新。
result: pass

### 6. 带引用发送消息（页面内容注入）

expected: 选中 1-2 个标签页后发送「总结这个页面的内容」，AI 回复能体现被引用页面的实际内容（具体细节，而非泛泛回答或报错）。
result: pass
note: "两轮修复（G-23-6：命名空间死代码、提取脚本、webview 映射、提示词加固）后复测通过：气泡带引用标记，AI 直接基于引用内容回答，未导航当前标签"

### 7. 中文收藏全文搜索

expected: 让 AI 用中文关键词搜索收藏（如「搜索我收藏的关于 xx 的内容」），AI 调用 search_favorites_fulltext 工具并返回语义相关的中文收藏结果；搜索不存在的词时友好提示未找到。
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-23-2
  truth: "在 AI 聊天输入框输入 `@` 应弹出标签页选择浮动面板（列出所有容器标签页，搜索框自动聚焦）"
  status: resolved
  reason: "User reported: 输入 @ 没有任何反应"
  severity: major
  test: 2
  root_cause: ".context-picker-panel 为 absolute + bottom:100%，但父级 .ai-input-area 无 position，包含块上溯到 .ai-panel(relative)，面板被渲染到 AI 面板顶边之上并被其 overflow:hidden 裁剪——JS 已打开面板但视觉不可见"
  artifacts:
    - path: "src/styles/main.css"
      issue: ".ai-input-area 缺少 position: relative（~line 4280）"
  missing:
    - "为 .ai-input-area 添加 position: relative，使面板锚定输入框上方（per UI-SPEC 定位约定）"
  resolved_by: "inline fix: main.css .ai-input-area + position: relative"
  resolved_at: 2026-08-02
- gap_id: G-23-4
  truth: "选中标签页后输入框中的 @ 触发符应被清理，不留残留字符"
  status: failed
  reason: "User reported: 选中标签后 @ 符号残留未清理，下次还得手动删除再重新输入"
  severity: minor
  test: 4
  root_cause: "handleAIInputAutoResize 打开面板时未移除触发字符 @，且以 value.includes('@') 作为面板存续哨兵，导致 @ 必须残留"
  artifacts:
    - path: "src/renderer.js"
      issue: "handleAIInputAutoResize 打开分支缺少触发符清理（~line 4086）"
  missing:
    - "打开面板时从 input.value 移除末尾 @"
  fix_applied: "renderer.js 打开面板时 input.value = value.slice(0, -1)"
  resolved_by: "inline fix: renderer.js @ 触发符清理"
  resolved_at: 2026-08-02
- gap_id: G-23-6
  truth: "带 @ 引用发送消息时，被引用标签页的正文内容应注入 AI 上下文，AI 基于引用内容回答；发送气泡应显示引用标记；AI 不得为读取内容而导航当前标签页"
  status: failed
  reason: "User reported: 选中两个标签后发送查看网页内容，上下文没有带上两个标签的内容，AI 还是只查看了当前标签；复测补充：气泡无引用标记；AI 用 open_link newTab:false 把当前标签导航走去读页面，破坏当前页面"
  severity: major
  test: 6
  root_cause: "四层 bug：(1) preload promptWithContext 在 ai: 命名空间，renderer 守卫查顶层 undefined → 带上下文分支死代码（已修）；(2) 提取脚本非 async 函数用 await + fetch 相对路径解析到 guest 站点 404 + eval 被 CSP 拦截（已修）；(3) 最深根因——extractReferencedTabsContent 用 wv.dataset.tabId 建 webview 映射，但 webview 元素从未设置 data-tab-id（只有 tab 标签栏元素设置了），映射恒为空 → content 恒 ''；(4) REALM_SYSTEM_PROMPT 未禁止 AI 为读内容而导航当前标签，内容为空时 AI 滥用 open_link newTab:false"
  artifacts:
    - path: "src/renderer.js"
      issue: "extractReferencedTabsContent webview 映射源错误；handleSendAIMessage 未把引用附加到用户消息"
    - path: "ai-manager.js"
      issue: "系统提示词缺少破坏性导航禁令"
  missing:
    - "改用 state.webviews（tabId→webview 权威 Map）替代 DOM dataset 查询"
    - "用户气泡渲染引用标记（彩色圆点+标题）+ 对应 CSS"
    - "系统提示词禁止为读取内容而 open_link/导航当前标签，内容为空时如实告知"
  fix_applied: "renderer.js 改用 state.webviews + webview 缺失告警；气泡引用标记 + main.css 样式；ai-manager 提示词加固"
  resolved_by: "inline fixes round1+round2（6+3 处）"
  resolved_at: 2026-08-02
