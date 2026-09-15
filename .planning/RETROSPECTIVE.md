# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

> 本文件自 v2.5 起建立（v1.0–v2.4 未做里程碑回顾，其经验散落在各 phase 的 REVIEW/UAT 与 `.planning/debug/` 中）。

## Milestone: v2.5 — AI 网络搜索功能

**Shipped:** 2026-09-10
**Phases:** 6（40-45） | **Plans:** 38 | **Tasks:** 76

### What Was Built

- AI 联网搜索与网页抓取：`search-manager.js`（provider 注册表 + 速率限制器 + SSRF 防护 + 结果标准化）、`web_search` 工具（4 家 API provider + Auto Fallback + 诊断 attempts）、`web_fetch` 工具（fetchUrl + turndown 转 Markdown + 逐跳 SSRF 校验）、设置页「网络搜索」配置区
- AI 历史对话管理：独立 SQLite 对话存储 + 一对话一 Agent + 列表/切换/删除/重命名 + 消息归一化双形状（显示/注入分离）
- AI 三层条目记忆：USER.md / 全局 MEMORY.md 冻结快照注入 / 容器 `memories/*.md` 按需 `memory_read`，含写入威胁扫描与容器删除联动
- 播放器视频缓存与本地媒体库：`/proxy` 分片级磁盘缓存（FIFO 淘汰 + 强淘 + 哈希校验 + 断网降级照播）+ 观看历史精确续播 + 独立播放窗口 localhost 化
- 媒体任务中心：直播录制（m3u8 轮询追分片）+ mux.js TS→fMP4 转封装 + `realm://tasks` 任务页 + 主窗口角标 + 关窗/退出两级确认
- AES-128 加密 HLS 解密转封装 + B 站直播 fMP4 转录（EXT-X-MAP init 拼接 + tfdt rebase 时间轴归零）

### What Worked

- **gap-closure 计划模式**：Phase 42/43/44/45 的 UAT gap 都以 `--gaps` 计划的形态闭合，gap 有稳定 id（G-4x-N）可与 UAT 条目反向对账，复盘时能直接追溯"哪个 gap 由哪个 plan 关闭"
- **code-review 后置 + 用户决策止损**：Phase 44 的 CR-06/WR-07 与 3 项 UI minor 在评估「改动风险 vs 收益」后明确选择"仅修注释"/"记债"，避免了在刚修复的 SIGSEGV 时序区再次改动
- **纯逻辑模块去 Electron 化**：m3u8 parser、media-task-manager、media-cache-manager 做成可单测纯模块（Wave 0 单测），使 80% 的媒体逻辑能在 `node --test` 下回归而不必真机
- **诊断留痕**：Electron UAF 这类 heisenbug 先 `find_root_cause_only` 出根因文档（`.planning/debug/stop-record-sigsegv.md`，含 dSYM 全帧符号化），再决定修复路径，避免了盲改

### What Was Inefficient

- **多轮 UAT 记录堆积在同一文件**：`44-UAT.md` 累积 4 轮且共用 `### N.` 编号，历史 issue/skipped 会被 `uat-predicate` 永久计入阻塞，收官时需人工加轮次前缀才过门禁（详见下文教训）
- **verification 指纹随代码漂移**：Phase 44/45 的 `covered_digest` 在后续任何源码改动后即 stale，收官前必须重算；这是设计使然，但每次都要记起"改完被覆盖文件再算 digest"的顺序
- **阶段乱序完成**：45 先于 44 完成，导致 `phase complete 44` 把 `next` 推断成"plan phase 45"（其实已完成），STATE/state.json 需人工纠正
- **记账债在收官时集中暴露**：Phase 43 的 UAT 在 2026-09-04 就已闭合（43-04/43-05 执行 + VERIFICATION passed 15/15），但 UAT 文件的 test 结果与 gap 状态从未回填，直到 v2.5 收官才被发现并补账

### Patterns Established

- **验证指纹纪律**：`VERIFICATION.md` 的 `covered_files` 必须在后续 gap 计划/评审文档产生后回填，并按当前字节重算 `covered_digest`；顺序是"先改完全部被覆盖文件，最后算 digest"
- **UAT 归档约定**：同一 `-UAT.md` 内多轮记录，归档轮次的条目加 `[Round N]` 前缀（内容一字不改），使门禁只认当前轮次
- **UI 评审分档处理**：Top-N（有功能影响的）修，minor 按"纯样式/交互行为/结构机制"三档评估回归成本后再决定改或记入 `Acknowledged Gaps`
- **弹框居中约定**（Phase 42 沉淀进 AGENTS.md）：主窗口一律原生 `<dialog>` + 显式 `margin: auto`；`realm://` 页面因 CSP 用 div 遮罩 + CSSOM 切换

### Key Lessons

1. **收尾门禁失败常是记账问题而非质量问题**：`phase complete` 报 stale / `uat-passed=false`，先查 `covered_files` 是否滞后、UAT 是否多轮混编，而不是怀疑实现
2. **改完被指纹覆盖的文件再算 digest**：清单里含 `*-UAT.md` 等你会去改的文件时，顺序错了就要重算第二遍
3. **上游 heisenbug 只能收窄不能确定性修复**：用"结构性收窄 + 版本升级"双层防御，并把诊断日志留在 dev 环境（生产零输出，避免泄 URL）
4. **"记录即可"是合法决策**：评审项按改动风险分级后，明确接受并写入 `Acknowledged Gaps` 比勉强修改更负责任

### Cost Observations

- Model mix: 未采集（本项目未开用量遥测）
- Sessions: v2.5 区间 495 commits，跨多个会话
- Notable: 大量时间花在"收官与对账"而非写码——v2.5 最后一天（2026-09-10）的工作是技术债修复 + 状态对账 + 里程碑归档

---

## Milestone: v2.6 — AI 助手技能（Skill）能力

**Shipped:** 2026-09-15
**Phases:** 6 | **Plans:** 38

### What Was Built
- 技能目录落进 agent 工作区硬沙箱，接进 pi-agent-core 原生 Skill 层，`<available_skills>` 注入 system prompt 第 4 段；模型看到的 `<location>` 经真实沙箱 `readTextFile` 验证可打开
- 随包自审过的两个内置技能（find-skills 零安装语义改写版 + skill-creator 固定 SHA 快照）经原子播种进 `managed-skills/`，并把「零安装语义」做成可机器检查的门禁
- `/` 面板并入技能列表 + `/skill:name [args]` 显式调用进对话历史 + 模型按 description 自动匹配；运行期新增的技能**至多一次重扫**后当场可调用
- `manage_skill`（create / update / delete）落在零 electron 依赖的写权威面：seeded 按播种登记表保护、字段分离扫描、沙箱原子写、单次刷新链
- 设置页技能管理区 + `/api/skills/*` 双入口读同一权威（`realm://` guest 走 HTTP + token / 主窗口走 IPC），启停与卸载带乐观翻转与失败回滚
- 用户技能导入管线：本地 zip 与网络地址两条通道汇进**同一段**解压校验与落盘；两阶段预览 + 恶意包整包拒绝 + SSRF 逐跳防护

### What Worked
- **`/gsd-verify-work` 的真实运行期驱动是本里程碑最大的增量**：4 项人工 UAT 全部自动化后立刻抓到「逐行核对 + 模块级实跑」这条链照不到的运行期缺陷（`CR-02`：`downloadPackage` 无绑定 ⇒ 网络导入整条腿 100% `ReferenceError`）
- **verifier 的独立复跑纠正了作者的自证**：把一条「21/21 全过」拆成「6 次 1 红的分支相关假判据」，并逼出「环境读数 vs 判据」的分账纪律
- 把「环境读数只登记不断言」「驱动收尾按精确 PID 收自己的子进程」「开跑前登记并发实例」写进驱动文件头与 STATE ⇒ 可复用的驱动范式

### What Was Inefficient
- **收尾时跳过了 `verify:post` 的 hook dispatch**，Phase 51 因此漏跑 `security_enforcement=true` 强制的 security step，事后补跑才产出 `51-SECURITY.md`
- **把 ROADMAP 的里程碑标头当自由文本改**，破坏了 `milestone.complete` 的相位窗口解析（"the ROADMAP window for v2.6 is truncated"）并让 `init.manager` 返回 `phases: []` ⇒ 工作流那条 `all_phases_verified` 门禁**空集恒真**；回退后才恢复，且归档时还要为此走一次 shrink 许可
- 为刷新 verification digest 多跑了 **4 轮 verifier**（每轮改一个 `covered_files` 内文件就再 stale 一次）
- 并发会话共用 `realm-dev` userData 让驱动读数带噪，一轮间歇红耗费了大量定位成本

### Patterns Established
- **运行期集成缝必须由真实运行期驱动覆盖**（模块级测试密集 ≠ 覆盖；**形态断言 ≠ 绑定断言**）
- **环境读数与判据分账**：做不出可靠两侧判据的观测量一律「只登记不断言」——给读数设阈值等于造一条假判据
- **uat 驱动自身要有卫生**：开跑前登记并用实例数、收尾按精确 PID 收掉自己的子进程、「未复现 ≠ 零抖动」
- **改 `.planning` 受保护产物前先探一次解析器**（`milestone complete <v> --dry-run`）

### Key Lessons
1. 真实运行期驱动能在几分钟内发现模块级测试全绿也照不到的缺陷 —— 收尾不要把它当「锦上添花」
2. **verifier 的复跑次数就是判据可靠性的证据**：一条只跑一次就绿的阈值断言，很可能只是碰对了分支
3. 驱动会污染驱动：一个 `PPID=1` 的孤儿 Electron 实例足以让后续每一轮读数带噪
4. 受保护产物的**标头也是解析器输入**，不是展示文本；改 headline 前先 dry-run

### Cost Observations
- Model mix: 未采集
- Sessions: 未采集
- Notable: `CR-02` 这类「接线类」缺陷的成本集中在**发现**而非修复（修复是 1 行），而发现它需要真实运行期驱动 + 独立 verifier 两条链

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0–v2.4 | 未采集 | 39 | 未建立回顾文档；流程从"直接执行"演进到 discuss → plan → execute → verify 全链 |
| v2.5 | 未采集 | 6 | 引入 gap-closure 计划闭环、code-review 后置、UI 评审、验证指纹与 UAT 门禁对账 |
| **v2.6** | 未采集 | 6 | 引入**真实运行期 UAT 驱动**（`uat-*` 三支）、「环境读数 vs 判据」分账、驱动自身卫生（孤儿实例守卫）、里程碑归档前 dry-run 探解析器 |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v2.5 | 媒体套件 188 + 导航/附件 197 全绿 | 未采集（无覆盖率工具） | 2（turndown；mux.js 已在 v2.4 引入） |
| **v2.6** | 技能域 7 套件（55/198/115/49/41/116/50）全 fail 0；UAT 三驱动 29+18+48 全绿 | 未采集（无覆盖率工具） | 2（`yauzl`；`yaml` 精确钉版） |

### Top Lessons (Verified Across Milestones)

1. **先锁根因再改代码**：多个阶段（Phase 21/24/44）的返工都源于"症状驱动修改"，而写根因文档的阶段返工显著更少
2. **跨进程契约必须双向注释**（300ms 延时、basename 提取、文案前缀等），否则一端改动静默劣化另一端
