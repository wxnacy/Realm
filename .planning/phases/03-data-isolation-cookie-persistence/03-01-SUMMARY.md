---
phase: 03-data-isolation-cookie-persistence
plan: 01
subsystem: cookie-management
tags: [cookie, session, isolation, persistence, electron]
depends_on:
  requires: [02-05]
  provides: [cookie-manager, container-manager]
  affects: [main.js, ipc-handlers.js, src/preload.js]
tech_stack:
  added: [electron-session-api, electron-store]
  patterns: [session-partition, cookie-json-persistence]
key_files:
  created:
    - cookie-manager.js
    - container-manager.js
  modified:
    - ipc-handlers.js
    - src/preload.js
  unchanged:
    - main.js
decisions:
  - Cookie 文件存储在 `{userData}/cookies/` 目录，每个容器独立 JSON 文件
  - Cookie 保存包含 sameSite 和 hostOnly 属性确保完整恢复
  - 删除容器时同时删除 Cookie 文件和 Session 数据（D-01, D-02）
  - 应用退出使用 before-quit + preventDefault 模式避免写盘竞态
metrics:
  duration: 18s
  completed: "2026-07-24T09:42:29Z"
  tasks: 3
  files_changed: 5
status: complete
---

# Phase 03 Plan 01: Cookie 管理增强 + 数据隔离验证 + 容器删除清理 Summary

cookie-manager.js 完整 Cookie 管理模块（保存/加载/导出/导入/删除），支持 sameSite 和 hostOnly 属性持久化；容器删除时自动清理 Cookie 文件和 Session 数据；应用启动自动加载、退出前自动保存 Cookie。

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Cookie 属性增强 | 2f05ada | cookie-manager.js: saveCookies/loadCookies 包含 sameSite, hostOnly, url 等完整属性 |
| 2 | 容器删除时清理 Cookie | 3fbf368 | container-manager.js 集成 deleteCookies; ipc-handlers.js 添加 cookie:delete; preload.js 暴露 deleteCookie |
| 3 | 主进程集成自动保存/加载 | (已存在于基线) | main.js: loadAllCookies 启动加载, saveAllCookies before-quit 保存 |

## Key Implementation Details

### cookie-manager.js
- **saveCookies**: 获取 Session Cookie 并格式化为包含 sameSite, hostOnly, url 的完整 JSON
- **loadCookies**: 从 JSON 文件恢复 Cookie，加载失败记录错误但不中断
- **saveAllCookies/loadAllCookies**: 遍历所有容器批量操作
- **exportCookies/importCookies**: 手动导出/导入，支持文件对话框
- **deleteCookies**: 删除 Cookie JSON 文件 + 调用 clearStorageData 清理 Session

### container-manager.js
- **deleteContainer**: 删除容器时调用 cookieManager.deleteCookies(id) 清理关联数据
- 容器 CRUD 完整实现，配置通过 electron-store 持久化

### IPC 集成
- `cookie:save`, `cookie:load`, `cookie:export`, `cookie:import`, `cookie:delete` 完整 IPC 通道
- 所有处理器包含 assertTrustedSender 安全校验

## Decisions Made

- Cookie 文件使用 JSON 格式，存储在 `{userData}/cookies/{containerId}.json`
- 保存时包含 sameSite 和 hostOnly 确保 Cookie 属性完整恢复
- 删除容器时同步清理 Cookie 文件和 Session 存储数据
- 应用退出使用 before-quit + preventDefault + cookiesSaved 标志避免写盘竞态

## Verification Results

### 自动化验证
```
sameSite: PASS
hostOnly: PASS
JSON.stringify: PASS
deleteCookies: PASS
clearStorageData: PASS
unlinkSync: PASS
cookie-manager require: PASS
cookieManager.deleteCookies: PASS
cookie:delete: PASS
deleteCookie: PASS
loadAllCookies: PASS
saveAllCookies: PASS
before-quit: PASS
```

### 手动验证（待执行）
1. 在容器 A 登录网站 -> 切换到容器 B -> 容器 B 未登录
2. 在容器中登录 -> 关闭应用 -> 重新打开 -> 仍然登录
3. 删除容器 -> Cookie 文件被删除
4. 导出 Cookie -> 删除容器 -> 导入 Cookie -> Cookie 恢复

## Known Stubs

None - all functionality is fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file_write | cookie-manager.js | Cookie JSON 文件写入 userData 目录，需确保路径安全 |
| threat_flag: session_clear | cookie-manager.js | clearStorageData 清理 Session 数据，需确保不误删其他容器 |

## Self-Check: PASSED
