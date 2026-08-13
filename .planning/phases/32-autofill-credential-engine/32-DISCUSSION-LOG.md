# Phase 32: 自动填充 — 凭据引擎 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 32-自动填充 — 凭据引擎
**Areas discussed:** 表单检测策略, 保存提示 UI 形态, 自动填充时机与交互, autofill/fillForm 互斥机制

---

## 表单检测策略

### Q1: webview-preload.js 中何时检测登录表单？

| Option | Description | Selected |
|--------|-------------|----------|
| 页面加载后一次性扫描 | 页面加载完成后扫描一次 DOM，查找登录表单。简单可靠，但 SPA 动态加载的表单可能漏检。 | |
| MutationObserver 持续监听 | 持续监听 DOM 变化，新表单出现时立即检测。能处理 SPA 动态加载，但性能开销略高。 | |
| 两者结合（推荐） | 先在页面加载时扫描一次，之后用 MutationObserver 监听后续变化。兼顾可靠性和 SPA 支持。 | ✓ |

**User's choice:** 两者结合（推荐）
**Notes:** 兼顾可靠性和 SPA 支持

### Q2: 如何判断一个表单是「登录表单」？

| Option | Description | Selected |
|--------|-------------|----------|
| password 字段存在即为登录表单（推荐） | 查找包含 type=password 的 input 元素的 form。简单准确，覆盖 99% 登录场景。 | |
| 多字段特征匹配 | 分析 form 内所有 input 的 type/name/autocomplete 属性，用规则引擎判断是否为登录/注册表单。更精确但复杂。 | |
| 两层检测 | 用简单规则（password 存在）做初筛，再用特征匹配做精细分类（登录 vs 注册 vs 密码修改）。 | ✓ |

**User's choice:** 两层检测
**Notes:** 第一层 password 字段存在即为登录表单，第二层多字段特征匹配精细分类

### Q3: 如何检测用户「提交了登录表单」这个动作？

| Option | Description | Selected |
|--------|-------------|----------|
| 监听 form submit 事件（推荐） | 监听 form 的 submit 事件，在提交时捕获凭据。可靠但需要表单使用原生 submit。 | ✓ |
| 监听提交按钮点击 | 监听 password 字段所在 form 内的 button[type=submit] 点击。兼容更多场景。 | |
| 两者结合 | 同时监听 submit 和 button click，用防抖去重。覆盖最广。 | |

**User's choice:** 监听 form submit 事件（推荐）
**Notes:** 可靠且简单

### Q4: 如何从提交的表单中提取用户名和密码？

| Option | Description | Selected |
|--------|-------------|----------|
| 直接读取 input value（推荐） | 从 form 内查找 input[type=text/email] 和 input[type=password]，读取 value。简单直接。 | ✓ |
| FormData 序列化 | 在 submit 事件中拦截，序列化整个 form 数据。能捕获隐藏字段（如 CSRF token），但可能包含无关数据。 | |
| 直接读取 + 隐藏字段识别 | 直接读取 username/password 字段，额外识别隐藏字段中的 username 相关字段（如 email、phone）。 | |

**User's choice:** 直接读取 input value（推荐）
**Notes:** 简单直接，覆盖主要场景

---

## 保存提示 UI 形态

### Q5: 用户提交登录表单后，保存凭据的提示出现在哪里？

| Option | Description | Selected |
|--------|-------------|----------|
| 工具栏下方弹出横幅（推荐） | 类似 Chrome，在 URL 栏下方弹出一个小横幅提示「是否保存密码？」。用户熟悉，不遮挡页面。 | ✓ |
| 页面内居中弹窗 | 在页面中央弹出一个小型对话框。醒目但可能遮挡内容。 | |
| 工具栏图标 + 点击展开 | 在 URL 栏右侧显示一个小图标，点击后展开保存选项。最不干扰但发现性低。 | |

**User's choice:** 工具栏下方弹出横幅（推荐）
**Notes:** 用户熟悉 Chrome 的交互方式

### Q6: 保存提示横幅显示哪些内容和操作按钮？

| Option | Description | Selected |
|--------|-------------|----------|
| 保存/永不 两按钮（推荐） | 显示「是否为 [网站名] 保存密码？」+ 两个按钮「保存」「永不」。简洁明了。 | |
| 保存/永不/暂不 三按钮 | 显示「是否为 [网站名] 保存密码？」+ 三个按钮「保存」「永不」「暂不」。给用户更多控制。 | ✓ |
| 显示用户名 + 两按钮 | 显示用户名 + 网站名 + 保存/永不按钮。让用户确认具体是哪个账号。 | |

**User's choice:** 保存/永不/暂不 三按钮
**Notes:** 给用户更多控制权

### Q7: 用户点击「永不」后，如何记住这个选择？

| Option | Description | Selected |
|--------|-------------|----------|
| 记录到凭据存储（推荐） | 在凭据存储中记录该网站的「永不保存」标记，后续不再提示。可重置。 | ✓ |
| 记录到 electron-store | 在 electron-store 中维护一个「永不保存网站」列表。全局设置，不按容器。 | |
| 仅当前会话有效 | 不记录，每次提交都提示。「永不」仅对当前会话有效。 | |

**User's choice:** 记录到凭据存储（推荐）
**Notes:** 按容器隔离，可重置

### Q8: 保存提示横幅的自动消失行为？

| Option | Description | Selected |
|--------|-------------|----------|
| 10 秒后自动消失（推荐） | 横幅显示 10 秒后自动消失，等同于「暂不」。用户不操作也不会一直遮挡。 | ✓ |
| 一直显示直到操作 | 横幅一直显示直到用户操作或页面导航。确保用户看到，但可能遮挡。 | |
| 5 秒后自动消失 | 横幅显示 5 秒后自动消失。更快消失但用户可能错过。 | |

**User's choice:** 10 秒后自动消失（推荐）
**Notes:** 平衡可见性和不干扰

---

## 自动填充时机与交互

### Q9: 用户再次访问已保存凭据的网站时，何时填充？

| Option | Description | Selected |
|--------|-------------|----------|
| 页面加载后自动填充（推荐） | 页面加载完成后，如果该网站有保存的凭据，立即自动填充用户名和密码。用户无需操作。 | ✓ |
| 用户点击图标后填充 | 页面加载后在密码字段旁显示一个小图标，用户点击后才填充。用户有完全控制权。 | |
| 自动填用户名 + 点击填密码 | 自动填充用户名，密码字段显示为 placeholder 或需要用户点击后才填充。平衡便捷和安全。 | |

**User's choice:** 页面加载后自动填充（推荐）
**Notes:** 便捷，用户无需额外操作

### Q10: 同一网站保存多个凭据时如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 只保存一个凭据（推荐） | 只保存和填充该网站的最后一个凭据。简单，Chrome 默认行为。 | ✓ |
| 多账号列表选择 | 允许同一网站保存多个凭据，自动填充时显示账号列表让用户选择。适合多账号用户。 | |
| 一个凭据 + 设置页管理 | 只保存一个凭据，但用户可以在设置页管理（Phase 33）。 | |

**User's choice:** 只保存一个凭据（推荐）
**Notes:** 简单，Chrome 默认行为

### Q11: 自动填充完成后是否显示视觉反馈？

| Option | Description | Selected |
|--------|-------------|----------|
| 无额外反馈（推荐） | 填充后无额外视觉反馈，用户直接看到字段已填好。简洁。 | ✓ |
| 显示填充来源图标 | 填充后在密码字段旁显示一个小图标，表示「由 Realm 自动填充」。可点击清除。 | |
| 短暂 toast 提示 | 填充后短暂显示 toast 提示「已自动填充」。明确告知但可能干扰。 | |

**User's choice:** 无额外反馈（推荐）
**Notes:** 简洁，不干扰用户

### Q12: 页面刷新或重新导航时是否再次自动填充？

| Option | Description | Selected |
|--------|-------------|----------|
| 每次都填充（推荐） | 同一页面刷新或重新导航时仍然自动填充。用户无需重复操作。 | ✓ |
| 会话内只填充一次 | 同一页面会话内只填充一次，刷新后不再填充。避免重复操作但用户可能需要。 | |
| 字段为空时才填充 | 每次填充前先检查字段是否为空，非空则不填充。避免覆盖用户手动输入。 | |

**User's choice:** 每次都填充（推荐）
**Notes:** 用户无需重复操作

---

## autofill/fillForm 互斥机制

### Q13: AI 填表（CDP fillForm）激活时，如何禁用浏览器 autofill？

| Option | Description | Selected |
|--------|-------------|----------|
| fillForm 激活时临时禁用 autofill（推荐） | AI 填表（fillForm）激活时，临时禁用该 webview 的 autofill 检测。fillForm 完成后恢复。 | ✓ |
| IPC 通知禁用/恢复 | fillForm 执行前发送 IPC 通知主进程禁用 autofill，完成后通知恢复。双向通信。 | |
| 全局标志位控制 | 在 webview-preload.js 中维护一个全局标志，fillForm 通过 executeJavaScript 设置标志。 | |

**User's choice:** fillForm 激活时临时禁用 autofill（推荐）
**Notes:** 简单直接，无需复杂通信

### Q14: fillForm 和 autofill 的优先级关系？

| Option | Description | Selected |
|--------|-------------|----------|
| fillForm 优先（推荐） | fillForm 优先级高于 autofill。AI 填表时自动禁用 autofill，fillForm 完成后恢复。 | ✓ |
| autofill 优先 | autofill 优先级高于 fillForm。用户手动启用 autofill 时，fillForm 被禁用。 | |
| 先到先得 | 两者互斥但无固定优先级，谁先激活谁优先。后激活的被忽略。 | |

**User's choice:** fillForm 优先（推荐）
**Notes:** AI 填表优先级更高

### Q15: fillForm 完成后如何恢复 autofill？

| Option | Description | Selected |
|--------|-------------|----------|
| 自动恢复（推荐） | fillForm 完成后自动恢复 autofill 检测。无需用户干预。 | ✓ |
| 用户确认后恢复 | fillForm 完成后显示一个提示「是否恢复自动填充？」，用户确认后恢复。 | |
| 不自动恢复 | fillForm 完成后不自动恢复，用户需要手动重新启用 autofill。 | |

**User's choice:** 自动恢复（推荐）
**Notes:** 无需用户干预

### Q16: fillForm 激活后，autofill 禁用的持续时间？

| Option | Description | Selected |
|--------|-------------|----------|
| 仅执行期间禁用（推荐） | 只在 fillForm 执行期间禁用 autofill，执行完立即恢复。精确控制。 | ✓ |
| 禁用到页面导航 | fillForm 激活后禁用 autofill 直到页面导航或刷新。避免冲突但可能过度禁用。 | |
| 禁用到手动恢复 | fillForm 激活后禁用 autofill 直到用户手动恢复。最保守但最不便捷。 | |

**User's choice:** 仅执行期间禁用（推荐）
**Notes:** 精确控制，避免过度禁用

---

## Claude's Discretion

无 — 用户对所有问题都做出了明确选择。

## Deferred Ideas

None — discussion stayed within phase scope
