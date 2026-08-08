---
status: diagnosed
phase: 29-
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md]
started: 2026-08-08T18:00:00+08:00
updated: 2026-08-08T18:30:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. 冷启动冒烟测试
expected: 完全退出应用后重新启动（npm run dev 或 .app）。应用无报错启动，主界面正常加载，设置页可正常打开。（本阶段修改了 main.js 主进程，需验证冷启动）
result: pass

### 2. 设置页「多媒体」入口
expected: 打开 realm://settings，侧边栏在「AI 助手」和「关于」之间出现「多媒体」项（play-circle 图标）；点击后切换到多媒体设置区，显示功能开关和域名白名单区域。
result: pass

### 3. 功能开关切换与持久化
expected: 开关默认关闭，下方内容区半透明且不可交互；点击开关打开后内容区恢复可交互；完全重启应用后开关状态保持（electron-store 持久化）。
result: pass

### 4. 白名单添加域名
expected: 输入域名（如 example.com）回车或点「添加」→ 出现蓝色 pill 标签；输入含非法字符（空格、斜杠等）被拒绝并提示；重复添加同一域名被拒绝。
result: issue
reported: "输入 test 也通过了，基本的域名格式应该校验下"
severity: major

### 5. 白名单删除域名
expected: 点击标签上的圆形 × 按钮移除域名；重开设置页后被删域名不恢复（持久化生效）。
result: pass

### 6. 开关关闭时隐藏媒体面板
expected: 开关关闭时主界面媒体面板按钮隐藏（媒体面板不可见）；打开开关后按钮恢复显示；设置变更即时生效（visibilitychange 同步），无需重启。
result: issue
reported: "不行，地址栏后边的播放按钮必须重启才行，不能实时变更"
severity: major

### 7. MediaSniffer.clearAll() clears mediaMap, dedupSets, pendingByWcId
expected: MediaSniffer.clearAll() clears mediaMap, dedupSets, pendingByWcId
result: pass
source: automated
coverage_id: D1

### 8. webRequest callback checks mediaPlayer.enabled and whitelist before sniffing
expected: webRequest callback checks mediaPlayer.enabled and whitelist before sniffing
result: pass
source: automated
coverage_id: D2

### 9. isDomainWhitelisted with empty-whitelist-allows-all and subdomain suffix matching
expected: isDomainWhitelisted with empty-whitelist-allows-all and subdomain suffix matching
result: pass
source: automated
coverage_id: D3

### 10. renderer dom-ready checks mediaPlayer.enabled before script injection
expected: renderer dom-ready checks mediaPlayer.enabled before script injection
result: pass
source: automated
coverage_id: D4

### 11. updateMediaPlayerVisibility hides media panel button and panel when disabled
expected: updateMediaPlayerVisibility hides media panel button and panel when disabled
result: pass
source: automated
coverage_id: D5

## Summary

total: 11
passed: 9
issues: 2
pending: 0
skipped: 0

## Gaps

- gap_id: G-29-4
  truth: "白名单只接受合法域名格式（如 example.com），无点的裸词（如 test）应被拒绝"
  status: failed
  reason: "User reported: 输入 test 也通过了，基本的域名格式应该校验下"
  severity: major
  test: 4
  root_cause: "addWhitelistDomain（src/settings-page.js:1518）只有字符黑名单校验 /[^\\w.\\-]/，无域名结构校验——test 全由 \\w 组成直接通过；同正则还放行 ..、-、a..b、.com、com 等结构垃圾。消费端 isDomainWhitelisted（main.js:347）不过滤脏条目：com 会匹配所有 .com 站点（白名单形同虚设），test 永不匹配（静默失效）"
  artifacts:
    - path: "src/settings-page.js:1518"
      issue: "addWhitelistDomain 缺域名结构校验（主要修复点）"
    - path: "src/settings-page.js:1247"
      issue: "addDomain（开发者模式抓取域名）同构弱校验 /\\s/ + /[^\\w.-]/，可顺带共用修复"
  missing:
    - "抽 isValidDomain 共享校验函数（至少含一个点、每段非空、不以连字符开头/结尾）"
    - "addWhitelistDomain 拒绝时复用现有 toast + highlightInputError，提示格式示例"
  debug_session: .planning/debug/whitelist-domain-validation.md
- gap_id: G-29-6
  truth: "切换功能开关后，主界面地址栏旁的媒体播放按钮应立即显示/隐藏，无需重启"
  status: failed
  reason: "User reported: 不行，地址栏后边的播放按钮必须重启才行，不能实时变更"
  severity: major
  test: 6
  root_cause: "运行时同步通道是死代码：updateMediaPlayerVisibility 唯一运行期触发点是主文档 visibilitychange 监听（src/renderer.js:1936），但 realm://settings 是同一 renderer 文档内的 webview tab，切 tab 只改 webview CSS 可见性，document.hidden 永不变，监听只在窗口最小化/恢复时触发；且设置写入走 POST /api/settings/update → configStore.set（main.js:995），主进程无 settings-updated IPC 广播（全仓零匹配）。按钮显隐只有重启走 init() 才刷新"
  artifacts:
    - path: "src/renderer.js:1936-1945"
      issue: "visibilitychange 监听挂在永不触发的主文档上（死代码）"
    - path: "main.js:995-1002"
      issue: "settings update 端点写 electron-store 后未广播变更事件"
    - path: "src/renderer.js:5169-5189"
      issue: "updateMediaPlayerVisibility 本身无 bug，只是运行期无人调用"
  missing:
    - "主进程 /api/settings/update 写入成功后 mainWindow.webContents.send('settings:updated', changedKeys)"
    - "preload 暴露 onSettingsUpdated；renderer 订阅后重读 settings 并调 updateMediaPlayerVisibility"
  debug_session: .planning/debug/media-button-realtime-visibility.md
