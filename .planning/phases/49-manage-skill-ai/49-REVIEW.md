---
phase: 49-manage-skill-ai
reviewed: 2026-09-13T08:12:15Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - ai-skills-manager.js
  - ai-manager.js
  - ai-memory-manager.js
  - ai-conversations-manager.js
  - src/skill-picker-model.js
  - src/renderer.js
  - src/index.html
  - src/styles/main.css
  - tests/test-manage-skill.js
  - tests/test-ai-skills.js
  - tests/test-skill-picker-model.js
findings:
  critical: 3
  warning: 4
  info: 6
  total: 13
status: issues_found
---

# Phase 49: Code Review Report

**Reviewed:** 2026-09-13T08:12:15Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 49 delivers `manage_skill` + the AI write path in `ai-skills-manager.js` + the skill-ified card. The structural discipline the phase set out for itself is largely honoured: the tool's top-level parameter key set is exactly `{action, name, content, description}` (no `path`), path ownership is enforced by interface design, the three action functions share one validator set / one scan point / one atomic-write path, `syncAgentSystemPrompt()` is called exactly once per successful write, `ai-skills-manager.js` remains electron-free, and the closed-whitelist tables are used without `undefined` literals leaking into `class` / text.

Three defects survive, all of them in the "silent false success" family the phase explicitly targeted (T-49-01-08 ghost skills / RESEARCH Pitfall 4):

1. **CR-01** — the renderer's terminal-event branch *replaces* `manageSkill` instead of merging it, so every `manage_skill` card collapses back to the generic card the moment the tool finishes (losing the title, the tier badge, the short reason, the content box, and the params summary — falling back to a JSON dump of the full 64 KiB body). The in-repo guards (M3 source scan + M5b behaviour test) are false-green: M5b hand-builds the merged object the renderer never builds.
2. **CR-02** — `buildSkillFileText` interpolates the description into YAML without quoting/escaping. A description containing `: `, a leading `-`/`@`/`*`, or the literal `true`/`12345`/`null` produces a file the loader's YAML parse rejects (or silently truncates at `#`), while the tool still reports success. Empirically reproduced end-to-end.
3. **CR-03** — the description is validated *before* sanitization, and sanitization can empty a previously valid description (`"\u200B"` passes `trim()` validation, sanitizes to `''`) → same ghost-skill outcome, different root cause.

Note on the known deferred item (write-side 65536-byte content gate vs the loader's whole-file gate): the direction is already recorded, but the **width is wrong in the record** — see WR-01 (measured window is up to ~1.1 KB, not the recorded ~56 bytes).

---

## Critical Issues

### CR-01: Terminal-event branch replaces `manageSkill`, destroying the whole card variant

**File:** `src/renderer.js:9368-9378` (offending line `9377`); card branch at `src/renderer.js:9603-9610`

**Issue:** `tool_execution_start` delivers `manageSkill = {action, name}` and `tool_execution_end` delivers `{tier?, code?, promptIncluded?}` (see `_resolveManageSkillTerminal`, `ai-manager.js:1780-1793` — it deliberately projects *only* the three terminal keys). The renderer's "existing entry" branch then does:

```js
toolMsg.toolExecutions[existingIdx] = {
  ...toolMsg.toolExecutions[existingIdx],
  status: event.status,
  result: event.result,
  error: event.error,
  ...(event.manage_skill ? { manageSkill: event.manage_skill } : {})   // ← 替换，不是并入
};
```

`manageSkill: X` **overrides** the spread value — it does not merge into it. So after the end event the object is `{tier: 'managed', promptIncluded: false}`; `action` and `name` are gone. Consequences at that instant (i.e. for the entire visible life of a finished card):

- `MANAGE_SKILL_ACTION_LABEL[undefined]` → `undefined` → `manageLabel` falsy → `manageSkillOk === false` (`renderer.js:9606-9610`)
- title falls through to `name.textContent = toolExecution.name` → the card reads `manage_skill` (`renderer.js:9677-9679`)
- tier badge, failure short reason (`code`), and the `未进提示词 · 超预算` note never render
- the content collapsed box is not built (`renderer.js:9705-9728` gated on `manageSkillOk`)
- the params area reverts to `JSON.stringify(toolExecution.params, null, 2)` (`renderer.js:9760-9762`) — dumping the **entire `content` argument (up to 64 KiB, escaped)** as a JSON wall, which is the exact failure mode the phase's params summary exists to prevent

This directly contradicts UI-SPEC 硬约束 1 ("**必须**把标记的终态字段一并并入") and the `{action, name, tier?, code?, promptIncluded?}` data contract.

**Verified** by replaying the renderer's literal semantics against the two real event payloads:

```
terminal toolExecution.manageSkill = {"tier":"managed","promptIncluded":false}
manageLabel = undefined | manageSkillOk = false
```

**Why the guards didn't catch it:** `tests/test-ai-skills.js:3637` (M3) only asserts that the substring `manageSkill` and a `event.manage_skill ?` ternary appear in the merge region. `tests/test-ai-skills.js:3689-3740` (M5b) builds the expected live shape itself with `const live = { ...startMarker, ...endTerminal }` (`:3705`) — it validates the *intended* merge, not the renderer's actual merge. All 172 tests pass. Fix the merge and re-derive M5b from the renderer's real semantics (or move the merge into `_resolveManageSkillTerminal` so the test's `{...start, ...terminal}` becomes literally true).

**Fix:** merge instead of replace (keep the previous marker as the base):

```js
...(event.manage_skill
  ? { manageSkill: { ...(toolMsg.toolExecutions[existingIdx].manageSkill || {}), ...event.manage_skill } }
  : {})
```

(Alternative single-point fix: have `_resolveManageSkillTerminal` return the full decoration from `_buildManageSkillDecoration` — i.e. include `action` / `name` — so the live and reload paths produce byte-identical shapes by construction. That requires updating the M2b expectation at `tests/test-ai-skills.js:3621-3630`.)

---

### CR-02: Description is interpolated into YAML frontmatter unescaped → silently unloadable / truncated skills

**File:** `ai-skills-manager.js:1143-1146` (`buildSkillFileText`), reached from `createManagedSkill` (`:1376-1380`) and `updateManagedSkill` (`:1433-1437`)

**Issue:** The SKILL.md frontmatter is assembled by string concatenation with no YAML escaping:

```js
return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
```

`description` is LLM-authored free text (the tool's own description invites a sentence), and the SDK parses this block with the real `yaml` parser (`@earendil-works/pi-agent-core/dist/harness/skills.js:262-274` → `parse()`; a throw yields `parse_failed` and `skill: null`). Empirically reproduced end-to-end (`createManagedSkill` → `refreshSkills` → `getSkillsForUI`):

| description written | stored file | loader outcome |
|---|---|---|
| `Use it like this: run the weekly report` | written verbatim | `parse_failed` → **skill never loads (ghost)** |
| `Summarize this #1 priority task` | written verbatim | parses, description silently truncated to `Summarize this` |
| `true` | written verbatim | parsed as boolean → `typeof !== 'string'` → `description is required` → **ghost** |
| `A perfectly normal description` | written verbatim | loads correctly |

Also rejecting/throwing: leading `-`, leading `@`, leading `*`, `summary: it works`, any `key: value` shape. Also silent-emptying: `!important` (unresolved tag → `''`), `|` / `>` (empty block scalar).

In every ghost case the tool returns a **success** result to the LLM — `已创建技能「x」。它从下一条消息起对模型可见。` — and, because `getSkillPromptIncluded()` cannot find the entry in the cache, it additionally appends `该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:x 手动调用。` — which is doubly false (the budget is not full, and `/skill:x` cannot resolve either). The model is told a nonexistent skill works, and no diagnostic surfaces to the user.

**Fix:** emit a YAML-safe scalar (single-quoted, with `'` doubled — YAML single-quoted scalars perform no escape processing, which also avoids mangling Windows-style backslashes in the description), and normalise line breaks defensively:

```js
function yamlScalar(text) {
  return `'${String(text).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/'/g, "''")}'`;
}
// ...
return `---\nname: ${name}\ndescription: ${yamlScalar(description)}\n---\n\n${body}`;
```

Do **not** import the `yaml` package directly — it is an SDK transitive dep and importing it would break this module's stated dependency discipline (`ai-skills-manager.js:18-21`). Add regression cases for all four rows of the table above to `tests/test-manage-skill.js` (today `buildSkillFileText` is only exercised with `描述`, `tests/test-manage-skill.js:375`, and the only `: `-bearing description is rejected earlier by the credential scan, `:316`).

---

### CR-03: Description is validated *before* sanitization — the sanitizer can empty a validated description

**File:** `ai-skills-manager.js:1321-1331` (create) / `:1414-1424` (update); `validateManagedSkillDescription` `:1036-1051`; `sanitizeSkillDescription` `:1097-1103`

**Issue:** Steps 1 → 3 are "validate" → "scan" → "sanitize". The D-09 scan-before-sanitize rule is correct, but the **validator runs on the raw value and is never re-checked after sanitization**, while sanitization strictly removes characters (`C0/C1 + \u200B-\u200D \u2060 \uFEFF`), i.e. it can only shrink the string. `String.prototype.trim()` does **not** remove `U+200B`, so a description consisting of zero-width characters passes validity and then sanitizes to the empty string.

Verified end-to-end:

```
validate passes? {"ok":true}
create returned description = ""
file = "---\nname: zw\ndescription: \n---\n\n# body"
loaded = []            // skill dropped by the loader
promptIncluded = false // → tool appends the misleading "预算已满" line
```

Same ghost-skill outcome as CR-02, reached without any YAML punctuation. The result object also exposes `description: ''`, which contradicts D-07's "description 必填、trim 后非空" invariant for a call the tool reports as successful.

**Fix:** sanitize first (into a local), then assert non-emptiness on the sanitized value before scanning/scan-consistent validation — keeping scan-before-sanitize for the *scan* by scanning the raw text:

```js
const safeDescription = sanitizeSkillDescription(description);
scanSkillText(description, { includeCredentials: true });   // 先扫描原文（D-09 顺序不变）
const safeDescCheck = validateManagedSkillDescription(safeDescription); // 净化后再验一次非空
if (!safeDescCheck.ok) throw makeManageSkillError(safeDescCheck.code, safeDescCheck.reason);
```
Apply the same re-check inside `createManagedSkill` before `buildSkillFileText`, and add a `'\u200B'` case to `tests/test-manage-skill.js`.

---

## Warnings

### WR-01: The documented byte-bound ghost window is an order of magnitude too narrow

**File:** `ai-skills-manager.js:1068-1081` vs `:216-238` (loader gate); record: `.planning/phases/49-manage-skill-ai/49-01-SUMMARY.md:300`

**Issue:** `validateManagedSkillContent` bounds the **content only** (`Buffer.byteLength(content)`), while the loader gate measures the **whole `SKILL.md`** including the frontmatter that `buildSkillFileText` prepends. The recorded item estimates the window at "约 65 480–65 536" (~56 bytes). The frontmatter is `---\nname: ` + name (≤64) + `\ndescription: ` + description (≤1024) + `\n---\n\n`, so the real window is up to ~1.1 KB (≈1.7 %) — 20× wider. Measured:

```
content = 65 200 bytes (accepted), description = 1024 chars
written file size = 66 257 (limit 65 536)
loaded skills  = []                                  ← ghost
diags          = read_failed, realm_skill_md_too_large
```

The existing record therefore understates the exposure; treat this as needing a fix rather than an acceptable band.

**Fix:** bound by the real artifact: `if (Buffer.byteLength(builtText, 'utf8') > LIMITS.MAX_SKILL_MD_BYTES)` on `buildSkillFileText({name, description, content})`, or cap content at `MAX_SKILL_MD_BYTES - (frontmatter 实测开销)`. A single measured check of the assembled text is the only form that cannot drift when the frontmatter shape changes.

---

### WR-02: Reload path cannot restore `code`, so failed cards lose the short reason (hard constraint 3 violated for the failure state)

**File:** `ai-manager.js:1811-1823` (`_manageSkillTerminalFromStored`), `:2928-2941` (rebuild loop); contract: `49-UI-SPEC.md` 硬约束 3 + 交互契约「终态（失败）」

**Issue:** The live failure path decorates with `{action, name, code}` (`ai-manager.js:1780-1793` + `:6247`), but on reload only `promptIncluded` (from persisted `details`) and `tier` (from the current cache) are recoverable — `code` is deliberately omitted. After CR-01 is fixed, the live and reload key sets still differ for every failed row: live `{action, name, code, tier?}` vs reload `{action, name, tier?}`. Visually, a failed card shows `名称不合法` / `内置不可改删` while you are in the conversation, and silently loses that annotation after reopening it. UI-SPEC's stated invariant is "两条链路的产出对象**键集合逐字相等**" and the failure state is specified as "标题 + 档位徽标 + **短原因**".

**Fix (either):** (a) persist the code somewhere it survives — e.g. have Realm wrap the thrown error's message with an explicit `[code]` prefix that `_manageSkillTerminalFromStored` parses back out (the message is what lands in `tool_results`), or (b) if the deviation is intentional, record it in `49-UI-SPEC.md` / `docs/product/ai-skills.md` as a known reload asymmetry and narrow the M5b assertion so it no longer claims byte-identical key sets for failed rows.

---

### WR-03: Success result text deviates from the UI-SPEC's authoritative copy list

**File:** `ai-manager.js:6248-6252`; contract: `49-UI-SPEC.md:275-282` + `:288-299` ("全部用户可见文案（唯一权威清单）")

**Issue:** Spec vs implementation, all three actions:

| action | UI-SPEC (authoritative) | implementation |
|---|---|---|
| create | `已创建技能「{name}」。该技能从下一条消息起可用。` | `已创建技能「{name}」。它从下一条消息起对模型可见。` |
| update | `已更新技能「{name}」。下一条消息起按新正文生效。` | `已更新技能「{name}」。它从下一条消息起对模型可见。` |
| delete | `已删除技能「{name}」。下一条消息起不再可用。` | `已删除技能「{name}」。它从下一条消息起不再可用。` |

This string is both the tool result shown to the model and the card's 结果 area, so the drift is user-visible. The `promptIncluded === false` suffix (`:6255`) **does** match the spec. Note the M5b fixture at `tests/test-ai-skills.js:3719` uses the *spec* wording, so the mismatch is invisible to the suite (it is only a canned string, never compared against production output).

**Fix:** emit the three spec strings verbatim (keep the "下一条消息起" clause — it is the D-13 contract), and have the `promptIncluded === false` branch append to them.

---

### WR-04: Sanitizer strips zero-width characters but not bidi/format controls

**File:** `ai-skills-manager.js:1100`

**Issue:** `sanitizeSkillDescription` removes `\u0000-\u001F \u007F-\u009F \u200B-\u200D \u2060 \uFEFF`, closing the "零宽字符包裹的注入语" gap (P3). The same mitigation class is left open for bidirectional controls — `U+202A–U+202E` (LRE/RLE/PDF/LRO/RLO), `U+2066–U+2069` (isolates), `U+200E/U+200F` — which are not in the class and are not matched by the injection patterns. A description carrying them reaches the system prompt (description is prompt-visible by design) and the skill panel as visually-reordered text; the user reviewing what an AI-authored skill claims to do can be shown a rendering that differs from the stored bytes (Trojan-Source class).

**Fix:** extend the strip class to the bidi/format range, e.g.
`/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g` (keep `2028/2029` handled by the following `\s+` collapse), and record the extension in `docs/product/ai-skills.md` §四 as part of the sanitize contract.

---

## Info

### IN-01: Dead `madeDir` flag; `createDir` result unchecked

**File:** `ai-skills-manager.js:1370-1384`
`const madeDir = true;` is unconditionally true, so the `if (madeDir)` in the catch (`:1382`) is dead code — the comment claims a condition that cannot be false. Either drop the variable (and keep the comment explaining *why* removing is safe given step 5 guarantees `not_found`) or derive it from a real `exists` probe. Related: `await env.createDir(destDir)` ignores its Result (`:1371`); if dir creation fails, the surfaced error is the downstream `技能文件落盘失败：目标路径 …` from `atomicWriteSkillFile` (`:1200-1206`), which misattributes the cause. Check `madeDir.ok` and throw a specific error.

### IN-02: `unknown` has no short reason; an illegal `action` is labelled as a name problem
**File:** `ai-manager.js:6194-6202`, `src/skill-picker-model.js:383-393`
The tenth code `MANAGE_SKILL_ERROR.UNKNOWN` (sandbox-layer fallback, used by `atomicWriteSkillFile` / `deleteManagedSkill`) has no entry in `MANAGE_SKILL_SHORT_REASON`, so those failures render a bare title with no note. Separately, an out-of-enum `action` is given `err.code = 'invalid_name'` (`ai-manager.js:6194-6202`), which renders the card annotation `名称不合法` for what is actually a bad action. Both are within the closed-whitelist discipline; if intentional, say so in the D-07 code table, otherwise add an `unknown` row.

### IN-03: Empty `content` renders the annotation `描述不合法`
**File:** `ai-skills-manager.js:1069-1071` → `src/skill-picker-model.js:390`
`validateManagedSkillContent('')` returns `INVALID_DESCRIPTION`, so the card annotation says 描述不合法 while the expanded error text says 技能正文不能为空. The tradeoff is documented (D-07, no tenth code), but the visible label is misleading; consider mapping the empty-content case to `oversize`'s sibling — or state explicitly in the UI-SPEC copy table that `invalid_description` covers "描述或正文为空".

### IN-04: `MANAGE_SKILL_ACTION_NAME` is the only one of the three tables without a value-domain test
**File:** `src/skill-picker-model.js:367-371`; tests `tests/test-skill-picker-model.js:924-978`
The B group title says "两张白名单表" and asserts values/frozenness for `MANAGE_SKILL_ACTION_LABEL` and `MANAGE_SKILL_SHORT_REASON` only. `MANAGE_SKILL_ACTION_NAME` values feed the user-visible `动作：创建/更新/删除` line (`src/renderer.js:9714`) — bring it under the same assertion pattern.

### IN-05: `_manageSkillMeta` is reclaimed only by the end event
**File:** `ai-manager.js:736`, `:1780-1793`
`set` happens in both tool exits; the only `delete` is inside `_resolveManageSkillTerminal`. If a run is torn down between tool completion and `tool_execution_end`, the entry survives for the process lifetime, and a later execution that reuses the same `toolCallId` would receive a stale decoration instead of `null`. The SDK's sequential path does always emit the end event (`agent-loop.js:295-330`), so this is forward-looking hardening: clear the map in `_cleanupCurrentAgent()` / the new-run entry, and state the invariant where the field is declared.

### IN-06: Card params summary shows the raw description while the file carries the sanitized one
**File:** `src/renderer.js:9717-9719` vs `ai-skills-manager.js:1331/1424`
`描述：` is taken from `params.description` (raw, may contain control / zero-width / newline characters); the persisted frontmatter holds `safeDescription`. Since the description is the field that reaches the prompt, the card can show the user something other than what is actually stored. Preferring the sanitized value (it is already returned as `result.description`, persisted in `details.description`) would remove the discrepancy — `details` is available on reload rows too.

---

_Reviewed: 2026-09-13T08:12:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
