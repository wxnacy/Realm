# API Coverage — 技能导入的外部来源面（GitHub 下载端点 + 主机白名单）

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> **检测器判定：** `node gsd-core/bin/lib/api-coverage.cjs --json`（scope = `51-CONTEXT.md` + ROADMAP §Phase 51）
> 返回 `{"detected":true,...}`（信号词 `Contents API`）。**该信号是「显式不做」的否定语境**，但本阶段
> 确实**集成了一条外部网络面**（`https://github.com` / `codeload.github.com` / `raw.githubusercontent.com`
> 的包下载）⇒ 按协议**产出矩阵而非空声明**。矩阵的每一行都是 `D-05` / `D-06` / `CR-1` / `CR-1b` 的落点。

**被集成的服务：** GitHub 的匿名只读内容端点（zipball / raw）。**不引入**任何 SDK、不鉴权、无服务端信任根。

| capability | decision | reason |
|---|---|---|
| `github.com/<o>/<r>`（含 `/tree/<ref>/<path>`）→ codeload zipball | INTEGRATE | D-06：仓库/目录地址一律转 zipball，**不做** Contents API 列一层 |
| `github.com/<o>/<r>/blob/<ref>/<path>` → raw 直链 | INTEGRATE | 实测 GitHub 自己在 HTML 响应里给出同口径的 `x-raw-download` 头 |
| `raw.githubusercontent.com/…/SKILL.md` 直链 | INTEGRATE | D-07：落到 `importDir` 后进**同一个**树校验 + 定位 + 落盘函数 |
| `codeload.github.com` zipball 下载（含 `zip/main` 裸 ref 形态） | INTEGRATE | 实测直连 200 + `application/zip`，且**不吃** API 限流 |
| 302 跳转链（`github.com/…/archive/….zip` 一类）与逐跳白名单校验 | INTEGRATE | 逐跳校验 + 跳数上限，超限抛错（顺手修 `search-manager.fetchUrl` 的「带 3xx 掉出」缺陷） |
| 403 / 429（未鉴权限流 60 req/h）与 404（ref / 地址不存在）的原因区分 | INTEGRATE | USER-08：失败给真实原因，限流文案须提示重试 |
| `api.github.com`（`search/repositories`、`repos/…/contents`） | OPT-OUT | explicitly out of scope —— D-06 不做 Contents API；导入管线无载荷语义 ⇒ CR-1b：**显式拒绝**并回 `unsupported_url` |
| `objects.githubusercontent.com` | OPT-OUT | not needed yet —— 白名单保留为纵深（release/asset 重定向落点），本阶段不构造指向它的 URL |
| `skills.sh` | OPT-OUT | not needed yet —— CR-1 裁决：保留为未来兼容；实测 308 → `www.skills.sh`，本阶段**无消费者** |
| `www.skills.sh` | OPT-OUT | not needed yet —— 同 CR-1；主机匹配规范化为「去 `www.` 前缀后比对」，使该条目**可达**而非永远被自己的逐跳校验拒 |
| 仓库级 Contents API「列一层」+ 多技能勾选安装 | OPT-OUT | explicitly out of scope —— ECO-01 / v1.x；多技能包走「拒绝 + 提示改用 `tree/<ref>/<path>`」（CR-8） |
| GitHub release / asset 下载（`/releases/download/...`） | OPT-OUT | not needed —— 技能包的合法来源是仓库与 raw 单文件，release 附件属另一类产品语义 |
| Git LFS / submodule 内容拉取 | OPT-OUT | not needed —— zipball 不含 LFS 实体与子模块内容；命中即按「包内无技能根」拒绝 |
| 技能包签名 / 校验和 / 发布者验证 | OPT-OUT | explicitly out of scope —— REQUIREMENTS Out of Scope；无服务端信任根 |
| 应用内技能市场 / 排行榜 / 遥测 | OPT-OUT | explicitly out of scope —— REQUIREMENTS Out of Scope |

**覆盖判据（本阶段的机械验收）：** 上表 `INTEGRATE` 的每一行都在 `51-05-PLAN.md`（网络面）与
`51-03-PLAN.md`（分流后汇入的同一管线）里有**逐行对应用例**；四类 `OPT-OUT` 中「显式拒绝」的两条
（`api.github.com`、白名单外主机）有拒绝用例与 `unsupported_url` 文案；其余 `OPT-OUT` 均为
「本阶段不构造指向它的 URL」并在 `docs/product/ai-skills.md` 的导入章节如实成文（`51-07-PLAN.md`）。
