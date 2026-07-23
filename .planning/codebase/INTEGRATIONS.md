# External Integrations

**Analysis Date:** 2026-07-23

## APIs & External Services

**无外部 API 集成：**
- 项目当前不依赖任何外部 API 或云服务
- 所有功能均为本地桌面应用功能

## Data Storage

**Databases:**
- 无传统数据库
- 使用 Electron Session API 进行容器数据隔离

**Local Storage:**
- electron-store (realm-config.json) - 容器配置持久化
  - 存储位置：应用用户数据目录
  - 格式：JSON
  - 用途：保存容器列表、名称、颜色、图标

**Session Storage:**
- Electron Session Partitions - 每个容器独立的 Cookie、缓存和存储
  - 格式：`persist:container-{id}`
  - 隔离级别：完全隔离（Cookie、localStorage、缓存等）

**File Storage:**
- 本地文件系统 - 应用构建产物和临时文件
- 无云存储集成

**Caching:**
- 无显式缓存层
- 依赖 Electron 和 Chromium 内置缓存机制

## Authentication & Identity

**Auth Provider:**
- 无认证机制 - 应用为本地桌面应用，不需要用户认证
- 未来可集成 AI Agent SDK（预留架构）

## Monitoring & Observability

**Error Tracking:**
- 无外部错误追踪服务
- 使用 console.log 进行日志记录

**Logs:**
- 主进程日志：通过 console.log 输出到终端
- 渲染进程日志：通过 console.log 输出到开发者工具
- 日志前缀：`[Realm]` 用于主进程，`[Realm Renderer]` 用于渲染进程

## CI/CD & Deployment

**Hosting:**
- 本地桌面应用 - 无需服务器托管
- 分发方式：macOS 安装包 (dmg, zip)

**CI Pipeline:**
- 未检测到 CI/CD 配置
- 构建通过 npm scripts 手动执行

## Environment Configuration

**Required env vars:**
- `NODE_ENV` - 控制开发/生产模式（development/production）
- 无其他必需环境变量

**Secrets location:**
- 无敏感信息存储
- 应用配置存储在 electron-store (realm-config.json)

## Webhooks & Callbacks

**Incoming:**
- 无传入 Webhook

**Outgoing:**
- 无传出 Webhook

## IPC 通信机制

**内部 API：**
- 通过 `contextBridge` 暴露 `window.realmAPI` 给渲染进程
- 使用 `ipcMain.handle` / `ipcRenderer.invoke` 模式
- 支持的 API：
  - `getContainers()` - 获取所有容器
  - `getCurrentContainer()` - 获取当前容器 ID
  - `switchContainer(containerId)` - 切换容器
  - `createContainer(config)` - 创建新容器
  - `deleteContainer(containerId)` - 删除容器
  - `getContainerCookies(containerId)` - 获取容器 Cookie
  - `setContainerCookie(containerId, cookie)` - 设置 Cookie
  - `clearContainerCookies(containerId)` - 清除 Cookie
  - `onContainerSwitched(callback)` - 监听容器切换事件

---

*Integration audit: 2026-07-23*
