# Phase 44 — UI Review

**Audited:** 2026-09-07
**Baseline:** 44-UI-SPEC.md（已 approved 设计契约）
**Screenshots:** 未捕获（localhost:3000/5173/8080 均无 dev server）——纯代码审计（结构 / 类名 / 字符串 / 状态覆盖逐项核对）

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 契约文案逐字落地率高，但磁盘满两条契约文案（D-08）全链路无用户可见出口 |
| 2. Visuals | 3/4 | 层级/图标完备（checker 建议②已落实），录制红点 10px 热区过小且无 aria 语义 |
| 3. Color | 3/4 | 双 token 体系纪律良好，但转换 CTA / 反馈条存在硬编码色值、设置页入口按钮偏离 accent 预留清单 |
| 4. Typography | 3/4 | tabular-nums 覆盖到位，但出现契约外字重 500 与 10px/12px 两档契约外字号 |
| 5. Spacing | 3/4 | 布局级间距严守 4 的倍数，散见 6px/9px/3px 微偏移未在例外清单内 |
| 6. Experience Design | 3/4 | 状态覆盖面广（空/错/降级/确认/隐藏式禁用），但播放器内转换发起失败与删除失败均为静默 |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **磁盘满契约文案无用户出口（BLOCKER for Pillar 1 收口）** — D-08 两条文案「磁盘空间不足，已自动清理最久未看的缓存」「缓存写入失败：磁盘空间不足」在 main.js / media-cache-manager.js / player.js / tasks-page.js 全部无匹配：`media-cache-manager.js:488` 返回 `reason:'disk_full'` 后，main.js 无映射（CONVERT_FAIL_TEXT 亦无 disk_full 条目，main.js:3022），用户永远看不到磁盘满的具体原因，只可能看到笼统的降级提示 — 影响：缓存静默失效，用户不知道该去设置页调容量 — 修复：在 main.js 增加 disk_full → 「缓存写入失败：磁盘空间不足」映射并经既有降级提示条/任务通知通道透出；强淘成功路径发「磁盘空间不足，已自动清理最久未看的缓存」一次性提示。
2. **播放器内「转换为 MP4」发起失败静默（WARNING）** — `src/player.js:1019-1023`：`r.ok === false` 时仅 `console.warn`，服务端拒绝（segments_incomplete / discontinuity）时用户点了按钮却无任何可见反馈，弹框也不出现 — 影响：主 CTA 无声失败，用户以为点击无效 — 修复：复用 `showError()` 或降级提示条展示「MP4 转换失败：{原因}」（reason → 中文映射可在主进程 startConvert 返回体里带上 CONVERT_FAIL_TEXT 文案，避免 renderer 再建一份表）。
3. **录制红点 10px 点击热区过小且无可达性语义（WARNING）** — `player.css:474-487` `#record-dot` 宽高 10px、可点击停止，但无 `role="button"`、无 `aria-label`，10px 热区远低于常规 24px 最小可点尺寸 — 影响：误触率高（想点红点停止常点空），键盘/辅助技术不可达 — 修复：外包一层 ≥24×24 透明热区（`-webkit-app-region: no-drag` 保持），补 `role="button"` + `aria-label="停止录制"`；tooltip 逻辑随热区层迁移。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**契约逐字核对（通过项）：**
- 「开始录制」/「停止录制」tooltip：`player.js:824`（`btnRecord.title` 随状态切换）✅
- 抽屉空态「暂无观看记录」+「播放过的视频会出现在这里，重开可从上次位置继续」：`player.html:124-125` ✅
- 任务页空态「暂无媒体任务」+「直播录制和 MP4 转换任务会在这里显示进度」：`tasks.html:46-47` ✅
- D-10 降级「部分分片加载失败，已缓存部分可继续观看」：`player.js:767` ✅（且正确 gate 在 `state.isIndependentMode && !isLive`，webview 模式不误显，player.js:193）
- 录制失败「录制失败：{原因}。已录部分仍可转换为 MP4」：`player.js:920` ✅
- 删除确认逐字文案 + G-44-8 勾选联动警示变体：`player.js:1085, 1092-1094` ✅
- 状态徽标五态文案（进行中/已完成/失败/已取消/已中断）：`tasks-page.js:247-253` ✅；cancelled 归入「失败已中断」分区与 44-03 决策一致
- 关窗确认「继续后台录制 / 停止并保存」+「记住我的选择」、退出确认「有正在进行的录制任务，退出将中断录制。确定退出吗？」：`ipc-handlers.js:2155-2159`、`main.js:4357` ✅
- 「MP4 转换失败：{原因}」前缀落库 + 通知去重：44-05/44-11 CONVERT_FAIL_TEXT 覆盖 9 个 reason，无「未知原因」兜底漏洞（main.js:3022-3032）✅
- 「更改目录…」（checker 建议①）：`settings.html:576` ✅；「打开任务列表」按钮文字与分区行标签「任务列表」（settings.html:587）分工清晰

**缺陷（支撑扣分）：**
- **[WARNING] D-08 磁盘满文案零出口**：契约两条「磁盘空间不足，已自动清理最久未看的缓存」「缓存写入失败：磁盘空间不足」在全部 UI 文件 grep 零命中；`media-cache-manager.js:488` 的 `disk_full` 只落 console.warn（:480），`reason` 无消费端映射。见 Top Fix 1。
- **[minor] 降级提示文案在「零缓存」场景不准确**：`player.js:196/200` 对未缓存过的新视频首次播放遇网络错误同样显示「已缓存部分可继续观看」，此时实际无任何缓存可看 — 文案与真实状态可能矛盾。
- **[minor] 无泛型英文残留**：grep Submit/OK/Cancel 等仅命中「取消」（删除确认框，符合惯例）——无问题。

### Pillar 2: Visuals (3/4)

- 分区标题/页面标题层级清晰：任务页 20px/600 页题（main.css:8991）+ 16px/600 分区题（main.css:9103），抽屉标题 16px/600（player.css:549）✅
- 状态色徽标（accent/success/danger/warning + 15% 底）提供一眼可辨的状态层级：main.css:9141-9160 ✅
- 图标按钮全部带 `title`；抽屉删除按钮 `aria-label="删除缓存"`（player.js:1034，checker 建议②已落实）✅
- webview tab 模式录制/抽屉/红点整体隐藏（player.css:817-822 `display:none !important`），入口语义不泄漏 ✅
- **[WARNING] 录制红点 10px 热区 + 无 aria 语义**：见 Top Fix 3。作为「可点击停止」的 destructive 控件，这是播放器内唯一无 title/aria 兜底的交互点（tooltip 是自绘 div，不进可访问性树）。
- **[minor] 主窗口角标形态偏离 Component #9**：spec 描述「8px 圆点 accent（可带数字）」，实现为「播放图标按钮 + 16px 数字胶囊」（index.html:277-283）——视觉可辩护（与其他工具栏按钮同构），但与契约组件形态不一致，未在文档记录偏离理由。
- **[minor] 任务页首帧闪现三个空分区标题**：tasks.html 三区初始可见，首次 `loadTasks()` 返回前（网络往返）三组「进行中/已完成/失败已中断」标题+空列表短暂可见；初始隐藏应走 CSS 类（realm:// CSP 约定本可做到）。

### Pillar 3: Color (3/4)

- 双 token 体系执行到位：player 层全部走 `--player-*`（新增元素无跨层引用 main.css）；tasks/设置/角标层全部走 `--bg-secondary`/`--accent-color`/`--success-color` 等语义 token（main.css:9118/9142/9197/9252）✅
- accent 预留清单核对：进度条已播（player.css:257）、音量填充（:398）、抽屉续播条（:620）、转换 CTA（:691）、任务进行中徽标与进度条（main.css:9142/9197）、角标（:9252）——无 accent 滥用（>10 元素阈值远未触及）✅
- 录制红点为 destructive `#EF4444` 非 accent（player.css:481）✅，闪烁 keyframes 1s 循环（:486,493）符合契约
- **[minor] 转换 CTA 硬编码 accent 派生色**：`player.css:692-693` `rgba(59,130,246,0.12)` / `rgba(59,130,246,0.45)` 未走 `var(--player-accent)`（可用 color-mix 与 main.css 徽标同法）——将来调 accent 色此按钮脱钩。
- **[minor] 反馈条底色硬编码**：`main.css:9227` `rgba(239,68,68,0.08)`，同文件徽标已用 `color-mix(in srgb, var(--danger-color) 15%, transparent)`（:9153）——同层两种写法不一致。
- **[minor] 提示条/确认框底色偏移**：`player.css:178` `rgba(20,20,20,0.85)`、`:745` `rgba(20,20,20,0.95)` vs 契约 Secondary `rgba(0,0,0,0.85)`——观感近似但偏离契约声明值。
- **[minor] 设置页「任务列表」入口按钮未用 accent**：预留清单声明「设置页『任务列表』入口按钮（链接式 accent）」，实现为 `btn-secondary`（settings.html:590）——属「欠用」而非滥用，方向安全但与清单不符。

### Pillar 4: Typography (3/4)

- 字号分布：13px（次要/元信息）、14px（正文/条目标题）、16px（分区/抽屉标题）、20px（页面标题）——契约四档之外发现两档：
  - **[minor] 12px**：`.drawer-item-convert`（player.css:689）、`.task-badge`（main.css:9134）
  - **[minor] 10px**：`.media-task-badge`（main.css:9254）
  - 徽标类小字号是常见变通，但契约 Typography 表未声明徽标档位，属契约外字号；建议补记或收敛到 13px。
- 字重分布：400/600 为主，但 **[minor] `.drawer-item-convert` 用 `font-weight: 500`（player.css:690）**——契约明确「字重只用 400 + 600 两档」，应改 600（CTA 语义也更贴合）。
- tabular-nums 覆盖：time-display（player.css:356）、红点 tooltip（:507）、抽屉 meta（:630）、task-time（main.css:9171）、角标数字（:9263）✅——数字跳动约束执行完整。
- 单行截断：抽屉标题（player.css:603-606）、task-title（main.css:9178-9180）、产物路径任意断行 + tooltip（main.css:9211、tasks-page.js:223）✅
- **[minor] 抽屉空态标题 14px/600**（player.css:729-730）：契约 Heading 档为 16px/600；小空态用 14 可辩护，但与「暂无媒体任务」空态（download-empty-title）的档位未对齐核对。

### Pillar 5: Spacing (3/4)

- 布局级间距严守 4 的倍数：抽屉面板 padding 16px（player.css:534）、条目 padding 12px 8px、任务卡片 padding 12px / gap 8px（main.css:9120-9123）、分区间距 24px、页面级留白 24px（main.css:9088）✅
- **[minor] 契约外微偏移散点**（均不在例外清单——例外仅声明进度条 track 3px/5px）：
  - `gap: 6px`：`.drawer-delete-option`（player.css:769）——4 的倍数破坏者，改 4 或 8
  - `top: 9px`：`#record-dot`（player.css:477）
  - `padding: 3px 10px`：`.drawer-item-convert`（player.css:688）
  - `padding: 2px 8px`：`.task-badge`（main.css:9136）
  - `margin-top: -4.5px`：音量 thumb 垂直居中（player.css:387）——有注释论证，建议同进度条一样列入契约例外清单
- 进度条 3px/5px hover 变高与契约例外一致（player.css:230/239）；任务页 4px 进度条（main.css:9185）与 Component #7 规格一致 ✅
- **[minor] 转换按钮锚定偏移**：`top:8px/right:36px`（player.css:686-687）与删除按钮 `top:10px/right:8px`（:654-655）顶部基线不齐（8 vs 10）——hover 同显时轻微错位。

### Pillar 6: Experience Design (3/4)

**覆盖充分项：**
- 空态：抽屉（player.js:961 切 `.drawer-empty.visible`）+ 任务页整页空态且空分区隐藏（tasks-page.js:160-171）✅
- 降级/错误：D-10 提示条 4s 自动消失（player.js:778-784）、hls 重试 ≤3 次 + FRAG_LOADED 复位计数防永久失效（player.js:194-216）、任务页操作失败反馈条 `role="alert"` textContent 防注入（tasks-page.js:321-331）、主窗口终态 toast 点击定位（renderer.js:10619）✅
- 破坏性确认：删除缓存 dialog `margin: auto` + `::backdrop`（player.css:744/754，居中约定合规，非 div 遮罩）、关窗确认 checkbox 记忆 + appQuitting 防双弹、退出确认 hasActiveTasks（main.js:4357）✅
- 禁用语义：转换按钮按 D-17「隐藏非置灰」（player.js:1008 gating + 主进程三层复校）✅
- zero-one-many：角标 count>0 显示归零消失（renderer.js:10575）、点击 openUrl 收敛统一导航入口（renderer.js:10601）✅
- buffered 段可视化缓存覆盖范围（player.html:46、player.css:242）✅

**缺陷（支撑扣分）：**
- **[WARNING] 转换发起失败静默**：见 Top Fix 2。G-44-9 只补了任务页反馈，播放器内同一链路的失败仍无声。
- **[WARNING] 删除缓存失败静默**：`player.js:1113-1115` catch 仅 `console.error`，IPC 失败（如文件占用）时用户无感知且列表照旧 — 建议复用降级提示条样式给一次性反馈。
- **[minor] 任务页无加载态 + 轮询失败不可见**：首次 loadTasks 前无 loading 指示（叠加 Pillar 2 的首帧闪现问题）；5s 轮询失败仅 console.error（tasks-page.js:140），服务端不可达时页面静默展示陈旧数据 — 可接受但建议首次加载加轻量 loading、连续失败在页头提示「数据同步失败」。
- **[minor] apiAction 无防重复点击**：停止/续转按钮点击后不禁用（tasks-page.js:291-312），双击触发两次 POST — 服务端幂等兜底了大部分场景，仍建议按钮点击即禁用至 loadTasks 返回。
- **[minor] 关窗确认实现偏离 Component #6 机制**：spec 写「原生 `<dialog>` + showModal()」，实现为主进程 `dialog.showMessageBox`（ipc-handlers.js:2155，44-04 记录了理由：与 close 拦截同层、销毁时序可控）——OS 原生弹框居中天然满足，用户可见结果等效，但与契约字面不符，建议在 UI-SPEC 补记偏离。

---

## Files Audited

- `src/player.html`（全量 160 行）
- `src/player.css`（全量 822 行）
- `src/player.js`（关键段：错误处理 :180-230、进度上报/降级提示 :740-784、录制 UI :786-923、抽屉渲染/删除确认 :945-1124）
- `src/tasks.html`（全量 53 行）
- `src/tasks-page.js`（全量 368 行）
- `src/styles/main.css`（任务页/角标/反馈条/toast-clickable 段 :1477, :8984-9273）
- `src/settings.html`（多媒体分区 :568-605）
- `src/settings-page.js`（视频缓存事件 :254-264, :436-445, :1347-1389）
- `src/index.html`（媒体任务角标 :276-283）
- `src/renderer.js`（角标/终态 toast :4244-4248, :10570-10630）
- `main.js`（CONVERT_FAIL_TEXT :3022、退出确认 :4357）
- `ipc-handlers.js`（关窗确认 :2152-2181）
- `media-cache-manager.js`（disk_full 路径 :384-496，交叉验证）

**Registry audit：** shadcn 未初始化（无 components.json），UI-SPEC 声明无第三方 registry——跳过，无 flag。
