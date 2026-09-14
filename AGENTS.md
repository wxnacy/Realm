# Realm Browser - CLAUDE.md

## 项目概述

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie 管理和 AI Agent 集成。

核心目标：
- 每个容器完全隔离（Cookie、缓存、存储）
- 可视化容器管理
- 多窗口支持与跨窗口 Tab 拖拽
- AI Agent 集成（基于 pi-agent-core SDK）

## 分支与提交工作流（AI 开始改动前必须先判断）

完整规范见 **[docs/dev/branching-spec.md](docs/dev/branching-spec.md)**（`master` 主干 + `feature`/`hotfix` 短期分支模型）。本节是该规范中**面向 AI 的执行部分**，AI 在动手前必须逐条走完，不要跳过。

### 1. 先按语义判断意图属于哪一类

用户不会主动说「这是 feature」，按语义判断，只看一件事：**是新增能力，还是修正既有行为**。

| 类型 | 语义特征 | 应落在 |
|------|---------|--------|
| 新功能 / 大改动 | 加新能力、新页面、新模块、重构、改交互设计 | `feature/<简述>` |
| Bug 修复 | 现状与预期不符、报错、行为异常、回归 | `hotfix/<简述>` |
| 纯文档 / 配置 | 只动 `.md`、注释、依赖版本号，无行为变更 | 可直接在 `master` |

判定模糊时（如「优化一下 X」「调一下 X 的手感」）**先向用户确认属于哪一类**，不要自行假定，也不要默认当 feature 处理。

### 2. 当前在 `master` 上 → 写代码前先提示拆分支

先用 `git rev-parse --abbrev-ref HEAD` 确认当前分支。若在 `master` 上且工作属于上表前两类，**在写任何代码之前**停下并告知用户：

- 本次改动按规范应落在 `feature/<name>` 或 `hotfix/<name>`
- 给出**建议的分支名**（小写 + 连字符，2~4 个词，如 `feature/ai-memory-gc`、`hotfix/cookie-www-dedup`）
- 询问：**「是否先拆出分支再开始？」，并注明推荐拆分支**

推荐项固定为「先拆分支」（符合规范）。用户明确选择在 `master` 上直接改时，遵从用户，但要在回复中指出这偏离规范、后续难以单独回滚与 review。

**可直接在 master 上做的例外**：改动属于上表第三类（纯文档/配置），或用户已明确说「就在 master 上改」。

### 3. 已在 `feature/*` / `hotfix/*` 分支上 → 按「任务」边界主动同步/回合

**触发时机是「完成一个任务」**（一个可交付的最小单元，不是每改一个文件），完成后主动告诉用户该做哪一步，得到确认再执行：

| 所在分支 | 完成一个任务后应做 | 说明 |
|---------|------------------|------|
| `feature/*` | `git merge master`（拉新 master 进 feature） | 冲突在 **feature 侧**解决；用 merge **不用 rebase** |
| `hotfix/*` | 合回 `master`（`git merge --no-ff`） | 回合后再 bump `package.json` patch 版本 + 打 `v<x.y.z>` tag |

执行前先 `git fetch`，避免基于过期的远端状态判断。

**三条不要做**：

- 不要把 `hotfix` 回合到各条 `feature` 分支 —— feature 拉 master 时会自动获得修复，手动回合只会制造重复提交
- 不要 `rebase` 已 push 的共享分支（会重写历史、需要 `--force-push`）
- 不要静默提交 / 静默合并 —— 合并、commit、push、开 PR 都要先向用户确认

### 4. 与 `master` 直接相关的高危动作

`master` 受保护、禁止直推，一律走 PR。AI 在 `feature`/`hotfix` 分支上完成提交即止，**推送与开 PR 需用户确认后再执行**。

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Main Process                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  container-   │  │   window-    │  │    tab-      │                  │
│  │  manager      │  │   manager    │  │    manager   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│           │                │                 │                           │
│           ▼                ▼                 ▼                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Session Manager                               │   │
│  │  (persist:container-work, persist:container-*)                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│  ┌────────┴────────────────────────────────────────────────────────┐   │
│  │                     20 个功能模块                                │   │
│  │  cookie-manager    favorites-manager    history-manager          │   │
│  │  download-manager  shortcut-manager     context-menu-manager     │   │
│  │  ai-manager        cdp-manager          drag-coordinator         │   │
│  │  credential-manager address-manager     frequent-sites-manager   │   │
│  │  assignment-rules  ua-ch-manager        media-sniffer            │   │
│  │  dev-requests-writer favicon-fetcher                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ IPC (contextBridge)                      │
│                              ▼                                          │
└──────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Renderer Process                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        UI Layer                                  │   │
│  │  - Container List (Sidebar)                                      │   │
│  │  - Toolbar (URL, Navigation)                                     │   │
│  │  - Browser View (webview/webContents)                            │   │
│  │  - Bookmarks Bar                                                 │   │
│  │  - Modals (Container CRUD, Cookie Manager)                       │   │
│  │  - realm:// 内部页面 (history/favorites/settings/downloads/newtab)│   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 代码规范

### 命名规范
- 文件名：小写 + 连字符（kebab-case）
- 变量/函数：camelCase
- 类/构造函数：PascalCase
- 常量：UPPER_SNAKE_CASE
- CSS 类名：小写 + 连字符

### 代码风格
- 使用 2 空格缩进
- 字符串使用单引号
- 语句末尾使用分号
- 函数和类必须添加 JSDoc 注释

### 命名约定
```javascript
// 容器相关：container-xxx
const containerList = [];
const containerId = 'work';

// 窗口相关：window-xxx
const windowContainerMap = new Map();

// 事件名：动词-名词
// IPC 通道：get-xxx, set-xxx, delete-xxx, create-xxx
```

## 关键文件说明

### 主进程核心模块

| 文件 | 说明 |
|------|------|
| main.js | 主进程入口，应用生命周期管理、模块组装、操作确认 IPC、本地 HTTP 服务器 |
| ipc-handlers.js | 集中注册所有 IPC 处理器，使用 `container:*` 等命名空间格式 |
| container-manager.js | 容器 CRUD，Session partition 管理，4 个默认容器 |
| window-manager.js | 窗口注册表、容器映射、窗口位置持久化（Phase 36）、跨窗口广播 |
| tab-manager.js | Tab 生命周期管理，多窗口支持（Phase 35），Tab 回收（D-07 上限 20） |
| shortcut-manager.js | 快捷键管理，before-input-event 实现，14 个默认快捷键 |
| cookie-manager.js | Cookie 持久化（session ↔ cookies.json 合并），`.www` 域名去重 |
| context-menu-manager.js | 右键菜单管理（标签页/网页），已关闭标签栈 LIFO |
| drag-coordinator.js | 跨窗口 Tab 拖拽协调器，状态机 idle->dragging->ended/cancelled |

### 数据管理模块

| 文件 | 说明 |
|------|------|
| favorites-manager.js | 收藏夹管理，better-sqlite3，全局 favorites 表，FTS5 全文搜索 |
| history-manager.js | 历史记录管理，每容器独立表，FIFO 淘汰（每容器上限 10000 条） |
| download-manager.js | 下载管理器，进度追踪、SQLite 持久化、滑动窗口速度计算 |
| credential-manager.js | 登录凭据加密存储（safeStorage + macOS Keychain） |
| address-manager.js | 收货地址加密存储（safeStorage） |
| frequent-sites-manager.js | 常用网站管理，frecency 算法（频率+最近性加权） |
| dev-requests-writer.js | CDP 抓取请求的 SQLite 异步批量写入队列 |

### AI 与网络模块

| 文件 | 说明 |
|------|------|
| ai-manager.js | AI Agent 管理器，基于 pi-agent-core SDK，LLM 连接、工具注册、对话状态 |
| vision-describer.js | 视觉专用模型描述器（Vision Bridge）：主模型不支持图片时把附件图片经 ai.visionModel 配置的视觉模型转写为文字描述 |
| ai-attachments-manager.js | AI 聊天附件管理：拖拽/粘贴文件复制快照进 agent-workspace/attachments/、sourceKey 去重、marker 文本构建 |
| cdp-manager.js | CDP 调试器管理器，Network 域抓包、AI 工具调试器管理 |
| ua-ch-manager.js | UA Client Hints 覆盖（CDP Network.setUserAgentOverride） |
| media-sniffer.js | 媒体嗅探器（网络拦截/脚本注入/DOM 监听三种方式） |
| assignment-rules.js | URL 自动容器分配规则 |
| favicon-fetcher.js | Favicon 远程抓取转 data URL（net.fetch，非 undici） |

### 渲染进程文件

| 文件 | 说明 |
|------|------|
| src/renderer.js | 渲染进程核心逻辑（UI 交互、Tab 管理、容器切换） |
| src/preload.js | contextBridge 安全暴露 IPC 接口 |
| src/webview-preload.js | webview guest 预加载脚本 |
| src/index.html | 主界面结构 |
| src/newtab.html + src/newtab-page.js | 新标签页（realm://newtab），常用网站网格、搜索 |
| src/history.html + src/history-page.js | 浏览历史页面（realm://history），日期分组、搜索过滤 |
| src/favorites.html + src/favorites-page.js | 收藏夹页面（realm://favorites），文件夹树、拖拽排序 |
| src/settings.html + src/settings-page.js | 设置页面（realm://settings），快捷键设置、规则管理 |
| src/downloads.html + src/downloads-page.js | 下载内容页面（realm://downloads） |
| src/devrequests.html + src/devrequests-page.js | 开发者请求页面 |
| src/player.html + src/player.js + src/player.css | 多媒体播放器页面 |
| src/bookmarks-bar.js + src/bookmarks-bar-menu.js | 书签栏组件 |
| src/container-env-presets.js | 容器环境变量预设 |
| src/ai-brand-map.js | AI 品牌词典+模型元数据快照（scripts/generate-ai-brand-map.js 生成，勿手改；数据源 models.dev + @lobehub/icons-static-svg，均 MIT） |
| src/model-family.js | 模型家族分组/每组最新选取/图标 HTML（window.ModelFamily，settings 页与 renderer 共用） |
| src/assets/ai-icons/ | 品牌 SVG 图标子集（统一白色圆角底板渲染；kimi 等白字形图标用深色底板，dark 标记由生成器写入词典） |

### CLI 工具

| 文件 | 说明 |
|------|------|
| bin/realm-cli.js | CLI 入口文件（全局命令 `realm`） |
| cli/commands/container.js | 容器管理命令（list, show） |
| cli/utils.js | CLI 工具函数（配置文件读取） |

## 开发要点

### 容器隔离机制
每个容器使用独立的 Electron Session：
```javascript
// main.js
const partition = `persist:container-${containerId}`;
const ses = session.fromPartition(partition);
```

### IPC 通信
所有 IPC 通信通过 preload.js 暴露的 realmAPI：
```javascript
// renderer.js
const containers = await window.realmAPI.getContainers();
await window.realmAPI.switchContainer('work');
```

### 新增 IPC 接口
1. 在 main.js 中添加 `ipcMain.handle('channel-name', handler)`
2. 在 preload.js 中添加 `contextBridge.exposeInMainWorld` 方法
3. 在 renderer.js 中通过 `window.realmAPI` 调用

### 新增快捷键（完整链路，五处都要改）

以"打开设置" `CmdOrCtrl+,` 为例：

1. **`shortcut-manager.js`** — `DEFAULT_SHORTCUTS` 加 `'openSettings': 'CmdOrCtrl+,'`（默认值的唯一来源）
2. **`src/settings-page.js`** — `SHORTCUT_NAMES` 加中文名 `'openSettings': '打开设置页面'`，同时 `SHORTCUT_GROUPS` 对应分组加 action id（否则设置页不渲染该快捷键）
3. **`src/renderer.js`** — `initShortcuts` 的 switch 加 `case 'openSettings': openSettingsTab(); break;`
4. 行为函数（如 `openSettingsTab`）在 renderer 中定义；设置按钮等 UI 入口共用此函数

**无需**改 `ipc-handlers.js` / `preload.js` —— 注册/触发链路是通用的。重置走 `realmAPI.resetShortcut(action)`（`shortcut:reset` 通道），主进程删除自定义覆盖后 `getShortcuts` 的 `{...DEFAULT, ...custom}` 合并语义自动回落默认，**不要在 renderer 再写一份默认表**。

### 导航入口与分配规则（强制维护约定）

所有"加载一个 URL"的入口（地址栏、收藏栏/菜单、右键菜单、Vim hint、AI 聊天链接、AI 工具 open_link、OS open-url、guest 页面内导航等）的权威清单见 **[docs/product/navigation-entry-points.md](docs/product/navigation-entry-points.md)**。

**统一导航入口 `openUrl`（src/renderer.js）**：renderer 侧所有"加载一个 URL"的入口必须收敛到 `openUrl(url, options)`，不得再直接 `webview.loadURL()` / `createTab(containerId, url)` 发起导航（程序化 loadURL 不触发主进程 `will-navigate`，会静默绕过分配规则）。签名与流水线：

```js
openUrl(url, {
  disposition: 'current-tab' | 'new-tab' | 'background-tab',  // 缺省 current-tab
  sourceTabId,            // current-tab 宿主 tab（缺省 state.activeTabId）
  explicitContainerId,    // 用户显式选容器（右键指定容器、OS 固定默认容器），优先于规则
  bypassRules,            // 显式跳过规则（快照恢复类入口用；restoreTabs/duplicate/重开关闭 tab 直接走原链路不入漏斗）
})
```

内部流水线：normalizeUrl → WR-9 白名单（http(s)/realm/file/view-source:http(s)）→ 内部 URL 豁免 → `realmAPI.matchRule` 分配规则匹配（`state.navSeq` 竞态守卫：连续导航只让最后一次生效）→ 容器决策（explicitContainerId > 规则 > 来源/当前容器）→ disposition 分支执行。current-tab 命中其他容器规则时改为**匹配容器新建 tab、原 tab 不动**（与主进程 will-navigate 规则重定向语义一致；当前 webview partition 绑定来源容器不能跨容器加载）。

主进程发起的导航（AI open_link、OS open-url）经 `open-url-in-tab` / `open-external-url` 通道落到 renderer 的 openUrl 链路；主进程侧发送前先 `assignmentRules.matchUrl` 解析容器。guest 页面内导航保持 will-navigate / setWindowOpenHandler 拦截链路不变。

**以后新增任何导航入口、或修改导航 / 分配规则 / 容器决策相关功能时**：
1. **必须收敛到 openUrl 并及时更新该文档**（入口位置、触发场景、disposition/容器参数）；
2. **必须在各入口间同步功能逻辑**——同一 URL、同一用户意图，不管从哪个入口进来，规则匹配、URL 规整、m3u8 转换、tab 容器归属的行为必须一致。不要让"某入口绕过分配规则"这类行为分裂靠手动发现。回归验证跑 `node tests/test-unified-navigation.js`（32 项断言）。

### 内部页面（`realm://`）打开新 Tab

`realm://favorites` / `realm://history` / `realm://settings` 等页面加载在 webview 中。在 guest 内打开新 tab 的标准做法：

```js
window.open(url, '_blank');
```

主进程 `main.js` 的 `setWindowOpenHandler` 统一拦截，按 D-09 决策在**来源容器**新建 tab。不要为这些页面单独写 IPC。

### 内部页面 CSP：markup 内联 style 会被拦截

`realm://` 页面的 CSP 是 `style-src 'self'`（无 unsafe-inline），**HTML markup 里的 `style="display:none"` 属性不生效**，元素会在页面加载时短暂或持续可见。规则：

- 元素的**初始隐藏**必须走 CSS 类规则（如 `.ai-modal-overlay { display:none }`）
- JS 里 `el.style.display = 'flex'`（CSSOM 方式）不受 CSP 限制，可正常覆盖样式表规则
- 显隐切换用具体的 `'flex'/'block'/'none'` 值，不要依赖 `''` 回落到 markup 状态
- 同理不要在内联 style 里写 `mask-image`（单色品牌图标因此改用 `<img>` + 白色圆角底板，见 `model-family.js iconHtml`；白字形图标如 kimi 用 `.ai-icon-dark-tile` 深色底板，dark 标记在词典数据里）

### 弹框居中约定（所有弹框必须显示在屏幕中央）

全局约定：**以后所有弹框都必须显示在屏幕中央**（源自删除确认框三次钉在左上角的事故）。主窗口（`file://` 加载，无 CSP）统一用原生 `<dialog>` 元素 + `showModal()`/`close()` 控制显隐：

- dialog 的类规则必须**显式声明 `margin: auto`**——`main.css` 的全局 `* { margin: 0 }` 重置会清掉 UA stylesheet 的 `dialog { margin: auto }` 居中。既有正确参照：`.modal`、`.download-delete-modal`、`.download-clear-modal`、`.ai-conv-delete-dialog`（均显式 margin: auto）
- **绝不要把全屏 div 遮罩类（如 `.ai-modal-overlay`：position:fixed; inset:0; flex 居中）用到 `<dialog>` 元素上**——UA 的 fit-content 尺寸 + inset 全 0 过约束解析会把盒子钉在 `top:0; left:0`；dialog 的遮罩压暗用 `::backdrop` 承接
- 不要用 `width/height: 100%` 撑满视口的「补全 overlay」方案——UA `dialog:modal` 的 max-width/max-height（`calc(100% - 6px - 2em)`）会截断盒子导致偏心（Electron 43 实测偏移 19px，已否决）
- `realm://` 内部页面（CSP `style-src 'self'`）不适用本条：继续用 div 遮罩 + JS CSSOM `display` 切换，初始隐藏走 CSS 类（与上方「内部页面 CSP」小节衔接）

### AI 供应商模型分组与品牌图标

设置页 AI 分区的模型列表按「品牌家族」分组（如 Qwen 3 / Qwen Max / GLM 4.6）：

- `src/ai-brand-map.js`（生成的快照）：品牌别名表、供应商图标表、模型元数据（family/release_date/能力/模态）
- `src/model-family.js`：`groupModels` 分组（词典 → 斜杠后段 → 启发式）、`latestPerGroup`（需求：≥10 个模型时每组只自动添加最新一个）、`iconHtml` 图标渲染
- 分组规则：剩余串**字母开头**取子产品线（qwen-image → Qwen Image），**数字开头**取版本号（qwen3.8-max → Qwen 3.8），参数量（235b/8x7b）和日期（2026-02-13/-1106）先剥离
- 供应商 `enabled` 字段（默认 true）：设置页编辑器右上角开关即改即存；禁用后聊天框模型下拉不展示，存储的 activeProvider 记录保留，重新启用自动恢复
- 词典更新：`curl -sL https://models.dev/api.json -o /tmp/realm-modelsdev.json && npm pack @lobehub/icons-static-svg -p /tmp/realm-icons && tar xzf /tmp/realm-icons/*.tgz -C /tmp/realm-icons && node scripts/generate-ai-brand-map.js`

### AI 工作区与 Bash 权限（agent 根目录 + SDK 内置工具）

AI 助手接入了 pi-agent-core 的 4 个内置工具（`read`/`write`/`edit`/`bash`），配套 agent 工作区与三档权限（方案见 [docs/plan/ai-file-bash-tools-integration.md](docs/plan/ai-file-bash-tools-integration.md)）。

**维护约定（与导航入口清单同款）**：本功能的产品说明权威文档是 **[docs/product/ai-agent-workspace.md](docs/product/ai-agent-workspace.md)**。以后修改工具能力、权限分档、白名单匹配语义、确认流程、沙箱边界、工作区目录结构等行为时，**必须同步更新该产品文档**，保持说明与实际行为一致。聊天附件功能（拖拽/粘贴文件图片进聊天框）的产品说明见 **[docs/product/ai-chat-attachments.md](docs/product/ai-chat-attachments.md)**，修改附件交互/快照语义/vision 通道/持久化时须同步更新；其中**视觉桥（Vision Bridge）**——主模型不支持图片时由视觉专用模型（`ai.visionModel` 配置，`vision-describer.js`）把附件图片转写为文字描述——的触发条件/注入格式/降级行为变更同样须同步该文档。本小节只记实现要点。

- **agent 根目录** `userData/agent-workspace/`：AI 落盘数据统一收纳。`ai-memory/`（记忆，由 `ai-memory-manager.getBaseDir` 指向，启动时从旧 `userData/ai-memory/` 一次性迁移且旧目录保留不删）、`.tmp/`（bash 截断全量输出等临时文件，SDK `createTempDir/createTempFile` 被重定向到此）
- **硬沙箱**（`agent-workspace.js` 的 `createSandboxEnv`）：包装 `NodeExecutionEnv` 覆写**全部** FileSystem 方法 + exec——任何漏包的路径入口就是逃逸口。路径校验 `resolveInside` 双基准（root + root 的 realpath，macOS /var → /private/var 必须放行）+ 已存在路径 realpath 复核（防 symlink 二段式逃逸）。拒绝返回 `FileError('permission_denied')` 不 throw（SDK FileSystem 契约），SDK 工具内部 getOrThrow 会转 throw → agent loop 编码为 isError toolResult
- **工具适配**（`ai-manager.js` 的 `_adaptHarnessTool`）：AgentHarnessTool 与低层 AgentTool 唯一差异是 execute 第 5 参 `{ env }`，包装注入即可；name 保留 SDK 原值（LLM 训练先验），label/description 重写中文；4 个工具强制 `executionMode: 'sequential'`（file-mutation-queue 只串行化 write/edit，不约束 bash）
- **write/edit 沙箱内自动执行不加确认**：破坏面已被硬沙箱限定在 AI 专用数据区；单独确认防不住 bash 天然写逃逸，只会让 LLM 绕道 bash
- **Bash 三档权限**（`ai-bash-policy.js` 纯函数引擎，`evaluateBashCommand`）：① 白名单命中 → 免确认（主流前缀语义：裸条目 `brew` 覆盖 `brew` 本身与 `brew xxx` 子命令，空格边界不误中 `brewx`；`npm run *` 显式通配 ≡ 前缀 `npm run `）；② 默认 → 弹确认卡片；③ 强制确认 —— **两个互不包含的触发源**：**危险段**（`DANGEROUS_PATTERNS` 词边界正则：rm 全系/sudo/dd/kill/chmod/重定向覆盖系统路径等 + `DANGEROUS_INTERPRETERS` 管道右侧 sh/node/python 等）与**包管理器安装档**（`PACKAGE_MANAGER_TOOLS`，**默认拒绝**：首 token 命中工具集且子命令**不在该工具的显式只读清单**内即强制确认；工具集含 `npx` / `bunx` / `npm` / `pnpm` / `yarn` / `bun` / `pip` / `pip3` / `pipx` / `uv` / `uvx` / `brew` / `cargo` / `go` / `gem`），两者**进白名单也无效**（`reason` 分别为 `danger` / `install`，均 `riskLevel: 'high'`）。匹配前做一次**词法归一化**（`stripShellQuoting`：去引号 + 去反斜杠转义），`brew "install" wget` 与 `brew install wget` 判定相同。`PACKAGE_MANAGER_INSTALL_PATTERNS` 退居**纵深**层，仍承接首 token 非包管理器的形态（`echo "npm install"` / `python3 -m pip install x`）。拆段 `splitCommandPipeline` 引号感知（引号内 `;`/`|` 不拆），复合命令逐段判定
- **安装档只读豁免的三条实现约束**（改判定口径时不得破坏）：① **只读判定前先跑纵深表**（`npm -g install list` / `brew --quiet install info` 这类「旗标 + 安装动词 + 只读同名词」仍属安装档）；② 空 `readOnly` 的工具（`npx` / `bunx` / `uvx`）**不生成**动词式只读正则（空捕获组 `\b()\b` 匹配空串 = 带参形态全放行）；③ 只读词条里 `npm init` / `audit` 带**形态限定**（`npm init <initializer>` ≡ `npx create-<initializer>`、`audit fix` / `audit --fix` 属安装档），`npm start` / `stop` / `restart` / `run-script` 与 `run` / `test` 同族只读。`pipx` 的纵深条目必须**动词限定**（裸条目会让其非空只读清单 `['list']` 不可达）
- **维护约定**：改动安装档的判定口径（工具集 / 只读清单 / 归一化 / 纵深优先）**必须同步** [docs/product/ai-agent-workspace.md](docs/product/ai-agent-workspace.md) §四§五§七 与 [docs/product/ai-skills.md](docs/product/ai-skills.md) §九
- 白名单存储键 `settings.aiBashWhitelist`（string[]），设置页 AI 分区「AI Bash 命令白名单」tag 式即改即存（复用 `whitelist-tag` 样式段），`/api/settings/update` 对该键有服务端校验（`validateWhitelistList`：数组/非空/≤200 字符/无换行控制符/**不支持单独 `*`**——空前缀条目会使白名单变成全放行，`matchesWhitelist` 侧另有一道跳过护栏）；bash 工具每次执行实时 `configStore.get` 不缓存
- 确认链路复用 `requestActionConfirmation`（type: 'execute_script'，危险 high / 普通 medium），未确认返回 cancelled 正常结果不 throw；终态经 `notifyActionSettled` 推送
- 诚实边界：静态拆段无法覆盖全部 shell 语法，白名单判定是「降低误执行概率」的启发式而非安全边界；安全边界 = 确认卡片 + 硬沙箱；OS 级隔离（sandbox-exec）列为后续可选增强
- 测试：`node tests/test-agent-workspace.js`（沙箱/迁移，21 例）、`node --test tests/test-ai-bash-policy.js`（策略引擎，97 例）、`node tests/test-builtin-skills-seeder.js`（播种 / 差异诊断 / 零安装语义 / 归属断言，新增）、`node --test tests/test-skill-picker-model.js`（面板纯逻辑：解析与 args 取值 / 过滤两档 / 展平与可选中性 / 导航取模 / 三条接线扫描 / 气泡构建单源与回填后定向刷新，111 例；含卡片标记并入函数 `mergeManageSkillMarker` 的值域与卡片头部超预算标注的 ≤ 4 字投影 / 48 原文冻结 / 九码长度上限）、`node --test tests/test-ai-cancel-state.js`（取消归属与用户气泡时序的纯逻辑用例 + renderer 接线护栏）、`node tests/test-manage-skill.js`（AI 自建技能域：`manage_skill` 三动作 / 校验器值域 / 四类撞名与 seeded 三入口保护 / 原子写与失败清理 / 字段分离扫描与扫描-净化顺序 / 数量闸 / 幽灵技能与越界护栏（含 description 值域与写↔读闸口边界：`: ` / `#` / 裸标量 / 纯零宽），55 例）、`node tests/test-ai-skills.js`（技能域全量单测：加载管线 / 诊断 / 限额 / 启停 / prompt 注入 / Agent 回写 / 显式调用解析与实时读盘 / 投影与 tier / `read` 卡片标记 / 重载装饰 / 运行期新增技能的一次性权威重扫 / 延迟补刷在纯文本流的成功出口落地（G-48-18） / 重扫或重试读盘抛错沿用原判定（G-48-19） / `manage_skill` 卡片标记两时点与终态元数据通道（M 组） / `manage_skill` 刷新链时序与次数账（L 组） / 失败态原因码的词缀与重载还原 / 三态 `promptIncluded` 消费侧 / a11y 增量的条件施加（M9b：守卫内施加 + 两调用点取值 + 单源未破），178 例）
- **打包排除项的前提（`package.json` 是 JSON、无法内联注释，故写在此处）**：`package.json` 的 `build.files` **只用 `!` 排除项、没有正向 allowlist**；`!` 仅在**无正向 `files` 条目**时保留 electron-builder 的默认全量包含语义。**日后若要添加正向 allowlist，必须同时列入 `skills-builtin/**` 与 `THIRD_PARTY_NOTICES.md`**，否则 SEED-05 与 P10 会同时失效（`tests/test-builtin-skills-seeder.js` 的「打包排除项配置护栏」断言组会变红，其中一条专门断言「每一项都以 `!` 开头」）。排除 `.planning/**` 的原因是它含 `.planning/research/PITFALLS.md` —— 一份逐字记录 `npx skills add <owner/repo@skill> -g -y` 的安装说明书，与 P1 门禁要消除的风险同源；同批排除的还有 `test/**` / `tests/**` / `scripts/**` / `*.bak`（`make install-nightly` 的 `cp main.js main.js.bak` 副产物）/ 根级符号链接 `CLAUDE.md`、`CODEBUDDY.md`
- **内置技能**（随包静态技能，`skills-builtin/`）：`package.json` 的 `build.asarUnpack` 与运行时路径成对（打包态 `process.resourcesPath/app.asar.unpacked/skills-builtin`，开发态回落 `__dirname`，见 `builtin-skills-seeder.js` 的 `resolveBuiltinSkillsSrc()`）。每次启动由 `seedBuiltinSkills()` 自愈式播种（按**单个技能目录**粒度同步 `managed-skills/<name>/`；**内容一致时跳过写盘** —— `detectDiff` 判 `same` 则不复制、不产诊断，差异或缺失时才覆盖，差异覆盖前先产 `warning` 级 `realm_builtin_seed_overwritten` 诊断；播种前先清扫 `/\.(tmp|bak)_\d+$/` 的崩溃残留目录；播种结束按级别经 `console.error` / `console.warn` 输出累积诊断，使「一个都没播种成功」在正式版可见 —— Phase 50 接入技能面板前该兜底不得删除）；seeded 身份 = **扫随包目录名集合**（零状态文件、零硬编码）。产品说明见 [docs/product/ai-skills.md](docs/product/ai-skills.md) 第八节
- **技能不构成额外权限** + `allowed-tools` **当前运行时不被强制、仅供参考**：技能的 bash 命令与其它来源走同一套三档策略与确认卡片，不因为「技能里写了」而放宽；SDK 的 `Skill` 接口只有五个字段（无工具授权字段），任何「按技能授权工具集」的展示或表述都是虚假安全感 —— 见 [docs/product/ai-skills.md](docs/product/ai-skills.md) 第六节与 [docs/product/ai-agent-workspace.md](docs/product/ai-agent-workspace.md) 第七节第 6 条
- **随包静态技能目录的维护约定**：改动 `skills-builtin/**` 时**必须同步核对 `THIRD_PARTY_NOTICES.md` 的五要素**（来源仓库 / 固定 SHA / 许可证 / 是否修改 / 修改说明）**并重跑零安装语义扫描**（`node tests/test-builtin-skills-seeder.js`）—— 随包内容变更而不更新归属声明就是潜在的许可证违约
- **技能发现与调用的维护约定**：任何「加载一个技能」或「把技能暴露给用户」的入口（`/` 面板、`/skill:name`、裸 `/name`、模型自动匹配的 `read`）的权威说明是 **[docs/product/ai-skills.md](docs/product/ai-skills.md) 的「发现与调用」章节**；改动面板形态 / 语法优先级 / 实时读盘口径 / 边界技能行为 / 三档徽标 / `read` 卡片技能化时，**必须同步更新该章节与本节测试清单**
- **AI 自建技能（`manage_skill`）的维护约定**：产品说明权威 = **[docs/product/ai-skills.md](docs/product/ai-skills.md) 第十一节**；改动**校验器 / 三动作 / 限额常量 / 扫描与净化口径 / 九码拒绝面 / 卡片形态**时，**必须同步该章节与该节测试清单**。四条硬约束：① 校验器与三动作住 `ai-skills-manager.js`，该模块**零 electron 依赖** ⇒ Phase 50/51 **直接 require 同一份**，不得另写第二份（这是 Phase 49 排在 50/51 之前的全部理由）；② seeded 判定按**播种登记表**（`getSeededSkillNames()` 的注入值）而非目录位置；③ `LIMITS` **只允许加项**，不得改既有三项数值（`MAX_SKILL_MD_BYTES` / `MAX_USER_SKILLS` / `SKILLS_PROMPT_CHAR_BUDGET`）；④ 三动作**一律不加确认卡片**（破坏面已被硬沙箱限定），且 `SKILL_THREAT_PATTERNS` 技能域模式组归 Phase 51 —— Phase 49 只把扫描点接成单点，不预置技能域模式表。**时序口径**：成功后只调**一次** `syncAgentSystemPrompt()`（其函数体内已含 `refreshSkills()` 重扫；写两次调用会变成三次全量重扫），新技能集在本轮**成功出口**回写、**下一条消息起可用**。**测试口径**：`node tests/test-manage-skill.js`（manager 级值域矩阵与护栏）+ `node tests/test-ai-skills.js` 的 M/L 组（卡片标记与刷新链接线）；测试**必须**直接注入 `seededNames`，**严禁**经 `getSeededSkillNamesSafe()`（纯 Node 下会降级为 `[]`，会让 seeded 保护用例假绿）。**本 run 新增/改写的测试面**：`description` 值域与写↔读闸口边界、失败态原因码的词缀与重载还原、三态 `promptIncluded` 的消费侧、卡片标记并入函数的值域、a11y 增量的条件施加（M9b：守卫内施加 + 两调用点取值 + 单源未破） —— 三处计数与 `docs/product/ai-skills.md` §七、§11.8 同源（三处必须一起刷），并由该节携带的可重跑一致性命令机械判据。**四条不变式（本 run 新增，改动时必须同步）**：① **写侧权威字节闸口的判据对象 = 组装后的 `SKILL.md` 全文**（不是单独正文或 frontmatter 片段）—— 两侧判的必须是同一个量，否则会产出「落盘成功但整条被加载管线跳过」的幽灵技能，同步 `docs/product/ai-skills.md` §11.3；② **净化之后必须对净化值复验非空** —— 净化只能缩减（剥字符 / 压单行 / `trim`），纯零宽字符描述会被净化为空，写入流程固定为「原文结构校验 → 扫描原文 → 净化 → 净化值复验非空」，同步 §11.5；③ **失败态的机器可读原因码经消息词缀持久化** —— 词缀在消息起始、只含白名单原因码、不回显被拒内容原文，重载链路用同一常量还原；改动词缀格式必须同时改 encode / decode 两侧与 §11.3 的成文；④ **卡片标记的并入逻辑单源在 `src/skill-picker-model.js` 的 `mergeManageSkillMarker`** —— 渲染端与纯 Node 测试共用同一实现，渲染端不得另写一份展开式合并，否则守卫会退回「断言意图」的假绿形态，同步 §11.7 与本节测试清单。

### Cookie 面板的数据源语义

- **Session tab** = 容器当前活 cookie（`ses.cookies.get({})`），唯一可写源
- **File tab** = `cookies.json` 磁盘快照，只读视图
- 保存按钮永远是 `session → file` 单向：无论停在哪个 tab，IPC 都只从 session 读。File tab 下保存按钮 `disabled`（`updateSourceTabUI` 联动）
- Cookie 行的 domain 列：无前导点 = host-only，有 `.` 前缀 = domain cookie（含子域）。UI 用 `cookie-badge-hostonly` 徽标区分，避免看起来像重复行

### Cookie `.www` 域名去重机制

**背景**：Keycloak 登录时会同时往 `www.codebuddy.cn` 和 `.www.codebuddy.cn` 两个域设 cookie，导致请求头翻倍，触发 nginx 400 Bad Request（Request Header Or Cookie Too Large）。

**去重规则**：同一 `name|path|裸域名` 下，优先保留无前导点的 host-only 版本（`www.codebuddy.cn`），丢弃 `.www` domain 版本（`.www.codebuddy.cn`）。

**改动时必须同步修改的三处**（都含 `.www` 去重逻辑）：

| 位置 | 函数 | 作用 |
|------|------|------|
| `cookie-manager.js` | `loadCookies` | 启动时：文件去重 + session 去重 |
| `cookie-manager.js` | `saveCookies` | 退出/手动保存时：合并去重 + session 去重 |
| `cookie-manager.js` | `saveDomainCookies` | 快速保存时：合并去重 + session 去重 |
| `cookie-manager.js` | `compareDomainCookies` | 同步检查时：`toMap` 内用裸域名做 key + 去重 |

**核心原理**：session 去重只在保存时运行。服务端可能在浏览过程中重新设 `.www` cookie 到 session，所以每次保存后都要清理 session。比较时 `toMap` 统一用裸域名做 key，使得 `.www.codebuddy.cn|name` 和 `www.codebuddy.cn|name` 视为同一 cookie。

### `state.currentContainer` 同步约定

修改 `state.currentContainer` 后必须重渲染侧边栏，否则「当前」徽标和 active 高亮会滞后：

```js
state.currentContainer = tab.containerId;
renderContainerList();  // 必跟
```

参考 `switchTab`（容器跟随活动 tab）和 `switchContainer`（用户主动切换）的现有写法。

### 收藏栏拖拽（移入文件夹 / 栏内排序）

`src/bookmarks-bar.js`（拖拽主体）+ `src/bookmarks-bar-menu.js`（菜单拖拽放置）实现，Chrome 风格交互：拖到文件夹立即松手 = 移入末尾；悬停 600ms（`DRAG_FOLDER_OPEN_DELAY`）弹出下拉，可继续放入子文件夹（递归）或插入到菜单内收藏项之间。改动时的关键约束：

- **HTML5 DnD + 自定义 MIME** `application/x-realm-bookmark`，**不要加 text/plain**——否则误拖进 webview 松手会触发网页导航
- **拖拽期间 mouse 事件全部停发**：菜单悬停展开在拖拽下由 `dragenter/dragover` 驱动（`_dragOpenTimer`），与点击流程的 `mouseenter/_hoverTimers` 并存，两套定时器不要混用
- 拖拽模式打开下拉必须 `showFolderMenu(el, id, { forDrag: true })`：跳过遮罩层，否则遮罩挡住收藏栏的 dragover，光标无法从菜单移回收藏栏。**菜单项 dragstart 同理必须 `_removeBackdrop()`**——点击打开的源菜单自带全屏遮罩（z-index 99990 高于收藏栏），不移除则拖到收藏栏完全无法放置（dragover/drop 都到不了栏）；取消拖拽菜单保持展开时由 `endDragPin()` 补回遮罩恢复「点击外部关闭」
- 菜单关闭时机（防弹窗闪烁）：只有光标移到「其他收藏项」上才 `closeAllMenus()`。源文件夹本身必须豁免——菜单弹出时光标仍停在它上面，立即关会被悬停定时器重开；列表空白区也要豁免——「源文件夹 → 菜单」之间有几像素缝隙会落到 blank，穿越时立即关会打断移入菜单
- **移入文件夹末尾一律走 `moveFavoriteInto`**（folder_id + 末尾 fractional 键事务写入）；`moveFavorite` 只改 folder_id 不动 sort_order，落位不可预期。`moveFolder` 的追加排序已从 `MAX+1` 修复为 fractional 键（整数键与文本键混排会排到最前）
- **主窗口排序键计算走 IPC** `favorites:compute-sort-keys`（`realmAPI.computeFavoriteSortKeys`）——`file://` fetch 不了 HTTP 端点 `/api/favorites/compute-sort-keys`，realm:// 页面才走 HTTP
- drop 成功后**不要**在 renderer 直接 `bookmarksBar.load()`：主进程 move/sort IPC 已统一广播 `bookmarks-bar:refresh`，各窗口（含发起者）经既有监听重载，直接调会双刷
- dragend 绑在拖拽源元素上（`{ once: true }`）而非委托在列表：drop 后广播重载会移除源元素，detached 元素收不到列表委托的事件
- **菜单项也是拖拽源**（`draggable` 仅在 `dataset.folderId` 菜单启用，溢出菜单除外）：dragstart 由菜单容器委托 `_onMenuDragStart` 处理，经 `window.bookmarksBar.beginMenuDrag` 建立拖拽状态——它**不关菜单**（区别于栏内 dragstart）
- **pinned 源菜单**（Chrome 式拖出保持展开）：拖拽起始于菜单项时 `_pinMenuChainForDrag` 给源菜单链打 `_pinnedDrag` 标记，拖出期间豁免一切关闭逻辑（菜单 dragleave、收藏栏 close-check）；目标文件夹展开的菜单是「临时菜单」，用 `closeTransientMenus()` 单独收起（勿用 `closeAllMenus`，会连源菜单一起关）。取消拖拽且未放置 → `endDragPin()`（菜单保持展开）；已放置或栏内拖拽 → `closeAllMenus()`
- `_dragState.folderId` 是**来源文件夹**（栏内拖拽为 0）：executeDrop 据此判断跨层移动（菜单项拖出到栏/其他文件夹要先改 folder_id）、文件夹边缘排序的兄弟上下文经 `target.siblings`（`menu._subFolders`）+ `target.parentId` 传入
- **拖到文件夹项 = 移入该文件夹末尾，来源即目标文件夹 = 重排到末尾**。不要恢复「同文件夹 no-op」短路——会让「只含文件夹的子文件夹」失去可命中的移入放置区（其子菜单里全是文件夹项，孙文件夹项显示禁止、其余项是移入别的文件夹）
- **菜单来源拖拽放置后菜单保持展开并实时刷新**：`executeDrop` 末尾对 `drag.fromMenu` 调 `bookmarksBarMenu.refreshOpenMenus()`（按最新数据对每个打开菜单原地重建内容、按 folderId 重新锚定打开着的子菜单，无闪烁）；`_onBarDragEnd` 对 fromMenu 一律 `endDragPin()` 保持展开，**不要 closeAllMenus**（会退回「操作后菜单消失需重开」）。栏内来源拖拽维持 dragend 关菜单
- 书签 id 与文件夹 id 分属两表**数值可能相同**：drag.id 与 folder.id 的同体判定必须先分类型再比较，否则书签拖到同数值 id 的文件夹会被误判为拖到自身

### 收藏栏菜单悬浮切换（Chrome 式）

一个菜单已打开时，悬浮其他文件夹/»按钮自动收旧开新（`bookmarks-bar-menu.js` 悬浮切换区块）：

- **收藏栏样式改错文件等于白改**：index.html 只引用 `main.css?v=2`，`src/styles/bookmarks-bar.css` 当前**未被任何页面加载**（内容是拆分出去的死副本）。收藏栏的运行时样式全部在 `main.css` 的收藏栏段（搜 `.bookmark-item,` / `.bookmarks-dropdown`），改完记得同步死副本防以后误判
- **为什么不能用 mouseenter/mouseover**：菜单打开时全屏遮罩（z-index 99990）盖住收藏栏（菜单 99999/子菜单 100000 在遮罩之上），文件夹上的 hover 事件全部落在遮罩上收不到。悬浮切换只能用 document `mousemove` + 矩形命中分区实现（`_findBarHitTarget`，rAF 节流，仅 `_activeMenus` 非空时生效，`getDragState()` 非空早退）
- **遮罩同样拦掉原生 `:hover`**：菜单打开期间收藏栏项失去 CSS 悬浮反馈，由命中跟踪手动维护 `bar-hover` 类补齐（`_setSyntheticBarHover`，菜单关闭/拖拽开始时清除）
- **选中高亮（menu-open）**：菜单打开期间触发项（文件夹/»按钮）加 `menu-open` 类保持高亮，随悬浮切换移动；drop 后收藏栏广播重载会重建文件夹元素，`refreshOpenMenus` 末尾检测锚点失效按顶层菜单 folderId 重挂。**测试必须断言 getComputedStyle 而非类名**——类名在但规则没加载/没匹配时计算样式仍是透明，类名断言检不出这种失效
- **语义边界**：悬浮只负责「中间切换」，打开第一个和关闭最后一个仍靠点击/键盘（点外部、Esc、再点同文件夹 toggle），鼠标离开收藏栏+菜单区域**不**自动关。切换停留 `BAR_MENU_SWITCH_DELAY`（150ms）防扫过中间项闪烁
- **同一目标重复命中不重置定时器**：mousemove 高频触发，重复 schedule 会把延迟永远重置导致永不切换；换目标才重置，落点进菜单/书签项/空白/栏外一律取消（`_cancelBarSwitchTimer`）
- **遮罩 mousedown 命中增强**：点击落点在收藏栏文件夹/»按钮矩形上时直接切换（省掉先关再开的第二次点击）；命中的是当前打开者则维持 toggle 只关不重开。溢出项数据经 `window.bookmarksBar.getOverflowItems()` 读取
- 定时器纪律（三套互不复用）：点击子菜单展开 `_hoverTimers`、拖拽展开 `_dragOpenTimer`（栏）/`item._dragOpenTimer`（菜单项）、悬浮切换 `_barSwitchTimer`

## 多窗口支持

### 窗口管理架构

**window-manager.js** 核心数据结构：
- `windows: Map<windowId, BrowserWindow>` -- 所有通过 createMainWindow 创建的窗口
- `managedWindowIds: Set<number>` -- 受信窗口 ID 集合
- `windowContainerMap: Map<number, string>` -- 窗口与容器映射

**tab-manager.js** 多窗口支持（Phase 35）：
- 每个 Tab 对象包含 `windowId` 字段
- `activeTabs: Map<windowId, tabId>` 按窗口维护活动 Tab
- `getTabsByWindowId` / `closeTabsByWindowId` 按窗口操作

### 窗口位置持久化（Phase 36）

```javascript
// window-manager.js
const windowBoundsStore = new Store({ name: 'window-bounds' });

// moved/resized 事件实时保存
saveWindowBounds(windowId, bounds);

// 启动时恢复 + 越界检测
restoreWindowBounds(windowId);
```

### 跨窗口 Tab 拖拽

**drag-coordinator.js** 实现：
- 自定义 mousedown/mousemove/mouseup 事件（非 HTML5 DnD）
- 状态机：idle -> dragging -> ended/cancelled
- IPC 通道：drag:start/update-position/end/cancel/state-changed

## 数据库架构

### 共享数据库：history.db

| 模块 | 表名 | 说明 |
|------|------|------|
| history-manager | `history_{containerId}` | 每容器独立历史记录表 |
| favorites-manager | `favorites` | 全局收藏夹表（与容器解耦） |
| download-manager | `downloads` | 下载记录表 |
| credential-manager | `credentials` | 登录凭据表（safeStorage 加密） |
| address-manager | `addresses` | 收货地址表（safeStorage 加密） |

### 独立数据库

| 数据库 | 模块 | 说明 |
|--------|------|------|
| dev-requests.db | dev-requests-writer | CDP 抓取的网络请求记录 |

### 关键特性

- **FTS5 全文搜索**：favorites-manager 使用 nodejieba 中文分词
- **fractional-indexing**：收藏夹拖拽排序
- **FIFO 淘汰**：历史记录每容器上限 10000 杁
- **frecency 算法**：常用网站按频率+最近性加权

## realm:// 协议

### 协议注册

项目注册了 `realm://` 自定义协议（privileged scheme），支持以下内部页面：

| 页面 | 路径 | 说明 |
|------|------|------|
| 新标签页 | `realm://newtab` | 常用网站网格、搜索 |
| 历史记录 | `realm://history` | 日期分组、搜索过滤 |
| 收藏夹 | `realm://favorites` | 文件夹树、拖拽排序 |
| 设置 | `realm://settings` | 快捷键设置、规则管理 |
| 下载 | `realm://downloads` | 下载内容列表 |
| 开发者请求 | `realm://devrequests` | 网络请求监控 |

### 数据获取方式

内部页面通过本地 HTTP 服务器的 `/api/*` 端点获取数据（非直接 IPC）：

```javascript
// main.js
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/history')) { ... }
  if (req.url.startsWith('/api/favorites')) { ... }
  // ...
});
```

**主窗口（index.html）不能 fetch 这些 HTTP API**：主窗口从 `file://` 加载，
fetch `http://localhost:PORT` 是跨域请求会被 CORS 拦截（`TypeError: Failed to fetch`）。
数据访问分层约定：
- **主窗口 renderer**（受信 webContents）→ 一律走 preload 暴露的 `realmAPI.*` IPC
- **webview guest 内部页面**（`http://localhost:PORT` 同源）→ 走 `/api/*` + URL token 鉴权

事故参考：Phase 38 模型选择器下拉打不开——renderer.js 直接 fetch `/api/ai/providers`，
叠加单引号模板字符串不插值，双重失效。

## AI Agent 集成

### ai-manager.js

- 基于 pi-agent-core SDK
- LLM 连接与对话管理
- 工具注册与调用
- 操作确认机制（requestActionConfirmation）

### cdp-manager.js

- CDP 调试器管理
- Network 域抓包
- AI 工具调试器管理

### ua-ch-manager.js

- UA Client Hints 覆盖
- CDP Network.setUserAgentOverride

## 媒体嗅探器

### media-sniffer.js

三种检测方式：
1. 网络拦截（webRequest）
2. 脚本注入（executeJavaScript）
3. DOM 监听（MutationObserver）

### 播放器页面

- `src/player.html` + `src/player.js` + `src/player.css`
- 支持 HLS（hls.js）、DASH（dashjs）、FLV（mpegts.js）
- 配置项在设置页面管理

## 环境隔离

开发、调试、Nightly、正式四个环境使用独立的 `userData` 目录，互不干扰：

| 命令 | 环境 | userData 路径 | 自动打开 DevTools | 热加载 |
|------|------|--------------|-------------------|--------|
| `npm run dev` | 开发 | `~/Library/Application Support/realm-dev/` | ❌ | ✅ |
| `npm run debug` | 调试 | `~/Library/Application Support/realm-dev/` | ✅ | ✅ |
| `npm run nightly` | Nightly | `~/Library/Application Support/realm-nightly/` | ❌ | ❌ |
| `npm start` / .app | 正式 | `~/Library/Application Support/realm/` | ❌ | ❌ |

实现在 `main.js` 顶部，通过 `process.env.NODE_ENV` 判断：

```javascript
// 环境隔离：开发/调试/Nightly 环境使用独立的 userData 目录
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  app.setName('realm-dev');
} else if (process.env.NODE_ENV === 'nightly') {
  app.setName('realm-nightly');
}

// 应用图标：Nightly 版用深色背景圆角图标，正式版/开发环境用透明背景版
const APP_ICON_FILE = process.env.NODE_ENV === 'nightly' ? 'icon-nightly.png' : 'icon.png';
```

**热重载配置**（仅开发/调试模式）：
```javascript
// 热重载配置（仅开发/调试模式，测试模式不启用）
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
  try { require('electron-reloader')(module); } catch {}
}
```

**自动打开 DevTools**（仅调试模式）：
```javascript
// 调试环境启动即打开主窗口 DevTools（停靠右侧，调试 realmAPI/mediaAPI）
if (mainWindow && process.env.NODE_ENV === 'debug') {
  mainWindow.webContents.openDevTools();
}
```

### 构建安装命令

| 命令 | 用途 | 安装路径 |
|------|------|---------|
| `make install` | 构建正式版 .app | `/Applications/Realm.app` |
| `make install-nightly` | 构建 Nightly 版 .app | `/Applications/Realm Nightly.app` |

`make install-nightly` 构建时会临时在 main.js 注入 `process.env.NODE_ENV = 'nightly'`，构建完成后自动恢复源代码。Nightly 版使用独立的 appId（`com.realm.browser.nightly`）、productName（`Realm Nightly`）和深色背景图标（`icons/icon-nightly.icns`）。正式版图标为透明背景版（`icons/icon.png|icns`），运行时图标由 main.js 的 `APP_ICON_FILE` 按 NODE_ENV 选择。

这会影响所有本地存储：
- electron-store 配置（`realm-config.json`）
- Cookie JSON 文件（`cookies/`）
- Session Partitions（`Partitions/`）

## 调试

### 环境配置

项目支持三种运行环境，通过 `NODE_ENV` 环境变量区分：

| 环境 | 命令 | userData 目录 | 自动打开 DevTools | 热加载 | 用途 |
|------|------|---------------|-------------------|--------|------|
| **开发** | `npm run dev` | `~/Library/Application Support/realm-dev/` | ❌ | ✅ | 日常开发，快速迭代 |
| **调试** | `npm run debug` | `~/Library/Application Support/realm-dev/` | ✅ | ✅ | 需要调试时使用，自动打开 DevTools |
| **Nightly** | `npm run nightly` | `~/Library/Application Support/realm-nightly/` | ❌ | ❌ | Nightly 版验证，数据隔离 |

**环境隔离说明：**
- `dev` 和 `debug` 共享同一个 userData 目录（`realm-dev`），方便切换时保留数据
- `nightly` 使用独立的 userData 目录（`realm-nightly`），不影响开发数据
- 只有 `debug` 模式会自动打开 DevTools，`dev` 模式需要手动打开
- `dev` 和 `debug` 支持热重载，`nightly` 不支持（更接近生产环境行为）

### 开发模式
```bash
npm run dev
```
- 主进程日志：终端输出
- 渲染进程日志：开发者工具 Console（需手动打开）

### 调试模式
```bash
npm run debug
```
- 自动打开开发者工具
- 适合需要调试渲染进程或 DevTools 的场景

### 调试案例（docs/debug/）

- [fill_form 假成功排查实录](docs/debug/fill-form-silent-success.md) — CDP 表单填写三层根因：`Input.enable` 已被 Chromium 128+ 移除（Input 命令无需 enable）；表单填写用 `Input.insertText` 真实输入管线而非 JS 赋值；工具结果必须回读校验杜绝 `filled` 虚报；AI 口语字段名需语义映射 + availableFields 重试
- [fill_form 焦点输入管线排查实录](docs/debug/fill-form-focus-pipeline.md) — insertText 打进的是输入管线焦点元素（DOM focus/activeElement ≠ keyboard focus，焦点在 embedder 时会把填表文本打进 AI 聊天框造成串字）；根治：insertText 前合成 dispatchMouseEvent 点击落位 + readback 裁决 + 原生 setter 回退双保险
- [GitHub 登录跳转 `/sessions/two-factor/app` 404 排查实录](docs/debug/github-login-404-two-factor-app.md) — 双层根因：① `Network.setUserAgentOverride` 在**未导航过的 webContents** 上永久挂起（不要在 `web-contents-created` 阶段对未导航 webview 发 CDP Network 命令）；② **改代码不修旧数据**——历史 session 残留于 `Partitions/container-<id>` + `containers/<id>/cookies.json`，换容器就好、旧容器不行时清这两个位置（须先退出应用，运行中删除会被刷盘重建）
- [部分网站整页漆黑排查实录](docs/debug/webview-transparent-background-dark-page.md) — webview guest 默认背景透明，不显式设背景的网页（如部分 Docusaurus 站点）会透出窗口深色底色 `backgroundColor: '#1a1a1a'` 导致正文漆黑；修复：`.browser-view webview { background: #fff }` 兜底白画布，网站自身背景不透明时不受影响
- [多窗口关闭标签误关整个窗口排查实录](docs/debug/close-tab-closes-whole-window.md) — 三条成因链：restoreTabs"不恢复"全局清空误删其他窗口 Tab 元数据、菜单 role:'close'（Cmd+W）与 closeTab 双重绑定竞态、次级窗口未挂关闭处理器留幽灵 Tab；修复：tab:clear-all 按窗口清空 + 命中快捷键无条件 preventDefault + setWindowCloseSetup 统一挂载 + 拖出新窗口时序对齐
- [Twitch 直播转录 mp4 预览打不开排查实录](docs/debug/twitch-record-avfoundation-hang-audio-first-moof.md) — mux.js 产物三处 AVF 不兼容：音频 moof 在前死等、mvhd 0xFFFFFFFF 时长累加显示 13.3 小时（改真实值双倍拉伸，唯一正确值是 0）、mfhd seq 跨轨重复致播 2s 即卡；修复：reorderVideoFirst + zeroFragmentedMovieDurations + renumberFragmentSequence 三处等长原位改写；判别签名：qlmanage 挂起/13h 时长/卡首个分片边界
- [录制源取到 master playlist → 0 分片空转至 token 过期](docs/debug/twitch-record-master-playlist-zero-segments.md) — usher master 无分片，引擎不选 variant 白录 20 分钟后才报 `network`；四条判别签名 + 修复方向（未修）
- [webview 播放 m3u8「HLS 播放失败」排查实录](docs/debug/m3u8-webview-player-route-a.md) — 路线 A（tab 内 /player 页 + hls.js）全记录；两处根因：外部源 CORS/防盗链（曾用 /proxy 同源代理修复，44-09 后 webview 改直连、仅独立窗口走代理）、**改传输层后 player.html CSP `connect-src` 未覆盖 `http:` 源**（2026-09-09 修复）；教训：改「代理 ↔ 直连」传输语义必须核对页面 CSP 各指令是否覆盖新请求目标

### 查看容器数据
```javascript
// 在渲染进程开发者工具中执行
const cookies = await window.realmAPI.getContainerCookies('work');
console.log(cookies);
```

## 构建

```bash
# 开发模式（热重载，不自动打开 DevTools）
npm run dev

# 调试模式（热重载，自动打开 DevTools）
npm run debug

# Nightly 模式（无热重载，数据隔离）
npm run nightly

# macOS 生产构建
npm run build:mac
```

### 开发/正式环境差异 → 发布前必查

引入两类环境可能存在差异的改动时，**提交前必须主动考虑打包发布问题**，不能只在 `npm run dev` 下验证：

- **原生模块（nodejieba / better-sqlite3 等）**：JS 层 `fs` 能读 app.asar 内文件，但原生 `fopen`/`dlopen` 不行。词典、数据文件等被原生代码读取的资源必须：① `package.json` build 配置加 `asarUnpack`；② `app.isPackaged` 时显式把路径指到 `process.resourcesPath/app.asar.unpacked/...`（参考 `favorites-manager.js` 的 `nodejieba.load`）
- **路径**：`__dirname` 拼出的路径在 asar 内外含义不同；打包后要落盘或被原生读取的资源一律走 `process.resourcesPath` / `app.getPath('userData')`
- **新增依赖**：检查依赖包里是否带 `.node`、二进制、数据文件，有就要过一遍上面两条
- **发布前验证**：`make install` 装出 .app 后**实际启动一次**（不是只跑 dev），确认无原生崩溃再发布。启动闪退看 `~/Library/Logs/DiagnosticReports/Realm-*.ips`

事故参考：0.1.4 nodejieba 词典未解包，cppjieba 原生 fopen 读 asar 内路径失败直接 abort，启动必崩（修复见 9a1ae11）。
