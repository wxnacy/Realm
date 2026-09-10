---
status: fixed
trigger: "设置页面「分配规则」的导入功能失效——用户选择文件后没有任何反应，规则未导入。"
created: 2026-02-01T00:00:00Z
updated: 2026-02-01T00:00:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED - 设置页导入客户端把「整个解析后的文件内容」再包一层 {rules: ...} 发给 /api/rules/import，导致服务端拿到的 rules 是对象而非数组，importRules 直接拒绝；客户端又不检查 result.success，显示「已导入 undefined 条规则」的 2 秒 toast 后列表无变化 → 用户感知「没反应」
test: 代码全链路走读（export 产物格式 → 客户端封装 → 服务端解构 → importRules 校验 → 客户端响应处理）
expecting: N/A - 已通过代码阅读确认数据格式双重包裹
next_action: 返回 ROOT CAUSE FOUND（find_root_cause_only 模式，不修复）

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: 打开设置页面（CmdOrCtrl+,）→ 左侧边栏切换到「分配规则」→ 点击「导入」按钮 → 选择 JSON 规则文件 → 规则成功导入并显示在规则列表中
actual: 导入选择文件后没有成功导入，没反应
errors: None reported (用户未观察到任何报错或界面反馈)
reproduction: Test 2 in UAT（设置页面 → 分配规则 → 导入按钮 → 选择文件）
started: Discovered during UAT (Phase 11 设置页面重构)

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: 事件监听未绑定（importRulesBtn / rulesFileInput）
  evidence: settings-page.js:956-958 三个监听均绑定；用户能打开文件对话框说明 importRules 已触发 rulesFileInput.click()，即 setupEventListeners 已执行
  timestamp: 2026-02-01T00:00:00Z
- hypothesis: DOM 元素缺失（rulesFileInput / toast 为 null 导致静默异常）
  evidence: settings.html:134 存在 #rulesFileInput，settings.html:160 存在 #toast
  timestamp: 2026-02-01T00:00:00Z
- hypothesis: HTTP API 层整体不可用（页面 origin 错误 / token 鉴权失败 / CSP 拦截 fetch）
  evidence: UAT 同测试中规则的添加/删除/toggle/排序均正常（同一 rulesApi 通道）；main.js:215-216 注释确认 realm:// 由渲染进程转换为 http://localhost:PORT 后加载，fetch 同源；CSP default-src 'self' 覆盖 connect-src
  timestamp: 2026-02-01T00:00:00Z
- hypothesis: IPC 通道 rule:import 缺失或 assertTrustedSender 拒绝
  evidence: 设置页根本不走 IPC（webview guest 走 HTTP /api/*）；且 realmAPI.importRules/exportRules 无任何调用方（死代码），与本次故障无关
  timestamp: 2026-02-01T00:00:00Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-02-01T00:00:00Z
  checked: 导出产物格式（assignment-rules.js:231-236 exportRules + main.js:640-644 export 路由 + settings-page.js:587-597 导出下载）
  found: 导出文件内容为对象 {rules: [...], exportedAt: <ts>}，不是裸数组
  implication: 导入方必须能识别 {rules: [...]} 包装格式才能往返兼容
- timestamp: 2026-02-01T00:00:00Z
  checked: 设置页导入客户端 settings-page.js:558-582 handleFileSelect
  found: rulesData = JSON.parse(文件全文)（即 {rules:[...], exportedAt} 整个对象），随后 POST body = JSON.stringify({rules: rulesData}) → 双重包裹成 {rules: {rules: [...], exportedAt}}
  implication: 服务端解构出的 rules 是对象而非数组
- timestamp: 2026-02-01T00:00:00Z
  checked: 服务端导入路由 main.js:646-651 + readJsonBody main.js:251-264
  found: const { rules } = await readJsonBody(req) 后原样传给 assignmentRules.importRules(rules)，无格式解包/归一化；readJsonBody 仅裸 JSON.parse
  implication: importRules 收到非数组对象
- timestamp: 2026-02-01T00:00:00Z
  checked: assignment-rules.js:243-246 importRules 入口校验
  found: if (!Array.isArray(rulesData)) return { success: false, message: '规则数据格式不正确' }
  implication: 导入被拒绝，0 条规则入库，但 HTTP 状态仍是 200
- timestamp: 2026-02-01T00:00:00Z
  checked: 客户端响应处理 settings-page.js:572-574
  found: 不检查 result.success / result.message，直接 showToast(`已导入 ${result.count} 条规则`) → 显示「已导入 undefined 条规则」（2 秒即消失），随后 refreshRulesList() 列表无新规则
  implication: 用户看到的效果 = 没有导入成功 + 无明显/正确的反馈 → 报告「没反应」。唯一可成功的文件格式是裸数组 [...]，但应用自身导出不产生该格式 → 导出→导入往返必然失败
- timestamp: 2026-02-01T00:00:00Z
  checked: IPC 路径 rule:import（ipc-handlers.js:625-659）作为对照
  found: 该路径正确校验「文件必须含 rules 数组」，格式预期与导出产物一致；但 grep 确认 realmAPI.importRules/exportRules 无调用方（设置页改 HTTP 后成为死代码）
  implication: 两条路径格式预期不一致；HTTP 路径的客户端封装是唯一的 bug 点

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: 设置页导入存在「数据格式双重包裹 + 失败响应被静默吞掉」两个叠加缺陷。(1) 主因：settings-page.js handleFileSelect 把 JSON.parse 后的整个文件内容（导出产物本身就是 {rules:[...], exportedAt} 对象）再次包装为 {rules: rulesData} POST 到 /api/rules/import；服务端 main.js:647 解构出的是对象而非数组，assignment-rules.js:244 的 Array.isArray 校验失败，返回 {success:false, message:'规则数据格式不正确'}，0 条导入。(2) 次因：服务端以 HTTP 200 返回失败，客户端 settings-page.js:572-573 不检查 result.success，反而弹出「已导入 undefined 条规则」的 2 秒 toast 并刷新出无变化的列表，用户感知为「没反应」。唯一能被接受的文件是裸 JSON 数组，而应用自身导出不产生该格式，导出→导入往返必然失败。
fix: （建议方向，本模式不实施）客户端发送前解包：const rulesData = JSON.parse(text); const rules = Array.isArray(rulesData) ? rulesData : rulesData.rules; body: JSON.stringify({rules})；同时客户端应检查 result.success，失败时显示 result.message 而非成功 toast。（可选：服务端 import 路由做同样的归一化以防御。）
verification: 未验证（find_root_cause_only 模式）——验证方法：导出规则得到 realm-rules.json → 设置页导入该文件 → 应显示「已导入 N 条规则」且列表出现新规则
files_changed: []
