# Phase 48 — UI Review

**Audited:** 2026-09-13
**Baseline:** `.planning/phases/48-skill-name/48-UI-SPEC.md`（approved 2026-09-12，7/7 通过 / 2 项非阻断 FLAG）
**Screenshots:** **captured（复用而非重拍）** —— 目标产物是 Electron 应用（非 web dev server），
CLI 截图路径不适用（3000/5173/8080 由无关本地代理应答 502）。视觉证据改用本阶段 UAT 驱动
（playwright `_electron` + 真实 dev 应用）已产出的 10 张截图，复制到 git 安全目录
`.planning/ui-reviews/48-20260913-115110/`（`.planning/ui-reviews/.gitignore` 已覆盖 `*.png`，
`git check-ignore` 实测命中）。证据文件：

| 文件 | 内容 |
|------|------|
| `uat48-r4-t20-w280.png` / `-w360.png` / `-w600.png` | `/` 面板 55 技能数据集三档宽度 |
| `uat48-r4-t20-panel-bottom.png` | 面板滚动到底部视图（sticky 标题 + 超限标注） |
| `uat48-r4-t20-window.png` | 整窗（AI 面板 360 默认宽） |
| `uat48-r4-t19-A.png` / `-B.png` | 真实会话气泡（`技能` pill + `技能正文（N 字符）` 折叠块） |
| `uat48-r2-t9.png` / `uat48-r2-t13-q1.png` | 气泡 pill 短名形态 / `read` 卡片技能变体（`使用技能「demo」` + `用户` 徽标） |

![panel 280](../../ui-reviews/48-20260913-115110/uat48-r4-t20-w280.png)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | UI-SPEC 的 18 条文案逐字命中；但「行尾 muted 标注」的 `title` 被复用到「与本地命令同名」态，对该态给出的理由不成立 |
| 2. Visuals | 3/4 | 长技能名行（≤360px）把来源徽标挤到**第二行**，UI-SPEC「元素 1–3 不可换行组」未成立；名称为无省略号的硬截断 |
| 3. Color | 3/4 | 零新增 accent、双主题令牌与契约逐值一致；但**行 hover/active 背景下**徽标与超限标注对比度跌破契约自定的 4.5:1 |
| 4. Typography | 3/4 | 气泡技能名**不是等宽 + 600**（`.ai-skill-pill` 全仓零 CSS 规则）→ 三族 pill 形状不可辨，与 UI-SPEC 明文冲突 |
| 5. Spacing | 4/4 | 新增间距全在 4 网格内，两条 B 表例外逐条正确落地，零任意值；仅 3 条 INFO |
| 6. Experience Design | 2/4 | 主发送路径的状态覆盖完备，但**重发/重试路径**留空壳气泡（WR-03，已实测确认）+ 3 条台账在册的可见缺陷；折叠块开关仅鼠标可达 |

**Overall: 18/24**

> 本轮**无 BLOCKER**（无 pillar 得 1，无破坏任务完成的缺陷）。得分集中在 3 分档的理由是：
> 契约实现度很高（文案/色彩令牌/间距/结构逐条命中），但存在 3 处**契约未真正兑现**的可见缺陷
> 与 1 处交互状态覆盖缺口。

---

## Top 3 Priority Fixes

1. **气泡技能名缺等宽 + 600（`.ai-skill-pill` 是孤儿类）** — 用户气泡里三族 pill 只剩微标可辨，
   UI-SPEC 明确要求的「三者在形状上可辨」失效；面板行名与 `read` 卡片名都是等宽，只有气泡不是。
   **修法**：在 `src/styles/main.css`（`.ai-skill-pill-badge` 段旁，约 `:5815` 后）补
   `.ai-skill-pill .ai-message-ref-title { font-family: var(--font-mono, monospace); font-weight: 600; }`；
   同时把 `tests/test-skill-picker-model.js:375-376` 的「类名在即通过」断言升级为「该类的样式契约存在」
   （该文件已有同类断言范式，见其「样式契约」组）。
2. **行 hover/active 下徽标与超限标注对比度跌破 4.5:1** — 键盘高亮行是**常驻**状态，
   徽标不达标档：`用户` 4.27:1（暗）/ 4.10:1（亮）、`托管` 4.15:1（暗）；超限标注亮色 3.80:1，
   11px/12px 小字不达标。**修法**：把三个徽标规则的底色基准由 `transparent` 换成 `var(--bg-secondary)`
   （`main.css:7174` / `:7180` / `:7186`，`color-mix(… 15%, var(--bg-secondary))`）——底色不再随行背景漂移，
   面板底核算值（实测暗 5.72 / 6.58 / 5.59，亮 4.89 / 4.70 / 5.30）在任何行状态下都成立；
   另把浅色 `--skill-limit-text`（`main.css:55`）由 `#B45309` 改为 `#92400E`（实测 6.50:1 面板底 /
   5.37:1 hover 底）。
3. **长名行把来源徽标挤到第二行** — 55 技能实测：280px 与 360px 下 `/zzvis2-…-skill-name-11` 独占首行，
   `托管` 徽标与描述被换到第二行，行高由 35px 变为 60/62px；用户扫列表时看到「有名字、无来源」的行
   与「有徽标、无名字」的行。UI-SPEC 声明元素 1–3 为不可换行组，但只给了「各自 `flex-shrink: 0`」
   这一机制，扁平 flex 下并不成立。**修法**：在 `renderSlashPickerList`（`src/renderer.js:10434-10440`）
   把名称 + 徽标 + `仅显式` 标记包进一个 `<span class="slash-picker-row-main">`，
   CSS 给 `.slash-picker-row-main { display:flex; align-items:center; gap:10px; flex-shrink:0 }`；
   或退一步让 `.slash-picker-name`（`main.css:7122-7129`）改为
   `flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis` —— 名称让位、徽标不再被挤走
   （后者顺带把上面那条「硬截断无省略号」也一并改善）。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**逐条核对（UI-SPEC §Copywriting「全部用户可见文案（唯一权威清单）」）—— 18/18 命中：**

| 契约文案 | 实现位置 | 结果 |
|---|---|---|
| 分组标题 `技能` / `命令` | `renderer.js:10404` / `:10407` | ✅ |
| 空态 `无匹配技能或命令，输入 / 查看全部` | `renderer.js:10395-10396` | ✅（旧文案 `无匹配命令…` 已按契约更新） |
| 行名 `/{name}`、行 `title="/skill:{name} 可显式调用"` | `10435` / `10426-10428` | ✅（命令行不加 `title` ✅） |
| 徽标文字 `用户`/`内置`/`托管` + 三条 `title` | `skill-picker-model.js:324-340`（`TIER_BADGE` 白名单查表） | ✅ 逐字一致 |
| `仅显式` + `title` | `10423-10425` | ✅ |
| `未进提示词 · 超预算` / `超数量上限`（刻意不统一） | `skill-picker-model.js:238-244`（`STATUS_TEXT`） | ✅ |
| 超限 `title` / 遮蔽 `title` | `renderer.js:10354-10357`（`SLASH_STATUS_TITLE`） | ✅ |
| 遮蔽 `已遮蔽 · 由用户同名技能胜出`；同名 `与本地命令同名 · 本地命令优先` | `skill-picker-model.js:240-241` | ✅ |
| 禁用 system-note / 未找到 system-note | `ai-manager.js:6200-6211`（唯一来源） | ✅ 逐字一致 |
| 裸名未知命令 `未知命令 /foo，输入 / 查看可用技能与命令` | `renderer.js:8712` | ✅ |
| 气泡 `技能` 微标 / `技能正文（N 字符）` / `使用技能「name」` | `8899` / `8936` / `9584` | ✅ |

**WARNING —「行尾 muted 标注」的 `title` 被复用到语义不同的第二种状态。**
`SLASH_STATUS_TITLE.muted = 本行不可调用；/skill:名字 作用于胜出的用户技能`（`renderer.js:10356`）
同时服务于两类行（`skill-picker-model.js:274-279`：`shadowed` 与 `nameClash` 同走 `muted` tone）。
对「与本地命令同名」的行，该行不可选中的原因**不是**「胜出的用户技能」，而是本地命令优先
（`skill-picker-model.js:96-99`）—— 该行渲染的 `/clear` 与命令行的 `/clear` 同名，`/skill:clear`
实际调用的是技能、裸 `/clear` 调用的是本地命令。`48-02-SUMMARY.md` 的 Decisions §2 记录这是
「UI-SPEC 未给单独文案 → 按 tone 复用、不新造文案」的刻意取舍，但结果是**用户悬停读到一句对该行不成立的理由**。
**修法**：给 `nameClash` 单独的 tone（如 `clash`）并补一条文案
（建议 `本行不可调用；/skill:名字 可直接调用该技能（本地命令优先占用 /名字）`），
再按 `skill-picker-model.js` 的既有权威表范式登记 —— 注意 UI-SPEC 的「唯一权威清单」里
`与本地命令同名 · 本地命令优先` 是**推导项**，同节补一条 title 属契约内补齐而非新造语义。

**INFO — 三档徽标文案存在第二份副本（WR-01，仍开）。** `renderer.js:8847-8851`（`SKILL_TIER_TITLES`）
与 `skill-picker-model.js:324-340`（`TIER_BADGE[*].title`）逐字重复三条文案，而
`docs/product/ai-skills.md:358` 声称「不存在第二份徽标实现」。今天两侧逐字相同（无用户可见分叉），
故不扣分；一旦漂移，面板徽标与气泡微标的 tooltip 会给出不一致的来源说明。

**INFO — 空态行可点击观感。** 空态是单行提示条（`10395-10396`，`.slash-picker-row-empty` 只给
`cursor: default`，`main.css:7118-7120`），但行 hover 规则只排除 `.slash-picker-row-disabled`
（`main.css:7103-7105`）→ 面板空态会随鼠标上浮变色。48-02 改写这一行（此前是内联
`style="cursor:default"`）时有机会补 `-disabled` 类而未补；因形态与改动前一致，按 INFO 记。

---

### Pillar 2: Visuals (3/4)

**WARNING — 长名行的行内分组在窄面板下失效（有截图证据）。**
契约声明：元素 1–3（名称 / 来源徽标 / `仅显式`）为**不可换行组**，元素 4 承担全部压缩，元素 5 换第二行
（UI-SPEC §面板结构契约「行布局约束」）。实测（`uat48-r4-t20-w280.png` / `-w360.png`，已放大复看）：

```
280px:  /zzvis2-644315-extremely-long-ski        ← 名称独占首行，硬截断无省略号
        托管   短描述 11                          ← 徽标被换到第二行（左对齐，读作另一行）
360px:  /zzvis2-644315-extremely-long-skill-name-11   ← 名称正好占满行宽
        托管   短描述 11
```

UAT round 4 的行高分布（`33×2 / 35×15 / 60×15 / 62×29`）与这两张图一致：**约半数的长名行都变成双行、
徽标脱离名称**。用户扫列表时失去「名字 ↔ 来源」的配对。契约给的机制（「名称与徽标/标记的
`flex-shrink: 0`」+ 名称 `nowrap`）在**扁平 flex-wrap 容器**里不足以形成不可换行组 —— 名称 nowrap 且
不收缩会把徽标整块挤出首行。修法见 Top 3 #3。

> 已知并已裁决的边界：`.slash-picker-name` 的 `nowrap + flex-shrink:0` 导致的**名称硬截断**
> （`main.css:7122-7129`）用户 2026-09-13 接受，本报告不另记分 —— 但**徽标被挤到第二行**是另一条
> 后果，不在该裁决覆盖范围内，故记为 WARNING。

**已验证符合契约（正面证据）**：
- 层阶可用：名称 13px/600 等宽（`main.css:7122-7129`）→ 描述 12px muted 单行 ellipsis（`7131-7139`）
  → 徽标/标记 11px（`7162-7201`）→ 行尾标注右对齐（`7204-7217`）；真实截图里 `/weather`、
  `/demo` 行一眼可读，50+ 行列表无破版（`uat48-r4-t20-w600.png`）。
- 两个分组标题 sticky 常驻且背景不透明（`main.css:7145-7157`；底部视图 `-panel-bottom.png` 中
  `技能` 仍钉在滚动容器顶部），空分区标题整个不输出（`10403-10408`）。
- `read` 卡片技能变体形状正确（`uat48-r2-t13-q1.png`）：`✓ 使用技能「demo」` + `用户` 徽标 + `完成`
  同高排列，徽标 `flex-shrink: 0` 不被名称挤压；`.tool-card-name-skill` 的 `gap: 8px` 与
  父容器 `.tool-card-header` 存量 `gap: 8px`（`main.css:6001`）一致。
- 气泡结构（`uat48-r4-t19-A.png` 放大 4×）：`技能` 微标 + 技能名 pill（20px 高、`rgba(0,0,0,0.25)` 底）
  → 正文 → 折叠块 header（`技能正文（39 字符）` + 右侧 chevron `▸` = 折叠态）→ 气泡下方 `复制`。
  顺序与 UI-SPEC §用户气泡契约结构图逐条一致。

**INFO — 三个孤儿类（有 JS 挂载、全仓零 CSS 规则）**：`.slash-picker-row-skill`
（`renderer.js:10412`）、`.ai-skill-pill`（`8895`，见 Pillar 4）、`.ai-skill-content-box-title`
（`8935`；与既有 `.ai-summary-box-title` 同款「无样式钩子」，属存量先例）。
前两者若被后续阶段当作可用钩子去写样式，会出现「改了不生效」的静默失败。

**INFO — `技能` 标题在命令分区仍是唯一钉住的分组标题。** sticky 元素的包含块是整个
`#slashPickerList`（无分区包裹元素），故滚动到命令分区时钉在顶部的是 `技能`；命令分区仅 2 行、
其 `命令` 标题在流内可见（`-panel-bottom.png` 可读），当前**不产生误导**。若未来某个分区变长，
需要重新评估分区包裹。

---

### Pillar 3: Color (3/4)

**已核对通过（正面证据）**：
- **accent 零新增**：新增三个 CSS 段（`main.css:5803-5869` / `6149-6164` / `7078-7217`）grep `accent`
  零命中（仅注释提及）；选中/悬停行仍一律 `var(--bg-hover)`（`main.css:7103-7109`），未改为 accent
  —— 契约硬约束成立。
- **令牌双主题齐备且逐值一致**：暗 `#93C5FD / #6EE7B7 / #C4B5FD / #F59E0B`（`main.css:25-29`）、
  亮 `#1D4ED8 / #065F46 / #5B21B6 / #B45309`（`:52-55`）与 UI-SPEC 表逐字相同；全仓 `--skill-*`
  声明恰四个（未超出契约允许的令牌面）。
- 徽标底色/边框用 `color-mix(… 15% / 30%, transparent)`（`7172-7188`），配置徽标为中性
  `rgba(127,127,127,0.16)`（`7200`）—— 一行不出现第 4 个色相，符合契约的「来源是分类、`仅显式` 是修饰」。
- 60/30/10 分布未被扰动：新元素全部落在 `--bg-secondary`（面板底）/ `--bg-hover`（行高亮）与
  11px 级徽标上，未新增任何 accent 面；`--skill-limit-text` 与三档来源色是契约自有的分类色。

**WARNING — 行 hover/active 背景下小字对比度跌破契约自定的硬要求（数值实测）。**
契约 §Color 写「**对比度硬要求：徽标文字对「15% 混色底 + 面板 `--bg-secondary`」的对比度 ≥ 4.5:1**
（11px 属小字）」，并按 `--bg-secondary` 核算通过。但面板行在 hover **与键盘 active** 时底色切到
`--bg-hover`（`main.css:7103-7109`），徽标底色是 `transparent` 混色（跟随行背景漂移），超限标注是纯文字。
用 WCAG 相对亮度重算（对照：契约声明的 `用户` 档 5.7 / 4.7 与本次 5.72 / 4.89 逐位吻合，
其余各档同量级、差异 ≤ 0.5 —— 属契约手工核算的混色取整差异）：

| 元素 | 面板底（契约核算态） | **hover / active 底** | 判定 |
|---|---|---|---|
| `用户` 徽标（暗 #93C5FD） | 5.72:1 ✅ | **4.27:1** ❌（`#404040`） | 不达标 |
| `用户` 徽标（亮 #1D4ED8） | 4.89:1 ✅ | **4.10:1** ❌（`#e0e0e0`） | 不达标 |
| `托管` 徽标（暗 #C4B5FD） | 5.59:1 ✅ | **4.15:1** ❌ | 不达标 |
| `托管` 徽标（亮 #5B21B6） | 5.30:1 ✅ | 5.30:1 ✅（同色底更浅，比值反升） | 达标 |
| `内置` 徽标（暗 #6EE7B7 / 亮 #065F46） | 6.58 / 4.70 ✅ | 4.89 / 4.68 ✅ | 达标 |
| 超限标注 `--skill-limit-text` | 6.68（暗）/ 4.61（亮）✅ | **3.80:1**（亮 `#e0e0e0`）❌；暗 4.83 ✅ | 亮色不达标 |
| muted 遮蔽标注 | 2.97 / 2.33（灰显行，`opacity:.6` → 非活动控件豁免） | — | 契约已豁免 |

要点：**键盘高亮行是常驻状态**（`↑↓` 停在超限技能行上时该行一直带 `.active`），所以这不是一闪而过的
过渡态。根因是契约的核算只覆盖 `--bg-secondary`，未覆盖契约自己规定的 `--bg-hover` 行高亮 —— 实现
逐字照抄了令牌值，缺陷来自契约盲区。修法见 Top 3 #2（把徽标底色基准钉在 `--bg-secondary` 即一次性解决
三档徽标；超限标注无底色可钉，需调亮色令牌值）。

**INFO — 徽标与 `仅显式` 标记的边框不对称导致「严格同高」不可能达成。**
契约要求两个徽标「必须严格同高」（`main.css` 侧共用 B 表 `1px 4px` 例外），但契约给出的徽标 CSS 含
`border: 1px solid …`、`仅显式` 标记无边框；两者 `height: auto` 时 `box-sizing` 不影响结果 ⇒
来源徽标实测高 19.4px、`仅显式` 17.4px（同一行 `align-items: center` 下居中，视觉仅差 2px）。
若确要严格同高，给 `.slash-picker-tag-explicit`（`main.css:7191-7201`）补 `border: 1px solid transparent`。

---

### Pillar 4: Typography (3/4)

**契约声明**：本阶段 4 字号（11 / 12 / 13 / 14）× 2 字重（400 / 600），`.tool-card-name` 的存量 500
以「继承登记」形式豁免。**实测符合**：新增规则只用 11px/400、12px/400、13px/600（`main.css:5803-5868`、
`7078-7217`），`.tool-card-name-text` 不加字号字重（继承 12px/500，`6149-6164` 只加等宽与截断四件套）。

**WARNING（契约明文未兑现）— 气泡技能名不是等宽 + 600。**
UI-SPEC §用户气泡契约写：pill 结构 = `.ai-skill-pill-badge` + `.ai-message-ref-title`（技能名（**等宽 600**）），
理由明文：「技能名用**等宽字体 + 600**（与面板行名称同款），与 @ 引用 pill 的『彩色圆点 + 普通字重标题』
和附件 pill 的『SVG 图标 + 标题』在形状上三者可辨」。实现只给 name 挂了原类：

- `renderer.js:8895` — `pill.className = 'ai-message-ref-pill ai-skill-pill'`
- `renderer.js:8902` — `name.className = 'ai-message-ref-title'`（无任何修饰类 / 内联样式）
- `.ai-skill-pill` 在 `src/styles/main.css` 与 `src/styles/bookmarks-bar.css` **均无规则**
  （`grep -rn '\.ai-skill-pill[ ,{]' --include='*.css' --include='*.html'` 零命中），
  `.ai-message-ref-title`（`main.css:7054-7058`）只做 ellipsis、不含 `font-family` / `font-weight`
  ⇒ 技能名继承 pill 的 11px + 气泡的 400 + 系统 sans。

视觉复核（`uat48-r4-t19-A.png` 4× 放大）：气泡内 `uat-r4a-70490058` 为比例字体，与**同一张截图右侧面板**里
等宽的 `/demo` `/weather` 以及 `uat48-r2-t13-q1.png` 里等宽的 `使用技能「demo」` 明显不同族 ⇒
「三族 pill 形状可辨」只靠微标成立，技能名与 @ 引用 pill 的标题**完全同形**。
测试之所以长期为绿：`tests/test-skill-picker-model.js:375-376` 只断言字符串里出现
`ai-skill-pill` / `ai-skill-pill-badge`（**类名在 ≠ 规则在**，正是本 phase 自己在「收藏栏菜单悬浮切换」
一节里写下的教训：类名断言检不出样式失效）。修法见 Top 3 #1。

**INFO — 三条新规则未声明契约给出的 line-height。** 契约 Typography 表为 Body（1.5）/Label（1.4）声明了
行高，`.slash-picker-status`（`main.css:7204-7209`，12px）与 `.tool-card-name-text` 未声明（继承），
三个徽标类与分组标题都显式写了 `1.4`。因两者都处于 `align-items: center` 的 flex 行内、不影响行高，
仅作记录。

**INFO — `--font-mono` 未定义。** `main.css:7123` 与 `:6159` 均写 `var(--font-mono, monospace)`，
全文件无该变量声明 ⇒ 实际走通用族 `monospace`（平台默认等宽族）。UI-SPEC 自己也按
`var(--font-mono, monospace)` 描述，故此为实现与契约一致，但「等宽」在跨机上不是确定字体。

---

### Pillar 5: Spacing (4/4)

**逐条核对新增声明（全部在 4 网格内，或落在 UI-SPEC Exceptions A/B 表内）：**

| 新增规则 | 值 | 判定 |
|---|---|---|
| `.slash-picker-group-header` | `padding: 4px 12px` | ✅ 均 4 的倍数（契约同值） |
| `.slash-picker-source-badge` / `-tag-explicit` / `.ai-skill-pill-badge` | `padding: 1px 4px` | ✅ **B 表第 1 条**登记的共用例外（垂直 `1px`），三处一致 |
| `.ai-skill-pill-badge` | `margin-right: 4px` | ✅ |
| `.ai-skill-content-box` | `margin: 4px 0 0` | ✅ 对齐 `.ai-summary-box` 存量 `4px auto` |
| `.ai-skill-content-box-header` | `gap: 6px` / `padding: 6px 12px` | ✅ **B 表第 2 条**（逐值照抄 `.ai-summary-box-header`） |
| `.ai-skill-content-box-body` | `padding: 8px 12px 10px` | ✅ A 表照抄存量 |
| `.tool-card-name-skill` | `gap: 8px` | ✅ 与父容器存量 `gap: 8px` 同值（契约明文禁止此处用 6px） |
| `.slash-picker-row` | `flex-wrap: wrap` + 存量 `gap:10px` / `padding:8px 12px` | ✅ A 表「既有值不改」；仅增补属性 |
| 任意值扫描 | `\[.*px\]` / `\[.*rem\]` | ✅ 零命中 |

无 44px 触控目标例外需要（契约已声明本阶段无独立触控入口）。

**INFO — 契约声明的 `xs`（4px）用途未以 `margin-right` 落地。** 契约 Spacing 表的 xs 行写着
「徽标/标记与相邻文字的间隙（`margin-right`）」，实现未给任何徽标加 `margin-right`（除气泡微标），
行内间隙全部来自 `.slash-picker-row` 的存量 `gap: 10px`（`main.css:7097`）。10px 是 A 表登记且明令
「**不改**」的既有值，因此实现的选择是唯一不与契约另一条冲突的写法；仅记录「契约的 token 用途描述
与实现路径不一致」这一事实，供后续阶段在新增行元素时不要误以为已存在 4px 间隙规约。

**INFO — 徽标与标记的高度差。** 见 Pillar 3 的对应 INFO（19.4 vs 17.4px，源自契约自身边框不对称）。

---

### Pillar 6: Experience Design (2/4)

**已核对通过（正面证据，逐条对应契约状态表）**：
- **空态**：过滤零命中 → 单行提示条 + 契约文案（`renderer.js:10394-10398`）；技能集为空时只渲染
  `命令` 分区、空标题不输出（`10403-10408`）。
- **无 loading 态**（契约要求）：打开瞬间用内存快照同步渲染（`10308-10313`），无骨架屏 / spinner；
  后台 `refreshSkills()` 成功后就地重渲染（`10315-10329`）。
- **无 error UI**（契约要求）：刷新失败 `catch` 后保留旧快照、面板零错误 UI（`10325-10328`）；
  快照重拉路径同款（`9081-9094`）。
- **禁用/灰显态**：`disabled` 技能在面板隐藏（`skill-picker-model.js:222`）、`shadowed` 与同名行
  `opacity: .6` + 不绑处理器 + 不参与 hover/active 高亮（`main.css:7103-7115`、`renderer.js:10413`、
  `10451-10465`）；`↑↓` 取值域收敛为可选中集合，全部不可选中 → `-1` 并回落既有 false 路径
  （`10156-10172`、`skill-picker-model.js:180-196`）。
- **发送路径的错误态**：主进程未调用 `agent.prompt` 时 renderer 移除刚推的 user 气泡与 assistant 占位、
  复位流式状态、只留一条 system-note（`renderer.js:8822-8830` + `removeSkillFailureBubbles:8870-8879`）
  —— 契约「零残留气泡」成立，UAT round 4 亦覆盖。
- **不丢焦点 / 不关面板 / 不清输入框 / 不改 activeIndex**：重渲染只替换 `#slashPickerList` 的
  `innerHTML`（`10442`），输入框节点不动；`scrollIntoView({block:'nearest'})` 保留（`10444-10448`）。
- **无破坏性操作** ⇒ 不需要确认卡片、不新增 dialog（契约声明成立）。

**WARNING（已实测确认）— 重发 / 重试路径的 `skillError` 分支留下空壳气泡（WR-03，仍开）。**
`regenerateMessage` 与 `showAIError` 重试按钮都在 try 之前先 push 了 assistant 占位并整列渲染
（`renderer.js:9985` / `:9989`、`:10066` / `:10069`），但 `skillError` 分支只 `pushSystemNote` + `return`
（`9994-10000`、`10072-10078`）——**没有**调用 `removeSkillFailureBubbles`。那一刻 `state.aiStreaming`
已被置 false，`pushSystemNote` → `renderAIMessages()` 时 `skipBubble` 为真（空 content、无工具卡片）
但仍会追加操作按钮（`renderer.js:8093-8095`）⇒ 界面留下一只**只有「复制」按钮、复制内容为空**的
空壳。触发条件真实可达：技能在两次尝试之间被删除 / 改名 / 禁用，或运行期新增技能的 miss 路径
（48-07 的 G-48-12 场景）。修法：两处 `skillError` 分支与发送路径对齐，先
`removeSkillFailureBubbles(...)`（或按最近一条 user 消息移除占位）再 push system-note。

**WARNING — 全部行不可选中时 `↑↓` 不复渲染，DOM 与状态短暂背离（IN-03，仍开）。**
`renderer.js:10165-10169`：`next < 0` 时置 `activeIndex = -1` 后直接 `return`，未重渲染 ⇒
上一行的 `.active` 高亮仍留在 DOM（`--bg-hover` 常驻），用户看到「高亮着一行」却按下 Enter 走发送路径。
修法：该分支改为 `state.slashPickerActiveIndex = -1; renderSlashPickerList(); return;`。

**WARNING — 技能已注入但本轮 run 失败时，气泡不显示 pill / 折叠块（IN-07，仍开，已复核）。**
`ai-manager.js:1112` 的重试耗尽失败出口返回 `{conversationId, skillInvocation: null}`，renderer 的
`if (result && result.skillInvocation)`（`renderer.js:8810`）因此不成立 ⇒ 用户看不出这一轮实际把哪个
技能喂给了模型 —— 正是 D-09「让用户看到实际喂了什么」要消除的困惑。

**WARNING（次要）— 技能正文折叠块的展开/折叠仅鼠标可达。**
header 是 `<div>` + click 监听（`renderer.js:8931-8946`），无 `tabindex` / `role="button"` /
`aria-expanded`，全阶段四个表面在 `renderer.js:8840-9060`、`10370-10470` 范围内
`aria-*` / `role=` / `tabindex` **零命中**。UX 后果：键盘无法展开正文、读屏无法得知折叠状态。
与既有 `.ai-summary-box-header`（`renderer.js:7992-8013`）完全同款，属**存量交互范式**的延续
（契约也只要求视觉「逐值照抄」），故记为次要 WARNING 而非契约违背；若 Phase 49/50 会重做这一族折叠
控件，建议一并补 `button` 语义 + `aria-expanded`。

**INFO — 本轮内技能气泡缺「复制」动作（IN-06，仍开，已复核为有界窗口）。**
定向刷新只替换 `.ai-message-content`（`renderer.js:8195-8201`），wrapper 级 `.message-actions`
由流式结束时的 `finalizeAIStreamingBubble`（`8313-8327`）统一补齐 ⇒ 缺口只存在于「本轮进行中」，
回合结束后与其他气泡一致。与 G-48-6 的「整列重绘会丢流式节点」取舍互为代价，可接受。

**INFO — 视觉 backstop 的证据与账本不一致。**
UI-SPEC 唯一 backstop（50+ 技能 × 220px 面板观感）已在 UAT round 4 test 20 实测：55 技能 / 三档面板宽度
（280 / 360 / 600）/ 数值 + 截图 + 用户拍板 pass ✅。但 `.planning/WINDOWS.md:38` 的 id 21 仍为 `open`
（`open_count: 22`）—— `/gsd-ship` 会因此阻塞。建议把 id 21 按 test 20 的证据置 `fixed`
（本报告不代改账本）。

**INFO — 未跑的验证面**：`read` 卡片技能变体（48-03）与气泡/面板的**深色主题**观感在本轮证据里
没有对应截图（现存证据全为浅色主题）。UAT 以文本记录覆盖了卡片变体（round 2 test 13「标题/徽标/
参数逐字仍在」），但深色主题下徽标 hover 态对比度（`用户` 4.27:1 / `托管` 4.15:1）尚无视觉确认，与
Pillar 3 的 finding 同一根因，建议与 #2 的修复一并在深色主题下复核。

---

## 附录：与本阶段既有台账的对应关系

| 本报告条目 | 台账 id | 状态 |
|---|---|---|
| Pillar 6 空壳气泡 | `48-REVIEW.md` WR-03 | open（本轮代码复核确认形态仍在） |
| Pillar 6 `↑↓` 不复渲染 | IN-03 | open（已复核） |
| Pillar 6 本轮内缺复制动作 | IN-06 | open（已复核为有界窗口） |
| Pillar 6 run 失败无 pill | IN-07 | open（已复核 `ai-manager.js:1112`） |
| Pillar 1 徽标文案双份 | WR-01 | open（两侧今日逐字一致，无可见分叉） |
| Pillar 2/4 面板 `title` 属性逃逸 | TD-48-01（CR-01） | user-deferred（Phase 49 开工前第一条）；`escapeHtml`（`renderer.js:11349-11353`）仍只转义 `& < >`，技能目录名含 `"` 可闭合 `title` 属性 —— 已裁决延后，本报告不作为 finding |
| Pillar 6 折叠块键盘可达性 | 无台账条目 | **本轮新增观察** |
| Pillar 3 hover 态对比度 | 无台账条目 | **本轮新增观察**（契约盲区，实现逐值合规） |
| Pillar 4 气泡技能名等宽/字重 | 无台账条目 | **本轮新增观察**（契约明文未兑现） |
| Pillar 2 徽标被挤出首行 | 无台账条目 | **本轮新增观察**（有截图证据） |
| 50+ 面板 backstop | WINDOWS id 21 | 证据已在 UAT test 20，账本未随动 |

---

## Files Audited

| 文件 | 审计面 |
|---|---|
| `src/skill-picker-model.js`（359 行，全量） | `STATUS_TEXT`/`TIER_BADGE` 文案唯一权威、`filterPickerItems` 两档过滤、`buildPickerItems` 可选中性与标注优先级、`nextSelectableIndex` |
| `src/renderer.js` | `renderAISkillPill:8890-8916`、`renderSkillContentBox:8927-8955`、`buildUserMessageContent:8973-9050`、`refreshUserMessageBubble:8183-8202`、`renderAIMessages:7983-8103`、`createMessageActions/finalizeAIStreamingBubble:8243-8327`、`handleSendAIMessage:8672-8842`、`pullAiSkillsSnapshot:9081-9094`、`skills:changed` 监听 + 预热 `4401-4409`、`renderToolCard:9552-9598`、`handleAIInputKeydown:10153-10196`、`executeActiveSlashCommand:10213-10233`、`openSlashPicker:10308-10330`、`SLASH_STATUS_*:10344-10357`、`renderSlashPickerList:10376-10466`、`escapeHtml:11349-11353`、`regenerateMessage`/重试 `9985-10090` |
| `src/styles/main.css` | 主题令牌 `7-56`、`ai-skill-pill-badge` `5803-5815`、`ai-skill-content-box*` `5819-5869`、`tool-card-name*` `6128-6164`、`slash-picker-*` `7078-7217`、`.ai-message-refs/-pill/-title` `7027-7058`、`.ai-summary-box*` `5746-5798` |
| `src/index.html` | `slashPickerPanel/slashPickerList` `861-864`、CSS 版本 `?v=8`（`:11`）、脚本加载顺序 `1020-1024` |
| `ai-manager.js`（只读核对） | `skillErrorFromReason:6200-6211`、`prompt()` 返回契约 `1095-1112`、`_resolveSkillInvocation` 失败出口 `1500` |
| `tests/test-skill-picker-model.js`（只读核对） | 气泡/面板断言（`:375-376` 的类名级断言） |
| `docs/product/ai-skills.md` §10 | §10.7 / §10.8 与实现的一致性 |
| 设计契约与证据 | `48-UI-SPEC.md`（审计基线）、`48-01..48-08-SUMMARY.md`、`48-CONTEXT.md`、`48-REVIEW.md`（台账比对）、`48-UAT.md`（round 4 证据）、`.planning/WINDOWS.md`（id 21-24） |
| 截图证据（git 安全目录） | `.planning/ui-reviews/48-20260913-115110/`（10 张，含 4×/3× 放大裁剪复看） |

**Registry Safety**：`components.json` 不存在（UI-SPEC 亦声明项目未初始化 shadcn、不消费任何
registry）⇒ 门禁不适用，不生成 Registry Safety 章节。
