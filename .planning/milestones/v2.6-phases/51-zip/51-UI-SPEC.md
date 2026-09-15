---
phase: "51"
slug: "zip"
status: approved
shadcn_initialized: false
preset: none
created: "2026-09-15"
reviewed_at: "2026-09-15T03:05:45Z"
---

# Phase 51 — UI Design Contract

> 用户技能导入管线（zip + 网络地址）的视觉与交互契约。
> 由 gsd-ui-researcher 生成，gsd-ui-checker 校验。
>
> **本阶段 UI 面全部落在设置页 `realm://settings` 内（= 由 `http://localhost:PORT/settings` 加载的
> webview guest）**：① 「技能管理」区标题行右侧的「导入技能」入口按钮；② 一个两模式的导入弹框
> （「本地上传」/「网络地址」）；③ 弹框内的两阶段预览卡片（名称 + 落点 / description 原文 /
> 目录树 / 字节数 / 脚本清单标红 / 威胁扫描结论两栏 / `allowed-tools` + 免责标注）；
> ④ 风险必勾确认；⑤ 同名冲突三选一（覆盖 / 改名 / 取消）；⑥ 失败反馈（弹框内状态行 + 区级 inline hint）。
> **不新增页面、不新增图标、不新增字体、不新增折叠控件家族、不新增 toast 基建、不新增前端依赖、
> 不新增任何颜色令牌。**
>
> **本契约与 48 / 49 / 50 是同一套视觉语言**：三档来源徽标、折叠块家族、`.settings-group` 骨架、
> `.ai-modal` 弹框形态、inline hint 范式、`.btn.btn-secondary.btn-sm` 按钮族**全部原样复用**，
> 仅按下表登记的三条**作用域收敛**覆盖（全部以 `.skill-manage-section` 为前缀，48/49 的实名宿主零变化）。
>
> **四条对本阶段直接生效的项目约定（AGENTS.md / CONTEXT 前置约束）**：
> 1. **内部页面 CSP**：`realm://settings` 的 CSP 是 `style-src 'self'`（无 `unsafe-inline`）⇒
>    **markup 内联 `style="…"` 不生效**（会被静默拦掉、元素反而常驻可见）。所有初始隐藏走 **CSS 类规则**；
>    显隐切换用 JS CSSOM 的**具体值**（`'flex'` / `'block'` / `'none'`），不依赖 `''` 回落。
>    **不得在内联 style 里写 `mask-image`**。
> 2. **弹框居中约定**：`realm://` 内部页继续用 **div 遮罩 + CSSOM `display` 切换**
>    （`.ai-modal-overlay` + `.ai-modal`，D-18 锁定）。**绝不**把 `.ai-modal-overlay` 用到 `<dialog>` 上
>    （UA fit-content 尺寸 + `inset: 0` 过约束会把盒子钉在 `top:0; left:0`）。
> 3. **数据访问分层**：设置页是 `<webview>` guest、**没有 `realmAPI`** ⇒ 一律走 `/api/skills/*` + URL token
>    （与 `/api/*` **同源**，实测零 CORS 面：`main.js` 无任何 `Access-Control-Allow-*`，同源本就不需要）。
>    主窗口 `file://` **不能** fetch 本地 HTTP（Phase 38 事故）⇒ 走 IPC。两条**不可互换**。
>    本阶段**不新增主窗口入口**（50 D-17：不得为了让 IPC 有消费者而新造一套管理 UI）。
> 4. **不可信字符串**：预览卡片渲染的**全部内容都来自用户导入的包**（文件名 / 目录树路径 /
>    description 原文 / `allowed-tools` 值 / 诊断原文）⇒ 注入纪律见 `## 结构与交互契约` 的
>    「不可信字符串与注入纪律」；`TD-48-01`（`escapeHtml` 不转义引号 ⇒ 属性上下文逃逸）**仍开、仍未被修**，
>    本阶段的责任是**不扩大缺口**（新增插值面全部走 DOM API，零 HTML 字符串模板）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none（无 `components.json` / 无 `tailwind.config.*` / `package.json` 依赖中无 UI 框架；纯手写 HTML + 原生 JS） |
| Icon library | none（**本阶段不新增任何图标，也不新增任何字形**：目录树的折叠开关、脚本清单的展开开关一律用既有 `.btn.btn-secondary.btn-sm` 承载文字「展开全部」/「收起」；**不引入 chevron 字符**） |
| Font | 系统字体栈 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`（`src/styles/main.css:135`，`body` 规则）；**路径 / 技能名 / 落点行**用 `var(--font-mono, monospace)`（既有用法；该变量全仓**未定义**，实际走平台默认等宽族 —— 与 48/49/50 一致，本阶段**不新建字体变量**） |

**样式令牌的实际来源**：全部为 `src/styles/main.css` 顶部两个主题块的**手写 CSS 自定义属性**，
不是任何设计系统产物：

- `:root, [data-theme="dark"]`（`main.css:7-39`）—— 深色主题（默认）
- `[data-theme="light"]`（`main.css:41-71`）—— 浅色主题

**本阶段新增令牌：恰 0 个。** 理由（写在这里以免日后被当成遗漏再补一遍）：本阶段的全部着色需求
已被**四条既有语义文字色**覆盖 —— `--text-primary` / `--text-secondary`（中性）、
`--skill-error-text`（脚本清单标红 / 失败 / 校验错误）、`--skill-limit-text`（启发式高亮 / 必勾提示 / 冲突提示）、
`--skill-success-text`（区级成功 hint）；唯一新增的「强调边框」复用 `--accent-color` 作**非文本边界**。
**不引入任何新的填充色 / 底色 / 语义色** ⇒ 不引入「两套主题各要补一处」的双份失败点
（50 新增 `--skill-success-text` 时已记录该风险形态）。

**shadcn 门禁**：项目非 React / Next.js / Vite，纯手写 HTML + 原生 JS，**门禁不适用**，不做初始化、不询问 preset。
**Registry 安全门禁**：无第三方 registry，见 `## Registry Safety`。

---

## Component Inventory

Could not enumerate: 项目无组件库、无设计系统包 —— 无 `components.json`、无 `tailwind.config.*`、
`package.json` 依赖中无 UI 框架；全部 UI 为手写 HTML 元素 + 单文件 `src/styles/main.css`（**10748 行，实测**），
不存在可枚举的组件导出面（无包、无 `exports` 映射、无版本号可读）。

本阶段的「组件清单」因此是**既有可复用原语的清点**，由以下可重跑命令生成（非组件库枚举）：

```bash
grep -cE '^\.(settings-group|settings-group-title|setting-description|ai-modal|ai-modal-overlay|ai-modal-header|ai-skill-content-box|ai-memory-tabs|ai-memory-tab|whitelist-input-area|whitelist-tag|btn|btn-secondary|btn-sm|ai-switch|slash-picker-source-badge|skill-manage)[a-z-]*[ ,{:]' src/styles/main.css
# → 95（声明行数）；去重后 67 个类（2026-09-15 实测）
```

**非穷尽清单 —— 不是封闭白名单。** 执行时如需表外既有原语，直接查 `main.css` 是**预期路径**，
不是例外。本表的作用是标出本阶段**已经核对过**的复用点，不是允许使用的上限。

| 既有原语（类 / 常量 / 函数） | 位置 | 本阶段如何复用 |
|------------------------------|------|----------------|
| `.settings-group` | `main.css:3202-3208` | 区外壳（`background: var(--bg-secondary)` / `border-radius: 8px` / `padding: 16px 20px` / `border: 1px solid var(--border-color)`）。**零改动** —— 它同时是**弹框内预览卡片文字**的底色基准（弹框内层 `.ai-modal` 也是 `--bg-secondary`，**同一个不透明令牌** ⇒ 预览内文字与本区行文字落在同一个底上） |
| `.settings-group-title` | `main.css:3210-3215` | 区标题「技能管理」：14px / 600 / `--text-primary` / `margin-bottom: 16px`。**类本体零改动**；仅允许一条**作用域收敛**覆盖（`margin-bottom: 0`，见 `## Color` 的作用域覆盖 ②） |
| `.setting-description` | `main.css:2105-2108` | 区级说明（12px / 400 / `--text-secondary`）。**零改动** |
| `.ai-modal-overlay` | `main.css:5357-5365` | 导入弹框的外层遮罩：**既有 `display: none` 初始隐藏（CSP 安全的初始隐藏范式）** / `position: fixed` / `inset: 0` / `background: rgba(0,0,0,.6)` / `align-items:center` / `justify-content:center` / `z-index: 1000`。**零改动**（JS 置 `display:'flex'` 即居中） |
| `.ai-modal` / `.ai-modal-header` / `.ai-modal-header h3` | `main.css:5383-5405` | 弹框内层：`background: var(--bg-secondary)` / `border-radius: 10px` / `padding: 16px` / **`display:flex` + `flex-direction:column` + `gap: 10px`** / **`max-height: 80vh`**；标题 16px / 600。**零改动** ⇒ 本阶段的「弹框内唯一滚动容器」契约正是建立在它既有的 flex + max-height 之上（见 `## 结构与交互契约`） |
| `.ai-memory-tabs` / `.ai-memory-tab` / `.ai-memory-tab.active` | `main.css:10389-10415` | **模式选择（本地上传 / 网络地址）复用同一类**（同一视觉语言的第 2 个宿主）：`display:flex; gap:4px; border-bottom:1px solid var(--border-color); margin-bottom:16px` + 按钮 `padding: 8px 12px / font-size: 14px / border-bottom: 2px solid transparent`。**类本体零改动**；但 `.active` 的 `color: var(--accent-color)`（`main.css:10412`）对宿主实测**暗 3.90 / 亮 3.37 < 4.5:1**（14px 非大字）⇒ **本页作用域内新增一条 `color` 覆盖**（作用域覆盖 ①）。⚠️ 宿主（AI 记忆区的三个 tab）**零变化**，其既有不达标**如实登记、不修不声称已修**（补记 ④） |
| `.ai-skill-content-box` 家族（`-header` / `-chevron` / `-body`） | `main.css:5834-5896` | **48 D-09 已建**的折叠块。本阶段**不新增折叠控件**：预览卡片内的分区一律**平铺**（不折叠），只有目录树 / 脚本清单各自有一个「展开全部」按钮控制**渲染条数**（不是折叠容器）。**不得新建折叠实现、不得复用 `.collapsed` 做条数控制** |
| `.whitelist-input-area .text-input` | `main.css:8663-8672`（`:focus` 在 `:8674-8677`） | URL 输入框与改名输入框的**几何逐值照抄对象**（`flex:1` / `height:40px` / `background:var(--bg-tertiary)` / `border:1px solid var(--border-color)` / `border-radius:8px` / `padding:0 12px` / `color:var(--text-primary)` / `font-size:14px`）。⚠️ **只照抄几何，绝不照抄 `:focus { outline: none }`** —— 该焦点指示器仅靠 1px accent 边框（对输入框底实测**暗 3.09 / 亮 2.92 < 3:1**）⇒ 本阶段改用 `:focus-visible` + 2px accent 焦点环（作用域覆盖 ③）；既有面**不修不声称已修**（补记 ⑤） |
| `.btn` / `.btn-secondary` / `.btn-sm` | `main.css:913-918` / `930-937` / `939-943` + `1356-1360` + `5645-5649` | **本阶段全部五个按钮**（入口 `导入技能` / `选择 zip 文件` / `获取预览` / `展开全部` / `收起` / `取消`）：生效值 `font-size: 12px` / `padding: 4px 8px` / `height: 28px` / `border-radius: 6px` / 底 `--bg-tertiary` / hover 底 `--bg-hover` / 文字 `--text-primary`，**零改动**。⚠️ 全局 `button { border: none; background: none }`（`main.css:144-150`）⇒ 按钮**默认无边框**（这一点决定了「强调按钮」只能靠**新增边框**表达，见下） |
| `.btn-primary` | `main.css:921-928` | **本阶段不使用**：白字对 `--accent-color` 实测 **3.68:1 < 4.5**（12px 小字）⇒ 入口按钮与确认按钮都**不得**用主色填充（见 `## Color` 的禁用记录） |
| `.btn-danger` | `main.css:1449-1461` | **本阶段不使用**（白字对 `--danger-color` 3.76:1；与 50 同款判定） |
| `.ai-switch` + `.skill-manage-section .ai-switch:focus-visible` | `main.css:5105-5137` / `10633` | 启停开关与 50 建的作用域焦点环。**零改动、零交集**（本阶段不触碰启停） |
| `.slash-picker-source-badge*` / `.slash-picker-tag-explicit` | `main.css:7243-7281` | 三档来源徽标（**本阶段预览卡片不使用** —— 导入的技能在写入前没有来源档位；来源徽标属列表行，见 50） |
| `.skill-manage-*` 全套（50 建） | `main.css:10491-10735` | **本阶段直接复用**：`.skill-manage-hint` / `-success` / `-danger`（区级 hint）、`.skill-manage-section`（本阶段三条作用域覆盖的**统一前缀**）、`.skill-manage-confirm-actions`（动作区形状的照抄对象）。**类本体零改动** |
| `#skillManageConfirm` 的 `.ai-modal-overlay` + `.ai-modal` 形态 | `settings.html:555-567` | **弹框形态模板**（D-18）：外壳复用 + 初始隐藏走类 + CSSOM 显隐。本阶段的导入弹框是**同族新实例**，不是它的改写 |
| `#rulesFileInput` 的文件选择链路 | `settings.html:197` / `settings-page.js:231 / 769 / 812-814 / 1242` / `main.css:3182-3191` | **文件选择的完整先例**：`<input type="file">` 经 **CSS 类规则** `display:none` 初始隐藏、由可见 button 调 `.click()` 触发、`change` → 处理函数、**`finally` 里清空 `e.target.value`**（`:812-814`，形如 `e.target.value = ''`）**保证同一文件可重复触发**。本阶段照抄这条链路（**不新增 native dialog / 不新增 IPC 通道**） |
| `skillsApi(route, options, query)` | `settings-page.js:4874-4897` | **HTTP 客户端的逐行模板**：`token` 查询参数 → `fetch(\`/api/skills${suffix}?…\`)` → 非 2xx 时优先取后端 `{ error, code }`。本阶段的 preview / commit 两个调用直接复用它（`options.body` 允许传 `File` / `ArrayBuffer`） |
| `setSkillManageHint` / `resetSkillManageHint` + `skillManageHintTimer` | `settings-page.js:4822 / 5289-5306` | **区级 inline hint 的既有单源**（`clearTimeout` 纪律 + 2 秒无条件复位）。本阶段**直接调用同一函数**，不新建 hint 实例、不新建 toast |
| `STATUS_TEXT` / `TIER_BADGE` / `PROMPT_OMITTED_CARD_NOTE`（`src/skill-picker-model.js:239 / 394 / 314`） | 状态文案单源 | 本阶段**不新增状态文案键**：导入不产生新的行尾状态（导入成功后技能即普通 `user` 技能，状态由 50 的链决定） |
| `LIMITS`（`ai-skills-manager.js:48-54`） | 限额单源 | **端点与前端零字面量**：预览里的限额对照数值一律取主进程回传值；本阶段**只允许加项、不得改既有数值** |
| `validateManagedSkillName`（`ai-skills-manager.js`） | 写入门校验器 | **改名的唯一校验器**（D-08 明文「一份校验器，不写第二份」）。渲染端的**内联**判据必须与它同判据同值域（经主进程回传的投影或直接复用同一实现），**不得另写一份正则** |

> ① `main.css:5602-5608` 是 `.settings-input-wrapper`（另一处 `.text-input` 作用域）；本表引用的是
> 白名单区那两段（`.whitelist-input-area`，`:8663-8677`），它是**同页 AI 分区**内最贴近的先例。

---

## Spacing Scale

声明值（**新增元素**的 `gap` / `padding` / `margin` 只允许取 4 的倍数；唯一例外通道是下方
Exceptions 的 **B 表** —— 偏离值必须逐条登记并附理由与既有先例）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 目录树容器与行内间隙（`.skill-import-tree { gap: 4px }` / `.skill-import-tree-row { gap: 4px }`）；脚本清单同款（`.skill-import-scripts { gap: 4px }`）；扫描栏内条目间隙（`.skill-import-scan-col { gap: 4px }`）；动作区上边距（`.skill-import-actions { margin-top: 4px }`，**照抄 50 的 `.skill-manage-confirm-actions`**）；`#skillManageConfirm` 的既有同款值 |
| sm | 8px | 区标题行的标题↔按钮间隙（`.skill-manage-header { gap: 8px }`）；弹框内每层容器的子元素间隙（`.skill-import-panel` / `.skill-import-preview` / `.skill-import-scan` / `.skill-import-ack` / `.skill-import-conflict` 的 `gap: 8px`）；字段行内标签↔值间隙（`.skill-import-field-row { gap: 8px }`）；输入行间隙（`.skill-import-field { gap: 8px }`）；单选行间隙（`.skill-import-radio-row { gap: 8px }`）；必勾行间隙（`.skill-import-ack-label { gap: 8px }`）；动作区按钮间隙（`.skill-import-actions { gap: 8px }`）；两栏左内边距（`.skill-import-scan-col { padding-left: 8px }` / `.skill-import-conflict { padding-left: 8px }`） |
| md | 16px | 区标题行的下外边距（`.skill-manage-header { margin-bottom: 16px }` —— **与既有 `.settings-group-title` 的 `margin-bottom: 16px` 同值**，视觉结果不变）；弹框宽度由 `.skill-import-modal { width: 560px }` 定，内边距复用 `.ai-modal` 的既有 `padding: 16px` |
| lg | 24px | 本阶段**未使用**（保留） |
| xl | 32px | 本阶段**未使用**（保留） |
| 2xl | 48px | 本阶段**未使用**（保留） |
| 3xl | 64px | 本阶段**未使用**（保留） |

**12px 亦在标内**（4 的倍数）：本阶段新增声明里 `12px` 只出现在 `.skill-import-field .text-input { padding: 0 12px }`
（**逐值照抄既有** `.whitelist-input-area .text-input`）与目录树缩进步长（`12px/层`，经 CSSOM 施加）。

> 本表的 Usage 列逐条对应 `## 结构与交互契约` 的「新增 CSS 声明清单」，可由命令机械复核
> （`grep -nE '\.(skill-manage-header|skill-import)[a-z-]*\s*\{' src/styles/main.css`）。

### Exceptions

**A. 存量继承值** —— 既有类的值，被复用或逐值照抄；允许继续存在，**不得新增同类偏离**：

| 既有类 / 属性 | 值 | 位置 | 处理 |
|--------------|-----|------|------|
| `.settings-group` | `padding: 16px 20px` / `margin-bottom: 12px` / `border-radius: 8px` | `main.css:3202-3208` | **不改** |
| `.settings-group-title` | `margin-bottom: 16px` / 14px / 600 | `main.css:3210-3215` | 类本体**不改**；本区标题行内由作用域覆盖 ② 归零（值 16px 由 `.skill-manage-header` 承担，几何结果逐值相同） |
| `.ai-modal` | **`gap: 10px`** / `padding: 16px` / `max-height: 80vh` | `main.css:5383-5394` | **不改** —— 弹框内层宿主的既有子元素间距。本阶段弹框的「标题 → 模式选择 → 面板 → 状态行 → 预览 → 必勾 → 冲突 → 动作区」**全部**落在它内部（与 `## 结构与交互契约` 的「元素顺序是契约」逐段同序），故 10px 在本阶段真实生效；它是存量值、非本阶段新增，按「存量继承」登记，本阶段**不新增**任何 10px |
| `.ai-modal-header h3` | 16px / 600 | `main.css:5402-5405` | **不改**（弹框标题；本页唯一 16px 用途，不进本阶段字号预算） |
| `.ai-memory-tabs` | `gap: 4px` / `border-bottom: 1px` / `margin-bottom: 16px` | `main.css:10389-10394` | **不改**（本阶段第二次复用，类本体零改动） |
| `.ai-memory-tab` | `padding: 8px 12px` / `font-size: 14px` / `border-bottom: 2px solid transparent` / `margin-bottom: -1px` | `main.css:10396-10406` | **不改**（同上） |
| `.ai-memory-tab.active` | `font-weight: 600` / `border-bottom-color: var(--accent-color)` | `main.css:10411-10415` | **不改**（只覆盖 `color`，见作用域覆盖 ①） |
| `.btn` + `.btn-sm` | **生效值：`font-size: 12px` / `padding: 4px 8px` / `height: 28px` / `border-radius: 6px`** | `main.css:913-918` + `939-943` + `1356-1360` + **`5645-5649`（最后一条 `.btn-sm`，`padding: 4px 8px` —— 它才是生效的 padding）** | **直接复用该既有组合**（本阶段全部五个按钮）。**有效值以最后一处声明为准**：`padding` 取 `:5645` 的 `4px 8px`，`height` 取 `:1356` 的 `28px` |
| `.whitelist-input-area .text-input` | `height: 40px` / `padding: 0 12px` / `border-radius: 8px` | `main.css:8663-8677` | 照抄值（本阶段两个输入框的几何）。⚠️ 其 `:focus { border-color: var(--accent-color); outline: none }` **不照抄**（补记 ⑤） |
| `.ai-modal-overlay` | `background: rgba(0, 0, 0, 0.6)` | `main.css:5361` | **不改**（遮罩压暗度；非文本对比不参与 1.4.3） |

**B. 本阶段新增声明中非 4 倍数的值 —— 恰 2 条，且都**不是间距值**（仅出现在边框宽度上）：

| 新增类 / 属性 | 值 | 位置 | 理由 | 既有先例 |
|--------------|-----|------|------|---------|
| `.skill-import-scan-col` / `.skill-import-conflict` | `border-left: 2px solid …` | 本阶段新增（CSS 块） | 高亮条：`border-left` 是**边框宽度**（不占 Spacing token 预算），2px 是「非文本边界」的可感知最小宽度（1px 在 12px 文字旁易被当作分隔线） | 仓内既有同款：`main.css:540` 的 `border-left: 2px solid var(--accent-color)`（既有高亮条用法） |
| `.skill-import-confirm` | `border: 1px solid var(--accent-color)` | 本阶段新增（CSS 块） | 强调按钮：全局 `button { border: none }`（`main.css:146`）⇒ 本阶段必须**新增**边框才能表达强调；1px 是边框最小值，且 `box-sizing: border-box`（`main.css:131`）+ `.btn-sm` 的定高 `28px` ⇒ **零布局位移** | 仓内既有同款：`.ai-switch { border: 1px solid var(--border-color) }`（`main.css:5112`） |

执行时若确需新间距值，**必须先补进本表**（附理由 + 既有先例）再落码 —— 契约与 CSS 块必须始终自洽。

无 44px 触控目标例外：本页面是桌面端（鼠标 + 键盘）设置页，无独立触控入口（沿 50 的同一判定）。
**本阶段也不新增任何滚动容器以外的尺寸约束**（弹框宽度 `560px` / `max-width: 94vw` 是**宽度**声明，
不进 Spacing token 预算，与 50 的 `.skill-manage-confirm { width: 420px; max-width: 94vw }` 同款）。

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px | 400 | 1.5 |
| Label | 11px | 400 | 1.4 |
| Heading | 13px | 600 | 1.4 |
| Display | 14px | 600 | 1.2 |
| Inherited（既有类，**本阶段不改声明**） | — | — | — |

**本阶段声明**：**4 个字号（11 / 12 / 13 / 14）、2 个字重（400 / 600）**。逐个用途：

- **Body 12px / 400 / 1.5** —— 目录树行、脚本清单路径、状态行、字段值、说明文案、
  description 原文、扫描结论条目、必勾标签、单选行、禁用原因文本、失败/成功文案、
  弹框正文与输入框内文字（输入框本身是既有 14px，见下方继承登记）
- **Label 11px / 400 / 1.4** —— **字段标签**（`技能名` / `落点` / `描述` / `目录` / `体积` / `脚本` /
  `扫描结论` / `allowed-tools`）与**计数**（`共 N 个文件 / M 个目录`、`共 N 个脚本`；
  `命中 N 条`）—— 与 50 的「元数据簇取 11px」同款判断：它们与来源徽标 / 诊断徽标同处
  「可扫读的次要信息」一档
- **Heading 13px / 600 / 1.4** —— **预览卡片的技能名**（等宽 + 600，与 48 面板行名
  `.slash-picker-name` 同款同档）
- **Display 14px / 600 / 1.2** —— **区标题**「技能管理」（复用既有 `.settings-group-title`，
  **继承登记**：本阶段零改动；其 `line-height` 未声明，由 UA 默认承担）

> **表末行与下表的既有类是「继承登记」而非本阶段声明**。以下既有类的字号/字重**不属于本阶段声明**，
> 也不得因此新增任何新类去复制它们：
>
> | 既有类 | 存量值 | 说明 |
> |--------|--------|------|
> | `.settings-group-title` | 14px / 600 | 区标题（本页唯一 14px 用途之一） |
> | `.ai-memory-tab` / `.ai-memory-tab.active` | 14px / 400 → 600 | 模式选择两个按钮（复用类的存量值，本阶段零改动） |
> | `.btn` / `.btn-sm` | 12px / **500** | 本阶段五个按钮的实际取值（500 **不计入**本阶段字重数） |
> | `.ai-modal-header h3` | 16px / 600 | 弹框标题 |
> | `.ai-modal` | 继承 `body` 的 16px 与 UA 默认行高 | 弹框容器不声明字号 |
> | `.setting-description` | 12px / 400（行高由 UA 承担） | 区说明（既有） |
> | `.skill-import-field .text-input` | 14px / 400 | 输入框内文字（逐值照抄 `.whitelist-input-area .text-input`） |
> | `.skill-manage-hint` / `-success` / `-danger` | 12px / 400 / 1.5 | 区级 inline hint（50 建，**零改动**） |

Exceptions：

- **本阶段不引入第 5 个字号**，也不引入第 3 个字重（**700 一律不得出现在本阶段新增的类上**；
  500 只作为既有 `.btn` 的继承值存在，不得写进本阶段新增声明）。
- **确认按钮的强调不用字号 / 不用主色填充**：`.skill-import-confirm` 只在既有 12px / 500 之上
  加 `font-weight: 600`（**600 在本阶段预算内**）+ 1px accent 边框。这是取舍的正面理由：
  字号提升会破坏同一行内两个按钮的基线一致性，而主色填充的白字实测 3.68:1 不达标。
- **字段标签取 11px 而非 12px**：与计数、来源徽标同处「元数据簇」；12px 会让标签与值（同为 12px）
  竞争注意力，失去「可扫读」的层级。
- **不用 13px 承载正文**：13px 在本阶段**只**给技能名一个用途（与 50 的组标题同档），
  避免与 12px 正文形成无意义的第三档。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary` — 暗 `#1a1a1a` / 亮 `#ffffff` | 设置页页面底（`.settings-content`）与遮罩下的内容（`.ai-modal-overlay` 的 `rgba(0,0,0,.6)` 是压暗层，不是新底色） |
| Secondary (30%) | `--bg-secondary` — 暗 `#2a2a2a` / 亮 `#f5f5f5`；次级 `--bg-tertiary` — 暗 `#3a3a3a` / 亮 `#e5e5e5` | **本阶段全部文字的生效底恒为 `--bg-secondary`**：`.settings-group` 卡片底（`main.css:3203`）与**弹框内层 `.ai-modal` 底**（`main.css:5384`）是**同一个不透明令牌** ⇒ 区文字与预览卡片文字落**在同一个底上**，本契约的对比度表因此只有一套底。`--bg-tertiary` 只作**输入框与按钮**的填充底（沿用既有 `.text-input` / `.btn-secondary`）；hover 底 `--bg-hover` — 暗 `#404040` / 亮 `#e0e0e0`（**仅按钮 hover**，本阶段不用于行） |
| Accent (10%) | `--accent-color` `#3B82F6` | 见下方 **Accent reserved for** 显式清单（**共四处** —— 三条既有/机制性的 + 一条本阶段新增的勾选框填充，且**没有一处是文字色**） |
| Warning / 注意 | `--skill-limit-text` — 暗 `#F59E0B` / 亮 `#92400E` | 启发式高亮条目文字；必勾提示与冲突提示文字；**两处高亮条的左边框**（非文本，2px） |
| Error | `--skill-error-text` — 暗 `#FCA5A5` / 亮 `#B91C1C` | **脚本清单标红**（路径文字）；失败状态行；改名校验失败内联文案；注入类扫描结论的拒绝原因 |
| Success | `--skill-success-text` — 暗 `#6EE7B7` / 亮 `#065F46` | 区级 inline hint 的导入成功文案（50 建的令牌，本阶段首次在**弹框关闭后**的成功路径上使用） |
| Destructive | `--danger-color` `#EF4444` | **本阶段不使用**（白字对其底 3.76:1、作文字色四档 3.81 / 2.76 / 3.45 / 2.85 全部不达标）。覆盖同名技能是**破坏性动作**，其危险语义由「冲突三选一 + 必勾 + 确认按钮」这套**结构**承担，不由红色承担 |
| **新增令牌** | **恰 0 个** | 见 `## Design System` 的理由段 |

### Accent reserved for（显式清单，非「所有可交互元素」）

1. **键盘焦点环**（统一登记为一条）：本阶段新增 `.skill-import-field .text-input:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px }`
   （作用域覆盖 ③）。同族还有**既有** `.skill-manage-section .ai-switch:focus-visible`（`main.css:10633`，
   50 建）与 `.ai-skill-content-box-header:focus-visible`（`main.css:5869-5872`）—— 两者在本阶段的新实例上
   **zero 命中**（弹框内无开关、无折叠块），列出仅为把「accent 的这一类用法」登记齐。
   > 本条沿用 50 对 `49-UI-REVIEW W3-01` 的追认口径：焦点环**不是** accent 背景、**不是**展开/折叠态边框。
2. **确认按钮的 1px 边框**（`.skill-import-confirm { border: 1px solid var(--accent-color) }`）——
   **非文本边界**，是本阶段唯一用 accent 表达「主行动」的地方。
3. **既有 `.ai-memory-tab.active` 的 `border-bottom-color`**（`main.css:10414`）—— 复用类的存量用法；
   本阶段的模式选择因此获得一条**非颜色冗余**的「当前项」指示（下边框 + `aria-pressed`）。
4. **必勾复选框的勾选态填充**（`.skill-import-ack-box { accent-color: var(--accent-color) }`，**本阶段新增**）——
   **非文本填充**：`accent-color` 只决定 UA 绘制勾选框时用的强调色，**不参与任何文字渲染**，也不构成
   背景板（「框」本身仍由 UA 用系统色绘制）。**这是本阶段唯一用 accent 做填充的地方**，与第 2 条（边框）、
   第 3 条（既有下边框）一样，都不承担「唯一状态指示」的职责 ⇒ **中性化替代**：删掉该声明即回落到
   UA 默认强调色（macOS = 系统蓝），**功能与可达性零损失** —— 勾选 / 未勾选的差异**另有文本冗余表达**
   （禁用原因文本的出现 / 消失 + 确认按钮由 `disabled` 变可用，见表 A-2 末行）⇒ 它是**可撤回的装饰性强化**，
   不是承重件。CSS 块内同步标了交叉引用（见 `## 结构与交互契约` 的 `.skill-import-ack-box` 注释）。
5. **显式排除**：`--bg-hover` 行高亮 / 按钮 hover / 状态文本 / **除第 4 项以外的任何填充色** —— **一律不用 accent**。
6. `.btn-primary`（accent 填充）**本阶段不使用** —— 白字对其底实测 **3.68:1 < 4.5**（12px 小字），
   见下方「禁用记录」。

### 对比度核算（WCAG 1.4.3；11px / 12px / 13px / 14px 全部属小字 ⇒ 硬要求 **≥ 4.5:1**）

**复算方法（第三人可逐值复现）**：相对亮度按 WCAG 2.x 定义
（`c/255` 后 `c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`，权重 `0.2126/0.7152/0.0722`），
对比度 `(L_light + 0.05) / (L_dark + 0.05)`，四位小数后**四舍五入到两位**。
全部输入 hex 逐字取自 `src/styles/main.css:7-39`（暗）与 `:41-71`（亮）两个主题块。
**本阶段的底只有两个**（见 `## Color` 第 2 行）：`--bg-secondary`（文字）与 `--bg-tertiary`（输入框/按钮内的文字）。

**表 A —— 常态底 `--bg-secondary` 的文字**（暗 `#2a2a2a` / 亮 `#f5f5f5`）：

| 元素（本阶段新增或首次用于弹框内） | 令牌 | 暗 · `#2a2a2a` | 亮 · `#f5f5f5` | 判定 |
|-----------------------------------|------|----------------|----------------|------|
| 技能名（13px / 600 等宽） | `--text-primary` | 12.60 | 15.96 | ✅ |
| 字段值、目录树**目录行**、description 原文、单选行文字、必勾标签 | `--text-primary` | 12.60 | 15.96 | ✅ |
| 字段标签、计数、状态行、说明文案、目录树**文件行**、禁用原因文本 | `--text-secondary` | **5.49** | **5.27** | ✅ |
| **脚本清单路径（标红）** | `--skill-error-text` | **7.56** | **5.93** | ✅ 双主题达标（本契约要求的目标值即此，不得下探） |
| **扫描结论高亮条目**、必勾提示、冲突提示 | `--skill-limit-text` | **6.68** | **6.50** | ✅ 双主题达标 |
| 改名校验失败内联文案、失败状态行、注入类拒绝原因 | `--skill-error-text` | 7.56 | 5.93 | ✅ |
| 区级成功 hint | `--skill-success-text` | 9.42 | 7.05 | ✅ |

**表 A-2 —— 非文本对比（1.4.11，要求 ≥ 3:1）**：

| 元素 | 取值 | 暗 · 对 `#2a2a2a` | 亮 · 对 `#f5f5f5` | 判定 |
|------|------|-------------------|-------------------|------|
| **两处高亮条的左边框**（扫描启发式栏 / 冲突区） | `--skill-limit-text` 2px | 6.68 | 6.50 | ✅ |
| **确认按钮的 accent 边框**（对外部邻色 = 弹框底） | `--accent-color` 1px | **3.90** | **3.37** | ✅（两者均 ≥ 3:1） |
| 同上，对**内侧**填充（`--bg-tertiary`，**不参与 1.4.11 判定**，如实列出供复算） | `--accent-color` | 3.09 | 2.92 | 记录 |
| 模式选择的「当前项」指示（既有 `.ai-memory-tab.active` 下边框，2px） | `--accent-color` | 3.90 | 3.37 | ✅ |
| 必勾复选框的勾选态 | `accent-color: var(--accent-color)` 填充 + UA 对勾 | 依赖 UA 绘制 | 依赖 UA 绘制 | ⚠️ **不单靠颜色**：勾选状态另由「禁用原因文本消失 + 确认按钮由 `disabled` 变可用」**冗余表达**（满足 1.4.1「不以颜色为唯一传达手段」），故本项不作单点对比度判定 |

**表 B —— 填充底为 `--bg-tertiary` 的元素（输入框 / 本阶段全部六个按钮）**：

| 元素 | 文字令牌 | 暗 · 常态 `#3a3a3a` | 暗 · hover `#404040` | 亮 · 常态 `#e5e5e5` | 亮 · hover `#e0e0e0` | 判定 |
|------|---------|---------------------|----------------------|---------------------|----------------------|------|
| `导入技能` / `选择 zip 文件` / `获取预览` / `展开全部` / `收起` / `取消` | `--text-primary` | 9.98 | 9.10 | 13.82 | 13.18 | ✅ 全档 |
| `导入`（确认按钮，同一 `.btn.btn-secondary.btn-sm` + 1px accent 边框） | `--text-primary` | 9.98 | 9.10 | 13.82 | 13.18 | ✅ 全档（强调由**边框**承担，非文字色） |
| 两个输入框内的文字（URL / 新的技能名） | `--text-primary` | 9.98 | —（无 hover 底） | 13.82 | — | ✅ |
| 禁用的按钮（`.btn:disabled { opacity: .3; cursor: not-allowed; pointer-events: none }`，`main.css:1466-1470`） | 继承 | — | — | — | — | ✅ **豁免**：1.4.3 对「非活动 UI 组件的一部分」明文无对比度要求。**代价已登记**：`pointer-events: none` 使 `title` 无法触发 ⇒ **禁用原因必须上屏**（见 `## 结构与交互契约` 的禁用态契约） |

**表 C —— 禁用记录（不得使用 / 不修不声称已修）**：

| 记录 | 取值 | 暗 · 常态 | 暗 · hover | 亮 · 常态 | 亮 · hover | 判定 |
|------|------|-----------|------------|-----------|------------|------|
| `.btn-primary`（白字 on `--accent-color`） | `#fff` / `#3B82F6` | **3.68 ❌** | — | **3.68 ❌** | — | ❌ ⇒ 本阶段**不使用**（入口按钮与确认按钮都不用主色填充） |
| `.btn-danger`（白 on `--danger-color`） | `#fff` / `#EF4444` | **3.76 ❌** | 4.83 | **3.76 ❌** | 4.83 | ❌ ⇒ 本阶段不使用 |
| `--danger-color` 作文字 | on `--bg-secondary` / `--bg-hover` | 3.81 ❌ | 2.76 ❌ | 3.45 ❌ | 2.85 ❌ | ❌ ⇒ 不得作文字色 |
| `--accent-color` 作文字（**既有 `.ai-memory-tab.active`**） | on `--bg-secondary` | **3.90 ❌** | — | **3.37 ❌** | — | ❌ **既有（43）缺陷**：本页由作用域覆盖 ① 修复为 `--text-primary`；**AI 记忆区的三个 tab 不修、不声称已修**（补记 ④） |
| `--text-muted` 作文字 | on `--bg-secondary` | 2.97 ❌ | 2.14 ❌ | 2.33 ❌ | 1.92 ❌ | ❌ ⇒ 本阶段**不得**用它（活动文字一律 `--text-primary` / `--text-secondary`） |
| **输入框的既有焦点指示器**：`.whitelist-input-area .text-input:focus { border-color: var(--accent-color); outline: none }`（`main.css:8674-8677`） | `--accent-color` 1px 边框 on `--bg-tertiary` | **3.09 ❌** | — | **2.92 ❌** | — | ❌（< 3:1 非文本阈值）**既有缺陷**（同款还见 `.rules-add-form .text-input:focus` `:3286-3289` / `.devmode-domain-input .text-input:focus` `:3414-3417` / `.settings-select:focus` `:3238-3241`）⇒ **本阶段不修、不声称已修**（补记 ⑤）；本阶段**新增**输入框不照抄 `outline: none`，改走作用域覆盖 ③ |
| **`.btn-secondary` 与宿主底的分界**（底色 `--bg-tertiary` on 卡片底 `--bg-secondary`） | `#3a3a3a` vs `#2a2a2a` / `#e5e5e5` vs `#f5f5f5` | **1.26 ❌** | — | **1.16 ❌** | — | ❌（< 3:1，1.4.11 的组件边界）**既有页面级事实** —— 本页全部 `.btn-secondary`（含 50 的 9 处实例与 50 弹框的两个按钮）都如此 ⇒ **不修、不声称已修**（补记 ⑥）。本阶段的做法：**确认按钮**加 accent 边框把它自己提到 3.90 / 3.37（≥ 3:1）；`取消` 保持既有处置（与 50 弹框两个按钮同款，不做单向美化造成同排参差） |

### 前置修复 / 作用域覆盖（**三条**，全部以 `.skill-manage-section` 为前缀 ⇒ 48/49 的实名宿主零变化）

| # | 处置 | 位置 | 为什么本阶段必须落 |
|---|------|------|-------------------|
| ① | **scope 覆盖**：`.skill-manage-section .ai-memory-tab.active { color: var(--text-primary); }` | 新增规则（新增作用域前缀） | 模式选择的第二个按钮（`.active` 态）的**存量**文字色是 `--accent-color`（`main.css:10412`），实测**暗 3.90 / 亮 3.37 < 4.5:1**（14px 非大字）。本页是 `.ai-memory-tab` 的**第 2 个宿主**（第 1 个是 AI 记忆区，`settings.html:490-493`）⇒ 必须在其 hover/active 态达标。**作用域收敛的理由**：AI 记忆区三个 tab 行为**零变化** —— 本阶段不重设计既有面（49 收尾的爆炸半径纪律，与 50 前置修复 ① / ③ 同款形状）。几何值（`padding` / `font-size` / `border-bottom`）**一字未改** ⇒ 不产生同排参差 |
| ② | **scope 覆盖**：`.skill-manage-header .settings-group-title { margin-bottom: 0; }` | 新增规则（新增作用域前缀） | 标题行变成 `display:flex` 后，标题自身的 `margin-bottom: 16px` 会被计入 flex 行高，使右侧按钮相对标题文字**偏心**（`align-items:center` 会把 16px 也算进交叉轴中心）。把 16px 移到行容器上（`.skill-manage-header { margin-bottom: 16px }`）后**几何结果与改动前逐值相同**，且**本区以外所有 `.settings-group-title` 零变化** |
| ③ | **新增规则**：`.skill-import-field .text-input:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }` | 新增规则（新类作用域） | 输入框几何逐值照抄 `.whitelist-input-area .text-input`，但**其 `:focus` 指示器不达标**（`outline: none` + 1px accent 边框 ⇒ 暗 3.09 / 亮 2.92 < 3:1）。本阶段改走 50 已确立的焦点环形状（`outline: 2px solid var(--accent-color)` + `outline-offset: 2px`，accent 对 `--bg-secondary` 3.90 / 3.37 ≥ 3:1）。**不修既有输入框**（改它会命中 AI Bash 白名单区 / 规则区 / 开发者模式区，属跨阶段视觉决策） |

### 补记（**四条**，均为「不修、不声称已修」的既有事实；与 `TD-48-01` 同款处置：不扩大缺口 + 如实挂账）

| # | 记录 | 位置 | 处置 |
|---|------|------|------|
| ④ | `.ai-memory-tab.active` 的 `--accent-color` 文字在 **AI 记忆区**仍不达标（暗 3.90 / 亮 3.37） | `main.css:10411-10415` + `settings.html:490-493` | 本页只覆盖自己的实例（①）。修类本体会改动本阶段以外的实名宿主 ⇒ **须单独立项** |
| ⑤ | `.text-input:focus` / `.settings-select:focus` 的 `outline: none` + 1px accent 边框焦点指示器（≤ 3.09:1） | `main.css:3238-3241` / `:3286-3289` / `:3414-3417` / `:8674-8677` | 页面级既有模式（4 处以上）。修它 = 跨区域视觉决策 ⇒ **须单独立项**。本阶段只保证**新增**输入框不复制该形态（③） |
| ⑥ | `.btn-secondary` 的填充与卡片底分界仅 1.16–1.26:1（< 3:1，1.4.11） | `main.css:930-933` + `.settings-group` `:3203` | 页面级既有事实（50 的全部按钮实例亦然）。改 `.btn-secondary` 底色或加统一边框会改动全页按钮外观 ⇒ **须单独立项** |
| ⑦ | 设置页 4 个既有多候选弹框缺 `role="dialog"`、且 2 个 `.ai-modal-overlay` 遮罩弹框无焦点陷阱 | `settings.html:371` / `:402`（遮罩式）与 `:792` / `:806`（原生 `<dialog class="modal">`，走 `showModal()` —— **这两个自带平台焦点陷阱**） | 本阶段**沿用 50 的「不做焦点陷阱」决定**并按 50 的登记口径如实挂账；本阶段新增弹框另加 `role="dialog"` + `aria-labelledby`（零机制成本），**但不写 `aria-modal`**（理由见 `## 结构与交互契约` 的键盘契约）。既有的 4 个弹框**零变化** |

### 须在真实渲染下取数的读数（UAT 驱动必须断言；不得只信上表算值）

1. 两套主题下，预览卡片内 `.skill-import-script-path`（`--skill-error-text`）与
   `.skill-import-scan-item`（`--skill-limit-text`）的**实际渲染**对比度 ≥ 4.5:1
   —— 用 `getComputedStyle` 取 `color` 与**逐级回溯后的有效底色**，按 WCAG 公式复算。
2. `.skill-import-confirm` 的 accent 边框对**外部邻色** ≥ 3:1。
3. 必勾复选框的「勾选 / 未勾选」差异**同时**体现在颜色与文本上（禁用原因文本的出现/消失 +
   按钮 `disabled` 翻转）—— 断言「不单以颜色传达状态」。
4. 深色主题下 UA 原生 checkbox 的未勾选态可辨识（本页既有裸 checkbox 的同一宿主同一底，
   见 `settings.html:160 / 674 / 765`）—— 若实测不可辨识，**不得**自行引入 `appearance: none` 重绘
   （那属新的视觉机制），应回到本契约修订。

---

## Copywriting Contract

### 全部新增 / 复用的用户可见文案（唯一权威清单）

| # | 位置 | 文案 | 来源 |
|---|------|------|------|
| 1 | 入口按钮 | `导入技能` | 本契约（D-18 的入口） |
| 2 | 弹框标题 | `导入技能` | 本契约 |
| 3 | 模式按钮 | `本地上传` / `网络地址` | 本契约（D-18 的两个 tab，措辞取 D-18 原文） |
| 4 | 本地上传说明 | `选择技能的 zip 压缩包。包内必须恰好包含一个技能（一个 SKILL.md 所在的目录）。` | 本契约（D-06「恰好一个技能根」的用户可见投影；`SKILL.md` 以 `<code>` 呈现） |
| 5 | 选择文件按钮 | `选择 zip 文件` | 本契约（`<input type="file">` 的 visible 触发器） |
| 6 | 未选文件的空态（**仅本地上传模式**） | `尚未选择 zip 文件` | 本契约（E4 空态；**落点 = 弹框内状态行**，见状态机 `idle·本地` 行。⚠️ **网络地址模式的空态不使用本条** —— 它由 #7 的地址形态说明 + 禁用原因 `请输入网络地址` 承担，见状态机 `idle·网络` 行） |
| 7 | 网络地址说明 | `粘贴技能包地址：GitHub 仓库或子目录（github.com/<组织>/<仓库>/tree/<分支>/<路径>）、raw.githubusercontent.com 上的 SKILL.md 直链。地址必须为 https。` | 本契约（D-06 的三种 URL 形态 + CR-8 的「必须自己补 tree/<ref>/<path>」提示；host 以 `<code>` 呈现） |
| 8 | 获取预览按钮 | `获取预览` | 本契约 |
| 9 | 在途状态行 | `正在读取技能包…` / `正在从网络地址下载…` / `正在写入技能，请稍候…` | 本契约（三条定长；沿设置页 `加载中…` 的单行纯文本先例，**零 spinner、零骨架屏**） |
| 10 | 预览就绪状态行 | `预览已就绪，确认后才会写入。` | 本契约（两阶段语义的用户可见承诺） |
| 11 | 预览字段标签 | `技能名` / `落点` / `描述` / `目录` / `体积` / `脚本` / `扫描结论` / `allowed-tools` | 本契约（D-13 的信息集；技术标识保留原文） |
| 12 | 落点说明 | `将写入 skills/<name>/` | 本契约（D-13 原文；`<name>` 是**不可信字符串**，经 DOM API 注入） |
| 13 | 目录计数 / 截断 | `共 {N} 个文件 / {M} 个目录` + 截断时追加 `（当前显示前 {K} 项）`；开关 `展开全部` / `收起` | 本契约（D-13「禁静默截断」；`{N}`/`{M}`/`{K}` 均为数字） |
| 14 | 脚本计数 | `共 {N} 个脚本` | 本契约 |
| 15 | 脚本清单说明（**恒显**） | `技能不构成额外权限 —— 这些脚本受既有 bash 三档策略与确认卡片约束。` | 本契约（`docs/product/ai-agent-workspace.md` §七 第 6 条同口径） |
| 16 | 脚本清单为空 | **不渲染该块**（不写「未检测到脚本」） | 本契约（E11 的 dismissed 理由） |
| 17 | 扫描结论栏头 | `注入类模式` / `技能域启发式` | 本契约（D-12 的两栏） |
| 18 | 注入类通过 | `未命中` | 本契约（命中即整包拒绝 ⇒ 预览内这一栏只可能是肯定表述） |
| 19 | 启发式无命中 | `未命中技能域启发式模式` | 本契约 |
| 20 | 启发式栏诚实边界（**恒显**） | `启发式检测只降低概率，不是安全边界。` | 本契约（D-12 明文要求写进文档的同一句） |
| 21 | 高亮提示 | `以下内容命中技能域启发式模式，导入前请逐条确认：` | 本契约（D-12 的「显著高亮」文字面） |
| 22 | 必勾标签 | `我已了解以上风险` | 本契约（D-12 的必勾项文案） |
| 23 | 冲突提示 | `已存在同名用户技能「{name}」。` | 本契约（D-08 的「三选一」前提陈述） |
| 24 | 冲突三选一 | `覆盖` / `改名` / `取消` | **D-08 原文**（三选一的选项名） |
| 25 | 改名说明（选中「改名」时恒显） | `覆盖会把 skills/{name}/ 整个目录先备份、写入失败时自动恢复；改名不占同名技能，但会新建一个技能（计入数量上限）。` | 本契约（D-09 备份/回滚 + D-11「覆盖豁免 / 改名计入」的用户可见投影） |
| 26 | 改名字段标签 | `新的技能名` | 本契约 |
| 27 | 改名输入框 placeholder | `小写字母、数字与连字符` | 本契约（`validateManagedSkillName` 值域的用户可见投影，**不含 64 字符上限数值** —— 上限由校验器拒绝时给出） |
| 28 | managed 同名提示（**不提供覆盖**） | `已存在同名 AI 自建技能「{name}」，导入后它将被永久遮蔽。` | 本契约（D-08 第三档 + 46 D-06 的遮蔽语义；可改名 / 可取消） |
| 29 | 与内置同名（**拒绝导入**） | `「{name}」是内置技能名，受保护，无法导入。请改用其它名称。` | 本契约（D-08 第一档 / SEC-07） |
| 30 | 多技能 / 零技能根拒绝 | `该地址包含 {N} 个技能，请改用指向具体技能目录的地址（例如 github.com/<组织>/<仓库>/tree/<分支>/<路径>）。` / `未在包内找到技能（缺少 SKILL.md）。` | 本契约（D-06 + CR-7 / CR-8；`{N}` 为实测根数） |
| 31 | 数量上限拒绝 | `用户技能数量已达上限（{N}），请先卸载不再需要的技能。` | 本契约（D-11；`{N}` **取主进程回传的 `limits`，前端零字面量**） |
| 32 | 预览过期 | `预览已过期，请重新选择文件。` | 本契约（D-02 的 `import_expired` 类码文案） |
| 33 | `allowed-tools` 缺失 | **整行不渲染** | 本契约（宁缺勿猜，沿 49「表外跳过」同款） |
| 34 | `allowed-tools` 解析失败 | 值渲染为 `（无法解析）`（**行仍渲染**，不当成缺失） | 本契约（禁止静默失败） |
| 35 | `allowed-tools` 免责标注（**恒与值同排**） | `本字段在当前运行时不被强制，仅供参考。` | **O3 裁决原文** + REQUIREMENTS 的 Out of Scope（`docs/product/ai-skills.md` §六 第 1 条同口径） |
| 36 | 预览诚实边界（**恒显**） | `以上结论由启发式检测与限额判据得出，不代表该技能是安全的。` | 本契约（D-13 的诚实边界） |
| 37 | 弹框按钮 | `取消` / `导入`（冲突项选中「取消」时，确认按钮文案切 `关闭弹框`） | 本契约（见下方「确认按钮文案的二元表」） |
| 38 | 导入成功（区级 hint） | `已导入「{name}」` | 本契约（D-18 / D-19 的成功出口） |
| 39 | 体积对照 | `解压后合计 {X} · 单文件最大 {Y}（限额：SKILL.md {A} / 累计 {B}）` | 本契约（D-13；`{A}`/`{B}` **取主进程回传值**，前端零字面量；`SKILL.md` 以 `<code>` 呈现） |
| 40 | 禁用原因（见下方禁用态契约） | `请输入网络地址` / `请先选择 zip 文件` / `请先勾选「我已了解以上风险」` / `请选择覆盖、改名或取消` / `请输入新的技能名` / `正在处理，请稍候…` | 本契约（**禁用按钮不可聚焦、`title` 也不显示** ⇒ 原因必须上屏） |

### 确认按钮文案的二元表（单一数据源，不得散落成 if 分支）

| 条件 | 确认按钮文案 |
|------|-------------|
| 无冲突，或冲突项选中「覆盖」/「改名」 | `导入` |
| 冲突项选中「取消」 | `关闭弹框` |

- 取值只有两个、都取自本表；**不得**在渲染代码里再写一份字面量。
- **为什么「取消」是单选组的第三项而不是只靠弹框的取消按钮**：D-08 锁定「三选一」，
  而把它做成「点了等于关闭」的第三项会出现一个**必然死路**的确认按钮（点击无动作）；
  故取「确认按钮随选择切文案」—— 点击语义恒为「执行当前选择」，
  「取消」选择的执行结果就是**不落盘并关闭**（`取消` 按钮本身的行为不变）。

### 失败文案映射表（按服务端回传的 `code`，前端**不解析 `message`**）

> 契约面：`/api/skills/*` 的业务错误以 `{ error, code }` 返回（HTTP 状态沿既有 `/api/*` 范式）。
> **落点**：弹框打开期间的失败一律进**弹框内状态行**（`#skillImportStatus`，E6）；
> 弹框关闭后的结果进**区级 inline hint**（E18，复用 `setSkillManageHint`）。
> **不得**把弹框打开期间的失败写到区级 hint（被遮罩挡住 = 用户看不到 = 静默失败）。

| `code` | 触发场景 | 用户可见文案（弹框内状态行 / 区级 hint） |
|--------|---------|-----------------------------------------|
| `import_expired` | commit 命中已过期的 `importId`（D-02 的 TTL） | `预览已过期，请重新选择文件。`（**并回到「未选包」态**：清预览、清冲突选择、保留模式与输入法） |
| `unsupported_url` | URL 形态不受支持（含 CR-1b 的 `api.github.com`） | `该地址不受支持，请改用 GitHub 仓库 / 子目录地址或 SKILL.md 直链。` |
| `unsupported_zip64` | 条目缺 zip64 extra field 却声明 `0xFFFFFFFF`（CR-6 ③） | `压缩包格式不受支持（zip64），请重新打包后重试。` |
| `multi_skill` / `no_skill` 类 | 0 个或多于 1 个技能根（D-06） | 见上表 #30 两条（**逐字取用，不在本表重写**） |
| `seeded_conflict` 类 | 与内置同名（SEC-07） | 见上表 #29（**逐字取用**） |
| `limit_exceeded` 类 | 六类限额命中（单 entry / 累计 / entry 数 / 压缩比 / 深度 / `SKILL.md` 字节） | 后端 `error` 原文（**必须含「哪个限额 + 当前值」**，D-11 / USER-08 明文）—— 前端不另造文案 |
| `invalid_name` | 改名的 `name` 不合法（复用 `validateManagedSkillName` 的拒绝原因） | 输入框下方 inline danger 文案（**就近**，不放状态行） |
| `BODY_TOO_LARGE` | 请求体超限（`readRawBody` 的 413 兜底） | `请求体超过上限，导入未执行。` |
| 表外 / 缺失 / `unknown` | 沙箱失败等 | `导入失败：{后端 error 原文}`（取不到则 `导入失败，请重试。`） |

**纪律**：

- **闭合白名单**：表外 `code` **不**回落到 `undefined` —— 统一走最后一行兜底文案。
- **完整码表待回填**：新增的导入码集合由 plan 期在**独立常量 `IMPORT_SKILL_ERROR`**（CR-3：**不得**并入
  被 11 键锁死的 `MANAGE_SKILL_ERROR`）里落定；**落定后必须把每个码回填进本表**，
  且本表是 `src/settings-page.js` 里的**闭合白名单表**（第二消费者出现时须提升为单源，
  沿 50 的同一纪律）。**未回填的码不得上线**（表外一律走兜底文案本身是允许的，但「有码无文案」会丢掉可操作原因）。
- **不解析 `message`**：前端只按 `code` 查表（49 / 50 同款纪律）。
- **不静默失败**（SKILL-06 / P12 / USER-08）：每条拒绝路径都必须有码 + 可读原因；
  **导入落盘后必须回读验证**（D-10），验证失败按上表兜底文案 + 后端 `error` 原文呈现，并回滚。
- **不回显被拒内容原文**：拒绝原因里**不渲染**被拒条目名 / 被拒正文片段（沿 49 的既有纪律）。
  唯一例外是**预览卡片**（它就是给用户看包内容的），且其渲染全部走 DOM API + 显示前净化。

### 空态 / 错误态（模板要求的三行）

| Element | Copy |
|---------|------|
| Empty state heading | **本阶段的空态没有独立标题行**，也**不新建空态容器**：**本地上传**模式的空态由**弹框内状态行的单行文本**承载（#6 `尚未选择 zip 文件`，见状态机 `idle·本地` 行）；面板内的 #4 是**包形态说明**（`p.skill-import-note`，恒渲染），不承担空态文案。**网络地址**模式的空态**不写进状态行**（该行留空并 CSSOM `display:none`），由面板内 #7 的地址形态说明 + 动作区的禁用原因 `请输入网络地址` 共同承担（E5 已如此建模）。预览区在未就绪时不渲染（`display:none`，不占位）。理由：这是设置页既有的「单行纯文本」加载/空态范式（`加载中…` / `0 / 0`），本阶段不新建空态容器 |
| Empty state body | 见上表 #4 / #6 / #7 —— 每态一句「现状 + 下一步」；**URL 模式的空态**由 #7 的地址形态说明（面板内）+ 禁用原因 `请输入网络地址`（动作区）共同承担 |
| Error state | **两种落点**：① 弹框打开期间 ⇒ 弹框内状态行（E6）danger（`--skill-error-text`），按上表 `code` 查表，**不清空用户已选的文件 / 已填的 URL / 已勾的必勾项**（除 `import_expired` 外）；② 弹框关闭后 ⇒ 区级 inline hint（E18，`setSkillManageHint` + 2 秒无条件复位 + `clearTimeout` 纪律） |
| Destructive confirmation | **覆盖同名技能**是本阶段唯一的破坏性动作。**确认面 = 四个部分（不是二次弹框）**：冲突提示句 #23 + 三选一 #24（选中「覆盖」）+ 后果说明 #25（**必须写清「先备份、失败自动恢复」** —— D-09 的回滚是用户可见承诺，不写用户就不知道可以反悔）+ 必勾 #22（命中启发式时）。**要素枚举而非视觉序**：这四处都落在动作区正上方（布局序 = 预览 → 必勾 → 冲突 → 禁用原因 → 动作区，与「元素顺序是契约」一致）；命中启发式时勾选是**另一条**独立的门（见禁用态契约情形 2/4）。**不新建第二层确认弹框** |

### 文案纪律（硬要求）

- 全部**新增** UI 文案为**简体中文**；技术标识（技能 `name`、`skills/<name>/`、`SKILL.md`、
  `github.com/...`、`raw.githubusercontent.com`、`allowed-tools`、`zip64`、`realm_*` 诊断码、
  错误码字面量）**保留原文**，并以 `<code>` 呈现（**静态字面量才允许走 markup 直写**，见注入纪律）。
- **引用单源，不得在本阶段写第二份**：区级 hint 走 `setSkillManageHint`；三档徽标 / 状态标注走
  `TIER_BADGE` / `STATUS_TEXT`（本阶段不使用，故零改动）；限额数值走主进程回传；
  `allowed-tools` 免责标注与 #15 的「不构成额外权限」是**跨文档同口径**的定长串，落
  `src/settings-page.js` 的闭合白名单表即可（一旦出现第二个消费者必须提升到 `src/skill-picker-model.js`）。
- **不在设置页写任何限额数值**（`64 KiB` / `32 MiB` / `50` / `2000` / `100:1` / `12` 等）——
  限额一律取主进程回传值（45/46 建立的「端点与前端零字面量」纪律；D-11 的嵌套深度口径由 CR-4 定为
  「按技能根相对计、≥ 12」，该数值必须在主进程侧定义并回传）。
- **诚实边界必须上屏**（不是只写进文档）：#20（启发式非安全边界）、#36（不代表安全）、#35（`allowed-tools` 不被强制）、
  #15（脚本不构成额外权限）。这四条**恒显**，不得折叠、不得省略、不得只在 tooltip 里。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| （无） | — | not applicable —— 项目未初始化 shadcn（无 `components.json`），不消费任何 registry，无第三方 block 需要 vetting |

---

## 结构与交互契约

**落点**：`src/settings.html`（DOM）+ `src/settings-page.js`（渲染 / 交互）+ `src/styles/main.css`（样式）。
**插入位置**：① 区标题行与入口按钮插入 `src/settings.html:536-537`（`div.settings-group.skill-manage-section` 的开头，
包住既有 `h2.settings-group-title`）；② 导入弹框插入该区的**末尾**（`#skillManageConfirm` 之后，见 `:568`）；
③ 脚本引入：**不新增任何 `<script>`**（本阶段零新增前端文件）。

### DOM 骨架

```
div.settings-group.skill-manage-section                              ← 既有（50）
  ├─ div.skill-manage-header                                          ← 新增：标题行（作用域覆盖 ②）
  │    ├─ h2.settings-group-title                                    技能管理（既有类）
  │    └─ button#skillImportOpen.btn.btn-secondary.btn-sm            导入技能（**不是** .btn-primary，见 Color 表 C）
  ├─ p.setting-description …（既有三段，零改动）
  ├─ div#skillManageSummary / #skillManageState / #skillManageGroups / p#skillManageHint   ← 既有（50，零改动）
  ├─ div#skillManageConfirm.ai-modal-overlay …                        ← 既有（50，零改动）
  └─ div#skillImportModal.ai-modal-overlay                            ← 新增：导入弹框（初始隐藏走既有 CSS 类）
       └─ div.ai-modal.skill-import-modal[role="dialog"][aria-labelledby="skillImportTitle"]
            ├─ div.ai-modal-header > h3#skillImportTitle              导入技能
            ├─ div.ai-memory-tabs[role="group"][aria-label="导入方式"] ← **复用 50 的类**（第 2 个宿主）
            │    ├─ button.ai-memory-tab[aria-pressed="true"]         本地上传
            │    └─ button.ai-memory-tab[aria-pressed="false"]        网络地址
            ├─ div#skillImportPanelLocal.skill-import-panel.active     本地上传面板
            │    ├─ p.skill-import-note                                包形态说明（#4）
            │    ├─ input#skillImportFile.skill-import-file-input[type=file][accept=".zip,application/zip"]
            │    └─ button#skillImportPick.btn.btn-secondary.btn-sm    选择 zip 文件（转调 input.click()）
            ├─ div#skillImportPanelUrl.skill-import-panel              网络地址面板
            │    ├─ p.skill-import-note                                地址形态说明（#7）
            │    └─ div.skill-import-field
            │         ├─ input#skillImportUrl.text-input[type=url]     地址
            │         └─ button#skillImportFetch.btn.btn-secondary.btn-sm   获取预览
            ├─ p#skillImportStatus.skill-import-status[role="status"][aria-live="polite"]   ← E6（兼 AT 播报）
            ├─ div#skillImportPreview.skill-import-preview[tabindex="0"]  预览卡片（**唯一滚动容器** + 键盘可达停靠点，未就绪 display:none）
            │    ├─ div.skill-import-field-row   技能名 / 落点（#11 #12）
            │    ├─ div.skill-import-field-row   描述（**原文**，`white-space:pre-wrap`）
            │    ├─ div.skill-import-field-row   目录 + 「共 N 个文件 / M 个目录」+ button 展开全部/收起
            │    │    └─ div.skill-import-tree > div.skill-import-tree-row[-dir|-file] × ≤N
            │    ├─ div.skill-import-field-row   体积（累计 / 单文件最大 / 限额对照）
            │    ├─ div.skill-import-scripts     脚本清单（标红）+ 计数 + button 展开全部/收起 + p.skill-import-note（#15）
            │    ├─ div.skill-import-scan        扫描结论两栏（col / col-heuristic）
            │    ├─ div.skill-import-field-row   allowed-tools 值 + 免责标注（**恒同排**）
            │    └─ p.skill-import-note          预览诚实边界（#36，**恒显**）
            ├─ div#skillImportAck.skill-import-ack                      必勾风险确认（条件渲染；**恒在预览之后、冲突之前**）
            │    ├─ p.skill-import-ack-note      高亮提示（#21）
            │    └─ label.skill-import-ack-label > input[type=checkbox].skill-import-ack-box + 「我已了解以上风险」
            ├─ div#skillImportConflict.skill-import-conflict            冲突三选一（条件渲染；**恒在必勾之后、禁用原因之前**）
            │    ├─ p.skill-import-ack-note      冲突提示（#23）
            │    ├─ div.skill-import-radio-row × 3                      覆盖 / 改名 / 取消（**默认都未选中**）
            │    └─ div.skill-import-field       新的技能名（仅选中「改名」时渲染）
            ├─ p#skillImportGate.skill-import-gate                      禁用原因的**可见文本**（空时 CSSOM display:none）
            └─ div.skill-import-actions
                 ├─ button#skillImportCancel.btn.btn-secondary.btn-sm   取消
                 └─ button#skillImportConfirm.btn.btn-secondary.btn-sm.skill-import-confirm[disabled]   导入 / 关闭弹框
```

**元素顺序是契约**（不得调换）：模式选择 → 当前面板 → 状态行 → 预览 → 必勾 → 冲突 → 禁用原因 → 动作区。
把**必勾与冲突放在预览之后、按钮之前**是刻意的：用户必须先看完预览才能读到风险与冲突选择，
且两者都紧邻动作区（「刚读完的条件就在按钮上面」）。
**必勾在冲突之前**同样刻意：必勾是「我知道这包可能有害」的总括确认，冲突是「这个包要落到哪」的覆盖决策；
勾选是**先于**落盘方式的元级确认，故它排在更靠近预览的位置（离它要确认的内容更近）。

> **本顺序的自查（改完后逐处回读）**：本文件内在 **4 处**声明该元素的先后，全部要求同序 ——
> ① 本段；② 上方 DOM 骨架（`#skillImportAck` 在 `#skillImportConflict` **之前**）；
> ③ 状态机表的列序（状态行 → 预览区 → 必勾区 → 冲突区 → 动作区）；
> ④ 键盘契约的 Tab 序（… → 必勾复选框 → 冲突 3 个 radio → 改名输入框 → 取消 → 确认）。
> 另有两处**刻意不构成顺序声明**：`## Spacing Scale` 的 `.ai-modal` 行只列「正文段落全集」（附「逐段同序」标注），
> Copywriting 的 Destructive confirmation 行只做**要素枚举**（已显式写明「要素枚举而非视觉序」）。
> 元素清单（UI Considerations 的 E14 → E15）与状态机列序同向。

### 状态机（`#skillImportModal` 的唯一权威状态表）

| 状态 | 触发 | 状态行 | 预览区 | 必勾区 | 冲突区 | 动作区 |
|------|------|--------|--------|--------|--------|--------|
| **idle·本地** | 弹框打开 / 切到本地上传 | `尚未选择 zip 文件`（中性色 `--text-secondary`）= **#6 的空态** | `display:none` | 不渲染 | 不渲染 | 取消可用；确认 `disabled`，原因 `请先选择 zip 文件` |
| **idle·网络** | 切到网络地址 | **空**（CSSOM `display:none`，不占位） | `display:none` | 不渲染 | 不渲染 | 取消可用；确认 `disabled`，原因 `请输入网络地址` |
| **在途·读取** | zip 文件 `change` | `正在读取技能包…`（中性色） | 不渲染 | 不渲染 | 不渲染 | **双 `disabled`** |
| **在途·下载** | 点「获取预览」 | `正在从网络地址下载…`（中性色） | 不渲染 | 不渲染 | 不渲染 | **双 `disabled`**；`Escape` **仍可用**（下载可中断，走 `AbortController`） |
| **预览就绪** | preview 响应到达 | `预览已就绪，确认后才会写入。` | `display:flex`（滚动容器） | 启发式命中 ⇒ 渲染（默认**未勾**） | 同名 ⇒ 渲染（默认**未选**） | 取消可用；确认 `disabled` 直到**四条门**全满足 |
| **提交中** | 点确认（`mode:'commit'`） | `正在写入技能，请稍候…` | 保持 | 保持 | 保持 | **双 `disabled`**；`Escape` **被忽略** |
| **提交成功** | commit 响应 ok | — | 关闭弹框并复位 | — | — | — |
| **提交失败** | commit 响应非 ok | danger + 按 `code` 查表 | 保持 | **保持勾选** | **保持选择** | 恢复可点（可就地重试） |
| **预览过期** | commit 返回过期类码 | danger `预览已过期，请重新选择文件。` | `display:none`（清空） | 清空（不渲染） | 清空（不渲染） | 回到 idle 的门（确认 `disabled`） |

**两行 idle 的状态行内容不同是刻意的（不是遗漏）**：#6 的空态文案 `尚未选择 zip 文件` 是
**本地上传专属**（E4 明文要求它落在状态行）；**网络地址**模式的空态由**面板内 #7 的地址形态说明**
（恒渲染）+ **动作区的禁用原因** `请输入网络地址` 共同承担（E5 即如此建模）⇒ 状态行**留空**并
CSSOM `display:none`。理由：这三条已经占满了「现状 + 下一步」，再让状态行复述一遍会让动作区上方
出现两条同义文本，稀释「禁用原因」的可读性。**该行留空是本契约的定值，不是未定义状态。**

**弹框关闭（`取消` / `Escape` / 成功后）的复位契约**：一律把预览内容 `replaceChildren()` 清空、
状态行复位为空、必勾与冲突选择清空、**URL 输入框清空**、**文件输入置空**
（`input.value = ''` —— ⚠️ `<input>` **没有** `reset()` 方法，那是 `<form>` 的；
本文件此前写成「文件输入 `reset()`」的**四处**措辞（组件清单 / 本节 / 与 48·49·50 既有面的关系 / 决策来源表）
均按此统一）。
理由：避免「上次的地址被静默重发」这种不透明状态；而**可修正的错误不需要靠关弹框来重试**
（失败时弹框保持打开、输入保留，见「提交失败」行）。

**文件输入的 `change` 逻辑必须 `finally { input.value = '' }`** —— 否则同一个文件第二次选不触发。
既有先例的准确形态：`handleFileSelect` 的 `finally` 块在 `settings-page.js:812-814`
（`:812` 是 `} finally {`，`:813` 是注释，`:814` 是 `e.target.value = '';`）；
其 `addEventListener('change', handleFileSelect)` 注册行是 `settings-page.js:1242`
（**注册行不是重置实现** —— 此处照抄的是**形态**，不是该行号）。

### 禁用态契约（四种情形 + 五条通用纪律）

确认按钮在**四种**情形下必须 `disabled`（前三种是本 phase 的硬约束，第四种是冲突选择器的必然）：

| # | 情形 | 可见原因文本（`#skillImportGate`） |
|---|------|-----------------------------------|
| 1 | 预览未就绪（idle / 在途 / 失败 / 过期） | 未选包时 `请先选择 zip 文件` / `请输入网络地址`；在途时 `正在处理，请稍候…` |
| 2 | 必勾未勾 | `请先勾选「我已了解以上风险」` |
| 3 | 改名输入非法（含为空） | `请输入新的技能名`（**非法形态**时另有输入框下方的 inline danger 文案给具体原因） |
| 4 | 冲突项尚未选择 | `请选择覆盖、改名或取消` |

**通用纪律（硬要求）**：

1. **一律用原生 `disabled` 属性**（`btn.disabled = true`），**不得**只用 `aria-disabled`：
   `aria-disabled` **不阻止激活** —— 键盘在单行输入框里按 Enter 仍会触发 click / 表单提交，
   只做属性「声明」是**假安全**。因此本契约明确：**`aria-disabled` 不使用**（它与 `disabled` 重复，
   或语义更弱；写下这一条是为了让「为什么没有 `aria-disabled`」有据可查，不是省略）。
2. **禁用原因必须上屏**：`.btn:disabled` 的 `pointer-events: none`（`main.css:1466-1470`）会让
   `title` **根本无法触发**，且 `disabled` 元素**不可聚焦**（读屏也读不到）⇒ 原因**只能**靠
   `#skillImportGate` 这段可见文本承载。**禁止**把原因只写在 `title` 里。
3. **视觉**：沿用既有 `.btn:disabled { opacity: .3; cursor: not-allowed; pointer-events: none }`，
   **不新增禁用态样式**。对比度豁免依据：WCAG 1.4.3 明文豁免「非活动 UI 组件的一部分」
   （见 `## Color` 表 B 末行）。
4. **在途期间**：确认与取消**双双** `disabled`（本阶段唯一「连取消都不可用」的窗口，长度 = 本地
   `rename` 序列，毫秒级）；状态行同步说明「正在写入技能，请稍候…」，`Escape` 被忽略。
   **不得**用「乐观关闭弹框 + 后台写入」替代 —— 那会让用户在结果未知的情况下离开。
5. **已知边界（如实登记，本阶段不处置，也不声称已修）**：`#skillImportGate` 的**禁用原因变化不在 live region 内**
   —— 该节点只有可见文本，**没有** `aria-live`；读屏用户在勾选 / 取消勾选必勾框、或切换冲突三选一时，
   **听不到**原因文本的出现与消失。**为什么不能「并入 E6 的 `role="status"`」—— 两条独立理由**：
   ① **位置与语义都不是状态**：`#skillImportGate` 是位于动作区正上方的**恒在说明性文本**，
   把它塞进一个**状态播报**通道会让每次勾选切换都产生一次插入/删除播报，与 `polite`「不打断当前朗读」的
   取向冲突，且会让 `#skillImportStatus` 的内容不再等于**状态行的可见文本**
   （本契约要求两者同一份文案，见 AT 播报契约）⇒ **并入即破坏该条**；
   ② **就地加 `aria-live` 也不免费**：`#skillImportGate` 文本为空时走 CSSOM `display:none`
   （本契约的显隐纪律），而 `display:none` 的 live region **不在无障碍树内** ——
   「由隐藏变为可见」是否触发播报**依 AT 而异**，要可靠就得把它改成**恒占位**，
   那会推翻本契约已登记的「空文本不占位、不留残留外边距」。
   **结论**：正确处置须**新建第二个恒在的 live region**（属新的交互机制，与「不做焦点陷阱」同一处置口径：
   **须单独立项**）。**补偿（部分，不夸大）**：复选框自身的 `checked` 状态、确认按钮的 `disabled` 状态翻转，
   读屏在 Tab 到这两个元素时可读出；但**「为什么禁用」那句解释在勾选切换的当下不可闻** ——
   这是本边界的真实代价，已写明。

### 键盘可达性契约（本契约最需要正面回答的一条）

#### 决定：**沿用 50 的「不做完整焦点陷阱（Tab 循环）」**，并因此**省略 `aria-modal`**

| # | 理由 |
|---|------|
| 1 | D-18 锁定的 `.ai-modal-overlay` **div 遮罩**形态拿不到平台焦点陷阱 —— 免费陷阱只在原生 `<dialog>` + `showModal()` 下存在（本页 2 个既有弹框走那条路，`settings.html:792` / `:806`）。改用 `<dialog>` 会**推翻 D-18**，且 AGENTS.md 的「弹框居中约定」要求 `realm://` 页继续用 div 遮罩 + CSSOM |
| 2 | 给本页 4 个既有候选弹框里的**一个**单独引入 Tab 循环 = **跨页面新机制**。50 已把它具名写成「属跨页面新机制，须单独立项」（`settings.html:553-554` 的注释逐字保留该口径） |
| 3 | 本阶段已承载 **P2 / P4 / P9** 三条 S1/S2 安全门禁（zip 路径类 / symlink 逃逸 / SSRF），不宜在同阶段引入新的全局交互机制 —— 风险隔离（ROADMAP 把 51 排最后正是同一条取向） |

**`aria-modal` 必须省略（这是对 50 的一处**有意偏离**，且是更诚实的处理）**：
`aria-modal="true"` 向辅助技术**声明「框外内容不可用」**，而本契约不强制焦点留在框内 ⇒
焦点仍可能落到被声明为不可用的元素上 —— **比不写更糟**（用户听到「不可用」却发现键盘能进去）。
取而代之：`role="dialog"` + `aria-labelledby="{标题节点 id}"`（零机制成本、纯静态语义）。

#### 补偿性条款（全部**不需要**新机制，逐条可断言）

| 项 | 契约 |
|----|------|
| **初始焦点** | 弹框打开时落在**当前模式面板内的第一个可交互元素**：本地上传 = `选择 zip 文件` 按钮；网络地址 = URL 输入框。**不落在确认按钮**（避免误触落盘）、**不落在标题**（不可聚焦） |
| **`role` / 命名** | 弹框根：`role="dialog"` + `aria-labelledby="skillImportTitle"`；**不写 `aria-modal`**（理由如上）。标题节点 id 固定 `skillImportTitle` |
| **Tab 顺序** | **严格等于 DOM 序**。**无任何正 `tabindex`（`>0`）、无 roving tabindex**；全弹框**唯一**的 `tabindex` 是**预览滚动容器的 `tabindex="0"`**（零值 ⇒ 不改相对顺序，只把该容器加入自然顺序）。序：模式选择 2 个按钮 → 当前面板控件（选择文件 / URL 输入 → 获取预览）→ **预览滚动容器**（仅预览就绪时在序内）→ 树「展开全部」→ 脚本「展开全部」→ 必勾复选框 → 冲突 3 个 radio → 改名输入框（仅选中「改名」时存在）→ `取消` → `确认`。**被 `display:none` 隐藏的面板 / 预览区 / 改名输入框 / 不渲染的开关天然不在 Tab 序内** |
| **`Escape`** | 关闭弹框，语义**等同**「取消」。**监听挂在 `document`** 并以「弹框可见」为**前置守卫**早退 —— **不挂 overlay 局部**：因不做焦点陷阱，焦点可能被用户 Tab 到框外，局部监听会让 `Escape` 静默失效（这是不做陷阱的直接后果，必须由实现补偿掉）。⚠️ 与既有 `settings-page.js:1026 / 4387 / 5708` 三处 `Escape` 处理器**互不冲突**（三者的守卫都要求各自的弹框 / 面板可见）。**例外**：`提交中` 状态 `Escape` 被忽略 |
| **焦点归还** | 关闭时（`取消` / `Escape` / 成功）把焦点归还**触发元素**（`#skillImportOpen`），判据是 **`isConnected`**：`skillImportOpen.isConnected === true` 才调 `focus()`；**`isConnected === false` 时不调用 `focus()`**（也不主动把焦点移向任何其它节点）。**本契约不再承诺「焦点不落到 `body`」** —— 归还发生时框内持有焦点的元素已被置 `display:none`，浏览器**必然**把焦点移出（落到 `body` 是 UA 行为，不是本阶段代码能约束的对象；把它写成承诺就成了**不可断言项**，故删除）。本条的断言对象收窄为**本阶段代码是否主动调 `focus()`**，驱动可直接构造：摘除 `#skillImportOpen` 后关闭弹框，断言**未对该节点调用 `focus()`**（判据形态与 50 的既有先例同款，`settings-page.js:5459`） |
| **焦点可见性** | 新增控件一律走**既有可见焦点体系**：`.btn` 系走 UA 默认焦点环（全仓**无**全局 `outline: none` 重置 —— `main.css` 的 **22 处** `outline: none`（**实测 2026-09-15**：`grep -cE 'outline:\s*none;' src/styles/main.css` → **22**；宽松匹配 `outline:\s*none` 得 23，多出的 1 处在 `:5862` 的注释内、非声明）全部挂在**具体类 / 标签**上，无一作用于 `button` 全局）；两个输入框走作用域覆盖 ③；复选框 / radio 走 UA 默认环；**预览滚动容器**（`tabindex="0"`）同样只依赖 UA 默认焦点环，不加自定义规则。**本阶段不新增第三条焦点环规则** —— 上列四项全部落在既有机制内 |
| **零可见高度停靠点（硬禁令）** | 弹框内**不得**出现「在 Tab 序内但不可见 / 零可见高度」的停靠点：所有显隐一律用 **`display`** 切换的类（`.skill-import-panel.active` / `.skill-import-preview.active` / 条件渲染），**不得**用 `max-height: 0` + `overflow: hidden`（49 的 `UI-49-W6-01` 正是该形态），**也不得**用 `visibility: hidden`（它同样不移出 Tab 序）。判据是**方向无关**的：「凡在弹框内的焦点停靠点都必须可见」，**不是**「弹框内零键盘停靠点」（后者会把日后做成可聚焦的改善误判为回归）。**预览滚动容器是本阶段唯一的「非控件型」停靠点**（`tabindex="0"`，理由见下条）：它在预览就绪时恒有可见高度（`flex: 1 1 auto` 撑开），未就绪时整块 `display:none` ⇒ 与禁令相容。**这正是该判据「方向无关」的实例**：新增一个**可见**停靠点不违反禁令，**不可见**停靠点才违反 |
| **滚动区的键盘可达性（本阶段对齐的一条）** | `.skill-import-preview` 作为**唯一滚动容器**显式声明 `tabindex="0"`。理由：内容溢出且**内部无可聚焦后代**时（例如只有一条长 description、条目数 ≤ 50 因而不渲染「展开全部」按钮），键盘用户**没有任何**进入该区域的路径 ⇒ 零值 `tabindex` 是零成本修复（不改相对顺序、不新增焦点环规则、不违反上一条禁令）。**可断言判据（UAT）**：预览处于 `.active` 时 `Tab` 能落在容器上，容器获焦后 `ArrowDown` / `PageDown` 能滚动其内容（`scrollTop` 增大）；预览非 `.active`（`display:none`）时**不在** Tab 序内 |
| **已知边界（如实登记）** | Tab 可以从弹框尾部走回背景页面控件（无陷阱）。**这是有理由的边界，不是静默省略**。**补偿**：弹框自带可见的 `取消` 按钮（恒在 DOM、恒可聚焦），且 `Escape` 因挂在 `document` 上仍然有效 ⇒ 键盘用户有一条**不依赖走回触发元素**的退出路径 |

#### 模式选择的语义取舍：**复用类、不复用 ARIA 形态**

- **复用** `.ai-memory-tabs` / `.ai-memory-tab` **类**（视觉零新增，同页面同款）。
- **不复用**既有宿主（`settings.html:490-493`）的 `role="tablist"` / `role="tab"` 用法 ——
  该用法缺 `aria-selected` / `aria-controls` 且无 roving tabindex（**既有 ARIA 不完整**；
  本阶段**不改、也不声称已修**，见补记口径）。
- **契约取值**：容器 `role="group"` + `aria-label="导入方式"`；两个按钮 `aria-pressed="true|false"`
  （互斥的**分段控件**）。
- **理由**：ARIA tabs 模式**要求** roving tabindex + 左右方向键 + Home/End —— 那是**一套新的键盘机制**
  （同上「须单独立项」）；而分段控件用原生 `button` + `aria-pressed` **零新机制**即合规，
  且 Tab 序天然覆盖两个按钮（不需要 Tab 进入、方向键在组内切换的 t模式）。
- **代价（如实登记）**：与同类的既有宿主 ARIA 形态**不一致**（视觉一致、语义更规范）。
  **不改既有宿主**（改它会命中 AI 记忆区，属跨阶段决策）；代价是这两套 ARIA 形态会并存，
  需在 plan 期的文档里点名。

### `#skillImportStatus` 的 AT 播报契约

- `[role="status"]` + `aria-live="polite"`：**恒为 polite**，**绝不**用 `assertive`
  （避免打断用户正在读的读屏内容）。
- 该节点**同时**是可见文本与 AT 播报源（**一个节点承担两职**，不新建屏读专用节点）。
- 播报内容 = 状态行的**同一份文案**（不另写一份「仅屏读」文本，避免双份文案漂移）。
- 预览从「在途」变「就绪」时**不移动焦点**（`aria-live` 已宣告），
  因为聚焦点移动会打断用户对模式选择的键盘操作。

### 不可信字符串与注入纪律（硬约束 —— 与 `TD-48-01` 的关系）

预览卡片渲染的**全部内容都来自用户导入的包**（文件名 / 目录树路径 / description 原文 /
`allowed-tools` 值 / 后端错误原文）。纪律如下：

1. **零 HTML 字符串模板**：所有插值走 **DOM API** ——
   `el.textContent = v` / `el.title = v` / `el.setAttribute(name, v)` / `el.dataset.x = v`。
   **禁止**任何 `innerHTML` / `insertAdjacentHTML` / 「拼完再整体赋给 `innerHTML`」的路径。
   （理由：`el.title = value` 是 **DOM 属性赋值**，不走 HTML 解析，与 `escapeHtml` 的属性逃逸缺口无关。）
2. **属性上下文的三条额外要求**（「不扩大 `TD-48-01`」的正面形式）：
   - 属性值**一律经 DOM 属性赋值**；**不得**拼字符串再 `setAttribute('title', 'x="' + v + '"')`。
   - **不得**把包内字符串拼进 `class` / `id` / `dataset` 的**键或值**：本阶段的类名**全部是白名单字面量**
     （目录行 vs 文件行由 `kind === 'directory'` 的三元表达式选择，**不拼接**）；扩展名标签同理 ——
     只渲染扩展名白名单查表得到的定长文字，**包内原始扩展名不参与展示文案拼接**。
   - `aria-label` / `aria-labelledby` 的取值只允许来自**本契约的定长文案**或**经校验的 `name`**（同样走 DOM 赋值）。
3. **显示前净化（本阶段新增的硬要求）**—— 包内**路径类**字符串上屏前做一次**只读**净化：
   - 移除 C0 控制字符（`\x00`–`\x1F`）与 `\x7F`、以及 C1（`\x80`–`\x9F`）；
   - 移除双向文本控制符（U+202A–U+202E、U+2066–U+2069、U+200E / U+200F）
     —— 它们能让 `evil\u202ex/SKILL.md` 在界面上**视觉欺骗**（CR-6 ② 的实测漏网族）；
   - 净化**只在显示层**，**绝不参与拒绝判据**（判据用原始字节 —— 用净化值判会让 RTL override 类样本逃过检查）；
   - 被净化字符数 > 0 时在该行末尾追加定长提示 `（含 {N} 个控制字符，已隐藏）`
     —— **禁止静默隐藏**（用户必须知道名字里有什么）。
4. **不回显被拒内容原文**：拒绝原因（状态行 / hint）只给**码 + 定长原因**，不渲染被拒条目名 /
   被拒正文片段（沿 49 的既有纪律）。
5. **本阶段的诚实边界**：`TD-48-01` / `TD-48-02` **仍开、仍未被修**（用户已裁决延后，49/50 均未处置）。
   本阶段的责任是**不扩大缺口**：新增插值面**全部**是 DOM API 赋值，零 HTML 字符串模板。
   执行期若顺手修 `escapeHtml`，须一并核对 48 的面板面并**单独记账**，**不得**在本阶段声称已修。
6. **唯一允许走 markup 直写的字符串**是**静态字面量**（说明文案里的 `<code>SKILL.md</code>` /
   `<code>github.com</code>` / `<code>allowed-tools</code>` 等）—— 它们**不含任何来自导入包的插值**。

### 折叠 / 截断 / 滚动纪律

- **唯一滚动容器** = `.skill-import-preview`（`flex: 1 1 auto; min-height: 0; overflow-y: auto`）。
  `min-height: 0` 是**必需**的（flex 子项默认 `min-height: auto`，不给 0 则永不收缩、弹框会被撑破）。
  **不得**在预览内部再建第二个滚动容器（目录树 / 脚本清单 / 扫描结论一律随预览区滚动）。
  该容器同时是**键盘可达停靠点**（标记 `tabindex="0"`，见键盘契约的「滚动区的键盘可达性」行）。
  目录树与脚本清单的「只渲染前 50 项」是**内容截断**，**不是**滚动容器。
- **显隐一律用 `display`**：面板（`.skill-import-panel` / `.active`）、预览（`.skill-import-preview` / `.active`）、
  状态行与隐藏 file input 用 **JS CSSOM 具体值**。**不用** `max-height` / `opacity` / `visibility` 做显隐。
  **不写 markup 内联 `style`**（CSP `style-src 'self'` 会拦掉且元素反而常驻可见）。
- **禁止新建折叠控件**：48 的 `.ai-skill-content-box` / `.collapsed` **不得**用于「展开全部」
  —— 那会产出「同一区域两个控件、两份状态」（`aria-expanded` 需双向同步）的漂移面。
  本阶段的「展开全部 / 收起」是**内容截断开关**，用既有 `.btn.btn-secondary.btn-sm` 承载，
  状态由按钮自身文案表达（`展开全部` ↔ `收起`），**不引入 `aria-expanded`**（它不是折叠容器的开关，
  内容是**追加**渲染的结果，不存在「展开/折叠一个容器」的语义）。
- **截断必须显式**（D-13「禁静默截断」）：计数**恒显**；点「展开全部」后**不得**再有任何截断。
- **目录树缩进**：每层 12px、**第 8 层封顶**（最大缩进 96px），经 `el.style.paddingLeft = …`（CSSOM）；
  封顶的理由：嵌套深度上限按技能根相对计 ≥ 12（CR-4），不封顶会让深树把条目名挤出可视区。
- **确定性渲染顺序**：同一父节点下**目录在前**，同级按**路径字符串的 UTF-16 码元序**
  （JS `<` / `>`，**非 locale 敏感排序** —— `localeCompare` 会随机器 locale 变，破坏预览的可复现性）。

### 长文本与溢出纪律

| 字段 | 规则 |
|------|------|
| 预览的技能名 | **CSS 单行截断**（`overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap`）+ `title` 全文（等宽 13px/600） |
| 落点行 `skills/<name>/` | `word-break: break-all` 折行，不截断 |
| description 原文 | **不截断**：`white-space: pre-wrap` + `word-break: break-word` |
| 目录树行（路径） | `word-break: break-all`；缩进见上 |
| 脚本清单路径 | `word-break: break-all` + `--skill-error-text` |
| 扫描结论条目 | `word-break: break-word`，不截断 |
| `allowed-tools` 值 | `word-break: break-word`；免责标注**同排**、可换行 |
| 状态行 / 区级 hint | `word-break: break-word`，不截断；空文本时 CSSOM `display:none`（不留残留外边距） |
| URL 输入框 | 原生横向滚动，不换行、不撑破布局 |
| 本地上传面板的**已选文件名**（若有回显） | 单行截断 + `title` 全文（不可信且无长度上界） |
| 全部按钮 | 定长文案 + `flex-shrink: 0`；**窄窗口下让位的是文本**，不是按钮 |
| 禁用原因 / 必勾提示 / 冲突提示 | 允许换行；**必须是上屏文本**，不得只进 `title` |

**硬禁令**：`.skill-import-actions` **不得**声明 `flex-wrap`（两按钮恒同排；重演
`48-UI-REVIEW` Pillar 2 的「分组被挤到第二行」属回归）。**唯一**可压缩项是上面的文本块。

### 新增 CSS 声明清单（本阶段全部新增，逐条可核）

命名空间统一为 `.skill-import-*`（kebab-case，符合项目命名规范）+ 一条 `.skill-manage-header`。
**本次新增规则共 3 条是覆盖**（作用域覆盖 ①②③，见 `## Color`），**其余全部是零命中新类**。

**落点（强制）**：整段**追加在 `src/styles/main.css` 末尾**的专属段中（段注释见下）。
理由是**源序依赖**：`.skill-manage-header .settings-group-title { margin-bottom: 0 }` 与既有
`.settings-group-title`（`main.css:3210`）**特异性差一级**（两段式 vs 一段式）⇒ 与落点无关也成立，
但作用域覆盖 ① 的 `.skill-manage-section .ai-memory-tab.active` 同样需保持「本阶段全部新增 CSS 集中
一处、可整段复核」的可维护性（与 50 的专属段同款做法）。

```css
/* ===== 设置页「技能导入」（Phase 51） ===== */

/* 区标题行：标题 + 右侧「导入技能」入口按钮。
   作用域覆盖 ②：把标题自身的 margin-bottom 归零，16px 由本行承担 ⇒ 几何结果与既有逐值相同，
   本区以外的 .settings-group-title 零变化。 */
.skill-manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}
.skill-manage-header .settings-group-title { margin-bottom: 0; }

/* 作用域覆盖 ①：模式选择的 .active 文字色。
   存量 .ai-memory-tab.active 的 --accent-color 对宿主实测暗 3.90 / 亮 3.37 < 4.5:1（14px 非大字）。
   几何值（padding / font-size / border-bottom）一字未改 ⇒ 不产生同排参差；
   AI 记忆区的三个 tab 零变化（其既有不达标见 ## Color 补记 ④）。 */
.skill-manage-section .ai-memory-tab.active { color: var(--text-primary); }

/* ---- 导入弹框 ---- */
.skill-import-modal { width: 560px; max-width: 94vw; }

/* 两个面板：显隐一律走 display（CSP 安全；不用 max-height / visibility —— 后者不移出 Tab 序） */
.skill-import-panel { display: none; flex-direction: column; gap: 8px; }
.skill-import-panel.active { display: flex; }

/* 隐藏的 file input（初始隐藏走类规则，不写 markup 内联 style）。
   可见入口是 .skill-import-pick = .btn.btn-secondary.btn-sm，点击时转调 input.click()。 */
.skill-import-file-input { display: none; }

/* 输入行（URL / 新的技能名）：几何逐值照抄 .whitelist-input-area .text-input，
   但**不照抄**其 :focus { outline: none }（1px accent 边框对输入框底实测 3.09 / 2.92 < 3:1）。 */
.skill-import-field { display: flex; align-items: center; gap: 8px; }
.skill-import-field .text-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0 12px;
  color: var(--text-primary);
  font-size: 14px;
}
/* 作用域覆盖 ③：焦环走 50 已确立的形状（accent 对 --bg-secondary 3.90 / 3.37 ≥ 3:1） */
.skill-import-field .text-input:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* 弹框状态行（兼 aria-live 播报区；空文本时经 CSSOM display:none 不占位） */
.skill-import-status {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}
.skill-import-status-danger { color: var(--skill-error-text); }

/* 预览卡片容器：弹框内**唯一**滚动容器（min-height: 0 是它能在 flex 列里收缩的前提）。
   键盘可达：容器在 markup 上声明 tabindex="0"（见 ## 结构与交互契约 的键盘契约）；
   焦点环走 UA 默认，**不为此新增规则**。 */
.skill-import-preview {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: none;
  flex-direction: column;
  gap: 8px;
}
.skill-import-preview.active { display: flex; }

/* 字段行：11px 标签 + 12px 值（与来源徽标同处「可扫读的次要信息」一档） */
.skill-import-field-row { display: flex; align-items: baseline; gap: 8px; }
.skill-import-label {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.skill-import-value {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}
.skill-import-value-mono { font-family: var(--font-mono, monospace); word-break: break-all; }

/* description **原文**：不净化、不语义截断 */
.skill-import-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 计数（11px，与标签同档） */
.skill-import-count {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--text-secondary);
}

/* 目录树 */
.skill-import-tree { display: flex; flex-direction: column; gap: 4px; }
.skill-import-tree-row {
  display: flex;
  gap: 4px;
  min-width: 0;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
}
.skill-import-tree-row-dir { color: var(--text-primary); }
.skill-import-tree-row-file { color: var(--text-secondary); }
.skill-import-tree-name { min-width: 0; word-break: break-all; }

/* 脚本清单（标红；--skill-error-text 对宿主 7.56 / 5.93 ≥ 4.5:1） */
.skill-import-scripts { display: flex; flex-direction: column; gap: 4px; }
.skill-import-script-path {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  color: var(--skill-error-text);
  word-break: break-all;
}

/* 说明 / 诚实边界文案（不构成额外权限 / 预览不代表安全） */
.skill-import-note {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}

/* 扫描结论两栏：左高亮条是**非文本**指示（lim 对宿主 6.68 / 6.50 ≥ 3:1） */
.skill-import-scan { display: flex; flex-direction: column; gap: 8px; }
.skill-import-scan-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 2px solid var(--border-color);
  padding-left: 8px;
}
.skill-import-scan-col-heuristic { border-left-color: var(--skill-limit-text); }
.skill-import-scan-head {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--text-secondary);
}
.skill-import-scan-item {
  font-size: 12px;
  line-height: 1.5;
  color: var(--skill-limit-text);
  word-break: break-word;
}

/* 风险必勾区 */
.skill-import-ack { display: flex; flex-direction: column; gap: 8px; }
.skill-import-ack-note {
  font-size: 12px;
  line-height: 1.5;
  color: var(--skill-limit-text);
  word-break: break-word;
}
.skill-import-ack-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  cursor: pointer;
}
/* 勾选态的填充色与既有 .ai-switch.on 的强调色一致；未勾选态的可见性沿用本页既有裸 checkbox
   的同一宿主同一底（settings.html:160 / 674 / 765），且状态变化另有文本冗余表达
   （= ## Color 的「Accent reserved for」第 4 项：本阶段唯一用 accent 做填充处，
   可撤回的装饰性强化 —— 删掉即回落 UA 默认强调色，功能零损失）。 */
.skill-import-ack-box { accent-color: var(--accent-color); }

/* 冲突三选一 */
.skill-import-conflict {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 2px solid var(--skill-limit-text);
  padding-left: 8px;
}
.skill-import-radio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}
/* 改名校验失败的**就近**内联文案 */
.skill-import-error {
  font-size: 12px;
  line-height: 1.5;
  color: var(--skill-error-text);
  word-break: break-word;
}

/* 禁用原因的**可见文本**（.btn:disabled 的 pointer-events:none 让 title 无法触发 ⇒ 必须上屏） */
.skill-import-gate {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}

/* 动作区（形状逐值照抄 50 的 .skill-manage-confirm-actions） */
.skill-import-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
/* 强调按钮：白字对 --accent-color 仅 3.68:1 ⇒ 用 accent **边框**（非文本，对外部邻色 3.90 / 3.37 ≥ 3:1）
   + 600 字重，**不用** accent 填充。全局 button 无边框（main.css:146）⇒ 必须新增；
   box-sizing: border-box + .btn-sm 定高 28px ⇒ 零布局位移。 */
.skill-import-confirm { border: 1px solid var(--accent-color); font-weight: 600; }
```

**本段的两条非 4 倍数声明**（均为**边框宽度**，不占 Spacing token 预算，已按 B 表逐条登记）：
`.skill-import-scan-col` / `.skill-import-conflict` 的 `border-left: 2px`
与 `.skill-import-confirm` 的 `1px`。**其余新增间距全为 4 / 8 / 16。**

### 与 48 / 49 / 50 既有面的关系

| 面 | 关系 |
|----|------|
| `.settings-group` / `.settings-group-title` / `.setting-description`（50 的区骨架） | **原样复用**：本阶段只往标题行加一个按钮（包一层 `.skill-manage-header` + 作用域覆盖 ②）。区说明三段、汇总条、状态区、分组列表、inline hint **全部零改动** |
| `.ai-modal-overlay` + `.ai-modal`（50 的 `skillManageConfirm` 形态） | **同族新实例**（D-18 明文照抄）。外壳零改动；差别只有三处：宽度（560px vs 420px）、`role="dialog"` + `aria-labelledby`（新增，因本弹框交互面远大于确认框）、`aria-modal` **不写**（理由见键盘契约）。**不改 `#skillManageConfirm`** |
| `.ai-memory-tabs` / `.ai-memory-tab`（Phase 43 的 tab 族） | **第 2 个宿主**：复用类（视觉零新增）+ 1 条作用域色覆盖（①）。宿主（AI 记忆区三个 tab）**零变化**；其既有不达标（暗 3.90 / 亮 3.37）**登记不修、不声称已修**（补记 ④）；其 ARIA 形态（`role="tab"` 无 `aria-selected`）**不改**，本阶段改用 `aria-pressed` 分段控件（代价已登记） |
| `.ai-skill-content-box` 家族（48 D-09 / 49 / 50 三处共用） | **零交集**：本阶段**不使用**折叠块，也**不新建**折叠控件；「展开全部」是内容截断开关（不是折叠容器）。因此 49 的「卡片语境无键盘入口」a11y 挂账、50 的「折叠态单一写入点」纪律**都不被本阶段触碰，也不被本阶段处置** |
| 三档来源徽标 / `TIER_BADGE` / `STATUS_TEXT`（48 / 49 / 50） | **零交集**：预览卡片显示的是**尚未落盘**的包，没有来源档位、也不产生新的行尾状态。导入成功后技能即普通 `user` 技能，其行尾状态由 50 的链决定（本阶段**不新增 `STATUS_TEXT` 键**） |
| `.skill-manage-hint` / `setSkillManageHint`（50 D-06 的 inline hint 范式） | **直接复用同一函数与同一类**：导入成功 / 最终失败走它（2 秒无条件复位 + `clearTimeout` 纪律）。**弹框打开期间不使用它**（会被遮罩挡住）—— 改用弹框内状态行（E6） |
| `.btn.btn-secondary.btn-sm`（50 的按钮族） | **六个按钮全部复用同一组合**（+ 确认按钮的 1px accent 边框）。**不使用** `.btn-primary` / `.btn-danger`（两者白字对比度 3.68 / 3.76 不达标） |
| `#rulesFileInput` 的文件选择链路 | **照抄形状**：隐藏 `<input type="file">`（类规则 `display:none`）+ 可见 button `.click()` + `change` 处理 + `finally { input.value = '' }`（既有实现见 `settings-page.js:812-814`；⚠️ **`<input>` 没有 `reset()` 方法**，本文件一律写 `input.value = ''`）。**不新增 native dialog IPC 通道**（设置页是纯 HTTP 客户端） |
| `skillsApi()`（50 的 HTTP 客户端模板） | **直接复用**：preview 阶段用 `{ method:'POST', headers:{'Content-Type':'application/zip'}, body: file }`（同源、零预检，实测 0 个 OPTIONS）或 `{ 'Content-Type':'application/json', body: JSON.stringify({mode:'url',url}) }`；commit 用 `{mode:'commit', importId, conflict, newName?}`。**不使用 base64**（D-01） |
| `escapeHtml` / `TD-48-01` | **不扩大缺口**：本阶段新增插值面**全部** DOM API 赋值，零 HTML 字符串模板；另加**显示前净化**（控制字符 + 双向控制符）。**该挂账项仍在原处、仍未被修**，不得读成已修 |
| `TD-48-02` / `WR-02` / `WR-06` / `WR-12` / `IN-14` / `IN-16` / `IN-17` | **不在本阶段契约面**，逐字保持挂账。**若本阶段新增真实渲染门禁，不得重复 `WR-12` 的「否命题空集真」形态**（承重判据必须带**正命题**，见 `## Color` 的「须在真实渲染下取数的读数」四条），且新驱动的证据**不得只活 `/tmp`**（`IN-16` / `WR-09` 教训 ⇒ 夹具固化进 `tests/fixtures/`，基线动态取） |
| P8 失效链的双账本口径（50 D-18 / D-19） | 本阶段**收口写路径 3/3**（导入是第三个写路径）：契约要求 `await ensureSkillsFresh()` **恰一次** + **调用侧**补播 `windowManager.broadcast('skills:changed')` **恰一次**，且**不得改 `syncAgentSystemPrompt()` 函数体**。⚠️ 该 3/3 与「读侧 / 兜底份额」**不是同一个量**，**不得**声称 P8 6/6 全覆盖（两个数分别记） |

---

## UI Considerations

> 本节由**探针引擎**产出后人工裁决：
> `node $HOME/.codebuddy/gsd-core/bin/lib/ui-consideration-probe.cjs elements.json resolutions.json`
> —— 元素清单**逐元素手工补全种类**（`elements` 覆盖数组）后**再**跑，规避其散文关键词分类器的
> 有损性（Phase 50 实测：9 个元素里 5 个被判 `unclassified`；本阶段若只写一个「导入弹框」笼统元素，
> 弹框内的 tab / 输入框 / 文件选择 / 目录树 / 脚本清单 / 扫描结论栏 / 复选框 / 冲突选择器 /
> 改名输入框 / 确认按钮 / inline hint **会全部丢失承载面**）。实跑结果：
> `{"applicable":82,"resolved":82,"unresolved":0,"byVerification":{"explicit":55,"backstop":2}}`。
> **重复运行即整节替换，不追加**（幂等）。
>
> 空态与错误态的**文案**在 `## Copywriting Contract`（空态 #4/#6/#7 + 失败 `code` 映射表 +
> 三条在途文案），本节只记**形状根因**的状态覆盖并**引用**那些行，不重述文案。

coverage: **applicable 82 / resolved 82 / unresolved 0** ——
byStatus `{ resolved: 57, dismissed: 25 }`；byVerification `{ explicit: 55, backstop: 2 }`。

元素清单与种类（**人工补全，绕过有损分类器**）：

| ID | 元素 | `elements` 种类 | 补充说明 |
|----|------|----------------|---------|
| E1 | 技能管理区标题行 + 「导入技能」入口按钮（`div.skill-manage-header`） | `interactive-control` · `static-content` | 引擎判 `unclassified`；**人工补** —— 一段静态标题 + 一个按钮，无异步取数、无集合 |
| E2 | 导入弹框外壳（`.ai-modal-overlay` + `.ai-modal` + 标题 + 内层布局） | `interactive-control` · `static-content` | **人工补** —— 它是**容器级**元素，承载「弹框内唯一滚动容器」这条布局契约；**未**补 `list-collection`（内部集合由 E9 / E11 / E12 各自承载，补上会重复） |
| E3 | 模式选择（本地上传 / 网络地址 两个分段按钮） | `nav` · `interactive-control` | **人工补** —— 它是**在两组内容间切换**的导航面（引擎的 `nav` 关键词命中 `tabs`，此处按语义确认 `nav` 成立）；同时是两个按钮 |
| E4 | 本地上传面板（选择 zip 文件按钮 + 隐藏 file input + 未选文件说明） | `form` · `interactive-control` · `static-content` | **人工补** `form` —— 有一个数据录入控件（file input，经按钮代理触发）与「未选/已选」的填写态 |
| E5 | 网络地址面板（URL 输入框 + 获取预览按钮 + 地址形态说明） | `form` · `interactive-control` · `static-content` | **人工补** 三项 —— 文本录入 + 触发按钮 + 定长说明；这是本阶段**唯一**的自由文本入口 ⇒ `empty` / `error` 必须在此建模 |
| E6 | 弹框状态行（加载中 / 预览就绪 / 失败三态承载，兼 `aria-live` 播报） | `static-content` | **人工补** —— 单行提示文本；**未**补 `interactive-control`（它是纯展示，无可操作控件）；**未**补 `list-collection`（它承载的是**单条**状态而非集合） |
| E7 | 预览卡片：技能名 + 落点说明（`skills/<name>/`） | `static-content` | **人工补** —— 两个只读字段；**未**补 `form`（不可编辑） |
| E8 | 预览卡片：description 原文 | `static-content` | **人工补** —— 只读长文本；「不截断、完整渲染」是它的核心契约 |
| E9 | 预览卡片：目录树（默认前 N 项 + 计数 + 展开全部开关） | `list-collection` · `interactive-control` · `static-content` | **人工补** 三项 —— 这是本阶段**第一个真正的集合**（0..2000 条 × 深度 ≤ 16），`empty` / `populated` / `partial` / `zero-one-many` 的主要承载面，且带一个截断开关 |
| E10 | 预览卡片：字节数（累计 + 单文件最大 + 限额对照） | `static-content` | **人工补** —— 定长数值字段 |
| E11 | 预览卡片：脚本清单标红（计数 + 路径列表 + 展开全部 + 不构成额外权限说明） | `list-collection` · `static-content` | **人工补** 两项 —— 第二个集合（0..2000 条）**加**一个恒显说明；**未**补 `interactive-control`（展开开关与 E9 同款，已在 E9 建模，此处不重复计一个开关面） |
| E12 | 预览卡片：威胁扫描结论两栏（注入类 / 技能域启发式） | `list-collection` · `static-content` | **人工补** 两项 —— 两栏各是一个条目集合（启发式栏 0..N 条）**加**两个恒显的诚实边界说明 |
| E13 | 预览卡片：`allowed-tools` 值与免责标注 | `static-content` | **人工补** —— 只读字段 + 一条**恒必须同排**的免责文案 |
| E14 | 风险确认区（必勾复选框 + 高亮提示 + 未勾选时的可见禁用原因） | `form` · `interactive-control` · `static-content` | **人工补** `form` —— 一个必勾控件（二值）+ 提示文案；禁用原因文本是它与 E17 的**共享契约面** |
| E15 | 冲突三选一（覆盖 / 改名 / 取消 单选组 + 改名输入框） | `form` · `interactive-control` · `static-content` | **人工补** 三项 —— 一组互斥单选（含一个条件性文本输入）；**未**把改名输入框单列（它是选中「改名」才存在的**子面**，与 E16 的分工见下） |
| E16 | 改名输入框与内联校验失败文案 | `form` · `static-content` | **人工补** 两项 —— 与 E15 的边界是**刻意**的：E15 管「选哪一项」，E16 管「选了改名之后那个输入框的填写/校验/失败」；两者不漏不重（输入框本身在 E15 的 `overflow` 行里提「未选中前不渲染」，其**填写态**归 E16） |
| E17 | 动作区（取消 / 导入 两个按钮）+ 禁用原因的可见文本 | `interactive-control` · `static-content` | **人工补** 两项 —— 两个按钮（含在途禁用态）与一段理由文本；`loading` / `error` 在此建模 |
| E18 | 区级 inline hint（导入成功 / 最终失败，2 秒复位） | `static-content` | **人工补** —— 弹框关闭后的结果承载面，单行文本 |

> **未采用 `media`**：本阶段无任何图片 / 视频 / 音频元素（无图标位图；「展开全部」是文字按钮，
> **不引入 chevron 字形**）。
> **8 个状态类别在补全后全部有元素承载**，无类别缺口（`zero-one-many` 按引擎规则只挂在
> `list-collection` 上，本阶段由 E9 / E11 / E12 三个集合承载）。

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | E1 入口按钮 | ✅ dismissed | 入口按钮是无异步的同步开关（只切弹框显隐），自身不负载体态 —— 导入在途由 E6 状态行承载 |
| error | E1 入口按钮 | ✅ dismissed | 按钮无失败态；一切导入失败在弹框内（E6）或弹框关闭后（E18）呈现 |
| overflow | E1 入口按钮 | ✅ resolved (explicit) | 标题行 flex（`justify-content:space-between`）+ 按钮 `flex-shrink:0` + `white-space:nowrap`：标题过长时让位的是标题（`.settings-group-title` 为定长「技能管理」） |
| long-text | E1 入口按钮 | ✅ resolved (explicit) | 区标题「技能管理」与按钮文案「导入技能」均为定长字面量；按钮不设 `title` 以外的属性插值面 |
| loading | E2 弹框外壳 | ✅ resolved (explicit) | 弹框无自身加载态（零 spinner、零骨架屏，与 50 的空态 / 加载态先例一致）：预览在途由 E6 单行文本承载 |
| error | E2 弹框外壳 | ✅ resolved (explicit) | 弹框打开期间的一切失败只在弹框内的 E6 状态行呈现 —— 区级 hint（E18）在此刻被遮罩挡住，不得作为弹框内的失败反馈面 |
| overflow | E2 弹框外壳 | 🧪 resolved (backstop) | { statement: "复用既有 `.ai-modal` 的 `max-height:80vh` + `flex-direction:column`，新增 `.skill-import-preview { flex:1 1 auto; min-height:0; overflow-y:auto }` 为弹框内**唯一**滚动容器（标题与按钮排不参与滚动）；真实 512 条目包 + 启发式高亮齐备时，在 800px 可用窗口下弹框总高不超过 80vh、页面级滚动不移动、且滚动只发生在预览区内（需真实数据集视觉确认，非 CSS 推算可证）", verification: backstop } |
| long-text | E2 弹框外壳 | ✅ resolved (explicit) | 弹框标题「导入技能」定长；正文与预览区一律允许换行（`word-break:break-word`），不截断、不用 `text-overflow` |
| loading | E3 模式选择 | ✅ dismissed | 分段切换是纯同步态切换（两个面板的 DOM 恒在，只切 `display` 类），无在途态 |
| error | E3 模式选择 | ✅ dismissed | 切换不会失败，无失败面 |
| overflow | E3 模式选择 | ✅ resolved (explicit) | 两个按钮 `flex-shrink:0` + `white-space:nowrap`，容器 `gap:4px` 不换行；两条文案定长 ⇒ 不存在挤压 |
| long-text | E3 模式选择 | ✅ resolved (explicit) | 两条文案为定长字面量「本地上传」/「网络地址」，不承载任何不可信字符串 |
| empty | E4 本地上传面板 | ✅ resolved (explicit) | 未选文件时状态行显示「尚未选择 zip 文件」+ 支持的包形态说明；文件名为空 = 该元素的空态，入口恒渲染不隐藏 |
| loading | E4 本地上传面板 | ✅ resolved (explicit) | 选中文件后立即进入在途态：状态行「正在读取技能包…」，入口按钮置 `disabled`；零 spinner、零骨架屏 |
| error | E4 本地上传面板 | ✅ resolved (explicit) | 解析失败 ⇒ 状态行 danger（按 `code` 查表 + 可读原因），文件选择入口保持可用以直接重选，不新建「重试」按钮 |
| partial | E4 本地上传面板 | ✅ resolved (explicit) | 已选文件但预览未就绪一律视为在途态 —— 预览是原子产物，不存在「部分预览」 |
| overflow | E4 本地上传面板 | ✅ resolved (explicit) | 文件名超长时单行截断 + `title` 放全文；说明文案 `word-break:break-word` 可换行 |
| long-text | E4 本地上传面板 | ✅ resolved (explicit) | 包内文件名是不可信且无长度上界的字符串 ⇒ 显示层单行截断 + `title` 全文；说明文案为定长字面量 |
| empty | E5 网络地址面板 | ✅ resolved (explicit) | 输入框为空时「获取预览」置 `disabled`，并在 E17 的禁用原因文本里说明「请输入网络地址」；输入框与说明恒渲染 |
| loading | E5 网络地址面板 | ✅ resolved (explicit) | 下载中状态行「正在从网络地址下载…」+「获取预览」`disabled`；中止走「取消」按钮（AbortController 真正中止请求，不只关弹框） |
| error | E5 网络地址面板 | ✅ resolved (explicit) | URL 非法 / 主机不在白名单 / 非 https / 网络或限流失败 ⇒ 状态行 danger 给机器码与可读原因，输入框保留已填内容以便就地修正 |
| partial | E5 网络地址面板 | ✅ resolved (explicit) | 输入非空但未点「获取预览」不构成加载态；不存在「部分下载可用于预览」的中间态（流式上限命中即整包拒绝） |
| overflow | E5 网络地址面板 | ✅ resolved (explicit) | URL 在输入框内单行横向滚动；结果区的地址回显单行截断 + `title` 全文；说明文案可换行 |
| long-text | E5 网络地址面板 | ✅ resolved (explicit) | 地址无长度上界 ⇒ 输入框横向滚动 + 结果区单行截断；支持的地址形态说明为定长字面量（含 `tree/<ref>/<path>` 的实测样例） |
| overflow | E6 弹框状态行 | ✅ resolved (explicit) | 允许换行（`word-break:break-word`），不截断；文本为空时经 CSSOM 置 `display:none`（不走 markup 内联 style，不用 `''` 回落） |
| long-text | E6 弹框状态行 | ✅ resolved (explicit) | 承载后端 `error` 原文（长度不可控）⇒ 折行不截断；其余状态一律取闭合白名单的定长文案 |
| overflow | E7 名称与落点 | ✅ resolved (explicit) | 技能名等宽单行截断 + `title` 全文；落点行 `skills/<name>/` 用 `word-break:break-all` 折行 |
| long-text | E7 名称与落点 | ✅ resolved (explicit) | `name` 受写入侧校验器约束（小写字母 / 数字 / 连字符，≤ 64 字符）⇒ 等宽字体下最宽约 64 字符，落点行随其折行不断字 |
| overflow | E8 description 原文 | ✅ resolved (explicit) | 不截断：`white-space:pre-wrap` + `word-break:break-word`，随预览区内层滚动，不带动整页 |
| long-text | E8 description 原文 | ✅ resolved (explicit) | description 原文可能极长（≤ 1024 字符由 `LIMITS.MAX_SKILL_DESCRIPTION_CHARS` 约束）且**必须完整渲染** —— 不净化、不语义截断，预览的全部意义就是让用户判断净化是否会误伤 |
| empty | E9 目录树 | ✅ dismissed | 包内条目数为 0 时不存在可渲染的树：无 `SKILL.md` 即无技能根，整包在解析阶段被拒 ⇒ 预览卡片根本不渲染（0 条不是空树而是拒绝） |
| loading | E9 目录树 | ✅ dismissed | 树随预览响应原子填充：解析完成才有树，展开 / 收起是纯本地态切换，无异步中间态 |
| error | E9 目录树 | ✅ dismissed | 解析或校验失败 ⇒ 整包拒绝、预览不渲染；树自身不承载失败态（失败走 E6） |
| populated | E9 目录树 | ✅ resolved (explicit) | 常态：全量条目按确定性顺序渲染（同一父节点下目录在前，同级按路径字符串 UTF-16 码元序 —— 非 locale 敏感排序），默认展开前 50 项 |
| partial | E9 目录树 | ✅ dismissed | 不存在「部分就绪」的数据态：截断是显式的展示层行为（恒显总数 + 显式开关），不是缺数据 |
| overflow | E9 目录树 | ✅ resolved (explicit) | 截断三件套：默认仅渲染前 50 项 + **恒显**「共 N 个文件 / M 个目录」计数 + 「展开全部」按钮；缩进按深度 12px 并在第 8 层封顶（最大缩进 96px），越深不再推进 —— 绝不静默截断、绝不横向撑破 |
| zero-one-many | E9 目录树 | ✅ resolved (explicit) | 0 项不可达（见 empty）；1 项只渲染 1 行且**不渲染**「展开全部」开关；2..50 项全量渲染且无开关；> 50 项渲染前 50 项 + 开关 + 进度提示「当前显示前 50 项」 |
| long-text | E9 目录树 | ✅ resolved (explicit) | 单条路径 `word-break:break-all` 折行不截断；RTL override（U+202A–U+202E / U+2066–U+2069）与 C0/C1 控制字符在**显示前**净化（拒绝对策仍用原始字节），故不存在视觉欺骗与布局破坏 |
| overflow | E10 字节数 | ✅ resolved (explicit) | 定长数值格式（`toFixed(1)` + B/KB/MB/GB），与限额对照同排；整体可换行，不横向溢出 |
| long-text | E10 字节数 | ✅ resolved (explicit) | 数值与单位均为定长格式，无长文本面；限额数值一律取主进程回传值，前端零字面量 |
| empty | E11 脚本清单 | ✅ dismissed | 0 个脚本时整块不渲染（不占位、不写「未检测到脚本」）—— 干净包不产生额外视觉噪声；「已扫描」的肯定信息由 E12 的扫描结论块承担 |
| loading | E11 脚本清单 | ✅ dismissed | 随预览响应原子填充，无异步中间态 |
| error | E11 脚本清单 | ✅ dismissed | 脚本清单本身不承载失败态；整包拒绝时预览不渲染（失败走 E6） |
| populated | E11 脚本清单 | ✅ resolved (explicit) | 常态：每条以 `--skill-error-text` 标红渲染（12px 等宽路径），并在块内恒显「技能不构成额外权限 —— 这些脚本受既有 bash 三档策略与确认卡片约束」 |
| partial | E11 脚本清单 | ✅ dismissed | 无部分就绪态：命中集合在解析阶段一次算定，截断是展示层行为（同 E9） |
| overflow | E11 脚本清单 | ✅ resolved (explicit) | 截断口径与目录树同款：默认前 50 项 + **恒显**「共 N 个脚本」+ 「展开全部」按钮；路径 `word-break:break-all` 折行 |
| zero-one-many | E11 脚本清单 | ✅ resolved (explicit) | 0 条走 empty（整块不渲染）；1 条渲染 1 行 + 计数「共 1 个脚本」；N 条同款；> 50 条出现「展开全部」开关 |
| long-text | E11 脚本清单 | ✅ resolved (explicit) | 路径按 `break-all` 折行不截断；扩展名 / 可执行位标签只渲染**白名单查表**得到的定长文字，包内原始扩展名不参与展示文案的拼接 |
| empty | E12 扫描结论两栏 | ✅ dismissed | 扫描结论块**恒渲染**：两栏都有值（注入类栏恒为肯定表述「未命中」或拒绝原因；启发式栏 0 条时显示定长「未命中技能域启发式模式」）⇒ 不存在空态 |
| loading | E12 扫描结论两栏 | ✅ dismissed | 随预览响应原子填充，无异步中间态 |
| error | E12 扫描结论两栏 | ✅ dismissed | `INJECTION_PATTERNS` 命中即**整包拒绝** ⇒ 预览不渲染，失败原因走 E6 状态行；故本块在已渲染的预览内不承载注入类的失败态 |
| populated | E12 扫描结论两栏 | ✅ resolved (explicit) | 注入类栏：恒渲染，通过时为定长「未命中」；启发式栏：每条以 `--skill-limit-text` 高亮渲染（12px），并在栏头恒显「启发式检测，降低概率而非安全边界」的诚实边界文案 |
| partial | E12 扫描结论两栏 | ✅ dismissed | 无部分就绪态：扫描结论在解析阶段一次算定 |
| overflow | E12 扫描结论两栏 | ✅ resolved (explicit) | 结论条目 `word-break:break-word` 折行不截断；命中条目较多时随预览区内层滚动（块内不新建第二层滚动容器） |
| zero-one-many | E12 扫描结论两栏 | ✅ resolved (explicit) | 启发式 0 条 ⇒ 单行定长否定表述；1 条 ⇒ 1 行；N 条 ⇒ N 行 + 栏头计数「命中 N 条」（中文无单复数形态，用括号计数） |
| long-text | E12 扫描结论两栏 | ✅ resolved (explicit) | 结论文本可能引用命中的模式名（定长白名单词条）+ 被扫描字段名（`description` / 正文，定长标识）⇒ 一律折行不截断；**不渲染命中处的原文片段**（不回显被拒内容，沿 49 既有纪律） |
| overflow | E13 allowed-tools | ✅ resolved (explicit) | 值可较长（逗号分隔的工具名列表）⇒ `word-break:break-word` 折行；免责标注同为文本节点、与值同一行内可换行 |
| long-text | E13 allowed-tools | ✅ resolved (explicit) | 该行受组装后 `SKILL.md` 64 KiB 闸约束，无独立长度上界 ⇒ 折行不截断；免责标注「本字段在当前运行时不被强制，仅供参考」是从单源常量渲染的定长文案，**必须与值同排出现，不得折叠、不得省略** |
| empty | E14 风险确认区 | ✅ resolved (explicit) | 「未勾选」即该元素的空态：复选框恒渲染（启发式命中时必勾项必然存在），未勾选时确认按钮 `disabled` 且 E17 的可见原因文本写明「请先勾选『我已了解以上风险』」 |
| loading | E14 风险确认区 | ✅ dismissed | 复选框无在途态（本地布尔，不发请求） |
| error | E14 风险确认区 | ✅ dismissed | 复选框自身不会失败；提交失败走 E6，且勾选状态在失败后**保持**（不静默复位） |
| partial | E14 风险确认区 | ✅ dismissed | 二值控件，不存在部分态 |
| overflow | E14 风险确认区 | ✅ resolved (explicit) | 提示文案可换行；命中条目列表过长时随预览区内层滚动（不新建第二个滚动容器） |
| long-text | E14 风险确认区 | ✅ resolved (explicit) | 必勾文案为本契约的定长单源字符串；其引用的命中条目路径列表可长 ⇒ 折行不截断 |
| empty | E15 冲突三选一 | ✅ resolved (explicit) | 两种含义的空态**都**已定义：① 与已有用户技能不同名 ⇒ 整块不渲染（不占位）；② 同名但尚未选择 ⇒ 三项均未选中，确认按钮 `disabled` 并在 E17 的可见原因文本里写明「请选择覆盖、改名或取消」 |
| loading | E15 冲突三选一 | ✅ dismissed | 单选组无在途态（纯本地状态） |
| error | E15 冲突三选一 | ✅ dismissed | 选择本身不会失败；提交失败走 E6，且已选项在失败后保持 |
| partial | E15 冲突三选一 | ✅ dismissed | 互斥单选，不存在部分选择态 |
| overflow | E15 冲突三选一 | ✅ resolved (explicit) | 三项与改名输入框纵向排列，文案可换行；输入框在选中「改名」前不渲染（不占位、不进 Tab 序） |
| long-text | E15 冲突三选一 | ✅ resolved (explicit) | 被冲突的同名技能 `name` ≤ 64 字符 ⇒ 等宽单行截断 + `title` 全文；三项标签为本契约定长文案 |
| empty | E16 改名输入框 | ✅ resolved (explicit) | 输入框为空 ⇒ 确认按钮 `disabled`，E17 的可见原因文本写明「请输入新的技能名」；**不预填默认值**（预填会让用户误以为已校验通过） |
| loading | E16 改名输入框 | ✅ dismissed | 输入框无在途态；越界与形态校验是同步本地判据（与主进程同一校验器同判据） |
| error | E16 改名输入框 | ✅ resolved (explicit) | 校验失败 ⇒ 输入框下方内联 danger 文案（取 `validateManagedSkillName` 的同一拒绝原因，不写第二份映射），同时确认按钮 `disabled` |
| partial | E16 改名输入框 | ✅ dismissed | 单值输入框，不存在部分态 |
| overflow | E16 改名输入框 | ✅ resolved (explicit) | 单行输入框内横向滚动（`type="text"` 原生行为），不换行、不撑破布局 |
| long-text | E16 改名输入框 | ✅ resolved (explicit) | 名称上限 64 字符由校验器统一拒绝并给可见原因；**不在输入框内另做字数计数**（第二份上限实现会与校验器漂移），也不设 `maxlength`（`maxlength` 截断会产出静默失败，与「拒绝必须可见」相悖） |
| loading | E17 动作区与禁用原因 | ✅ resolved (explicit) | 在途态：确认与取消**双双** `disabled`（原生 `disabled` 属性），状态行同步给出「正在写入技能，请稍候」；在途期间 `Escape` 被忽略（不得让用户处在「不知道有没有落盘」的状态） |
| error | E17 动作区与禁用原因 | ✅ dismissed | 按钮组本身不承载失败态；失败走 E6 状态行（弹框打开期间）或 E18 区级 hint（弹框关闭后） |
| overflow | E17 动作区与禁用原因 | 🧪 resolved (backstop) | { statement: "按钮排 `flex-end` + `gap:8px`、禁用原因文本位于按钮排**上方**且可换行（窄窗口下让位的是文本而不是按钮）；最宽形态（禁用原因文本为「请先勾选『我已了解以上风险』」+ 冲突提示 + 两按钮）在 800px 可用窗口下不横向溢出、按钮不被裁切、文本按 `word-break` 折行（由 CSS 值推算，非实测）", verification: backstop } |
| long-text | E17 动作区与禁用原因 | ✅ resolved (explicit) | 按钮文案取自闭合二元表（默认「导入」，冲突项选「取消」时切「关闭弹框」；取消按钮恒「取消」）；禁用原因文本可换行不截断 ⇒ 不存在按钮被长文案撑破的路径 |
| overflow | E18 区级 inline hint | ✅ resolved (explicit) | 可换行（`word-break:break-word`），不截断；文本为空时经 CSSOM 置 `display:none`，不留 8px 残留外边距 |
| long-text | E18 区级 inline hint | ✅ resolved (explicit) | 承载后端 `error` 原文（长度不可控）⇒ 折行不截断；常规成功 / 失败文案由闭合白名单定长给出 |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ resolved (explicit) → a plain truth string lifted into must_haves.truths
     🧪 resolved (backstop) → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                              evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ✅ dismissed           → closed with an authored reason (NOT an omission — every dismissal carries one)
     ⚠ unresolved           → an explicit planner assumption (surfaced, never silently dropped). 本轮为 0 条。
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

> **两条 backstop 的共同形态**（供 plan 期理解 `human_needed` 的触发面）：它们都是
> **「由 CSS 值推算的布局结论 + 需要真实数据集在真实窗口下的读数」** ⇒ 验证方式是**一条带正命题的
> 属性测试**（`scrollWidth <= clientWidth`、`modal.getBoundingClientRect().height <= 0.8 * innerHeight`、
> 滚动发生在预览区内），**不是**「看着没问题」。若无该显式证据，正确处置是 `human_needed`
> —— **绝不允许静默通过**（`#1154`）。⚠️ 写该驱动时**不得重复 `WR-12` 的「否命题空集真」形态**：
> 判据必须能在「未修复的树上转红」（先红后绿），且证据固化进仓库（`IN-16` / `WR-09` 教训）。

---

## 决策来源表

| 契约条目 | 来源 |
|----------|------|
| 入口 = 技能管理区标题行右侧「导入技能」按钮 + `realm://` 范式 div 遮罩弹框 + 两个 tab | **D-18 原文** |
| 弹框形态照抄 50 的 `skillManageConfirm`（`.ai-modal-overlay` + `.ai-modal`、初始隐藏走 CSS 类、禁 markup 内联 style、绝不用于 `<dialog>`） | **D-18 原文** + AGENTS.md「内部页面 CSP」/「弹框居中约定」 |
| 文件选择复用既有 `<input type="file">` 先例（`rulesFileInput` + `.click()` + `finally` 里置空 `input.value`），不新增 native dialog IPC | **D-18 原文** |
| 失败反馈走设置页既有 inline hint（**不新建 toast 基建**） | **D-18 原文**（50 D-06 同一判断） |
| 不新增主窗口入口 | **D-18 原文** + 50 D-17 |
| 预览卡片信息集（名称 + 落点 / description **原文** / 目录树折叠 + 前 N 项 + 计数 / 字节数 + 限额对照 / 脚本清单**标红** / 扫描结论**两栏** / `allowed-tools` + 免责标注 / 诚实边界） | **D-13 原文**（含 ROADMAP 判据 1 的六字段） |
| 目录树「默认展开前 50 项 + 恒显计数 + 展开全部、**禁静默截断**」 | **D-13 原文**（建议值 50） |
| 脚本清单判据 = 扩展名集合**或** POSIX 可执行位；文案必须写清「技能不构成额外权限」 | **D-13 原文** + `docs/product/ai-agent-workspace.md` §七 第 6 条 |
| `allowed-tools` **解析并展示 + 必须带免责标注**「本字段在当前运行时不被强制，仅供参考」 | **D-13 原文** + O3 裁决 ② + REQUIREMENTS 的 Out of Scope |
| 威胁扫描**两级效力**：`INJECTION_PATTERNS` 命中**硬拒整包**；技能域启发式**不拒**，改为**显著高亮 + 必勾确认** | **D-12 原文** |
| 必勾文案与「启发式非安全边界」须**成文/上屏** | **D-12 原文**（含 CR-10 的「后端不校验该复选框」诚实边界） |
| 冲突策略按来源分档：与内置同名**拒绝**；与用户技能同名**三选一**（覆盖 / 改名 / 取消）；与 managed 同名只允许**改名 / 取消**并提示遮蔽 | **D-08 原文** |
| 改名的 `name` 走**同一份** `validateManagedSkillName`（一份校验器） | **D-08 原文** + 49 D-11（复用纪律） |
| 覆盖 = 备份 + 两段 rename + 失败回滚；且**必须让用户知道可回滚** | **D-09 原文**（D-09 是契约的「后果说明 #25」的来源） |
| 数量闸：覆盖**豁免**、改名**计入**；到顶拒绝 + 可操作提示 | **D-11 原文** |
| 两阶段语义（先预览，确认后才落盘）、`importId` **不透明句柄**、TTL 过期**不得静默失败** | **D-02 原文**（含「预览已过期，请重新选择文件」文案） |
| zip 上传走 **raw binary body**（`Content-Type: application/zip`），**不用 base64** | **D-01 原文**（客户端构造 `File` 作 body，零 FileReader） |
| 路由 = 一个 `POST /api/skills/import` 按 `Content-Type` / `mode` 分流；**只有一个落盘实现** | **D-03 / D-07 原文** |
| 网络导入：https-only + 主机白名单 + 逐跳校验 + 跳数上限 + 流式上限 + magic bytes；`api.github.com` **显式拒绝**（`unsupported_url`） | **D-05 原文** + **CR-1 / CR-1b**（白名单须同时含 `skills.sh` 与 `www.skills.sh`，且不得再写成「承载产品闭环」） |
| 技能根定位：命中 0 个或 > 1 个即**拒绝并给可操作提示**（含 `tree/<ref>/<path>` 的正确形态与实测样例） | **D-06 原文** + **CR-7 / CR-8** |
| 目录名必须以校验后的 `name` 命名（**绝不使用包内原始目录名拼路径**） | **D-06 原文**（P5 第 2 条） |
| 「上传上限 ⇒ 解压上限」的**方向正确**表述（合法包解压 ≤ 32 MiB ⇒ 压缩后必然 ≤ 32 MiB ⇒ 上传闸不误杀合法包） | **CR-5**（计划文本必须用这句；本契约的「体积对照」文案据此不承诺炸弹防护） |
| 嵌套深度**按技能根相对计、≥ 12**；该口径必须写进产品文档 | **CR-4**（因此预览的「目录」字段不展示「包根深度」，只展示树与计数） |
| 新增错误码走**独立常量 `IMPORT_SKILL_ERROR`**，不得并入被 11 键锁死的 `MANAGE_SKILL_ERROR` | **CR-3**（本契约的失败映射表据此声明「完整码表待回填」） |
| 显示前净化（C0/C1 控制字符 + 双向控制符）+ **净化只在显示层、判据用原始字节** | 本契约（CR-6 ② 的六类实测漏网 + `TD-48-01` 不得扩大的正面形式） |
| 零 HTML 字符串模板 / 属性上下文一律 DOM 属性赋值 / 不得把包内字符串拼进 `class`·`dataset` | 本契约（`TD-48-01` 的「不扩大缺口」纪律，与 50 的注入纪律同款） |
| **不新增任何颜色令牌**；四条既有语义文字色 + accent 非文本边框即足够 | 本契约（少一个令牌 = 少两处「两主题各补一处」的失败点） |
| 入口按钮与确认按钮**不用** `.btn-primary`（白字 3.68:1），确认按钮改用 1px accent 边框 + 600 字重 | 本契约（对比度直接导出，与 50 禁用 `.btn-danger` 同款判定） |
| 脚本清单标红用 `--skill-error-text`（暗 7.56 / 亮 5.93）、启发式高亮用 `--skill-limit-text`（暗 6.68 / 亮 6.50） | 本契约（**可测量的双主题目标值**，由 WCAG 公式复算；48/49/50 的同一个 `--bg-secondary` 宿主） |
| 模式选择**复用 `.ai-memory-tab` 类** + 1 条作用域色覆盖；宿主（AI 记忆区）零变化、其既有不达标登记不修 | 本契约（同类名的第 2 宿主 + 作用域收敛，与 50 前置修复 ① / ③ 同款形状） |
| 模式选择用 `aria-pressed` **分段控件**（不复用宿主的 `role="tab"` 形态、不引入 roving tabindex / 方向键） | 本契约（ARIA tabs 模式要求的键盘机制属「须单独立项」；分段控件零新机制即合规） |
| **沿用 50 的「不做完整焦点陷阱」**；补偿 = 初始焦点进当前面板首个控件 / `Escape` 挂在 `document` 并带可见前置守卫 / 焦点归还触发元素 / 无正 tabindex / **零可见高度停靠点**硬禁令 | 本契约（D-18 锁定的 div 形态拿不到平台陷阱；给 4 个既有弹框中的一个单独引入 Tab 循环 = 跨页面新机制；本阶段已承载三条安全门禁） |
| **省略 `aria-modal`**（刻意偏离 50 的默认做法） | 本契约（声明模态却不强制焦点留在框内 = 焦点落到被声明为不可用的元素上，**比不写更糟**） |
| 弹框根加 `role="dialog"` + `aria-labelledby`（**既有 4 个弹框零变化**） | 本契约（零机制成本的静态语义；沿「不重设计既有面」纪律只在**新增**实例上施加） |
| 状态行 `[role="status"]` + `aria-live="polite"`，**一个节点兼作可见文本与 AT 播报源**（不另写屏读文案） | 本契约（零新机制、无双份文案漂移） |
| 禁用态一律用**原生 `disabled`**、**不用 `aria-disabled`**（`aria-disabled` 不阻止激活 = 假安全） | 本契约（正面回答「`aria-disabled` 契约」：**明确不使用** + 理由） |
| **禁用原因必须上屏**（`.btn:disabled` 的 `pointer-events:none` 让 `title` 无法触发、且 `disabled` 元素不可聚焦） | 本契约（对比度豁免的代价必须由别处承担） |
| 在途期间**确认与取消双双 disabled**、`Escape` 被忽略 | 本契约（不得让用户在结果未知时离开；窗口长度 = 本地 rename 序列） |
| **唯一滚动容器** = `.skill-import-preview`（`flex:1 1 auto; min-height:0; overflow-y:auto`） | 本契约（复用 `.ai-modal` 既有 `max-height:80vh` + flex 列；`min-height:0` 是 flex 收缩的必需前提） |
| 该滚动容器**兼作键盘可达停靠点**（`tabindex="0"`，零值 ⇒ 不改相对顺序） | 本契约（溢出且内部无可聚焦后代时，键盘无任何进入路径；容器恒有可见高度 ⇒ 不违反「零可见高度停靠点」硬禁令） |
| `#skillImportGate` 的禁用原因**不进 live region**（勾选切换当下读屏不可闻） | 本契约的**已知边界**（并入 E6 的状态通道会破坏「状态行 = 播报源同一份文案」；就地加 `aria-live` 会被「空文本 `display:none`」抵消 ⇒ 正确处置须新建第二个恒在 live region，**须单独立项**） |
| 必勾复选框的 `accent-color` 填充 = **Accent reserved for 第 4 项**（本阶段唯一用 accent 填充处） | 本契约（可撤回的装饰性强化：勾选态另有「禁用原因消失 + 确认按钮可用」的文本冗余表达） |
| **禁止新建折叠控件**（「展开全部」是内容截断开关，不复用 `.ai-skill-content-box` / `.collapsed`） | 本契约（避免「同一区域两个控件、两份状态」的漂移面；也避免触碰 49 的 a11y 挂账） |
| 目录树缩进 12px/层、**第 8 层封顶**；同级按 **UTF-16 码元序**（非 locale 敏感） | 本契约（深树不把名字挤出可视区；`localeCompare` 随机器 locale 变 ⇒ 破坏预览可复现性） |
| 三选项**默认都不预选**；选中「取消」时确认按钮文案切 `关闭弹框` | 本契约（D-08 要三选一，而「点了等于关闭」的第三项会产出必然死路的确认按钮；取舍见 Copywriting 的二元表） |
| 弹框关闭一律复位全部输入（含 URL 与文件输入） | 本契约（避免「上次的地址被静默重发」；可修正的错误靠**失败时弹框保持打开**而非靠关弹框重试） |
| P8 写路径收口 = `ensureSkillsFresh()` 恰一次 + **调用侧**补播 `skills:changed` 恰一次；**不得改 `syncAgentSystemPrompt()` 函数体**；双账本分别记 | **D-19 原文**（含「不得读成 P8 6/6」的提醒） |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Reviewed at:** `2026-09-15T03:05:45Z`　**Approval:** approved（修订轮：6 条 FLAG 全部处置完毕，0 BLOCK 遗留）

### 本次 6 条 FLAG 的逐条处置

| FLAG | 维度 | 处置 | 落点 / 理由 |
|------|------|------|------------|
| F1 | 2 Visuals | **已修** | **互换 DOM 骨架中 `#skillImportAck` 与 `#skillImportConflict` 两块**，使四处声明同序（本段 / DOM 骨架 / 状态机列序 / Tab 序）。顺带清掉两处**疑似第四处**：`## Spacing Scale` 的 `.ai-modal` 行（原写「确认区」）改为逐段同序枚举并加注；Copywriting 的 Destructive confirmation 行把箭头链（`冲突 → 必勾 → 导入`）改为**要素枚举**并显式写明「要素枚举而非视觉序」。新增「本顺序的自查」引用块，把四处 + 两处非声明处逐条列出 |
| F2 | 1 Copywriting | **已修（保留「空态文案由状态行承载」方向）** | 状态机 `idle·本地` 行的状态行格由「空（`display:none`）」改为 **`尚未选择 zip 文件`**（= #6），与该表相邻行、Copywriting #6、空态节、E4 四处对齐。`idle·网络` 行**保持留空**，并新增一段「两行 idle 的差别是刻意的」说明其理由（#6 是 zip 专属；URL 模式空态由面板 #7 + 禁用原因承担），空态节的「一律」措辞改为按模式分别陈述 |
| F3 | 7 Inventory Provenance | **原样保留（未改一个字）** | `Could not enumerate` 的理由真实（无 `components.json` / 无 `tailwind.config.*` / 依赖中无 UI 框架）；「**非穷尽清单 —— 不是封闭白名单**」这句与自带的可重跑 `grep` 命令**均未动**，表外原语查 `main.css` 仍是**预期路径** |
| F4 | 2 Visuals | **已修（取「改写成可断言形式」）** | 焦点归还改为 **`isConnected`** 判据（`true` 才调 `focus()`；`false` 不调），**删除**「不得把焦点丢到 `body`」承诺并写明删除理由（UA 必然移出 ⇒ 原表述不可断言）；断言对象收窄为「本阶段代码是否主动调 `focus()`」，并在驱动里可构造（摘除 `#skillImportOpen` 后关闭）。判据形态与 50 的既有先例 `settings-page.js:5459` 同款。**未**同时声明「分支不可达」——按裁决要求二选一 |
| F5 | 契约精度 | **已修（a/b/d/e 四处落笔；c 无落点，见下）** | **a** `:755` / `:769` → **`:792` / `:806`**（2 处，实测两个 `<dialog class="modal">` 在 `settings.html:792` / `:806`）；**b** `main.css` 的 `10 处` → **`22 处`**（实测 `grep -cE 'outline:\s*none;'` → 22，宽松匹配 23 的差额在 `:5862` 注释内；结论不变：无一条作用于 `button` 全局）；**d** `finally reset()` @`:1242` → **`settings-page.js:812-814`、形态 `e.target.value = ''`**（`:1242` 是 `change` 注册行，已注明「注册行不是重置实现」）+ 组件清单源址列同步补 `812-814`；**e** 「文件输入 `reset()`」4 处措辞统一为 **`input.value = ''`**（含 `## 决策来源表` 一处），并在复位契约处写明 `<input>` 无 `reset()` 方法。**c：本文件不存在该表述** —— 全文 `grep` 无 `skill-creator` / `.py` / `python` 命中（`44,998` / `viewer.html` 同样零命中），故**无落点可改**；实测值已复核为 **10 个 `.py`**（`scripts/` 9 个：8 个含 `__init__.py` + `utils.py`，另 `eval-viewer/generate_review.py` 1 个），该数字确由 `51-CONTEXT.md:121` / `51-RESEARCH.md:118` 携带旧值，但按裁决**不改上游两份文档** |
| F6 | 3 Color | **已修** | `Accent reserved for` 新增**第 4 项**「必勾复选框的勾选态填充」（`.skill-import-ack-box { accent-color: var(--accent-color) }`），写明**中性化替代**（删声明即回落 UA 默认强调色，功能零损失）与「可撤回的装饰性强化」定位；原第 4 项「显式排除」改为第 5 项并把「任何填充色」收敛为「**除第 4 项以外**的任何填充色」，`.btn-primary` 顺延为第 6 项；`## Color` 表头「只有三处」→「共四处」；CSS 块内该规则注释加交叉引用。清单与正文再无冲突 |

### 附加项（上一轮列为可选的 3 条）

| 项 | 处置 | 说明 |
|----|------|------|
| ① 预览滚动容器声明 `tabindex="0"` | **已采纳** | DOM 骨架加 `[tabindex="0"]`；Tab 序契约新增该停靠点（并澄清「无正 `tabindex`」指 `>0`，零值不改相对顺序）；「零可见高度停靠点」行加实例说明；新增「滚动区的键盘可达性」一行（含可断言判据）；折叠/滚动纪律、CSS 注释、决策来源表同步 |
| ② description 也做显示层净化 | **未采纳（有意保留原状）** | 与 E8 的定值冲突：E8 明文「description **必须完整渲染** —— 不净化、不语义截断，预览的全部意义就是让用户判断净化是否会误伤」，CSS 注释与长文本纪律同口径。改成净化会让「用户看到的就是包里的原文」这一预览核心承诺失效 ⇒ 保留「路径类净化 + description 原文」的分工，不采纳 |
| ③ `#skillImportGate` 原因变化不在 live region | **以「已知边界」写明（不处置）** | 见禁用态契约通用纪律第 5 条：写明两条不能并入 E6 状态通道的独立理由（语义冲突 + `display:none` 的 live region 不在无障碍树内），结论为「须新建第二个恒在 live region ⇒ 单独立项」，并**如实写明补偿是部分的**（勾选切换当下「为什么禁用」不可闻） |

### 核验结论（必须在修订轮保持不变的算术）

- 元素数 **18**（E1–E18）；账本 **82 / 82 / 0**；`byStatus = {resolved: 57, dismissed: 25}`；
  `byVerification = {explicit: 55, backstop: 2}`；backstop **2** 条。本轮修订**未增删任何元素或账本行**，
  上列计数逐字保持（探针实跑输出 `{"applicable":82,"resolved":82,"unresolved":0,…}` 不变）。
- 三条「核验通过、不得回退」的结论原样保留：① 刻意省略 `aria-modal` + 改加 `role="dialog"` +
  `aria-labelledby`；② 「明确不使用 `aria-disabled`、一律原生 `disabled`」+「禁用原因必须上屏」；
  ③ 上述 18 / 82 / 2 的算术。
- 本轮**零新增颜色令牌**（仍为 0 个）、零新增字体、零新增图标、零新增折叠控件、零新增 toast 基建、
  零新增前端依赖 —— 新增的 `tabindex="0"` 是 markup 属性，不构成新机制。
