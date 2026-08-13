# Phase 32: 自动填充 — 凭据引擎 - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

用户登录网站时保存凭据，再次访问时自动填充，凭据按容器隔离存储。

**核心交付：**
- AF-01: 用户提交登录表单时弹出保存凭据提示
- AF-02: 保存的凭据使用 safeStorage 加密存储（macOS Keychain）
- AF-03: 用户再次访问已保存凭据的网站时自动填充用户名和密码
- AF-05: 凭据数据按容器隔离存储（不同容器的同一网站凭据独立）
- AF-08: 自动填充与现有 CDP fillForm 工具互斥（AI 填表时禁用浏览器 autofill）
- AF-09: 自动填充在 webview preload 脚本中检测表单（需 DOM 上下文）

**成功标准：**
1. 用户提交登录表单时弹出保存凭据提示
2. 保存的凭据使用 safeStorage 加密存储（macOS Keychain）
3. 用户再次访问已保存凭据的网站时自动填充用户名和密码
4. 凭据按容器隔离存储，容器 A 的凭据不会在容器 B 中被填充
5. AI 填表（CDP fillForm）激活时，浏览器 autofill 自动禁用，避免冲突

</domain>

<decisions>
## Implementation Decisions

### 表单检测策略
- **D-01:** 检测时机：页面加载完成后扫描 + MutationObserver 持续监听（两者结合）
- **D-02:** 识别规则：两层检测 — 第一层 password 字段存在即为登录表单，第二层多字段特征匹配精细分类（登录/注册/密码修改）
- **D-03:** 提交检测：监听 form submit 事件
- **D-04:** 凭据提取：直接读取 input[type=text/email] 和 input[type=password] 的 value

### 保存提示 UI 形态
- **D-05:** 提示位置：工具栏下方弹出横幅（Chrome 风格）
- **D-06:** 提示内容：保存/永不/暂不 三按钮 + 网站名
- **D-07:** 永不保存记录：记录到凭据存储（按容器隔离）
- **D-08:** 自动消失：10 秒后自动消失（等同于「暂不」）

### 自动填充时机与交互
- **D-09:** 填充时机：页面加载后自动填充用户名和密码
- **D-10:** 多账号处理：只保存一个凭据（同一网站最后一个）
- **D-11:** 填充反馈：无额外视觉反馈，字段直接填好
- **D-12:** 页面刷新：每次都填充（刷新/重新导航都触发）

### autofill/fillForm 互斥机制
- **D-13:** 互斥策略：fillForm 激活时临时禁用 autofill 检测
- **D-14:** 优先级：fillForm 优先（AI 填表优先于浏览器 autofill）
- **D-15:** 状态同步：fillForm 完成后自动恢复 autofill 检测
- **D-16:** 禁用持续时间：仅执行期间禁用（fillForm 执行完立即恢复）

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Electron API
- `src/webview-preload.js` — 现有 webview preload 脚本结构，表单检测将在此实现
- `src/preload.js` — IPC 接口暴露模式，凭据 API 将遵循此模式
- `main.js` — 主进程架构，凭据存储和 IPC 处理将在此实现

### 现有代码模式
- `.planning/phases/30-download-manager-core/30-CONTEXT.md` — Phase 30 决策：SQLite 表结构、IPC 通道设计模式
- `.planning/phases/31-download-manager-ui/31-CONTEXT.md` — Phase 31 决策：UI 组件模式、realm:// 页面模式

### 需求文档
- `.planning/REQUIREMENTS.md` — AF-01, AF-02, AF-03, AF-05, AF-08, AF-09 需求定义
- `.planning/ROADMAP.md` — Phase 32 目标和成功标准

### 技术约束
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **webview-preload.js**: 现有 preload 脚本结构，使用 contextBridge 暴露安全接口，表单检测将在此扩展
- **IPC 通信模式**: contextBridge + ipcMain.handle 模式，凭据 API 将遵循此模式
- **SQLite + better-sqlite3**: Phase 30 已使用，凭据存储将使用相同模式
- **container_id 列模式**: Phase 30 downloads 表已验证，凭据表将使用相同模式
- **深色主题 CSS 变量**: 已有完整颜色系统，保存提示 UI 将直接使用

### Established Patterns
- **容器隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）
- **SQLite 同步 API**: 使用 better-sqlite3 同步 API
- **realm:// 协议**: 已有 realm://history、realm://favorites 等内部页面
- **IPC 事件广播**: download:started、download:progress 等事件已定义，凭据事件将遵循此模式

### Integration Points
- **webview-preload.js**: 表单检测和凭据提取将在此实现
- **main.js**: 凭据存储、加密、IPC 处理将在此实现
- **src/preload.js**: 暴露凭据 API 给渲染进程
- **src/renderer.js**: 保存提示 UI 横幅将在此实现

</code_context>

<specifics>
## Specific Ideas

- 保存提示 UI 类似 Chrome 的工具栏下方横幅，用户熟悉
- 表单检测使用两层检测：password 字段存在 + 多字段特征匹配
- autofill/fillForm 互斥：fillForm 优先，执行期间临时禁用 autofill
- 凭据存储使用 safeStorage 异步 API（encryptStringAsync/decryptStringAsync）
- 同一网站只保存一个凭据（最后一个）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-自动填充 — 凭据引擎*
*Context gathered: 2026-08-13*
