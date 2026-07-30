---
status: complete
phase: 16-favorites-enhancements
source: [16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md]
started: 2026-07-29T12:37:29Z
updated: 2026-07-30T03:47:24Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 杀掉所有 realm 进程，npm run dev 启动浏览器。窗口正常打开，无报错。打开 realm://favorites 页面，收藏列表能加载。渲染进程 DevTools Console 无红色报错。
result: pass
notes: "初次报告 ERR_REQUIRE_ESM blocker 已通过 vendor 修复（vendor/fractional-indexing.js）。修复后启动正常。console 中存在预先存在的 CSP 报错（src/index.html 中的 style=\"...\" 属性触发，引入自 commit 88aab61 Phase 01-02），与 Phase 16 无关，不阻塞。"

### 2. 同目录拖拽排序
expected: 在 realm://favorites 中，拖拽一个收藏项到同目录另一个收藏项的上方/下方。拖拽过程中：源项半透明、目标位置出现蓝色插入指示线。松手后收藏项移动到新位置。刷新页面后顺序保持。
result: pass

### 3. 跨文件夹拖拽移动
expected: 拖拽一个收藏项到另一个文件夹上（不是文件夹之间的空隙）。拖拽到文件夹上时文件夹高亮（D-06）。松手后该项从原位置消失、出现在目标文件夹内。刷新页面后位置保持。
result: pass

### 4. 文件夹嵌套拖拽 + 循环引用防护
expected: 拖拽文件夹 A 到文件夹 B 上，A 变成 B 的子文件夹。再尝试把 B 拖到 A（现在是 B 的后代）上，应被拒绝（循环引用检测，复用 Phase 14 逻辑），不允许形成环。
result: pass

### 5. Cmd/Ctrl+Click 切换选中
expected: 点击选中收藏项 1，再 Cmd+Click (macOS) / Ctrl+Click (Win) 收藏项 3 和 5。三项都呈蓝色高亮（.selected），不需要相邻。再 Cmd+Click 已选中的项 3，仅项 3 取消选中，1 和 5 仍选中。
result: pass

### 6. Shift+Click 范围选择
expected: 先点击项 2，再 Shift+Click 项 6。项 2、3、4、5、6 全部被选中（inclusive）。之前若有其他选中项会被清除，只保留这个范围。
result: pass
notes: "初次报告选中状态串扰（左侧文件夹被错误高亮），通过引入命名空间 key（'f:id' / 'd:id'）修复。复测通过。"

### 7. 右键菜单自适应（单选 vs 多选）
expected: 未选中或只选中 1 项时右键，显示单选菜单（打开/编辑/删除/剪切/复制等单数操作）。选中 2+ 项后右键其中一项，菜单切换为批量操作（批量删除/剪切/复制），项数与选中数一致。
result: pass

### 8. 批量删除
expected: 选中 2+ 个收藏项（可混合文件夹），右键 → 批量删除。确认后所有选中项从列表消失。刷新页面后保持删除状态（数据库已持久化）。
result: pass

### 9. 批量剪切 + 粘贴
expected: 选中 2+ 个收藏项，右键 → 批量剪切。进入另一个文件夹（或返回根目录），右键空白处 → 粘贴。所有选中项移动到新位置。刷新页面后位置保持。
result: pass

### 10. Escape 清除选中
expected: 选中多个项后按 Escape 键。所有 .selected 高亮立即清除，右键菜单回到单选/无选中模式。
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "应用冷启动时正常加载 favorites-manager，主进程不抛 ERR_REQUIRE_ESM"
  status: resolved
  reason: "User reported: 启动后弹窗报错 Uncaught Exception: Error [ERR_REQUIRE_ESM]"
  severity: blocker
  test: 1
  root_cause: "fractional-indexing@4.0.0 是纯 ESM 包（\"type\": \"module\"），Electron 主进程 CommonJS 不能 require()"
  artifacts:
    - path: "vendor/fractional-indexing.js"
      issue: "新增 vendored CJS 副本（从 node_modules/fractional-indexing/src/index.js 转换）"
    - path: "favorites-manager.js"
      issue: "require('fractional-indexing') → require('./vendor/fractional-indexing')"
    - path: "main.js"
      issue: "同上"
    - path: "package.json"
      issue: "移除 fractional-indexing 依赖（已 vendor）"
  missing: []
  debug_session: ""

- truth: "渲染进程 DevTools Console 无红色报错"
  status: deferred
  reason: "CSP style-src 'self' 阻止 src/index.html 中预先存在的 style=\"...\" 属性（来自 Phase 01-02 commit 88aab61），与 Phase 16 无关"
  severity: minor
  test: 1
  root_cause: "src/index.html 使用 inline style 属性（容器颜色 sample、display:none 等），CSP style-src 'self' 不允许"
  artifacts:
    - path: "src/index.html"
      issue: "第 96, 180-187, 390 行使用 style=\"...\" 属性"
  missing:
    - "将 style=\"background:#xxx\" 改为 CSS class"
    - "将 style=\"display:none\" 改为 [hidden] 属性或 utility class"
  debug_session: ""
  note: "技术债，建议单独立项清理，不阻塞 Phase 16"

- truth: "Shift+Click 范围选择只高亮右侧收藏项，不影响左侧文件夹树"
  status: resolved
  reason: "User reported: 收藏网页显示正常，但是左侧无关的文件夹也出现几个选中状态（截图确认：右侧 3 个收藏项正确选中，左侧 test/ssssfwe/sss 4 个文件夹被错误高亮）"
  severity: major
  test: 6
  root_cause: "state.selectedIds 是扁平 number Set，但 favorites 表 id 和 favorite_folders 表 id 是两个独立自增序列（命名空间冲突）。handleItemClick 在 favorites-page.js:545 收藏项传 record.id、:642 文件夹传 folder.id，两个 id 混在同一 Set；updateSelectionUI 对两类元素分别用同一 Set 判断，导致 id 碰撞时双方都高亮。"
  artifacts:
    - path: "src/favorites-page.js"
      issue: "state.selectedIds 命名空间冲突：favorite 和 folder id 混合存储"
  fix_applied:
    - "引入 SELECTION_TYPE 常量（FAVORITE='f' / FOLDER='d'）和 makeSelKey/parseSelKey/getFavoriteIdsFromSelection helpers"
    - "selectedIds 改为存储 'f:123' / 'd:123' 字符串 key，命名空间隔离"
    - "handleItemClick 签名改为 (e, type, itemId)；lastClickedId → lastClickedKey"
    - "getAllVisibleItemIds → getAllVisibleSelKeys 返回 namespaced key"
    - "批量操作（删除/剪切/复制）通过 getFavoriteIdsFromSelection 过滤 favorites id"
  missing: []
  debug_session: ""
  introduced_by: "acf3238 feat(16-03): 实现多选与批量操作功能"
