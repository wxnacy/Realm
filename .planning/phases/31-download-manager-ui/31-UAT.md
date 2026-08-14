---
status: complete
phase: 31-download-manager-ui
source: 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md
started: 2026-08-13T03:27:43Z
updated: 2026-08-14T09:20:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. 下载面板打开/关闭
expected: 点击工具栏下载按钮，面板从按钮下方弹出（380x480px）。再次点击下载按钮，面板关闭。
result: pass

### 2. 下载面板显示最近记录
expected: 面板显示最近 10 条下载记录，每条包含文件名、状态图标。无下载时显示"暂无下载记录"。
result: pass

### 3. 进行中下载的进度条
expected: 下载进行中时显示进度条（accent 色）和暂停按钮。暂停时进度条保留进度并变为 muted 色。
result: pass

### 4. 暂停/恢复单个下载
expected: 进行中的下载点击暂停按钮后暂停，进度条保留并变色。暂停的下载点击恢复按钮后继续下载。
result: pass

### 5. 已完成下载的操作按钮
expected: 已完成的下载记录 hover 时显示打开文件、Finder、删除三个按钮。
result: pass

### 6. 删除单条下载记录
expected: 点击删除按钮弹出居中确认弹窗，可选删除本地文件。确认后记录从列表移除。
result: pass
resolved: 2026-08-14 — 弹窗居中（* {margin:0} 覆盖 dialog UA margin:auto，已补回）；面板保持打开（embedder mousedown 落点记录裁决 webview 穿透 IPC + document click 排除 closest('dialog')）；确认后列表实时刷新。详见 docs/bugs/download-panel-close-on-dialog.md

### 7. 清空所有下载记录
expected: 点击"清空"按钮，二次确认后面板保持打开，列表实时刷新为空状态。
result: pass
resolved: 2026-08-14 — 同 #6 同一组修复

### 8. realm://downloads 页面
expected: 点击"查看全部"打开新标签页，显示完整下载历史，布局与历史记录页一致。
result: pass

### 9. downloads 页面搜索
expected: 在搜索框输入关键词，300ms debounce 后过滤显示匹配的下载记录。
result: pass

### 10. downloads 页面滚动分页
expected: 滚动到底部自动加载下一页（50 条/页），无明显卡顿。
result: pass

### 11. downloads 页面暂停/恢复操作
expected: realm://downloads 页面上的暂停/恢复按钮正常工作，与面板内操作一致。
result: pass
resolved: 2026-08-14 — 原症状（暂停后文字卡在"下载中 · 计算中..."）由暂停进度 gap 修复覆盖：getAllDownloads 返回 progress 字段后，apiAction 刷新即正确显示"已暂停"+进度保留 45%+muted 色（mock 服务实测验证）

### 12. 批量操作（Cmd+Click 多选）
expected: Cmd+Click 多选下载记录后显示批量操作栏，可批量删除选中记录。
result: pass
resolved: 2026-08-14 — 实测（Playwright 驱动真实 Electron）多选逻辑一直正常，metaKey 正常到达；问题是视觉反馈不可见：selected 与 hover 同色（已改 accent 蓝色调）+ 批量栏需 ≥2 项才显示（已改 ≥1）+ 删除按钮为纯图标难发现（已改文字按钮）。另补充 downloads 页面 checkbox 批量管理（对齐历史页）。详见 docs/bugs/download-panel-multi-select.md

### 13. 面板关闭方式
expected: ESC 键、点击面板外部区域均可关闭面板。
result: pass

### D1. /api/downloads/list 响应格式
expected: /api/downloads/list 返回 {success: true, downloads: [...]} 格式
result: pass
source: automated
coverage_id: D1

### D2. 下载操作 HTTP API 路由
expected: pause/resume/cancel/open/show-in-folder 5 个 HTTP API 路由正常工作
result: pass
source: automated
coverage_id: D2

### D3. downloads-page.js 路由匹配
expected: downloads-page.js 调用路径与新路由完全匹配
result: pass
source: automated
coverage_id: D3

## Summary

total: 16
passed: 16
issues: 0
pending: 0
skipped: 0

## Gaps

所有 gap 已于 2026-08-14 修复并回归验证通过：

- truth: "暂停时进度条保留暂停前的进度并变为 muted 色"
  status: resolved
  resolution: "pauseDownload/resumeDownload/interrupted 通知携带 percent + getAllDownloads 计算 progress 字段；同时修复 downloads 页面暂停后状态同步（test 11）"

- truth: "删除/清空操作时面板保持打开，弹窗确认后面板实时刷新"
  status: resolved
  resolution: "webview mousedown 经 IPC 异步晚到，改为 embedder capture 阶段记录最近 mousedown 落点，media:outside-click 到达时回看裁决；document click 排除 closest('dialog')；弹窗 margin:auto 居中修复。详见 docs/bugs/download-panel-close-on-dialog.md"
  debug_session: "docs/bugs/download-panel-close-on-dialog.md"

- truth: "Cmd+Click 多选下载记录，显示批量操作栏"
  status: resolved
  resolution: "功能实测正常，原因为视觉反馈不可见：selected 与 hover 同色 → accent 蓝色调；批量栏 ≥2 项才显示 → ≥1 项；纯图标按钮 → 文字按钮。另补充 downloads 页面 checkbox 批量管理。详见 docs/bugs/download-panel-multi-select.md"
  debug_session: "docs/bugs/download-panel-multi-select.md"
