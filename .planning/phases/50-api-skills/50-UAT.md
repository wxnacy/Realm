---
status: testing
phase: 50-api-skills
source: [50-VERIFICATION.md]
started: 2026-09-14T15:55:00Z
updated: 2026-09-14T15:55:00Z
---

## Current Test

number: 1
name: 设置页在 `realm://` CSP 下加载 `skill-picker-model.js`
expected: |
  DevTools 断言 `window.SkillPickerModel` 存在，且两个空态分支按 `refreshedAt`（=== 0 / > 0）而非「数组为空」判定
awaiting: user response

## Tests

### 1. 设置页在 `realm://` CSP 下加载 `skill-picker-model.js`（research A3）
expected: DevTools 断言 `window.SkillPickerModel` 存在，且两个空态分支按 `refreshedAt`（=== 0 / > 0）而非「数组为空」判定
result: [pending]

### 2. 未配置任何 AI provider 时仍能列出随包内置技能（D-19 锁定决策的验收面）
expected: 打开设置页「技能管理」区，**两个内置技能在列**且 `refreshedAt > 0`，不出现「技能列表尚未加载」（可用从未配置过 provider 的 `realm-dev` 用户数据，或临时清空 `settings.ai` 的 Key）
result: [pending]

### 3. 打包态（`make install` 产物）列出内置技能
expected: `make install` → 启动 `/Applications/Realm.app` → 打开设置页，内置技能组列出两个技能；播种失败时顶部汇总条须给出 `realm_*` 诊断，**不得**静默为空
result: [pending]

### 4. 禁用后在 `/` 面板的可见性（跨进程半边）
expected: 禁用某技能 → 同一会话打开 `/` 面板，断言该技能不在列表；重新启用即恢复
result: [pending]

### 5. 多窗口 / 多设置页实例间即时同步
expected: 开两个设置页标签，在 A 禁用某技能 → 回 B **手动重进该页**，列表已同步（**不**断言 A 改动后 B 即时刷新 —— 不做即时同步是 D-18 的设计）
result: [pending]

### 6. 413 拒收探针在 **Electron 内**复跑（research A4）
expected: `npm run dev` 后在渲染进程 DevTools 向 `/api/skills/set-disabled` POST 一个 > 1 MiB 的 body，断言 413 + JSON 且主进程堆不线性增长
result: [pending]

### 7. 100 条技能时的渲染耗时 / 滚动密度 / 投影字节数（research A6）
expected: 造 100 条技能（描述取上限）→ 打开设置页，记录首次渲染耗时与滚动流畅度，并在 DevTools 量 `/api/skills/list` 响应体字节数（结构性依据是投影不含正文；~200 KB 上界是**估值、未经实测**）
result: [pending]

### 8. 启停四态与卸载确认弹框的运行时行为（`behavior_unverified_items` 1/2）
expected: |
  启停：点击瞬间开关乐观翻转 `.on` / `aria-checked` 并进入在途态（`disabled`）；成功保持；**失败必须回滚到点击前状态并解除 disabled**，区级 hint 给出按 `code` 查表的文案。
  卸载：响应到达前弹框保持打开且「卸载」按钮为 `disabled`；失败 ⇒ 弹框关闭、行内状态不变 + danger hint；`not_found` 时该行随重拉自然消失。
result: [pending]

### 9. 800px 最小窗口下行首行是否单行不换行（E5 backstop）
expected: `npm run dev` → 窗口缩到最小（800px）→ 设置页「技能管理」区构造最宽形态行（同时命中诊断徽标 + 「已遮蔽」状态标注 + 开关 + 卸载按钮）⇒ 每行首行**单行**且右侧操作簇完整可见（不被裁切、不与描述重叠、头部高度不变），仅技能名缩到省略号（`title` 仍可读全名）
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

<!-- verify-work 回填。第 8 项特别标注：REVIEW 的 WR-02（`sw.disabled = true` 位于 await 之前 ⇒ Chromium blur，焦点掉到 `<body>`，`restoreSkillManageFocus` 永不生效）是同一行为面上的**既有挂账缺陷**，因此第 8 项不得以「测试环境不具备」豁免。 -->
