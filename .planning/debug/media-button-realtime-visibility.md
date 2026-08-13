---
status: fixed
trigger: "UAT Test 6: 切换多媒体功能开关后，主界面地址栏旁的媒体播放按钮不能实时显示/隐藏，必须重启才生效"
created: 2026-08-10T00:00:00Z
updated: 2026-08-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — visibilitychange listener on main renderer document never fires on tab switch; no IPC push from main on settings change
test: code trace complete
expecting: n/a
next_action: return ROOT CAUSE FOUND (find_root_cause_only mode)

## Symptoms

expected: 开关关闭时主界面媒体面板按钮隐藏；打开后恢复显示；设置变更即时生效（visibilitychange 同步），无需重启
actual: 地址栏后边的播放按钮必须重启才能实时变更
errors: None reported
reproduction: realm://settings → 多媒体 → toggle 功能开关 → 回到主窗口 → 播放按钮不变化，重启后生效
started: Phase 29 UAT (commit 7e12a60)

## Eliminated

- hypothesis: updateMediaPlayerVisibility 本身逻辑有 bug
  evidence: renderer.js:5169-5189 逻辑正确；init 时调用（1681-1682）生效——重启后状态正确即证明函数本身工作正常
  timestamp: 2026-08-10
- hypothesis: 设置未真正写入（保存链路断了）
  evidence: settings-page.js:1465-1479 POST /api/settings/update → main.js:995-1002 configStore.set('settings.mediaPlayer.enabled')；重启后生效证明写入成功
  timestamp: 2026-08-10

## Evidence

- timestamp: 2026-08-10
  checked: src/renderer.js updateMediaPlayerVisibility 的全部调用点
  found: 仅两处调用：init()（L1681-1682）和 visibilitychange 监听（L1936-1945）。无任何 settings 变更推送订阅
  implication: 运行期唯一的再同步通道是 visibilitychange
- timestamp: 2026-08-10
  checked: realm://settings 的宿主形态
  found: openSettingsTab（renderer.js:1335-1357）→ createTab(containerId, 'realm://settings')；settings 是同一 renderer 文档内的一个 webview tab
  implication: 切 tab 不换文档
- timestamp: 2026-08-10
  checked: switchTab（renderer.js:560-615）
  found: 切 tab 只是 showWebview(tabId) 切换 webview 元素的 CSS 可见性；宿主文档 document.hidden 不变
  implication: 主 renderer 文档的 visibilitychange 只在整个 BrowserWindow 最小化/恢复/隐藏时触发，从设置 tab 切回主界面时**不会触发**——同步代码成为死代码
- timestamp: 2026-08-10
  checked: 设置写入链路 + 是否存在 settings-updated 推送
  found: 设置经内部 HTTP 服务器 POST /api/settings/update → configStore.set（main.js:995-1002）；全仓 grep settings-updated/settings:changed/webContents.send.*setting 零匹配
  implication: 主进程→渲染进程没有任何设置变更广播；渲染进程只能轮询或等 visibilitychange（而后者不触发）
- timestamp: 2026-08-10
  checked: settings-page.js:1863 visibilitychange 监听
  found: 该监听在 **settings 页 guest 文档**内（webview guest 显示/隐藏时会触发），用于设置页自刷新；与主 renderer 文档无关
  implication: 同名事件在两个不同文档，plan 02 很可能误把 guest 侧可触发当成主 UI 侧可触发
- timestamp: 2026-08-10
  checked: bug_class 分类
  found: Bohrbug（确定性可复现：切开关→回主界面→100% 不更新）
  implication: 无需 record-replay；代码走读即确诊

## Resolution

root_cause: 运行时同步依赖的 visibilitychange 事件挂在主 renderer 文档上，但 realm://settings 是同一文档内的 webview tab——切 tab 只切换 webview CSS 可见性，主文档 document.hidden 永不变，事件永不触发；同时设置写入走内部 HTTP → configStore.set，主进程没有任何 settings-updated IPC 广播。因此 updateMediaPlayerVisibility 运行期唯一同步通道失效，只有重启走 init() 才生效
fix: （find_root_cause_only，不实施）方向：主进程在 /api/settings/update 写入后向主窗口 webContents.send('settings:updated', ...)，preload 暴露 onSettingsUpdated，renderer 订阅后重读 settings 并调 updateMediaPlayerVisibility；或简化：switchTab/从 settings tab 切回时重读。visibilitychange 监听可移除或保留作窗口级兜底
verification: 代码走读确诊；重启生效与"最小化/恢复窗口后可能意外生效"均与该机制一致
files_changed: []
