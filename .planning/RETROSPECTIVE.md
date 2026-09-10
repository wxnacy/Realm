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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0–v2.4 | 未采集 | 39 | 未建立回顾文档；流程从"直接执行"演进到 discuss → plan → execute → verify 全链 |
| v2.5 | 未采集 | 6 | 引入 gap-closure 计划闭环、code-review 后置、UI 评审、验证指纹与 UAT 门禁对账 |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v2.5 | 媒体套件 188 + 导航/附件 197 全绿 | 未采集（无覆盖率工具） | 2（turndown；mux.js 已在 v2.4 引入） |

### Top Lessons (Verified Across Milestones)

1. **先锁根因再改代码**：多个阶段（Phase 21/24/44）的返工都源于"症状驱动修改"，而写根因文档的阶段返工显著更少
2. **跨进程契约必须双向注释**（300ms 延时、basename 提取、文案前缀等），否则一端改动静默劣化另一端
