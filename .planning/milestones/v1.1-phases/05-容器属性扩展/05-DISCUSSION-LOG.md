# Phase 5: 容器属性扩展 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 5-容器属性扩展
**Areas discussed:** 属性字段布局, 数据验证规则, 备注字段限制, 旧数据兼容策略

---

## 属性字段布局

| Option | Description | Selected |
|--------|-------------|----------|
| 单列垂直排列 | 每个字段独占一行，垂直排列（邮箱、手机号、备注依次排列） | ✓ |
| 两列并排 + 备注独占 | 邮箱和手机号并排显示，备注独占一行（节省垂直空间） | |
| 分组折叠 | 扩展属性放在「更多信息」折叠区域，默认收起 | |

**User's choice:** 单列垂直排列
**Notes:** 采用单列垂直排列方式，在现有属性（名称、颜色、图标）下方依次显示邮箱、手机号、备注字段

---

## 数据验证规则

| Option | Description | Selected |
|--------|-------------|----------|
| 宽松格式验证 | 邮箱只检查 @ 格式，手机号只检查数字长度（11位），不强制填写 | ✓ |
| 严格格式验证 | 邮箱正则验证格式，手机号验证国际格式，不填写时显示提示 | |
| 完全可选，无验证 | 所有字段都是可选的，不进行任何格式验证，用户自由填写 | |

**User's choice:** 不填时作为可选。添了做宽松格式验证
**Notes:** 所有扩展属性都是可选字段，填写时进行宽松格式验证

---

## 备注字段限制

| Option | Description | Selected |
|--------|-------------|----------|
| 单行，限 200 字符 | 简单的文本输入框，最多 200 字符，适合简短备注 | |
| 多行，限 500 字符 | textarea 输入框，最多 500 字符，可换行 | ✓ |
| 多行，无限制 | textarea 输入框，不限制长度（但 UI 上控制高度） | |

**User's choice:** 多行，限 500 字符
**Notes:** 备注字段使用 textarea 多行输入框，最大长度限制为 500 字符

---

## 旧数据兼容策略

| Option | Description | Selected |
|--------|-------------|----------|
| 读取时惰性填充 | 每次读取容器数据时，检查并填充缺失字段的默认值（简单、性能略低） | ✓ |
| 启动时批量迁移 | 应用启动时一次性迁移所有容器数据，填充缺失字段（性能更好，但需要迁移逻辑） | |

**User's choice:** 读取时惰性填充
**Notes:** 采用读取时惰性填充策略，每次读取容器数据时检查并填充缺失字段的默认值

---

## Claude's Discretion

- 新容器创建时，扩展属性默认为空字符串
- 表单提交时，空字符串字段不会触发验证
- 容器列表和下拉面板不需要显示扩展属性

## Deferred Ideas

None — discussion stayed within phase scope
