---
phase: 50-api-skills
reviewed: 2026-09-14T15:07:01Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - ai-skills-manager.js
  - ai-manager.js
  - main.js
  - ipc-handlers.js
  - src/preload.js
  - src/renderer.js
  - src/settings-page.js
  - src/settings.html
  - src/skill-picker-model.js
  - src/styles/main.css
  - tests/test-skills-management.js
  - tests/test-skills-http-api.js
  - tests/test-ai-skills.js
  - tests/test-manage-skill.js
  - tests/test-skill-picker-model.js
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-09-14T15:07:01Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 50 (settings-page skill management surface + `/api/skills/*`) is broad but mostly
disciplined: the read path is a genuinely synchronous zero-IO projection, the size walk is
symlink-safe and cycle-safe, the SEC-09 body limit really does stop accumulating mid-stream, and
the three IPC channels really are judgement-free forwarders.

**One BLOCKER was found and reproduced empirically**: the new management-surface name predicate
added in 50-02 accepts `.` / `..`, and `deleteUserSkill()` interpolates the name straight into a
`path.join` + `env.remove(..., { recursive: true })`. `POST /api/skills/uninstall {"name":"."}`
deletes the entire `agent-workspace/skills/` tree, and `{"name":".."}` deletes the **entire agent
workspace** (ai-memory, attachments, skills, managed-skills, .tmp). Both answer `200 OK` with a
normal projection, i.e. the UI reports success after the wipe. This directly contradicts the
phase's own security claim T-50-10 ("这一条是路径注入面：名字要被 `path.join` 进删除路径").

Reproduction used (real modules, temp workspace):

```
predicate("..") = {"ok":true,"value":".."}
predicate(".")  = {"ok":true,"value":"."}
deleteUserSkill(".")  返回: {"name":".","action":"uninstall"}
skills/ 仍存在? false                 skills/real-skill/SKILL.md 仍存在? false
# name: '..' →  workspace root 仍存在? false ；ai-memory/important.md 仍存在? false
```

Focus areas that were checked and found **sound** (recorded so the reader knows they were not
skipped): symlink/cycle safety of `measureSkillDir` (kind check + real 20 s-timeout loop test),
no double counting, `bytes === 0 && fileCount === 0` → explicit `statsUnavailable` consumed by the
renderer, "read disk not warm cache" for the uninstall three-state predicate, exactly-one rescan
per write (including the busy branch), `res`-missing downgrade branch not crashing, no
`req.destroy()` / no `Connection: close`, all 59 `readJsonBody` call sites passing `res`, no
inline markup `style=` in the new `realm://` markup, and the optimistic toggle rollback restoring
`.on` / `aria-checked` / `disabled`.

The double `skills:changed` event per write (one from `syncAgentSystemPrompt`, one caller-side
re-broadcast) is **not** reported as a defect: it is deliberate, test-locked (N1), and provably
benign — the only listener is `pullAiSkillsSnapshot()` (`src/renderer.js:4405`), a zero-IO
projection read that early-returns on an unchanged digest. The settings page receives no broadcast
at all.

All three test suites for this phase pass on the working tree
(`test-skills-management.js` 47/47, `test-skills-http-api.js` 32/32); the passing state is
precisely what makes CR-01 and WR-01..WR-06 worth reporting — they are the gaps the green
suites cannot see.

## Critical Issues

### CR-01: `.` / `..` accepted as a skill name → recursive deletion outside `skills/` (agent workspace wipe)

**File:** `ai-skills-manager.js:1330` (`validateSkillNameForManagement`), exploited at
`ai-skills-manager.js:2006-2040` (`deleteUserSkill`), reachable from `main.js:2873-2879`
(`POST /api/skills/uninstall`) and `ipc-handlers.js:1815` (`ai:uninstall-skill`).

**Issue:** The new *management-surface* predicate is deliberately the "safe superset" of the write
gate, so it dropped `^[a-z0-9-]+$` and only rejects `/`, `\` and control characters. Dots are
therefore allowed, and `.` / `..` are not path segments but path *normalizers*:

```js
// ai-skills-manager.js:2006
const skillName = typeof name === 'string' ? name.trim() : name;
const nameCheck = validateSkillNameForManagement(skillName);   // { ok: true, value: '.' } / '..'
...
const userDir = path.join(workspace.getSkillsDir(), skillName); // '.' → skills/ ; '..' → 工作区根
const info = await env.fileInfo(userDir);                       // kind === 'directory' → isDir = true
const res = await env.remove(userDir, { recursive: true });     // 递归删掉整个目录
```

`resolveInside(root, p)` cannot save this: `p` **is** the sandbox root (or a legitimate child of
it), so the guard returns "inside" and the delete proceeds. Measured consequences:

- `{"name":".."}` → `path.join(<ws>/skills, '..')` === `<ws>` → `env.remove(<ws>, {recursive:true})`
  → the whole `agent-workspace/` is gone: **all AI memory, all attachments, all user skills, all
  AI-created (managed) skills**. `ensureWorkspaceDir()` only recreates the empty directory
  skeleton — the content is unrecoverable.
- `{"name":"."}` → `path.join(<ws>/skills, '.')` === `<ws>/skills` → **the entire user skill
  directory is deleted** (every user-authored skill).

The three-state rejection table in the JSDoc ("存在且 `kind === 'directory'` → 允许卸载") is what
returns `ok` for both cases, and the response is `200 { name, filePath, action: 'uninstall' }`, so
`uninstallUserSkill` → `sendJson(res, 200, …)` reports a successful uninstall of a skill literally
named `.`. Note that `deleteManagedSkill` / `resolveManagedTarget` are **not** affected (they keep
the strict `validateManagedSkillName`), so this hole was opened by 50-02's wider predicate.

**Fix:** reject dot-segments in the predicate **and** add a containment assertion at the deletion
site (defence in depth — this file is the data authority and will be reused by 51):

```js
// validateSkillNameForManagement(): 追加在分隔符判定之前
if (value === '.' || value === '..' || value.includes('..')) {
  return { ok: false, code: MANAGE_SKILL_ERROR.INVALID_NAME, reason: '技能名不能是 . 或 ..' };
}
```

```js
// deleteUserSkill(): 判据成立之后、remove 之前（删除目标必须**恰好**是 skills/ 的一级子目录）
const skillsRoot = path.resolve(workspace.getSkillsDir());
if (path.dirname(path.resolve(userDir)) !== skillsRoot) {
  throw makeManageSkillError(
    MANAGE_SKILL_ERROR.NOT_FOUND,
    `技能 "${skillName}" 不存在（只能卸载 skills 目录下的用户技能）`
  );
}
```

(Equivalently: build the target from the *raw* name and assert
`path.join(skillsRoot, skillName) === path.resolve(userDir)` — see WR-01, which is the same
mistake in a milder form.)

**Status:** verified empirically with the real modules against a temp workspace — the workspace
root and `ai-memory/` were destroyed and `action: 'uninstall'` was returned with no error.

## Warnings

### WR-01: Name is silently trimmed, so the deletion target can be a *different* skill

**File:** `ai-skills-manager.js:1334` / `:2008` (`name.trim()`), consumed by the settings page at
`src/settings-page.js:5318-5332` (switch) / `:5427-5439` (confirm dialog).

**Issue:** `validateSkillNameForManagement` returns the **trimmed** value and `deleteUserSkill`
uses that returned value for the path join. The management projection's `name` is the raw
directory name (`enforceDirNameAuthority`, 46 D-08 — the loader deliberately keeps
non-conforming names). So for a hand-placed directory `skills/ foo` (leading space):

- `skills/" foo"` is listed in the settings page with a rendered uninstall button
  (`item.tier === 'user'`), and the confirmation dialog reads `将删除 skills/ foo/ 整个目录…`;
- `POST {"name":" foo"}` → trimmed to `foo` → `env.fileInfo(<ws>/skills/foo)` → if `skills/foo`
  exists, **that unrelated skill is deleted**; if it does not exist, the user gets
  `not_found` → "技能已不存在" for a row that is plainly on screen (the exact失实文案 class this
  phase set out to eliminate).
- The same asymmetry makes the enable/disable switch a silent no-op for such a skill: the
  trimmed name is written to `settings.aiSkills.disabled`, no cache entry matches it, the returned
  projection re-renders the row as enabled, and the toggle visibly "springs back" for no stated
  reason.

This is the same defect family as CR-01 (name → path), reached without any traversal.

**Fix:** never path-join a normalized name. Either (a) keep the raw value for the path and only
normalize for the disabled-name list, or (b) reject names whose trimmed form differs from the raw
form (with a message that names the offending directory), and drop `trim()` from the path
derivation:

```js
const raw = typeof name === 'string' ? name : '';
const nameCheck = validateSkillNameForManagement(raw);   // 判据仍按 trim 后值域
if (!nameCheck.ok) throw makeManageSkillError(nameCheck.code, nameCheck.reason);
if (raw !== nameCheck.value) throw makeManageSkillError(
  MANAGE_SKILL_ERROR.INVALID_NAME,
  `技能名 "${raw}" 含首尾空白，无法安全定位目录`
);
const userDir = path.join(workspace.getSkillsDir(), raw);
```

### WR-02: `restoreSkillManageFocus` can never fire — keyboard focus is dropped to `<body>` on every toggle

**File:** `src/settings-page.js:5350` (`sw.disabled = true`), `:5598-5610` (`renderSkillManagement`),
`:5638-5648` (readers), `:5662-5671` (restore).

**Issue:** the restore path reads the *current* `document.activeElement` **at re-render time**:

```js
const prevRow = focusedSkillRowName();          // activeElement.closest('.skill-manage-row')
const prevWasSwitch = isFocusedSkillSwitch();   // activeElement.classList.contains('ai-switch')
```

but `toggleSkillDisabled` sets `sw.disabled = true` **before** awaiting the request, and Chromium
blurs a focused element the moment it becomes disabled. Verified in this repo's Electron
(probe: `button.focus(); button.disabled = true` → `{"before":"b","after":"BODY"}`). By the time
the response arrives, `document.activeElement` is `<body>` ⇒ `focusedSkillRowName()` returns `''`
⇒ `restoreSkillManageFocus` early-returns. The uninstall path is equally unreachable
(`closeSkillUninstallConfirm` restores focus to the *uninstall button*, which is not an
`.ai-switch`). Net effect: every toggle/uninstall in a long list throws the keyboard user back to
the top of the document, while both the JSDoc ("按 `data-skill-name` 把焦点归还到**同一技能行**的开关")
and the test (`tests/test-skills-management.js:1113`) claim the opposite.

**Fix:** capture the intended target *before* the request instead of reading `activeElement` after
it, and let the caller declare it:

```js
// toggleSkillDisabled(): sw.disabled = true 之前
const focusName = name;
...
renderSkillManagement(projection, { focusSkillName: focusName });
```
```js
function renderSkillManagement(projection, { focusSkillName = '' } = {}) {
  ...
  restoreSkillManageFocus(focusSkillName || focusedSkillRowName(), prevWasSwitch || !!focusSkillName);
}
```

### WR-03: Three new IPC channels + preload methods have zero consumers, and one of them deletes directories

**File:** `ipc-handlers.js:1781`, `:1798`, `:1815`; `src/preload.js:1047`, `:1055`, `:1062`.

**Issue:** `getSkillsManagement` / `setSkillDisabled` / `uninstallSkill` and their three channels
are registered and exposed, but there is **no call site anywhere in `src/`** (grep for all three
names returns only `preload.js`). The management UI lives exclusively in the `realm://settings`
guest, which reaches the manager over HTTP. The "两入口同一权威" claim is therefore only
source-scanned, never exercised — and the unused surface is not inert: `ai:uninstall-skill`
is a recursive-delete capability permanently exposed to every trusted main-window renderer with
no UI gating it, which multiplies the blast radius of CR-01 (any main-window prototype-injection /
XSS can wipe the agent workspace through a channel no test ever drives). It also contradicts the
phase's own stated rule ("不新增没有消费者的字段" — applied to the uninstall response shape).

**Fix:** either wire the management surface into the main window (the natural future home is the
`/` panel's row context menu), or drop the three channels and the three preload methods until a
consumer exists. Until then, add a manager-level assertion so the destructive path can be
reached only through the audited entry point.

### WR-04: The uninstall guard test set gives false traversal coverage (this is how CR-01 shipped green)

**File:** `tests/test-skills-management.js:886-896` (predicate rejects),
`:939-971` (`deleteUserSkill` rejection codes).

**Issue:** the rejection faces are enumerated as
`['', '   ', 'a'.repeat(65), 'a/b', 'a\\b', 'a\u0000b', 'a\u001fb', 42, null, undefined, {}]` and
the manager-level set uses `'../escape'`. Both *look* like traversal coverage, and both miss the
only two strings that actually traverse inside the sandbox root: `.` and `..`. `'../escape'` is
rejected by the `/` rule alone, so it cannot distinguish "path separators blocked" from "dot
segments blocked" — exactly the "assertions that pass regardless of the implementation" pattern
this repo has a recorded history of.

**Fix:** add `.` and `..` (and `' . '` after trim) to both reject enumeration lists, plus one
end-to-end assertion that the workspace root is still intact after an uninstall attempt with
`{ name: '..' }`:

```js
for (const value of ['.', '..', ' . ']) {
  const check = aiSkills.validateSkillNameForManagement(value);
  assert.strictEqual(check.ok, false, `${JSON.stringify(value)} 必须被拒（点段会 normalize 出界）`);
}
```
```js
await expectCode(() => aiSkills.deleteUserSkill(env, { name: '..' }), 'invalid_name'); // 或 not_found
assert.ok(fs.existsSync(root), '越界名不得删除工作区根');
```

### WR-05: Assertions that cannot fail (existence-only / tautological / redundant)

**File:** `tests/test-skills-management.js:574`, `:1111-1118`, `:1190-1191`;
`tests/test-skills-http-api.js:544-549`.

**Issue:** several assertions are decorative rather than load-bearing:

- `:574` — `assert.notStrictEqual(item.bytes, item.bytes + 0 + allEntries[0].size, 'sanity')`
  compares a value against itself plus a non-zero constant. It is a tautology; the "反方向证据"
  the surrounding comment claims is not produced. (`allEntries[0]` is also not guaranteed to be a
  directory, and `fs.statSync` follows symlinks, unlike the production口径.)
- `:1113` — `assert.ok(/\.focus\(\)/.test(r))` is a substring check that passes for a permanently
  unreachable code path (WR-02 is the live proof).
- `:1190-1191` — `assert.ok(calls.length >= 3)` is satisfied by the definition line alone plus any
  two calls; it cannot fail while the function exists.
- `tests/test-skills-http-api.js:544-549` — the second assertion `threw || status !== 413` is
  implied by the preceding `assert.notStrictEqual(status, 413)` (when `threw` is true, `status` is
  still `0`), so it can never fail independently.

**Fix:** replace each with a discriminating assertion: assert the *measured* byte difference of a
directory entry (e.g. wrap the walk with a directory-size-inclusive variant and assert the values
differ), drive `restoreSkillManageFocus` through a fake `document.activeElement` stub and assert
`focus()` was called on the right element, and delete the redundant `threw || …` line (or assert
`threw === true` explicitly to pin the destroy-form behaviour).

### WR-06: The SEC-09 behavioural guarantees are proven against a *copy* of `readJsonBody`, and the `Content-Length` fast path has no source assertion

**File:** `tests/test-skills-http-api.js:335-376` (`readJsonBodyEq`), `:450-551` (behaviour group),
`:553-617` (source contracts).

**Issue:** the 413-reachability / heap-bound / no-unhandledRejection guarantees — the load-bearing
claims of 50-03 — are asserted against `readJsonBodyEq`, a hand-written re-implementation, not
against `main.js`. The file states this honestly, and backs it with source-scan assertions
(signature, `canRespond`, 413 form, `req.resume()`, no `destroy()`, no `Connection` header,
data-listener statement order). But the source contracts do **not** cover the
`Content-Length` pre-check: deleting

```js
const declared = Number(req.headers['content-length']);
if (Number.isFinite(declared) && declared > maxBytes) { tooLarge(); reject(…); return; }
```

from `main.js` leaves every test in the suite green (`readJsonBodyEq` keeps its own copy, and the
harness sends the fast-path case with `withContentLength: true`). The documented "fail-closed,
zero-byte-read rejection" property is therefore unverified for production code — the harness
inoculates the mutation instead of detecting it.

**Fix:** add a source contract for the pre-check (its presence and its `Number.isFinite` guard, and
that it sits before the `data` listener registration), and — preferably — move `readJsonBody` /
`sendJson` out of the `realmServer` closure into a small require-able module so the behaviour group
drives production code. Two independent copies of a security control is the same "second
implementation" pattern the phase bans elsewhere.

## Info

### IN-01: Dead CSS sibling rule and a permanent 32 px hole in the section

**File:** `src/styles/main.css:10508`; `src/settings.html:544-546`; `src/styles/main.css` `.skill-manage-state`.

**Issue:** `.ai-skill-content-box.skill-manage-summary + .skill-manage-groups { margin-top: 16px }`
can never match: the DOM order is `#skillManageSummary`, `#skillManageState`, `#skillManageGroups`,
so the summary's adjacent sibling is always `#skillManageState`. The intended "仅在有汇总条时生效"
spacing therefore never applies, and because `.skill-manage-state { padding: 16px 0 }` keeps its
padding after `clearNode()`, a constant ~32 px gap sits between the summary bar and the list
regardless of whether a summary exists.

**Fix:** use a general-sibling/descendant selector (`.skill-manage-summary.ai-skill-content-box
~ .skill-manage-groups`) or move `#skillManageState` after `#skillManageGroups`, and add
`.skill-manage-state:empty { display: none; padding: 0 }`.

### IN-02: `BODY_TOO_LARGE` front-end copy is unreachable; the 413 body omits `code`

**File:** `src/settings-page.js:4858`; `main.js:946` (413 body), `main.js:2873-2879`.

**Issue:** `skillsApi()` sets `err.code` from `data.code`, and `handleSkillsApi` answers only via
`sendJson(res, 400, { error, code: err.code || undefined })` — but on the over-limit path
`readJsonBody` has already written the 413 with `{ error, limit }` and **no `code`**, so the
handler's `sendJson` no-ops (`headersSent`) and the client never sees the code. The
`BODY_TOO_LARGE: '请求体超过上限，操作未执行'` entry is dead, the user gets the generic
`操作失败：请求体超过上限（N 字节）` fallback, and the documented `{ error, code }` error contract
does not hold for this response.

**Fix:** include `code: 'BODY_TOO_LARGE'` in the 413 payload (it is the same single-source constant
the handlers use), or key the front-end lookup on `err.status === 413`.

### IN-03: `limits` is returned by both entry points but consumed by nobody

**File:** `ai-skills-manager.js:1077-1083`; `main.js:2846` (empty `limits: {}`); `src/settings-page.js`.

**Issue:** the projection carries `limits` (five keys) precisely so that "端点与前端零字面量" holds,
but no consumer reads it — the only occurrence in `settings-page.js` is the prose comment at
`:4899`. The field is therefore an un-consumed addition of the kind the phase explicitly forbids
elsewhere ("无消费者的字段必然腐化成第二次实现"), and the `{ limits: {} }` shape returned by the
not-ready branch is a second, silently different shape of the same key.

**Fix:** either render the limits where the UI needs them (e.g. the `超数量上限` / `超预算` status
tooltips) or drop the field until a consumer exists.

### IN-04: A shadowed row's switch silently toggles the *winning* skill, and its status annotation disappears

**File:** `src/settings-page.js:5318-5332` (`createSkillSwitch`), `src/skill-picker-model.js:268`.

**Issue:** `settings.aiSkills.disabled` is name-keyed and source-agnostic (46 D-09), and the
settings page renders a switch on **every** row — including `shadowed` builtin/managed rows that
share a name with a user skill. Clicking the shadowed row's switch writes the shared name, which
disables the user skill that actually wins, while the shadowed row loses its
`已遮蔽 · 由用户同名技能胜出` annotation (the D-12 chain puts `disabled` first, so the row now reads
`已禁用`). The behaviour is consistent with the locked decisions and documented as a known
boundary, so this is informational — but the two rows are visually indistinguishable as "the same
switch" and the resulting state change is attributed to the wrong row.

**Fix (optional):** render the shadowed row's switch as disabled with a title explaining that the
name-keyed list is shared, or render the `disabled` state plus the shadowed reason together in the
row tail.

### IN-05: The disabled-name cleanup lives at the caller, so a direct manager call leaves a stale entry

**File:** `ai-manager.js:1691-1695` (cleanup), `ai-skills-manager.js:2006` (no cleanup).

**Issue:** the "uninstall ⇒ drop the name from `settings.aiSkills.disabled`" invariant is
implemented in `AIManager.uninstallUserSkill`, not in `deleteUserSkill`. Every production caller
goes through the manager, so the invariant holds today — but `deleteUserSkill` is the documented
single data authority ("判据 / 校验 / 删除全部住 manager") and the tests call it directly, exactly
the shape a future caller (Phase 51) would copy; that caller would silently reintroduce the
"same-named re-install is auto-disabled" bug the invariant exists to prevent.

**Fix:** move the cleanup to the data authority (pass the store / a `clearDisabledName` callback into
`deleteUserSkill`), or — if the split is kept deliberately — state the post-condition explicitly in
`deleteUserSkill`'s JSDoc ("调用方必须把返回的 `name` 从 `settings.aiSkills.disabled` 摘掉"), since
it already returns that name and nothing currently tells a future caller to use it.

---

_Reviewed: 2026-09-14T15:07:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
