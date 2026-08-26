# Requirements — v2.5 AI 网络搜索功能

**Milestone:** v2.5
**Scope:** AI 网络搜索（web_search + web_fetch）
**Research:** `.planning/research/SUMMARY.md`

---

## v2.5 Requirements

### 搜索基础设施

- [ ] **SEARCH-01**: search-manager.js 模块初始化 — electron-store 配置读取、Provider 注册表、搜索入口函数
- [ ] **SEARCH-02**: 速率限制器 — 每 Provider 独立策略（minIntervalMs + maxConcurrent + jitter），指数退避，429 响应处理
- [ ] **SEARCH-03**: SSRF 防护 — 私有 IP 检测（127.x/10.x/192.168.x/172.16-31.x/localhost），DNS 解析校验，逐跳重定向检查
- [ ] **SEARCH-04**: 搜索结果标准化 — 统一输出格式 `{title, url, content}`，Markdown 编号列表渲染

### web_search 工具

- [ ] **TOOL-01**: web_search 工具定义 — 注册到 `_buildRealmTools()`，参数：query（必填）、maxResults（可选，默认 10）
- [ ] **TOOL-02**: API Provider 实现 — Tavily（Bearer token）、Brave（X-Subscription-Token）、Serper（X-API-KEY）、AnySearch（Bearer/匿名）
- [ ] **TOOL-03**: Auto 智能 Fallback 策略 — 付费 API → anysearch_free → 浏览器 Provider，失败状态分类（rate_limited/auth/empty/low_quality/blocked）
- [ ] **TOOL-04**: 错误处理与用户反馈 — 搜索失败时返回明确错误信息，诊断信息（attempts 数组）

### web_fetch 工具

- [ ] **FETCH-01**: web_fetch 工具定义 — 参数：url（必填）、maxLength（可选，默认 12000）
- [ ] **FETCH-02**: URL 内容抓取 — 支持 HTML、JSON、纯文本，15 秒超时，最大 5 次重定向
- [ ] **FETCH-03**: HTML 转 Markdown — 使用 turndown 库，提取正文内容（去除 script/style/nav/footer）
- [ ] **FETCH-04**: SSRF 防护 — 复用 search-manager 的 isPrivateIp，重定向后再次校验

### 搜索配置 UI

- [ ] **CONFIG-01**: 设置页搜索配置子区域 — 在 AI 助手分区下新增"网络搜索"子区域
- [ ] **CONFIG-02**: Provider 选择下拉 — auto/tavily/brave/serper/anysearch/anysearch_free，切换即时生效
- [ ] **CONFIG-03**: API Key 管理 — 每个 Provider 独立输入框，添加/删除/验证（发送测试查询）
- [ ] **CONFIG-04**: IPC 通道 + preload 暴露 — get-search-config / set-search-config / verify-search-key

---

## Traceability

| Requirement | Phase | Implementation |
|-------------|-------|----------------|
| SEARCH-01 | TBD | search-manager.js |
| SEARCH-02 | TBD | search-manager.js: SearchRateLimiter |
| SEARCH-03 | TBD | search-manager.js: isPrivateIp + safeFetch |
| SEARCH-04 | TBD | search-manager.js: normalizeResults |
| TOOL-01 | TBD | ai-manager.js: web_search tool |
| TOOL-02 | TBD | search-manager.js: Provider implementations |
| TOOL-03 | TBD | search-manager.js: doAutoSearch |
| TOOL-04 | TBD | ai-manager.js: error handling |
| FETCH-01 | TBD | ai-manager.js: web_fetch tool |
| FETCH-02 | TBD | search-manager.js: fetchUrl |
| FETCH-03 | TBD | search-manager.js: htmlToMarkdown (turndown) |
| FETCH-04 | TBD | search-manager.js: isPrivateIp reuse |
| CONFIG-01 | TBD | settings-page.js |
| CONFIG-02 | TBD | settings-page.js + ipc-handlers.js |
| CONFIG-03 | TBD | settings-page.js + ipc-handlers.js |
| CONFIG-04 | TBD | ipc-handlers.js + preload.js |

---

## Future Requirements

- 浏览器 Provider（Bing/Google/DDG DOM 解析）— v2.5.x
- 中文搜索质量优化（低质量检测 + 字典/百科过滤）— v2.5.x
- 搜索诊断信息展示（调试面板）— v2.5.x
- 搜索结果高亮（在 AI 回复中标注信息来源）— v2.6+
- 搜索历史建议（基于用户搜索历史提供自动补全）— v2.6+

---

## Out of Scope

- **浏览器扩展搜索集成** — 不支持 Chrome/Firefox 扩展的搜索引擎
- **搜索结果持久化** — 搜索结果是临时数据，不存储到 SQLite
- **搜索结果缓存** — 时效性强，缓存失效策略复杂，不做缓存
- **自定义搜索引擎** — 不支持用户自定义搜索引擎 URL
