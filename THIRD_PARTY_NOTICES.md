# 第三方内容归属声明（Third-Party Notices）

本文件记录 Realm Browser 随包分发的第三方内容及其许可证义务，是发布门禁 **P10** 的载体。
每项记录五个要素：**来源仓库 URL / 固定 commit SHA / 许可证 / 是否修改 / 修改说明**，
另加一行指向随包的许可证副本路径。

固定 SHA 一律取「该文件最后一次改动所属的 commit」，**不是仓库 HEAD** —— HEAD 每天都在动，
用 HEAD 等于没有固定。两个内置技能**都标 `modified`**（fail-safe：把已修改的内容说成未修改
是潜在的许可证违约，尤其是 Apache-2.0 第 4(b) 条要求被修改的文件带显著修改声明；反过来只是
过度声明，无法律风险）。

**最后更新日期: 2026-09-11**

---

## 1. find-skills（内置技能，随包分发）

| 要素 | 内容 |
|------|------|
| **来源仓库** | https://github.com/vercel-labs/skills |
| **固定 commit SHA** | `773fb2c7bbf16781670a3520affc4abd0c6151ae`（`skills/find-skills/SKILL.md` 最后改动，2026-07-10） |
| **许可证** | MIT |
| **是否修改** | **是（modified）** —— Realm 化改写版 |
| **修改说明** | 逐项见下 |
| **许可证副本** | `skills-builtin/find-skills/LICENSE.txt`（随播种落至 `agent-workspace/managed-skills/find-skills/LICENSE.txt`） |

**修改说明（逐项）：**

1. **移除全部 CLI 与安装语义**：原版引导使用 `skills` CLI 检索与安装技能（含上游第 100 / 103 行
   逐字解释的全局位置旗标与跳过确认旗标），Realm 版把这些内容**整段删除**，正文里不存在任何
   可执行的安装路径。
2. **检索路径改为只读网络发现**：改为经 Realm 既有的 `web_fetch` 工具请求 GitHub 搜索 API 的
   结构化端点，`web_search` 仅作兜底；逐条核验仓库与许可证后才输出候选清单。
3. **正文与 `description` 改为中文**：面向 Realm 语境重写。
4. **新增「本技能的能力边界」显式禁令段**（置于正文最前）：只产出候选清单，绝不执行任何安装 /
   下载命令；安装一律由用户在 Realm 内完成。
5. **frontmatter 新增 `disable-model-invocation: true`**：使该技能的 `description` 不进入
   system prompt（SEED-04）。

---

## 2. skill-creator（内置技能，随包分发）

| 要素 | 内容 |
|------|------|
| **来源仓库** | https://github.com/anthropics/skills |
| **固定 commit SHA** | `b0cbd3df1533b396d281a6886d5132f623393a9c`（`skills/skill-creator/SKILL.md` 最后改动，2026-03-06） |
| **许可证** | Apache License 2.0 |
| **是否修改** | **是（modified）** |
| **修改说明** | 逐项见下（`SKILL.md` 的六处受控改动 + 一项连带结果 + 一项新增文件 + 一处误报消歧） |
| **许可证副本** | `skills-builtin/skill-creator/LICENSE.txt`（Apache-2.0 全文，11,357 字节，逐字保留未改写） |

**修改说明（逐项）：**

1. **`SKILL.md` 文首新增显著的修改声明**（Apache-2.0 第 4(b) 条的直接要求）：点名来源固定 SHA
   并列出全部改动类别。
2. **新增 `## Environment Preflight` 章节**（英文）：说明 Python 脚本是可选路径、先跑
   `node scripts/check_env.mjs --capability <name>` 拿能力清单、缺依赖时由用户在**自己的**
   Python 环境里安装（本技能不会自动安装）、可用 `REALM_SKILL_CREATOR_PYTHON` 指定解释器。
3. **删除三章**：`## Package and Present (only if \`present_files\` tool is available)`、
   `## Claude.ai-specific instructions`、`## Cowork-Specific Instructions`。理由：Realm 没有
   `present_files` 工具、也不是 Claude.ai / Cowork；保留会让模型尝试调用不存在的工具或读到
   平台专有指令。
4. **两章各加一句前置句**（英文）：`## Running and evaluating test cases` 与
   `## Description Optimization` 的开头各插入「这是可选评测路径，先跑环境预检，缺依赖告知用户、
   不要自动安装」。
5. **更新 `## Reference files` 文件清单**：使其反映实际随包的文件集（含 `scripts/check_env.mjs`），
   且不再引用已删除的三章。这是改动 2 / 改动 3 与新增文件 8 的**必然连带结果**，不是独立的语义偏离。
6. **frontmatter 新增 `disable-model-invocation: true`**（SEED-04）：上游 frontmatter 实测只有
   `name` + `description`，不加该字段则约 350 字符的英文 `description` 会无条件进入每次请求的
   system prompt。
7. **frontmatter 的 `description` 改写为中文**（D-04）：内置技能的 `description` 面向 `/` 面板与
   设置页的人眼可读性。**正文仍为上游英文原文** —— D-06 管正文语言、D-04 管 `description` 语言，
   两者不冲突。
8. **新增 `scripts/check_env.mjs`**：**该文件由 Realm 自研，以 MIT 许可证随 Realm Browser 分发**，
   不属于上游内容，因此**不适用本节对上游快照的第三方归属义务**（它不是 `anthropics/skills` 的一部分）。
   上游可选的 `scripts/__init__.py` 一并在内 —— 它不是新增，是上游文件。
9. **`agents/`（3 文件 / 26,712 字节）完整保留**：使「完整保留上游全部内容」成立，且
   `## Advanced: Blind comparison` 章对 `agents/*.md` 的三处引用不断链。
10. **其余正文逐字保留上游英文原文**（未做中文化、未重写章节、未增删段落）。
11. **`## Description Optimization` 第 4 步的一句消歧改写**：上游原文为
    `Take \`best_description\` from the JSON output and update the skill's SKILL.md frontmatter.`。
    其中 `update the skill's` 会被零安装语义扫描器的「安装技能的祈使句」模式
    （`\b(install|add|update)\s+(the\s+)?skill\b`）命中；该模式是 **P1 门禁**的必要组成，且第 1 段
    扫描面**按设计零容忍、不接受任何豁免**。因此把 `update the skill's SKILL.md frontmatter`
    改写为 `set it in the skill's SKILL.md frontmatter` —— **语义不变，仅消除误报**，使门禁得以
    保持零豁免而不必削弱模式表。

---

## 3. 易错事实说明（归属声明最容易被写错的三处）

1. **find-skills 的上游仓库根没有独立 LICENSE 文件。** 许可证仅由 `package.json` 的
   `"license": "MIT"` 声明，且该文件的 `author` 字段为空，没有可抄的版权行。因此随包的
   `LICENSE.txt` 是 Realm 补录的标准 MIT 全文，版权行记 `vercel-labs`。
2. **上游仓库根的 `ThirdPartyNoticeText.txt`（6,585 字节）不随包。** 经核实它是 Skills CLI 的
   第三方组件清单，与本技能的文本无关 —— 不是本技能的许可证，附上会造成误导。
3. **`anthropics/skills` 没有仓库级 LICENSE**：GitHub API 的 `license.spdx_id` 返回 `null`。
   这正是不应只信 API `license` 字段的实例 —— 真实许可证在技能目录内的
   `skills/skill-creator/LICENSE.txt`（Apache-2.0，11,357 字节），本记录以此为准。

---

## 4. 不由 Realm 分发的运行时依赖

skill-creator 的部分脚本需要 Python 包 `pyyaml`（`quick-validate` 能力）与 `anthropic`
（`description-optimize` 能力），上游还曾可选依赖外部 `claude` CLI。**这些依赖由用户环境提供，
不由 Realm 分发**，也不包含在本仓库或打包产物中，故**不适用本文件的归属义务**。

Realm 版的 capability 面已收缩为 4 组（`baseline` / `quick-validate` / `eval-viewer` /
`description-optimize`），依赖 `claude` CLI 的 `run-eval` / `run-loop` 两组已去掉。
`scripts/check_env.mjs` 会报告缺失的依赖并明确要求由用户在自己的环境里安装
（并逐字声明 `Do not auto-install dependencies from this skill.`）。

---

## 5. 升级上游版本时的检查清单

1. **换 SHA**：在 `skills-builtin/<skill>/` 对应的上游仓库里用
   `commits?path=<文件>&per_page=1` 取到目标文件最后改动所属的 commit，替换本文件与
   `skills-builtin/skill-creator/SKILL.md` 文首声明里的固定 SHA。
2. **重跑字节核对表**：按新的上游版本重新下载全部文件，逐文件 `wc -c` 与
   `tests/test-builtin-skills-seeder.js` 里 `UPSTREAM_SKILL_CREATOR_FILES` 的表核对并同步表值。
3. **重跑 `node tests/test-builtin-skills-seeder.js` 的 P10 断言组**。
4. **更新上面的「最后更新日期」**。

> **这四步不只是文档承诺 —— 有机械兜底。** P10 断言组会逐字匹配本文件里的两个固定 SHA
> （改了文件却没同步文档、或改了文档却没同步文件集，断言都会红）、断言文档里不出现把已修改
> 说成未修改的措辞、断言五要素关键词齐备、并把两个 `LICENSE.txt` 随播种逐字节比对落盘内容。
> 也就是说，升级流程中任何「只改一半」都会在测试里显形。
