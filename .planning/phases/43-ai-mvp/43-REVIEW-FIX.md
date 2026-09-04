---
phase: 43-ai-mvp
fixed_at: 2026-08-11T11:05:00Z
review_path: .planning/phases/43-ai-mvp/43-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 43: Code Review Fix Report

**Fixed at:** 2026-08-11T11:05:00Z
**Source review:** .planning/phases/43-ai-mvp/43-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3（Critical 0 + Warning 3；Info 4 项不在 fix_scope 范围内，跳过）
- Fixed: 3
- Skipped: 0

**Verification environment:** `workflow.use_worktrees = false`（.planning/config.json），全部修复在主检出（分支 `master`）直接编辑提交，未创建隔离 worktree。验证命令均在主检出运行。

## Fixed Issues

### WR-01: replace/remove use line-identity matching — duplicated identical lines corrupt multiple entries

**Status:** fixed: requires human verification（按索引定位属匹配语义变更，建议人工复核边界行为）
**Files modified:** `ai-memory-manager.js`
**Commit:** 17f89e6
**Applied fix:** `parseEntries` 为每条目记录 `index`（在 `split('\n')` 后数组中的下标）；`write()` 的 replace 分支由「逐行文本比对改写」改为 `lines[hit.index] = ...` 按索引改写，remove 分支由 `lines.filter(line => line !== hit.line)` 改为 `lines.splice(hit.index, 1)` 按索引删除。文件中出现字节相同的重复条目行时只动目标行，不再连锁改写/删除，恢复 D-09 编号精确改写不变式。

### WR-02: add/replace 不校验换行——content 可伪造 `[MN]` 条目行

**Status:** fixed: requires human verification（新增校验规则改变了工具可接受输入域，建议人工确认 LLM 调用方无单行假设冲突）
**Files modified:** `ai-memory-manager.js`, `ai-manager.js`
**Commit:** 3d45e45
**Applied fix:** 采用 REVIEW.md 推荐的方案一（拒绝全部换行，而非仅拒伪造条目行）：`write()` 在威胁扫描前对 add/replace 的 content 检查 `/[\r\n]/`，命中即 throw「条目正文须为单行文本」。同步更新 `ai-manager.js` 的 memory 工具 description 与 content 参数 description，注明「content 必须为单行文本（不含换行），多行内容拆成多条 add」。

### WR-03: 容器 tab 零容器（或容器 API 失败）时产生非法 scope `container:`

**Status:** fixed
**Files modified:** `src/settings-page.js`
**Commit:** 0b3790d
**Applied fix:** 三处守卫：
1. `loadAiMemory` 开头：容器 tab 且 `containerId` 为空时清空 textarea、budget 置 0、显示「暂无容器，创建容器后可使用容器记忆」、禁用保存按钮，不再构造非法 scope 发起必然 400 的请求；
2. `saveAiMemory` 开头：同样空态直接 return（按钮已禁用的双保险）；
3. `updateAiMemoryCount`：budget 为 0 时 `over` 恒 false，textarea 输入监听会重新启用保存按钮——补 `noContainer` 条件使空态下保存按钮持续禁用，且空态 hint 不被超限 hint 联动覆盖。

## Verification

- Tier 1（重读确认）：三个文件修改段均重读核对，fix 内容在位、周边代码无损坏
- Tier 2（语法检查）：`node --check ai-memory-manager.js`、`node --check ai-manager.js`、`node --check src/settings-page.js` 全部通过
- Tier 3：不适用（Tier 2 已可用）
- 回归：`npm run test:memory` 56/56 通过（WR-01、WR-02 提交后各跑一次；settings-page.js 为浏览器脚本不经 node 测试，但语法检查通过）
- 威胁扫描护栏（threat-scan.test.js）随主套件通过，WR-02 新校验未破坏既有扫描语料库断言

## Skipped Issues

（无——范围内 3 项全部修复。Info 级 IN-01~IN-04 按 fix_scope: critical_warning 跳过，未处理。）

---

_Fixed: 2026-08-11T11:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
