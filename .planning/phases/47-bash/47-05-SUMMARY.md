---
phase: 47-bash
plan: 5
subsystem: bash-policy
status: complete
tags: [gap-closure, cr-01, sec-01, doc-02, default-deny, shell-quoting-normalization, readonly-allowlist, deep-layer-priority, flag-tolerance, wr-01, pipx-blocker1]

# 本计划**已全部完成**（3/3 任务）。
#
# 执行事故与接管（如实记录，见「Deviations from Plan」D-47-05-x）：
# 派发的 gsd-executor 子代理在 429 配额限制下**未提交任何内容**即死亡，
# 但已在工作区留下 Task 1 的主体改动（ai-bash-policy.js 重写 + Task 1 测试组，
# 未提交、无 SUMMARY）。按既往约定，主会话确认子代理已死（无提交、无 SUMMARY）
# 后内联接管：补完 Task 1 尾项 → 提交 → 实施 Task 2 / Task 3 → 提交。
# 三个任务各自原子提交，全部判据由主会话实跑复算。

# Dependency graph
requires:
  - phase: 47-bash
    plan: 2
    provides: PACKAGE_MANAGER_INSTALL_PATTERNS（13 族）+ reason 'install' + install 短路先于白名单 + D-13/D-14/D-15/D-16 四条锁定决策
  - phase: 47-bash
    plan: 4
    provides: 三份文档的既有措辞（本计划在其上逐句改写为默认拒绝语义）
provides:
  - ai-bash-policy.js 的 stripShellQuoting（替换 stripLeadingQuotes，只在 matchInstall 内使用）
  - ai-bash-policy.js 的 PACKAGE_MANAGER_TOOLS（15 工具集，含 bunx / pipx）与派生的 PACKAGE_MANAGER_TOOL_MAP（只读正则集）
  - 重写后的 matchInstall：纵深优先 → 默认拒绝 + 显式只读降级
  - 只读豁免的三条承重墙 + 纵深层不遮蔽自身只读清单（pipx 条目动词限定）
  - matchesWhitelist 的空前缀护栏（WR-01，设计性契约变更）+ validateWhitelistList 的 * 拒绝分支
  - tests/test-ai-bash-policy.js 的 GAP 1 四组（词法改写绕过 / 默认拒绝语义 / 承重墙 / 源码不变量）、绕过面收敛组、WR-01 组；97 例基线（改前 70 例）
  - 三处反向验证的实测记录（pipx 裸条目 / WR-01 护栏 / npm 工具条目）
  - docs/product/ai-agent-workspace.md §四/§五/§七/§八、docs/product/ai-skills.md §八/§九、AGENTS.md 的同步改写（逐句为真）
affects: [48, 49, 50, 51, ship]

# Actuals (#2632) —— 与 plan estimate（62000 tokens / 3 tasks）同尺度（chars/4 over realized diff）
actuals:
  tokens: 24462
  tasks: 3
  commits: 3
  plan_head_before: 0bbb6c43c828116e848edce33cb0f4c9a54ea73d

tech-stack:
  added: []          # 零新增依赖（纯函数引擎，无新 import）
  patterns:
    - "默认拒绝而非黑名单：安全性不再依赖子命令枚举的完整性 —— 未收录即强制确认（fail-safe），漏报代价是多一次卡片，漏放代价是零卡片"
    - "纵深优先（顺序即语义）：只读豁免必须先跑既有安装模式表，才能避免 FLAG_TOLERANCE 的取值槽把真实安装动词吞成「旗标取值」"
    - "形态化只读词条：只在部分形态下只读的词条（npm init <initializer> / audit fix）用带守卫正则实现，词条仍留在 readOnly 作为文档与表驱动断言的单一来源"
    - "结构性判据优先于行为判据：空 readOnly 工具不得生成动词式正则这件事，靠 readOnlyRes.length === 0 与「无空捕获组」的真判据钉住（行为断言在纵深优先下会被掩盖，只能作防退化证据）"
    - "反向验证作为「断言非空转」的证明手段：每处新护栏都临时移除后确认对应用例变红、还原后转绿"

key-files:
  created: []
  modified:
    - ai-bash-policy.js
    - tests/test-ai-bash-policy.js
    - docs/product/ai-agent-workspace.md
    - docs/product/ai-skills.md
    - AGENTS.md

key-decisions:
  - "D-47-05-a：安装档主判定取「首 token 默认拒绝 + 显式只读清单」而非继续枚举安装动词。理由：白名单是文本前缀匹配、黑名单式子命令匹配必然可被同前缀的中间 token / 词法改写击穿（GAP 1 的成因）；默认拒绝把漏检面收敛到「首 token 不是包管理器」这一条天然不命中白名单前缀的边界，D-14 的「install 短路先于白名单」才真正成立"
  - "D-47-05-b：词法归一化只落在 matchInstall 内（stripShellQuoting），不提到 normalizeSegment / matchesWhitelist / matchDangerous 层。理由：后三者的口径由既有 32 例断言锁定；把归一化提到共用层会同时移动白名单与危险判定的匹配语义，超出 GAP 1 的必要范围"
  - "D-47-05-c：pipx 的纵深条目必须**动词限定 + 旗标容忍**（不得裸 \\bpipx\\b）。理由：纵深优先意味着裸条目会先命中任何含 pipx 的段，使非空只读清单 ['list'] 整个不可达（pipx list 变成安装档）；删除 readOnly 的 list 也可让断言变绿，但那会把一条满足准入判据的只读命令标成「将从网络下载并运行第三方代码」，制造新的事实错误标注。修法选「动词限定」以保住语义真实性（checker blocker 1）"
  - "D-47-05-d：npm 补入同族生命周期别名 start / stop / restart / run-script；pnpm / yarn / bun 的同类别名**不收录**。理由：前者跑的是项目自身定义的脚本（与 run / test 同族），漏补会对其做事实错误标注；后者的别名语义未逐一核验，按「存疑一律不收」处理 —— 由此产生的保守误报（pnpm start 族落强制确认、卡片文案不准确）作为**具名残余**同时写进 JSDoc、SUMMARY 与两份用户文档，不静默扩散"
  - "D-47-05-e：WR-01 的 `*` 条目在匹配层与校验层**双向关闭**，不改 src/settings-page.js。理由：设置页的 tag 校验是重复的本地实现，权威校验在 /api/settings/update → validateWhitelistList；即便用户手输 `*` 并绕过前端，服务端会拒绝，matchesWhitelist 的 continue 是最后一道防御"
  - "D-47-05-f：Task 2 的门禁表判据**不以预设用例总数为门槛**（计划已移除 `# tests >= 90` 一类判据）。理由：用例分组粒度由实施者定，写死总数会误伤更粗粒度的写法；「非空转」改由三处反向验证证明，强度更高"
  - "Task 3 的文档改写判据是「每一句都为真」而非「改了几处文字」：逐句对照 ai-bash-policy.js 的**实际行为**（而非计划文本）核验，GAP 1 的第二半正是文档在提供虚假安全保证"

requirements-completed: [SEC-01, DOC-02]
# SEC-01（安装档不可被白名单免确认）与 DOC-02（文档与行为一致）**均已闭合**：
# 验证报告 BLOCKER 节的 12 行绕过形态 + 1 行对照逐行断言通过（全 confirm/install）；
# 三份文档中「白名单不可越过安装档 / 漏检 ≠ 免确认」两处表述均改为**带前提**为真。
# WR-01 为 REVIEW 列出的 Warning（非 gaps 列表要求），因与本计划的安装档白名单不变式
# 同源而一并关闭。

coverage:
  - id: D1
    description: "`brew \"install\" wget` 这类 shell 等价形态不再落到 allow 零卡片：引号 / 反斜杠 / 引号拼接三类词法噪音在判定前被抹平，8 条改写形态 + 6 条第二绕过家族在文档推荐白名单下全部 confirm/install"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#GAP 1 词法改写绕过（SEC-01 / CR-01）4 例 + #GAP 1 绕过面收敛（SEC-01 门禁复算）4 例"
        status: pass
      - kind: unit
        ref: "`/bin/sh -c 'set -- brew \"install\" wget; printf \"%s \" \"$@\"'` 与字面形态的 argv 逐字相同（用例内 spawnSync 实跑）"
        status: pass
    human_judgment: false
  - id: D2
    description: "安装档判定为「首 token 默认拒绝」：首 token 命中 15 项工具集且子命令不在该工具显式只读清单内即强制确认；只读清单表驱动断言全绿（同时证明纵深层未遮蔽只读清单）"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#GAP 1 默认拒绝语义（SEC-01）6 例（含 15 项工具集完整性、pipx 双侧、readOnlyRes 结构断言、清单一致性）"
        status: pass
      - kind: unit
        ref: "主会话独立复算 49 条 must_haves.truths 靶心断言 → ALL PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "只读豁免的三条承重墙 + 纵深层不遮蔽自身只读清单：空 readOnly 工具不生成动词式正则（npx/bunx/uvx 的 readOnlyRes.length === 0、全表无空捕获组）；纵深优先把 `npm -g install list` / `brew --quiet install info` 三条真实安装命令收回安装档；init/audit 形态化；pipx list 只读可达而 pipx install black 属安装档"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#只读豁免的承重墙（空清单 / 纵深优先 / 形态化 / 别名）5 例 + #GAP 1 源码不变量 4 例"
        status: pass
      - kind: unit
        ref: "反向验证：pipx 纵深条目改回裸 /\\bpipx\\b/ → GAP 1 默认拒绝语义 + P1 门禁信号共 3 例变红；还原 → 97/97 转绿"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-01：`['*']` 这条「一个字符作废整份白名单」的退化入口在服务端校验与匹配层被双向关闭；合法通配条目（`npm run *`）与裸条目行为不变"
    requirement: "SEC-01"
    verification:
      - kind: unit
        ref: "tests/test-ai-bash-policy.js#WR-01 白名单通配条目护栏 3 例（含源码断言：两个通配分支各一道空前缀 continue）"
        status: pass
      - kind: unit
        ref: "反向验证：注释掉空前缀护栏 → WR-01 组共 2 例变红；还原 → 97/97 转绿"
        status: pass
    human_judgment: false
  - id: D5
    description: "DOC-02：三份文档（ai-agent-workspace.md / ai-skills.md / AGENTS.md）的安装档描述与只读清单在新行为下逐句为真，含三处形态限定、两条具名残余与 `pipx list`；AGENTS.md 测试用例数回填实跑值 97；修正 IN-04 交叉引用"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "机械文档断言：两份产品文档均含 默认拒绝 / 显式只读 / bunx / pipx / init <initializer> / audit fix / pipx list / npm -g update ls / pnpm start / 纵深 / 短路先于（或等义）；AGENTS.md 三档段含 PACKAGE_MANAGER_TOOLS / 默认拒绝 / bunx / pipx / 纵深 / 词法归一化"
        status: pass
      - kind: unit
        ref: "`grep -o '策略引擎，[0-9]\\+ 例' AGENTS.md` = 97 = `node --test tests/test-ai-bash-policy.js` 的 `# tests`"
        status: pass
      - kind: unit
        ref: "`git diff 0bbb6c4..HEAD -- agent-workspace.js ai-manager.js` 为空（D-15 与沙箱的零 diff 约束）"
        status: pass
    human_judgment: false

metrics:
  tasks: 3
  commits: 3
  tests_before: 70
  tests_after: 97
  reverse_verifications: 3

---

# Phase 47 Plan 05: bash 安装档默认拒绝（GAP 1 / CR-01）+ WR-01 护栏 Summary

## Performance

- **Tasks:** 3/3
- **Commits:** 3（每个任务原子提交）
- **Tests:** 70 → **97 例全绿**（`node --test tests/test-ai-bash-policy.js`）
- **反向验证:** 3 处（每处都确认「移除护栏 → 对应用例变红；还原 → 转绿」）
- **零 diff 约束:** `agent-workspace.js` 与 `ai-manager.js` 相对 `plan_head_before` 逐字节未变

## Accomplishments

### Task 1：安装档改「首 token 默认拒绝」+ 共用词法归一化（GAP 1 端到端纵切）

关闭验证报告 BLOCKER 的靶心：`evaluateBashCommand('brew "install" wget', ['brew'])` 改前为 `{level:'allow'}`
（零卡片），而 `/bin/sh` 证明其 argv 与 `brew install wget` 完全相同。

- **`stripShellQuoting(seg)`**（替换 `stripLeadingQuotes`）：`normalizeSegment` → 去反斜杠转义 → 去引号。
  只在 `matchInstall` 内使用，白名单与危险判定的匹配口径零移动。
- **`PACKAGE_MANAGER_TOOLS`**：15 项工具集（`npx` / `bunx` / `npm` / `pnpm` / `yarn` / `bun` / `pip` /
  `pip3` / `pipx` / `uv` / `uvx` / `brew` / `cargo` / `go` / `gem`），每条含 `name`（逐字沿用既有断言
  锁定的家族名）/ `readOnly`（显式只读清单）/ `bareIsInstall` / 可选 `guarded`（形态化）/ `composite`。
- **`PACKAGE_MANAGER_TOOL_MAP`**：只读正则集，四条拼装次序不可调换（动词式 → 守卫式 → 复合式 → 裸形式）；
  **`verbs` 为空时必须跳过构造**（空捕获组 `\b()\b` 匹配空串会让该工具带参形态全放行）。
- **`matchInstall` 重写**：纵深优先 → 只读降级 → 默认拒绝；三个 return 点各留一行具名注释。
- **纵深表追加两条**：`bunx`（裸形安全，readOnly 为 `[]`）与 `pipx`（**动词限定 + 旗标容忍**）。
- **测试新增四组**：词法改写绕过（8 条 × 文档推荐白名单 + `/bin/sh` argv 等价性证据 + 白名单不变式对）、
  默认拒绝语义（工具集完整性 / 表驱动只读 / `readOnlyRes` 结构断言 / 清单一致性 / pipx 双侧 / 纵深层仍生效）、
  承重墙（空清单执行器 / 空捕获组危害可复算 / 纵深优先 / 形态化 / 生命周期别名）、源码不变量
  （纵深优先位置 / 非空守卫 / 两份 JSDoc 语义）。

### Task 2：绕过家族全表断言收敛 + WR-01 `*` 条目护栏

- **WR-01**：`matchesWhitelist` 两个通配分支各加 `if (!prefix.trim()) continue;`；
  `validateWhitelistList` 追加「去尾部 `*` 后为空」的拒绝分支（`不支持单独使用 *`）。
  改前实测 `['*']` 下 `cat ~/.ssh/id_rsa` / `curl -o /tmp/x http://…` 全为 `allow` —— 一个字符作废整份白名单。
- **新增两组测试**：`GAP 1 绕过面收敛（SEC-01 门禁复算）` 把验证报告 BLOCKER 表逐行翻成断言，
  并额外钉住三处残余边界（`NPM i x` 仍 confirm 但 reason 不是 install / `NPM=npm $NPM i x` 不命中白名单前缀 /
  命令替换仍命中 install）；`WR-01 白名单通配条目护栏` 覆盖校验层、匹配层与源码断言。
- **门禁表扩充**：`INSTALL_FAMILIES` 补 `bunx` / `pipx` 两族与 `npm update` / `npm rebuild` /
  `yarn workspace app add lodash` / `cargo add serde` / `go get` / `brew cask install` 等真实安装形态；
  `READONLY_NEGATIVES` 补 `npm start` / `stop` / `restart` / `run-script` / `npm audit` / **`pipx list`**
  （blocker 1 在门禁表里的回归哨兵）；`P1-b-1` 补八条只读侧承重墙用例 + pipx。

### Task 3：文档与卡片文案在词法改写形态下全部为真（DOC-02 / GAP 1 文档面）

- **`docs/product/ai-agent-workspace.md`**：§四 ③ 档判定与触发源表改写为默认拒绝语义 + 工具集清单 +
  词法归一化 + 「install 短路先于白名单」的机制说明；§四 只读段改写为「显式只读清单」并补**三处限定**
  （`npm init <initializer>` ≡ `npx create-<initializer>`；`npm audit fix` / `audit --fix` 属安装档；
  `npm start` / `stop` / `restart` / `run-script` 与 `run` / `test` 同族只读）+ **纵深优先**（`npm -g install list`
  / `brew --quiet install info` 仍属安装档）+ `pipx list`；§五 服务端校验补「不支持单独 `*`」、
  使用建议改写为「白名单不再能放开任何非只读包管理器子命令」；§七 第 5 条改为**带前提**表述并新增
  **三条具名残余**；§八 测试描述补默认拒绝与词法改写形态。
- **`docs/product/ai-skills.md`**：§八 补「内容一致时跳过重建」精度句 + 崩溃残留自愈 + 播种诊断 console 兜底
  （描述 **47-06 的既定行为**，见 cross_plan_coordination）；§九 家族清单补 `bunx` / `pipx` 并改为默认拒绝表述、
  白名单不可越过的理由改写为机制 + 可自证例子、只读段三处限定、残余风险段按实际行为改写。
- **`AGENTS.md`**：bash 三档段改写（`PACKAGE_MANAGER_TOOLS` + 默认拒绝 + 工具集 + 词法归一化 +
  纵深表退居纵深层的说明）+ 新增只读豁免三条实现约束 + 维护约定；白名单段补 `*` 拒绝；
  **测试用例数由 70 回填为实跑值 97**；修正 IN-04 交叉引用（`allowed-tools` 声明在 §七**第 6 条**，
  原文误写第 5 条）。
- **`ai-manager.js` 逐句核验（D-15，只读）**：① title `AI 请求安装第三方软件包` ✓；
  ② 文案「将从网络下载并运行第三方代码；该命令不会因为加入白名单而免确认」✓（改前为假是因为
  命中白名单前缀的漏检形态根本不进该分支）；③ `riskLevel: (isDanger || isInstall) ? 'high' : 'medium'` ✓。
  **结论：无需修改**（零 diff）。唯一不完全准确处是已具名登记的 `pnpm start` 族保守误报，
  已在 JSDoc 与两份用户文档中并列说明。

## Task Commits

| Task | Commit | 说明 |
|------|--------|------|
| 1 | `532ab63` | `feat(47-05)` 安装档改「首 token 默认拒绝」+ 共用词法归一化（GAP 1 / CR-01） |
| 2 | `c7e19a8` | `feat(47-05)` 绕过家族全表断言收敛 + WR-01 白名单通配条目护栏 |
| 3 | `9f2ab37` | `docs(47-05)` 三份文档与卡片文案在词法改写形态下全部为真（DOC-02 / GAP 1 文档面） |

`plan_head_before`：`0bbb6c43c828116e848edce33cb0f4c9a54ea73d`（三提交的基线，台账取 `git plan-head-before-47-05`）

## Files Created/Modified

- `ai-bash-policy.js`（+346 行）：`stripShellQuoting` / `PACKAGE_MANAGER_TOOLS` / `PACKAGE_MANAGER_TOOL_MAP` /
  `matchInstall` 重写 / 纵深表两条追加 / `matchesWhitelist` 空前缀护栏 / `validateWhitelistList` `*` 拒绝 /
  两份 JSDoc 与文件头改写 / 导出面追加三项
- `tests/test-ai-bash-policy.js`（+519 行）：新增六组用例 + 三张表扩充 + 两处已设计变更的注释
- `docs/product/ai-agent-workspace.md`、`docs/product/ai-skills.md`、`AGENTS.md`

**零 diff（硬约束）**：`agent-workspace.js`、`ai-manager.js`

## Decisions Made

见 frontmatter 的 `key-decisions`（D-47-05-a..f）。补充三条实现取舍：

1. **只读清单准入判据**：只收「不取新代码 **且** 不执行第三方代码」的子命令；存疑一律不收
   （`uv run` 隐式 sync 依赖、`npm config set` 可改 registry、`npm publish` / `pack` 跑项目生命周期脚本、
   `npm owner` / `team` / `dist-tag` 有写操作）。
2. **不重新审议 `run` / `test` 族**（D-16 已锁定为 read-only）：判据若被无限外推会得出「`npm test` 执行
   第三方测试运行器 → 移出清单」，那与 D-16 直接冲突且制造大量噪声。形态化的适用范围限于**取新代码**的形态。
3. **`python` / `python3` 刻意不入工具集**：首 token 已被 `DANGEROUS_INTERPRETERS` 强制确认（danger 先于
   install 返回），install 档无增量价值；`python3 -m pip install x` 的复合形态由纵深表承接
   （既有断言继续通过）。

## Deviations from Plan

### D-47-05-x：执行方式变更 —— 子代理 429 死亡后由主会话内联接管

- **现象**：派发的 `gsd-executor` 子代理在 429（用量超频，重置时间 2026-09-12 19:52 UTC+8）下
  **未提交任何内容**即失败；但工作区已留下 Task 1 的主体改动（`ai-bash-policy.js` 重写 + Task 1 测试组），
  无提交、无 SUMMARY。
- **处置**：先确认子代理确已死亡（`git log` 无 47-05 提交、无 `47-05-SUMMARY.md`、无后台残留进程），
  再由主会话内联接管：补完 Task 1 尾项 → 提交 → 实施 Task 2 / Task 3 → 提交。
- **影响**：三个任务的提交边界与计划一致；Task 1 的绝大部分代码由子代理产出、由主会话复核并补尾项
  （`⑦-e` JSDoc 字面量 + `npm runx` 移出只读反例）。全部 must_haves 由主会话独立复算（49 条 → ALL PASS）。
- **记录原因**：这是「子代理 429 后主会话接管」这一约定的一次实际应用，且子代理留下了**未提交的工作区改动** ——
  接管前必须先确认代理已死并盘点残留，否则会重复劳动或覆盖已完成的正确改动。

### D-47-05-y：Task 1 的提交含一处原属 Task 2 的测试改动

- `READONLY_NEGATIVES` 中 `npm runx` 的移除本属 Task 2 步骤 2，但它是 Task 1「已设计变更」的直接后果
  （`npm runx` 在默认拒绝下不再是只读反例），不移除则 Task 1 的测试无法转绿。
- 处置：在 Task 1 提交中一并移除（带注释说明理由），Task 2 只做表头扩充与其余条目追加，未重复改动。

## Issues Encountered

1. **反向验证是必需的，不是可选的**：本计划的三条承重墙里，「空 readOnly 不生成动词式正则」在
   既定判定顺序下**会被纵深层的裸条目掩盖**（npx / bunx / uvx 各有一条裸纵深条目，先命中即返回，
   `readOnlyRes` 分支到不了）。因此该护栏的唯一可靠判据是**结构断言**
   （`readOnlyRes.length === 0` + 全表无空捕获组），行为断言只能作为防退化证据。
   SUMMARY 与测试注释均按此口径写明，未宣称行为断言单独能证明该护栏。
2. **旗标取值与子命令在词法上不可区分**（结构性残余，不可消除）：既有锁定负例要求
   `pnpm --filter a run build` 判只读（`a` 是 `--filter` 的取值），同一 `FLAG_TOLERANCE` 取值槽必然
   也能吞掉子命令。已用**纵深优先**把可识别面压到最小（三条真实安装命令被收回安装档），
   剩余部分（`npm -g update ls`，改前亦为 null，**无回归**）作为具名残余写进 JSDoc ⑦-e、
   `PACKAGE_MANAGER_TOOLS` JSDoc ⑤ 与两份用户文档。
3. **`pnpm` / `yarn` / `bun` 的 `start` 族保守误报**：未收录 → 落强制确认档，卡片文案
   「将从网络下载并运行第三方代码」对这族命令不准确。方向安全（多一次卡片），作为**已接受的代价**
   具名登记（JSDoc ⑦ / SUMMARY / 两份用户文档）。
4. **大小写形态（WR-05）不在本计划范围**：`NPM i x` / `RM -rf x` 不命中任何档 → 降级为普通确认卡片
   而非高风险卡片。已用断言把严重性钉死（**即便漏检也不免确认**），并写进用户文档。

## Reverse Verification Records（证明断言非空转）

| # | 变更 | 结果 | 还原后 |
|---|------|------|--------|
| 1 | pipx 纵深条目改回裸 `/\bpipx\b/` | `GAP 1 默认拒绝语义` + `P1 门禁信号` 共 **3 例变红**（94/97） | 97/97 转绿 |
| 2 | 注释掉 `matchesWhitelist` 的两个空前缀护栏 | `WR-01 白名单通配条目护栏` 共 **2 例变红**（95/97） | 97/97 转绿 |
| 3 | 从 `PACKAGE_MANAGER_TOOLS` 移除 `npm` 条目 | `matchInstall 判定` / `GAP 1 词法改写绕过` / `GAP 1 默认拒绝语义` / `只读豁免承重墙` / `P1 门禁信号` / `GAP 1 绕过面收敛` 共 **8 例变红**（89/97） | 97/97 转绿 |

## Cross-reference Verification（REVIEW IN-04）

- `docs/product/ai-skills.md` §九末尾引用 `ai-agent-workspace.md` **第七节第 5 条** —— 被引内容是安装档的
  「只审一级 bash 命令」残余，**序号正确**（第 5 条）。
- `AGENTS.md` 的「技能不构成额外权限 / `allowed-tools`」条目原引用 `ai-agent-workspace.md` 第七节**第 5 条**，
  但 `allowed-tools` 的声明实际落在**第 6 条** —— **已修正为第 6 条**。

## 关键实测值

- `node --test tests/test-ai-bash-policy.js` → `# tests 97` / `# pass 97` / `# fail 0`（改前基线 70 例）
- `node tests/test-ai-skills.js` → 64/64 pass；`node tests/test-agent-workspace.js` → 21/21 pass
- 主会话独立复算 must_haves.truths 靶心断言 **49 条 → ALL PASS**（不依赖测试文件的断言组织方式）
- `matchInstall` 实测：`brew "install" wget` / `brew \install wget` / `brew ins""tall wget` 均 `Homebrew 安装包`；
  `npm -g install list` / `npm --global install ls` 均 `npm 安装依赖`；`brew --quiet install info` 为
  `Homebrew 安装包`；`pipx list` 为 `null` 而 `pipx install black` 为 `包执行器（pipx）`；
  `npm start` 族四条为 `null`；`npm init react-app my-app` / `npm audit fix` / `pnpm audit --fix` 非 null

## Next Phase Readiness

- 本计划闭合 GAP 1（BLOCKER / CR-01）与 WR-01；同波的 **47-06** 闭合播种模块的三个 warning 级 gap
  （GAP 2/3/4）。两者文件集互不重叠（本计划持有 `ai-bash-policy.js` / `tests/test-ai-bash-policy.js` / 三份文档；
  47-06 持有 `builtin-skills-seeder.js` / `tests/test-builtin-skills-seeder.js`，且**不得改 docs/ 或 AGENTS.md`）。
- ⚠ **跨计划口径耦合（必须核对）**：本计划 Task 3 已按 47-06 计划文本写入 `docs/product/ai-skills.md` §八
  的三处行为（内容一致跳过重建 / 崩溃残留清扫 / 播种诊断 console 兜底）。若 47-06 实施时行为必须偏离，
  **以 47-06 的实现为准并回改本节文档**，不得留假说明。
- 阶段复验时 `tests/test-builtin-skills-seeder.js` 当前仍有 2 例失败（属 47-06 的 GAP 2/3/4，本计划不动该文件）。

## Self-Check: PASSED

- [x] Task 1/2/3 全部执行并各自原子提交
- [x] `ai-bash-policy.js` / `tests/test-ai-bash-policy.js` / 三份文档 已落地
- [x] `47-05-SUMMARY.md` 已创建（本文件）
- [x] 六组新用例 + 三张表扩充 + 97 例全绿
- [x] 三处反向验证已执行并记录
- [x] `agent-workspace.js` / `ai-manager.js` 相对基线零 diff
- [x] 全部 `must_haves.truths` 由独立脚本复算通过（49/49）
- [x] IN-04 交叉引用核验完成并修正
- [x] 残余风险（旗标取值 / pnpm 别名保守误报 / 大小写 WR-05）三方登记（JSDoc + SUMMARY + 用户文档）
