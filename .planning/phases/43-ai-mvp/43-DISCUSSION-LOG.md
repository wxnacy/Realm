# Phase 43: AI 记忆系统集成（条目记忆 MVP） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-04
**Phase:** 43-ai-mvp
**Areas discussed:** 容器记忆字符上限, replace/remove 条目定位语义, 威胁扫描命中行为, 设置页保存交互

---

## 讨论范围选择

用户选择了全部 4 个识别出的灰色地带。方案文档（`docs/plan/ai-memory-system.md` §三）已拍板的决策（方案 A 消歧、skill 原理按需加载、冻结快照、容器删除联动、HTTP 端点、全局字符预算）未重问，直接承接为锁定决策。

---

## 容器记忆字符上限

| Option | Description | Selected |
|--------|-------------|----------|
| 2200 字符（推荐） | 与全局 MEMORY.md 一致，统一预算模型；容器记忆是「工作记忆」，量级与全局相当 | ✓ |
| 4000 字符 | 容器记忆承载项目/站点细节，信息密度高；代价是 memory_read 注入 token 变多 | |
| 1500 字符 | 控制注入成本，迫使 AI 只记高频要点；代价是细节被挤出 | |
| 你决定 | 由实现者根据注入成本和条目密度决定 | |

**User's choice:** 2200 字符
**Notes:** 与全局 MEMORY.md 统一预算模型，超限行为同全局（add 失败提示整理）

---

## replace/remove 条目定位语义

| Option | Description | Selected |
|--------|-------------|----------|
| 编号定位（推荐） | 条目用 [M1] [M2] 式编号（§ 分隔），memory_read 带编号返回，replace/remove 传编号；AI 定位最可靠 | ✓ |
| 内容匹配 | AI 提供 old_text 片段精确匹配替换；引文偏差会失败或误命中 | |
| replace 整文件重写 | replace 语义改为重写全文；每次修改重传全文，易丢失未看见的内容 | |

**User's choice:** 编号定位
**Notes:** 追问编号策略 — 删除后编号如何处理：

| Option | Description | Selected |
|--------|-------------|----------|
| 稳定编号不回收（推荐） | 删除中间条目后编号不复用，新条目取最大编号+1；AI 持有的编号引用永不过期 | ✓ |
| 删除后重新编号 | 文件始终紧凑 M1..Mn；但同会话先读后删可能拿旧编号误改 | |

**User's choice:** 稳定编号不回收

---

## 威胁扫描命中行为

| Option | Description | Selected |
|--------|-------------|----------|
| 拒绝写入+说明（推荐） | fail-closed：命中注入模式时拒绝写入，工具结果告知原因，AI 可换措辞重试；与 Phase 24 sanitizeInput 惯例一致 | ✓ |
| 净化后写入 | 去除危险片段仍写入；净化可能误伤，写入结果对 AI 不可预期 | |
| 警告但写入 | 只警告不阻断，用户经设置页人工审查；恶意网页提示注入可借 AI 污染记忆 | |

**User's choice:** 拒绝写入 + 工具结果说明命中原因
**Notes:** 设置页人工编辑不经扫描（用户本人操作可信）

---

## 设置页保存交互

| Option | Description | Selected |
|--------|-------------|----------|
| 显式保存按钮（推荐） | textarea + 保存按钮，与现有设置页惯例一致；顺带字数统计（如 1320/2200）和超限阻断 | ✓ |
| 输入即保存 | 失焦/停止输入自动写盘；误碰可意外改写，无字数预检时机 | |

**User's choice:** 显式保存按钮

---

## Claude's Discretion

- 条目文件具体排版（表头/§ 分隔符样式），只要 [Mn] 编号可解析
- 威胁扫描模式清单与匹配实现（可扩展 sanitizeInput）
- system prompt 快照注入位置/格式与容器记忆索引指引措辞
- memory/memory_read 参数 schema 与工具结果文案
- /api/ai-memory 沿用现有 token 鉴权的实现细节
- 设置页「AI 记忆」分区样式（遵循现有风格）

## Deferred Ideas

- 阶段 2：被动摘要（openhanako 式，从 ai-conversations.db 异步生成）— 阶段 1 验证后启动
- 阶段 3：FTS5 深度记忆 + search_memory 检索工具 — 远期
- Dream 式记忆整理（atomize→dedupe→optimize→compose→verify）— 远期可选
