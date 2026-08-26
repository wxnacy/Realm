# Domain Pitfalls: Realm Browser AI 网络搜索功能

**Domain:** AI Agent 网络搜索工具（Electron 桌面浏览器）
**Researched:** 2026-08-26

## Critical Pitfalls

### Pitfall 1: 浏览器 Provider CAPTCHA 触发

**What goes wrong:** Google/Bing 检测到自动化搜索，返回 CAPTCHA 页面而非搜索结果
**Why it happens:** 浏览器 Provider 使用程序化请求模拟用户搜索，搜索引擎的反爬机制会识别并拦截
**Consequences:** 浏览器 Provider 完全失效，如果 Auto Fallback 链中只有浏览器 Provider，搜索功能不可用
**Prevention:**
- 浏览器 Provider 作为最后的兜底方案，不作为首选
- 实现 CAPTCHA 页面检测（`isCaptchaPage()` 检查页面文本中的 "captcha"/"unusual traffic"/"verify you are human"）
- 检测到 CAPTCHA 时立即 fallback 到下一个 Provider，不等待用户干预
**Detection:** 搜索结果为空或包含 CAPTCHA 关键词时触发 fallback

### Pitfall 2: Electron 主进程的 SSRF 风险

**What goes wrong:** web_fetch 工具被利用访问 `localhost`、`127.0.0.1`、`192.168.x.x` 等内网地址
**Why it happens:** Electron 主进程运行在用户本地网络中，可以直接访问本地服务（如数据库管理面板、路由器管理页面）
**Consequences:** 攻击者可通过 AI 对话诱导工具访问内网服务，窃取敏感信息或执行操作
**Prevention:**
- `isPrivateIp()` 检测所有私有 IP 范围（10.x/172.16-31.x/192.168.x）
- 检测 localhost/0.0.0.0/::1/169.254.169.254（云元数据）
- 重定向后再次检查目标地址
- 仅允许 http/https 协议
**Detection:** SSRF 防护应有单元测试覆盖所有边界情况

### Pitfall 3: 浏览器 Provider 的 Electron BrowserWindow 隔离

**What goes wrong:** 浏览器 Provider 复用用户可见的 BrowserWindow 或 webview，搜索过程干扰用户操作
**Why it happens:** 为简化实现，直接在现有窗口中加载搜索引擎页面
**Consequences:** 用户当前页面被覆盖；搜索完成后的页面残留；Cookie/Session 污染
**Prevention:**
- 使用隐藏的 BrowserWindow（`show: false`）进行搜索
- 使用独立的 Session partition（`partition: 'persist:search-provider'`）
- 搜索完成后立即销毁 BrowserWindow
**Detection:** 用户反馈当前页面被意外导航

## Moderate Pitfalls

### Pitfall 4: 搜索 API 免费额度耗尽

**What goes wrong:** AnySearch Free 或 Tavily/Brave 免费额度用完，搜索功能突然不可用
**Prevention:**
- Auto Fallback 链设计：一个 Provider 失败自动切换到下一个
- 速率限制器控制调用频率，避免过快消耗额度
- 设置页显示各 Provider 的剩余额度（如果 API 支持查询）

### Pitfall 5: 搜索结果格式不一致

**What goes wrong:** 不同 Provider 返回的结果字段名不同（Tavily 用 `content`，Serper 用 `snippet`，Brave 用 `description`）
**Prevention:**
- 结果标准化层：所有 Provider 返回统一的 `{title, url, content}` 格式
- 每个 Provider 的结果映射函数独立维护

### Pitfall 6: turndown 库的 XSS 风险

**What goes wrong:** web_fetch 抓取的 HTML 包含恶意脚本，turndown 转换后仍保留危险内容
**Prevention:**
- 转换前用 DOMPurify 消毒 HTML（复用现有 ai-manager.js 的 DOMPurify 依赖）
- 或在 turndown 转换规则中过滤 script/style 标签

## Minor Pitfalls

### Pitfall 7: 搜索超时导致 AI 对话卡住

**What goes wrong:** 搜索 API 响应慢（>30s），AI 对话一直等待
**Prevention:**
- 所有 fetch 调用使用 `AbortSignal.timeout(30000)`（参考 HanaAgent）
- 浏览器 Provider 使用更长超时（60s），因为需要加载页面

### Pitfall 8: 搜索引擎页面 DOM 结构变化

**What goes wrong:** Bing/Google/DuckDuckGo 更新页面结构，浏览器 Provider 的解析脚本失效
**Prevention:**
- 解析脚本与核心逻辑分离（独立的 `browser-search-extractors.js`）
- CAPTCHA 检测作为兜底：解析失败时检测是否为 CAPTCHA 页面
- Auto Fallback 确保单个 Provider 失败不影响整体功能

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 37: 搜索基础设施 | 速率限制器状态丢失（应用重启后冷却期重置） | 可接受：重启后冷却期重置是合理的，避免持久化复杂度 |
| Phase 38: web_search 工具集成 | 系统提示词过长导致 token 浪费 | 简洁描述工具用途，详细用法放在工具 description 中 |
| Phase 39: web_fetch 工具 | DNS rebinding 绕过 SSRF 防护 | 先解析 DNS 再检查 IP（但 Electron 环境中需要额外的 DNS 查询） |
| Phase 40: 浏览器 Provider | Google 搜索结果页面有多种布局变体 | 解析脚本需要覆盖多种选择器；失败时 fallback 到其他 Provider |

## Sources

- HanaAgent 参考实现中的 CAPTCHA 检测和 SSRF 防护代码
- OWASP SSRF Prevention Cheat Sheet
- Electron Security Docs: https://www.electronjs.org/docs/latest/tutorial/security
