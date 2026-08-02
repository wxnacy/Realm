# Phase 22 Deferred Items

## 22-03 执行期间发现（超出本计划范围，未修复）

### Network 抓取调试器状态在 webview 销毁后残留

- **发现于：** 22-03 Task 2（webview destroyed 挂接 detachForAI）
- **现象：** main.js 的 `destroyed` 监听现只清理 `source === 'ai-tool'` 的 debuggerStates 条目（经 detachForAI）。开发者模式 Network 抓取附加的条目（无 source 字段，Phase 12 引入）在 webview 销毁后仍残留于 Map，直到应用退出 cleanup() 才清除。
- **影响：** 轻微内存泄漏（每个销毁的 webview 一条小对象）；功能无影响（webContents 销毁时 Electron 自动断开调试器，条目不再被引用）。
- **建议：** 后续阶段可在 cdp-manager 增加按 webContentsId 无条件清理的方法，或给 Network 抓取条目也加 source 标记统一治理。
- **未修复原因：** 预存在缺陷（Phase 12），非本任务改动引入 — per SCOPE BOUNDARY 规则记录待办，不在此修复。
