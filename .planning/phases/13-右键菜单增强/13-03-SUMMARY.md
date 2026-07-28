---
phase: 13
plan: 03
subsystem: context-menu
tags: [context-menu, favicon, electron-menu, ipc, gap-closure, pinned-tabs]
gap_closure: true
requirements: [GAP-5, GAP-6, GAP-7, GAP-8, GAP-9]
requirements-completed: [GAP-5, GAP-6, GAP-7, GAP-8, GAP-9]
dependency_graph:
  requires: [context-menu-manager.js, buildWebMenu, showWebContextMenu, renderTabs]
  provides: [createTabElement, tab.faviconUrl 持久化, contextInfo.editFlags, contextInfo.pageURL]
  affects: [main.js, src/renderer.js, src/styles/main.css, tab-manager.js, 13-UAT.md]
tech_stack:
  added: []
  patterns: [page-favicon-updated 事件 → tab state → DOM img → updateTab 持久化（仿 page-title-updated 模式）, Tab DOM 创建单一入口 createTabElement]
key_files:
  created: []
  modified:
    - main.js
    - src/renderer.js
    - src/styles/main.css
    - tab-manager.js
    - .planning/phases/13-右键菜单增强/13-UAT.md
decisions:
  - "删除遗留 webContents context-menu handler 后，网页右键菜单唯一来源为新管线（renderer → show-web-context-menu IPC → buildWebMenu）"
  - "三处 Tab DOM 创建点抽取 createTabElement(tab) 公共函数，杜绝后续三处漂移"
  - "基础 .tab-favicon 加 margin-right:6px，使既有 .tab-pinned .tab-favicon{margin-right:0} 规则获得其设计预期的覆盖对象"
  - "固定 Tab 关闭按钮维持现状（既有 .tab-close opacity 0→hover 1 已满足 hover 才显示，无需改动）"
metrics:
  duration: 9min
  completed: "2026-07-28T05:08:23Z"
  tasks_completed: 4
  tasks_total: 4
  files_created: 0
  files_modified: 5
status: complete
---

# Phase 13 Plan 03: Gap 关闭 — 右键菜单管线解竞 + favicon 数据流 Summary

删除与新管线竞争的遗留 context-menu handler 使 buildWebMenu 成为唯一菜单来源（GAP-7/8/9 同根因），补发 contextInfo 的 editFlags/pageURL 潜伏缺陷，实现 favicon 完整数据流让固定标签页显示网站图标（GAP-6），并按方案 A 决策修正 UAT test 5 期望（GAP-5）。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 删除 main.js 遗留 context-menu handler（GAP-7/8/9 根因） | 62693d9 | main.js |
| 2 | contextInfo 补发 editFlags 和 pageURL | a485061 | src/renderer.js |
| 3 | 实现 favicon 数据流 + 固定标签图标显示（GAP-6） | c793bc6 | src/renderer.js, src/styles/main.css, tab-manager.js |
| 4 | 更新 UAT test 5 期望为逐条 LIFO 语义（GAP-5） | fe6de6d | 13-UAT.md |

## What Was Built

### Task 1: main.js（删除遗留 handler）

删除 `web-contents-created` 注册处约 166-178 行的旧 `contents.on('context-menu')` handler（菜单模板为检查元素/后退/前进/刷新/复制 5 项）。该 handler 与新管线（renderer IPC 往返 → buildWebMenu 13+ 项）竞争且先弹出，是 UAT tests 7/8/9 同根因。检查元素功能已被 context-menu-manager.js buildGeneralMenuItems 覆盖，无功能损失。`web-contents-created` 的其他用途（setWindowOpenHandler、导航事件、before-input-event、will-navigate）均保留未动。

验证：`grep "\.on('context-menu'" main.js` 无结果；`ipcMain.on('show-web-context-menu')` 等三个新管线监听器保留（1019/1031/1052 行）。

### Task 2: src/renderer.js（contextInfo 补发字段）

webview context-menu 事件处理（784 行起）发送的 contextInfo 补充：
- `editFlags: params.editFlags || {}` — 透传 Electron 编辑能力标志（canCut/canCopy/canPaste/canSelectAll），使 buildGeneralMenuItems 的剪切/复制/粘贴/全选按上下文正确启用禁用
- `pageURL: webview.getURL()` — 供"查看页面源代码"打开真实 `view-source:` URL

字段名与 context-menu-manager.js 消费方（165 行 `contextInfo.editFlags || {}`、243 行 `contextInfo.pageURL`）精确对齐。

### Task 3: favicon 数据流（GAP-6）

**A. 事件监听（src/renderer.js:794）** — `page-favicon-updated` 监听：取 `e.favicons[0]` → 写 `tab.faviconUrl` → 同步 DOM `img.src` 并取消隐藏 → `window.realmAPI.updateTab(tabId, { faviconUrl })` 持久化（仿 page-title-updated 模式）。

**B. createTabElement(tab) 公共函数（src/renderer.js:377）** — 抽取三处复制粘贴的 Tab DOM 创建点（createTab:425、restoreTabs:1131、renderTabs 重建分支:1338）为单一入口，均包含 `img.tab-favicon`（无 faviconUrl 时 `display:none` 不占位）。restoreTabs 恢复时 faviconUrl 随持久化数据还原，重启后不丢失。

**C. CSS（src/styles/main.css:1160）** — 基础 `.tab-favicon`（16px、flex-shrink:0、margin-right:6px、vertical-align:middle）+ `.tab-pinned .tab-content` 居中。基础 margin-right 使既有 `.tab-pinned .tab-favicon{margin-right:0}`（1128 行）获得其设计预期的覆盖对象，无冲突。

**D. 固定 Tab 关闭按钮** — 既有 `.tab-close{opacity:0}` + `.tab:hover .tab-close{opacity:1}` 已是 hover 才显示，按计划"若现有规则已是 hover 显示则无需改动"未动。

**E. 持久化白名单（tab-manager.js:161）** — `updateTab` 硬白名单新增 `faviconUrl` 分支（原白名单仅 url/title/lastActiveAt，faviconUrl 必被静默丢弃）。IPC 接线（preload updateTab → tab:update → tabManager.updateTab）为透传，无需改动。

### Task 4: 13-UAT.md（GAP-5，无代码）

按 2026-07-28 产品决策（方案 A 维持逐条 LIFO）：
- Tests 区 test 5 expected 改为逐条 LIFO 语义；result: issue → pass，注明 `resolved-by-decision: 方案 A`
- Gaps 区 test 5 条目 status: failed → resolved，补 `resolution` 决策结论
- Summary 计数 passed 5 → 6、issues 5 → 4（total 10 不变，计数自洽）

## Deviations from Plan

None — plan executed exactly as written.

（Task 3 基础 `.tab-favicon` 的 `margin-right: 6px` 为计划"确认现有 .tab-pinned .tab-favicon 规则与新基础样式不冲突"的落地方式：既有 pinned 规则 margin-right:0 预设了基础样式存在非零 margin-right，本次补齐使设计意图闭环，非范围外改动。）

## Known Stubs

None — 所有实现均为功能完整代码。favicon 加载失败回退图标为计划明确的非目标（保持 display:none，不引入默认图标资源）。

## Verification Results

- `! grep "\.on('context-menu'" main.js`: PASS（无 webContents 级注册）
- `ipcMain.on('show-web-context-menu')` / `'context-menu:closed-tab'` / `'show-tab-context-menu'` 保留: PASS
- `grep editFlags src/renderer.js` + `grep pageURL src/renderer.js`: PASS（798/799 行）
- `grep page-favicon-updated src/renderer.js`: PASS（794 行）
- `grep tab-favicon src/renderer.js` + `grep tab-favicon src/styles/main.css`: PASS（391/804 + 1128/1160 行）
- `grep faviconUrl tab-manager.js`: PASS（161 行白名单）
- `grep resolved-by-decision 13-UAT.md` + `grep 方案 A 13-UAT.md`: PASS
- `node --check main.js / src/renderer.js / tab-manager.js`: PASS（语法检查全部通过）
- UAT tests 6/7/8/9/10 重验: 待 end-of-phase 人工验证（human_verify_mode: end-of-phase）

## Threat Flags

None — faviconUrl 仅用于 img.src 展示（T-13-06 accept，与计划 threat model 一致）；editFlags/pageURL 来自渲染进程仅用于菜单构建不执行（信任边界内）；无新依赖安装。

## Self-Check: PASSED

- FOUND: main.js（遗留 handler 已删）
- FOUND: src/renderer.js（editFlags/pageURL/page-favicon-updated/createTabElement）
- FOUND: src/styles/main.css（.tab-favicon 基础样式）
- FOUND: tab-manager.js（faviconUrl 白名单）
- FOUND: .planning/phases/13-右键菜单增强/13-UAT.md（test 5 改判）
- FOUND: commit 62693d9 (Task 1)
- FOUND: commit a485061 (Task 2)
- FOUND: commit c793bc6 (Task 3)
- FOUND: commit fe6de6d (Task 4)
