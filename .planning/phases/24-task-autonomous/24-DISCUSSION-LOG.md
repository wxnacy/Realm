# Phase 24: 任务自主执行 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 24-任务自主执行
**Areas discussed:** 表单字段定位策略, 操作确认 UI 模式, 元素定位与操作设计, 安全防护与边界处理

---

## 表单字段定位策略

### Q1: AI 填表时如何定位表单字段？

| Option | Description | Selected |
|--------|-------------|----------|
| CSS 选择器 | AI 返回 CSS 选择器如 input[name="email"]，精确但依赖页面结构 | |
| ARIA 语义 + 文本匹配 | 优先用 placeholder/label/aria-label 文本匹配，更贴近人类理解 | ✓ |
| AI 自主选择 | AI 自行决定用什么方式定位，灵活性最高但一致性最差 | |

**User's choice:** ARIA 语义 + 文本匹配（推荐）
**Notes:** 用户询问了能力对比和 Tabbit 做法，Claude 提供了对比表后用户选择了 ARIA 语义方案

### Q2: fill_form 工具的参数格式？

| Option | Description | Selected |
|--------|-------------|----------|
| 字段名 + 值 | AI 返回 { field: "邮箱", value: "test@example.com" }，CDP 端多策略查找 | ✓ |
| 选择器 + 值 | AI 返回 CSS 选择器和值，精确但耦合页面结构 | |
| 自然语言指令 | AI 返回自然语言描述，CDP 端解析并执行 | |

**User's choice:** 字段名 + 值（推荐）
**Notes:** 用户要求对比三种方案后选择了字段名+值

### Q3: 需要支持哪些表单元素类型？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础输入 + 下拉框 | input/textarea/select | |
| 基础 + 选择器 + 上传 | + checkbox/radio/file upload/date picker | |
| 全覆盖（含富文本） | + contenteditable/iframe 内表单/CAPTCHA 字段检测 | ✓ |

**User's choice:** 全覆盖（含富文本）

### Q4: 字段找不到时如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 报错 + 告知用户 | 返回"找不到该字段"错误 | |
| 报错 + 返回可用字段 | 返回所有可用字段列表，AI 可以选择最接近的 | ✓ |
| 模糊匹配兜底 | 自动用模糊匹配找最接近的字段 | |

**User's choice:** 报错 + 返回可用字段

---

## 操作确认 UI 模式

### Q5: 写操作执行前的确认 UI 形式？

| Option | Description | Selected |
|--------|-------------|----------|
| 模态弹窗 | 页面中央模态弹窗，阻塞页面操作 | |
| 聊天内联确认 | AI 聊天面板内显示确认卡片，不阻塞页面 | ✓ |
| 底部确认条 | 页面底部确认条，不阻塞 | |

**User's choice:** 聊天内联确认
**Notes:** 用户询问了哪个比较好，Claude 推荐模态弹窗但用户选择了聊天内联确认，更看重不阻塞页面的流畅体验

### Q6: 确认卡片需要展示哪些信息？

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁版 | 仅显示操作类型和目标 | |
| 标准版 | 操作类型 + 具体值 | |
| 详细版 | 操作类型 + 值 + 目标页面 URL + 容器名 + 风险等级 | ✓ |

**User's choice:** 详细版

### Q7: 哪些操作需要用户确认？

| Option | Description | Selected |
|--------|-------------|----------|
| 仅高风险操作 | 表单提交、文件上传、支付相关 | ✓ |
| 所有写操作 | 填写、点击、滚动、提交都需要确认 | |
| 可配置 | 用户可自行设置 | |

**User's choice:** 仅高风险操作
**Notes:** 偏离 Roadmap 原要求"所有写操作必须用户确认"，用户明确确认此偏离

### Q8: 哪些算"高风险操作"？

| Option | Description | Selected |
|--------|-------------|----------|
| 提交类操作 | 表单提交(submit)、文件上传、支付相关 | ✓ |
| 提交 + 数据变更 + 跳转 | + 删除/修改数据 + 导航跳转 | |
| 全面高风险 | + 页面权限请求 | |

**User's choice:** 提交类操作

---

## 元素定位与操作设计

### Q9: execute_action 如何定位目标元素？

| Option | Description | Selected |
|--------|-------------|----------|
| 文本描述定位 | AI 描述元素的可见文本，CDP 端通过 text/aria-label 匹配 | |
| CSS 选择器 | AI 返回 CSS 选择器 | |
| 文本优先 + 选择器兜底 | AI 优先用文本描述，找不到时用 CSS 选择器作为兜底 | ✓ |

**User's choice:** 文本优先 + 选择器兜底（推荐）

### Q10: execute_action 需要支持哪些操作类型？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础交互 | click/scroll/type/select/check/focus | |
| 扩展交互 | + submit/upload/drag/hover/keydown | |
| 全覆盖（含脚本） | + execute_script/screenshot/wait_for_element | ✓ |

**User's choice:** 全覆盖（含脚本）

### Q11: execute_action 工具的参数格式？

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化参数 | AI 返回 { action: 'click', target: '提交按钮' } | ✓ |
| 自然语言指令 | AI 返回自然语言如"点击页面上的提交按钮" | |

**User's choice:** 结构化参数（推荐）
**Notes:** 用户询问了哪个比较好，Claude 对比后推荐结构化参数（行业标准、可靠、可校验）

### Q12: 操作执行后返回什么结果？

| Option | Description | Selected |
|--------|-------------|----------|
| 简洁确认 | 返回 success: true | |
| 结果 + 页面变化 | 返回操作结果 + 页面变化（新 URL、弹窗、验证错误） | ✓ |
| 结果 + 变化 + 截图 | + 操作后截图（base64） | |

**User's choice:** 结果 + 页面变化（推荐）

---

## 安全防护与边界处理

### Q13: Prompt Injection 攻击的防护策略？

| Option | Description | Selected |
|--------|-------------|----------|
| 输入消毒 | 过滤危险字符如 <script>、javascript:、eval | |
| 脚本静态分析 | 检测 eval、Function、fetch 等危险调用 | |
| 多层防护 | 输入消毒 + 脚本静态分析 + 沙箱执行 | ✓ |

**User's choice:** 多层防护（推荐）

### Q14: 遇到 CAPTCHA 或 2FA 页面时如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 提示 + 停止 | 返回"检测到验证码，请手动操作" | |
| 暂停 + 等待恢复 | 暂停当前任务，等待用户手动完成后继续 | ✓ |
| 跳过 + 继续 | 跳过验证码步骤，继续执行其他操作 | |

**User's choice:** 暂停 + 等待恢复（推荐）

### Q15: 如何检测 CAPTCHA/2FA？

| Option | Description | Selected |
|--------|-------------|----------|
| 特征检测 | 检测常见 CAPTCHA 框架和 2FA 输入框 | |
| 特征 + 关键词 | 特征检测 + 页面内容关键词分析 | ✓ |
| 全面检测 | 特征 + 关键词 + AI 语义理解 | |

**User's choice:** 特征 + 关键词（推荐）

### Q16: execute_script 如何保证安全？

| Option | Description | Selected |
|--------|-------------|----------|
| 黑名单禁止 | 禁止 eval、new Function、import()、require() 等 | |
| 白名单允许 | 仅允许 DOM 操作和页面交互 API | ✓ |
| 沙箱隔离 | 在独立沙箱环境（vm2/quickjs）中运行 | |

**User's choice:** 白名单允许（推荐）

---

## Claude's Discretion

无 — 所有关键决策已由用户确认。

## Deferred Ideas

None — discussion stayed within phase scope
