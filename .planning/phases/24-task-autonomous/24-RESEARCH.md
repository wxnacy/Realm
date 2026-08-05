# Phase 24: 任务自主执行 - Research

**Researched:** 2026-08-02
**Domain:** CDP 自动化、AI 工具注册、操作确认 UI、安全防护
**Confidence:** HIGH

## Summary

Phase 24 的目标是让 AI Agent 能够自动填写网页表单和执行页面操作，同时对高风险操作（表单提交、文件上传、支付相关）实施用户确认机制。

本研究基于对现有代码库的深入分析，发现项目已有完善的 CDP 调试器管理基础设施（`cdp-manager.js`）和 AI 工具注册框架（`ai-manager.js`），可以直接复用。主要工作集中在：
1. 在 `cdp-manager.js` 新增 `fillForm` 和 `executeAction` 两个 CDP 底层方法
2. 在 `ai-manager.js` 的 `_buildRealmTools()` 中注册 `fill_form` 和 `execute_action` 两个 AI 工具
3. 在渲染进程添加操作确认卡片 UI
4. 实现多层 Prompt Injection 防护

**Primary recommendation:** 复用现有 `attachForAI/detachForAI/executeCommand` 基础设施，新增 CDP 方法采用相同的按需附加/用完即卸模式。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** ARIA 语义 + 文本匹配 — 优先用 label/placeholder/aria-label/文本内容定位表单字段，找不到时回退 CSS 选择器
- **D-02:** 字段名 + 值参数格式 — fill_form 工具参数为 `{ field: "邮箱", value: "test@example.com" }`
- **D-03:** 全表单类型支持 — 支持 input[text/email/password/number/tel/url/search/date/time]、textarea、select、checkbox、radio、file upload、date picker、contenteditable、iframe 内表单、CAPTCHA 字段检测
- **D-04:** 字段未找到时报错 + 返回可用字段列表
- **D-05:** 聊天内联确认 — 确认 UI 在 AI 聊天面板内显示确认卡片，不阻塞页面操作
- **D-06:** 详细版确认信息 — 展示操作类型 + 具体值 + 目标页面 URL + 容器名 + 风险等级
- **D-07:** 仅高风险操作确认 — 仅对表单提交(submit)、文件上传、支付相关操作要求用户确认
- **D-08:** 偏离 Roadmap — 此决策偏离 Roadmap 原要求"所有写操作必须用户确认"
- **D-09:** 文本优先 + 选择器兜底 — execute_action 定位元素时优先用文本描述匹配，找不到时用 CSS 选择器
- **D-10:** 全操作类型支持 — 支持 click、scroll、type、select、check/uncheck、focus/blur、submit、upload、drag、hover、keydown/keyup、execute_script、screenshot、wait_for_element
- **D-11:** 结构化参数格式 — execute_action 参数为 `{ action: 'click', target: '提交按钮' }`
- **D-12:** 操作结果 + 页面变化 — 返回操作结果 + 页面变化（新 URL、新弹窗、表单验证错误等）
- **D-13:** 多层 Prompt Injection 防护 — 输入消毒 + 脚本静态分析 + 沙箱执行
- **D-14:** CAPTCHA/2FA 暂停等待 — 检测到验证码或 2FA 时暂停任务，提示用户手动操作
- **D-15:** 特征 + 关键词检测 — CAPTCHA 检测：常见框架 + 页面关键词
- **D-16:** 白名单脚本安全 — execute_script 仅允许 DOM 操作和页面交互 API

### Claude's Discretion
无 — 所有关键决策已由用户确认。

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTO-01 | fillForm CDP 方法（自动化网页表单填写） | CDP DOM/Input 域，复用 executeCommand |
| AUTO-02 | executeAction CDP 方法（执行点击、滚动等页面操作） | CDP DOM/Input/Runtime 域，复用 executeCommand |
| AUTO-03 | fill_form AI 工具（AI 调用填表能力） | 复用 _buildRealmTools() 注册模式 |
| AUTO-04 | execute_action AI 工具（AI 调用操作能力） | 复用 _buildRealmTools() 注册模式 |
| AUTO-05 | 操作确认 UI（高风险操作必须用户确认） | 新增 IPC 通道 + 渲染进程确认卡片 |
| AUTO-06 | Prompt Injection 防护（输入消毒、脚本静态分析、沙箱执行） | 已有 dompurify 依赖，新增静态分析 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CDP 命令执行 | Main Process | — | cdp-manager.js 运行在主进程，直接调用 Electron debugger API |
| AI 工具注册 | Main Process | — | ai-manager.js 运行在主进程，管理 Agent 生命周期 |
| 操作确认 UI | Renderer Process | — | 聊天面板在渲染进程，用户交互在渲染进程 |
| IPC 通信 | Main Process | Renderer Process | 主进程发起确认请求，渲染进程响应确认/取消 |
| 输入消毒 | Main Process | — | 工具参数在主进程验证后再传入 CDP |
| CAPTCHA 检测 | Main Process | — | 通过 CDP Runtime.evaluate 在页面上下文检测 |

## Standard Stack

### Core (已有依赖，无需新增)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron CDP API | 32.x 内置 | 底层调试器协议 | 项目已使用，cdp-manager.js 已封装 |
| pi-agent-core | ^0.82.1 | AI Agent 框架 | 项目已使用，工具注册模式已建立 |
| dompurify | ^3.4.12 | HTML 消毒 | 项目已有依赖，可用于输入消毒 |

### Supporting (无需新增包)

本阶段无需安装新的 npm 包。所有功能基于 Electron 内置 CDP API 和现有依赖实现。

**Installation:**
```bash
# 无需安装新包
```

## Package Legitimacy Audit

本阶段无需安装新外部包。所有功能基于 Electron 内置 API 和项目已有依赖实现。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | — | — | 无需新增包 |

## Architecture Patterns

### System Architecture Diagram

```
用户消息 "填写邮箱 test@example.com"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Renderer Process                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AI Chat Panel                                   │   │
│  │  - 显示确认卡片（高风险操作）                      │   │
│  │  - 用户点击 确认/取消                              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │ IPC: action:confirm / action:cancel
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Main Process                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  AI Manager (_buildRealmTools)                   │   │
│  │  - fill_form 工具                                 │   │
│  │  - execute_action 工具                            │   │
│  │  - 风险评估（高/低）                               │   │
│  │  - 高风险 → 发送确认请求到渲染进程                  │   │
│  │  - 低风险 → 直接执行                               │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  CDP Manager                                     │   │
│  │  - attachForAI(['Runtime', 'DOM', 'Input'])      │   │
│  │  - fillForm(webContentsId, fields)               │   │
│  │  - executeAction(webContentsId, action, target)  │   │
│  │  - detachForAI(webContentsId)                    │   │
│  └─────────────────────────────────────────────────┘   │
│           │                                             │
│           ▼ CDP Protocol                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Webview (Chromium)                              │   │
│  │  - DOM.querySelector / DOM.setAttributeValue     │   │
│  │  - Input.dispatchKeyEvent / Input.insertText     │   │
│  │  - Input.dispatchMouseEvent                      │   │
│  │  - Runtime.evaluate (CAPTCHA 检测)               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
cdp-manager.js          # 新增 fillForm / executeAction 方法
ai-manager.js           # 新增 fill_form / execute_action 工具注册
src/renderer.js         # 新增确认卡片渲染逻辑
src/preload.js          # 新增 action:confirm / action:cancel IPC 通道
src/styles/main.css     # 新增 .action-confirm-* / .captcha-waiting-* 样式
```

### Pattern 1: CDP 工具复用模式

**What:** 新 CDP 方法复用现有 attachForAI/detachForAI/executeCommand 基础设施
**When to use:** fillForm 和 executeAction 底层实现
**Example:**
```javascript
// 复用现有模式（参考 read_page_content 工具）
async fillForm(webContentsId, fields) {
  const attachResult = await attachForAI(webContentsId, ['Runtime', 'DOM', 'Input']);
  if (!attachResult.success) throw new Error(attachResult.error);

  try {
    // 逐个字段填写
    for (const field of fields) {
      const element = await this._findFormField(webContentsId, field.field);
      await this._setFieldValue(webContentsId, element, field.value);
    }
    return { success: true };
  } finally {
    detachForAI(webContentsId);  // 用完即卸
  }
}
```

### Pattern 2: AI 工具注册模式

**What:** 新 AI 工具遵循 _buildRealmTools() 中的统一注册模式
**When to use:** fill_form 和 execute_action 工具注册
**Example:**
```javascript
// 遵循现有模式（参考 read_page_content、extract_links）
{
  name: 'fill_form',
  label: '填写表单',
  description: '自动填写网页表单字段，支持 input/textarea/select/checkbox/radio 等',
  parameters: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: '字段名称（label/placeholder/aria-label）' },
            value: { type: 'string', description: '要填写的值' }
          }
        },
        description: '要填写的字段列表'
      }
    },
    required: ['fields']
  },
  execute: async (toolCallId, params) => {
    // 实现逻辑
  }
}
```

### Pattern 3: 操作确认 IPC 模式

**What:** 高风险操作通过 IPC 确认机制实现用户授权
**When to use:** 表单提交、文件上传、支付相关操作
**Example:**
```javascript
// 主进程：发送确认请求
async function requestActionConfirmation(actionData) {
  const mainWindow = windowManager.getMainWindow();
  const actionId = generateUniqueId();

  return new Promise((resolve) => {
    // 存储待确认操作
    pendingActions.set(actionId, resolve);

    // 发送到渲染进程
    mainWindow.webContents.send('action:request-confirmation', {
      actionId,
      ...actionData
    });

    // 超时处理（30 秒）
    setTimeout(() => {
      if (pendingActions.has(actionId)) {
        pendingActions.delete(actionId);
        resolve({ confirmed: false, reason: 'timeout' });
      }
    }, 30000);
  });
}

// 渲染进程：显示确认卡片
ipcRenderer.on('action:request-confirmation', (event, data) => {
  renderConfirmationCard(data);
});
```

### Anti-Patterns to Avoid

- **不要在渲染进程直接调用 CDP:** 所有 CDP 操作必须通过主进程的 cdp-manager.js
- **不要跳过输入消毒:** 所有用户输入和 AI 生成的脚本必须经过静态分析
- **不要阻塞页面操作:** 确认 UI 是非模态的，不阻塞用户继续浏览
- **不要在低风险操作时要求确认:** 仅高风险操作（submit/upload/payment）需要确认

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML 消毒 | 自定义正则过滤 | dompurify (已有依赖) | 已有成熟库，处理边界情况更安全 |
| CDP 命令执行 | 直接调用 debugger.sendCommand | cdpManager.executeCommand() | 已有超时保护和错误处理 |
| 工具注册 | 手动管理工具列表 | _buildRealmTools() 模式 | 已有统一的注册和返回格式 |

## Common Pitfalls

### Pitfall 1: CDP 域未启用
**What goes wrong:** 调用 DOM 或 Input 域方法时报错 "Domain not enabled"
**Why it happens:** attachForAI 默认只启用 Runtime 域
**How to avoid:** 明确指定需要的域：`attachForAI(webContentsId, ['Runtime', 'DOM', 'Input'])`
**Warning signs:** CDP 命令返回 "Domain not found" 错误

### Pitfall 2: DevTools 冲突
**What goes wrong:** 用户打开 DevTools 后 AI 工具无法附加调试器
**Why it happens:** Electron 同一 webContents 只能有一个调试器连接
**How to avoid:** 检查 attachForAI 返回的错误，提示用户关闭 DevTools
**Warning signs:** "DevTools 已打开，请关闭后重试" 错误

### Pitfall 3: 页面导航后 webContentsId 失效
**What goes wrong:** 页面导航后之前获取的 webContentsId 不再有效
**Why it happens:** 导航可能导致 webview 重新加载
**How to avoid:** 每次工具调用时重新获取活跃 webContentsId
**Warning signs:** "标签页已关闭" 或 "webview 尚未就绪" 错误

### Pitfall 4: 确认卡片状态不同步
**What goes wrong:** 用户确认后卡片状态未更新
**Why it happens:** IPC 事件监听器未正确绑定或清理
**How to avoid:** 使用 actionId 关联请求和响应，确保状态一致
**Warning signs:** 卡片一直显示 "执行中..."

### Pitfall 5: CAPTCHA 检测误报
**What goes wrong:** 正常页面被误判为 CAPTCHA
**Why it happens:** 关键词匹配过于宽泛
**How to avoid:** 结合 DOM 特征（iframe src、div class）和关键词双重验证
**Warning signs:** 频繁提示用户手动验证

## Code Examples

### CDP 域启用和表单填写

```javascript
// 附加调试器并启用所需域
const attachResult = await cdpManager.attachForAI(webContentsId, ['Runtime', 'DOM', 'Input']);
if (!attachResult.success) {
  throw new Error(attachResult.error);
}

try {
  // 查找表单字段（ARIA 语义优先）
  const findScript = `
    (function() {
      const label = Array.from(document.querySelectorAll('label'))
        .find(l => l.textContent.includes('${fieldName}'));
      if (label && label.htmlFor) {
        return document.getElementById(label.htmlFor);
      }
      return document.querySelector('[placeholder*="${fieldName}"], [aria-label*="${fieldName}"]');
    })()
  `;

  const elementResult = await cdpManager.executeCommand(
    webContentsId,
    'Runtime.evaluate',
    { expression: findScript, returnByValue: false }
  );

  // 设置字段值
  if (elementResult.result?.result?.objectId) {
    await cdpManager.executeCommand(
      webContentsId,
      'DOM.setAttributeValue',
      {
        objectId: elementResult.result.result.objectId,
        name: 'value',
        value: fieldValue
      }
    );
  }
} finally {
  cdpManager.detachForAI(webContentsId);  // 用完即卸
}
```

### 操作确认卡片渲染

```javascript
// 渲染确认卡片（参考 renderToolCard 模式）
function renderConfirmationCard(actionData) {
  const card = document.createElement('div');
  card.className = 'action-confirm-card';
  card.dataset.actionId = actionData.actionId;

  // 头部：图标 + 标题 + 风险标签
  const header = document.createElement('div');
  header.className = 'action-confirm-header';

  const icon = document.createElement('div');
  icon.className = 'action-confirm-icon';
  icon.innerHTML = getActionIcon(actionData.type);  // 根据操作类型显示不同图标

  const info = document.createElement('div');
  info.className = 'action-confirm-info';

  const title = document.createElement('div');
  title.className = 'action-confirm-title';
  title.textContent = actionData.title;  // 如 "提交表单"

  const desc = document.createElement('div');
  desc.className = 'action-confirm-description';
  desc.textContent = actionData.description;  // 如 "向 example.com 提交数据"

  info.appendChild(title);
  info.appendChild(desc);

  const riskBadge = document.createElement('div');
  riskBadge.className = `action-confirm-risk risk-${actionData.riskLevel}`;
  riskBadge.textContent = getRiskLabel(actionData.riskLevel);

  header.appendChild(icon);
  header.appendChild(info);
  header.appendChild(riskBadge);

  // 详情区域
  const details = document.createElement('div');
  details.className = 'action-confirm-details';
  // ... 添加 URL、容器名等详情

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'action-confirm-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-confirm-btn action-confirm-btn-cancel';
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', () => {
    window.realmAPI.actionCancel(actionData.actionId);
    updateCardState(card, 'cancelled');
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'action-confirm-btn action-confirm-btn-confirm';
  confirmBtn.textContent = '确认执行';
  confirmBtn.addEventListener('click', () => {
    window.realmAPI.actionConfirm(actionData.actionId);
    updateCardState(card, 'executing');
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  card.appendChild(header);
  card.appendChild(details);
  card.appendChild(actions);

  return card;
}
```

### CAPTCHA 检测

```javascript
// CAPTCHA 检测脚本（通过 Runtime.evaluate 注入页面）
const captchaDetectionScript = `
(function() {
  // 特征检测
  const hasRecaptcha = !!document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]');
  const hasHcaptcha = !!document.querySelector('.h-captcha, iframe[src*="hcaptcha"]');
  const hasTurnstile = !!document.querySelector('.cf-turnstile, iframe[src*="turnstile"]');

  // 关键词检测
  const bodyText = document.body.innerText || '';
  const captchaKeywords = ['验证码', '机器人检测', '安全验证', '人机验证', 'CAPTCHA', 'verify you are human'];
  const hasKeyword = captchaKeywords.some(kw => bodyText.includes(kw));

  return {
    detected: hasRecaptcha || hasHcaptcha || hasTurnstile || hasKeyword,
    type: hasRecaptcha ? 'recaptcha' : hasHcaptcha ? 'hcaptcha' : hasTurnstile ? 'turnstile' : hasKeyword ? 'keyword' : null
  };
})()
`;
```

### 输入消毒（execute_script 安全检查）

```javascript
// 脚本静态分析：检测危险调用
function validateScript(script) {
  // 禁止的模式
  const dangerousPatterns = [
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bimport\s*\(/,
    /\brequire\s*\(/,
    /\bfs\./,
    /\bnet\./,
    /\bhttp\./,
    /\bchild_process\b/,
    /\bprocess\./,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      return {
        safe: false,
        reason: `检测到危险调用: ${pattern.source}`
      };
    }
  }

  return { safe: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 手动填写表单 | AI 自动填写 | Phase 24 | 提升用户体验，减少重复操作 |
| 所有写操作需确认 | 仅高风险操作需确认 | Phase 24 (D-08) | 降低交互摩擦，提升效率 |

**Deprecated/outdated:**
- Roadmap 原要求"所有写操作必须用户确认" → 用户决定仅对高风险操作确认 (D-07/D-08)

## Assumptions Log

> 所有关键决策已在 CONTEXT.md 中由用户确认，无 ASSUMED 声明。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

## Open Questions

1. **iframe 内表单如何定位？**
   - What we know: D-03 要求支持 iframe 内表单
   - What's unclear: CDP 是否支持跨 iframe 的 DOM 查询
   - Recommendation: 使用 Runtime.evaluate 在页面上下文执行脚本，通过 contentDocument 访问 iframe 内容

2. **contenteditable 元素如何设置值？**
   - What we know: D-03 要求支持 contenteditable
   - What's unclear: 不能用 setAttributeValue，需要模拟键盘输入
   - Recommendation: 使用 Input.insertText 或 execCommand('insertText')

3. **file upload 如何实现？**
   - What we know: D-03 要求支持 file upload，D-07 将其归类为高风险操作
   - What's unclear: CDP 如何处理文件选择对话框
   - Recommendation: 使用 DOM.setFileInputFiles 方法，需要用户提供文件路径

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron CDP API | fillForm/executeAction | ✓ | 32.x | — |
| dompurify | 输入消毒 | ✓ | ^3.4.12 | — |
| pi-agent-core | AI 工具框架 | ✓ | ^0.82.1 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前没有测试框架） |
| Config file | none |
| Quick run command | `npm test`（需要先配置） |
| Full suite command | `npm test`（需要先配置） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | fillForm CDP 方法 | manual-only | — | ❌ Wave 0 |
| AUTO-02 | executeAction CDP 方法 | manual-only | — | ❌ Wave 0 |
| AUTO-03 | fill_form AI 工具 | manual-only | — | ❌ Wave 0 |
| AUTO-04 | execute_action AI 工具 | manual-only | — | ❌ Wave 0 |
| AUTO-05 | 操作确认 UI | manual-only | — | ❌ Wave 0 |
| AUTO-06 | Prompt Injection 防护 | manual-only | — | ❌ Wave 0 |

**说明：** 本阶段所有功能涉及 Electron 主进程/渲染进程交互和 CDP 协议，难以自动化测试，建议采用手动验证。

### Sampling Rate
- **Per task commit:** 手动验证对应功能
- **Per wave merge:** 完整功能测试
- **Phase gate:** 所有 AUTO-01~06 需求通过 UAT

### Wave 0 Gaps
- [ ] 配置测试框架（可选，本阶段建议手动测试）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 脚本静态分析 + 输入消毒 |
| V6 Cryptography | no | — |

### Known Threat Patterns for CDP Automation

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt Injection via execute_script | Elevation of Privilege | 静态分析禁止 eval/Function/import/require |
| 恶意表单提交 | Tampering | 高风险操作需用户确认 |
| XSS 通过 DOM 操作 | Information Disclosure | dompurify 消毒 + 白名单 API |
| 跨域数据泄露 | Information Disclosure | 仅允许当前页面上下文操作 |

## Sources

### Primary (HIGH confidence)
- 项目代码库 `cdp-manager.js` — CDP 调试器管理器，已验证 attachForAI/detachForAI/executeCommand 模式
- 项目代码库 `ai-manager.js` — AI Manager，已验证 _buildRealmTools() 工具注册模式
- 项目代码库 `src/preload.js` — contextBridge API，已验证 IPC 通道模式
- 项目代码库 `src/renderer.js` — 渲染进程，已验证 handleAIStream/renderToolCard 模式
- 24-CONTEXT.md — 用户确认的所有实现决策
- 24-UI-SPEC.md — 操作确认卡片的完整 UI 规范

### Secondary (MEDIUM confidence)
- Electron CDP API 文档 — DOM/Input/Runtime 域方法

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 所有依赖已存在，无需新增
- Architecture: HIGH — 复用现有 CDP 和 AI 工具基础设施
- Pitfalls: MEDIUM — 基于代码分析和常见 CDP 问题

**Research date:** 2026-08-02
**Valid until:** 2026-09-02（30 天，项目处于活跃开发期）
