# Phase 3: Data Isolation + Cookie Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 03-data-isolation-cookie-persistence
**Areas discussed:** 容器删除清理, 孤立文件管理, Cookie 属性完整性, 数据隔离说明

---

## 容器删除清理

| Option | Description | Selected |
|--------|-------------|----------|
| 自动删除 cookie 文件 | 删除容器时自动删除对应的 cookie JSON 文件，不可恢复 | ✓ |
| 保留 cookie 文件 | 保留 cookie 文件，用户可以手动清理或重新导入 | |
| 移动到回收站 | 将 cookie 文件移动到回收站目录，可恢复 | |

**User's choice:** 自动删除 cookie 文件
**Notes:** 直接删除，不保存最新状态

---

## 孤立文件管理

| Option | Description | Selected |
|--------|-------------|----------|
| 启动时自动清理 | 应用启动时检测 cookies/ 目录下的文件，删除不属于任何容器的文件 | |
| 不清理 | 不主动清理，保留孤立文件不影响功能 | |
| 提示用户处理 | 检测到孤立文件时提示用户选择删除或保留 | |

**User's choice:** 不清理，记录下，后续设置中增加主动清理按钮
**Notes:** 孤立文件管理推迟到后续设置面板

---

## Cookie 属性完整性

| Option | Description | Selected |
|--------|-------------|----------|
| 保持当前属性 | 仅保存当前实现的属性（name, value, domain, path, expirationDate, secure, httpOnly） | |
| 添加 SameSite | 添加 sameSite 属性（Strict/Lax/None） | |
| 添加 SameSite + hostOnly | 添加 sameSite 和 hostOnly 属性，更完整地保留 cookie 状态 | ✓ |

**User's choice:** 添加 SameSite + hostOnly
**Notes:** 需要更新 cookie-manager.js 的 saveCookies 函数

---

## 数据隔离说明

| Option | Description | Selected |
|--------|-------------|----------|
| 添加隔离说明 | 在 CONTEXT.md 中明确说明 Electron session partition 自动隔离的范围 | ✓ |
| 保持现状 | 保持现有内容，不需要额外说明 | |

**User's choice:** 添加隔离说明
**Notes:** Electron session partition 自动覆盖 ISO-01 到 ISO-04

---

## Claude's Discretion

无 — 所有决策均由用户明确选择

## Deferred Ideas

### 设置面板清理功能
- 后续在设置面板中增加手动清理孤立 cookie 文件的按钮
- 属于 Phase 4 或后续阶段的功能

