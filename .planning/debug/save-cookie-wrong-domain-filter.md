---
status: fixed
trigger: "在 https://www.baidu.com/ 页面打开 Cookie 管理面板（容器名为 xiao），点击\"保存到文件\"按钮保存了 65 个 Cookie，但该域名实际只有 6 个 Cookie。预期只保存当前域名及其子域名的 Cookie。"
created: 2026-07-27T00:00:00Z
updated: 2026-07-27T00:00:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 【已确认】handleSaveToFile 中 querySelector('.webview-container[data-tab-id=...]') 永远返回 null → domain 恒为 '' → 走 fallback 分支 saveCookie → saveCookies() 无过滤保存全部 65 个 session Cookie
test: 代码路径静态追踪 + 全库搜索 webview-container 选择器
expecting: 选择器无匹配元素（已证实）；fallback toast 无域名（与用户报告一致）
next_action: 返回 ROOT CAUSE FOUND 给 team-lead（模式为 find_root_cause_only，不执行修复）

reasoning_checkpoint:
  hypothesis: "webview-container 选择器永不匹配导致 domain=''，handleSaveToFile 回退到保存全部 Cookie"
  confirming_evidence:
    - "全库 grep 'webview-container' 仅 1 处命中 —— 就是该 querySelector 本身；createWebviewForTab（renderer.js:606-632）创建裸 <webview> 直挂 browserView，无 class、无 data-tab-id"
    - "fallback 分支 saveCookie→cookie:save→saveCookies() 使用 ses.cookies.get({}) 无过滤，返回 count=session总数+保留数=65，与用户报告一致"
    - "用户报告未提到 toast 含域名，与 fallback toast 格式（'已保存 N 个 Cookie 到文件'，无域名）一致；域名分支 toast 为 '已保存 N 个 {domain} 的 Cookie'"
  falsification_test: "若库中任何元素带 webview-container class 或 toast 含域名，则假设错误 —— 均未观察到"
  fix_rationale: "按 showCookiesModal 的既有正确模式取域名（state.tabs.get(state.activeTabId).url），使 saveDomainCookies 被真正调用"
  blind_spots: "未实际运行 app 观察 toast；但 querySelector 对不存在 class 必然返回 null，代码路径确定。另有次级隐患：saveDomainCookies 过滤方向（匹配子域名 cookie）与 UI subdomain 过滤（匹配父域名 cookie）语义相反，修复主因后保存数可能仍少于 UI 显示的 6 个"

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: 点击保存按钮后，只保存当前域名及其子域名的 Cookie 到文件，不保存其他域名的 Cookie。在 baidu.com 下应只保存约 6 个 Cookie。
actual: 在 https://www.baidu.com/ 网址中点击保存，保存了 65 个 cookie，但是这个域名只有 6 个，容器为 xiao
errors: None reported
reproduction: UAT Test 6 — 打开百度页面 → Cookie 管理面板 → 切换到 xiao 容器 → 点击"保存到文件"
started: UAT Phase 10 测试时发现

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: cookie:save IPC 通道本身过滤错误（saveCookies 不过滤域名）
  evidence: cookie:save 设计即为"保存全部"（合并模式，JSDoc 明确说明）；真正应走的通道是 cookie:save-domain，但它从未被调用到 —— 问题在渲染进程域名提取，不在主进程过滤器
  timestamp: 2026-07-27T00:00:00Z
- hypothesis: saveDomainCookies 的子域名匹配逻辑（endsWith）错误导致匹配过多
  evidence: 该函数从未被执行（domain 恒为 ''）；且其过滤只会偏严不会偏宽 —— 不可能产生 65 这个总数
  timestamp: 2026-07-27T00:00:00Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-27T00:00:00Z
  checked: src/renderer.js:2275-2314 handleSaveToFile
  found: 用 document.querySelector('.tab.active') + querySelector(`.webview-container[data-tab-id="..."]`) 提取域名；webview 为 null 时 domain 保持 ''，走 else 分支调用 window.realmAPI.saveCookie()（保存全部）
  implication: 域名提取依赖一个不存在的 DOM 结构，fallback 路径会被静默触发
- timestamp: 2026-07-27T00:00:00Z
  checked: 全库 grep "webview-container"
  found: 仅 1 处命中 —— handleSaveToFile 的 querySelector 本身。createWebviewForTab（renderer.js:606-632）创建的是裸 <webview> 元素，直接 appendChild 到 elements.browserView，无 webview-container class、无 data-tab-id 属性
  implication: 选择器 100% 返回 null，domain 恒为 ''，saveDomainCookies 永远不会被调用
- timestamp: 2026-07-27T00:00:00Z
  checked: cookie-manager.js:92-162 saveCookies / ipc-handlers.js:306-312 cookie:save / preload.js:171 saveCookie
  found: fallback 链路 saveCookie → cookie:save → saveCookies() 执行 ses.cookies.get({}) 无过滤取全部 session Cookie，合并文件旧 Cookie 后返回 count=mergedCookies.length
  implication: 65 = xiao 容器 session 中累积的所有网站 Cookie 数（+保留的旧 Cookie），完全符合用户观察
- timestamp: 2026-07-27T00:00:00Z
  checked: renderer.js:2275 两个分支的 toast 文案
  found: 域名分支 toast 为 "已保存 N 个 {domain} 的 Cookie 到文件"；fallback 分支为 "已保存 N 个 Cookie 到文件"（无域名）。用户报告仅说"保存了 65 个 cookie"，未提及域名
  implication: 与 fallback 分支被触发的假设一致
- timestamp: 2026-07-27T00:00:00Z
  checked: renderer.js:1951-1966 showCookiesModal（对照组）
  found: 面板用正确模式取域名：state.tabs.get(state.activeTabId).url → new URL().hostname → cookieState.currentDomain
  implication: 同一文件中存在正确实现，handleSaveToFile 是独立发明的错误路径；UI 能正确显示 6 个正是因为用了 state.tabs
- timestamp: 2026-07-27T00:00:00Z
  checked: 次级隐患 —— applyDomainFilter（renderer.js:2037-2045）vs saveDomainCookies（cookie-manager.js:183-194）
  found: UI 的 subdomain 过滤是 domain.endsWith('.' + cookieDomain)（匹配父域名 cookie，如 .baidu.com）；保存过滤是 cookieDomain.endsWith('.' + domain)（匹配子域名 cookie）。方向相反。www.baidu.com 下百度大部分 Cookie 设在 .baidu.com 父域
  implication: 即使修复主因，按当前 saveDomainCookies 语义保存数可能仍 ≠ UI 显示的 6 个；修复时需对齐两边过滤语义（建议以 UI 所见为准）
- timestamp: 2026-07-27T00:00:00Z
  checked: 三级隐患 —— webview.getAttribute('src')
  found: 导航走 webview.loadURL()（renderer.js:2802）及页面内跳转，src attribute 不随导航更新；库内既有正确模式是 webview.getURL()（renderer.js:731）
  implication: 即使选择器存在，getAttribute('src') 也只会拿到初始 URL；修复时不应沿用此方式

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: handleSaveToFile（src/renderer.js:2275-2290）用 document.querySelector('.webview-container[data-tab-id="..."]') 获取当前 webview，但应用中从未存在带 webview-container class 的元素（webview 是裸元素直挂 browserView），选择器永远返回 null → domain 恒为 '' → 落入 fallback 分支 window.realmAPI.saveCookie() → cookie:save → saveCookies() 无过滤保存容器内全部 session Cookie（65 个）。正确域名提取模式就在同文件 showCookiesModal 中：state.tabs.get(state.activeTabId).url。
fix: （未修复 —— find_root_cause_only 模式）方向：handleSaveToFile 改用 state.tabs.get(state.activeTabId).url 提取域名（或复用面板已算好的 cookieState.currentDomain）；同时对齐 saveDomainCookies 与 applyDomainFilter 的过滤语义（父域名匹配方向），确保保存结果与 UI 所见一致
verification: （待修复后验证）
files_changed: []
