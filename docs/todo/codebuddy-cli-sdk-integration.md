# CodeBuddy CLI SDK 调研（待办）

> 调研日期：2026-09-04
> 结论：可集成，与 pi 互补而非冲突——pi 管「浏览器自动化 Agent」，CodeBuddy SDK 管「通用编码 Agent」。
> 状态：仅调研，未动手。后续重启时从「起步路径」一节开始。

## 一、SDK 是什么

- 包名 `@tencent-ai/agent-sdk`（调研时 0.3.252），纯 JS，运行时依赖仅 MCP/ACP SDK，要求 Node ≥ 18
- 文档：https://www.codebuddy.cn/docs/cli/sdk-typescript
- **CLI 可执行文件直接打包在 SDK 内**（`cli/bin/codebuddy` + dist-server 分片，npm 解包约 150MB），不需要用户预装 CLI；代价是集成后 Realm 包体增大约 150MB
- 本质：spawn 一个 CodeBuddy CLI 子进程，通过消息流通信

### 两种 API 风格

| API | 用途 | 状态 |
|-----|------|------|
| `query()` | 单次任务，`for await` 遍历消息流，首个 ResultMessage 后关进程 | 稳定 |
| `unstable_v2_createSession()` | 多轮交互会话：`send()` / `stream()` / `close()` | 实验性 |

单次便捷调用：`unstable_v2_prompt(message, options): Promise<Message[]>`

### 核心能力

- **认证**：CodeBuddy 账号（`unstable_v2_authenticate()`，token 自动缓存复用），无需管理各供应商 API Key——与 pi 最大的差异点。`onAuthUrl` 回调可自定义打开登录页的方式
- **权限**：`canUseTool` 回调（每次工具调用 allow/deny），可映射到 ai-manager 现有 `requestActionConfirmation` 确认机制
- **工具**：自带文件读写/Bash/MCP/子代理等编码工具；`allowedTools`/`disallowedTools` 白黑名单裁剪
- **配置**：`settingSources` 默认不加载任何配置（干净环境）；`cwd` 指定工作目录；`systemPrompt` 注入自定义提示词
- **事件流**：Message 类型丰富（assistant 增量、tool_use、task_started/progress、result），可映射到现有 renderer 广播

## 二、当前 pi 集成现状（ai-manager.js，约 4800 行）

- pi-ai 做 LLM 层 + pi-agent-core `Agent`，主进程动态 `import()` 加载 ESM
- 注册约 20 个 Realm 专属浏览器工具（`get_tabs`、`open_link`、`fill_form`、`read_page_content`、`switch_container`、`memory` 等），深度耦合 tab-manager / container-manager / CDP
- `agent.subscribe()` → 事件广播到 renderer；对话存 ai-conversations-manager
- API Key 走 electron-store + CredentialStore

## 三、共存方案（推荐：双 Agent 后端架构）

**不替换 pi**——Realm 浏览器自动化工具链都在 pi 生态，CodeBuddy CLI 是编码 Agent，做不了 `fill_form` / `switch_container` 这类浏览器内操作。

在 ai-manager 之上抽象一层 Agent 后端接口，CodeBuddy 作为可选第二后端：

```
renderer（AI 面板）
   │  模式切换：「Realm Agent (pi)」/「CodeBuddy Agent」
   ▼
ai-manager（统一会话/广播/确认机制不变）
   ├─ PiBackend         → pi-agent-core Agent + Realm 浏览器工具（现状）
   └─ CodeBuddyBackend  → @tencent-ai/agent-sdk（新增）
```

### CodeBuddyBackend 适配要点

1. **定位**：面向「AI 编程助手」场景——用户指定一个项目目录，CodeBuddy 在里面写代码/跑命令；与 pi 的浏览器场景并存，按会话选后端
2. **认证**：首次使用调 `unstable_v2_authenticate()`，`onAuthUrl` 里用 Realm 自己的方式打开登录页（可落在某容器的 webview 里，顺便吃到容器隔离）
3. **权限**：`canUseTool` 映射到现有操作确认 IPC；`permissionMode` 默认 `default`，绝不 `bypassPermissions`
4. **cwd 隔离**：会话工作目录固定在 `userData/agent-workspaces/<id>`，禁止指向用户敏感路径
5. **事件桥接**：SDK Message 流 → 现有 `_setupEventBroadcasting` 同款 renderer 事件，前端改动最小
6. **裁剪工具**：`allowedTools` 白名单 + `systemPrompt` 注入 Realm 上下文

## 四、风险清单

| 风险 | 说明 | 对策 |
|------|------|------|
| 包体 +150MB | SDK 内含完整 CLI | 接受；或 `asarUnpack: ['node_modules/@tencent-ai/agent-sdk/cli/**']` |
| asar 内 spawn 子进程 | 子进程读 asar 内 JS 可能有坑 | 发布前 `make install` 实测启动 + 发起一次会话 |
| V2 Session API 实验性 | 接口可能变 | 锁定版本 + 适配层隔离，只用 `send/stream/close` 三个方法 |
| 子进程生命周期 | 应用退出要杀干净 | 会话持有子进程句柄，`app.on('will-quit')` 统一 `close()` |
| Node 版本 | SDK 要 Node ≥ 18 | Electron 43 内置 Node 更高，无问题 |
| 编码工具破坏性 | Bash/文件写是真机操作 | `canUseTool` 全量确认 + cwd 隔离 + `disallowedTools` 禁高危 |

## 五、起步路径（重启时从这里开始）

1. **半天验证**：`npm install @tencent-ai/agent-sdk`，在主进程（或 Electron UtilityProcess）跑通 `unstable_v2_prompt()` 单次调用，验证 CLI 能正常 spawn + 认证
2. 验证通过 → 做完整双后端；不通过 → 退而用 `query()` 做轻量「AI 编程」入口
3. dev 环境先跑通，打包验证留到最后（asar spawn 是主要变数）
