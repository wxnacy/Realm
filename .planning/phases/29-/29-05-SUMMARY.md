---
phase: 29-
plan: 05
type: execute
wave: 1
gap_closure: true
gap_ids:
  - G-29-12
status: completed
completed_at: 2026-08-08T21:30:00+08:00
---

# Plan 29-05 Summary: 关闭 UAT Gap G-29-12

**Objective:** 白名单过滤被脚本注入路径绕过。媒体嗅探有两条路径，白名单只挂在网络路径（main.js onResponseStarted）上；脚本注入路径完全失守。

**Root Cause:**
1. renderer.js dom-ready 注入前只查 enabled 不查 whitelist
2. ipc-handlers.js media:report-detected 收到上报直接入库无任何校验
3. 网络路径按 details.url（媒体资源 URL，常是 CDN 域名）匹配白名单，与用户「按站点域名过滤」的心智不符

## Changes Made

### media-sniffer.js
- 新增模块级 `isDomainWhitelisted(url, whitelist)` 纯函数（搬自原 main.js 347-357 行）
- 在 `module.exports` 追加导出 `isDomainWhitelisted` 供主进程共享
- 白名单为空数组时返回 true（空白名单 = 全部允许，per D-06）
- 匹配条件：hostname === domain || hostname.endsWith('.' + domain)（子域名包含，per D-07）

### main.js
- 删除本地 `isDomainWhitelisted` 定义及其注释头（避免双份漂移）
- `onResponseStarted` 回调白名单匹配改为页面 URL：
  - `const pageUrl = webContents.fromId(details.webContentsId)?.getURL()`
  - 匹配目标改为 `pageUrl || details.url`（取不到页面 URL 时回退媒体 URL）
  - 调用 `mediaSniffer.isDomainWhitelisted(pageUrl || details.url, whitelist)`
- 加注释说明语义：白名单按站点页面域名过滤，媒体资源常在 CDN 域（如 bilivideo.com），按 details.url 匹配会误挡白名单站点自身内容

### ipc-handlers.js
- 顶部 `require('electron')` 解构加入 `webContents`
- `media:report-detected` 处理器增加白名单校验（防御纵深）：
  - 读取 `configStore.get('settings.mediaPlayer.whitelist', [])`
  - `webContents.fromId(webContentsId)` 判空 + `isDestroyed()` 检查
  - `mediaSniffer.isDomainWhitelisted(wc.getURL(), whitelist)` 为 false 时静默丢弃
  - 日志：`[Realm IPC] media:report-detected 非白名单站点上报已丢弃: <hostname>`
  - 返回 `{ success: false }`，不入库

### src/renderer.js
- 新增模块级 `isPageWhitelisted(url, whitelist)` 纯函数，语义与 `isDomainWhitelisted` 逐字一致
- JSDoc 注明「与 media-sniffer.js isDomainWhitelisted 语义保持一致，改动需同步」
- dom-ready 处理器在 enabled 检查之后、注入之前插入白名单检查：
  - 复用已获取的 `settings.mediaPlayer.whitelist`
  - 页面 URL 用 `webview.getURL() || webview.src || ''`
  - 非白名单时 `return` 跳过注入

## Verification

- `node --check media-sniffer.js && node --check main.js && node --check ipc-handlers.js && node --check src/renderer.js` 全部通过
- `isDomainWhitelisted` 8 个行为用例全过（空/null 白名单放行、子域匹配、非后缀相似域拒绝、无效 URL 拒绝）
- `isPageWhitelisted` 定义 + 调用 ≥2 处匹配；dom-ready 段包含 whitelist 检查
- main.js 全文件 `function isDomainWhitelisted` 零匹配（本地定义已删）
- `mediaSniffer.isDomainWhitelisted` 在 main.js 和 ipc-handlers.js 各 ≥1 处匹配
- `webContents.fromId` 在 ipc-handlers.js ≥1 处匹配

## UAT Gap Status

| Gap ID | Status | Test |
|--------|--------|------|
| G-29-12 | **Closed** | Test 12: 白名单过滤生效（端到端） |
