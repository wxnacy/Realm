---
phase: "51"
slug: "zip"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-15"
---

# Phase 51 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Phase scope**：用户技能导入管线（本地 zip 上传 / 网络 zipball / 直链 SKILL.md → **同一条**解压校验与落盘管线）。
> **归属安全门禁**：**P2**（S1）写面加固 —— T-51-01 / T-51-02 / T-51-05 / T-51-29 闭合；
> **P4**（S1）zip 路径类 —— T-51-11 / T-51-12 / T-51-13 / T-51-14 / T-51-15 闭合；
> **P9**（S2）SSRF —— T-51-31 / T-51-32 闭合，T-51-33 以**如实接受**处置；
> **P3**（S1）注入扫描 —— T-51-17 闭合。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| AI 工具（`write` / `edit` / `bash`）→ 沙箱 root 外的文件系统 | 不可信路径经 `ExecutionEnv` 进入真实 `fs`；本计划加固的正是这条边界上「写目标尚不存在」的那一段 | 见 PLAN 原文（`51-01`） |
| 沙箱 root 内的**已存在** symlink → 写盘路径 | 链接本身合法（用户或 bash 建的），但它把写的**实际落点**带到 root 外 | 见 PLAN 原文（`51-01`） |
| `bash` 的任意命令 → 文件系统 | 命令内容**不在**沙箱这一层校验 | 见 PLAN 原文（`51-01`） |
| npm registry → `node_modules` | 新增两个包的代码将进入主进程（`ai-skills-manager.js` 直接 require），且**随应用打包分发** | 见 PLAN 原文（`51-02`） |
| `package.json` 的版本声明 → 运行时实际加载的实现 | 声明与磁盘实装不一致时，差异是**静默**的（双实例各自解析同一份 YAML） | 见 PLAN 原文（`51-02`） |
| `package.json` 的 `build.*` → 发布产物形状 | 正向 allowlist / `asarUnpack` 的改动会改变随包内容（SEED-05 / P10 的承重面） | 见 PLAN 原文（`51-02`） |
| 设置页 guest（`http://localhost:PORT/settings`）→ `POST /api/skills/import` | 携带任意二进制的**不可信** body；唯一授权是 URL 里的 `REALM_TOKEN` | 见 PLAN 原文（`51-03`） |
| 上传的 zip 字节 → yauzl → 临时解压目录 → `skills/` | 包内一切内容（entry 名 / 元数据 / 压缩声明 / 正文）都不可信；解压本身是「不可信字节 → 真实文件系统」的越界时刻 | 见 PLAN 原文（`51-03`） |
| 解压产物 → 沙箱落点 | 落盘后该目录会成为 AI 读取的技能根（其 `description` 无条件进每次请求的 system prompt） | 见 PLAN 原文（`51-03`） |
| 预览渲染 → 用户判断 | 预览里的一切字符串都来自不可信包（`51-06` 的前端注入纪律）；本计划只保证**服务端**不把不可信内容当判据 | 见 PLAN 原文（`51-03`） |
| 客户端（`realm://` guest）→ commit 端点 | 只允许传 `{ importId, conflict, newName }`；**绝不接受路径**，`importId` 是不透明句柄 | 见 PLAN 原文（`51-04`） |
| 进程内状态（`_skillImports` Map）→ 临时区目录 | Map 是唯一权威；磁盘上的残留是不可信的（崩溃 / 并发实例） | 见 PLAN 原文（`51-04`） |
| 覆盖动作 → 用户已有的技能目录 | 被替换的是**用户自己的**目录（可能手改过），这是本阶段唯一的破坏性写操作 | 见 PLAN 原文（`51-04`） |
| 并发实例（`dev` / `debug` 共享 userData） | 各自持有独立的 Map，但共享同一个 `.tmp/` 与 `skills/` | 见 PLAN 原文（`51-04`） |
| 用户提供的 URL → 主进程出网请求 | URL 是**不可信输入**；它决定我们向哪里发请求（SSRF 面） | 见 PLAN 原文（`51-05`） |
| 远端响应 → 临时文件 → 解压管线 | 远端内容不可信；`content-type` 可伪造（magic bytes 才是权威） | 见 PLAN 原文（`51-05`） |
| 重定向链 → 白名单边界 | 每一跳都可能指向另一个主机（含私网） | 见 PLAN 原文（`51-05`） |
| `net.fetch`（Chromium 网络栈）↔ `dns.lookup`（Node） | 两者可能用不同的解析器 / 代理 ⇒ 被校验的 IP ≠ 被连接的 IP（DNS rebinding） | 见 PLAN 原文（`51-05`） |
| 不可信包内容 → 预览 DOM | 文件名 / 目录树路径 / `description` 原文 / `diagnostics` 原文 / `allowed-tools` 值全部来自用户导入的包 | 见 PLAN 原文（`51-06`） |
| 主进程回传的错误 → 用户可见文案 | 前端只按 `code` 查闭合表，**不解析 `message`**（也**不回显被拒内容原文**） | 见 PLAN 原文（`51-06`） |
| 设置页 guest 的 CSP（`style-src 'self'`）→ 渲染 | 内联 `style` 被拦（元素反而常驻可见）；初始隐藏必须走 CSS 类 | 见 PLAN 原文（`51-06`） |
| 键盘 / AT 用户 → 弹框交互 | 禁用原因必须上屏（`disabled` 元素不可聚焦、`title` 无法触发） | 见 PLAN 原文（`51-06`） |
| 文档 → 后续维护者的判断 | 文档里的措辞（尤其诚实边界与限额口径）直接决定后续改动是否安全；一句被推翻的旧理由会传播一手 | 见 PLAN 原文（`51-07`） |
| 验证契约 → 里程碑审计 | `51-VALIDATION.md` 是审计的判据来源；勾错的项会让覆盖率结论失真 | 见 PLAN 原文（`51-07`） |
| 例数账本 → 门禁 | 账本与实测不符 ⇒ 该门禁本身失去意义（它会恒红或被绕过） | 见 PLAN 原文（`51-07`） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-51-01 | Elevation of Privilege / Tampering | `createSandboxEnv` 的 `writeFile` / `appendFile` / `renameFile` / `createDir` / `remove` | high | mitigate | 全部切到 `guardForWriteResult`（`resolveInsideForWrite`：词法双基准 + 最近已存在祖先 realpath 复核）；`renameFile` 的 source 与 destination 各校验一次；用例组第 6/11/12 条覆盖三个写面各自的逃逸路径 | closed |
| T-51-02 | Elevation of Privilege | `createTempDir` / `createTempFile`（走 `fs.promises.mkdtemp`，`mkdtemp` 本身不经 guard） | high | mitigate | 父目录（`getTmpDir()`）+ 产物路径**两段**复核；产物命名前缀保持不变（与崩溃清扫正则成对） | closed |
| T-51-03 | Denial of Service | `realpathSync` 在父目录链上的上溯（路径极深时） | low | accept | 上溯深度受路径段数物理限制（`MAX_PATH` 级），且仅对写目标调用一次；不引入缓存（缓存会引入失效面，收益不足） | closed (accepted risk) |
| T-51-04 | Denial of Service | `canonicalPath` 的既有输出再校验与本次新函数的语义混淆 | low | accept | `canonicalPath` 是**读面**（`:296-305` 已有输出再校验），本计划**不动它**；新函数的注释里交叉引用它的先例，避免后续把两处合并 | closed (accepted risk) |
| T-51-05 | Tampering | 既有读面语义被顺手改动（把 `resolveInside` 的 ENOENT 分支改成 fail-closed） | high | mitigate | 新函数**并列**于 `guardResult` 而非改本体；门禁二断言六个读面方法体内仍含 `guardResult(`；门禁用例引用既有 21 例（`根内普通路径（存在与不存在）放行` 会先转红） | closed |
| T-51-06 | Repudiation | 加固被写成「bash 写盘能力已被封闭」 | medium | mitigate | 用例组注释 + `prohibitions` 具名登记；诚实边界由 `51-07` 写进 `docs/product/ai-agent-workspace.md` §七 | closed |
| T-51-SC | Tampering | npm / pip / cargo 安装 | high | mitigate | **本计划零安装动作、零新增依赖**（只用 `path` / `fs` 内建）⇒ 无供应链面 | closed |
| T-51-07 | Tampering | `yaml` 依赖（门禁裁决 `[SUS]`，reason `too-new`） | high | mitigate | Task 1 的 `checkpoint:human-verify gate="blocking-human"`（不可自动批准）+ 三条人工确认（钉 2.9.0 / 与 SDK 同版 / 无 postinstall）+ Task 2 的磁盘级单实例判据 | closed |
| T-51-08 | Tampering | `yauzl` 依赖（zip 解析层，直接消费不可信字节） | medium | mitigate | 门禁裁决 `[OK]`（36.7M 周下载 / 真实上游仓库 / 无 `postinstall` / 唯一依赖 `pend`）+ 无 `postinstall` 的本地复判（门禁四）+ 导出面契约断言（升版改 API 形态会在安装当刻可见） | closed |
| T-51-09 | Tampering | 双实例导致的**静默**解析差异 | high | mitigate | 精确钉版 + 门禁二的「嵌套副本不存在」判据；`prohibitions` 具名禁止用 `overrides` / 手工删目录「绕过」 | closed |
| T-51-10 | Elevation of Privilege | 依赖随包分发时的产物面被顺手改动（加 `asarUnpack` / 加正向 allowlist） | medium | mitigate | 门禁四断言 `asarUnpack` 恰两项且 `build.files` 全 `!`；既有护栏套件 `tests/test-builtin-skills-seeder.js` 作第二道 | closed |
| T-51-11 | Tampering | zip-slip（`..` / 绝对路径 / 盘符 / UNC / 反斜杠 / ADS / 控制字符 / 尾随空格与点 / 空段 / RTL） | high | mitigate | `validateEntryName` 八条判据（**先判原始字节**再判解码值；`path.posix.normalize` **之后**判 `..`）；12 类样本逐类一例；越界对照组真跑一次断言 root 外零新文件 | closed |
| T-51-12 | Tampering / Elevation | symlink entry 写出 root 外（yauzl 自身**不报错**） | high | mitigate | **两路独立**：central-directory 属性（先看 `versionMadeBy >>> 8 === 3` 再判 `(extAttr >>> 16) & 0xF000`）与解压后递归 `lstat` + `realpathSync`；两路都**拒绝整包**（断言点不是「跳过条目」）；落点再经 51-01 的写面判据做第三道 | closed |
| T-51-13 | DoS | zip bomb（高压缩比 / 2500 条目 / 深目录） | high | mitigate | **三道独立闸**：central-directory `uncompressedSize` 预检、**压缩比闸**（`MAX_COMPRESSION_RATIO`）、**累计字节闸**（边读边累加 + 流内 `rs.destroy()`）；entry 数闸与深度闸（按技能根相对计）；磁盘上界 ≤ `MAX_TOTAL_BYTES` | closed |
| T-51-14 | DoS / Tampering | `uncompressedSize === 0xFFFFFFFF` 静默通过（参与压缩比运算会得到 4 GiB 的荒谬值） | high | mitigate | 显式 `=== 0xFFFFFFFF` ⇒ `UNSUPPORTED_ZIP64`；加密条目与不支持的压缩方法经 `canDecodeFileData()` ⇒ `UNDECODABLE_ENTRY` | closed |
| T-51-15 | Tampering | 名字碰撞覆盖（大小写 / NFC-NFD） | high | mitigate | 全量 entry 名 `normalizedEntryKey`（NFD + 小写）查重 ⇒ 冲突即拒绝整包；两例用例（大小写 / NFC-NFD） | closed |
| T-51-16 | Tampering | 幽灵技能（frontmatter 解析失败但文件已落盘 ⇒ 加载管线整条丢弃） | high | mitigate | 落盘**前**自行 `yaml` 解析 + 类型检查（`null` / 数组 / 标量都显式判）+ 组装后全文（此路径 = 包内文件）64 KiB 预筛 + 落盘**后**经 `refreshSkills` 回读验证，失败即回滚 | closed |
| T-51-17 | Tampering | 注入类内容经 `description` 进每次请求的 system prompt | high | mitigate | `scanSkillText` 硬拒（description 跑注入 + 凭据两组 / body 只跑注入组 —— 49 D-08 的分字段口径）；命中 ⇒ `INJECTION_DETECTED` 整包拒绝 | closed |
| T-51-18 | Tampering | 拒绝路径静默（P12 / SKILL-06） | high | mitigate | 每条拒绝给机器可读码 + 可读原因（20 键码表一次定义）；限额类 message 含「哪个限额 + 当前值」；`51-06` 用闭合白名单表把码映射成文案且**不解析 message** | closed |
| T-51-19 | Information Disclosure / DoS | `readRawBody` 无上限读入内存 ⇒ 主进程 OOM | high | mitigate | 累积中拒收（`if (rejected) return;` 先于累加）+ `req.resume()`（**不** `destroy`、**不** `Connection: close` ⇒ 413 可达）+ `Content-Length` 快路径（仅加速）；内存上界 = `maxBytes` ≈ 32 MiB（如实成文，不声称零增长） | closed |
| T-51-20 | Denial of Service | import 分支的 400 路径把非 JSON body 喂给 `JSON.parse` 产生误导性错误 | medium | mitigate | 按 `Content-Type` 显式三分支（zip 三种 MIME / json / 其它），其它 MIME 直接给显式码；`readJsonBody` 的解析失败仍在既有 `catch` 里折叠成 400 + `code` | closed |
| T-51-21 | Elevation of Privilege | 落盘路径被 handler 或前端接管 | high | mitigate | `importUserSkill` 是**唯一**落盘实现（全仓出现位置恰 2 处：定义 + 调用，`main.js` / 前端各 0）；路径恒由 `path.join` + `getSkillsDir()` 计算；目录名一律用**校验后的 name**（绝不用包内原始目录名拼路径） | closed |
| T-51-22 | Tampering | 解压入口被复制成第二条（直链 SKILL.md 日后另写一条） | high | mitigate | `yauzl.openPromise(` 恰 1 处（源码判据）；三条来源都写 `<importDir>/pkg.zip` 再进同一入口；`51-05` 复用同一函数的 `scopeRel` 与 `<importDir>` 约定 | closed |
| T-51-23 | Tampering | 静默覆盖用户技能（同名时默认覆盖） | high | mitigate | `resolveImportConflict` 三档判定 + `conflict` 缺省时抛 `CONFLICT_UNRESOLVED`（不静默覆盖）+ 六条冲突矩阵用例（含「未给 conflict ⇒ 显式失败」） | closed |
| T-51-24 | Repudiation / Tampering | 覆盖中途失败导致旧技能丢失（「先删后移」） | high | mitigate | 备份 + 两段 `rename` + 第二步失败回滚（实测配方 C1/C2/C3）；回滚用例先读旧内容副本再逐字比对 | closed |
| T-51-25 | Tampering | 覆盖 managed 技能（用户无法从导入 UI 恢复） | medium | mitigate | 第三档判定**不允许覆盖** + 「永久遮蔽」提示 + 只允许改名 / 取消；用例断言 managed + `overwrite` 被拒 | closed |
| T-51-26 | Denial of Service | 并发实例互删进行中的预览（`WR-05` 的历史缺陷形态） | high | mitigate | 两种清扫模式分离（`own` 只删本进程登记项 / `stale` 只删 mtime 早于 2 × TTL 的残留）+ 陈旧性正反两例用例 | closed |
| T-51-27 | Repudiation | `importId` 被重放或长期悬挂（临时目录堆积） | medium | mitigate | 一次性句柄（提交第二次 ⇒ `IMPORT_NOT_FOUND`）+ TTL + 并发上限 + 成功 / 取消 / 过期三条路径都删目录与 Map 项 | closed |
| T-51-28 | Tampering | 失败路径静默（`error` 为空 / 只有通用文案 / 限额不说哪个限额） | high | mitigate | 21 键码表（含本计划补的 `INVALID_NAME`）+ `assertRejected` 统一断言（每条失败必须有非空 message）+ 限额类循环断言「名 + 当前值」+ 机械矩阵用例（缺码即指名） | closed |
| T-51-29 | Elevation of Privilege | 用 Node `fs` 绕过沙箱写面判据实现覆盖 | high | mitigate | 覆盖三步全用 `env.renameFile` / `env.remove`；门禁断言 `importUserSkill` 内出现 `fs.renameSync` / `fs.rm` 即报错 | closed |
| T-51-30 | Denial of Service | 数量闸被覆盖路径绕过（无限增长）或改名路径不计数 | medium | mitigate | 「覆盖豁免 / 改名计入」两条 + 读盘判据（改完磁盘立即生效，不依赖重扫） | closed |
| T-51-31 | Information Disclosure | SSRF：URL 指向内网 / 元数据服务 / 本地端口 | high | mitigate | https-only + 主机白名单（`www.` 归一化 + 精确成员）+ **逐跳** `isPrivateHost` + 跳数上限（超限**抛错**）+ 流式字节上限；用例覆盖「第二跳是私网」与「跳数超限」两类 | closed |
| T-51-32 | Bypass | 重定向绕过白名单（302 到白名单外的域） | high | mitigate | 逐跳三校验（协议 / 白名单 / 私网）在**每一跳**执行；302/308 链用例 + 「第二跳私网被拒」用例 | closed |
| T-51-33 | Spoofing | DNS rebinding（被校验的 IP ≠ 被连接的 IP） | high | accept | **无法在「先解析再请求」模型下根除** ⇒ D-16 要求如实披露（`51-07` 写进产品文档与威胁模型）；缓解 = 白名单把收益压到接近零 + https-only + magic bytes + 流式上限。**不得**写成「已缓解 / 已消除」 | closed (accepted risk) |
| T-51-34 | Tampering | `content-type` 伪造 / 误判（OS 识别的 `application/x-zip-compressed`、codeload 404 的 `text/plain`） | medium | mitigate | **magic bytes 为权威**（`50 4B 03 04` / `50 4B 05 06`），`content-type` 只用于把错误说清楚；raw 分支不校验 magic 而校验「非空 + 无 NUL」 | closed |
| T-51-35 | Denial of Service | 无上限流式下载（大文件 / 无限流） | high | mitigate | `Readable.fromWeb` + 累加计数，超 `IMPORT_LIMITS.MAX_TOTAL_BYTES` 即 `destroy` + 抛错；声明长度不可信 ⇒ 判据是**实读字节**；失败必 `unlinkSync` 半成品 | closed |
| T-51-36 | Tampering | 直链 SKILL.md 被写成第二条落盘路径 | high | mitigate | `prepareFromRawFile` 只产出 `pkgRoot`，之后是**同一段**后段；判据：`importUserSkill(` 恰 2 处、`yauzl.openPromise(` 恰 1 处、`locateSkillRoot(` 在 `ai-manager.js` 恰 1 处调用 | closed |
| T-51-37 | Tampering | 为通过测试而在生产路径注入放宽的 `hostWhitelist` / no-op `isPrivateHost` | high | mitigate | 门禁断言生产调用点未传这三个键（默认值表达式里接真实实现）；`prohibitions` 具名登记 | closed |
| T-51-38 | Repudiation | 限流 / 404 被折叠成通用错误 ⇒ 用户不知该怎么办 | medium | mitigate | 403 / 429 / 404 各自的 message（含 `retry-after` 与 x-ratelimit 头**若存在**）；「状态码分类先于 magic 校验」由用例正命题守住 | closed |
| T-51-39 | Tampering (XSS) | 预览渲染不可信字符串（含属性上下文） | high | mitigate | region 内**零** `innerHTML` / `insertAdjacentHTML` / 字符串模板拼 HTML；全部 DOM API 赋值（`textContent` / `el.title` / `setAttribute`）；类名 / id / dataset 全为白名单字面量；注入纪律判据 = **负命题 + 正命题**同时存在；uat 驱动用含 `<img onerror>` 的文件名做渲染快照断言 | closed |
| T-51-40 | Spoofing | RTL override / 控制字符让包内路径**视觉欺骗** | high | mitigate | 显示前净化（C0 / C1 / 双向控制符）**只作用于显示层**（判据仍用原始字节）+ 净化数 > 0 时行末可见提示（**禁止静默隐藏**）；uat 驱动断言提示文本出现 | closed |
| T-51-41 | Repudiation | 弹框打开期间的失败被写进被遮罩挡住的区级 hint ⇒ 静默失败 | medium | mitigate | 失败落点两分（弹框内 `#skillImportStatus` / 关闭后 E18）；`prohibitions` 具名登记 | closed |
| T-51-42 | Tampering | 用 `aria-disabled` 假装禁用 ⇒ 键盘 Enter 仍可提交 | medium | mitigate | 一律原生 `disabled`；门禁断言 region 内不出现 `aria-disabled`；uat 断言「未勾选时真实 `click()` 不提交」 | closed |
| T-51-43 | Availability | 禁用原因不可见（只写在 `title` / 依赖 hover） | medium | mitigate | `#skillImportGate` 的可见文本承载原因；uat 逐情形断言该文本非空且 `height > 0` | closed |
| T-51-44 | Tampering | 前端复刻改名校验规则 ⇒ 与主进程漂移 | medium | mitigate | 前端**只**消费后端 `invalid_name` 的 `code` + `message`；`maxlength` 与字数计数被禁止（会静默截断 / 第二份上限） | closed |
| T-51-45 | Repudiation | 诚实边界被降级为 tooltip / 折叠 / 省略 | medium | mitigate | 四条恒显文本各有源码判据（`不是安全边界` / `不代表该技能是安全的` / `不被强制，仅供参考` / `不构成额外权限`）；`prohibitions` 具名登记 | closed |
| T-51-46 | Tampering | CSP 下内联 `style` 被拦 ⇒ 元素常驻可见（`realm://` 的既有事故形态） | medium | mitigate | 初始隐藏走 `.ai-modal-overlay { display:none }` 类规则；显隐用 CSSOM 具体值；门禁核对 `settings.html` 的 `style=` 计数并逐处判定 | closed |
| T-51-47 | Repudiation | 诚实边界只写进文档、未上屏（或反之） | medium | mitigate | 四条已在 UI 上屏（`51-06` 的源码判据）且本节与 `AGENTS.md` 各写一份；第十三节 13.10 与 `AGENTS.md` 双向引用 | closed |
| T-51-48 | Spoofing | 文档沿用已被实测推翻的旧理由（`skills.sh` 承载闭环 / 上传闸拦炸弹 / 扫描通过即安全） | high | mitigate | 四条各有一条**负向 token 判据**（出现即转红），且第十三节要求「为什么」写成实测依据 + 指向研究章节 | closed |
| T-51-49 | Repudiation | 验证契约被勾成通过而未真跑 | high | mitigate | 四道门禁现场跑九个套件 + counts-parity 现场取值比对 + `wave_0_complete` 与勾选数判据（`status`/`nyquist` 保持不自证）；Manual-Only 表要求区分「已跑 / 未跑」 | closed |
| T-51-50 | Tampering | 文档写入本机绝对路径 / 运行期随机路径 / 具体 sha 作为可复现前提 | low | mitigate | 负向判据扫 `/Users/wxnacy` / `/Volumes` / `/private/var`；要求写路径形状或访问器名 | closed |
| T-51-51 | Tampering | 账本数字凭估算写入（与实测不符 ⇒ 门禁失真） | medium | mitigate | counts-parity 命令**现场跑套件取值**再比对；`cells` 下限 20 防「少写单元」 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (= high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## 验证方法与结论（L1 grep-depth）

威胁寄存器**在计划期成文**（7 份 PLAN 全部含可解析的 `<threat_model>` 块 ⇒ `register_authored_at_plan_time: true`），
共 **52 条唯一威胁**（high 32 / low 3 / medium 17；
49 mitigate + 3 accept）。

按 `workflow.security_asvs_level = 1` 的 **L1 grep-depth** 核验：逐条从 mitigation 文本抽取具名符号/控制，
在实现面（`ai-skills-manager.js` / `ai-manager.js` / `main.js` / `src/settings-page.js` / `src/settings.html` /
`src/styles/main.css` / `agent-workspace.js` / `package.json` / `tests/**` / 计划与验证产物）逐一定位。
**结论：全部 mitigate 条目的控制点均存在**；3 条 `accept` 记入下方 Accepted Risks Log 后判 closed。
⇒ `threats_open: 0`（无 OPEN 威胁落在 `high` 阻断线及以上）。

**短路径裁决（记录依据，避免被读成「漏跑深度验证」）**：`threats_open: 0` ∧ `register_authored_at_plan_time: true`
∧ `asvs_level == 1` ⇒ 按 `secure-phase` 的短路径规则**不派发 auditor**（L1 grep-depth 在此档位充分）。
这与本里程碑既有做法一致：`47-SECURITY.md` / `50-SECURITY.md` 同为 State B 新建、ASVS L1、`threats_open: 0`、未派 auditor。
（规则要求：ASVS **≥ 2** 时即便 `threats_open: 0` 也**必须**派 auditor 做 L2/L3 —— 本阶段不在该档位。）

**额外的运行期证据（超出 L1 grep-depth）**：本阶段收尾把 4 项人工 UAT 全部自动化，其中若干条直接以**真实运行期**
观测覆盖了威胁面：T-51-31/32/35/38（真实 GitHub zipball 导入、真实 404、403/429 文案）、
T-51-19（`readRawBody` 上限与 413 可操作性）、T-51-39/40/43（弹框在真实设置页 CSP 下渲染不可信字符串、
净化提示与禁用原因可见性，5 档窗口尺寸矩阵）。详见 `51-UAT.md` 与 `tests/.uat-out/*.json`。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-51-01 | T-51-03 | `realpathSync` 沿父目录链上溯的深度受路径段数**物理限制**（`MAX_PATH` 级），且仅对写目标调用一次；引入缓存换来的收益不足以抵消其失效面 ⇒ 接受 | GSD security (secure-phase 51) | 2026-09-15 |
| AR-51-02 | T-51-04 | `canonicalPath`（读面）的既有输出再校验与本次新写面函数的语义**可能被后续混淆**；本阶段不动 `canonicalPath`，并已在注释里交叉引用其先例 ⇒ 接受（属可维护性风险，非运行期风险） | GSD security (secure-phase 51) | 2026-09-15 |
| AR-51-03 | **T-51-33（high）** | **DNS rebinding 无法在「先 `dns.lookup` 校验、再 `net.fetch` 请求」的模型下根除**（被校验的 IP ≠ 被连接的 IP）。缓解措施已就位（主机白名单把收益压到接近零、https-only、magic bytes 校验、流式字节上限），但**不得**表述为「已缓解 / 已消除」；如实披露已写入 `docs/product/ai-skills.md` 与威胁模型（D-16） ⇒ **接受**。⚠️ 这是本阶段**唯一落在 `high` 阻断线上的 accept**，故其「接受」而非「闭合」必须显式可见 | 用户裁决（D-16 锁定决策） | 2026-09-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-15 | 52 | 52 | 0 | GSD orchestrator（L1 grep-depth，短路径，未派 auditor） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
