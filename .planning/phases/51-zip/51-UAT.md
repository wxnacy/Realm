---
status: testing
phase: 51-用户技能导入管线（zip + 网络地址）
source: [51-VERIFICATION.md]
started: 2026-09-15T10:05:22Z
updated: 2026-09-15T10:05:22Z
---

## Current Test

number: 1
name: 真实 GitHub 端到端成功路径（网络地址导入）
expected: |
  整条真实网络链路走通；zipball 顶层 `<repo>-<ref>/` 前缀被剥离；技能落到 `skills/<name>/` 并回读可见；
  组件列表出现该技能、`/` 面板可见、下一条消息技能进 prompt。
awaiting: user response

## Tests

### 1. 真实 GitHub 端到端成功路径（网络地址导入）
expected: |
  设置页 → AI → 技能管理 → 导入技能 → 网络地址；填一个含**恰好一个**技能根的仓库
  `tree/<ref>/<path>` 地址 → 预览六字段齐备 → 确认 → 组件列表出现该技能、`/` 面板可见、
  下一条消息技能进 prompt；zipball 顶层 `<repo>-<ref>/` 前缀被剥离；落盘 `skills/<name>/` 并回读可见。
  交叉核对：`curl -sIL <zipball url>` 确认前缀形态。
why_human: |
  自动化套件刻意只用本地 stub server（不得依赖实时外网），真实外网成功路径只能在真机上人工跑一次。
  `51-05-SUMMARY.md` 与 `51-VALIDATION.md` 均如实登记为**仍未跑**。
result: [pending]

### 2. 真实 GitHub 403 / 429 限流文案的可操作性
expected: |
  连续多次导入直到命中未鉴权限流（60 req/h）⇒ 提示含「限流」与重试指引，且**不是**静默失败。
why_human: |
  需要真实触发 GitHub 侧限流，无法在离线套件里复现；分类逻辑（403 / 429 / 404 各一例含可操作原因）
  已由 stub server 用例覆盖，但文案的可操作性只有真实触发才可判。
result: [pending]

### 3. 32 MiB 上传在本机 Electron 的真实耗时与内存峰值
expected: |
  dev 模式打开 DevTools Performance，上传一个接近 32 MiB 的包 ⇒ 记录耗时与堆曲线；
  确认**无**「先 `arrayBuffer()` 再判大小」的峰值。
why_human: |
  绝对耗时 / 内存峰值为本机环境相关量；行为面（413 可达 / 无 `unhandledRejection` /
  堆不线性增长）已由 `tests/test-skills-http-api.js` 覆盖。
result: [pending]

### 4. 其余窗口尺寸档下的预览弹框布局
expected: |
  在设置页真实 CSP 下换极窄 / 超宽窗口复核预览弹框（目录树折叠、脚本标红、必勾、冲突三选一）⇒
  各尺寸档下弹框总高 ≤ 80vh、滚动只在预览区、动作区不横向溢出、按钮不被裁切。
why_human: |
  `tests/uat-51-import-modal.js` 的 52 项断言已在**单一**尺寸档实测通过（verifier 独立复跑），
  其余尺寸档未逐一取数，属残余人工面。
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

<!-- 空 —— 本阶段 29/29 must-haves 已由 verifier 在自动化面独立验证通过；本表只列人工面未跑项。 -->

## 需要同时决定的非 gap 事项（verifier 提请裁决，未计为 gap）

- **CR-01（BLOCKER，已在 `51-REVIEW.md` 登记，verifier 独立复现）**：`src/settings-page.js:6844` 覆盖
  `skillImportTarget.importId` 时未归还上一个句柄 ⇒ **同一弹框会话内第 4 次连续预览 100% 返回
  `too_many_pending`**，且 UI 没有「取消上一个预览」的入口可自救（实测：句柄数 1→2→3 → 报错，
  残留 4 个 `.tmp/skill-import-*` 目录）。它**不落在任何 must-have 真值上**（51-04 的句柄真值
  「三态可达且各有显式码」成立），故未计为 gap。
  **若认为「重复预览后无自救路径」属于目标未达** ⇒ `/gsd-plan-phase 51 --gaps` 把它升为 gap。
- **WR-01 / WR-02 / WR-03**：实现与文档/注释的三处漂移（禁用名单在回读刷新时被 `_cache` 丢掉 /
  压缩比口径「整包 vs 按 entry」/ `manage_skill` 是否获得技能域模式）——均已在 `51-REVIEW.md` 登记。
