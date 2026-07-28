---
status: complete
phase: 12-开发者模式
source: [12-VERIFICATION.md]
started: 2026-07-27T12:00:00Z
updated: 2026-07-27T14:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 端到端开发者模式流程测试
expected: 开启开关 → 添加域名 → webview 导航 → CDP 抓取 → devrequests 页面查看，devrequests 页面显示抓取的 API 请求记录
result: pass
note: "初次失败（CDP 未附加），修复 guest 容器映射 + CDP 字段误用后复测通过；详见 Gaps"

### 2. 设置页面开发者模式 UI 交互
expected: toggle 切换、域名添加/删除、队列状态轮询，配置区域禁用/启用状态正确，域名操作正常，队列状态实时更新
result: pass

### 3. devrequests 请求查看页面功能
expected: 表格、详情展开、过滤、分页、清空，完整的数据展示和交互功能
result: pass
note: "容器下拉和滚动问题已修复后复测通过；详见 Gaps"

### 4. 应用重启后配置持久化
expected: electron-store 开关和域名列表保持，重启后配置不变
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "开启开关 → 添加域名 → webview 导航 → CDP 抓取 → devrequests 页面查看，devrequests 页面显示抓取的 API 请求记录"
  status: fixed
  reason: "User reported: 添加 www.workbuddy.cn 域名后 在 xiao 容器中访问页面没有抓到接口信息"
  severity: major
  test: 1
  root_cause: "Electron 32 下 webview guest 的 session 不暴露 partition：getPartition() 方法已删除（首次修复改为 session.partition 属性后实测仍为空串，见用户日志 partition: \"\"），主进程无法从 guest session 反推容器。getGuestContainerId 返回 null → did-start-navigation 处理器跳过 cdpManager.handleNavigation → 调试器从未附加 → dev-requests.db 零表零记录（已验证）。影响所有容器。最终修复：渲染进程在 did-attach/dom-ready 时用 webview.getWebContentsId() + webview.partition（权威来源）经 webview:register-container IPC 上报映射，主进程维护 guestContainerMap 反查，guest destroyed 时清理。"
  artifacts:
    - path: "main.js"
      issue: "getGuestContainerId 无法从 guest session 反推 partition（Electron 32 限制）"
    - path: "ipc-handlers.js"
      issue: "缺少 guest→容器 映射注册通道"
    - path: "src/renderer.js"
      issue: "webview 创建后未向主进程上报 guest 映射"
  missing:
    - "新增 guestContainerMap + webview:register-container IPC（已修）"
    - "getGuestContainerId 优先查映射，session.partition 作回落（已修）"
    - "renderer did-attach/dom-ready 上报映射（已修）"
  debug_session: ""
- truth: "devrequests 页面容器下拉列表应显示所有容器，且从设置页打开时应定位到当前容器"
  status: fixed
  reason: "User reported: realm://devrequests/ 中清空所有请求左边下拉列表只显示 default"
  severity: major
  test: 3
  root_cause: "两个 bug 叠加：(1) devrequests-page.js init() 只把 URL 参数中的当前容器作为唯一 option，从未拉取容器列表；(2) settings-page.js:1070 使用 state.devMode.containerId（该字段从未被 loadDevModeSettings 赋值），永远回落 'default'，而设置页 URL 本身已被 realmUrlToHttp 注入 container 参数却未读取"
  artifacts:
    - path: "src/devrequests-page.js"
      issue: "init() 未填充完整容器列表"
    - path: "src/settings-page.js"
      issue: "devrequests 链接 container 参数来源错误"
  missing:
    - "devrequests-page.js 新增 loadContainers() 拉取 /api/containers/list 填充下拉（已修）"
    - "settings-page.js 改用 pageParams.get('container')（已修）"
  debug_session: ""
- truth: "devrequests 列表的耗时和大小应显示真实值"
  status: fixed
  reason: "User reported: 可以看到列表了，不过时间和大小不对（耗时显示 186634.8s，大小全是 0 B）"
  severity: major
  test: 1
  root_cause: "三处 CDP 事件字段误用：(1) 耗时用 response.timing.requestTime（单调时钟基准值，约 186000 秒）+ receiveHeadersEnd 计算，得到巨大伪值——应在 loadingFinished 用事件单调时间戳差值；(2) Network.dataReceived 事件没有 data 字段（只有 dataLength/encodedDataLength），size 累加从未执行；(3) 响应体靠 dataReceived 攒 _dataChunks 永远为空——必须 loadingFinished 时发 Network.getResponseBody 主动拉取"
  artifacts:
    - path: "cdp-manager.js"
      issue: "duration/size/responseBody 三个字段的 CDP 取值方式全部错误"
  missing:
    - "duration 改为 (loadingFinished.timestamp - requestWillBeSent.timestamp) * 1000（已修）"
    - "size 改为累加 dataReceived.dataLength（已修）"
    - "responseBody 改为 Network.getResponseBody 拉取，filterResponseBody/_dataChunks 已删除（已修）"
  debug_session: ""
- truth: "devrequests 列表内容超出视口时应可上下滚动"
  status: fixed
  reason: "User reported: 列表无法上下滚动"
  severity: major
  test: 3
  root_cause: "main.css:54 全局 body { overflow: hidden }（主窗口 app 壳样式），内部页面复用 main.css 但没有自建滚动容器；.devrequests-page 无 height/overflow 设置，内容被 body 裁剪"
  artifacts:
    - path: "src/styles/main.css"
      issue: ".devrequests-page 缺少滚动容器设置"
  missing:
    - ".devrequests-page 改为 height:100vh + overflow-y:auto 滚动容器，padding-inline 保持内容 1200px 居中且滚动条在窗口右缘（已修）"
  debug_session: ""
