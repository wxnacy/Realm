---
phase: 49-manage-skill-ai
reviewed: 2026-09-13T12:52:52Z
depth: standard
files_reviewed: 9
files_reviewed_list:
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
  warning: 4
  info: 3
  total: 7
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

_Reviewed: 2026-09-13T12:52:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
