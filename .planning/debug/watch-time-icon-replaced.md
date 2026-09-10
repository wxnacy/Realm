---
status: diagnosed
trigger: "删除功能没问题，但是图标替换理解有误，我只想替换『最近观看』四个字，时间还是要有的，现在只有一个图标没有时间了"
created: 2026-09-07T00:00:00Z
updated: 2026-09-07T00:00:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

hypothesis: (已确认) commit 44a24ef（G-44-8 修复，44-12）把 meta 行的「最近观看 {watched}」整个文本段替换成了仅含 SVG 时钟图标的 span，时间文本只进了 `title` tooltip 属性，不再作为可见文本渲染
test: 读 src/player.js:983-1001 渲染代码 + git log -L 溯源引入提交 + 对照 44-12-SUMMARY 的需求表述
expecting: 确认时间文本是被移入 title（非 CSS 隐藏、非数据缺失）
next_action: 无（goal: find_root_cause_only，fix 走 plan-phase --gaps）

## Symptoms

expected: 缓存抽屉条目 meta 行为「时钟图标 + 时间」并排展示——时钟图标替换「最近观看」标签文字，时间文本始终直接可见（非仅 hover 才显示）
actual: 用户报告（verbatim）：「删除功能没问题，但是图标替换理解有误，我只想替换『最近观看』四个字，时间还是要有的，现在只有一个图标没有时间了」。当前 meta 行只有一个时钟图标，时间看不到了（疑似移到 hover title 或被删除）。
errors: 无报错
reproduction: Test 6 in UAT（打开播放器缓存抽屉查看条目 meta 行）
started: Discovered during UAT 2026-09-07（dev 环境）

## Eliminated

- hypothesis: 时间被 CSS 隐藏
  evidence: .drawer-item-watched 样式（player.css:637-642）仅 inline-flex 对齐+颜色，无 display:none / text-indent / visibility 隐藏；且时间文本根本不在 DOM 文本节点里
  timestamp: 2026-09-07
- hypothesis: 后端数据缺失（lastWatched 未返回）
  evidence: 渲染代码 `if (watched)` 判断通过才会画图标——图标能显示说明 formatWatchedTime(item.lastWatched) 返回了非空值，数据链路正常
  timestamp: 2026-09-07

## Evidence

- timestamp: 2026-09-07
  checked: src/player.js:983-1001（renderDrawer 抽屉条目 meta 行构建）
  found: meta.textContent = 「缓存大小 · 完整度%」或「未缓存」；有 lastWatched 时仅追加分隔符 ' · ' + span.drawer-item-watched（内含纯 SVG 时钟图标），`watchedIcon.title = '最近观看 ${watched}'`。时间字符串 watched 只存在于 title 属性（hover tooltip），没有任何可见文本节点承载它
  implication: 时间文本被移入 title tooltip，DOM 中不存在 → 用户看到的正是「只有一个图标没有时间」
- timestamp: 2026-09-07
  checked: git log -L 983,1002:src/player.js
  found: commit 44a24ef「feat(44-12): 删除确认框条目级 checkbox + 文案联动 + 「最近观看」时钟图标（G-44-8）」将原实现（cab8f2c，44-04 引入的 `parts.push('最近观看 ${watched}')`，时间常显）替换为图标 + title tooltip 方案
  implication: 引入提交精确定位为 44a24ef；此前版本行为与用户预期一致
- timestamp: 2026-09-07
  checked: .planning/phases/44-/44-12-SUMMARY.md、44-VERIFICATION.md
  found: 需求侧表述为「「最近观看」图标化后完整时间保留在 title tooltip（G-44-8 missing 第 3 项）」；verify 预期也是「meta 行时钟图标 hover 显示「最近观看 时间」」——实现与该轮 gap 文字自洽，但该表述本身偏离了用户真实意图（只图标化标签、时间保留可见）
  implication: 属于需求歧义导致的实现偏差，不是实现走样；修复需同时更新 gap 描述与渲染代码

## Resolution

root_cause: commit 44a24ef（Phase 44 Plan 12 / G-44-8 gap 修复）在 src/player.js:983-1001 的抽屉 meta 行渲染中，把原「最近观看 {时间}」整段文本替换为仅含 SVG 时钟图标的 `<span class="drawer-item-watched">`，时间字符串只写入 `watchedIcon.title`（hover tooltip），DOM 中不再有任何可见的时间文本——需求「图标只替换『最近观看』四个字」被理解成「『最近观看 时间』整体收进 tooltip」。非 CSS 隐藏、非数据缺失。
fix: （待 plan-phase --gaps 处理）在 src/player.js:995-1001：保留时钟图标 span，在其后追加时间文本节点（图标 + `watched` 并排，如 span 内 icon + text 或 span 后跟 textNode），title 可保留或精简；同步更新 player.css:636 的注释与 .drawer-item-watched 布局（inline-flex 已兼容并排）
verification: 未修复（诊断模式）
files_changed: []
