# Phase 41 — API Coverage Matrix

**Generated:** 2026-08-27
**External APIs:** net.fetch, jsdom, @mozilla/readability, turndown

---

## Capability Surface

| Capability | Library | API Surface | Coverage Status |
|-----------|---------|-------------|-----------------|
| HTTP GET 请求 | net.fetch (Electron 内置) | `net.fetch(url, options)` — redirect:manual, AbortSignal.timeout, headers | FETCH-02 |
| HTTP 重定向处理 | net.fetch | 手动跟踪 301/302/307/308，逐跳 SSRF 校验 | FETCH-02, FETCH-04 |
| SSRF 防护 | search-manager.js (已有) | `isPrivateHost(hostname)` — DNS lookup + PRIVATE_IP_RANGES | FETCH-04 |
| HTML 解析 | jsdom | `new JSDOM(html, { url })` — 构建 DOM 环境 | FETCH-03 |
| 正文提取 | @mozilla/readability | `new Readability(document).parse()` — 去噪提取 | FETCH-03 |
| HTML→Markdown | turndown | `new TurndownService(opts).turndown(html)` | FETCH-03 |
| 内容截断 | 自实现 | maxLength 字符截断 + 截断标记 | FETCH-01, D-05, D-06 |
| JSON 美化 | JSON.stringify | `JSON.stringify(JSON.parse(raw), null, 2)` | D-04 |
| 配置存储 | electron-store | `configStore.get/set('search.*')` | CONFIG-01~04 |
| IPC 通道 | ipcMain/ipcRenderer | search-config:get/set/verify-key | CONFIG-04 |
| HTTP API | main.js 本地服务器 | /api/search-config/get/set/verify-key | CONFIG-01 |

## Decisions → Capability Mapping

| Decision | Capability | Implementation |
|----------|-----------|----------------|
| D-01 | Readability→turndown 管线 | jsdom + Readability + TurndownService |
| D-02 | 富文本模式 | turndown config: headingStyle:'atx', bulletListMarker:'-', remove:['script','style','nav','footer','aside'] |
| D-03 | 图片保留 | turndown 默认行为 `![alt](src)` |
| D-04 | Content-Type 判断 | HTML→Readability→turndown, JSON→stringify, text→raw |
| D-05 | 先转后截断 | text = markdown; if (text.length > maxLength) truncate |
| D-06 | 截断标记 | `\n\n[内容已截断，原始长度: X 字符，已显示: Y 字符]` |
| D-07 | 纯文本返回 | execute 返回 `{content: [{type:'text', text: markdown}]}` |
| D-08 | 可折叠子区域 | settings-group-header + settings-group-content toggle |
| D-09 | 左右分栏 | settings-ai-split 布局 |
| D-10 | 6 个 Provider | SEARCH_PROVIDERS 常量数组 |
| D-11 | auto 优先级 | 固定链：付费→免费→DDG |
| D-12 | 手动验证 | 验证按钮 click handler |
| D-13 | 测试查询词 'test' | doSearch('test', 1) |
| D-14 | 内联结果 | verify-result div + success/error class |
| D-15 | 先存后验 | configStore.set 先保存，verify 标记状态 |

## Risk Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| jsdom + Readability 兼容性 | Readability 需要完整 DOM API | jsdom 30.x 提供标准 DOM，已验证兼容 |
| turndown XSS | Markdown 中可能含恶意 HTML | 渲染时 DOMPurify 消毒（已有模式） |
| DNS rebinding | SSRF 绕过 | redirect:manual + 逐跳 DNS 校验 |
| API Key 泄露 | 日志/响应暴露 Key | maskApiKeys 遮蔽 + type="password" |
