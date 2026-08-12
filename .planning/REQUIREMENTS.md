# Milestone v2.3 Requirements

**Milestone:** v2.3 浏览器基础功能补全
**Goal:** 补全浏览器核心基础功能，提升日常使用体验
**Created:** 2026-08-11

## v1 Requirements

### 下载管理器

- [ ] **DL-01**: 用户下载文件时显示下载进度条（文件名、大小、速度、剩余时间）
- [x] **DL-02**: 用户可以在下载面板中查看下载历史列表
- [x] **DL-03**: 用户可以暂停正在进行的下载
- [x] **DL-04**: 用户可以恢复已暂停的下载（需服务端支持 Range 请求）
- [ ] **DL-05**: 用户可以打开已下载的文件（使用系统默认应用）
- [x] **DL-06**: 用户可以在 Finder 中显示已下载的文件
- [x] **DL-07**: 用户可以删除下载记录（可选是否删除本地文件）
- [x] **DL-08**: 用户可以清空所有下载历史
- [ ] **DL-09**: 点击下载链接时弹出保存对话框，用户可选择保存位置
- [ ] **DL-10**: 下载管理器工具栏按钮显示当前下载数量徽标
- [ ] **DL-11**: 下载数据按容器隔离存储（SQLite）

### 自动填充

- [ ] **AF-01**: 应用检测到用户提交登录表单时弹出保存凭据提示
- [ ] **AF-02**: 用户保存的凭据使用 safeStorage 加密存储（macOS Keychain）
- [ ] **AF-03**: 用户再次访问已保存凭据的网站时自动填充用户名和密码
- [ ] **AF-04**: 用户可以管理已保存的凭据（在设置页查看和删除）
- [ ] **AF-05**: 凭据数据按容器隔离存储（不同容器的同一网站凭据独立）
- [ ] **AF-06**: 用户可以保存地址表单信息（姓名、电话、地址）
- [ ] **AF-07**: 用户可以在地址表单中自动填充已保存的地址信息
- [ ] **AF-08**: 自动填充与现有 CDP fillForm 工具互斥（AI 填表时禁用浏览器 autofill）
- [ ] **AF-09**: 自动填充在 webview preload 脚本中检测表单（需 DOM 上下文）

### Bug Fixes + Polish

- [ ] **FIX-01**: 修复 20 个已诊断 debug sessions（从 v2.0-v2.2 延续）
- [ ] **FIX-02**: 清理 Phase 23 代码审查遗留 19 项（6 Critical）

## Future Requirements

<!-- 下一里程碑可能包含的功能 -->

- 边播边缓存 (Deferred from v2.2)
- 增强功能 (ENH-01~06: 截图/画中画/播放列表/字幕/DASH/RTMP)
- 书签导出
- 全屏模式
- 无痕/隐私浏览

## Out of Scope

- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）
- **页面缩放 (Zoom)** — 延后到后续里程碑
- **阅读模式** — 延后到后续里程碑
- **DASH (.mpd) 播放** — 二层根因未诊断，继续暂缓

## Traceability

<!-- 由 roadmap 填充，记录每个需求被哪个 Phase 覆盖 -->

| Requirement | Phase | Status |
|-------------|-------|--------|
| DL-01 | Phase 30 | Pending |
| DL-02 | Phase 31 | Complete |
| DL-03 | Phase 31 | Complete |
| DL-04 | Phase 31 | Complete |
| DL-05 | Phase 30 | Pending |
| DL-06 | Phase 31 | Complete |
| DL-07 | Phase 31 | Complete |
| DL-08 | Phase 31 | Complete |
| DL-09 | Phase 30 | Pending |
| DL-10 | Phase 30 | Pending |
| DL-11 | Phase 30 | Pending |
| AF-01 | Phase 32 | Pending |
| AF-02 | Phase 32 | Pending |
| AF-03 | Phase 32 | Pending |
| AF-04 | Phase 33 | Pending |
| AF-05 | Phase 32 | Pending |
| AF-06 | Phase 33 | Pending |
| AF-07 | Phase 33 | Pending |
| AF-08 | Phase 32 | Pending |
| AF-09 | Phase 32 | Pending |
| FIX-01 | Phase 33 | Pending |
| FIX-02 | Phase 33 | Pending |
