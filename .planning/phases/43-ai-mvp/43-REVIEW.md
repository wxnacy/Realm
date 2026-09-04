---
phase: 43-ai-mvp
reviewed: 2026-08-11T10:30:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - ai-manager.js
  - ai-memory-manager.js
  - container-manager.js
  - main.js
  - package.json
  - src/renderer.js
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - test/memory/helpers.js
  - test/memory/scenario-harness.js
  - test/memory/storage.test.js
  - test/memory/threat-scan.test.js
  - test/memory/fixtures/adversarial-01-injection-transcribe-a.js
  - test/memory/fixtures/adversarial-02-injection-transcribe-b.js
  - test/memory/fixtures/adversarial-03-credential.js
  - test/memory/fixtures/adversarial-04-cross-container-leak.js
  - test/memory/fixtures/adversarial-05-dangling-id.js
  - test/memory/fixtures/adversarial-06-budget-silent.js
  - test/memory/fixtures/boundary-01-empty-read.js
  - test/memory/fixtures/boundary-02-multi-container-read.js
  - test/memory/fixtures/boundary-03-session-refusal.js
  - test/memory/fixtures/critical-path-01-add-user.js
  - test/memory/fixtures/critical-path-04-replace.js
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
gap_closure_reviewed: 2026-09-04
gap_closure_findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
---

# Phase 43: Code Review Report

**Reviewed:** 2026-08-11T10:30:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed Phase 43 AI 记忆 MVP at standard depth: the storage layer (`ai-memory-manager.js`), the two Agent tools (`memory` / `memory_read` in `ai-manager.js`), container-delete cleanup (`container-manager.js`), the `/api/ai-memory` endpoint (`main.js`), and the settings-page editing section (`settings-page.js` / `settings.html` / `main.css`), plus all 14 fixture/harness/test files.

Verification performed: all modified JS files pass `node --check`; `npm run test:memory` passes 56/56; `node test/memory/scenario-harness.js --dry-run` validates 14/14 fixtures. Both Agent creation sites (`init()` line 751 and `_recreateAgent()` line 2169) route through `buildSystemPrompt()` — no missed snapshot injection point. Container-ID path traversal is correctly blocked in `resolveFile` / `parseScope` / `deleteContainerMemory`; the `/api/ai-memory` endpoint is token-gated (`REALM_TOKEN`, `crypto.randomUUID()`), and the human-edit path (`writeScope`, no threat scan) matches locked decision D-11 and is NOT flagged. No XSS: all settings-page dynamic content uses `textContent` / DOM APIs, no `innerHTML` with data; CSP-compliant initial hiding via CSS class (`.ai-memory-container-select { display: none }`), CSSOM toggling with concrete values.

Overall the implementation is solid and fail-closed discipline is consistently applied. The 3 warnings below are correctness/robustness gaps in entry-identity semantics (duplicated lines, forged entry lines via multi-line content) and a settings-page zero-containers edge case. No blockers.

## Warnings

### WR-01: replace/remove use line-identity matching — duplicated identical lines corrupt multiple entries

**File:** `ai-memory-manager.js:240-245`
**Issue:** `write()` locates the target entry by comparing full line text (`lines.map(line => line === hit.line ? ...)` for replace, `lines.filter(line => line !== hit.line)` for remove). If a layer file ever contains two byte-identical entry lines (e.g. `[M3] foo` twice), replace rewrites BOTH lines to `[M3] <new content>` (creating two entries with the same ID `M3`), and remove deletes BOTH entries. This silently violates the D-09 "编号精确改写" invariant and causes data loss beyond the requested entry. The path is reachable: the human-edit path is a first-class feature (`writeScope` raw-text replace via settings page — paste/copy operations can easily produce duplicate lines), and manual `USER.md`/`MEMORY.md` editing is an explicitly supported workflow (D-11, error messages reference "人工编辑"). `parseEntries` already parses the ID — identity should be positional, not textual.
**Fix:**
```javascript
// parseEntries 已有逐行顺序；记录行索引，按索引改写/删除
function parseEntries(text) {
  const entries = [];
  const lines = String(text || '').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(ENTRY_LINE_RE);
    if (m) entries.push({ id: `M${m[1]}`, num: parseInt(m[1], 10), line, index: i });
  });
  return entries;
}
// replace/remove：
const hit = entries.find(e => e.id === entryId);
if (!hit) { /* 现有 throw */ }
if (action === 'replace') {
  lines[hit.index] = `[${entryId}] ${content.trim()}`;
  merged = lines.join('\n');
} else {
  lines.splice(hit.index, 1);
  merged = lines.join('\n');
}
```
(重复 ID 行本身仍需处理——见 WR-02——但按索引定位后重复行不再引发连锁改写。)

### WR-02: add/replace 不校验换行——content 可伪造 `[MN]` 条目行，破坏 D-09/D-10 编号不变式

**File:** `ai-memory-manager.js:229-233`（add 合并逻辑）、`ai-manager.js:4576-4579`（工具 description 未约束单条目）
**Issue:** `write()` 对 content 只做 `trim()`，不禁止内嵌换行。`memory` 工具的 LLM 调用方可以写入多行正文（如 `foo\n[M99] 伪造条目`），该行会被 `parseEntries` 当作真实条目 M99：下一次 add 跳号到 M100（破坏 D-10 连续语义）、`replace/remove` 的 `find(e => e.id === entryId)` 命中歧义、`memory_read` 回读展示伪造条目。威胁扫描拦不住无注入措辞的伪造编号行。对 LLM 自发行为是格式约定问题，但对「网页内容诱导转写」场景（本 phase 的威胁模型 T-43-01）这是一个绕过扫描即可持久化结构化投毒条目的通道——只要载荷不命中 INJECTION_PATTERNS 措辞。
**Fix:**
```javascript
// write() 的 add/replace 分支在扫描前追加：
if (/[\r\n]/.test(content)) {
  throw new Error('条目正文须为单行文本（请去除换行；多行内容请拆成多条 add）');
}
```
或至少拒绝会伪造条目行的内容：`if (content.split('\n').some(l => ENTRY_LINE_RE.test(l))) throw ...`。前者更符合「条目 = 一行」的 D-09 模型，工具 description 同步注明「content 必须单行」。

### WR-03: 容器 tab 零容器（或容器 API 失败）时产生非法 scope `container:`，显示误导性报错

**File:** `src/settings-page.js:3641-3671`（`loadAiMemory`）、`3674-3703`（`switchAiMemoryTab`）、`3705-3746`（`saveAiMemory`）
**Issue:** `fetchContainers()` 失败时返回 `[]` 而非 throw（`settings-page.js:87-90`），全部容器被删除时列表也为空。此时 `aiMemoryState.containerId = ''`，`aiMemoryCurrentScope()` 返回 `container:`，`main.js` 的 `parseAiMemoryScope`（长度校验）拒绝之 → GET 400 → 状态行显示「保存失败：非法的记忆 scope（合法值：user / global / container:<id>），请重试」——对一个合法的「零容器」空态显示了保存失败 + 泄露内部实现细节的错误文案；保存按钮也未被禁用，点击同样 400。UI-SPEC 明确要求 zero-containers 有专门 resolution。
**Fix:**
```javascript
async function loadAiMemory() {
  if (aiMemoryState.tab === 'container' && !aiMemoryState.containerId) {
    textarea.value = '';
    aiMemoryState.budget = 0;
    setAiMemoryHint('暂无容器，创建容器后可使用容器记忆');
    if (saveBtn) saveBtn.disabled = true;
    return;
  }
  // …原逻辑
}
// saveAiMemory 开头同样加该 guard
```

## Info

### IN-01: 取数失败复用「保存失败」文案，语义错位

**File:** `src/settings-page.js:3662`
**Issue:** `loadAiMemory` 的 catch 显示「保存失败：…」——这是 GET（读取）路径，用户没有执行保存操作。UI-SPEC error resolution 应区分「加载失败」。
**Fix:** 该行改为 `加载失败：${err.message}，请重试`。

### IN-02: 保存过程中状态行显示「加载中…」

**File:** `src/settings-page.js:3722`
**Issue:** `saveAiMemory` 保存期间 `setAiMemoryHint('加载中…')`，与实际动作（保存）不符。
**Fix:** 改为 `'保存中…'`。

### IN-03: 对同步函数 `deleteContainerMemory` 使用 `await` 且注释理由不成立

**File:** `container-manager.js:310-312`
**Issue:** 注释称「必须 await：删除方保证原子性」，但 `deleteContainerMemory` 是同步函数（内部全 `*Sync`，返回 `undefined`），`await` 无实际效果，注释描述的异步原子性保证并不存在（当然也无害——同步调用本身就是原子的）。注释会误导后续维护者以为存在异步时序约束。
**Fix:** 二选一：去掉 `await` 并把注释改为「同步删除，调用方无需时序保证」；或保持 `await` 但修正注释为「防御性 await，manager 当前为同步实现」。

### IN-04: scope 白名单逻辑在 main.js 与 manager 间重复且口径不一

**File:** `main.js:2163-2175`（`parseAiMemoryScope`）vs `ai-memory-manager.js:273-284`（`parseScope`）
**Issue:** main.js 的 `parseAiMemoryScope` 是 manager `parseScope` 的宽松重复实现（不校验容器 ID 形态）。安全上无洞——`readScope`/`writeScope` 内部会再经 `parseScope` 严格校验——但两处白名单需要人工保持同步，新增 scope 枚举时容易漏改 main.js 侧（manager 会 throw，最终行为正确，但 main.js 的 400 文案会先于 manager 的更精确报错出现）。
**Fix:** 让 main.js 直接复用 `aiMemoryManager` 暴露的 `parseScope`（导出它），删掉本地 `parseAiMemoryScope`；或至少在注释里声明 main.js 侧只是「快速失败预检，权威校验在 manager」。

## Gap-Closure Review (2026-09-04)

**Reviewed:** 2026-09-04 (gap-closure increment)
**Depth:** standard
**Scope:** commits `0b6a091` (systemPrompt 双负向规则 + harness 路径收口)、`3ac94bf` (层级归属正向指引)、`62b0d6f` (G-43-2 成功提示守卫)
**Files Reviewed:** 3 — `ai-memory-manager.js`, `test/memory/scenario-harness.js`, `src/settings-page.js`
**Status:** issues_found (0 Critical / 1 Warning / 1 Info — 无阻断项)

### Summary

Reviewed the three gap-closure commits at standard depth, reading the full hunks in their current working-tree context (not just the diffs).

**ai-memory-manager.js (`0b6a091` + `3ac94bf`)**: The new snapshot sections (层级归属正向路由 + 双负向安全规则) are static text appended to `buildGlobalSnapshot`'s `lines` array — pure additive string building, no logic. Cross-checked against `ai-manager.js`: the referenced tool names `read_page_content` / `extract_links` (ai-manager.js:3304, 3403) and `memory` tool `target` enum `user/global/container` (ai-manager.js:4566-4569) all exist and match the rule text — no prompt/tool drift. Rules are frozen into the snapshot at agent creation (D-04), so they apply to new sessions only; that is documented design, not a defect. Note the JS string concatenation means the markdown renders as single lines (bullets/headings are line-separated correctly via the `lines` array).

**test/memory/scenario-harness.js (`0b6a091`)**: The three `require` paths `../` → `../../` are correct for `test/memory/` → repo root (`../../ai-memory-manager`, `../../ai-manager`, `../../ai-conversations-manager`). `FIXTURES_DIR` uses `path.join(__dirname, 'fixtures')` and is unaffected. No other relative requires remain broken (grep-verified).

**src/settings-page.js (`62b0d6f`)**: Guard logic traced through all state transitions: `updateAiMemoryCount` computes `over` (line 3606) before the guard check (line 3620) — no use-before-declaration; count/button updates occur before the guard short-circuit, so 字数统计/超限置红/按钮禁用 are never suppressed (D2 claim holds). Over-budget while guard active clears the guard and shows the danger hint (超限优先, T-43-09). Input listener, `switchAiMemoryTab`, and the 2s callback's unconditional first-line reset close all "残留 true" paths for the guard boolean itself. The one gap found is the **untracked setTimeout**: the timer id is never stored or cleared, so a stale timer from a previous save can truncate a newer one — see GC-W-01.

Both modified JS files pass `node --check`. No Critical issues; the gap-closure increment is sound overall.

### Warnings

#### GC-W-01: 成功提示 2 秒定时器未追踪/未清除——连续两次保存时 stale timer 截断第二次「已保存」

**File:** `src/settings-page.js:3761-3768` (`saveAiMemory` 的 `setTimeout`)
**Issue:** `saveAiMemory` 每次成功都新建一个 2 秒匿名 `setTimeout`，timer id 不入 `aiMemoryState`、置位前不清除旧 timer。守卫布尔值本身无残留 true 路径，但 stale timer 有两条可复现的干扰路径：

1. **截断第二次成功提示**：save#1 成功（t=0，guard=true，timer#1）。finally 释放 busy 后按钮立即可用，用户在 t<2s 内再次保存并成功（t=1s，guard=true，timer#2）。t=2s 时 timer#1 触发：`hint.textContent === '已保存'` 命中的是**第二次**保存的提示 → `resetAiMemoryHint()` 把第二次「已保存」在仅 1.5s 时提前抹掉。
2. **守卫真空窗口**：timer#1 首行无条件 `successHintActive = false`，到 timer#2 触发（t=2.5s）前的 0.5s 内守卫处于 false 但 hint 仍为「已保存」——此窗口内任何 `updateAiMemoryCount` 调用（如容器下拉 change → `loadAiMemory` finally）都会提前覆盖 hint。同理 save#2 **失败**时守卫未被 catch 清除，timer#1 触发照样会命中失败后重试成功的第三次保存提示。

失败场景本质：瞬态 UI 反馈的存活期由「最后一次保存」决定，而当前实现让「最早一次未到期 timer」也能裁决。
**Fix:**
```javascript
// saveAiMemory 成功分支：
if (aiMemoryState.successTimer) clearTimeout(aiMemoryState.successTimer);
aiMemoryState.successHintActive = true;
aiMemoryState.successTimer = setTimeout(() => {
  aiMemoryState.successHintActive = false;
  aiMemoryState.successTimer = null;
  const hint = document.getElementById('aiMemoryHint');
  if (hint && hint.textContent === '已保存') resetAiMemoryHint();
}, 2000);
// aiMemoryState 增加 successTimer: null 字段；switchAiMemoryTab 兜底清除处同步
// clearTimeout(aiMemoryState.successTimer) + 置 null。
```

### Info

#### GC-I-01: scenario-harness JSDoc 注释仍引用旧的 `../` 路径

**File:** `test/memory/scenario-harness.js:263`
**Issue:** `installStubs` 的 JSDoc 注释写「必须在 require('../ai-manager') 之前调用」，但本提交已把实际 require 改为 `../../ai-manager`（line 458）。注释与代码路径漂移，会误导后续按注释路径检索的维护者。
**Fix:** 注释同步改为 `require('../../ai-manager')`。

---

_Gap-Closure Reviewed: 2026-09-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (increment scope: 0b6a091, 3ac94bf, 62b0d6f)_

---

_Reviewed: 2026-08-11T10:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
