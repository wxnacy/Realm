# Stack Research: Realm Browser v2.6 — AI 助手技能（Skill）能力

**Domain:** Electron 桌面应用内的 Agent Skill 系统（SKILL.md 目录 + zip / 网络导入）
**Project:** Realm Browser v2.6（现有 v2.5 基线，Electron 43.6.0）
**Researched:** 2026-09-10
**Confidence:** HIGH（依赖事实全部经 npm registry 查询 + 本地 `node_modules` 实读 + 网络端点 `curl` 实测核验）

---

## TL;DR — 结论先行

> **只需新增 1 个运行时依赖：`yauzl@^3.4.0`（zip 解压）。**
> 其余四项问题全部是「零新增依赖」：
>
> | 问题 | 结论 | 新增依赖 |
> |------|------|----------|
> | (a) zip 解压 | **`yauzl@^3.4.0`**（唯一新增） | ✅ 1 个 |
> | (b) GitHub 下载 | `net.fetch` + `codeload.github.com` / `raw.githubusercontent.com` 直连（绕开 API 限流） | ❌ 0 |
> | (c) YAML frontmatter | SDK 已内置 `yaml@2.9.0` 并完成解析；**不要自己 parse** | ❌ 0 |
> | (d) 热重载 watching | **不需要**。变更路径上确定性 reload，零依赖 | ❌ 0 |
> | (e) 内置 zlib/fs | `zlib` 不提供 ZIP 容器解析，**不能替代 yauzl**；`fs` 已足够 | ❌ 0 |

**明确不要加**：`chokidar`、`js-yaml`、`adm-zip`、`extract-zip`、`unzipper`、`jszip`、`fflate`、`node-stream-zip`、`tar`。理由见后文。

---

## 关键前置发现（改变方案，roadmap 必须先读这一段）

这 5 条是本次调研中「与直觉相反」或「不查就会踩坑」的发现，直接影响技术方案选型。

### 发现 1 — pi-agent-core 的 skill API **只能从包根导入**，深路径会直接抛错

`@earendil-works/pi-agent-core@0.84.3` 的 `package.json` `exports` 字段**只有 4 个入口**：

```json
{
  ".":                    { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./node":               { "types": "./dist/node.d.ts",  "import": "./dist/node.js" },
  "./session/testing":    { ... },
  "./package.json":       "./package.json"
}
```

**没有 `./harness/skills` 子路径导出**。因此下面这行会抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`：

```js
// ❌ 错误 — exports map 未声明该子路径
await import('@earendil-works/pi-agent-core/dist/harness/skills.js');
```

正确写法（`index.js:15` 有 `export * from "./harness/skills.js"`，`./node` 又 `export * from "./index.js"`，所以包根即可拿到全部 skill API）：

```js
// ✅ 正确 — 与 agent-workspace.js:184-185 既有先例一致
const { loadSkills, loadSourcedSkills, formatSkillInvocation, formatSkillsForSystemPrompt } =
  await import('@earendil-works/pi-agent-core');
const { NodeExecutionEnv } = await import('@earendil-works/pi-agent-core/node');
```

可用的 4 个 API（均已在 `.d.ts` 中确认签名）：

| API | 签名 | 用途 |
|-----|------|------|
| `loadSkills(env, dirs)` | `(ExecutionEnv, string\|string[]) => Promise<{skills: Skill[], diagnostics: SkillDiagnostic[]}>` | 扫描目录递归加载 SKILL.md |
| `loadSourcedSkills(env, inputs, mapSkill?)` | `inputs: Array<{path, source}>` → 每条 skill/diagnostic 带 `source` | **天然适配 `skills/` + `managed-skills/` 双目录来源标记** |
| `formatSkillsForSystemPrompt(skills)` | `Skill[] => string` | 生成 `<available_skills>` 系统提示注入块 |
| `formatSkillInvocation(skill, additionalInstructions?)` | `(Skill, string?) => string` | 生成 `<skill name=... location=...>` 调用块 |

`Skill` 形状（`harness/types.d.ts:28`）：`{ name, description, content, filePath, disableModelInvocation? }`。

> **对 roadmap 的意义**：接线点是主进程 CJS 侧动态 import 包根。**不要**为了让路径「更好看」去 import 深路径。

### 发现 2 — YAML frontmatter 由 SDK 免费解析 → **v2.6 不需要 `yaml` 依赖**

`harness/skills.js:2` 明确 `import { parse } from "yaml"`，其内部 `parseFrontmatter()` 已完成：

- `\r\n` / `\r` 归一化
- `---` 起始 + `\n---` 结束的切片（`slice(4, endIndex)`）
- `parse()` 包在 `try/catch`，YAML 语法错误降级为 `parse_failed` diagnostic（**不 throw**，不炸 agent loop）
- 无 frontmatter 时安全返回 `{}`

**依赖可达性已实测确认**：

| 包 | 版本 | 归属 | 会进打包产物？ |
|----|------|------|----------------|
| `yaml` | **2.9.0**（精确 pin `"2.9.0"`） | `@earendil-works/pi-agent-core` 的 **`dependencies`** | ✅ 是（pi-agent-core 在 Realm 的 `dependencies` 中） |
| `ignore` | **7.0.5**（精确 pin `"7.0.5"`） | 同上 | ✅ 是 |
| `js-yaml` | 4.3.0 | 仅 `electron-builder@24.13.3` 传递链（**devDependency**） | ❌ **否 — 打包后不存在** |

**两条硬结论**：

1. **绝对不要 `require('js-yaml')`** —— 它只在 `electron-builder` 的依赖树里，`make install` 打出的 `.app` 中不存在，`npm run dev` 下能跑通会造成「开发正常、正式版启动报错」的经典事故（与 AGENTS.md「开发/正式环境差异 → 发布前必查」小节同类）。
2. **v2.6 直接复用 SDK 的解析与校验，不要自己 parse frontmatter。** 需要 name/description（例如设置页导入预览、名称冲突检测）时，走**「解压到临时目录 → `loadSkills(env, [tmp])` → 读返回的 `Skill[]` + `diagnostics[]`」**。这样免费获得与运行时**完全一致**的校验语义：

   | SDK 内置校验（`skills.js:237-261`） | 规则 |
   |---|---|
   | `name` 与父目录名必须相同 | `name "${name}" does not match parent directory "${parentDirName}"` |
   | 长度 | `name ≤ 64`，`description ≤ 1024` |
   | 字符集 | 仅 `^[a-z0-9-]+$` |
   | 连字符 | 不得首尾为 `-`，不得含 `--` |
   | description | 必填非空 |

   自己 parse 会**必然**与这份规则漂移（改一处漏一处），是所有技术债里最不划算的一种。

> **仅当** roadmap 出现「不落盘就预览 frontmatter」的硬需求时，才显式加 `yaml@^2.9.0`（**必须与 SDK 同版本**，否则 npm 可能装出双实例）。v2.6 需求清单里没有这一条。

### 发现 3 — zip 库的安全格局在 2026 年已经洗牌，直接决定选型

这是本次调研最重的一段。三个「看起来最主流」的库现在**都有未修复的安全问题**：

| 库 | 最新版 | 最新版发布 | 安全问题 | 状态 |
|----|--------|-----------|---------|------|
| `extract-zip` | **2.0.1** | **2020-06-10**（6 年未发版） | **CVE-2026-56876**，**CVSS 8.1 Important** — 不校验 symlink 目标，`../../../../etc/passwd` 式相对链接可直接读写任意位置 | 🔴 **上游维护者失联，明确无补丁**。Red Hat 官方建议：「avoid using this package」 |
| `adm-zip` | **0.6.0** | 2026-07-10 | **CVE-2026-76845**（GHSA-vwc7-r8mq-g2x9，CVSS 6.8）— `0.5.9` ~ `0.6.0` **全部受影响，含最新版**；`Utils.sanitize` 只做**字符串比较**，`fs.openSync(path,'w',0o666)` 无 `O_NOFOLLOW`、无写入前 `lstat` → 目标目录内已存在的 symlink 组件可让条目内容穿透写出根目录，**归档里连 `..` 都不需要出现** | 🔴 **最新版即受影响版本，无修复版本**。另有历史 CVE-2018-1002204 |
| `unzipper` | 0.12.5 | 2026-06-21 | **CVE-2026-17514** — `lib/extract.js` 的 `Extract` 函数路径穿越（影响 **≤ 0.12.3**） | 🟡 0.12.4+ 已修，但依赖树重（`bluebird` + `fs-extra` + `graceful-fs` + `duplexer2` + `node-int64`） |
| `node-stream-zip` | 1.16.0 | 2026-07-22 | 内置 `validateName()` 正则拦截 `\` / 盘符 / 前导 `/` / `..`；**但 `extract()` 用 `fs.open(outPath,'w')` 无 `O_NOFOLLOW`、无 `path.resolve` 包含性复核**；且 v1.16.0 刚修的正是「特制归档导致内存溢出」 | 🟡 内置校验 + 活跃维护，但写入路径与 adm-zip 同一类弱点 |
| **`yauzl`** | **3.4.0** | 2026-06-07 | **内置 `validateFileName()`，且 `decodeStrings:true`（默认）时对每个条目自动执行**；**`validateEntrySizes:true`（默认）强制校验 `uncompressedSize`，官方明确标注为 zip bomb 安全特性**；**库本身从不写盘，只产 read stream** | 🟢 **推荐** |

**`yauzl` 的关键结构性优势**（这是它胜过 node-stream-zip 的核心理由，不是「更流行」）：

> yauzl **不提供任何落盘 API**——`openReadStream()` 只给你一个流，「写到哪、要不要写、拒绝哪些条目」全部由调用方决定。
>
> 因此 adm-zip CVE-2026-76845 的那一整类攻击（**库自己**用 `fs.open(w)` 跟随了目标目录里预先存在的 symlink）在 yauzl 上**结构性地不可能发生**。这是我们能拿到的最大安全收益，而且不需要依赖上游修 bug。

配合 yauzl 的另外两个默认开关，我们**开箱即得**三层防护：

1. **Zip Slip** — `validateFileName()` 自动拦截，命中时 emit `error` 而**不是** `entry`（攻击条目根本到不了我们的代码）
2. **Zip bomb** — `validateEntrySizes` 强制 `uncompressedSize` 契约，我们再加一道累计字节预算即可
3. **目标符号链接穿越** — 库不写盘，我们自己的写入逻辑 `mkdir` 全新目录 + `O_NOFOLLOW` 语义（`fs.writeFile` 到我们刚建的空目录内，且拒绝 symlink 条目）即可

`yauzl` 维护与采纳度（实测）：**27,060,107 次/周**下载，唯一依赖 `pend@1.2.0`（**`pend` 自身零依赖**），解包体积 **109,901 B（≈110 KB）**，纯 JS **无原生模块**。

### 发现 4 — GitHub zipball 有单层前缀；`codeload` 不吃 API 限流（已实测）

2026-09-10 实测三个端点（`curl -D -`）：

| 端点 | 返回 | `x-ratelimit-*` 头 |
|------|------|-------------------|
| `api.github.com/repos/anthropics/skills` | `HTTP/2 200` | **`x-ratelimit-limit: 60`**、`x-ratelimit-remaining`、`x-ratelimit-used`、`x-ratelimit-reset`、`x-ratelimit-resource: core` |
| `codeload.github.com/<o>/<r>/zip/refs/heads/<b>` | `content-type: application/zip` | **完全没有任何 `x-ratelimit-*` 头** |
| `raw.githubusercontent.com/<o>/<r>/<b>/<path>` | `content-type: text/plain` | **完全没有任何 `x-ratelimit-*` 头** |

**结论：`codeload` 与 `raw` 是独立主机，不占用 REST API 的 60/hr 主配额。**

限流规则（GitHub 官方文档，2026-03-10 版）：

- 未认证：**60 请求/小时**，按**来源 IP** 计（不是按应用）
- 认证 PAT：**5,000 请求/小时**；GitHub Enterprise Cloud 组织下的 App/OAuth app：15,000/小时
- 超限返回 **403 或 429**，须等 `x-ratelimit-reset`；次级限流会带 **`retry-after`**
- 次级限流：并发 ≤ 100、≤ 900 points/min、内容生成 ≤ 80/min 且 ≤ 500/hr
- 检查配额用响应头（官方明确建议**不要**为查配额去调 `GET /rate_limit`）

**zipball 结构（实测 `anthropics/skills`）**：

```
entries: 512        大小: 3,984,611 B ≈ 3.98 MB
顶层前缀: ['skills-main']        ← 唯一顶层目录
  skills-main/
  skills-main/skills/
  skills-main/skills/<skill-name>/SKILL.md
```

> **两个必须处理的实现细节**：
> 1. GitHub zipball **恒定**包一层 `<repo>-<ref>/` 前缀，导入器**必须剥离第一段路径**，否则解压结果会是 `skills-main/skills/foo/SKILL.md` 而不是期望的 `skills/foo/SKILL.md`。
> 2. ZIP 内路径分隔符按规范是 `/`，剥离首段后再用 `path.join` 拼本地路径。

### 发现 5 — 内置技能的真实仓库路径（已实测确认）

| 技能 | 仓库 | 实际路径 | frontmatter |
|------|------|---------|-------------|
| `skill-creator` | `anthropics/skills` | **`skills/skill-creator/SKILL.md`** | `name: skill-creator` + `description:` |
| `find-skills` | `vercel-labs/skills` | **`skills/find-skills/SKILL.md`** | `name: find-skills` + `description:` |

`anthropics/skills/skills/` 下共 19 个技能目录（`academy-guide`、`algorithmic-art`、`docx`、`pdf`、`pptx`、`xlsx`、`mcp-builder`、`webapp-testing`…）。

> ⚠️ **对 roadmap 的重大影响 — 用户粘贴「GitHub 仓库 URL」时不能假设仓库根就是技能目录。**
>
> 两个事实：
> 1. **规范布局是 `skills/<name>/SKILL.md`**，不是 `<repo-root>/SKILL.md`（两个官方仓库都是这个布局）。
> 2. `vercel-labs/skills` 本身是一个 **CLI 项目**（含 `src/`、`bin/`、`tests/`、`package.json`、`pnpm-lock.yaml`、`.husky/`、`scripts/`），技能只是其中一个子目录。整仓 zipball 会把大量无关文件拖下来。
>
> 所以「解析 + 定位技能目录」是导入流程里**独立且必要**的一步（按优先级探测：URL 显式指定的子路径 → `skills/<name>/` → 仓库根含 `SKILL.md` → 用 GitHub Contents API 列一层让用户选）。这一步的复杂度**不在 zip 库里**，roadmap 不能把它算进依赖选型的成本。

---

## Recommended Stack

### Core Technologies（新增 1 项）

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **`yauzl`** | **`^3.4.0`** | 用户上传 zip 技能包 + GitHub zipball 的解压 | **唯一新增运行时依赖**。内置 `validateFileName()`（生效于默认 `decodeStrings:true`）自动挡 Zip Slip；`validateEntrySizes:true` 内置 zip bomb 防护；**库自身从不写盘**，因此不存在 adm-zip CVE-2026-76845 那一类「库跟随目标 symlink 写出根目录」的可能；27M 次/周下载、活跃维护（3.4.0 于 2026-06-07 发布）、唯一依赖 `pend`（零依赖）、110 KB 纯 JS、无原生模块 |

### Supporting Libraries（**全部为现有依赖，零新增**）

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@earendil-works/pi-agent-core` | `^0.84.3`（现有） | **skill 全部核心能力**：`loadSkills` / `loadSourcedSkills` / `formatSkillsForSystemPrompt` / `formatSkillInvocation` | 从**包根**动态 import（详见发现 1） |
| `yaml`（**传递依赖**） | `2.9.0`（SDK 精确 pin） | frontmatter 解析 | **不直接 require**。由 SDK 内部使用；如需显式声明见发现 2 |
| `ignore`（**传递依赖**） | `7.0.5`（SDK 精确 pin） | 技能目录 `.gitignore`/`.ignore` 支持 | **不直接 require**。由 SDK 内部使用 |
| `electron` 的 `net.fetch` | 内置 | 下载 zipball / SKILL.md | **必须用 `net.fetch`，不要用全局 `fetch`**（下详） |
| Node 内置 `fs` / `path` / `zlib` | 内置 | 落盘、路径、无需直接调 zlib（yauzl 内部已用） | 现有用法即可 |
| Node 内置 `crypto` | 内置 | （可选）导入包 hash / 下载完整性 | 需要时用 |
| `electron-store` | `^8.1.0`（现有） | 技能启用状态等偏好 | 复用 `settings.aiBashWhitelist` 的「即改即存」先例 |
| `agent-workspace.js` 的 `createSandboxEnv` | 现有 | `skills/` / `managed-skills/` 纳入硬沙箱；`loadSkills(env, ...)` 的 `env` 入参 | 直接复用，**不要为 skill 另建 env** |

### Development Tools（零新增）

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` + `tests/` 约定 | 技能加载/导入/边界测试 | 沿用 `tests/test-agent-workspace.js`、`tests/test-ai-bash-policy.js` 先例 |
| `esbuild`（devDep，现有） | 若内置技能需 bundle | 现有 |

---

## (a) zip 解压库选型（详细对比）

### 评分矩阵

| 维度 | **yauzl 3.4.0** | node-stream-zip 1.16.0 | extract-zip 2.0.1 | adm-zip 0.6.0 | unzipper 0.12.5 |
|------|-----------------|------------------------|-------------------|---------------|-----------------|
| 最新版发布 | 2026-06-07 | 2026-07-22 | **2020-06-10** | 2026-07-10 | 2026-06-21 |
| 周下载量 | **27,060,107** | 2,934,995 | 13,598,837 | 11,132,259 | 11,643,718 |
| 依赖数 | **1**（`pend`，零依赖） | **0** | 4（含 `@types/*`） | 0 | **5**（`bluebird`/`fs-extra`/…） |
| 解包体积 | 109,901 B | 54,006 B | 10,749 B + yauzl 树 | 140,065 B | 56,795 B + 重依赖树 |
| 原生模块 | 无 | 无 | 无 | 无 | 无 |
| **内置 Zip Slip 防护** | ✅ `validateFileName()`，**默认自动**对每条执行 | ⚠️ `validateName()` 正则，可被 `skipEntryNameValidation` 关掉 | ❌（且 CVE-2026-56876） | ⚠️ 仅字符串比较（CVE-2026-76845） | 🟡 依赖自身 `Extract` 实现 |
| **zip bomb 防护** | ✅ `validateEntrySizes:true` **默认开启**，官方标注为安全特性 | ❌ 无 | ❌ 无 | ❌ 无 | ❌ 无 |
| **库是否写盘** | ❌ **从不写盘**（只给 read stream） | ✅ `fs.open(w)` 无 `O_NOFOLLOW` | ✅ 写盘 | ✅ `fs.openSync(w)` 无 `O_NOFOLLOW` | ✅ 写盘 |
| 目标 symlink 穿越 | **结构性不可能** | 🟡 同类弱点 | 🔴 已 CVE | 🔴 已 CVE（最新版仍受影响） | 🟡 |
| symlink 条目处理 | 不创建（需自行读 `externalFileAttributes`） | 不创建（`attr` 读了但未用，会把链接目标**当文件内容**写出） | 🔴 **创建链接且不校验目标** | 部分 | 部分 |
| ZIP64 | ✅（< 8 PiB） | ✅ | ✅ | ✅ | ✅ |
| 加密 zip | 仅检测传统加密，不支持解密 | 🔴 AES 直接 throw | ❌ | ❌ | ❌ |
| API 风格 | Promise（`openPromise` / `eachEntry` / `openReadStreamPromise`）+ 回调 | Promise + 回调，**自带 `extract()`** | 回调/Promise | 全内存同步 API | 流式 |
| 是否需自写解压循环 | ✅ 需要（≈60-90 行） | ❌ 不需要 | ❌ | ❌ | ❌ |
| 维护风险 | 低 | 低 | 🔴 **维护者失联 4+ 年，官方声明无补丁** | 🔴 最新版即受影响 | 中（依赖树重） |

### 决策：`yauzl@^3.4.0`

**为什么选它**：唯一一个**把三道防线做进默认值**的库——名字校验默认自动跑、`uncompressedSize` 契约默认强制、且**它自己不写盘**所以最危险的那一类（库跟随目标 symlink 写出根目录）从架构上就不存在。代价只是要自写一个 ~60-90 行的解压循环，换来的是每一行落盘行为都在我们自己手里（这点对「导入的是**不可信第三方 zip**」的场景是刚需，不是洁癖）。

**为什么不是 `node-stream-zip`（第二优）**：它更小（54 KB）、零依赖、自带 `extract()` 少写代码、而且 1.16.0 刚修了内存溢出。**但**它的 `extract()` 用 `fs.open(outPath,'w')` 且**除 `validateName()` 外没有任何 `path.resolve` 包含性复核**，与 adm-zip 的 CVE 属同一弱点类别——而它的名称校验可以被 `skipEntryNameValidation: true` 一次性关掉（配置漂移即失守）。用它我们仍须自己补 symlink + 包含性防线，那既然都要自己写，就选**不写盘**的 yauzl，少一层「库替我做决定」的信任面。

> 如果 roadmap 最终决定「要少写代码、接受事后打补丁」，`node-stream-zip@^1.16.0` 是可接受的第二选择。**但必须**加两道自己的护栏：① 落盘前 `path.resolve` + `startsWith(root + sep)` 复核；② 按 `entry.attr` 高位判定 `S_IFLNK (0xA000)` 并直接拒绝 symlink 条目。且**绝不能**传 `skipEntryNameValidation`。

**yauzl 的已知约束（写代码前要知道）**：

- **不提供流式 API**，要求**随机访问**（`open()` 需要真实文件路径；`fromBuffer()` 从内存读）。→ 不能直接吃 HTTP 流，必须先落临时文件或整个读进 Buffer。
- `fromBufferPromise(buffer, options)` **总是强制 `lazyEntries: true`**（为了配合 `eachEntry()`）；`fromBuffer` 得到的 `ZipFile` **永不 emit `close`，也无需调 `close()`**。
- 默认 options（`fromBuffer` 文档明列）：`{lazyEntries:false, decodeStrings:true, validateEntrySizes:true, strictFileNames:false}`。用 `eachEntry()` 时必须 `lazyEntries:true`（`fromBufferPromise` 已替你设好）。
- **`decodeStrings` 必须保持 `true`** —— 设 `false` 会**同时关闭**自动文件名校验（官方文档明写）。
- **禁用 `getFileNameLowLevel()`** —— 它绕过 `validateFileName()`，官方明写「You should call that function yourself」。
- `strictFileNames:false`（默认）会把反斜杠**替换**为正斜杠（兼容微软非标准 zip）。对我们有利（统一成 `/`），但若发现异常可设 `true` 改为报错。
- 不校验 CRC-32（只提供字段不比对）→ 需要完整性时自行校验。
- 格式错误的 zip **默认会抛**，必须处理 callback `err` / promise rejection / `ZipFile` 的 `error` 事件 / read stream 的 `error` 事件四处。**尤其 `eachEntry()` 的 rejection 必须 `try/catch` 包住**，否则恶意 zip 能打穿我们的导入流程。
- 条目很多时 `lazyEntries:true` 才可控（官方 issue #22 记录过内存失控）。

**推荐调用形态**：

```js
// 主进程 CJS，yauzl 是 CJS 包可直接 require
const yauzl = require('yauzl');

// 来自 HTTP body（内存）→ 直接读 Buffer，省一次临时文件落盘
const zipfile = await yauzl.fromBufferPromise(buffer, { decodeStrings: true, validateEntrySizes: true });
// 注意：fromBufferPromise 已强制 lazyEntries:true

try {
  for await (const entry of zipfile.eachEntry()) {
    if (entry.fileName.endsWith('/')) continue;                  // 目录条目
    if (yauzl.validateFileName(entry.fileName) != null) continue; // 双保险（默认已自动跑）
    // ① 剥离 zipball 顶层前缀  ② 路径包含性复核  ③ 拒绝 symlink 条目  ④ 累计字节预算
    // ⑤ 从空目录 mkdir 起步（保证目标不存在预先存在的 symlink）
    const rs = await zipfile.openReadStreamPromise(entry);
    // ... pipeline 到自己算出的安全目标路径
  }
} catch (err) {
  // 必须捕获：格式错误 / 恶意归档（validateFileName 命中会走这里）
}
```

---

## (b) GitHub 仓库 / URL 下载策略

### 推荐：三路分流（对应 PROJECT.md 的「GitHub 仓库/目录 与 SKILL.md 直链自动分流」）

| 用户输入形态 | 走哪条路 | 是否吃 API 配额 | 需要 zip 库？ |
|-------------|---------|----------------|--------------|
| **`*.md` 直链**（如 `raw.githubusercontent.com/.../SKILL.md`） | `net.fetch` 直取该文件 → 写入 `<skill-name>/SKILL.md` | **❌ 不吃**（raw 主机无 `x-ratelimit` 头，已实测） | ❌ **不需要** |
| **GitHub 仓库 / 目录 URL** | **`codeload.github.com/<o>/<r>/zip/refs/heads/<branch>`** 直连下载整仓 zipball → yauzl 解压 → 只保留目标技能子目录 | **❌ 不吃**（codeload 主机无 `x-ratelimit` 头，已实测） | ✅ 需要 |
| 需要列目录让用户选 / 解析分支与默认分支 | `api.github.com/repos/.../contents/...` | ✅ **吃 60/hr** | ❌ |

### 为什么是 `codeload` 直连而不是 `api.github.com` 的 zipball 端点

- `api.github.com/repos/{o}/{r}/zipball/{ref}` 会 **302 重定向**到 codeload，但**那一次 api 请求本身计入 60/hr**。
- 直接打 `codeload.github.com/<o>/<r>/zip/refs/heads/<branch>` **完全不经过 api 主机**，实测响应无任何 `x-ratelimit-*` 头 → **不吃 60/hr 主配额**。
- 对「未认证、按 IP 计、只有 60/hr」的桌面客户端场景，这是**决定性差别**：导入 3 个技能用 codeload 是 3 次无关配额请求；用 API 就吃掉 3/60，还不能列目录。

**为什么不用 `api.github.com/.../contents/` 递归拉目录**：每个子目录一次请求，一个含 `scripts/`、`references/` 的技能目录能轻松吃掉十几次配额，而且 `contents` 对单文件返回 base64（有大小上限）。**只在需要「列一层让用户挑技能」时**才用它，且必须处理 403/429。

### 认证与限流处理

- **默认不带 token**（产品上不应要求用户配 PAT 才能装技能）。不带 token 时走 codeload/raw 就基本绕开了配额问题。
- **可选**：在设置页提供可选 GitHub token（复用 pi-ai Provider 的 API Key 存储思路），仅用于 `/contents/` 列目录这类 API 调用。若加，务必：
  - 用 `Authorization: Bearer <token>`（官方推荐），并发 ≤ 100
  - **必须先读响应头** `x-ratelimit-remaining` / `x-ratelimit-reset`，`remaining === 0` 就不发请求
  - 遇到 **403/429**：有 `retry-after` 就等它；否则等 `x-ratelimit-reset`（UTC epoch 秒）。**官方警告：被限流后继续发请求可能导致集成被封禁**
- 绝不把 token 写进日志/错误提示（复用 `search-manager.js` 的 Key 掩码先例）。

### ⚠️ 必须用 `net.fetch`（Electron Chromium 网络栈），不要用全局 `fetch`

项目已有明确先例与事故记录：

- `favicon-fetcher.js:8-9` —「使用 `net.fetch`（Chromium 网络栈）而非全局 `fetch`（undici）：undici 不走系统代理，直连外网在国内环境大面积失败」
- `search-manager.js:15` —「所有 HTTP 请求使用 Electron `net.fetch`（Chromium 网络栈），确保系统代理兼容」

`codeload.github.com` / `raw.githubusercontent.com` 在**国内网络环境下同样是直连常常不可达**的目标，走 undici 会让「导入技能」这个功能对相当一部分用户直接失效。**这是硬约束，不是偏好。**

### 下载实现要点

- **大小上限**：先看 `content-length` 并设硬上限（实测 `anthropics/skills` 整仓 zipball 已 **3.98 MB / 512 条目**；`vercel-labs/skills` 是 CLI 项目会更大）。超限直接拒绝并给出可读原因。
- **流式落盘**：`net.fetch` 的 `res.body` 是 web ReadableStream，**不要** `await res.arrayBuffer()` 整包进内存；边读边写临时文件、边累计字节数超限即中止。
- **超时**：`AbortSignal.timeout()`，并把它接到 `net.fetch({ signal })`。
- **URL 归一化/SSRF**：网络地址导入属于「用户提供 URL」入口。项目已有 SSRF 判据（`search-manager.js` 的 `isPrivateIp` + 逐跳重定向校验，`web_fetch` 复用）——**直接复用，不要另写一份**。用 `redirect: 'manual'` 逐跳校验（`search-manager.js:1604` 已有先例）。
- **zipball 顶层前缀剥离**：见发现 4，恒定包一层 `<repo>-<ref>/`。

---

## (c) YAML frontmatter 解析

**结论：v2.6 不需要新增也不需要显式依赖 `yaml`。**

| 问题 | 答案 |
|------|------|
| `yaml` 是传递依赖吗？ | 是。**`@earendil-works/pi-agent-core@0.84.3` 的 `dependencies` 里精确 pin 了 `"yaml": "2.9.0"`**（同时 pin `"ignore": "7.0.5"`） |
| 能直接 rely on 它吗？ | **技术上可以**（CJS 侧 `require('yaml')` 实测可行：`yaml@2.9.0` 的 `package.json` 是 `"type":"commonjs"`、`main: ./dist/index.js`、`exports["."].node = ./dist/index.js`），**但产品上不需要**——因为没有自己想 parse 的场景 |
| 应该显式加吗？ | **v2.6 不加。** 唯一值得加的场景是「不落盘就要预览 frontmatter」；此时加 `yaml@^2.9.0`（**与 SDK 同版本**，避免双实例）。既然我们已经必然要把 zip 解到一个目录（导入流程本身就要落盘），走 `loadSkills()` 往返更优 |
| `js-yaml` 能用吗？ | **绝对不能。** `js-yaml@4.3.0` 只存在于 `electron-builder@24.13.3` 的依赖树（**devDependency**），`make install` 打出的 `.app` 中**不存在**。`npm run dev` 下能跑通但正式版必炸——正是 AGENTS.md 反复警示的环境差异类事故 |

**推荐做法**：解压到 `agent-workspace/.tmp/` 下的临时目录 → `loadSkills(sandboxEnv, [tmpDir])` → 读 `skills[0].name` / `.description` 与 `diagnostics[]`。免费得到 SDK 一致的校验（见发现 2 表格），且**不会与运行时语义漂移**。

> 依赖卫生备注：`yaml` 是**传递依赖**，pi-agent-core 未来换掉它就会破。因为我们**不直接 require**，所以不受影响——这是选择「不直接依赖」而非「显式声明」的额外收益。

---

## (d) 是否需要 chokidar / 文件监听做技能热重载？

**结论：v2.6 不需要任何 watching。不要加 `chokidar`。**

**理由（按重要性排序）**：

1. **技能目录的写入者只有本应用自己**：设置页导入（zip / URL）、`manage_skill` 工具（create/update/delete）。这三条路径我们都**知道变更发生了**，在变更后确定性 reload 即可——这比监听更简单、更可靠、零延迟、无误报。监听是**为「外部不可知写入者」设计的机制**，我们的场景不存在。
2. **需求里没有这一条**。PROJECT.md v2.6 目标特性清单（skill 发现与调用 / 内置两技能播种 / `manage_skill` / 用户导入 / 沙箱双目录）**均未提及热重载**。为一个没有需求的能力引入依赖是本末倒置。
3. **`chokidar` 现在不在打包产物里**：树里的 `chokidar@3.6.0` 仅来自 **devDependency** `electron-reloader@1.2.3`。要用就必须新增运行时依赖。
4. **若未来真要热重载，`fs.watch` 就够了，仍然零依赖**：项目约束是 **macOS 专用**（PROJECT.md Constraints：Platform = macOS），而 Node 的 `fs.watch({ recursive: true })` 在 macOS 上走 FSEvents **原生支持递归**。chokidar README 自己也承认 raw `fs.watch` 的递归只是「partial」——但那主要指 Linux/Windows 差异，macOS 是我们的唯一目标平台。（备选：`chokidar@^4.0.3` —— v4 把依赖从 13 降到 1（`readdirp`）并**移除了内置原生 `fsevents`**，因此无原生模块、**不需要 `asarUnpack` / 不需要 electron-rebuild**，这是它唯一值得考虑的版本形态；`chokidar@5.0.0` 是 **ESM-only 且要求 Node ≥ 20**，CJS 主进程需动态 import。）

**推荐做法**：在 `skill-loader` 暴露一个 `reloadSkills()`，由「导入成功 / `manage_skill` 写入成功 / 设置页启停开关」三条路径显式调用。若日后确有「用户用外部编辑器改 SKILL.md」的需求，再加 `fs.watch({recursive:true})` + 300ms debounce（技能是文本文件，改一次会触发多次事件）。

---

## (e) 复用 Node 内置 `zlib` / `fs` 还是加依赖？

| 内置模块 | 能否替代新增依赖 | 说明 |
|---------|-----------------|------|
| `zlib` | **❌ 不能替代 yauzl** | `zlib` 只提供**压缩流**原语（gzip/deflate/brotli）；`inflateRaw` 是 deflate 的原始原语。**ZIP 是容器格式，不是压缩格式**——`zlib` 没有任何 ZIP 容器解析能力。自研 ZIP 读取器（只需 `zlib.inflateRaw`）技术上可行，但必须独立正确实现：ZIP64 extra field `0x0001`、Info-ZIP Unicode Path extra field `0x7075`、general-purpose bit 3 data descriptor、cp437 vs UTF-8 文件名编码、**以 Central Directory 为唯一权威**（local file header 可以撒谎）、CRC 校验……yauzl 正是这份规范的正确实现。**结论：不要手搓**——这是安全敏感的解析器，自研的收益（省 110 KB）远小于风险 |
| `fs` | ✅ 足够，无需新增 | `fs.mkdir`（recursive）、`fs.writeFile`、`fs.promises.pipeline`、`fs.cpSync`（项目已有先例 `agent-workspace.js:114`、`ai-attachments-manager.js:171`）。**注意**：用 `fs.cpSync` 从 `app.asar` 内复制内置技能目录有风险，见「集成要点」 |
| `fetch`（全局 / undici） | ⚠️ 可用但**本项目禁用** | 不走系统代理，国内环境大面积失败。**必须用 `net.fetch`** |
| `stream/promises` | ✅ 足够 | `pipeline()` 配合 yauzl 的 read stream |
| `crypto` | ✅ 足够 | 需要时算 hash |

---

## 集成要点（Electron 主进程约束 / asar / 原生模块）

这几条直接对应 AGENTS.md 的「开发/正式环境差异 → 发布前必查」小节，是 roadmap 必须写进计划的风险项。

### 1. 原生模块 / `asarUnpack`：**本次零负担**

`yauzl` 是纯 JS、无 `.node`、无二进制、无数据文件 → **不需要** `asarUnpack`，**不需要** `electron-rebuild`。当前 `package.json` 的 `build.asarUnpack` 只有 `["node_modules/nodejieba/**"]`，**保持不动**。这是本次唯一新增依赖的额外好处。

### 2. 内置技能目录的打包（**需要决策，有坑**）

内置 `find-skills` / `skill-creator` 要「完整打包目录并首次启动播种到 `managed-skills/`」。源码目录随 asar 进包后，**首启播种涉及「从 asar 内读目录树 → 写到 userData」**，而：

- `fs.readFileSync` / `readdirSync` / `statSync` 对 asar 内路径**可用**（Electron 已 patch）
- 原生 `fopen`/`dlopen` **不可用**（AGENTS.md 已记录 nodejieba 词典事故 9a1ae11）
- `fs.cpSync(asarPath, userDataPath, {recursive:true})` 依赖底层 `copyFile`，**在 asar 源上的行为不如逐文件读+写可靠**

**两条稳妥路线，roadmap 二选一**：

| 路线 | 做法 | 评价 |
|------|------|------|
| **A（推荐）显式递归读+写** | `readdirSync` 递归 → `readFileSync` → `writeFileSync` 到 `managed-skills/<name>/` | 只用到 Electron 明确 patch 过的 `fs` 读 API；播种逻辑与「多源优先级 / 冲突检测」天然共用同一套遍历代码；**零构建配置改动** |
| **B 加入 `asarUnpack`** | `build.asarUnpack` 增加内置技能目录，播种时从 `process.resourcesPath/app.asar.unpacked/...` 读 | 得到真实文件路径、可直接 `cpSync`；但引入构建配置与路径分支（`app.isPackaged` 判断），且**必须实跑 `make install` 后的 .app 验证** |

**若走 B，必须遵守 AGENTS.md 的三条**：① `asarUnpack` 加条目；② `app.isPackaged` 时把路径显式指到 `process.resourcesPath/app.asar.unpacked/...`（参考 `favorites-manager.js` 的 `nodejieba.load`）；③ **实际启动一次打好的 .app**，不能只跑 `npm run dev`。

**推荐 A**：需求里播种的是**文本目录**（SKILL.md + 可能的 references），体积小、文件数少，显式递归读写最省事且不碰构建配置。

### 3. 沙箱与 `loadSkills` 的 `env` 入参（**不要新建 env**）

- `loadSkills(env, dirs)` 的 `env` 是 `ExecutionEnv`。**直接复用 `agent-workspace.js` 的 `createSandboxEnv()`** —— 它已包装 `NodeExecutionEnv` 并覆写了**全部** FileSystem 方法 + `exec`，路径校验走 `resolveInside`（`agent-workspace.js:136`：`path.resolve` 双基准 + 已存在路径 realpath 复核，防 symlink 二段式逃逸）。
- `createSandboxEnv` 内部已经 `await import('@earendil-works/pi-agent-core/node')` 拿 `NodeExecutionEnv`——即模式已就位。
- `skills/` 与 `managed-skills/` 落在 `agent-workspace/` 内 → `resolveInside` **天然放行**，无需改沙箱根。
- `ensureWorkspaceDir()`（`agent-workspace.js:96`）现在建 `root` + `.tmp/` + `attachments/`，**需要扩成同时建 `skills/` 与 `managed-skills/`**（幂等 `mkdirSync recursive`）。
- **重要**：`loadSkills` 内部会调 `env.listDir` / `env.readTextFile` / `env.canonicalPath` / `env.fileInfo`。因为沙箱**拒绝时返回 `FileResult` 而非 throw**，SDK 会把它转成 `diagnostics`（`list_failed` / `read_failed` / `file_info_failed`）而不是崩溃——**这条链路是良性降级，roadmap 的 UI 要把 diagnostics 呈现给用户**，否则「导入了但没生效」会变成静默失败（与 Phase 11 UAT 的「静默吞错」根因同类）。

### 4. 解压临时目录必须落在沙箱内

解压目标应是 `agent-workspace/.tmp/`（`getTmpDir()`，`agent-workspace.js:80`）下的随机子目录，**不要用 `os.tmpdir()`**。原因：

- 沙箱外的路径 `resolveInside` 会拒绝 → 后续 `loadSkills` 校验预览会拿到 `permission_denied` 的 diagnostics
- `createSandboxEnv` 的 `createTempDir`/`createTempFile` 已被**刻意重定向**到 `.tmp/`（`agent-workspace.js:301-326`，注释明写「SDK 默认落 `os.tmpdir()`，会破沙箱封闭」）——我们自己的临时目录必须遵守同一约定

### 5. 设置页 zip 上行的通道选择（**有一个现成的陷阱**）

设置页是 `realm://settings`，加载在 **webview guest** 中 → 按 AGENTS.md，**guest 内 `realmAPI` IPC 会被 `assertTrustedSender` 拒绝**，必须走 `/api/*` HTTP 端点。

已确认的现有形态：

- 项目**已有** webview 内 `<input type="file">` 先例：`src/settings.html:197`（规则导入 `.json`）、`src/favorites-page.js:2183/2240`（书签 HTML 导入，Phase 17）
- 项目**没有** `dialog.showOpenDialog` 的任何先例（全仓 grep 无命中）
- **⚠️ 陷阱**：`main.js` 的 `readJsonBody`（`main.js:885-897`）是 `req.on('data', c => body += chunk)` **无任何大小上限**再 `JSON.parse`。把 zip 以 base64 塞进 JSON body 会**成倍放大内存占用**（base64 膨胀 33%）且没有拒绝上限 → 一个几十 MB 的 zip 就能把主进程打爆。

**推荐**：设置页按钮 → `POST /api/skills/import-from-file` → **主进程**弹 `dialog.showOpenDialog({ filters:[{name:'Skill 包', extensions:['zip']}] })` → 主进程**直接拿真实文件路径** → `yauzl.openPromise(path)` 流式解压。**zip 字节完全不经过 renderer，也不经过 HTTP body**。

- 好处：绕开无上限的 `readJsonBody`；`yauzl.open()` 拿到真路径（比 `fromBuffer` 更省内存）；新增了项目缺失但明显有用的 `dialog` 用法
- 代价：`dialog` 是**新引入的模式**（无先例），roadmap 需把它当作独立小任务
- **保底方案**（若坚持沿用已验证的 `<input type="file">` 先例）：renderer 侧 `input.files[0]` → `arrayBuffer()` → 走独立端点，**同时必须给该端点加显式 body 大小上限**（不要复用无上限的 `readJsonBody`），或改用 `multipart/form-data` 流式收包。**不要在 `readJsonBody` 上直接传 zip。**

### 6. 路径与 URL 归一化的既有约束

- 剥离 zipball 顶层前缀后，条目的 `fileName` 一定用 `path.join` 重新拼，**不要**字符串拼接
- 导入后的技能目录名**必须**与 frontmatter `name` 一致（SDK 会出 `name "x" does not match parent directory "y"` diagnostic）→ 导入流程应在落盘前用 frontmatter 的 `name` 作为目录名（必要时重命名）。这条容易被忽略，但会导致「导入成功但技能不出现」

---

## Installation

```bash
# 唯一新增运行时依赖
npm install yauzl@^3.4.0

# 无需新增 devDependencies
# 无需改动 package.json 的 build.asarUnpack（yauzl 纯 JS，无原生模块）
# 无需改动 package.json 的 dependencies 中任何现有条目
```

**`package.json` 结果 diff（预期）**：

```diff
   "dependencies": {
     "@earendil-works/pi-agent-core": "^0.84.3",
     "@earendil-works/pi-ai": "^0.84.3",
     "@mozilla/readability": "^0.6.0",
     "better-sqlite3": "^13.0.2",
     "cheerio": "^1.2.0",
     "dashjs": "^5.2.0",
     "dompurify": "^3.4.12",
     "electron-store": "^8.1.0",
     "highlight.js": "^11.11.1",
     "hls.js": "^1.6.17",
     "jsdom": "^30.0.0",
     "marked": "^18.0.7",
     "mpegts.js": "^1.8.1",
     "mux.js": "^6.3.0",
     "nodejieba": "^3.5.8",
-    "turndown": "^7.2.4"
+    "turndown": "^7.2.4",
+    "yauzl": "^3.4.0"
   }
```

> 注意 `yaml@2.9.0` / `ignore@7.0.5` **不会**出现在 `dependencies` 里——它们是 `pi-agent-core` 的传递依赖，`package-lock.json` 已解析到，打包时自动包含。**这正是「不要依赖它」而非「显式声明它」的前提**：我们不写 `require('yaml')`，所以上游换实现不会破我们。

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `yauzl` 自写解压循环 | `node-stream-zip@^1.16.0` | 若 roadmap 明确优先「少写代码」并接受自补 symlink/包含性护栏。它是唯一可接受的次选：零依赖、54 KB、活跃维护、内置 `validateName()`。**绝不可传 `skipEntryNameValidation`** |
| `yauzl` | `@electron-internal/extract-zip@1.0.5` | Electron 官方 fork 的 `extract-zip`（自述「Drop-in replacement for extract-zip」，2026-07-29 更新），理论上修了上游 CVE-2026-56876。但它只为 Electron 内部**打包期**用途服务（当前是 `electron@43.6.0` 的 devDep，**不在打包产物里**），把它提为产品运行时依赖属于超出设计意图的用法。**不建议**，除非 roadmap 接受「跟随 Electron 内部包的 semver 假设」 |
| `codeload` 直连 zipball | `api.github.com` contents 递归 | 仅当需要「列一层目录让用户选技能」时用；要处理 60/hr 与 403/429 |
| `codeload` 直连 zipball | `git clone --depth 1 --filter=blob:none` + sparse-checkout | **不可行**：打包后的 Electron 应用不能假设用户机器有 `git` |
| `net.fetch` | 全局 `fetch`（undici） | **本项目不使用**：不走系统代理，国内环境大面积失败（`favicon-fetcher.js:8-9` 事故记录） |
| `loadSkills` 往返读元数据 | 显式加 `yaml@^2.9.0` 自己 parse | 仅当出现「不落盘预览 frontmatter」的硬需求。**必须与 SDK 同版本**，否则双实例 |
| 变更路径确定性 reload | `fs.watch({recursive:true})` | 仅当出现「用户用外部编辑器改 SKILL.md」的需求。macOS 原生支持，零依赖，需 debounce |
| 变更路径确定性 reload | `chokidar@^4.0.3` | 仅当未来跨平台（Windows/Linux）。v4 无原生模块、无需 `asarUnpack`。**不要用 v5**（ESM-only，需 Node ≥ 20 + 动态 import） |
| 复用 `createSandboxEnv` | 为 skill 新建独立 `ExecutionEnv` | 任何时候都不要：会造成两套路径判据漂移，且 `skills/` 已在沙箱内 |
| `dialog.showOpenDialog`（主进程） | webview `<input type="file">` + base64 POST | 若 roadmap 优先复用已验证先例（`src/settings.html:197`、`favorites-page.js:2183`）。**必须**为该端点单独加 body 大小上限，不要复用无上限的 `readJsonBody` |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`extract-zip@2.0.1`** | **CVE-2026-56876（CVSS 8.1）未修复**：不校验 symlink 目标，`../../../../etc/passwd` 式相对链接可任意读写。上游 6 年未发版、维护者失联，**官方声明无补丁、建议停用** | `yauzl` |
| **`adm-zip@0.6.0`** | **CVE-2026-76845**：`0.5.9`~`0.6.0` **含最新版**全部受影响；`Utils.sanitize` 只做字符串比较 + `fs.openSync(path,'w',0o666)` 无 `O_NOFOLLOW` / 无写前 `lstat` → 目标目录内已存在的 symlink 可让内容穿透写出（归档里无需出现 `..`）。另有历史 CVE-2018-1002204。且**全内存**，大包打爆主进程 | `yauzl` |
| **`js-yaml`** | 只存在于 `electron-builder` 的依赖树（**devDependency**）→ **打包后的 `.app` 里不存在**。`npm run dev` 能跑、正式版必炸（AGENTS.md「环境差异 → 发布前必查」同类事故） | SDK 内建 `yaml@2.9.0`；或走 `loadSkills()` 往返 |
| **`chokidar`（v2.6）** | 无需求；`chokidar@5` ESM-only 且要求 Node ≥20（CJS 主进程要动态 import）；当前树里的 `chokidar@3.6.0` 只是 devDep `electron-reloader` 的，**不在打包产物里** | 变更路径确定性 reload；未来需要则 `fs.watch({recursive:true})`（macOS 原生） |
| **`unzipper`** | 依赖树重（`bluebird`+`fs-extra`+`graceful-fs`+`duplexer2`+`node-int64`）；已有 CVE-2026-17514（≤0.12.3） | `yauzl` |
| **`jszip`** | 693 KB 解包体积（`pako`+`lie`+`readable-stream`+`setimmediate`）；**MIT OR GPL-3.0-or-later 双许可**（与项目 MIT 并存需注意）；**主要价值是打包成 zip，而 v2.6 只需要解压**（`manage_skill` 写的是单个文件，不是 zip；需求里没有「导出为 zip」） | `yauzl` |
| **`fflate`** | 796 KB；面向浏览器的高性能压缩/解压，为「整包进内存」设计；同样**核心价值在压缩侧**；且不含 ZIP 安全校验语义 | `yauzl` |
| **自研 ZIP 读取器（`zlib.inflateRaw`）** | ZIP 是**容器**格式，自研需独立正确实现 ZIP64 extra field `0x0001`、Unicode Path extra field `0x7075`、GP bit 3 data descriptor、cp437/UTF-8 编码、Central-Directory-为权威、CRC 校验。安全敏感的解析器，省 110 KB 换来的风险不划算 | `yauzl` |
| **`tar` / tarball（`.tar.gz`）** | 用 tarball 换 tar 库只是把「ZIP 解析」问题换成「tar 解析」问题（Node **无内置 tar**；树里的 `tar` 只是 `node-gyp`/`electron-builder` 的传递依赖，**不在打包产物里**），且 GitHub tarball 同样有顶层前缀 | 用 zipball + `yauzl` |
| **`api.github.com/.../zipball`** | 那一次 api 请求**计入 60/hr**；codeload 直连不吃配额（已实测） | `codeload.github.com/<o>/<r>/zip/refs/heads/<b>` |
| **全局 `fetch`（undici）** | 不走系统代理，国内环境大面积失败（`favicon-fetcher.js:8-9` 事故记录） | Electron `net.fetch` |
| **把 zip 走 base64 进 `readJsonBody`** | `main.js:885-897` 的 body 解析器**无大小上限**，base64 再膨胀 33% → 大包直接打爆主进程 | 主进程 `dialog.showOpenDialog` 拿真路径给 `yauzl.open()`；或为该端点单独加大小上限 / multipart 流式 |
| **`skipEntryNameValidation` / `decodeStrings:false` / `getFileNameLowLevel()`** | 三者都会**关闭或绕过** yauzl 的自动文件名安全校验（官方文档明确警告 `decodeStrings:false` 时「no automatic file name validation is performed」） | 保持默认值；需要额外保险时显式再调一次 `yauzl.validateFileName(entry.fileName)` |

---

## Stack Patterns by Variant

**If 导入源是 SKILL.md 直链（`raw.githubusercontent.com/.../SKILL.md`）：**
- 用 `net.fetch` 直取该文件文本 → 写入 `<skill-name>/SKILL.md`
- **不需要 yauzl**，不需要临时 zip，不需要前缀剥离
- 仍需：SSRF 校验（复用 `search-manager.js`）、大小上限、`loadSkills` 校验后再落盘

**If 导入源是 GitHub 仓库/目录 URL：**
- `codeload.github.com/<o>/<r>/zip/refs/heads/<branch>` 流式下载到 `.tmp/`
- `yauzl` 解压，**剥离顶层 `<repo>-<ref>/` 前缀**
- 定位技能目录（优先级：URL 显式子路径 → `skills/<name>/` → 仓库根含 `SKILL.md` → `/contents/` 列一层让用户选）
- 只保留目标技能子目录，丢弃其余条目（`vercel-labs/skills` 是 CLI 项目，无关文件很多）

**If 导入源是本地上传 zip：**
- 主进程 `dialog.showOpenDialog` → 真路径 → `yauzl.openPromise()` 流式解压（推荐）
- 或 renderer `<input type="file">` → 独立端点 + **显式 body 大小上限**
- 一次性落盘到 `.tmp/<random>/`，校验通过后再原子 rename 到 `skills/<name>/`

**If 是内置技能首启播种：**
- 源码目录随 asar 进包 → **显式递归 `readdirSync`+`readFileSync`+`writeFileSync`** 到 `managed-skills/<name>/`（推荐路径 A）
- 或 `asarUnpack` + `process.resourcesPath/app.asar.unpacked/...`（路径 B，**必须实跑 `make install` 后的 .app 验证**）
- 幂等：仅当目标不存在时播种（沿用 `migrateAiMemory` 的「旧存在 && 新不存在才迁」先例，`agent-workspace.js:108-119`）

**If 需要区分用户技能 vs 内置技能的优先级：**
- `loadSourcedSkills(env, [{path: userSkillsDir, source:'user'}, {path: managedSkillsDir, source:'managed'}], mapSkill)`
- 该 API 天生给每条 skill/diagnostic 打 `source` 标记，不需要自己拼装来源信息

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `yauzl@^3.4.0` | Node 22.22.0（Electron 43.6.0 内置） | `engines: node >= 12`；纯 JS CJS，主进程可直接 `require('yauzl')`，无需动态 import |
| `yauzl@^3.4.0` | `pend@1.2.0` | yauzl 唯一依赖；`pend` 自身零依赖 → 依赖树最浅 |
| `yauzl@^3.4.0` | Electron 43.6.0 / 无原生模块 | **不需要** `asarUnpack`，**不需要** `@electron/rebuild` |
| `@earendil-works/pi-agent-core@^0.84.3` | `yaml@2.9.0`（SDK 精确 pin） | 传递依赖，会进打包产物；**我们不直接 require** |
| `@earendil-works/pi-agent-core@^0.84.3` | `ignore@7.0.5`（SDK 精确 pin） | 同上，供 `.gitignore`/`.ignore` 支持 |
| `@earendil-works/pi-agent-core@^0.84.3` | Node `>= 22.19.0` | `ai-manager.js:9` 已记录该要求；当前 Node 22.22.0 满足 |
| `yaml@2.9.0` | CJS `require()` | 实测可行：`"type":"commonjs"`、`main:./dist/index.js`、`exports["."].node=./dist/index.js` |
| `js-yaml@4.3.0` | ❌ **打包后不可用** | 仅 `electron-builder`（devDep）依赖树 |
| `chokidar@3.6.0` | ❌ **打包后不可用** | 仅 `electron-reloader`（devDep）依赖树 |
| `@electron-internal/extract-zip@1.0.5` | ❌ **打包后不可用** | 仅 `electron@43.6.0`（devDep）依赖树 |

**打包产物依赖可用性速查（本次调研反复用到的关键判据）**：

| 包 | 树中版本 | 来源 | 打包后存在？ |
|----|---------|------|-------------|
| `yaml` | 2.9.0 | `pi-agent-core`（**prod dep**） | ✅ |
| `ignore` | 7.0.5 | `pi-agent-core`（**prod dep**） | ✅ |
| `js-yaml` | 4.3.0 | `electron-builder`（**devDep**） | ❌ |
| `chokidar` | 3.6.0 | `electron-reloader`（**devDep**） | ❌ |
| `@electron-internal/extract-zip` | 1.0.5 | `electron`（**devDep**） | ❌ |
| 任意 zip 库 | — | — | ❌（本次须新增） |

---

## Sources

**本地实测（HIGH — 直接读取 `node_modules` / `package.json` / 源码）**

- `package.json`（根）— 现有 20 项 `dependencies`、`build.asarUnpack`、**无 `"type":"module"`（主进程为 CJS）**
- `node_modules/@earendil-works/pi-agent-core/package.json` — `exports` map 仅 4 入口；`dependencies` 精确 pin `yaml: "2.9.0"`、`ignore: "7.0.5"`
- `node_modules/@earendil-works/pi-agent-core/dist/index.js:15` — `export * from "./harness/skills.js"`（**包根可达**）
- `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js` — frontmatter 解析、`validateName`(L237)、`validateDescription`(L252)、`parseFrontmatter`(L262)
- `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.d.ts` — 4 个 API 签名
- `node_modules/@earendil-works/pi-agent-core/dist/harness/types.d.ts:28` — `Skill` 接口
- `node_modules/@earendil-works/pi-agent-core/dist/harness/env/nodejs.d.ts` — `NodeExecutionEnv` 构造与 17 个方法
- `node_modules/yaml/package.json` — `"type":"commonjs"`，`require()` 可用
- `agent-workspace.js:96/108/136/179-350/184-185` — `ensureWorkspaceDir`、`migrateAiMemory`、`resolveInside`、`createSandboxEnv`
- `ai-manager.js:5-12` — SDK ESM-only 与 Node 22.19.0 要求
- `favicon-fetcher.js:8-9` — `net.fetch` vs undici 的代理事故记录
- `search-manager.js:15,1599-1604` — `net.fetch` + `redirect:'manual'` 逐跳 SSRF 校验先例
- `main.js:885-897` — `readJsonBody` **无大小上限**
- `src/settings.html:197` / `src/favorites-page.js:2183,2240` — webview 内 `<input type="file">` 先例
- `ai-attachments-manager.js:171` — `fs.cpSync(..., {dereference:false, verbatimSymlinks:true})` 先例
- `AGENTS.md` — 环境差异/asarUnpack/原生模块发布规则、`realm://` CSP、guest 无 `realmAPI`

**npm registry 实测（HIGH — `npm view` + `api.npmjs.org`，2026-09-10）**

- `yauzl@3.4.0` — 2026-06-07 发布，109,901 B，`dependencies: {pend: '~1.2.0'}`，MIT，`engines: node >=12`，27,060,107 次/周
- `node-stream-zip@1.16.0` — 2026-07-22，54,006 B，零依赖，2,934,995 次/周
- `extract-zip@2.0.1` — **2020-06-10**，4 依赖，13,598,837 次/周
- `adm-zip@0.6.0` — 2026-07-10，140,065 B，11,132,259 次/周
- `unzipper@0.12.5` — 2026-06-21，5 依赖，11,643,718 次/周
- `jszip@3.10.2` — 693,061 B，`(MIT OR GPL-3.0-or-later)`，23,572,603 次/周
- `fflate@0.8.3` — 796,742 B，42,566,731 次/周
- `chokidar@5.0.0` — 2025-11-25（ESM-only，`import`-only）；`chokidar@4.0.3` — 2024-12-18（1 依赖，无 fsevents）
- `yaml@2.9.0`（685,953 B，105,453,178 次/周）；`ignore@7.0.9`（166,698,043 次/周）
- `@electron-internal/extract-zip@1.0.5` — 2026-07-29，「Drop-in replacement for extract-zip」
- `pend@1.2.0` — **零依赖**

**GitHub 端点实测（HIGH — `curl -D -` / `curl -sSL`，2026-09-10）**

- `api.github.com/repos/anthropics/skills` → `x-ratelimit-limit: 60`（并含 `remaining`/`used`/`reset`/`resource: core`）
- `codeload.github.com/anthropics/skills/zip/refs/heads/main` → `content-type: application/zip`，**无任何 `x-ratelimit-*` 头**；体积 **3,984,611 B**，**512 条目**，**唯一顶层前缀 `skills-main`**
- `raw.githubusercontent.com/.../README.md` → `content-type: text/plain`，**无任何 `x-ratelimit-*` 头**
- `api.github.com/repos/anthropics/skills/contents/` → 顶层 `skills/`、`spec/`、`template/`、`.claude-plugin/`
- `anthropics/skills/skills/` → 19 个技能目录，**含 `skill-creator`**（→ `skills/skill-creator/SKILL.md`，frontmatter 仅 `name` + `description`）
- `vercel-labs/skills/skills/` → **含 `find-skills`**（→ `skills/find-skills/SKILL.md`）；仓库根为 CLI 项目（`src/`、`bin/`、`tests/`、`pnpm-lock.yaml`）

**安全公告与官方文档（HIGH — 权威来源，多为交叉核对）**

- [CVE-2026-56876 — Red Hat CVE 页](https://access.redhat.com/security/cve/cve-2026-56876) — `extract-zip` symlink 目标未校验，CVSS 3.1 **8.1 Important**，CWE-22，公开于 2026-06-26，**明确「No patch is available… upstream maintainer is unresponsive (last commit 4+ years ago)」**，建议「avoid using this package」
- [CVE-2026-76845 — OpenCVE](https://app.opencve.io/cve/CVE-2026-76845) / [GHSA-vwc7-r8mq-g2x9] — `adm-zip` **0.5.9~0.6.0** 提取时跟随目标 symlink；`Utils.sanitize` 只做字符串比较、`Utils.writeFileTo` 用 `fs.openSync(path,"w",0o666)` 无 `O_NOFOLLOW`；CVSS 6.8；公开于 2026-08-24
- [CVE-2018-1002204 — NVD](https://nvd.nist.gov/vuln/detail/CVE-2018-1002204) / [Snyk npm:adm-zip:20180415](https://security.snyk.io/vuln/npm:adm-zip:20180415) — adm-zip < 0.4.9 目录穿越
- [CVE-2026-17514 — OSV](https://osv.dev/vulnerability/CVE-2026-17514) / [Snyk SNYK-JS-UNZIPPER-18365659](https://security.snyk.io/vuln/SNYK-JS-UNZIPPER-18365659) — `unzipper` `lib/extract.js` 的 `Extract` 路径穿越（**≤ 0.12.3**）
- [Snyk zip-slip-vulnerability](https://github.com/snyk/zip-slip-vulnerability) — Zip Slip 影响 zip/tar/jar/war/cpio/apk/rar/7z 的通类说明
- [yauzl README（GitHub / npm）](https://github.com/thejoshwolfe/yauzl) — `validateFileName()`（拦 `"/"`、`/[A-Za-z]:\//`、`".."` 段、`"\\"`；`decodeStrings:true` 时**自动**每条目执行；不安全时 emit `error` 而非 `entry`）；`validateEntrySizes` 作为 **zip bomb 安全特性**；`getFileNameLowLevel()` **绕过**安全检查的官方警告；`decodeStrings:false` 时**不执行**自动校验；`fromBuffer` **永不 emit `close`**；`fromBufferPromise` **强制 `lazyEntries:true`**；默认 `{lazyEntries:false, decodeStrings:true, validateEntrySizes:true, strictFileNames:false}`；无流式 API、要求随机访问；ZIP64 上限 8 PiB；仅检测传统加密不解密；不校验 CRC-32；「How to Avoid Crashing」四处错误处理要求；`eachEntry()` 的 must/must-not 约束
- [node-stream-zip README + 源码](https://github.com/antelle/node-stream-zip)（+ `master/node_stream_zip.js`）—— `validateName()` 正则 `/\\|^\w+:|^\/|(^|\/)\.\.(\/|$)/`、`skipEntryNameValidation` 选项、`extract()` 用 `fs.open(outPath,'w')`、`entry.attr` 读取但未解析（symlink 条目按普通文件处理）、无 `path.resolve` 包含性复核、v1.16.0 修复特制归档内存溢出（致谢 @DumDumSu）
- [GitHub Docs — Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)（apiVersion 2026-03-10）— 未认证 **60/hr 按 IP**；PAT **5,000/hr**；Enterprise Cloud App/OAuth **15,000/hr**；Actions `GITHUB_TOKEN` **1,000/hr/repo**；`x-ratelimit-limit/remaining/used/reset/resource`；超限 **403/429** 后等 `x-ratelimit-reset`；次级限流 `retry-after`、并发 ≤100、≤900 points/min、内容生成 ≤80/min 与 ≤500/hr；官方建议**用响应头而非 `GET /rate_limit`** 查配额；「继续在被限流时发请求可能导致集成被封禁」
- [chokidar (paulmillr)](https://github.com/paulmillr/chokidar) — v5（2025-11）ESM-only 且 Node ≥20；v4（2024-09）依赖 13→1、**移除 bundled fsevents**、移除 glob；「raw `fs.watch` 递归仅 partial」；`atomic`/`awaitWriteFinish` 选项；EMFILE/ENOSPC 排障

**经由 GSD 研究seam（LOW → 交叉核对后提升为 HIGH/MEDIUM）**

- `gsd-tools query research-plan`（`/tmp/research-plan-stack.json`）→ 6 个问题路由至 `websearch` provider（`exa`/`brave`/`firecrawl`/`tavily` 均为 `false`）
- `gsd-tools query classify-confidence --provider websearch` → **LOW**；`--verified` → **MEDIUM**
- 6 条 digest 已写入 `research-store`（key：`4b4ff1f5…` yauzl、`68158f41…` adm-zip、`2be47881…` node-stream-zip、`f280acba…` GitHub 限流、`9e7a474d…` watching、`9fdc4724…` 自研 zip）
- **上表所有 websearch 派生结论均已用 npm registry / 本地源码 / `curl` 实测或权威公告交叉核对**，故最终置信度按核对后来源标注

---

*Stack research for: Realm Browser v2.6 — AI 助手技能（Skill）能力*
*Researched: 2026-09-10*
*唯一新增运行时依赖：`yauzl@^3.4.0`*
