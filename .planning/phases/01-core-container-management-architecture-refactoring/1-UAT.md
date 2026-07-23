---
status: complete
phase: 01-core-container-management-architecture-refactoring
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: "2026-07-23T22:05:00Z"
updated: "2026-07-23T22:50:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. 冷启动测试
expected: 运行 npm run dev，应用正常启动，无报错。主窗口显示工具栏、容器指示器和侧边栏。
result: pass
note: "初次报告 logo 与 macOS 红绿灯重叠（cosmetic），修复 commit c431f1a 后用户复测通过"

### 2. 容器下拉面板
expected: 点击工具栏上的容器指示器（显示当前容器名称的区域），弹出下拉面板，列出所有容器（默认、工作、个人、金融），每个容器显示颜色圆点和名称。
result: pass

### 3. 容器切换
expected: 在下拉面板中点击"工作"容器，面板关闭，容器指示器更新为蓝色圆点 + "工作"，当前容器高亮标记转移到"工作"。
result: pass

### 4. 创建容器
expected: 点击下拉面板中的"+"按钮，弹出新建容器 Modal。输入名称"测试"，选择绿色和🔬图标，点击"创建容器"。Modal 关闭，新容器出现在下拉面板列表中。
result: pass

### 5. 编辑容器
expected: 将鼠标悬停在下拉面板中的"测试"容器上，点击编辑图标（铅笔），弹出编辑 Modal，标题为"编辑容器"，名称、颜色、图标已预填。将名称改为"研发"，点击"保存"。Modal 关闭，列表中显示"研发"。
result: pass

### 6. 删除容器
expected: 将鼠标悬停在"研发"容器上，点击删除图标（垃圾桶），弹出删除确认弹窗，显示容器预览（绿色圆点 + 🔬 研发）和警告文字。点击"删除"按钮，弹窗关闭，容器从列表消失，底部显示"容器已删除"成功提示。
result: pass

### 7. 默认容器保护
expected: 将鼠标悬停在"默认"容器上，删除图标显示为灰色禁用状态，鼠标悬停时显示"默认容器不可删除"提示。点击无反应。
result: pass

### 8. 删除活跃容器自动切换
expected: 先切换到"工作"容器，然后删除"工作"容器。删除成功后，容器指示器自动切换回"默认"容器。
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "应用启动后左上角 Realm 图标/文字应完整可见，不与 macOS 窗口控制按钮（红绿灯）重叠"
  status: fixed
  reason: "User reported: 左上角有个问题，三个按钮和 Realm 文字和图片重合了"
  severity: cosmetic
  test: 1
  root_cause: "window-manager.js 使用 titleBarStyle:'hiddenInset' 将 macOS 红绿灯内嵌到渲染区（约 78×38pt，距左/顶 ~12px），但 src/styles/main.css 中 .sidebar-header 仅 padding:16px，未预留红绿灯安全区，logo 从左上角 16px 处开始排布与按钮重叠"
  artifacts: ["window-manager.js:30", "src/styles/main.css:64-70", "src/index.html:12-16"]
  missing: [".sidebar-header 需要 padding-top ≥ 38px（或等效 safe-area 处理）以避让 hiddenInset 红绿灯"]
  fix_commit: "c431f1a"
  fix_summary: ".sidebar-header padding 由 16px 改为 38px 16px 16px，预留 macOS hiddenInset 红绿灯安全区"
