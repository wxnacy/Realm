# Technology Stack

**Analysis Date:** 2026-07-23

## Languages

**Primary:**
- JavaScript (ES6+) - 主进程和渲染进程开发
- HTML5 - UI 结构定义
- CSS3 - 样式和布局

**Secondary:**
- Node.js - Electron 主进程运行时

## Runtime

**Environment:**
- Node.js - 主进程运行时
- Chromium - 渲染进程运行时（通过 Electron）
- Electron 32.x - 桌面应用框架

**Package Manager:**
- npm - 包管理器
- Lockfile: 缺失（package-lock.json 被 gitignore）

## Frameworks

**Core:**
- Electron 32.0.0+ - 跨平台桌面应用框架
- Electron Builder 24.13.0+ - 应用打包和分发工具

**Testing:**
- 未检测到测试框架 - 项目当前没有配置测试

**Build/Dev:**
- Electron Builder - 生产构建和打包
- npm scripts - 开发和构建脚本

## Key Dependencies

**Critical:**
- electron-store 8.1.0+ - 容器配置持久化存储
- Electron Session API - 容器隔离的核心机制（内置）

**Infrastructure:**
- 无额外基础设施依赖

## Configuration

**Environment:**
- 通过 `process.env.NODE_ENV` 控制开发/生产模式
- 开发模式自动打开开发者工具
- 无外部环境变量配置

**Build:**
- `package.json` - 项目配置和构建脚本
- `electron-builder` 配置嵌入 package.json 的 `build` 字段
- 构建目标：macOS (dmg, zip)

## Platform Requirements

**Development:**
- Node.js 运行时
- npm 包管理器
- macOS（主要开发平台）

**Production:**
- macOS 桌面环境
- 应用 ID：`com.realm.browser`
- 产品名称：Realm

---

*Stack analysis: 2026-07-23*
