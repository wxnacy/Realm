# Phase 49 — UI Review

**Audited:** 2026-09-13
**Baseline:** `49-UI-SPEC.md`（status: approved，Design Contract）—— 逐条对照其 Spacing Scale / Typography / Color / Copywriting Contract / 卡片结构契约 / 交互契约 / UI Considerations
**Screenshots:** captured —— 复用本阶段真实渲染门禁已产出的窗口级与元素级截图（非 dev-server 截图；本项目是 Electron 桌面应用，无 web dev server：`localhost:3000/5173/8080` 实测 502 而非 200）

> **审计执行方式（诚实披露）**：本报告**不是**由独立的 `gsd-ui-auditor` 子代理产出。`/gsd-verify-work 49` 的 verify:post → `ui-review` 步骤在派发子代理时命中 **429 配额限制**（重置时间 2026-09-14 21:30 UTC+8），代理在创建阶段即失败、未产出任何内容、未留下未提交残留。按既有降级约定由**主会话接管**执行同一审计流程（gitignore 门禁 → dev server 探测 → 六支柱逐项对码 + 真实渲染证据 → 写盘）。本报告中的每一项几何量、命中测试、标签遍历与截图差分均为**实测**（见 `## 实测证据索引`），但**未经第二个独立主体复验**。

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 标题与九条短原因逐字合规；但成功结果文本与九条「展开区完整文案」与契约的「唯一权威清单」不符，且卡内引号风格不统一（「」 vs `"`） |
| 2. Visuals | 3/4 | 头部层级与徽标底色修复到位；280px 下技能名退化到 `更…`（契约接受），但最宽 6 字形态会只剩省略号，头部不再能回答「哪个技能被处理」 |
| 3. Color | 3/4 | 新增令牌两主题齐备、前置修复①②落地、新增规则零硬编码；但契约的 Accent 保留清单已漏记第 3 处使用（焦点环） |
| 4. Typography | 4/4 | 只引入 2 字号 / 2 字重、无第 5 字号、等宽用法与既有语言一致；未发现实现偏差 |
| 5. Spacing | 4/4 | 新增声明恰 2 条且全在 4 网格内，B 表为空（实测成立）、标注零内外边距、既有例外未放大 |
| 6. Experience Design | 2/4 | **BLOCKER**：49-02 新增的键盘停靠点落在被完全裁切的折叠容器内 —— 真实 Tab 遍历可停、命中测试取不到、聚焦前后卡片截图逐字节相同 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **折叠态卡片内的键盘停靠点不可见（BLOCKER）** — 键盘用户在每张 `manage_skill` 卡片上会停在一个**零可见高度**的控件上：焦点环被祖先裁掉、Enter/Space 切换的是看不见的态；而卡片头部（真正该可聚焦的入口）仍不可聚焦 ⇒ 键盘用户既看不到焦点、也无法展开卡片。修法二选一：① 把 `role="button"` / `tabindex="0"` / `aria-expanded` 从 `.ai-skill-content-box-header` 移到**卡片头部**（`.tool-card-header`），折叠块 header 保持纯视觉；② 保留现位置但在折叠态给该 header `tabindex="-1"`、仅展开态置 `0`（同步 `aria-hidden`）。推荐 ①：`renderSkillContentBox` 是气泡与卡片共用的**唯一**实现，气泡语境不受 `.tool-card-content` 裁切，故「卡片头部承担可达性」不会牺牲气泡既有行为。

2. **「唯一权威清单」与实际文案不符（WARNING）** — 契约声明自己是全部用户可见文案的唯一权威，实测至少 12 处不符：成功结果文本三句被合并为两句且措辞不同（`ai-manager.js:6289-6293`；`create`/`update` 均为「它从下一条消息起对模型可见。」，契约要求三句各不相同、且 `create` 为「该技能从下一条消息起可用。」—— 即既有挂账 WR-03 的完整面）；九条完整错误文案逐条措辞不同（`ai-skills-manager.js:1374/1384/1394/1462/1475/1125/1180`）。修法：把契约表改成**实测文案**（并说明它已不再是逐字契约），或把实现改回契约措辞；同时统一卡内引号风格 —— 标题用「」（`skill-picker-model.js:380-382`），错误体用 ASCII `"`（同文件外的四处 `"${name}"`），同一张卡片内两种风格并存。

3. **单源缺口与契约账本漂移（WARNING）** — ① `MANAGE_SKILL_ACTION_NAME`（`skill-picker-model.js:392-396`，`创建`/`更新`/`删除`）与 `MANAGE_SKILL_ACTION_LABEL`（`:379-383`，`创建技能「{name}」`）同域重复编码同一组动词，是本阶段新引入的第二张映射表，且不在数据契约硬约束 4 列举的三张表白名单内 ⇒ 二者存在漂移风险（本阶段已因「第二份拷贝」吃过 CR/WR 各一条）。修法：参数摘要的动词改为从 `MANAGE_SKILL_ACTION_LABEL` 派生，或把 `ACTION_NAME` 登记进契约的白名单表。② 契约 `## Color` 的「Accent reserved for」显式清单只有 2 条，但 `.ai-skill-content-box-header:focus-visible { outline: 2px solid var(--accent-color) }`（`main.css:5857`）是第 3 处 —— 用途正当（与全仓既有焦点语言 `main.css:1800` 一致），但「显式清单」口径已失真，应补记。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**逐字合规的部分（实测）**

| 契约项 | 实现 | 结论 |
|--------|------|------|
| 三动作标题 | `MANAGE_SKILL_ACTION_LABEL`（`src/skill-picker-model.js:379-383`）与契约 3 行**逐字相同** | ✅ |
| 九条短原因 | `MANAGE_SKILL_SHORT_REASON`（`:408-418`）九值逐字相同；`limit_exceeded: STATUS_TEXT.overLimit` 以**引用**形式写（非第二份拷贝） | ✅ |
| `promptIncluded === false` 追加句 | `ai-manager.js:6299` 与契约逐字相同，且**仅严格 `false`** 才追加（`:6297`） | ✅ |
| 正文折叠块 header | `技能正文（N 字符）`，N = `skillInvocation.content.length`（`src/renderer.js:8953`，String.length 口径） | ✅ |
| 短原因白名单纪律 | 表外 code ⇒ 不渲染标注（`renderer.js:9651-9655`），零 `undefined` 字面量 | ✅ |
| 通用标签 / 空态 / 主观措辞 | 新增区域无 `OK`/`Cancel`/`提交` 类标签；无空态文案（卡片由工具调用驱动）；无「确认正常」类措辞 | ✅ |

**W1-01（WARNING）成功结果文本与契约不符，且三句被合并为两句** — 契约三条各不相同；实现（`ai-manager.js:6289-6293`）`create` 与 `update` 共用 `它从下一条消息起对模型可见。`，`delete` 为 `它从下一条消息起不再可用。`。实测渲染逐字见 `uat49-t2-card-wide.png`：`已创建技能「commit-style」。它从下一条消息起对模型可见。`。实现文字其实更精确（点明「对模型可见」= D-13 的真实语义），但契约的「唯一权威清单」因此不成立。此项与既有挂账 **WR-03** 是同一处。

**W1-02（WARNING）九条「展开区完整文案」与契约表逐条不符** — 实测对照（仅列差异最大的四条）：

| code | 契约文案 | 实测文案（`ai-skills-manager.js`） |
|------|----------|-----------------------------------|
| `seeded_protected` | `「{name}」是随包内置技能，AI 不能覆盖或删除。请换一个名字创建，或用 update 增强自己创建的技能。` | `"${name}" 是随包内置技能，不能被覆盖或删除。请换一个名字创建新技能，或只增强你自己创建（managed）的技能`（`:1374`） |
| `user_owned_conflict` | `已存在同名用户技能「{name}」；…因此未写入。请换一个名字。` | `存在同名用户技能 "${name}"：用户技能优先级更高，AI 创建的会被它永久遮蔽，且它不属于 AI 的管理范围。请换一个名字`（`:1384`） |
| `not_found` | `技能「{name}」不存在，无法更新或删除。` | `技能 "${name}" 不存在（AI 只能修改或删除自己创建在 managed-skills 下的技能）。请先用 create 创建它`（`:1394`） |
| `oversize` | `技能正文超过上限（{N}）。请精简后再写入。` | `技能正文超过上限：限额 65536 字节，当前 N 字节`（`:1125`） |

`invalid_name` / `invalid_description` 在实现侧是**多条具体原因**（`:1034-1130` 共 10 条），契约只给了一句合并文案；此外空 `content` 被归到 `invalid_description`（`技能正文不能为空`，契约的 Checker Sign-Off 非阻断建议 2 已指出这一归属问题）。

**W1-03（WARNING）同一张卡片内引号风格不统一** — 标题走 `「」`（`skill-picker-model.js:380-382`），错误体走 ASCII `"`（`ai-skills-manager.js:1374/1384/1394/1462`）。280px 截图里同一屏同时可见两种形态：卡片标题 `创建技能「commit-style」` 与失败卡展开后的 `"commit-style" 是随包内置技能…`。

**W1-04（WARNING）第二份 action→动词 映射表** — `MANAGE_SKILL_ACTION_NAME`（`:392-396`）与 `MANAGE_SKILL_ACTION_LABEL`（`:379-383`）同域重复。契约的数据契约**硬约束 4** 把渲染端允许的查表枚举为三张（`TIER_BADGE` / `MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_SHORT_REASON`），实际导出了五张（加 `MANAGE_SKILL_ACTION_NAME`、`PROMPT_OMITTED_CARD_NOTE`；后者是经契约追认的投影，前者不是）。

### Pillar 2: Visuals (3/4)

**到位的部分** — 头部层级为「三态图标 → 标题 → 来源徽标 → 至多一个内联标注 → 状态文字」，`g49-3-card-520.png` 与 `uat49-t2-card-wide.png` 两档实景确认视觉权重递降清晰；徽标与标注同处 11px「元数据簇」、同为不可压缩元素；折叠块 chevron `margin-left: auto` + 折叠旋转，与卡片既有语言一致；参数区从「整面 JSON 墙」改为三行可读摘要（`改/技能名/描述`），实测截图确认 `content` 不出现在参数区；钩子类 `.tool-card-manage` 已按契约声明为**无 CSS 规则的定位钩子**（`renderer.js:9720`，全仓恰 1 处）。

**W2-01（WARNING）最小宽度下的信息损失比契约描述的更严重** — 契约的「已知且接受的退化」措辞是「技能名可能被压缩到仅剩省略号」。实测 280px 面板：目标卡（3 字标注）为 `更新技…`；失败卡（5 字短原因 `描述不合法`）已退化为 `更…`（**只剩 1 个字符**，见 `/tmp/uat49/audit-panel-band.png` 4× 放大）。按几何外推，最宽形态（6 字第 `内置不可改删`）会落回契约的「仅剩省略号」下限 —— 即头部在最需要它的时候（刚被拒、用户要知道是哪个技能）完全无法回答「哪个技能」。补救只在展开区的 `技能名：` 行，而展开入口的键盘可达性另有缺陷（见 W6-01）。**不违反契约**（契约明确接受），但契约对退化程度的描述偏乐观，建议按实测改词，或在头部给技能名加 `title` 全文（注意契约禁止把 `name` 拼进属性值 —— 该禁止的理由是防属性上下文注入，而 `el.title = value` 是 DOM 属性赋值、非 HTML 解析；若采纳需先修订该条纪律）。

**I2-01（INFO）装饰性状态 SVG 无 `aria-hidden`** — `renderer.js:9599/9602/9605` 三态图标是状态字形，同信息由 `.tool-card-status` 文本承载，但未标 `aria-hidden="true"`。全仓无该约定（非本阶段回归），仅记录。这三处 `innerHTML` 全部是**静态字面量**，零模板插值 —— 与契约「零 `innerHTML` 模板拼接」一致（该区域内 2 处代码 `innerHTML` + 1 处注释命中，逐行核对）。

### Pillar 3: Color (3/4)

**到位的部分** — 新增规则零硬编码色值（全部 `var()` / `color-mix()`）；`--skill-error-text` 在**两个**主题块都定义（`main.css:33` 暗 `#FCA5A5` / `:63` 亮 `#B91C1C`，缺一即对应主题失效，已逐处核对）；前置修复 ① 落地 —— 三档徽标底色基准已钉死为 `color-mix(in srgb, var(--skill-source-*) 15%, var(--bg-secondary))` + 边框 30%（`:7244-7260`）；前置修复 ② 落地 —— 浅色 `--skill-limit-text: #92400E`（`:61`）；卡片头部超预算标注与 `/` 面板行尾标注**共用同一令牌**（`.tool-card-manage-note-limit { color: var(--skill-limit-text) }`，`:6221`），与契约一致。实测复核：280px 亮色主题下失败短原因渲染为深红（`audit-panel-band.png` 4× 放大可读），与契约四档对比度核算的判定一致。

**W3-01（WARNING）Accent 保留清单漏记第 3 处使用** — 契约 `## Color` 的「Accent reserved for（显式清单，非「所有可交互元素」）」列 2 条，并声明「本阶段新增元素零 accent 使用 …… 不得改为 accent 背景；展开 / 折叠态不加 accent 边框」。实现另有 `.ai-skill-content-box-header:focus-visible { outline: 2px solid var(--accent-color); outline-offset: -2px }`（`main.css:5857`）。该用法**正当**（键盘焦点必须可见，且与全仓既有焦点语言 `main.css:1800` 的 dashed accent outline 同源），也**不是**「accent 背景」或「展开/折叠态边框」—— 但它确实是一处新的 accent 使用点，而契约把这张表定性为「显式清单」。修法：补记第 3 条（`键盘焦点环（.ai-skill-content-box-header:focus-visible）`）。

### Pillar 4: Typography (4/4)

**未发现实现偏差。** 新增元素只用 **2 个字号 / 2 个字重**（逐值核对）：

| 元素 | 实测声明 | 契约档位 |
|------|----------|----------|
| `.tool-card-manage-note`（`:6213`） | `font-size: 11px; font-weight: 400; line-height: 1.4` | Label 11px / 400 / 1.4 ✅ 与徽标同档 |
| `.tool-card-manage-note-error` / `-limit`（`:6220-6221`） | 只改 `color`，零字号字重声明 | ✅ |
| `.tool-card-name-text`（`:6174`） | 只加 `font-family: var(--font-mono)`，**不动**字号字重 | ✅ 与契约「只加等宽」一致 |
| `.tool-card-name`（`:6144`） | `font-size: 12px; font-weight: 500` | ✅ 继承登记值，本阶段零改动 |
| 正文折叠块正文 | `font-size: 12px; line-height: 1.6`（照抄 48 存量） | ✅ |
| 参数 / 结果载体 `.tool-card-value`（`:6261`） | `12px / line-height: 1.4 / 等宽` | ✅ |

未引入第 5 个字号（契约明确禁止）。实测 280px 与 520px 两档头部高度均为 **36px**（`header.offsetHeight === 36`、`scrollHeight <= clientHeight`），与字号/行高断言一致。**唯一观察是契约侧的自陈不准（INFO）**：Typography 表「Inherited」行把 `.tool-card-name` 的 line-height 写成「1.4（继承，`.tool-card-value` 存量声明）」，但 `.tool-card-name` 不是 `.tool-card-value` 的后代，该继承关系在 DOM 上不成立（实际由 UA 默认行高承担，实测头部高度仍精确 36px）。属契约文档问题，非实现缺陷。

### Pillar 5: Spacing (4/4)

**契约的「B 表为空（零条非 4 倍数新增间距）」经实测成立。** 本阶段新增的间距声明**恰两条**，全在 4 网格内：

```css
.tool-card-content .ai-skill-content-box { margin: 4px 12px 8px; }   /* main.css:6227-6229 */
.tool-card-content .ai-skill-content-box-body { max-height: none; }  /* :6230-6232，非间距属性 */
```

逐项核对：

- `.tool-card-manage-note`（`:6213-6219`）声明集为 `flex-shrink / white-space / font-size / font-weight / line-height` —— **零 padding、零 margin**，与契约「间隙由宿主 `.tool-card-name-skill` 的存量 `gap: 8px` 提供」逐字一致
- `.tool-card-header`（`:6098`）`gap: 8px; padding: 0 12px; height: 36px` —— 零改动，且**无 `flex-wrap`**（头部单行不变式的第一条）
- `.tool-card-name-skill`（`:6165`）`gap: 8px; min-width: 0` —— 零改动（与父容器同值）
- 徽标 `padding: 1px 4px`（`:7244` 段）与折叠块 header `gap: 6px; padding: 6px 12px` 段 —— 均为 48-UI-SPEC 已登记的存量例外，照抄未放大
- 新增元素无 44px 触控目标例外（桌面键盘优先的工具卡片，无独立触控入口）

**I5-01（INFO，非间距属性）** `.ai-skill-content-box-body` 的卡片语境覆盖只重置 `max-height: none`，未同时重置基线规则的 `overflow-y: auto`（`main.css:5854` 段）。实测无嵌套滚动条（无高度约束即不触发溢出），「单一滚动容器」目前靠**无高度约束**成立而非显式声明；建议顺手改成 `overflow-y: visible` 把意图写成声明。归入 Pillar 6 的成因链一并记录。

### Pillar 6: Experience Design (2/4)

**到位的部分**

| 状态 | 实测 |
|------|------|
| loading（运行中） | `renderer.js:9696-9702` 三态状态文字；运行中 = 旋转图标 + `正在执行...`，且**标题在 start 事件即出现**（`action + name`，零 IO），徽标与标注按设计尚未出现 |
| error（失败） | 红 ✗ + `失败` + 11px 短原因；实测 280px 亮色主题下 `描述不合法` 完整可读（`audit-panel-band.png`） |
| empty / partial | 均**不适用**且已论证（卡片由工具调用原子插入，无空壳、无部分就绪态） |
| destructive confirmation | 三动作一律自动（D-01 锁定，非遗漏），卡片是只读历史记录 —— 无确认卡片是决策而非缺失 |
| 折叠块 a11y 属性 | `role="button"` + `tabindex="0"` + 随态更新的 `aria-expanded` + Enter/Space（含 `preventDefault` 防 Space 滚动页），补齐作用于**唯一构建实现** `renderSkillContentBox`（`renderer.js:8935`，1 定义 / 2 调用：气泡 `:9067`、卡片 `:9739`） |
| 焦点环 | `:focus-visible { outline: 2px solid var(--accent-color); outline-offset: -2px }`（`main.css:5857`）—— Checker 的非阻断建议 3 已落地 |
| 多卡片 | `skills:changed` **不改写**已渲染的历史卡片（不可变记录），与契约一致 |

**W6-01（BLOCKER）新增的键盘停靠点落在被完全裁切的容器内**

49-02 给折叠块 header 补 `tabindex="0"` 的本意是兑现 48-UI-REVIEW Pillar 6 的建议，但**卡片语境**把该构建产物放进了 `.tool-card-content`（折叠态 `max-height: 0; overflow: hidden`，`main.css:6235-6238`）。`overflow: hidden` **不会**把后代移出顺序焦点导航 ⇒ 折叠的卡片上出现一个零可见高度的 Tab 停靠点。以下全部为真实渲染 + 真实键盘的**实测**（探针 `/tmp/uat49/audit-a11y-probe.js`，证据 `/tmp/uat49/audit-a11y-probe.json`；8/8 断言）：

| # | 实测 | 值 |
|---|------|-----|
| 1 | 卡片处于折叠态，祖先裁切盒几何 | `.tool-card-content` 外接矩形 **217 × 0**（`top = bottom = 620`），computed `max-height: 0px` / `overflow: hidden`；卡片总高 **36px**（仅头部） |
| 2 | header 的 a11y 属性 | `tabindex="0"`、`role="button"`、`aria-expanded="false"`、`tabIndex` 属性值 **0** |
| 3 | 是否被排除出 Tab 序 | 祖先链**无** `display:none` / `visibility:hidden` / `inert`，自身非 `disabled` ⇒ 在 Tab 序内 |
| 4 | 可聚焦性 | `focus({preventScroll:true})` 后 `document.activeElement === header` ⇒ 可聚焦 |
| 5 | **真实 Tab 遍历**（自 `body` 起 46 站） | 卡片域内**唯一**停靠点就是它（索引 **42**）—— 卡片头部本身不可聚焦 ⇒ 整张卡片仅此一个键盘入口，而它是隐形的 |
| 6 | 命中测试（header 中心点） | 返回的元素是**别的消息里的 `<CODE>`**（`当需要撰写符合 conventional commits 规…`），`hitIsHeader = false`、`hitInsideCard = false` ⇒ 该位置画的不是 header |
| 7 | **截图差分**（聚焦前 / 聚焦后，卡片元素级） | `Buffer.compare(before, after) === 0`，**3783 == 3783 字节逐字节相同**，且聚焦期间 `activeElement` 确为该 header ⇒ 焦点环从未绘制 |

**后果**：键盘用户在折叠的 `manage_skill` 卡片上按 Tab 时焦点**凭空消失**（WCAG 2.4.7 Focus Visible 不达标），此时按 Enter/Space 切换的是内层折叠块的 `.collapsed`（用户看不到任何变化），而真正该承接键盘的是卡片头部（展开/折叠卡片）——它没有 `tabindex`。**这不是回归**（49 之前卡片同样无键盘入口），但 49 的 a11y 增量在卡片语境里从「改善可达性」变成了「新增一个不可见的焦点陷阱」，即比不加更差。

**成因链**（与 `docs/debug/` 已记录的形态同源）：`.tool-card-content` 用 `max-height: 0` 而非 `display: none` 承载折叠 —— 这是为了 200ms 的 `transition: max-height`。`display: none` 会自动把后代移出 Tab 序，`max-height: 0` 不会。49-02 在**唯一构建实现**上加的 `tabindex` 因此在气泡语境（永远可见，正确）与卡片语境（默认折叠，失效）之间产生了**语境相关的语义分裂** —— 同一份代码在两种宿主下行为不同，而契约只描述了气泡语境。

**修法（二选一）**：① 把可达性上移到卡片头部（`.tool-card-header` 加 `role="button"` / `tabindex="0"` / `aria-expanded` 绑定 `.expanded`），折叠块 header 回到纯视觉 —— 推荐，因为卡片头部的展开/折叠才是用户真正要的操作，且气泡语境不受影响；② 保留现位置但在折叠态给该 header `tabindex="-1"` + `aria-hidden="true"`，卡片展开时（`.tool-card.expanded` 是卡片类，需 JS 在切换时同步）再置回 `0` —— 但要处理 `.ai-skill-content-box` 自身的 `.collapsed` 与卡片 `.expanded` 两层折叠叠加，复杂度更高。

**I6-01（INFO）嵌套滚动的「单一滚动容器」目前靠无高度约束成立** — `main.css:6230-6232` 的卡片语境覆盖只写 `max-height: none`，未重置基线 `overflow-y: auto`（`:5854` 段）。实测无嵌套滚动条（无高度约束 ⇒ 不触发溢出），故功能正确；但契约明文要求「避免嵌套滚动条」，把 `overflow-y: visible` 一并写上会让该意图成为**声明**而非巧合。

---

## 实测证据索引

| 证据 | 位置 | 用途 |
|------|------|------|
| 真实渲染门禁（本 run 重跑，退出码 0，A1–A9 全绿） | `tests/uat-49-g49-3-panel-layout.js` · 日志 `/tmp/uat49/rerun-verifywork.log` | 280/420/520/260 四档头部几何、祖先溢出、技能名压缩、CSS 声明投影 sha |
| 几何证据 JSON | `/tmp/uat49/evidence-g49-3.json` | 280px：`nameWrap 136/136`、`nameText clientWidth 54`、`badge 30`、`note 34/34`、`header 36` |
| 元素级截图（520 / 280） | `/tmp/uat49/g49-3-card-520.png` · `g49-3-card-280.png` | 头部层级、徽标与标注配色对照 |
| 窗口级截图（280px 面板） | `/tmp/uat49/g49-3-window-280.png`（2560×1330） | 同一屏内 5 张卡片的真实共存（`read` 失败卡 / `bash` 卡 / manage_skill 失败卡 / `read` 技能卡 / 目标卡） |
| 4× 放大：目标卡头部 | `/tmp/uat49/g49-3-zoom-280-header.png` | 「✓ 更新技…｜托管｜超预算｜完成」逐字目视 |
| 4× 放大：失败卡（本审计生成） | `/tmp/uat49/audit-panel-band.png`（`magick g49-3-window-280.png -crop 390x150+2170+350 +repage -resize 300%`） | 「✗ 更…｜托管｜描述不合法｜失败」—— 短原因完整、技能名退化到 1 字 |
| 展开态卡片截图 | `/tmp/uat49/uat49-t2-card-wide.png`（489×271） | 参数摘要三行 / 折叠块 header / 结果文本逐字 |
| a11y 探针（本审计自建） | `/tmp/uat49/audit-a11y-probe.js` · 日志 `audit-a11y-probe3.log` · 证据 `audit-a11y-probe.json` | Tab 遍历 46 站、命中测试、截图差分（W6-01 的 7 项实测） |
| UI-SPEC 决策来源 | `49-UI-SPEC.md` 的 Backstop 收口记录节 | E1 overflow 的收口对象与两条禁令 |

**安全纪律**（沿用本阶段既有教训）：全部真实渲染以 `NODE_ENV=development` 拉起**本进程自己启动的** `realm-dev` 子进程；用户的正式版 `/Applications/Realm.app`（PID 22083）在审计全程**始终运行且未被触碰**；探针因故中断后按**自身 PID 逐个**清理（`kill -TERM` 无效后 `kill -9` 39609/53582/53585），**未使用**任何 `pkill` / `pgrep` 模式匹配杀进程。收尾复核：`Projects/Realm/node_modules/electron/dist` 下无残留，PID 22083 仍在。

**范围声明**：本次审计针对 `src/renderer.js` 的 `manage_skill` 卡片变体、`src/skill-picker-model.js` 的四/五张白名单表、`src/styles/main.css` 的卡片域声明、以及承载它们的 `ai-manager.js` / `ai-skills-manager.js` 文案与状态机。`/` 面板行、气泡 pill、`read` 卡片变体属 48 面，仅在与本阶段共用面（徽标底色、`--skill-limit-text`、折叠块 a11y）相关时检查。**`Registry Safety` 节整节跳过** —— 项目未初始化 shadcn（无 `components.json`），不消费任何 registry。

---

## Files Audited

- `src/renderer.js` —— `renderToolCard` 的 `manage_skill` 变体（`:9609-9755` 头部三元素与三个内容块）、`renderSkillContentBox`（`:8935-9010`，a11y 增量 `:8941-8960`）、状态文字 `:9694-9702`、参数/结果标签 `:9767` / `:9789`
- `src/skill-picker-model.js` —— `STATUS_TEXT` `:239`、`PROMPT_OMITTED_CARD_NOTE` `:269`、`TIER_BADGE` `:349`、`MANAGE_SKILL_ACTION_LABEL` `:379`、`MANAGE_SKILL_ACTION_NAME` `:392`、`MANAGE_SKILL_SHORT_REASON` `:408`、`mergeManageSkillMarker` `:450`、导出面 `:463-475`
- `src/styles/main.css` —— 主题令牌 `:7-63`；`.tool-card` `:6091`、`.tool-card-header` `:6098`（+`:6108` hover）、`.tool-card-icon` `:6113`、`.tool-card-name` `:6144`、`.tool-card-status` `:6155`、`.tool-card-name-skill` `:6165`、`.tool-card-name-text` `:6174`、`.tool-card-manage-note` `:6213-6221`、卡片语境覆盖 `:6227-6232`、`.tool-card-content` `:6235-6245`、`.tool-card-params`/`-result` `:6248`、`.tool-card-label` `:6254`、`.tool-card-value` `:6261`、折叠块家族 `:5827-5859`（含 `:focus-visible`）、三档徽标 `:7244-7260`、面板行 `--skill-limit-text` 用法 `:7284`
- `ai-manager.js` —— 工具定义 `:6152-6190`、`execute` 参数读取 `:6191-6195`、成功结果文本 `:6289-6300`、失败词缀 encode `:6317-6320`、词缀常量 `:161`、`_manageSkillMeta` `:756` / `:6276` / `:6323` / `:1801-1803`、`_buildManageSkillDecoration` `:1768` / `:1804` / `:2968`、重载词缀 decode `:1847-1848`
- `ai-skills-manager.js` —— `LIMITS` `:50-56`、`yamlScalar` `:100-105`、校验器 `:1034-1130`、`sanitizeSkillDescription` `:1150`、`scanSkillText` `:1177-1183`、`buildSkillFileText` `:1204`、`validateSkillFileSize` `:1231`、`atomicWriteSkillFile` `:1274-1300`、`managedSkillPaths` `:1317`、`countManagedSkills` `:1335`、`resolveManagedTarget` `:1367`、`createManagedSkill` `:1422`、`updateManagedSkill` `:1539`、`deleteManagedSkill` `:1603`、`getSkillPromptIncluded` `:1651`、`applyShadowing` `:451`
- `src/index.html` —— `skill-picker-model.js` 的脚本加载顺序（先于 `renderer.js`）
- `tests/uat-49-g49-3-panel-layout.js` —— 真实渲染门禁（本次重跑，作为 Pillar 5 / 2 的几何证据来源）
- `.planning/phases/49-manage-skill-ai/49-UI-SPEC.md` —— 审计基线（Design System / Spacing Scale / Typography / Color / Copywriting Contract / 卡片结构契约 / 交互契约 / UI Considerations / 决策来源表）
- `.planning/phases/49-manage-skill-ai/49-CONTEXT.md` —— 锁定决策 D-01 / D-02 / D-07 / D-09 / D-12 / D-13 / D-15
- 真实渲染截图与证据：`/tmp/uat49/` 下 `g49-3-*`、`uat49-t2-*`、`audit-panel-band.png`、`evidence-g49-3.json`、`audit-a11y-probe.json`

---

_Audited: 2026-09-13 · 执行方式：`/gsd-verify-work 49` verify:post → `ui-review`（子代理 429，主会话接管）_
