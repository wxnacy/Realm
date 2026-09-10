---
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: unknown
---

# 白名单过滤被脚本注入路径绕过 — 调试记录

**日期**: 2026-08-08
**Gap**: G-29-12（测试 12）
**现象**: 白名单写入 bilibili.com 后，nnyy.in 页面仍能获取视频列表

## 根因

媒体嗅探有两条路径，白名单只挂在网络路径上：

| 路径 | 入口 | 白名单检查 |
|------|------|-----------|
| 网络路径 | main.js:444 `onResponseStarted` → main.js:453 `isDomainWhitelisted(details.url)` | 有（但按媒体 URL 匹配） |
| 脚本注入路径 | renderer.js:847 dom-ready 注入 → ipc-handlers.js:1488 `media:report-detected` | **无** |

两处失守：

1. **renderer.js:851** — dom-ready 注入前只查 `settings.mediaPlayer.enabled`，不读 whitelist，
   非白名单站点照样注入嗅探脚本（`window.__realmMediaSniffer`）。
2. **ipc-handlers.js:1488** — `media:report-detected` 收到上报后直接
   `mediaSniffer.handleScriptDetected(webContentsId, videos)`，无任何白名单校验。
   即使修了注入侧，已注入的旧脚本（SPA 站内导航、开关变更前注入的页面）仍可上报。

## 语义问题（顺带修正）

网络路径按 `details.url`（媒体资源 URL，常是 CDN 域名）匹配白名单，与用户
"按站点域名过滤"的心智不符：白名单 bilibili.com 会把 bilivideo.com CDN 的
视频在网络路径挡掉。修复应统一改为按**页面域名**过滤：
`webContents.fromId(details.webContentsId).getURL()` 取页面 URL 再匹配。

## 修复点

1. `renderer.js:847-855` — dom-ready 注入前增加白名单检查：
   读 `settings.mediaPlayer.whitelist`，对 webview 页面 URL 做域名匹配，
   非白名单跳过注入（白名单为空 = 全放行，与 isDomainWhitelisted 语义一致）。
2. `ipc-handlers.js:1488` — `media:report-detected` 增加服务端校验：
   `webContents.fromId(webContentsId).getURL()` 取页面 URL，非白名单直接丢弃
   （防御纵深，防已注入脚本绕过）。
3. `main.js:453` — 网络路径白名单匹配从 `details.url` 改为页面 URL
   （`webContents.fromId(details.webContentsId)?.getURL()`，取不到时回退 details.url）。

## 验证

- 白名单 = [bilibili.com]，开 nnyy.in 页面 → 媒体面板无视频（两条路径都挡住）
- 白名单 = [bilibili.com]，开 bilibili.com 视频页 → 视频正常嗅探（含 CDN 资源）
- 白名单为空 → 所有站点正常嗅探（回归）
