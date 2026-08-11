---
status: complete
phase: 26-ipc
source: [26-01-SUMMARY.md, 26-02-SUMMARY.md]
started: 2026-08-07T00:00:00Z
updated: 2026-08-07T08:25:00Z
---

## 续测须知（给接手的 agent）

- 主窗口 DevTools：`⌘⌥I`（已对齐 Chrome 习惯；`⌘⇧⌥I` 是网页 DevTools）；dev 启动自动打开
- `getMediaList()` 无参时按窗口当前容器解析（多容器混开不可靠），**测试一律传显式容器 ID**：`await window.mediaAPI.getMediaList('xiao')`
- 诊断接口：`await window.mediaAPI.debugState()`（各环节计数，无需翻终端）
- 全部 8/8 通过（2026-08-07）

## Current Test

[testing complete]

## Tests

### 1. 冷启动冒烟测试
expected: 完全退出 Realm（Cmd+Q），重新 `npm run dev` 启动。应用无报错启动，主窗口、侧边栏容器列表正常显示。
result: pass
note: "两轮 blocker（renderer/preload __dirname ReferenceError）修复后复测通过，详见 Gaps G-26-1"

### 2. 视频资源嗅探
expected: 在某容器打开含视频的页面（如 B 站任一视频）并播放。主窗口 DevTools 执行 `await window.mediaAPI.getMediaList()` 返回检测到的视频条目（含 url/type/source/timestamp）；HLS 站点不出现大量 .ts 分片刷屏。
result: pass
note: "三轮修复（检测触发条件/容器归属/图片误收录）后通过，B 站视频流可嗅探，jpeg 已过滤，详见 Gaps G-26-2（commit ba627c2）"

### 3. URL 去重
expected: 同一页面继续播放或刷新触发重复请求后，`getMediaList('<容器ID>')` 中同一 URL 只出现一次，无重复条目。
result: pass

### 4. 容器隔离
expected: 容器 A 打开视频页嗅探后，切到容器 B 打开不同视频页。`getMediaList('A')` 只含 A 的 URL，`getMediaList('B')` 只含 B 的 URL，互不串数据。
result: pass

### 5. 导航清空列表
expected: 在已嗅探到视频的 tab 内导航到另一个页面后，`getMediaList('<该tab容器ID>')` 返回空数组（旧页面的媒体被清空）。
result: pass

### 6. 关闭 tab 清空列表
expected: 重新嗅探出视频后关闭该 tab，`getMediaList('<该tab容器ID>')` 返回空数组（注意：同容器还有其他 tab 的条目时共享列表，per D-05 容器粒度）。
result: pass

### 7. 播放视频窗口
expected: DevTools 执行 `await window.mediaAPI.playMedia('<嗅探到的直链 mp4 URL>')`，打开深色主题播放器窗口，video 元素加载该 URL 并能播放出画面/声音。
result: pass

### 8. 复制视频 URL
expected: DevTools 执行 `await window.mediaAPI.copyMediaUrl('<视频URL>')` 返回成功，在任意文本框粘贴（Cmd+V）得到该 URL。
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

- gap_id: G-26-1
  truth: "冷启动后应用完整初始化：标签栏渲染、所有按钮可点击"
  status: resolved
  reason: "User reported: 所有功能全部失效，都不能点击，看不到标签"
  severity: blocker
  test: 1
  artifacts: [src/renderer.js, src/preload.js]
  missing: []
  root_cause: "renderer.js createWebviewForTab 使用 __dirname（Node 全局），主窗口 contextIsolation:true 下为 ReferenceError，init 中止于 restoreTabs"
  fix_iterations: "第一轮修复把 __dirname 挪进 preload.js，但 sandbox preload 同样无 __dirname，preload 加载即抛错导致 realmAPI 整体失效（第二轮症状：侧边栏为空）；最终方案：renderer 用 new URL('webview-preload.js', window.location.href) 纯浏览器 API 推导路径，全链路无 Node 全局"
  resolved_by: "直接修复：webview.setAttribute('preload', new URL('webview-preload.js', window.location.href).href)"
  resolved_at: 2026-08-07

- gap_id: G-26-2
  truth: "含视频页面播放后 getMediaList() 返回检测到的视频条目"
  status: resolved
  reason: "User reported: B 站与本地 m3u8 直链均返回空列表"
  severity: major
  test: 2
  artifacts: [media-sniffer.js, ipc-handlers.js, src/preload.js, src/renderer.js]
  missing: []
  root_cause: "① 检测触发仅认 resourceType==='media'/content-type 白名单（漏 MSE、x-mpegurl）；② 容器解析依赖 guest 注册时机丢首批响应；③ getMediaList/clearMediaList 按窗口容器解析，多容器混开时错位；④ 封面图被内核误标 resourceType=media 混入列表"
  resolved_by: "commit ba627c2（URL 扩展名触发 + 暂存补录 + 显式 containerId + 图片黑名单）"
  resolved_at: 2026-08-07
  note: "同容器多 tab 共享媒体列表为既定设计（D-05/D-08 容器粒度）；B 站 DASH 完整流 URL 可经 video/mp4 content-type 嗅探到"

## Deferred Follow-Ups

[none yet]
