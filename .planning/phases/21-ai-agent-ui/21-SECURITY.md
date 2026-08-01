---
phase: 21
slug: ai-agent-ui
threats_open: 0
asvs_level: 1
audited: 2026-08-01
---

# Phase 21 — Security Threat Verification

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-21-01 | Tampering | AI Response Rendering | medium | mitigate | CLOSED (hardened) | `renderAIMarkdown()` in src/renderer.js：marked.parse + DOMPurify.sanitize；DOMPurify 缺失时降级为全量转义 |
| T-21-02 | Tampering | Input Validation | low | accept | CLOSED (accepted) | 用户输入直接发送给 AI，渲染进程不执行用户输入 |
| T-21-03 | Tampering | Tool Result Rendering | medium | mitigate | CLOSED | renderToolCard 参数/结果均用 textContent（src/renderer.js） |
| T-21-04 | Tampering | Clipboard API | low | accept | CLOSED (accepted) | navigator.clipboard 浏览器原生安全机制 |

## Security Audit 2026-08-01

| Metric | Count |
|--------|-------|
| Threats found | 4 |
| Closed | 4 |
| Open | 0 |

### T-21-01 强化说明（重要）

原缓解声称"marked 默认转义 HTML 防 XSS"——**该前提不成立**：marked v5+ 移除了
sanitize 选项，原生 HTML 原样输出（已实测验证：`<img src=x onerror=...>` 完整透传）。
攻击路径：恶意网页 → 提示注入 → 模型输出 HTML/JS → innerHTML 渲染到主窗口 →
可访问 window.realmAPI（读取 Cookie/历史/配置）。

修复（本次审计中完成）：
- 安装 dompurify@3.4.12，index.html 加载 UMD 构建
- 新增 `renderAIMarkdown()`：marked.parse 输出必经 DOMPurify.sanitize
- DOMPurify 未加载时降级为全量 HTML 转义（宁可丢格式，不放行 XSS）
- 三处渲染点（renderAIMessages / updateAIStreamingBubble / finalizeAIStreamingBubble）
  统一收敛到该 helper

## Accepted Risks

| Threat ID | Reason |
|-----------|--------|
| T-21-02 | 用户输入仅作为 prompt 发送，渲染进程无执行路径；主进程 Agent 处理 |
| T-21-04 | 复制使用 navigator.clipboard 原生 API，浏览器安全机制兜底 |
