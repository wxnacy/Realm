# AI 文件/Bash 工具集成 + agent 根目录 + 权限白名单

> 日期：2026-09-05
> 状态：实施中

## 需求与已确认决策
把 pi-agent-core SDK 内置 4 工具（Read/Write/Edit/Bash）接入 Realm AI 助手：
- **agent 根目录** `userData/agent-workspace/` 作为 AI 操作 cwd，以后 AI 落盘都在里面；ai-memory 数据一次性迁入（旧目录保留不删，回滚保险）
- **硬沙箱**：read/write/edit 路径 resolve+realpath 后必须在根目录内，否则拒绝
- **Bash 三档权限**：白名单前缀免确认 → 默认弹确认卡片 → 危险命令（rm/sudo 等）强制确认（进白名单也无效）
- **设置页 AI 分区**新增白名单管理 UI
- 单根目录不按容器分；ai-conversations.db 本次不迁移；不引入新 npm 依赖

## 关键技术事实（已核实）
- SDK 四工具 name 固定为 `read`/`write`/`edit`/`bash`；与低层 AgentTool 唯一差异是 execute 第 5 参 `{ env }`，包装注入即可
- `NodeExecutionEnv` 从 `@earendil-works/pi-agent-core/node` 导入；`FileError`/`err` 从主入口导入
- bash 工具 exitCode≠0/超时/abort 会 throw；输出 2000 行/50KB 截断，全量落 `createTempDir`（SDK 默认 os.tmpdir()，需重定向到沙箱内 `.tmp/`）
- FileSystem 方法契约「永不 throw」返回 Result；确认链路取消时不 throw，返回 `{success:false, cancelled:true}` 正常结果
- ai-memory 的 `getBaseDir()` 是唯一路径来源，改一行迁移完成
- 设置页走 HTTP `/api/settings/update`（不走 IPC），白名单 UI 照抄多媒体域名白名单三函数模式

## 新建文件

### 1. `agent-workspace.js`（主进程根目录）
- `getWorkspaceDir()` = `path.join(app.getPath('userData'), 'agent-workspace')`，惰性 require electron；`setWorkspaceDir(dir)` 测试注入
- `getAiMemoryDir()` / `getTmpDir()`（root 下 `.tmp/`）/ `ensureWorkspaceDir()`（幂等 mkdirSync）
- `migrateAiMemory()`：旧 `userData/ai-memory` 存在 && 新不存在才 `fs.cpSync recursive`，失败仅告警；`setLegacyAiMemoryDir(dir)` 测试注入
- `createSandboxEnv({ cwd })`：组合持有 `NodeExecutionEnv`，**覆写全部 17 个 FileSystem 方法 + exec**（不漏包，任何漏包即逃逸口）
- 路径校验 `resolveInside(root, realRoot, p)`：
  1. `path.resolve` 消化 `..`；2. 根目录本身放行；3. 必须匹配 `root + path.sep` 前缀（防 `/agent-workspace-evil` 撞名）；4. 已存在路径 `realpathSync` 复核对 root/realRoot 双基准（防 symlink 二段式逃逸）
- 拒绝返回 `err(new FileError('permission_denied', ...))` 不 throw
- 拦截要点：`renameFile` 双路径分别校验；`joinPath` 纯词法透传；`createTempDir/createTempFile` **重定向**到 `workspace/.tmp/`（`fs.mkdtemp`）；`exec` 只校验 `options.cwd`（缺省=沙箱根），命令内容交给权限层
- 诚实边界：文件工具 100% 封闭；bash 命令本身可逃逸（`cat /etc/passwd`），由三档确认缓解，OS 级隔离列为后续可选

### 2. `ai-bash-policy.js`（纯函数，零依赖）
- `splitCommandPipeline(cmd)`：引号感知拆段（单引号全字面/双引号除 `\$ \` \" \\` 外字面/反斜杠转义），引号外在 `; && || | &` 处拆（`&&`/`||` 两字符贪心）
- `extractCommandName(seg)`：跳过 `KEY=VALUE` 前缀，首 token 取 basename
- `normalizeSegment`：trim + 连续空白折叠
- `matchesWhitelist(seg, list)`：`npm run *` 形式 = `startsWith(prefix)`（prefix 以空格结尾，不误中 `npm runx`）；否则精确匹配
- `DANGEROUS_PATTERNS`（词边界，**rm 全系**入表非仅 rm -rf，因 bash rm 不经沙箱且不可恢复；语义是强制确认非拒绝）：
  `rm` / `sudo` / `su <user>` / `dd|mkfs.*` / `kill|killall|pkill` / `shutdown|reboot|halt` / `hdiutil|diskutil|launchctl|csrutil|nvram|pmset` / `chmod|chown|chflags` / `defaults write` / 重定向覆盖 `> /非tmp`
- `DANGEROUS_INTERPRETERS`：管道右侧 `sh/bash/zsh/eval/source/osascript/python/node/ruby/perl`
- `evaluateBashCommand(command, whitelist)` → `{ level: 'allow'|'confirm', reason?, dangerNames? }`：任一段危险 → confirm(danger)（白名单失效）；全段命中白名单 → allow；否则 confirm(default)
- `validateWhitelistList(value)`：数组/字符串/≤200 字符/无 `\r\n\0`（服务端校验复用）

### 3. 测试 `tests/test-agent-workspace.js`、`tests/test-ai-bash-policy.js`
纯 Node 断言风格（无框架），注入临时目录：
- 沙箱：`../../etc/passwd`、绝对路径、撞名前缀拒绝；根目录/`sub/../sub2` 放行；symlink 逃逸拒绝；`writeFile` 越界返回 `{ok:false, code:'permission_denied'}`；temp 落 `.tmp/`；`exec('pwd')` 输出根目录
- 迁移：旧有新无 → cp；新已有 → 跳过；旧无 → no-op；失败不 throw
- 策略：引号内 `;` 不拆、`FOO=bar /usr/bin/rm` → rm、词边界（`killx` 不算）、`npm run *` 不中 `npm runx`、三档裁决（白名单内含 rm 段 → 白名单失效）、校验函数

## 修改文件

### 4. `ai-memory-manager.js`
`getBaseDir()` L105 改为 `path.join(userData, 'agent-workspace', 'ai-memory')`，其余零改动（/api/ai-memory、memory 工具、buildGlobalSnapshot 全走 manager）

### 5. `main.js`
- whenReady 早段（aiManager 创建前，initContainers 区域）挂 `ensureWorkspaceDir()` + `migrateAiMemory()`
- `handleSettingsApi` update 路由（L1228-1235）对 `aiBashWhitelist` 键调 `validateWhitelistList` 服务端校验，非法 400

### 6. `ai-manager.js`
- init 动态 import 块（L654-659）追加 `createReadTool/createWriteTool/createEditTool/createBashTool`；创建 `this.sandboxEnv = await createSandboxEnv()`
- `_adaptHarnessTool(harnessTool, overrides)`：展开 + 中文 label/description 覆盖 + `executionMode: 'sequential'`（4 个全串行，file-mutation-queue 不约束 bash 并发）+ execute 包装注入 `{ env: this.sandboxEnv }`
- `_buildRealmTools()` 尾部追加 4 工具；label/描述中文与现有 19 工具风格一致，description 写明沙箱边界与权限规则
- `_createBashToolWithPolicy()`：adapted 基础上再包 execute——每次实时 `this.configStore.get('settings.aiBashWhitelist', [])`（不缓存）→ `evaluateBashCommand` → confirm 档调 `requestActionConfirmation({ type:'execute_script', riskLevel: danger?'high':'medium', description: command })`，未确认返回 cancelled 正常结果；确认卡终态按现有 execute_script 模式推 `notifyActionSettled`
- `buildSystemPrompt()`（L508-515）三段拼接，新增 `buildWorkspacePrompt()`：工作目录绝对路径、read/write/edit 沙箱边界、bash cwd 与权限规则（被拒勿重试）、落盘一律写工作区、`.tmp` 勿动。白名单内容不进 prompt（实时变化）

### 7. 设置页 UI
- `src/settings.html`：AI 记忆组（L484-505）后加 `.settings-group.ai-perm-section`「AI Bash 命令白名单」：说明文字 + `#aiBashWhitelistInput` + 添加按钮 + `#aiBashWhitelistTags` + 空态 hint
- `src/settings-page.js`：照抄 `addWhitelistDomain/removeWhitelistDomain/renderWhitelistTags`（L1676-1770）三函数模式，整存整取 `settingsApi('update', { aiBashWhitelist: newList })` **即改即存**（与白名单类一致），DOM 构建 + textContent 防 XSS
- `main.css`：复用现有 `whitelist-tag/whitelist-input-area/whitelist-hint` 段（L8129-8205），仅新增 `.ai-perm-section` 间距类
- CSP 约束：初始隐藏走 CSS 类、JS 显隐用 CSSOM、输入用 textContent

### 8. 文档
- `AGENTS.md` 新增「AI 工作区与 Bash 权限」小节（目录结构、沙箱边界、三档权限、白名单键、确认链路）
- `docs/plan/ai-memory-system.md` L60 存储位置更新

## 实施顺序（每步独立验证）
1. **agent-workspace + 迁移**：agent-workspace.js、ai-memory-manager 改路径、main.js 启动挂载 → `node --check` + `node tests/test-agent-workspace.js` + dev 启动确认 `realm-dev/agent-workspace/` 生成、AI 记忆旧数据可读写
2. **策略引擎**：ai-bash-policy.js → `node tests/test-ai-bash-policy.js`
3. **工具接入**：SandboxExecutionEnv + 四工具适配 + bash 三档执行流 → `npm run debug` 实测：read 越界拒绝、write/edit 沙箱内成功、bash 免确认/普通卡/高危卡三档
4. **设置页**：UI + 服务端校验 → dev 设置页增删 tag、落盘与 400 校验
5. **收尾**：buildWorkspacePrompt、AGENTS.md、docs 更新 → 全量 `node tests/` 回归 + 对话验证 AI 自述工作区路径

## 风险备忘
- 确认卡请求体字段名（actionId/title/description/riskLevel）以 main.js requestActionConfirmation 与 renderer renderConfirmationCard 实际消费的字段为准，实现时对齐 ai-manager.js:3889 附近 execute_script 现有调用
- `settingsApi('update')` body 具体包裹格式照抄 addWhitelistDomain（settings-page.js:1705-1709）
- 白名单判定是启发式（静态拆段无法覆盖所有 shell 语法），诚实定位为「降低误执行概率」而非安全边界，安全边界 = 确认卡片 + 沙箱
