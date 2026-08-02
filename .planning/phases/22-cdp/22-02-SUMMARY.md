---
phase: 22-cdp
plan: 02
subsystem: ai
tags: [ai-tools, cdp, readability, runtime-evaluate, open-link]

# Dependency graph
requires:
  - phase: 22-cdp plan 01
    provides: cdp-manager attachForAI/detachForAI/executeCommand 三段式 API + lib/readability-bundle.js
  - phase: 20-ai-manager
    provides: ai-manager.js _buildRealmTools() 工具注册模式与事件广播
provides:
  - read_page_content — Runtime.evaluate 注入 Readability 提取标题/正文/元信息（100KB 截断）
  - extract_links — DOM 查询提取链接，http/https 过滤 + 锚点过滤 + URL 去重
  - open_link — 指定容器打开链接（新标签页经 open-url-in-tab 全链路 / 当前标签页 loadURL）
affects: [22-cdp plan 03, 智能上下文引用, 任务自主执行, 脚本生成]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI 工具目标 tab 解析单点 resolveToolTargetTab：活跃 tab + 渲染进程上报的 activeWebviewContentsId"
    - "ipc-handlers 惰性 require：纯 Node 验证环境可加载 ai-manager，Electron 运行时命中模块缓存"
    - "主进程创建可见 Tab 必须经渲染进程：open-url-in-tab 事件 → renderer createTab 全链路（DOM+webview+加载）"
    - "Runtime.evaluate 结果检查 exceptionDetails 与 result.value 类型后再 JSON.parse"

key-files:
  created: []
  modified: [ai-manager.js]

key-decisions:
  - "主进程 tab 对象无 webContentsId 字段：活跃 tab 的 guest ID 取渲染进程经 webview:set-active 上报值（唯一权威来源），非活跃 tab 明确报错待后续映射机制"
  - "open_link newTab=true 复用 window.open 拦截同款 open-url-in-tab 通道：tabManager.createTab 只建主进程记录会产生无 webview 的幽灵 Tab"
  - "newTab=false 导航 fire-and-forget：不等待页面加载，tab.url 由渲染进程 did-navigate 事件链路自动回写持久化"

patterns-established:
  - "AI 页面工具三段式：resolveToolTargetTab → attachForAI → executeCommand → finally detachForAI"
  - "主进程触发新 Tab：win.webContents.send('open-url-in-tab', { url, containerId, guestId: undefined })"

requirements-completed: [CDP-02, CDP-03, CDP-04]

coverage:
  - id: D1
    description: "_buildRealmTools() 返回数组包含 read_page_content 工具（execute 为函数）"
    requirement: CDP-02
    verification:
      - kind: other
        ref: "node -e \"require('./ai-manager')._buildRealmTools() 查找 read_page_content\""
        status: pass
    human_judgment: false
  - id: D2
    description: "_buildRealmTools() 返回数组包含 extract_links 工具（execute 为函数）"
    requirement: CDP-03
    verification:
      - kind: other
        ref: "node -e \"require('./ai-manager')._buildRealmTools() 查找 extract_links\""
        status: pass
    human_judgment: false
  - id: D3
    description: "_buildRealmTools() 返回数组包含 open_link 工具（execute 为函数）"
    requirement: CDP-04
    verification:
      - kind: other
        ref: "node -e \"require('./ai-manager')._buildRealmTools() 查找 open_link\""
        status: pass
    human_judgment: false
  - id: D4
    description: "真实页面上 read_page_content 提取质量、100KB 截断标记、extract_links 过滤正确性、open_link 两种模式、CDP 调试器用后断开"
    requirement: CDP-02, CDP-03, CDP-04
    verification: []
    human_judgment: true
    rationale: "需要真实 Electron webview + 网页环境，静态验证无法覆盖；由 Phase 22 UAT 配合 AI 对话验证"

# Metrics
duration: 8min
completed: 2026-08-02
status: complete
---

# Phase 22 Plan 02: 三个 AI 网页工具（read_page_content / extract_links / open_link）Summary

**三个 AI 网页操控工具注册进 _buildRealmTools()：Readability 页面内容提取（100KB 截断）、链接提取（协议/锚点过滤 + 去重）、容器内打开链接（新标签页经渲染进程全链路）**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-02T04:42:59Z
- **Completed:** 2026-08-02T04:51:00Z
- **Tasks:** 3
- **Files modified:** 1（ai-manager.js，+352 行）

## Accomplishments

- read_page_content（CDP-02）：模块加载时缓存 readability-bundle，Runtime.evaluate 注入后提取标题/正文/SEO meta/Open Graph/canonical/语言/字符集，正文 100KB 截断并追加中文标记（D-05~D-07）
- extract_links（CDP-03）：DOM 查询 a[href]，相对 URL 转绝对、仅保留 http/https、排除本页锚点链接与空文本链接、URL 去重，返回 {total, links[{url, text}]}（D-08/D-09）
- open_link（CDP-04）：URL 协议白名单、容器解析（参数 → 当前活跃容器 → default 兜底）与存在性校验、newTab 双模式（D-10/D-11）
- 所有 CDP 工具统一 attachForAI → executeCommand → finally detachForAI 三段式，调试器用完即卸（D-01/D-03）

## Task Commits

Each task was committed atomically:

1. **Task 1: 实现 read_page_content 工具** - `fe6ffb3` (feat)
2. **Task 2: 实现 extract_links 工具** - `7e7ca17` (feat)
3. **Task 3: 实现 open_link 工具** - `0c8a1c8` (feat)

## Files Created/Modified

- `ai-manager.js` — 顶部新增 fs/path/electron webContents/cdp-manager 引入、READABILITY_SCRIPT 缓存、getActiveWebviewContentsIdLazy、MAX_CONTENT_SIZE 常量、resolveToolTargetTab helper；_buildRealmTools() 新增 3 个工具定义（现共 8 个工具）

## Decisions Made

- **活跃 tab 的 webContentsId 取渲染进程上报值**：主进程 tab 对象不维护 webContentsId（RESEARCH 2.3 节的假设与实现不符），`webview:set-active` 上报到 ipc-handlers 的 activeWebviewContentsId 是活跃 guest 的唯一权威来源；ai-manager 经惰性 require('./ipc-handlers') 获取（顶层 require 会让纯 Node 验证环境崩溃：cookie-manager 顶层 app.getPath 依赖 Electron）
- **open_link 新标签页复用 open-url-in-tab 通道**：计划的 tabManager.createTab 路径只创建主进程记录，渲染进程不会建 webview，URL 实际不会被加载（幽灵 Tab，must_have 失败）；复用 main.js window.open 拦截同款通道后渲染进程走完整 createTab 链路。代价：tabId 异步创建不可同步返回（返回 null，AI 可经 get_tabs 按 URL 查得）
- **newTab=false 导航 fire-and-forget**：wc.loadURL 不 await（页面加载耗时不确定，工具应快速返回），tab.url 回写依赖 renderer bindWebviewEvents 已有的 did-navigate → realmAPI.updateTab 持久化链路，不做主进程侧冗余更新

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tab.webContentsId 不存在 → resolveToolTargetTab 定位活跃 tab**
- **Found during:** Task 1（read_page_content）
- **Issue:** 计划三个工具均引用 `tab.webContentsId`，但 tab-manager 的 tab 对象只有 id/containerId/url/title/createdAt/lastActiveAt（+faviconUrl/pinned），主进程不存在 tabId→webContentsId 映射（渲染进程 state.webviews 才持有该关联）
- **Fix:** 新增 resolveToolTargetTab helper：params.tabId 省略或等于活跃 tab 时取 getActiveWebviewContentsIdLazy()（渲染进程 webview:set-active 上报值）；指定非活跃 tabId 时抛出明确错误「暂仅支持当前活跃标签页」。工具 description 同步注明该限制
- **Files modified:** ai-manager.js
- **Impact:** 与计划的语义偏差 —— 计划声称 tabId 参数支持任意标签页，实际仅活跃标签页。后续建立 tabId→guestId 映射（渲染进程上报）后可无缝扩展
- **Committed in:** `fe6ffb3`（Task 1 提交）

**2. [Rule 3 - Blocking] open_link newTab=true 改经 open-url-in-tab 事件通道**
- **Found during:** Task 3（open_link）
- **Issue:** 计划用 tabManager.createTab(containerId, url) 创建新标签页，但主进程 createTab 只写 tab 记录与持久化，webview 由渲染进程创建 —— 直接调用会产生主进程有记录、UI 无 Tab/webview、URL 从未加载的幽灵 Tab（重启恢复时暴露），must_have「在指定容器中打开链接」不成立
- **Fix:** 复用既有 open-url-in-tab 通道（main.js window.open 拦截同款）：mainWindow.webContents.send → 渲染进程 handleOpenUrlInTab（自带 http(s) 校验）→ 本地 createTab 全链路（realmAPI.createTab → DOM + webview + URL 加载）。返回值 tabId 置 null 并在代码注释说明可经 get_tabs 查询
- **Files modified:** ai-manager.js
- **Impact:** 返回契约偏差 —— 计划返回新建 tab 的 id，实际异步创建主进程不可知（null）。打开行为本身与浏览器原生 window.open 完全一致
- **Committed in:** `0c8a1c8`（Task 3 提交）

**3. [Rule 1 - Bug] Runtime.evaluate 异常路径与 Readability 缺失防御**
- **Found during:** Task 1（read_page_content），Task 2 同步应用
- **Issue:** 页面内脚本抛异常时 Runtime.evaluate 返回 exceptionDetails 且 result.value 为 undefined，计划直接 JSON.parse(result.value) 会抛出难以定位的错误；READABILITY_SCRIPT 加载失败时注入脚本必抛 ReferenceError
- **Fix:** executeCommand 返回后检查 exceptionDetails（带页面侧错误文本抛出）与 result.value 类型；read_page_content 执行前检查 READABILITY_SCRIPT 非空
- **Files modified:** ai-manager.js
- **Committed in:** `fe6ffb3`、`7e7ca17`

---

**Total deviations:** 3 auto-fixed（2 blocking、1 bug）
**Impact on plan:** 均为完成 must_have 所必需的阻断性修复，无范围蔓延、无新 IPC 通道、无新增文件。两处语义偏差（仅活跃 tab 可读、新 tab id 返回 null）已记录在案，待后续 tabId→guestId 映射机制补齐。

## Issues Encountered

None beyond deviations — Wave 1 交付的 CDP 三段式 API 与 readability-bundle 按计划直接可用。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CDP-02/03/04 工具已注册，AI 对话中即可调用；plan 03（若有）与 Phase 23 智能上下文引用可直接消费 read_page_content/extract_links
- 待后续处理：非活跃 tab 支持需建立 tabId→guestId 映射（渲染进程上报，类似 webview:register-container）；main.js webview destroyed 挂接 detachForAI（RESEARCH T7，Wave 1 已列入后续）
- 运行时行为（提取质量、截断标记、链接过滤、打开行为、调试器断开）需 Electron GUI 环境 UAT 验证

## Self-Check: PASSED

- FOUND: ai-manager.js 含 read_page_content/extract_links/open_link 工具定义（node 注册验证 PASS ×3，工具列表共 8 个）
- FOUND: commit fe6ffb3（Task 1）、7e7ca17（Task 2）、0c8a1c8（Task 3）于 git log
- FOUND: node --check ai-manager.js 语法通过；三次提交均无文件删除

---
*Phase: 22-cdp*
*Completed: 2026-08-02*
