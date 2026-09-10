---
phase: 41
slug: web-fetch-ui
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | 未配置（项目当前无测试框架） |
| **Config file** | none — Wave 0 可选安装 |
| **Quick run command** | `npm run validate`（现有脚本级验证） |
| **Full suite command** | `npm run validate` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run validate`
- **After every plan wave:** 手动验证所有 Success Criteria
- **Before `/gsd-verify-work`:** 手动验证 + `npm run validate` 必须通过
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | FETCH-01 | — | web_fetch 工具注册到 _buildRealmTools() | manual | 启动应用，AI 调用 web_fetch | ❌ W0 | ⬜ pending |
| 41-01-02 | 01 | 1 | FETCH-02 | T-41-01 | URL 内容抓取（HTML/JSON/纯文本）+ SSRF 防护 | manual | AI 抓取公开网页 + 尝试抓取 127.0.0.1 | ❌ W0 | ⬜ pending |
| 41-01-03 | 01 | 1 | FETCH-03 | — | HTML→Markdown 转换质量 | manual | 检查返回的 Markdown 格式（保留链接/图片/标题） | ❌ W0 | ⬜ pending |
| 41-01-04 | 01 | 1 | FETCH-04 | T-41-01 | SSRF 防护（内网地址拒绝 + 重定向校验） | manual | AI 尝试抓取 127.0.0.1 / 10.x / 192.168.x | ❌ W0 | ⬜ pending |
| 41-02-01 | 02 | 2 | CONFIG-01 | — | 设置页搜索配置子区域 UI | manual | 打开设置页查看"网络搜索"子区域 | ❌ W0 | ⬜ pending |
| 41-02-02 | 02 | 2 | CONFIG-02 | — | Provider 选择切换即时生效 | manual | 切换 Provider 验证即时生效 | ❌ W0 | ⬜ pending |
| 41-02-03 | 02 | 2 | CONFIG-03 | T-41-02 | API Key 管理（添加/删除/验证） | manual | 添加/删除/验证 Key | ❌ W0 | ⬜ pending |
| 41-02-04 | 02 | 2 | CONFIG-04 | — | IPC + preload 暴露 | manual | 通过设置页操作验证 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 测试框架配置（项目当前无自动化测试，可选）
- [ ] web_fetch 单元测试 stubs（可选，当前全手动验证）

*Note: 项目当前无测试框架，所有验证通过手动 + `npm run validate` 进行。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| web_fetch 抓取公开网页返回 Markdown | FETCH-02 | 需要真实网络请求和 AI Agent 调用 | 启动应用 → AI 聊天输入"读取 https://example.com 的内容" → 检查返回 Markdown |
| web_fetch 拒绝内网地址 | FETCH-04 | SSRF 防护需真实网络环境 | 启动应用 → AI 聊天输入"读取 http://127.0.0.1" → 检查返回错误信息 |
| 设置页 Provider 切换即时生效 | CONFIG-02 | UI 交互行为 | 打开设置页 → 网络搜索 → 切换 Provider → 验证右侧编辑器切换 |
| API Key 验证功能 | CONFIG-03 | 需要真实 API Key | 输入 API Key → 点击验证 → 检查结果反馈 |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
