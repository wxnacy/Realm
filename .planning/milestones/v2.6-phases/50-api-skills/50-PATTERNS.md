# Phase 50: 设置页技能管理区 + `/api/skills/*` - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 15（3 改测试 + 11 改源码/文档 + 1 新建测试）
**Analogs found:** 15 / 15（全部为**同仓 git 追踪文件**，已用 `git ls-files` 逐个核验）

> **本阶段的特殊性**：所有目标文件都是**既有文件**（唯一新文件是测试套件），所以「analog」的形态是
> **同一文件内既有的同角色段落**，而不是「另一个文件」。下表与下文的 `file:line` 锚点即
> 「照抄这一段」的对象。**没有任何一个目标文件可以在别的文件里找到更好的模板** ——
> 唯一的例外是 `tests/test-skills-management.js`（照抄 `tests/test-manage-skill.js` 的文件骨架）。

---

## File Classification

| 新建 / 修改文件 | Role | Data Flow | Closest Analog | Match Quality |
|------------------|------|-----------|----------------|---------------|
| `ai-skills-manager.js` | service（技能集唯一数据权威，零 electron） | file-I/O + transform | 本文件 `refreshSkills()` `:538-730` / `deleteManagedSkill()` `:1603-1623` / `toUISkillEntry()` `:799-813` | exact（原地扩展） |
| `ai-manager.js` | service（编排层 / 失效链） | request-response + event-driven | 本文件 `syncAgentSystemPrompt()` `:3026-3054` / `_buildManageSkillTool()` 的 sync 恰一次 `:6252-6258` | exact |
| `main.js` | route + config（本地 HTTP 层） | request-response | 本文件 `handleSettingsApi()` `:1336-1406` / `handleAiMemoryApi()` `:2649-2702` / `sendJson` `:877-880` / `readJsonBody` `:887-900` | exact |
| `ipc-handlers.js` | route（IPC 转发层） | request-response | 本文件 `ai:get-skills` `:1747-1753` / `ai:refresh-skills` `:1763-1769` / `assertTrustedSender` `:113-122` | exact |
| `src/preload.js` | provider（contextBridge 桥） | request-response | 本文件 `getSkills` `:1033` / `refreshSkills` `:1040` | exact |
| `src/skill-picker-model.js` | utility（双模式导出的纯逻辑单源） | transform | 本文件 `TIER_BADGE` `:349-365` / `MANAGE_SKILL_ACTION_LABEL` `:379-383` / 双模式导出 `:476-477` | exact |
| `src/settings.html` | markup（静态结构） | static | `ai-perm-section`（AI Bash 白名单区）`:506-520` | exact |
| `src/settings-page.js` | component（`realm://` guest 渲染端） | CRUD + request-response | `settingsApi()` `:60-73` / `aiMemoryApi()` `:172-186` / 白名单即改即存链 `:2841-2901` / `renderAiBashWhitelistTags()` `:2907-…` / `setAiMemoryHint()` `:3878-3885` | exact |
| `src/styles/main.css` | config（样式） | — | `.ai-skill-content-box` 家族 `:5827-5891` / `.slash-picker-source-badge` 族 `:7236-7279` / `.ai-modal-overlay` `:5350-5358` | exact |
| `docs/product/ai-skills.md` | doc | — | 本文件 §十一 `:433-543`（含 §11.3 `:457-483` 与 §11.8 `:534-543` 账本） | role-match |
| `AGENTS.md` | doc（维护约定 + 测试清单） | — | 本文件 `:267`（测试清单行）`:`:272-273`（技能域维护约定） | role-match |
| **`tests/test-skills-management.js`**（**新建**） | test（`node:test` 独立套件） | — | `tests/test-manage-skill.js`（文件骨架 `:1-82`） | exact |
| `tests/test-manage-skill.js` | test | — | 本文件 `:1588-1621`（两条冻结断言） | exact |
| `tests/test-ai-skills.js` | test | — | 本文件 `:3219-3247`（`promptCtx`）/ `:3398`（`captureBroadcasts`） | exact |
| `tests/test-skill-picker-model.js` | test | — | 本文件 `:1026-1041`（`STATUS_TEXT` 冻结）/ `:1262-1279`（「仅显式」三条断言） | exact |

---

## 单源复用地基（**先读这一节 —— 本阶段最大的返工源**）

> CONTEXT 与 RESEARCH 反复点名的风险不是「写错代码」，而是**在第二个位置重写一份已有实现**。
> 下表是本阶段的**硬禁令清单**：左侧每一项都**已存在且是唯一权威**，本阶段只能**引用**。
> 表外任何「顺手重写一份更清晰」的冲动都必须在 plan 期被显式否掉。

| 单源符号 | 权威位置（`file:line`） | 本阶段如何用 | 不得做什么 |
|----------|------------------------|--------------|-----------|
| `LIMITS` | `ai-skills-manager.js:48-54` | 管理投影回传 `limits` 字段供前端渲染 | **不得重定义、不得改既有 5 项数值**（只允许加项）；**设置页不得写死任何限额数值**（`64 KiB`/`50`/`8000`/`1 MiB` 一律取投影回传值） |
| `computeDigest()` | `ai-skills-manager.js:189-202` | **不碰**（尺寸统计**不得**进 digest） | **禁止**把 `disabled` / `shadowed` / `overLimit` **从 digest 摘掉**（任何「digest 只该反映 prompt 内容」的优化）；也**不得**把 `bytes` / `fileCount` 加进去 |
| `sourceTierOf()` | `ai-skills-manager.js:776-780` | 管理投影直接调用求三档 tier | **不得**重写档位判定（48 D-14 已锁） |
| `toUISkillEntry()` | `ai-skills-manager.js:799-813` | 管理投影条目 = 它**加上** `bytes`/`fileCount`/`diagnostics` | **不得**重写既有 8 个字段的取值逻辑 |
| `getSkillsForUI()` | `ai-skills-manager.js:853-859` | **不扩展**（管理投影并列新增） | **不得**把 `bytes`/`diagnostics` 并进它（`/` 面板 IPC 会白传 100 条诊断与遍历结果） |
| `validateManagedSkillName()` | `ai-skills-manager.js:1034-1063` | **仅作对照**，理解「写入门严」的形态 | **不得**用作管理面谓词（严格 `^[a-z0-9-]+$` 会让 `skills/My_Skill/` 的开关点了必然 400）；**也不得**改写它 |
| `resolveManagedTarget()` | `ai-skills-manager.js:1367-1399` | **不碰** | **不得**复用其判据（managed 视角「seeded 保护 + 用户撞名」，方向与本阶段相反） |
| `deleteManagedSkill()` | `ai-skills-manager.js:1603-1623` | **只作形状模板**（校验 → 读盘判定 → `env.remove({recursive:true})` → 失败折叠 `UNKNOWN` 四段） | **不得**复用其判据（managed-only） |
| `makeManageSkillError()` | `ai-skills-manager.js:991-996` | 新码经此构造 | **不得**在模块外另造带 `code` 的错误对象；**不得**为外部构造而导出它（推荐不导出，判定全在模块内） |
| `MANAGE_SKILL_ERROR` | `ai-skills-manager.js:966-977` | D-08 加第 11 键 `NOT_USER_OWNED` | **不得**改动既有 10 键的键名与取值 |
| `MANAGE_SKILL_SHORT_REASON` | `src/skill-picker-model.js:408-418` | **不碰**（**保持恰 9 键**） | **不得**把 `not_user_owned` 加进它（被 `tests/test-skill-picker-model.js:946` 硬断言；该表只覆盖**工具面**） |
| `STATUS_TEXT` | `src/skill-picker-model.js:239-244` | D-12 加第 5 条 `disabled: '已禁用'` | **不得**改动既有 4 键的值；**不得**在设置页另写一份状态文案 |
| `STATUS_TEXT.nameClash` | `src/skill-picker-model.js:241` | **设置页不使用**（命令表 `SLASH_COMMANDS` 在 `src/renderer.js:344-347`，guest 拿不到） | **不得**删除或改值（面板仍在用且有冻结断言）；**不得**把命令表搬进设置页 |
| `TIER_BADGE` | `src/skill-picker-model.js:349-365` | 设置页**只查表**取 `label`/`className`/`title` | **不得**扩表、不得复制文案、不得拼 `className` |
| 「仅显式」label + title | 今天是 `src/renderer.js:10599` 的**内联字面量** | 本阶段**提升为单源**（住 `src/skill-picker-model.js`，与 `TIER_BADGE` 同族），面板侧改引用 | **不得**在设置页写第二份字面量；提升后**面板渲染结果逐字不变** |
| `syncAgentSystemPrompt()` | `ai-manager.js:3026-3054` | 管理写路径**调用**它（恰一次） | **不得**改其函数体（46-04 方法体源码断言 + 48 广播次数断言同时钉着）；**不得**把补播挪进去 |
| `_flushDeferredSkillsPrompt()` | `ai-manager.js:3100-3114` | **不碰**（延迟补刷的唯一实现） | **不得**在别处再实现 `_skillsPromptDirty` 的检脏/复位 |
| `readJsonBody()` | `main.js:887-900` | 本阶段改造对象（加 `res` + `maxBytes`） | **不得**为「大 body 端点」另写第二个请求体读取函数（Phase 51 的 zip 端点未来也走它 + `{maxBytes}`） |
| `sendJson()` | `main.js:877-880` | 本阶段加幂等护栏 | **不得**新增第二个响应发送点 |
| `assertTrustedSender()` | `ipc-handlers.js:113-122` | 三个新 IPC 通道首行复用 | **不得**另写来源校验（`main.js:3371-3377` 有一份同款，但那不是可 require 的导出） |
| `escapeHtml()` | `src/settings-page.js:1657` | **不用于本页新插值** | `TD-48-01`：它**只转义 `& < >`、不转义引号**且**仍开**。本页新增插值**一律走 DOM API**（`textContent` / `el.title = …` / `setAttribute`），**禁止** `innerHTML` / 字符串模板拼 HTML |
| `.ai-skill-content-box` 家族 | `src/styles/main.css:5827-5891` | 诊断详情区 + 汇总条的**唯一**折叠视觉 | **不得**新建第二份折叠实现；**且** JS 侧**没有**可复用模块（见下方 Pitfall） |
| `.ai-modal-overlay` / `.ai-modal` | `src/styles/main.css:5350-5358` / `:5376-5403` | 卸载确认弹框外壳 | **不得**新建遮罩实现；**绝不**把 overlay 类用到 `<dialog>` 上 |
| `--skill-limit-text` / `--skill-error-text` | `src/styles/main.css:29`/`:33`（暗）`:61`/`:63`（亮） | 状态标注与诊断级别上色 | **不得**新增同义令牌；本阶段**唯一新增令牌**是 `--skill-success-text` |
| `windowManager.broadcast` | `window-manager.js:310` | 写路径调用侧补播 | **不得**期望它到达 webview guest（只发各 `BrowserWindow.webContents`）；**不得**为设置页新开 guest push 通道 |

---

## Pattern Assignments

### `ai-skills-manager.js`（service / file-I/O + transform）

**Analog:** 本文件 `refreshSkills()` `:538-730`（管线插入点）、`deleteManagedSkill()` `:1603-1623`（删盘形状）、`toUISkillEntry()` `:799-813`（投影骨架）、`validateManagedSkillName()` `:1034-1063`（谓词同形）。

**模块头依赖纪律（照抄 `:1-30` 的文件头注释口径）**：本模块**零 electron 依赖**，只依赖 Node 内建 + SDK。任何新代码**不得** `require('electron')`、**不得** require `ai-manager.js`（依赖方向是 `ai-manager` → `ai-skills-manager`，反向即循环）。

**1）尺寸遍历的接入点**（`:644-658`，插在 ④ 之后、⑤ 之前）：

```js
    // ③ 同名遮蔽：managed 先、user 后 → 后到者（user 版）胜出，败者标
    //    shadowed / shadowedBy 但**保留在集合内**（D-06 costly 可逆性）。
    // ④ 确定性定序：bySkillPriority 是全序，排序结果与输入顺序无关（跨机一致）。
    //    定序必须在遮蔽之后 —— 胜负由输入顺序决定，与可观测顺序无关。
    _cache.skills = applyShadowing(entries).sort(bySkillPriority);

    // ④.5 【本阶段新增】逐技能递归尺寸统计（D-13）—— 必须落在重扫管线内，
    //      随 refreshedAt / digest 一起失效；**不进 computeDigest**。
    //      逐技能隔离失败：任何一项读不到只影响它自己 + 一条诊断，
    //      不得让整批走 :717-728 的 catch 回滚。

    // ⑤ 启用/禁用（D-09）：禁用是**消费侧过滤的下游信号** —— 数据层保留完整条目，
```

**2）诊断落点的分工（照抄既有两件套，`:334-337` / `:373-375`）**：

```js
function pushEntryDiag(entry, diag) {
  if (entry && Array.isArray(entry.diagnostics)) entry.diagnostics.push(diag);
  _cache.diagnostics.push(diag);
}
```
```js
function pushError(errDiag) {
  _cache.errors.push(errDiag);
}
```
尺寸遍历的失败诊断**按归属分流**：条目级（某技能目录读不到 / 超 depth / 超 entries）用 `pushEntryDiag`；模块级（技能根缺失一类）已有既有代码，不重复。

**3）删盘 + 错误折叠形状（模板 = `:1603-1623`，逐字对照）**：

```js
async function deleteManagedSkill(env, { name, seededNames } = {}) {
  // 1. name 仍须合法（否则拼出的路径没有意义）
  const skillName = typeof name === 'string' ? name.trim() : name;
  const nameCheck = validateManagedSkillName(skillName);
  if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);

  // 2. 统一的目标判定（seeded 保护的三入口同形的第三入口）
  const target = await resolveManagedTarget(env, skillName, seededNames);
  if (!target.ok) throw makeManageSkillError(target.code, target.message);

  // 3. 递归删除（recursive 默认 false，必须显式传）
  const res = await env.remove(target.destDir, { recursive: true });
  if (!res || res.ok !== true) {
    throw makeManageSkillError(
      MANAGE_SKILL_ERROR.UNKNOWN,
      `删除技能 "${skillName}" 失败（沙箱码 ${sandboxErrorCode(res)}）`
    );
  }

  return { name: skillName, filePath: target.destFile, action: 'delete' };
}
```
新 `deleteUserSkill` 照抄这**四段结构**，但第 2 段换成 D-07 的「仅 user 可删」读盘判据（**不复用 `resolveManagedTarget`**）。

**4）路径派生必须走 `path.join` + `getSkillsDir()`（对照 `:1317-1321` 的 managed 侧先例）**：

```js
function managedSkillPaths(name) {
  const managedDir = getAgentWorkspaceLazy().getManagedSkillsDir();
  const destDir = path.join(managedDir, name);
  return { managedDir, destDir, destFile: path.join(destDir, 'SKILL.md') };
}
```
user 侧本阶段**尚无对应函数** ⇒ 新 `deleteUserSkill` 内照同款派生 `path.join(getAgentWorkspaceLazy().getSkillsDir(), name)`。**不得手拼字符串**、**不得直接 `fs`**（沙箱 `resolveInside` 双基准 + realpath 复核是唯一路径校验）。

**5）判据必须 `fileInfo` 而非 `exists`**（`agent-workspace.js:286-290` 与 `:309-313` 的原语签名对照）：

```js
    async fileInfo(p) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.fileInfo(p);
    },
```
```js
    async exists(p) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.exists(p);
    },
```
SDK 的 `exists` 是「`fileInfo` 成功即 `ok(true)`」（`node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js:584-591`）⇒ **普通文件也算存在**，判不出 `kind === 'directory'`。D-07 的判据字面是「存在**且 `kind` 是目录」⇒ **必须 `env.fileInfo`**。

**6）管理面名称谓词的同形（对照 `:1034-1063` 的返回形状，但取值域更宽）**：

```js
  if (typeof name !== 'string') {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名必须是字符串' };
  }
  const value = name.trim();
  if (!value) {
    return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能为空' };
  }
```
新谓词返回 `{ok:true} | {ok:false, code: INVALID_NAME, reason}`（**同形**以便同样经 `makeManageSkillError` 构造），但判据 = 非空 + ≤64 + 无 `/` `\` 与控制字符（**不加** `^[a-z0-9-]+$` / 不加首尾与连续连字符判据）。`MAX_SKILL_NAME_CHARS = 64`（`:62`）可复用为长度上限的单源。

**7）错误构造唯一处（`:991-996`）**：

```js
function makeManageSkillError(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}
```

**8）导出面追加（对照 `:1663-1686` 的分段注释风格）**：

```js
module.exports = {
  LIMITS,
  refreshSkills,
  ...
  // 49 新增（技能集 AI 写入路径：校验器 / 净化 / 扫描单点 / 组装 / 三动作）
  validateManagedSkillName,
  ...
  MANAGE_SKILL_ERROR,
```
新导出（管理投影 / `deleteUserSkill` / 管理面名称谓词）**另起一段注释**，与 48-01 / 49 的两段并列。**不导出** `makeManageSkillError`、`measureSkillDir` 一类内部件（测试经公开函数的行为面覆盖）。

---

### `ai-manager.js`（service / 编排层 + 失效链）

**Analog:** 本文件 `syncAgentSystemPrompt()` `:3026-3054`、`refreshSkillsForPanel()` `:3072-3075`、`_buildManageSkillTool()` 的 sync 恰一次先例 `:6252-6258`、`getSeededSkillNamesSafe()` `:1565-1573`、`getSkillsForUI()` `:1583-1585`。

**1）失效链函数体（`:3026-3054`，**逐字不改** —— 只读它，不碰它）**：

```js
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
读这段的**唯一目的**是确认两件事：① 它体内**已含**恰一次 `refreshSkills` ⇒ 写路径只调它、**不要再调 `refreshSkills`**；② `isProcessing || streaming` 分支**只置脏、不广播** ⇒ 管理写路径必须在**调用侧**补播。

**2）sync 恰一次 + 调用侧补播的形状（先例 `:6252-6258` 的注释口径）**：

```js
          // 三动作共用同一句刷新链：该方法的函数体内已含 refreshSkills 重扫，
          // 忙碌时只置脏标记，回写与广播由本轮成功出口的补刷落地（D-13）。
          await this.syncAgentSystemPrompt();
```
本阶段的管理写方法在同款位置之后**追加一行**：

```js
  windowManager.broadcast('skills:changed');   // 调用侧补播（覆盖忙时只置脏不广播的分支）
```
`windowManager` 在本文件**顶层已 require**（`ai-manager.js:25`），无需新增依赖。

**3）读路径初始化的形状（`refreshSkillsForPanel()` `:3072-3075` 是**不能复用的**对照 —— 它经 `syncAgentSystemPrompt()`，而后者首行 `if (!this.agent || !this.sandboxEnv) return;` 在无 Agent 时早退）**：

```js
  async refreshSkillsForPanel() {
    await this.syncAgentSystemPrompt();
    return this.getSkillsForUI();
  }
```
新 `ensureSkillsFresh()` 的判据必须是「**缓存是否已加载过**」，**不得**按「有没有 provider」判 —— `ai-manager.js` 有**两条**早退（`:789-793` 无 API Key、`:893-896` 未找到模型），两条都在 `:899` 建 `sandboxEnv` 与 `:903` 首次 `refreshSkills` **之前**。形状见 `50-RESEARCH.md` §Pattern 5（懒建 `sandboxEnv` → 有 Agent 走 `syncAgentSystemPrompt()`、无 Agent 直接 `refreshSkills`；**不得两条都执行**）。

**4）seeded 注入与投影转发的单向性（`:1565-1585`）**：

```js
  getSeededSkillNamesSafe() {
    try {
      const names = getBuiltinSkillsSeederLazy().getSeededSkillNames();
      return Array.isArray(names) ? names : [];
    } catch (err) {
      console.warn('[Realm AI] 读取随包内置技能名失败（seeded 判定降级为空集合）:', err.message);
      return [];
    }
  }
```
```js
  getSkillsForUI() {
    return getAiSkillsManagerLazy().getSkillsForUI(this.getSeededSkillNamesSafe());
  }
```
新增管理方法**照此形状**：`this.getSkillManager().getSkillsForManagement(this.getSeededSkillNamesSafe())` —— seeded 集合**由调用方注入**，`ai-skills-manager` 不自行解析随包目录。

**5）`configStore` 注入式读取的三处既有先例（`:904` / `:3031` / `:3147`，三处逐字同形）**：

```js
        disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [],
```
新写路径读-改-写名单时沿用 `this.configStore ? … : []` 的空值保护。

---

### `main.js`（route + config / request-response）

**Analog:** `sendJson` `:877-880`、`readJsonBody` `:887-900`、`handleSettingsApi` `:1336-1406`、`handleAiMemoryApi` `:2649-2702`、`realmServer` 分发 `:2704-2835`、两个书签导入端点 `:1156-1177`。

**1）`sendJson` 现状（`:877-880`）与改造后（`headersSent || writableEnded` 幂等护栏）**：

```js
  function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }
```
改造后**唯一**新增首行：`if (res.headersSent || res.writableEnded) return;`。**不得**新增第二个发送点 —— 13 个宿主（12 个具名 handler + `/api/bookmarks-bar/toggle` 内联分支 `:2818-2835`）的 `catch → sendJson` 全部依赖这一处护栏。

**2）`readJsonBody` 现状（`:887-900`）与**已裁决**的目标形状**：

```js
  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }
```
**目标形状 = `50-RESEARCH.md` §「矛盾 1」的 `✅ 已裁决 —— 方案 A` 契约块（BINDING，不得自由发挥）**：
`readJsonBody(req, res, { maxBytes = MAX_JSON_BODY_BYTES } = {})`（**`res` 为第二位置参**）+ **强制的 `res` 缺失降级分支**（`if (!res || typeof res.writeHead !== 'function')` ⇒ **不答、只 reject** 带 `code:'BODY_TOO_LARGE'`）+ 全部 **57 个调用点**改为 `readJsonBody(req, res, …)` + 413 形态固定 `sendJson(res, 413, …)` + `req.resume()`（**禁用** `req.destroy()` / `Connection: close`）。完整代码骨架见 `50-RESEARCH.md` §Code Examples（`:1221-1277`）。

数值单源（同处 `main.js`）：
```js
const MAX_JSON_BODY_BYTES = 1024 * 1024;                 // 1 MiB 全局默认（D-16）
const MAX_JSON_BODY_BYTES_LARGE = 32 * 1024 * 1024;      // 需大 body 的端点（书签导入）显式覆盖
```
**不得**在设置页或任何前端写第二份。

**3）两个书签导入端点的显式覆盖（`:1156-1157` / `:1176-1177`）—— 漏改即静默破坏既有功能**：

```js
      // Chrome JSON 导入：body { filePath } 或 { content }
      if (route === 'import-chrome' && req.method === 'POST') {
        const { filePath, content } = await readJsonBody(req);
```
```js
      // HTML 书签导入：body { filePath | content, mode: 'preview' | 'import' }
      if (route === 'import-html' && req.method === 'POST') {
        const { filePath, content, mode } = await readJsonBody(req);
```
这两处改签名时**必须显式传** `{ maxBytes: MAX_JSON_BODY_BYTES_LARGE }`（`src/favorites-page.js:2245` 提交的是用户书签文件**全文**，Chrome / Safari 常规 1–10 MB）。

**4）HTTP handler 形状（`:1336-1344`，`handleSkillsApi` 逐字照抄前四行）**：

```js
  async function handleSettingsApi(req, res, reqUrl) {
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/settings/', '');
```
`handleAiMemoryApi()` `:2649-2654` 是**同款首四行**的第二个实例。`handleSkillsApi` 取 `route = reqUrl.pathname.replace('/api/skills/', '')`，三个子路由 `list`（GET）/ `set-disabled`（POST）/ `uninstall`（POST）。

**5）错误形状与 `catch`（`:2698-2701`，三个子路由共用）**：

```js
    } catch (err) {
      console.error('[Realm] AI 记忆 API 处理失败:', err.message);
      sendJson(res, 400, { error: err.message });
    }
```
技能的 `code`（`not_user_owned` 等）**必须一并回传**：`sendJson(res, 400, { error: err.message, code: err.code || undefined })` —— UI-SPEC 的失败文案映射表**按 `code` 查表、不解析 `message`**（HTTP 状态统一 **400**，与既有 `/api/*` 范例一致）。

**6）路由分发插入点（`:2756-2766`，**插在 `/api/ai-memory` 之后、`/api/devrequests/` 之前**）**：

```js
    // AI 记忆 JSON API（设置页面「AI 记忆」分区数据层）
    if (reqPath === '/api/ai-memory') {
      handleAiMemoryApi(req, res, reqUrl);
      return;
    }

    // 开发者模式请求数据 API（devrequests 页面数据层）
    if (reqPath.startsWith('/api/devrequests/')) {
```
新分支形状：`if (reqPath.startsWith('/api/skills/')) { handleSkillsApi(req, res, reqUrl); return; }`（`startsWith` 形态，与 `/api/settings/` 一类相同而非 `===`，因为要承载三个子路由）。

**7）`/api/settings/update` 的校验循环（`:1372-1392`，D-10 在此加分支）**：

```js
      if (route === 'update' && req.method === 'POST') {
        const updates = await readJsonBody(req);
        // 安全策略键服务端双保险校验（Pitfall 8：不能只依赖设置页前端校验）
        for (const [key, value] of Object.entries(updates)) {
          if (key === 'aiBashWhitelist') {
            const check = bashPolicy.validateWhitelistList(value);
            if (!check.valid) {
              sendJson(res, 400, { error: check.reason });
              return;
            }
          }
          // 缓存上限服务端校验（T-44-09：1-1024 整数，非法拒绝）
          if (key === 'cacheMaxGB') {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1 || n > 1024) {
              sendJson(res, 400, { error: '缓存上限必须为 1-1024 的整数' });
              return;
            }
          }
          configStore.set(`settings.${key}`, value);
        }
```
新增两条分支**并列**在同处，判据取 `ai-skills-manager` 新导出的「安全超集谓词」（**单源**，`main.js` 直接 require —— 该模块零 electron 依赖）。**两种键形态都要覆盖**：`key === 'aiSkills.disabled'` 校验 `value` 本体；`key === 'aiSkills'` 校验 `value && value.disabled`（否则手改 URL 提交 `{ "aiSkills": { "disabled": [ … ] } }` 会把整个 `settings.aiSkills` 对象覆写掉）。

---

### `ipc-handlers.js`（route / request-response）

**Analog:** `assertTrustedSender` `:113-122`、`ai:get-skills` `:1747-1753`、`ai:refresh-skills` `:1763-1769`。

**来源校验（`:113-122`，三个新通道首行复用）**：

```js
function assertTrustedSender(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    throw new Error('不受信任的 IPC 来源');
  }
  if (!windowManager.isManagedWindow(win.id)) {
    throw new Error('不受信任的 IPC 来源');
  }
  return win;
}
```

**通道形状（`:1747-1753`，三个管理通道逐字照抄）**：

```js
  ipcMain.handle('ai:get-skills', async (event) => {
    assertTrustedSender(event);
    if (!aiManager) {
      throw new Error('AI Manager 未初始化');
    }
    return aiManager.getSkillsForUI();
  });
```
**「只做转发、零判定」是硬约束**：判据 / 校验 / 写函数全在 `ai-skills-manager.js` —— 与 `:1743` 的注释口径「**不得**走 `/api/skills/*`（主窗口 `file://` 不能 fetch 本地 HTTP —— Phase 38 事故）」同读：主窗口 **必须** IPC、设置页 **必须** HTTP，两条不可互换。

---

### `src/preload.js`（provider / contextBridge）

**Analog:** `getSkills` `:1033` / `refreshSkills` `:1040`（`realmAPI.ai` 命名空间）。

**形状（`:1028-1040`）**：

```js
    /**
     * 获取 `/` 面板的技能集投影（48 D-17：同步快照，零正文）
     * 主窗口 `file://` 不能 fetch 本地 HTTP API，技能数据只能走本 IPC（Phase 38 事故）
     * @returns {Promise<{skills: Array<object>, refreshedAt: number, digest: string}>}
     */
    getSkills: () => ipcRenderer.invoke('ai:get-skills'),

    /**
     * 后台刷新技能集（重扫 → 必要回写 → 广播），返回刷新后的投影
     * 与 getSkills 是两次独立调用：先立即渲染快照，再后台刷新（stale-while-revalidate）
     * @returns {Promise<{skills: Array<object>, refreshedAt: number, digest: string}>}
     */
    refreshSkills: () => ipcRenderer.invoke('ai:refresh-skills'),
```
三个新方法（读管理投影 / `set-disabled` / `uninstall`）**紧挨其后并列**，同款 `@returns` JSDoc + `() => ipcRenderer.invoke('…')` 单行箭头。**写侧当前无 UI 消费者**（D-17 明文）—— 不得为了让 IPC 有消费者而在主窗口新造管理 UI。

---

### `src/skill-picker-model.js`（utility / 双模式导出纯逻辑）

**Analog:** 本文件 `STATUS_TEXT` `:239-244`、`TIER_BADGE` `:349-365`、`MANAGE_SKILL_ACTION_LABEL` `:379-383`、双模式导出 `:476-477`。

**1）IIFE + 单源冻结表的既有形状（`:238-244`）**：

```js
  /** 行尾状态标注四条定长文案（UI-SPEC §Copywriting，唯一权威） */
  const STATUS_TEXT = Object.freeze({
    shadowed: '已遮蔽 · 由用户同名技能胜出',
    nameClash: '与本地命令同名 · 本地命令优先',
    promptOmitted: '未进提示词 · 超预算',
    overLimit: '超数量上限',
  });
```
D-12 在此**加第 5 条** `disabled: '已禁用'`。⚠️ RESEARCH「矛盾 3」已核实：该表今天有 **4 键**（含 CONTEXT D-12 未枚举的 `nameClash`），加后为 5 键；**既有 4 键的值一个字都不许动**（`tests/test-skill-picker-model.js:1026-1041` 逐字冻结，但**无键数断言** ⇒ 新增第 5 键不会打翻它）。

**2）「仅显式」单源提升的同族形状（`{label, title}` 表，对照 `TIER_BADGE` `:349-365`）**：

```js
  const TIER_BADGE = Object.freeze({
    user: Object.freeze({
      label: '用户',
      className: 'slash-picker-source-badge-user',
      title: '用户技能（agent-workspace/skills/），同名时优先于内置与托管',
    }),
    ...
  });
```
新表与它**同址、同导出面、同 `Object.freeze`** 双层冻结形态。要提升的两条字面量今天是 `src/renderer.js:10599`：

```js
      ? '<span class="slash-picker-tag-explicit" title="该技能不进模型提示词，只能手动调用（/skill:名字）">仅显式</span>'
```
提升后面板侧改引用同一常量，**渲染结果逐字不变**。**必须同批改写三条既有断言**（见下方测试节）。

**3）导出面（`:456-477`）**：

```js
  const api = {
    SKILL_PREFIX,
    ...
    TIER_BADGE,
    STATUS_TEXT,
    PROMPT_OMITTED_CARD_NOTE,
```
```js
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
})();
```
新表加进 `api` 对象即可 —— **双模式导出是「设置页能 require 到同一份」的全部机制**，不需要第二份实现。

---

### `src/settings.html`（markup / static）

**Analog:** `ai-perm-section`（AI Bash 白名单区）`:506-520`（`.settings-group` 范式 + 区说明 `<p class="setting-description">` 先例）。

**区外壳范式（`:506-520`）**：

```html
        <!-- AI Bash 命令白名单（tag 式即改即存；CSP：初始隐藏走 CSS 类，禁止 markup 内联 display） -->
        <div class="settings-group ai-perm-section">
          <div class="settings-group-header">
            <h2 class="settings-group-title">AI Bash 命令白名单</h2>
          </div>
          <div class="settings-group-content">
            <p class="setting-description">命中白名单的 Bash 命令免确认自动执行；……</p>
```
⚠️ **UI-SPEC 的区骨架与本范例的层级不同**（UI-SPEC `:586-597` 是 `h2.settings-group-title` + `p.setting-description` **直接挂在 `div.settings-group.skill-manage-section` 下**）—— 以 **UI-SPEC 为准**：本区不带 `settings-group-header` / `settings-group-content` 两层包装。

**插入位置（`:521-532`）**：

```html
        <!-- 视觉专用模型（主模型无 vision 时的图片转写；下拉即改即存） -->
        <div class="settings-group ai-vision-section">
          ...
        </div>
      </section>
```
新区插在 `ai-vision-section` 的 `</div>` 之后、`</section>`（`:532`）之前，即 AI 分区的**最后一个子区**。

**脚本引用（`:783-785`，新 `<script>` 插在 `settings-page.js` **之前**）**：

```html
  <script src="ai-brand-map.js"></script>
  <script src="model-family.js"></script>
  <script src="settings-page.js"></script>
```
新行 `<script src="skill-picker-model.js"></script>` 插在 `model-family.js` 与 `settings-page.js` 之间 —— **顺序是硬约束**（设置页在 `init()` 期就要读 `window.SkillPickerModel`）。该文件零依赖 / 双模式导出 / 纯函数 ⇒ `realm://` CSP `script-src 'self'` 下自源加载，风险低但**须实测一次**（research A3 / `50-VALIDATION.md` 的 Manual-Only 表）。

**CSP 硬约束（AGENTS.md「内部页面 CSP」）**：`realm://settings` 的 CSP 是 `style-src 'self'`（无 `unsafe-inline`）⇒ **markup 内联 `style="display:none"` 会被拦**。元素的初始隐藏**必须走 CSS 类**（如既有 `.ai-modal-overlay { display: none }`，`main.css:5350-5358`）；显隐切换用 JS CSSOM 的**具体值**（`el.style.display = 'flex' / 'none'`），**不要**依赖 `''` 回落到 markup 状态。

---

### `src/settings-page.js`（component / `realm://` guest 渲染端）

**Analog:** `settingsApi()` `:60-73`、`aiMemoryApi()` `:172-186`、白名单即改即存链 `:2841-2901`、`renderAiBashWhitelistTags()` `:2907-2920`、`setAiMemoryHint()` `:3878-3885`、`init()` `:4787-4809`。

**1）HTTP 客户端形状（`:172-186`，`skillsApi()` 逐字照抄）**：

```js
async function aiMemoryApi(route = '', options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const suffix = route ? `/${route}` : '';
  const res = await fetch(`/api/ai-memory${suffix}?${params.toString()}`, options);
  if (!res.ok) {
    // 优先使用后端返回的错误详情（如「容器不存在」「记忆已达字符上限…」）
    let detail = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
    } catch { /* 非 JSON 响应忽略 */ }
    throw new Error(detail || `AI 记忆 API 请求失败: ${res.status}`);
  }
  return res.json();
}
```
`apiToken` 来自 URL 查询参数（`:49`：`const apiToken = pageParams.get('token') || '';`）。⚠️ 失败路径需要**同时**拿到 `code`（UI-SPEC 的失败映射表按 `code` 查表）—— 在 `detail` 之外一并保留 `data.code`，但**仍沿用**「优先用后端 `error` 文案、前端不另造」的既有纪律。空态 C 的正文即取此处 `detail` 原文。

**2）即改即存链路形状（`:2841-2901`，「读 state → 整存 → POST → 更新 state → 重渲染」）**：

```js
  try {
    const newList = [...state.aiBashWhitelist, raw];
    await settingsApi('update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiBashWhitelist: newList }),
    });
    state.aiBashWhitelist = newList;
    renderAiBashWhitelistTags();
    input.value = '';
    showToast(`已添加白名单命令: ${raw}`);
  } catch (error) {
    console.error('[Realm] 添加 AI Bash 白名单失败:', error);
    showToast(error.message || '添加失败，请重试');
  }
```
启停开关照抄**这条链路的形状**（即改即存、无保存按钮），但**反馈面换成 inline hint**（D-06：本区**不调用** `showToast` —— 设置页既有的 `#toast` 是全页通用通道，D-06 已把本区锁定为 inline hint）。

**3）DOM 构建范式（`:2907-2912`，**零 HTML 字符串模板**）**：

```js
function renderAiBashWhitelistTags() {
  const tagsEl = document.getElementById('aiBashWhitelistTags');
  const hintEl = document.getElementById('aiBashWhitelistHint');
  if (!tagsEl || !hintEl) return;
```
注释逐字写着「使用 DOM 构建 + textContent 防止 XSS（WR-13）；空态 hint 显隐走 CSSOM（CSP）」。本页整棵技能列表照此范式：`createElement` + `textContent` + `el.title = …` / `setAttribute`。**禁止**任何 `innerHTML` / `insertAdjacentHTML` / 字符串模板拼 HTML（含「拼完再整体赋给 `innerHTML`」）—— 源码扫描测试会机械断言设置页零命中。

**4）inline hint 形状（`:3878-3885`，本阶段**另立** `setSkillManageHint` / `resetSkillManageHint`）**：

```js
function setAiMemoryHint(text, tone = '') {
  const hint = document.getElementById('aiMemoryHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.remove('ai-memory-hint-success', 'ai-memory-hint-danger');
  if (tone === 'success') hint.classList.add('ai-memory-hint-success');
  if (tone === 'danger') hint.classList.add('ai-memory-hint-danger');
}
```
**两处必须新增的加固**（UI-SPEC 硬要求，既有先例未覆盖）：
- **`clearTimeout` 纪律**：2 秒复位定时器保存在模块级变量，**每次设置 hint 前先 `clearTimeout` 上一次** —— 连续操作（快速连点两个开关）时陈旧复位不得清掉新消息。既有 set/clear 配对写法可照 `:3815-3816`（`clearTimeout(debounceTimer); debounceTimer = setTimeout(...)`）。
- **文本与色调必须一并设置**（不允许「只改文字不改色」的路径 —— 否则会出现绿色文案说失败）。
- 空文本时用 **CSSOM** 置 `hintEl.style.display = 'none'`（有文本置 `'block'`），**不走 markup 内联 style**、**不用 `''` 回落**。

**5）初始化接线（`:4787-4809`）**：

```js
async function init() {
  console.log('[Realm] 设置页面初始化');

  // 加载设置
  await loadSettings();
  ...
  // 初始化 AI 记忆分区事件监听（默认激活「全局记忆」tab）
  setupAiMemoryListeners();
```
新区监听在 `init()` 内**并列加一行**（形状同 `setupAiMemoryListeners()`），`document.addEventListener('DOMContentLoaded', init);`（`:4846`）不动。**进入页面即拉一次列表**（D-18 诚实边界：设置页收不到任何主进程广播）。

**6）不可用的既有工具（**反面参照**，必须走各自的替代）**：

| 想做的事 | 不能用 | 为什么 | 替代 |
|----------|--------|--------|------|
| 复用折叠块的 JS | `renderSkillContentBox`（`src/renderer.js:8953`） | 浏览器脚本、**无 `module.exports`**、纯 Node 不可 require；设置页是另一个 `<script>` 上下文 ⇒ **跨文件不可调用** | 复用 CSS 类 + 在本文件写 **3~5 行**局部展开辅助，并把 a11y 契约（`role="button"` + `tabindex="0"` + `aria-expanded` + Enter/Space）与类名**双写纪律**一并实现 |
| 等跨窗口同步事件 | `skills:changed` / 任何 broadcast | `windowManager.broadcast` 只发各 `BrowserWindow.webContents`，**不到 webview guest**（`window-manager.js:310`）；设置页实测零 `realmAPI` / 零 `ipcRenderer` | 每次写操作**用响应体回传的最新投影**就地重渲染（**零二次请求**）；进入页面时拉一次 |
| 复用状态文案 | 本页新写「已禁用」/「已遮蔽…」 | D-12 单源 | 查 `window.SkillPickerModel.STATUS_TEXT` |
| 复用来源徽标文案 | 本页新写「用户/内置/托管」 | 48/49 单源 | 查 `window.SkillPickerModel.TIER_BADGE` |
| 用既有 hint 色调类 | `.ai-memory-hint-success` / `-danger` | UI-SPEC `:88` 反面参照：`--success-color`（亮底 2.33:1）与 `--danger-color`（四档 3.81/2.76/3.45/2.85）作小字文字色**全部不达标** | 另立 `.skill-manage-hint-success`（`--skill-success-text`）/ `.skill-manage-hint-danger`（`--skill-error-text`） |
| 用既有空态 hint 类 | `.whitelist-hint` | UI-SPEC `:87` 反面参照：`--text-muted` 在 `--bg-secondary` 上 2.97:1（暗）/ 2.33:1（亮）不达标，且它是**非活动控件**的豁免场景，本页的行是**活动行** | 另立 `.skill-manage-state` 家族 |
| 用危险按钮类 | `.btn-danger` | 白字对 `--danger-color` 实测 **3.76:1** < 4.5（12px 小字） | `.skill-manage-danger-btn` = 中性底（`.btn-secondary` 的 `--bg-tertiary`）+ `color: var(--skill-error-text)` |

---

### `src/styles/main.css`（config / 样式）

**Analog:** `.ai-skill-content-box` 家族 `:5827-5891`、`.slash-picker-source-badge` 族 `:7236-7279`、`.ai-modal-overlay` `:5350-5358`、令牌块 `:7-34`（暗）/ `:36-64`（亮）。

**落点强制**：整段**追加在文件末尾**的专属段中（段注释 `/* ===== 设置页「技能管理」区（Phase 50） ===== */`）。理由是**源序依赖**：`.skill-manage-danger-btn { color: … }` 与 `.btn-secondary`（`:923-926`）**同特异性**（各一个类），必须靠**后出现**才能覆盖 `color`。插到中部会让这条覆盖**静默失效**。

**完整 CSS 段已由 UI-SPEC 逐条定稿**（`50-UI-SPEC.md:826-1045`）—— **plan 期直接照抄该代码块**，不要自行设计。三条**作用域收敛**的覆盖是唯一允许触碰既有类的入口（均带 `.skill-manage-section` 前缀 ⇒ 48/49 实名宿主零变化）：

```css
/* 焦点环（作用域收敛：不改动 provider 区的那个宿主） */
.skill-manage-section .ai-switch:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }
```
```css
.skill-manage-section .slash-picker-tag-explicit { color: var(--text-primary); }
```
```css
.skill-manage-section .ai-skill-content-box-header:hover { color: var(--text-primary); }
```

**唯一新增令牌**（**两套主题块都要写**，缺一即在对应主题下失效）：

| 令牌 | 暗色值 | 浅色值 | 用途 |
|------|--------|--------|------|
| `--skill-success-text` | `#6EE7B7` | `#065F46` | 启停成功的 inline hint（12px） |

⚠️ **同值不同量提醒**：`--skill-success-text` 与 `--skill-source-builtin`（内置徽标色）今天**取值相同**、**语义不同** —— **改动其中一个时不得顺手同步另一个**。

**硬禁令（由对比度核算直接导出，UI-SPEC `:350-355`）**：`.skill-manage-row` **不得**声明 `:hover` / `.active` 的 `background: var(--bg-hover)`（会让描述 / 元信息 / 中性状态标注同时跌破 4.5:1，并把「仅显式」的合成底拖动）。另：`.skill-manage-row-main` **不得**声明 `flex-wrap`。

---

### `docs/product/ai-skills.md` / `AGENTS.md`（doc）

**Analog:** `docs/product/ai-skills.md` §十一 `:433-543`（章节体例 + §11.8 的 `NN 例，实测` 账本）；`AGENTS.md:267`（测试清单行）/ `:272-273`（技能域维护约定）。

**文档体例**：现有十一节，`## 一、` … `## 十一、`（`grep -n "^## " docs/product/ai-skills.md`）。新增**第十二节「管理面」**，条目形态照抄 §十一：短小节标题 + 表格 + 「诚实边界」小节。

**三处必须同批刷新（D-08 / OQ-3）**：
1. `docs/product/ai-skills.md` §11.3 `:457-483` 的「九条拒绝原因 / **不新增第十码**」⇒ 改为「**工具侧**九条不变；管理面另有 `not_user_owned`（第十码，见第十二节）」。
2. `docs/product/ai-skills.md` §七 `:98-99` 与 §11.8 `:534-543` 的 `NN 例` 账本行。
3. `AGENTS.md:267` 的测试清单行（含「九码长度上限」措辞）与 `:273` 维护约定的硬约束条目。

**counts-parity 是机械判据**（命令见 `50-VALIDATION.md:29` / `50-RESEARCH.md:1511-1524`）：新增第四个套件时，**四处必须同批扩** —— ① 命令的 `suites` 数组；② `AGENTS.md:267`；③ `docs/product/ai-skills.md` §七/§11.8；④ `50-VALIDATION.md` 的命令副本。⚠️ 该判据用 `if(cells<8)`（**`<` 而非 `!==`**）⇒ **漏加新套件的账本单元不会自动报错**，plan 期必须主动补，不得依赖它报错。

---

### `tests/test-skills-management.js`（**新建** / `node:test` 独立套件）

**Analog:** `tests/test-manage-skill.js` 的文件骨架 `:1-82`（**逐字照抄**）。

**1）文件头注释（`:1-17`，必须带「用法:」行）**：

```js
/**
 * `manage_skill` 写入路径单元测试（node:test，**纯 Node 环境**）
 *
 * 覆盖 Phase 49 的校验器 / 净化 / 扫描单点 / 撞名判定 / seeded 保护 / 数量闸 /
 * 沙箱原子写 / 三动作 / 护栏。全部用例经 `setWorkspaceDir` 注入临时目录，
 * 不触碰真实 userData。
 *
 * **seededNames 一律显式注入数组常量 `SEEDED`，严禁走 `getSeededSkillNamesSafe()`**：
 * 后者在纯 Node 下 `require('electron')` 返回字符串、`app` 为 undefined ⇒ TypeError
 * ⇒ 被 catch 降级为 `[]`，会让 seeded 保护用例**假绿**（这正是 D-11 的注入式签名
 * 设计的目的）。
 *
 * 用法: node tests/test-manage-skill.js
 */
```

**2）require 头（`:19-29`）**：

```js
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiMemoryManager = require('../ai-memory-manager');
const aiSkills = require('../ai-skills-manager');

/** 仓库根目录（源码扫描型断言用） */
const REPO_ROOT = path.join(__dirname, '..');
```

**3）源码扫描读取器（`:38-41`，双入口「无判定逻辑 / 同一方法名」判据要用）**：

```js
/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}
```

**4）临时根 + 缓存复位夹具（`:69-82`，新套件**必须**照抄 —— 否则跨用例污染让「空技能集」断言假失败）**：

```js
/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-manage-skill-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    aiMemoryManager.setBaseDir(null);
    // 模块级 _cache 跨用例污染会让后续断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  aiMemoryManager.setBaseDir(dir);
  return dir;
}
```
`aiSkills._resetCacheForTest()`（导出面见 `ai-skills-manager.js:1659-1661`）是**新套件跨用例隔离的必用件**。

**5）沙箱 env 构造（`:84-86` 的注释口径）**：

```js
/** 建工作区目录 + 沙箱 env（create 的硬前置：.tmp/ 与 managed-skills/ 都要存在） */
async function makeEnv(root) {
```
尺寸遍历的用例需要**真实 `fs`** 造 `.DS_Store` / 嵌套目录 / 内部 symlink 环 / 外逃 symlink（`50-RESEARCH.md` §Pattern 1 的遍历规则表逐行对应一条断言）。

**6）运行方式**：`node tests/test-skills-management.js`（**文件内自带 `require('node:test')` 自跑**，与 `test-manage-skill.js` / `test-ai-skills.js` 同款）。⚠️ **不要**照 `test-skill-picker-model.js` 的 `node --test` 形态 —— 本仓两种跑法并存，counts-parity 命令按**文件名是否含 `picker`** 切换。**`npm test` 不存在**（`package.json` 的 `scripts` 无 `test`），任何 `<automated>` 都必须用具名命令。

---

### 三个既有测试套件的增补（原地改）

**`tests/test-manage-skill.js`** —— Analog：`:1588-1621` 的两条 `deepStrictEqual` 冻结断言。

```js
describe('九码闭合白名单的不变式（本计划不增不减不改名）', () => {
  test('MANAGE_SKILL_ERROR 恰十条键：九码 + 沙箱层兜底 unknown，值集合逐字锁定', () => {
    assert.deepStrictEqual(
      Object.keys(aiSkills.MANAGE_SKILL_ERROR).sort(),
      [
        'ALREADY_EXISTS',
        ...
        'USER_OWNED_CONFLICT',
      ].sort(),
      '新增或删除任一码都必须先改契约（D-07 的闭合白名单），本计划不动它'
    );
```
**同批改三处**：① 键集合加 `NOT_USER_OWNED`（十键 → **十一键**）；② 值集合加 `'not_user_owned'`（九码 → **十码**，注意 `unknown` 已在内 ⇒ 清单从 10 项变 11 项）；③ `:1588` 的 describe 标题（「本计划不增不减不改名」在新设计下失实）。**`assert` 的第三条消息文本也要一并改**（否则留下自相矛盾的注释）。

**`tests/test-ai-skills.js`** —— Analog：`:3219-3247`（`promptCtx` 夹具，含 own-property 计数包装）+ `:3398`（`captureBroadcasts`）+ `:3282-3296`（`channels` 与 `rescanCalls === 2`）。

新增两组用例：**写路径次数账**（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播恰一次）与**忙时补播**（`ctx.isProcessing = true` 后调管理写方法 ⇒ `channels` 含 `skills:changed` 恰一次，且 `agent.state.systemPrompt` 未变）。⚠️ 该夹具的 fake `configStore` **目前只有 `get`**（`:3233`）—— **必须补 `set`** 才能测管理写路径。

**`tests/test-skill-picker-model.js`** —— Analog：`:1026-1041`（`STATUS_TEXT` 冻结）/ `:1262-1279`（「仅显式」三条断言）。

新增 `STATUS_TEXT.disabled` 值断言（**不要**动 `MANAGE_SKILL_SHORT_REASON` 的 9 键断言 —— 那是**另一张表**）：

```js
  test('G-49-3 · 九码短原因长度上限：每值非空字符串且 ≤ 6 字；limit_exceeded 引用同一常量', () => {
    const table = model.MANAGE_SKILL_SHORT_REASON;
```
「仅显式」单源提升后**三条既有断言必然转红、必须一并改写，且三条方向各不相同**：

```js
    assert.strictEqual(
      (panelBody.split('仅显式').length - 1),
      1,
      '「仅显式」在面板渲染函数体内恰出现一次（条件标记，权威在渲染侧）'
    );
    assert.strictEqual(
      (panelBody.split('该技能不进模型提示词，只能手动调用（/skill:名字）').length - 1),
      1,
      '其 title 文案在面板渲染函数体内恰出现一次'
    );
    ...
    assert.strictEqual(modelSrc.includes('仅显式'), false, '该文案不与行尾状态标注混放');
```
改写方向（UI-SPEC `:562-571` 已定稿，**必须三条一起改**）：
- `:1265-1269` 与 `:1270-1274` ⇒ 字面量计数变 **0** ⇒ 改为「断言单源表的值」+「断言面板侧**引用**该单源常量」；
- `:1278` 的 `modelSrc.includes('仅显式') === false` 被新设计**直接证伪**（单源表必须把它写在 `skill-picker-model.js` 里）⇒ 改为「断言**单源表的值**恰为 `'仅显式'`」+「断言它**不在** `STATUS_TEXT` 的值集合里」（把「不混放」从**文件级零命中**改为**表级值域隔离** —— 前者在新设计下**字面不可满足**）。

> ⚠️ **必须先按新设计逐条实跑一遍再落码**：三条里第 3 条属 `feedback_plan_authored_gates` 的同族形态（「断言恒真 / 恒假」），凭「改了就能过」的推断交付会让测试永久红。

---

## Shared Patterns

### 1. HTTP handler 形状：`token → pathname strip → 分支 → sendJson`

**Source:** `main.js:1336-1344`（`handleSettingsApi`）/ `main.js:2649-2654`（`handleAiMemoryApi`）
**Apply to:** `main.js` 的 `handleSkillsApi`

```js
    // token 鉴权
    if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const route = reqUrl.pathname.replace('/api/settings/', '');
```
`REALM_TOKEN` = `crypto.randomUUID()`（`main.js:104`）。**每个 `/api/*` 入口首行都要有它** —— 这是 ASVS V4 的既有控制面，`handleSkillsApi` 不得例外。`catch` 块形状见 `main.js:2698-2701`。

### 2. 错误形状：`{ error, code }` + HTTP 400 + 不回显被拒内容原文

**Source:** `main.js:1379` / `:1387` / `:2700`（`sendJson(res, 400, { error })`）+ `ai-skills-manager.js:979-995`（`makeManageSkillError` 的口径注释）
**Apply to:** `handleSkillsApi` 三个子路由

```js
 * 错误消息只给原因码 + 可操作提示 + 限额 / 当前值，**不回显被拒内容原文**。
```
前端**只按 `code` 查表、不解析 `message`**（UI-SPEC 失败文案映射表 `:466-472`，含闭合白名单与 `BODY_TOO_LARGE` 兜底）。

### 3. 零 electron 依赖 + 双模式导出（跨进程单源的全部机制）

**Source:** `ai-skills-manager.js`（模块头依赖纪律）+ `src/skill-picker-model.js:476-477`

```js
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
```
**Apply to:** `ai-skills-manager.js` 的任何新增（必须保持零 electron）；`src/skill-picker-model.js` 的任何新增表（必须仍只挂到同一个 `api` 对象）。
**为什么关键**：`main.js` 要直接用管理面名称谓词、设置页要直接用 `STATUS_TEXT`/`TIER_BADGE` —— 两侧都靠「纯 Node 可 require + 浏览器可 `window.*`」这一个形态拿到**同一份**实现。

### 4. 沙箱文件原语（**唯一**的文件 IO 入口）

**Source:** `agent-workspace.js:205-…`（`createSandboxEnv`）→ `:286-290` / `:292-296` / `:309-313` / `:321-325`

```js
    async listDir(p, abortSignal) {
      const blocked = guardResult(p);
      if (blocked) return blocked;
      return inner.listDir(p, abortSignal);
    },
```
**Apply to:** `ai-skills-manager.js` 的尺寸遍历、`deleteUserSkill`
**契约**：FileSystem **永不 throw**，失败编码进 `Result`（`agent-workspace.js:215` 逐字注释）⇒ 一切 `ok !== true` 都当「读不到」处理、**不 throw**。路径恒由 `path.join` 计算，**不得**直接 `fs`（绕过 `resolveInside` 的 realpath 复核 = 开一个新的越界读入口）。

### 5. 渲染端 DOM 构建（零 HTML 字符串模板）

**Source:** `src/settings-page.js:2907-2912`（`renderAiBashWhitelistTags` 的注释逐字「使用 DOM 构建 + textContent 防止 XSS（WR-13）」）
**Apply to:** `src/settings-page.js` 的技能列表 / 诊断详情区 / 汇总条 / 确认弹框
**承重理由**：`escapeHtml`（`src/settings-page.js:1657`）只转义 `& < >`、**不转义引号**（`TD-48-01` 仍开、用户已裁决延后）⇒ 本页新增的**属性上下文**插值（`title` / `aria-label` / `aria-controls`）必须走 `el.title = value` / `setAttribute`（DOM 属性赋值不走 HTML 解析），**不扩大缺口**。

### 6. `realm://` CSP 与弹框居中的既有豁免

**Source:** `src/styles/main.css:5350-5358`（`.ai-modal-overlay { display: none }`）+ `AGENTS.md` §「内部页面 CSP」/「弹框居中约定」

**Apply to:** 卸载确认弹框

- 初始隐藏走**CSS 类**（既有 `.ai-modal-overlay { display: none }`），打开时 JS 置 `overlay.style.display = 'flex'`（CSSOM，不受 CSP 限制），关闭置 `'none'`；
- **绝不**写 markup 内联 `style="display:none"`；
- **绝不**把 `.ai-modal-overlay` 用到 `<dialog>` 元素上（`AGENTS.md` 明文：全屏 div 遮罩类用到 `dialog` 上会把盒子钉在 `top:0; left:0`）。

### 7. 写路径收口（`syncAgentSystemPrompt()` 恰一次 + 调用侧补播恰一次）

**Source:** `ai-manager.js:6252-6258`（先例）+ `ai-manager.js:3038-3041` / `:3053`（忙时置脏早退 vs 广播点）
**Apply to:** `setSkillDisabled` / `uninstallUserSkill`

```
写成功
  ├─ 改名单位（增/删一个名字）
  ├─ await this.syncAgentSystemPrompt()   ← 内含恰一次 refreshSkills；**不得**前置再调 refreshSkills
  └─ windowManager.broadcast('skills:changed')  ← 调用侧补播，覆盖 isProcessing||streaming 的「只置脏、return、不广播」
```
**为什么必须在调用侧**：`syncAgentSystemPrompt()` 的忙时分支在 `:3041` **return**，而广播在 `:3053` —— 函数体被 46-04 方法体源码断言（`tests/test-ai-skills.js:1299-1306` / `:2299-2303`）与 48 广播次数断言（`:1239` / `:3289` / `:3455`）同时钉着，**不能改**。补播**幂等**（`:4405-4407` 的消费端无条件重拉快照）。

### 8. 「禁用」的消费侧过滤（**已存在，不重判**）

**Source:** `src/skill-picker-model.js:222`

```js
      if (!s || s.disabled === true) continue;
```
**Apply to:** 无需改动 —— 本阶段只需保证管理投影如实带出 `disabled`，`/` 面板侧的过滤逻辑**已就位**（D-10「纯消费主进程布尔，不重判」）。

---

## No Analog Found

**无。** 本阶段 15 个目标文件全部有 exact / role-match 级 analog，且全为同仓 git 追踪文件（已逐个 `git ls-files` 核验）。

唯一形态上「新」的是 **`src/settings-page.js` 内的折叠辅助** —— RESEARCH Pitfall 13 已核实**不存在可复用的 JS 模块**（`renderSkillContentBox` 在 `src/renderer.js:8953`，浏览器脚本、无 `module.exports`，跨文件不可调用）。**处置 = 接受一处 3~5 行的小重复 + 必须加一条跨文件源码扫描测试**，断言设置页与 renderer 使用**同一组类名**与**同一组 aria 属性契约**（否则第三处宿主会静默漂移成第二套折叠控件）。**不得**为了消重去改 `src/renderer.js`（UI-SPEC 明文「本阶段不重设计既有面」）。

同样属于「无处照抄、按 RESEARCH 给形状实现」的两处（analog 存在但不覆盖目标形态，已在对应节内给出证据锚点）：

| 位置 | 为什么没有直接 analog | 目标形状来源 |
|------|----------------------|--------------|
| `main.js` 的 `readJsonBody` 体积闸 | 仓内**没有任何**请求体限流先例（现状就是 `body += chunk` 无上限） | `50-RESEARCH.md` §「矛盾 1」的 ✅ 已裁决块（**BINDING**）+ §Code Examples `:1221-1277` |
| `ai-manager.js` 的 `ensureSkillsFresh()` | 仓内**没有**「不依赖 Agent 的读路径初始化」先例（既有两条读路径都早退） | `50-RESEARCH.md` §Pattern 5（含四条约束与「判据必须是缓存是否已加载过、不得按有没有 provider 判」） |

---

## Metadata

**Analog search scope:** 仓库根（`ai-skills-manager.js` / `ai-manager.js` / `main.js` / `ipc-handlers.js` / `agent-workspace.js` / `builtin-skills-seeder.js`）+ `src/`（renderer / settings-page / settings.html / skill-picker-model / preload / styles/main.css）+ `tests/` + `docs/product/` + `AGENTS.md`；SDK 读 `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.js`
**Files scanned:** 24（读了全部相关段落，含冻结断言块与测试夹具骨架）
**追踪状态核验:** 17 个 analog 全部 `git ls-files` 命中（**零 gitignored 镜像路径** —— 本阶段全部 analog 都在仓库根与 `src/` 的受追踪源码树内）
**Pattern extraction date:** 2026-09-14
**上游依据:** `50-CONTEXT.md`（D-01..D-19 + OQ-1..OQ-5）/ `50-RESEARCH.md`（含「矛盾 1」的 **✅ 已裁决 = 方案 A** BINDING 块）/ `50-UI-SPEC.md`（approved，三轮通过）/ `50-VALIDATION.md`
