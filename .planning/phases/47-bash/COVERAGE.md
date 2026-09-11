# API Coverage — Phase 47: 内置技能播种 + bash 策略加固

No external API integration: 本阶段只交付随包内置技能播种（`skills-builtin/` → `managed-skills/`）与 `ai-bash-policy.js` 的包管理器安装档，不新增任何 API / SDK 客户端代码。

## 复核证据

`api-coverage` 检测器在阶段范围内命中的 `api` 词共 5 处，逐条核对后均非外部 API 集成：

| 位置 | 命中原义 | 判定 |
|---|---|---|
| `47-01-PLAN.md:192` | `https://api.github.com/search/repositories` —— find-skills 技能**正文**里指导模型调用的检索端点 | 由 Phase 41 已交付的 `web_fetch` 工具在运行时执行；本阶段只写技能文本，不新增任何客户端代码 |
| `47-03-PLAN.md:59,296` | 「GitHub API 的 `license.spdx_id` 返回 `null`」 | `THIRD_PARTY_NOTICES.md` 归属记录里的**文档陈述** |
| `47-05-PLAN.md:316` | `/api/settings/update` | Realm **自身的本地 HTTP 端点**（Phase 38 既有） |
| `47-06-PLAN.md:87` | 「原先它只在 API 层成立」 | 指 `builtin-skills-seeder.js` 的**模块内部 API** |

## 阶段实际改动面

`skills-builtin/**`（find-skills / skill-creator 两个技能目录）、`builtin-skills-seeder.js`、`ai-bash-policy.js`、`ai-manager.js` 的确认卡片文案分支、`package.json` 打包项、`THIRD_PARTY_NOTICES.md`、文档与测试。

无网络客户端、无鉴权、无 SDK 依赖、无 endpoint 封装。

## 边界说明

`THIRD_PARTY_NOTICES.md` 中记录的 GitHub 仓库 / commit SHA 属**许可证归属**信息，非运行时调用；find-skills 的检索职责完全委托给既有 `web_fetch` 工具，其能力边界（端点、限定符、配额、核验规则、失败兜底）已在 `skills-builtin/find-skills/SKILL.md` 正文中枚举，不属于本阶段的 API 集成面。
