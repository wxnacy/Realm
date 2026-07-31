# Phase 19: AI Agent 集成 - 基础验证 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 19-AI Agent 集成 - 基础验证
**Areas discussed:** Node.js 版本兼容方案, 最小可行 Demo 范围, AI Manager 骨架设计, API Key 存储策略

---

## Node.js 版本兼容方案

| Option | Description | Selected |
|--------|-------------|----------|
| 验证后决定 (Recommended) | 验证 Electron 32 内置 Node 版本。如果满足要求则直接用；如果不满足，优先评估升级 Electron 的可行性，再考虑子进程方案。 | ✓ |
| 优先绕过限制 | 先尝试方案 C（仅用 pi-ai），最小化依赖。如果不行再考虑子进程。 | |
| 直接用子进程 | 直接用子进程方案，与主进程完全隔离，不依赖 Electron 内置 Node 版本。 | |

**User's choice:** 验证后决定 (Recommended)
**Notes:** 用户倾向于先验证 Electron 内置版本，再决定具体方案。如果版本满足要求则直接用；如果不满足，优先评估升级 Electron 的可行性，再考虑子进程方案。方案 C（仅用 pi-ai）作为最后备选。

---

## 最小可行 Demo 范围

| Option | Description | Selected |
|--------|-------------|----------|
| 最小验证 | 创建 Agent 实例 → 发送消息 → LLM 返回文本 → 打印到主进程控制台。不涉及工具、IPC、渲染进程。 | |
| Agent + 工具验证 (Recommended) | Agent + get_tabs 工具 + 工具执行结果 + 主进程控制台输出。验证工具系统可用。 | ✓ |
| 完整链路验证 | Agent + 工具 + IPC 事件广播 + 渲染进程控制台输出。验证完整链路。 | |

**User's choice:** Agent + 工具验证 (Recommended)
**Notes:** Demo 范围确定为：创建 Agent 实例 + get_tabs 工具 + 工具执行结果，验证工具系统可用。输出到主进程控制台，不涉及渲染进程 UI。

---

## AI Manager 骨架设计

| Option | Description | Selected |
|--------|-------------|----------|
| 完整骨架 (Recommended) | 完整类结构 + 所有方法签名 + 静态工具注册 + 事件广播 + Demo 可直接运行。Phase 20 只需填充工具逻辑。 | ✓ |
| 类框架 | 完整类结构 + 方法签名 + 注释，部分方法留空。Demo 需要补充部分实现。 | |
| 最小接口 | 只暴露 init() 和 prompt() 接口，内部逻辑后续补充。 | |

**User's choice:** 完整骨架 (Recommended)
**Notes:** ai-manager.js 采用完整骨架设计，包含完整类结构、所有方法签名、静态工具注册、事件广播机制。骨架可直接运行 Demo，Phase 20 只需填充工具逻辑。

---

## API Key 存储策略

| Option | Description | Selected |
|--------|-------------|----------|
| electron-store (Recommended) | 使用 electron-store 存储，与现有容器配置统一。Phase 19 快速验证，安全性后续增强。 | ✓ |
| 环境变量 / Keychain | 用环境变量或系统 Keychain 存储，安全性高但用户配置不便。 | |
| electron-store + 加密 | electron-store + 简单加密（如 AES），安全性与易用性平衡。 | |

**User's choice:** electron-store (Recommended)
**Notes:** 使用 electron-store 存储 API Key，与现有容器配置统一。Phase 19 快速验证，安全性后续增强（Phase 20 或后续版本可考虑加密）。初始支持 OpenAI 提供商，其他提供商后续扩展。

---

## Claude's Discretion

以下方面由 Claude 自行决定：
- ai-manager.js 的具体方法实现细节
- get_tabs 工具的参数定义和返回格式
- 错误处理和日志输出格式
- Demo 的具体测试用例

## Deferred Ideas

None — discussion stayed within phase scope
