# Phase 40: 搜索基础设施 + web_search 工具 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 40-搜索基础设施 + web_search 工具
**Areas discussed:** Auto Fallback 链策略, AnySearch 免费兜底可靠性, 速率限制器参数策略, 搜索结果质量判断标准

---

## Auto Fallback 链策略

### Q1: Auto Fallback 的降级链深度？

| Option | Description | Selected |
|--------|-------------|----------|
| 三级链全实现 | 付费 API → anysearch_free → 浏览器 Provider。浏览器 Provider 在 Phase 40 实现基础版（仅 DDG），保证零配置可用 | ✓ |
| 两级链，浏览器延后 | 付费 API → anysearch_free。浏览器 Provider 延后到 v2.5.x | |
| 无 Auto，手动选择 | 仅实现 API Provider + anysearch_free，不做 Auto 逻辑 | |

**User's choice:** 三级链全实现
**Notes:** Phase 40 实现基础版 DDG 浏览器 Provider，保证零配置可用

### Q2: 多个付费 API Key 时的优先级？

| Option | Description | Selected |
|--------|-------------|----------|
| 固定顺序：Tavily 优先 | Tavily → Brave → Serper → AnySearch → DDG。按搜索质量排序，Tavily 专为 AI 搜索优化 | ✓ |
| 最近成功优先 | 哪个 Provider 最近成功就优先用，失败才切换 | |
| 用户自定义顺序 | 用户在设置中手动排列 Provider 顺序 | |

**User's choice:** 固定顺序：Tavily 优先

### Q3: 什么条件下触发降级？

| Option | Description | Selected |
|--------|-------------|----------|
| 错误 + 限流 + 认证 + 空结果 | 网络错误 + 429 + 认证失败(401/403) + 空结果。超时不算（可能只是慢） | ✓ |
| 仅错误 + 限流 | 只在网络错误和 429 时降级，空结果和认证失败不降级 | |
| 所有失败都降级 | 任何非 200 响应 + 空结果都降级 | |

**User's choice:** 错误 + 限流 + 认证 + 空结果

### Q4: 所有 Provider 都失败时如何反馈？

| Option | Description | Selected |
|--------|-------------|----------|
| 诊断信息 + 用户提示 | 返回 attempts 数组 + 明确的用户提示 | ✓ |
| 仅最后错误 | 只返回最后尝试的 Provider 的错误 | |
| 静默失败 | AI 回复"我无法搜索"但不解释原因 | |

**User's choice:** 诊断信息 + 用户提示

---

## AnySearch 免费兜底可靠性

### Q1: AnySearch Free 的角色？

| Option | Description | Selected |
|--------|-------------|----------|
| 无 Key 直接调用 | 直接使用 AnySearch Free 公共端点，无需 Key | ✓ |
| 可选 Key + 免费端点 | 支持可选的 AnySearch API Key，无 Key 时使用免费端点 | |
| 不要 AnySearch | 去掉 AnySearch，Auto 链为：付费 API → DDG 浏览器 | |

**User's choice:** 无 Key 直接调用

### Q2: 超时和重试策略？

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随 OpenHanako 30s | 30 秒超时，无最小间隔，maxConcurrent 3，限流退避 10 秒 | ✓ |
| 短超时 10s | 10 秒超时，更激进，避免阻塞太久 | |
| 折中 15s | 15 秒超时，minIntervalMs 2000，maxConcurrent 2 | |

**User's choice:** 跟随 OpenHanako 30s
**Notes:** 基于 OpenHanako 实际实现的调研结果

### Q3: 免费和付费是否同一端点？

| Option | Description | Selected |
|--------|-------------|----------|
| 同一 URL，有无 Key | api.anysearch.com/v1/search，有 Key 时加 Authorization header | ✓ |
| 不同端点 | AnySearch 免费和付费使用不同的 API 端点 | |

**User's choice:** 同一 URL，有无 Key
**Notes:** 参考 OpenHanako 实现，searchAnySearch 函数中通过 apiKey 参数判断

---

## 速率限制器参数策略

### Q1: 参数来源？

| Option | Description | Selected |
|--------|-------------|----------|
| 直接复用 OpenHanako 参数 | 每个 Provider 独立策略，这些数值经过实际测试调优 | ✓ |
| 默认值 + 用户可覆盖 | 使用 OpenHanako 的参数作为默认值，但允许用户在设置页自定义覆盖 | |
| 统一简化策略 | 所有 API Provider 用同一套参数，浏览器 Provider 用另一套 | |

**User's choice:** 直接复用 OpenHanako 参数

### Q2: 实例化方式？

| Option | Description | Selected |
|--------|-------------|----------|
| 每 Provider 独立实例 | 每个 Provider 一个 SearchRateLimiter 实例，各自独立的队列和状态 | ✓ |
| 单一全局实例 | 单一 RateLimiter 管理所有 Provider，共享全局状态 | |
| 按类型分组 | 每类（API/浏览器）一个实例，同类 Provider 共享限制 | |

**User's choice:** 每 Provider 独立实例

### Q3: 429 退避策略？

| Option | Description | Selected |
|--------|-------------|----------|
| Retry-After + 指数退避 | 读取 Retry-After header，如果存在则用其值，否则用 rateLimitBaseDelayMs + 指数退避 | ✓ |
| 固定延迟 | 固定延迟 rateLimitBaseDelayMs，不读取 Retry-After | |
| 不退避，直接跳过 | 仅依赖 Auto Fallback 跳过被限流的 Provider，不做退避等待 | |

**User's choice:** Retry-After + 指数退避

---

## 搜索结果质量判断标准

### Q1: 质量判断标准？

| Option | Description | Selected |
|--------|-------------|----------|
| 中文低质量检测（跟随 OpenHanako） | 仅对中文查询做字典/百科检测，针对性强但覆盖面窄 | ✓ |
| 中文 + 通用检测 | 中文检测 + 通用检测（结果数 < 3、内容过短 < 50 字符） | |
| 不做质量检测 | 所有结果直接返回给 AI 模型判断 | |

**User's choice:** 中文低质量检测（跟随 OpenHanako）

### Q2: 检测到低质量时的处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 降级 + 兜底返回 | 低质量结果触发降级，所有 Provider 都低质量时返回第一个低质量结果 | ✓ |
| 直接返回不降级 | 低质量结果直接返回，AI 模型自行判断 | |
| 丢弃低质量结果 | 低质量结果丢弃，返回空结果 | |

**User's choice:** 降级 + 兜底返回

### Q3: 标准化输出格式？

| Option | Description | Selected |
|--------|-------------|----------|
| 标准化三字段 + 可选元数据 | {title, url, content, score?, metadata?} | ✓ |
| 仅三字段 | 只要 {title, url, content}，不要 score 和 metadata | |
| 扩展字段集 | {title, url, content, score, published_at, source} | |

**User's choice:** 标准化三字段 + 可选元数据

---

## Claude's Discretion

- 浏览器 Provider（DDG）的具体实现细节（User-Agent、请求头、DOM 解析）由实现者决定
- SSRF 防护的具体 IP 范围列表跟随 Node.js 标准库

## Deferred Ideas

- 浏览器 Provider（Bing/Google）— v2.5.x
- 中文搜索质量优化（扩展检测）— v2.5.x
- 搜索诊断信息展示（调试面板）— v2.5.x
- 用户自定义 Provider 优先级 — 未讨论
