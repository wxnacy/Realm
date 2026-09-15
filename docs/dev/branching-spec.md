# 分支规范

> 适用范围：Realm Browser 全部代码仓库协作。
> 模型：**master 主干 + 短期 feature/hotfix 分支 + 每分支独立 worktree**。
> 一句话原则：**新功能与 bug 修复都在独立 worktree 的独立分支上做；修复的落点永远是 master。**

---

## 一、分支模型总览

```
master ────────●────●──────────●────●──────●   ← 唯一主干，可直接提交 / 推送
                \              \     \
 .worktrees/gc  ─●────●         \     \        feature/ai-memory-gc
                                 \     \
 .worktrees/cookie-fix ───────────●─────●      hotfix/cookie-www-dedup
```

四件事决定了这套模型成立：

1. `master` 始终等于「当前线上该有的代码」
2. 修复**只在 master 上做**，feature 靠定期拉 master 被动获得修复
3. `feature` 与 `hotfix` 都是**短期分支**，用完即删
4. **每个分支独占一个 worktree** —— 分支决定历史线，worktree 决定改动落在哪个工作目录

> 关于 `master`：它**不受保护、可直接提交与推送**，不强制 PR。远端（`origin`）已存在，PR 是可选路径而非必由之路。
> 但这不等于可以在 master 上做功能/修复 —— 见第二节与第三节。

---

## 二、分支类型定义

| 分支 | 命名 | worktree 路径 | 从哪分出 | 合回哪 | 生命周期 |
|------|------|--------------|---------|--------|---------|
| `master` | `master` | 主工作树（仓库根） | — | — | 永久 |
| 功能分支 | `feature/<简述>` | `.worktrees/<简述>` | `master` | `master` | **≤ 2~3 周** |
| 修复分支 | `hotfix/<简述>` | `.worktrees/<简述>` | `master` 或 发布 tag | `master` | **≤ 2 天** |
| 维护分支 | `release/<x.y>` | 按需 | 发布 tag | 只吃 cherry-pick | 按维护窗口 |

命名约定：

- 全小写 + 连字符，禁止空格、中文、下划线
- `<简述>` 用 2~4 个英文词描述范围，如 `feature/ai-memory-gc`、`hotfix/cookie-www-dedup`
- **worktree 路径取分支名的 `<简述>` 部分**：`feature/ai-memory-gc` → `.worktrees/ai-memory-gc`
- 禁止用个人名做分支名（`feature/wxnacy-tmp`）
- **维护分支 `release/x.y` 当前未启用** —— 启用条件见第九节

---

## 三、worktree 使用规范

**所有 `feature/*` 与 `hotfix/*` 都必须在独立 worktree 中进行，不在主工作树上 `switch` 到分支再改。**

### 为什么必须用 worktree

`git switch -c` 也能开分支，但它会**整体替换主工作树的内容**：未提交的改动会跟着切走、正在跑的应用与 IDE 索引全部重置、且同一时刻只能有一个状态。worktree 让「master 始终可发布」这条原则在物理上成立。

### 建 worktree 前，主工作树需要干净吗？

**建 worktree 不需要；但同目录 `switch` 会把改动带走、或直接拒绝 —— 这正是本节要求用 worktree 的实证理由。**

2026-09-14 实测（隔离环境）：

| 场景 | 目标分支上该文件的状态 | 结果 |
|------|---------------------|------|
| 建 worktree（`git worktree add … -b <分支> <基点>`） | — | ✅ 成功。主工作树的**已跟踪改动与未跟踪文件都不会带进新 worktree**，新 worktree 的 `git status` 是干净的 |
| 同目录 `git switch -c <新分支>` | 同一内容 | ✅ 成功，但**改动跟着切走**（已跟踪与未跟踪都带） |
| 同目录 `git switch <目标分支>` | 该文件**内容不同** | ❌ **拒绝**，退出码 1：「您对下列文件的本地修改将被检出操作覆盖……请在切换分支前提交或贮藏您的修改」 |
| 同目录 `git switch <目标分支>` | 该文件在目标分支**已被跟踪**（本地是未跟踪同名文件） | ❌ **拒绝**，退出码 1：「工作区中下列未跟踪的文件将会因为检出操作而被覆盖」 |

**为什么这是 worktree 的核心优势**：同目录 `switch` 时，主工作树上那份半成品会**静默跟着你进新分支**（git 只在冲突时才出声音）。你在新分支上一提交，改动就落在新分支了 —— 而 `master` 从未有过它。结果是两边都不是你想要的样子。

**实操口径**

| 情况 | 做法 |
|------|------|
| 主工作树的未提交改动与新工作**无关** | 直接建 worktree，无需处理 |
| 新工作**依赖**那些改动 | 先提交到 `master`（新分支从它分出，自然包含） |
| 那些改动是**不想进 master 的半成品** | 先 `git stash`；需要时在新 worktree 内 `git stash apply` |
| 想保持「master 始终可发布」 | 建 worktree 前先提交或 stash，别让 master 长期挂着脏状态 |
| 同一文件可能被两边同时改 | 必须先在一边落定（提交），否则合并时更难解 |

### worktree 必须放在仓库内部

**位置固定为 `<仓库根>/.worktrees/<简述>`。** 这不是审美选择 —— 放在仓库**外面**（如 `../Realm-fix`）会导致 Node 的 `node_modules` 向上查找链够不到主仓库，**所有测试立刻 `Cannot find module`**。

实测（2026-09-14）：

| worktree 位置 | 有无 `node_modules` | 跑 `tests/test-favorites-folders.js` |
|---|---|---|
| `<仓库>/.worktrees/xxx`（内部） | 无 | ✅ 33/33 全过（向上解析命中主仓库 `node_modules`） |
| `../Realm-xxx`（外部） | 无 | ❌ `Cannot find module` |

所以**默认不需要在 worktree 里重装依赖** —— 它会自动「蹭」主仓库那 893 MB 的 `node_modules`。

### 五条边界（会静默出错，务必遵守）

| 边界 | 后果 | 正确做法 |
|------|------|---------|
| **改了 `package.json`（加/升级依赖）** | 共享的 `node_modules` 与该分支不匹配，**测试结果不可信且不报错** | 在 worktree 内 `npm install`（会建出独立的 `node_modules`，从此与主仓库分离） |
| **要跑构建 / 打包（`make install`）** | 同理，且打包需要完整且匹配的依赖树 | 在 worktree 内独立 `npm install`，或回主工作树做 |
| **在 worktree 内跑过一次 `npm install`** | 内部 `node_modules` 会**遮蔽**共享的那份，两者开始漂移 | 记住该 worktree 已「独立化」，别再假设它在蹭依赖 |
| **原生模块（`better-sqlite3` / `nodejieba`）** | 绑定 Node / Electron ABI 与平台 | 同机同版本才通用；换机器即失效 |
| **测试驱动用绝对路径拼 `node_modules`** | 绝对路径**不参与**向上查找 ⇒ 该依赖拿不到共享副本，worktree 内直接 `MODULE_NOT_FOUND` | 改用**裸说明符**（`require('electron')`）；详见下节 |

### 在 worktree 内跑自动化测试

**结论：纯 Node 套件与「需要 Electron 的自动化测试」都能在 worktree 内直接跑，不需要 `npm install`。**

前提是测试驱动取依赖时用**裸说明符**：

```js
// ✅ 主工作树与 worktree 都能解析（worktree 无自己的 node_modules 时靠 Node 向上查找）
const ELECTRON_EXECUTABLE = require('electron');

// ❌ 绝对路径不参与向上查找 ⇒ worktree 内必然 MODULE_NOT_FOUND
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));
// ❌ 同病：手写 dist 路径
executablePath: path.join(REALM_ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
```

实测（2026-09-15，在 `.worktrees/hard-reload-shortcut` 内，该 worktree **没有**自己的 `node_modules`）：

| 形态 | 结果 |
|------|------|
| `require('electron')`（裸说明符） | ✅ 解析到**主仓库**的 `node_modules/electron` 二进制 |
| `require(path.join(ROOT, 'node_modules', 'electron'))` | ❌ `MODULE_NOT_FOUND: Cannot find module '<worktree>/node_modules/electron'` |
| `require('better-sqlite3')` 等其它依赖 | ✅ 同裸说明符，正常复用 |
| 以裸说明符驱动的 Electron 端到端用例 | ✅ 9/9 通过（真实启动 dev 应用，零 `npm install`；参照实现 `tests/uat-hard-reload-shortcut.js`） |

**为什么容易踩**：`node_modules` 向上查找**只对裸说明符生效**；把根目录拼成绝对路径就等于绕开整条复用机制。而 playwright 装在全局（靠 `NODE_PATH`），它自己也找不到本仓的 electron —— 驱动为了「显式传 `executablePath`」而拼绝对路径时，正好踩中这条。

**运行方式**：需要 Electron 的驱动一律带 `NODE_PATH`（playwright 是全局依赖，不在本仓 `node_modules` 里）：

```bash
NODE_PATH="$(npm root -g)" node tests/uat-<name>.js
```

**机械判据**（改完驱动后自查是否踩了绝对路径）：

```bash
grep -rn "require(path\.join(.*node_modules\|node_modules/electron/dist" tests/
```

命中即为待修形态。判据刻意只匹配**真实调用形态**（`require(path.join(...node_modules` 与手拼 `node_modules/electron/dist`），而不是裸的 `node_modules/electron` 子串 —— 后者会被「注释里复述该错误写法」的说明文字误命中（本判据首版即被一节警示注释误报，2026-09-15 实测）。反过来，若在注释里照抄这两种**调用形态**，仍会命中，届时按行号判断即可。

截至 2026-09-15 命中 6 个文件：`test-unified-navigation.js`、`uat-49-g49-3-*`、`uat-49-g49-4-*`（含 `better-sqlite3` 一处同病）、`uat-50-a-*`、`uat-50-b-*`、`uat-50-t1-*` —— 均把「本仓自带 Electron」写成绝对路径，目前只能回主工作树跑。

### 生命周期：必须用 `git worktree remove` 清理

worktree 里的 `.git` 是一个**文件**（内容是 `gitdir: <主仓库>/.git/worktrees/<name>`），元数据登记在主仓库的 `.git/worktrees/` 下。**手删目录不会注销元数据**，会留下 `git worktree list` 标为 `prunable` 的僵尸条目。

```bash
# 正确清理（两步，缺一不可）
git worktree remove .worktrees/<简述>     # 清目录 + 清元数据；有未提交改动时需 --force
git branch -d feature/<简述>              # 再删分支（顺序不能反）
```

---

## 四、铁律

### 1. 新功能与 bug 修复必须在独立 worktree 的独立分支上进行

不允许在主工作树的 `master` 上直接做功能或修复，也不允许在主工作树上 `switch` 到 `feature`/`hotfix` 分支再改。唯一例外见第五节的 5.4「可直接在 master（主工作树）上做」清单。

### 2. 修复的落点永远是 `master`（upstream first）

任何 bug 修复都先在 `master` 上完成，不得只在某个 feature 分支上修。

> **Why**：如果只在 feature 分支上修，这个修复就永远不会进入主线，后续版本必然复发同一个 bug。
> 这是 git-flow 体系被反复记录的头号事故，本模型通过「修复只落 master」在结构上消除它。

### 3. `hotfix` **不需要**回合 feature 分支

`master` 是上游，feature 定期 `merge master` 时会自动获得修复。手动往每条 feature 回合 hotfix 只会制造重复提交和伪造的合并历史。

### 4. feature 定期同步 `master`，且用 `merge` 不用 `rebase`

在 feature 的 worktree 内执行：

```bash
git merge master
```

> **Why**：分支一旦推送就是共享分支，`rebase` 会重写历史、需要 `--force-push`。冲突应当在 **feature 侧**解决，而不是往 master 里解。

同步时机：**master 出现影响本 feature 的改动当天就合**，不要攒到周末或收尾。无脑定时合也可以，但「当天合」能显著降低冲突规模。

### 5. 需要拉 `hotfix` 时，先确认 `master` 是否等于线上

- `master` 干净（没有未发布的 feature）→ 直接从 `master` 拉
- `master` 已含未发布功能 → **必须从发布 tag 拉**，否则会把未发布功能一起发上线，且修的其实不是线上那份代码

```bash
git worktree add .worktrees/login-500 -b hotfix/login-500 v0.1.20
```

### 6. 用完即删：worktree 与分支一起清

合并后立即清理，否则 `.worktrees/` 会堆积、`.git/worktrees/` 会留僵尸条目。顺序：先 `worktree remove`，再 `branch -d`。

### 7. 提交信息用 Conventional Commits

仓库既有风格，保持一致：

```
<type>(<scope>): <描述>

type: feat | fix | docs | refactor | perf | test | build | chore
scope: 模块名或阶段号，如 ai-manager、settings、50
```

示例：`fix(cookie): 修正 .www 域名去重漏清理 session 的问题`

---

## 五、工作流

### 5.1 开发新功能

```bash
# 1. 更新主干，从它拉出分支 + worktree
git switch master && git pull
git worktree add .worktrees/ai-memory-gc -b feature/ai-memory-gc master
cd .worktrees/ai-memory-gc

# 2. 开发（依赖默认蹭主仓库 node_modules，无需 npm install）
#    跑测试：纯 Node 套件直接 node tests/<name>.js；
#    需要 Electron 的驱动带 NODE_PATH="$(npm root -g)"（见第三节「在 worktree 内跑自动化测试」）
# 3. 定期同步主干 —— 冲突在 feature 侧解
git merge master

# 4. 完成 → 回合 master
cd <仓库根>
git switch master && git pull
git merge --no-ff feature/ai-memory-gc
git push origin master

# 5. 清理（两步）
git worktree remove .worktrees/ai-memory-gc
git branch -d feature/ai-memory-gc
```

**实操校验（2026-09-15 端到端实测，步骤 3 / 4 / 5）**

命令本身能跑通，但**同一仓库有并发会话时**这四步各要多判一件事。以下每条都是实测踩点，不是理论推演。

**① 步骤 3（`git merge master`）前先 fetch 并看对方多出什么**

```bash
git fetch origin
git log --oneline HEAD..master      # master 相对本分支多出的提交
```

用来判断将要合入的内容是否触及本分支改过的文件。实测：master 已前进 3 个提交（其中一条是 Phase 51 的**真实代码**提交，不是文档），但因文件零重叠，`git merge master` 直接干净合并。

**② 步骤 4（合回 `master`）前逐文件核对与并发会话未提交改动的重叠**

`git merge` 在**目标工作树存在未提交改动、且该文件恰好被本次合并修改**时会拒绝。并发会话在场时主工作树常挂着别人的半成品，所以先做一次集合求交：

```bash
cd <仓库根>
git status --short                        # 别人的未提交文件
git diff --name-only master feature/<简述> # 本次合并会改的文件
```

**交集为空**才直接合并；非空先与对方确认，**不要**用 `git checkout --` / `reset --hard` 去「腾地方」。

合并后立即复查别人的改动是否原样保留 —— `git status --short` 的输出应与合并前逐行一致。

**③ 合并后用 tree hash 相等继承分支上的验证结论**

不必为了「在 master 上再验一遍」重跑整套。若步骤 3 已把 master 完全并进分支，则：

```bash
git rev-parse feature/<简述>^{tree} master^{tree}
```

两个 hash **相同**即 master 内容与分支逐字节一致 ⇒ 分支上跑过的验证结论**直接继承**（实测二者同为 `8d5b7a1c…`，故不再重跑那 9 条端到端断言）。

同时按**改动面**挑要复跑的套件：改了 `renderer.js` / `settings-page.js` 这类被**源码扫描**的文件时，务必复跑那些做源码扫描的套件 —— 它们才是真实风险面，纯逻辑套件不会因这类改动变红。

**④ 步骤 5 清理后确认零残留**

```bash
git worktree list        # 应只剩主工作树一行
git branch --list        # feature 分支应已消失
ls .git/worktrees/       # 应为空；有内容 = 僵尸元数据（手删目录的后果）
```

**⑤ 一个判读纪律**：`master` 是**活跃共享线** —— 并发会话可能在你合并之上继续提交。所以「合并后某测试变红」不一定是你的改动引起的，先 `git log` 看清中间有没有别人的提交，再下结论。

**feature 寿命超过 2~3 周的处理**：不要靠「再多合几次 master」硬撑。二选一：

- 拆成若干可独立合入的小 feature
- 上 feature flag，代码先进 `master`、默认关闭，做完再开

### 5.2 修复普通 bug（非紧急）

与 5.1 相同，分支名用 `hotfix/<简述>`，合回 `master` 后打 patch tag（见第六节）。

### 5.3 紧急线上故障

```bash
# 1. 确认线上版本对应的提交
git fetch --tags
git tag --sort=-creatordate | head

# 2a. master 干净 → 从 master 拉
git switch master && git pull
git worktree add .worktrees/login-500 -b hotfix/login-500 master

# 2b. master 含未发布功能 → 从发布 tag 拉
git worktree add .worktrees/login-500 -b hotfix/login-500 v0.1.20

cd .worktrees/login-500

# 3. 修复 + 提交（单次提交只含这一个修复，不要夹带格式化/依赖升级）

# 4. 回合 master
cd <仓库根>
git switch master && git merge --no-ff hotfix/login-500

# 5. 发布并打 patch tag
#    bump package.json 版本 → make install → 打 tag（见第六节）
git tag -a v0.1.21 -m "fix login 500"
git push origin master --tags

# 6. 清理
git worktree remove .worktrees/login-500
git branch -d hotfix/login-500
```

> **注意**：走 2b（从 tag 拉）时，修复**仍然必须回合 `master`**（步骤 4）。从 tag 拉只是为了让本次发布不夹带未发布功能，不代表修复可以不进主干。

### 5.4 可直接在 master（主工作树）上做

| 类型 | 例子 |
|------|------|
| 纯文档 | 只改 `.md`、注释、错别字 |
| 纯配置 | 依赖版本号、`.gitignore`、`package.json` 的 build 段 |
| GSD 流程产出 | `.planning/**` 的阶段规划、状态镜像等机械提交 |

判断口径：**无行为变更**。只要改了会跑起来的代码，就属于前两类，必须开分支 + worktree。

---

## 六、版本与 tag

### 现状（务必区分两套编号）

| 编号 | 载体 | 含义 |
|------|------|------|
| `v1.0` ~ `v2.5` | git tag | **里程碑标记**，与项目阶段推进挂钩，**不代表可安装的应用版本** |
| `0.1.x` | `package.json` 的 `version` | **应用发布版本**，`.app` 构建产物对应它 |

当前二者是解耦的 —— 看到 tag `v2.5` 不能推出应用版本是 2.5。

### 规范

1. **每次实际发布应用都要打一个应用版本 tag**，格式 `v<package.json version>`（如 `v0.1.20`）
2. tag 必须打在**发布用的那个提交**上，并 `git push --tags` 推送到远端（否则别人 `fetch` 不到，无法作为 hotfix 基线）
3. 应用版本遵循 SemVer：
   - 修 bug 只递增 patch（`0.1.20` → `0.1.21`）
   - 每次 hotfix 发布**都要**递增 patch 并打新 tag
4. 发布流程：bump `package.json` → `make install` → 实际启动验证 → 打 tag → 推送

> **Why**：没有 tag 就无法回答「线上到底是哪个提交」，「从 tag 拉 hotfix」这条规则也就无从执行。

---

## 七、冲突处理原则

| 冲突场景 | 在哪里解决 | 说明 |
|---------|-----------|------|
| feature ↔ master | **feature 侧**（在其 worktree 内） | 由 feature 负责人在同步时解决 |
| hotfix ↔ master | **hotfix 侧** | 同理，不要在 master 上解 |
| 多 feature 互相冲突 | **各自的 feature 侧** | 说明改动面重叠，考虑拆分或串行推进 |

**禁止**为了「跑完合并」而整侧选一边。冲突往往意味着两侧有真实的语义差异，需要判断后手动合并。

feature 分支过长、冲突越来越难解，是「该拆了 / 该上 feature flag 了」的信号，不是继续加大同步频率的理由。

---

## 八、合并前检查清单

在把分支合回 `master` 之前自查：

- [ ] 分支名符合命名规范，且从正确的基线分出
- [ ] worktree 位于 `.worktrees/` 下（仓库内部）
- [ ] 已 `merge master` 并解决全部冲突
- [ ] 提交信息符合 Conventional Commits
- [ ] 单次提交只做一件事（特别是 hotfix，不含无关清理）
- [ ] 相关测试通过；**若本分支改过 `package.json`，已在 worktree 内独立 `npm install`**
- [ ] 需要 Electron 的驱动已在 worktree 内跑过（`NODE_PATH="$(npm root -g)" node tests/<name>.js`），未因拼绝对路径而跳测
- [ ] hotfix 按**该发布版本**的依赖/运行时验证，不能只跑 master 当前工具链
- [ ] 若为发布修复：已 bump `package.json` patch 版本，并准备好 tag
- [ ] 合并后已 `git worktree remove` + `git branch -d`

---

## 九、何时引入 `release/x.y` 维护分支

**当前不启用。** 这套模型只支持「一个线上版本」。当且仅当出现以下情况时启用：

> **旧版本仍需继续接收修复** —— 例如 `0.2.x` 已发布，但客户仍在用 `0.1.x` 且 `0.1.x` 仍要修 bug。

启用方式（**不要引入 `develop` 分支**）：

```bash
# 从最后一个该线的发布 tag 拉起
git switch -c release/0.1.x v0.1.20

# 修复照旧先在 master 做，再 cherry-pick 过去
git switch release/0.1.x
git cherry-pick -x <sha-in-master>
# 冲突在 release 分支侧解决；解决不了的用 --abort 退出，回到 master 重新设计
```

启用后新增的硬规则：

1. **`master` 先行**：修复永远先在主干完成，再 cherry-pick，不得在 `release/x.y` 上独立提交修复
2. **`-x` 必须带**：在提交信息里留下 `(cherry picked from commit <sha>)`，供后人追溯
3. **只吃 bug 修复**：功能一律不进维护分支
4. **每次修复递增 patch 版本 + 打新 tag**
5. **维护窗口要显式声明并到期截止**（如「只维护最近 2 个 minor」），否则维护成本会无限增长

---

## 十、AI 协作约定（强制）

本项目大量改动由 AI 助手执行。规范必须由 AI **主动执行**，而不是等用户提醒。

> **执行口径的唯一来源是 [AGENTS.md](../../AGENTS.md) 的「分支与提交工作流」一节**（含逐步判断清单与话术），本节只记约定要点，不重复展开。

1. **动手前先判断意图**：新功能 / 大改动 → `feature/*`；bug 修复 → `hotfix/*`；纯文档 / 配置 / GSD 流程产出 → 可留 `master`。语义模糊时先问用户，不自行假定。
2. **在 `master` 上收到功能/修复请求时**：写代码前停下，给出**建议分支名与 worktree 路径**，并询问「是否先建 worktree + 分支再开始」（**推荐建**）。用户坚持在 master 上改则遵从，但要指出偏离规范。
3. **在 feature/hotfix 的 worktree 中完成一个任务后**：主动提示并按确认结果执行 ——
   - `feature/*`：`git merge master`（拉新主干，冲突在 feature 侧解）
   - `hotfix/*`：合回 `master` + bump `package.json` patch 版本 + 打 tag
4. **合并 / 提交 / 推送 / 清理 worktree 一律先经用户确认**，不静默执行。

**不要做**：在主工作树 `switch` 到 feature/hotfix 分支；把 hotfix 回合到各条 feature 分支（feature 拉 master 自动获得）；`rebase` 已推送的分支；手删 worktree 目录（必须 `git worktree remove`）。

> 改动本节的判断口径时，**必须同步** [AGENTS.md](../../AGENTS.md) 的「分支与提交工作流」一节与本文档第三、四、五节，四处不得出现口径分歧。

---

## 十一、速查表

```bash
# 新功能 / 修 bug（统一形态）
git switch master && git pull
git worktree add .worktrees/<简述> -b feature/<简述> master   # 或 hotfix/
cd .worktrees/<简述>
# … 开发（默认蹭主仓库 node_modules）→ 定期 git merge master
# 完成后回主工作树：git merge --no-ff feature/<简述> && git push origin master

# 清理（两步，顺序不能反）
git worktree remove .worktrees/<简述>
git branch -d feature/<简述>

# 紧急故障（master 已含未发布功能时，从发布 tag 拉）
git worktree add .worktrees/<简述> -b hotfix/<简述> v0.1.20
```

| 场景 | 做法 |
|------|------|
| 有新 feature 在开发，同时要修 bug | 各开一个 worktree —— 这正是 worktree 存在的意义 |
| feature 落后于 master | 在 feature 的 worktree 内 `git merge master` |
| hotfix 要不要回合 feature | **不要**，feature 拉 master 自动获得 |
| master 已有未发布功能时修线上 | 从**发布 tag** 建 worktree，修完仍要回合 master |
| 该分支改了 `package.json` | 在 worktree 内独立 `npm install`，别依赖共享依赖 |
| 能不能在仓库外建 worktree | **不能** —— Node 找不到 `node_modules`，测试全崩 |
| 在 worktree 内跑测试 | 纯 Node 套件直接跑；需要 Electron 的驱动带 `NODE_PATH="$(npm root -g)"`，且驱动必须用裸 `require('electron')` 取二进制 |
| 驱动报 `MODULE_NOT_FOUND` 且路径里有 `node_modules` | 它拼了绝对路径，改用裸说明符；见第三节 |
| feature 开了三周还没合 | 拆小 或 feature flag，不要再加大同步频率 |
| 旧版本还要继续支持 | 启用 `release/x.y`，见第九节 |
