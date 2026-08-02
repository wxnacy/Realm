---
status: diagnosed
phase: 22-cdp
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md, 22-04-SUMMARY.md
started: 2026-08-02T07:35:37Z
updated: 2026-08-02T08:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出 Realm 后重新 `npm run dev` 启动。应用无报错启动，主窗口/侧边栏容器列表正常，能在容器中打开真实网页。（main.js 在 22-03 被修改，需冷启动回归）
result: pass

### 2. read_page_content 真实页面提取
expected: 打开真实网页（新闻/文档站各一），AI 对话输入「读取当前页面内容」。返回完整结构（title/url/favicon/meta/og/content）；正文可读；大页面 100KB 截断带中文标记；纯应用/空白页返回带「页面无可读内容，可能是纯应用页面或空白页」message。
result: pass

### 3. extract_links 真实页面过滤
expected: 真实页面上 AI 对话输入「提取页面链接」。仅返回 http/https 链接、无本页锚点、无空文本、URL 无重复；返回 {total, links[{url, text}]}。无有效链接页面返回带「未找到有效链接（仅保留 http/https 协议）」message。
result: pass

### 4. open_link 双模式 + 全新 profile 回归
expected: ① 模拟全新 profile（备份后移除 realm-config.json 的 containers 键，重启），AI 输入「打开 https://example.com」→ 默认路径成功打开（不再报「指定容器不存在或已删除」）；② 指定 containerId 在目标容器打开；③ newTab=true 新建标签页 / newTab=false 当前标签页导航两种模式均正常。
result: issue
reported: "当前标签页打开网址有正确回复，但是没有真的打开网页。日志显示 AI 调用 navigate 工具 → 主进程创建 tab-469 记录（[Realm] Tab 创建: tab-469 容器: default），工具返回 success，但页面实际未加载。"
severity: major
retest_22_05: "复测场景（22-05 新增）：用「当前标签打开 <URL>」措辞重测 — AI 应选择 open_link 且设 newTab 为 false，当前活跃 webview 真实导航（终端出现 did-navigate 日志、页面可见加载），工具卡片成功。navigate 工具已移除（Gap 1 修复方式：删工具消除歧义，非改实现），AI 不再可能在两个打开链接工具间误选。"

### 5. DevTools 冲突与错误提示呈现
expected: 对当前 tab 打开 DevTools 后调用「读取当前页面内容」→ 工具卡片显示「失败」+「DevTools 已打开，请关闭后重试」；新建空 tab（未加载页面）调用工具 → 工具卡片「失败」+「当前标签页未加载页面，请先打开网页」。tool_execution_update running/completed/failed 状态在渲染进程正确呈现。
result: pass
note: "DevTools 冲突场景（子项 A）：实际行为为 DevTools 打开时 read_page_content 仍可正常读取（Electron 允许 AI debugger 与 DevTools 共存）。用户确认该行为更好，明确保留（2026-08-02）→ 22-UI-SPEC『DevTools 已打开，请关闭后重试』契约为过期预期，后续应更新 UI-SPEC/移除冲突检测，非代码缺陷，不计入 Gaps。子项 B（未加载 tab 报错）：pass。"

### 6. webview 销毁清理实际触发
expected: AI 工具执行期间或执行后关闭对应 tab，主进程终端日志输出「webview 销毁，已清理容器映射与 CDP 调试器状态」；之后再次调用 AI 工具无状态残留影响（不报意外错误）。
result: pass

### 7. 大页面性能（ROADMAP SC#5）
expected: 打开 >1MB 大页面（长文新闻/文档站），调用「读取当前页面内容」计时。5 秒内返回截断结果，期间 UI 可交互（可滚动、切换 tab 不卡顿）。
result: issue
reported: "打开第一个链接（zh.wikipedia.org/wiki/第二次世界大战），5秒内也返回了内容，但好像没有截断（AI 回复为完整结构化总结，未见 100KB 截断中文标记）"
severity: minor
expectation_correction_22_05: "期望修正（22-05）：性能期望不变（5 秒内返回、UI 可交互）。截断标记期望改条件式 — 仅当 Readability 提取后正文超 102,400 字符时，内容应截断并附字符语义截断标记（新措辞）；未超阈值时完整返回属正确行为。附注：原始 HTML 大小 ≠ 提取后文本量（wiki 案例提取率约 7.3%，99,630 < 102,400 故未截断），复测选页可用调试会话的 Electron 复现脚本预验证提取后长度（.planning/debug/truncation-marker-missing.md 记载 /tmp/readability_test.js 方法）。"

### 8. cdp-manager.js 导出 attachForAI/detachForAI/executeCommand 三个 AI 工具调试器管理方法
expected: cdp-manager.js 导出 attachForAI/detachForAI/executeCommand 三个 AI 工具调试器管理方法
result: pass
source: automated
coverage_id: 22-01-D1

### 9. lib/readability-bundle.js 存在且为可注入的 Readability minified IIFE
expected: lib/readability-bundle.js 存在且为可注入的 Readability minified IIFE（全局 Readability 构造函数 + parse 方法）
result: pass
source: automated
coverage_id: 22-01-D2

### 10. _buildRealmTools() 返回数组包含 read_page_content 工具
expected: _buildRealmTools() 返回数组包含 read_page_content 工具（execute 为函数）
result: pass
source: automated
coverage_id: 22-02-D1

### 11. _buildRealmTools() 返回数组包含 extract_links 工具
expected: _buildRealmTools() 返回数组包含 extract_links 工具（execute 为函数）
result: pass
source: automated
coverage_id: 22-02-D2

### 12. _buildRealmTools() 返回数组包含 open_link 工具
expected: _buildRealmTools() 返回数组包含 open_link 工具（execute 为函数）
result: pass
source: automated
coverage_id: 22-02-D3

### 13. REALM_SYSTEM_PROMPT 包含三个新工具说明与使用指南
expected: REALM_SYSTEM_PROMPT 包含 read_page_content/extract_links/open_link 说明与使用指南
result: pass
source: automated
coverage_id: 22-03-D1

### 14. main.js webview destroyed 监听调用 detachForAI
expected: main.js webview destroyed 监听调用 cdpManager.detachForAI(contents.id)
result: pass
source: automated
coverage_id: 22-03-D2

### 15. _buildRealmTools() 返回 8 个工具且三新工具字段齐全
expected: _buildRealmTools() 返回 8 个工具且三新工具 name/label/description/parameters/execute 齐全
result: pass
source: automated
coverage_id: 22-03-D3

### 16. 6 条错误文案与 22-UI-SPEC 契约逐条一致
expected: 6 条错误文案与 22-UI-SPEC 契约逐条一致（DevTools 冲突/页面未加载/CDP 附加失败/内容截断/链接打开失败/容器不存在）
result: pass
source: automated
coverage_id: 22-03-D4

### 17. open_link / switch_container 容器校验改用内存权威数据
expected: open_link / switch_container 容器校验改用 containerManager.getContainers() 内存权威数据，全新 profile 下默认路径可找到 default 容器
result: pass
source: automated
coverage_id: 22-04-D1

### 18. extract_links / read_page_content 空状态契约文案挂载
expected: extract_links 过滤后 0 链接时携带「未找到有效链接（仅保留 http/https 协议）」；read_page_content 正文为空时携带「页面无可读内容，可能是纯应用页面或空白页」
result: pass
source: automated
coverage_id: 22-04-D2

## Summary

total: 18
passed: 16
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "AI 打开链接时目标网页在窗口中真实加载（当前标签页模式）"
  status: failed
  reason: "User reported: 当前标签页打开网址有正确回复，但是没有真的打开网页。日志：AI 调用 navigate {\"url\":\"https://www.baidu.com\"} → 主进程 [Realm] Tab 创建: tab-469 (容器: default) → 工具返回 success，但渲染进程未创建 webview，URL 从未加载（疑似幽灵 Tab）"
  severity: major
  test: 4
  root_cause: "三重根因：① Phase 20 遗留 navigate 工具（ai-manager.js:776）直接调 tabManager.createTab（tab-manager.js:102-125 仅写主进程记录/持久化，不通知渲染进程）→ 与 open_link 已修复的同款幽灵 Tab；② navigate 声明 newTab 参数（默认 false）但 execute 从未使用（:771 死代码），永远创建新 tab 记录、从不执行当前标签导航；③ REALM_SYSTEM_PROMPT 中 navigate/open_link 职责重叠、指引不足，AI 对「当前标签打开」误选 navigate。次生危害：主进程活跃指针被劫持到幽灵 tab、saveTabs 持久化后重启可能物化。"
  artifacts:
    - path: "ai-manager.js:748-790"
      issue: "navigate 工具直接调 tabManager.createTab 产生幽灵 Tab；newTab 参数被忽略；无 URL 白名单校验"
    - path: "ai-manager.js:86-104"
      issue: "REALM_SYSTEM_PROMPT navigate/open_link 职责重叠，工具选择歧义"
    - path: "tab-manager.js:102-125"
      issue: "createTab 设计上由渲染进程 IPC 驱动，被 navigate 误用为完整创建入口"
  missing:
    - "navigate 双模式修复：newTab=true 走 open-url-in-tab 渲染进程全链路，newTab=false 走活跃 webview loadURL；或移除 navigate 仅保留 open_link 并重写系统提示词消除歧义"
    - "UAT Test 4 补「当前标签打开」措辞回归场景"
  debug_session: ".planning/debug/open-link-ghost-tab.md"
- truth: "大页面（>1MB）内容在 100KB 处截断并附加中文标记（用户可感知）"
  status: failed
  reason: "User reported: 打开第一个链接（zh.wikipedia.org/wiki/第二次世界大战），5秒内也返回了内容，但好像没有截断（AI 回复为完整结构化总结，未见 100KB 截断中文标记）"
  severity: minor
  test: 7
  root_cause: "截断未触发（非代码 bug）：该页原始 HTML 1.36MB，但经项目真实 readability-bundle 提取后正文仅 99,630 UTF-16 字符，恰低于 MAX_CONTENT_SIZE=102,400（差 2.7%），ai-manager.js:1049 截断分支不执行，标记从未生成；AI 输出完整总结是实现下的正确行为。叠加单位语义错位（IN-01）：契约/标记文案写 bytes，实现按 UTF-16 字符比较（该页按字节 173,889 > 阈值，按字符 99,630 < 阈值）。UAT 用例前提错配：以原始 HTML 大小推断截断，未考虑 Readability 提取率（本页 ~7.3%）。"
  artifacts:
    - path: "ai-manager.js:110"
      issue: "MAX_CONTENT_SIZE = 100*1024 语义为字符数而非字节"
    - path: "ai-manager.js:1049-1052"
      issue: "截断逻辑本身无 bug；标记文案 bytes 与字符实现不符（IN-01）"
    - path: ".planning/phases/22-cdp/22-UI-SPEC.md:139"
      issue: "契约文案同样写 bytes，措辞不准"
    - path: ".planning/phases/22-cdp/22-UAT.md"
      issue: "Test 7 以 HTML 大小作截断前提，选中阈值边缘页面"
  missing:
    - "明确契约单位：字节语义改 Buffer.byteLength 比较，或字符语义修订 UI-SPEC/标记措辞（落地 REVIEW IN-01）"
    - "修正 UAT 用例：选用提取后正文确定超 102,400 字符的页面（可脚本预验证）或改条件式期望"
    - "可选：系统提示引导 AI 转述截断标记，或工具卡片基于 details.contentLength 显示截断状态"
  debug_session: ".planning/debug/truncation-marker-missing.md"

## 附注（22-05）

- 工具总数由 8 变为 7（navigate 已移除）— Test 15 等历史自动化用例若复跑，期望数量与工具集合相应更新
- Test 5 的 DevTools 子项用户决策已同步至 22-UI-SPEC 契约变更记录
- navigate 工具已移除（22-05 Gap 1 修复方式：删工具消除歧义，非改实现），AI 不再可能在两个打开链接工具间误选
