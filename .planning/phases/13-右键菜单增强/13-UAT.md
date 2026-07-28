---
status: complete
phase: 13-右键菜单增强
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md]
started: 2026-07-28T00:00:00Z
updated: 2026-07-28T00:29:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出应用后重启，主窗口正常加载，容器列表和 Tab 列表显示正常，控制台无启动错误
result: pass

### 2. Tab 栏右键菜单显示
expected: 在任意 Tab 上右键，弹出原生菜单，包含：关闭标签页、关闭其他标签页、关闭左侧标签页、关闭右侧标签页、重新打开已关闭标签页（无可关闭项时禁用）、固定标签页/取消固定
result: pass

### 3. 通过右键菜单关闭标签页
expected: Tab 右键 → 关闭标签页，该 Tab 立即被关闭，相邻 Tab 自动激活
result: pass

### 4. 关闭其他/左侧/右侧标签页
expected: 在有 3+ 个 Tab 的情况下，右键菜单选择"关闭其他标签页"仅保留当前 Tab；"关闭左侧/右侧标签页"分别关闭对应方向所有 Tab，当前 Tab 保留
result: pass

### 5. 重新打开已关闭标签页
expected: 先关闭一个 Tab（记住其 URL），再右键其他 Tab → "重新打开已关闭标签页"，关闭的 Tab 在原容器中以原 URL 恢复
result: issue
reported: "点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
severity: major

### 6. 固定/取消固定标签页
expected: Tab 右键 → 固定标签页，该 Tab 移到 Tab 栏最左侧（带 .tab-pinned class 标识）；再次右键 → 取消固定，Tab 回到普通位置
result: issue
reported: "固定后样式不好看，标题没有了，只有底部一个小点，应该显示下网站图标"
severity: major

### 7. 网页通用右键菜单
expected: 在网页空白处右键，弹出菜单含：后退/前进/重新加载/强制刷新、复制页面地址、添加到收藏、在新标签页打开、在后台打开、检查元素、查看页面源代码、撤销/剪切/复制/粘贴/全选（部分项按上下文禁用）
result: issue
reported: "右键只有检查元素/后退/前进/刷新/复制。差距很大"
severity: major

### 8. 图片右键菜单
expected: 在网页中的图片上右键，菜单顶部显示图片专属项：图片另存为、复制图片、复制图片地址、在新标签页打开图片；下方为通用菜单项
result: issue
reported: "图片右击和空白页右键出现的内容相同，不符合讨论内容"
severity: major

### 9. 链接右键菜单 + 容器中打开
expected: 在链接上右键，菜单含：在新标签页打开链接、在后台标签页打开链接、复制链接地址、添加到收藏、"在容器中打开"子菜单（列出所有容器，选择后链接在指定容器的新 Tab 中打开）
result: issue
reported: "链接右击和空白页右键出现的内容相同，不符合讨论内容"
severity: major

### 10. 文本编辑操作（输入框右键）
expected: 在网页输入框中选中文字后右键，剪切/复制/粘贴/全选可用并正常工作（使用 execCommand 白名单）
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "重新打开已关闭标签页应恢复所有刚被批量关闭的标签页"
  status: failed
  reason: "User reported: 点击关闭右侧标签页，再点击恢复，只恢复了最右侧的。没有一次性恢复多个"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "固定标签页应显示网站图标（favicon）而非仅一个小点"
  status: failed
  reason: "User reported: 固定后样式不好看，标题没有了，只有底部一个小点，应该显示下网站图标"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "网页通用右键菜单应包含全部 13 项通用菜单项（导航/页面操作/开发者工具/文本编辑）"
  status: failed
  reason: "User reported: 右键只有检查元素/后退/前进/刷新/复制。差距很大"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "图片上右键应显示图片专属菜单项（图片另存为/复制图片/复制图片地址/在新标签页打开图片）"
  status: failed
  reason: "User reported: 图片右击和空白页右键出现的内容相同，不符合讨论内容"
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "链接上右键应显示链接专属菜单项（新标签页打开/后台打开/复制链接地址/添加到收藏/在容器中打开子菜单）"
  status: failed
  reason: "User reported: 链接右击和空白页右键出现的内容相同，不符合讨论内容"
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
