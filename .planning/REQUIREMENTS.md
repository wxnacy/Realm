# Milestone v2.1 Requirements

**Milestone:** v2.1 AI CDP 增强 + Tabbrowser 功能集成
**Goal:** 为 AI Agent 增加深度浏览器控制能力，集成 Tabbrowser 核心功能

## Phase 22: CDP 管理器扩展 + 基础网页操控工具

- [x] **CDP-01**: 独立 CDP 管理器扩展（Runtime/DOM/Page 域支持 + 资源监控和自动清理）
- [x] **CDP-02**: read_page_content 工具（读取当前标签页的页面标题、正文、元信息）
- [x] **CDP-03**: extract_links 工具（提取页面所有有效链接，支持过滤和去重）
- [x] **CDP-04**: open_link 工具（在指定容器中打开链接，支持当前标签页或新标签页）

## Phase 23: 智能上下文引用 + 全文检索

- [x] **CTX-01**: @ 引用标签页 UI（输入框 + Tab 选择器，支持多标签页引用）
- [x] **CTX-02**: ai:prompt-with-context IPC 通道（渲染进程传递 Tab 元数据到主进程）
- [x] **CTX-03**: AI 上下文注入逻辑（将引用的标签页内容注入到 AI 对话上下文）
- [x] **CTX-04**: FTS5 全文检索索引扩展（favorites-manager.js 新增 FTS5 虚拟表和触发器）
- [x] **CTX-05**: search_favorites_fulltext 工具（AI 可搜索收藏内容）

## Phase 24: 任务自主执行

- [ ] **AUTO-01**: fillForm CDP 方法（自动化填写网页表单）
- [ ] **AUTO-02**: executeAction CDP 方法（执行点击、滚动等页面操作）
- [ ] **AUTO-03**: fill_form AI 工具（AI 调用填表能力）
- [ ] **AUTO-04**: execute_action AI 工具（AI 调用操作能力）
- [ ] **AUTO-05**: 操作确认 UI（高风险操作必须用户确认）
- [ ] **AUTO-06**: Prompt Injection 防护（输入消毒、脚本静态分析、沙箱执行）

## Phase 25: 脚本生成 + 智能标签整理

- [ ] **SCRIPT-01**: generate_script 工具（自然语言描述生成可执行脚本）
- [ ] **SCRIPT-02**: 脚本预览/确认 UI（用户确认后执行）
- [ ] **SCRIPT-03**: 脚本静态分析和安全验证（防止代码注入和权限提升）
- [ ] **TAG-01**: suggest_tab_groups 工具（AI 按主题/域名智能分组标签页）
- [ ] **TAG-02**: 标签分组 UI（展示和应用分组建议）

## Future Requirements

- 容器感知的 AI 上下文 — AI 理解当前容器身份
- 跨容器内容对比 — 对比不同容器中同一网站的内容差异
- AI 浏览摘要 — 自动生成页面结构化摘要
- 智能表单记忆 — 按容器隔离存储表单数据

## Out of Scope

- **Cookie/请求保存功能修改** — 本版本不修改现有 Cookie 管理和请求保存的核心功能（技术约束）
- **自动化脚本市场** — 需要脚本格式标准化，v2+ 考虑
- **操作录制回放** — 类似 Playwright codegen，复杂度高，v2+ 考虑
- **标签页智能休眠** — 可后续迭代
- **无确认的自动化操作** — 所有写操作必须用户确认（安全约束）
- **页面内容持久化存储** — 仅内存缓存，会话结束清除（隐私约束）
- **跨容器数据泄露** — AI 上下文严格按容器隔离（安全约束）
- **自动化绕过网站安全机制** — 遇到 CAPTCHA/2FA 提示用户手动操作（安全约束）

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CDP-01 | 22 | Complete |
| CDP-02 | 22 | Complete |
| CDP-03 | 22 | Complete |
| CDP-04 | 22 | Complete |
| CTX-01 | 23 | Complete |
| CTX-02 | 23 | Complete |
| CTX-03 | 23 | Complete |
| CTX-04 | 23 | Complete |
| CTX-05 | 23 | Complete |
| AUTO-01 | 24 | Pending |
| AUTO-02 | 24 | Pending |
| AUTO-03 | 24 | Pending |
| AUTO-04 | 24 | Pending |
| AUTO-05 | 24 | Pending |
| AUTO-06 | 24 | Pending |
| SCRIPT-01 | 25 | Pending |
| SCRIPT-02 | 25 | Pending |
| SCRIPT-03 | 25 | Pending |
| TAG-01 | 25 | Pending |
| TAG-02 | 25 | Pending |
