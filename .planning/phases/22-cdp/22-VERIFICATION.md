---
phase: 22-cdp
verified: 2026-08-02T05:49:24Z
status: gaps_found
score: 9/14 must-haves verified
behavior_unverified: 4
overrides_applied: 0
gaps:
  - truth: "AI 调用 open_link 在指定容器中打开链接（CDP-04 / ROADMAP SC#3）"
    status: failed
    reason: "open_link 容器存在性校验使用非权威数据源 configStore.get('containers', [])（ai-manager.js:1172）。container-manager.initContainers()（container-manager.js:65）只以 DEFAULT_CONTAINERS 为默认值读入内存、从不写回 store；全库 set('containers') 仅发生在容器 CRUD 三处（container-manager.js:139/199/245）。全新 profile（用户从未做过容器 CRUD）下 store 无 containers 键 → 返回 [] → find(c => c.id === 'default') 失败 → 抛出事实性错误的「指定容器不存在或已删除」。AI 最常见的调用方式（不传 containerId，默认当前容器）在新用户环境 100% 失败。开发者本机因做过容器 CRUD、store 已有键而无法复现，属潜伏 bug（22-REVIEW CR-01，描述经代码核实准确）。"
    artifacts:
      - path: "ai-manager.js"
        issue: "1172-1176 行 open_link 容器校验读取 configStore 而非 containerManager.getContainers()（内存权威数据，initContainers 已含 DEFAULT_CONTAINERS）"
      - path: "ai-manager.js"
        issue: "925-929 行 switch_container 同款 configStore.get('containers', []) 校验模式（Phase 20 预存在），建议随本次修复一并处理"
    missing:
      - "open_link 容器校验改为 const container = containerManager.getContainers().find(c => c.id === containerId)（ai-manager 顶部 require('./container-manager')）"
      - "switch_container（ai-manager.js:925-929）同款校验同步改为 containerManager.getContainers()"
      - "修复验证：删除/重命名 realm-config.json 中 containers 键模拟全新 profile，open_link 默认路径（不传 containerId）应成功打开链接"
  - truth: "UI-SPEC 空状态文案契约完整实现（22-UI-SPEC.md 空状态 2 条）"
    status: partial
    reason: "22-UI-SPEC 契约共 8 条文案（6 错误 + 2 空状态），代码仅实现 6 条错误文案。「未找到有效链接（仅保留 http/https 协议）」与「页面无可读内容，可能是纯应用页面或空白页」全代码库 grep 零命中：extract_links 在 0 链接时返回 {total: 0, links: []}，read_page_content 在 Readability 解析失败时返回 content: ''，均未携带契约文案（22-REVIEW WR-02）。22-03 SUMMARY「6 条错误文案与契约完全对齐」的表述属实但遗漏空状态 2 条。属 Warning 级契约偏差，不阻塞工具功能，随 gap 修复一并补齐。"
    artifacts:
      - path: "ai-manager.js"
        issue: "1123-1128 行 extract_links 返回处未在 total === 0 时附加契约文案；1026-1037 行 read_page_content 返回处未在 content 为空时附加契约文案"
    missing:
      - "extract_links：data.total === 0 时附加 data.message = '未找到有效链接（仅保留 http/https 协议）'"
      - "read_page_content：!data.content 时附加 data.message = '页面无可读内容，可能是纯应用页面或空白页'"
behavior_unverified_items:
  - truth: "AI 调用 read_page_content 返回页面标题、正文、元信息"
    test: "Electron GUI 环境中打开真实网页，AI 对话输入「读取当前页面内容」"
    expected: "返回 title/url/favicon/meta/og/properties/content 完整结构；Readability 提取正文质量可用；大页面在 100KB 处截断并带中文标记"
    why_human: "Runtime.evaluate 注入真实页面的提取质量、Readability 在实际 DOM 上的表现，静态检查无法覆盖（22-01/22-02 coverage D3/D4 均标记 human_judgment）"
  - truth: "AI 调用 extract_links 返回去重后的有效链接列表"
    test: "真实页面上 AI 对话输入「提取页面链接」"
    expected: "返回 {total, links[{url, text}]}；仅 http/https、无本页锚点链接、无空文本链接、URL 无重复"
    why_human: "DOM 查询与过滤规则在真实页面上的正确性需运行时验证"
  - truth: "错误状态通过 toast/工具卡片正确提示用户"
    test: "打开目标页面的 DevTools 后调用 read_page_content；对未加载的新建 tab 调用工具"
    expected: "工具卡片显示「失败」+ UI-SPEC 契约文案（DevTools 已打开/页面未加载）；tool_execution_update running/completed/failed 状态在渲染进程正确呈现"
    why_human: "工具卡片 UI 状态呈现与事件广播的端到端链路需 Electron GUI 环境"
  - truth: "大页面（>1MB）内容提取在 5 秒内返回，不阻塞 UI 交互（ROADMAP SC#5）"
    test: "打开大型页面（如长文新闻/文档站），调用 read_page_content 计时"
    expected: "5 秒内返回截断结果，期间 UI 可交互"
    why_human: "性能指标只能在真实运行时测量"
---

# Phase 22: CDP 管理器扩展 + 基础网页操控工具 — Verification Report

**Phase Goal:** CDP 管理器扩展 + 基础网页操控工具 — 让 AI Agent 能够通过 CDP 读取页面内容、提取链接、在容器中打开链接
**Verified:** 2026-08-02T05:49:24Z
**Status:** gaps_found
**Re-verification:** No — initial verification
**Score:** 9/14 must-haves verified（另有 4 项代码就绪但行为需运行时验证，1 项 FAILED）

## 结论摘要

三个 plan 的代码交付物**全部存在且实质实现**：cdp-manager 三段式 API（attachForAI/executeCommand/detachForAI）逻辑严谨（冲突检测、超时 race + clearTimeout、source 标记、cleanup 清理），三个 AI 工具注册完整（node 验证 8 工具全 PASS），Readability bundle 经 vm 沙箱验证可注入，main.js webview 销毁清理正确挂接，6 条错误文案与 UI-SPEC 逐字匹配，8 个任务提交全部在 git log 中。

**但 22-REVIEW 的 CR-01 经代码核实描述准确，且阻碍了 CDP-04 的验收**：open_link 的容器校验读取非权威数据源，全新 profile 下默认调用路径 100% 失败。这是"任务完成 ≠ 目标达成"的典型案例 — 工具代码存在、已注册、在开发者本机可用，但对新用户而言"AI 在容器中打开链接"这一 phase 目标不成立。判定 **status: gaps_found**。

## Must-Haves Verification

### Observable Truths（合并 3 个 plan + ROADMAP SC，去重后 14 项）

| # | Truth | 来源 | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | AI 工具调用时能成功附加 CDP 调试器并启用 Runtime/DOM 域 | 22-01 | ✓ VERIFIED | cdp-manager.js:308-343 attachForAI：isDestroyed 检查 → isAttached 冲突检测 → attach('1.3') → 逐域 enable → debuggerStates 记录 source:'ai-tool' |
| 2 | 工具执行完成后调试器自动断开，不保留连接 | 22-01/22-02 | ✓ VERIFIED | ai-manager.js:1038-1040、1129-1131 两工具 finally 块调 detachForAI；cdp-manager.js:353-368 仅断 source==='ai-tool' 并删 Map 条目 |
| 3 | DevTools 已打开时返回明确错误提示 | 22-01 | ✓ VERIFIED | cdp-manager.js:315-317 isAttached → 返回契约文案「DevTools 已打开，请关闭后重试」（WR-01 附加说明：dev-mode 抓包占用槽位时此文案误导，见 Warnings） |
| 4 | CDP 命令执行超时 10 秒后返回错误而非挂起 | 22-01 | ✓ VERIFIED | cdp-manager.js:381-402 Promise.race + setTimeout reject('CDP 命令执行超时') + finally clearTimeout（无悬挂定时器） |
| 5 | webview 销毁时自动清理相关调试器状态 | 22-01/22-03 | ✓ VERIFIED | main.js:134-140 web-contents-created 的 destroyed 监听调 cdpManager.detachForAI(contents.id)；detachForAI 对已销毁 wc 仍删 debuggerStates 条目（cdp-manager.js:367）；cleanup() 退出时断开全部 ai-tool 调试器（cdp-manager.js:699-716） |
| 6 | AI 调用 read_page_content 返回页面标题、正文、元信息 | 22-02 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 代码完整：ai-manager.js:950-1042，Readability 注入 + meta/og/properties 提取 + finally detach；提取质量需真实页面验证 → Human Verification #1 |
| 7 | AI 调用 extract_links 返回去重后的有效链接列表 | 22-02 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 代码完整：ai-manager.js:1043-1133，http/https 过滤 + 锚点过滤 + 空文本过滤 + Set 去重；运行时正确性 → Human Verification #2 |
| 8 | AI 调用 open_link 在指定容器中打开链接 | 22-02 | ✗ **FAILED** | **CR-01**：ai-manager.js:1172 容器校验用 configStore.get('containers', [])，全新 profile 返回 []，默认容器误判不存在，默认路径 100% 抛错。详见 Gaps #1 |
| 9 | 大页面（>1MB）内容在 100KB 处截断并标记 | 22-02 | ✓ VERIFIED | ai-manager.js:89 MAX_CONTENT_SIZE = 100*1024；1029-1032 截断 + 中文标记文案（与 UI-SPEC 匹配） |
| 10 | 链接过滤仅保留 http/https 协议，过滤锚点链接 | 22-02 | ✓ VERIFIED | ai-manager.js:1081-1092 过滤逻辑与 D-08 逐条对应（协议白名单、本页锚点排除、空文本排除） |
| 11 | AI 系统提示词包含三个新工具的说明 | 22-03 | ✓ VERIFIED | ai-manager.js:65-83 REALM_SYSTEM_PROMPT 含 read_page_content/extract_links/open_link 说明 + 使用指南（场景→工具映射 + DevTools 冲突提示） |
| 12 | 错误状态通过 toast 正确提示用户 | 22-03 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 链路存在：工具 throw → pi-agent-core tool_execution_end(isError) → _setupEventBroadcasting（ai-manager.js:412-471）广播 failed；UI 呈现 → Human Verification #3 |
| 13 | 工具执行状态通过现有事件系统广播到渲染进程 | 22-03 | ✓ VERIFIED | ai-manager.js:446-471 tool_execution_update 三状态（running/completed/failed）广播逻辑存在 |
| 14 | 大页面内容提取 5 秒内返回，不阻塞 UI（ROADMAP SC#5） | ROADMAP | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 性能指标无法静态验证 → Human Verification #4 |

**Score:** 9/14 VERIFIED + 4 PRESENT_BEHAVIOR_UNVERIFIED + 1 FAILED

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cdp-manager.js` | attachForAI/detachForAI/executeCommand | ✓ VERIFIED | 三方法实现完整并导出（751-753 行）；node typeof 检查均为 function；含 cleanup AI 状态清理 + 顶部 Readability 用途注释 |
| `lib/readability-bundle.js` | 可注入的 Readability 库 | ✓ VERIFIED | 33287 bytes minified IIFE；vm 沙箱验证 typeof Readability === 'function' 且 prototype.parse 为 function；头部含 Apache 2.0 归属声明；node --check 通过 |
| `ai-manager.js` | read_page_content 工具定义 | ✓ VERIFIED | 950-1042 行，name/label/description/parameters/execute 齐全，node 注册验证 PASS |
| `ai-manager.js` | extract_links 工具定义 | ✓ VERIFIED | 1043-1133 行，node 注册验证 PASS |
| `ai-manager.js` | open_link 工具定义 | ✓ VERIFIED（存在 CR-01 缺陷） | 1134-1239 行，注册验证 PASS；容器校验数据源缺陷见 Gaps #1 |
| `ai-manager.js` | 系统提示词含三工具说明 | ✓ VERIFIED | 65-83 行 |
| `main.js` | webview 销毁 CDP 清理逻辑 | ✓ VERIFIED | 134-140 行 destroyed → detachForAI；main.js:58 已导入 cdp-manager |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| attachForAI | debuggerStates 状态管理 | source: 'ai-tool' 标记 | ✓ WIRED | cdp-manager.js:329-333 |
| executeCommand | 超时保护机制 | Promise.race + clearTimeout | ✓ WIRED | cdp-manager.js:387-401 |
| webview destroyed | detachForAI 清理 | main.js web-contents-created destroyed 监听 | ✓ WIRED | main.js:134-140（contents.id 即 guest webContentsId，与 unregisterGuestContainer 同点挂接） |
| read_page_content | cdpManager.attachForAI → Runtime.evaluate → Readability | 三段式调用 | ✓ WIRED | ai-manager.js:971-1013；READABILITY_SCRIPT 模块加载时缓存（35-40 行），执行前非空检查（966-968） |
| extract_links | Runtime.evaluate → DOM 查询 → 链接过滤 | 三段式调用 | ✓ WIRED | ai-manager.js:1059-1110 |
| open_link | tabManager.createTab / loadURL | open-url-in-tab 通道（计划偏差，更优实现） | ✓ WIRED | newTab=true：ai-manager.js:1190 send('open-url-in-tab') → preload.js:89-90 → renderer.js:1465 注册 handleOpenUrlInTab → 1971 createTab 全链路（DOM+webview+URL 加载）。newTab=false：1216-1224 webContents.fromId + loadURL。注：计划原写 tabManager.createTab 会产生无 webview 的幽灵 Tab，22-02 偏差修复合理 |
| REALM_SYSTEM_PROMPT | 工具能力描述 | 提示词文本 | ✓ WIRED | ai-manager.js:73-81 |
| 工具执行错误 | 渲染进程 | _setupEventBroadcasting | ✓ WIRED | ai-manager.js:412-471（计划写的 "notifyToast" 为 cdp-manager dev-mode 通道，AI 工具错误实际走 tool_execution_update 广播，意图达成） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| read_page_content | data（标题/正文/元信息） | Runtime.evaluate 注入脚本在真实页面 DOM 执行 | 是（运行时页面数据） | ✓ FLOWING（代码级；页面数据质量属 Human #1） |
| extract_links | data.links | 真实页面 document.querySelectorAll('a[href]') | 是 | ✓ FLOWING（Human #2 复核） |
| open_link | containerId | params → windowManager.getCurrentContainer → 'default' 兜底 | **容器校验环节数据源错误** | ✗ HOLLOW（CR-01：校验用 configStore 而非内存权威数据，全新 profile 下数据流在此中断） |

## Requirements Traceability

| Requirement | 描述 | 来源 Plan | Status | Evidence |
|-------------|------|-----------|--------|----------|
| CDP-01 | 独立 CDP 管理器扩展（Runtime/DOM/Page 域支持 + 资源监控和自动清理） | 22-01, 22-03 | ✓ COVERED（代码级） | attachForAI 支持任意 domains 参数（默认 Runtime）；executeCommand 超时保护；destroyed/cleanup 双重清理。域启用与清理的实际运行时行为 → Human #3/#5 |
| CDP-02 | read_page_content 工具（标题、正文、元信息） | 22-02, 22-03 | ✓ COVERED（代码级） | 工具注册 PASS，注入/提取/截断逻辑完整；提取质量 → Human #1 |
| CDP-03 | extract_links 工具（过滤和去重） | 22-02, 22-03 | ✓ COVERED（代码级） | 工具注册 PASS，D-08/D-09 过滤规则完整；运行时正确性 → Human #2 |
| CDP-04 | open_link 工具（指定容器、当前/新标签页） | 22-02, 22-03 | ✗ **GAP** | **CR-01 阻碍验收**：全新 profile 默认路径 100% 失败（详见下方决策分析） |

REQUIREMENTS.md 中 CDP-01..04 全部映射到 Phase 22，plan frontmatter 声明完整（22-01: CDP-01；22-02: CDP-02/03/04；22-03: 全部），无 ORPHANED 需求。

## CR-01 验收决策分析（CDP-04）

**问题：CR-01 是否阻碍 CDP-04（open_link）验收？—— 是，阻碍。**

代码核实确认 22-REVIEW 描述准确，证据链：

1. **数据源对比**：container-manager.js:65 `initContainers()` 以 `configStore.get('containers', DEFAULT_CONTAINERS)` 读入内存 Map，**从不写回**；全库 `set('containers')` 仅 3 处 CRUD（139/199/245 行，已 grep 全库确认无其他写入点）。ai-manager.js:1172 用 `configStore.get('containers', [])`，默认值是 `[]` 而非 DEFAULT_CONTAINERS。
2. **失败路径**：全新 profile → store 无 containers 键 → 返回 `[]` → `find(c => c.id === 'default')` → undefined → 抛「指定容器不存在或已删除」（node 模拟复现确认）。
3. **触发条件是主路径而非边缘场景**：AI 最典型的调用「打开这个链接」不传 containerId → 1168 行取当前活跃容器（windowContainerMap 窗口创建时已赋值，或 'default' 兜底）→ 命中失败校验。新用户 = 全新 profile = 100% 触发。
4. **错误文案事实性错误**：容器实际存在（内存 Map 与 windowContainerMap 均有），用户被告知"不存在或已删除"，无可操作的恢复指引。
5. **潜伏性质放大风险**：开发者本机做过容器 CRUD、store 已有键，UAT 在本机会通过 — 若按 passed 放行，该 bug 将直达新用户。
6. **同一 store 实例确认**：main.js:47 `new Store({ name: 'realm-config' })` → main.js:1640 传入 aiManager.init()；container-manager.js:16 同名 Store 共享同一 backing file。CRUD 写入对 ai-manager 可见，这解释了开发者本机不复现。

结论：CDP-04 的验收标准「AI 在指定容器的当前标签页或新标签页中打开链接」对全新 profile 用户不成立 → truth #8 FAILED → status: gaps_found。修复方案明确（containerManager.getContainers() 内存权威数据），随 gap-closure plan 执行。switch_container（ai-manager.js:925-929，Phase 20 预存在同款模式）建议一并修复。

## Automated Checks

| # | Command | Result | Status |
|---|---------|--------|--------|
| 1 | `node -e "const cdp = require('./cdp-manager'); console.log(typeof cdp.attachForAI, typeof cdp.detachForAI, typeof cdp.executeCommand)"` | function / function / function | ✓ PASS |
| 2 | `node --check cdp-manager.js && node --check ai-manager.js && node --check main.js` | 无输出（语法通过） | ✓ PASS |
| 3 | node 注册验证：`_buildRealmTools()` 工具列表 | 8 工具：get_tabs, navigate, search_history, manage_favorites, switch_container, read_page_content, extract_links, open_link；三新工具 name/label/description/parameters/execute 齐全 | ✓ PASS ×3 |
| 4 | vm 沙箱执行 readability-bundle + `node --check` | typeof Readability === 'function'，prototype.parse 为 function，33287 bytes，语法通过 | ✓ PASS |
| 5 | grep 6 条 UI-SPEC 错误文案 | 全部命中（DevTools 已打开×1、页面未加载×1、CDP 附加失败×1、截断标记×2、链接打开失败×2、容器不存在×1） | ✓ PASS |
| 6 | grep 2 条 UI-SPEC 空状态文案 | **零命中**（WR-02 确认） | ✗ FAIL → Gaps #2 |
| 7 | grep main.js `detachForAI` + destroyed 监听 | main.js:138 挂接于 web-contents-created destroyed（134-140 行） | ✓ PASS |
| 8 | grep open-url-in-tab 渲染进程链路 | preload.js:89-90 ipcRenderer.on → renderer.js:1465 注册 → 1946 handleOpenUrlInTab → 1971 createTab | ✓ PASS |
| 9 | git log 验证 8 个任务提交 | 680a166, bf64caf, fe6ffb3, 7e7ca17, 0c8a1c8, 5559783, bf2df1c, e0c40b8 全部存在 | ✓ PASS |
| 10 | CR-01 失败路径 node 模拟 | fresh profile `[].find(c => c.id === 'default')` → undefined → 抛错复现 | ✓ 复现确认 |

## Human Verification Needed

以下项目需 Electron GUI 环境（与三份 SUMMARY 的 coverage human_judgment 标记一致），建议在 CR-01 修复后随 UAT 一并执行：

### 1. read_page_content 真实页面提取

**Test:** 打开真实网页（新闻/文档站各一），AI 对话输入「读取当前页面内容」
**Expected:** 返回 title/url/favicon/meta/og/properties/content 完整结构；正文可读；大页面 100KB 截断带中文标记
**Why human:** Readability 在真实 DOM 上的提取质量无法静态验证

### 2. extract_links 真实页面过滤

**Test:** 真实页面上输入「提取页面链接」
**Expected:** 仅 http/https、无本页锚点、无空文本、URL 无重复；返回 total 与 links 数组
**Why human:** DOM 查询与过滤规则需运行时验证

### 3. open_link 双模式 + CR-01 修复验证

**Test:**（修复后）① 模拟全新 profile（移除 realm-config.json 的 containers 键），AI 输入「打开 https://example.com」；② 指定 containerId 与新/当前标签页两种模式
**Expected:** 全新 profile 默认路径成功打开；指定容器正确路由；工具卡片显示成功结果
**Why human:** 需真实窗口/容器环境，且是 CR-01 的回归验证

### 4. DevTools 冲突与错误提示呈现

**Test:** 打开目标页面 DevTools 后调用 read_page_content；对未加载新建 tab 调用工具
**Expected:** 工具卡片「失败」+ 契约文案「DevTools 已打开，请关闭后重试」/「当前标签页未加载页面，请先打开网页」
**Why human:** 工具卡片 UI 状态与文案呈现需 GUI 环境

### 5. webview 销毁清理实际触发

**Test:** AI 工具执行期间/之后关闭对应 tab，检查主进程日志
**Expected:** 日志输出「webview 销毁，已清理容器映射与 CDP 调试器状态」；后续工具调用无状态残留影响
**Why human:** 生命周期事件触发需真实 webview 创建/销毁

### 6. 大页面性能（ROADMAP SC#5）

**Test:** 打开 >1MB 大页面调用 read_page_content 计时
**Expected:** 5 秒内返回，期间 UI 可交互
**Why human:** 性能指标只能运行时测量

## Warnings（22-REVIEW 已记录，不重复计为新发现，建议随 gap 修复一并处理）

| ID | 摘要 | 建议 |
|----|------|------|
| WR-01 | dev-mode 抓包占用 debugger 槽位时 attachForAI 报误导性「DevTools 已打开」文案，且与 JSDoc「互不干扰」声明矛盾 | 区分占用来源给准确文案（cdp-manager.js:315-317） |
| WR-02 | UI-SPEC 2 条空状态文案未实现 | 已列入 Gaps #2 |
| WR-03 | open_link URL 校验大小写敏感且无 trim，与 renderer `/^(https?|realm):\/\//i` 不一致 | 改解析式校验（new URL + protocol 白名单 + trim） |
| IN-01~07 | 截断单位语义、TOCTOU 竞态、params 防御、未使用导入、bundle 重生成命令缺 banner、dev-mode 导航漏抓 | Info 级，后续迭代处理 |

## Gaps Summary

**Gap #1（BLOCKER）：open_link 容器校验数据源错误（CR-01）— 阻碍 CDP-04**
全新 profile 下 open_link 默认路径 100% 失败且报错文案事实性错误。修复：ai-manager.js:1172 与 925 两处校验改用 `containerManager.getContainers()`。验证方式：模拟全新 profile 后默认路径应成功。

**Gap #2（minor）：UI-SPEC 空状态文案 2 条未实现（WR-02）**
契约 8 条文案只实现 6 条。extract_links 0 链接与 read_page_content 无内容时未携带契约 message。Warning 级，随 Gap #1 修复一并补齐。

两处 gap 修复范围均限于 ai-manager.js 单文件，预计一个 gap-closure plan 即可覆盖。修复完成 + Human Verification #1-6 通过后，CDP-04 与 Phase 22 方可验收。

---

_Verified: 2026-08-02T05:49:24Z_
_Verifier: Claude (gsd-verifier)_
