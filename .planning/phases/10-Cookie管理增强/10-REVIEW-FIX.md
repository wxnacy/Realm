---
phase: 10-Cookie管理增强
fixed_at: 2026-07-27T03:05:42Z
review_path: .planning/phases/10-Cookie管理增强/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-07-27T03:05:42Z
**Source review:** .planning/phases/10-Cookie管理增强/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4（fix_scope=critical_warning：1 Critical + 3 Warning；5 个 Info 不在范围内）
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: deleteSingleCookie 删除不持久化——saveCookies 合并保留逻辑使已删除 Cookie 在文件中复活

**Files modified:** `cookie-manager.js`
**Commit:** 48c497f
**Applied fix:** `deleteSingleCookie` 不再调用 `saveCookies` 走通用合并保存，改为在 `ses.cookies.remove` 之后显式读取 cookies.json、按唯一键 `domain|name|path` 过滤剔除目标条目并写回。修复后 Session 来源和 File 来源的删除均可持久化（File 来源时 `ses.cookies.remove` 为 no-op，文件剔除仍生效）。已用打桩 PoC 行为验证：删除后目标 Cookie 从文件剔除、其余条目不误删；`node scripts/test-save-domain-cookies.js` 回归套件 15/15 通过（本修复不改变 save/merge 语义，无需扩展套件）。

### WR-01: editCookie 修改 Domain/Path 会产生重复 Cookie（旧条目残留）

**Files modified:** `src/index.html`, `src/renderer.js`
**Commit:** c246035
**Applied fix:** 采用审查建议的方案 2（更简单稳妥）：编辑模态框的 Domain/Path 输入框设为 `disabled`（与 Name 一致），只允许修改 value/过期时间/标志位，彻底回避键迁移问题。纵深防御：`handleSaveCookieEdit` 构造 cookieData 时 domain/path 直接取 `cookieState.editingCookie` 的原始值而非读取输入框，即使通过 devtools 解除禁用也无法改变 Cookie 唯一键。

### WR-02: "保存到文件"按钮硬编码 includeSubdomains=true，忽略面板当前过滤器

**Files modified:** `src/renderer.js`
**Commit:** 01993ff
**Applied fix:** `handleSaveToFile` 的保存范围跟随 `cookieState.filter`：`filter === 'all'`（或无法提取域名）走 `saveCookie` 保存全部；`filter === 'subdomain'` 走 `saveDomainCookies(container, domain, true)`（含父域）；`filter === 'exact'` 走 `saveDomainCookies(container, domain, false)`（仅当前域名）。Toast 文案带范围说明（"（含父域）"/"（仅当前域名）"）。回归套件 15/15 通过，其中两条 handleSaveToFile 静态断言（无 document 级选择器、域名提取与 showCookiesModal 同源）保持满足。

### WR-03: 删除末页最后一条后页码越界，列表误显"暂无 Cookie"且分页消失

**Files modified:** `src/renderer.js`
**Commit:** c4ff2df
**Applied fix:** 在 `renderCookiesList` 开头钳制页码：`totalPages = Math.max(1, Math.ceil(filteredCookies.length / pageSize))`，若 `cookieState.page > totalPages` 则重置为 totalPages。放在渲染入口可覆盖所有收缩列表的路径（删除、过滤切换、来源切换），删除末页最后一条后自动回退到新的最后一页，分页控件正常可用。

## Skipped Issues

无——全部范围内发现均已修复。

---

_Fixed: 2026-07-27T03:05:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
