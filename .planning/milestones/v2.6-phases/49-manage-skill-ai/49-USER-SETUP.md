# Phase 49: User Setup Required

**Generated:** 2026-09-13
**Phase:** 49-manage-skill-ai（计划 07 · gap `G-49-3`）
**Status:** Complete（本机已满足，见下）

本计划 frontmatter 登记的 `user_setup` 只有一项：驱动 **兜底路径**（复用已持久化会话失败时才走）
需要真实 LLM 往返，故需要 `XIAOMI_API_KEY`。**该键在本机已存在于环境变量中**，由驱动的第 0 步
前置自检（`E-KEY`，只判「已设置」不打印值）当场核实，因此**无需人工补做任何配置**。

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [x] | `XIAOMI_API_KEY` | 小米 MiMo 平台控制台 → API Keys（变量名沿用既有 UAT 运行 2026-09-13 已使用的名字） | 运行环境的环境变量（realm-dev 的 `realm-config.json` 内该键为空，主进程 `ai-manager.detectEnvVar` 从环境变量解析） |

> 安全：值**从不落盘、从不打印**；驱动的 `E-KEY` 只输出「已设置 + 长度」，不输出内容。

## Account Setup

None —— 复用既有小米 MiMo 账号与既有键，不需要新建账号。

## Dashboard Configuration

None。

## 前置数据（**删除即本 gap 不可复现**）

| 位置 | 内容 | 为什么不能删 |
|------|------|-------------|
| `~/Library/Application Support/realm-dev/agent-workspace/managed-skills/` | `commit-style` + 14 个 `aa-budget-01..14`（每个 description 950 字符） | SDK 按 `localeCompare` 排序且 managed 先于 user ⇒ `aa-budget-*` 必然排在 `commit-style` 之前并撑满 8000 字符技能段预算，`commit-style` 才落入 `promptOmitted`、卡片才渲染超预算标注 |

驱动的 `E-DATA` 自检逐条判这两项，**判负即硬退出**（缺前提时任何「全绿」都是假绿）。

## Verification

```bash
# 1) 全局 playwright（_electron）+ 键存在 + 前置数据齐 —— 驱动的第 0 步自检即这三条
NODE_PATH="$(npm root -g)" node -e "process.exit(require('playwright')._electron?0:1)"   # 期望：退出码 0
node -e "process.exit(process.env.XIAOMI_API_KEY ? 0 : 1)"                                # 期望：退出码 0
ls "$HOME/Library/Application Support/realm-dev/agent-workspace/managed-skills/" | grep -c '^aa-budget-'   # 期望：14
ls -d "$HOME/Library/Application Support/realm-dev/agent-workspace/managed-skills/commit-style"            # 期望：存在

# 2) 真实渲染门禁（本 gap 的唯一有效证据）
NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js   # 期望：退出码 0，A1–A9 全绿
```

Expected results：

- 驱动首行打印 `E-PW true | E-KEY true | E-DATA true`，全轮断言 `ALL ASSERTIONS PASS`
- 证据 JSON 的 `preflight` 字段含上述三条的判定与明细

---

**Once all items complete:** Mark status as "Complete" at top of file.

> 本文件由计划 49-07 的执行器生成；`user_setup` 的前置条件在本机**已满足**，故生成时即标
> `Complete` 并把核实方式写在上面，避免留下一个会误导读者以为「还没配好」的 `Incomplete` 文件。
