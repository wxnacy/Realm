# Phase 5: 容器属性扩展 - Research

**Researched:** 2026-07-25
**Domain:** Electron 容器数据模型扩展 + 表单 UI 增量修改
**Confidence:** HIGH

## Summary

本阶段为现有容器管理系统扩展三个新属性：手机号（phone）、邮箱（email）、备注（notes）。核心改动集中在四个文件：`container-manager.js`（数据模型）、`src/index.html`（表单 UI）、`src/renderer.js`（表单交互逻辑）、`src/styles/main.css`（textarea 样式）。

项目已具备完整的容器 CRUD 流程、electron-store 持久化、IPC 通信链路。本阶段是在已有架构上的增量修改，不涉及新依赖引入、不涉及架构变更、不涉及新 IPC 通道。所有扩展属性为可选字段，采用读取时惰性填充策略确保旧数据兼容。

**Primary recommendation:** 直接扩展现有容器数据模型和编辑表单，无需引入新库或新模式。改动范围小、风险低，属于纯增量开发。

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATTR-01 | 用户可以为容器设置手机号属性 | 扩展 container-manager.js 数据模型 + 编辑 Modal 表单 |
| ATTR-02 | 用户可以为容器设置邮箱属性 | 同上，新增 email 字段 |
| ATTR-03 | 用户可以为容器设置备注属性 | 同上，新增 notes 字段（textarea） |
| ATTR-04 | 容器属性在编辑容器 Modal 中展示和编辑 | 修改 index.html 表单结构 + renderer.js 表单逻辑 |
| ATTR-05 | 旧版本容器数据自动兼容（缺失字段填充默认值） | 读取时惰性填充策略，在 getContainers()/getContainer() 中实现 |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 采用单列垂直排列方式，在现有属性（名称、颜色、图标）下方依次显示邮箱、手机号、备注字段
- **D-02:** 每个字段独占一行，与现有表单风格保持一致
- **D-03:** 所有扩展属性（手机号、邮箱、备注）都是可选字段
- **D-04:** 填写时进行宽松格式验证：邮箱检查 @ 格式，手机号检查数字长度（11位）
- **D-05:** 不填写时不显示任何验证错误或提示
- **D-06:** 备注字段使用 textarea 多行输入框
- **D-07:** 备注字段最大长度限制为 500 字符
- **D-08:** 备注字段支持换行输入
- **D-09:** 采用读取时惰性填充策略，每次读取容器数据时检查并填充缺失字段的默认值
- **D-10:** 缺失字段的默认值为空字符串：`phone: ''`, `email: ''`, `notes: ''`
- **D-11:** 不需要启动时批量迁移，减少启动开销

### Claude's Discretion

- 新容器创建时，扩展属性默认为空字符串
- 表单提交时，空字符串字段不会触发验证
- 容器列表和下拉面板不需要显示扩展属性

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 容器数据模型扩展 | Main Process (container-manager.js) | — | 数据结构定义和持久化由主进程管理 |
| 旧数据兼容（惰性填充） | Main Process (container-manager.js) | — | 读取路径在主进程，填充逻辑应在读取时完成 |
| 表单 UI 扩展 | Renderer (index.html + renderer.js) | — | 表单是纯渲染进程职责 |
| 表单验证 | Renderer (renderer.js) | — | 客户端验证，不涉及主进程 |
| 持久化 | Main Process (electron-store) | — | 已有机制，无需修改 |

## Standard Stack

### Core

本阶段不引入任何新依赖。所有改动基于已有技术栈：

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-store | 8.1.0+ | 容器配置持久化 | 已在项目中使用，直接扩展数据结构 |
| Electron Session API | 32.x | 容器隔离 | 内置 API，无需额外安装 |

### Supporting

无。本阶段为纯增量修改，不涉及新工具或库。

### Installation

无需安装任何新包。

## Package Legitimacy Audit

本阶段不引入新包，无需进行包合法性审计。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| （无新包） | — | — | — |

## Architecture Patterns

### 现有数据流（需修改的路径）

```
用户点击编辑容器
    │
    ▼
renderer.js: showEditContainerModal(containerId)
    │  从 state.containers 读取容器数据
    │  填充表单字段（名称、颜色、图标）  ← 需扩展：填充 phone, email, notes
    ▼
用户修改表单 → 点击保存
    │
    ▼
renderer.js: containerForm submit handler
    │  收集表单数据 { name, color, icon }  ← 需扩展：收集 phone, email, notes
    │  调用 window.realmAPI.updateContainer(id, data)
    ▼
preload.js → IPC → main.js → container-manager.updateContainer()
    │  更新容器属性  ← 需扩展：处理 phone, email, notes
    │  持久化到 electron-store
    ▼
完成
```

### Recommended Changes by File

```
container-manager.js        # 数据模型 + 惰性填充 + create/update 扩展
src/index.html              # 编辑 Modal 表单新增 3 个字段
src/renderer.js             # 表单填充 + 收集 + 验证逻辑
src/styles/main.css         # textarea 样式
```

### Pattern 1: 惰性填充（Lazy Fill）

**What:** 在读取容器数据时，检查缺失字段并填充默认值
**When to use:** 旧版本容器数据缺少新字段时
**Example:**
```javascript
// container-manager.js - getContainers() 中的惰性填充
function getContainers() {
  return Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    phone: c.phone || '',    // 旧数据缺失时填充空字符串
    email: c.email || '',    // 旧数据缺失时填充空字符串
    notes: c.notes || '',    // 旧数据缺失时填充空字符串
  }));
}
```

### Pattern 2: 表单字段扩展

**What:** 在现有表单中添加新字段，复用已有的 .form-group 样式
**When to use:** 容器编辑 Modal 扩展
**Example:**
```html
<!-- index.html - 容器编辑 Modal 中添加扩展属性 -->
<!-- 在 emoji-picker form-group 之后、form-actions 之前插入 -->
<div class="form-divider"></div>
<div class="form-group">
  <label for="containerEmailInput">邮箱</label>
  <input type="email" id="containerEmailInput" placeholder="例如：user@example.com" maxlength="100">
  <div class="error-message" id="emailError"></div>
</div>
<div class="form-group">
  <label for="containerPhoneInput">手机号</label>
  <input type="tel" id="containerPhoneInput" placeholder="例如：13800138000" maxlength="11">
  <div class="error-message" id="phoneError"></div>
</div>
<div class="form-group">
  <label for="containerNotesInput">备注</label>
  <textarea id="containerNotesInput" placeholder="可选填写备注信息..." maxlength="500" rows="4"></textarea>
  <div class="error-message" id="notesError"></div>
</div>
```

### Anti-Patterns to Avoid

- **在启动时批量迁移旧数据:** 不需要。惰性填充策略更简单，且避免迁移逻辑的复杂性
- **在容器列表/下拉面板显示扩展属性:** 不需要。扩展属性仅在编辑 Modal 中展示
- **严格验证格式:** 用户决策为宽松验证。邮箱只检查 @，手机号只检查 11 位数字

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 邮箱验证 | 复杂正则 | 简单检查 `@` | 用户要求宽松验证 |
| 手机号验证 | 国际格式解析 | 检查 11 位数字 | 用户要求宽松验证 |
| 数据迁移 | 迁移脚本 | 惰性填充 | 用户决策 D-09 |

## Common Pitfalls

### Pitfall 1: 旧数据缺少新字段导致 undefined

**What goes wrong:** 从 electron-store 读取的旧容器数据没有 phone/email/notes 字段，访问时返回 undefined
**Why it happens:** 旧版本保存的容器配置只有 id/name/color/icon
**How to avoid:** 在 getContainers() 和 getContainer() 返回时使用 `|| ''` 确保默认值
**Warning signs:** 编辑 Modal 打开时字段显示 undefined 而非空

### Pitfall 2: textarea 换行符持久化

**What goes wrong:** textarea 的换行符（\n）在 electron-store JSON 序列化/反序列化时可能丢失
**Why it happens:** JSON 标准支持 \n，但某些场景下需要确认
**How to avoid:** electron-store 使用 JSON 序列化，\n 会被正确保留。无需额外处理
**Warning signs:** 备注中的换行在重启后消失

### Pitfall 3: 表单提交时空字符串覆盖已有值

**What goes wrong:** 用户编辑容器时清空某个字段，提交时空字符串应该覆盖原值
**Why it happens:** 需要区分"未修改"和"清空"
**How to avoid:** 本阶段不需要区分。所有字段在每次提交时都完整发送，空字符串表示清空
**Warning signs:** 用户清空备注后保存，重启发现备注又出现了

## Code Examples

### 容器数据模型扩展

```javascript
// container-manager.js - DEFAULT_CONTAINERS 扩展
const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: '🌐', phone: '', email: '', notes: '' },
  { id: 'work', name: '工作', color: '#3B82F6', icon: '💼', phone: '', email: '', notes: '' },
  { id: 'personal', name: '个人', color: '#10B981', icon: '👤', phone: '', email: '', notes: '' },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦', phone: '', email: '', notes: '' },
];
```

### getContainers() 惰性填充

```javascript
// container-manager.js
function getContainers() {
  return Array.from(containers.values()).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    phone: c.phone || '',
    email: c.email || '',
    notes: c.notes || '',
  }));
}
```

### createContainer() 扩展

```javascript
// container-manager.js
function createContainer({ name, color = '#6B7280', icon = '📌', phone = '', email = '', notes = '' }) {
  // ... 现有验证逻辑 ...
  const container = {
    id,
    name: name.trim(),
    color,
    icon,
    phone: phone || '',
    email: email || '',
    notes: notes || '',
  };
  // ... 现有持久化逻辑 ...
}
```

### updateContainer() 扩展

```javascript
// container-manager.js
function updateContainer(id, { name, color, icon, phone, email, notes }) {
  const container = containers.get(id);
  if (!container) return undefined;

  if (name !== undefined) container.name = name;
  if (color !== undefined) container.color = color;
  if (icon !== undefined) container.icon = icon;
  if (phone !== undefined) container.phone = phone;
  if (email !== undefined) container.email = email;
  if (notes !== undefined) container.notes = notes;

  // ... 现有持久化逻辑，需扩展 savedContainers[index] 的字段 ...
}
```

### renderer.js 表单填充（编辑模式）

```javascript
// renderer.js - showEditContainerModal() 扩展
function showEditContainerModal(containerId) {
  const container = state.containers.find(c => c.id === containerId);
  if (!container) return;

  // ... 现有逻辑 ...
  // 新增：填充扩展属性
  document.getElementById('containerEmailInput').value = container.email || '';
  document.getElementById('containerPhoneInput').value = container.phone || '';
  document.getElementById('containerNotesInput').value = container.notes || '';

  elements.containerModal.showModal();
}
```

### renderer.js 表单收集（提交时）

```javascript
// renderer.js - containerForm submit handler 扩展
const formData = {
  name,
  color: state.selectedColor,
  icon: state.selectedIcon,
  email: document.getElementById('containerEmailInput').value.trim(),
  phone: document.getElementById('containerPhoneInput').value.trim(),
  notes: document.getElementById('containerNotesInput').value.trim(),
};

// 宽松验证（仅在有值时验证）
if (formData.email && !formData.email.includes('@')) {
  // 显示邮箱格式错误
  return;
}
if (formData.phone && !/^\d{11}$/.test(formData.phone)) {
  // 显示手机号格式错误
  return;
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | （无假设） | — | — |

本研究所有发现均基于代码库实际文件内容和 CONTEXT.md 中的用户决策，无未验证假设。

## Open Questions

无。所有实现细节已在 CONTEXT.md 中由用户决策确定。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 主进程/渲染进程 | ✓ | 32.x | — |
| electron-store | 容器配置持久化 | ✓ | 8.1.0+ | — |
| Node.js | 主进程运行时 | ✓ | — | — |

**Missing dependencies with no fallback:** 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none |
| Quick run command | `npm test`（未配置） |
| Full suite command | `npm test`（未配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTR-01 | 设置手机号属性 | manual | — | — |
| ATTR-02 | 设置邮箱属性 | manual | — | — |
| ATTR-03 | 设置备注属性 | manual | — | — |
| ATTR-04 | 编辑 Modal 展示和编辑 | manual | — | — |
| ATTR-05 | 旧数据自动兼容 | manual | — | — |

### Sampling Rate

- **Per task commit:** 无自动化测试，手动验证
- **Phase gate:** 手动验证所有 5 个验收标准

### Wave 0 Gaps

- [ ] 项目无测试框架，本阶段不引入（scope 外）
- [ ] 所有验证通过手动 UAT 完成

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 客户端宽松验证（邮箱 @ 格式、手机号 11 位数字） |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via notes field | Tampering | 使用 textContent 而非 innerHTML（项目已有 WR-13 模式） |
| 注入 via email/phone | Tampering | 客户端验证 + electron-store 序列化安全 |

## Sources

### Primary (HIGH confidence)
- 项目代码库：`container-manager.js`, `src/renderer.js`, `src/index.html`, `src/styles/main.css`
- `.planning/phases/05-容器属性扩展/05-CONTEXT.md` — 用户决策
- `.planning/phases/05-容器属性扩展/05-UI-SPEC.md` — UI 设计规范
- `.planning/REQUIREMENTS.md` — ATTR-01 到 ATTR-05 需求定义

### Secondary (MEDIUM confidence)
- 无（本阶段不涉及外部库或新模式研究）

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 不引入新依赖，纯增量修改
- Architecture: HIGH — 已有架构清晰，改动路径明确
- Pitfalls: HIGH — 常见问题已识别并有标准解决方案

**Research date:** 2026-07-25
**Valid until:** 2026-08-25（30 天，项目架构稳定）
