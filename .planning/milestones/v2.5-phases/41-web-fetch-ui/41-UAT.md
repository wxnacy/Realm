---
status: complete
phase: 41-web_fetch 工具 + 搜索配置 UI
source: [41-VERIFICATION.md]
started: 2026-08-27
updated: 2026-08-27
---

## Current Test

[testing complete]

## Tests

### 1. HTML→Markdown 转换质量
expected: AI 调用 web_fetch 抓取公开网页（如 https://example.com），返回的 Markdown 保留链接（带 href）、图片（带 alt）、标题层级、列表、代码块。去除 script/style/nav/footer/aside。
result: pass
note: "测试 https://en.wikipedia.org/wiki/Electron_(software)，链接/图片/标题/列表/表格均正确转换，截断标记正常"

### 2. SSRF 防护运行时行为
expected: AI 尝试抓取 http://127.0.0.1 或 http://192.168.1.1 时，返回明确的错误信息（如"拒绝访问内网地址"），而非沉默失败。
result: pass

### 3. 设置页 UI 交互
expected: 打开设置页 → AI 助手分区 → 点击"网络搜索"展开子区域 → 左侧显示 6 个 Provider 列表（auto/tavily/brave/serper/anysearch/anysearch_free），每个显示状态标签（未配置/已配置/免费）→ 点击 Provider 右侧显示 API Key 编辑器。
result: pass
note: "UI 功能正常，但下拉箭头太小，用户要求去掉箭头直接展示"

### 4. API Key 验证流程
expected: 输入 API Key → 点击"验证 API Key" → 按钮变为"正在验证..."（disabled）→ 验证成功显示绿色对勾 + "Key 有效"，失败显示红色叉号 + 具体错误信息。覆盖已有 Key 时弹出 inline 确认条。
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
