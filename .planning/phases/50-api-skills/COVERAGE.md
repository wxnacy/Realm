No external API integration: `/api/skills/*` 是本应用自建 `http.createServer` 的 localhost 内部端点（token 鉴权），技能读写全在 `agent-workspace/managed-skills/` 硬沙箱内，不调用任何第三方 HTTP API、SDK 或云服务。

（完整说明：管理面两个写子路由（`set-disabled` / `uninstall`）与读路由 `list` 全部挂在 main.js 的 `realmServer` 上，仅监听 localhost，鉴权走与 `/api/history`、`/api/favorites` 同款的 URL token；判据与投影逻辑住 `ai-skills-manager.js`（零 electron 依赖），handler 只做转发。技能文件的读写路径经 `agent-workspace` 硬沙箱的 FileSystem 原语收敛在 `managed-skills/<name>/`。唯一的外部依赖是既有的 `@earendil-works/pi-agent-core` 本地包 —— frontmatter 解析与技能加载，经包根动态 import，非网络 API。设置页侧另走 `realmAPI` IPC，同样不涉及外部服务。

判定来源：orchestrator 预跑的 api-coverage 探针在 Phase 50 范围命中的唯一信号是计划 prose 中的字符串 `DOM API`（`[A-Z]\w+ API` surface 规则命中，`DOM` 不在 stopwords / descriptor 词表内）—— 属误报，非外部 API 集成。与 Phase 49 同款误报，故此处按「探针 detected=true 但确无外部 API」分支写出带理由的声明，不伪造矩阵行。）
