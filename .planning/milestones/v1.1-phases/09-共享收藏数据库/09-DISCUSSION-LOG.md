# Phase 9: 共享收藏数据库 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 9-共享收藏数据库
**Areas discussed:** 跨容器 URL 冲突合并, 迁移失败回滚策略, 收藏页面 UI 微调

---

## 跨容器 URL 冲突合并

| Option | Description | Selected |
|--------|-------------|----------|
| 最早收藏优先（推荐） | 保留最早收藏的那条记录的标题/favicon（简单、确定性高） | |
| 最新收藏优先 | 保留最新收藏的那条记录的标题/favicon（反映用户最近的认知） | |
| 最早记录 + 最新标题 | 总是保留第一条记录，但用最新收藏的标题覆盖 | |

**User's choice:** "这就是新功能，不用考虑迁移问题了。"
**Notes:** 用户认为不需要迁移旧数据，直接从零开始。后续确认为"全新开始，删除旧数据"。

---

## 迁移策略确认

| Option | Description | Selected |
|--------|-------------|----------|
| 全新开始，删除旧数据（推荐） | 不迁移旧数据，直接创建新的全局表。旧的 per-container 表在迁移步骤中被清理掉 | ✓ |
| 全新开始，保留旧表备份 | 创建新全局表，但保留旧表不删除 | |
| 还是做数据迁移 | 按 ROADMAP 原计划，将旧表数据合并迁移到新全局表 | |

**User's choice:** 全新开始，删除旧数据（推荐）
**Notes:** 旧数据直接丢弃，Phase 9 只需创建新的全局收藏表

---

## 迁移失败回滚策略

| Option | Description | Selected |
|--------|-------------|----------|
| 无需回滚（推荐） | 既然旧数据本来就不要了，迁移失败就直接重建空表 | ✓ |
| 备份旧表再迁移 | 迁移前先备份旧表到 _backup 后缀，失败时可恢复 | |

**User's choice:** 无需回滚（推荐）
**Notes:** 旧数据不需要保留，失败就下次启动重试

---

## 收藏页面 UI 微调

| Option | Description | Selected |
|--------|-------------|----------|
| 完全移除容器感知（推荐） | 移除所有容器相关逻辑，收藏页面不再关心当前在哪个容器 | ✓ |
| 保留来源容器标签显示 | 虽然数据全局共享，但 UI 上仍显示每条收藏来自哪个容器 | |

**User's choice:** 完全移除容器感知（推荐）
**Notes:** 收藏与容器彻底解耦，UI 上不再有任何容器相关信息

---

## Claude's Discretion

- SQLite 表结构优化（索引设计等）
- 迁移代码的具体实现位置
- favorites-manager.js 重构后的代码组织
- 收藏页面 CSS 微调

## Deferred Ideas

None — discussion stayed within phase scope
