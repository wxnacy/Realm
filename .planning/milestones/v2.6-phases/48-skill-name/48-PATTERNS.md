# Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`） - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 12（新建 2 / 改造 10）
**Analogs found:** 11 / 12（唯一无先例：`src/skill-picker-model.js` 的双模式导出）

> **本阶段是消费型阶段**：零新增技能写路径。除 `src/skill-picker-model.js` 与 `tests/test-skill-picker-model.js` 两个新文件外，
> 全部改动都是**改造既有文件**。因此绝大多数 analog 就是**被改造文件自身**（精确到既有函数体），
> 照抄即可；只有 4 处需要新模式（见 `## 无先例 / 高风险改动点`）。

---

## File Classification

| 新建 / 改造文件 | Role | Data Flow | 最近 analog | Match Quality |
|-----------------|------|-----------|-------------|---------------|
| `src/renderer.js` — 面板渲染 / 键盘 / 执行分支 | component | request-response | **自身** `renderSlashPickerList` (`:9900`) / `handleAIInputKeydown` (`:9768`) / `executeActiveSlashCommand` (`:9810`) | exact（原地改造） |
| `src/renderer.js` — 斜杠解析分支 | component | request-response | **自身** `handleSendAIMessage` 斜杠拦截 (`:8673-8691`) | exact |
| `src/renderer.js` — 用户气泡 pill + 正文折叠块 | component | render | **自身** `referencedTabs` pill 行 (`:8030-8052`) + `.ai-summary-box` 渲染 (`:7966-7997`) | exact |
| `src/renderer.js` — `read` 卡片技能化 | component | render | **自身** `renderToolCard` 的 `execute_action (${action})` 分支 (`:9246-9250`) | exact |
| `src/renderer.js` — `skills:changed` 监听 | hook | event-driven | **自身** `onIpcMessage('bookmarks-bar:refresh', …)` (`:4206`) | exact |
| `ai-manager.js` — 权威解析 + 实时读盘 + 组装 | controller | request-response | **自身** `promptWithContext` 组装段 (`:1227-1231`) + `refreshSkills` 注入 (`:849-855`) | exact |
| `ai-manager.js` — `read` 工具事件标记 | controller | event-driven | **自身** `_setupEventBroadcasting` 的 `tool_execution_start` (`:1474-1484`) | exact |
| `ai-manager.js` — 面板刷新入口 | controller | request-response | **自身** `syncAgentSystemPrompt()` (`:2514-2542`)，**只加调用方不改函数体** | exact |
| `ai-skills-manager.js` — 收窄投影 / tier / `promptOmitted` / `matchSkillByPath` | service | transform | **自身** `getSkillsSnapshot` (`:648`) + `bySkillPriority` (`:396`) + ⑦ 预算循环 (`:585-596`) | exact |
| `ai-skills-manager.js` — `readSkillForInvocation`（实时读盘） | service | file-I/O | **自身** `refreshSkills` 的 SDK 动态 import + env 注入 (`:481-485`) | role-match |
| `ipc-handlers.js` — 2 个新通道 | route | request-response | **自身** `ai:prompt` / `ai:prompt-with-context` (`:1680-1720`) | exact |
| `src/preload.js` — `ai.getSkills` / `ai.refreshSkills` | bridge | request-response | **自身** `ai.getState` / `ai.getAvailableModels` (`:1063-1069`) | exact |
| **`src/skill-picker-model.js`（新建）** | utility | transform | **无先例** — `src/vimium/vimium-manager.js:258` 是纯 CommonJS、`src/model-family.js:277` 是纯 window IIFE，**两者兼有的双模式没有** | **none** |
| `src/styles/main.css` — 新增令牌与类 | config | — | **自身** `.slash-picker-*` (`:6973-7019`) + `.whitelist-tag` (`:8405`) + `.ai-summary-box` (`:5733-5785`) | exact |
| `src/index.html` — 新 `<script>` + 面板容器 | config | — | **自身** `<script src="model-family.js">` (`:1019`) + `#slashPickerPanel` (`:861-864`) | exact |
| `tests/test-ai-skills.js`（扩展） | test | — | **自身** `readSource`/`functionBody`/`methodBody` (`:48-73`) + `wm.broadcast` 覆写 (`:1226-1233`) | exact |
| **`tests/test-skill-picker-model.js`（新建）** | test | — | `tests/test-builtin-skills-seeder.js:347-362` `scanFiles` 源码扫描骨架 | role-match |
| `ai-conversations-manager.js`（可选落点） | service | transform | **自身** `<context-summary>` 特判 (`:641-651`) | exact |
| `docs/product/ai-skills.md` | docs | — | **自身** 现有九节结构 | exact |

---

## Pattern Assignments

### `src/renderer.js` — 面板渲染 / 键盘导航 / 执行分支

**Analog:** `src/renderer.js`（自身，三处既有函数）

#### ① 状态与注册表（`:279-282` / `:328-337`）—— **`SLASH_COMMANDS` 零改动**

```js
// src/renderer.js:279-282 —— 新增 state.aiSkills / state.slashPickerSelectable 落点
  // / 斜杠命令面板状态
  slashPickerOpen: false,
  slashPickerItems: [],
  slashPickerActiveIndex: 0,
```

```js
// src/renderer.js:328-337 —— 本地命令注册表（P-48-02：技能**不得** push 进来）
/**
 * AI 输入框斜杠命令注册表
 * name: 命令名（不含 /）；description: 面板展示的中文描述
 * takesArg: 是否接受可选参数（/name 后的剩余文本作为 args 传入 handler）
 * handler: (args: string) => Promise<void>，函数声明提升保证此处可直接引用
 */
const SLASH_COMMANDS = [
  { name: 'clear', description: '开启新对话', takesArg: false, handler: executeSlashClear },
  { name: 'compact', description: '压缩上下文（可附重点说明，如 /compact 重点保留登录调试）', takesArg: true, handler: executeSlashCompact },
];
```

#### ② 渲染：单数组 `innerHTML` 模板 + `data-*` 点击绑定（`:9900-9951`）—— **本节是分组改造的基座**

```js
// src/renderer.js:9900-9926（现状，逐行对照改造）
function renderSlashPickerList() {
  const list = elements.slashPickerList;
  if (!list) return;

  const value = elements.aiInput ? elements.aiInput.value : '';
  const filter = value.slice(1).split(/\s/)[0].toLowerCase();
  const items = SLASH_COMMANDS.filter(c => c.name.startsWith(filter));

  state.slashPickerItems = items;
  if (state.slashPickerActiveIndex >= items.length) {
    state.slashPickerActiveIndex = Math.max(0, items.length - 1);
  }

  if (items.length === 0) {
    list.innerHTML = '<div class="slash-picker-row" style="cursor:default"><span class="slash-picker-desc">无匹配命令，输入 / 查看全部</span></div>';
    return;
  }

  list.innerHTML = items.map((cmd, index) => {
    const isActive = index === state.slashPickerActiveIndex;
    return `
      <div class="slash-picker-row ${isActive ? 'active' : ''}" data-cmd="${cmd.name}">
        <span class="slash-picker-name">/${cmd.name}</span>
        <span class="slash-picker-desc">${cmd.description}</span>
      </div>
    `;
  }).join('');
```

**必须同时修的两处既有缺陷**（P-48-04 / P-48-10）：

```js
// src/renderer.js:9928-9949（现状）—— ① 越界守卫只能收敛到「最近索引」而非「最近可选中索引」
  const activeRow = list.querySelector('.slash-picker-row.active');
  if (activeRow) { activeRow.scrollIntoView({ block: 'nearest' }); }

  // ② 按 name 反查索引：同名两行时永远命中第一行（技能行）→ 点「命令」分区的 /clear 会执行技能
  list.querySelectorAll('.slash-picker-row[data-cmd]').forEach(row => {
    row.addEventListener('click', () => {
      const idx = items.findIndex(c => c.name === row.dataset.cmd);
      if (idx >= 0) {
        state.slashPickerActiveIndex = idx;
        executeActiveSlashCommand();
      }
    });
    row.addEventListener('mousemove', () => {
      const idx = items.findIndex(c => c.name === row.dataset.cmd);
      if (idx >= 0 && idx !== state.slashPickerActiveIndex) {
        state.slashPickerActiveIndex = idx;
        renderSlashPickerList();
      }
    });
  });
}
```

**改造要点（照抄既有骨架，只换内容与绑定）**：
- `data-cmd` → `data-index="${index}"`，点击改用 `Number(row.dataset.index)`（消除 name 重名与特殊字符进 HTML 属性的双重隐患）
- `items.map` 内按 `kind` 分支产出「分组标题行」/「技能行」/「命令行」三种模板；分组标题**不占索引**
- 技能名字/描述/状态标注全部经 `escapeHtml()` 包裹（`:10834`，P-48-11）
- 灰色不可选中行**不绑点击/`mousemove` 处理器**，也不加 `.active`

#### ③ 键盘导航（`:9768-9803`）—— 在可选中索引集合上取模

```js
// src/renderer.js:9768-9803（现状，↑↓ 在**全量**索引上取模）
function handleAIInputKeydown(e) {
  if (state.slashPickerOpen) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const count = state.slashPickerItems.length;
      if (count > 0) {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        state.slashPickerActiveIndex = (state.slashPickerActiveIndex + delta + count) % count;
        renderSlashPickerList();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSlashPicker(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // 按当前高亮项直接执行（输入可能是前缀如 /cle，不能依赖文本精确匹配）
      if (!executeActiveSlashCommand()) {
        closeSlashPicker();
        handleSendAIMessage();
      }
      return;
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAIMessage(); }
}
```

**照抄的语义**：Enter 的 `if (!executeActiveSlashCommand()) { closeSlashPicker(); handleSendAIMessage(); }`
是 UI-SPEC「全部不可选中 → `activeIndex = -1` → 回落既有 `false` 路径」的**现成实现**，
`activeIndex = -1` 时 `state.slashPickerItems[-1]` 为 `undefined` → 返回 `false` → 自然落回 `handleSendAIMessage`。
**零新增分支**。

#### ④ 执行分支（`:9810-9824`）—— **事实 2 的 `rest` 取值必须修（P-48-01，阻断）**

```js
// src/renderer.js:9810-9824（现状，含缺陷）
function executeActiveSlashCommand() {
  const cmd = state.slashPickerItems[state.slashPickerActiveIndex];
  if (!cmd) return false;

  const value = elements.aiInput.value.trim();
  // 跳过 "/name" 及过滤 token，取其后的剩余文本作为 args
  // （/cle → ''；/compact 重点保留登录 → '重点保留登录'）
  const rest = value.slice(1 + cmd.name.length).replace(/^\S*/, '').trim();  // ← 缺陷行

  elements.aiInput.value = '';
  elements.aiInput.style.height = 'auto';
  closeSlashPicker();
  cmd.handler(rest);
  return true;
}
```

**token 取值法的最近 analog**：`handleSendAIMessage` 的斜杠分支（`:8673-8683`）已用
「严格前缀 + 空白边界」的 `find`，以及 `text.slice(match.name.length + 1).trim()`。
但该式同样假设「输入 token 长度 == name 长度」，故**两处都应按研究给的 token 取值法**：

```js
// 研究与本节共同推荐的取值法（renderer 与 main 用同一纯函数）
const token = value.slice(1).split(/\s/)[0];          // 斜杠后、首个空白前的完整 token
const rest  = value.slice(1 + token.length).trim();   // token 之后的剩余文本
```

> 该式对研究实测的 7 组输入全部正确，且对既有命令语义零变化（`/compact 重点…` 逐字节相同）。
> 修法应落在 `src/skill-picker-model.js` 的 `extractArgs(inputValue)` 里，**两处调用**（renderer + main 的 `parseSkillInvocationText`）。

**分流（新增）**：`cmd.kind === 'command'` → 既有 `cmd.handler(rest)` 逐字节不变；
`cmd.kind === 'skill'` → **不调 handler**，改为把完整语法文本交给 `handleSendAIMessage`（D-19）。

#### ⑤ `handleSendAIMessage` 的斜杠分支（`:8663-8691`）—— 技能分支插入点

```js
// src/renderer.js:8663-8691（现状）
async function handleSendAIMessage() {
  const text = elements.aiInput.value.trim();
  if (!text && state.aiAttachments.length === 0) return;
  if (state.aiCompacting) return;

  // 斜杠命令拦截：命令文本绝不进入对话历史。
  // 须在 aiStreaming 守卫之前——/clear、/compact 支持流式回复进行中执行，
  // handler 内部会先 abort
  if (text.startsWith('/')) {
    const match = SLASH_COMMANDS.find(c =>
      text === '/' + c.name || text.startsWith('/' + c.name + ' ')
    );
    if (match) {
      elements.aiInput.value = '';
      elements.aiInput.style.height = 'auto';
      const args = text.slice(match.name.length + 1).trim();
      await match.handler(args);
      return;
    }
    // 未知命令：提示且不入历史
    elements.aiInput.value = '';
    elements.aiInput.style.height = 'auto';
    pushSystemNote(`未知命令 ${text.split(/\s/)[0]}，输入 / 查看可用命令`);
    return;
  }

  if (state.aiStreaming) return;
```

**改造**：在「未知命令」`return` **之前**插入技能预检（本地命令优先 → `parseSkillRef` → 查 `state.aiSkills` →
未找到/已禁用 → `pushSystemNote` + `return`；命中 → 挂 `skillInvocation` 元数据后**落入正常发送流程**）。
`if (state.aiStreaming) return;` 与斜杠拦截的**相对位置不得调换**（D-08 位置约束）。

#### ⑥ 用户消息元数据挂载（`:8711-8731`）—— **D-06 的逐字形状先例**

```js
// src/renderer.js:8711-8731（现状，referencedTabs / attachments 同款模式）
  // 添加用户消息（附带引用标签页与附件标记，气泡中展示）
  const userMsgId = 'user-msg-' + Date.now();
  state.aiMessages.push({
    role: 'user',
    content: text,
    id: userMsgId,
    referencedTabs: referencedTabs.map(t => ({
      tabId: t.tabId,
      title: t.title,
      containerColor: t.containerColor
    })),
    attachments: attachments.map(a => ({ id: a.id, name: a.name, path: a.path,
      mimeType: a.mimeType, isImage: a.isImage, isDirectory: a.isDirectory, size: a.size }))
  });
```

**改造**：同一对象上加 `skillInvocation: { name, tier, content }`（由 IPC 响应回传，见 §2.5）。
**不改表结构**（D-16）—— 附着字段走既有「消息对象挂字段」通道。

#### ⑦ 气泡 pill + 折叠块（`:8030-8090` + `:7966-7997`）—— D-06 / D-09 落点

```js
// src/renderer.js:8030-8052（现状：referencedTabs pill 行，纯 DOM API + textContent）
    if (isUser) {
      // @ 引用标签页标记（在气泡顶部展示，便于确认引用已随消息发出）
      if (msg.referencedTabs && msg.referencedTabs.length > 0) {
        const refRow = document.createElement('div');
        refRow.className = 'ai-message-refs';
        msg.referencedTabs.forEach(t => {
          const pill = document.createElement('span');
          pill.className = 'ai-message-ref-pill';
          const dot = document.createElement('span');
          dot.className = 'ai-message-ref-dot';
          dot.style.backgroundColor = t.containerColor || '#666';
          const title = document.createElement('span');
          title.className = 'ai-message-ref-title';
          title.textContent = t.title || '标签页';
          pill.appendChild(dot);
          pill.appendChild(title);
          refRow.appendChild(pill);
        });
        content.appendChild(refRow);
      }
```

```js
// src/renderer.js:7965-7997（现状：/compact 折叠框，D-09 的逐值照抄对象）
    if (msg.role === 'summary') {
      const box = document.createElement('div');
      box.className = 'ai-summary-box collapsed';
      const header = document.createElement('div');
      header.className = 'ai-summary-box-header';
      const icon = document.createElement('span');
      icon.className = 'ai-summary-box-icon';
      icon.textContent = '📄';
      const title = document.createElement('span');
      title.className = 'ai-summary-box-title';
      title.textContent = '上下文已压缩（点击查看摘要）';
      const chevron = document.createElement('span');
      chevron.className = 'ai-summary-box-chevron';
      chevron.textContent = '▾';
      header.appendChild(icon); header.appendChild(title); header.appendChild(chevron);
      const body = document.createElement('div');
      body.className = 'ai-summary-box-body';
      body.textContent = msg.content || '';
      header.addEventListener('click', () => { box.classList.toggle('collapsed'); });
      box.appendChild(header); box.appendChild(body);
      elements.aiMessageList.appendChild(box);
      return;
    }
```

**照抄纪律**：技能 pill 用**同一套 DOM API + `textContent`**（不得 `innerHTML`）；
技能正文折叠块**逐值照抄**折叠状态（`collapsed` 类 + header 点击 toggle + body `textContent`），
只是把类名换成 `.ai-skill-content-box*`、header 文案换成 `技能正文（N 字符）`。
插入位置：pill 行在 `referencedTabs` pill 行**之后**、正文之前；折叠块在**附件之后**（UI-SPEC 结构图）。

#### ⑧ `read` 卡片技能化（`:9244-9250`）—— D-15 落点

```js
// src/renderer.js:9243-9250（现状：execute_action 的「按参数特殊化标题」先例）
  // 工具名称（execute_action 显示具体 action）
  const name = document.createElement('span');
  name.className = 'tool-card-name';
  if (toolExecution.name === 'execute_action' && toolExecution.params?.action) {
    name.textContent = `execute_action (${toolExecution.params.action})`;
  } else {
    name.textContent = toolExecution.name;
  }
```

**改造**：加一条 `if (toolExecution.skillInvocation?.name)` 分支 → `name.textContent = \`使用技能「${skillInvocation.name}」\``
+ 追加 `.tool-card-name-skill` 修饰类 / `.tool-card-name-text` / `.slash-picker-source-badge` 徽标。
**接口契约**：`skillInvocation` 缺失 / 非法 → **走 else 原路径**（零回归）；renderer **不得**按路径字符串自行匹配。

#### ⑨ 流式事件映射（`:9014-9055`）—— `skill_invocation` → `skillInvocation`

```js
// src/renderer.js:9041-9051（现状：新工具执行对象的字段白名单）
            } else {
              // 添加新的工具执行
              toolMsg.toolExecutions.push({
                id: event.tool_execution_id,
                name: event.tool_name,
                status: event.status,
                params: event.params,
                result: event.result,
                error: event.error
              });
            }
```

**改造**：在 `push` 对象中加 `skillInvocation: event.skill_invocation`（主进程侧字段名为 snake_case，
与既有 `tool_execution_id` / `tool_name` 同款）。`existingIdx >= 0` 的更新分支已用 `...spread` 保留
既有字段 → 标记会自然留存，**不需要改更新分支**（研究 §3.1 第 3 条）。

#### ⑩ `skills:changed` 监听（`:4206` 先例 + `:4388-4392` 挂载点）

```js
// src/renderer.js:4206-4210（现状：广播监听唯一既有形状）
  window.realmAPI.onIpcMessage('bookmarks-bar:refresh', () => {
    if (window.bookmarksBar) window.bookmarksBar.load();
  });
  window.realmAPI.onIpcMessage('bookmarks-bar:visibility-changed', (data) => {
```

```js
// src/renderer.js:4386-4392（现状：AI 事件流初始化点，新监听同处挂载）
  // 初始化窗口标题
  updateWindowTitle();

  // 初始化 AI 事件流监听
  handleAIStream();
```

**改造**：同处新增 `window.realmAPI.onIpcMessage('skills:changed', () => { … })`；
处理器内**只重拉快照投影**（`ai.getSkills`），**不得**调 `ai.refreshSkills`（P-48-06 自激回路）。

#### ⑪ `openSlashPicker`（`:9880-9885`）—— stale-while-revalidate 起点

```js
// src/renderer.js:9880-9885（现状）
function openSlashPicker() {
  state.slashPickerOpen = true;
  state.slashPickerActiveIndex = 0;
  elements.slashPickerPanel.style.display = 'block';
  renderSlashPickerList();
}
```

**改造**：在 `renderSlashPickerList()`（立即用内存投影，零延迟）**之后**追加
`await realmAPI.ai.refreshSkills()` 的 fire-and-forget → 完成后原地 `renderSlashPickerList()`。
**无 loading 态**（UI-SPEC 明文）。

#### ⑫ 既有复用件（零改动，直接调用）

```js
// src/renderer.js:8794-8798
function pushSystemNote(content) {
  state.aiMessages.push({ id: 'note-' + Date.now(), role: 'system-note', content });
  state.aiAutoScroll = true;
  renderAIMessages();
}
```

```js
// src/renderer.js:8804-8813
async function abortAIIfStreaming() {
  if (!state.aiStreaming) return;
  try {
    state.aiCancelledByUser = true;
    await window.realmAPI.ai.abort();
  } catch (err) {
    console.error('[Realm Renderer] 中止流式回复失败:', err);
    state.aiCancelledByUser = false;
  }
}
```

```js
// src/renderer.js:10834-10838 —— 面板 innerHTML 模板的唯一转义工具
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

```js
// src/renderer.js:9070-9100（错误分支的「占位气泡无内容则 splice 掉」先例，§2.5 的 skillError 路径照抄）
          const placeholderIdx = state.aiMessages.findIndex(
            m => m.role === 'assistant' && m.id === state.aiCurrentMessageId
          );
          if (placeholderIdx >= 0) {
            const placeholder = state.aiMessages[placeholderIdx];
            if (!placeholder.content &&
                (!placeholder.toolExecutions || placeholder.toolExecutions.length === 0)) {
              state.aiMessages.splice(placeholderIdx, 1);
            }
          }
```

---

### **`src/skill-picker-model.js`（新建）— 双模式导出，项目内零先例**

**Analog:** 无。项目内两种导出形态**互斥**，没有任何文件同时支持两者：

```js
// src/model-family.js:14-17 + :277-285（浏览器脚本形态：裸 IIFE + window.，无 module.exports）
(function () {
  'use strict';
  const DATA = window.AI_BRAND_DATA || {};
  // …
  window.ModelFamily = {
    resolveModel, groupModels, latestPerGroup, getProviderIcon, iconUrl, iconHtml,
  };
})();
```

```js
// src/vimium/vimium-manager.js:256-265（CommonJS 形态：module.exports，无 window.）
// ==================== 模块导出 ====================

module.exports = {
  VimStateMachine,
  VIM_ENABLED_KEY,
  isVimEnabled,
  SINGLE_KEY_MAP,
  PENDING_G_MAP,
  PENDING_Y_MAP,
};
```

> 全仓 `src/**/*.js` grep `module.exports|typeof module` 只命中两处：
> `src/vendor/highlight.min.js`（第三方 UMD）与 `src/vimium/vimium-manager.js`（纯 CommonJS，
> 由主进程 require，**不经 `<script>` 加载**）。`src/model-family.js` / `src/ai-brand-map.js` 均无 exports。

**最小可照抄骨架**（研究 §「代码骨架」的逐字形态，仅 3 行样板）：

```js
/**
 * Realm Browser - `/` 面板纯逻辑模型（双模式导出）
 *
 * 为什么抽出独立模块：D-04 的裸名边界语义、D-03 的两档排序、args token 取值
 * 是本阶段最容易出**静默错**的三处规则，必须表驱动覆盖；留在 renderer.js 里
 * （浏览器脚本、无 module.exports）只能靠 Playwright 或人工验证。
 *
 * 双模式：<script src="skill-picker-model.js"> 暴露 window.SkillPickerModel；
 *         纯 Node 测试 require('src/skill-picker-model.js') 取同一份 api 对象。
 * 两侧拿到的是**同一个对象引用** —— 规则只此一份，不存在漂移面。
 */
(function () {
  'use strict';

  const SKILL_PREFIX = 'skill:';

  function parseSkillRef(text, commandNames) { /* 本地命令优先 + 严格前缀边界 + /skill: 拆分 */ }
  function extractArgs(inputValue) { /* 事实 2 的 token 取值法 */ }
  function filterPickerItems(skills, filter) { /* §1.6 两档排序 */ }
  function buildPickerItems(skills, filter) { /* §1.5 展平 + kind + selectable + statusText */ }

  const api = { SKILL_PREFIX, parseSkillRef, extractArgs, filterPickerItems, buildPickerItems };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
})();
```

**加载接线**（`src/index.html:1018-1020`，插在 `model-family.js` 之后、`renderer.js` **之前**）：

```html
  <script src="ai-brand-map.js"></script>
  <script src="model-family.js"></script>
  <script src="skill-picker-model.js"></script>   <!-- 新增：必须在 renderer.js 之前 -->
  <script src="renderer.js"></script>
```

> **风险标注（高风险，无先例）**：这是本阶段引入的**唯一新模式**。研究 §Assumptions A5 与
> 「Validation Architecture」均给了**备选路线**（纯函数留在 `renderer.js`，用
> `tests/test-unified-navigation.js` 同款 Playwright `_electron` 断言）。
> **二者择一，但必须有一处覆盖**。planner 需在 PLAN 里明确选择并在验收判据中体现。
> 该文件**零项目内 import**（纯函数、不依赖 electron / SDK / DOM），
> 因此 `node --test tests/test-skill-picker-model.js` 无需任何桩即可跑。

---

### `ai-manager.js` — 权威解析 + 实时读盘 + 组装 + 事件标记

**Analog:** `ai-manager.js`（自身，四处既有实现）

#### ① 惰性 require 先例（`:94-121`）—— 接入 `builtin-skills-seeder` 的模板

```js
// ai-manager.js:110-121（逐字模板，新增 getBuiltinSkillsSeederLazy 同款）
/**
 * 惰性 require AI 技能管理模块（技能集唯一数据权威）
 *
 * ai-skills-manager 无 electron 依赖、无顶层 SDK import（SDK 在 refreshSkills
 * 内动态 import），纯 Node 环境下可直接加载与测试。此处按同款惰性模式引用
 * （与 getAgentWorkspaceLazy 一致），避开模块加载顺序问题。
 *
 * @returns {object} ai-skills-manager 模块导出
 */
function getAiSkillsManagerLazy() {
  return require('./ai-skills-manager');
}
```

> `builtin-skills-seeder` 经 `agent-workspace` 间接依赖 electron，且 `getSeededSkillNames()`
> → `resolveBuiltinSkillsSrc()` **直接** `require('electron')`（事实 4）。生产（Electron main）
> 无影响（`main.js:140` 已在 require），但**纯 Node 测试必须注入**（见 §tests）。

#### ② `REALM_SYSTEM_PROMPT` 第 1 段（`:479`）—— D-18 落点

```js
// ai-manager.js:479-481（现状，第 1 段后紧接「你的能力：」）
const REALM_SYSTEM_PROMPT = `你是 Realm Browser 的 AI 助手。你可以帮助用户管理浏览器标签页、查看当前状态、读取网页内容、提取链接等。

你的能力：
```

**改造**：在第一段与 `你的能力：` 之间插入**一个独立段落**（模板字面量内换行 + 空行，与既有段落分隔风格一致）。

```js
// ai-manager.js:575-577（D-18 的硬边界：技能段原样使用 SDK 返回值，不得加前缀/后缀/包装）
 * formatSkillsForSystemPrompt 的返回值，不加中文前缀。
```

```js
// ai-manager.js:580-585（技能段拼装，D-18 不得触碰）
function buildSystemPrompt() {
  const base = REALM_SYSTEM_PROMPT + '\n\n' + buildWorkspacePrompt() + '\n\n'
    + getAiMemoryManagerLazy().buildGlobalSnapshot();
  const skillsBlock = getAiSkillsManagerLazy().buildSkillsPrompt();
  return skillsBlock ? base + '\n\n' + skillsBlock : base;
}
```

#### ③ rootDirs 注入先例（`:845-855` / `:2518-2524`）—— seeded 集合注入的模板

```js
// ai-manager.js:844-855（现状：manager 自己从不解析路径，全部由 ai-manager 注入）
      this.sandboxEnv = await getAgentWorkspaceLazy().createSandboxEnv();

      // 刷新技能集（D-04：每次 Agent 创建前无条件重扫；managed 先、user 后）
      // configStore 注入式读取（manager 侧零 configStore 依赖）
      await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
        disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
        rootDirs: [
          getAgentWorkspaceLazy().getManagedSkillsDir(),
          getAgentWorkspaceLazy().getSkillsDir(),
        ],
      });
```

**改造**：`getSeededSkillNames()` 用同款注入风格传给 `getSkillsForUI(seededNames)`。
包一层 try/catch 降级（seeded 集合视为空 + `console.warn`）—— 见 `## 无先例 / 高风险改动点` 第 2 条。

#### ④ `prompt()` 的两处改动（`:1021` / `:1040`）

```js
// ai-manager.js:1018-1033（现状：_ensureConversation 收**原始** message —— D-19 的关键）
    // 惰性对话生命周期（per G-42-2 / D-04）：首条消息创建（或认领）对话，
    // 标题自动取首条用户消息前 30 字符
    try {
      this._ensureConversation(message);        // ← 必须保持收到原始语法文本
    } catch (err) { /* … */ }

    console.log(`[Realm AI] 发送消息: ${message}`);
```

```js
// ai-manager.js:1038-1043（现状：agent.prompt 收 message —— 改为收 enhanced）
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.agent.prompt(message);       // ← 改为 await this.agent.prompt(enhanced)
        await this.agent.waitForIdle();
        this.isProcessing = false;
        return this.currentConversationId || null;
```

**改造（两处，缺一不可）**：
- `_ensureConversation(message)` **保持原样**（P-48-32 的接线扫描：`_ensureConversation(enhanced` 不得出现）
- `agent.prompt(enhanced)` 其中 `const enhanced = skillBlock ? skillBlock : message;`（普通消息逐字节不变）
- 返回值由裸 `string|null` 扩为 `{ conversationId, skillInvocation }`（见 §2.5）

#### ⑤ `promptWithContext()` 的增强消息组装（`:1223-1234`）—— D-07 的精确落点

```js
// ai-manager.js:1223-1234（现状）
      // 构建增强消息：attachment marker 置于最前（先于 tab XML 块——模型先
      // 看到「有附件及路径」再看引用内容），marker 与正文之间空行分隔。
      // 图片措辞按通道条件化（inline=原生直发 / fallback=直发但模型可能看不到 /
      // described=桥接转写），避免「声称已附于消息」却看不到图诱发幻觉
      const markerBlock = aiAttachments.buildAttachmentMarkers(resolvedAttachments, { imageMode });
      const contextBlock = this._buildMessageWithContext(message, referencedTabs);
      const enhancedMessage = [visionNotice, markerBlock, visionBlock, contextBlock]
        .filter(Boolean)
        .join('\n\n');

      // 调用 agent.prompt（images 为空数组时传 undefined，避免 SDK 端歧义）
      await this.agent.prompt(enhancedMessage, images.length > 0 ? images : undefined);
      await this.agent.waitForIdle();
```

**改造**：数组头部插入 `skillBlock`（其余元素**相对顺序逐字节不变**）：

```js
      const enhancedMessage = [skillBlock, visionNotice, markerBlock, visionBlock, contextBlock]
        .filter(Boolean)
        .join('\n\n');
```

**组装函数形状**（研究 §2.4 的逐字形态）：

```js
/** 技能块 + provenance + args（D-05）。一次 formatSkillInvocation 调用完成，分隔符由 SDK 决定。 */
function buildSkillInvocationBlock({ skill, name }, args) {
  const provenance = `用户显式调用了技能「${name}」`;
  const instructions = [provenance, args].filter(Boolean).join('\n\n');
  return formatSkillInvocation(skill, instructions);   // → <skill …>…</skill>\n\n<provenance>\n\n<args>
}
```

#### ⑥ `_ensureConversation` / `_deriveConversationTitle`（`:1305-1341`）—— D-19 的根因与验证面

```js
// ai-manager.js:1305-1318（现状）
  _ensureConversation(userMessageText) {
    const derivedTitle = this._deriveConversationTitle(userMessageText);
    if (!this.currentConversationId) {
      const conv = conversationStore.createConversation({
        title: derivedTitle, model: this.activeModelId, provider: this.activeProvider,
      });
      this.currentConversationId = conv.id;
      // …
```

```js
// ai-manager.js:1331-1341（纯函数，可打表测试 —— 验证方式）
  _deriveConversationTitle(userMessageText) {
    const trimmed = typeof userMessageText === 'string' ? userMessageText.trim() : '';
    return trimmed ? trimmed.substring(0, 30) : '新对话';
  }
```

#### ⑦ `_setupEventBroadcasting` 的 `tool_execution_start`（`:1474-1484`）—— D-15 的判定位置

```js
// ai-manager.js:1461-1484（现状：sendNow 语义 + tool_execution_start 分支）
    const sendNow = (uiEvent) => {
      flushPending();
      this._sendEventsBatch([{ ...uiEvent, timestamp: Date.now() }]);
    };

    this.agent.subscribe((event) => {
      switch (event.type) {
        // …
        case 'tool_execution_start': {
          console.log(`[Realm AI] 工具调用: ${event.toolName}`, JSON.stringify(event.args || {}));
          sendNow({
            type: 'tool_execution_update',
            tool_execution_id: event.toolCallId,
            tool_name: event.toolName,
            status: 'running',
            params: event.args,
          });
          break;
        }
```

**改造**（唯一新增一行）：

```js
            params: event.args,
            // 新增：仅 read + 命中技能文件时携带（缺失 → renderer 渲染普通 read 卡片）
            skill_invocation: resolveSkillMarker(event.toolName, event.args),
```

**必要性（三条独立成立的既有事实）**：
- `sendNow` 是**同步**上下文，而匹配可以是同步的（`_cache.skills` 的 `filePath` 是内存数据）
- `tool_execution_end`（`:1497-1510`）**不带 `params`** → 标记必须在 start 事件一次性给出
- renderer 的更新分支（`:9035-9040`）用 `...spread` 保留既有字段 → 标记自然留存

#### ⑧ `saveCurrentConversation` / `getConversationMessages`（`:2116-2124` / `:2471-2473`）—— 重载装饰落点

```js
// ai-manager.js:2111-2124（落库来源 = agent.state.messages → messages.content 列存增强消息）
  saveCurrentConversation() {
    if (!this.currentConversationId || !this.agent) return;
    try {
      const messages = this.agent.state.messages || [];
      if (messages.length === 0) return;
      conversationStore.saveMessages(this.currentConversationId, messages);
```

```js
// ai-manager.js:2461-2473（★ 推荐的装饰落点：conversationStore 保持「只懂存储」单一职责）
  /**
   * 获取指定对话的消息列表（renderer 显示形状）
   * 透传 conversationStore.getMessages：assistant 行带 toolExecutions
   * 工具卡片结构，无独立 toolResult 行，可直接赋 renderer state.aiMessages。
   * 上下文注入请用 conversationStore.getAgentMessages（switchConversation 内部使用）。
   */
  getConversationMessages(conversationId) {
    return conversationStore.getMessages(conversationId);
  }
```

**改造**：在 `getConversationMessages` 内对 user 行做一次 `<skill>` 装饰（§2.6）、对 assistant 行
`toolExecutions` 重建 `skillInvocation`（§3.3）—— **同一个 `resolveSkillMarker` 两处调用**。

#### ⑨ `syncAgentSystemPrompt()`（`:2514-2542`）—— **只加调用方，函数体零改动**

```js
// ai-manager.js:2514-2542（**逐字保持**，tests/test-ai-skills.js:1278-1295 是方法体源码扫描断言）
  async syncAgentSystemPrompt() {
    if (!this.agent || !this.sandboxEnv) return;

    // 重新扫描两个技能目录（磁盘可能被模型经 write/bash 直接改写）
    await getAiSkillsManagerLazy().refreshSkills(this.sandboxEnv, {
      disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
      rootDirs: [
        getAgentWorkspaceLazy().getManagedSkillsDir(),
        getAgentWorkspaceLazy().getSkillsDir(),
      ],
    });

    if (this.isProcessing || (this.agent.state && this.agent.state.isStreaming)) {
      this._skillsPromptDirty = true;
      return;
    }

    const snap = getAiSkillsManagerLazy().getSkillsSnapshot();
    const next = buildSystemPrompt();
    // digest 是快速判定主键、逐字符比对是二次确认 —— 两者一致才认定「无变化」
    if (snap.digest === this._skillsPromptDigest && this.agent.state.systemPrompt === next) return;

    // 先记录已应用的摘要，再改写 prompt（顺序不可调换：中途抛错时摘要不应超前）
    this._skillsPromptDigest = snap.digest;
    this.agent.state.systemPrompt = next;

    // 只在真正改写了 prompt 的路径上广播（本阶段只发事件，消费方在 Phase 48/50）
    windowManager.broadcast('skills:changed');
  }
```

**新增调用方（不改函数体）**：

```js
  /** 面板数据源（同步投影，零 IO）—— 供 ai:get-skills */
  getSkillsForUI() { /* … */ }
  /** 面板后台刷新 —— 供 ai:refresh-skills（复用既有链路，闭合 P8 触发点） */
  async refreshSkillsForPanel() {
    await this.syncAgentSystemPrompt();   // ← 生产调用方，函数体不动
    return this.getSkillsForUI();
  }
```

**早退边界（必须在代码注释与产品文档写明）**：`if (!this.agent || !this.sandboxEnv) return;` ——
AI 未初始化时不刷新，面板拿到旧投影。此时**根本没有任何可用的读盘环境**，降级为不刷新是唯一诚实行为。

#### ⑩ 导出面（文件末尾 `module.exports`）

```js
// ai-manager.js 尾部（现状 —— 新增模块级纯函数时按同款「挂到导出对象」写法）
module.exports = AIManager;
module.exports.executeScript = executeScript;
module.exports.sanitizeInput = sanitizeInput;
module.exports.validateScriptForSteps = validateScriptForSteps;
module.exports.buildSystemPrompt = buildSystemPrompt;
```

`parseSkillInvocationText` / `buildSkillInvocationBlock` 用同款 `module.exports.xxx = xxx` 导出供测试。

---

### `ai-skills-manager.js` — 收窄投影 / tier / `promptOmitted` / 实时读盘

**Analog:** `ai-skills-manager.js`（自身，五处既有实现）

#### ① 依赖纪律（文件头 `:18-21`）—— **新增函数必须遵守**

```js
// ai-skills-manager.js:18-21
 * 依赖纪律：本模块**不得**有 electron 依赖、不得顶层 import SDK（SDK 为 ESM-only，
 * 一律用包根动态 import）；也不得直接引入 SDK 的传递依赖
 * （其 frontmatter 解析与忽略文件匹配实现只经 SDK 往返获得，不自行引入）。
 */
```

> **这是 tier 组合点不放在本模块的直接依据**（研究 §1.3）：`seededNames` 必须由调用方**注入**，
> 由 `ai-manager` 从 `builtin-skills-seeder` 取。

#### ② `LIMITS` / `EMPTY_CACHE`（`:26-46`）—— 常量单源，**48 只在 promptOmitted 处消费，不得新增字面量**

```js
// ai-skills-manager.js:32-36
const LIMITS = {
  MAX_SKILL_MD_BYTES: 64 * 1024,
  MAX_USER_SKILLS: 50,
  SKILLS_PROMPT_CHAR_BUDGET: 8000,
};
```

```js
// ai-skills-manager.js:48-61（条目形状权威注释，新增字段需同步更新此处）
 * 模块级技能快照（唯一权威）
 *
 * 形状：{ skills, promptBlock, digest, diagnostics, errors, refreshedAt }
 * - skills：缓存条目 `{ skill, source, diagnostics }`，source 取 'user' | 'managed'
 *   （遮蔽败者额外带 `shadowed: true` 与 `shadowedBy`）；条目级 `diagnostics`
 *   即 D-07 语境中的 `skill.diagnostics[]` —— 诊断挂在**缓存条目**上，
 *   `Skill` 本体保持 SDK 五字段形状不被注入私有字段
```

#### ③ `bySkillPriority`（`:376-406`）—— 面板分档内的排序依据（**不得改区域敏感比较**）

```js
// ai-skills-manager.js:396-406
function bySkillPriority(a, b) {
  const sourceRank = (e) => (e.source === 'user' ? 0 : 1);
  const invocationRank = (e) => (e.skill.disableModelInvocation === true ? 1 : 0);
  const bySource = sourceRank(a) - sourceRank(b);
  if (bySource !== 0) return bySource;
  const byInvocation = invocationRank(a) - invocationRank(b);
  if (byInvocation !== 0) return byInvocation;
  if (a.skill.name < b.skill.name) return -1;
  if (a.skill.name > b.skill.name) return 1;
  return 0;
}
```

> 投影出的 `skills[]` 已按此序排列 → renderer 的「前缀命中档内保持投影原序」即自动继承该全序。

#### ④ `overLimit` 的「标记不剔除」先例（`:562-574`）—— `promptOmitted` 的逐字模板

```js
// ai-skills-manager.js:562-574
    // ⑥ 数量上限：只统计 user 来源（managed 由应用自身投递，不计入用户配额）。
    //    超限条目标 overLimit 而**不剔除、不删文件** —— 数据层完整，只是不注入。
    const userEntries = _cache.skills.filter((e) => e.source === 'user');
    if (userEntries.length > LIMITS.MAX_USER_SKILLS) {
      for (const e of userEntries.slice(LIMITS.MAX_USER_SKILLS)) e.overLimit = true;
      _cache.diagnostics.push({
        level: 'error',
        code: 'realm_user_skill_limit_exceeded',
        message: `用户技能数量超过上限：限额 ${LIMITS.MAX_USER_SKILLS} 个，当前 ${userEntries.length} 个；超出部分不进 system prompt（请先卸载不用的技能）`,
        limit: LIMITS.MAX_USER_SKILLS,
        currentValue: userEntries.length,
      });
    }
```

#### ⑤ ⑦ 的预算贪心循环（`:576-611`）—— **`promptOmitted` 的注入点**

```js
// ai-skills-manager.js:576-611（现状；新增一行在 `used += cost;` 循环之后）
    const dummySkill = { name: '', description: '', filePath: '' };
    const fixedOverhead = formatSkillsForSystemPrompt([dummySkill]).length;
    const entryCost = (skill) =>
      formatSkillsForSystemPrompt([dummySkill, skill]).length - fixedOverhead;
    const eligible = _cache.skills.filter(
      (e) => !e.shadowed && !e.disabled && !e.overLimit && e.skill.disableModelInvocation !== true
    );
    const kept = [];
    let used = fixedOverhead;
    for (const e of eligible) {
      const cost = entryCost(e.skill);
      if (used + cost > LIMITS.SKILLS_PROMPT_CHAR_BUDGET) break;
      kept.push(e.skill);
      used += cost;
    }
    let block = kept.length ? formatSkillsForSystemPrompt(kept) : '';
    const omitted = eligible.length - kept.length;
    if (omitted > 0) {
      // 省略提示追加在 SDK 技能段的**闭合标签之外**：未截断时的前缀与截断时逐字节
      // 相同，provider 前缀缓存友好。截断绝不静默（SKILL-07）。
      _cache.diagnostics.push({
        level: 'warning',
        code: 'realm_prompt_budget_exceeded',
        message: `prompt 段预算 ${LIMITS.SKILLS_PROMPT_CHAR_BUDGET} 字符，已省略 ${omitted} 个技能（共 ${eligible.length} 个）`,
        limit: LIMITS.SKILLS_PROMPT_CHAR_BUDGET,
        currentValue: used,
      });
      block += `\n\nNote: ${omitted} of ${eligible.length} skills omitted to stay within the prompt budget.`;
    }
    _cache.promptBlock = block;
    _cache.digest = computeDigest(_cache.skills, _cache.promptBlock);
    _cache.refreshedAt = Date.now();
```

**新增（一行，位置在 `kept` 循环之后、`_cache.promptBlock = block;` 之前）**：

```js
// ⑦ 尾部（新增）—— 与 overLimit 同款「标记不剔除」
for (const e of eligible.slice(kept.length)) e.promptOmitted = true;
```

> **判定边界必须与 `eligible` 过滤条件完全一致**（P-48-08）：`shadowed` / `disabled` /
> `overLimit` / `disableModelInvocation === true` 的条目**不是** `promptOmitted`。
> `promptOmitted` 不必进 `computeDigest()`（见 `:91-104` 的输入清单注释：任何使
> `promptOmitted` 变化的输入都会改变 `omitted` → 改变省略提示行 → `promptBlock` 变 → digest 变）。

#### ⑥ `getSkillsSnapshot` 的「浅拷贝视图」形态（`:641-655`）—— 投影函数的模板

```js
// ai-skills-manager.js:641-655
/**
 * 同步读取技能集快照（供 Phase 48 /skill: 解析与 Phase 50 列表消费）
 *
 * 返回**浅拷贝视图**：就地改其数组不污染模块级权威。零 IO、非 Promise。
 *
 * @returns {object} { skills, promptBlock, digest, diagnostics, errors, refreshedAt }
 */
function getSkillsSnapshot() {
  return {
    ..._cache,
    skills: _cache.skills.slice(),
    diagnostics: _cache.diagnostics.slice(),
    errors: _cache.errors.slice(),
  };
}
```

> **关键**：`skill.content`（完整正文）随浅拷贝一并带出（事实 5）→ 面板**必须**走
> `getSkillsForUI()` 的**收窄投影**，不得把快照整体 JSON 过 IPC（≤ 50 × 64 KiB）。

**新增纯函数（同款 JSDoc + `@returns` 风格）**：

```js
/** 面板投影（剔除 content / diagnostics / filePath；只送渲染需要的字段） */
function toUISkillEntry(entry, seededNames) {
  return {
    name: entry.skill.name,
    description: entry.skill.description,
    tier: sourceTierOf(entry, seededNames),            // 建议字段名用 tier 而非 source（见命名警告）
    disableModelInvocation: entry.skill.disableModelInvocation === true,
    disabled: entry.disabled === true,
    shadowed: entry.shadowed === true,
    shadowedBy: entry.shadowed ? entry.shadowedBy : undefined,
    overLimit: entry.overLimit === true,
    promptOmitted: entry.promptOmitted === true,
  };
}

/** 列表读盘口（面板数据源） */
function getSkillsForUI(seededNames) {
  return {
    skills: _cache.skills.map((e) => toUISkillEntry(e, seededNames)),
    refreshedAt: _cache.refreshedAt,
    digest: _cache.digest,
  };
}
```

**命名警告（必须写进代码注释与产品文档）**：UI-SPEC 把该字段写作 `skillInvocation.source`，
其**取值是 tier**（`'user' | 'builtin' | 'managed'`），而数据层的 `source` 只有
`'user' | 'managed'`（seeded 也是 `'managed'`）。两个 `source` 语义不同、取值域不同 →
**强烈建议在投影与事件里改用 `tier` 字段名**。

#### ⑦ SDK 动态 import + env 注入（`:481-485`）—— `readSkillForInvocation` 的模板

```js
// ai-skills-manager.js:481-485（现状：SDK 为 ESM-only，只能从包根动态 import）
    // SDK 为 ESM-only，只能从包根动态 import（exports map 只有包根与少数具名入口）
    const { loadSourcedSkills, formatSkillsForSystemPrompt } =
      await import('@earendil-works/pi-agent-core');

    const { skills: loadedEntries, diagnostics } = await loadSourcedSkills(skillsEnv, inputs);
```

```js
// ai-skills-manager.js:440-444（现状：env 由调用方注入，manager 自己从不构造 env）
async function refreshSkills(env, { disabled = [], rootDirs = [] } = {}) {
  const roots = rootDirs.filter(Boolean);
  const inputs = [];
  if (rootDirs[0]) inputs.push({ path: rootDirs[0], source: 'managed' });
  if (rootDirs[1]) inputs.push({ path: rootDirs[1], source: 'user' });
```

**新增（同款注入 + 同款动态 import；**不自行剥 frontmatter**）**：

```js
async function readSkillForInvocation(env, name) {
  const entry = _cache.skills.find((e) => e.skill.name === name && e.shadowed !== true);
  if (!entry) return { ok: false, reason: 'not_found', name };
  if (entry.disabled === true) return { ok: false, reason: 'disabled', name };

  const { loadSkills } = await import('@earendil-works/pi-agent-core');
  const dir = path.dirname(entry.skill.filePath);
  const { skills } = await loadSkills(env, dir);
  const fresh = skills.find((s) => s.name === name) || skills[0];
  // 磁盘上 SKILL.md 被删 / 被改成不可解析 → 与「不存在」同形（D-13 推论）
  if (!fresh || typeof fresh.content !== 'string' || fresh.content === '') {
    return { ok: false, reason: 'not_found', name };
  }
  // name 以目录名权威：不一致说明目录被换成别的技能 → 同样按不存在处理，绝不冒名注入
  if (fresh.name !== name) return { ok: false, reason: 'not_found', name };
  return { ok: true, skill: fresh, source: entry.source };
}
```

#### ⑧ `applyShadowing` 的路径匹配形态（`:349-374`）—— `matchSkillByPath` 的对照

```js
// ai-skills-manager.js:353-374（现状：只消费顺序、不重新定义优先级）
function applyShadowing(entries) {
  const winnerByName = new Map();
  const out = [];
  for (const entry of entries) {
    const name = entry.skill.name;
    const loser = winnerByName.get(name);
    if (loser) {
      loser.shadowed = true;
      loser.shadowedBy = entry.source;
      pushEntryDiag(loser, {
        level: 'warning',
        code: 'realm_shadowed',
        message: `同名技能被 ${entry.source} 来源的 "${name}" 遮蔽（败者文件：${loser.skill.filePath}）`,
        path: loser.skill.filePath,
        source: loser.source,
      });
    }
    winnerByName.set(name, entry);
    out.push(entry);
  }
  return out;
}
```

**新增 `matchSkillByPath(absPath)`**：遍历 `_cache.skills` 做**规范化全等比较**
（`path.resolve(e.skill.filePath)`）—— **不按目录前缀猜、不重新扫盘**（Anti-Pattern 5）。

#### ⑨ 导出面（`:662-668`）—— 按同款追加

```js
// ai-skills-manager.js:662-668（现状）
module.exports = {
  LIMITS,
  refreshSkills,
  buildSkillsPrompt,
  getSkillsSnapshot,
  _resetCacheForTest,
};
```

新增：`sourceTierOf`、`getSkillsForUI`、`matchSkillByPath`、`readSkillForInvocation`。

---

### `ipc-handlers.js` / `src/preload.js` — 通道成对写法

**Analog:** `ai:prompt` / `ai:prompt-with-context`（**这是新增通道的逐字模板**）

#### ① `ipc-handlers.js`（`:1673-1720`）

```js
// ipc-handlers.js:1673-1690（模板 A：单参数通道）
  // ==================== AI 相关 ====================

  /**
   * 发送用户消息给 AI Agent
   * @param {string} message - 用户输入的消息
   * @returns {Promise<{success: boolean, conversationId: string|null}>} …
   */
  ipcMain.handle('ai:prompt', async (event, message) => {
    assertTrustedSender(event);
    if (!message || typeof message !== 'string') {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    const conversationId = await aiManager.prompt(message);
    return { success: true, conversationId };
  });
```

```js
// ipc-handlers.js:1692-1720（模板 B：对象载荷通道 + 返回体形状）
  ipcMain.handle('ai:prompt-with-context', async (event, data) => {
    assertTrustedSender(event);
    // 正文可为空串（纯附件发送，marker 文本兜底语义），但必须有消息字段；
    // 空正文时必须携带附件
    if (!data || typeof data.message !== 'string') {
      throw new Error('无效的消息');
    }
    const attachmentIds = Array.isArray(data.attachmentIds) ? data.attachmentIds : [];
    if (!data.message && attachmentIds.length === 0) {
      throw new Error('无效的消息');
    }
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    const conversationId = await aiManager.promptWithContext(
      data.message, data.referencedTabs || [], attachmentIds, data.supportsVision !== false,
    );
    return { success: true, conversationId };
  });
```

**新增两通道（同款三件套：`assertTrustedSender` → `aiManager` 判空 → 返回体）**：

```js
ipcMain.handle('ai:get-skills', async (event) => {
  assertTrustedSender(event);
  if (!aiManager) throw new Error('AI Manager 未初始化');
  return aiManager.getSkillsForUI();
});

ipcMain.handle('ai:refresh-skills', async (event) => {
  assertTrustedSender(event);
  if (!aiManager) throw new Error('AI Manager 未初始化');
  return aiManager.refreshSkillsForPanel();
});
```

**返回体扩展（`:1688` / `:1713`）**：`const conversationId = await aiManager.prompt(...)`
→ `const res = await aiManager.prompt(...)`，返回
`{ success: true, conversationId: res.conversationId, skillInvocation: res.skillInvocation, skillError: res.skillError }`。

#### ② `src/preload.js`（`:969-991` / `:1059-1069`）

```js
// src/preload.js:969-981（现状：ai 命名空间的 JSDoc + invoke 成对写法）
  // ==================== AI 助手 ====================

  /**
   * AI 相关 API
   * 提供 AI Agent 的消息发送、取消、配置和状态查询功能
   */
  ai: {
    /**
     * 发送用户消息给 AI Agent
     * @param {string} message - 用户输入的消息
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    prompt: (message) => ipcRenderer.invoke('ai:prompt', message),
```

```js
// src/preload.js:1059-1069（现状：无载荷通道的 JSDoc + invoke 成对写法 —— 逐字模板）
    /**
     * 获取可用模型列表
     * @returns {Promise<{models: Array<{provider: string, id: string, name: string}>}>}
     */
    getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),

    /**
     * 获取当前 Agent 状态
     * @returns {Promise<{initialized: boolean, model: string|null, toolsCount: number}>}
     */
    getState: () => ipcRenderer.invoke('ai:get-state'),
```

**新增（同款「JSDoc + 箭头 invoke」成对）**：

```js
    /** 读取技能面板投影（同步快照，零 IO；不含正文） */
    getSkills: () => ipcRenderer.invoke('ai:get-skills'),

    /** 后台重扫技能集并把新 prompt 落到 Agent（面板打开时调用一次） */
    refreshSkills: () => ipcRenderer.invoke('ai:refresh-skills'),
```

#### ③ 广播监听（`src/preload.js:718-726` + `src/renderer.js:4206`）

```js
// src/preload.js:718-726（通用监听通道，主进程 broadcast 经此到达 renderer）
  /**
   * 监听收藏栏 IPC 消息
   * 主进程右键菜单行为通过这些 channel 推送
   * @param {string} channel - IPC channel 名称
   * @param {Function} callback - 回调函数
   */
  onIpcMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },
```

> **`skills:changed` 无需新增 preload 面**：`onIpcMessage` 是**通用通道**，
> `windowManager.broadcast('skills:changed')` 直接经它到达 renderer。
> renderer 侧**当前零监听**（本机 grep 确认 `skills:changed` 只出现在 `ai-manager.js:2541`）。

---

### `tests/test-ai-skills.js`（扩展）—— main 侧断言组宿主

**Analog:** 自身既有测试设施

#### ① 头部 require 块（`:13-22`）

```js
// tests/test-ai-skills.js:13-22
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');
const aiManager = require('../ai-manager');
```

#### ② 临时 workspace 注入设施（`:24-46`）—— **所有新用例的夹具基座**

```js
// tests/test-ai-skills.js:24-46
/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-skills-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让后续「空技能集」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}

/** 写入一个契约布局技能：<scannedDir>/<name>/SKILL.md */
function writeSkill(scannedDir, name, { description = `${name} 技能描述`, body = `# ${name}\n\n正文内容\n` } = {}) {
  const dir = path.join(scannedDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
  return file;
}
```

#### ③ 源码扫描三件套（`:48-73`）—— 护栏断言的既有工具

```js
// tests/test-ai-skills.js:48-73
/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/**
 * 取类方法体文本（支持 `async <name>(` / `function <name>(` / 两空格缩进的 `<name>(`）
 */
function methodBody(source, name) {
  let start = source.indexOf(`async ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`\n  ${name}(`);
  assert.ok(start >= 0, `源码中应存在方法 ${name}(`);
  const end = source.indexOf('\n  }', start);
  return source.slice(start, end);
}
```

#### ④ 依赖覆写 + `t.after` 复位先例（`:1226-1233`）—— **seeded 注入测试的模板**

```js
// tests/test-ai-skills.js:1224-1233（覆写模块级依赖 + after 复位）
    const AIManager = require('../ai-manager');
    const wm = require('../window-manager');
    const originalBroadcast = wm.broadcast;
    const calls = [];
    wm.broadcast = (channel) => { calls.push(channel); };
    t.after(() => {
      wm.broadcast = originalBroadcast;
    });
```

**seeded 注入的既有先例**（`tests/test-builtin-skills-seeder.js:364-370`，**P-48-07 的直接解药**）：

```js
// tests/test-builtin-skills-seeder.js:364-370
describe('端到端纵切（tracer）', () => {
  test('真实随包 skills-builtin → 播种 → managed-skills → 零诊断加载 → 不进 prompt', async (t) => {
    const root = withTempRoot(t);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir });
```

对应的注入器实现（`builtin-skills-seeder.js:514-537`）：

```js
// builtin-skills-seeder.js:514-530
/**
 * 注入测试依赖（测试临时目录注入唯一入口）
 *
 * **抽象层次说明（避免误解）**：本注入器收的是**更高层的目录**，不是 Electron 原语 ——
 * - `srcDir` 直接**覆盖 `resolveBuiltinSkillsSrc()` 的返回值**（测试钩子短路该函数），
 *   而不是去伪造 `app.isPackaged` / `process.resourcesPath`；
 * - `managedDir` 同理**覆盖 `getManagedSkillsDir()` 的返回值**。
 */
function setBuiltinDepsForTest(deps) {
  const d = deps || {};
  if ('srcDir' in d) _srcDirOverride = d.srcDir;
  if ('managedDir' in d) _managedDirOverride = d.managedDir;
}
```

**本阶段推荐的夹具（在既有三件套上追加，形式与 `wm.broadcast` 覆写同款）**：

```js
/**
 * 注入 seeded 集合（P-48-07：getSeededSkillNames() 在纯 Node 里 require('electron')
 * 返回字符串 → app 为 undefined → TypeError）
 *
 * 优先路线：seeder.setBuiltinDepsForTest({ srcDir: <真实 skills-builtin 绝对路径> })
 *           + t.after(() => seeder._resetForTest())
 * 备选路线：直接把 seededNames 数组注入投影函数（tier 断言完全不触达 seeder，
 *           研究 §D.25 明确「seeded 集合由测试注入，不依赖真实 skills-builtin/」）
 */
```

#### ⑤ 既有源码扫描断言（`:1278-1295`）—— **不得打红的硬约束**

```js
// tests/test-ai-skills.js:1278-1295（syncAgentSystemPrompt 方法体五条断言，本阶段必须继续绿）
  test('源码：syncAgentSystemPrompt 的早退 → 改写 → 广播形态', () => {
    const body = methodBody(readSource('ai-manager.js'), 'syncAgentSystemPrompt');
    assert.ok(body.includes('refreshSkills('), '必须先重扫技能集');
    assert.ok(body.includes('this.agent.state.systemPrompt = next'), '必须直接改写 agent.state.systemPrompt（不重建 Agent —— D-03）');
    assert.ok(body.includes("windowManager.broadcast('skills:changed')"), '真正改写后必须广播');
    assert.ok(body.includes('this._skillsPromptDirty = true'), '忙时必须置脏');
    assert.ok(body.includes('snap.digest === this._skillsPromptDigest'), '早退须以 digest 为快速判定主键');
```

#### ⑥ 广播行为断言（`:1218-1276`）—— 新增「面板刷新调用方」断言的形态参照

```js
// tests/test-ai-skills.js:1218-1258（节选：覆写 broadcast 后断言调用次数）
  test('广播行为断言：真正改写时以 skills:changed 调用恰一次；无变化不调用；忙时不调用只置脏', async (t) => {
    // …
    await AIManager.prototype.syncAgentSystemPrompt.call(ctx);
    assert.deepStrictEqual(calls, ['skills:changed'], '真正改写了 prompt 时必须以 skills:changed 广播恰一次');
    // (b) 无变化时不调用（digest 早退 + 逐字符比对都生效）
    await AIManager.prototype.syncAgentSystemPrompt.call(ctx);
    assert.strictEqual(calls.length, 1, '无变化时不得重复广播（保 provider 前缀缓存）');
```

---

### `tests/test-skill-picker-model.js`（新建）—— renderer 侧纯逻辑断言组

**Analog:** `tests/test-builtin-skills-seeder.js:340-362` 的源码扫描骨架（同款单文件脚本式）

```js
// tests/test-builtin-skills-seeder.js:340-362（骨架模板）
/**
 * 逐行扫描一组文件，返回命中记录（含文件相对路径 + 行号 + 命中模式 + 理由）
 */
function scanFiles(files, patterns, exemptions = []) {
  const hits = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (exemptions.some((e) => e.file === rel && e.line.test(line))) return;
      for (const { re, why } of patterns) {
        if (re.test(line)) {
          hits.push({ file: rel, line: i + 1, pattern: re.source, why, text: line.trim() });
        }
      }
    });
  }
  return hits;
}
```

**新文件的断言组结构**（A/B/C 三组，研究 §「需要的断言组清单」逐条）：
- A 组：`parseSkillRef` 正例/边界反例/本地命令优先 + `extractArgs` 七组表（**事实 2 的表逐行照抄**）
  + `parseSkillRef` 与 main 侧 `parseSkillInvocationText` 的**规则一致性**（跨进程契约防漂移）
- B 组：过滤两档排序 / 命令分区与既有 `SLASH_COMMANDS.filter` 结果**逐项相等**（对照组防「顺手改语义」）
  / 空分组标题不输出 / `/skill:fi` 前缀分流 / 展平顺序 === 渲染顺序 / `selectable` 判定 / 取模跳过
- C 组：八行状态矩阵的 renderer 半边 + `disableModelInvocation ≠ disabled` 双 flag 独立性
- 源码扫描：`renderer.js` 的 `SLASH_COMMANDS` 数组字面量仍是两条、`renderer.js` 不出现
  `fetch('/api/skills`（Phase 38 事故护栏）、限额字面量零出现

**Playwright 备选路线先例**（若 plan 期否决双模式模块）：

```js
// tests/test-unified-navigation.js:23-26 + :70-85（全局 playwright _electron 驱动真实 dev 应用）
const { _electron } = require('/Users/<user>/.nvm/versions/node/v22.22.0/lib/node_modules/playwright');
const REALM_ROOT = path.join(__dirname, '..');
// …
  const app = await _electron.launch({
    args: ['.'], cwd: REALM_ROOT,
    executablePath: path.join(REALM_ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    env: { ...process.env, NODE_ENV: 'development' },
  });
  // 必须按 URL 找主窗口（firstWindow 可能拿到 devtools 窗口）；轮询等待最多 20s
  let win = null;
  for (let i = 0; i < 100; i++) {
    win = app.windows().find((w) => w.url().includes('index.html'));
    if (win) break;
    await sleep(200);
  }
```

> 代价：慢、需 GUI 环境、断言脆弱（研究明文）。**二者择一，但必须有一处覆盖。**

---

### `src/styles/main.css` — 新增令牌与类

**Analog:** 自身既有 CSS 原语

#### ① 两个主题块（`:7-23` / `:25-43`）—— 新增令牌**必须两处都写**

```css
/* src/styles/main.css:7-23（深色主题，默认） */
:root, [data-theme="dark"] {
  /* 深色主题颜色系统 */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;
  --bg-hover: #404040;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-muted: #6b7280;
  --border-color: #404040;
  --accent-color: #3B82F6;
  --accent-hover: #2563EB;
  --danger-color: #EF4444;
  --success-color: #10B981;
  --warning-color: #F59E0B;
  --ai-tool-card-bg: #252525;
}
```

```css
/* src/styles/main.css:25-43（浅色主题） */
[data-theme="light"] {
  /* 浅色主题颜色系统 */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  ...
  --warning-color: #F59E0B;

  /* AI 工具卡片 */
  --ai-tool-card-bg: #f0f0f0;
}
```

**新增 4 个令牌（两处各写一份）**：`--skill-source-user` / `--skill-source-builtin` /
`--skill-source-managed` / `--skill-limit-text`（值见 UI-SPEC `## Color`）。

#### ② 面板行（`:6972-7019`）—— 分组标题与行五要素的插入点

```css
/* src/styles/main.css:6972-7019（现状：.slash-picker-list 无规则，故 sticky 天然成立） */
/* / 斜杠命令浮动面板（复用 @ 面板定位思路，输入框上方弹出） */
.slash-picker-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  margin-bottom: 4px;
}

.slash-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.slash-picker-row:hover {
  background: var(--bg-hover);
}

.slash-picker-row.active {
  background: var(--bg-hover);
}

.slash-picker-name {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.slash-picker-desc {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**硬约束**：`.slash-picker-panel` 仍是滚动容器；`#slashPickerList` 或其包裹层
**不得加 `overflow:hidden` / `auto`**（会打断分组标题的 `position: sticky`）。
新增 `.slash-picker-row` 的 `flex-wrap: wrap` + 名称/徽标 `flex-shrink: 0` + 描述 `flex:1; min-width:0`。

#### ③ 徽标先例（`.whitelist-tag:8405-8421`）—— 「pill + 低饱和底 + 细边框」的最近 analog

```css
/* src/styles/main.css:8404-8421 */
/* 单个标签 */
.whitelist-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px 0 10px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 14px;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s ease;
}
```

#### ④ 气泡 pill 家族（`:6921-6953`）—— **原地复用，零改动**

```css
/* src/styles/main.css:6921-6953 */
/* 用户气泡内的 @ 引用标记 */
.ai-message-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.ai-message-ref-pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  max-width: 180px;
}

.ai-message-ref-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

> 新增 `.ai-skill-pill-badge` 的底必须是 `rgba(0, 0, 0, 0.25)`（与所属 pill 同底），
> **不得**用 `.ai-attachment-pill-badge` 的 `var(--bg-hover)`（在蓝底气泡上发灰）。

#### ⑤ 折叠框先例（`:5732-5785`）—— **技能正文折叠块逐值照抄**

```css
/* src/styles/main.css:5732-5785 */
/* /compact 可折叠摘要框（默认折叠，点击 header 展开） */
.ai-summary-box {
  /* flex 子项默认可收缩，overflow:hidden 会解除 min-content 高度保护，
     列表内容超高时 box 被压成 0 高只剩边框——必须禁用收缩 */
  flex-shrink: 0;
  max-width: 86%;
  margin: 4px auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.ai-summary-box-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--text-secondary, #888);
  transition: background-color 150ms ease;
}

.ai-summary-box-header:hover { background: var(--bg-hover); }

.ai-summary-box-chevron { margin-left: auto; transition: transform 150ms ease; }

.ai-summary-box.collapsed .ai-summary-box-chevron { transform: rotate(-90deg); }

.ai-summary-box-body {
  display: none;
  padding: 8px 12px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary, #888);
  white-space: pre-wrap;
  word-break: break-word;
  border-top: 1px solid var(--border-color);
  max-height: 260px;
  overflow-y: auto;
}

.ai-summary-box:not(.collapsed) .ai-summary-box-body { display: block; }
```

#### ⑥ 工具卡片（`:5990-6059`）—— D-15 的骨架复用面

```css
/* src/styles/main.css:5997-6006 + :6043-6052 */
.tool-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  cursor: pointer;
  user-select: none;
}

.tool-card-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

#### ⑦ `color-mix` 先例（全库 15 处，如 `:8441`）

```css
/* src/styles/main.css:8441（既有用法） */
  background: color-mix(in srgb, var(--danger-color) 10%, transparent);
```

> 徽标底/边用 `color-mix(in srgb, var(--skill-source-<tier>) 15%/30%, transparent)` —— 同款。

---

### `src/index.html` — 面板容器与脚本接线

```html
<!-- src/index.html:861-864（现状：无结构改动，分组标题由 JS 生成） -->
      <!-- / 斜杠命令浮动面板 -->
      <div class="slash-picker-panel" id="slashPickerPanel" style="display:none">
        <div class="slash-picker-list" id="slashPickerList"></div>
      </div>
```

```html
<!-- src/index.html:1018-1020（现状：脚本加载顺序，新脚本插在 model-family.js 之后、renderer.js 之前） -->
  <script src="ai-brand-map.js"></script>
  <script src="model-family.js"></script>
  <script src="renderer.js"></script>
```

---

### `ai-conversations-manager.js`（可选落点）—— 重载解析的既有先例

**Analog:** 自身 `<context-summary>` 特判（**研究建议装饰层放 `ai-manager.getConversationMessages`，
但形态照抄此处**）

```js
// ai-conversations-manager.js:639-659（★ 具体先例：user 角色包 XML → 剥壳透传）
    // /compact 摘要消息（user 角色包 <context-summary> XML）→ 可折叠摘要框
    // 剥掉 XML 壳透传摘要正文，渲染端默认折叠、点击展开查看
    if (text.startsWith('<context-summary>')) {
      const m = text.match(/^<context-summary>\n?([\s\S]*?)\n?<\/context-summary>$/);
      display.push({
        id: row.id,
        role: 'summary',
        content: (m && m[1] ? m[1] : text).trim(),
        timestamp: row.created_at,
      });
      continue;
    }

    // user 及其他角色 → 用户气泡（attachments 元数据随行带出，供气泡渲染附件徽标）
    display.push({
      id: row.id,
      role: 'user',
      content: text,
      attachments: safeJsonParse(row.attachments, null) || undefined,
      timestamp: row.created_at,
    });
```

> **关键差异**：`<context-summary>` 是把整行**换一个 role**；`<skill>` 装饰是**保留 user role、
> 把 content 换成 args、另挂 `skillInvocation` 字段**（研究 §2.6 的还原规则）。
> 正则模板锚定，**不要用「最后一个空行」之类的位置猜测**。
> assistant 行的 `toolExecutions` 重建形态见 `:580-612`（`{ id, name, status, params }`）。

---

### `docs/product/ai-skills.md` — 新增「发现与调用」章节

**Analog:** 自身现有九节结构（`一、能力` → `九、bash 包管理器安装档`）

章节形态（照抄 `## 三、优先级` 的「要点列表 + 表格」混排）：

```markdown
<!-- docs/product/ai-skills.md:55-59（章节形态模板） -->
## 三、优先级

- **同名遮蔽**：两目录存在同名技能时，`user` 来源胜出，`managed` 来源被遮蔽。…
- **名称以目录名为权威**：…
- **顺序确定**：…
```

```markdown
<!-- docs/product/ai-skills.md:63-73（表格形态模板） -->
## 四、限额

三条限额集中定义在 `ai-skills-manager.js` 的 `LIMITS` 一处（端点与前端零字面量），单位不同、互不换算：

| 常量 | 值 | 单位 | 生效位置与行为 |
|------|----|------|----------------|
| `MAX_SKILL_MD_BYTES` | 64 KiB | **字节**（`FileInfo.size`） | … |
```

**新增章节必须覆盖**（研究 §「文档同步」逐条）：面板形态 / 两种语法 + 本地命令优先 /
**实时读盘口径** / 边界技能行为表（搬 §2.8 矩阵去掉实现列）/ 三档来源徽标 + seeded 判定来源 /
`read` 卡片技能化 / **诚实边界**（面板刷新依赖 `syncAgentSystemPrompt()`，AI 未初始化时不刷新；
`read` 标记在极端 Unicode 文件名下可能不命中）。
同时更新 **§六 已知限制**（补「技能文件改动后需重开对话才反映到已注入的历史消息」）
与 **§七 测试与验证**（补新测试命令）。

---

## Shared Patterns

### 单一数据权威（主进程唯一权威）
**Source:** `ai-skills-manager.js:1-21`（文件头）+ `:440-626`（`refreshSkills` 唯一加载入口）
**Apply to:** 全部涉及技能集状态的文件（`src/renderer.js` / `src/skill-picker-model.js` / `ipc-handlers.js`）

renderer 只渲染，**不得**出现 `bySkillPriority` / `shadowedBy` 判定 / `MAX_USER_SKILLS` /
`8000` 等字面量（研究 §「不得回退的前置约束」的源码扫描判据）。
面板展平数组里每个条目的状态字段**全部**来自主进程投影。

### `assertTrustedSender(event)`（IPC 边界）
**Source:** `ipc-handlers.js:1681` / `:1700`（既有 AI 通道做法）
**Apply to:** 新增的 `ai:get-skills` / `ai:refresh-skills` 两个通道

```js
  ipcMain.handle('ai:prompt', async (event, message) => {
    assertTrustedSender(event);
```

### 「消息对象挂字段」的持久化通道（不改表结构）
**Source:** `src/renderer.js:8711-8731`（renderer 侧挂） + `ai-manager.js:1241-1258`（main 侧挂）
**Apply to:** `skillInvocation` 元数据（D-06 / D-09 / D-16）

```js
// ai-manager.js:1241-1254（main 侧挂的既有实现，挂前判空防重复挂）
      try {
        const messages = this.agent.state.messages || [];
        const lastUser = [...messages].reverse().find((m) => m && m.role === 'user');
        if (lastUser && !lastUser.attachments && resolvedAttachments.length > 0) {
          lastUser.attachments = resolvedAttachments.map((a) => ({ /* … */ }));
          this.saveCurrentConversation();
        }
      } catch (err) {
        console.warn('[Realm AI] 附件元数据挂载失败（不影响消息收发）:', err.message);
      }
```

### XSS 缓解：两条通道，按落点选
**Source:** `src/renderer.js:10834`（`escapeHtml`，`innerHTML` 模板用） / `renderToolCard` 的 `textContent`（`:9274-9284`）

```js
// src/renderer.js:9274-9284（DOM API + textContent：面板之外的一切新渲染走这条）
  // 参数区域（使用 textContent 防止 XSS）
  if (toolExecution.params) {
    const paramsSection = document.createElement('div');
    paramsSection.className = 'tool-card-params';
    const paramsLabel = document.createElement('div');
    paramsLabel.className = 'tool-card-label';
    paramsLabel.textContent = '参数';
    const paramsValue = document.createElement('pre');
```

**判定**：`renderSlashPickerList` 是 `innerHTML` 模板 → 技能名/描述/状态标注/title 全部 `escapeHtml`；
气泡 pill、折叠块、`read` 卡片是 DOM API → 一律 `textContent`，**不得**为「加徽标」退回 `innerHTML`。
tier → 类名映射走**白名单查表**（`{user:'…', builtin:'…', managed:'…'}`），不把 tier 值直接拼进 class。

### 错误/反馈一律走 system-note（禁止静默失败）
**Source:** `src/renderer.js:8794`（`pushSystemNote`） + `.ai-system-note` 样式（`main.css:5713-5725`）
**Apply to:** D-10 禁用 / D-13 未找到 / 未知命令 / main 侧 `skillError` 回传

```js
// src/renderer.js:8684-8688（既有「未知命令」路径 —— D-13 的形态先例，零新渲染形状）
    // 未知命令：提示且不入历史
    elements.aiInput.value = '';
    elements.aiInput.style.height = 'auto';
    pushSystemNote(`未知命令 ${text.split(/\s/)[0]}，输入 / 查看可用命令`);
    return;
```

### 常量单源 + 文档同步维护约定
**Source:** `AGENTS.md`「导航入口与分配规则」「AI 工作区与 Bash 权限」两节同款模式
**Apply to:** `docs/product/ai-skills.md`（本阶段新增章节 + §六/§七更新）

---

## 无先例 / 高风险改动点（planner 需重点给 `<read_first>` 与验收判据）

| # | 改动点 | 为什么高风险 | 现有最接近的先例与缺口 | 建议验收判据 |
|---|--------|-------------|----------------------|-------------|
| **1** | **`src/skill-picker-model.js` 双模式导出**（`module.exports` + `window.` 并存） | 项目内**零先例**。`src/model-family.js:14-17/277-285` 是裸 IIFE + `window.`（不可 require）；`src/vimium/vimium-manager.js:258-265` 是纯 CommonJS（不经 `<script>` 加载）。两者兼有是**新模式** | 骨架仅 3 行样板（研究 §代码骨架已给逐字形态）；备选是 Playwright 路线 | `<read_first>`：`src/model-family.js`（对照形态）、`src/index.html:1018-1020`（加载顺序）。判据：`node --test tests/test-skill-picker-model.js` 全绿 **且** `npm run dev` 面板可用（证明 `<script>` 加载与 `require` 两条路径都通）。**二者择一时必须在 PLAN 里显式记录选择**（研究 A5） |
| **2** | **`getSeededSkillNames()` 的 electron 依赖规避**（事实 4 + P-48-07） | `resolveBuiltinSkillsSrc()` 在纯 Node 里 `require('electron')` 返回字符串 → `app` 为 undefined → **抛 TypeError**（实测）。该模块自述契约是「任何失败仅 console.error + 产诊断，**不 throw**」（`builtin-skills-seeder.js:18-24`）—— 当前实现**违反了自己的契约** | 注入先例已存在：`setBuiltinDepsForTest({ srcDir })`（`:526-530`）+ `_resetForTest()`（`:533-537`）；使用先例 `tests/test-builtin-skills-seeder.js:368`。**缺的是**：fail-safe 是否收进本阶段（研究列为 open question） | `<read_first>`：`builtin-skills-seeder.js:60-70 / :92-107 / :514-537`。判据二选一：① 加 fail-safe 后 `getSeededSkillNames()` 在纯 Node 返回 `[]` 不 throw；② 不加 fail-safe 则投影侧 try/catch 降级 + `console.warn`，且测试一律经 `setBuiltinDepsForTest` 注入 |
| **3** | **重载路径的 `<skill>` 块解析装饰**（P-48-05） | 正则是**对 SDK 固定模板的锚定解析** —— SDK 升版改了引导行格式就静默失配。且**两条路径（live / 重载）必须产出逐字同形的对象** | 形态先例：`ai-conversations-manager.js:641-651` 的 `<context-summary>` 特判（同款「锚定正则 + 剥壳」）。**缺的是**：`tier` 还原（需 `matchSkillByPath`）与「找不到就省略 tier、气泡照常渲染」的降级口径 | `<read_first>`：`ai-conversations-manager.js:570-663`、`node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:8-11`（模板权威）。判据：断言率 27（研究 D 组）—— 把增强消息塞进临时对话库 → `getConversationMessages` 还原出 `{content: args, skillInvocation:{name, tier, content}}`，**并与 live 路径的对象形状断言一致** |
| **4** | **`promptOmitted` 新条目字段**（事实 3 / P-48-08） | 判定条件与 ⑦ 的 `eligible` 过滤**必须完全一致**，漂移即误标（`disable-model-invocation` 的技能会带橙色「超预算」） | **低风险**：与 `overLimit` 完全同族（`:562-566`「标记不剔除」），注入点仅一行。**缺的是**：Phase 50 是否希望用别的字段名（正向语义 `promptOmitted` 已建议） | 判据：构造 3 个超预算技能 + 1 个 `disable-model-invocation` → 断言后者 `promptOmitted !== true`；`disableModelInvocation` 条目**永不** `promptOmitted` |
| **5** | **`read` 工具事件的路径规范化**（研究 §3.2） | `read` 的 `args.path` 是模型给的原文（可相对可绝对），SDK 用 `env.absolutePath` 解析（含 `~` / `file://` 特判）；沙箱 `resolveInside` 用 **root + realpath 双基准**。若词法比对漂移，标记不命中 | **低风险失败模式**：仅表现为「显示为普通 `read` 卡片」，技能正文仍被正常读取。**缺的是**：`matchSkillByPath` 是否需 realpath 双比较（待实测） | 判据：四例路径断言（绝对命中 / 相对 `managed-skills/<name>/SKILL.md` 命中 / `references/*.md` 不命中 / 工作区外不命中）。若实测 realpath 漂移，回退方案是双侧 `path.resolve` + `fs.realpathSync`（存在时）双比较，**不得**退化为「按目录名包含 `skills/` 猜」 |

> **另有 1 处「低风险但易错」**：**`executeActiveSlashCommand` 的 `rest` 取值**（P-48-01，阻断级）。
> 修法是纯函数 + 表驱动测试，不改架构；风险在于**两处（renderer + main）必须用同一套规则**，
> 故研究建议提取为 `src/skill-picker-model.js` 的 `extractArgs` 并由 `parseSkillInvocationText` 复用。

---

## Metadata

**Analog search scope:** 仓库根（`ai-*.js` / `ipc-handlers.js` / `builtin-skills-seeder.js` / `agent-workspace.js`）、
`src/`（含 `src/styles/` `src/vimium/`）、`tests/`、`docs/product/`、`node_modules/@earendil-works/pi-agent-core/dist/harness/`

**Files scanned:** 22（`src/renderer.js` / `ai-manager.js` / `ai-skills-manager.js` / `ipc-handlers.js` /
`src/preload.js` / `builtin-skills-seeder.js` / `ai-conversations-manager.js` / `src/model-family.js` /
`src/vimium/vimium-manager.js` / `src/styles/main.css` / `src/index.html` / `tests/test-ai-skills.js` /
`tests/test-builtin-skills-seeder.js` / `tests/test-unified-navigation.js` / `docs/product/ai-skills.md` /
`.planning/phases/48-skill-name/48-{CONTEXT,RESEARCH,UI-SPEC}.md` 等）

**Tracked-source 校验:** 全部被命名的 analog 均已 `git ls-files -- <path>` 确认为**已追踪源文件**
（`ai-conversations-manager.js` / `ai-manager.js` / `ai-skills-manager.js` / `builtin-skills-seeder.js` /
`docs/product/ai-skills.md` / `ipc-handlers.js` / `src/ai-brand-map.js` / `src/index.html` /
`src/model-family.js` / `src/preload.js` / `src/renderer.js` / `src/styles/main.css` /
`tests/test-*.js` / `skills-builtin/**`）。**零 gitignored 镜像路径**。

**Pattern extraction date:** 2026-09-12
**Baseline for this phase:** `node --test tests/test-ai-skills.js` → `# tests 64 / # pass 64 / # fail 0`（研究实测，2026-09-12）
