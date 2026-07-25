# Feature Research - Multi-Container Isolation Browser

**Domain:** 多容器隔离浏览器
**Researched:** 2026-07-23
**Confidence:** MEDIUM（基于官方产品页面的一手信息，但未经用户验证）

## 竞品概览

研究了以下竞品的功能集：

| 产品 | 类型 | 核心定位 | 价格模型 |
|------|------|---------|---------|
| Firefox Multi-Account Containers | 浏览器扩展 | 隐私隔离 + 多账号 | 免费 |
| Ghost Browser | 独立浏览器（Chromium） | 专业多账号管理 | 免费 + 付费 |
| Multilogin | 独立浏览器 + 云手机 | 反检测/多账号运营 | 付费订阅 |
| GoLogin | 独立浏览器 | 反检测/指纹伪装 | 付费订阅 + 免费试用 |
| SessionBox | 浏览器扩展 | 多账号会话管理 | 免费 + 付费 |

## Feature Landscape

### Table Stakes（用户必须有的功能）

没有这些功能，产品就不完整，用户会直接离开。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 容器隔离（Cookie/Session/存储） | 这是产品的核心价值，所有竞品都支持 | MEDIUM | Realm 已有 Session partition 机制，需确保 LocalStorage、IndexedDB、HTTP 缓存也完全隔离 |
| 容器 CRUD（创建/编辑/删除） | 用户需要管理自己的容器 | LOW | Firefox MAC 和 Ghost Browser 都支持自定义容器 |
| 容器自定义（名称/颜色/图标） | 视觉区分是基本需求 | LOW | Firefox MAC 支持颜色+名称+图标，Ghost Browser 也支持 |
| 多账号同时登录同一网站 | 这是用户使用容器浏览器的核心动机 | MEDIUM | 所有竞品的 primary use case |
| 容器列表/管理界面 | 用户需要看到和管理所有容器 | LOW | 下拉面板或侧边栏 |
| URL 导航 | 浏览器的基本功能 | MEDIUM | Realm 当前未实现，需要 webview 或 BrowserView |
| 前进/后退/刷新 | 浏览器基本导航 | LOW | 标准浏览器功能 |

### Differentiators（竞争优势功能）

这些功能让产品脱颖而出。Realm 应选择性实现，聚焦核心价值。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cookie 文件持久化 | 用户可以备份/迁移容器数据，跨设备同步 | MEDIUM | 参考 AutoBrowser 的 JSON 文件格式。Ghost Browser 和 Multilogin 都有数据持久化，但实现方式不同 |
| 容器分配规则（URL 自动归类） | 指定网站自动在特定容器打开，减少手动切换 | MEDIUM | Firefox MAC 的杀手功能之一。用户可以设定 "github.com 总是在 Work 容器打开" |
| 容器间数据导入导出 | 方便迁移和备份 | LOW | 所有竞品都有某种形式的数据导出 |
| 快捷键支持 | 提高效率用户的操作速度 | LOW | Firefox MAC 支持长按新标签页按钮快速打开容器标签 |
| 容器颜色标识的 Tab UI | 视觉区分当前容器 | LOW | Firefox MAC 用颜色条标识容器，非常直观 |
| 每容器独立代理 | 不同容器走不同 IP | HIGH | Ghost Browser 和 GoLogin 的核心功能。Realm PROJECT.md 明确标注为 Out of Scope |
| 浏览器指纹伪装 | 防止网站通过指纹关联账号 | HIGH | Multilogin 和 GoLogin 的核心卖点（53+ 指纹参数）。技术复杂度极高，且与 Realm 的核心定位不同 |
| 团队协作/共享容器 | 团队成员共享容器配置 | HIGH | Multilogin 和 Ghost Browser 的付费功能。需要云同步和权限管理 |

### Anti-Features（应该避免的功能）

这些功能看起来不错，但会带来问题或偏离核心定位。

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| 浏览器扩展支持 | 用户可能想用 Chrome 扩展 | Electron 的扩展支持不稳定，维护成本极高，且安全模型与容器隔离冲突 | 聚焦原生功能，不依赖扩展生态 |
| 完整的反检测浏览器功能 | 市场有需求 | 技术复杂度极高（53+ 指纹参数），需要持续对抗网站检测，且可能涉及法律灰色地带 | 专注隐私隔离，不追求反检测 |
| 云同步/跨设备同步 | 用户期望跨设备使用 | 需要后端基础设施，增加运维成本和安全风险 | 先做本地 JSON 导入导出，未来可选云同步 |
| 内置 VPN/代理服务 | Ghost Browser 和 GoLogin 都有 | 需要代理基础设施，成本高，且与浏览器核心功能耦合 | 支持用户配置外部代理，或预留接口 |
| AI Agent 集成 | 项目规划中有 | 当前阶段会分散精力，且 AI Agent 的浏览器自动化场景尚未成熟 | 预留架构接口，但本期不实现 |
| 自动化脚本/宏录制 | Multilogin 和 GoLogin 支持 Selenium/Puppeteer | 技术复杂度高，且主要面向批量操作场景，与 Realm 的个人用户定位不符 | 预留 API 接口，未来可考虑 |
| 移动端支持 | 市场覆盖 | Electron 不适合移动端，需要完全不同的技术栈 | 专注桌面端 macOS |

## Feature Dependencies

```
容器 CRUD
    └──requires──> 容器管理 UI（下拉面板）
                       └──requires──> 容器列表渲染

容器切换
    └──requires──> 容器 CRUD
        └──requires──> URL 导航（webview/BrowserView）

多账号登录
    └──requires──> 容器隔离（Cookie/Session/存储）
        └──requires──> 容器 CRUD

Cookie 文件持久化
    └──requires──> 容器隔离
        └──enhances──> 容器间数据导入导出

容器分配规则
    └──requires──> 容器 CRUD
        └──requires──> URL 导航

容器颜色标识 Tab UI
    └──requires──> 容器自定义（颜色）
        └──enhances──> 容器切换体验
```

### Dependency Notes

- **容器 CRUD 是所有功能的基础**：没有容器管理，其他功能都无法工作
- **URL 导航是关键瓶颈**：Realm 当前未实现 webview 导航，这是阻塞项
- **容器隔离是核心价值**：必须确保 Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存全部隔离
- **Cookie 持久化增强可靠性**：用户关闭应用后数据不丢失，是信任基础

## MVP Definition

### Launch With (v1)

最小可行产品 — 验证核心概念所需的最少功能。

- [ ] **容器 CRUD** — 创建、编辑、删除容器，自定义名称/颜色/图标
- [ ] **容器管理 UI** — 下拉面板显示容器列表，支持切换
- [ ] **完整数据隔离** — Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存
- [ ] **URL 导航** — 在容器中打开和浏览网页
- [ ] **多 Tab 支持** — 同一窗口内多个容器的 Tab
- [ ] **基础导航** — 前进、后退、刷新、URL 输入

### Add After Validation (v1.x)

核心验证通过后添加的功能。

- [ ] **Cookie 文件持久化** — 触发条件：用户反馈关闭应用后登录状态丢失
- [ ] **容器分配规则** — 触发条件：用户频繁手动切换容器到同一网站
- [ ] **快捷键支持** — 触发条件：效率用户反馈操作繁琐
- [ ] **容器间数据导入导出** — 触发条件：用户需要备份或迁移
- [ ] **容器颜色标识 Tab** — 触发条件：用户反馈难以区分当前容器

### Future Consideration (v2+)

产品市场验证后再考虑的功能。

- [ ] **每容器独立代理** — 需要代理基础设施，成本高
- [ ] **团队协作** — 需要云同步和权限系统
- [ ] **AI Agent 集成** — 预留架构，等待市场成熟
- [ ] **浏览器扩展支持** — 技术复杂度高，维护成本大

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 容器 CRUD | HIGH | LOW | P1 |
| 容器管理 UI | HIGH | LOW | P1 |
| 完整数据隔离 | HIGH | MEDIUM | P1 |
| URL 导航 | HIGH | MEDIUM | P1 |
| 多 Tab 支持 | HIGH | MEDIUM | P1 |
| 容器自定义（名称/颜色/图标） | MEDIUM | LOW | P1 |
| Cookie 文件持久化 | MEDIUM | MEDIUM | P2 |
| 容器分配规则 | MEDIUM | MEDIUM | P2 |
| 快捷键支持 | LOW | LOW | P2 |
| 容器颜色标识 Tab | MEDIUM | LOW | P2 |
| 数据导入导出 | LOW | LOW | P2 |
| 每容器独立代理 | MEDIUM | HIGH | P3 |
| 团队协作 | LOW | HIGH | P3 |
| AI Agent 集成 | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch（v1 必须有）
- P2: Should have, add when possible（v1.x 添加）
- P3: Nice to have, future consideration（v2+ 考虑）

## Competitor Feature Analysis

| Feature | Firefox MAC | Ghost Browser | Multilogin | GoLogin | Realm |
|---------|-------------|---------------|------------|---------|-------|
| 容器/Profile 隔离 | 完整支持 | 完整支持 | 完整支持 | 完整支持 | 核心功能 |
| 自定义容器名称/颜色/图标 | 支持 | 支持 | 支持 | 支持 | 支持 |
| 多账号同时登录 | 支持 | 支持 | 支持 | 支持 | 支持 |
| URL 自动归类 | 支持 | 不明确 | 不明确 | 不明确 | 计划中 |
| Cookie 持久化 | 浏览器管理 | 支持 | 支持 | 支持 | 计划中 |
| 独立代理 | Mozilla VPN 集成 | 支持 | 支持 | 内置代理 | Out of Scope |
| 指纹伪装 | 不支持 | 不支持 | 53+ 参数 | 53+ 参数 | Out of Scope |
| 团队协作 | 不支持 | 支持 | 支持 | 支持 | 未来考虑 |
| Chrome 扩展兼容 | N/A（Firefox） | 支持 | 支持 | 支持 | Out of Scope |
| 自动化/Selenium | 不支持 | 不明确 | 支持 | 支持 | 未来考虑 |
| 云同步 | Firefox Sync | 支持 | 支持 | 支持 | 未来考虑 |
| 平台 | Firefox | Win/Mac/Linux | 云端 | 云端 | macOS |

### Realm 的差异化定位

Realm 不是反检测浏览器（Multilogin/GoLogin），也不是企业协作工具（Ghost Browser）。

Realm 的定位是：**个人用户的多容器隔离浏览器**，类似于 Firefox Multi-Account Containers 的独立应用版本。

核心差异：
1. **独立应用**：不依赖 Firefox/Chrome，基于 Electron 构建
2. **简单易用**：比 Firefox MAC 更直观的 UI，比 Multilogin 更轻量
3. **数据主权**：Cookie 本地持久化，用户完全控制数据
4. **预留 AI 能力**：未来可集成 AI Agent，这是竞品都没有的

## Sources

- [Firefox Multi-Account Containers - addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/) — 官方扩展页面，一手信息
- [Ghost Browser - ghostbrowser.com](https://ghostbrowser.com/) — 官方网站，一手信息
- [Multilogin - multilogin.com](https://multilogin.com/) — 官方网站，一手信息
- [GoLogin - gologin.com](https://gologin.com/) — 官方网站，一手信息

---
*Feature research for: Multi-Container Isolation Browser*
*Researched: 2026-07-23*

---

# v1.1 Feature Landscape

**Domain:** Electron 多容器隔离浏览器 v1.1 — 容器属性增强 + 收藏历史 + 常用网站 + 设置页面
**Researched:** 2026-07-25
**Overall confidence:** MEDIUM（基于浏览器通用实现模式和 Electron API 知识，LOW confidence 来源于 websearch，MEDIUM confidence 来源于现有代码结构验证）

## v1.1 Table Stakes

用户在容器浏览器中期望的基础功能，缺失会导致产品不完整。

### 容器属性扩展

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 容器备注（notes） | Firefox Multi-Account Containers 用户常用场景：记录容器用途、登录账号等 | Low | 现有 `electron-store` 容器对象直接扩展字段即可 |
| 容器手机号/邮箱 | 多账号管理场景下标记容器对应的联系方式 | Low | 同上，纯数据字段扩展 |
| 容器属性编辑 UI | 用户需要可视化编辑扩展属性 | Med | 现有容器编辑模态框需扩展字段区域 |
| 容器属性展示 | 侧边栏或下拉面板中展示容器的关键属性摘要 | Med | 需要设计信息密度平衡 |

**依赖现有实现：**
- `container-manager.js` 中 `DEFAULT_CONTAINERS` 数据结构（line 24-29）→ 扩展字段
- `container-manager.js` 中 `configStore` 持久化机制 → 无需改动
- `src/renderer.js` 中容器编辑模态框 → 扩展 UI

### 收藏夹管理

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 添加收藏（星号按钮/Cmd+D） | 所有浏览器标配，用户肌肉记忆 | Low | 需要捕获当前 Tab 的 URL 和标题 |
| 收藏列表展示 | 用户需要查看和管理已收藏内容 | Med | 需要新的 UI 面板（侧边栏或独立页面） |
| 收藏编辑（标题/URL 修改） | 网站标题过长或不直观时用户需要自定义 | Low | CRUD 中的基础 Update |
| 收藏删除 | 基础 CRUD | Low | 单个删除 + 确认提示 |
| 收藏文件夹 | 当收藏量增大后需要分类组织 | Med | 需要树形数据结构和嵌套 UI |
| 收藏搜索 | 收藏量大时快速定位 | Low | 匹配标题和 URL |
| 收藏栏显示 | 快速访问常用收藏 | Med | 工具栏下方的书签栏 |

**依赖现有实现：**
- `main.js` 中 webview 的 `did-navigate` 事件 → 获取当前页面 URL/标题
- `src/preload.js` 中 `contextBridge` → 新增收藏相关 IPC
- `electron-store` → 收藏数据持久化（建议使用独立 store 文件）

### 浏览历史

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 自动记录访问（URL/标题/时间） | 所有浏览器标配 | Low | 监听 webview 导航事件 |
| 历史列表展示 | 用户查看最近访问记录 | Med | 按日期分组的列表 UI |
| 历史搜索 | 在大量历史记录中定位 | Med | 需要全文搜索或前缀匹配 |
| 历史条目点击跳转 | 点击历史记录重新访问该页面 | Low | 基础导航功能 |
| 历史删除 | 清除单条或批量历史 | Low | 单条 + 批量 + 清空全部 |
| 历史自动过期 | 避免历史数据无限增长 | Med | 可配置保留天数，默认 90 天 |

**依赖现有实现：**
- `main.js` 中 `webview` guest 拦截逻辑（line 38-76）→ 可在此处追踪导航
- `src/renderer.js` 中 webview 事件监听 → `did-navigate`、`did-navigate-in-page`
- 每个容器的 Session 隔离 → 历史也应按容器隔离

### 常用网站推荐

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 新标签页常用网站网格 | Chrome/Firefox/Safari 新标签页标配 | Med | 需要新的新标签页 UI |
| 按访问频率排序 | 基础排序逻辑 | Med | 需要历史记录数据支持 |
| 时间衰减权重 | 近期访问权重更高 | Med | 类似 Firefox frecency 算法 |
| 网站图标/缩略图展示 | 视觉识别，提升点击率 | Med | 需要 favicon 获取机制 |
| 用户置顶/固定 | 显式操作覆盖算法推荐 | Low | 类似 Safari 固定网站功能 |
| 按容器过滤 | 常用网站应按当前容器上下文展示 | Med | 不同容器显示不同常用网站 |

**依赖现有实现：**
- 浏览历史数据 → 计算频率/最近性
- `src/renderer.js` 中 Tab 创建逻辑 → 新标签页需要特殊处理
- 容器 Session 隔离 → 常用网站按容器隔离

### 设置页面

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 设置页面入口 | macOS 菜单"偏好设置"，用户期望标准位置 | Low | 应用菜单中添加设置项 |
| 通用设置（启动行为） | 控制应用启动时的行为 | Low | electron-store 持久化 |
| 隐私设置（清除数据） | 用户需要清除浏览数据的能力 | Med | 需要调用 session.clearStorageData |
| 默认浏览器设置 | 引导用户设置为默认浏览器 | Med | macOS 平台限制较多 |
| 设置持久化 | 设置项需要在重启后保持 | Low | 使用 electron-store |
| 设置变更即时生效 | 修改设置后立即生效，无需重启 | Med | 需要 IPC 通知主进程 |

**依赖现有实现：**
- `electron-store` → 设置持久化
- `main.js` 中 `configStore` → 可复用或扩展
- Electron `session` API → 清除浏览数据

## v1.1 Differentiators

区别于其他浏览器的差异化特性，提升产品竞争力。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 收藏按容器隔离 | 每个容器拥有独立的收藏夹，避免工作/个人收藏混在一起 | Med | Firefox Multi-Account Containers 不支持此功能，是显著差异化点 |
| 容器属性自动填充 | 根据容器的手机号/邮箱属性自动填充网页表单 | High | 需要 DOM 注入 + 表单识别，复杂度高但价值大 |
| 常用网站域名聚合 | 同一域名下多个页面合并为一个常用网站卡片 | Med | Chrome 已支持，但按容器隔离是新体验 |
| 收藏智能分类建议 | 基于 URL 模式自动建议收藏文件夹 | High | 需要 URL 分析和模式识别，可后续迭代 |
| 历史记录跨 Tab 关联 | 显示从哪个页面跳转到当前页面的链路 | Med | 需要记录 referrer 信息，构建导航图 |
| 设置页面容器级配置 | 每个容器可独立配置行为（如是否记录历史、是否保存 Cookie） | Med | 与现有 assignment-rules 模式一致 |
| 默认浏览器一键设置 | 应用内引导用户设置为默认浏览器 | Low | 利用 Electron API + 系统设置引导 |

## v1.1 Anti-Features

明确不在本期构建的功能，避免范围蔓延。

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 收藏/历史同步 | 跨设备同步需要后端服务，架构复杂度极高 | 仅本地存储，预留数据导出接口 |
| 书签标签系统 | 标签系统需要全新的搜索和筛选 UI，与文件夹系统重复 | 使用文件夹组织，保持简单 |
| 历史记录死链检测 | 需要后台网络请求，影响性能 | 用户点击时自然发现死链 |
| 收藏重复检测 | 需要 URL 标准化和模糊匹配逻辑 | 允许重复，用户自行管理 |
| 收藏导入（从其他浏览器） | 需要解析多种格式（Chrome JSON、Firefox HTML 等） | 仅支持标准 HTML 格式导出，不支持导入 |
| AI 驱动的智能推荐 | 需要 ML 模型和用户行为分析 | 使用简单的频率+最近性算法 |
| 容器属性加密存储 | 增加复杂度，用户可能不需要 | 明文存储在 electron-store 中 |
| 历史记录云端备份 | 需要后端服务 | 仅本地存储 |

## v1.1 Feature Dependencies

```
浏览历史记录 ──→ 常用网站推荐（需要历史数据计算频率和最近性）
浏览历史记录 ──→ 历史搜索（需要历史数据）
收藏夹管理 ──→ 收藏栏显示（需要收藏数据）
收藏夹管理 ──→ 收藏按容器隔离（需要收藏 + 容器关联）
容器属性扩展 ──→ 容器属性自动填充（需要属性数据 + DOM 注入）
容器属性扩展 ──→ 容器属性编辑 UI（需要属性数据模型）
常用网站推荐 ──→ 新标签页 UI（需要展示框架）
```

### 关键路径

```
容器属性扩展（独立，无依赖）
    └── 容器属性编辑 UI
    └── 容器属性展示

浏览历史记录（独立，无依赖）
    ├── 常用网站推荐（依赖历史数据）
    └── 历史搜索（依赖历史数据）

收藏夹管理（独立，无依赖）
    ├── 收藏栏显示（依赖收藏数据）
    └── 收藏按容器隔离（依赖收藏 + 容器）

设置页面（独立，无依赖）
    └── 默认浏览器设置
```

## v1.1 MVP Recommendation

### 优先构建（Phase 1）

1. **容器属性扩展** — 低成本高价值，直接扩展现有数据结构
2. **浏览历史记录** — 基础数据层，为常用网站推荐提供数据支持
3. **收藏夹管理** — 基础 CRUD，浏览器必备功能
4. **设置页面** — 独立模块，可并行开发

### 延后构建（Phase 2）

- **常用网站推荐** — 需要历史数据积累，建议在历史记录功能稳定后实现
- **收藏按容器隔离** — 需要设计容器与收藏的关联模型
- **收藏文件夹** — 初期可只支持扁平收藏列表

### 不构建

- 收藏导入/同步、标签系统、死链检测、AI 推荐等 — 见 Anti-Features

## v1.1 Confidence Notes

| 领域 | 置信度 | 原因 |
|------|--------|------|
| 容器属性扩展 | HIGH | 现有代码结构清晰，扩展路径明确 |
| 收藏夹管理 | MEDIUM | 浏览器通用模式成熟，但 UI 设计需结合项目风格 |
| 浏览历史 | MEDIUM | 实现模式成熟，但 Electron webview 事件需验证 |
| 常用网站推荐 | MEDIUM | 算法模式成熟，但 frecency 实现细节需确认 |
| 设置页面 | HIGH | Electron 标准模式，无技术风险 |
| 默认浏览器 | LOW | macOS 平台限制较多，需实际测试验证 |

## v1.1 Sources

- 浏览器通用实现模式（Chrome/Firefox/Safari 公开文档和源码）
- Firefox Multi-Account Containers 扩展源码（Mozilla GitHub）
- Electron 官方文档（app.setAsDefaultProtocolClient、webview 事件）
- 项目现有代码结构（container-manager.js、main.js、renderer.js）
