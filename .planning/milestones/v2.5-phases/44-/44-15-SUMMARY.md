---
phase: 44
plan: 15
subsystem: electron-runtime / ua-fingerprint-constants
tags: [gap-closure, G-44-2, electron-upgrade, ua-client-hints, release-verification]
requires: ["44-14 (销毁时序收窄，G-44-2 第一步)"]
provides: ["Electron 43.6.0 补丁线（Chromium 150.0.7871.250）", "与内核实测一致的全版本号 UA/CH 常量"]
affects: ["后续所有打包发布", "指纹伪装三层一致性"]
tech-stack:
  added: []
  patterns: ["同分支补丁线升级（43.3.0 → 43.6.0，避开跨大版本 44/Chromium 152）"]
key-files:
  created: []
  modified:
    - package.json
    - main.js
    - ua-ch-manager.js
decisions:
  - "升级目标取执行日实测 dist-tag 43-x-y 最新 = 43.6.0（npm + releases.electronjs.org 双源复核，与计划锚点一致，无字面量替换）"
  - "package-lock.json 本项目 gitignored，未随 Task 1 提交（与既有仓库惯例一致）"
  - "打包版验证自动化：make install 后经 playwright _electron 驱动真实 /Applications/Realm.app 完成浏览 + 播放器播放；验证完成后应用保持运行（不 pkill）"
metrics:
  duration: 24min
  completed: 2026-09-07
status: complete
actuals:
  tokens: 40000
  tasks: 2
  commits: 2
  plan_head_before: ef83395
---

# Phase 44 Plan 15: G-44-2 第二步 — Electron 补丁线升级与 UA/CH 常量同步 Summary

**One-liner:** Electron 43.3.0 → 43.6.0（Chromium 150.0.7871.224 → .250）+ 4 处 UA/CH 常量与新内核实测对齐（降维 UA 冻结不动），打包版实机浏览+播放验证无崩溃，与 44-14 叠加形成 G-44-2 双层防御。

## What Was Done

### Task 1: 升级 Electron 并重编原生模块（commit ed7d4d2）

- **执行日复核**（precondition）：npm dist-tag `43-x-y` = **43.6.0**，releases.electronjs.org 确认 Chromium **150.0.7871.250**——与计划锚点完全一致，版本字面量零替换。
- `npm install --save-dev electron@43.6.0`（package.json `^43.3.0` → `^43.6.0`；package-lock.json 本项目 gitignored 不入库）。
- 运行时实测：`process.versions` → electron 43.6.0 / **chrome 150.0.7871.250** / node 24.20.0（Node 24 线不变）。
- 原生模块重编：`npx electron-rebuild -f -w nodejieba,better-sqlite3`（项目既有方式）；`make install` 时 electron-builder 亦二次重编确认（dependencies=better-sqlite3@13.0.2, nodejieba@3.5.8）。
- 测试全绿：`node tests/test-favorites-folders.js` 33/33、`node tests/test-player-history.js` 7/7、`node tests/test-media-task-registry.js` 0 fail——FTS5/nodejieba 分词与下载/历史链路在新 Electron 下正常。

### Task 2: 同步 UA/CH 全版本号常量并验证发布（commit 157d3e7）

按 docs/debug/google-login-ua-cover-done.md Round 5 清单核对 4 处常量：

| # | 位置 | 处理 |
|---|------|------|
| ① | main.js:108 CHROME_UA（降维 Chrome/150.0.0.0） | **零 diff**（build 号冻结） |
| ② | ua-ch-manager.js:36 CHROME_UA（同降维） | **零 diff** |
| ③ | main.js Sec-CH-UA 高熵头（full-version-list 2 值 + full-version 1 值）+ tag 注释 ×2 | `.212` → `.250` |
| ④ | ua-ch-manager.js fullVersion + fullVersionList 2 值 + tag/Electron 版本注释 | `.212` → `.250`（注释 Electron 43.3.0 → 43.6.0） |

grep 审计：旧内核号 `150.0.7871.212` 双文件 **0 残留**；新内核号 main.js 4 处 / ua-ch-manager.js 5 处；降维 UA main.js 2 处 / ua-ch-manager.js 1 处原样保留。品牌表顺序（Not;A=Brand → Chromium → Google Chrome）、GREASE（"Not;A=Brand" v"8"）、CDP 覆盖链路全部未动（prohibition 遵守，diff 仅版本号字面量+注释）。

**实测验证（dev 环境，playwright _electron 驱动真实应用）**：
- 主进程 `process.versions.chrome` = 150.0.7871.250；
- webview guest 内 `navigator.userAgentData.getHighEntropyValues` 回读：fullVersionList = `8.0.0.0 / 150.0.7871.250 / 150.0.7871.250`，`uaFullVersion`（内核真实值、不受 CDP 覆盖控制）= **150.0.7871.250**，低熵 brands = `Not;A=Brand v8 / Chromium 150 / Google Chrome 150`——三处同值不变式（常量 ↔ 内核 ↔ 页面侧）成立。
- 技术注记：JS API `getHighEntropyValues` 不返回顶层 `fullVersion` 键（该字段仅存在于 CDP UserAgentMetadata 协议层），`uaFullVersion` 是 JS 侧对应的内核真值来源。

**打包发布验证（AGENTS.md 发布前必查）**：`make install` 装出 /Applications/Realm.app（electron-builder 对 43.6.0 重编原生依赖），实际启动：
- 启动无闪退、无原生崩溃（~/Library/Logs/DiagnosticReports 无新增 Realm-*.ips）；
- 地址栏真实浏览 https://example.com 成功；
- 播放器窗口播放真实网络视频（flower.mp4）currentTime 持续推进（0.50s → 3.49s）、video.error 为 null；
- 稳定运行观察后保持存活。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 打包版验证自动化路径修正**
- **Found during:** Task 2 发布验证
- **Issue:** 首次自动化以 `realmAPI.createTab` IPC 直建 tab，打包版（生产 userData，tab 计数已 2000+）下 renderer 未为该 tab 创建 webview 元素（主进程已建 tab、无 did-start-navigation）；dev 环境同一调用正常。判定为自动化调用路径与真实用户路径的偏差，非应用回归——改用地址栏 UI 真实路径（click → fill → Enter）后秒级加载成功。
- **Fix:** 验证脚本全部改走 UI 真实路径；播放器仍走 `mediaAPI.playMedia`（renderer 侧标准 IPC，行为等同用户点播）。
- **Files modified:** 无（仅 /tmp 验证脚本）

## Incident（非计划内，须用户知悉）

**执行过程中生产版 Realm.app 被误杀一次（已恢复运行）：**

- 验证打包版时，**用户的生产版 Realm.app 当时正在运行**（约 47 小时长会话，userData=realm）。`make install` 的 `rm -rf /Applications/Realm.app` 与其并行（macOS 允许，运行中实例从内存映射继续）。
- 随后清理验证实例的 `pkill -f ".../MacOS/Realm"` 模式**误匹配并杀掉了生产版主进程**（执行者操作失误）。
- **影响评估：** tabs.json 等落盘数据无损坏；仅退出时的 Cookie 自动保存被跳过（自上次保存后的增量 Cookie 可能丢失）。生产版现由打包验证实例恢复运行（即当前 /Applications/Realm.app 43.6.0 在跑）。
- **防复发（沉淀给执行者）：** 对 /Applications 下正式 .app 做验证/清理时，pkill 模式必须精确到自身启动的 PID，绝不使用按路径匹配的 pkill；且验证前先检查 `pgrep -f "Contents/MacOS/Realm"` 是否有用户实例在跑。

## Verification Results（对应计划 <verification>）

1. ✅ `npm ls electron` = 43.6.0；favorites/history/media-task-registry 测试全绿。
2. ✅ `150.0.7871.212` 双文件 0 命中；`150.0.7871.250` 双文件命中；降维 UA（Chrome/150.0.0.0）双文件原样。
3. ✅ git diff 范围审计：ef83395..HEAD 仅 package.json / main.js / ua-ch-manager.js 三文件（package-lock.json gitignored），main.js diff 仅版本号字面量+注释。
4. ✅ human-check（打包实机启动验证）已由执行者以自动化方式完成：浏览 + 播放器播放各一次，无闪退、无崩溃报告。

## Deviation Rules / Auth Gates

- 无认证门。
- 无跨大版本升级（44.0.0/Chromium 152 禁令遵守：package.json electron = 43.6.0）。

## Known Stubs

None.

## Self-Check: PASSED

- ✅ commit ed7d4d2 存在（Task 1: electron 升级）
- ✅ commit 157d3e7 存在（Task 2: 常量同步）
- ✅ .planning/STATE.md 与 .planning/ROADMAP.md 未被本计划修改（orchestrator 所有）
- ✅ 未触碰 src/settings-page.js / src/settings.html（pre-existing 未提交改动保留）、ipc-handlers.js、src/renderer.js、media-record-engine.js、src/player.*
