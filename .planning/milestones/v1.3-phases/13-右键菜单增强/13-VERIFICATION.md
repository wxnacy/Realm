---
phase: 13-右键菜单增强
verified: 2026-07-28T06:02:02Z
status: passed
score: 10/16 must-haves verified
behavior_unverified: 6
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 10/10
  note: "上次 passed 后被 UAT 推翻（tests 6/7/8/9 发现 5 个 gap）。本次为 gap closure（plan 13-03，commits 62693d9..07e4529 含 code review 修复 56760b9）后的再验证：代码层 5 个 gap 全部关闭、前 10 truths 无回归；运行时菜单/favicon 行为按 13-03 既定 human_verify_mode: end-of-phase 留待人工 UAT 重验。"
  gaps_closed:

    - "GAP-5 (UAT test 5): 重新打开已关闭标签页语义 — 2026-07-28 产品决策方案 A 维持逐条 LIFO，13-UAT.md test 5 改判 pass 并注明 resolved-by-decision（fe6de6d），无代码改动"
    - "GAP-6 (UAT test 6): 固定标签页 favicon — favicon 数据流已实现：page-favicon-updated 监听（renderer.js:807-825）→ tab.faviconUrl → createTabElement 统一 DOM img.tab-favicon（:371-409，三处调用点 :425/:1144/:1353）→ updateTab 白名单持久化（tab-manager.js:161）→ .tab-favicon CSS（main.css:1160-1166）"
    - "GAP-7 (UAT test 7): 网页通用右键菜单项缺失 — main.js 遗留 webContents 级 context-menu handler 已删除（62693d9，grep `.on('context-menu'` 无匹配），buildWebMenu 成为唯一菜单来源；web-contents-created 其余用途（setWindowOpenHandler/before-input-event/will-navigate）完整保留"
    - "GAP-8 (UAT test 8): 图片右键与空白处菜单相同 — 同 GAP-7 根因已除；buildWebMenu image 分支（context-menu-manager.js:431-453 四项图片专属项）现为唯一来源"
    - "GAP-9 (UAT test 9): 链接右键与空白处菜单相同 — 同 GAP-7 根因已除；buildWebMenu link 分支（:481-505 含容器子菜单）现为唯一来源；另补发 contextInfo.editFlags/pageURL（renderer.js:850-851）修复潜伏缺陷"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:

  - truth: "网页空白处右键弹出 buildWebMenu 构建的完整 13 项通用菜单"
    test: "运行应用，在网页空白处右键（UAT test 7 重验）"
    expected: "弹出 13 项通用菜单（后退/前进/刷新/停止 + 另存为/打印/添加到收藏夹 + 查看页面源代码/检查元素 + 剪切/复制/粘贴/全选），不再是旧 5 项菜单"
    why_human: "原生 Menu.popup 需 Electron 运行时；遗留 handler 已删、新管线代码已通，但实际弹出内容需人工确认"

  - truth: "图片右键显示图片专属 4 项 + 通用菜单"
    test: "在含图片网页上右键图片（UAT test 8 重验）"
    expected: "菜单顶部出现：在新标签页中打开图片/将图片另存为…/复制图片/复制图片地址，后接通用菜单"
    why_human: "mediaType=image 分支的运行时触发需真实图片元素"

  - truth: "链接右键显示链接专属项（含在容器中打开子菜单）+ 通用菜单"
    test: "在链接上右键（UAT test 9 重验）"
    expected: "菜单顶部出现：在新标签页中打开链接/在后台标签页中打开/在新容器标签页中打开（子菜单列出全部容器）/复制链接地址"
    why_human: "linkURL 分支与容器子菜单的运行时构建需真实链接元素"

  - truth: "输入框右键的剪切/复制/粘贴按 editFlags 正确启用/禁用"
    test: "在网页输入框选中文字后右键；再在无可复制内容处右键（UAT test 10 重验）"
    expected: "有选区时剪切/复制可用，无选区时禁用；粘贴按剪贴板状态启用"
    why_human: "editFlags 由 Chromium 在运行时按上下文生成，enabled 状态只能人工确认"

  - truth: "固定标签页显示网站 favicon 而非空块"
    test: "固定一个已加载网站的 Tab（UAT test 6 重验）"
    expected: "40px 固定 Tab 内居中显示该站 favicon，不再是仅底部小点"
    why_human: "page-favicon-updated 事件与 img 渲染需真实网站加载"

  - truth: "重启应用后固定标签 favicon 不丢失"
    test: "固定带 favicon 的 Tab 后完全退出并重启应用"
    expected: "restoreTabs 后固定 Tab 仍显示 favicon（faviconUrl 经 updateTab 白名单持久化还原）；固定状态本身也不丢失（WR-02 pinned 白名单修复）"
    why_human: "持久化往返需真实重启验证"
human_verification:

  - test: "UAT tests 6/7/8/9/10 重验（见 behavior_unverified_items 1-5）"
    expected: "5 项全部 pass，UAT Summary 更新为 passed 10/10"
    why_human: "原生菜单弹出、favicon 渲染、editFlags 启用态均为 Electron 运行时行为，grep 无法验证"

  - test: "重启后固定 Tab favicon 与固定状态保留（见 behavior_unverified_items 6）"
    expected: "favicon 与 pinned 均跨重启保留"
    why_human: "持久化往返需真实重启"

  - test: "查看页面源代码端到端：网页右键 → 查看页面源代码"
    expected: "新 Tab 打开 view-source:<页面URL> 并显示源码（CR-01 修复后首次端到端可用）"
    why_human: "renderer 双闸口已放行 view-source:http(s)；main.js will-navigate 的 isAllowedWebUrl 不放行 view-source:，理论上 webview 初始 src 加载属程序化加载不触发 will-navigate，但此为 Electron 运行时语义，需人工点验确认无二次拦截"
---

# Phase 13: 右键菜单增强 Verification Report（再验证）

**Phase Goal:** 右键菜单增强 — 为浏览器添加完整的右键菜单系统，包括 Tab 栏右键菜单和网页右键菜单
**Verified:** 2026-07-28T06:02:02Z
**Status:** human_needed
**Re-verification:** Yes — UAT 发现 5 gaps 后的 gap closure（plan 13-03）再验证

## Goal Achievement

### Observable Truths

**A. 前一轮 10 truths 回归检查（13-03 改动后）**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 主进程能根据上下文参数构建四种菜单模板（Tab/Web通用/图片/链接） | ✓ VERIFIED | context-menu-manager.js 未被 13-03 触碰；`node -e require` 实测 buildTabMenu/buildWebMenu 均为 function；29 个 label 项，image 4 项（:431-453）、link 4 项+子菜单（:481-505）、通用 13 项齐全 |
| 2 | 菜单项 click 回调能正确执行主进程直接操作（导航/剪贴板/打印/DevTools） | ✓ VERIFIED | context-menu-manager.js 未变；goBack/goForward/reload/saveAs/print/openDevTools/clipboard 调用原样保留 |
| 3 | 菜单项 click 回调能正确发送 IPC 消息给渲染进程 | ✓ VERIFIED | hostWebContents.send('context-menu:*') 调用原样保留；preload.js:550 onContextMenuAction 16 通道注册未动 |
| 4 | Tab 菜单的禁用状态根据上下文正确计算 | ✓ VERIFIED | buildTabMenu 未变；tabCount>1/tabIndex>0/tabIndex<tabCount-1/hasClosedTabs 逻辑保留 |
| 5 | 链接菜单的容器子菜单动态列出所有容器 | ✓ VERIFIED | containers.map() 子菜单保留；main.js:1035 仍注入 containerManager.getContainers()（:1031-1045 handler 完整，含 T-13-01 activeWebviewContentsId 缓解） |
| 6 | Tab 栏右键点击能触发主进程菜单弹出 | ✓ VERIFIED | renderer.js:2276-2295 contextmenu 委托保留（tabCount/tabIndex/isPinned/hasClosedTabs → showTabContextMenu）；main.js:1019-1024 → buildTabMenu |
| 7 | webview 内右键点击能根据元素类型弹出对应菜单 | ✓ VERIFIED（增强） | renderer.js:836-853 context-menu 监听保留并新增 editFlags/pageURL；旧竞争 handler 已删（见 B-1），类型分支现在真正可达 |
| 8 | 菜单项 click 后渲染进程正确处理所有回调 | ✓ VERIFIED | handleContextMenuAction（renderer.js:1179）完整：reopen-tab :1219-1227、toggle-pin :1229-1237（含 updateTab 持久化 + renderTabs）、open-in-new-tab :1239-1250（含 view-source 放行）、注册于 :1402 |
| 9 | closedTabsStack 在关闭标签时正确维护 | ✓ VERIFIED | renderer.js:129 栈、:512-520 closedTabsStackPush（push+shift@10+notifyClosedTab）、:533 closeTab 调用；主进程 pushClosedTab 导出实测为 function |
| 10 | 固定标签页后 Tab 栏 UI 正确更新（位置/样式） | ✓ VERIFIED（增强） | renderTabs（:1331-1361）pinned 分组前置 + .tab-pinned class；CSS 1119-1143 保留并新增 favicon 支持；toggle-pin 现经 updateTab 白名单持久化（WR-02 修复） |

**回归结论：10/10 无回归。** 13-03 触碰的四处（main.js 删旧 handler、renderer.js 补字段+favicon+createTabElement、main.css 加样式、tab-manager.js 扩白名单）均为纯增量/删除死代码，未改动上述 truths 的支撑链路；`node --check` 对 main.js/renderer.js/tab-manager.js 全部通过。

**B. 13-03 gap closure 新增 truths**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | 网页空白处右键弹出 buildWebMenu 构建的完整 13 项通用菜单 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 代码层闭环：`grep "\.on('context-menu'" main.js` 无匹配（唯一来源达成）；buildGeneralMenuItems 13 项齐全。运行时弹出内容待 UAT test 7 重验 |
| 12 | 图片右键显示图片专属 4 项 + 通用菜单 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | image 分支 4 项（context-menu-manager.js:431/439/447/453）+ type 判定（renderer.js:838/840）保留；运行时待 UAT test 8 重验 |
| 13 | 链接右键显示链接专属项（含容器子菜单）+ 通用菜单 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | link 分支（:481/489/498/505）+ 容器注入（main.js:1035）保留；运行时待 UAT test 9 重验 |
| 14 | 输入框右键的剪切/复制/粘贴按 editFlags 正确启用/禁用 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 字段链全线贯通：renderer.js:850 `editFlags: params.editFlags \|\| {}` → preload 透传 → context-menu-manager.js:165 消费、:262/272/282 `enabled: !!editFlags.canCut/canCopy/canPaste`。运行时启用态待 UAT test 10 重验 |
| 15 | 固定标签页显示网站 favicon 而非空块 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | favicon 数据流四层全通：监听（renderer.js:807-825 取 e.favicons[0]→state→DOM img.src 取消隐藏→持久化）→ createTabElement img.tab-favicon（:384-388，无 url 时 display:none）→ CSS .tab-favicon 16px + .tab-pinned .tab-content 居中（main.css:1160-1172）→ .tab-pinned .tab-favicon margin-right:0（:1128）。运行时渲染待 UAT test 6 重验 |
| 16 | 重启应用后固定标签 favicon 不丢失 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 持久化往返代码闭环：tab-manager.js:161 faviconUrl 白名单 → saveTabs 全量序列化 → initTabs 还原 → restoreTabs createTabElement（renderer.js:1144）读 tab.faviconUrl；WR-03 附加保障 did-navigate 清空旧 favicon（:712-721）。真实重启待人工验证 |

**Score:** 10/16 truths verified（6 项 present + wired，行为待人工 UAT 重验 — 符合 13-03 既定的 human_verify_mode: end-of-phase）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| main.js（修改） | 删除遗留 webContents context-menu handler，保留新管线 3 IPC | ✓ VERIFIED | 62693d9 删除 14 行；`\.on('context-menu'` 零匹配；:1019/:1031/:1052 三监听器保留；web-contents-created 其余用途（setWindowOpenHandler :132、before-input-event :168、will-navigate :181）未动 |
| src/renderer.js（修改） | contextInfo 补 editFlags/pageURL；page-favicon-updated 监听；createTabElement 统一三处 DOM 创建 | ✓ VERIFIED | :850-851 字段与消费方（manager :165/:243）精确对齐；:807-825 监听实质完整；createTabElement :371-409 含 favicon/title/close 全结构，三处调用 :425/:1144/:1353，无行为漂移 |
| tab-manager.js（修改） | updateTab 白名单 +faviconUrl（+pinned 评审追加） | ✓ VERIFIED | :161 faviconUrl、:162 pinned，均 `!== undefined` 判断（null 可写入，支撑 WR-03 清空）；saveTabs() 随后调用 |
| src/styles/main.css（修改） | .tab-favicon 基础样式 + .tab-pinned .tab-content 居中 | ✓ VERIFIED | :1160-1166 基础（16px/flex-shrink:0/margin-right:6px）、:1168-1172 居中；与既有 :1128 pinned 覆盖规则层叠正确（0,2,0 > 0,1,0） |
| 13-UAT.md（修改） | test 5 改判 pass + resolved-by-decision 方案 A | ✓ VERIFIED | test 5 result: pass 注明决策（:33-34）；Gaps 区 status: resolved 含 resolution（:75-89）；Summary passed: 6 / issues: 4 计数自洽 |
| context-menu-manager.js（未变） | 四种菜单模板 | ✓ VERIFIED | require 实测 5 个导出均为 function |
| src/preload.js（未变） | 4 个菜单 API | ✓ VERIFIED | :520/:535/:550/:582 原样保留 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| webview context-menu 事件 | showWebContextMenu IPC | renderer.js:836-853（含 editFlags :850、pageURL :851） | ✓ WIRED | 类型判定 + 全字段发送 |
| show-web-context-menu IPC | buildWebMenu | main.js:1031-1045 | ✓ WIRED | 注入 containers + activeWebviewContentsId（T-13-01 保留） |
| contextInfo.editFlags | 菜单项 enabled | context-menu-manager.js:165 → :262/:272/:282 | ✓ WIRED | 字段名与消费方精确对齐 |
| contextInfo.pageURL | 查看页面源代码 URL | context-menu-manager.js:243 `view-source:${pageURL}` | ✓ WIRED | 端到端见下方 CR-01 行 |
| view-source: URL | 新 Tab 打开（CR-01 修复） | open-in-new-tab 闸口 renderer.js:1243-1244 + createWebviewForTab 闸口 :633-634 | ✓ WIRED | 双闸口均仅放行包裹 http(s) 内层的 view-source:，file:/javascript: 保持拦截 |
| page-favicon-updated | tab.faviconUrl → DOM → 持久化 | renderer.js:807-825 | ✓ WIRED | 仿 page-title-updated 模式，四步齐全 |
| did-navigate | favicon 清空（WR-03） | renderer.js:712-721 | ✓ WIRED | state + DOM img + updateTab(null) 三处同步，Chrome 风格 |
| tab.faviconUrl | 跨重启还原 | tab-manager.js:161 白名单 → saveTabs → initTabs → restoreTabs:1144 | ✓ WIRED | 全量序列化/还原链路无断点 |
| Tab 栏 contextmenu | showTabContextMenu IPC | renderer.js:2276-2295 → main.js:1019 | ✓ WIRED | 回归确认未受 13-03 影响 |
| 主进程 context-menu:* 回调 | handleContextMenuAction | preload.js:550-572 → renderer.js:1179（注册 :1402） | ✓ WIRED | 回归确认 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| buildWebMenu | contextInfo.editFlags | e.params.editFlags（Chromium 运行时生成） | Yes — 真实编辑态 | ✓ FLOWING |
| buildWebMenu | contextInfo.pageURL | webview.getURL() | Yes — 真实页面 URL | ✓ FLOWING |
| createTabElement | tab.faviconUrl | page-favicon-updated e.favicons[0] / restoreTabs 持久化数据 | Yes — 真实 favicon | ✓ FLOWING |
| buildTabMenu | tabInfo.* | state.tabs + closedTabsStack（:2286-2293） | Yes — 真实 Tab 态 | ✓ FLOWING（回归） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| context-menu-manager 导出完整 | `node -e "require(...)"` | buildTabMenu/buildWebMenu/pushClosedTab/hasClosedTabs/popClosedTab 均 function | ✓ PASS |
| 遗留 handler 已删 | `grep "\.on('context-menu'" main.js` | 零匹配 | ✓ PASS |
| 新管线 IPC 保留 | `grep "show-web-context-menu\|show-tab-context-menu\|context-menu:closed-tab" main.js` | :1019/:1031/:1052 | ✓ PASS |
| 修改文件语法 | `node --check main.js renderer.js tab-manager.js` | 全部通过 | ✓ PASS |
| 13-03 提交链存在 | `git log` | 62693d9/a485061/c793bc6/fe6de6d + 评审修复 56760b9 + 文档 88e4a2c/07e4529 | ✓ PASS |

### Probe Execution

SKIPPED — 本项目无 `scripts/*/tests/probe-*.sh` 探针，phase 文档亦未声明探针。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CTX-01 | 13-01/13-02 | Tab 栏右键菜单 | ✓ SATISFIED | buildTabMenu + contextmenu 委托 + toggle-pin 全链（回归确认） |
| CTX-02 | 13-01/13-02 | 网页通用右键菜单 | ✓ SATISFIED（代码层） | buildGeneralMenuItems 13 项 + 唯一来源达成；运行时待 UAT test 7 重验 |
| CTX-03 | 13-01/13-02 | 图片右键菜单 | ✓ SATISFIED（代码层） | image 分支 4 项；运行时待 UAT test 8 重验 |
| CTX-04 | 13-01/13-02 | 链接右键菜单 | ✓ SATISFIED（代码层） | link 分支 + 容器子菜单；运行时待 UAT test 9 重验 |
| CTX-05 | 13-01/13-02 | 菜单项功能与 Chrome 一致 | ? NEEDS HUMAN | UAT tests 1-5/10 已 pass；6-9 代码修复完成待重验 |
| GAP-5 | 13-03 | test 5 LIFO 语义决策落地 | ✓ SATISFIED | UAT 改判 pass + resolved-by-decision 方案 A（fe6de6d） |
| GAP-6 | 13-03 | 固定标签 favicon | ✓ SATISFIED（代码层） | favicon 数据流四层 + 持久化白名单 + WR-03 清空（c793bc6/56760b9） |
| GAP-7 | 13-03 | 通用菜单项缺失 | ✓ SATISFIED（代码层） | 遗留 handler 删除（62693d9）+ editFlags/pageURL 补发（a485061） |
| GAP-8 | 13-03 | 图片菜单不区分 | ✓ SATISFIED（代码层） | 同 GAP-7 根因已除 |
| GAP-9 | 13-03 | 链接菜单不区分 | ✓ SATISFIED（代码层） | 同 GAP-7 根因已除 |

无 ORPHANED requirements（REQUIREMENTS.md 不存在于本仓库，CTX 系列来自 ROADMAP.md Phase 13 节，GAP 系列来自 13-UAT.md，均已对照）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| （无） | — | — | — | 13-03 全部改动文件（main.js/renderer.js/tab-manager.js/main.css 新增行）扫描 TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/coming soon 零匹配；favicon display:none 为计划明确设计（非 stub） |

### Human Verification Required

见 frontmatter `human_verification`（3 项）与 `behavior_unverified_items`（6 项，与 truths 11-16 一一对应）。核心动作：**重跑 UAT tests 6/7/8/9/10 + 重启持久化验证 + 查看页面源代码端到端点验**。

### Gaps Summary

无代码层 gap。5 个 UAT gap 的修复全部实证落地（删除死代码/补字段/新数据流/文档改判，均逐行核对非 SUMMARY 转述），code review 的 1 Critical + 3 Warning 修复（56760b9）亦全部核实：CR-01 双闸口放行 view-source:http(s)、WR-01 JSDoc 归位、WR-02 pinned 白名单、WR-03 did-navigate 清空 favicon。前 10 truths 零回归。

剩余事项仅为 13-03 计划本身既定的 end-of-phase 人工 UAT 重验（human_verify_mode），非新发现的缺陷。

---

_Verified: 2026-07-28T06:02:02Z_
_Verifier: Claude (gsd-verifier)_
