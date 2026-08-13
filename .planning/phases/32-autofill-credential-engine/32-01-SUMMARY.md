---
phase: 32-autofill-credential-engine
plan: 01
subsystem: credential-storage
tags: [safeStorage, sqlite, better-sqlite3, electron, encryption, credentials]

# Dependency graph
requires:
  - phase: 30-download-manager-core
    provides: history.db SQLite database, download-manager.js pattern (delayed loading, WAL mode)
provides:
  - credential-manager.js 凭据管理器模块（加密存储、查询、永不保存记录）
  - 5 个 credential:* IPC 通道（save/get/never-save/is-never-save/delete）
  - main.js 凭据管理器初始化集成
affects: [32-autofill-credential-engine, autofill, credential-api]

# Tech tracking
tech-stack:
  added: [safeStorage async API (encryptStringAsync/decryptStringAsync)]
  patterns: [credential-manager module pattern, safeStorage encryption, lazy re-encryption on key rotation]

key-files:
  created: [credential-manager.js]
  modified: [ipc-handlers.js, main.js]

key-decisions:
  - "共享 history.db 数据库（与 download-manager、history-manager 共用），减少文件数量"
  - "使用 safeStorage 异步 API（encryptStringAsync/decryptStringAsync），不使用已废弃的同步版本"
  - "加密不可用时拒绝存储凭据（T-32-01 安全缓解），而非降级为明文存储"
  - "密钥轮转懒更新：getCredential 解密时检查 shouldReEncrypt，按需重加密"

patterns-established:
  - "凭据管理器模块模式：延迟加载 better-sqlite3 + WAL 模式 + 共享 history.db"
  - "safeStorage 加密模式：isAsyncEncryptionAvailable 检查 + encryptStringAsync 加密 + decryptStringAsync 解密"
  - "IPC 凭据通道模式：assertTrustedSender + 参数校验 + 异步加密操作"

requirements-completed: [AF-02, AF-05, AF-01, AF-03]

coverage:
  - id: D1
    description: "credential-manager.js 凭据管理器模块（加密存储、查询、永不保存记录）"
    requirement: AF-02
    verification:
      - kind: other
        ref: "node -e \"require('./credential-manager')\" — 模块加载无报错"
        status: pass
    human_judgment: false
  - id: D2
    description: "5 个 credential:* IPC 通道注册"
    requirement: AF-01
    verification:
      - kind: other
        ref: "grep -c \"ipcMain.handle('credential:\" ipc-handlers.js — 输出 5"
        status: pass
    human_judgment: false
  - id: D3
    description: "main.js 集成凭据管理器初始化"
    requirement: AF-05
    verification:
      - kind: other
        ref: "grep credentialManager main.js — require 和 initDatabase 调用存在"
        status: pass
    human_judgment: false
  - id: D4
    description: "凭据按 container_id 隔离存储（UNIQUE 约束）"
    requirement: AF-03
    verification:
      - kind: other
        ref: "CREATE UNIQUE INDEX idx_credentials_container_origin ON credentials (container_id, origin)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-13
status: complete
---

# Phase 32 Plan 01: 凭据管理器核心模块 Summary

**safeStorage 加密凭据存储 + 5 个 credential:* IPC 通道 + 容器隔离 SQLite 凭据表**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-13T10:33:31Z
- **Completed:** 2026-08-13T10:35:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 创建 credential-manager.js 凭据管理器核心模块，支持 safeStorage 异步加密/解密
- 实现 6 个导出函数：initDatabase / saveCredential / getCredential / markNeverSave / isNeverSave / deleteCredential
- 在 ipc-handlers.js 注册 5 个 credential:* IPC 通道，每个通道调用 assertTrustedSender 校验来源
- 在 main.js 中集成凭据管理器初始化（app.whenReady 回调）

## Task Commits

Each task was committed atomically:

1. **Task 1: 创建 credential-manager.js 凭据管理器模块** - `efeab66` (feat)
2. **Task 2: 注册 credential:* IPC 通道到 ipc-handlers.js** - `f0c1146` (feat)

## Files Created/Modified

- `credential-manager.js` - 凭据管理器核心模块（新建）：safeStorage 加密/解密、SQLite 凭据表 CRUD、永不保存记录管理
- `ipc-handlers.js` - 添加 credential:* IPC 通道：save / get / never-save / is-never-save / delete
- `main.js` - 引入 credential-manager 模块并在 app.whenReady 中调用 initDatabase()

## Decisions Made

- 共享 history.db 数据库（与 download-manager、history-manager 共用），减少文件数量
- 使用 safeStorage 异步 API（encryptStringAsync/decryptStringAsync），不使用已废弃的同步版本
- 加密不可用时拒绝存储凭据（T-32-01 安全缓解），而非降级为明文存储
- 密钥轮转懒更新：getCredential 解密时检查 shouldReEncrypt，按需重加密
- UNIQUE 约束 (container_id, origin)：同一容器同一 origin 只保存一个凭据（per D-10）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 凭据管理器核心模块和 IPC 通道已完成，Plan 02（表单检测和自动填充 UI）可立即开始
- Plan 02 将在 webview-preload.js 中实现表单检测引擎，在 renderer.js 中实现保存提示横幅

---
*Phase: 32-autofill-credential-engine*
*Completed: 2026-08-13*
