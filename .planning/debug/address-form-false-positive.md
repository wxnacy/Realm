---
status: resolved
trigger: "realm://settings 页面错误触发地址表单检测提示"
created: 2026-08-16T00:00:00Z
updated: 2026-08-16T00:00:00Z
---

## Current Focus

hypothesis: 内部页面 realm://settings 的地址编辑表单被 AddressDetector 误匹配
test: 检查 settings.html 中的 input 字段属性，与 AddressDetector 扫描模式对比
expecting: settings.html 中的 addressNameInput/addressPhoneInput/addressFullInput 命中 2/3 匹配阈值
next_action: 在 webview-preload.js 的 DOMContentLoaded 中添加 realm:// 页面跳过逻辑

## Symptoms

expected: realm://settings 页面不触发地址表单检测
actual: 访问 realm://settings 时弹出"检测到地址表单，是否保存收货地址？"提示
errors: 无错误日志，是检测逻辑误触发
reproduction: 打开 Realm Browser -> 导航到 realm://settings -> 观察地址表单检测提示
started: Phase 33 地址表单检测功能上线后

## Eliminated

（无）

## Evidence

- timestamp: 2026-08-16
  checked: settings.html 第 408-416 行
  found: addressNameInput(type=text, placeholder="收件人姓名")、addressPhoneInput(type=tel)、addressFullInput(placeholder="省市区+街道+门牌号")
  implication: 三个字段属性完全命中 AddressDetector 的姓名/手机号/地址正则，满足 2/3 阈值

- timestamp: 2026-08-16
  checked: webview-preload.js 第 428-441 行
  found: DOMContentLoaded 中无条件调用 AddressDetector.scanForAddressForms()，不区分 realm:// 内部页面
  implication: 内部页面和外部网页走同一条检测路径

## Resolution

root_cause: webview-preload.js 的 DOMContentLoaded 地址表单检测对所有页面（含 realm:// 内部页面）无差别执行。settings.html 的地址编辑表单（姓名/手机号/地址）命中 2/3 匹配阈值，导致误触发。
fix: 在 DOMContentLoaded 和 MutationObserver 中检测 window.location.hostname === 'localhost' 时跳过表单检测。注意：第一次修复使用 window.location.protocol === 'realm:' 无效，因为内部页面通过 http://localhost:PORT/ 加载。
verification: 修改后访问 realm://settings 不再弹出地址检测提示
files_changed: [src/webview-preload.js]
