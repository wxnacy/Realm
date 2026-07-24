# Phase 4: Convenience Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 04-Convenience Features
**Areas discussed:** 规则匹配模式, 规则冲突处理, 快捷键作用域, 规则管理增强

---

## 规则匹配模式

| Option | Description | Selected |
|--------|-------------|----------|
| 仅域名（当前） | 保持简单，只匹配域名。大部分场景够用。 | ✓ |
| 域名 + 路径 | 支持 google.com/mail 这样的路径匹配。可以区分同一域名下的不同服务。 | |
| 完整 URL 模式 | 支持正则表达式或 glob 模式匹配完整 URL。最灵活但最复杂。 | |

**User's choice:** 仅域名（当前）
**Notes:** 保持简单，当前的域名匹配已经够用。

---

## 规则冲突处理

| Option | Description | Selected |
|--------|-------------|----------|
| 第一个匹配（当前） | 简单高效，按创建顺序返回第一个匹配的规则。用户可以通过删除/禁用规则来调整。 | ✓ |
| 优先级排序 | 用户可以拖拽排序规则，优先级高的先匹配。更灵活但增加 UI 复杂度。 | |
| 提示用户选择 | 当多个规则匹配时弹出选择框，让用户决定使用哪个容器。最准确但可能打断工作流。 | |

**User's choice:** 第一个匹配（当前）
**Notes:** 保持当前行为，简单高效。

---

## 快捷键作用域

| Option | Description | Selected |
|--------|-------------|----------|
| 全局（当前） | 应用在后台时快捷键也能触发。适合需要快速切换到浏览器的场景，但会占用系统快捷键。 | |
| 仅应用内 | 只有应用在前台时快捷键才生效。不会与系统冲突，但需要先切换到应用。 | ✓ |
| 可配置 | 用户可以选择每个快捷键是全局还是应用内。最灵活但增加设置复杂度。 | |

**User's choice:** 仅应用内
**Notes:** 重要变更！需要将 globalShortcut 改为应用内快捷键（通过 Menu 或 before-input-event）。

---

## 规则管理增强

| Option | Description | Selected |
|--------|-------------|----------|
| 启用/禁用切换 | 快速启用或禁用单条规则，无需删除。当前需要点击编辑才能切换。 | ✓ |
| 规则排序 | 拖拽排序规则，控制匹配优先级。当规则冲突时有用。 | ✓ |
| 规则导入/导出 | 将规则导出为 JSON 文件，或从文件导入。方便备份和分享规则。 | ✓ |
| 当前已足够 | 保持现有的 CRUD 功能，不需要额外增强。 | |

**User's choice:** 启用/禁用切换, 规则排序, 规则导入/导出（全部选择）
**Notes:** 用户希望增强规则管理功能，提升易用性。

---

## Claude's Discretion

无 — 所有决策均由用户明确选择

## Deferred Ideas

无 — 讨论保持在 Phase 范围内
