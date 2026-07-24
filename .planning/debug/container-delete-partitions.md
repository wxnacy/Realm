# 容器删除时 Partitions 目录未完全清理

**状态：** 未解决
**发现时间：** 2026-07-24
**相关文件：** cookie-manager.js, container-manager.js

## 问题描述

删除容器时，`~/Library/Application Support/Realm/Partitions/container-{id}/` 目录未被删除，或删除后被自动重建。

## 尝试过的修复方案

### 方案 1：在 deleteCookies 中调用 clearStorageData + rmSync

```javascript
const ses = session.fromPartition(`persist:container-${containerId}`);
await ses.clearStorageData();
fs.rmSync(partitionDir, { recursive: true, force: true });
```

**结果：** 目录删除后被 `session.fromPartition()` 自动重建。

### 方案 2：添加 100ms 延迟等待文件句柄释放

```javascript
await ses.clearStorageData();
await new Promise(resolve => setTimeout(resolve, 100));
fs.rmSync(partitionDir, { recursive: true, force: true });
```

**结果：** 同上，目录仍被重建。

### 方案 3：不调用 session.fromPartition，直接删除目录

```javascript
// 删除 cookie JSON 文件
fs.unlinkSync(filePath);
// 直接删除 Partitions 目录
fs.rmSync(partitionDir, { recursive: true, force: true });
```

**结果：** 目录删除失败（可能被 Electron 进程占用）。

## 根本原因分析

1. Electron 的 `session.fromPartition('persist:xxx')` 会在获取 session 时自动创建 `Partitions/container-xxx/` 目录
2. 即使删除了该目录，只要有代码调用 `session.fromPartition()`，目录就会被重建
3. 如果不调用 `session.fromPartition()`，直接用 `fs.rmSync` 删除，可能因为 Electron 进程持有文件句柄而失败

## 建议修复方向

1. **延迟删除：** 在容器删除后，延迟一段时间再删除目录，确保 Electron 释放所有句柄
2. **使用 Electron API：** 查找 Electron 是否提供删除 session/partition 的官方 API
3. **忽略目录：** 接受目录存在但为空的状态，不影响功能（目录为空时占用空间极小）
4. **应用退出时清理：** 在 `before-quit` 事件中统一清理已删除容器的 Partitions 目录

## 相关代码位置

- `cookie-manager.js:deleteCookies()` — Cookie 删除逻辑
- `container-manager.js:deleteContainer()` — 容器删除入口
- `ipc-handlers.js:container:delete` — IPC handler
