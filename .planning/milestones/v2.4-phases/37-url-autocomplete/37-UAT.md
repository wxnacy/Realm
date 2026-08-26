---
status: complete
phase: 37-url-autocomplete
source: [37-01-SUMMARY.md, 37-02-SUMMARY.md]
started: 2026-08-21T04:25:00Z
updated: 2026-08-21T05:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. searchAllContainers 跨容器历史搜索
expected: searchAllContainers 方法通过 UNION ALL 查询所有 history_* 表
result: pass
source: automated
coverage_id: D1 (37-01)

### 2. searchFrequentSites 常用网站搜索
expected: searchFrequentSites 通过关键词过滤 getFrequentSites(100) 结果
result: pass
source: automated
coverage_id: D2 (37-01)

### 3. autocomplete-manager 多源合并
expected: getSuggestions 合并 3 个数据源（收藏夹、常用网站、历史记录），带 LRU 缓存
result: pass
source: automated
coverage_id: D3 (37-01)

### 4. IPC 处理器注册
expected: autocomplete:query IPC 处理器已注册，带 assertTrustedSender 安全检查
result: pass
source: automated
coverage_id: D4 (37-01)

### 5. preload API 暴露
expected: getAutocompleteSuggestions 已通过 preload contextBridge 暴露给渲染进程
result: pass
source: automated
coverage_id: D5 (37-01)

### 6. 内联补全文本显示
expected: 输入时在光标后显示高亮的补全文本（Chrome 风格）
result: pass
source: automated
coverage_id: D1 (37-02)

### 7. Tab/ArrowRight 接受补全
expected: 按 Tab 或右箭头可接受内联补全建议
result: pass
source: automated
coverage_id: D2 (37-02)

### 8. 实时更新内联补全
expected: 输入过程中内联补全文本实时更新
result: pass
source: automated
coverage_id: D3 (37-02)

### 9. 下拉列表限制 6 项
expected: 下拉列表最多显示 6 个建议项
result: pass
source: automated
coverage_id: D4 (37-02)

### 10. 每项显示 favicon + 标题 + URL
expected: 每个建议项显示网站图标、标题和 URL
result: pass
source: automated
coverage_id: D5 (37-02)

### 11. 键盘导航
expected: 支持 ArrowDown/ArrowUp/Enter/Tab/Escape 键盘导航
result: pass
source: automated
coverage_id: D6 (37-02)

### 12. 鼠标点击导航
expected: 点击建议项可跳转到对应 URL
result: pass
source: automated
coverage_id: D7 (37-02)

### 13. 深色主题样式
expected: 下拉菜单样式与深色主题一致
result: pass
source: automated
coverage_id: D8 (37-02)

### 14. 输入防抖 100ms
expected: 自动补全输入有 100ms 防抖延迟
result: pass
source: automated
coverage_id: D9 (37-02)

## Manual Functional Tests

### 15. 输入触发自动补全
expected: 在地址栏输入关键词后，100ms 内弹出下拉建议列表，显示收藏夹/常用网站/历史记录的匹配结果
result: pass

### 16. 内联补全文本
expected: 输入时地址栏光标后出现灰色高亮的补全文本（Chrome 风格），实时跟随输入更新
result: pass

### 17. Tab 接受内联补全
expected: 内联补全文本显示时，按 Tab 键接受补全，地址栏填入完整 URL
result: pass

### 18. 键盘导航下拉列表
expected: 按 ArrowDown/ArrowUp 在下拉列表中切换选中项，选中项有高亮样式
result: pass

### 19. Enter 跳转
expected: 下拉列表中有选中项时，按 Enter 跳转到该 URL
result: pass

### 20. 鼠标点击跳转
expected: 鼠标点击下拉列表中的某一项，跳转到对应 URL
result: pass

### 21. Escape 关闭下拉
expected: 下拉列表打开时，按 Escape 关闭下拉列表
result: pass

### 22. 下拉列表最多 6 项
expected: 输入常见关键词时，下拉列表最多显示 6 个建议项
result: pass

### 23. 匹配度优先排序
expected: 输入 "hugg" 时 huggingface.co 排在第一位，收藏夹仅在匹配度相同时优先
result: pass

### 24. 多词模糊查询
expected: 输入 "git wxnacy" 时出现 github.com/wxnacy，每个词都必须在 URL 或标题中出现
result: pass

## Summary

total: 24
passed: 24
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "输入时地址栏光标后出现灰色高亮的补全文本"
  status: failed
  reason: "用户报告: 没有出现补全文本，并且地址栏现在很短"
  severity: major
  test: 16
  root_cause: "1) .url-input 使用 flex:1 但在 wrapper 内无效，需改为 width:100%; 2) updateInlineCompletion 只处理 URL 前缀匹配，标题子串匹配不显示补全; 3) .toolbar-center 缺少 position:relative 导致下拉定位异常"
  artifacts:
    - path: "src/styles/main.css"
      issue: ".url-input flex:1 在 wrapper 内无效，.toolbar-center 缺少 position:relative"
    - path: "src/renderer.js"
      issue: "updateInlineCompletion 只处理 URL 前缀匹配"
  missing:
    - "url-input 改为 width:100% + box-sizing:border-box"
    - "增加 URL 中间位置匹配逻辑"
    - "toolbar-center 增加 position:relative"

- truth: "匹配结果按匹配度排序，相同匹配度时收藏夹优先"
  status: failed
  reason: "用户报告: 输入 hugg 第一个出现 map.yanue.net/gps.html 而不是 huggingface.co"
  severity: major
  test: 23
  root_cause: "排序逻辑把所有收藏夹无条件置顶，未考虑匹配度；客户端缓存前缀子集优化可能导致旧结果混入"
  artifacts:
    - path: "autocomplete-manager.js"
      issue: "排序仅按 source 分组，无匹配度评分"
    - path: "src/renderer.js"
      issue: "getCachedSuggestions 前缀子集过滤可能返回不相关结果"
  missing:
    - "新增 calculateRelevanceScore 按 URL 前缀/域名/标题匹配度评分"
    - "排序改为匹配度优先，收藏夹仅 +5 分平局加分"
    - "客户端缓存移除前缀子集优化"
