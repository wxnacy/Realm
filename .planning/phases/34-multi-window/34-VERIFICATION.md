---
phase: 34-multi-window
type: verification
status: passed
created: 2026-08-16
verifier: codebuddy (kimi-k3)
---

# Phase 34 验证报告: 窗口管理基础（多窗口）

## 需求追溯矩阵

| 需求 ID | 描述 | 覆盖 Plan | 状态 |
|---------|------|-----------|------|
| MW-01 | 用户可以通过 Dock 右击菜单新建窗口 | 34-03 | PASS |
| MW-07 | 新建窗口继承容器上下文（重定义为使用默认容器，见 34-CONTEXT.md） | 34-03 | PASS |
| MW-08 | 用户可以使用 Cmd+N 快捷键新建窗口 | 34-01 + 34-03 + 快捷键修复 | PASS |
| MW-09 | 用户可以使用 Cmd+Shift+W 关闭当前窗口 | 34-01 + 34-03 + 快捷键修复 | PASS |
| MW-10 | 多窗口时窗口间焦点切换正常工作 | 34-01 | PASS |

所有 5 个需求 ID 均已覆盖，无遗漏。

---

## Plan 01: window-manager Map 重构 + shortcut-manager 焦点派发

### 关键项验证

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | 窗口注册表 Map + Set 双重注册 | PASS | `window-manager.js:29` windows Map、`window-manager.js:32` managedWindowIds Set、`createMainWindow()` 三结构同步维护（windows/managedWindowIds/windowContainerMap），closed 时清理 |
| 2 | isManagedWindow() 受信窗口判断 | PASS | `window-manager.js:258` 基于 managedWindowIds 集合 |
| 3 | broadcast() 多窗口广播 | PASS | `window-manager.js:269` 遍历 windows Map 向未销毁窗口发送 |
| 4 | 快捷键派发到焦点窗口 | PASS | `shortcut-manager.js:232` BrowserWindow.getFocusedWindow() 动态路由，非 managed 窗口（播放器）D-13 特殊处理 |

## Plan 02: assertTrustedSender 泛化 + IPC 信任模型扩展

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | assertTrustedSender 使用 isManagedWindow 集合校验 | PASS | `ipc-handlers.js` assertTrustedSender 不再硬编码主窗口比较（D-11） |
| 2 | registerHandlers 防重复注册守卫 | PASS | `ipc-handlers.js` handlersRegistered 模块级变量 |

## Plan 03: Dock 菜单 + activate 事件 + 广播替换（2026-08-16 执行）

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | Dock 右键菜单含「新建窗口」 | PASS | `main.js:2564` app.dock.setMenu，click 调 createMainWindow('default', ..., { offsetPosition: true }) |
| 2 | App 菜单含 新建窗口 ⌘N / 关闭窗口 ⇧⌘W | PASS | `main.js:2628-2644` 「窗口」子菜单 |
| 3 | activate 事件 hasVisibleWindows 处理 | PASS | 34-03-SUMMARY 验证 grep hasVisibleWindows × 4 |
| 4 | show-quit-hint 广播到所有窗口 | PASS | 34-03-SUMMARY 验证 broadcast('show-quit-hint') |
| 5 | DevTools 切换动态 getMainWindow() | PASS | `main.js:2660` 不再依赖闭包 mainWindow |

## Plan 04: UAT 缺陷修复（focusUrl + 初始化顺序）

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | focusUrl (Cmd+L) 快捷键 | PASS | `shortcut-manager.js:54` DEFAULT_SHORTCUTS; `src/renderer.js:1737` case 'focusUrl'（commit ddaf437） |
| 2 | registerShortcuts 先于 createMainWindow | PASS | `main.js:2579-2580`（commit 1c661c2） |

---

## 快捷键双重注册修复（2026-08-16，UAT 复测发现）

**问题**：Cmd+N / Cmd+Shift+W 同时注册在应用菜单 accelerator（main.js）和 before-input-event 快捷键表（shortcut-manager.js DEFAULT_SHORTCUTS）。before-input-event 命中后 preventDefault 吞掉菜单 accelerator，并向 renderer 派发 shortcut:triggered，但 renderer 分发 switch 无 newWindow/closeWindow 分支 → 静默失效。仅启动时焦点在 DevTools（devtools 类型不挂监听）时首次按键能走菜单生效。

**修复**：窗口级操作在 `shortcut-manager.js:246-264` before-input-event 拦截后直接主进程处理——newWindow 调 createMainWindow、closeWindow 调 focusedWindow.close()，不再派发 renderer。新窗口统一 `{ offsetPosition: true }` 错位 30px（三处入口：快捷键/Dock/菜单），避免完全覆盖原窗口。

**验证**：用户 UAT 复测通过（连续 Cmd+N、Cmd+Shift+W、Dock、菜单、多窗口焦点切换）。

---

## UAT 结果

34-UAT.md: **10/10 passed**（测试 5-9 于 2026-08-16 复测通过，blocked 清零）。

## 总结

**Phase 34 全部 5 个需求 ID（MW-01, MW-07, MW-08, MW-09, MW-10）均已实现并通过验证。**

- Plan 01（窗口注册表 + 焦点派发）: PASS
- Plan 02（IPC 信任模型泛化）: PASS
- Plan 03（Dock/菜单/activate/广播）: PASS（2026-08-16 补执行）
- Plan 04（UAT 缺陷修复）: PASS
- 快捷键双重注册修复: PASS（2026-08-16）

里程碑 v2.4 审计中 phase 34 相关 3 个 critical gap 全部关闭。
