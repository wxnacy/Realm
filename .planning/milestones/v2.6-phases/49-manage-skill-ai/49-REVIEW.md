---
phase: 49-manage-skill-ai
reviewed: 2026-09-13T16:52:00Z
depth: standard
round: 5
previous_round: 4
diff_base: a52f09de47c8fb0c5c40179978eb8d076ea20301
diff_base_round_5: 38d48726598bd79755dc64524ca6a52c9acf7527
head_round_5: 27fea24
files_reviewed: 6
files_reviewed_list:
  - AGENTS.md
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/uat-49-g49-4-card-a11y-tab-order.js
files_reviewed_list_round_4:
  - AGENTS.md
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-ai-skills.js
  - tests/test-skill-picker-model.js
  - tests/uat-49-g49-3-panel-layout.js
files_reviewed_list_rounds_1_3:
  - AGENTS.md
  - ai-manager.js
  - ai-skills-manager.js
  - docs/product/ai-skills.md
  - src/renderer.js
  - src/skill-picker-model.js
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
findings:
  critical: 0
  warning: 8
  info: 11
  total: 19
findings_scope: 累计（本文件全部轮次）—— 轮 1–3 的 7 条（WR-05..WR-08 / IN-07..IN-09）+ 轮 4 新增 7 条（WR-09..WR-11 / IN-10..IN-13）+ 轮 5 新增 5 条（WR-12 / IN-14..IN-17）
status: issues_found
---

# Phase 49: Code Review Report (re-review · gap-closure round)

**Reviewed:** 2026-09-13T12:52:52Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found
**Diff base:** `844f19f5` (previous review) → `03456c1` (HEAD)

## Summary

This round claims to close exactly five `49-REVIEW.md` items — `CR-01` / `CR-02` / `CR-03` / `WR-01` / `WR-02` — and explicitly declares `WR-03` / `WR-04` / `IN-01`–`IN-06` out of scope. My job was two-fold: verify the closures are real (not false-greens), and find what the closures broke.

**All five closures are real.** I verified each one twice — by reading the code, and by **mutation testing** (revert the fix in a copy, confirm the corresponding guard goes red, restore). Every claimed fixture proved falsifiable:

| claimed closure | code site | guard | mutation result |
|---|---|---|---|
| `CR-01` renderer merge | `src/renderer.js:9378-9385` | `tests/test-ai-skills.js:3904-3920` (M3) | revert to `manageSkill: event.manage_skill` → **M31 red** |
| `CR-02` YAML single-quoted scalar | `ai-skills-manager.js:1204-1207`, `100-105` | `tests/test-manage-skill.js:386-416` + `description 值域` group | revert to bare interpolation → **6 failures** |
| `CR-03` post-sanitize re-validation | `ai-skills-manager.js:1443-1444` / `1558-1559` | `tests/test-manage-skill.js` (create + update rows) | disable create-side → 2 red; disable update-side → 1 red |
| `WR-01` whole-file byte gate | `ai-skills-manager.js:1231-1248`, `1485-1495`, `1568-1578` | `tests/test-manage-skill.js:1008-1130` | disable create-side → 2 red; disable update-side → 1 red |
| `WR-02` failure-code affix | `ai-manager.js:6317-6320` (encode), `1847-1848` (decode) | M2c (`:3656`) + M2d (`:3751`) | disable encode → 1 red; disable decode → 2 red |

I additionally replayed the renderer's **literal** merge expression (extracted from source, evaluated against the real two-phase payloads) and confirmed the card variant now survives the `tool_execution_end` event — `action`/`name` are preserved, `manageSkillOk === true`, and a field-less update event does not erase the marker. The `yamlScalar` fix was exercised against 25 adversarial descriptions beyond the ones in the suite (bare `true`/`null`/`12345`, leading `-`/`@`/`*`, `!important`, `|`, `>`, `'''`, `C:\path`, `---`, `x\r\nname: injected`, emoji, lone surrogates, `U+FFFE`): **zero ghosts, zero description mismatches** against the real loader. The `counts-parity` judge in `docs/product/ai-skills.md` §11.8 runs clean (`cells=8 measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"105"}`) and is falsifiable — I perturbed a ledger cell and it exited non-zero.

**No Critical findings.** What survives is the guard-strength family: one of the two "semantic-ised" guards (`M3`) is still a substring scan and still admits a full `CR-01` regression; and three residual contract gaps, one of which (WR-07) directly contradicts the key-set-equality invariant that M5b/M5c are cited as establishing.

Auxiliary files read to trace call chains (not in the configured review scope): `ai-conversations-manager.js` (reload reconstruction), `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js` (throw → `createErrorToolResult` → emit ordering), `src/index.html` (script load order).

---

## Warnings

### WR-05: `M3` is still a substring scan — a full `CR-01` regression passes all 282 tests

**File:** `tests/test-ai-skills.js:3904-3920`; call site `src/renderer.js:9378-9385`

**Issue:** The commit that landed this round advertises "M3 语义化" (guard rewritten from a substring scan into a semantic assertion). M3 still asserts only two things about the merge region:

```js
merge.includes('mergeManageSkillMarker(')          // presence of the identifier
!/manageSkill:\s*event\.manage_skill\b/.test(merge) // absence of the old direct assignment
```

Neither constrains **what the shared function is called with**. The `prev` argument — the only thing that makes the call a *merge* rather than a *replace* — is unverified. Verified by mutation:

```js
// src/renderer.js:9380-9383 mutated to:
manageSkill: window.SkillPickerModel.mergeManageSkillMarker(null, event.manage_skill)
```

`prev === null` ⇒ `mergeManageSkillMarker` takes its `!prev` branch ⇒ returns `{...incoming}` = terminal-only `{tier, promptIncluded}`. That is **byte-for-byte the pre-fix CR-01 defect**: `action` and `name` are gone, `MANAGE_SKILL_ACTION_LABEL[undefined]` is `undefined`, `manageSkillOk` is `false`, and the card collapses to the generic tool-name title with the full 64 KiB `content` JSON wall.

Measured result of that mutation:

```
tests/test-ai-skills.js               177 pass / 0 fail
tests/test-skill-picker-model.js      105 pass / 0 fail
```

M5b/M5c cannot cover it: both call `mergeManageSkillMarker(startMarker, endTerminal)` **themselves** (with the correct argument order) and never touch the renderer's call site — the exact "test verifies the intent, renderer has its own implementation" false-green shape that AGENTS.md invariant ④ and this phase's recorded lesson were written to eliminate. The mutation is semantically distinct from the one M3 does catch, so the guard's negative assertion gives a false sense of coverage.

**Fix:** pin the call shape, e.g. add to M3:

```js
assert.ok(
  /mergeManageSkillMarker\(\s*existing\.manageSkill\s*,\s*event\.manage_skill\s*\)/.test(merge),
  '并入必须把「已有标记」作为 prev、把终态载荷作为 incoming —— 参数绑定反了/prev 传 null 时'
    + ' 等价于回到 CR-01 的覆盖语义（M5b/M5c 只测共享函数本身，抓不到这一层）'
);
```

Stronger (removes the class entirely, same move as `mergeManageSkillMarker` itself): move the renderer's whole `tool_execution_update` → `toolExecutions` mapping into a pure function in `src/skill-picker-model.js` (e.g. `applyToolExecutionEvent(prevExec, event)`), have `renderer.js` call that one implementation, and have the tests drive it with real start/end payloads. A source scan can never be the load-bearing guard for behaviour that a pure function can express.

---

### WR-06: A ghost write still reports unqualified success — the three-state fix removed the only signal

**File:** `ai-manager.js:6266-6300` (consume side), `ai-skills-manager.js:1651-1656` (`getSkillPromptIncluded`)

**Issue:** `getSkillPromptIncluded()` is now three-state, which is correct, and the consume side now only appends the "预算已满" sentence for strict `false` (`:6297`). But the `undefined` branch — "该 name 不在当前技能集快照里" — is documented as "此时不能断言「预算已满」…故一律不加" (`:6294-6296`) and the M2e fixture (`tests/test-ai-skills.js:3830-3868`) locks that in as desired behaviour.

For `create` / `update`, `undefined` is not an ambiguous state — it is the **ghost condition**. `getSkillsSnapshot().skills` (`ai-skills-manager.js:752-759`) contains only entries that survived the load pipeline; the name was just written to `managed-skills/<name>/SKILL.md`; the rescan ran unconditionally inside `syncAgentSystemPrompt()` **before** its busy early-return (`ai-manager.js:3030-3041`), so the snapshot is fresh. "Fresh snapshot + name absent" therefore means the file was written but the loader dropped it — the `T-49-01-08` failure family. In that state the tool returns:

```
已创建技能「x」。它从下一条消息起对模型可见。
```

which is false, and is now **unaccompanied by any qualifier**. Before this round the (doubly-wrong) `预算已满 / 仍可用 /skill:x 手动调用` suffix at least marked the row as anomalous; the consumer-side change deleted it without putting anything truthful in its place, and M2e asserts only the absence of the two wrong strings — never that a *true* string is present. The tool has zero positive ghost detection on its success path.

I could not construct a ghost producer against the current tree (25 adversarial descriptions + 9 exotic `content` shapes all round-tripped through the real loader with `diagnostics: []`), so this is a residual risk rather than a demonstrable live regression. It is nonetheless the phase's headline risk class, and the signal is sitting in the code unused.

**Fix:** use the third state as designed — after a successful `create` / `update`, when `promptIncluded === undefined`, append a truthful line instead of nothing:

```js
if (promptIncluded === false) {
  text += `该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:${result.name} 手动调用。`;
} else if (promptIncluded === undefined) {
  // 写成功 ⇒ 重扫已跑 ⇒ 名字仍不在技能集 ⇒ 加载管线丢弃了它（幽灵技能）
  text += `注意：该技能已落盘但未被技能加载管线接受（当前不在技能集里），`
    + `多半无法被自动匹配或 /skill:${result.name} 调用。请检查描述与正文是否合规后重试。`;
}
```

and assert the positive text in M2e (the current M2e only asserts two absences, so it would pass with the string also missing entirely).

---

### WR-07: Live and reload `manageSkill` key sets diverge whenever the tool never executed

**File:** `ai-manager.js:1800-1813` (`_resolveManageSkillTerminal`) vs `:1836-1855` (`_manageSkillTerminalFromStored`); contract asserted at `tests/test-ai-skills.js:3817-3822`, `:4066-4068`; normative claim in `49-UI-SPEC.md` 硬约束 3 / `docs/product/ai-skills.md` §11.7

**Issue:** Both chains are claimed to produce "键集合逐字相等" (`{action, name, tier?, code?, promptIncluded?}`). They do not agree on one reachable class of call: a `manage_skill` call the SDK rejects **before** invoking the tool (`prepareToolCall` argument-schema validation) or never runs at all (output-token-limit truncated arguments).

The SDK emits `tool_execution_start` **before** validation (`agent-loop.js:299-305`, `:335-341`), so the renderer does create the card with the start marker, but no `_manageSkillMeta` entry is ever written. Then:

- live: `_resolveManageSkillTerminal` → `null` (`ai-manager.js:1802`) → renderer keeps the start marker unchanged → **`{action, name}`**, no `tier`
- reload: `_manageSkillTerminalFromStored` derives `tier` from the *current* skill set by `params.name` (`:1849-1853`) → decoration carries `tier` → **`{action, name, tier}`**

Verified by driving the real functions with the real arm/terminal shapes:

```
live   = {"action":"create","name":"demo"}                  terminal = null
reload = {"action":"create","name":"demo","tier":"managed"} terminal = {"tier":"managed"}
keys equal? false
```

Consequence: a failed `manage_skill` card shows no tier badge while you are in the conversation, and **gains one** when you reopen the conversation — a visible live/reload asymmetry in the phase's own "两条链路产出同一形状" invariant. This is pre-existing (it is about how `tier` is sourced on the reload side), not introduced by this round, but it is the invariant the `WR-02` closure cites as its justification, and no test covers the never-executed class (M2d/M5c both pre-populate `_manageSkillMeta`, the live path's easy case).

**Fix (either):** (a) make the live path fall back to the same derivation, i.e. in `_resolveManageSkillTerminal`, when the meta entry is missing, derive `{tier: tierOf(params.name)}` from the `tool_execution_start` args — mirroring `_manageSkillTerminalFromStored`'s fallback exactly; or (b) treat `tier` as live-only decoration (it is a property of *this run's* target, and the reload path's "current set" lookup is admittedly a re-derivation), and narrow the M5b/M5c assertions so they no longer claim byte-identical key sets for rows with no terminal metadata. Option (a) is preferable — it makes the claim true.

---

### WR-08: The `[code]` affix's encode predicate is looser than its decode predicate — the "白名单原因码" invariant is documentation-only

**File:** `ai-manager.js:6317-6320` (encode) vs `:161` + `:1847-1848` (decode); invariant stated in `AGENTS.md:273` (不变式 ③) and `docs/product/ai-skills.md` §11.3

**Issue:** The write side accepts **any non-empty string** as a code:

```js
if (err instanceof Error && typeof err.code === 'string' && err.code
  && !MANAGE_SKILL_CODE_TAG.test(err.message)) {
  err.message = `[${err.code}] ${err.message}`;
}
```

The read side only ever decodes `/^\[([a-z_]+)\]\s/` (lowercase letters + underscore). The two predicates are therefore not each other's inverse, which contradicts both the JSDoc (`:153-154`: "词表域 `[a-z_]+` 与九码…的字符集一致") and the two normative documents ("词缀只含白名单原因码"). Two consequences:

1. **Permanent visible noise with no payoff.** Any error carrying a non-conforming `code` inside the `try` block (`syncAgentSystemPrompt()` throwing a Node error ⇒ `ENOENT`/`EACCES`; any future caller that sets a `SCREAMING_SNAKE` or namespaced code) gets an affix that the reload path can never decode. The affix is then permanently in the LLM-facing `toolResult` text and the user-facing expanded error, decodes to no short reason, and buys nothing.
2. **Malformed-affix path.** A `code` containing `]`, a space or a newline (the guard checks none of these) produces e.g. `[a] [b] msg` — precisely the artefact the neighbouring comment (`:6308-6310`) says must not be producible, and `MANAGE_SKILL_CODE_TAG.test()` would then treat the doubly-affixed message as already-tagged, so the mis-form survives.

Reachability today is narrow (every throw inside the block either goes through `makeManageSkillError` with one of the ten whitelisted codes or comes from Node with an uppercase code), which is why this is a Warning and not a Critical — but the invariant is stated as enforced in three places and is enforced in none.

**Fix:** make the encode predicate the decode predicate's inverse:

```js
if (err instanceof Error
  && typeof err.code === 'string'
  && /^[a-z_]+$/.test(err.code)          // 与 MANAGE_SKILL_CODE_TAG 的捕获域一致
  && !MANAGE_SKILL_CODE_TAG.test(err.message)) {
  err.message = `[${err.code}] ${err.message}`;
}
```

and extend M2c's existing "非字符串 code 不得加词缀" case with a non-conforming-string case (`{code: 'ENOENT'}` → message unchanged).

---

## Info

### IN-07: `oversize`'s card annotation now says 正文超限 for a rejection that is not about the body

**File:** `src/skill-picker-model.js:391` (`oversize: '正文超限'`) vs `ai-skills-manager.js:1231-1248`
`WR-01`'s closure moved the authoritative gate from "content bytes" to "assembled `SKILL.md` bytes". The rejection code stayed `oversize`, so a create that is rejected because *description* pushed the whole file over 64 KiB renders the header annotation 正文超限 while the expanded reason reads `技能文件超过上限：限额 65536 字节，当前 … 字节（按 frontmatter + 正文的整文件计）`. The two texts on one card contradict each other. Same family as the still-open `IN-03` (`invalid_description` used for empty content), so it inherits that tradeoff — but it is newly reachable because of this round's change. Either widen the short reason (e.g. `文件超限`) or state in the UI-SPEC copy table that `oversize` covers the whole file.

### IN-08: `ai-manager.js:159` cites a source gate that does not exist

**File:** `ai-manager.js:156-161`
The `MANAGE_SKILL_CODE_TAG` JSDoc asserts "写入侧与解析侧**必须逐字引用这一个标识符**（源码门禁按此断言），另起名字会让门禁转红". There is no such gate: `MANAGE_SKILL_CODE_TAG` occurs zero times under `tests/`. M2c deliberately defines its own `CODE_TAG_RE` (documented, and a *better* behavioural guard), so nothing enforces the single-constant rule. Also note the mutable-regex hazard the same comment warns about (`/g` + `lastIndex`) is currently avoided only because the constant has no `/g` — a future edit adding `/g` for a different reason would silently break both `.test()` and `.exec()`. Either delete the "源码门禁" claim or add the assertion (e.g. count references to the identifier from both the encode site and the decode site).

### IN-09: M2d/M5c hand-build the persisted row — the encode → store → decode join has no guard

**File:** `tests/test-ai-skills.js:3764` and `:4053` (`error: '[seeded_protected] …'`)
The `WR-02` fixtures construct the persisted `toolExecution` row by hand, which is the "assert against the object the implementation is supposed to produce" pattern this phase flags. The two *halves* are covered behaviourally (M2c drives the real tool failure exit; M2d/M5c drive the real `_manageSkillTerminalFromStored`), but the **join** — that the affixed message actually survives SDK → `toolResult.content` → the `messages.content` column → `target.error` on reload — is untested. I traced it and it holds (`agent-loop.js:509-524` builds the error result from `error.message`; `ai-conversations-manager.js:633-639` sets `target.error = text` for `isError` rows, and `parseStoredContent` returns the raw column text at `:311-315`), and the affix sits at the message start so the 100 KiB `TOOL_RESULT_TRUNCATE_SIZE` prefix-truncation cannot strip it. Recorded so the closure's evidence chain is honest about which link is manual.

---

## Closure verification & traceability

**Closed this round (verified real, mutation-tested):** `CR-01`, `CR-02`, `CR-03`, `WR-01`, `WR-02` (all in the `49-REVIEW.md` namespace).

**Still open, declared out of scope, and confirmed still present in the tree (not re-counted as findings above):**

| item | evidence it is still open |
|---|---|
| `WR-03` success copy vs UI-SPEC | `ai-manager.js:6290-6293` still emits `它从下一条消息起对模型可见。`; the suite still carries both wordings (`tests/test-ai-skills.js:3776` implementation vs `:3997` spec) |
| `WR-04` bidi/format controls not stripped | `ai-skills-manager.js:1153` still stops at `\u200D \u2060 \uFEFF`; probe: description `a\u202Eb` round-trips with the RLO intact |
| `IN-01` dead `madeDir` | `ai-skills-manager.js:1500` `const madeDir = true;` unchanged |
| `IN-02` `unknown` has no short reason | `src/skill-picker-model.js:383-393` — nine keys only |
| `IN-03` empty content labelled `invalid_description` | `ai-skills-manager.js:1117-1119` unchanged |
| `IN-04` `MANAGE_SKILL_ACTION_NAME` value-domain test | still absent from `tests/test-skill-picker-model.js` (grep: zero occurrences) |
| `IN-05` `_manageSkillMeta` reclaimed only by the end event | `ai-manager.js:756` / `:1803` unchanged |
| `IN-06` card shows raw description, file carries sanitized | `src/renderer.js:9717-9719` unchanged |

**Not conflated:** Phase 48's `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06` are a different namespace and were not evaluated here; `docs/product/ai-skills.md` §11.8 now namespaces them correctly, which resolves the one place the two `WR-01`/`WR-02` pairs could be misread.

**Ledger accuracy:** the three example counts (`55` / `177` / `105`) match the suites' measured `# tests` in all eight ledger cells, and the `§11.8` parity command is falsifiable. The gap-closure list in `§11.8` and the four invariants in `AGENTS.md` match the code — except for invariant ③'s "只含白名单原因码" clause (see WR-08) and the non-existent gate cited at `ai-manager.js:159` (IN-08).

---

## Round 4 (49-07 / G-49-3 收口)

**Reviewed:** 2026-09-13T14:39:43Z
**Scope:** `git diff a52f09d..HEAD` 中在册的 8 个文件 —— `49-07` 的唯一目标是把 `manage_skill` 卡片头部的超预算标注从面板长串改成单源投影的 3 字短形态，使 280px 面板最小宽度下「徽标 + 标注」不再越界裁切。
**判决:** **收口本身是真的**（红轮证据真实存在、红→绿可复现、`main.css` 确实只动了注释、例数账本与 §11.8 判据仍然可跑）；本轮的问题**全部落在新判据的承重能力上** —— 两条「双判据」中有一条在仓内根本不存在，另一条的基准活在 `/tmp`；而真实渲染门禁的 A1–A6 是**单向**判据，标注从布局里消失时它会全绿。

### 本轮增量（逐条独立复核为真）

| 声明 | 我的复核手段 | 结果 |
|---|---|---|
| 渲染端改取 `PROMPT_OMITTED_CARD_NOTE` | `git diff`：只改了 `noteText =` 一行 + 注释；挂载结构仍是单 `createElement` / `textContent` / 单 `appendChild`（`src/renderer.js:9662-9667`） | ✅ 真 |
| 该常量是面板串第二段的机械投影 | 读 `src/skill-picker-model.js:269`；值域用例（`includes` + `split(' · ').pop()`）实跑通过 | ✅ 真 |
| `main.css` **声明零改动** | **独立复算**（不依赖驱动的 sha 台账）：`git show a52f09d:src/styles/main.css` 与 HEAD 各自剥注释后 sha256 **都是** `69899a4f2a42c56aa5b102ee828ab49ccaf6ca9b23032674759b6a88d7a293db`，原文本不等 ⇒ 只动了注释 | ✅ 真 |
| 280px 下的溢出曾真实存在（G-49-3 不是编造） | 读 `/tmp/uat49/g49-3-red.log`：A1 越界 11.84px、A2 祖先 148 > 136、A3 技能名 `clientWidth = 0`、A6 仍是长串；四档几何量齐全 | ✅ 真 |
| 修复后 A1–A9 全绿 | 读 `/tmp/uat49/g49-3-green.log` + `evidence-g49-3.json`：A1 越界 0.00px、A2 136 ≤ 136、A3 = 54、A6 = `超预算`、`arithmetic.fits = true`，且 `errorNoteCovered = true` | ✅ 真 |
| 红轮 `cssDeclProjection.red` 不是伪造的 | 该 sha 与我独立复算的**修复前**投影 sha 逐字相等（见上） | ✅ 真 |
| 例数账本（111 / 177 / 55） | 现场跑三个套件：`111 / 177 / 55`；§11.8 的 `counts-parity` 判据输出 `counts-parity ok cells=8 measured={"test-manage-skill.js":"55","test-ai-skills.js":"177","test-skill-picker-model.js":"111"}` | ✅ 真 |
| `48 D-12` 原文与另三键冻结 | 新用例逐字断言；`未进提示词 · 超预算` 未动 | ✅ 真 |
| 驱动选择器 / 前置自检有效 | `src/index.html` 有 `#aiPanel`/`#aiPanelBtn`/`#aiPanelResizeHandle`/`#aiHistoryBtn`/`#aiConvDropdown`/`#aiConvList`/`#aiMessageList`；`E-DATA` 判负即 `exit 12`（fail-closed，**不**在缺前提的树上判绿） | ✅ 真（设计正确） |

### 注入 → 守卫矩阵（本轮问题的集中面）

按「注入一处具体缺陷」逐条跑**本轮的**判据。判据表达式逐字取自源码，在内存中的变异文本上求值（**未改动工作区任何文件**；旧版本文本经 `git show a52f09d:…` 取得）：

| 注入 | 判据 | 结果 |
|---|---|---|
| `skill-picker-model.js` 把常量写成 `'超预算'` 字面量 | `test-skill-picker-model.js:1011`（引用形式）+ `:1015-1016`（零第二份字面量） | **转红** ✅ 可失败性成立 |
| 渲染端回落到旧**长串** | `test-ai-skills.js:4173`（M10）在 `a52f09d` 的旧文本上实跑 | **转红** ✅ |
| 渲染端写死 `'超预算'`，**且**同行留一句提及常量名的注释 | 同上 M10（`stripComments(branch)` 之后） | **全绿** ❌ → `WR-11` |
| `skill-picker-model.js` 写死拼接 `'超' + '预算'`（仅此一项） | `:1011` / `:1015-1016` | **转红** ✅（正则是承重的） |
| 同上，**且**用一行注释承载所要求的书写形式 | `:1011` / `:1015-1016` | **全绿** ❌ → `IN-10` |
| `.tool-card-manage-note` 加 `max-width: 60px` | M14（`test-ai-skills.js:4233-4248`）/ M15（`:4250-4264`） | **全绿** ❌（与 `49-07-PLAN.md` 的记载一致） |
| 同上 | A9（声明投影 sha） | 有 `/tmp` 基准时**转红**；基准缺失（新机器 / `/tmp` 被清 / 证据文件被删）时**恒真** ❌ → `WR-09` |
| 同上 | `css-decl-freeze` | 能拦住（我在当前树上复跑该片段通过），但**该判据不在仓内** —— 只存在于 `49-07-PLAN.md:161-190` 的 `<verify>` ❌ → `WR-09` |
| `.tool-card-manage-note { display: none }`（标注从布局里消失） | A1–A6（几何 + textContent） | **全绿** ❌ → `WR-10`（A3 反而更绿：技能名宽度 98） |

### WR-09: `A9` 的红轮基准只活在 `/tmp`，缺失即恒真；第二条判据（`css-decl-freeze`）不在仓内 —— 「CSS 声明零改动」至今没有可重跑的判据

**File:** `tests/uat-49-g49-3-panel-layout.js:274-287`（基准获取）、`:628-634`（A9 判定）；`:33-36`（docstring 的「能检出任意位置的声明改动」）；第二条判据唯一出现处 `.planning/phases/49-manage-skill-ai/49-07-PLAN.md:161-190`

**Issue:** A9 的语义是「全轮 `cssDeclProjection` 的 sha 彼此相等」。而 `sha[0]`（`red` 记录）的取值有两条路径（`:284-287`）：

```js
const priorRed = prior ? (prior.cssDeclProjection.find(e => e.round === 'red') || null) : null;
const shaAtStart = cssDeclProjectionSha();
const redRecord = priorRed
  ? { round: 'red', sha: priorRed.sha, note: 'carried forward from the pre-fix run（红轮，改源码之前）' }
  : { round: 'red', sha: shaAtStart, note: '本次运行的起始投影（首次运行 = 未修复的当前树）' };
```

`prior` 来自 `/tmp/uat49/evidence-g49-3.json`。**该文件不存在时，`redRecord.sha` 就是本次运行开始时把同一个文件算出来的 sha，于是各轮与之比较必然相等 —— A9 与 CSS 内容完全无关，恒真。** 我在内存变异（给标注加 `max-width: 60px`）上实测的两种口径：

```
A9 有 /tmp 基准：            FAIL（拦住）
A9 无基准（新机器/CI/清理后）： PASS  <== 恒真，与 CSS 内容无关
```

同时 `priorRed` 一旦存在就**永不更新**（只搬运旧 `red.sha`），因此任何**合法的**声明改动都会让 A9 永久转红，而唯一自然的处置就是删掉那个 `/tmp` 文件 —— 一删 A9 又回到恒真。docstring（`:33-36`）称 A9「**能检出任意位置的声明改动**」，这句话只在 `/tmp` 状态存活时成立，而它的落盘位置（`/tmp`）与信度不匹配；`49-UI-SPEC.md:695` 与 `49-07-SUMMARY.md:158` 都以「A9 + `css-decl-freeze` 双判据、`max-width: 60px` 实测双红」作为 G-49-3 的收口证据，但 `css-decl-freeze` **从未进入仓库**：`grep -rn css-decl-freeze` 只命中驱动 docstring、`STATE.md`、`49-07-PLAN.md`、`49-UI-SPEC.md`、`49-07-SUMMARY.md` —— 全是**散文**，没有一处是可执行断言；`grep -rn 69899a4f` 同理只命中 `49-07-SUMMARY.md:112` 的散文。于是「声明零改动」这条被写进 `<done>`、写进 T-49-07-03 的 mitigation、写进两份文档的约束，**在仓内没有任何可重跑的判据承担**（M14/M15 对它全绿，已实测）。

**Fix（两条，建议都做）：**

1. 驱动自带冻结基准，去掉 `/tmp` 依赖（我已独立验算该 sha 就是修复前树的投影，可安全入源码）：

```js
/** 修复前（a52f09d）的声明投影 sha —— 冻在源码里：不依赖 /tmp 证据文件，缺基准不再退化为恒真 */
const FROZEN_DECL_SHA = '69899a4f2a42c56aa5b102ee828ab49ccaf6ca9b23032674759b6a88d7a293db';
...
assertions.A9 = {
  pass: shas.every((s) => s === FROZEN_DECL_SHA),
  detail: `声明投影 sha 必须全等于冻结值 ${FROZEN_DECL_SHA.slice(0, 12)}：${shas.join(' ')}`,
};
```

（同时删除 `:274-287` 的 `priorRed` 搬运块，并让 `evidence.cssDeclProjection` 只记本次各轮值。）

2. 把 `49-07-PLAN.md` 的 `css-decl-freeze` 落成一个**提交进仓**的判据（例如 `tests/test-49-css-decl-freeze.js`，或在 `tests/test-ai-skills.js` 的 M14 旁补一组「四规则块声明集逐字相等」断言）。我在当前树上复跑该片段，四块声明集为

```
note:     flex-shrink,font-size,font-weight,line-height,white-space
-error:   color
-limit:   color
nameText: font-family,min-width,overflow,text-overflow,white-space
```

判据本身是健全的（对 `max-width: 60px` 转红），缺的只是「它是一件随包/随仓的产物」。补完后把该判据同时登记进 `AGENTS.md:267` 的测试行与 `docs/product/ai-skills.md` §11.8 的清单，使它可被发现。

### WR-10: 真实渲染门禁 A1–A6 全是「不越界」单向判据 —— 标注被 `display:none` 从布局里移除时 A1–A9 全绿

**File:** `tests/uat-49-g49-3-panel-layout.js:575-587`（A1–A3）、`:604-609`（A6）、`:614-627`（A8）

**Issue:** 四条几何判据都是**否命题**：A1「标注右缘 ≤ 裁切祖先右缘」、A2「祖先 `scrollWidth ≤ clientWidth`」、A3「技能名 `clientWidth > 0`」、A6「textContent 与类名正确」。它们在「标注**根本不占位**」时全部成立，且 A3 会变得更绿。用逐字照抄的表达式在合成几何量上求值（基线 = 本次绿轮实测值；变异 = 给 `.tool-card-manage-note` 加 `display: none`）：

```
基线（当前实现）: {"A1":true,"A2":true,"A3":true,"A4":true,"A5":true,"A6":true}
变异 display:none : {"A1":true,"A2":true,"A3":true,"A4":true,"A5":true,"A6":true}   ← 全绿
```

`display:none` 的元素仍被 `querySelector` 命中，因此驱动的定位逻辑（`:371-377`、`:456-467`）与前置断言 `noteCount === 1` 也照样成立 —— 门禁会**判绿**并且 `sourcePath` 走复用路径，把一张「标注消失」的卡片记成 G-49-3 已收口。叠加 `WR-09`（A9 无基准即恒真、`css-decl-freeze` 不在仓内），这条注入在**所有**本轮判据下都是绿的。A8（失败态标注）是条件性的（`:624-626` 未覆盖时 `pass:true`），因此也补不上这个洞。真·红轮证明的只是「越界消失了」，不是「标注被渲染出来且可见」。

**Fix:** 加一条**正命题**判据（`measureInPage` 里补采元素自身的可见性，`:196-243` 的返回对象一并给字段）：

```js
// measureInPage() 内补充：
const cs = getComputedStyle(note);
// ... note: { ..., rectCount: note.getClientRects().length,
//            display: cs.display, visibility: cs.visibility, color: cs.color }

assertions.A10 = {
  pass: r280.note.rectCount === 1
    && r280.note.rect.width > 0 && r280.note.rect.height > 0
    && r280.note.display !== 'none' && r280.note.visibility !== 'hidden'
    && r280.note.rect.left >= r280.nameWrap.rect.left - EPS
    && r280.note.rect.right >= r280.nameWrap.rect.left,
  detail: `标注必须真的被渲染且落在裁切祖先内：rects=${r280.note.rectCount} `
    + `w=${r280.note.rect.width.toFixed(2)} display=${r280.note.display} visibility=${r280.note.visibility}`,
};
```

顺带把 A8 的 `covered: false` 从「静默通过」改成显式记录 + 输出醒目告警（或在 `E-DATA` 同款意义上作为非零退出的可选项），因为 `docs/product/ai-skills.md:529` 的诚实边界是以「是否覆盖」为陈述对象的（见 `IN-11`）。

### WR-11: M10 的新判据只对「整行注释」免疫 —— 行尾注释仍能满足它（本轮正是为消除这一形态才改的）

**File:** `tests/test-ai-skills.js:4160-4180`（M10）；`stripComments` 定义在 `:3548-3550`

**Issue:** 本轮的改动理由写在用例注释里（`:4163-4166`）：「本分支区域内有一条**提及**新常量名的注释，裸 `branch.includes(...)` 会被那段散文满足 —— 关于代码的判断不得被同区域散文满足」。为此把判据对象换成 `stripComments(branch)`。但 `stripComments` 只剥 `/* … */` 与**整行** `//`（`/^\s*\/\/.*$/gm`），**行尾注释不在其列**；而新判据是正则

```js
/noteText\s*=\s*window\.SkillPickerModel\.PROMPT_OMITTED_CARD_NOTE\b/.test(code)
```

它能被行尾散文满足，也不需要 `readSource` 另外做什么。实测（同一段真实分支文本，仅替换那条赋值）：

```
A. 修复前（a52f09d）的渲染端分支          RED   ← 判据可失败性成立
B. 当前树                                 GREEN
C2. noteText = '超预算'; // noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE
                                          GREEN ← 假绿：写死第二份字面量仍未被拦下
```

剥注释后该行原样保留（`stripComments` 只删整行注释），所以「同区域散文不得满足判据」这条本轮新写下的纪律，**对行尾散文没有生效**。同类形态的第二个面：`src/skill-picker-model.js` 的字面量扫描只覆盖**该文件**（`:1009`），因此渲染端写死短串不会被它拦下，唯一拦它的是 M10 —— 而 M10 正是这里被绕开的。

**Fix:** 把判据从「正则能匹配到某个赋值」改成「**所有** `noteText` 赋值都不得含字符串字面量」（形态判据，不依赖注释剥离策略，也不会被行尾散文满足）：

```js
const assigns = [...code.matchAll(/\bnoteText\s*=\s*([^;]+);/g)].map((m) => m[1].trim());
assert.ok(assigns.length >= 2, `noteText 的赋值点提取口径失效（实得 ${assigns.length}）`);
assert.ok(
  assigns.filter((a) => a !== 'null').every((a) => !/['"]/.test(a)),
  'noteText 的两处取值必须来自白名单查表 / 单源常量，不得出现字符串字面量（'
    + '写死第二份文案时，行尾注释里的常量名不再能顶替真实取值）：' + assigns.join(' | ')
);
```

（若偏好改助手，也可让 `stripComments` 额外剥行尾 `//`；但那会影响 M7/M8 的既有度量口径，上面的 `matchAll` 方案不动它们。）

---

## Round 4 · Info

### IN-10: 新源码护栏的「承重判据」半个是散文可及的

**File:** `tests/test-skill-picker-model.js:1008-1019`；被扫描文件 `src/skill-picker-model.js:246-269`

**Issue:** 该用例的两条断言里，正形式判据 `/PROMPT_OMITTED_CARD_NOTE\s*=\s*STATUS_TEXT\.promptOmitted\.split\(/` 跑在**未剥注释的整份源码**上，而 `src/skill-picker-model.js` 的 JSDoc 同时宣称「第一条的门禁正则锚在源码上」「注释里也不许写」「第二条是**承重判据**」。实测（内存变异）：

```
0. 当前树                                    两条护栏均绿
1. const X = '超预算';                       有红 ✅
2. const X = '超' + '预算';                  有红 ✅（正形式判据承重）
3. 拼接字面量 + 一行注释承载所要求的形式         两条护栏均绿 ❌
4. split(' ') 换掉分隔符（形式不变、今日同值）    两条护栏均绿
```

即：**朴素注入能被拦下**（这一点值得肯定，也不是「纸糊护栏」），但第 3 种形态（注释里写出那条引用式表达式 + 真实取值写成拼接字面量）让两条同时转绿 —— 与 `WR-11` 是同一缺陷类（散文满足代码判据），只是这里需要刻意写一行模仿式注释，故降一档记为 Info。第 4 种（换掉分隔符）说明该护栏只管**书写形式**、不管分隔符，值域由 `:1000-1004` 的 `split(' · ').pop()` 用例兜住，今日无实害，一并记录以免日后误以为分隔符也被钉死。

**Fix:** 正形式判据改跑在剥注释后的副本上（与 `WR-11` 同一处置，可共用一个小助手），或干脆删掉这条源码扫描 —— 它的可核对面（「是第二段的投影」）已由 `:993-1006` 的**值域**用例表达，而值域用例是行为判据、不可被散文满足。

### IN-11: `docs/product/ai-skills.md:529` 的「诚实边界」与已落盘证据相反

**File:** `docs/product/ai-skills.md:529`

**Issue:** 本轮新增的诚实边界写的是「真实渲染门禁**未用真实渲染**逐条覆盖它 —— 它**只覆盖超预算那条**（即本次整改的形态）」。但已落盘的证据里，失败态标注**恰好在同一次真实渲染中被覆盖了**：`/tmp/uat49/evidence-g49-3.json` 的 `errorNoteRounds[280]` 抓到的是一张真实失败卡片（`note.textContent = 描述不合法`，注意宽 56px、同行技能名 `clientWidth = 32`、状态 `失败`），`errorNoteCovered = true`，A8 对它做了「标注右缘 ≤ 裁切祖先右缘 + 祖先不溢出」的判定。所以**准确的说法**是：「门禁对失败态的覆盖是**条件性**的（找到真实失败卡片才判；找不到时 A8 自动通过并记 `covered:false`），本轮实测覆盖到九码中的一条（`描述不合法`），其余八条未覆盖」。当前的措辞把**已发生的覆盖**说成未发生，也掩盖了「条件性判据 = 覆盖率随数据集浮动」这个真正的边界。

**Fix:** 按上述准确说法改写该句，并把 `errorNoteRounds` / `errorNoteCovered` 作为引用锚点写进去（证据可查、口径可复核）。

### IN-12: 「卡片的**结果区**已承载完整语义」在默认折叠态下不成立

**File:** `docs/product/ai-skills.md:528`；`src/skill-picker-model.js:256-258`（JSDoc ② 同款措辞）；`src/styles/main.css:6235-6239`

**Issue:** 两处新文档（产品文档与常量 JSDoc）用同一条理由为短形态背书：「卡片有结果区承载完整语义（『该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:{name} 手动调用』），头部标注只是可扫读的短标签而非唯一信息载体」。我核对过那句话确实由主进程产出（`ai-manager.js:6298-6300`，且只在 `promptIncluded === false` 时追加），**但结果区默认是折叠的**：

```css
.tool-card-content { max-height: 0; overflow: hidden; }   /* main.css:6235-6239 */
.tool-card.expanded .tool-card-content { max-height: 500px; overflow-y: auto; }
```

卡片默认不展开，所以用户**不点开**时唯一可见的仍是 3 个字 `超预算`——「未进提示词」这半边语义与「仍可用 /skill:{name} 手动调用」的引导都在一次点击之后。文档的措辞（「已承载完整语义」）读起来像「无需额外操作即可获得」，与实现不符；这也是 D-12 的「可见性」初衷在本轮被部分让出的事实，值得显式写出来而不是靠结果区兜底。

**Fix（三选一，建议 ①）：** ① 给标注元素加 `title`（如「该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:{name} 手动调用」），使悬停即可得完整语义（`title` 走 `textContent` 之外的单源字符串，需注意 CSSOM 不受 CSP 限制、且不得写入 `innerHTML`）；② `promptIncluded === false` 时默认展开卡片；③ 至少在文档里把措辞改成「**展开后**结果区承载完整语义」。

### IN-13: `main.css:6196-6198` 的实测口径自相矛盾

**File:** `src/styles/main.css:6192-6198`

**Issue:** 该注释段自称「修复前的实测（非估算）—— 两轮口径并列，来源可查」，但其中两句与两份日志对不上：

1. 「两轮的**标注** `scrollWidth` 同为 **148**」—— 两轮日志里标注自身的 `scrollWidth` **都是 100**（`note=100`）；148 是**祖先** `.tool-card-name-skill` 的 `scrollWidth`（绿轮 `nameWrap=136/136`、红轮 `nameWrap=136/148`），也正是 `49-UAT.md` 那句「不可压缩内容 148px」（= 8 + 32 + 8 + 100 的簇合计）被搬过来的数。三个量级被写成同一个名字。
2. 「8 + 30 + 8 + 100 = 146 > 136，**越界 11.84px**」—— `146 - 136 = 10`，不是 11.84；11.84 是 A1 的**外接矩形**口径（红轮 A1：标注右缘 2477.08 vs 祖先右缘 2465.23），与上面这条整数算式不是同一个量（标注的 rect 宽比取整后的 `scrollWidth` 略大）。

数值本身都能在日志里查到，问题在于**把两种口径写成了一个等式**，而该段落的全部价值就是「来源可查、实测与估算分离」。同一段后文（`≈` 与「估算」标注）做得是对的，这里属漏改。

**Fix:** 改成「两轮的**标注** `scrollWidth` 同为 100；**祖先**的 `scrollWidth` 同为 148（即不可压缩簇 8 + 32 + 8 + 100 的合计值，与 49-UAT.md 的几何表同源）」，越界值改写为「A1 的外接矩形口径实测 11.84px（标注右缘 2477.08 − 祖先右缘 2465.23，`/tmp/uat49/g49-3-red.log`）」，与整数算式各自标明口径。

---

## Round 4 · 复核后的挂账状态

**本轮（49-07 / G-49-3）闭合的是**：`manage_skill` 卡片头部的超预算标注在 280px 面板最小宽度下不再被祖先裁切，且卡片的默认可见高度、徽标、技能名退化行为均回到契约（真实渲染 A1–A9 全绿，`arithmetic.fits = true`），而 48 的 `/` 面板长串逐字未动。这条**是真的**。

**本轮新挂账（7 条，编号避开既有 ID）**：`WR-09`（A9 基准活在 `/tmp` + `css-decl-freeze` 不在仓内 ⇒ 「声明零改动」无可重跑判据）、`WR-10`（A1–A6 单向判据 ⇒ 标注消失也全绿）、`WR-11`（M10 只对整行注释免疫 ⇒ 行尾注释仍可满足）、`IN-10`（`skill-picker-model` 正形式判据可被注释满足）、`IN-11`（诚实边界与已落盘证据相反）、`IN-12`（结果区默认折叠 ⇒ 短标签成了唯一常驻信息载体）、`IN-13`（`main.css` 注释里两种口径被写成一个等式）。

**仍未复核、仍按上一轮挂账**：`WR-03`（成功文案 vs UI-SPEC）、`WR-04`（bidi 控制符未剥离）、`IN-01`–`IN-06`、以及 Phase 48 命名空间的 `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06` —— 这些文件的当前内容未被本轮扫描（不在 `files_reviewed_list` 内），其「仍开放」的判断继承自上一轮，本轮**未重新验证**。

**非本轮新增、但本轮证据暴露的一处结构性事实**：本阶段真正的「唯一有效证据」是 `/tmp` 下的三个文件（`g49-3-red.log` / `g49-3-green.log` / `evidence-g49-3.json`）与一条不在仓内的 `node -e` 片段。`/tmp` 不是证据保存地、计划内联门禁也不是产物；凡是「验收依赖 /tmp 或依赖计划文本」的判据，在下一轮复核时都应视为**未保存证据**。这与本仓既有的两条教训同源（`feedback_false_green_guards`：门禁假绿；`feedback_plan_authored_gates`：计划自带门禁必须先落到当前树实跑）。

---

_Reviewed: 2026-09-13T14:39:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 4（`a52f09d..HEAD`，49-07 / G-49-3 收口）· 累计 findings: critical 0 / warning 7 / info 7 / total 14_

---

## Round 5（49-08 / UI-49-W6-01 收口）

**Reviewed:** 2026-09-13T16:52:00Z
**Scope:** `git diff 38d4872..HEAD` 在册的 6 个文件（`AGENTS.md` / `docs/product/ai-skills.md` / `src/renderer.js` / `src/styles/main.css` / `tests/test-ai-skills.js` / `tests/uat-49-g49-4-card-a11y-tab-order.js`）。本轮唯一目标是闭合 `49-UI-REVIEW.md` 的 BLOCKER `UI-49-W6-01` —— 折叠的 `manage_skill` 卡片上那个「零可见高度、可 Tab 到达却看不见」的键盘停靠点。
**判决:** **收口本身是真的**（我逐条独立复核了源码、证据 JSON 与可重跑的账本判据；`{ interactive: false }` 确实落在**真实**渲染路径上，a11y 回归也**真的消失而非搬了位置** —— `.tool-card-content` 内不存在任何其它可聚焦元素）。本轮的问题**全部落在新门禁的承重能力上**：绿轮那条自称「承重判据」的 `R3` 在**空集**上为真（证据 JSON 自己记着 `inCardCount = 0`），而 docstring 声称用来排除这种空真的 `R1` **根本不判卡片域**；整套断言又全是「没有不可见停靠点」这一**否命题**，把折叠块从布局里拿掉也能全绿。此外新增的 `M9b` 是纯源码形态扫描 —— 我用**逐字复制**的判据在内存变异文本上实测了三种形态等价的回归，**全部全绿**。

### 本轮增量（逐条独立复核）

| 声明 | 我的复核手段（不依赖本轮自带结论） | 结果 |
|---|---|---|
| `renderSkillContentBox` 增加语境开关（缺省 `true`；三条属性与 `keydown` 受 `if (interactive)` 守卫；`toggleCollapsed` 的 `aria-expanded` 同步同守卫） | 直读 `src/renderer.js:8952-9002`（守卫在 `:8959-8963`、`:8969-8971`、`:8986-8993`）；全仓 `setAttribute('tabindex')` **仅 1 处**（`:8961`，在守卫内）、`setAttribute('role')` 2 处（`:695` 的 tab、`:8960` 在守卫内） | ✅ 真 |
| `{ interactive: false }` 落在**真实**卡片渲染路径（不是测试态路径） | `renderToolCard` 是实时（`renderToolCards` → `:10100`）与重载（`:8087`）的**唯一**卡片构建入口，`:9765` 在该函数内；证据 JSON 绿轮 `R5` 实测折叠/展开**两态**的 `tabindex` / `role` / `aria-expanded` **均为 `null`** | ✅ 真 |
| a11y 回归**真的消失，而非搬到别的祖先** | 全仓 `ai-skill-content-box*` 只在 `renderSkillContentBox` 一处构建、只在 CSS 一处定义（`:5827-5890`、`:6232-6237`），无外部补加路径；绿轮 80 站 Tab 遍历中 `inToolCard = true` 命中 **0 站** | ✅ 真（但见 `WR-12`：这条「消失」在绿轮是**空集真**） |
| 气泡实例的 48 Pillar 6 增量原位保留 | 气泡调用点 `:9093` 仍为 `renderSkillContentBox(msg.skillInvocation)`（不传选项 ⇒ 缺省 `true`）；驱动 `R4` 用**真实 `Enter`** 切换成功（`aria-expanded: false→true`、`collapsed→展开`） | ✅ 真 |
| `src/styles/main.css` **只改注释** | **独立复算**（不采信任何自带 sha）：剥块注释后两侧非注释行 8373 行**逐字相等**；声明投影 sha256 在 `a52f09d` / `38d4872` / HEAD 三处**同为** `69899a4f2a42c56aa5b102ee828ab49ccaf6ca9b23032674759b6a88d7a293db` | ✅ 真 |
| 例数账本 8 单元 = 178 / 55 / 111 | 现场跑三个套件：`178 / 55 / 111`；§11.8 的 `counts-parity` 命令输出 `counts-parity ok cells=8 measured={"test-manage-skill.js":"55","test-ai-skills.js":"178","test-skill-picker-model.js":"111"}` | ✅ 真 |
| 红→绿两轮证据存在且自洽 | 读 `/tmp/uat49/evidence-g49-4.json`：`runs = red(exit 1 · inCard 2 / 违反 2 · R5 tabindex '0') + green(exit 0 · inCard 0 / 违反 0)`；红轮的属性值只有**未修复树**才可能产生 ⇒ 该轮确实跑在预修复态 | ✅ 真（但配对本身落在 `/tmp`，见 `IN-16`） |
| `docs` / `AGENTS.md` 的口径限定与账本刷新 | `docs/product/ai-skills.md:531`（§11.7 新条目）、`:98` / `:539-540`（178 / 55 / 111）；`AGENTS.md:267-276` 测试行 | ✅ 与实现一致 |
| **副作用（本轮未声明但已闭合）**：`WR-11` 的逃逸形态被 `stripComments` 扩展顺手堵住 | 逐字复制 `rendererManageRegions().branch` 与 M10 的常量判据，在内存变异上求值：`noteText = '超预算'; // noteText = window.SkillPickerModel.PROMPT_OMITTED_CARD_NOTE` ⇒ **新 `stripComments` 判红（旧版判绿）** | ✅ 真（机制已闭合，建议在账本里登记） |

### 注入 → 判据矩阵（本轮门禁的承重面）

| 注入 | 判据 | 结果 |
|---|---|---|
| 卡片调用点去掉 `{ interactive: false }`（= 红轮/未修复树） | `R3`（收紧后的 `hit === el \|\| el.contains(hit)`） | **转红** ✅ 可失败性成立（`hitIsAncestorOfEl = true`，命中承载裁切的 `.ai-message-ai`） |
| 同上 | 绿轮 `R3`（`inCardCount = 0`） | **绿 —— 空集真** ❌ → `WR-12` |
| 折叠块被 `display: none` 从布局里移除（`.tool-card-content .ai-skill-content-box`） | `P1`/`P2`（容器仍 0 高）+ `R3`（无停靠点 ⇒ 空集真）+ `R5`（属性仍 `null` ⇒ 绿）+ `R4`（气泡不受影响） | **全绿** ❌ → `WR-12` |
| `M9b`：函数内加一行 `interactive = true;`（形态全不变，行为完全退回修复前） | `M9b` ①–⑧（逐字复制） | **全绿** ❌ → `IN-14` |
| `M9b`：三条属性移到一处紧凑的 `if (interactive) { … }` 之后（无条件下施加） | 同上 | **全绿** ❌ → `IN-14` |
| `M9b`：卡片调用点之后另有 `manageContentBox.querySelector('…').setAttribute('tabindex','0')` | 同上（⑧ 只禁 `removeAttribute` / `deleteAttribute`） | **全绿** ❌ → `IN-14` |
| `M9b`：三条属性整体移出守卫 | 同上 | **转红** ✅（③ 对 `role` / `tabindex` 承重；对 `aria-expanded` 被 `toggleCollapsed` 的同类调用满足，见 `IN-14`） |
| `M9b`：卡片调用点不传选项 / 新增第三个调用点 | 同上 | **转红** ✅（⑤ / ⑦） |
| `M10`：写死 `'超预算'` 字面量 + 行尾注释承载常量名 | M10 常量判据（新 `stripComments`） | **转红** ✅（`WR-11` 机制已闭合） |

### WR-12: 新驱动的「承重判据」在绿轮是**空集真**，且整套断言只有否命题 —— 折叠块被 `display:none` 移出布局时全绿

**File:** `tests/uat-49-g49-4-card-a11y-tab-order.js:44-50`（docstring 的「断言非恒真的自证」）、`:662-672`（`R1`/`R2`）、`:674-720`（`R3`）、`:722-758`（`R5`）、`:89`（`TAB_STOPS`）

**Issue:** 驱动自己在 docstring 里点名了这条失败模式 ——

```
 * 绿轮可能**空真**（卡片内零停靠点 ⇒ 「凡卡片内停靠点都可见」是空集真）。故：
 *   ① `R1` 断言遍历本身有效（停靠点总数 ≥ 20 且至少一站非 `BODY`）；
```

而 `R1` 的判据是 **`tabStops.length >= 20 && nonBody.length >= 1`** —— 两个数都是**全文档**口径，与「卡片域是否有停靠点」正交。`R2` 更是 `P1 && P2` 的重复（前提断言），同样不涉及卡片域。于是：

1. **本轮绿轮实测就踩在了这条失败模式上。** `/tmp/uat49/evidence-g49-4.json` 的绿轮 `r3Detail` 是 `{"inCardCount":0,"violationCount":0}`、`R1` 却是 `PASS`（`停靠点总数 80 · 非 body/html 站数 80`）、退出码 **0** 并打印 `ALL ASSERTIONS PASS`。我另查了该轮 `tabStops`：`inToolCard === true` **0 站**、`isContentBoxHeader === true` **0 站**（80 站实际只覆盖 21 种唯一元素签名，`tab-close` 一项就占 16 站 —— 即遍历**已在同一个环上跑了约两遍**）。也就是说：绿轮那条「承重判据」判定的是一个**空集**，它对「卡片内不存在不可见停靠点」这句话**没有提供任何证据**；实质证据来自 `R5`（真实渲染下三属性为 `null`）与红轮的配对。`49-08-SUMMARY.md` 的 `patterns-established` 把它写成「用 R1/R2 排除『遍历没跑起来』的空真」，与代码不符。
2. **全套断言只有否命题，没有一条「折叠块确实被渲染」的正命题。** 逐条看：`R3` = 「卡片内停靠点都可见」（无停靠点即成立）、`R5` = 「三属性为 `null`」（元素消失也成立）、`P2` = 「`.tool-card-content` 高 0」（与折叠块无关）、`R4` = 气泡侧。因此注入 `.tool-card-content .ai-skill-content-box { display: none }`（或任何让折叠块脱离布局的等价改动）时：`querySelector` 仍能命中 header ⇒ 前置 `E-DATA` / `targetProbe` 照常通过；`display:none` 的元素不进 Tab 序 ⇒ `inCardCount` 仍为 0、`R3` 仍绿；三属性仍为 `null` ⇒ `R5` 仍绿；`R5` 的 `expandedOk` 只看 `.tool-card-content` 的 `max-height` ⇒ 仍绿。**「技能正文折叠块消失了」这一整类回归在全部 8 条断言下是绿的。** 这与上一轮 `WR-10`（`uat-49-g49-3` 的 A1–A6 单向判据）是**同一缺陷类**，只是这次落在新文件、且恰好落在这条 BLOCKER 的闭环判据上。（这一条我是**由源码直读判定**的：`querySelector` 命中 `display:none` 元素、以及 `display:none` 退出顺序焦点导航，都是确定性的浏览器语义，无需实跑。）
3. 附带，`R6` 绿分支的 `detail` 写作「绿轮必须为绿且 **R1/R2** 为绿」，代码只 AND 了 `R1`（`:834`）—— 自校验的**措辞**也不是承重项；另 `R3` 统计的是**遍历站数**而非唯一元素数，故红轮的「违反 2 站」实际是**同一个 header 被访问两次**（`index 33` 与 `index 76`），`inCardCount` 同理不能读作「元素个数」。

**Fix（三条，建议全做；改桩不动源码）：**

```js
// ① 正命题判据（R7）：折叠块必须真的被渲染、展开后真的可见、header 必须不是可聚焦控件
assertions.R7 = {
  pass: expandedState.boxRectH > 0 && expandedState.boxDisplay !== 'none'
    && expandedState.boxVisibility !== 'hidden'
    && expandedState.headerRole === null && expandedState.headerTabindex === null
    && /^技能正文（\d+ 字符）/.test(expandedState.headerText || ''),
  detail: '折叠块必须在展开态被真实渲染（rectH>0）且 header 不带焦点语义：'
    + `rectH=${expandedState.boxRectH} display=${expandedState.boxDisplay} headerText=${JSON.stringify(expandedState.headerText)}`,
};
// 需要在 targetProbe() 的返回对象里补采 box / header 的 rectH、display、visibility

// ② 把「空集真」显式化：R3 的 pass 之外，把 inCardCount 本身纳入判定
assertions.R3 = {
  pass: r3Violations.length === 0 && (ROUND === 'red' ? inCard.length >= 1 : true),
  detail: /* … */ + (inCard.length === 0
    ? ' · ⚠ 卡片域内零停靠点 ⇒ 本条在绿轮是**空集真**，本轮的实质证据是红轮配对 + R5/R7'
    : ''),
};
// ③ R6 的绿分支同时要求 R5 && R7（把「属性为 null」与「块被渲染」绑在一起），
//    并把 detail 里的 R1/R2 与代码对齐
```

（`R3` 的**方向无关**设计本身是对的 —— 日后卡片头部真变成可聚焦入口时命中即为自身、照样绿；问题只在绿轮的空集与缺正命题，不要把这条收紧成「卡片内不得有停靠点」。）

## Round 5 · Info

### IN-14: `M9b` 是纯源码形态扫描 —— 三种形态等价的回归实测全绿，而它是本仓唯一能自动跑的护栏

**File:** `tests/test-ai-skills.js:4168-4237`（`M9b` ①–⑧）；`tests/test-ai-skills.js:3547-3558`（本轮扩展的 `stripComments`）

**Issue:** `M9b` 的八条断言**没有一条构造被测函数**：①/⑦ 数标识符出现次数，② 匹配签名正则，③/④ 用「`if (interactive) {` 之后 200（/400）字符内须出现 `setAttribute` / `addEventListener`」这一**距离启发式**，⑤/⑥ 匹配调用点的**书写形态**，⑧ 对整份 `renderer.js` 做 `removeAttribute` / `deleteAttribute` 的负向扫描（性质是**函数局部**的，判据却是**文件全局**的）。我把这些判据逐字复制到内存变异文本上求值（未改动工作区任何文件），结果：

```
M0 当前树                                   GREEN
M1 函数内加一行 interactive = true;          GREEN  ← 行为完全退回修复前，M9b 全过
M2 三条属性整体移出守卫                       RED    （role / tabindex 转红；aria-expanded 被
                                                    toggleCollapsed 内同类调用满足而漏过）
M3 卡片调用点不传 { interactive: false }      RED    （⑤ 承重）
M4 新增第三个调用点（默认 true）               RED    （⑦ 承重）
M5 调用点之后外部补 setAttribute('tabindex')  GREEN  ← ⑧ 只禁「事后清除」，不禁「别处施加」
M6 属性置于一处紧凑 if (interactive) { … } 之后 GREEN  ← ③ 的距离启发式被满足，属性实为无条件施加
```

即：**朴素注入能被拦下**（M2/M3/M4 转红，这一点值得肯定），但**「守卫内施加」这一实质语义没有被任何一条断言钉住** —— 判据钉的是「某个 `if (interactive) {` 与其后 200 字符内的 `setAttribute`」这一**相邻形态**。当前树不存在第二种施加入口（全仓 `setAttribute('tabindex')` 仅 1 处、`role` 2 处，我已 grep 核对），因此**今日无实害**；但要知道这条护栏不承重：`package.json` 没有 `test` 脚本，`uat-` 驱动也不在 Node 默认测试发现规则的拾取范围内（我用同构的合成目录在 Node v22.22.0 上实测：`tests/uat-foo.js` 不被 `node --test` 拾取，而 `tests/test-bar.js` 被拾取 ⇒ 驱动 docstring 的这条声明为真；另注：本机 Node 22.22 下 `node --test tests/` 这种「传目录」的写法直接以 `Cannot find module` 失败），所以**能自动跑的只有 `M9b` 这一层**。

另有一处应记录的同源风险：本轮把 `stripComments` 扩成 `(^|[^:])\/\/.*$`（剥行尾注释）**确实闭合了 `WR-11`**（我实测旧版判绿、新版判红），但该正则不区分「注释」与「字符串里的 `//`」—— 未来任何一行出现 `'…//…'` 形态的字符串字面量，其**行尾代码会被静默删除**，对 `M7` / `M8` / `M10` / `M9b` 的**负向**断言（「不得出现 `JSON.stringify(...)`」这类）是假绿方向。我扫过当前 `src/renderer.js`：此类行**0 行**，故属潜在风险而非现存缺陷。

**Fix:** 把「施加受 `interactive` 守卫」从形态判据改成**行为判据**（这是本阶段反复写下的纪律：源码扫描不该承重行为）。最小成本方案是把 `renderSkillContentBox` 抽成一个**零 DOM 依赖的纯函数**（返回 `[{attr, value}]` 的属性清单）放进 `src/skill-picker-model.js`，渲染端只做 `applyAttributes(el, list)`，测试直接断言 `planHeaders(…, {interactive:false}).length === 0`；若暂不重构，至少把 ③/④ 的距离启发式换成「`interactive` 的所有使用点都必须出现在 `if/&&/?:` 的判定位置」的形态判据，并补一条「`renderer.js` 中除本函数外不得对 `.ai-skill-content-box-header` 施加 `tabindex` / `role`」（对 M5 转红）。`stripComments` 侧建议改成先剥字符串字面量再剥注释，或至少在判据里加一条「剥注释后源码长度变化 ≤ 注释总长度」的自检。

### IN-15: 两处 `49-UI-SPEC.md:508` 引用被本轮自己的插入挪成了空白行

**File:** `src/renderer.js:8946`（`（契约 49-UI-SPEC.md:508 锁定"本阶段零改动"）`）、`src/styles/main.css:5860`（`卡片头部（.tool-card-header）的展开 / 折叠沿用全仓既有的鼠标语义（契约 :508）`）

**Issue:** 本轮在 `49-UI-SPEC.md` 的 `## 卡片结构契约` 中插入了 17 行（「为什么卡片实例必须不施加」等段落），把被引用的那一行——`| 展开 / 折叠（卡片） | 既有行为：… **本阶段零改动** … |`——从 **508** 推到了 **525**。两处引用没有跟着改，现在指向一个**空行**（我在当前文件上核对：`:508` 为空行，行内容在 `:525`）。`49-08-SUMMARY.md` 说「`:508` 逐字未改」，指的是**行内容**未改（这是真的），但**行号已变**，于是引用失效。同类：`.planning/.../49-UI-SPEC.md:567` 的 E3 元素清单行仍写「header 具 `role="button"` + `aria-expanded`」（未加语境限定），与同文件 `:526` 的限定行不一致 —— 该文件不在本轮的 6 个在册文件内，故只作交叉提示，不计为本轮 finding。

**Fix:** 把两处改成不带行号的引用（如「契约 `49-UI-SPEC.md` 的『展开 / 折叠（卡片）』行」），或改指 `:525`；避免在有插入动作的同一轮里保留会漂移的行号锚点。若后续允许，给 UI-SPEC 的契约行加一个稳定锚点（如 `<!-- contract:card-fold -->`）比行号更耐用。

### IN-16: 红→绿配对只活在 `/tmp`，且驱动对本机 `realm-dev` 会话库有**数据前置** —— 新机器 / CI 上无法复建

**File:** `tests/uat-49-g49-4-card-a11y-tab-order.js:71-79`（`EVIDENCE_PATH` / `CONV_DB`）、`:141-214`（`E-DATA-DB` 硬退出）、`:226-245`（累积式证据）、`:453-460`（`mutation` 由环境变量自标）

**Issue:** 两件事合并记录：

1. **数据前置**：`E-DATA-DB` 要求 `~/Library/Application Support/realm-dev/ai-conversations.db` 里存在「既有带 `content` 的 `manage_skill` 调用、又有成功结果」的会话，否则**以退出码 12 硬退出**（fail-closed，方向安全）。这意味着目标卡片**不是驱动构造的夹具**，而是作者本机会话的偶然产物（实际用的是会话 `3dec0492…`）；新机器 / CI / 换 userData 时该门禁**根本跑不起来**，而它承载的是本轮 BLOCKER 的唯一行为证据。
2. **配对不可在仓内复建**：`G49_4_ROUND=red|green` 只是环境变量标签，`runs[]` 按标签去重覆盖；红轮需要**手工回退源码**，仓内没有任何东西表达这一状态。红轮的属性值（`tabindex === '0'`）确实只有未修复树才可能产生 ⇒ 我**不怀疑**该轮的真实性，故按 Info 而非 Warning 记；但 `/tmp` 不是证据保存地，证据被清或会话库变动后，「红→绿」这一结论无法重跑复核 —— 与 `WR-09`（A9 的红轮基准活在 `/tmp`）**同一族**，只是这次落在新驱动上。`49-08-SUMMARY.md` 的 Self-Check 也把 `/tmp/uat49/g49-4-{red,green}.log` 列为通过项，属同类依赖。

**Fix:** 让驱动**自带夹具**：启动前用 `ai-conversations-manager` 的写入 API（或直接对一份临时 userData 的 `ai-conversations.db` 播种）造一条含成功 `manage_skill` 调用 + `content` 的会话，把 `E-DATA-DB` 从「读用户数据」改成「构造数据」；红轮的基线则用 `WR-09` 建议的同款做法**冻进源码**（例如把「卡片 header 必须无焦点语义」这条的期望值写成常量，并让 `G49_4_ROUND=red` 只影响证据标签、不影响判据）。这样 `/tmp` 只承担日志，判据本身随仓可重跑。

### IN-17: §11.7 新条目写了「为什么不施加」，没写「后果」—— 卡片语境下正文折叠块**没有任何键盘路径**

**File:** `docs/product/ai-skills.md:531`（§11.7 新增条目）

**Issue:** 新条目把成因与修法讲得很完整（宿主默认零高 ⇒ 零可见高度停靠点 ⇒ 焦点环被祖先裁掉 ⇒ 故卡片实例不施加），但是**只写了「避免什么」**，没写**代价**：改动之后，卡片语境下的技能正文折叠块既无 `tabindex` 也无 `keydown`，而它的祖先 `.tool-card-content` 与卡片头部 `.tool-card-header` **同样不可聚焦**（全仓工具卡片范式），因此**键盘用户完全无法展开这张卡片去读 AI 刚写下的技能正文** —— 鼠标是唯一入口。这是 49 之前既已存在的范式（不是本轮引入的回归），也确实被 `49-UI-SPEC.md:525` 的契约锁定为「本阶段零改动」；但对**产品说明**而言，读者从新条目会得到「卡片一切照旧」的印象，而实际语义是「本已不可达的正文，现在明确承认键盘不可达」。作为产品文档的权威条目，代价应当与原因并列写出（本阶段另有两处同类做法：`allowed-tools` 不被强制、bash 白名单是启发式，均写明「不是安全边界」）。

**Fix:** 在该条目末尾补一句限定，例如：`—— 代价是卡片语境下的正文折叠块**没有键盘展开入口**（与卡片头部同为鼠标语义，全仓工具卡片的既有范式，本阶段契约锁定不变）；键盘用户要读同一段正文，走 `/skill:<name>` 的气泡实例。`

## Round 5 · 复核后的挂账状态

**本轮（49-08 / `UI-49-W6-01`）闭合的是**：折叠的 `manage_skill` 卡片上**不再存在零可见高度的键盘停靠点**（`{ interactive: false }` 落在真实路径、气泡侧增量原位保留、`main.css` 声明零改动、账本按实测刷新）。这条**是真的**，我按源码 / 证据 JSON / 独立复算三条互不依赖的路线复核过。
**顺带闭合（未声明）**：`WR-11`（`M10` 可被行尾注释满足）—— `stripComments` 扩展后我用变异实测旧绿新红；建议在 `49-VERIFICATION.md` 的 advisory 表与 `49-REVIEW.md` 的挂账清单里把它标为已闭合（本轮未改这两处措辞，故此处只作记录）。

**本轮新挂账（5 条，编号避开既有 ID）**：`WR-12`（承重判据 `R3` 绿轮空集真 + 全套只有否命题 ⇒ 折叠块被 `display:none` 移出布局时全绿）、`IN-14`（`M9b` 纯源码形态扫描，三种等价变体全绿，而它是唯一可自动跑的护栏）、`IN-15`（两处 `:508` 引用被本轮自己的插入挪成空行）、`IN-16`（红→绿配对只在 `/tmp` + `E-DATA-DB` 数据前置 ⇒ 不可移植，同 `WR-09` 一族）、`IN-17`（§11.7 只写原因不写代价）。

**仍未复核、仍按上一轮挂账**（这些文件/区域不在本轮 6 个在册文件的复核范围内，其「仍开放」继承自上一轮，本轮**未重新验证**）：`WR-03`（成功文案 vs UI-SPEC）、`WR-04`（bidi 控制符未剥离）、`WR-05`（`M3` 子串扫描）、`WR-06`（幽灵写入报无保留成功）、`WR-07`（两链路 `manageSkill` 键集合分歧）、`WR-08`（`[code]` 词缀 encode/decode 谓词不成逆）、`WR-09`（A9 基准活在 `/tmp`；A9 与 `css-decl-freeze` 至今无仓内判据 —— 本轮 `main.css` 的声明零改动我已独立复算，但**并没有**给这两条判据补上仓内落点）、`WR-10`（g49-3 的 A1–A6 单向判据）、`IN-07`–`IN-13`。其中 `WR-11` / `IN-10` 的机制面：`WR-11` 已闭合（见上），`IN-10`（`skill-picker-model` 的正形式判据可被注释满足）**未闭合** —— `tests/test-skill-picker-model.js` 本轮未改动，其判据仍跑在未剥注释的源码上。
**Phase 48 命名空间的 `TD-48-01` / `TD-48-02` / `WR-01` / `WR-02` / `WR-06`** 与相位命名空间隔离，本轮未评估。

**本轮暴露的一处结构性事实（承上轮）**：上一轮记的「本阶段真正的唯一有效证据是 `/tmp` 下的文件」在本轮**再次成立**，且这次多了一层 —— 连「能不能跑这个门禁」都取决于本机 `realm-dev` 会话库的内容（`IN-16`）。凡是「验收依赖 `/tmp`、依赖本机用户数据、或依赖计划文本」的判据，都应视为**未保存的证据**，其结论只能作为旁证，不能作为闭环判据；这也解释了为什么本轮唯一可自动重跑的那层（源码形态扫描）反而在形态等价变异下不承重（`IN-14`）。

---

_Reviewed: 2026-09-13T16:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round: 5（`38d4872..27fea24`，49-08 / UI-49-W6-01 收口）· 累计 findings: critical 0 / warning 8 / info 11 / total 19_
