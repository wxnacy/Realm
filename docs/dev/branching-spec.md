# 分支规范

> 适用范围：Realm Browser 全部代码仓库协作。
> 模型：**master 主干 + 短期 feature/hotfix 分支**（GitHub Flow 轻量变体）。
> 一句话原则：**master 永远可发布，修复的落点永远是 master。**

---

## 一、分支模型总览

```
master ──●──●──●──●──●──●──●──●   ← 唯一主干，永远可发布，受保护
          \        \        \
 feature/x ─●──●────●──●─────●     定期 merge master，完成后 PR 回合
            \
 hotfix/y ───●                     紧急修复，PR 立即回合 master + 打 tag
```

三件事决定了这套模型成立：

1. `master` 始终等于「当前线上该有的代码」
2. 修复**只在 master 上做**，feature 靠定期拉 master 被动获得修复
3. `feature` 与 `hotfix` 都是**短期分支**，用完即删

---

## 二、分支类型定义

| 分支 | 命名 | 从哪分出 | 合回哪 | 生命周期 | 谁负责 |
|------|------|---------|--------|---------|--------|
| `master` | `master` | — | — | 永久 | 全员（仅通过 PR） |
| 功能分支 | `feature/<简述>` | `master` | `master`（PR） | **≤ 2~3 周** | 功能负责人 |
| 修复分支 | `hotfix/<简述>` | `master` 或 发布 tag | `master`（PR） | **≤ 2 天** | 修复人 |
| 维护分支 | `release/<x.y>` | 发布 tag | 只吃 cherry-pick | 按维护窗口 | 维护者 |

命名约定：

- 全小写 + 连字符，禁止空格、中文、下划线
- `<简述>` 用 2~4 个英文词描述范围，如 `feature/ai-memory-gc`、`hotfix/cookie-www-dedup`
- 禁止用个人名做分支名（`feature/wxnacy-tmp`）
- **维护分支 `release/x.y` 当前未启用** —— 启用条件见第八节

---

## 三、铁律

### 1. `master` 永远可发布，禁止直推

所有改动（含 `hotfix`）必须走 PR。理由是「hotfix 立即回合 master」如果允许直推，就绕过了 review 和 CI。

### 2. 修复的落点永远是 `master`（upstream first）

任何 bug 修复都先在 `master` 上完成，不得直接在某个 feature 分支上修。

> **Why**：如果只在 feature 分支上修，这个修复就永远不会进入主线，后续版本必然复发同一个 bug。
> 这是 git-flow 体系被反复记录的头号事故，本模型通过「修复只落 master」在结构上消除它。

### 3. `hotfix` **不需要**回合 feature 分支

`master` 是上游，feature 定期 `merge master` 时会自动获得修复。手动往每条 feature 回合 hotfix 只会制造重复提交和伪造的合并历史。

### 4. feature 定期同步 `master`，且用 `merge` 不用 `rebase`

```bash
git switch feature/x
git merge master
```

> **Why**：feature 分支一旦 push 到远端就是共享分支，`rebase` 会重写历史、需要 `--force-push`，会打断其他人的工作。冲突应当在 **feature 侧**解决，而不是往 master 里解。

同步时机：**master 出现影响本 feature 的改动当天就合**，不要攒到周末或收尾。无脑定时合也可以，但「当天合」能显著降低冲突规模。

### 5. 需要拉 `hotfix` 时，先确认 `master` 是否等于线上

- `master` 干净（没有未发布的 feature）→ 直接从 `master` 拉
- `master` 已含未发布功能 → **必须从发布 tag 拉**，否则会把未发布功能一起发上线，且修的其实不是线上那份代码

```bash
git switch -c hotfix/login-500 v0.1.20   # 从发布 tag，而不是 master
```

### 6. 分支用完即删

PR 合并后立即删除远端与本地分支。残留分支会让「哪些还在进行中」失去可信度。

### 7. 提交信息用 Conventional Commits

仓库既有风格，保持一致：

```
<type>(<scope>): <描述>

type: feat | fix | docs | refactor | perf | test | build | chore
scope: 模块名或阶段号，如 ai-manager、settings、50
```

示例：`fix(cookie): 修正 .www 域名去重漏清理 session 的问题`

---

## 四、工作流

### 4.1 开发新功能

```bash
# 1. 从最新 master 拉出
git switch master && git pull
git switch -c feature/ai-memory-gc

# 2. 开发过程中定期同步主干（解决冲突在 feature 侧）
git merge master

# 3. 完成后推送并开 PR
git push -u origin feature/ai-memory-gc
# → PR 目标分支：master，等待 review + CI

# 4. 合并后清理
git switch master && git pull
git branch -d feature/ai-memory-gc
```

**feature 寿命超过 2~3 周的处理**：不要靠「再多合几次 master」硬撑。二选一：

- 拆成若干可独立合入的小 feature
- 上 feature flag，代码先进 `master`、默认关闭，做完再开

### 4.2 修复普通 bug（非紧急）

与 4.1 相同，分支名用 `hotfix/<简述>`，合回 `master` 后打 patch tag（见第五节）。

### 4.3 紧急线上故障

```bash
# 1. 确认线上版本对应的提交
git fetch --tags
git tag --sort=-creatordate | head

# 2a. master 干净 → 从 master 拉
git switch master && git pull
git switch -c hotfix/login-500

# 2b. master 含未发布功能 → 从发布 tag 拉
git switch -c hotfix/login-500 v0.1.20

# 3. 修复 + 提交（单次提交只含这一个修复，不要夹带格式化/依赖升级）
# 4. 推送 + PR + 加急 review（hotfix 分支不跳过 CI）

# 5. 回合 master
git switch master && git merge --no-ff hotfix/login-500

# 6. 发布并打 patch tag
#    bump package.json 版本 → make install → 打 tag（见第五节）
git tag -a v0.1.21 -m "fix login 500"
git push origin master --tags

# 7. 清理
git branch -d hotfix/login-500
```

> **注意**：走 2b 分支（从 tag 拉）时，修复**仍然必须回合 `master`**（步骤 5）。从 tag 拉只是为了让本次发布不夹带未发布功能，不代表修复可以不进主干。

---

## 五、版本与 tag

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

## 六、冲突处理原则

| 冲突场景 | 在哪里解决 | 说明 |
|---------|-----------|------|
| feature ↔ master | **feature 侧** | 由 feature 负责人在同步时解决 |
| hotfix ↔ master | **hotfix 侧** | 同理，不要在 master 上解 |
| 多 feature 互相冲突 | **各自的 feature 侧** | 说明改动面重叠，考虑拆分或串行推进 |

**禁止**为了「跑完合并」而整侧选一边。冲突往往意味着两侧有真实的语义差异，需要判断后手动合并。

feature 分支过长、冲突越来越难解，是「该拆了 / 该上 feature flag 了」的信号，不是继续加大同步频率的理由。

---

## 七、日常检查清单

提交 PR 前自查：

- [ ] 分支名符合命名规范，且从正确的基线分出
- [ ] 已 `merge master` 并解决全部冲突
- [ ] 提交信息符合 Conventional Commits
- [ ] 单次提交只做一件事（特别是 hotfix，不含无关清理）
- [ ] CI 通过；hotfix 按**该发布版本**的依赖/运行时验证，不能只跑 master 当前工具链
- [ ] 若为发布修复：已 bump `package.json` patch 版本，并准备好 tag

---

## 八、何时引入 `release/x.y` 维护分支

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

## 九、AI 协作约定（强制）

本项目大量改动由 AI 助手执行。规范必须由 AI **主动执行**，而不是等用户提醒。

> **执行口径的唯一来源是 [AGENTS.md](../../AGENTS.md) 的「分支与提交工作流」一节**（含逐步判断清单与话术），本节只记约定要点，不重复展开。

1. **动手前先判断意图**：新功能 / 大改动 → `feature/*`；bug 修复 → `hotfix/*`；纯文档 / 配置 → 可留 `master`。语义模糊时先问用户，不自行假定。
2. **在 `master` 上收到功能/修复请求时**：写代码前停下，给出**建议分支名**并询问「是否先拆分支再开始」（**推荐拆分支**）。用户坚持在 master 上改则遵从，但要指出偏离规范。
3. **在 feature/hotfix 分支上完成一个任务后**：主动提示并按确认结果执行 ——
   - `feature/*`：`git merge master`（拉新主干，冲突在 feature 侧解）
   - `hotfix/*`：合回 `master` + bump `package.json` patch 版本 + 打 tag
4. **合并 / 提交 / 推送 / 开 PR 一律先经用户确认**，不静默执行。
5. `master` 禁止直推，走 PR；AI 在分支上完成提交即止，推送与开 PR 需用户确认。

**不要做**：把 hotfix 回合到各条 feature 分支（feature 拉 master 自动获得）；`rebase` 已 push 的共享分支。

> 改动本节的判断口径时，**必须同步** [AGENTS.md](../../AGENTS.md) 的「分支与提交工作流」一节与本文档第三、四节，三处不得出现口径分歧。

---

## 十、速查表

```bash
# 新功能
git switch master && git pull
git switch -c feature/<name>
git merge master                 # 定期同步（用 merge，不用 rebase）
# … PR 到 master，合并后 git branch -d

# 修 bug
git switch master && git pull
git switch -c hotfix/<name>
# … PR 到 master，合并后打 patch tag

# 紧急故障（master 已含未发布功能时）
git switch -c hotfix/<name> v0.1.20   # 从发布 tag 拉
# … 修复 → PR → 合回 master → bump 版本 → 打 tag → 推送
```

| 场景 | 做法 |
|------|------|
| 有新 feature 在开发，同时要修 bug | `hotfix/*` 从 master 分，合回 master |
| feature 落后于 master | feature 侧 `git merge master` |
| hotfix 要不要回合 feature | **不要**，feature 拉 master 自动获得 |
| master 已有未发布功能时修线上 | 从**发布 tag** 拉 hotfix，修完仍要回合 master |
| feature 开了三周还没合 | 拆小 或 feature flag，不要再加大同步频率 |
| 旧版本还要继续支持 | 启用 `release/x.y`，见第八节 |
