---
phase: 43-ai-mvp
plan: 03
subsystem: main-http-api / settings-ui
tags: [ai-memory, http-api, settings-ui, realm-webview]
requires: ["ai-memory-manager.js readScope/writeScope/BUDGETS（43-01 提供）", "main.js 本地 HTTP 服务器路由族（handleHistoryApi 鉴权先例）", "settings-page.js searchConfigApi/fetchContainers 先例"]
provides:
  - "main.js /api/ai-memory GET+POST 端点（REALM_TOKEN 鉴权 + scope 白名单 + 容器存在性校验 + writeScope 人工路径）"
  - "src/settings.html ai-memory-section（三 tab + 容器下拉 + textarea + 状态行 + 保存按钮）"
  - "src/settings-page.js aiMemoryApi 包装 + AI 记忆分区完整交互（tab 切换/取数/保存/字数/空态/错误/加载态）"
affects: ["UAT（realm://settings AI 记忆分区手动验证）", "AI-SPEC §7 每周 dogfooding 的目检窗口"]
tech-stack:
  added: []
  patterns: ["端点 budget 从 manager BUDGETS 读取（数值单源，端点与前端零字面量）", "初始隐藏全部走 CSS 类（realm://settings CSP style-src 'self'）", "JS CSSOM 显隐切换用具体值不依赖 '' 回落"]
key-files:
  created: []
  modified: ["main.js", "src/settings.html", "src/settings-page.js", "src/styles/main.css"]
decisions:
  - "POST content 空或非字符串 → 400（按计划原文执行：清空整层记忆暂不可经 UI 完成，需留内容；如需空文件写入语义由后续 plan 决策）"
  - "端点 dispatch 用 reqPath === '/api/ai-memory' 精确匹配（区别于其他 /api/xxx/ 前缀族），aiMemoryApi 包装 route 参数留空兼容 searchConfigApi 形状"
  - "ai-memory-manager 顶层 require（其 electron 依赖模块内部惰性获取，与 main.js 现有 manager 引用方式一致）"
  - "样式落在 main.css（settings.html 实际引用的样式表，规避 bookmarks-bar.css 死副本教训）；tab 激活态/danger/success 全部消费既有 CSS 变量"
metrics:
  duration: 18min
  completed: 2026-09-04
actuals:
  tokens: 6000
  tasks: 2
  commits: 2
status: complete
---

# Phase 43 Plan 03: /api/ai-memory 端点 + 设置页「AI 记忆」分区 Summary

本地 HTTP `/api/ai-memory` GET/POST 端点（token 鉴权 + scope 白名单 + 容器存在性校验 + writeScope 人工路径零扫描）与 realm://settings「AI 记忆」三 tab 编辑分区（实时字数 / 超限阻断 / 显式保存 / 空态错误文案齐全），预算数值全程单源自 manager BUDGETS。

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | /api/ai-memory HTTP 端点 — token 鉴权 + scope 白名单 + 预算双保险 | 8877f19 | main.js |
| 2 | 设置页「AI 记忆」分区 — 三 tab 编辑 + 字数统计 + 显式保存 | a1c0ccd | src/settings.html, src/settings-page.js, src/styles/main.css |

## Verification Results

- `node --check` main.js / src/settings-page.js 均通过
- `npm run test:memory`：56/56 全绿（本 plan 改动零回归）
- 源断言：handleAiMemoryApi 入口第一业务判断为 REALM_TOKEN 不匹配 → 403 Forbidden
- 源断言：GET 返回 `{ content, used, budget }` 三键；budget 经 `aiMemoryManager.BUDGETS[target]` 读取
- 源断言：POST 容器 scope 校验 `containerManager.getContainers()` 存在性，不存在 → 400「容器不存在」（T-43-08）；写入仅调 `writeScope`（grep `write(` 零命中，D-11 prohibition 达成）
- 反向断言：main.js / settings-page.js 内 1375/2200 字面量均 0
- 反向断言：ai-memory-section 区块内 `style="display"` 计数 = 0（CSP 铁律）
- UI 文案逐条 grep 命中：保存后将在新会话生效 / 容器记忆即时生效，AI 通过 memory_read 按需读取 / 超出字符上限，请精简内容后再保存 / 该容器暂无记忆，AI 首次写入后在此显示 / 暂无内容，AI 写入记忆后在此显示 / 已保存 / 保存失败：{原因}，请重试 / 加载中…
- 取数与保存期间 `textarea.disabled = true` + 保存按钮 disabled +「加载中…」hint（UI-SPEC backstop loading 态）
- Manual（VALIDATION.md Manual-Only 表）：realm://settings 实际渲染/编辑保存回读留待 UAT（CSP 与真实渲染环境）

## Deviations from Plan

None - plan executed exactly as written.

说明（非偏离）：
- main.css 不在 frontmatter files_modified 列表，但 plan Task 2 action 明确指示「样式加在 main.css」，属计划内改动
- settings.html 既有 2 处内联 display（eye-off 图标、searchEnvVarHint）为范围外存量，本 plan 未修改——按 upstream contract 记入 REVIEW.md 技术债

## Known Stubs

None - 本 plan 无 stub。

## Threat Surface Scan

无新增超出 `<threat_model>` 的安全面：T-43-07（端口扫描）由 REALM_TOKEN 鉴权缓解落地；T-43-08（孤儿记忆文件）由容器存在性校验缓解落地；T-43-09（人工路径绕过扫描）为 D-11 既定 accept 语义，端点严格走 writeScope 且预算校验仍生效。零新依赖。

## Notes for Downstream Plans

- Phase 43 三 plan 全部完成：存储层（43-01）→ 删除钩子 + eval harness（43-02）→ HTTP 端点 + 设置页编辑入口（43-03）
- UAT 建议顺序：`npm run eval:memory` 全量跑（43-02）→ realm://settings AI 记忆分区手动编辑保存回读（本 plan）→ 主窗口删除容器确认记忆文件清理（43-02）
- 设置页存量内联 display 技术债（eye-off / searchEnvVarHint）：本就被 CSP 拦截失效，待后续 UI 清理 plan 统一处理

## Self-Check: PASSED

- 提交 8877f19 / a1c0ccd 均在 git log 中（FOUND）
- main.js handleAiMemoryApi + dispatch、settings.html ai-memory-section、settings-page.js aiMemoryApi + 分区逻辑、main.css 样式段全部存在（FOUND）
