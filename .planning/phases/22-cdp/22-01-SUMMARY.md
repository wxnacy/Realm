---
phase: 22-cdp
plan: 01
subsystem: infra
tags: [cdp, electron, debugger, readability, esbuild]

# Dependency graph
requires:
  - phase: 12-dev-mode
    provides: cdp-manager.js 基础（Network 域抓取、debuggerStates Map、attach/detach 生命周期）
provides:
  - attachForAI/detachForAI/executeCommand — AI 工具专用的 CDP 调试器生命周期管理
  - lib/readability-bundle.js — 可经 Runtime.evaluate 注入的 Mozilla Readability minified IIFE
affects: [22-cdp plan 02/03, 智能上下文引用, 任务自主执行, 脚本生成]

# Tech tracking
tech-stack:
  added: ["@mozilla/readability@0.6.0 (dev)", "esbuild@0.28.1 (dev)"]
  patterns:
    - "AI 调试器与 Network 抓取调试器经 debuggerStates.source 字段区分，互不干扰"
    - "CDP 命令统一经 executeCommand 超时保护（默认 10s Promise.race）"
    - "第三方库打包产物头部保留许可证归属 + 重新生成命令"

key-files:
  created: [lib/readability-bundle.js]
  modified: [cdp-manager.js, package.json]

key-decisions:
  - "AI 调试器附加与 Network 抓取附加经 state.source 区分（ai-tool vs 隐式抓取），detachForAI 只断开自己附加的连接（D-03 用完即卸）"
  - "Readability.js 为 CommonJS 单文件导出，esbuild --global-name=Readability 打包后全局变量即构造函数本身，可直接 new Readability(doc)"

patterns-established:
  - "AI 工具 CDP 调用三段式：attachForAI → executeCommand → detachForAI（finally 中确保断开）"
  - "executeCommand 超时保护：Promise.race + setTimeout reject + finally clearTimeout"

requirements-completed: [CDP-01]

coverage:
  - id: D1
    description: "cdp-manager.js 导出 attachForAI/detachForAI/executeCommand 三个 AI 工具调试器管理方法"
    requirement: CDP-01
    verification:
      - kind: other
        ref: "node -e \"require('./cdp-manager')\" + typeof 检查三个导出均为 function"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/readability-bundle.js 存在且为可注入的 Readability minified IIFE（全局 Readability 构造函数 + parse 方法）"
    requirement: CDP-01
    verification:
      - kind: other
        ref: "node vm 沙箱执行 bundle，验证 typeof Readability === 'function' 且 prototype.parse 为 function；node --check 语法通过"
        status: pass
    human_judgment: false
  - id: D3
    description: "DevTools 冲突检测、10s 超时保护、webview 销毁状态清理等运行时行为"
    requirement: CDP-01
    verification: []
    human_judgment: true
    rationale: "需要真实 Electron webview + DevTools 交互场景，静态验证无法覆盖；由后续 UAT 配合 AI 工具调用验证"

# Metrics
duration: 7min
completed: 2026-08-02
status: complete
---

# Phase 22 Plan 01: CDP 管理器扩展 + Readability 打包 Summary

**cdp-manager 新增 AI 工具调试器三段式 API（attachForAI/executeCommand/detachForAI，含 DevTools 冲突检测与 10s 超时保护）+ Mozilla Readability 0.6.0 minified IIFE 可注入 bundle**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-02T04:26:16Z
- **Completed:** 2026-08-02T04:33:00Z
- **Tasks:** 2
- **Files modified:** 3（cdp-manager.js、package.json、lib/readability-bundle.js 新建）

## Accomplishments

- cdp-manager.js 扩展 AI 工具专用调试器管理：按需附加、域启用（默认 Runtime）、用完即卸、DevTools 冲突明确报错（D-01~D-04）
- executeCommand 提供统一的 CDP 命令超时保护（默认 10s，Promise.race + finally clearTimeout 无悬挂定时器）
- lib/readability-bundle.js：Readability 0.6.0 经 esbuild 打包为 32.5KB minified IIFE，vm 沙箱验证全局构造函数与 parse 方法可用，头部保留 Apache 2.0 归属声明与重新生成命令
- cleanup() 退出时断开所有 source 为 ai-tool 的调试器，防止连接泄漏

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展 cdp-manager.js 添加 AI 工具方法** - `680a166` (feat)
2. **Task 2: 创建 Readability 库打包文件** - `bf64caf` (feat)

## Files Created/Modified

- `lib/readability-bundle.js` — Mozilla Readability minified IIFE（新建，32.5KB，注入 webview 后 `new Readability(doc).parse()` 直接可用）
- `cdp-manager.js` — 新增 attachForAI/detachForAI/executeCommand + cleanup AI 状态清理 + 顶部 Readability 用途注释
- `package.json` — devDependencies 新增 @mozilla/readability@0.6.0、esbuild@0.28.1

## Decisions Made

- **esbuild 显式安装为 devDependency 替代 `npx esbuild` 临时拉取**：构建工具链入 package.json 可复现，版本锁定（0.28.1）
- **bundle 全局语义验证后再定稿**：Readability.js 是 CommonJS 单文件（`module.exports = Readability` 构造函数），esbuild `--global-name=Readability` 打包后全局变量即构造函数本身，无需额外 wrapper — vm 沙箱实测确认
- **detachForAI 对已销毁 webContents 仍清理 debuggerStates 条目**：Electron 在 webContents 销毁时自动断开调试器，但 Map 条目需显式删除否则泄漏（支撑 must_have「webview 销毁时自动清理相关调试器状态」）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] detachForAI 在 webContents 已销毁路径补充状态清理**
- **Found during:** Task 1（扩展 cdp-manager.js）
- **Issue:** 计划字面值「wc.isDestroyed() 直接返回」会跳过 debuggerStates.delete，webview 销毁后 Map 条目残留（与 must_have「webview 销毁时自动清理相关调试器状态」冲突）
- **Fix:** 调整为先取 state 校验 source，wc 存活才 detach，最后无条件 delete Map 条目
- **Files modified:** cdp-manager.js
- **Verification:** node 语法检查 + 导出检查通过
- **Committed in:** `680a166`（Task 1 提交）

**2. [Rule 2 - Missing Critical] executeCommand 超时定时器补充 clearTimeout**
- **Found during:** Task 1（扩展 cdp-manager.js）
- **Issue:** 计划伪码的 setTimeout 在命令先于超时完成时不清除，定时器残留至超时触发（每次调用最长悬挂 10s）
- **Fix:** finally 块中 clearTimeout(timeoutId)
- **Files modified:** cdp-manager.js
- **Verification:** node 语法检查通过
- **Committed in:** `680a166`（Task 1 提交）

**3. [Rule 2 - Missing Critical] bundle 头部恢复 Apache 2.0 许可证归属声明**
- **Found during:** Task 2（Readability 打包）
- **Issue:** esbuild --minify 剥离源文件全部注释，含 Apache 2.0 要求的 copyright notice
- **Fix:** 重新打包时经 --banner:js 注入归属声明 + 用途 + 重新生成命令
- **Files modified:** lib/readability-bundle.js
- **Verification:** vm 沙箱复验构造函数/parse 可用，node --check 通过
- **Committed in:** `bf64caf`（Task 2 提交）

---

**Total deviations:** 3 auto-fixed（1 bug、2 missing critical）
**Impact on plan:** 均为正确性/合规性修复，无范围蔓延。bundle 大小 32.5KB 与计划「约 50KB」的估计有出入 — 0.6.0 版本 minify 后实际更小，功能完整性经 vm 沙箱验证，估计偏差不影响交付。

## Issues Encountered

None — 计划与 RESEARCH.md 的技术设计准确，实施顺畅。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CDP-01 基础设施就绪：plan 02/03 的 read_page_content/extract_links/open_link 工具可直接消费 attachForAI/executeCommand/detachForAI 三段式 API 与 readability-bundle
- 待后续计划处理：main.js webview destroyed 事件挂接 detachForAI（RESEARCH T7）、AI 工具注册进 ai-manager.js
- 运行时行为（DevTools 冲突提示、超时、真实页面内容提取）需 Electron GUI 环境 UAT 验证

## Self-Check: PASSED

- FOUND: lib/readability-bundle.js（33287 bytes）
- FOUND: cdp-manager.js 导出 attachForAI/detachForAI/executeCommand（typeof 均为 function）
- FOUND: commit 680a166（Task 1）、bf64caf（Task 2）于 git log

---
*Phase: 22-cdp*
*Completed: 2026-08-02*
