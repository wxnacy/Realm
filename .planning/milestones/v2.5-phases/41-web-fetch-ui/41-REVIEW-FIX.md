---
phase: 41-web-fetch-ui
fixed_at: 2026-08-27T14:30:00Z
review_path: .planning/phases/41-web-fetch-ui/41-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-08-27T14:30:00Z
**Source review:** .planning/phases/41-web-fetch-ui/41-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical + 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: verify-key 并发竞态 — HTTP handler 备份/恢复 apiKeys 模式问题，IPC handler 未使用传入参数

**Files modified:** `main.js`, `ipc-handlers.js`
**Commit:** 073474f
**Applied fix:** 将 HTTP handler 和 IPC handler 的 verify-key 实现从"备份/恢复整个 apiKeys 对象"改为"按单个 provider 备份/恢复 key"。IPC handler 现在正确使用传入的 `provider` 和 `apiKey` 参数，临时写入 configStore 后执行 doSearch，finally 块只恢复该 provider 的原始 key，避免并发请求互相覆盖。

### CR-02: search-config:set 缺少输入校验

**Files modified:** `main.js`, `ipc-handlers.js`
**Commit:** b6ef577
**Applied fix:** 在 HTTP handler 和 IPC handler 中添加输入校验：(1) provider 必须是已知字符串（auto/tavily/brave/serper/anysearch/anysearch_free），(2) apiKeys 必须是对象且键值均为字符串。HTTP handler 返回 400 错误，IPC handler 返回 `{ success: false, error }`。

### WR-01: web_fetch 工具 catch 错误后返回文本而非抛异常

**Files modified:** `ai-manager.js`
**Commit:** 46f1991
**Applied fix:** 将 `web_fetch` 工具的 catch 块从返回 `{ content: [{ type: 'text', text: '抓取失败: ...' }] }` 改为 `throw new Error('抓取失败: ...')`，与其他工具（read_page_content、fill_form）行为一致，使 pi-agent-core 框架能正确感知工具失败。

### WR-02: fetchUrl 重定向循环未校验目标协议

**Files modified:** `search-manager.js`
**Commit:** 2b69a22
**Applied fix:** 在重定向循环中，URL 解析后、下一跳 isPrivateHost 检查前，增加协议校验：如果 `currentUrl` 不以 `http://` 或 `https://` 开头，抛出错误拒绝重定向。防止 `javascript:` / `data:` 等非 HTTP 协议被 net.fetch 处理。

### WR-03: showConfirmBar 使用 innerHTML 拼接消息（XSS 隐患）

**Files modified:** `src/settings-page.js`
**Commit:** 4698e80
**Applied fix:** 将 `showConfirmBar` 函数的 innerHTML 模板字符串替换为 DOM 创建 API（`document.createElement` + `textContent`），消除 HTML 注入风险。消息文本和按钮文本均通过 textContent 设置。

### WR-04: settings.html 内联 style 在 CSP 下不生效

**Files modified:** `src/settings.html`, `src/styles/main.css`
**Commit:** ed36822
**Applied fix:** (1) 在 main.css 中为 `.settings-section` 添加 `display: none` 规则，并为 `#setDefaultBrowserBtn`、`#rulesAddForm`、`#rulesFileInput`、`#aiEditorForm`、`#aiEnvVarHint`、`#aiModelEmpty`、`#aiModelError`、`#searchEditorForm` 添加 `display: none` 规则。(2) 从 settings.html 中移除所有 16 处 `style="display:none;"` 内联样式属性。JS 通过 CSSOM 设置 `style.display = 'block'` 覆盖 CSS 规则的行为不受影响。

## Skipped Issues

None — all findings were successfully fixed.

---

_Fixed: 2026-08-27T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
