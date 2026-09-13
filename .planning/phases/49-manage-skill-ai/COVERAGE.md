No external API integration: Phase 49 `manage_skill` 只写本地文件系统（`agent-workspace/managed-skills/<name>/SKILL.md`，经 `agent-workspace` 硬沙箱的 FileSystem 原语）并复用进程内的技能加载管线（`ai-skills-manager.refreshSkills`）；它不调用任何第三方 HTTP API、SDK 服务端点或云服务，唯一的外部依赖是既有的 `@earendil-works/pi-agent-core` 本地包（frontmatter 解析与技能加载，经包根动态 import，非网络 API）。

（判定来源：orchestrator 预跑的 api-coverage 探针在 Phase 49 范围命中的唯一信号是既有计划里 UI-SPEC 注入纪律句中的字符串 `DOM API` —— 属误报，非外部 API 集成；故此处按「探针 detected=true 但确无外部 API」分支写出带理由的声明，不伪造矩阵行。）
