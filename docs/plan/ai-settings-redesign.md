# AI 设置页面重新设计规划（参考 CherryStudio）

## 1. 背景与目标

Realm 当前 AI 设置页面对供应商（provider）与模型（model）仅以纯文本列表展示，缺乏品牌辨识度，模型数量多时也难以管理。目标：参考 CherryStudio 的模型设置 UI，重做设置页 AI 分区与聊天框模型选择器，使其：

- 有品牌图标、分组清晰、可搜索、可按组增删
- 内置供应商开箱即用、自定义供应商易接入
- 每个供应商可一键启用/禁用，禁用后不污染聊天选择器

参考截图：`/Users/wxnacy/Downloads/CherryStudio1.png`、`/Users/wxnacy/Downloads/CherryStudio2.png`

约束：规划先行、不直接开发；规划获批后再实现（已获用户"确认规划，开始开发"确认）。

---

## 2. 原始需求拆解（8 点）

1. **品牌图标**：供应商列表、模型列表均显示厂商图标，图标资源来自模型排名网站（models.dev）+ 品牌图标库（@lobehub/icons-static-svg）。
2. **居中加图标的添加对话框**：点击"添加供应商"弹出的对话框应居中，并显示厂商图标。
3. **按供应商分组的模型列表 + 删除**：点击某供应商后，右侧模型按该供应商分组展示，每组行尾有"−"按钮可删除模型。
4. **模型列表头部搜索 + 获取模型列表**：模型列表头部右侧有搜索按钮；"获取模型列表"按钮打开对话框，可筛选并增删模型。
5. **初始模型数量阈值**：新增供应商（初始添加）时，若该供应商模型数 `<10` 则展示全部；若 `>=10` 仅展示每组最新一个模型。
6. **启用/禁用开关**：供应商设置页右上角有启用/禁用开关；被禁用的供应商不出现在聊天框模型选择器中。
7. **研究可优化点**：在实施过程中主动研究哪些交互可以更清晰，并反馈用户。
8. **先规划后开发**（流程约束）。

后续截图反馈（已实现，见第 6 节）：Kimi 图标透明看不清、± 号太小、整体放大设置页字体；添加内置供应商弹框加宽且无横向滚动条；聊天框模型列表也加图标。

---

## 3. 整体架构

数据流（图标与元数据）：

```
models.dev/api.json  ─┐
                      ├─► scripts/generate-ai-brand-map.js ─► src/ai-brand-map.js（提交快照）
@lobehub/icons 静态SVG ┘                                   src/assets/ai-icons/*.svg（子集，168 个）
                                                          │
                                                          ▼
                                              src/model-family.js（运行时分组/图标解析 window.ModelFamily）
```

运行时依赖顺序（两个页面都需在业务脚本前加载）：

- `src/index.html`：`<script src="ai-brand-map.js">` + `<script src="model-family.js">` 在 `renderer.js` 前
- `src/settings.html`：`<script src="ai-brand-map.js">` + `<script src="model-family.js">` 在 `settings-page.js` 前

配置存储（electron-store）：`ai.providers.{id}`（含 `enabled`、`setActive` 等字段）、`ai.activeProvider`。

---

## 4. 图标管道（关键模块）

### 4.1 `src/ai-brand-map.js`（生成，勿手改）
- 全局 `window.AI_BRAND_DATA = { AI_BRANDS, AI_BRAND_ALIASES, AI_PROVIDER_ICONS, AI_MODEL_META }`
- `AI_BRANDS` 每条含 `dark` 布尔（白色字形图标如 kimi 用深色瓷砖）
- `AI_MODEL_META`：`[brandKey, releaseDate, caps, inputMod, outputMod]`，约 1515 条
- 来源：`models.dev/api.json`（MIT）+ `@lobehub/icons-static-svg` v1.94.0（MIT，903 个品牌 SVG）

### 4.2 `scripts/generate-ai-brand-map.js`（创建）
- 从两个数据源生成快照
- `BRANDS` 表覆盖 qwen（别名 qwen/qwq/qvq/tongyi/text-embedding，split:true）、glm、mistral（含 mixtral）、kimi、minimax、deepseek、gpt、claude、gemini、bge（icon baai）、titan、zimage、wan、funasr、codeqwen 等
- `FAMILY_TO_BRAND` 映射：qwen3.5→qwen、qvq→qwen、mixtral→mistral 等
- `DARK_TILE_ICONS = new Set(['kimi'])`；`resolveIcon` 返回 `{icon, color, dark}`
- 同步命令：`curl -sL https://models.dev/api.json -o /tmp/realm-modelsdev.json && npm pack @lobehub/icons-static-svg -p /tmp/realm-icons && tar xzf /tmp/realm-icons/*.tgz -C /tmp/realm-icons && node scripts/generate-ai-brand-map.js`

### 4.3 `src/model-family.js`（创建，window.ModelFamily）
- `resolveModel(id)` → `{brand, series, groupKey, title, icon, color, darkTile, releaseDate, caps:{vision,reasoning,tools}, type}`
- `matchBrandDetailed(id)`：先斜杠后缀别名匹配 → META → 启发式（修复后顺序，避免 Qwen Qwen3.8 边界 bug）
- `extractSeriesFromRest(rest)`：剥离参数量（235b/8x7j）与日期（2026-02-13/-1106），避免日期后缀错误分组为"Qwen 2026.02"
- `groupModels(models)` / `latestPerGroup(models)`：分组（品牌字典 → 斜杠后段 → 启发式）；`>=10` 模型时每组仅取最新一个
- `getProviderIcon(pid)` / `iconUrl(iconKey)` / `iconHtml(iconKey, hasColor, fallbackText, darkTile)`
  - 最终 `iconHtml`：
    ```js
    function iconHtml(iconKey, hasColor, fallbackText, darkTile) {
      if (!iconKey) { return `<span class="ai-icon ai-icon-fallback">${escapeHtml(ch)}</span>`; }
      const tileCls = darkTile ? ' ai-icon-dark-tile' : '';
      if (hasColor) { return `<img class="ai-icon${tileCls}" src="${iconUrl(iconKey + '-color')}" alt="">`; }
      return `<img class="ai-icon${tileCls}" src="${iconUrl(iconKey)}" alt="">`;
    }
    ```
- 所有品牌图标统一白色圆角瓷砖（`background:#fff`）；白色字形图标（kimi）用深色瓷砖 `.ai-icon-dark-tile { background:#141414 }`

### 4.4 `src/assets/ai-icons/`（创建，168 个 SVG）
- @lobehub 图标子集；kimi-color.svg 为白色 K 字形（`fill="#fff"`），故走深色瓷砖渲染

---

## 5. CSP 约束与 CSS 模式（必须遵守）

`realm://` 页面 CSP 为 `style-src 'self'`（无 unsafe-inline）：

- **HTML markup 内联 style 不生效**（如 `style="display:none"` 被忽略，元素会短暂/持续可见）→ 初始隐藏一律走 CSS 类规则
- **JS 的 `el.style.display='flex'/'block'/'none'`（CSSOM）不受限**，显隐切换用具体值，不要依赖 `''` 回落
- **不要在内联 style 写 `mask-image`** → 单色图标改用 `<img>` + 白色圆角瓷砖

受影响元素：`.ai-modal-overlay { display:none }`（JS 切换 flex）、`#aiModelSearch { display:none }`、`.ai-add-custom-form { display:none }`、`#aiCustomError { display:none }`。

`main.js` HTTP 服务器路由：`/settings/<sub>` → `src/<sub>`，已支持 `.svg` MIME（main.js:~482）。`settings.html` 含 `<base href="/settings/">`，相对 URL 在 `/settings/` 下解析。

---

## 6. 实现方案（各模块改动）

### 6.1 `src/settings.html`（重写 AI 分区）
- 引入 ai-brand-map.js / model-family.js
- 编辑器头部：`#aiEditorIcon`、`#aiEnableToggle`（switch）、`#aiEnableLabel`
- 模型部分头部：`#aiModelHeaderTitle`、`#aiModelSearchBtn`、`#aiFetchModelsBtn`（替代原 detect 按钮）、`#aiModelAddBtn`、`#aiModelSearch`（CSS 隐藏）、`#aiModelGroups`、`#aiModelEmpty`、`#aiModelError`
- 新增 `#aiAddDialog`（`.ai-modal-overlay`，无内联 style）→ `#aiAddGrid`、`#aiAddCustomHeader`/`#aiAddCustomForm`/`#aiCustomName`/`#aiCustomBaseURL`/`#aiCustomApiKey`/`#aiCustomCreateBtn`/`#aiCustomError`
- 新增 `#aiFetchDialog`（`.ai-modal-overlay`）→ `#aiFetchTitle`/`#aiFetchCount`/`#aiFetchAddAllBtn`/`#aiFetchSearch`/`#aiFetchTabs`/`#aiFetchList`

### 6.2 `src/settings-page.js`（大量新增/重写）
- `renderProviderList()`：图标 `MF.getProviderIcon(p.id)` + `MF.iconHtml`；禁用态变灰 + "已停用"标签；活动点
- `showEditorForm()`：设 `#aiEditorIcon`（iconHtml）、`#aiEnableToggle`（class/aria）；baseURL 始终可见（内置只读）
- `renderModelGroups(provider)`（由 `renderModelTags` 升级）：分组可折叠列表，每行 = 图标 + 名称 + caps 徽章 + "−"删除；`aiModelGroupCollapsed` Map 保存折叠态；`aiCapBadgeSvg(kind)` 辅助
- `saveProviderConfig()`：body 带 `enabled`；保存后若 `apiKey && !hadModels` 调 `autoPopulateModels`
- 新增：`requestDetectModels(providerId, creds)`、`autoPopulateModels`（应用阈值规则：`<10` 全部，`>=10` `MF.latestPerGroup`）、`showFetchModelsDialog()`、`renderFetchDialog(provider)`（类型 tab、搜索、+/-）、`showModelAddInput()`
- 新增：`showAddProviderDialog()`、`renderAddProviderGrid()`（5 列，居中，无横向滚动）、`createCustomProvider()`、`setProviderEnabled(enabled)`（立即 POST `setActive:false`，尊重已配置状态）
- `setupAISettingsListeners()` 为所有新 ID 重新接线
- 全部 9 处 `iconHtml` 调用补齐 `darkTile` 第 4 参；按钮 SVG 12px→14px

### 6.3 `src/renderer.js`（聊天下拉加图标）
- `renderModelDropdown()`：
  - 过滤 `if (provider.enabled === false) return;`
  - 组标题取 `MF.getProviderIcon` 图标
  - 每模型图标：
    ```js
    if (MF) {
      const r = MF.resolveModel(model.id);
      const iconWrap = document.createElement('span');
      iconWrap.className = 'ai-model-option-icon';
      iconWrap.innerHTML = MF.iconHtml(r.icon, r.color, model.name || model.id, r.darkTile);
      option.appendChild(iconWrap);
    }
    ```
- `updateModelSelectorButton()`：活动供应商禁用时回退到第一个启用的已配置供应商

### 6.4 `ai-manager.js`（启用/禁用语义）
- `configureProviders`：解构 `enabled` 与 `setActive`；两条路径持久化 `enabled`；`if (config.setActive !== false) { this.configStore.set('ai.activeProvider', provider); }`
- `init()`：活动供应商选择 `const enabledIds = configuredIds.filter(id => providersCfg[id].enabled !== false); const activeProvider = savedActive && enabledIds.includes(savedActive) ? savedActive : enabledIds[0];` 含空值守卫 `if (!activeProvider) { isInitialized = false; return; }`
- `getAvailableModels()`：内置路径 `enabled: saved && saved.enabled === false ? false : true`；自定义路径同逻辑

### 6.5 `src/styles/main.css`（AI 分区样式）
- `.ai-icon`：22px、圆角 5px、白瓷砖 `background:#fff`、padding 2px
- `.ai-icon-dark-tile { background:#141414 }`；`.ai-icon-fallback { padding:0 }`
- 供应商项 52px / 字体 15px；供应商图标 26px；编辑器头部图标 30px、标题 17px；AI 表单标签 14px、提示 13px
- `.ai-family-title` 14px、`.ai-family-count` 12px；`.ai-model-row` 名称 14px、padding `6px 8px 6px 30px`
- `.ai-model-remove` 26px、`opacity:1` 常显、hover 危险色
- `.ai-cap-badge svg` 13px（vision/reasoning/tools 各色）
- 对话框：`.ai-add-dialog { width:720px; max-width:94vw }`、`.ai-add-grid { grid-template-columns: repeat(5, minmax(0,1fr)); overflow-x:hidden }`、单元格图标 34px；`.ai-fetch-dialog { width:720px }`
- 下拉：`.ai-model-option { height:36px; gap:8px; font-size:14px }`、`.ai-model-option-icon { width:18px; height:18px }`、`.ai-model-group-title .ai-icon { width:16px; height:16px }`
- `.btn-icon { width:28px; height:28px }`

### 6.6 `src/index.html`
- 在 renderer.js 前加 ai-brand-map.js、model-family.js

### 6.7 `AGENTS.md`
- 渲染进程文件表补 ai-brand-map.js / model-family.js / ai-icons/ 行
- 新增 CSP 节（内联 style / mask-image 被阻，走 CSS 类 + CSSOM）
- 新增"AI 供应商模型分组与品牌图标"节（分组规则 + 生成器命令）
- 更新 ai-icons 描述为白瓷砖/深瓷砖方法

---

## 7. 研究发现的优化点（需求第 7 点）

实施过程中主动改进的清晰度问题：

1. **CSP 感知的初始隐藏**：对话框/搜索框初始隐藏用 CSS 类而非内联 style，否则被 CSP 拦截导致页面加载即闪现。
2. **单色图标渲染**：放弃内联 `mask-image`（被 CSP 阻），统一改为 `<img>` + 白色圆角瓷砖；白色字形图标（kimi）自动走深色瓷砖，保证可见。
3. **分组边界质量**：针对真实 241 模型聚合供应商（Bailian）修正多种边界 case——日期后缀、参数量吞系列号、斜杠前缀 ID、distill 模型、Qwen Qwen3.8 meta 分支 bug（详见 generate-ai-brand-map.js 与 model-family.js 注释）。
4. **删除按钮常显**：模型行"−"按钮默认 `opacity:1`，避免 hover 才出现导致找不到；放大到 26px、SVG 14px。
5. **整体字号放大**：设置页 AI 分区供应商/模型/组标题/表单标签整体放大一档，提升可读性（用户截图反馈后落实）。
6. **添加内置供应商弹框加宽到 720px / 5 列 + `overflow-x:hidden`**，消除横向滚动条（用户截图反馈后落实）。

---

## 8. 文件改动清单

新建：
- `scripts/generate-ai-brand-map.js`
- `src/ai-brand-map.js`（生成）
- `src/model-family.js`
- `src/assets/ai-icons/*.svg`（168 个）

修改：
- `src/settings.html`
- `src/settings-page.js`
- `src/renderer.js`
- `src/index.html`
- `ai-manager.js`
- `src/styles/main.css`
- `AGENTS.md`

---

## 9. 验证方式

- 所有 JS 文件 `node --check` 通过
- 独立 chromium 视觉测试（浅色主题）：确认 Kimi 深瓷砖白色 K 可见、添加弹框无横向滚动条
- 真实 Electron 下拉测试：`DROPDOWN {exists:true, groups:2, groupIcons:2, options:243, optionIcons:243, broken:[]}`
- 变更未提交，待用户确认后提交

---

## 10. 后续可选

- 提交上述变更（用户确认后执行）
- 词典/图标更新走生成器命令，勿手改快照
