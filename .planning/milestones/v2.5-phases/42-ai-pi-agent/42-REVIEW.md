---
phase: 42-ai-pi-agent
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - AGENTS.md
  - ai-conversations-manager.js
  - ai-manager.js
  - ipc-handlers.js
  - src/index.html
  - src/preload.js
  - src/renderer.js
  - src/styles/main.css
findings:
  critical: 2
  warning: 4
  info: 11
  total: 17
  fixed:
    - CR-01 (prev round: getAgentMessages toolResult 配对)
    - WR-04 (prev round: parseStoredContent 旧格式启发式)
    - WR-05 (prev round: createNewConversation 未 await _recreateAgent)
    - IN-02 (prev round: conversationMeta 陈旧 model/provider)
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Re-review of Phase 42 (AI conversation history management) after the first fix round. Verified as fixed in current HEAD: the previous CR-01 (`getAgentMessages` now does two-pass toolCall/toolResult pairing with orphan synthesis, `ai-conversations-manager.js:665-724`), WR-04 (`isLegacyBlockArray` KNOWN_TYPES discriminator, `:253-259`), WR-05 (`createNewConversation` awaits `_recreateAgent`, `ai-manager.js:1746-1772`), and IN-02 (`conversationMeta` now taken from the target conversation, `ai-manager.js:1691-1694`).

The storage layer remains the strongest part: all SQL fully parameterized, transactional full-replace saves, WAL + foreign-key CASCADE, corrupt rows degrade via `safeJsonParse`, orphan/reverse-orphan toolCall pairing closed in both directions. XSS handling is correct across the new UI: conversation list / context menu / dialogs use `textContent` exclusively, AI message HTML passes DOMPurify with an escape-all fallback, tool cards use `textContent`. All new IPC channels gate on `assertTrustedSender`, the delete dialog follows the `dialog { margin: auto }` convention, and `_escapeXml` (a pre-existing no-op replaced characters with themselves) is now correctly fixed at `ai-manager.js:1097-1104`.

Two findings are escalated to Critical this round. The previous round's WR-01/WR-03 (mid-stream switch/delete unguarded; aborted-run events broadcast as real errors) were verified against `pi-agent-core` internals (`node_modules/@earendil-works/pi-agent-core/dist/agent.js:202-203, 326-365`): abort is converted into a failure AssistantMessage that still emits `turn_end`/`agent_end` to listeners. That grounds two concrete failure chains — a pending user message delivered into the wrong conversation via the retry backoff, and a stale error event that splices out the next run's placeholder — which meet the Critical bar (incorrect behavior / data misplacement), not Warning.

## Critical Issues

### CR-01: No active-run guard on switchConversation/deleteConversation — mid-stream switch misroutes the in-flight run and corrupts the next run's UI state

**File:** `ai-manager.js:1652-1704` (switchConversation), `ai-manager.js:1793-1812` (deleteConversation), `src/renderer.js:6781-6820` (switchConversation), `src/renderer.js:7037-7059` (deleteConversation), `ipc-handlers.js:1782`, `ipc-handlers.js:1802`
**Continuity:** previous round WR-01 (Warning), escalated — failure chains now traced to ground.

**Issue:** Neither main-process `switchConversation`/`deleteConversation` nor the renderer equivalents check `isProcessing`/`state.aiStreaming`. The history dropdown is clickable at any time, including mid-stream. Verified chain:

1. Mid-stream switch aborts the active agent. The SDK converts the abort into a failure AssistantMessage and emits `turn_end` + `agent_end` with `errorMessage` (agent.js:349-365); the broadcast handler turns that into a renderer `error` event (`ai-manager.js:1217-1221`).
2. Renderer `switchConversation` resets `aiStreaming=false` / `aiCurrentMessageId=null`, re-enabling send while the main process's original `prompt()` is still pending.
3. If the user sends message M2 and the stale abort `error` event arrives afterwards, `handleAIStream`'s error branch (`src/renderer.js:8019-8035`) locates M2's placeholder via `aiCurrentMessageId`, splices it out, and clears streaming state while M2 is still running. M2's subsequent `message_update` events find no placeholder, so the streamed reply never renders — though the main process persists it. Data exists but is invisible until a conversation re-switch.
4. `prompt()`'s retry loop (`ai-manager.js:875-901`) re-reads `this.agent` after each 1-4s backoff sleep with no check that the agent/conversation is unchanged. If the conversation is switched during backoff, the pending user message is delivered to the new conversation's agent and persisted there on `agent_end` — message and response land in the wrong conversation.

**Fix:** Guard both main-process methods with the same busy check `prompt()` uses, and mirror it in the renderer:

```javascript
// ai-manager.js — switchConversation / deleteConversation
if (this.isProcessing) {
  throw new Error('AI 正在处理上一条消息，请稍候再试');
}
```

```javascript
// src/renderer.js — switchConversation / deleteConversation
if (state.aiStreaming) {
  showToast('AI 正在回复中，请等待完成或点击停止后再切换');
  closeConvDropdown();
  return;
}
```

Additionally, stamp broadcast events with a monotonically increasing run token (captured when `prompt()` starts, included in every `_sendEventsBatch` payload) so `handleAIStream` can drop events from an aborted run instead of misattributing them to the active one.

### CR-02: _cleanupCurrentAgent never unsubscribes the agent event listener (JSDoc claims it does)

**File:** `ai-manager.js:1859-1869` (vs `ai-manager.js:1152`)
**Continuity:** previous round WR-03 (partial), escalated.

**Issue:** The JSDoc says "abort + unsubscribe + nullify", but the implementation only aborts and nullifies — the unsubscribe function returned by `this.agent.subscribe(...)` in `_setupEventBroadcasting` (`ai-manager.js:1152`) is discarded. After a switch/create/delete, the discarded agent still holds the broadcast closure, so its abort settlement (see CR-01) still executes: it `sendNow`s stale `error`/`turn_end` events into the renderer after the switch, and invokes `this.saveCurrentConversation()` against whatever `this.currentConversationId`/`this.agent` hold at that instant. Today the save happens to be benign by coincidence only (new agent empty → early return; injected history → identical content re-saved to the same conversation); any reordering of the switch sequence (e.g., `currentConversationId` assigned before message injection) turns this into a silent cross-conversation write.

**Fix:**

```javascript
// _setupEventBroadcasting
this._agentUnsubscribe = this.agent.subscribe(handler);

// _cleanupCurrentAgent
_cleanupCurrentAgent() {
  if (this._agentUnsubscribe) {
    try { this._agentUnsubscribe(); } catch (err) { /* ignore */ }
    this._agentUnsubscribe = null;
  }
  if (this.agent) {
    try { this.agent.abort(); } catch (err) { /* ignore */ }
    this.agent = null;
  }
  this.isProcessing = false;
}
```

## Warnings

### WR-01: renameConversation — Escape commits the rename; Enter double-submits

**File:** `src/renderer.js:6981-6992`
**Continuity:** previous round WR-06, still unfixed.

**Issue:** The Escape branch calls `renderConvList()`, which detaches the focused input. Chromium fires `blur` when a focused element is removed, and the blur handler (`:6990-6992`) unconditionally calls `submitRename()` — the "cancelled" edit is saved anyway. The Enter path has the same defect in duplicate form: `submitRename()` → its trailing `renderConvList()` (`:6978`) detaches the input → blur fires → `submitRename()` runs a second time, issuing a redundant `ai:rename-conversation` IPC.

**Fix:** Guard against teardown-triggered blur:

```javascript
let settled = false;
const submitRename = async () => {
  if (settled || !input.isConnected) return;
  settled = true;
  // ...existing logic...
};
```

### WR-02: regenerateMessage trims only the renderer's message array — deleted answer resurrects on next save, user message duplicated in transcript

**File:** `src/renderer.js:8403-8442`
**Continuity:** previous round WR-02, still unfixed; two additional defects found this round.

**Issue:** `state.aiMessages.slice(0, msgIndex)` (`:8421`) trims only the renderer view. The main process `agent.state.messages` still holds the discarded tail, so the next `agent_end` full-replace-saves the untrimmed transcript — the "deleted" answer is re-persisted and, because the user message is re-sent, appears twice in the transcript. After a conversation switch (DB reload) the deleted answer resurrects and the user bubble shows twice. Additionally, `window.realmAPI.ai.prompt(userMsgContent)` at `:8436` is not awaited, so the `catch` at `:8437-8441` is dead code — an IPC rejection becomes an unhandled rejection and `aiStreaming` can stay stuck true.

**Fix:** Trim the main-process transcript first — add an IPC (e.g. `ai:truncate-to-user-message` or `prompt` variant) that splices `agent.state.messages` back to the target user message before re-prompting, and await the prompt call:

```javascript
try {
  await window.realmAPI.ai.regenerateFrom(userMsgIndex); // main trims transcript + prompts
} catch (err) {
  state.aiStreaming = false;
  renderAIMessages();
}
```

### WR-03: serializeToolData truncation produces invalid JSON — oversized tool payloads are lost wholesale, not truncated

**File:** `ai-conversations-manager.js:117-122`
**Continuity:** previous round WR-07, still unfixed.

**Issue:** `jsonStr.substring(0, TOOL_RESULT_TRUNCATE_SIZE) + '"...(truncated)"'` cuts mid-string/mid-structure and appends an unterminated fragment. The stored column is unparseable, so the read side's `safeJsonParse` falls back to `[]`/`null` and the ENTIRE payload is discarded — not a truncated prefix. For a >100KB `tool_results` column this loses `toolCallId`, so `getMessages` drops the toolResult row (the card never receives its result/error) and `getAgentMessages` synthesizes a `（历史工具结果未记录）` placeholder instead of the real result. The 100KB cap per RESEARCH Pitfall 3 therefore acts as an all-or-nothing discard.

**Fix:** Store an always-valid JSON envelope:

```javascript
if (jsonStr.length > TOOL_RESULT_TRUNCATE_SIZE) {
  return JSON.stringify({
    truncated: true,
    originalLength: jsonStr.length,
    preview: jsonStr.substring(0, TOOL_RESULT_TRUNCATE_SIZE),
  });
}
```

…and unwrap `preview` on read (for tool_results, keep `{ toolCallId, isError, truncated: true }` so pairing metadata survives even when details are dropped).

### WR-04: Renderer switchConversation does not reset referencedTabs / context pills

**File:** `src/renderer.js:6781-6820`
**New this round.**

**Issue:** `createNewConversation` (`:6835-6841`) clears `state.referencedTabs` and the `#aiContextPills` markup; `switchConversation` does not. A pending @-reference prepared in conversation A silently rides along after switching to conversation B, and its full extracted tab content (up to 100KB per tab, XML-injected) is attached to B's next message — content prepared for a different conversation.

**Fix:** Replicate the reset block from `createNewConversation` inside `switchConversation`:

```javascript
state.referencedTabs = [];
if (elements.aiContextPills) {
  elements.aiContextPills.innerHTML = '';
}
```

## Info

### IN-01: loadConversations fallback can assign a non-array to state.conversations

**File:** `src/renderer.js:6672-6675`

**Issue:** `state.conversations = result.conversations || result || []` — if `result.conversations` is ever absent while `result` is an object (IPC shape drift), the whole envelope object is assigned; `renderConvList`'s spread `[...state.conversations]` then throws "object is not iterable". Unreachable with the current handler shape, but the fallback is worse than no fallback.

**Fix:** `state.conversations = Array.isArray(result?.conversations) ? result.conversations : [];`

### IN-02: getAgentMessages reads a provider column that is never selected

**File:** `ai-conversations-manager.js:707` (vs `ai-conversations-manager.js:315-320`)
**Continuity:** previous round IN-01, still unfixed.

**Issue:** `provider: row.provider || ''` — `readMessageRows`' SELECT has no `provider` column (the messages table has none), so this is always `''`. Dead field; misleading to future readers.

**Fix:** Drop the field, or add it to the SELECT if provenance is intended.

### IN-03: getMessageCount exported but never called

**File:** `ai-conversations-manager.js:763-771`

**Issue:** No caller anywhere in the codebase (message counts come from the `getConversations` LEFT JOIN). Dead code.

**Fix:** Remove, or wire it up where needed.

### IN-04: Conversation context menu has no viewport clamping

**File:** `src/renderer.js:6861-6900`

**Issue:** `showConvContextMenu` positions at raw `e.clientX/clientY`; items near the bottom/right screen edge open a clipped menu.

**Fix:** Clamp after append: `menu.style.top = Math.min(e.clientY, innerHeight - menu.offsetHeight - 8) + 'px'` (same for left).

### IN-05: Title derivation can split surrogate pairs

**File:** `ai-manager.js:1040-1046`

**Issue:** `trimmed.substring(0, 30)` can cut an astral character (emoji) in half, producing a U+FFFD replacement char in conversation titles.

**Fix:** Use `[...trimmed].slice(0, 30).join('')` (code-point aware).

### IN-06: preload switchConversation JSDoc return shape is stale

**File:** `src/preload.js:1019-1024` (vs `ipc-handlers.js:1782-1799`)

**Issue:** Documented as `@returns {Promise<{conversation: Object}>}` but the channel also returns `messages` (which the renderer depends on). Doc drift on a load-bearing field.

**Fix:** Update the JSDoc to `{conversation: Object, messages: Array}`.

### IN-07: Auto-rename matches the default title by exact string equality

**File:** `ai-manager.js:1023-1028`

**Issue:** `_ensureConversation` path b overwrites the title when `existing.title === '新对话'`. A user who deliberately renames a conversation to exactly「新对话」will have it silently replaced by the next message's derived title.

**Fix:** Track "user renamed" as a flag/column instead of sentinel-string comparison, or accept and document the edge case.

### IN-08: token_total column never written

**File:** `ai-conversations-manager.js:62` (column), `ai-manager.js:1719-1728` (updates)
**Continuity:** previous round IN-03, still unfixed.

**Issue:** `conversations.token_total` stays 0 forever — `saveCurrentConversation` never includes it and `updateConversation`'s allowlist is never exercised for it. The D-12 metadata statistic is declared but not implemented.

**Fix:** Either accumulate usage from `agent_end` events (message.usage) into `token_total`, or remove the column from the schema until implemented.

### IN-09: Delete dialog has no close/cancel listener — Esc leaves stale dataset

**File:** `src/renderer.js:7037` (deleteConversation), `src/index.html:935`
**Continuity:** previous round IN-04, still unfixed.

**Issue:** Esc (native `cancel`) closes the dialog without running `closeDeleteConfirm()`, so `dataset.conversationId` persists. Harmless today (the next `showDeleteConfirm` overwrites it and the confirm button is the only reader), but a footgun if confirm logic ever reads the dataset outside the button flow.

**Fix:** `elements.aiConvDeleteDialog.addEventListener('close', closeDeleteConfirm)` — covers Esc and programmatic close in one path.

### IN-10: IPC input validation gaps — rename title length, get-conversations limit type

**File:** `ipc-handlers.js:1819-1833` (rename), `ipc-handlers.js:1755-1761` (get-conversations)
**Continuity:** previous round IN-05, still unfixed.

**Issue:** `ai:rename-conversation` accepts arbitrarily long titles (unbounded UI/text in the list); `ai:get-conversations` passes `limit` through unvalidated — a non-number rejects at the SQL binding, a negative number means unlimited rows.

**Fix:** Clamp `newTitle.length` (e.g. 200) and `limit = Math.min(Math.max(1, Number(limit) || 50), 200)`.

### IN-11: saveMessages regenerates every message row id on each save

**File:** `ai-conversations-manager.js:494`

**Issue:** Full-replace + fresh `crypto.randomUUID()` per row per save means a conversation's message ids churn after every turn. No current consumer breaks (the renderer's live view uses locally generated ids and reloads on switch), but any future id-keyed persistence (deep links, per-message feedback) goes stale across saves.

**Fix:** Reuse `msg.id` when present (`const id = msg.id || generateId()`); with DELETE+INSERT the duplicate-row hazard that motivated regenerating ids no longer exists.

---

_Positive notes: `_escapeXml` was a no-op before this phase (replaced characters with themselves) — the fix at `ai-manager.js:1097-1104` is correct and applied in the right order (`&` first). The `ai:configure` handler relaxation (`apiKey` no longer required, `ipc-handlers.js:1703`) is intentional and safe: `configureProviders` retains its own builtin-provider key validation and the custom-provider pending flow (`ai-manager.js:1356-1376`). All previously reported fixed items (old CR-01/WR-04/WR-05/IN-02) were re-verified as fixed in current HEAD._

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
