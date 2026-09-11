---
phase: 47
reviewers: [claude, opencode]
reviewed_at: 2026-09-11T07:25:31Z
plans_reviewed: [47-01-PLAN.md, 47-02-PLAN.md, 47-03-PLAN.md, 47-04-PLAN.md]
models:
  claude: "unknown"
  opencode: "unknown"
model_sources:
  claude: "unknown"
  opencode: "unknown"
---

# Cross-AI Plan Review — Phase 47

<!-- gsd:plan-revision-conflicts:begin -->
## Plan-Revision Conflicts

<!-- gsd:plan-revision-conflicts:end -->

## Claude Review

Now I have enough evidence to write a thorough review. Here is my structured feedback.

---

## 47-01

### Summary

Plan 47-01 establishes the end-to-end "tracer" for Phase 47: the seed pipeline from bundled `skills-builtin/find-skills/` through `builtin-skills-seeder.js` to `managed-skills/`, verified by the skill loader recognizing the skill with zero diagnostics and `disable-model-invocation: true` keeping it out of the system prompt. The design correctly mirrors established project patterns (`migrateAiMemory` for error handling, `favorites-manager.js` for `app.isPackaged` path branching, `withTempRoot` for test scaffolding). The find-skills SKILL.md rewrite follows the research's §A-3 outline precisely, eliminating all installation semantics while preserving functional discovery via `web_fetch`.

### Strengths

- **Tracer-first design is well-justified.** The plan correctly identifies that the seed pipeline is the single most critical path to verify before adding semantics (Wave 2) or documentation (Wave 3). The end-to-end assertion chain (seed → load → zero diagnostics → empty prompt) at `main.js:4040-4041` → `aiManager.init()` → `refreshSkills()` is precisely located and the ordering constraint is well-reasoned.
- **`safeCopyDir` atomic pattern is correctly specified.** The tmp → bak → rename → rollback pattern with same-parent-directory constraint (avoiding `EXDEV` on macOS `/var/folders`) is a non-obvious but critical detail. The plan correctly warns against `os.tmpdir()`.
- **`detectDiff` avoids mtime.** The layered short-circuit (path set → size → sha256) with explicit prohibition of mtime comparison is correct — `safeCopyDir` rewrites mtime on every sync, so mtime-based diff would produce100% false `realm_builtin_seed_overwritten` warnings on every startup.
- **Zero-hardcoding invariant for `getSeededSkillNames()`.** Scanning `skills-builtin/` directory names at runtime (D-11) rather than maintaining a state file or hardcoded list is the right design — it's self-healing against deletion, doesn't fork across environments, and automatically picks up future builtin skills.
- **Symlink fail-closed.** Refusing to follow symlinks in the source directory (which should be pure git-tracked text) is safer than the openhanako reference implementation's "follow and copy" approach.

### Concerns

- **MEDIUM: `detectDiff` error handling during traversal is unspecified.** The plan describes the short-circuit logic for `'same'`/`'different'`/`'missing'` but doesn't address what happens if `readdirSync` or `hashFile` throws mid-traversal (e.g., permission error on one file within the source). Should `detectDiff` return `'different'` on any IO error (fail-safe: always re-sync), or propagate the error? The plan's `seedBuiltinSkills` wraps the whole operation in try/catch, but an error in `detectDiff` would skip the sync entirely rather than falling back to "just copy it." Recommend: `detectDiff` errors should return `'different'` (conservative: always re-sync when uncertain).
- **MEDIUM: `npm ci` justification is absent from plan47-01 but is critical context.** While `npm ci` handling belongs to47-02, the plan's `must_haves.truths` mentions it in passing without explaining *why* it's included. The research §E-1 provides the key justification ("不取新代码不等于不执行任意代码" — `npm ci` runs all dependencies' `postinstall` scripts). This rationale should be documented in the code, not just the plan, since future maintainers will question why `npm ci` is treated differently from `npm run`.
- **LOW: Task3's EXEMPTIONS list for47-03's `check_env.mjs` is deferred but not stubbed.** The plan correctly notes that47-03 will add real exemption entries, but Task3's action step2 says "本阶段47-01该目录集为空 → 断言「扫描器已就位且豁免清单非空时不影响第1段」". This is correct for47-01 but creates a coupling: if47-03 fails to add the exemptions, the scanner will flag `check_env.mjs`'s "Do not auto-install" text as a P1 violation. The coupling is by design (Wave2 depends on Wave1), but worth noting.
- **LOW: `resolveBuiltinSkillsSrc` dependency injection shape.** The plan specifies `setBuiltinDepsForTest({ srcDir, managedDir })` but the actual `resolveBuiltinSkillsSrc()` function uses `deps.isPackaged` / `deps.resourcesPath` / `deps.dirname`. These are different abstraction levels — the test setter accepts high-level directories while the function accepts low-level Electron primitives. This is fine functionally but could confuse readers. The plan should clarify that `setBuiltinDepsForTest` internally maps `srcDir` to overriding `resolveBuiltinSkillsSrc`'s return value, not its parameters.

### Suggestions

- Add a one-line comment in `builtin-skills-seeder.js`'s `detectDiff` explaining *why* mtime is not used (e.g., "safeCopyDir rewrites mtime on every sync → mtime-based diff would always report 'different'").
- Specify that `detectDiff` on IO error returns `'different'` (fail-safe: always re-sync).
- Ensure the `FORBIDDEN_PATTERNS` scanner in Task3 uses `skills-builtin/**/SKILL.md` glob (not hardcoded `find-skills/SKILL.md`) so it automatically covers skill-creator when47-03 adds it.

### Risk Assessment

**LOW.** The plan is well-grounded in verified source code locations and established patterns. The tracer design minimizes blast radius. The main risk (detection edge cases in `detectDiff`) has a clear fail-safe default.

---

## 47-02

### Summary

Plan47-02 adds the `install` tier to `ai-bash-policy.js` — the second half of the P1 gate. The13-family pattern table is directly copied from the research's E-1 section (33 positive /34 negative /15 escape vectors tested), and the insertion point into `evaluateBashCommand` correctly places the install short-circuit before `matchesWhitelist` (whitelist cannot bypass) while preserving `danger` priority over `install`. The `_createBashToolWithPolicy` modification in `ai-manager.js:5630-5691` correctly extends the binary `isDanger` check to a three-way branch.

### Strengths

- **Pattern table is research-verified, not designed from scratch.** The13 `{ pattern, name }` entries are copied verbatim from47-RESEARCH §E-1, which was tested against33 positive +34 negative +15 escape vectors. This eliminates the most common source of policy bugs (regex design errors).
- **`install` short-circuit placement is correct and well-justified.** The flow `danger → install → whitelist → default` satisfies both D-14 (whitelist cannot bypass install) and the existing invariant that `danger` takes priority (e.g., `sudo npm i x` reports `danger`, not `install`).
- **Read-only subcommand exclusion is thorough.** The plan explicitly lists14+ negative examples (`npm run`, `test`, `ls`, `view`, `audit`, `outdated`, `brew info`, `list`, `search`, `pip list`, `show`, `cargo search`, `go list`, bare command names) and requires them as *hard assertions*, not just documentation. This directly addresses D-16's concern that false positives would drive users to whitelist `npm` entirely.
- **Decision D-47-02-a (complete shape, route A) is the right call.** Adding `installNames: []` to all branches (including `allow`) and updating the2 `deepStrictEqual` assertions ensures downstream consumers get a consistent shape without defensive `verdict.installNames || []` patterns.
- **The `_createBashToolWithPolicy` modification is minimal and well-scoped.** Only4 lines change within the method body (`:5651`-`:5662`); the cancel path (`:5664-5674`) and execution/settlement path (`:5676-5689`) are untouched.
- **Residual risks are honestly documented.** Command substitution (`` `npm i x` ``), variable indirection (`NPM=npm $NPM i x`), and `echo "npm install"` false positives are explicitly acknowledged with severity assessment (the first two don't hit whitelist either → still show `confirm/default` card).

### Concerns

- **HIGH: The2 `deepStrictEqual` assertions at `tests/test-ai-bash-policy.js:159-164` are correctly identified but the exact line numbers need care.** The plan says "159-164" but the actual assertions are: line159-161 (`npm run test` → `{ level: 'allow', dangerNames: [] }`) and line162-164 (`git status && ls -la` → same). The plan's acceptance criteria correctly says "只改这两条的目标对象字面量" but an implementer could misidentify which lines to change. Verified: lines159-164 in `tests/test-ai-bash-policy.js` are indeed the2 `deepStrictEqual` calls that will break if `installNames` is added to the `allow` return shape.
- **MEDIUM: `stripLeadingQuotes` placement could confuse future readers.** The plan correctly scopes it to `matchInstall` only (not `matchDangerous` / `matchesWhitelist`), but doesn't explain *why* it's needed. The reason: `'npm' i x` (shell quoting around the command name) would not match `\bnpm\b` without stripping. A brief inline comment would prevent someone from "cleaning up" the function later.
- **MEDIUM: The plan's `must_haves.truths` states "`splitCommandPipeline` / `matchesWhitelist` / `normalizeSegment` / `extractCommandName` 四个函数零改动" but the acceptance criteria uses `git diff "$BASE"..HEAD` which will show changes to the *file*, not individual functions. The plan should clarify that the diff verification checks these four functions' bodies are unchanged (e.g., by grepping for their function signatures and comparing surrounding lines).
- **LOW: `PACKAGE_MANAGER_INSTALL_PATTERNS` JSDoc says `curl … | sh` is not included, but doesn't explain where it IS handled.** A one-line note ("管道右侧 `sh` 已属 `DANGEROUS_INTERPRETERS`，`danger` 先返回") would prevent someone from "fixing the omission."

### Suggestions

- Add a comment above `stripLeadingQuotes` explaining its purpose: "覆盖 `'npm' i x` 类 shell 引号包裹命令名的形态".
- In the acceptance criteria's git diff check, specify that the diff should be filtered to show only changes within the new functions/table/export block (not the entire file).
- Add the `npm ci` postinstall rationale as a comment in the `PACKAGE_MANAGER_INSTALL_PATTERNS` JSDoc: "`npm ci` 计入安装档：虽不取新代码，但执行所有依赖的 `postinstall` 脚本（实质是任意代码执行）".

### Risk Assessment

**LOW.** The pattern table is pre-verified, the insertion point is precisely located, the2 breaking assertions are correctly identified, and the `ai-manager.js` modification is minimal. The residual risks are honestly documented with severity assessment.

---

## 47-03

### Summary

Plan47-03 brings skill-creator as a pinned-SHA upstream snapshot (19 files:18 upstream + `check_env.mjs`), applies six controlled modifications to SKILL.md (§4(b) declaration, Environment Preflight chapter, removal of three platform-specific chapters, frontmatter additions), and creates `THIRD_PARTY_NOTICES.md` with five-element attribution for both builtin skills. The decision to mark both skills as `modified` (fail-safe) is correct.

### Strengths

- **Fail-safe `modified` labeling (D-47-03-b) is the right call.** Apache-2.0 §4(b) requires "prominent modification statements" for modified files. Marking an unmodified file as modified is legally harmless (over-disclosure); marking a modified file as unmodified is potentially a license violation. The plan correctly applies this to both skills.
- **Six controlled changes to SKILL.md are well-justified.** Each change has a clear functional reason: removing `present_files` / Claude.ai / Cowork chapters prevents the model from calling nonexistent tools; adding `disable-model-invocation: true` prevents the350-char English description from consuming prompt budget on every request; Chinese `description` serves the `/` panel human readers (D-04).
- **`check_env.mjs` capability reduction to4 groups is correct.** Removing `run-eval` and `run-loop` (which depend on `claude` CLI) from the Realm version avoids false "missing command" failures on user machines that don't have the CLI installed.
- **`agents/` inclusion (D-47-03-a) prevents broken references.** The `## Advanced: Blind comparison` chapter in SKILL.md references `agents/*.md`; excluding them would create dangling references that confuse the model.
- **THIRD_PARTY_NOTICES.md structure is comprehensive.** Five elements per skill, three "易错事实说明" (find-skills has no standalone LICENSE, `anthropics/skills` has `license.spdx_id: null`, Python deps not distributed by Realm), and a dedicated section for non-distributed runtime dependencies.
- **P10-5 LICENSE.txt landing assertion is a critical addition.** The plan correctly identifies that "LICENSE.txt 不产生诊断" doesn't prove the file exists (missing file also produces no diagnostic), so a direct byte-comparison assertion is needed.

### Concerns

- **HIGH: The `body 不含 CJK` assertion could be fragile.** The plan requires that SKILL.md's body (after frontmatter) contains no CJK characters. But the `## Environment Preflight` chapter will be written in English by the implementer — there's no *mechanism* preventing someone from accidentally writing a Chinese sentence in that chapter. The assertion is correct as a guardrail, but the plan should explicitly note that the Environment Preflight chapter *must* be written in English to avoid failing this assertion.
- **MEDIUM: `check_env.mjs`'s `installGuidance` text contains the word "install" — this will be flagged by the scanner's second stage.** The plan correctly identifies this in Task2 action step3 (adding2 EXEMPTIONS entries), but the coupling is subtle: if the exemption entries don't exactly match the line content (e.g., whitespace differences), the test will fail. The plan should specify that the exemption regex matches the *line content*, not a fixed line number (line numbers shift when the file is edited).
- **MEDIUM: The `files_modified` list has21 entries but the plan notes "19项是curl取回...从不以Read打开".** This is correct for context management, but the `estimate.tokens: 46000` should account for the fact that `SKILL.md` (33,168 B) will need to be fully read and edited. At ~4 chars/token, that's ~8,300 tokens just for reading SKILL.md. The estimate seems tight.
- **LOW: The plan doesn't specify what happens if the upstream SHA becomes unavailable.** If `raw.githubusercontent.com/anthropics/skills/b0cbd3df...` returns404 (repo deleted, force-pushed, etc.), the plan has no fallback. The research's B-1 section verified the SHA is accessible as of2026-09-11, but this is a time-sensitive dependency. Consider downloading the files as a first step and verifying byte counts before proceeding with modifications.
- **LOW: The `THIRD_PARTY_NOTICES.md` `check_env.mjs` entry says "Realm 自研，非上游内容 —— 该文件不适用本节的归属义务".** This is correct but could be misread as "no license applies." Consider adding "该文件以 MIT 许可证随 Realm 分发" for clarity.

### Suggestions

- Add explicit instruction: "## Environment Preflight 章节必须用英文撰写（body 不含 CJK 的断言会检查）".
- Specify that EXEMPTIONS entries use regex matching on line content (not line numbers), and that the regex should match the *entire relevant text span* to avoid partial matches.
- Consider a fallback: download all18 files first, verify byte counts, then proceed with modifications. If any download fails, abort early.
- Add "该文件以 Realm 的 MIT 许可证分发" to the `check_env.mjs` attribution note.

### Risk Assessment

**MEDIUM.** The plan is well-designed but has two fragile coupling points (CJK assertion on body text, exact-match EXEMPTIONS entries) and a time-sensitive external dependency (upstream SHA availability). The fail-safe `modified` labeling and comprehensive THIRD_PARTY_NOTICES structure mitigate the P10 risk effectively.

---

## 47-04

### Summary

Plan47-04 closes Phase47 by: (1) adding `build.files` exclusion entries to prevent `.planning/` (containing the P1 RCE playbook `PITFALLS.md`) from entering the distribution package, (2) verifying the packaged .app actually loads and seeds both builtin skills (the only signal that covers `app.isPackaged`), and (3) synchronizing documentation across three files (`ai-skills.md`, `ai-agent-workspace.md`, `AGENTS.md`) with the new "内置技能" and "bash 包管理器安装档" chapters.

### Strengths

- **Pitfall4 mitigation is well-prioritized.** The research's Pitfall4 documented that `build.files` was `[]` (no allowlist), causing `.planning/research/PITFALLS.md` (containing `npx skills add -g -y` verbatim) to be packaged. The5-item `!` exclusion approach is minimal-risk: it preserves the default include-all semantics (so `skills-builtin/**` and `THIRD_PARTY_NOTICES.md` are automatically included) while precisely removing the dangerous directories.
- **`make install-nightly` over `make install` (D-47-04-c) is the right safety choice.** The research verified that `/Applications/Realm.app` is currently running (PID25922 + ~10 helpers). Using Nightly avoids the destructive `rm -rf` on the running bundle while still exercising the same `app.isPackaged` code path.
- **Documentation synchronization is comprehensive.** The three-file sync covers all three reader personas (product / security / implementation), and the "三档权限" framework consistency check (no "四档" anywhere) prevents terminology drift.
- **Chapter ordering assertion (`indexOf` comparison) is clever.** Simply checking that chapter titles *exist* wouldn't catch "六、八、九、七" ordering bugs. The `indexOf` comparison ensures self-consistent numbering and positioning.
- **The `autonomous: false` flag on Task3 correctly forces human verification.** The `pgrep` check cannot be automated (it requires user decision-making about whether to close their running instance).

### Concerns

- **HIGH: The `build.files` exclusion approach has a subtle future risk the plan doesn't fully mitigate.** If a future phase adds a `build.files` *allowlist* (positive inclusions), the5 `!` exclusion entries become no-ops — `!` only works within the default include-all semantics. The plan's test guardrail (checking the5 entries exist) would still pass, but `.planning/` would re-enter the package. The plan should add a comment in `package.json` (or at minimum in the test) warning: "这些排除项仅在无正向 allowlist 时生效；若日后添加 `build.files` 正向列表，必须同时排除这些目录."
- **MEDIUM: Test count discrepancy between research and plan.** The research says "64例" for `test-ai-skills.js` but my grep shows75 `test(` calls in that file. The AGENTS.md update in Task2 should use the *actual* count, not the research's number. The plan says "以47-02落地后的实跑输出为准" which is correct, but the research's "64" should not be carried forward without verification.
- **MEDIUM: The verification script for Task1 uses `node -e` which requires approval (node is in DANGEROUS_INTERPRETERS).** The plan's `<verify>` step runs `node -e "..."` to check `package.json` — this will trigger the bash policy's install/danger confirmation. This is expected behavior but could confuse an implementer who expects automated verification to run without prompts.
- **LOW: `ai-agent-workspace.md` §五's `brew` example update is vaguely specified.** The plan says "复核 `brew` 例子" but doesn't give the exact current text or proposed replacement. The current §五 likely says something about `brew` being safe to whitelist — but with47-02's install tier, `brew install` now triggers forced confirmation while `brew info` / `brew list` don't. The plan should specify the exact wording change.
- **LOW: The plan doesn't address what happens if `make install-nightly` fails.** The Makefile's `install-nightly` target inherits `package.json`'s `build` section, but the plan adds `build.files` exclusions *in the same phase*. If Task1's `package.json` edit has a JSON syntax error, `make install-nightly` in Task3 will fail with a cryptic electron-builder error. The plan should add a `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` syntax check between Task1 and Task3.

### Suggestions

- Add a warning comment in the test guardrail: "这些排除项仅在无正向 `build.files` allowlist 时生效".
- Verify actual test counts by running the tests before writing the AGENTS.md update.
- Add a `package.json` syntax validation step between Task1 and Task3.
- Specify the exact `brew` example wording change for `ai-agent-workspace.md` §五.

### Risk Assessment

**MEDIUM.** The `.planning/` exclusion is well-motivated but has a subtle future-risk with allowlist semantics. The packaged .app verification is correctly gated behind human approval. The documentation sync is comprehensive but has a test-count accuracy concern.

---

## Cross-Plan Comparison

### Dependency Ordering

The wave structure (47-01 → 47-02/47-03 parallel → 47-04) is correct. 47-01 establishes the seed pipeline that47-03 depends on (it adds skill-creator to `skills-builtin/` which the seeder automatically picks up). 47-02 is independent of47-03 (they modify different files: `ai-bash-policy.js` vs `skills-builtin/`). 47-04 depends on all three (it needs the packaged content, the install tier, and both skills to verify end-to-end).

### Consistency Check

- **"三档权限" framework**: All four plans consistently use the three-tier framework. 47-02's D-47-02-b decision and47-04's D-47-04-b decision are aligned. No plan introduces "四档."
- **Test counts**: 47-01/47-02/47-03 all reference the research's counts (32 for bash-policy,64 for skills,21 for workspace). My verification shows32 is correct for bash-policy,21 for workspace, but skills has75 `test(` calls (not64). 47-04 correctly says "以实跑输出为准."
- **`installNames` shape**: 47-02's D-47-02-a (complete shape, route A) is consistent with all plans' expectations. No plan assumes the minimal shape (route B).
- **P10 attribution**: 47-03 creates `THIRD_PARTY_NOTICES.md` with both skills marked `modified`. 47-01's `must_haves` doesn't mention P10 (correctly — it's not its responsibility). 47-04 verifies the file is in the package.

### Missing Edge Cases Across Plans

1. **No plan addresses `npm exec` alias behavior.** `npm exec` is the modern equivalent of `npx` (since npm7). The pattern table in47-02 includes `exec` in the npm patterns, but47-01's find-skills SKILL.md doesn't mention `npm exec` as a forbidden term. The zero-install scanner in47-01 Task3 covers `npm.*exec` via regex, but the SKILL.md's explicit prohibition text (D-02) might benefit from mentioning `npm exec` alongside `npx`.
2. **No plan addresses the `postinstall` attack vector in documentation.** The research explains why `npm ci` is included (postinstall scripts), but neither47-04's documentation chapters nor47-02's code comments explain this to users. A one-line note in `ai-skills.md §九` would help: "`npm ci`虽不取新代码，但会执行所有依赖的 `postinstall` 脚本（实质是任意代码执行），因此也在安装档内."
3. **The `THIRD_PARTY_NOTICES.md` won't be in the asar if a future `build.files` allowlist is added.** 47-04's Task1 test guardrail checks that the5 `!` entries exist, but doesn't check that `THIRD_PARTY_NOTICES.md` is actually *included*. If someone adds a `files: ["main.js", "skills-builtin/**"]` allowlist, `THIRD_PARTY_NOTICES.md` would be excluded. The test should also verify `THIRD_PARTY_NOTICES.md` is NOT in the exclusion list.

---

## Overall Risk Assessment

**MEDIUM**

**Justification:** Phase47's two deliverables (builtin skill seeding + bash install tier) are well-designed and grounded in verified source code. The P1 gate has two halves that are correctly identified as inseparable. The research foundation is unusually thorough (33+34+15 test vectors for the pattern table, real GitHub API verification, pinned SHA with byte-count validation).

The primary risks are:
1. **Fragile coupling between47-01 and47-03** — the zero-install scanner's exemption list must be precisely updated when skill-creator is added, and the CJK assertion on SKILL.md body text requires disciplined English-only authoring of new chapters.
2. **`build.files` exclusion has allowlist-semantic fragility** — the5 `!` entries only work in the default include-all mode; a future positive allowlist would silently re-include `.planning/`.
3. **Packaged .app verification is manual and environment-dependent** — it requires the user to close their running Realm instance, and the Nightly path hasn't been verified to inherit `asarUnpack` from `package.json` (flagged as assumption A2 in the research).

None of these are blockers, but each requires careful execution. The plans' explicit "反向验证" requirements (proving scanners aren't empty-circuited) and the `autonomous: false` gating on the packaged .app verification are appropriate mitigations.

---

## OpenCode Review

# Cross-AI Plan Review: Phase 47 - 内置技能播种 + bash 策略加固

## 47-01

**Summary:** 本计划建立了 Phase 47 的端到端纵切（tracer）：从随包 `skills-builtin/` 到播种模块到技能加载器的完整链路，同时将 find-skills 从上游的「安装说明书」改写为 Realm 的「零安装候选清单技能」。计划定义了 3 个任务，覆盖播种、原子性/差异诊断、零安装语义扫描器三个维度，测试基线从 0 例起步到预期 50+ 例。

**Strengths:**
- **纵切验证设计优秀**：Task 1 作为 tracer 任务横跨五个文件、四个层级，端到端验证「随包 → 播种 → 加载 → 零诊断 → 不进 prompt」，确保链路完整性
- **安全门禁前置**：P1 门禁的文本半（SEED-03）在 Task 3 被具体化为可执行的扫描器，且有反向验证证明非空转
- **原子性保障到位**：`safeCopyDir` 的 tmp → bak → rename → rollback 算法与同步阻塞策略，确保播种不留半成品
- **诊断形状对齐**：4 个新诊断 code 遵循 Phase 46 的 `toRealmDiag` 形状，可直接被 Phase 50 设置页消费
- **回归保护严格**：既有测试（117 例）被显式要求保持全绿，且有 agent-workspace.js 零 diff 的源码 gate

**Concerns:**
- **MEDIUM: 测试基线不确定性**。计划中提到"既有测试基线：agent-workspace 21 例、ai-skills 64 例、ai-bash-policy 32 例"，但未确认这些数字是否最新（计划声称从 0 例起步，但实际有基线）
- **MEDIUM: 播种依赖 `migrateAiMemory` 的时序**。计划明确播种必须在 `migrateAiMemory` 之后、`new AIManager` 之前，但未解释若 `migrateAiMemory` 失败（`catch` 分支）时播种是否仍应执行
- **LOW: `check_env.mjs` 的能力分组选择**。计划选择 4 个 capability（baseline/quick-validate/eval-viewer/description-optimize），去掉了 run-eval/run-loop，但未说明这 4 个分组是否覆盖 skill-creator 实际需要的全部场景
- **LOW: `getSeededSkillNames` 的硬编码风险**。虽然计划要求零硬编码，但测试断言中可能需要点名技能名，需确保测试文件自身不受此约束

**Suggestions:**
- 建议在 Task 1 的 read_first 中补充 `main.js:4040-4041` 的完整上下文，以验证播种时序的正确性
- 建议为 `safeCopyDir` 添加一个「源目录不存在」的提前返回分支，避免不必要的 `readdirSync` 开销
- 建议在 Task 3 的扫描器中明确标注「第 2 段扫描范围是 `skills-builtin/**/*` 且排除第 1 段已覆盖的文件」，防止与 47-03 的豁免清单冲突
- 建议为 `hashFile` 函数添加一个缓存机制（至少在单次 `detectDiff` 调用内），避免对同一文件重复计算

**Risk Assessment: MEDIUM**
计划整体设计扎实，但存在两个需关注的风险点：(1) 播种时序依赖 `migrateAiMemory` 的成功完成，若迁移失败可能导致 `managed-skills/` 目录状态不确定；(2) 测试基线数字需在实施前确认，避免基于过时数字规划测试增量。

---

## 47-02

**Summary:** 本计划实现了 P1 门禁的第二半：在 `ai-bash-policy.js` 中新增包管理器安装档，覆盖 13 个包管理器家族的安装/包执行语义，无论是否命中白名单一律走强制确认卡片。同时在 `ai-manager.js` 中为 install 档添加专属的确认卡片文案与 `riskLevel: 'high'`。

**Strengths:**
- **模式表设计精准**：13 条 `PACKAGE_MANAGER_INSTALL_PATTERNS` 经过 33 正例 + 34 反例 + 15 逃逸向量实测，正例 0 漏检、反例 0 误伤
- **流水线结构最小改动**：只在 `evaluateBashCommand` 中新增 `installNames` 收集与 `install` 短路分支，不改动 `splitCommandPipeline` / `matchesWhitelist` 等既有函数（32 条断言安全）
- **确认卡片三分支**：`isDanger` / `isInstall` / 默认三个分支语义清晰，`riskLevel` 正确映射（install 与 danger 同级）
- **门禁核心断言明确**：`evaluateBashCommand('npm i x', ['npm *'])` 仍返回 `reason === 'install'`，直接证明白名单不可越过
- **既有断言同步**：2 条 `deepStrictEqual` 按完整形状更新，且有反向验证证明门禁断言非空转

**Concerns:**
- **HIGH: `ai-manager.js` 的三分支改动可能遗漏其他消费点**。计划只检查了 `_createBashToolWithPolicy` 方法，但 `verdict` 可能被其他地方消费（如日志、遥测）。需确认 `install` 档的所有消费者都已更新
- **MEDIUM: `stripLeadingQuotes` 的位置选择**。计划明确只在 `matchInstall` 内部使用，但未说明为何不在 `normalizeSegment` 层面处理（后者是所有判定的公共入口）。需确认这不会导致 `matchDangerous` 的行为漂移
- **MEDIUM: 逃逸向量的处理**。计划承认 `npm --prefix X i Y` 类取值旗标形态不覆盖，但未给出该缺口的严重性评估（实际使用频率、绕过难度）
- **LOW: `PACKAGE_MANAGER_INSTALL_PATTERNS` 的可维护性**。13 条模式表随新包管理器出现需要更新，但未说明如何在 Phase 48+ 发现新家族时扩展

**Suggestions:**
- 建议在 `ai-bash-policy.js` 的 JSDoc 中添加「本表的维护约定」：新增家族只需在 `PACKAGE_MANAGER_INSTALL_PATTERNS` 数组中追加 `{ pattern, name }` 条目
- 建议为 `install` 档添加一个独立的 `reason` 字符串常量（如 `const REASON_INSTALL = 'install'`），避免多处字符串比较
- 建议在测试中添加一个「模式表完整性」断言：`PACKAGE_MANAGER_INSTALL_PATTERNS.length >= 13` 且每条 `name` 非空
- 建议在 Task 2 的残余风险记录中明确写出「命令替换 / 变量间接的严重性判断」—— 它们也不命中白名单，所以实际风险有限

**Risk Assessment: MEDIUM**
计划的核心逻辑（install 短路先于白名单）设计正确且有充分测试覆盖。主要风险是 `ai-manager.js` 的三分支改动可能影响其他消费点（需代码搜索确认），以及逃逸向量的缺口需要在文档中如实记录。

---

## 47-03

**Summary:** 本计划将 skill-creator 作为固定 SHA 的上游快照随包分发，经六处受控改写后消除平台专有内容；新增 `check_env.mjs` 环境预检脚本；建立 `THIRD_PARTY_NOTICES.md` 归属记录。同时将 SEED-03 扫描器从单技能扩展到两个技能，并为 SKILL-09 提供反向证据断言。

**Strengths:**
- **上游快照策略清晰**：18 个文件逐字保留 + 1 个 Realm 自研脚本，字节数有精确护栏（LICENSE.txt 必须 11,357 B）
- **六处受控改写有明确判据**：每处改动都有功能正确性或合规性理由（如删除 `present_files` 章节是因为 Realm 没有该工具）
- **`check_env.mjs` 能力收缩合理**：去掉依赖 `claude` CLI 的 `run-eval` / `run-loop`，保留 4 个 Realm 实际需要的能力
- **P10 归属五要素齐全**：来源仓库、固定 SHA、许可证、是否修改、修改说明全部明确，且两个技能都标 `modified`（fail-safe）
- **行级豁免机制**：`check_env.mjs` 的「禁止安装」声明被精确豁免，反向验证证明豁免机制有效

**Concerns:**
- **HIGH: `SKILL.md` 的六处改动可能引入回归**。计划声称「只做六处受控改动，其余正文逐字保留」，但删除三章、新增两章、修改 frontmatter 的组合可能导致 `## Reference files` 清单不同步。需确认该清单与实际随包文件一致
- **MEDIUM: `check_env.mjs` 的 `spawnSync` 失败处理**。计划提到「传 timeout 时失败会带 `result.error`」，但未明确说明 `result.error` 的具体形态（是 Error 对象还是字符串？）。需确认 `result.error || result.status !== 0` 双判的正确性
- **MEDIUM: `THIRD_PARTY_NOTICES.md` 的维护负担**。两个技能的修改说明长达 10+ 项，未来版本升级时需人工同步。未说明是否有自动化检查机制
- **LOW: `agents/*.md` 的平台专有内容检查**。计划提到「核对三个 agents/*.md 是否引用 Claude 平台专有工具」，但未给出具体的检查方法或已知问题清单

**Suggestions:**
- 建议在 Task 1 的 Step 2 完成后立即运行 `grep -n "present_files\|Claude\.ai\|Cowork" skills-builtin/skill-creator/SKILL.md`，确认三处平台专有内容已被删除
- 建议为 `check_env.mjs` 添加一个 `--dry-run` 参数，用于测试而不实际执行探测（降低测试的副作用）
- 建议在 `THIRD_PARTY_NOTICES.md` 中添加一个「最后更新日期」字段，便于未来版本升级时核对
- 建议在 Task 4 的反向验证中明确记录：临时添加 `pip install pyyaml` 后第 1 段扫描变红的**具体错误输出**，作为证据留痕

**Risk Assessment: MEDIUM**
计划的上游快照策略和归属记录设计正确，但存在两个需关注的风险：(1) SKILL.md 的六处改动可能导致 `Reference files` 清单不同步，需在实施时仔细核对；(2) `check_env.mjs` 的 `spawnSync` 失败处理细节需在实施时验证。

---

## 47-04

**Summary:** 本计划收口 Phase 47 的两道门禁：给打包产物补上 `.planning/**` 的排除项（消除随包分发 RCE 说明书的残余路径）；在真实打包的 .app 上验证内置技能播种；把「内置技能」与「bash 包管理器安装档」两章写进三份文档。

**Strengths:**
- **打包排除项设计保守**：选最小 `!` 排除而非完整 allowlist，保留默认包含语义，避免漏列 `skills-builtin/**` / `THIRD_PARTY_NOTICES.md`
- **打包验证安全路径**：优先 `make install-nightly` 而非 `make install`，避免删掉用户运行中的正式版实例
- **文档同步口径一致**：三份文档统一沿用「三档权限」框架，不出现「四档」说法
- **既有文档零改动**：`ai-skills.md` 的既有七节结构、`ai-agent-workspace.md` §四的标题、§七的 4 条诚实边界一字不动
- **测试护栏完整**：配置级断言（`build.files` 的 5 条排除项存在）+ 静态文本断言（关键章节标题与关键词）+ 口径一致性断言

**Concerns:**
- **HIGH: `build.files` 的 `!` 排除可能遗漏其他敏感目录**。计划只排除了 5 个目录（`.planning`、`.claude`、`.gsd`、`.wzsh`、`.zcode`），但仓库根可能还有其他不应随包的目录（如 `test/`、`.github/`）。需确认是否还有其他排除项
- **MEDIUM: `make install-nightly` 的验证效力**。计划声称 Nightly 版与正式版等价（同一 `app.isPackaged` 分支），但未说明 `--config` 参数是否会覆盖 `build.asarUnpack`。若覆盖则 Nightly 构建可能不包含 `skills-builtin/**`
- **MEDIUM: 文档同步的维护成本**。三份文档需要在能力变更时同步更新，但未说明是否有自动化检查机制（如测试断言确保文档与代码一致）
- **LOW: `AGENTS.md` 的测试行计数**。计划要求把过时的「29 例」改为实测计数，但未给出具体数字（需以 47-02 落地后的实跑输出为准）

**Suggestions:**
- 建议在 Task 1 的改后取证中显式断言以下目录**不在** asar 清单中：`test/`、`.github/`、`node_modules/.cache/`（若有）
- 建议在 Task 3 的验证步骤中添加一个「Nightly 版 asar 包含 `skills-builtin/**`」的检查，确认 `--config` 没有覆盖 `build.asarUnpack`
- 建议在 `docs/product/ai-skills.md` 的维护约定块中添加「修改 `skills-builtin/**` 必须同步核对 `THIRD_PARTY_NOTICES`」的提醒
- 建议在 Task 3 的 SUMMARY 中明确记录 Nightly 版的**实际 userData 路径**（`~/Library/Application Support/realm-nightly/`），避免路径错误

**Risk Assessment: MEDIUM**
计划的打包排除项和文档同步设计合理，但存在两个需关注的风险：(1) `build.files` 的排除项可能遗漏其他敏感目录，需在实施时完整审查；(2) `make install-nightly` 的验证效力需在实跑时确认（`--config` 是否覆盖 `build.asarUnpack`）。

---

## Cross-Plan Comparison

### Dependency Ordering
四个计划的依赖关系清晰：
- **Wave 1**: 47-01（独立，tracer）
- **Wave 2**: 47-02（依赖 47-01）+ 47-03（依赖 47-01）—— 可并行
- **Wave 3**: 47-04（依赖 47-01 + 47-02 + 47-03）

**优势**：Wave 2 的两个计划互不依赖，可并行执行，缩短总体工期。
**风险**：若 47-01 延期，Wave 2 和 Wave 3 都会被阻塞。建议 47-01 的 Task 1（端到端纵切）尽早完成，作为后续计划的基础。

### P1 门禁的闭合路径
P1 门禁需要两半同时落地：
- **第一半（内置技能文本零安装语义）**：47-01 Task 1 + Task 3（扫描器）→ 47-03 Task 1 + Task 4（扩展到两个技能）
- **第二半（安装档强制确认）**：47-02 Task 1 + Task 3（门禁信号断言）

**优势**：两半的实现路径独立，可并行推进。
**风险**：若只完成一半，P1 门禁仍不闭合。建议在 47-04 的打包实跑验证中同时检查两半的生效状态。

### 测试覆盖的一致性
四个计划都要求测试覆盖，但基线数字不一致：
- 47-01 声称从 0 例起步
- 47-02 声称从 32 例起步（ai-bash-policy）
- 47-03 声称从 64 + 21 例起步（ai-skills + agent-workspace）
- 47-04 要求全量回归绿

**建议**：在实施前统一确认测试基线（实际 `node --test` 输出），避免基于过时数字规划。

---

## Overall Risk Assessment

### HIGH Risks
1. **`.planning/**` 的 asar 泄漏**（47-04 Task 1）：这是 P1 门禁在分发面的旁路，必须堵。若遗漏，随包分发的 `PITFALLS.md` 仍含逐字的 `npx skills add -g -y`
2. **`ai-manager.js` 的三分支改动可能遗漏其他消费点**（47-02 Task 1）：`verdict` 可能被日志、遥测等其他地方消费，需确认所有消费点都已更新

### MEDIUM Risks
1. **播种时序依赖 `migrateAiMemory` 的成功完成**（47-01 Task 1）：若迁移失败，`managed-skills/` 目录状态不确定
2. **`make install-nightly` 的验证效力**（47-04 Task 3）：`--config` 参数可能覆盖 `build.asarUnpack`，导致 Nightly 构建不包含 `skills-builtin/**`
3. **SKILL.md 的六处改动可能导致 `Reference files` 清单不同步**（47-03 Task 1）

### LOW Risks
1. **逃逸向量的缺口**（47-02 Task 2）：`npm --prefix X i Y` 类取值旗标形态不覆盖，但实际使用频率低
2. **`THIRD_PARTY_NOTICES.md` 的维护负担**（47-03 Task 3）：未来版本升级需人工同步修改说明
3. **文档同步的维护成本**（47-04 Task 2）：三份文档需在能力变更时同步更新

---

## Recommendations

1. **统一测试基线**：在实施前用 `node --test` 跑一次全量测试，确认实际基线数字
2. **确认 `build.files` 的完整排除清单**：审查仓库根所有不应随包的目录，避免遗漏
3. **验证 `make install-nightly` 的 `asarUnpack` 行为**：确认 `--config` 没有覆盖 `build.asarUnpack`
4. **检查 `ai-manager.js` 的所有 `verdict` 消费点**：确保 `install` 档的所有消费者都已更新
5. **在 47-04 的 SUMMARY 中记录所有验证的原始输出**：包括 `pgrep`、目录清单、诊断状态，作为 SEED-05 的唯一验收面

> [editorial note] opencode lane 的输出尾部附带了一段会话上下文回显（"Objective" / "Work State" / "Relevant Files" 三节）与一句收尾对话，均非评审内容，已在此截断以免污染评审正文。

---

## Consensus Summary

**Lane availability.** 本次评审只有 **2 个 lane** 产出真实评审（claude、opencode）。其余被检测到或已声明的 lane 均不可用 —— `--all` 语义下「没找到没人点名的 lane 是正常的」，但评审覆盖因此确实少了一只眼睛，逐条如实记录：

| lane | 状态 | 失败原因（实测） |
|---|---|---|
| gemini | dropped | 二进制在，认证失败：`You do not have a valid license of this product`（Code Assist 未授权） |
| codex | dropped | `401 Unauthorized: Invalid API Key`（provider `newapi` → `token-plan-cn.xiaomimimo.com/v1/responses`） |
| qwen | dropped | 无输出、长期挂起（trivial prompt 跑到 4m47s 仍无响应）；为避免拖死整个 lane loop 未派发 |
| coderabbit / cursor / agy | undetected | 二进制未安装 |
| ollama / lm_studio / llama_cpp | undetected | 本地无监听（11434 / 1234 / 8080 均 `ECONNREFUSED`） |
| kimi | n/a | 非 GSD 声明的 lane |

**Shared-adapter caveat.** 两个成功 lane 都经第三方网关路由（`claude` CLI 的 `ANTHROPIC_BASE_URL=api.xiaomimimo.com/anthropic`；`opencode` 走 `~/.config/opencode/opencode.json` 里的 Xiaomi MiMo token-plan provider）。两者可能属同一模型家族，**独立评审的多样性弱于名义上的「两个 AI 系统」** —— 下文共识按「同一网关的两个独立会话」加权，分歧项单列。

**Plan coverage.** 两个 lane 都逐一提到了全部 4 个 plan id（本地覆盖检查：`{complete: true, missing_ids: [], total: 4}`）。

### Agreed Strengths

- **Tracer 优先与 Wave 结构正确。** 两个 reviewer 都认可 47-01 先打通「随包 → 播种 → 加载 → 零诊断 → 不进 prompt」这条最薄纵切，再让 Wave 2 在已验证链路上叠语义；Wave 1 → (Wave 2 并行) → Wave 3 的依赖关系两方均判为正确，且 47-02 与 47-03 确实互不依赖（改的文件集不相交）。
- **install 短路先于 `matchesWhitelist` 是本阶段的正确核心。** 两方都把它认定为 P1 门禁第二半的判据，并认可 `danger → install → whitelist → default` 的返回顺序（`sudo npm i x` 仍应是 `danger`）。
- **模式表来自实测而非现设计。** 13 条 `PACKAGE_MANAGER_INSTALL_PATTERNS` 逐字取自 RESEARCH §E-1（33 正例 / 34 反例 / 15 逃逸向量实测），两方都认为这消除了策略类改动最常见的正则设计错误。
- **`safeCopyDir` 的原子性与 `detectDiff` 不用 mtime。** 两方都认可 tmp → bak → rename → rollback 的写法、tmp/bak 必须同父目录（避开 macOS `/var/folders` 的 `EXDEV`），以及「每次启动都覆盖会让 mtime 必变 → mtime 判差异等于 100% 误报」的推理。
- **归属声明的 fail-safe 取向。** 两个技能一律标 `modified`（Apache-2.0 §4(b)：漏声明是违约、过度声明无风险），以及「`LICENSE.txt` 无诊断 ≠ 文件存在、必须逐字节断言落盘」的 P10-5 补充，两方都判为正确。
- **最小 `!` 排除优于完整 allowlist。** 两方都认可 47-04 选 5 条 `!` 排除而不是正向 allowlist 的理由（allowlist 漏列 `skills-builtin/**` / `THIRD_PARTY_NOTICES.md` 会让 SEED-05 与 P10 同时失效）。
- **残余风险的诚实记录与反向验证要求。** 命令替换 / 变量间接 / `echo "npm install"` 字面量误报都被写进注释并附严重性佐证；两方都认可「临时删条目 / 加一行安装语使断言变红再还原」这类反向验证是必要动作。

### Agreed Concerns

1. **[HIGH] `build.files` 的 `!` 排除只在「无正向 allowlist」语义下生效 —— 这是本阶段最脆的一处。** claude 指出：一旦日后有人加正向 `files` allowlist，这 5 条 `!` 会静默变成 no-op，`.planning/**`（含逐字 `npx skills add -g -y` 的 `PITFALLS.md`）重新入包，而现有测试护栏（只断言 5 条 `!` 存在）仍会通过；opencode 从另一个方向问同一件事：5 条排除是否遗漏了仓库根其他不该随包的目录。两方都要求把「这些排除项的前提条件」写进代码注释 / 测试注释，并补一条「`THIRD_PARTY_NOTICES.md` / `skills-builtin/**` 未被任何排除项命中」的断言。
2. **[MEDIUM-HIGH] 打包态验证的效力与不可自动化。** claude：`make install-nightly` 是否继承 `package.json` 的 `asarUnpack` 本身未被验证（research 把它列为假设 A2），且整个判据依赖人工、依赖用户先关掉正在运行的实例；opencode：`install-nightly` 若带 `--config` 是否会覆盖 `build.asarUnpack`。两方都要求在 Task 3 的实跑记录里显式确认「Nightly 的 asar 清单含 `skills-builtin/**`」，而不只是确认 userData 下的播种结果。
3. **[MEDIUM] SKILL.md 的受控改写与「豁免 / 清单」之间的脆弱耦合。** claude：`body 不含 CJK` 这条断言要求新增的 `## Environment Preflight` 与两处前置句必须用英文撰写，但计划没有给出「谁来保证不写中文」的机制；opencode 从另一侧指出删除三章 + 新增章节后 `## Reference files` 清单极易与实际随包文件集不同步（HIGH）。两方都要求把「英文撰写」写成显式动作项、把清单同步作为独立断言并核对。
4. **[MEDIUM] 测试基线数字需要以实跑为准，不要沿用文档里的旧数。** 两方都发现计划/文档引用的计数彼此不一致（AGENTS.md 的「29 例」已过时），都要求在写 AGENTS.md 前先跑一次全量测试取真实数字。**本条已由本次评审的独立复核判定（见下）。**
5. **[MEDIUM] install 档残余风险的严重性论证不足。** claude 要求把 `npm ci` 为何计入安装档（不取新代码但执行所有依赖的 `postinstall`）写进代码注释而不只写在计划里；opencode 指出逃逸向量（`npm --prefix X i Y` / 命令替换 / 变量间接）缺少使用频率与绕过难度的判断。两方都要求在文档与注释里补齐这条论证，而不是只列现象。

### Divergent Views

- **47-01 / 47-02 的风险定级相反。** claude 给这两个计划 `LOW`（「位置全部经源码核验、改动面最小、残余风险有 fail-safe 默认值」），opencode 给 `MEDIUM`（并列了两个 `HIGH`）。差异主要来自 opencode 对两处不确定性的估计更保守，而非发现了 claude 漏看的缺陷。
- **`ai-manager.js` 是否有其他 `verdict` 消费点。** opencode 把这个列为 **HIGH**（「`verdict` 可能被日志、遥测等地方消费，需确认所有消费点」）；claude 判为「改动最小且范围明确」。**本次复核站在 claude 一侧**（见下）。
- **测试基线的具体误读方向不同。** claude 称 `tests/test-ai-skills.js` 有 75 处 `test(`（并据此说 research 的 64 不可信）；opencode 称「47-01 声称从 0 例起步」。两者都是误读，但指向同一结论：基线数字要以实跑为准。

### Adjudication（评审侧对仓库的独立复核）

以下事实由本次评审直接对仓库实测，用于收敛上述分歧、并检出两个 reviewer 都没抓到的计划内自相矛盾：

**已收敛的分歧**

- **测试基线（实测，`node --test` 汇总行）**：`tests/test-ai-bash-policy.js` = **32 例**、`tests/test-ai-skills.js` = **64 例**、`tests/test-agent-workspace.js` = **21 例**，三者 `# fail 0`。计划里的 32 / 64 / 21 **全部正确**；claude 的「75」是把 `grep -c "test("` 的嵌套/多行计数当成用例数，opencode 的「从 0 例起步」是对「本阶段新建测试文件」的误读。AGENTS.md 的「29 例」确已过时 —— 47-04 Task 2 已计划修正，方向正确。
- **`verdict` 消费点**：`evaluateBashCommand` 在生产代码中**只有 `ai-manager.js:5647` 一个调用点**，`verdict.level` / `verdict.reason` / `verdict.dangerNames` 的使用集中在 `:5650-5654`（`docs/plan/ai-file-bash-tools-integration.md` 另有一处**文档**描述返回值形状，非代码消费）。opencode 的「日志 / 遥测等未审查消费点」不成立。
- **白名单缺口确实存在（47-02 的核心断言针对真实缺口）**：当前 `evaluateBashCommand('npm i x', ['npm *'])` → `{level:'allow',dangerNames:[]}`，`evaluateBashCommand('brew install wget', ['brew *'])` → 同样 `allow`；`('npm i x', [])` → `confirm/default`。`DANGEROUS_INTERPRETERS` 含 `sh/bash/.../python3/node/...` 但**不含 `npx`**。
- **其余被引用位置的抽查全部对得上**：`ai-bash-policy.js` 263 行；`_createBashToolWithPolicy` 在 `ai-manager.js:5630`，`isDanger` 在 `:5651`，`title`/`riskLevel` 在 `:5659`/`:5661`；`main.js` 的 `ensureWorkspaceDir()` / `migrateAiMemory()` / `new AIManager()` 在 `:4040`/`:4041`/`:4044`；`package.json` 的 `build` 段**当前无 `files` 字段**、`asarUnpack` 仅 `node_modules/nodejieba/**`；`.planning/research/PITFALLS.md:37` 确有逐字 `npx skills add <owner/repo@skill> -g -y`；SDK 的 `MAX_DESCRIPTION_LENGTH = 1024` 在 `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js:5`；`refreshSkills(env, { disabled, rootDirs })` 签名与计划用法一致；`disableModelInvocation` 由 `ai-skills-manager.js:96/:398/:586` 真正消费。

**两个 reviewer 都没抓到、但会影响收尾判定的四处计划内问题**

1. **`realm_builtin_src_invalid` 在设计的控制流里无法触发（47-01 Task 2）。** 该诊断的触发条件写作「源目录下某子目录缺 `SKILL.md`」，但 `seedBuiltinSkills()` 只遍历 `getSeededSkillNames()` 的返回，而后者已用 `fs.existsSync(path.join(dir,'SKILL.md'))` 过滤掉这类目录 —— 那条诊断永远收不到输入。47-01 Task 2 却把它描述为「与 `getSeededSkillNames()` 的过滤互为表里」。需要么补一次独立的源目录扫描，么明确该 code 仅作保留、并去掉「互为表里」的表述。
2. **47-03 Task 1 的 acceptance 自相矛盾。** 同一条里既写「19 个相对路径」又写「`scripts/check_env.mjs` 除外 —— 本任务只要求 18 个上游文件」。Task 1 只产出 18 个上游文件（`check_env.mjs` 由 Task 2 产出），清单应统一为 18。
3. **ROADMAP 的成功判据 1 从未被任何计划同步。** ROADMAP `Phase 47` 成功判据 1 的原文仍是「重启不重复播种、不覆盖用户修改（**版本戳登记表**幂等）」，而 D-08/D-09 已显式改为「每次启动无条件覆盖 + 差异诊断」，CONTEXT 也把它记为「与需求字面偏离的两处」之一。四个计划的 `files_modified` 都**不含 `.planning/ROADMAP.md`**（只在 context 引用里出现）。这意味着 phase 收尾时会出现「按 D-08 实现 → 判据 1 字面不成立」的判定歧义，**需要在规划收敛时顺手改掉判据文字**（或明确记录该判据被 D-08/D-09 取代）。
4. **47-03 引用的仓库外参照路径有 typo 且在外置卷上。** 47-03 Task 2 的 read_first 把 `openhanako` 写成 `openhanbao`（CONTEXT 与 47-03 Task 1 均用 `openhanako`），且路径在 `/Volumes/ZhiTai/...`（外置卷，未必挂载）。该条自带「若不可访问则按 RESEARCH §Pattern 5 / §B-3 独立实现」的退路，退路本身合格，但 typo 会让实施者白找一趟。
