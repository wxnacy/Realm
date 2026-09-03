# devrequests 增强：渲染后 HTML 保存 + 统一 page_request_id + 列表页加宽

## 需求（已与用户确认）

1. **保存渲染后 HTML**：devMode 域名的网页渲染完成后，把最终渲染 DOM 的 HTML 存到主文档请求记录的新列 `rendered_html`，超 5MB 截断加标记（初版 2MB，实测微信文章页 DOM 4.1MB 被截，后调至 5MB；`response_body` 的 `MAX_RESPONSE_BODY_SIZE` 同步 1MB → 5MB）。
2. **统一 request-id**：一次主文档导航产生的主文档 + 全部子资源/API 请求共享同一个 `page_request_id`（表里已有 CDP 每请求唯一 id 列 `request_id`，新列必须叫 `page_request_id` 避免冲突）。SPA 同文档导航（isInPlace）不换 id。
3. **列表页 UI**：新增「主键 ID」「Request ID」「类型」列（ID/Request ID 置于最前），URL 列加宽，页面容器 1200px → 1600px 加宽。
4. **类型筛选与渲染视图**（实现期追加）：列表页增加「类型」筛选项；详情页「渲染后 HTML」tab 用 iframe srcdoc 真实渲染（sandbox 禁脚本），可切换源码；内容区 flex 自适应高度 + 滚动条常显。

## 数据流（现状）

`did-start-navigation(isMainFrame)` → `cdpManager.handleNavigation` → 域名匹配 → `attachDebugger + Network.enable` → Network 事件组 record → `writer.enqueue` → 2s flush 批量 INSERT `dev_requests_{containerId}` 表 → devrequests 页面 fetch `/api/devrequests/*`。

## 实施步骤

### 第 1 步：数据层 `dev-requests-writer.js`

1. **ensureTable**（109-139 行）：
   - CREATE TABLE 加 `page_request_id TEXT DEFAULT ''`、`rendered_html TEXT DEFAULT ''`
   - 加索引 `idx_{t}_page_request_id`
   - 新增 `migrateTableColumns(tableName)`：`PRAGMA table_info` 检查缺列则 `ALTER TABLE ADD COLUMN`（幂等），在 ensureTable 的 db.exec 后调用；`queryRecords` 的 tableExists 检查后也顺带调用（查询侧老表对齐）
2. **writeRecords**（276-312 行）：INSERT 加两列，取 `record.pageRequestId || ''` / `record.renderedHtml || ''`；事务前消费 pending 回写缓存（见 3）
3. **新增 `updateRenderedHtml(containerId, requestId, html)`** 解决时序：
   - `UPDATE ... SET rendered_html = ? WHERE request_id = ? AND (rendered_html IS NULL OR rendered_html = '')`
   - changes > 0 → 完成（最常见：主文档 enqueue 先于 did-finish-load）
   - changes = 0 → 存模块级 Map `pendingRenderedHtml`（key `containerId|requestId`，带时间戳），writeRecords insert 时消费
   - 过期兜底：>60s 或 Map 超 20 条清理最旧，防 2MB 字符串滞留内存
   - 加入 module.exports
4. **queryRecords**（327-388 行）：映射时剔除 `rendered_html`（否则 list 50 行 × 2MB 响应爆炸）；加可选 `options.pageRequestId` 过滤条件。`getRecordById` SELECT * 自动带新列，不改

### 第 2 步：id 生成与捕获 `cdp-manager.js`

1. **新增 `pageNavStates: Map<webContentsId, { pageRequestId, url, mainDocRequestId, captureTimer }>`** —— 不放 debuggerStates（`attachForAI` 377 行会整体覆写该条目）
2. **handleNavigation**（1000-1017 行）：签名加 `isInPlace`；域名匹配分支中 `!isInPlace` 时 `rotatePageNavState`（clearTimeout 旧 captureTimer → 生成 `crypto.randomUUID()` 新状态 → `scheduleRenderedHtmlCapture`）；isInPlace 不换 id
3. **handleRequestWillBeSent**（775-800 行）：签名加 webContents，`record.pageRequestId = pageNavStates.get(id)?.pageRequestId || null`；`params.type === 'Document'` 时记 `navState.mainDocRequestId = requestId`
4. **handleLoadingFailed**（926 行）：同样补 pageRequestId
5. **新增 `scheduleRenderedHtmlCapture(webContents, containerId, navState)`**：
   - `wc.once('did-finish-load', capture)` + `setTimeout(capture, 8000)` 兜底（Google accounts 类页 iframe 长期不 onload，main.js:443 注释已证）
   - capture：captured 防重入；`pageNavStates` 当前 pageRequestId 比对（被新导航取代则放弃）；`wc.isDestroyed()` 检查
   - `wc.executeJavaScript("'<!DOCTYPE html>\n' + document.documentElement.outerHTML")`（不依赖 debugger，DevTools detach 后仍工作）
   - 超 `MAX_RENDERED_HTML_SIZE`（2MB）截断 + `\n[截断：原始大小 N bytes]` 标记（同 fetchResponseBody 981 行风格）
   - `navState.mainDocRequestId` 存在时调 `writer.updateRenderedHtml(...)`
   - 失败 console.warn，不弹 toast
6. rotate 时 clearTimeout + webContents `destroyed` 时清理 pageNavStates 条目（防泄漏）

### 第 3 步：main.js

- `did-start-navigation` 回调（498-508 行）把 `isInPlace` 传给 `handleNavigation`
- `handleDevRequestsApi` list 路由（1643-1744 行）：读取 `pageRequestId` 查询参数透传 `queryRecords`

### 第 4 步：列表页 UI

- **src/devrequests.html**（58-63 行）：thead 加两列，列序：方法 | URL | 状态码 | ID | Request ID | 请求时间 | 耗时 | 大小
- **src/devrequests-page.js**：
  - `buildRecordRow`（302-392 行）：插两个 td。ID 列右对齐 monospace；Request ID 展示前 8 位，title 放完整 UUID，点击 `copyText(完整值)` + `stopPropagation` 防误触发展开
  - `buildDetailRow`（408-466 行）：colspan 6 → 8
  - `DETAIL_TABS`（395-401 行）加 `{ key: 'rendered-html', label: '渲染后 HTML' }`；`renderDetailContent`（474-498 行）加 case：list 响应已剔除 rendered_html，点击 tab 时按需 fetch `/api/devrequests/detail` 拉取并缓存进 record，加载中显示提示
- **src/styles/main.css**（3607-3680 段）：
  - 加 `.col-id { width: 70px; text-align: right; font-family: monospace; ... }`、`.col-page-request-id { width: 100px; font-family: monospace; ... cursor: copy; }`
  - `.devrequests-page`（3452-3463 行）`padding-inline` 的 1200px → 1600px
  - `.url-cell`（3697 行）`max-width: 500px` → 760px
  - CSP 约束：本页 `style-src 'self'`，全部走 main.css 类，无内联 style

### 第 5 步：独立详情页 `src/devrequest-detail-page.js`

- `renderHeader`（259-320 行）metaRow 加 `ID`、`Page Request`（前 8 位 + title 完整值，`buildMetaItem` 加可选 title 参数）
- `renderContent`（350-374 行）switch 加 case `'rendered-html'`：复用 `buildPreSection('渲染后 HTML', record.rendered_html || '(无渲染后 HTML)')`

## 涉及文件

| 文件 | 改动 |
|------|------|
| dev-requests-writer.js | 新列 + 迁移 + updateRenderedHtml + queryRecords 剔除/过滤 |
| cdp-manager.js | pageNavStates + isInPlace + 打标 + 渲染 HTML 捕获 |
| main.js | isInPlace 透传 + list API pageRequestId 参数 |
| src/devrequests.html | thead 两列 |
| src/devrequests-page.js | 行渲染 + colspan + rendered-html tab |
| src/styles/main.css | 列宽 + 页面加宽 |
| src/devrequest-detail-page.js | header meta + rendered-html 渲染 |

## 风险点

- 主文档导航失败无 load 信号 / mainDocRequestId 为 null → capture 直接跳过，无脏数据
- 老库迁移：PRAGMA 检查幂等，老记录新列为空
- 大 HTML 写库：队列最多堆积数条 2MB 字符串，2s flush 上界，可接受
- iframe DOM 不展开（以标签形式包含）——符合「主文档渲染后 HTML」语义

## 收尾

- 计划文档保存到 `docs/plan/`（用户要求，实现开始时先落盘）

## 实现后修订（2026-09-03）

实现与联调过程中的实际改动，与原计划的差异记录：

- **表结构新增三列**：`page_request_id` / `resource_type`（CDP 资源类型，类型列与筛选共用）/ `rendered_html`，均在 `migrateTableColumns` 中 PRAGMA 幂等迁移
- **主文档判定修复**：iframe 子文档的 `params.type` 同样是 `'Document'`，会覆盖 `navState.mainDocRequestId`（实测微信页 iframe open.weixin.qq.com 抢走了主页面 HTML 回写）。改为取 rotate 后**第一个** Document 请求（主文档必然先于 iframe 发起）
- **截断上限**：`MAX_RENDERED_HTML_SIZE`（rendered_html）与 `MAX_RESPONSE_BODY_SIZE`（response_body）均为 5MB。实测 3-4MB 的微信文章页 DOM 组成：脚本 ~75% + 内联 CSS ~21% + 正文仅 ~1.5%，截断只砍尾部脚本时视觉渲染无损，但正文超 5MB 仍会缺尾部
- **详情页布局**：`max-height: calc(100vh - Npx)` 固定偏移在 header/URL 换行时估不准（内容框超出窗口底部），改为 flex 自适应链（`.devrequest-detail-page` 100vh flex column → `#detailMain` flex:1 → `.detail-content` flex:1 + overflow-y）；`.detail-pre` 移除内部 500px 滚动统一由内容区滚动；`::-webkit-scrollbar` 常显样式（macOS overlay 滚动条平时不可见，被感知为「无法滚动」）
- **渲染视图**：iframe srcdoc + `sandbox`（全禁脚本/表单/弹窗/导航），「渲染/源码」切换；CSP 放宽 `style-src 'unsafe-inline' https: http: data:` 与新增 `font-src`（srcdoc 继承父页 CSP，不放行则渲染丢样式），顺带修复 markup 内联 `style="display:none"` 被 CSP 拦截的问题
- **CSS 变量修复**：`--text-tertiary` 未定义（3 处引用，含滚动条 thumb hover 色），hover 时 background 声明整体失效回落透明，感知为「滚动条悬停消失」；全部改为 `--text-secondary`
- **列表页列序**：最终为 ID | Request ID | 方法 | URL | 类型 | 状态码 | 请求时间 | 耗时 | 大小（9 列，colspan=9）；类型筛选 `HTML→Document`、`API→XHR+Fetch`（IN 合并）、`CSS→Stylesheet`、`WS→WebSocket`，其余同名精确匹配

## 验证方式（dev 环境）

1. `npm run dev` → 设置页开 devMode + 添加监控域名
2. 需求 2：主文档 + 子资源/API 共享同一 Request ID 前缀；SPA 站内跳转 id 不变；新导航换 id；loadingFailed 记录也带 id
3. 需求 1：主文档记录「渲染后 HTML」tab 可见动态渲染后 DOM（对比 viewsource 原始 HTML）；>2MB 页面有截断标记；curl detail 确认字段落库
4. 需求 3：8 列不错位（colspan=8）、Request ID 点击复制、页面 1600px 居中
5. 迁移幂等：老 dev-requests.db 重启两次，ALTER 不报错
6. 边界：加载中途关 tab；开 DevTools 后刷新捕获仍工作；非监控域名往返
