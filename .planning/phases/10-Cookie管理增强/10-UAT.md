---
status: diagnosed
phase: 10-Cookie管理增强
source: [10-VERIFICATION.md]
started: 2026-07-26T15:35:00Z
updated: 2026-07-27T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 来源切换功能
expected: 打开 Cookie 管理面板后，可以看到 Session 和 File 两个标签页。点击 Session 标签显示实时 Cookie，点击 File 标签显示持久化 Cookie。
result: pass

### 2. 域名过滤功能
expected: Cookie 列表上方有域名过滤工具栏，支持"仅当前域名"、"含子域名"、"全部"三种模式。切换过滤模式后列表实时更新。
result: pass

### 3. 分页功能
expected: Cookie 列表每页显示 25 条，底部有分页控件。当 Cookie 超过 25 条时可以翻页。
result: pass

### 4. 单条编辑功能
expected: 每个 Cookie 行有编辑按钮。点击后弹出编辑模态框，包含 name（只读）、value、domain、path、expirationDate、secure、httpOnly、sameSite 字段。保存后 Cookie 立即更新。
result: pass

### 5. 单条删除功能
expected: 每个 Cookie 行有删除按钮。点击后显示确认对话框，确认后 Cookie 从列表中移除，同时从 Session 和文件中删除。
result: pass

### 6. 保存到文件（域名过滤）
expected: 点击保存按钮后，只保存当前域名及其子域名的 Cookie 到文件，不保存其他域名的 Cookie。显示成功提示包含保存数量。
result: issue
reported: "https://www.baidu.com/ 网址中点击保存保存了 65 个 cookie，但是这个域名只有6个，xiao 容器中"
severity: major

### 7. 样式一致性
expected: Cookie 管理面板宽度 750px，标签页、过滤栏、列表、分页控件样式与应用整体深色主题一致。
result: issue
reported: "cookie 显示区域背景太黑了，文字有点看不清（列表区背景过深，与文字对比度不足）"
severity: cosmetic

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "保存按钮只保存当前域名及其子域名的 Cookie 到文件"
  status: failed
  reason: "User reported: https://www.baidu.com/ 网址中点击保存保存了 65 个 cookie，但是这个域名只有6个，xiao 容器中"
  severity: major
  test: 6
  root_cause: "handleSaveToFile (src/renderer.js:2275-2290) 通过 document.querySelector('.webview-container[data-tab-id=...]') 获取当前 webview，但应用中从未存在 webview-container class（createWebviewForTab 创建裸 <webview> 直挂 browserView，无 class、无 data-tab-id）。选择器永远返回 null → domain 恒为 '' → 落入 fallback 分支 saveCookie → cookie:save → saveCookies() 用 ses.cookies.get({}) 无过滤保存容器全部 65 个 session Cookie。本应触达的 saveDomainCookies 从未执行。次级隐患：UI subdomain 过滤是 domain.endsWith('.'+cookieDomain) 匹配父域，saveDomainCookies 是 cookieDomain.endsWith('.'+domain) 匹配子域，方向相反。"
  artifacts:
    - path: "src/renderer.js"
      issue: "L2275-2314 handleSaveToFile 域名提取逻辑错误，永远走 save-all fallback"
    - path: "src/renderer.js"
      issue: "L591-641 createWebviewForTab 佐证不存在 webview-container 元素"
    - path: "src/container/cookie-manager.js"
      issue: "L92-162 saveCookies 无过滤保存全部（fallback 执行者，本身设计如此）"
    - path: "src/container/cookie-manager.js"
      issue: "L172-255 saveDomainCookies 正确函数但从未被触达，且过滤方向与 UI 相反"
  missing:
    - "handleSaveToFile 改用 showCookiesModal 同款模式提取域名：state.tabs.get(state.activeTabId).url → new URL().hostname（或复用 cookieState.currentDomain）"
    - "对齐 saveDomainCookies 过滤方向以匹配 UI（UI 所见为准，确保保存数与面板显示一致）"
  debug_session: ".planning/debug/save-cookie-wrong-domain-filter.md"

- truth: "Cookie 管理面板样式与应用整体深色主题一致，文字清晰可读"
  status: failed
  reason: "User reported: cookie 显示区域背景太黑了，文字有点看不清（列表区背景过深，与文字对比度不足）"
  severity: cosmetic
  test: 7
  root_cause: "Cookie 列表行文本继承原生 <dialog> UA 默认 color: black，渲染为纯黑 (#000) 在 #3a3a3a 背景上（对比度仅 1.9:1）。具体机制：renderCookiesList() 使用 .cookie-col-name/.cookie-col-value/.cookie-col-domain 类，这些类（main.css L620-646）只定义布局未定义 color；其祖先 .cookie-item/.cookies-list/.modal-content/.modal 也都没设 color。Chromium UA 样式表对 <dialog> 元素级 color:black 优先于 body 继承。像素级证据：模态表面 #2a2a2a ✓、行背景 #3a3a3a ✓（均符合 UI-SPEC），但行文本字形主色为 (0,0,0) 纯黑。历史成因：Phase 10 重构把旧 .cookie-name/.cookie-value/.cookie-domain（L761-783，含颜色，现已死代码）改名为 .cookie-col-* 时只迁移布局属性，遗漏颜色声明。"
  artifacts:
    - path: "src/styles/main.css"
      issue: "L620-646 .cookie-col-* 缺 color；L656-662 .cookie-item 缺 color；L328-334 .modal 未覆盖 dialog UA color；L761-783 旧 .cookie-name/.cookie-value/.cookie-domain 死代码"
    - path: "src/renderer.js"
      issue: "L2071-2127 renderCookiesList() 使用无颜色的类名"
    - path: "src/index.html"
      issue: "L270-313 Cookie 模态框结构（<dialog> 是问题根源）"
  missing:
    - "为 .cookie-item（或各 .cookie-col-*）添加显式颜色：name → var(--text-primary)，value/domain → var(--text-secondary)（旧设计 value 用 --text-muted #6b7280 对比度仅 2.4:1，不够）"
    - "防御性修复：.modal 上加 color: var(--text-primary)，杜绝 <dialog> 后代再次继承黑色"
    - "清理死代码 .cookie-name/.cookie-value/.cookie-domain"
  debug_session: ".planning/debug/cookie-list-bg-too-dark.md"
