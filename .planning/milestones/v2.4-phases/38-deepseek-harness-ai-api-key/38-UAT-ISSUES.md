# Phase 38 UAT 问题排查记录

## 问题概述

Phase 38 实现了 AI 助手多供应商管理功能，但 UAT 测试中发现多个问题导致核心功能不可用。

---

## 问题 18：下拉打开/键盘导航不停留在激活模型位置（2026-08-22 用户反馈）

**现象：** 激活的模型不在列表前排时：
1. 点击模型选择按钮打开下拉，显示的是列表第一页（顶部），看不到当前聚焦项
2. 按上下键选择后视口也会跳回第一页

**根因：**
1. `renderModelDropdown` 给激活项加了 focused class，但**没有滚动下拉容器**——
   激活项在列表深处时停留在视口外
2. 键盘导航用 `scrollIntoView({ block: 'nearest' })`——它会**连带滚动所有祖先
   可滚动容器**（包括外层页面），行为不可控，视口被拽回顶部

**修复（renderer.js）：**
- 新增 `scrollModelDropdownToOption(optionEl, center)`：手动计算并设置下拉容器的
  `scrollTop`，只滚动下拉自身，完全避开 scrollIntoView 的跨容器副作用
- `renderModelDropdown` 渲染后把激活项滚动到容器**中央**（打开即见）
- 键盘导航改为贴边滚动（nearest 等价语义，仅作用于下拉容器）

**实测验证（290 个模型的大列表）：**
- 打开下拉 scrollTop=599，激活项「glm-5.2-fast-preview」居中可见
- ↓↑ 连续移动，焦点项始终在视口内，scrollTop 平滑不跳页

---

## 问题 1：添加自定义供应商按钮无反应

**现象：** 点击「添加自定义供应商」按钮无任何反应

**根因：** `main.js` 中 `POST /api/ai/providers` 端点验证逻辑要求 `apiKey` 非空：
```javascript
if (!config || !config.provider || !config.apiKey) {
  sendJson(res, 400, { error: '提供商和 API Key 不能为空' });
}
```
但自定义供应商创建时 `apiKey` 为空字符串，被服务端拒绝返回 400。

**修复：**
- `main.js` 第 1149 行：验证改为只检查 `provider`，移除 `apiKey` 必填要求
- `settings-page.js`：添加自定义供应商按钮增加 try-catch 错误提示

---

## 问题 2：模型检测报错 400

**现象：** 点击「检测模型」报错 `设置 API 请求失败: 400`

**根因：** `main.js` 中 `POST /api/ai/providers/:id/detect-models` 端点要求请求体中 `apiKey` 非空。但用户可能依赖环境变量，请求体中无 `apiKey`。

**修复：** `main.js` 第 1175 行：增加环境变量回退逻辑，请求无 `apiKey` 时自动从环境变量检测。

---

## 问题 3：内置供应商（如 xiaomi）检测模型报错「没有默认端点」

**现象：** 内置供应商 xiaomi 点击检测模型报错 `提供商 xiaomi 没有默认端点，请手动指定 base URL`

**根因：** `ai-manager.js` 的 `detectModels` 函数检查 `provider.baseURL`（大写 U），但 pi-ai 目录库使用 `baseUrl`（小写 u）：
```javascript
// xiaomi.js
createProvider({
  id: "xiaomi",
  baseUrl: "https://api.xiaomimimo.com/v1",  // 小写 u
  ...
});
```

**修复：** `ai-manager.js` 第 1313 行：改为同时检查两种写法：
```javascript
const providerBaseURL = provider && (provider.baseURL || provider.baseUrl);
```

---

## 问题 4：新建供应商在列表中不显示

**现象：** 添加自定义供应商后，左侧列表不显示该供应商

**根因：** `settings-page.js` 的 `loadAISettings` 函数过滤条件过严：
```javascript
aiProvidersList = aiProvidersCatalog.filter(p => p.configured);
```
只显示已配置 `apiKey` 的供应商，新建的自定义供应商（无 apiKey）被过滤掉。

**修复：** 改为包含自定义供应商：
```javascript
aiProvidersList = aiProvidersCatalog.filter(p => p.configured || p.isBuiltin === false);
```

---

## 问题 17：API Key 显隐切换无内容可看（已保存 Key 不回显，2026-08-22 用户反馈）

**现象：** 手动填写过 Key 的供应商（如 modelscope），选中后 API Key 输入框是空的
（仅 placeholder 显示「已保存 (…xxxx)」），点「显示」切换成明文也没有内容可看。

**根因：** `getAvailableModels` 出于安全只返回 keyPreview（后 4 位），
前端从未拿到完整 Key，显隐切换按钮对着空输入框失去意义。

**修复：**
- `main.js`：新增 `GET /api/ai/providers/:id/api-key` 端点，按需返回完整 Key
  （不随列表请求下发，收窄暴露面）
- `ai-manager.js`：新增 `getProviderApiKey(providerId)` 从 configStore 读取
- `settings-page.js`：`showEditorForm` 对已配置供应商回显完整 Key 到输入框
  （默认 password 遮蔽，点「显示」查看明文）；
  每次打开表单重置 type=password 和按钮文本；
  placeholder 改为「留空则使用环境变量（如有）或保留原 Key」
  （与问题 11 的 __keep__ 环境变量优先语义衔接：清空输入框保存 = 环境变量生效）

**实测验证：** 选中 modelscope → 输入框回显完整 Key（与 configStore 一致）→
password 遮蔽 → 点「显示」明文可见 → 再点恢复遮蔽。

---

## 问题 16：模型选择器键盘上下键看似无效（2026-08-22 用户反馈）

**现象：** 模型选择器下拉打开后，按 ↑↓ 键不能选择模型。

**根因：** `handleModelSelectorKeydown` 的 focused class 切换逻辑本身正常，
但 `.ai-model-option.focused` **没有定义任何 CSS 样式**——
焦点项在视觉上与普通项无异，用户感知为「按键没反应」。
另外打开下拉时没有任何初始聚焦项，第一次按键的起点也不直观。

**修复：**
- `main.css`：新增 `.ai-model-option.focused` 样式（hover 底色 + accent 描边）
- `renderer.js`：`renderModelDropdown` 给当前激活项同时加 `focused`，
  打开下拉即以当前模型为键盘导航起点

**实测验证：** ↓↑ 移动（focused 背景色生效）→ Enter 选中（按钮文本更新、下拉关闭）→
Esc 关闭，全部正常。同轮验证：点击外部（pointerdown）关闭下拉正常。

---

## 问题 15：新对话按钮只清 UI 不清上下文（2026-08-22 用户反馈）

**现象：** 点击「新对话」后消息列表看似清空，但再次发送时：
1. 之前的聊天内容重新出现在列表中
2. 旧内容仍在 LLM 上下文中（AI 记得之前的对话）

**根因（双层）：** `handleNewConversation` 只做了 DOM 清空（`innerHTML = ''`），
但消息有两个真实的存储层都未重置：
1. **主进程 Agent transcript**（`agent.state.messages`）——LLM 请求的消息来源，
   未清空所以旧内容仍在上下文
2. **renderer 的 `state.aiMessages` 数组**——`renderAIMessages()` 的渲染数据源，
   未清空所以下次渲染时旧消息全部复现

**修复（完整链路四处）：**
- `ai-manager.js`：新增 `newConversation()`，调 pi-agent-core Agent 的 `reset()`
  （清空 transcript/流式状态/消息队列，保留 systemPrompt/model/tools）
- `ipc-handlers.js`：新增 `ai:new-conversation` 通道（assertTrustedSender）
- `preload.js`：暴露 `realmAPI.ai.newConversation()`
- `renderer.js`：`handleNewConversation` 改为 async，清空 `state.aiMessages` + 调 IPC 重置主进程

**实测验证（暗号测试法）：**
1. 告知 AI 暗号「蓝莓7492」→ 回复「记住了」
2. 点新对话 → 消息列表清空 + 主进程 transcript 重置
3. 问「我刚才告诉你的暗号是什么」→ AI 明确回答「这是我们本次会话的第一条消息」，
   且列表中只有新对话的 2 条消息，旧消息不复现

---

## 问题 14：新对话按钮文字竖排 + 重启后模型选择器不显示当前模型（2026-08-22 用户反馈）

**现象 1：** 聊天工具栏「新对话」按钮没有按钮形态，「新对话」三字竖排显示，svg 图标被挤没。

**根因 1：** 按钮同时挂了 `.btn-icon`（固定 `width: 32px; height: 32px`）和 `.ai-new-chat-btn`
（flex 横向布局但未覆盖宽度）。32px 宽度放不下 svg + 三个汉字，文字被迫逐字换行。

**修复 1（main.css）：** `.ai-new-chat-btn` 覆盖 `width: auto; height: auto; white-space: nowrap`。

**现象 2：** 退出重进应用后，模型选择器按钮显示「选择模型 ▾」而非上次选择的模型，
点击一次下拉后才恢复显示。

**根因 2：** `updateModelSelectorButton` 依赖内存缓存 `aiModelsData`，
而 `loadModelSelectorData` 之前只在首次打开下拉时才调用——启动后缓存为空，按钮显示默认文案。

**修复 2（renderer.js）：** renderer 初始化时（获取 realmPort 后）主动调 `loadModelSelectorData()`，
启动即回显当前模型。

**实测验证：** 新对话按钮 74px 横排带图标；重启后按钮直接显示当前模型名。

---

## 问题 13：自定义供应商切换模型报「未知提供商」+ 发送报「AI 助手未初始化」（2026-08-22 用户反馈）

**现象：** 添加自定义供应商、检测模型都成功，但从模型选择器下拉选择该供应商的模型后：
1. renderer 报 `切换模型失败: 未知提供商: custom-xxx`
2. 发送消息报「AI 助手未初始化」

**根因（四层叠加）：**
1. `selectModel`（renderer.js）调 configureProviders 时未传 `isBuiltin: false`，
   后端按内置供应商校验，catalog 找不到 custom id → 抛「未知提供商」
2. 更根本：`init()` 只用 `builtinModels`（内置目录），自定义 provider 从未注册进 Models，
   `getModel(customId, modelId)` 返回 undefined → 初始化失败 → 发送报「未初始化」
3. 注册实现时 `openAICompletionsApi` 从主入口导入（实际未导出，undefined），
   ESM 动态导入缺失绑定抛 SyntaxError，被 init 的 catch 吞到 stderr，表现为「静默失败」
4. init 注册后，`_getCatalog()` 复用 `this.models` 导致自定义供应商污染目录，
   `getAvailableModels` 误判其为内置（isBuiltin: true），selectModel 又把它传回后端走内置校验

**修复（ai-manager.js / renderer.js）：**
1. `init()` 中对 `getProvider(id)` 查不到的已配置供应商，用 `createProvider` 按 OpenAI 兼容协议
   动态构造并 `setProvider` 注册（baseUrl/apiKey/customModels 来自 configStore；
   判定按「id 是否在内置目录」而非 configStore 的 isBuiltin 字段，历史脏数据自愈）
2. `openAICompletionsApi` 改从子路径 `@earendil-works/pi-ai/api/openai-completions.lazy` 导入
3. `_getCatalog()` 不再复用 `this.models`，永远返回纯净内置目录独立实例
4. `selectModel` 从 aiModelsData 查 provider 的 isBuiltin 并传给后端

**实测验证（真实 modelscope 供应商，46 个模型）：**
切换 → 「自定义供应商已注册 (46 个模型)」→「初始化完成: custom-xxx/DeepSeek-V4-Flash」
→ 发送消息 AI 正常回复。isBuiltin 判定正确（`builtin: false`）。

---

## 问题 11：检测模型成功但发送消息 401（__keep__ 保留旧 Key 与环境变量提示矛盾，2026-08-22 用户反馈）

**现象：** 环境变量 XIAOMI_API_KEY 有效，检测模型成功返回真实模型列表，
但发送消息报 `401 Invalid API Key`。

**根因（三层叠加）：**
1. configStore 中残留着早前保存的**已失效 Key**
2. 检测模型走 main.js 端点的环境变量回退（用真 Key，成功）
3. 但保存时前端传 `__keep__` 哨兵（输入框为空 + configured=true），
   后端 `__keep__` 分支直接保留旧的失效 Key，环境变量回退逻辑根本没机会执行
4. UI 却提示「检测到环境变量，已自动使用」——承诺与实际行为矛盾，用户无法察觉

关键证据：真实环境变量直接 curl `chat/completions` 返回 200，
证明 Key 对两个端点都有效，问题出在 Agent 使用了旧 Key。

**修复：**
- `ai-manager.js`：`__keep__` 解析优先级改为 **环境变量 > 已保存 Key**
  （与 UI 提示语义对齐：显式输入 > 环境变量 > 已保存）
- `settings-page.js`：已 configured 供应商的环境变量提示改为
  「检测到环境变量 X，保存时将使用它覆盖已保存的 Key」，消除歧义

**实测验证（真 XIAOMI_API_KEY）：** 保存时日志「从环境变量检测到 API Key（覆盖已保存）」
→ 发送消息 AI 正常回复。用户恢复路径：设置页点一次「保存配置」即可让环境变量覆盖旧 Key。

---

## 问题 12：设置页删减模型后聊天面板模型选择器不同步（2026-08-22 用户反馈）

**现象：** 设置页删除几个模型后，聊天面板工具栏的模型选择器下拉仍显示旧列表。

**根因：** renderer 的 `aiModelsData` 是内存缓存，`openModelDropdown` 只在
缓存为空时才拉取（`if (!aiModelsData) loadModelSelectorData()`），
设置页的变更不会推送到主窗口，缓存永不过期。

**修复（renderer.js）：** `openModelDropdown` 改为每次打开都重新拉取数据
（一次 IPC 调用，成本可忽略），不再依赖过期缓存。

**实测验证：** 设置页删 2 个模型（6→4）→ 保存 → 主窗口下拉同步显示 4 个。

---

## 问题 9：模型选择器下拉打不开（主窗口 CORS + 模板字符串双重 bug，2026-08-22 UAT 8-11 发现）

**现象：** 聊天面板工具栏点击模型选择器按钮，下拉菜单不出现，按钮永远显示「选择模型 ▾」。

**根因（双层）：**
1. `renderer.js` 的 `loadModelSelectorData` 使用**单引号**字符串：
   ```javascript
   fetch('http://localhost:${location.port}/api/ai/providers')
   ```
   `${location.port}` 不会插值，请求 URL 是字面量，永远失败。
2. 即使修好插值，主窗口 index.html 从 `file://` 加载，fetch `http://localhost:PORT` 是**跨域请求**，
   本地 HTTP 服务器未设 CORS 头 → `TypeError: Failed to fetch`。
   （设置页 guest 是 `http://localhost:PORT` 同源所以一直正常，问题只在主窗口 renderer。）
3. 且 `/api/ai/providers` 路径本身也不存在——服务器只有 `/api/settings/ai/providers` 路由。

**修复（renderer.js）：** `loadModelSelectorData` 和 `selectModel` 改走 preload 暴露的受信 IPC
（`realmAPI.ai.getAvailableModels` / `realmAPI.ai.configureProviders`），
符合架构约定：主窗口 webContents 受信走 IPC，webview guest 走 token 鉴权的 HTTP API。

**配套修复（ai-manager.js）：** `configureProviders` 的 `validModel` 校验可选集合合并
已保存的 `existing.customModels`——下拉切换模型只传 `model` 不传 `customModels`，
否则选择「检测到的但不在 catalog 默认列表」的模型会被校验静默回退。

**实测验证：** 下拉打开、按供应商分组、active 高亮、切换后按钮文本/后端 activeModel/Agent 重新初始化全部正常。

---

## 问题 10：环境变量自定义名检测永远 403（URL 拼接 bug，2026-08-22 UAT 6 发现）

**现象：** 修改环境变量名输入框后，检测提示不更新（不变红/绿）。

**根因：** `settings-page.js` 把查询参数直接拼进 route 字符串：
```javascript
settingsApi(`ai/providers/${id}/env-var?customName=${name}`)
```
而 `settingsApi` 内部再拼 `?token=...`，最终 URL 变成
`/api/settings/ai/providers/x/env-var?customName=YYY?token=ZZZ`——
第二个 `?` 成为 customName 值的一部分，token 参数丢失 → 403 → catch 静默忽略 → 提示不更新。

**修复（settings-page.js，两处）：** customName 改走 `settingsApi` 的第三参数 query 对象，
由 URLSearchParams 统一编码拼接。

**实测验证：** 存在名 → 绿「已自动使用」；不存在名 → 红「未检测到」；来回切换正常。

---

## 问题 8：保存后模型列表回退默认列表，删除模型不生效（2026-08-22 复验发现）

**现象：** 检测模型能获取到列表，但点击保存后模型列表又变回默认列表；
删除模型标签后保存，重新打开也恢复原样。

**根因：** 数据保存与回显走了两个字段：
- 检测/删除的结果保存在 `customModels`（已正确持久化到 configStore）
- 但 `getAvailableModels()` 返回内置供应商时，`models` 字段永远取 catalog 默认列表（`p.getModels()`），
  `customModels` 只作为附加字段返回，UI 渲染用的是 `models`
- 保存后 `loadAISettings()` 重新拉取 → `renderModelTags(provider)` 渲染默认列表 → 用户的修改"看起来没生效"

**修复（ai-manager.js）：**
1. `getAvailableModels`：内置供应商 `models` 字段改为——`customModels` 非空时优先用它
  （视为用户确认过的列表），名称从 catalog 补全；为空时才回退 catalog 默认列表
2. `configureProviders`：`validModel` 校验的可选集合同样优先 `customModels`
  （检测到的新模型可能不在 catalog 默认列表中，否则会被校验回退掉）；
   自定义供应商 model 为空时回退 `customModels[0]`

**实测验证（playwright _electron）：**
- xiaomi 默认 5 个模型 → 删除 2 个 → 保存 → 重载后仍显示删减后的 3 个，重新选中也是 3 个
- Agent 初始化模型正确落到删减后列表的第一个（xiaomi/mimo-v2.5-pro）

---

## 问题 7：环境变量已检测到，但点检测模型/保存仍被前端拦截（2026-08-22 复验发现）

**现象：** xiaomi 供应商，页面已显示绿色提示「检测到环境变量 XIAOMI_API_KEY，已自动使用」，
API Key 输入框 placeholder 也显示「环境变量 XIAOMI_API_KEY 已配置」，
但点击「检测模型」和「保存配置」时焦点跳到 API Key 输入框，操作未执行。

**根因：** 前端守卫只认输入框的值，与后端环境变量回退逻辑脱节：
- `detectModels` 的 `if (!apiKey && !provider.configured)` 直接拦截，请求根本没发出去
- `saveProviderConfig` 的内置供应商空 key 检查同理
- 而后端两个端点早已实现环境变量回退（main.js detect-models / ai-manager.js configureProviders），前端拦截使它永远不会被触发

**修复（settings-page.js / main.js）：**
1. 删除 `detectModels` 和 `saveProviderConfig` 的前端空 key 硬拦截，放行请求由后端回退环境变量；
   环境变量也没有时后端返回明确错误（「API Key 不能为空，请在输入框填写或设置环境变量」）
2. `settingsApi` 错误处理增强：HTTP 非 200 时解析响应体 `error` 字段作为异常消息，
   用户能看到后端的具体原因而不是干巴巴的「请求失败: 400」
3. detect-models 请求体现在携带 `envVarName`，main.js 回退检测时优先使用用户自定义环境变量名

**实测验证（playwright _electron + XIAOMI_API_KEY=假key 启动 dev）：**
- 空输入框点检测模型 → 「检测中...」→ 环境变量回退发请求至 xiaomi 端点 → 401 → 显示「API Key 无效」，焦点不再被劫持
- 空输入框点保存 → 「保存中...」→ 后端从 XIAOMI_API_KEY 取 key → 保存成功 → AI Manager 初始化完成 → 状态栏「已连接 (xiaomi / mimo-v2-flash, 13 个工具)」

---

## 问题 5：保存配置时自定义供应商被拒绝

**现象：** 自定义供应商点击保存报错

**根因：** `ai-manager.js` 的 `configureProviders` 函数要求 `apiKey` 非空：
```javascript
if (!apiKey) {
  throw new Error('API Key 不能为空');
}
```

**修复：** 增加环境变量回退 + 自定义供应商允许首次创建无 apiKey：
```javascript
if (!apiKey) {
  // 尝试从环境变量检测
  const envResult = this.detectEnvVar(provider, envVarName);
  if (envResult && envResult.found) {
    apiKey = envResult.value;
  }
}
// 自定义供应商允许首次创建时无 apiKey
if (!apiKey && isBuiltin === false) {
  // 保存配置但不初始化 Agent
  return { success: true, pending: true };
}
```

---

## 问题 6（未验证）：内置供应商 baseURL 未返回给客户端

**现象：** 客户端无法获取内置供应商的 baseURL

**根因：** `getAvailableModels` 函数返回内置供应商时未包含 `baseURL` 字段。

**修复：** 添加 `baseURL: p.baseURL || p.baseUrl || null` 到返回对象。

---

## 待验证问题（已排查，2026-08-22 复验）

用户反馈「点击检测模型和保存都没有反应」。已用 playwright _electron 驱动真实 dev 应用实测验证：

**结论：问题 1-6 的代码修复全部生效，按钮链路正常。**

实测结果：
- 自定义供应商（无 key）点保存 → 按钮变「保存中...」→ POST 200 → 保存成功（pending 分支）
- 内置供应商（deepseek + 假 key）点检测模型 → 按钮变「检测中...」→ 请求发出 → 401 → 页面显示「模型检测失败：API Key 无效」
- 四个猜测原因全部排除：Base URL 显示/隐藏逻辑正常、事件绑定时机正常、无 JS 语法/运行时错误、settingsApi 路由匹配正常

**「没反应」的真实根因：前端静默拦截 + toast 反馈不足**

对未填写 API Key 的供应商，点击「检测模型」/「保存」时被前端守卫拦截
（`detectModels` 的 `if (!apiKey && !provider.configured)`、`saveProviderConfig` 的内置供应商 key 检查），
仅弹一个 **2 秒、无错误样式** 的 toast，用户极易错过，感知为「完全没反应」。
且 `showToast` 第二参数 `'error'` 原本被忽略（函数只接收 message），错误提示无视觉区分。

**已修复（settings-page.js）：**
1. `showToast(message, type)` 支持 `'error'` 类型：加 `toast-error` class（红色左边条，CSS 已有），显示时长从 2s 延长到 4s
2. ~~无 key 拦截时自动 focus() 到 API Key 输入框~~（后续被问题 7 的修复取代：前端拦截整体删除，
   空 key 放行给后端走环境变量回退，见下文「问题 7」）

复验通过：error toast 可见且带样式、焦点落在 API Key 输入框、2.8s 后 toast 仍可见。

---

## 历史猜测（已排除）

1. ~~**Base URL 输入字段**~~：`showEditorForm` 显示/隐藏逻辑正常（实测排除）
2. ~~**事件监听器绑定时机**~~：按钮为静态 HTML，`setupAISettingsListeners` 绑定正常（实测排除）
3. ~~**JavaScript 控制台错误**~~：`node --check` + 实测 pageerror 监听均无错误（实测排除）
4. ~~**settingsApi 路由问题**~~：`/api/settings/ai/providers` 路由匹配正常（实测排除）

---

## 已修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `main.js` | POST /api/ai/providers 验证逻辑放宽 |
| `main.js` | detect-models 端点增加环境变量回退 |
| `ai-manager.js` | detectModels 修复 baseUrl/baseURL 大小写 |
| `ai-manager.js` | configureProviders 增加环境变量回退 + 自定义供应商允许无 apiKey |
| `ai-manager.js` | getAvailableModels 返回 baseURL 字段 + 包含无 apiKey 的自定义供应商 |
| `settings.html` | 新增 Base URL 输入字段 |
| `settings-page.js` | showEditorForm 填充/显示 baseURL 字段 |
| `settings-page.js` | saveProviderConfig 读取 baseURL |
| `settings-page.js` | detectModels 从输入框读取 baseURL |
| `settings-page.js` | loadAISettings 包含未配置的自定义供应商 |
| `settings-page.js` | 添加自定义供应商按钮增加错误提示 |

---

## 调试建议

1. 打开设置页面的 DevTools Console，查看是否有 JS 错误
2. 在 Network 面板查看 API 请求是否发出、返回状态码
3. 在 Console 中手动测试：
   ```javascript
   // 检查元素是否存在
   document.getElementById('aiDetectModelsBtn')
   document.getElementById('aiSaveProviderBtn')
   document.getElementById('aiEditorBaseURL')
   
   // 检查事件监听器
   // Chrome DevTools > Elements > Event Listeners 面板
   ```
4. 检查 `aiSelectedProviderId` 变量是否有值
