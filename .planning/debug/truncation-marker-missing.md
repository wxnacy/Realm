---
status: fixed
trigger: "大页面 read_page_content 5 秒内返回但用户未感知 100KB 截断中文标记"
created: 2026-08-02T00:00:00Z
updated: 2026-08-02T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: B 确认 — 截断未触发（提取后正文 99,630 chars < 阈值 102,400），标记从未生成
test: 决定性实验完成 — Electron offscreen window + 项目真实 readability-bundle.js 复现 ai-manager.js extractScript
expecting: 已达成 — data.content.length (99630) > MAX_CONTENT_SIZE (102400) 为 false
next_action: 返回 ROOT CAUSE FOUND（find_root_cause_only 模式，不修复）

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: 打开 >1MB 大页面（zh.wikipedia.org/wiki/第二次世界大战）调用 read_page_content，内容在 100KB（MAX_CONTENT_SIZE）处截断并追加中文截断标记（如「内容过长，已截断」），用户可感知截断发生
actual: 用户测试中 5 秒内返回了内容（性能达标），AI 对话回复为完整结构化总结，未见截断中文标记，用户「好像没有截断」
errors: None reported
reproduction: Test 7 in UAT（.planning/phases/22-cdp/22-UAT.md）
started: Discovered during UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: A) 截断触发了，标记在工具返回 JSON 中，但 AI 生成回复时未转述（呈现层问题）
  evidence: 决定性实验证明截断分支未进入——真实 Readability 提取 content.length=99,630 < 102,400，工具返回中标记从未生成，AI 无从转述。另查 pi-agent-core createToolResultMessage (agent-loop.js:530-544) 对自定义工具结果原样透传、无截断层，truncate.js 的 50KB 上限仅用于 harness 内置 bash/read 工具
  timestamp: 2026-08-02
- hypothesis: C) 截断逻辑代码 bug（比较条件/单位写错导致该截不截）
  evidence: ai-manager.js:1049 比较 `data.content.length > MAX_CONTENT_SIZE` 逻辑正确（长度超阈值才截）；substring 截取正确。单位语义偏移（字符 vs 字节）存在但属 IN-01 已知 Info 级问题，非「逻辑 bug」——按其实现语义该页确实不满足触发条件
  timestamp: 2026-08-02

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-02
  checked: ai-manager.js 截断逻辑源码
  found: :110 `MAX_CONTENT_SIZE = 100 * 1024`（=102,400）；:1049-1052 `data.content.length > MAX_CONTENT_SIZE` 时 substring(0,102400) 并追加 `\n[截断：原始大小 ${length} bytes，已截断至 100KB]`；:1056-1058 空正文 message 挂载与截断互斥
  implication: 截断作用于 Readability 提取后的纯文本 textContent，非原始 HTML；比较单位是 JS string .length（UTF-16 code units），而文案写 "bytes"——单位语义错位（22-REVIEW.md IN-01 已记录为 Info 级）
- timestamp: 2026-08-02
  checked: 22-CONTEXT.md D-07 / 22-DISCUSSION-LOG / 22-UI-SPEC.md:139
  found: D-07 设计假设「平均 HTML 30-50KB，纯文本 5-15KB，100KB 覆盖 99%+ 网页」；UI-SPEC 契约标记文案同样写 "bytes"（契约措辞本身不准，REVIEW 已指出）
  implication: 契约的「100KB」语义自始模糊；HTML 大小与提取文本量无固定换算关系
- timestamp: 2026-08-02
  checked: curl 抓取 zh.wikipedia.org/wiki/第二次世界大战 原始 HTML + MediaWiki API plaintext extract
  found: 原始 HTML 1,356,758 bytes（>1MB ✓ 满足 UAT 前提）；API 纯正文 extract 仅 28,776 chars；含 infobox/表格/参考文献/navbox 的 mw-parser-output 粗提取 111,248 chars（其中参考文献 67,803=60.9%、正文 32,828=29.5%、navbox 9,886=8.9%）
  implication: 该页文本量恰在阈值边界（粗估值 ±8% 跨过阈值两侧），需决定性实验判定 Readability 实际输出
- timestamp: 2026-08-02
  checked: 决定性实验——Electron offscreen BrowserWindow 加载所抓取 HTML，注入项目真实 lib/readability-bundle.js，逐字复现 ai-manager.js:998-1027 extractScript
  found: content.length = **99,630** UTF-16 chars（173,889 UTF-8 bytes）< 102,400 → **截断分支不触发，无标记**；title 正确（第二次世界大战 - 维基百科…），提取内容完整到「外部链接」节尾
  implication: 假设 B 确认。按字节算 173,889 > 102,400 本「该截」，按实现语义（字符）不该截——IN-01 单位错位在此边界案例放大显现
- timestamp: 2026-08-02
  checked: pi-agent-core 工具结果到 LLM 的管线
  found: createToolResultMessage (agent-loop.js:530-544) content 原样透传；truncate.js DEFAULT_MAX_BYTES=50KB 仅被 harness 内置 bash/read 工具引用
  implication: 无「吞掉标记」的中间层；若截断真触发，标记会随完整 JSON 到达 LLM，转述与否是模型行为而非管线缺陷
- timestamp: 2026-08-02
  checked: UAT Test 7 前提设计
  found: 「>1MB 大页面」指原始 HTML 大小，但截断作用于提取后纯文本（本页提取率仅 ~7.3% chars）；所选用例页面是阈值边缘案例（99.6K vs 102.4K，差 2.7%）
  implication: 用例前提与截断触发条件错配；换用提取后正文确定超阈值的页面即可观察到标记

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 截断未触发（假设 B 确认）。UAT 测试页原始 HTML 1.36MB 满足「>1MB 大页面」前提，但经项目真实 readability-bundle 提取后正文 textContent 为 99,630 UTF-16 字符，恰低于 MAX_CONTENT_SIZE=102,400（差 2.7%），ai-manager.js:1049 条件为 false，截断分支不执行，工具返回 JSON 中不存在截断标记。AI 收到完整正文并生成完整总结是符合当前实现的正确行为——不存在「标记生成了但未转述」的呈现层问题。两个放大因素：① 单位语义错位（IN-01）——按 UTF-8 字节该页 173,889 bytes > 100KiB「该截」，按 UTF-16 字符 99,630「不该截」，契约文案写 bytes 实现按字符；② UAT 用例前提错配——以原始 HTML 大小推断提取后文本量，该页恰为阈值边缘案例。
fix: （find_root_cause_only 模式，未实施）建议方向：① 明确契约单位语义——若意图为字节 100KB，改用 Buffer.byteLength(content,'utf8') 比较与截断；若接受字符语义，修订 UI-SPEC:139 契约文案与标记措辞（"bytes"→字符），落地 REVIEW IN-01；② 修正 UAT 用例——选用提取后正文确定超 102,400 字符的测试页（可用本次 Electron 复现脚本 /tmp/readability_test.js 预验证），或将期望改为条件式「正文超阈值时截断并标记」；③ 可选增强——若产品要求用户可感知，可在系统提示中引导 AI 主动转述截断标记，或在 UI 工具卡片基于 details.contentLength 显示截断状态。
verification: 决定性实验（真实 bundle + Electron DOM + 逐字复现 extractScript）测得 99,630 < 102,400；盲注：UAT 时刻线上页面可能与抓取快照有 ±数百字符编辑差异，距阈值余量 2,770 chars（2.7%），判定翻转概率低；live 页面 CentralNotice banner 被 Readability negative regex（banner）滤除，不影响结论。
files_changed: []
