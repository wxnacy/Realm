---
status: complete
phase: 49-manage-skill-ai
source: [49-VERIFICATION.md]
started: 2026-09-13T13:02:00Z
updated: 2026-09-13T14:56:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 端到端可见性（49-VALIDATION.md 五步表的步骤①+②）
expected: |
  `npm run dev`，在 AI 聊天里显式要求它把某套流程沉淀为技能（名字用 commit-style）；
  **不重开对话**直接发下一条消息问「你现在有哪些技能？」——应答中出现 commit-style。
  这是 ROADMAP SC1「新技能集在下一条消息即对模型可见」的唯一端到端证据，
  断言点在**下一条消息**而非工具返回时。步骤①–⑤ 全文见 49-VALIDATION.md 的 Manual-Only 表。
why_human: 需真实 LLM 往返，不可自动化（49-VALIDATION.md 层 2 已声明不得由层 1 证据替代）
result: pass
source: automated-e2e
verified_at: 2026-09-13T13:22:00Z
evidence: |
  driver: /tmp/uat49/driver.log:6-13 · /tmp/uat49/evidence.json#tests.test1_visibility
  断言方式：playwright `_electron` 驱动真实 realm-dev 应用（userData 隔离，未触碰运行中的
  正式版 Realm.app）；真实键盘输入 + `#aiInput` → Enter；第一条消息走真实 `manage_skill`
  工具调用，第二条消息（**不重开对话**）取末条 assistant 气泡文本。
  实测应答（逐字）："当前可用的技能有以下 3 个：\n\ndemo — …\nweather — …\n
  commit-style — 当需要撰写 git 提交信息时使用此技能，按 conventional commits 规范书写。"
  判定：reply.includes('commit-style') === true。LLM = xiaomi/mimo-v2.5，key 经
  `ai-manager.detectEnvVar` 从环境变量 `XIAOMI_API_KEY` 解析（realm-dev 配置内 key 为空）。
  这是层 2 证据本身（真实 LLM 往返 + 真实工具调用），非层 1 替身。
  本 run（2026-09-13T14:53Z）复核：证据 JSON 仍在 `/tmp/uat49/evidence.json`，
  `containsTargetSkill === true`，`question === "你现在有哪些技能？请把当前可用的技能名全部列出来。"`
  —— 复现「下一条消息」口径（追问为独立消息、非重开对话）。**未重跑**（原始驱动脚本已不在 /tmp），
  沿用既有定论结果；层 2 的机制面另有 49-VERIFICATION 真值 #1（L1 行为用例）独立支撑。

### 2. 卡片终态视觉面（步骤①）
expected: |
  同一张卡片终态应显示「创建技能「commit-style」」标题 + 托管徽标 + 参数摘要三行
  + 折叠的「技能正文（N 字符）」块 + 含「下一条消息起」的结果文本。
  **本次与前次的关键差异**：CR-01 已被本 run 机械证明修复（终态 manageSkill 保留
  action/name、manageSkillOk === true），故该人工作业**现在可以执行**（前次报告明确写
  「修复 CR-01 前必然失败」）。注意：结果文本的实际措辞是「它从下一条消息起对模型可见。」，
  与 UI-SPEC 权威文案「该技能从下一条消息起可用。」不一致（WR-03，既有挂账）。
why_human: 视觉呈现需真实渲染；机械证据只证明变体可达，不证明渲染结果正确
result: pass
source: automated-dom+screenshot
verified_at: 2026-09-13T13:22:00Z
evidence: |
  driver: /tmp/uat49/driver.log:9 · /tmp/uat49/evidence.json#tests.test2_card
  截图: /tmp/uat49/uat49-t2-card-wide.png（卡片元素级，面板宽 600px）
  五项判据逐条机械断言（真实渲染 DOM）：
  | # | 判据 | 实测 | 结论 |
  |---|------|------|------|
  | 1 | 标题 | `.tool-card-name-text` === "创建技能「commit-style」" | ✅ |
  | 2 | 托管徽标 | `.slash-picker-source-badge-managed` 文本 === "托管" | ✅ |
  | 3 | 参数摘要三行 | `params` === "动作：创建\n技能名：commit-style\n描述：…"（split('\n').length === 3） | ✅ |
  | 4 | 折叠正文块 | `.ai-skill-content-box.collapsed`，标题 "技能正文（444 字符）" | ✅ |
  | 5 | 结果文本 | "已创建技能「commit-style」。它从下一条消息起对模型可见。"（含「下一条消息起」） | ✅ |
  另注（既有挂账 WR-03，非本阶段新增）：判据 5 的实际措辞与 UI-SPEC 权威文案
  「该技能从下一条消息起可用。」不一致 —— 与 49-VERIFICATION 既有记录一致，本次不改判。

### 3. backstop 视觉确认（步骤⑤）
expected: |
  把 AI 面板拖到最小宽度（--ai-panel-min-width: 280px），让一张卡片同时带
  来源徽标 + 「未进提示词 · 超预算」标注 —— 头部保持单行不换行、徽标与短原因完整可读、
  头部高度不变；唯一允许的退化是技能名被省略号压缩。
why_human: backstop 级判据（非可推断），需真实渲染下的视觉裁决；见 VERIFICATION.md 的 behavior_unverified_items
result: pass
source: automated-dom+screenshot
verified_at: 2026-09-13T14:53:00Z
evidence: |
  **G-49-3 修复后复测（本 run）**：`NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js`
  → **退出码 0**、`ALL ASSERTIONS PASS`、preflight `E-PW true | E-KEY true | E-DATA true`
  （数据前提：`commit-style` + `aa-budget-*=14/14` 齐备，未删未改）。
  驱动日志: /tmp/uat49/rerun-verifywork.log · 证据 JSON: /tmp/uat49/evidence-g49-3.json
  截图: /tmp/uat49/g49-3-zoom-280-header.png（4× 放大，直读「✓ 更新技…｜托管｜超预算｜完成」）
        /tmp/uat49/g49-3-card-280.png · /tmp/uat49/g49-3-window-280.png
  修复前（21:27 轮）→ 本次复测（14:53）逐条对照：
  | 判据 | 修复前 | 本次复测 | 结论 |
  |------|--------|----------|------|
  | A1 标注右缘 vs 裁切祖先右缘 | 越界 11.84px | 越界 **0.00px**（2465.23 vs 2465.23） | ✅ |
  | A2 祖先 scrollWidth ≤ clientWidth | 148 > 136 | **136 ≤ 136** | ✅ |
  | A3 技能名 clientWidth（>0 才可能有省略号） | **0**（整段消失） | **54** | ✅ |
  | A4 头部高度 / 单行 | 36 / 单行 | 520=36、280=36，scrollHeight 36 ≤ clientHeight 36 | ✅ |
  | A5 徽标完整可读 | 30 ≤ 30 | 30 ≤ 30，右缘 2423.50 ≤ 2465.73 | ✅ |
  | A6 标注文本 | 「未进提示词 · 超预算」 | **「超预算」**（3 字，E1 的 ≤ 4 字收口） | ✅ |
  | A7 最小宽度钳制 | 260 → 280 | 260 → 280；280 → 280 | ✅ |
  | A8 失败态卡片（-error）280 档 | 未覆盖 | 右缘 2465.23 ≤ 2465.23；祖先 136 ≤ 136（errorNoteCovered=true） | ✅ |
  | A9 CSS 声明投影全轮 sha 相等 | — | red = 520 = 420 = 280 = 260 = `69899a4f…`（只改注释） | ✅ |
  真实渲染几何（280 档）：panel=280 · card=217 · nameWrap 136/136 · nameText 54 · badge 30 · note 34（text="超预算"）。
  用户裁决：2026-09-13 判 pass（以本仓门禁 + 4× 放大截图直读为准）。
  残余守卫弱点（既有挂账，非本轮新增）：A1–A6 全为「不越界」单向判据（WR-10），
  已由正向信号兜底 —— 标注 `clientWidth 34 === scrollWidth 34`（非零渲染宽）+ 截图直读。

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-49-3
  truth: "在 AI 面板最小宽度（--ai-panel-min-width: 280px）下，同时带来源徽标 + 「未进提示词 · 超预算」标注的 manage_skill 卡片头部，徽标与短原因必须完整可读（不得被裁切），且技能名退化的上限是「被压缩到仅剩省略号」"
  status: resolved
  resolved_by: 49-07-PLAN.md
  resolved_at: 2026-09-13
  resolution_evidence: |
    修复提交 `fcf42d8`（卡片头部超预算标注改取单源 ≤ 4 字投影，`src/styles/main.css` 声明零改动、只改注释）。
    复测退出码 0、A1–A9 全绿（越界 0.00px / 祖先 136≤136 / 技能名 clientWidth 54 / 头部 36px 单行）；
    4× 放大截图直读「✓ 更新技…｜托管｜超预算｜完成」。会话见 49-UAT.md 测试 3 的 evidence。
  severity: minor
  test: 3
  reason: "自动化实测（非人工报告）：面板 280px 时卡片实宽 210px，`.tool-card-name`（.tool-card-name-skill）clientWidth 129px < 其不可压缩内容 148px，短原因右端 19px 被 `.tool-card-name` 的 overflow:hidden 裁掉；同时唯一可压缩项 `.tool-card-name-text` 被压到 clientWidth = 0，技能名整段消失且无省略号"
  root_cause: "`.tool-card-name`（main.css:6149）带 `overflow: hidden`，48-03 新增的修饰类 `.tool-card-name-skill`（main.css:6165-6170）只设 display:flex / gap / min-width，**未重置 overflow** —— 于是该 flex 容器成为裁切容器。49 新增的 `.tool-card-manage-note`（main.css:6187，flex-shrink: 0 + white-space: nowrap，实测 100px）与既有徽标（flex-shrink: 0，32px）在 280px 下合计 8+32+8+100 = 148px，已超过容器可用宽 129px；flex 收缩只作用于唯一可压缩的 `.tool-card-name-text`（min-width: 0），它先被压到 0，超出的 19px 由容器 overflow:hidden 裁在右端 —— 于是「徽标 + 短原因」两个本应受保护的不可压缩元素中，靠右的短原因反被裁切，而本应退化的技能名整段消失。"
  artifacts:
    - path: "src/styles/main.css"
      issue: ".tool-card-name (6149) 的 overflow: hidden 未被修饰类 .tool-card-name-skill (6165) 重置，使其成为裁切容器"
    - path: "src/styles/main.css"
      issue: ".tool-card-manage-note (6187) flex-shrink: 0 + 实测 100px，与徽标 32px 合计超出 280px 下的容器可用宽 129px"
    - path: "src/styles/main.css"
      issue: ".tool-card-name-text (6174) 是唯一可压缩项（min-width: 0），被压到 0 宽度后无法渲染省略号"
  missing:
    - "按 UI-SPEC E1 的指定处置收口：缩短短原因文案至 ≤ 4 字（**不得**改成换行头部、**不得**加 system-note）—— 使「徽标 + 短原因」在 129px 容器内可容纳，让退化重新回到「技能名仅剩省略号」"
    - "回归证据：在面板 280px 下断言 `.tool-card-manage-note` 的 scrollWidth ≤ clientWidth，且 `.tool-card-name-text` 的 clientWidth > 0（可见省略号），且头部高度仍为 36px"
  debug_session: ""
