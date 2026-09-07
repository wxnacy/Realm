---
status: testing
phase: 44-player-video-cache-and-local-media-library
source: [44-VERIFICATION.md]
started: 2026-09-07T08:00:00Z
updated: 2026-09-07T08:00:00Z
---

## Current Test

[not started]

number: 1
name: webview 直连真实源站（CR-06 收紧版）
expected: |
  webview tab 内用「无 ACAO + Referer 校验 + Cookie 门控」真实源站直连播放 m3u8：直连播放可识别为多媒体且与 Phase 43 行为一致；若不可用则按 CR-06 方案①/②/③（webRequest 层补 ACAO/Referer/Cookie、回退守卫、修正注释）建新 gap
awaiting: user response

## Tests

### 1. webview 直连真实源站（CR-06 收紧版，唯一实质新风险）
expected: webview tab 内用「无 ACAO + Referer 校验 + Cookie 门控」真实源站直连播放 m3u8，可识别为多媒体且与 Phase 43 行为一致；若不可用则按 CR-06 方案①/②/③建新 gap
result: pending

### 2. 录制按钮停止图标目检（UAT 4.1）
expected: 录制中显示停止方块图标、停止后恢复描边圆点、title 切换「停止录制/开始录制」（红点闪烁之外按钮图标可辨识）
result: pending

### 3. 直播录制/转换全链路（UAT 4.2/6，真实源）
expected: B 站直播（fMP4 流）停止录制后任务页显示「MP4 转换失败：分片格式暂不支持转换（仅支持 MPEG-TS）」且无 0 字节产物；正常 TS 源转换产物在播放器播放、时长/音画正常
result: pending

### 4. 终态 toast + 点击定位（UAT 5）
expected: 「MP4 转换完成：{文件名}」/「录制已保存」toast 出现约 5s，点击在 Finder 定位产物；失败任务弹 error toast
result: pending

### 5. 任务角标 running/归零/跳转（UAT 7）
expected: 录制进行中主窗口工具栏角标出现（数字=running 数）、停止后归零消失、点击跳 realm://tasks
result: pending

### 6. 抽屉删除两路径 + 时钟图标（UAT 8）
expected: 默认不勾删除 → 条目变「未缓存」；勾选「同时删除条目」删除 → 条目消失且重开抽屉不再出现；文案随勾选联动、确认框居中、meta 行时钟图标 hover 显示「最近观看 时间」
result: pending

### 7. 任务页失败反馈（UAT 9）
expected: 对无 meta.json 的中断任务点「已落盘部分续转」→ 反馈条显示「录制中崩溃的任务暂无分片索引，暂不支持续转」约 4s 消失；停止/定位失败同样有可见反馈
result: pending

### 8. 关窗/应用退出两级确认（D-19，前轮 #12 保持）
expected: 窗口级确认弹一次并记忆默认；取消退出后确认不被永久跳过（WR-05 观察）
result: pending

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
