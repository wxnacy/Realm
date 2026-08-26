---
phase: 32-autofill-credential-engine
plan: 02
subsystem: autofill
tags: [form-detection, autofill, credentials, webview-preload, native-setter, mutation-observer]

# Dependency graph
requires:
  - phase: 32-autofill-credential-engine
    plan: 01
    provides: credential-manager.js, 5 个 credential:* IPC 通道
provides:
  - FormDetector 表单检测引擎（两层检测 + MutationObserver）
  - AutofillEngine 自动填充引擎（native setter + 框架兼容）
  - credentialAPI 暴露给渲染进程
  - 保存凭据提示横幅 UI（Chrome 风格三按钮）
  - autofill/fillForm 互斥机制
affects: [32-autofill-credential-engine, autofill, credential-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [FormDetector two-layer detection, AutofillEngine native setter, credential banner pattern]

key-files:
  created: []
  modified: [src/webview-preload.js, src/preload.js, src/renderer.js, src/index.html, src/styles/main.css]

key-decisions:
  - "FormDetector 使用 WeakSet 跟踪已检测表单，避免重复绑定 submit 监听"
  - "AutofillEngine 使用 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set 获取 native setter，兼容 React/Vue"
  - "MutationObserver 使用 300ms 防抖避免 SPA 路由切换时频繁触发"
  - "credentialAPI 作为 realmAPI 的子对象暴露，不单独创建 contextBridge 命名空间"
  - "横幅 10 秒自动消失，ESC 键和点击外部等同于暂不"

patterns-established:
  - "表单检测引擎模式：WeakSet 去重 + 两层检测 + MutationObserver 防抖监听"
  - "native setter 填充模式：获取原生 setter + 触发 input/change 事件"
  - "凭据横幅模式：fixed 定位 + CSS 动画 + 定时自动消失 + 按钮事件绑定"

requirements-completed: [AF-09, AF-01, AF-03, AF-08, AF-05]

coverage:
  - id: D1
    description: "FormDetector 表单检测引擎（scanForLoginForms, findUsernameField, detectFormType, extractCredentials, attachSubmitListener）"
    requirement: AF-09
    verification:
      - kind: other
        ref: "grep -c 'FormDetector' src/webview-preload.js — 输出 10"
        status: pass
    human_judgment: false
  - id: D2
    description: "AutofillEngine 自动填充引擎（fillCredentials, setInputValue with native setter）"
    requirement: AF-03
    verification:
      - kind: other
        ref: "grep -c 'nativeSetter' src/webview-preload.js — 输出存在"
        status: pass
    human_judgment: false
  - id: D3
    description: "credentialAPI 暴露（saveCredential, getCredential, deleteCredential, markNeverSave, isNeverSave）"
    requirement: AF-01
    verification:
      - kind: other
        ref: "grep -c 'credentialAPI' src/preload.js — 输出存在"
        status: pass
    human_judgment: false
  - id: D4
    description: "保存凭据横幅 UI（三按钮 + 10 秒自动消失 + 域名显示）"
    requirement: AF-01
    verification:
      - kind: other
        ref: "grep -c 'credentialSaveBanner' src/renderer.js — 输出存在"
        status: pass
    human_judgment: false
  - id: D5
    description: "autofill/fillForm 互斥机制（pause/resume IPC + autofillPaused 标志）"
    requirement: AF-08
    verification:
      - kind: other
        ref: "grep -c 'autofill:pause' src/webview-preload.js — 输出存在"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-13
status: complete
---

# Phase 32 Plan 02: 表单检测引擎 + 自动填充注入 + 保存横幅 UI Summary

**FormDetector 两层登录表单检测 + AutofillEngine native setter 填充 + Chrome 风格凭据保存横幅 + credentialAPI 暴露**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-13T10:37:52Z
- **Completed:** 2026-08-13T10:43:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- 在 webview-preload.js 中实现 FormDetector 表单检测引擎（两层检测：password 字段存在 + 多字段特征匹配）
- 实现 AutofillEngine 自动填充引擎，使用 native setter 兼容 React/Vue 等前端框架
- 添加 autofill/fillForm 互斥机制（pause/resume IPC 监听，fillForm 优先）
- MutationObserver 持续监听 DOM 变更，300ms 防抖处理 SPA 动态加载
- 在 preload.js 中暴露 credentialAPI（5 个方法：save/get/delete/markNeverSave/isNeverSave）
- 在 index.html 中添加 Chrome 风格保存凭据横幅 HTML
- 在 main.css 中添加横幅样式（滑入动画、z-index 9997、44px 高度）
- 在 renderer.js 中实现横幅显示逻辑（10 秒自动消失、ESC 键隐藏、域名提取去 www 前缀）

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展 webview-preload.js — 表单检测 + 自动填充 + 互斥** - `ca0f3ec` (feat)
2. **Task 2: 暴露 credentialAPI + 保存横幅 UI + 自动填充协调** - `8dfc626` (feat)

## Files Created/Modified

- `src/webview-preload.js` - FormDetector + AutofillEngine + 互斥监听 + MutationObserver（扩展）
- `src/preload.js` - credentialAPI 暴露 5 个凭据管理方法（扩展）
- `src/renderer.js` - 保存凭据横幅逻辑 + 自动填充协调 + ipc-message 凭据处理（扩展）
- `src/index.html` - 凭据保存横幅 HTML 结构（扩展）
- `src/styles/main.css` - 横幅样式 + CSS 变量（扩展）

## Decisions Made

- FormDetector 使用 WeakSet 跟踪已检测表单，避免重复绑定 submit 监听器
- AutofillEngine 使用 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set 获取 native setter，兼容 React/Vue 框架的 value 拦截
- MutationObserver 使用 300ms 防抖避免 SPA 路由切换时频繁触发扫描
- credentialAPI 作为 realmAPI 的子对象暴露，保持 API 组织一致性
- 横幅 10 秒自动消失，ESC 键等同于「暂不」，不保存凭据也不标记永不保存

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 表单检测引擎和自动填充 UI 已完成，Phase 32 前端部分全部就绪
- Phase 33 可实现凭据管理 UI（查看/删除已保存凭据）和地址表单自动填充

## Self-Check: PASSED

- All key files exist: src/webview-preload.js, src/preload.js, src/renderer.js, src/index.html, src/styles/main.css
- All commits exist: ca0f3ec (Task 1), 8dfc626 (Task 2)
- SUMMARY.md created and complete

---
*Phase: 32-autofill-credential-engine*
*Completed: 2026-08-13*
