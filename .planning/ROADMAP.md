# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），已集成 AI Agent SDK。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)
- ✅ **v2.0 收藏夹文件夹支持 + AI Agent 集成** — Phases 14-21 (shipped 2026-08-01)
- 🚧 **v2.1 AI CDP 增强 + Tabbrowser 功能集成** — Phases 22-25 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Core Container Management + Architecture Refactoring — completed 2026-07-23
- [x] Phase 2: Browser Core - URL Navigation + Multi-Tab — completed 2026-07-23
- [x] Phase 3: Data Isolation + Cookie Persistence — completed 2026-07-23
- [x] Phase 4: Convenience Features — completed 2026-07-24

</details>

<details>
<summary>✅ v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面 (Phases 5-9) — SHIPPED 2026-07-26</summary>

- [x] Phase 5: 容器属性扩展 — completed 2026-07-25
- [x] Phase 6: 浏览历史记录 — completed 2026-07-25
- [x] Phase 7: 收藏夹管理 — completed 2026-07-25
- [x] Phase 8: 常用网站推荐 + 设置页面 — completed 2026-07-25
- [x] Phase 9: 共享收藏数据库 — completed 2026-07-26

</details>

<details>
<summary>✅ v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式 (Phases 10-12) — SHIPPED 2026-07-27</summary>

- [x] Phase 10: Cookie 管理增强 — completed 2026-07-26
- [x] Phase 11: 设置页面重构 — completed 2026-07-27
- [x] Phase 12: 开发者模式 — completed 2026-07-27

</details>

<details>
<summary>✅ v1.3 右键菜单增强 (Phase 13) — SHIPPED 2026-07-27</summary>

- [x] Phase 13: 右键菜单增强 — completed 2026-07-27

</details>

<details>
<summary>✅ v2.0 收藏夹文件夹支持 + AI Agent 集成 (Phases 14-21) — SHIPPED 2026-08-01</summary>

- [x] Phase 14: 收藏夹文件夹 - 数据库层实现 — completed 2026-07-28
- [x] Phase 15: 收藏夹文件夹 - UI 交互 — completed 2026-07-28
- [x] Phase 16: 收藏夹文件夹 - 增强功能 — completed 2026-07-29
- [x] Phase 17: Chrome 书签导入 — completed 2026-07-30
- [x] Phase 18: 收藏栏功能 — completed 2026-07-30
- [x] Phase 19: AI Agent 集成 - 基础验证 — completed 2026-07-31
- [x] Phase 20: AI Agent 集成 - 核心功能 — completed 2026-08-01
- [x] Phase 21: AI Agent 集成 - 聊天 UI — completed 2026-08-01

</details>

### 🚧 v2.1 AI CDP 增强 + Tabbrowser 功能集成 (In Progress)

**Milestone Goal:** 为 AI Agent 增加深度浏览器控制能力 — 从只能调用 5 个基础工具升级为能深度操控网页内容、引用标签页上下文、自动执行任务、生成脚本和智能整理标签页。

- [x] **Phase 22: CDP 管理器扩展 + 基础网页操控工具** - 独立 CDP 管理器 + read_page_content + extract_links + open_link (completed 2026-08-02)
- [ ] **Phase 23: 智能上下文引用 + 全文检索** - @ 引用标签页上下文 + FTS5 全文检索收藏
- [ ] **Phase 24: 任务自主执行** - 自动化填表 + 自动化操作 + 操作确认 + 安全防护
- [ ] **Phase 25: 脚本生成 + 智能标签整理** - 一句话生成脚本 + AI 自动标签分组

## Phase Details

### Phase 22: CDP 管理器扩展 + 基础网页操控工具

**Goal**: AI Agent 能够读取网页内容、提取链接、在容器中打开链接 — 所有后续阶段的 CDP 基础
**Depends on**: Nothing (本里程碑第一阶段)
**Requirements**: CDP-01, CDP-02, CDP-03, CDP-04
**Success Criteria** (what must be TRUE):

  1. 用户在 AI 聊天面板中输入"读取当前页面内容"，AI 返回页面标题、正文摘要和元信息
  2. 用户在 AI 聊天面板中输入"提取页面链接"，AI 返回当前页面所有有效链接列表（去重、过滤非 HTTP 协议）
  3. 用户在 AI 聊天面板中输入"打开某链接"，AI 在指定容器的当前标签页或新标签页中打开该链接
  4. CDP 会话在 webview 销毁时自动清理，不会因会话泄漏导致内存持续增长
  5. 大页面（>1MB）内容提取在 5 秒内返回，不阻塞 UI 交互

**Plans**: 5/5 plans complete
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — CDP 管理器扩展 + Readability 库准备
- [x] 22-04-PLAN.md — Gap 修复（CR-01 容器校验数据源 + UI-SPEC 空状态文案 2 条）
- [x] 22-05-PLAN.md — Gap 修复（移除 navigate 消除幽灵 Tab + 截断契约字符语义化 + UI-SPEC/UAT 同步）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — 实现 read_page_content/extract_links/open_link 三个 AI 工具

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-03-PLAN.md — 集成测试 + 系统提示词更新 + webview 销毁清理

**UI hint**: yes

### Phase 23: 智能上下文引用 + 全文检索

**Goal**: 用户在 AI 对话中可以引用特定标签页内容作为上下文，并通过全文检索搜索收藏内容
**Depends on**: Phase 22
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05
**Success Criteria** (what must be TRUE):

  1. 用户在 AI 聊天输入框中输入 @ 符号，弹出当前标签页选择器，可选择一个或多个标签页
  2. 选择标签页后发送消息，AI 能引用所选标签页的页面内容回答问题
  3. 用户在 AI 聊天中输入"搜索收藏 XXX"，AI 通过全文检索返回包含 XXX 内容的收藏项（支持中文搜索）
  4. @ 引用仅限当前容器的标签页，不会泄露其他容器的页面内容
  5. 全文检索索引在收藏新增/更新时自动维护，无需手动重建

**Plans**: TBD
**UI hint**: yes

### Phase 24: 任务自主执行

**Goal**: AI Agent 能够自动填写网页表单和执行页面操作，所有写操作必须用户确认
**Depends on**: Phase 22
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06
**Success Criteria** (what must be TRUE):

  1. 用户在 AI 聊天中描述填表需求（如"帮我填写登录表单，用户名 test@example.com"），AI 定位表单字段并填入值
  2. 用户在 AI 聊天中描述操作需求（如"点击提交按钮"），AI 执行对应的页面操作
  3. 所有写操作（填表、点击、提交）执行前弹出确认对话框，显示具体操作内容，用户确认后才执行
  4. 遇到 CAPTCHA 或 2FA 页面时，AI 提示用户手动操作，不尝试绕过
  5. 恶意网页的 Prompt Injection 攻击被输入消毒和脚本静态分析拦截，不会导致非预期操作

**Plans**: TBD
**UI hint**: yes

### Phase 25: 脚本生成 + 智能标签整理

**Goal**: 用户可以用自然语言描述生成可执行脚本，并通过 AI 智能分组整理标签页
**Depends on**: Phase 22, Phase 24
**Requirements**: SCRIPT-01, SCRIPT-02, SCRIPT-03, TAG-01, TAG-02
**Success Criteria** (what must be TRUE):

  1. 用户在 AI 聊天中输入自然语言描述（如"每天早上打开新闻网站并截取标题"），AI 生成可执行脚本并展示预览
  2. 生成的脚本在执行前经过静态分析验证，包含危险操作（eval、文件系统访问）的脚本被拦截并提示用户
  3. 用户确认脚本内容后，脚本在当前容器中执行，执行结果实时反馈
  4. 用户在 AI 聊天中输入"整理标签页"，AI 按主题或域名智能分组当前所有标签页并展示分组建议
  5. 用户确认分组建议后，标签页按分组重新排列，视觉上清晰区分不同组

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 22 → 23 → 24 → 25

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Container Management + Architecture Refactoring | v1.0 | 3/3 | Complete | 2026-07-23 |
| 2. Browser Core - URL Navigation + Multi-Tab | v1.0 | 5/5 | Complete | 2026-07-23 |
| 3. Data Isolation + Cookie Persistence | v1.0 | 1/1 | Complete | 2026-07-23 |
| 4. Convenience Features | v1.0 | 3/3 | Complete | 2026-07-24 |
| 5. 容器属性扩展 | v1.1 | 1/1 | Complete | 2026-07-25 |
| 6. 浏览历史记录 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 7. 收藏夹管理 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 8. 常用网站推荐 + 设置页面 | v1.1 | 2/2 | Complete | 2026-07-25 |
| 9. 共享收藏数据库 | v1.1 | 3/4 | Complete | 2026-07-26 |
| 10. Cookie 管理增强 | v1.2 | 2/2 | Complete | 2026-07-26 |
| 11. 设置页面重构 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 12. 开发者模式 | v1.2 | 2/2 | Complete | 2026-07-27 |
| 13. 右键菜单增强 | v1.3 | 3/3 | Complete | 2026-07-27 |
| 14. 收藏夹文件夹 - 数据库层实现 | v2.0 | 1/1 | Complete | 2026-07-28 |
| 15. 收藏夹文件夹 - UI 交互 | v2.0 | 2/2 | Complete | 2026-07-28 |
| 16. 收藏夹文件夹 - 增强功能 | v2.0 | 3/3 | Complete | 2026-07-29 |
| 17. Chrome 书签导入 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 18. 收藏栏功能 | v2.0 | 2/2 | Complete | 2026-07-30 |
| 19. AI Agent 集成 - 基础验证 | v2.0 | 2/2 | Complete | 2026-07-31 |
| 20. AI Agent 集成 - 核心功能 | v2.0 | 2/2 | Complete | 2026-08-01 |
| 21. AI Agent 集成 - 聊天 UI | v2.0 | 3/3 | Complete | 2026-08-01 |
| 22. CDP 管理器扩展 + 基础网页操控工具 | v2.1 | 5/5 | Complete   | 2026-08-02 |
| 23. 智能上下文引用 + 全文检索 | v2.1 | 0/TBD | Not started | - |
| 24. 任务自主执行 | v2.1 | 0/TBD | Not started | - |
| 25. 脚本生成 + 智能标签整理 | v2.1 | 0/TBD | Not started | - |
