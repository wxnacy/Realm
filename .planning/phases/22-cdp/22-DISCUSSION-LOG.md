# Phase 22: CDP 管理器扩展 + 基础网页操控工具 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 22-CDP 管理器扩展 + 基础网页操控工具
**Areas discussed:** CDP 会话生命周期, 内容提取策略, 链接提取与过滤, open_link 容器选择

---

## CDP 会话生命周期

### Q1: CDP 调试器附加策略

| Option | Description | Selected |
|--------|-------------|----------|
| 按需附加 | AI 工具调用时才 attach，用完后可选择 detach。节省资源，但首次调用有几百毫秒延迟 | ✓ |
| 常驻附加 | 所有 webview 启动后自动 attach。响应最快，但每个调试器占用约 5-10MB 内存 | |
| 智能附加 | 检测到 AI 面板打开时自动 attach 当前活跃标签页的调试器 | |

**User's choice:** 按需附加（推荐）
**Notes:** 用户确认使用按需附加策略

### Q2: 与现有 Network 调试器共存

| Option | Description | Selected |
|--------|-------------|----------|
| 统一管理 | cdp-manager 维护所有调试器状态，AI 工具复用已有连接并追加启用 Runtime/DOM 域 | ✓ |
| 独立实例 | AI 工具和网络抓取使用独立的 debugger attach | |
| 你来决定 | 让 Claude 根据代码情况选择最合适的方案 | |

**User's choice:** 统一管理（推荐）
**Notes:** 避免重复 attach，复用已有连接

### Q3: 调试器清理策略

| Option | Description | Selected |
|--------|-------------|----------|
| 用完即卸 | 工具执行完成后立即 detach。最节省资源 | ✓ |
| 延迟清理 | 工具执行后保留 30 秒，若 30 秒内无新调用再 detach | |
| 标签页关闭时清理 | 标签页关闭时才清理。响应最快但资源占用最多 | |

**User's choice:** 用完即卸（推荐）
**Notes:** 用户确认

### Q4: DevTools 冲突处理

| Option | Description | Selected |
|--------|-------------|----------|
| 提示用户关闭 | 检测到 DevTools 已打开时返回错误提示用户关闭后重试 | ✓ |
| 强制抢占 | 尝试强制 attach（会自动关闭 DevTools） | |
| 回退方案 | 跳过 CDP 方式，回退到其他方式 | |

**User's choice:** 提示用户关闭（推荐）
**Notes:** 简单可靠

---

## 内容提取策略

### Q1: 页面内容提取方式

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime.evaluate + 简单提取 | 通过 Runtime.evaluate 执行 JS 获取 document.title、meta 标签、body.innerText | |
| Runtime.evaluate + Readability | 注入 Mozilla Readability 算法提取可读内容（类似阅读模式） | ✓ |
| 混合策略 | 先尝试 Readability 提取，失败回退 innerText | |

**User's choice:** Runtime.evaluate + Readability
**Notes:** 质量更高

### Q2: 元信息范围

| Option | Description | Selected |
|--------|-------------|----------|
| 基础信息 | 页面标题、URL、favicon | ✓ |
| SEO 元信息 | description、keywords、author 等 meta 标签 | ✓ |
| Open Graph 标签 | og:title、og:description、og:image 等社交分享标签 | ✓ |
| 页面属性 | canonical URL、语言、字符集等 | ✓ |

**User's choice:** 全选（基础信息 + SEO + OG + 页面属性）
**Notes:** 返回尽可能完整的元信息

### Q3: 大页面处理

初始提议 50KB 截断，用户要求调研后调大。

调研数据（HTTP Archive）：
- 平均 HTML 文档大小：30-50 KB（未压缩）
- 用户可见纯文本：5-15 KB
- 50KB 可覆盖 95%+，100KB 可覆盖 99%+

| Option | Description | Selected |
|--------|-------------|----------|
| 固定截断 50KB | 正文截断到 50KB，超出标记 [截断] | |
| 两阶段提取 | 先返回摘要（5KB），AI 可请求全文 | |
| 固定截断 100KB | 正文截断到 100KB，覆盖 99%+ 场景 | ✓ |

**User's choice:** 调大截断限制 → 确认 100KB
**Notes:** 基于调研数据，100KB 覆盖几乎所有场景

---

## 链接提取与过滤

### Q1: 过滤规则

| Option | Description | Selected |
|--------|-------------|----------|
| 过滤非 HTTP 协议 | 仅保留 http:// 和 https:// 协议的链接 | ✓ |
| URL 去重 | 按 URL 完全去重 | ✓ |
| 相对→绝对 URL | 相对 URL 自动转为绝对 URL | ✓ |
| 过滤锚点链接 | 过滤掉 #section 等页面内锚点链接 | ✓ |

**User's choice:** 全选
**Notes:** 全部过滤规则都需要

### Q2: 返回字段

| Option | Description | Selected |
|--------|-------------|----------|
| URL + 文本 | URL + 链接文本（a 标签的 textContent） | ✓ |
| 仅 URL | 仅 URL 地址 | |
| URL + 文本 + target | URL + 文本 + 是否新窗口打开（target=_blank） | |

**User's choice:** URL + 文本（推荐）
**Notes:** 包含链接文本对 AI 理解链接用途有帮助

---

## open_link 容器选择

### Q1: 默认容器

| Option | Description | Selected |
|--------|-------------|----------|
| 当前活跃容器 | 使用用户当前活跃的容器（跟随用户操作上下文） | ✓ |
| 固定 default 容器 | 固定使用 default 容器，与现有 navigate 工具保持一致 | |
| AI 自主决定 | AI 自行判断，工具返回容器列表供 AI 选择 | |

**User's choice:** 当前活跃容器（推荐）
**Notes:** 更符合用户直觉

### Q2: 默认打开方式

| Option | Description | Selected |
|--------|-------------|----------|
| 新标签页 | 默认在新标签页打开，不影响用户当前正在看的页面 | ✓ |
| 当前标签页 | 默认在当前标签页打开，替换当前页面 | |
| AI 自主决定 | 由 AI 自行判断，参数可选 | |

**User's choice:** 新标签页（推荐）
**Notes:** 不干扰用户当前操作

---

## Claude's Discretion

无 — 所有关键决策已由用户确认。

## Deferred Ideas

无 — 讨论保持在 Phase 22 范围内。
