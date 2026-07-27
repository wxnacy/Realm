# Phase 12: 开发者模式 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 12-开发者模式
**Areas discussed:** CDP附加策略, SQLite存储方案, 写入队列设计, 请求数据查看

---

## CDP附加策略

### Q1: 调试器什么时候附加到 webview？

| Option | Description | Selected |
|--------|-------------|----------|
| 按需附加（推荐） | tab 加载的域名匹配抓取列表时才附加调试器，离开该域名时断开。节省内存，但每次附加有微小延迟。 | ✓ |
| 持久附加 | 只要域名在抓取列表中，tab 创建时就附加调试器，关闭 tab 时才断开。抓取更可靠，但内存开销更大。 | |
| 全局附加 | 开发者模式开启时，所有 tab 都附加调试器（不管域名）。简单粗暴，但性能开销最大。 | |

**User's choice:** 按需附加（推荐）
**Notes:** 无额外说明

### Q2: 匹配逻辑在哪里执行？

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程统一管理（推荐） | 主进程监听 webview 的 did-start-navigation 事件，检查 URL 域名是否在抓取列表中，匹配则附加调试器。集中在 main.js 管理。 | ✓ |
| 渲染进程通知主进程 | 每个 webview 的 did-navigate 事件中检查并附加。逻辑分散但更接近数据源。 | |

**User's choice:** 主进程统一管理（推荐）
**Notes:** 无额外说明

### Q3: 需要抓取哪些 CDP 事件？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础请求/响应（推荐） | 只抓 Network.requestWillBeSent 和 Network.responseReceived，包含 URL、方法、头、Cookie。够用且轻量。 | |
| 包含响应体 | 基础 + Network.dataReceived（响应体分片）、Network.loadingFinished/Failed。可获取完整响应体但数据量大。 | ✓ |
| 全量 Network 事件 | 所有 Network.* 事件，包括 WebSocket、EventSource 等。最全但开销最大。 | |

**User's choice:** 包含响应体
**Notes:** 无额外说明

### Q4: 调试器附加失败或断开时怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 静默 + 状态指示（推荐） | 失败时静默跳过，不弹窗不阻塞。用户可从设置页看到"抓取状态"指示（如绿/红点）。简单可靠。 | |
| toast 提示 + 继续 | 失败时弹 toast 提示"调试器附加失败"，但不阻塞页面加载。用户感知更强。 | ✓ |

**User's choice:** toast 提示 + 继续
**Notes:** 无额外说明

---

## SQLite存储方案

### Q1: 抓取的请求数据存在哪里？

| Option | Description | Selected |
|--------|-------------|----------|
| 容器数据库内（推荐） | 每个容器的数据库文件里加一张 dev_requests 表。复用现有 better-sqlite3 连接，按容器隔离。 | ✓ |
| 独立数据库文件 | 新建独立的 dev-capture.sqlite 文件。数据完全独立，不影响容器数据库大小。 | |

**User's choice:** 容器数据库内（推荐）
**Notes:** 无额外说明

### Q2: 表结构怎么设计？

| Option | Description | Selected |
|--------|-------------|----------|
| 统一表 + 容器列 | 所有容器共用一个表名 dev_requests，用 container_id 列区分。查询时按容器过滤。简单，但表会随容器增多而膨胀。 | |
| 每容器独立表（推荐） | 每个容器独立的表名（如 dev_requests_work、dev_requests_personal）。天然隔离，但表名需要动态拼接（已验证 container ID 白名单防注入）。 | ✓ |

**User's choice:** 每容器独立表（推荐）
**Notes:** 无额外说明

### Q3: 数据保留策略？

| Option | Description | Selected |
|--------|-------------|----------|
| FIFO 上限（推荐） | 每表上限 N 条（如 10000），超过时自动删除最旧的。简单可预测，类似历史记录的 FIFO 策略。 | |
| 按天数保留 | 用户可配置保留天数，自动清理过期数据。灵活但需要定时清理任务。 | ✓ |
| 手动清理 | 不自动清理，用户手动清空。最简单但可能占满磁盘。 | |

**User's choice:** 按天数保留
**Notes:** 无额外说明

### Q4: 响应体怎么存储？

| Option | Description | Selected |
|--------|-------------|----------|
| 直接存储 | 响应体直接存为 BLOB/TEXT 字段。简单直接，但大响应体（如图片、文件下载）会快速膨胀数据库。 | |
| 仅文本响应（推荐） | 只存 JSON/API 类响应（Content-Type 为 application/json、text/* 等），跳过二进制内容（图片、视频、文件下载）。更实用，数据量可控。 | ✓ |
| 文件 + 数据库路径 | 响应体存为磁盘文件，数据库只存文件路径。适合大响应，但文件管理复杂。 | |

**User's choice:** 仅文本响应（推荐）
**Notes:** 无额外说明

---

## 写入队列设计

### Q1: 队列满了怎么办？

| Option | Description | Selected |
|--------|-------------|----------|
| 丢弃新请求 | 队列达到上限（如 1000 条）时，丢弃新请求并记录丢弃计数。简单，但可能丢失重要数据。 | |
| 紧急 flush（推荐） | 队列满时触发紧急 flush，将当前队列全部写入磁盘后再继续接收。不丢数据但可能短暂阻塞。 | ✓ |
| 无上限队列 | 队列设为无上限，依赖 flush 频率控制内存。极端情况下可能 OOM。 | |

**User's choice:** 紧急 flush（推荐）
**Notes:** 无额外说明

### Q2: flush 频率怎么定？

| Option | Description | Selected |
|--------|-------------|----------|
| 定时 2 秒（推荐） | 每 2 秒 flush 一次，不管队列有多少条。简单可预测，对 SQLite 写入友好。 | ✓ |
| 定量 50 条 | 队列积累到 N 条（如 50 条）时立即 flush。响应更快但写入更频繁。 | |
| 混合策略 | 2 秒 OR 50 条，哪个先触发就 flush。兼顾两者优点。 | |

**User's choice:** 定时 2 秒（推荐）
**Notes:** 无额外说明

### Q3: 写入失败时怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 重试 3 次 + 丢弃（推荐） | 写入失败时将失败的条目放回队列头部，下次 flush 重试。最多重试 3 次，超过后丢弃并记录错误日志。 | ✓ |
| 丢弃 + 日志 | 写入失败时不重试，直接丢弃并记录错误日志。最简单但可能丢数据。 | |
| 落盘恢复 | 写入失败时将数据写入临时文件，下次启动时恢复。不丢数据但实现复杂。 | |

**User's choice:** 重试 3 次 + 丢弃（推荐）
**Notes:** 无额外说明

### Q4: 队列放在哪个进程？

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程统一队列（推荐） | 主进程维护写入队列，所有容器的抓取数据统一收集、批量写入。集中管理，flush 逻辑简单。 | ✓ |
| 每容器独立队列 | 每个容器一个独立队列，写入互不影响。隔离好但 flush 逻辑分散。 | |

**User's choice:** 主进程统一队列（推荐）
**Notes:** 无额外说明

---

## 请求数据查看

### Q1: 捕获的请求在哪里查看？

| Option | Description | Selected |
|--------|-------------|----------|
| 设置页内嵌 | 在设置页的开发者模式区域下方直接展示请求列表。操作集中，但设置页会变得很复杂。 | |
| 独立 realm:// 页面（推荐） | 新建 realm://devrequests 页面，通过工具栏或设置页链接进入。独立空间，可展示更丰富的内容。 | ✓ |
| 导出 HAR 文件 | 提供导出为 HAR 文件的功能，用户用外部工具（如 Chrome DevTools）查看。最简单但需要额外步骤。 | |

**User's choice:** 独立 realm:// 页面（推荐）
**Notes:** 无额外说明

### Q2: 请求列表怎么展示？

| Option | Description | Selected |
|--------|-------------|----------|
| 表格视图（推荐） | 表格形式展示：URL、方法、状态码、时间、大小等列。类似 Chrome DevTools Network 面板。信息密度高。 | ✓ |
| 卡片视图 | 每个请求一个卡片，显示关键信息。更友好但空间利用率低。 | |

**User's choice:** 表格视图（推荐）
**Notes:** 无额外说明

### Q3: 点击单条请求怎么展示详情？

| Option | Description | Selected |
|--------|-------------|----------|
| 行内展开面板（推荐） | 点击请求行后在下方展开详情面板，显示 Headers、Body、Response 等标签页。不离开列表页。 | ✓ |
| 模态框详情 | 点击后弹出模态框显示完整详情。独立空间大但会遮挡列表。 | |
| 左右分栏 | 点击后在右侧显示详情面板（类似 Chrome DevTools）。列表和详情并排显示。 | |

**User's choice:** 行内展开面板（推荐）
**Notes:** 无额外说明

### Q4: 需要哪些过滤和搜索功能？

| Option | Description | Selected |
|--------|-------------|----------|
| 域名 + 方法 + 搜索（推荐） | 按域名过滤 + 按请求方法（GET/POST等）过滤 + 关键词搜索 URL。实用且实现简单。 | ✓ |
| 仅域名过滤 | 只按域名过滤。最简单但功能有限。 | |
| 全量过滤器 | 域名 + 方法 + 状态码 + 时间范围 + 关键词搜索。最全但 UI 复杂。 | |

**User's choice:** 域名 + 方法 + 搜索（推荐）
**Notes:** 无额外说明

---

## Claude's Discretion

以下领域 Claude 自行决定：
- 设置页开发者模式区域的具体 UI 布局和样式细节
- 域名选择器的具体交互方式（下拉选择 vs 自动完成输入框）
- 请求表格的列宽、排序默认值
- realm://devrequests 页面的整体视觉风格
- 写入队列的具体上限值（1000 条为建议值）
- CDP 附加/断开的生命周期管理细节
- 数据保留天数的默认值和范围限制

## Deferred Ideas

None — discussion stayed within phase scope
