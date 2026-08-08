---
phase: 28-player
fixed_at: 2026-08-08T14:30:00Z
review_path: .planning/phases/28-player/28-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-08-08T14:30:00Z
**Source review:** .planning/phases/28-player/28-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical + 4 warning)
- Fixed: 4
- Skipped: 1

## Fixed Issues

### WR-01: player.html CSP 过于宽松

**Files modified:** `src/player.html`
**Commit:** 01b3441
**Applied fix:** 移除 `'unsafe-eval'`（防止 eval/XSS），将 `connect-src` 从通配符 `*` 改为 `'self' blob: data: https:`，仅允许 HTTPS 端点（视频流 CDN 需要），禁止 http: 明文请求。

### WR-02: renderMediaList 中 type 值未转义即拼入 HTML

**Files modified:** `src/renderer.js`
**Commit:** c84ff83
**Applied fix:** 添加 `ALLOWED_MEDIA_TYPES` 白名单（`m3u8/mp4/flv/webm/unknown`），对 `item.type` 做校验后再拼入模板，防止不可信输入通过属性逃逸造成 XSS。

### WR-03: media:report-detected IPC 未校验 videos 数组元素结构

**Files modified:** `media-sniffer.js`
**Commit:** 8aae18b
**Applied fix:** 在 `handleScriptDetected` 中校验每个 video 项：`url` 必须为 `http` 开头的字符串，`type` 必须为字符串（如有），防止恶意注入脚本上报畸形数据。

### WR-04: addMedia 内部 FILTERED_URL_RE 正则每次调用都重新创建

**Files modified:** `media-sniffer.js`
**Commit:** 8aae18b
**Applied fix:** 将 `FILTERED_URL_RE` 正则从 `addMedia` 方法内部移至文件顶部常量区域，避免每次调用都重新编译，符合项目"常量放顶部"的约定。

## Skipped Issues

### CR-01: getMediaListByContainer 定义在类外部 -- 语法错误

**File:** `media-sniffer.js:370-392`
**Reason:** 已在之前的提交 64287eb 中修复（"fix(28): move getMediaListByContainer inside MediaSniffer class body"）。当前代码中该方法已在类体内，语法检查通过。
**Original issue:** MediaSniffer 类在第 370 行关闭，但 getMediaListByContainer 方法定义在类体之外，导致 SyntaxError 使应用无法启动。

---

_Fixed: 2026-08-08T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
