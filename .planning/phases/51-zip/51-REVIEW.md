---
phase: 51-zip
reviewed: 2026-09-15T09:57:15Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - AGENTS.md
  - agent-workspace.js
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-agent-workspace.md
  - docs/product/ai-skills.md
  - main.js
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - tests/helpers/make-malicious-zip.js
  - tests/test-agent-workspace.js
  - tests/test-ai-skills.js
  - tests/test-builtin-skills-seeder.js
  - tests/test-manage-skill.js
  - tests/test-skills-http-api.js
  - tests/test-skills-import-net.js
  - tests/test-skills-import.js
  - tests/test-skills-management.js
  - tests/uat-51-import-modal.js
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-09-15
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

导入管线（zip 上传 / 网络 zipball / raw 直链 → 同一条解压校验与落盘管线）的安全承重面经逐行核对与**实跑探针**验证，多数判据与文档一致且判据链是单源的：

- 解压面（`readSkillPackageEntries`）：entry 名八条自建判据（含原始字节面）、NFD+小写查重、两路 symlink、zip64 声明特例、压缩比闸、累计字节闸、流内实测字节闸全部在位；`fs.mkdtempSync` 空目录 + 解压后 `assertNoSymlinkTree` realpath 复核构成双层。
- 网络面（`downloadPackage` + `classifyImportUrl`）：https 强制 / 白名单精确成员判定（`normalizeHost` 只剥一个 `www.`，不做后缀匹配）/ 逐跳私网 / 跳数超限抛错 / 流式字节上限（实读字节而非 `content-length`）/ magic bytes，五道逐跳执行；生产调用点传 `undefined` 走真实实现。
- 落盘面（`importUserSkill`）：唯一落盘实现、`importId` 不透明、客户端不能指定落点、改名走同一份 `validateManagedSkillName`、覆盖事务备份+两段 rename+回滚、回读失败即回滚、全走沙箱原语。
- 写面加固（SEC-10）：`resolveInsideForWrite` 与读面判据并列（`buildRootBaseline`/`isInsideBaseline` 同源），最近已存在祖先 realpath 复核堵住「中间目录是链接」的缺口；五个写方法与两个临时目录方法全部切换，读面语义零变化（源码契约与十例对照表双向钉住）。
- 前端 region **零 `innerHTML` / `insertAdjacentHTML`**，全部 `createElement` + `textContent` / `el.title`（不扩大 TD-48-01 的缺口）；`SKILL_IMPORT_ERROR_TEXT` 与 `IMPORT_SKILL_ERROR` 21 键双向覆盖有机械判据。
- 实跑：`node tests/test-skills-import.js` 116/116、`node tests/test-skills-import-net.js` 50/50 通过；另用三个独立探针复现了下述 CR-01 / WR-01 / WR-02。

**核心结论：安全与校验面未发现可证明的逃逸或注入缺口；但句柄生命周期在前端断了一环（CR-01，可复现的用户可见死路 + 临时区滞留），共享缓存被回读刷新污染且回滚后不复扫（WR-01），另有两条文档/注释与实现不符（WR-02 压缩比闸判据对象、WR-03 声称的 manage_skill 接线），六条 INFO 为死代码与口径不一致。**

## Critical Issues

### CR-01: 前端重复取预览不归还上一个 `importId` ⇒ 句柄与临时目录滞留、第 4 次预览起必然 `too_many_pending` 且无法按提示自救

**File:** `src/settings-page.js:6840-6848`（成功路径覆写）、`src/settings-page.js:6863`（失败路径置空）；成因链在 `ai-manager.js:1826`（并发上限判定）、`ai-manager.js:1933`（句柄登记）

**Issue:** `fetchSkillImportPreview()` 在取到新预览后**直接覆写** `skillImportTarget.importId`，从不调用 `discardSkillImportHandle()` 归还上一个句柄：

```js
skillImportTarget.importId = result && result.importId ? result.importId : null;   // 6844
skillImportTarget.preview   = result && result.preview  ? result.preview  : null;
...
} catch (err) {
  ...
  resetSkillImportSurfaces();      // 6863：把 importId 置 null，同样不归还
```

主进程侧 `previewSkillImport()` 每次都新建 `.tmp/skill-import-XXXX/` 并 `this._skillImports.set(importId, …)`，句柄只在四条路径上被释放：commit 成功 / commit 显式取消 / commit 报 `import_expired`·`import_not_found` / `cancelSkillImport`。`closeSkillImportModal()` 只归还**当前那一个** `importId`。于是：

1. **覆写即泄漏**：同一弹框会话内连续 3 次成功预览（「换个地址再试」「重选文件」都是自然操作）后 `_skillImports.size === 3`，第 4 次预览 100% 返回 `too_many_pending`，文案是「同时待确认的导入过多（上限 3 个），请先完成或取消上一个预览」——**而 UI 没有任何「取消上一个预览」的入口**，用户唯一的动作是关掉弹框；关掉只释放 1 个（size 3→2），重开后一次预览又回到 3，第 4 次再被拒。恢复只能等 10 分钟 TTL 或重启应用。
2. **失败预览会永久孤儿化旧句柄**：`catch` 分支把 `importId` 置 null 而不归还，此时旧句柄已从 UI 侧不可达（连 `closeSkillImportModal` 都拿不到它），只能等 TTL 或退出清扫。
3. **临时区滞留**：每个滞留句柄名下是一个**已解压的整包目录**（单包上限 32 MiB）。探针实测 3 次预览后 `.tmp/` 下常驻 3 个 `skill-import-*` 目录。

实测（直接驱动 `AIManager` 复现前端调用序列）：

```
preview #1 ok  size=1
preview #2 ok  size=2
preview #3 ok  size=3
preview #4 => too_many_pending: 同时待确认的导入过多（上限 3 个），请先完成或取消上一个预览
close modal (cancel newest) => size = 2          ← 关弹框只释放 1 个
preview after close ok, size = 3
next preview => too_many_pending                  ← 立刻再次撞墙
tmp residue: 3 dirs
```

`tests/test-skills-import.js:1177` 只覆盖了「3 个并发 + `cancelSkillImport` 释放名额」，没有覆盖「前端以新预览覆写旧 `importId`」这条真实链路，因此该缺口在两条独立证据链（单测 + uat）之外。

**Fix:** 在取新预览前先归还上一个句柄（同时覆盖成功覆写与失败孤儿两条路径）：

```js
async function fetchSkillImportPreview(source) {
  if (!skillImportTarget) return;
  const kind = source && source.kind;
  // 归还上一个句柄：新预览会覆写 importId，旧句柄否则会活到 TTL / 退出清扫
  discardSkillImportHandle(skillImportTarget.importId);
  skillImportTarget.importId = null;
  cancelSkillImportRequest();
  ...
```

（`discardSkillImportHandle()` 已是「尽力而为、不阻塞」语义，弹框内重复调用安全；若希望更保守，可把它放在成功分支里以 `prevId !== newId` 为守卫，并在 `catch` 内补一次。）

## Warnings

### WR-01: 回读刷新的 `refreshSkills()` 未传 `disabled`，且回滚后不复扫 ⇒ 共享缓存丢掉禁用名单、并留下指向已回滚目录的幽灵条目

**File:** `ai-skills-manager.js:4556`（回读刷新）、`ai-skills-manager.js:4574-4585`（回滚分支）；`ai-manager.js:2031`（仅在成功出口复扫）

**Issue:** `importUserSkill()` 的 ⑧ 回读验证用 `await refreshSkills(env, { rootDirs: [managedDir, skillsDir] })` 重建**模块级唯一权威缓存** `_cache`，而 `disabled` 缺省为 `[]`。`_cache` 是 `getSkillsForUI()` / `getSkillsForManagement()` / `getSkillPromptIncluded()` / `readSkillForInvocation()` / `buildSkillsPrompt()` 的共同数据源，因此这一步会**静默撤销**用户对其它技能的禁用标记。实测（`_cache` 直读）：

```
BEFORE alpha.disabled = true  | promptBlock contains d-alpha? false
AFTER  alpha.disabled = undefined | promptBlock contains d-alpha? true
getSkillsForUI alpha = {"name":"alpha",...,"disabled":false,...}
```

影响面：

- **成功路径**：`ai-manager.commitSkillImport` 随后调 `ensureSkillsFresh()`（传 `disabled`）把它修回来 —— 但修复来自另一个模块的调用，`importUserSkill` 自身产出的中间态是错的；且 `getSkillPromptIncluded()`（`manage_skill` 卡片）与上下文用量估算（`ai-manager.js:3904` 的 `buildSystemPrompt()`）读的是这份缓存。
- **失败路径**（回读验证失败 ⇒ 回滚）：`commitSkillImport` 刻意**不**调 `ensureSkillsFresh`（「失败保留句柄供就地重试」），于是污染**持久保留**到下一次无关的重扫（打开 `/` 面板、设置页列表、任意技能写路径）。此时 `readSkillForInvocation()` 对用户已禁用的技能不再返回 `{ok:false, reason:'disabled'}`（`ai-skills-manager.js:1159` 读 `entry.disabled`），`getSkillsForUI()` 报 `disabled:false`。
- **幽灵条目**：同一条路径上，回滚把 `skills/<name>/` 移回源位置后**没有复扫**，于是 `_cache.skills` 仍含一条 `filePath` 指向已不存在目录的条目（与「不提供部分导入」的落盘语义在缓存层不一致）。

**Fix:** 把 `disabled` 按本模块既有的注入纪律透传进来，并在回滚后复扫一次让缓存与磁盘同态：

```js
async function importUserSkill(env, { srcDir, rootRel = '', name, conflict, newName } = {}, { seededNames, disabled = [] } = {}) {
  ...
  await refreshSkills(env, { disabled, rootDirs: [managedDir, skillsDir] });
  ...
  if (!readbackOk) {
    ...回滚 rename...
    await refreshSkills(env, { disabled, rootDirs: [managedDir, skillsDir] }); // 回滚后复扫，避免幽灵条目
    throw makeImportError(...);
  }
```

调用点 `ai-manager.js:2027` 同步改为 `{ seededNames: this.getSeededSkillNamesSafe(), disabled: this.configStore ? this.configStore.get('settings.aiSkills.disabled', []) : [] }`。

### WR-02: 产品文档把压缩比闸写成「解压总量 ÷ 压缩包体积」，实现判的是**单条目**口径 —— 判据对象不一致，且实现严于文档（可拒绝文档口径下合法的包）

**File:** `docs/product/ai-skills.md:737`（文档） vs `ai-skills-manager.js:3370-3387`（实现）

**Issue:** 文档「六类限额」表写 `MAX_COMPRESSION_RATIO` 的作用是「**解压总量 ÷ 压缩包体积**的上限」，而实现是**逐条目**判定：

```js
entry.uncompressedSize / entry.compressedSize > IMPORT_LIMITS.MAX_COMPRESSION_RATIO
```

两者对多条目包**不等价**：`max_i(u_i/c_i) ≥ Σu/Σc`，逐条目口径恒严于（或等于）归档口径。实测反例（同一包内 1 MiB 低熵文本 + 1 MiB stored 随机数据，归档级压缩比 ≈ 2 << 100）：

```
zlib deflate 后大小 = 1034 => 压缩比约 1014
结果：拒绝 code=limit_exceeded :: 压缩包条目压缩比超过上限：限额 100:1，该条目实测约 1014:1
```

即文档口径下应放行的包被实现拒绝。方向是安全的（更严），但本仓对「判据对象必须写清、两侧判的必须是同一个量」有明文纪律（AGENTS.md 导入维护约定第 ②③④ 条同一族），且设置页的失败文案来自后端 message（逐条目措辞），用户对照文档会看不出为何被拒。

**Fix:** 二选一并保持两处同源。建议对齐**文档**（保留逐条目这道自建闸，它比归档口径更能拦住「单条目炸弹夹在合法条目之间」）：

```
| **压缩比** | `MAX_COMPRESSION_RATIO` | `100` | **单个条目**的解压后字节 ÷ 该条目的压缩后字节 的上限（zip 炸弹的另一道自建闸） |
```

同时在 13.3 的「逐条口径」段落补一句「逐条目判定严于归档级判定，低熵大文件（如 1 MiB 全空白）会命中 —— 这是已知的保守误报方向」。

### WR-03: `SKILL_THREAT_PATTERNS` 的 JSDoc 与 §11.5 声称「`manage_skill` 写入路径自动获得技能域模式」，实现没有这条接线

**File:** `ai-skills-manager.js:3993-3997`（注释断言）、`docs/product/ai-skills.md:502`（文档断言） vs `ai-skills-manager.js:1573-1581`（`scanSkillText` 实体）

**Issue:** 注释逐字写着「本表落 `ai-skills-manager.js` 后，**49 的 `manage_skill` 写入路径自动获得技能域模式**。这是交接契约的兑现」；§11.5 也写「写入前对文本跑**技能域扫描单点**（与记忆域共用同一份模式表与同一份判定逻辑；Phase 51 的威胁模式组只需在同一份模式单源里扩表，**不加接线**）」。但实现里：

- `scanSkillText()`（49 的写入侧唯一扫描点）只调 `ai-memory-manager.scanInjectionPatterns()`，**从不引用** `SKILL_THREAT_PATTERNS`；
- `SKILL_THREAT_PATTERNS` 只被 `scanSkillThreats()` 消费，而 `scanSkillThreats` 的两个调用点（`ai-skills-manager.js:4301-4302` 的 `buildImportPreview` 与 `:4502-4503` 的 `importUserSkill`）**都在导入面**。

全仓 grep 确认 `scanSkillThreats` / `SKILL_THREAT_PATTERNS` 只出现在 `ai-skills-manager.js`（定义）与两个测试套件，`docs/product/ai-skills.md` 正文里**没有**这条承诺。因此 `manage_skill` 的 create / update 路径现在**不会**报告技能域三类（外发 / 凭据回显 / 诱导跳过确认），文档与注释描述的行为不存在。两条判据的语义也确实不能直接合并（`scanSkillText` 命中即 throw 硬拒，技能域三类是「高亮 + 必勾」）—— 所以正确处置是**改文档与注释**，不是接线。

**Fix:** 把 `ai-skills-manager.js:3993-3997` 的断言改为如实表述，并同步 §11.5 那句（例如）：

```
## 与 49 写入侧的关系（**分表，无接线**）

本表**不**被 `scanSkillText()` 消费 —— 写入侧（manage_skill）与导入侧是两套效力：
前者命中即硬拒（`injectClass` / 凭据组），后者只高亮 + 必勾。因此 49 的写入路径
**不会**因为本表落在此文件而获得技能域三类；日后要扩写入侧的拒绝面，必须显式接线，
不能假定「扩表即可」。
```

## Info

### IN-01: `.skill-import-status-danger` 是死规则（JS 施加的是 `.skill-manage-hint-danger`）

**File:** `src/styles/main.css:10808` vs `src/settings-page.js:6007-6009`

**Issue:** 本阶段新增的 `.skill-import-status-danger { color: var(--skill-error-text); }` 没有任何消费者。`setImportState()` 里 remove/add 的类名是 50 的 `skill-manage-hint-success` / `skill-manage-hint-danger`（`main.css:10620` 定义了后者，效果与新增规则相同）。危险色**当前有效**，但载体是本区之外的既有类；一旦有人清理 50 的 hint 段，本区失败态会静默失色。
**Fix:** 删掉 10808 的规则（并在 `.skill-import-status` 注释里写明「危险色复用 `.skill-manage-hint-danger`」），或改 JS 施加 `.skill-import-status-danger` 并把注释同步。

### IN-02: `SKILL_IMPORT_STATE.SUCCESS` 定义了但从不进入

**File:** `src/settings-page.js:5766`（`SUCCESS: 'success'`）+ `SKILL_IMPORT_STATUS_TEXT` 的 `success: ''`

**Issue:** 成功出口走 `closeSkillImportModal()`（弹框关闭 → 区级 `setSkillManageHint`），`setImportState(SKILL_IMPORT_STATE.SUCCESS)` 全仓 0 处。该状态与它的状态行文案都是死代码，也没有任何测试断言它可达（`grep SKILL_IMPORT_STATE tests/` 为空）。UI-SPEC 的「9 态」因此有 1 态是名义态。
**Fix:** 或在 `performSkillImport()` 成功分支先 `setImportState(SUCCESS)` 再关闭（保留 9 态可达性），或在状态常量的 JSDoc 里如实标注「`success` 由关闭弹框 + 区级 hint 承载，不进入 `setImportState`」。

### IN-03: `downloadPackage` 的 `fallbackRef` 形参被 `void` 掉，JSDoc 却把它描述成下载层的职责

**File:** `ai-skills-manager.js:2765-2766`（`void fallbackRef;`）、`ai-skills-manager.js:2536-2539` 与 `:2760-2761`（JSDoc） vs `ai-manager.js:1866-1869`（真实重试点）

**Issue:** JSDoc 写「下载层在 **404** 时用 `fallbackRef` **重试恰一次**」，形参也确实列在签名里，但函数体首行就是 `void fallbackRef;` —— 重试实际发生在调用方 `ai-manager.previewSkillImport`（`cls.refBase + cls.fallbackRef`）。第二个 Agent 按 JSDoc 在下载层找重试逻辑会找不到。
**Fix:** 删掉形参与 JSDoc 的相关描述，或把重试实现搬进 `downloadPackage`（`classifyHttpFailure` 已把 `httpStatus` 挂在错误上，搬进去可少一次调用方分叉）。

### IN-04: `deriveImportName` 把 `MANAGE_SKILL_ERROR.INVALID_NAME` 透传进导入命名空间

**File:** `ai-skills-manager.js:3236`（`return { ok: false, code: check.code, ... }`）

**Issue:** AGENTS.md 的「码表隔离」明文要求「导入路径抛的是**本表**的那个值，不得借用 `MANAGE_SKILL_ERROR` 的键」。`deriveImportName` / `buildImportPreview`（`:4277` 的 `throw makeImportError(fm.code, …)`）路径上，`code` 直接取自 `validateManagedSkillName` 的返回（`MANAGE_SKILL_ERROR.INVALID_NAME`）。两值当前都是 `'invalid_name'`，行为无差异，但隔离纪律在此处被绕过（`prepareFromRawFile` / `importUserSkill` / `resolveRenamedTarget` 三处都显式用了本表的键，口径不一致）。
**Fix:** `deriveImportName` 内改成显式回本表的码：`return { ok: false, code: IMPORT_SKILL_ERROR.INVALID_NAME, reason: check.reason }`。

### IN-05: `/api/skills/import` 的 JSON 分支把体积闸从 1 MiB 放大到 32 MiB，而三个字段都是小载荷

**File:** `main.js:2995`

**Issue:** `mode: 'url'`（一个地址串）与 `mode: 'commit'`（`importId` + 冲突选择 + 可选新名）都不需要 32 MiB；`readJsonBody` 是「字符串累加 + `JSON.parse`」形态，放大后单次请求的驻留量约为 32 MiB × 2（UTF-16 字符串 + 解析产物）。zip 分支放大是必需的（raw 二进制），JSON 分支的放大没有对应收益。
**Fix:** 该分支改回 `readJsonBody(req, res)`（缺省 1 MiB）或显式 `{ maxBytes: MAX_JSON_BODY_BYTES }`；若担心 `newName` 被撑大，`validateManagedSkillName` 已有 64 字符上限，1 MiB 绰绰有余。

### IN-06: 测试 ④ 的第二条断言由第一条逻辑蕴含，不提供独立判别力

**File:** `tests/test-skills-http-api.js:985`（`readRawBody` 的 `destroy` 反向对照）

**Issue:** `assert.ok(outcomes.some(o => o !== 413))` 之后又断言 `outcomes.some(o => o !== 413) || outcomes.some(o => o === 'THREW')` —— 后者的左支即前一条断言，整条恒真于前一条成立时，属重复断言（看起来像两条判据，实际只有一条）。本仓对「每条判据必须能独立失败」有明文纪律（假绿形态清单）。
**Fix:** 把第二条改成有独立判别力的形态（例如断言 `destroy` 形态下 `outcomes.filter(o => o === 413).length < 3`，或直接删除并保留注释说明「单次断言的假红概率已由 3 次采样压到 1e-5」）。

---

_Reviewed: 2026-09-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
