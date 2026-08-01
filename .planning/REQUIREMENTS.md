# Realm Browser v2.0 里程碑需求文档

> 创建日期：2026-07-28
> 里程碑目标：收藏夹文件夹支持 + AI Agent 集成

---

## 需求总览

本里程碑包含 **4 个主要特性**，共 **18 个需求**：

1. **收藏夹文件夹支持** - 8 个需求
2. **Chrome 书签导入** - 3 个需求
3. **收藏栏（书签栏）** - 4 个需求
4. **AI Agent 集成** - 3 个需求（对应 pi-agent-integration.md Phase 1-3）

---

## 特性 1：收藏夹文件夹支持

### 需求列表

#### FOLDER-01: 创建文件夹
**优先级**: P0
**描述**: 用户可以在收藏夹中创建文件夹，支持多层嵌套

**验收标准**:
- [ ] 用户可以在收藏夹页面通过右键菜单或按钮创建新文件夹
- [ ] 用户可以设置文件夹名称
- [ ] 文件夹支持无限制层级嵌套（类似 Chrome）
- [ ] 新创建的文件夹默认在当前目录下

**技术要点**:
- 新增 `favorite_folders` 表（id, name, parent_id, created_at, updated_at）
- 实现递归查询获取完整文件夹树
- 防止循环引用（A → B → A）

---

#### FOLDER-02: 重命名文件夹
**优先级**: P0
**描述**: 用户可以重命名现有文件夹

**验收标准**:
- [ ] 用户可以通过右键菜单选择"重命名"
- [ ] 用户可以通过双击文件夹名称进入编辑模式
- [ ] 重命名后立即更新显示

---

#### FOLDER-03: 删除文件夹
**优先级**: P0
**描述**: 用户可以删除文件夹及其所有内容

**验收标准**:
- [ ] 用户可以通过右键菜单选择"删除"
- [ ] 删除前显示确认对话框，提示将删除所有子项
- [ ] 删除文件夹时，其下的所有收藏项和子文件夹一并删除（级联删除）
- [ ] 删除后自动导航到父文件夹

**技术要点**:
- 使用 SQLite `ON DELETE CASCADE`
- 或者在应用层实现级联删除

---

#### FOLDER-04: 移动收藏到文件夹
**优先级**: P0
**描述**: 用户可以将收藏项移动到指定文件夹

**验收标准**:
- [ ] 用户可以通过拖拽将收藏项移动到文件夹
- [ ] 用户可以通过右键菜单选择"移动到..."选择目标文件夹
- [ ] 支持批量移动（选中多个收藏项后移动）
- [ ] 移动后收藏项在原位置消失，出现在目标文件夹中

**技术要点**:
- `favorites` 表新增 `folder_id` 字段
- 实现批量更新 `folder_id` 的 API

---

#### FOLDER-05: 文件夹树状导航
**优先级**: P1
**描述**: 收藏夹页面左侧显示文件夹树

**验收标准**:
- [ ] 左侧面板显示完整的文件夹树结构
- [ ] 点击文件夹在右侧显示其内容
- [ ] 文件夹节点支持展开/收起
- [ ] 显示每个文件夹的收藏项数量

---

#### FOLDER-06: 面包屑导航
**优先级**: P1
**描述**: 收藏夹页面顶部显示当前位置的面包屑

**验收标准**:
- [ ] 顶部显示 "收藏夹 > 文件夹A > 子文件夹B" 格式的路径
- [ ] 点击路径中的任意节点可跳转到该位置
- [ ] 根目录显示 "收藏夹" 或 "所有书签"

---

#### FOLDER-07: 拖拽排序
**优先级**: P2
**描述**: 支持拖拽调整收藏项和文件夹的顺序

**验收标准**:
- [ ] 可以拖拽收藏项调整在同一文件夹内的顺序
- [ ] 可以拖拽文件夹调整顺序
- [ ] 拖拽到文件夹上时高亮显示，松开后移入该文件夹
- [ ] 排序结果持久化保存

**技术要点**:
- 使用 HTML5 Drag and Drop API
- 新增 `sort_order` 字段或使用 `fractional indexing`

---

#### FOLDER-08: 右键菜单（收藏夹页面）
**优先级**: P1
**描述**: 收藏夹页面的右键菜单功能

**验收标准**:
- [ ] **收藏项右键菜单**:
  - 打开（在当前标签页）
  - 在新标签页打开
  - 在新窗口打开
  - 编辑
  - 剪切 / 复制 / 粘贴
  - 删除
  - 属性
- [ ] **文件夹右键菜单**:
  - 打开（在新标签页打开所有书签）
  - 在新窗口中打开
  - 重命名
  - 删除
  - 添加书签
  - 添加文件夹
- [ ] **空白区域右键菜单**:
  - 添加书签
  - 添加文件夹
  - 按名称排序
  - 粘贴

---

## 特性 2：Chrome 书签导入

### 需求列表

#### IMPORT-01: 自动读取 Chrome 本地书签
**优先级**: P0
**描述**: 自动读取 Chrome 浏览器的本地书签文件

**验收标准**:
- [ ] 自动检测并读取 Chrome 书签文件路径：
  - macOS: `~/Library/Application Support/Google/Chrome/Default/Bookmarks`
  - Windows: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Bookmarks`
  - Linux: `~/.config/google-chrome/Default/Bookmarks`
- [ ] 解析 JSON 格式的书签数据
- [ ] 保留完整的文件夹结构
- [ ] 导入时显示进度和结果摘要
- [ ] 重复的 URL 自动跳过（不覆盖已有收藏）

**技术要点**:
- Chrome Bookmarks 文件是 JSON 格式
- 结构：`{ "roots": { "bookmark_bar": {...}, "other": {...}, "synced": {...} } }`
- 每个节点有 `type: "url"` 或 `type: "folder"`

---

#### IMPORT-02: 支持 HTML 书签文件导入
**优先级**: P1
**描述**: 支持导入 Chrome 导出的 HTML 格式书签文件

**验收标准**:
- [ ] 用户可以选择本地 HTML 书签文件导入
- [ ] 支持标准的 Netscape Bookmark 格式
- [ ] 保留文件夹结构
- [ ] 导入时显示预览，用户确认后执行

**技术要点**:
- HTML 书签格式是 Netscape Bookmark File Format
- 使用 `<DL><DT>` 结构
- 需要 HTML 解析库（如 cheerio）

---

#### IMPORT-03: 导入进度和冲突处理
**优先级**: P1
**描述**: 导入过程中显示进度，处理重复和冲突

**验收标准**:
- [ ] 导入时显示进度条（已导入/总数）
- [ ] 重复 URL 的处理策略：
  - 默认：跳过
  - 可选：更新标题和 favicon
- [ ] 导入完成后显示摘要：
  - 成功导入数量
  - 跳过数量（重复）
  - 创建的文件夹数量
- [ ] 支持取消导入操作

---

## 特性 3：收藏栏（书签栏）

### 需求列表

#### BAR-01: 收藏栏固定显示
**优先级**: P0
**描述**: 在地址栏下方固定显示收藏栏

**验收标准**:
- [ ] 收藏栏位于地址栏和标签栏之间
- [ ] 默认显示收藏夹根目录的内容
- [ ] 显示收藏项的 favicon 和标题
- [ ] 文件夹显示文件夹图标和名称
- [ ] 收藏栏高度固定，内容超出时显示 ">>" 溢出按钮

**UI 参考**:
```
┌─────────────────────────────────────────────────────────────┐
│ [←] [→] [⟳] [🔒 https://example.com                    ] │
├─────────────────────────────────────────────────────────────┤
│ 📁 常用  |  Google  |  GitHub  |  📁 工作  |  📁 学习  | >> │
├─────────────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

#### BAR-02: 收藏栏项目交互
**优先级**: P0
**描述**: 收藏栏项目的点击和交互行为

**验收标准**:
- [ ] 点击收藏项：在当前标签页导航到该 URL
- [ ] Cmd/Ctrl + 点击收藏项：在新标签页打开
- [ ] 点击文件夹：展开显示文件夹内容（下拉菜单）
- [ ] 鼠标悬停在文件夹上：自动展开（延迟 300ms）

---

#### BAR-03: 收藏栏右键菜单
**优先级**: P1
**描述**: 收藏栏的右键菜单功能

**验收标准**:
- [ ] **收藏项右键菜单**:
  - 在新标签页打开
  - 编辑
  - 删除
- [ ] **文件夹右键菜单**:
  - 在新标签页中打开所有书签
  - 重命名
  - 删除
  - 添加书签
  - 添加文件夹
- [ ] **收藏栏空白区域右键菜单**:
  - 添加书签
  - 添加文件夹
  - 隐藏收藏栏（设置）

---

#### BAR-04: 收藏栏显示/隐藏设置
**优先级**: P2
**描述**: 用户可以选择显示或隐藏收藏栏

**验收标准**:
- [ ] 在设置页面添加"显示收藏栏"开关
- [ ] 默认开启
- [ ] 可通过右键菜单快捷隐藏
- [ ] 设置持久化保存

---

## 特性 4：AI Agent 集成

> 参考文档：`docs/plan/pi-agent-integration.md`

### 需求列表

#### AI-01: Node.js 版本验证和基础架构
**优先级**: P0
**对应**: pi-agent-integration.md Phase 1
**重要说明**: AI 功能完全基于 pi-agent-core 集成，不自行开发 Agent 循环

**描述**: 验证 pi-ai 和 pi-agent-core 在 Electron 主进程中的兼容性，建立 AI 模块基础架构

**验收标准**:
- [x] 验证 Electron 32.x 内置 Node.js 版本是否满足 pi-agent-core 要求（>= 22.19.0）**结果: 32.3.3 内置 Node 20.18.x，不满足**
- [ ] 如不满足，实施方案（按优先级）：（**留到后续 Phase 评估**）
  - 方案 A：升级 Electron 版本至内置 Node >= 22.19.0
  - 方案 B：使用独立子进程运行 Agent（使用系统 Node.js），通过 IPC 与主进程通信
  - ~~方案 C：仅使用 pi-ai，自行实现 Agent 循环~~（**废弃，用户明确要求使用 pi-agent-core**）
- [x] 安装 `@earendil-works/pi-ai` 和 `@earendil-works/pi-agent-core`
- [x] 创建 `ai-manager.js` 模块骨架
- [ ] 实现最小可行 Demo：
  - 在主进程使用 pi-agent-core 的 `Agent` 类创建 Agent 实例
  - 实现 1 个简单工具（如 `get_tabs`），使用 `AgentTool` 接口
  - 通过 IPC 将 Agent 事件（`agent.subscribe`）推送到渲染进程控制台

**技术要点**:
- 检查 Node 版本：`process.versions.node`
- pi-ai 核心 API：`builtinModels()`, `models.stream()`
- pi-agent-core 核心：`Agent` 类, `AgentTool` 接口, `agent.subscribe()` 事件系统
- **不自行实现**: Agent 循环、工具执行引擎、上下文管理（全部使用 pi-agent-core 提供的能力）

---

#### AI-02: AI Manager 核心功能
**优先级**: P0
**对应**: pi-agent-integration.md Phase 2

**描述**: 完成 AI Manager 核心模块，注册 Realm 工具，打通 IPC 通信

**验收标准**:
- [ ] **AI Manager 模块** (`ai-manager.js`):
  - 初始化 pi-ai Models 集合
  - 创建和管理 Agent 实例
  - 管理 API Key 配置（存储在 electron-store）
  - 通过 IPC 广播 Agent 事件到渲染进程
- [ ] **注册 Realm 工具**（至少 5 个）:
  - `navigate` - URL 导航
  - `search_history` - 搜索浏览历史
  - `manage_favorites` - 增删查改书签
  - `switch_container` - 切换容器
  - `get_tabs` - 获取标签页列表
- [ ] **IPC 通道**:
  - `ai:prompt` - 发送用户消息
  - `ai:abort` - 取消当前操作
  - `ai:configure` - 配置 API Key
  - `ai:get-models` - 获取可用模型列表
  - `ai:event` - 广播 Agent 事件
- [ ] **Preload.js 新增 API**:
  ```javascript
  window.realmAPI.ai = {
    prompt: (message) => ipcRenderer.invoke('ai:prompt', message),
    abort: () => ipcRenderer.invoke('ai:abort'),
    onEvent: (callback) => { ... },
    configureProviders: (config) => ipcRenderer.invoke('ai:configure', config),
    getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),
  }
  ```

---

#### AI-03: AI 聊天面板 UI
**优先级**: P1
**对应**: pi-agent-integration.md Phase 3

**描述**: 实现 AI 助手的聊天界面

**验收标准**:
- [ ] **AI 聊天面板**:
  - 消息列表（用户消息 + AI 回复）
  - 输入框 + 发送按钮
  - 流式消息渲染（逐字显示）
  - 工具执行状态展示（折叠显示）
- [ ] **面板交互**:
  - 快捷键唤起/隐藏（建议 `Cmd/Ctrl + Shift + A`）
  - 支持拖拽调整面板大小
  - 记住面板大小和位置
- [ ] **设置集成**:
  - 设置页面新增 "AI 助手" 分类
  - API Key 配置
  - 模型选择
  - 启用/禁用开关

---

## 非功能性需求

### NFR-01: 性能
- 文件夹树加载时间 < 100ms（1000 个文件夹）
- 收藏栏渲染时间 < 50ms
- AI 响应首字节时间 < 2s

### NFR-02: 数据迁移
- 旧版本收藏数据自动迁移到新结构（添加 folder_id 字段）
- 迁移过程对用户透明，无需手动操作

### NFR-03: 向后兼容
- 未使用文件夹功能的用户，体验与当前版本一致
- 收藏栏默认显示根目录所有收藏项

---

## 技术依赖

### 新增 npm 包
```json
{
  "dependencies": {
    "@earendil-works/pi-ai": "^0.82.0",
    "@earendil-works/pi-agent-core": "^0.82.0",
    "cheerio": "^1.0.0"
  }
}
```

### 数据库变更
- 新增 `favorite_folders` 表
- `favorites` 表新增 `folder_id` 字段
- 新增索引优化查询性能

---

## 里程碑拆分建议

### Phase 1: 收藏夹文件夹基础（FOLDER-01 ~ FOLDER-04）
- 数据库层实现
- 核心 API
- 基础 UI 交互

### Phase 2: 收藏夹 UI 增强（FOLDER-05 ~ FOLDER-08）
- 文件夹树导航
- 面包屑
- 拖拽排序
- 右键菜单

### Phase 3: Chrome 导入 + 收藏栏（IMPORT-01 ~ IMPORT-03, BAR-01 ~ BAR-04）
- Chrome 书签解析
- 导入流程
- 收藏栏 UI
- 收藏栏交互

### Phase 4: AI 基础架构（AI-01）
- Node 版本验证
- pi-ai/pi-agent-core 集成
- 最小 Demo

### Phase 5: AI 核心功能（AI-02）
- AI Manager 完整实现
- 工具注册
- IPC 通信

### Phase 6: AI 聊天 UI（AI-03）
- 聊天面板
- 流式渲染
- 设置集成

---

## 待澄清问题

1. **Chrome 多 Profile 支持**：是否需要支持 Chrome 的多 Profile 书签导入？
2. **书签同步**：是否需要支持 Chrome 书签的实时同步（定期轮询）？
3. **AI Provider 优先级**：默认推荐哪个 AI Provider（OpenAI/Anthropic/本地）？
4. **收藏栏最大高度**：收藏栏最多显示几行？超出如何处理？

---

*文档创建：2026-07-28*
*待用户确认后开始路线图规划*
