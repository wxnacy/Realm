# Realm Browser

多容器隔离浏览器，支持独立 Cookie 管理和 AI Agent 集成。

## 特性

- 🔒 **容器隔离** - 每个容器拥有独立的 Cookie、缓存和存储
- 🎨 **可视化管理** - 通过颜色和图标直观区分不同容器
- 🤖 **AI Agent 集成** - 预留 AI Agent SDK 集成能力（开发中）
- ⚡ **高性能** - 基于 Electron + Chromium 内核
- 🎯 **易于扩展** - 模块化架构，便于功能扩展

## 技术栈

- **框架**: Electron 32
- **语言**: JavaScript (ES6+)
- **UI**: HTML + CSS (无框架依赖)
- **存储**: electron-store (配置持久化)

## 项目结构

```
Realm/
├── main.js                    # Electron 主进程入口
├── src/
│   ├── index.html            # 主界面
│   ├── preload.js            # 预加载脚本（安全 IPC）
│   ├── renderer.js           # 渲染进程逻辑
│   ├── styles/
│   │   └── main.css          # 主样式文件
│   ├── containers/           # 容器管理模块（待扩展）
│   ├── browser/              # 浏览器核心（待扩展）
│   ├── ui/                   # UI 组件（待扩展）
│   └── ai/                   # AI Agent 集成（待扩展）
├── configs/                  # 配置文件
├── docs/                     # 文档
├── package.json              # 项目配置
└── README.md                 # 项目说明
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 生产构建

```bash
npm run build:mac
```

## 容器隔离机制

每个容器使用独立的 Electron Session partition：

```javascript
// 容器 "work" 使用独立的 session
const workSession = session.fromPartition('persist:container-work');

// 容器 "personal" 使用另一个独立的 session
const personalSession = session.fromPartition('persist:container-personal');
```

不同容器之间完全隔离：
- ✅ Cookies
- ✅ localStorage
- ✅ IndexedDB
- ✅ HTTP 缓存
- ✅ 会话数据

## 默认容器

| 容器 | 颜色 | 用途 |
|------|------|------|
| 默认 | 灰色 | 通用浏览 |
| 工作 | 蓝色 | 工作相关网站 |
| 个人 | 绿色 | 个人账号 |
| 金融 | 黄色 | 银行和金融网站 |

## 快捷键

- `Cmd/Ctrl + N`: 新建容器
- `Escape`: 关闭对话框

## 开发计划

- [x] 基础容器隔离
- [x] 容器管理 UI
- [x] Cookie 管理
- [ ] Web 视图集成
- [ ] 书签系统
- [ ] 扩展支持
- [ ] AI Agent 集成
- [ ] 自动填充
- [ ] 隐私保护增强

## 许可证

MIT
