---
phase: 25
status: complete
---

# Phase 25 Research: 脚本生成 + 智能标签整理

## Executive Summary

Phase 25 实现两个核心功能：脚本生成系统和智能标签整理。脚本生成系统允许用户通过自然语言描述生成可执行的步骤序列，然后在 AI 聊天面板中预览、编辑和执行这些步骤。智能标签整理功能让 AI 根据页面标题、URL 和内容语义对当前标签页进行智能分组。

技术实现上，脚本格式采用 JSON 结构，每个步骤复用 Phase 24 的 execute_action 能力（click/type/scroll/wait 等原子操作）。脚本预览 UI 复用 Phase 24 的 action-confirm-card 模式，编辑功能支持拖拽排序和参数修改。静态分析已有现成实现（validateScript），只需扩展白名单。标签分组通过 AI 分析标签页元数据生成分组建议，用户确认后重新排列标签栏。

**关键发现：**
- 脚本生成系统可以完全复用现有 Phase 24 的 execute_action 底层能力
- 静态分析白名单机制已有实现，只需扩展危险操作列表
- action-confirm-card UI 模式可直接复用于脚本预览卡片
- 标签分组需要新增 IPC 通道来重新排列标签栏

**主要建议：**
1. 脚本格式采用 JSON 步骤序列，每步调用 cdpManager.executeAction
2. 脚本预览卡片复用 .action-confirm-card 样式
3. 标签分组建议卡片在 AI 聊天内联渲染
4. 分组应用通过 IPC 通道重排标签栏顺序

## Technical Approaches

### 脚本生成系统

#### 脚本格式设计

脚本采用 JSON 结构，包含以下字段：

```javascript
{
  name: "脚本名称",
  description: "脚本描述",
  steps: [
    {
      action: "navigate",           // 操作类型
      target: "https://example.com", // 目标元素或 URL
      options: {},                   // 可选参数
      waitFor: "load"               // 可选：执行后等待的事件
    },
    {
      action: "type",
      target: "邮箱输入框",
      options: { value: "user@example.com" }
    },
    {
      action: "click",
      target: "登录按钮"
    }
  ],
  containerId: "work"  // 目标容器
}
```

**支持的操作类型**（复用 Phase 24 execute_action）：
- `navigate` - 页面导航
- `click` - 点击元素
- `type` - 输入文本
- `scroll` - 滚动页面
- `wait` - 等待指定时间
- `select` - 选择下拉选项
- `check` / `uncheck` - 勾选/取消勾选
- `focus` / `blur` - 聚焦/失焦
- `submit` - 提交表单
- `keydown` / `keyup` - 按键操作

#### 脚本生成流程

1. 用户在 AI 聊天中描述任务（如"每天早上打开新闻网站并截取标题"）
2. AI 分析意图，生成 JSON 格式脚本
3. 脚本在 AI 聊天中渲染为预览卡片
4. 用户可编辑步骤、调整顺序、删除/添加步骤
5. 用户确认后，脚本逐步执行

#### 脚本执行流程

```javascript
// 脚本执行器（新增模块或在 ai-manager.js 中实现）
async function executeScript(script, onStepUpdate) {
  const { steps, containerId } = script;
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onStepUpdate({ index: i, status: 'executing', step });

    try {
      // 调用现有的 executeAction 方法
      const result = await cdpManager.executeAction(
        webContentsId,
        step.action,
        step.target,
        step.options
      );

      if (!result.success) {
        onStepUpdate({ index: i, status: 'error', error: result.error });
        // 失败停止策略
        return { success: false, stoppedAt: i, error: result.error };
      }

      onStepUpdate({ index: i, status: 'success', result });
      results.push(result);

      // 自动等待 load 事件（D-04）
      if (step.waitFor || step.action === 'navigate') {
        await waitForPageLoad(webContentsId, 5000);
      }
    } catch (err) {
      onStepUpdate({ index: i, status: 'error', error: err.message });
      return { success: false, stoppedAt: i, error: err.message };
    }
  }

  return { success: true, results };
}
```

#### 静态分析和安全验证

现有实现（ai-manager.js 的 validateScript 函数）已包含基础危险模式检测：

```javascript
const dangerousPatterns = [
  { pattern: /\beval\s*\(/, name: 'eval' },
  { pattern: /\bnew\s+Function\s*\(/, name: 'new Function' },
  { pattern: /\bimport\s*\(/, name: 'import()' },
  { pattern: /\brequire\s*\(/, name: 'require()' },
  { pattern: /\bfs\./, name: 'fs 模块' },
  { pattern: /\bnet\./, name: 'net 模块' },
  // ... 更多模式
];
```

**扩展建议**：
- 添加 `process.` 模式检测
- 添加 `child_process` 检测
- 添加文件路径遍历检测（`../`）
- 添加网络请求检测（`fetch`, `XMLHttpRequest`）

**白名单机制**：
- 仅允许 DOM 操作和页面交互 API
- 禁止所有 Node.js API 和文件系统访问
- 禁止动态代码执行（eval, Function）

#### 与现有系统的集成

**AI 工具注册**（ai-manager.js `_buildRealmTools()`）：

```javascript
{
  name: 'generate_script',
  label: '生成脚本',
  description: '根据自然语言描述生成可执行的自动化脚本',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: '任务描述'
      },
      containerId: {
        type: 'string',
        description: '目标容器（可选）'
      }
    },
    required: ['description']
  },
  execute: async (toolCallId, params) => {
    // AI 分析描述，生成脚本 JSON
    // 返回脚本供预览
  }
}
```

### 标签智能分组

#### 分组算法

AI 分析标签页的以下属性进行分组：

1. **URL 域名**：相同域名的标签页归为一组
2. **页面标题**：提取标题中的关键词进行语义分析
3. **内容语义**：结合页面内容进行主题分类（可选）

**分组策略**：
- 基础分组：按域名分组（如 github.com 所有标签页）
- 语义分组：按主题分组（如"新闻"、"社交媒体"、"工作"）
- 混合分组：域名 + 语义结合

**AI 分析示例**：

```javascript
// AI 工具调用
{
  name: 'suggest_tab_groups',
  label: '标签分组建议',
  description: '分析当前标签页并生成智能分组建议',
  parameters: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['domain', 'semantic', 'mixed'],
        description: '分组策略'
      }
    }
  }
}
```

#### 分组建议 UI

分组建议卡片在 AI 聊天中渲染：

```
┌─────────────────────────────────────┐
│ 📁 标签分组建议                      │
│ 按主题智能分组 3 个标签页             │
├─────────────────────────────────────┤
│ 工作相关 (2)                        │
│  ├─ GitHub - 项目仓库               │
│  └─ Jira - 任务看板                 │
│─────────────────────────────────────│
│ 新闻 (1)                            │
│  └─ 新浪新闻 - 首页                 │
├─────────────────────────────────────┤
│ [应用分组]  [取消]                   │
└─────────────────────────────────────┘
```

#### 分组应用流程

1. AI 生成分组建议
2. 在 AI 聊天中渲染分组建议卡片
3. 用户可编辑：修改组名、移动标签页、删除分组
4. 用户确认后，通过 IPC 通道重新排列标签栏

**新增 IPC 通道**：

```javascript
// preload.js
reorderTabs: (tabOrder) => ipcRenderer.invoke('tab:reorder', tabOrder),

// main.js
ipcMain.handle('tab:reorder', (event, tabOrder) => {
  // tabOrder: [{ tabId, groupId, groupIndex }]
  // 重新排列标签栏顺序
});
```

### 安全架构

#### 脚本执行安全边界

1. **静态分析拦截**：在脚本生成时检测危险操作
2. **沙箱执行**：脚本步骤通过 CDP 在页面上下文执行，无 Node.js 访问
3. **用户确认**：高风险操作（submit、upload、execute_script）需用户确认
4. **失败停止**：步骤执行失败时自动停止，等待用户决策

#### 权限控制

- 脚本仅能操作当前容器的标签页
- 无跨容器数据访问
- 无文件系统访问
- 无网络请求能力（除 navigate）
- 无环境变量读取

#### 防注入策略

1. **输入消毒**：复用 sanitizeInput 函数
2. **参数校验**：严格校验步骤参数类型
3. **白名单验证**：仅允许预定义的操作类型
4. **执行超时**：每个步骤 10 秒超时保护

## Implementation Patterns

### 现有模式复用

#### 1. AI 工具注册模式（ai-manager.js）

```javascript
// 工具定义结构
{
  name: 'tool_name',
  label: '工具标签',
  description: '工具描述',
  parameters: {
    type: 'object',
    properties: { /* 参数定义 */ },
    required: ['param1']
  },
  execute: async (toolCallId, params) => {
    // 实现逻辑
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      details: { /* 附加信息 */ }
    };
  }
}
```

#### 2. 操作确认 UI 模式（Phase 24）

```javascript
// renderer.js
function renderConfirmationCard(actionData) {
  const card = document.createElement('div');
  card.className = 'action-confirm-card';
  card.dataset.actionId = actionData.actionId;
  card.dataset.state = 'pending';

  // 头部：图标 + 标题 + 风险标签
  const header = document.createElement('div');
  header.className = 'action-confirm-header';
  // ...

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'action-confirm-actions';
  // ...
}
```

#### 3. CDP 命令执行模式（cdp-manager.js）

```javascript
async function executeCommand(webContentsId, method, params = {}, timeout = 10000) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { success: false, error: '标签页已关闭' };
  }

  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('CDP 命令执行超时')), timeout);
    });
    const result = await Promise.race([
      wc.debugger.sendCommand(method, params),
      timeoutPromise,
    ]);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### 4. 输入消毒模式（ai-manager.js）

```javascript
function sanitizeInput(params) {
  if (!params || typeof params !== 'object') return params;

  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    let result = str;
    result = result.replace(/\x00/g, '');  // 过滤 null 字节
    result = result.replace(/\$\{[^}]*\}/g, '');  // 移除模板字面量
    return result;
  }

  function deepSanitize(value) {
    if (typeof value === 'string') return sanitizeString(value);
    if (Array.isArray(value)) return value.map(deepSanitize);
    if (value && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = deepSanitize(value[key]);
      }
      return result;
    }
    return value;
  }

  return deepSanitize(params);
}
```

### 新增模式

#### 1. 脚本预览卡片模式

```javascript
function renderScriptPreviewCard(script, onExecute, onCancel) {
  const card = document.createElement('div');
  card.className = 'script-preview-card';

  // 头部
  const header = document.createElement('div');
  header.className = 'script-card-header';
  // ...

  // 步骤列表
  const stepsList = document.createElement('div');
  stepsList.className = 'script-steps-list';

  script.steps.forEach((step, index) => {
    const stepItem = document.createElement('div');
    stepItem.className = 'script-step-item';
    stepItem.dataset.index = index;
    stepItem.draggable = true;

    // 拖拽手柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'step-drag-handle';
    // ...

    // 步骤内容
    const content = document.createElement('div');
    content.className = 'step-content';
    // ...

    stepsList.appendChild(stepItem);
  });

  card.appendChild(stepsList);

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'action-confirm-actions';
  // ...

  return card;
}
```

#### 2. 标签分组建议卡片模式

```javascript
function renderTabGroupCard(groups, onApply, onCancel) {
  const card = document.createElement('div');
  card.className = 'tab-group-card';

  // 头部
  const header = document.createElement('div');
  header.className = 'tab-group-header';
  // ...

  // 分组列表
  const groupsList = document.createElement('div');
  groupsList.className = 'tab-groups-list';

  groups.forEach((group, groupIndex) => {
    const section = document.createElement('div');
    section.className = 'tab-group-section';

    // 分组头部
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'tab-group-section-header';
    // ...

    // 标签页列表
    const items = document.createElement('div');
    items.className = 'tab-group-items';

    group.tabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-group-item';
      item.draggable = true;
      // ...
      items.appendChild(item);
    });

    section.appendChild(sectionHeader);
    section.appendChild(items);
    groupsList.appendChild(section);
  });

  card.appendChild(groupsList);

  // 操作按钮
  const actions = document.createElement('div');
  actions.className = 'action-confirm-actions';
  // ...

  return card;
}
```

#### 3. 脚本步骤编辑器模式

```javascript
function renderStepEditor(step, onSave, onCancel) {
  const editor = document.createElement('div');
  editor.className = 'step-editor';

  // 操作类型选择
  const actionRow = document.createElement('div');
  actionRow.className = 'step-editor-row';
  const actionLabel = document.createElement('label');
  actionLabel.textContent = '操作';
  const actionSelect = document.createElement('select');
  actionSelect.className = 'step-action-select';
  // 添加操作选项
  ['navigate', 'click', 'type', 'scroll', 'wait', 'select'].forEach(action => {
    const option = document.createElement('option');
    option.value = action;
    option.textContent = getActionLabel(action);
    if (step.action === action) option.selected = true;
    actionSelect.appendChild(option);
  });
  actionRow.appendChild(actionLabel);
  actionRow.appendChild(actionSelect);
  editor.appendChild(actionRow);

  // 目标输入
  const targetRow = document.createElement('div');
  targetRow.className = 'step-editor-row';
  const targetLabel = document.createElement('label');
  targetLabel.textContent = '目标';
  const targetInput = document.createElement('input');
  targetInput.className = 'step-target-input';
  targetInput.value = step.target || '';
  targetRow.appendChild(targetLabel);
  targetRow.appendChild(targetInput);
  editor.appendChild(targetRow);

  // 参数输入（根据操作类型动态显示）
  if (['type', 'select'].includes(step.action)) {
    const paramRow = document.createElement('div');
    paramRow.className = 'step-editor-row';
    const paramLabel = document.createElement('label');
    paramLabel.textContent = '参数';
    const paramInput = document.createElement('input');
    paramInput.className = 'step-param-input';
    paramInput.value = step.options?.value || step.options?.text || '';
    paramRow.appendChild(paramLabel);
    paramRow.appendChild(paramInput);
    editor.appendChild(paramRow);
  }

  // 保存/取消按钮
  const actions = document.createElement('div');
  actions.className = 'step-editor-actions';
  // ...

  return editor;
}
```

## Risk Assessment

### 技术风险和缓解策略

#### 1. 脚本执行性能风险

**风险**：复杂脚本执行时间过长，阻塞 UI 交互

**缓解策略**：
- 每个步骤设置 10 秒超时（复用 cdpManager 超时机制）
- 支持用户随时停止脚本执行
- 实时显示执行进度
- 大页面内容提取限制在 5 秒内返回

#### 2. 脚本执行失败恢复

**风险**：步骤执行失败后，页面状态可能不一致

**缓解策略**：
- 失败停止策略：步骤失败后立即停止后续步骤
- 提供重试、跳过、终止三个选项
- 记录执行状态，支持从失败点继续执行
- 显示详细的错误信息和页面状态

#### 3. 跨容器脚本执行隔离性

**风险**：脚本可能访问其他容器的数据

**缓解策略**：
- 脚本执行前校验目标容器
- 通过 CDP 执行的操作自动受容器 Session 隔离
- 禁止跨容器数据访问（无 IPC 通道支持）

#### 4. 标签分组重排冲突

**风险**：用户在分组重排过程中操作标签栏导致冲突

**缓解策略**：
- 分组应用前锁定标签栏操作
- 应用完成后立即解锁
- 应用失败时回滚到原始状态

#### 5. AI 生成脚本质量

**风险**：AI 生成的脚本可能不符合用户预期

**缓解策略**：
- 提供预览和编辑功能
- 支持手动修改每个步骤
- 支持添加/删除步骤
- 支持拖拽调整步骤顺序

## Validation Architecture

### 测试框架

| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none |
| Quick run command | `npm test`（未配置） |
| Full suite command | `npm test`（未配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRIPT-01 | 自然语言生成脚本 | manual | — | ❌ |
| SCRIPT-02 | 脚本预览/确认 UI | manual | — | ❌ |
| SCRIPT-03 | 脚本静态分析和安全验证 | manual | — | ❌ |
| TAG-01 | AI 标签分组建议 | manual | — | ❌ |
| TAG-02 | 标签分组 UI | manual | — | ❌ |

### Sampling Rate

- **Per task commit:** 无自动化测试
- **Per wave merge:** 无自动化测试
- **Phase gate:** 手动验证所有需求

### Wave 0 Gaps

- [ ] 测试框架配置（建议引入 Jest 或 Vitest）
- [ ] 单元测试：脚本生成逻辑、静态分析函数
- [ ] 集成测试：脚本执行流程、标签分组应用
- [ ] E2E 测试：完整用户流程

## Recommendations

### 实施建议

#### Wave 1: 脚本生成系统核心

1. **生成脚本 AI 工具**（SCRIPT-01）
   - 在 ai-manager.js 的 `_buildRealmTools()` 中添加 `generate_script` 工具
   - 实现自然语言 → JSON 脚本的转换逻辑
   - 返回脚本数据供预览

2. **脚本预览卡片 UI**（SCRIPT-02）
   - 在 renderer.js 中添加 `renderScriptPreviewCard` 函数
   - 复用 `.action-confirm-card` 样式
   - 实现步骤列表渲染和状态显示

3. **脚本静态分析**（SCRIPT-03）
   - 扩展 ai-manager.js 的 `validateScript` 函数
   - 添加更多危险操作模式检测
   - 在脚本生成时执行静态分析

#### Wave 2: 脚本编辑和执行

1. **脚本编辑功能**
   - 实现步骤编辑器（修改目标/参数）
   - 实现拖拽排序
   - 实现添加/删除步骤

2. **脚本执行引擎**
   - 实现脚本执行器（逐步调用 cdpManager.executeAction）
   - 实现实时状态更新
   - 实现失败停止和用户决策

3. **执行结果反馈**
   - 在 AI 聊天中显示每个步骤的执行结果
   - 支持重试、跳过、终止操作

#### Wave 3: 智能标签整理

1. **标签分组 AI 工具**（TAG-01）
   - 在 ai-manager.js 的 `_buildRealmTools()` 中添加 `suggest_tab_groups` 工具
   - 实现基于域名和语义的分组算法
   - 返回分组建议数据

2. **标签分组 UI**（TAG-02）
   - 在 renderer.js 中添加 `renderTabGroupCard` 函数
   - 实现分组建议卡片渲染
   - 支持编辑分组（修改组名、移动标签页）

3. **分组应用**
   - 新增 IPC 通道 `tab:reorder`
   - 实现标签栏重排逻辑
   - 实现视觉分隔线

### 关键技术决策

#### 1. 脚本存储策略

**决策**：会话内有效（D-08）

**理由**：
- 简化实现，避免脚本持久化和版本管理
- 脚本通常是临时任务，不需要长期保存
- 避免脚本格式兼容性问题

#### 2. 脚本执行策略

**决策**：失败停止 + 用户决策（D-12）

**理由**：
- 防止错误累积导致更大问题
- 让用户决定如何处理失败（重试/跳过/终止）
- 提供更好的用户体验和控制感

#### 3. 标签分组策略

**决策**：AI 语义分组（D-13）

**理由**：
- 比简单的域名分组更智能
- 可以识别跨域名的主题关联
- 提供更有意义的分组结果

### 代码组织建议

#### 新增文件

1. **script-manager.js** - 脚本管理和执行逻辑
   - 脚本生成（从 AI 工具调用）
   - 脚本执行器
   - 脚本静态分析
   - 脚本状态管理

2. **tab-group-manager.js** - 标签分组管理逻辑
   - 分组算法
   - 分组应用
   - 分组状态管理

#### 修改文件

1. **ai-manager.js**
   - 添加 `generate_script` 工具
   - 添加 `suggest_tab_groups` 工具
   - 更新系统提示词

2. **src/renderer.js**
   - 添加 `renderScriptPreviewCard` 函数
   - 添加 `renderTabGroupCard` 函数
   - 添加步骤编辑器
   - 添加拖拽排序逻辑

3. **src/index.html**
   - 添加脚本预览卡片模板
   - 添加标签分组卡片模板

4. **src/styles/main.css**
   - 添加脚本预览卡片样式
   - 添加标签分组卡片样式
   - 添加步骤编辑器样式

5. **src/preload.js**
   - 添加 `script:execute` IPC 通道
   - 添加 `script:stop` IPC 通道
   - 添加 `tab:reorder` IPC 通道

6. **main.js**
   - 添加脚本执行 IPC 处理器
   - 添加标签重排 IPC 处理器

## Sources

### Primary (HIGH confidence)

- **ai-manager.js** - AI 工具注册模式、输入消毒、静态分析
- **cdp-manager.js** - CDP 命令执行、fillForm/executeAction 实现
- **Phase 24 代码** - action-confirm-card UI 模式、操作确认流程
- **tab-manager.js** - 标签管理 API
- **25-CONTEXT.md** - 用户决策和实现细节
- **25-UI-SPEC.md** - UI 设计契约

### Secondary (MEDIUM confidence)

- **Electron 文档** - Session 隔离、CDP 调试器 API
- **Chrome DevTools Protocol 文档** - Runtime.evaluate、DOM 操作

### Tertiary (LOW confidence)

- 无（所有关键实现模式均有代码验证）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于现有 Phase 24 实现，无新依赖
- Architecture: HIGH - 复用现有模式，架构清晰
- Pitfalls: MEDIUM - 脚本执行和标签重排可能遇到边缘情况

**Research date:** 2026-08-03
**Valid until:** 2026-08-17 (14 天，Phase 25 实施期间有效)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRIPT-01 | generate_script 工具（自然语言描述生成可执行脚本） | AI 工具注册模式、JSON 脚本格式设计、与 execute_action 集成方案 |
| SCRIPT-02 | 脚本预览/确认 UI（用户确认后执行） | action-confirm-card UI 模式、脚本预览卡片设计、编辑功能实现 |
| SCRIPT-03 | 脚本静态分析和安全验证（防止代码注入和权限提升） | validateScript 函数扩展、白名单机制、输入消毒模式 |
| TAG-01 | suggest_tab_groups 工具（AI 按主题/域名智能分组标签页） | AI 分组算法、标签页元数据分析、分组策略设计 |
| TAG-02 | 标签分组 UI（展示和应用分组建议） | 分组建议卡片 UI、拖拽排序、IPC 通道重排标签栏 |
