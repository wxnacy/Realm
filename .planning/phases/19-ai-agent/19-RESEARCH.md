# Phase 19: AI Agent 集成 - 基础验证 - 研究报告

**研究日期:** 2026-07-31
**状态:** 完成

---

## 1. Node.js 版本兼容性

### 系统环境

- **系统 Node.js**: v22.22.0 ✓ (满足 pi-agent-core >= 22.19.0 的要求)
- **Electron**: ^32.0.0
- **Electron 内置 Node**: 需运行时验证（`npx electron -e "console.log(process.versions.node)"`）

### 兼容性分析

**关键发现**: 系统 Node.js 版本已满足要求。但 Electron 主进程使用的是内置 Node 运行时，不是系统 Node.js。需要在运行时验证 Electron 32.x 内置的 Node 版本。

**验证步骤**:
1. 检查 Electron 32.x 内置 Node 版本
2. 测试 pi-ai 和 pi-agent-core 能否在 Electron 主进程正常 require
3. 如版本不满足，评估升级 Electron 或子进程方案

**决策路径**:
- D-01: 先验证 → D-02: 满足则直接用 → D-03: 不满足则升级/子进程 → D-04: pi-ai 单独兜底

---

## 2. pi SDK 依赖分析

### 需要安装的包

| 包名 | 用途 | 备注 |
|------|------|------|
| `@earendil-works/pi-ai` | 统一 LLM API 层 | 核心依赖 |
| `@earendil-works/pi-agent-core` | Agent 运行时 | 核心依赖 |

**不需要安装**:
- `@earendil-works/pi-coding-agent` — 编程 Agent CLI，与浏览器集成无关
- `@earendil-works/pi-tui` — 终端 UI 库，Electron 不需要

### API 核心概念

**pi-ai**:
- `builtinModels()` — 创建模型集合，支持 30+ 提供商
- `models.stream()` — 流式输出，返回异步迭代器
- `validateToolCall()` — TypeBox schema 校验工具参数
- `Context` — 纯 JSON，可序列化

**pi-agent-core**:
- `Agent` 类 — 高层封装，管理对话状态、工具执行、事件广播
- `AgentTool` 接口 — 工具定义，支持 TypeBox 参数
- 事件流 — `agent_start` → `turn_start` → `message_*` → `tool_execution_*` → `turn_end` → `agent_end`
- `AgentState` — 管理 systemPrompt、model、tools、messages

---

## 3. AI Manager 骨架设计

### 文件位置
- `ai-manager.js` — 主进程新模块

### 类结构

```javascript
class AIManager {
  constructor()           // 初始化状态
  async init()           // 初始化 pi-ai Models + Agent 实例
  async prompt(msg)      // 发送用户消息给 Agent
  abort()                // 取消当前操作
  _buildRealmTools()     // 构建 Realm 工具列表
  _compactContext()      // 上下文裁剪
}
```

### Phase 19 工具范围

| 工具 | 封装能力 | 对应模块 |
|------|---------|---------|
| `get_tabs` | 获取标签页列表 | tab-manager.js |

Phase 20 扩展其他工具（navigate、search_history、manage_favorites 等）。

---

## 4. 最小可行 Demo 范围

**目标**: 验证 Agent + get_tabs 工具执行

**流程**:
1. AIManager 初始化
2. 用户通过控制台调用 `aiManager.prompt('列出当前所有标签页')`
3. Agent 调用 get_tabs 工具
4. 结果打印到主进程控制台

**不涉及**:
- 渲染进程 UI（Phase 21）
- IPC 事件广播（Phase 20）
- API Key 管理 UI（Phase 20）

---

## 5. 集成点

| 集成点 | 文件 | Phase 19 行动 |
|--------|------|--------------|
| app.whenReady() | main.js | 添加 AIManager 初始化 |
| electron-store | 已有 | 复用存储 API Key |
| ipc-handlers.js | 已有 | Phase 20 添加通道 |
| preload.js | 已有 | Phase 20 暴露 API |

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Electron 内置 Node 版本不满足 | 阻断 | 验证后决定方案（升级/子进程/pi-ai 单独） |
| pi-agent-core API 变更 | 中 | 锁定版本，文档参考 0.82.1 |
| 主进程阻塞 | 中 | Phase 20 考虑 Worker Thread |

---

*研究完成，进入规划阶段。*
