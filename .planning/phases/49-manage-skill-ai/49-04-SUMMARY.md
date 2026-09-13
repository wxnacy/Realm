---
phase: 49-manage-skill-ai
plan: 04
subsystem: ai-integration
tags: [skills, yaml, frontmatter, manage_skill, byte-gate, sanitize, prompt-inclusion]

# Dependency graph
requires:
  - phase: 49-manage-skill-ai
    provides: 49-01 的三校验器 / 净化单点 / 扫描单点 / 原子写 / 三动作 / 九码闭合白名单（本计划只改「什么内容能过闸」与「过闸后写出的字节形态」）
  - phase: 46-skill-infra
    provides: createSkillsEnv 的加载期读盘闸（FileInfo.size > maxSkillMdBytes → realm_skill_md_too_large）与 refreshSkills 快照语义
provides:
  - ai-skills-manager.js 内部 yamlScalar（YAML 单引号标量编码；不导出、零新依赖）
  - buildSkillFileText 的 description 行改经 YAML 单引号标量编码（撇号双写 + 换行归一化）
  - create / update 固定「原文结构校验 → 扫描原文 → 净化 → 净化值复验非空 → … → 组装全文字节闸 → 写」
  - ai-skills-manager.js 内部 validateSkillFileSize（写侧权威字节闸，create / update 共用）
  - getSkillPromptIncluded 三态（true / false / undefined）
  - tests/test-manage-skill.js 55 例（原 41 例全保留 + 14 例新增/改写）
  - docs/product/ai-skills.md §四 / §11.3 / §11.5 口径纠正
affects: [49-05, 50, 51]

actuals:
  tokens: 14894
  tasks: 3
  commits: 3
plan_head_before: de2434e34d6b641a10eb4e46cad6381fa82573b0

tech-stack:
  added: []
  patterns:
    - "YAML 单引号标量编码自持（不 import yaml 包）：撇号双写 + 换行归一化，反斜杠不被误解释"
    - "权威闸口按落盘产物计字节，并返回被计量的产物本身 ⇒ 「测的字节」与「写的字节」在对象层面同一份"
    - "预筛 ⊂ 权威闸口：content 单独计字节降级为严格子集预筛（只能更早拒）"
    - "缩减型变形的调用方必须对变形后的值复验（净化后复验非空）"
    - "三态返回值区分「命中但被滤」与「未命中」，杜绝消费方把「不存在」冒充成「预算已满」"

key-files:
  created: []
  modified:
    - ai-skills-manager.js
    - tests/test-manage-skill.js
    - docs/product/ai-skills.md

key-decisions:
  - "结论先行：Gap 1 的三条独立成因（CR-02 description 未转义、CR-03 净化前校验且不复验、WR-01 写侧只按 content 计字节）全部闭合，且三条失败路径都不留磁盘残留"
  - "description 用**单引号**标量而非双引号：YAML 单引号标量不做转义处理（唯一变形是撇号双写），不会把描述里的 Windows 反斜杠误当转义序列；双引号需要自己实现整套反斜杠 / 控制字符转义表"
  - "绝不 import `yaml` 包（含动态 import）：它是 SDK 传递依赖，编码函数自持住本模块内部，保住零 electron 依赖纪律（Phase 50/51 要 require 同一份）"
  - "CR-03 的修法是「净化后对净化值再验一次非空」而不是把 validateManagedSkillDescription 整体挪到净化之后 —— 后者会把「先扫描原文」这条 D-09 顺序铁律挤掉（净化后再扫描等于扫净化值，零宽字符包裹的注入语会重新放行）"
  - "WR-01 的修法是对**组装后的全文**测一次字节作为权威闸口；validateManagedSkillContent 的 content 计字节保留为提前预筛（严格子集：组装全文 = content + frontmatter，frontmatter 长度恒为正 ⇒ 只可能更早拒）"
  - "闸口成功时返回被计量的 text，调用方直接写它 —— 在对象层面消灭「测的和写的不是同一份」的漂移面"
  - "getSkillPromptIncluded 改三态：未命中返回 undefined（原先与「命中但超预算」共享 false，会让工具把「技能不存在」误报成「预算已满」并追加一句解析不到的 /skill:{name} 提示）"
  - "name 不编码的前提写进代码注释：validateManagedSkillName 已把字符集收窄为 [a-z0-9-] 且只被写入侧调用；放宽字符集时这条「不编码」立刻变成 CR-02 的同款缺口"
  - "三处过度声称的「两侧同源同值」一并纠正（LIMITS 注释 / validateManagedSkillContent JSDoc / docs §11.3），并顺手纠正 docs §四限额表的同类措辞 —— 改闸口而不改声明会留下与新实现不符的断言，被 50/51 照抄"
  - "本计划不动 resolveManagedTarget / seeded 判定 / 数量闸 / 原子写 / 三动作签名与拒绝码；九码闭合白名单不增不减（description 净化后为空仍归 invalid_description，未新立第十码）"
  - "所有验证命令写成 `node tests/<file>.js` 的显式形式，不引用 package.json 里不存在的 `npm test`"

patterns-established:
  - "「写侧即加载侧」做成可失败被观察的代码事实：权威闸口与加载期闸口径同量（组装后 SKILL.md 全文 UTF-8 字节），边界由「恰限额放行 / 多 1 字节拒绝 / 读侧同阈值对照」三行机械证明"
  - "反向验证作为断言非假绿的证据：临时改回旧实现，记录哪几条断言转红，再恢复（结论见下）"

requirements-completed: [MGMT-01, MGMT-02, MGMT-03]

coverage:
  - id: D1
    description: "description 含 ': ' / '#' / 裸 YAML 标量形态时，写入的技能仍能被加载管线收进技能集且 description 逐字等于净化值（CR-02 闭合）"
    requirement: MGMT-03
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js#description 值域：落盘 ⇒ 可加载（CR-02 / CR-03 的靶心）"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js#蕴含关系（Gap 1 的真值面）：写侧未抛错 ⇒ 加载后技能集含该 name 且该条目无诊断"
        status: pass
    human_judgment: false
  - id: D2
    description: "description 仅由零宽字符组成（U+200B）时 create / update 被拒为 invalid_description，磁盘逐字不变（CR-03 闭合）"
    requirement: MGMT-03
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js#CR-03：description 仅由零宽字符组成（U+200B）→ invalid_description，且磁盘逐字不变（不落盘）"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js#CR-03：update 路径同样复验净化后非空（目标文件逐字不变）"
        status: pass
    human_judgment: false
  - id: D3
    description: "写侧权威字节闸与加载期闸口判同一个量（组装后 SKILL.md 全文 UTF-8 字节）：恰限额放行、多 1 字节拒绝且不落盘、update 路径同阈值同语义（WR-01 闭合）"
    requirement: MGMT-02
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js#WR-01 靶心：content 单独预筛放行、组装全文超限 → oversize 且不落盘；同 content 配短描述成功（对照组）"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js#写↔读闸口边界：组装全文恰等于限额放行、恰多 1 字节拒绝（同一 LIMITS.MAX_SKILL_MD_BYTES）"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js#update 路径同样经过权威闸口：超限拒且目标文件逐字不变（与 create 同阈值 / 同拒绝码）"
        status: pass
    human_judgment: false
  - id: D4
    description: "getSkillPromptIncluded 三态：命中可用 true / 命中被滤 false / 未命中 undefined"
    requirement: MGMT-01
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js#三态 + disabled / promptOmitted：命中可用 → true；命中被滤 → false；**未命中 → undefined**"
        status: pass
      - kind: automated_other
        ref: "node -e '<三态源码断言：getSkillPromptIncluded 段内须有 return undefined 且不得有 if (!entry) return false>' → three-state ok"
        status: pass
    human_judgment: false
  - id: D5
    description: "既有 41 例继续全绿；LIMITS 数值、九码值域、导出面、原子写与 seeded 判定路径未被本计划扰动"
    requirement: MGMT-04
    verification:
      - kind: unit
        ref: "node tests/test-manage-skill.js（55 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node --test test/memory/threat-scan.test.js（33 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node tests/test-ai-skills.js（172 pass / 0 fail）"
        status: pass
      - kind: unit
        ref: "node --test tests/test-skill-picker-model.js（99 pass / 0 fail）"
        status: pass
      - kind: automated_other
        ref: "node -e '<九码源码断言>' → error-codes intact 10"
        status: pass
      - kind: unit
        ref: "node tests/test-manage-skill.js#九码闭合白名单的不变式（本计划不增不减不改名）"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-13
status: complete
---

# Phase 49 Plan 04: manage_skill 幽灵技能 gap 闭合 Summary

**description 改经 YAML 单引号标量编码、净化后复验非空、写侧权威字节闸改按组装全文计字节 —— 「写侧允许落盘的技能必然能被加载管线收下」从一句声明变成三条可失败被观察的代码事实（`tools` 55/55、扫描层 33/33、兄弟套件 172/99 全绿，反向验证逐条指名转红的断言）**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-13T10:01:53Z
- **Completed:** 2026-09-13T10:07:52Z
- **Tasks:** 3/3
- **Files modified:** 3（`ai-skills-manager.js` / `tests/test-manage-skill.js` / `docs/product/ai-skills.md`）
- **Diff:** +749 / −45（`ai-skills-manager.js` +216、`tests/test-manage-skill.js` +570、`docs/product/ai-skills.md` +8）

## Accomplishments

- **CR-02 闭合**：新增内部 `yamlScalar(text)`（单引号标量 + 撇号双写 + `\r\n`/`\r`/`\n`/U+2028/U+2029 → 单空格），`buildSkillFileText` 的 description 行改用它。含 `": "`、含 `#`、裸 `true` 三类输入不再产出幽灵技能；含撇号与换行的描述可被 YAML 无损还原。**未引入任何新依赖**（明确未 import `yaml`），编码函数不导出，导出面保持 49-01/02 的形状。
- **CR-03 闭合**：`create` / `update` 的步骤顺序固定为「原文结构校验 → 扫描**原文** → 净化 → **净化值复验非空**」。`"\u200B"` 从「校验通过」翻转为 `invalid_description`，两个动作路径都不落盘 / 目标文件逐字不变。D-09 的「先扫描后净化」一字未动。
- **WR-01 闭合**：新增内部 `validateSkillFileSize({name, description, content})` —— 对 `buildSkillFileText` 的**产物**测 UTF-8 字节，与加载期 `FileInfo.size` 判同一个量；`create` / `update` 共用同一份实现，成功时返回被计量的 `text` 供调用方直接写盘（测的字节与写的字节同一份）。位点分别是「数量闸后、createDir 前」与「目标判定后、rename 前」⇒ 拒绝即零残留。`validateManagedSkillContent` 降级为严格子集预筛并在 JSDoc 中声明。
- **三态化**：`getSkillPromptIncluded` 未命中返回 `undefined`，使消费方（49-05）无法把「技能不存在」冒充成「预算已满」，也无法再给出解析不到的 `/skill:{name}` 提示。
- **口径纠正**：`LIMITS.MAX_SKILL_MD_BYTES` 注释、`validateManagedSkillContent` 的 JSDoc、`docs/product/ai-skills.md` §11.3 的 `oversize` 行（以及 §四限额表与 §11.5 净化章节）全部改为「组装全文」口径，删去被 WR-01 实测证伪的「同源同值」声明。
- **测试从 41 → 55 例**：既有 41 例**一条未被放宽或删除**；新增 14 例分别为 description 值域 6 例、写↔读闸口边界 3 例、蕴含关系整块 1 例、九码不变 2 例、`buildSkillFileText` 逐字断言 + 无 yaml 依赖 2 例。并发护栏由「源码子串扫描」升级为「构造真实工具项断言 executionMode / 无 path / 键集合」。

## Task Commits

Each task was committed atomically:

1. **Task 1（tracer）: description → 落盘 → 加载管线收得下（YAML 标量编码 + 净化后复验）** - `04d257d` (feat)
2. **Task 2: 字节闸改按组装全文（WR-01）+ getSkillPromptIncluded 三态 + 三处过度声称纠正** - `ed6c038` (feat)
3. **Task 3: 复核与加固 —— 旧断言一致性、九码不变、无残留缺口** - `9e7c9e8` (test)

**Plan metadata:** `docs(49-04): complete 49-04 plan`（最终元数据提交，含 SUMMARY / STATE / ROADMAP / REQUIREMENTS）

## Files Created/Modified

- `ai-skills-manager.js` — 新增 `yamlScalar` / `validateSkillFileSize`（均内部不导出）；`buildSkillFileText` 改经标量编码；`createManagedSkill` / `updateManagedSkill` 步骤顺序 + 净化后复验 + 权威字节闸；`getSkillPromptIncluded` 三态；`LIMITS` / `validateManagedSkillContent` / `sanitizeSkillDescription` 的注释与 JSDoc 口径改写
- `tests/test-manage-skill.js` — 41 → 55 例；`buildSkillFileText` 逐字断言改单引号形态；新增 description 值域组、WR-01 靶心行、写↔读闸口边界行、update 闸口行、蕴含关系整块行、九码不变行、无 yaml 依赖行；并发护栏升级为语义断言
- `docs/product/ai-skills.md` — §四限额表 `MAX_SKILL_MD_BYTES` 行、§11.3 `oversize` 行改为组装全文口径；§11.5 补「净化后复验非空」与 YAML 单引号标量编码事实

## Verification（每条 `<verify>` 与自动化门禁的实跑输出）

| # | 命令 / 检查 | 实际输出 | 归属 |
|---|---|---|---|
| 1 | `node tests/test-manage-skill.js`（Task 1 时点） | `# tests 49 / # pass 49 / # fail 0` | Task 1 |
| 2 | `node -e '<YAML 编码接线源码断言>'` | `yaml-encoding wired`（非零退出三条件均未触发） | Task 1 |
| 3 | `node tests/test-manage-skill.js`（Task 2 时点） | `# tests 52 / # pass 52 / # fail 0` | Task 2 |
| 4 | `node -e '<三态源码断言>'` | `three-state ok` | Task 2 |
| 5 | `node -e '<docs §11.3 oversize 行断言>'` | `doc ok` | Task 2 |
| 6 | `node tests/test-manage-skill.js`（Task 3 收尾） | `# tests 55 / # suites 12 / # pass 55 / # fail 0` | Task 3 |
| 7 | `node --test test/memory/threat-scan.test.js` | `# tests 33 / # pass 33 / # fail 0` | Task 3 |
| 8 | `node -e '<九码源码断言>'` | `error-codes intact 10` | Task 3 |
| 9 | `node tests/test-ai-skills.js`（兄弟套件回归） | `# tests 172 / # pass 172 / # fail 0` | Task 3 |
| 10 | `node --test tests/test-skill-picker-model.js`（兄弟套件回归） | `# tests 99 / # pass 99 / # fail 0` | Task 3 |

`<fails_when>` 逐条核对：无 `# fail > 0`；`# tests` 由 41 → 49 → 52 → 55（每阶段严格增长）；输出中**未出现** `parse_failed` / `description is required` / `realm_skill_md_too_large` 作为「落盘成功却被拒收」的证据（`realm_skill_md_too_large` 只在**手工造超限文件的读侧对照**里出现，且断言技能集不含它）。

### 反向验证（Task 3 步骤 5/6：断言不是假绿的证据）

把实现临时改回旧写法，跑 `node tests/test-manage-skill.js`，记录转红的叶子断言，随后恢复（`git diff` 为空 = 逐字还原，恢复后 55/55 全绿）：

| 变异 | 转红的叶子断言 | 例数 |
|---|---|---|
| **A. `buildSkillFileText` 改回 `description: ${description}` 直接插值** | ① `createManagedSkill 落盘 managed-skills/<name>/SKILL.md（单层 frontmatter + 正文）`（单引号断言）② `buildSkillFileText：frontmatter 恰两行；description 走单引号标量…`（逐字断言）③ `CR-02：description 含 ": "…` ④ `CR-02：description 含 "#"…` ⑤ `CR-02：description 为裸 "true"…` ⑥ `蕴含关系…整块断言` | 6 fail |
| **B. 净化后复验改为对原文复验（≡ 删掉这一步，2 处）** | ① `CR-03：description 仅由零宽字符组成（U+200B）…` ② `CR-03：update 路径同样复验净化后非空…` ③ `description 净化后为空仍归 invalid_description（不新立第十码）` | 3 fail |
| **C. 权威闸口改回只测 content 字节（pre-WR-01 语义）** | ① `WR-01 靶心：content 单独预筛放行、组装全文超限…` ② `写↔读闸口边界：恰等于限额放行、恰多 1 字节拒绝…` ③ `update 路径同样经过权威闸口…` | 3 fail |
| **D. `getSkillPromptIncluded` 未命中返回 `false`（旧二态）** | ① `三态 + disabled / promptOmitted：命中可用 → true；命中被滤 → false；**未命中 → undefined**` | 1 fail |

变异 C/D 是计划要求之外的自加证据，用来同时证明 Task 2 的字节闸行与三态行同样能失败。四条「改回旧写法必转红」的输入因此都可指名。

## Decisions Made

- **结论先行（与 key-decisions 同源，逐条列出）**：单引号标量而非双引号；绝不 import `yaml`；CR-03 只加「净化值复验」而不移动校验器（保住 D-09）；WR-01 用「组装全文测一次」而不估算 frontmatter 开销；闸口返回被计量的 `text` 交给写盘；`name` 不编码的前提写进注释；三处（加 §四一处）过度声称一并纠正；不触碰 `resolveManagedTarget` / seeded / 数量闸 / 原子写 / 动作签名 / 九码值域；验证命令一律写成 `node tests/<file>.js`。
- 详细理由见 frontmatter `key-decisions`（12 条）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `docs/product/ai-skills.md` §四限额表把 `MAX_SKILL_MD_BYTES` 的单位写成「`FileInfo.size` / 正文字节上限」**
- **Found during:** Task 2（口径纠正动作 10 的邻接面）
- **Issue:** 计划只点名 §11.3 的 `oversize` 行，但 §四那张限额表同样声称是「**正文**字节上限（`FileInfo.size`）」—— 与 WR-01 实测（加载期按整文件计）矛盾，属被证伪声明的第四个落点。只改计划点名的三处会留下一条自相矛盾的文档。
- **Fix:** 改为「单个 `SKILL.md` **整文件**（frontmatter + 空行 + 正文）的字节上限。写入侧的**权威闸口**与加载期判的是**同一个量**」。
- **Files modified:** `docs/product/ai-skills.md`
- **Verification:** `node -e '<§11.3 oversize 行断言>'` → `doc ok`；§四表格行由人工核对（同一 `LIMITS` 常量、同一「整文件」措辞）
- **Committed in:** `ed6c038`（Task 2 提交的一部分）

**2. [Rule 1 - Bug] 既有断言钉住旧行为，不修就必然转红**
- **Found during:** Task 1（`buildSkillFileText` 改经标量编码后）
- **Issue:** 两处既有断言按旧的无引号拼接写死了期望值：`create 脊椎` 里的 `text.includes('description: 用于测试的技能')` 与 `buildSkillFileText` 的逐字断言。不更新会让既有 41 例中的两条转红 —— 而它们断言的对象（组装产物形态）正是本任务要改的。
- **Fix:** 两处都改为断言**新语义**（单引号标量形态），并在消息文本里写明「改回旧写法必然转红」（该行因此从「记录现状」升级为「守门断言」，Task 3 的反向验证 A 实测其转红）。
- **Files modified:** `tests/test-manage-skill.js`
- **Verification:** 变异 A → 这两条断言实测转红（见反向验证表）
- **Committed in:** `04d257d`（Task 1 提交的一部分）

**3. [Rule 2 - Missing Critical] 并发护栏只断言源码子串，无法失败**
- **Found during:** Task 3（弱断言升级动作 2 的横向排查）
- **Issue:** `src.includes("executionMode: 'sequential'")` 是「子串存在」式断言 —— 声明被注释掉或挪到别处、甚至只出现在注释里，该断言都仍会通过（正是本 phase 已证实的假绿形态）。
- **Fix:** 改为 `tool.prototype._buildManageSkillTool.call({})` 构造**真实工具项**，再断言 `executionMode === 'sequential'`、`parameters.properties` 键集合恰为 `{action, content, description, name}`、schema 内**不出现** `"path"`。三条任一被破坏即转红。
- **Files modified:** `tests/test-manage-skill.js`
- **Verification:** 实跑通过（工具项实测 `executionMode: sequential` / 键集合 `action,content,description,name` / `has path: false`）
- **Committed in:** `9e7c9e8`（Task 3 提交的一部分）

**4. [Rule 2 - Missing Critical] `getSkillPromptIncluded` 的 `shadowed` 分支不可达，但没有如实标注**
- **Found during:** Task 3（弱断言升级的同一轮排查）
- **Issue:** 计划 `<behavior>` 列了「命中但 `shadowed` → `false`」，但该函数的查找面 `skills.find(...)` 在 46-03 的确定性全序下**恒命中胜出者**（既有断言正是钉住这一点的）。为一个到不了的分支写「用例」等于制造下一轮假绿。
- **Fix:** 不编造用例；改为用注释如实标注「该分支在当前定序下不可从本查找面到达」，并直接断言败者条目确实带 `shadowed` 标记（即该判据的**输入面**成立）。
- **Files modified:** `tests/test-manage-skill.js`
- **Verification:** 实跑通过；`getSkillPromptIncluded('dup') === true` 与 `entries.filter(e => e.shadowed === true).length === 1` 同时成立
- **Committed in:** `9e7c9e8`（Task 3 提交的一部分）

---

**Total deviations:** 4 auto-fixed（3 × Rule 1/2 的「断言与文档一致性」类、1 × Rule 2 的「弱断言」。无 Rule 3、无 Rule 4——本计划未新增依赖、未触碰架构决策面）
**Impact on plan:** 全部落在本计划已声明的三个文件内，无范围蔓延。第 1 条修掉了被证伪声明的第四个落点；第 2 条是改动本身的必然连带（否则既有例会转红）；第 3/4 条把「假绿」这一本 phase 的元问题在测试层又收掉两处。**未改动** `resolveManagedTarget` / seeded 判定 / 数量闸 / 原子写 / 三动作签名与拒绝码 / `LIMITS` 任何数值 / `MANAGE_SKILL_ERROR` 值域 / 导出面。

## Issues Encountered

- **反向验证 B 的变异脚本一度误伤注释**：`validateManagedSkillDescription(safeDescription)` 在文件里有 3 处匹配 —— 两处在代码里、一处在 `sanitizeSkillDescription` 的 JSDoc 里。首版按裸串替换时命中数校验（期望 2）失败并**在写盘前中止**（文件未被污染）；改为按带 `const safeDescCheck = ` 前缀的整行替换后命中恰 2 处。记此一笔是为了说明「突变测试的锚点必须唯一」这条纪律在本文件上确实需要小心。
- **`state advance-plan` 的计数器滞后（既有环境问题，非本计划引入）**：handler 把 Current Position 写成 `Plan: 2 of 6`，而 49-01..49-04 四份 SUMMARY 已落盘（ROADMAP 的 `summary_count` = 4）。执行期手工订正为 `5 of 6` 并在该行注明权威计数来源。同一 handler 写出的 frontmatter `progress.completed_plans: 22 / total_plans: 24` 本身是**正确**的；`percent: 0%` 是「按阶段」口径（阶段 49 尚未 complete）而非本次缺陷。
- 其余无。任务全程未走认证门禁，未遇到阻塞。

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — 本次改动的三个文件内不存在「硬编码空值流向 UI / 占位文案 / 未接线的数据源」。`grep -nE "TODO|FIXME|coming soon|not available|placeholder"` 对三个文件返回空。

另外确认：`docs/product/ai-skills.md` §11.3 的九码表**没有**新立第十码，`description` 净化后为空仍归 `invalid_description`；`validateSkillFileSize` 与 `yamlScalar` 都是**内部函数、未加入 `module.exports`**（导出面相对 49-01/02 零变化）。

## Threat Flags

None — 本计划未引入计划 `<threat_model>` 之外的新安全相关面：未新增网络端点 / 认证路径 / 文件访问模式（`managedSkillPaths` 仍只用 `path.join`，工具层仍不吃 `path`）/ schema 变更；新增的 `oversize` 原因文案沿用 49-01 的口径（只回显限额与当前值，不回显被拒内容原文），未扩大回显面。T-49-04-01/02/03/04 四条 `mitigate` 全部落到实现与断言上。

## Deferred Items（记录、不在本计划处置）

1. **`AGENTS.md` 的技能测试清单仍是「41 例」**：现为 55 例，计数已过期。AGENTS.md 在本工作树里带有**与本计划无关**的未提交改动（调试文档索引条目），执行期按仓库卫生约束**未触碰该文件**，故未顺手更新。建议由 49-05 或收尾时一并订正（属文档计数，不是行为契约面）。
2. **CR-01（renderer 终态标记覆盖）/ WR-02 / WR-03 / WR-04 / IN-01–IN-06** 归 49-05 / 50 处理，本计划未触碰 —— 详见 `49-REVIEW.md`。本计划**不声称**闭合它们。
3. **`49-VALIDATION.md` 的人工五步**：其中步骤①（卡片终态视觉面）在 CR-01 修复前必然失败，应在 49-05 落地后执行；步骤②（下一条消息可见）不受本计划影响。

## Next Phase Readiness

- `ai-skills-manager.js` 现在满足 Gap 1 的三条闭合要求，且三条失败路径都有「改回旧写法必转红」的断言钉住 —— 49-05 可直接消费 `getSkillPromptIncluded` 的**三态**（只在 `=== false` 时追加「预算已满」文案、只在 boolean 时写 `details.promptIncluded`）。
- Phase 50/51 可 `require` 同一份校验器 / 闸口（`ai-skills-manager.js` 仍零 electron 依赖、零新增依赖）；`validateSkillFileSize` 与 `yamlScalar` 是内部函数，若 50/51 需要按全文计字节，应经 `buildSkillFileText` + 既有导出面复用而不是新写第二份判据。
- **仍需在 49-05 之前完成**：`src/renderer.js:9377` 的并入修复（CR-01）—— 本计划按 `49-VERIFICATION.md` 的修复次序建议把 CR-01 留给 49-05，故卡片终态视觉面的人工验证应在其后执行。

---
*Phase: 49-manage-skill-ai*
*Completed: 2026-09-13*

## Self-Check: PASSED

**1. Created / modified files exist:**
```
FOUND: ai-skills-manager.js
FOUND: tests/test-manage-skill.js
FOUND: docs/product/ai-skills.md
FOUND: .planning/phases/49-manage-skill-ai/49-04-SUMMARY.md
```

**2. Commits exist:**
```
FOUND: 04d257d
FOUND: ed6c038
FOUND: 9e7c9e8
```

**3. Declared symbols present, and internal-only:**
```
symbols present and NOT exported   （yamlScalar / validateSkillFileSize 均在模块内、未进 module.exports）
```

**4. `commits:` 为实测值**（来源：`$(git rev-parse --git-dir)/gsd-plan-head-before-49-04` = `de2434e34d6b641a10eb4e46cad6381fa82573b0`）：
```
git rev-list --count de2434e3..HEAD  →  3
```

