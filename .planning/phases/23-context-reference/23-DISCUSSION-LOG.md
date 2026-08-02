# Phase 23: 智能上下文引用 + 全文检索 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 23-智能上下文引用 + 全文检索
**Areas discussed:** @ 引用交互方式, 引用内容读取策略, FTS5 索引设计, @ 引用安全约束

---

## @ 引用交互方式

### Q1: 输入 @ 后，标签页选择器怎么展示？

| Option | Description | Selected |
|--------|-------------|----------|
| 浮动面板 | 输入框输入 @ 后弹出浮动面板，显示当前容器标签页列表，鼠标点击或输入关键字过滤 | ✓ |
| Pill 标签展示 | 输入 @ 后，每个标签页变为可点击的 pill/chip 显示在输入框上方，点击选中/取消 | |

**User's choice:** 浮动面板
**Notes:** 参考 IDE 的 @ mention 交互模式

### Q2: 标签页选择器支持单选还是多选？

| Option | Description | Selected |
|--------|-------------|----------|
| 多选 | 用户可以同时选择多个标签页，AI 同时引用所有选中页面的内容 | ✓ |
| 单选 | 每次只能选择一个标签页，选中后替换之前的选择 | |

**User's choice:** 多选

### Q3: 选择标签页后怎么确认？

| Option | Description | Selected |
|--------|-------------|----------|
| Pill 确认 | 选中的标签页以 pill 形式显示在输入框上方，点击 × 取消选择 | ✓ |
| 确认按钮 | 在浮动面板底部加一个"确认"按钮，点击后关闭面板并锁定选择 | |

**User's choice:** Pill 确认
**Notes:** 选中的标签页显示为 pill，点 × 取消

### Q4: 什么条件下触发标签页选择器？

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 @ 触发 | 只有输入 @ 字符后才触发，空输入框不触发 | ✓ |
| 焦点即触发 | 输入框获得焦点时就显示标签页列表，无需输入 @ | |

**User's choice:** 仅 @ 触发

**Continue/Next:** Next area

---

## 引用内容读取策略

### Q1: 选中标签页后，AI 应该读取什么内容？

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 read_page_content | 复用 Phase 22 的 CDP + Readability 逻辑，读取完整正文+元信息 | ✓ |
| 仅元信息 | 只传递标题+URL+favicon 等轻量元信息，不读取页面正文 | |
| 截断读取 | 读取正文但截断到更短长度（如 10KB） | |

**User's choice:** 复用 read_page_content

### Q2: 多个标签页的内容怎么组合注入给 AI？

| Option | Description | Selected |
|--------|-------------|----------|
| 拼接注入 | 所有标签页内容拼接后一起注入 | |
| 分块注入 | 每个标签页的内容作为独立的上下文块注入，带标签区分来源 | ✓ |

**User's choice:** 分块注入
**Notes:** AI 可以区分不同页面的来源

### Q3: 多标签页时，总内容长度怎么控制？

| Option | Description | Selected |
|--------|-------------|----------|
| 按标签页独立截断 | 每个标签页最多 102,400 字符，总预算不限 | ✓ |
| 总预算截断 | 所有标签页共享一个总预算（如 200KB） | |
| 缩短单页截断 | 每个标签页截断到更短（如 20KB） | |

**User's choice:** 按标签页独立截断

### Q4: 引用的内容注入到 AI 对话的哪个位置？

| Option | Description | Selected |
|--------|-------------|----------|
| 系统提示词注入 | 注入到系统提示词中，作为 AI 的背景知识 | ✓ |
| 用户消息注入 | 作为用户消息的一部分发送 | |

**User's choice:** 系统提示词注入

**Continue/Next:** Next area

---

## FTS5 索引设计

### Q1: 中文全文检索使用什么分词方案？

| Option | Description | Selected |
|--------|-------------|----------|
| unicode61 | FTS5 内置 tokenizer，支持基本中文字符匹配但不支持智能分词 | |
| jieba 分词 | 集成 nodejieba，分词效果更好但增加依赖 | ✓ |

**User's choice:** jieba 分词
**Notes:** 需要更好的中文搜索体验

### Q2: FTS5 索引包含哪些字段？

| Option | Description | Selected |
|--------|-------------|----------|
| 标题+URL | 只索引 title 和 url 字段 | ✓ |
| 标题+URL+正文 | 还通过 CDP 读取页面正文建立索引 | |
| 全部字段 | 索引 title、url 和 favicon_url | |

**User's choice:** 标题+URL

### Q3: 已有收藏的 FTS5 索引怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 启动时自动全量 | 应用启动时自动检测并为所有已有收藏建立 FTS5 索引 | ✓ |
| 仅增量维护 | 添加收藏时触发器自动维护，但已有收藏不补建 | |

**User's choice:** 启动时自动全量

### Q4: search_favorites_fulltext 工具的默认返回数量？

| Option | Description | Selected |
|--------|-------------|----------|
| 默认 20 条 | 与现有 listRecords 保持一致 | |
| 默认 50 条 | 覆盖更多结果 | ✓ |
| AI 控制，默认 10 | 由工具参数控制 | |

**User's choice:** 默认 50 条

**Continue/Next:** Next area

---

## @ 引用安全约束

### Q1: @ 引用选择器的容器可见性？

| Option | Description | Selected |
|--------|-------------|----------|
| 严格隔离 | 仅显示当前容器的标签页 | |
| 跨容器可见 | 显示所有容器的标签页，用颜色区分容器 | ✓ |

**User's choice:** 跨容器可见
**Notes:** 偏离 Roadmap 原始要求"仅限当前容器"，用户明确确认

### Q2: 确认：允许跨容器引用？

| Option | Description | Selected |
|--------|-------------|----------|
| 确认跨容器 | 确认跨容器引用 | ✓ |
| 改为严格隔离 | 改为严格隔离 | |

**User's choice:** 确认跨容器

### Q3: @ 选择器中是否显示容器信息？

| Option | Description | Selected |
|--------|-------------|----------|
| 显示容器标识 | 每个标签页项显示容器颜色圆点和容器名称 | ✓ |
| 不显示容器信息 | 仅显示标签页标题和 URL | |

**User's choice:** 显示容器标识

**Continue/Next:** Done

---

## Claude's Discretion

无 — 所有关键决策已由用户确认。

## Deferred Ideas

无 — 讨论保持在阶段范围内。
