---
status: diagnosed
trigger: "Every app startup automatically creates an empty '新对话' conversation record (0 messages) in AI conversation history. The user says this must not happen."
created: 2026-09-01T00:00:00
updated: 2026-09-01T08:30:00
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "ai-manager.js init() (lines 739-748) runs on every app startup (called from main.js:3004 inside the app.whenReady handler at main.js:690) and unconditionally inserts a '新对话' row into ai-conversations.db, because its guard `if (!this.currentConversationId)` is always true at startup — currentConversationId is in-memory only (constructor line 570 sets null, never persisted/restored)."
  test: "Code-path trace (main.js whenReady -> aiManager.init -> createConversation) + read-only DB inspection of ai-conversations.db correlating 0-message row created_at timestamps with app restarts during UAT."
  expecting: "0-message '新对话' rows with created_at matching restart moments; no persistence mechanism for currentConversationId; init block present in both HEAD and tested working tree."
  next_action: "Diagnosis complete — return ROOT CAUSE FOUND to plan-phase --gaps (goal: find_root_cause_only, no code changes made)."
  falsification_test: "If the row were instead created by the renderer at AI-panel open, it would only appear after opening the panel and would not exist for startups where the panel is never opened; the DB shows rows created at restart times independent of panel state, and the creation code sits in the main-process init path — hypothesis stands. Direct disproof would be: comment out ai-manager.js:739-748 and restart -> no row created (not applied; diagnosis-only)."
  fix_rationale: "The init block itself performs the eager INSERT; removing/deferring it (lazy-create on first user message or explicit 新对话 click) removes the root cause rather than masking it in the UI layer."
  blind_spots: "No live app restart was executed (evidence is code-path + DB timestamp correlation, which is consistent across 6 rows and 2 distinct creation signatures). Did not live-verify that the user has exactly one enabled provider (init bails before creation if none configured, lines 680-684 — user clearly has one, since rows exist)."
  candidate_causes:
    - "code: init-time eager createConversation in ai-manager.js init() — CONFIRMED primary"
    - "design: D-06 decision ('每次打开 AI 面板自动新建对话') mandated auto-creation; the UAT gap G-42-1 now contradicts it, so D-06 itself needs revision — contributing"
    - "environment/config: ruled out — creation is unconditional w.r.t. environment (runs in any NODE_ENV whenever a provider is configured); not env-specific"
    - "data: ruled out — fresh rows appear on every start regardless of existing data; not a stale-data effect"
  and_gate: "YES — the '暂无对话' empty state is unreachable via two cooperating code paths: (1) init-time creation at startup; (2) deleteConversation auto-creates a replacement when the deleted conversation is current (ai-manager.js:1679-1681), so deleting the last/only conversation still inserts a new row. Both must change for the empty state to ever display. A third latent contributor: renderer deleteConversation (src/renderer.js:7032-7034) ALSO calls createNewConversation() after the main process already auto-created — double creation when renderer state.currentConversationId is in sync."

hypothesis: CONFIRMED (see reasoning_checkpoint)
test: completed
expecting: n/a
next_action: "Return ROOT CAUSE FOUND; no fix applied (find_root_cause_only)."

## Symptoms

expected: When no conversation exists, the AI conversation-history dropdown shows the empty state "暂无对话" with guide copy; app startup must NOT auto-create a "新对话" record.
actual: On every app startup, the conversation history list contains a record titled "新对话" showing 0 messages (日期 meta present). The empty state can never be seen because this spurious record always exists.
errors: None reported
reproduction: Start Realm (dev environment, `npm run dev`, userData = ~/Library/Application Support/realm-dev/) → open AI panel → click the conversation-history button (#aiHistoryBtn) → the dropdown list shows a 0-message "新对话" record. Delete it, restart the app, it reappears.
started: Discovered during UAT of Phase 42 (Test 1)

## Eliminated

- hypothesis: "Renderer creates the conversation when the AI panel opens (toggleAIPanel / loadConversations side effect)"
  evidence: "src/renderer.js:7308-7333 toggleAIPanel only calls loadAIPanelWidth/loadModelSelectorData/loadConversations — all read-only (ai:list-conversations). No createConversation call outside the explicit 新对话 button handler (renderer.js:6822) and the delete-current branch (renderer.js:7034). The comment at renderer.js:7306 mentioning 自动创建新对话 is stale."
  timestamp: 2026-09-01T08:20:00
- hypothesis: "Uncommitted working-tree changes introduced the bug"
  evidence: "git diff shows the three modified files' changes are: XML escaping fix, updateConversation comment, getConversationMessages addition, ai:configure validation, ai:switch-conversation returning messages, renderer createNewConversation result-parsing fix + removal of duplicate ai.newConversation() call. The init-time creation block (ai-manager.js:739-748) is unchanged from HEAD (verified via git show HEAD:ai-manager.js)."
  timestamp: 2026-09-01T08:22:00

## Evidence

- timestamp: 2026-09-01T08:10:00
  checked: "main.js:690 app.whenReady().then(async () => { ... }) spans through main.js:3000-3009"
  found: "aiManager = new AIManager(); aiManager.init(configStore).then(() => setAIManager(aiManager)) executes inside the whenReady handler — i.e. on every app startup, independent of any UI interaction."
  implication: "Creation happens at main-process startup, not at panel open."
- timestamp: 2026-09-01T08:12:00
  checked: "ai-manager.js init() lines 732-748; constructor line 570; grep of all currentConversationId references"
  found: "init() ends with: `if (!this.currentConversationId) { const conv = conversationStore.createConversation({ title: '新对话', model, provider }); this.currentConversationId = conv.id; }`. Constructor sets this.currentConversationId = null; no code path persists or restores it from DB/storage. Guard is therefore always true at startup (early-return at lines 680-684 only when no enabled provider is configured)."
  implication: "A new empty '新对话' row is INSERTed on every app startup whenever AI is configured — exactly the reported symptom."
- timestamp: 2026-09-01T08:25:00
  checked: "ai-conversations.db (copied to /tmp, read-only query): conversations + message counts"
  found: "6 rows, all titled 新对话: (1) 14:54:21 — 14 msgs; (2) 14:57:27 — 0 msgs; (3) 14:58:05 — 0 msgs; (4) 14:58:25 — 14 msgs; (5) 15:03:39 — 0 msgs; (6) 15:03:45 — 0 msgs. UAT started 14:56:16 local. Startup-creation rows (3) and (6) appear at restart moments with 0 messages. Rows (2) and (5) share the delete-current signature: created_at exactly equals the previous row's updated_at (14:57:27 and 15:03:39), matching ai-manager.js:1679-1681 (deleteConversation -> saveCurrentConversation stamps prior row's updated_at, then createNewConversation inserts replacement in the same second)."
  implication: "DB timestamps corroborate both creation paths: startup init-creation AND delete-current auto-replacement (why 'delete it, restart, it reappears')."
- timestamp: 2026-09-01T08:27:00
  checked: "42-CONTEXT.md D-06; 42-02-PLAN.md:316; 42-VERIFICATION.md:13"
  found: "D-06 (design decision): '新建对话触发方式：每次打开 AI 面板自动新建对话 + 显式「新对话」按钮 — 类似 ChatGPT 的体验'. The init block is an over-eager implementation of D-06."
  implication: "The bug is a design-level conflict: UAT gap G-42-1 ('应用启动不应自动创建「新对话」记录') contradicts D-06. D-06 must be revised alongside the code fix."
- timestamp: 2026-09-01T08:29:00
  checked: "renderer.js:7028-7044 deleteConversation + ipc-handlers ai:delete-conversation path"
  found: "Main-side deleteConversation already auto-creates a replacement when deleting the current conversation (ai-manager.js:1678-1681). Renderer then ALSO calls createNewConversation() when `conversationId === state.currentConversationId` (renderer.js:7032-7034) → double creation when renderer state is in sync (e.g. after switch). At startup-record deletion renderer state.currentConversationId is null, so only main-side fires."
  implication: "Secondary AND-gate contributor keeping the list permanently non-empty; plus a latent duplicate-creation defect in the delete flow."

## Resolution

root_cause: "ai-manager.js init() lines 739-748 eagerly INSERT a '新对话' conversation into ai-conversations.db on every app startup. The block runs from main.js:3004 (inside app.whenReady) each launch, and its guard `if (!this.currentConversationId)` is always true because currentConversationId is in-memory only (constructor ai-manager.js:570, never persisted/restored). This implements the D-06 design decision ('每次打开 AI 面板自动新建对话'), which UAT gap G-42-1 now contradicts. AND-gate: the empty state additionally requires removing the delete-current auto-replacement in ai-manager.js:1678-1681 — without that, deleting the last conversation immediately creates a fresh row, so '暂无对话' can never display."
fix: "(not applied — find_root_cause_only) Remove or lazy-defer the init-time creation: currentConversationId should start null and a conversation row should only be created on first user message or explicit 新对话 click. Also align deleteConversation (main) and renderer delete flow: no auto-replacement on delete-last, and remove the renderer-side duplicate createNewConversation after main-side auto-create."
verification: "DB timestamp forensics (6 rows, two distinct creation signatures matching the two code paths) + full code-path trace from app.whenReady to INSERT. No live restart executed (diagnosis-only)."
files_changed: []
