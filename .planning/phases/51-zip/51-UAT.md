---
status: complete
phase: 51-用户技能导入管线（zip + 网络地址）
source: [51-VERIFICATION.md, 51-05-SUMMARY.md, 51-06-SUMMARY.md, 51-07-SUMMARY.md]
started: 2026-09-15T10:05:22Z
updated: 2026-09-15T12:15:00Z
---

## Current Test

[testing complete]

## Tests

> 四项人工检查点在本次会话中**全部自动化化**，逐条由 `tests/uat-51-*.js` 三支驱动承重
> （`uat-` 前缀 ⇒ 永不被 `test-*.js` 套件拾取，只在需要真实运行期时手工跑）。
> 证据固化进仓：`tests/.uat-out/uat-51-import-live.json` / `…-limits.json` / `…-modal-sizes.json`。

### 1. 真实 GitHub 端到端成功路径（网络地址导入）

expected: |
  设置页 → AI → 技能管理 → 导入技能 → 网络地址；填一个含**恰好一个**技能根的仓库
  `tree/<ref>/<path>` 地址 → 预览六字段齐备 → 确认 → 组件列表出现该技能、`/` 面板可见、
  下一条消息技能进 prompt；zipball 顶层 `<repo>-<ref>/` 前缀被剥离；落盘 `skills/<name>/` 并回读可见。
  交叉核对：`curl -sIL <zipball url>` 确认前缀形态。
result: pass
automated_by: tests/uat-51-import-live.js（29/29）
evidence: |
  - **Node 侧真实交叉核对**：`codeload.github.com/anthropics/skills/zip/refs/heads/main` 下载
    3,988,166 B / 512 entry，顶层前缀**恰为单一个** `skills-main/`；`skills-main/skills/pdf/SKILL.md`
    是该 scope 下**唯一**的 SKILL.md（8,072 B，sha256 `9f78b835…d85b9c`）。
  - **真实 UI 全链路**：`https://github.com/anthropics/skills/tree/main/skills/pdf` → 预览 **927 ms**
    进入就绪态；六字段齐备（技能名=`pdf` / 落点=`将写入 skills/pdf/` / 描述 / 目录 / 体积
    `解压后合计 57.3 KB · 单文件最大 16.3 KB` / 脚本）；无同名冲突（realm-dev 无 `pdf`）。
  - **落盘断言**：`agent-workspace/skills/pdf/SKILL.md` 存在，**sha256 与上游逐字节相同**
    （`9f78b835…d85b9c`）⇒ zipball 的 `skills-main/` 前缀与 `scopeRel` 都被正确剥离
    （落点不是 `skills/skills-main-skills-pdf/`；`skills/` 下无任何 `skills-main*` 目录）。
  - **回读 / 列表 / 面板**：技能目录 5 个条目回读可见；提交后区级 hint `已导入「pdf」`；
    组件列表出现该技能且总数 19 → 20；`/` 面板技能行出现 `/pdf`。
  - **「下一条消息技能进 prompt」（真实发送 + 旁路捕获）**：发送 `/skill:pdf 请总结这个技能的第一节`
    → 在**主进程侧旁路捕获**真实 provider 请求（`https://api.xiaomimimo.com/v1/chat/completions`，
    API Key 由环境变量 `XIAOMI_API_KEY` 注入），请求体含
    `<skill name="pdf" location="…/agent-workspace/skills/pdf/SKILL.md">` 块**与该技能的真实正文**
    （上游 SKILL.md 首句逐字命中）；模型真实回复即在讲 PDF 技能第一节的 Quick Start。
    捕获是**只读观测**（转发原请求、不伪造响应），未改写任何字节。

### 2. 真实 GitHub 403 / 429 限流文案的可操作性

expected: |
  连续多次导入直到命中未鉴权限流（60 req/h）⇒ 提示含「限流」与重试指引，且**不是**静默失败。
result: pass
automated_by: tests/uat-51-import-live.js（同驱动 ⑥ 段）
evidence: |
  - **真实 404**（不靠替身）：`tree/zzq51-no-such-ref-9f3a/skills/pdf` ⇒ 真实 codeload 404 ⇒ 状态行
    `地址或 ref 不存在（HTTP 404），响应类型 text/plain; charset=utf-8。若这是仓库地址，请确认默认分支名（已尝试 main / master）`
    （danger 态、非空、可见、预览未进就绪态）。
  - **403**：`访问被拒（HTTP 403），剩余配额 0，请稍后重试或改用本地上传`
  - **429**：`触发远端限流（HTTP 429），请于 42 秒后重试`
  - 三条都经**真链路**：白名单 → 逐跳私网校验 → 跳数 → 状态分类 → HTTP 序列化 → 设置页文案表
    （`download_failed` 属 `SKILL_IMPORT_DETAIL_MESSAGE_CODES` ⇒ 后端原文原样上屏）→ 状态行渲染。
boundary: |
  ⚠️ **403 / 429 未真实触发 GitHub 侧限流**，属替代路径（证据里标 `substituted: true`）：
  导入链路只打 `codeload.github.com`，**不打 `api.github.com`**；未鉴权的 60 req/h 配额打在
  `api.github.com`，与 codeload 不是同一配额域 ⇒ 「打满 api 配额」不会让导入返回 403。
  故 403 / 429 用 `net.fetch` 单点替身返回**真实形状**的响应头
  （`x-ratelimit-remaining: 0` / `retry-after: 42`），**其余全部走真链路**。
  本项的可操作性判据（含「限流」与重试指引、非静默失败）是机械可判的，已逐条断言。

### 3. 32 MiB 上传在本机 Electron 的真实耗时与内存峰值

expected: |
  dev 模式打开 DevTools Performance，上传一个接近 32 MiB 的包 ⇒ 记录耗时与堆曲线；
  确认**无**「先 `arrayBuffer()` 再判大小」的峰值。
result: pass
automated_by: tests/uat-51-import-limits.js（21/21）
evidence: |
  - **A 近限成功**：包在 **guest 内现场生成**（store 方式 + 正确 CRC32，**不经 CDP 传字节**），
    解压总量 31,744,134 B（< 32 MiB 上限）、32 条目；上传 **906～1059 ms** 走到就绪态。
  - **A 正命题**：主进程 RSS 增量 **95,109,120 B（≈90.7 MiB）** ⇒ 这 ~30 MiB 真的过了线（非空跑）。
  - **确定性源码判据**：`src/settings-page.js` 的 Phase 51 导入区（45,698 B，**已剥注释**）内
    `arrayBuffer` / `readAsArrayBuffer` / `FileReader` **各 0 次**，且本地上传分支的 `body` 逐字是
    `source && source.file`（File 直传）+ 显式 `Content-Type: application/zip`；
    主进程 `readRawBody`（1,282 B）含 `Content-Length` 预检与 `req.resume()`，同样零 `arrayBuffer`。
    ⇒ 「先 `arrayBuffer()` 再判大小」在该路径上**不可能发生**。
  - **B 超限拒绝**：64 MiB 包（67,111,340 B）⇒ 状态行 `导入失败：请求体超过上限（33554432 字节）`
    （danger 态、非静默失败）；主进程 RSS 增量 **1,409,024 B** ⇒ 内存上界如实为 `maxBytes`，
    不随 body 线性增长（本次走 `Content-Length` 零字节快路径）。
  - **两侧可红（非恒真自证）**：同一仪器（主进程 RSS）在 A 读到 ≈90.7 MiB、在 B 读到 ≈1.3 MiB，
    而 **B 的 body 更大** ⇒ 判据有判别力。
  - 全程零 `pageerror`、零 `unhandledRejection`；关闭预览后 `.tmp/` 无残留。
boundary: |
  ⚠️ **guest JS 堆曲线只登记、不断言**：Chromium 的 `performance.memory.usedJSHeapSize` 是量化值
  且与 GC 强耦合 —— 实测标定（对同一个 File 显式 `await file.arrayBuffer()`）的峰值增量是**负值**
  （构造期垃圾在被测窗口内被回收，量级盖过拷贝本身），做不出可靠的两侧判据。
  故改用「确定性源码判据 + 主进程 RSS 两侧判据」承重。绝对耗时同样只登记不断言（本机环境相关量）。

### 4. 其余窗口尺寸档下的预览弹框布局

expected: |
  在设置页真实 CSP 下换极窄 / 超宽窗口复核预览弹框（目录树折叠、脚本标红、必勾、冲突三选一）⇒
  各尺寸档下弹框总高 ≤ 80vh、滚动只在预览区、动作区不横向溢出、按钮不被裁切。
result: pass
automated_by: tests/uat-51-import-modal-sizes.js（48/48）
evidence: |
  - **5 档尺寸矩阵**（窗口尺寸由**自标定偏移**反推：请求 1400×900 → guest 实测 1159×786
    ⇒ 偏移 241×114，即侧栏 240 + 内容边界）：
    | 档 | guest 实测内容尺寸 | 弹框高 / 0.8×视口高 |
    |---|---|---|
    | 极窄 | 420×620 | 496.0 / 496.0 |
    | 窄 | 600×700 | 560.0 / 560.0 |
    | 基线 | 880×820 | 656.0 / 656.0 |
    | 宽 | 1280×900 | 720.0 / 720.0 |
    | 超宽 | 1920×1080 | 864.0 / 864.0 |
  - 每档逐条独立判定全绿：总高 ≤ 80vh（且 `display !== none` 与非零高为前提）；
    滚动只在预览区（置 `scrollTop` 后变大 + 页面级滚动不动 + 可滚动容器候选集**恰为**
    `{skillImportPreview}`）；动作区 `scrollWidth ≤ clientWidth`；两按钮同排、不重叠、
    宽度 > 0、`right ≤ innerWidth`；禁用原因文本可见且位于按钮排上方；弹框本体不横向溢出；
    四类元素（目录树展开开关 / 脚本标红行 / 必勾区 / 冲突三选一 3 个 radio）在该档仍齐备。
  - **反恒真**：各档实测 `innerWidth` = `[420, 600, 880, 1280, 1920]`（5 个互不相同）、
    `innerHeight` = `[620, 700, 820, 900, 1080]`；非退化档 5/5、退化档 0
    ⇒ 矩阵真的是多档，不是同档测 5 次。
  - 目录树折叠非静默截断：折叠态 50 行 + 展开开关存在；展开后 64 行（文件 62 + 目录 2），
    末尾条目 `f059.txt`、`SKILL.md`、`scripts/run.sh` 都在 DOM 里。
  - 全程零 `pageerror`；收尾清理冲突探针技能。
boundary: |
  本驱动**关闭 AI 侧栏**后取数（否则窗口宽度→guest 宽度被侧栏宽度整体偏移，
  实测把窗口设成 480 时 guest 只拿到 0 ⇒ 矩阵名不副实）；该前提已在断言里前置声明。
  `51-UAT.md` 原文记「52 项断言已在单一尺寸档实测通过」，本驱动把该面补成 5 档矩阵。

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-51-1
  truth: "网络地址导入（zipball 与直链 SKILL.md 两条路径）在真实运行期可用"
  status: resolved
  resolved_by: 本次会话内直接修复（`ai-manager.js`）
  resolved_at: 2026-09-15
  reason: |
    User reported（`/gsd-verify-work 51` 的自动化驱动实测）：`导入失败：downloadPackage is not defined`
  severity: blocker
  test: 1
  root_cause: |
    `ai-manager.js` 里 `downloadPackage` **只有调用、没有任何绑定**。三处调用点
    （`:1857` / `:1868` 的 zipball 分支、`:1891` 的直链 SKILL.md 分支）裸写标识符，
    而该文件对 `ai-skills-manager.js` 的其余符号一律走 `getAiSkillsManagerLazy()`。
    运行期抛 `ReferenceError` ⇒ **所有**网络地址导入 100% 失败；本地上传（zip 文件）不受影响。
  artifacts:
    - path: "ai-manager.js"
      issue: "previewSkillImport 内三处 downloadPackage(...) 调用无绑定（引入于 0b8bc1d / 51-05，从未绑定过）"
  missing:
    - "在 `const skillsManager = getAiSkillsManagerLazy();` 之后加 `const { downloadPackage } = skillsManager;`"
  fix: |
    已在 `ai-manager.js:1841` 加显式解构 + 警示注释（保留调用点逐字 `downloadPackage(undefined, …)`，
    否则 `tests/test-skills-import-net.js:813` 的「首参逐字 undefined」源码门禁会转红）。
  verification: |
    修复后 `tests/uat-51-import-live.js` 由 12/21 转为 **29/29**；`tests/test-skills-import-net.js`
    仍 50/50；7 个套件 + counts-parity 全绿。
  why_guards_were_green: |
    ① 模块级单测直接打 `aiSkills.downloadPackage(deps, …)`（`ai-skills-manager` 的导出面），
       打不到 `ai-manager.js` 这条**集成缝**；
    ② 已有的源码门禁只断言调用**形态**正确（首参逐字 `undefined`、命中数 > 0），
       **不检查标识符是否有绑定**；
    ③ 仓内**无任何 `no-undef` 类静态检查**（无 ESLint / 无 lint script），
       `node --check` 只做语法检查 —— 未绑定标识符是运行期 ReferenceError。
    这三条已作为「未闭合项」登记在 `51-REVIEW.md`。

## 需要同时决定的非 gap 事项（verifier 提请裁决，未计为 gap）

- **CR-01（BLOCKER，已在 `51-REVIEW.md` 登记，verifier 独立复现）**：`src/settings-page.js:6844` 覆盖
  `skillImportTarget.importId` 时未归还上一个句柄 ⇒ **同一弹框会话内第 4 次连续预览 100% 返回
  `too_many_pending`**，且 UI 没有「取消上一个预览」的入口可自救（实测：句柄数 1→2→3 → 报错，
  残留 4 个 `.tmp/skill-import-*` 目录）。它**不落在任何 must-have 真值上**（51-04 的句柄真值
  「三态可达且各有显式码」成立），故未计为 gap。
  本次自动化**未触发** CR-01（Test 1 的预览被 commit 消费、Test 2 的三条在下载期即失败不产生句柄），
  本次三项驱动合计 4 次预览也未触及 `MAX_PENDING_IMPORTS = 3`。
  **若认为「重复预览后无自救路径」属于目标未达** ⇒ `/gsd-plan-phase 51 --gaps` 把它升为 gap。
- **WR-01 / WR-02 / WR-03**：实现与文档/注释的三处漂移（禁用名单在回读刷新时被 `_cache` 丢掉 /
  压缩比口径「整包 vs 按 entry」/ `manage_skill` 是否获得技能域模式）——均已在 `51-REVIEW.md` 登记。
