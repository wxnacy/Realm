# API Coverage — `@earendil-works/pi-agent-core` Agent Skills 原语

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> 检测器结论：`api-coverage.cjs` 对本阶段 scope 判定 `detected: true`
> （signals: `(surface)` + `api`、`wiring` + `sdk`）。因此本阶段按「外部 API 集成」
> 处理，逐项枚举该 SDK 的**技能能力面**并给出决定。
>
> 版本锚定：`@earendil-works/pi-agent-core@0.84.3`（本机实装；`package.json` 声明 `^0.84.3`）。
> 升版后本表需重新核对（`loadSkills` 递归语义、`includeRootFiles` 硬编码、诊断字段名均可被上游改动）。

| capability | decision | reason |
|---|---|---|
| `loadSkills(env, dirs)` | INTEGRATE | 经 `loadSourcedSkills` 间接消费；`skills/` 与 `managed-skills/` 的实际扫描入口 |
| `loadSourcedSkills(env, inputs, mapSkill?)` | INTEGRATE | 双来源（`user` / `managed`）加载的唯一入口，返回 `{skill, source}` 包装对象并给诊断补 `source` |
| `formatSkillsForSystemPrompt(skills)` | INTEGRATE | `<available_skills>` 段的唯一生产者（含 `escapeXml`）；禁止自拼（SKILL-02 / D-02） |
| `formatSkillInvocation(skill, extra?)` | OPT-OUT | 显式调用面 —— `/skill:name` 把技能正文作为 `<skill>` 块注入对话属 Phase 48（DISC-02 / DISC-03）；本阶段 scope fence 明确排除 |
| `Skill.disableModelInvocation` | INTEGRATE | 只读字段；`=== true` 的技能不进 prompt 段、不占预算（SKILL-02 / D-10 优先级语义） |
| `SkillDiagnostic` 透传（`{type, code, message, path}`） | INTEGRATE | SKILL-06 禁止静默失败；严重度字段是 `type`（非 `level`），合并需显式映射 |
| `Skill.allowedTools` | OPT-OUT | SDK 0.84.3 的 `Skill` 接口**根本不存在该字段**（探针实测 `Object.keys` 恰五项）。集成它等于集成一个不存在的面；任何 UI/文档展示都是虚假安全感（P6） |
| `Agent.state.systemPrompt` 可写 + 每轮重读 | INTEGRATE | SKILL-04 / D-03 的技术前提：改写 `state.systemPrompt` 下一轮 `prompt()` 即生效，不重建 Agent |

## 说明

- 本阶段**零新增依赖**（`node_modules/` 不在 `files_modified` 内；SDK 是既有依赖，只读消费）。
- `NodeExecutionEnv` / `createSandboxEnv` / `resolveInside` 属 Phase 43 既有集成面，**本阶段零改动**，不在此表重列。
- 另有 SDK 内部使用、**禁止 Realm 直接 require** 的传递依赖 `yaml@2.9.0` / `ignore@7.0.5`（P11/O5，归 Phase 51）—— 它们不是本阶段的集成面，列入 `must_haves.prohibitions`。
