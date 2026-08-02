---
phase: 22
plan: 04
subsystem: ai
tags: [electron, cdp, ai-tools, container-manager, electron-store, gap-closure]

# Dependency graph
requires:
  - phase: 22-cdp (plans 22-01/22-02/22-03)
    provides: cdp-manager 三段式 API、read_page_content / extract_links / open_link 工具、8 工具注册链路
provides:
  - open_link / switch_container 容器校验接入 containerManager.getContainers() 内存权威数据（全新 profile 默认路径可用）
  - UI-SPEC 空状态契约文案 2 条（extract_links 0 链接、read_page_content 空正文）
affects: [22-cdp UAT / Human Verification #1-6, verify-phase 22 复跑]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "跨模块只读访问主进程管理器数据一律走惰性 require helper（getXxxLazy），守护纯 Node 注册验证链路"
    - "容器列表唯一权威来源 = container-manager 内存 Map（initContainers 以 DEFAULT_CONTAINERS 兜底、从不写回 store）；禁止以空数组兜底从 electron-store 读 containers 键"

key-files:
  created: []
  modified:
    - ai-manager.js

key-decisions:
  - "容器校验数据源从 electron-store 切换到 container-manager 内存 Map：initContainers 从不写回 store，全新 profile 下 store 无 containers 键，空数组兜底读取 100% 误判 default 不存在（CR-01 根因）"
  - "经 getContainersLazy() 惰性 require 间接调用而非顶层 require：container-manager 依赖链在纯 Node 下崩溃（electron-store 构造时 app.getPath 为 undefined），顶层加载会打破 node -e require('./ai-manager') 注册验证"

patterns-established:
  - "getXxxLazy 模式扩展：凡需从 ai-manager 访问其他主进程管理器（ipc-handlers / container-manager）均封装模块私有惰性 helper，JSDoc 必须说明纯 Node 加载约束"
  - "工具空状态结果经 data.message 挂载契约文案：0 结果/空内容是合法结果而非错误，不 throw、不改变 return 结构"

requirements-completed: [CDP-02, CDP-03, CDP-04]

coverage:
  - id: D1
    description: "open_link / switch_container 容器校验改用 containerManager.getContainers() 内存权威数据，全新 profile（store 无 containers 键）下默认路径可找到 default 容器"
    requirement: CDP-04
    verification:
      - kind: other
        ref: "node /tmp/fresh-profile-sim.js → FRESH-PROFILE PASS（Module._load stub electron + electron-store，initContainers 后 getContainers().find('default') 为真）"
        status: pass
      - kind: other
        ref: "node -e \"_buildRealmTools()\" → 8 工具含 open_link/switch_container PASS；node --check ai-manager.js 退出 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "extract_links 过滤后 0 链接时结果携带契约文案「未找到有效链接（仅保留 http/https 协议）」；read_page_content 正文为空时携带「页面无可读内容，可能是纯应用页面或空白页」"
    requirement: CDP-03
    verification:
      - kind: other
        ref: "grep -c 两条文案各命中 1 次；与 22-UI-SPEC.md:147-148 MD5 比对逐字一致；挂载位置 grep -n 确认位于 JSON.parse 之后、return 之前"
        status: pass
      - kind: other
        ref: "node --check + 8 工具注册 PASS"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-08-02
status: complete
---

# Phase 22 Plan 04: Gap 关闭（CR-01 容器校验数据源 + UI-SPEC 空状态文案） Summary

**open_link/switch_container 容器校验切换到 container-manager 内存权威数据（修复全新 profile 100% 失败），并补齐 extract_links / read_page_content 两条空状态契约文案**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-02T07:07:13Z
- **Completed:** 2026-08-02T07:14:37Z
- **Tasks:** 2
- **Files modified:** 1（ai-manager.js，+39/-6）

## Accomplishments

- Gap #1（BLOCKER / CR-01 / CDP-04）关闭：open_link 与 switch_container 容器存在性校验从 `configStore.get('containers', [])` 改为 `getContainersLazy().find(...)`，全新 profile 下 AI 默认调用路径（不传 containerId）不再 100% 失败
- Phase 20 预存在同款反模式（switch_container）随 Gap #1 一并消除，ai-manager.js 中「containers 键 + 空数组默认值」读取零残留
- Gap #2（WR-02）关闭：extract_links 0 链接、read_page_content 空正文时按条件挂载契约 message，22-UI-SPEC 全部 8 条文案（6 错误 + 2 空状态）在代码库可 grep
- 零新增依赖、零新增导出、零 IPC 变更：仅新增模块私有 helper `getContainersLazy()`（不导出），8 工具注册与 CDP 三段式生命周期不受影响

## Task Commits

Each task was committed atomically:

1. **Task 1: 修复 open_link / switch_container 容器校验数据源（Gap #1 / CR-01）** - `42ddcac` (fix)
2. **Task 2: 补齐 UI-SPEC 两条空状态契约文案（Gap #2 / WR-02）** - `bfa56f9` (feat)

## Files Created/Modified

- `ai-manager.js` — 新增 `getContainersLazy()` 惰性 helper；open_link / switch_container 两处校验改内存权威数据；extract_links / read_page_content 两处条件挂载空状态 message

## 修改前后对比（Gap #1，两处校验）

### 新增 helper（ai-manager.js:59-79）

```javascript
function getContainersLazy() {
  return require('./container-manager').getContainers();
}
```

沿用 `getActiveWebviewContentsIdLazy()`（ai-manager.js:55-57）同款惰性 require 模式；JSDoc 说明容器列表权威来源为 container-manager 内存 Map（initContainers 以 DEFAULT_CONTAINERS 兜底、从不写回 store），纯 Node 下顶层 require 会因 electron-store 构造崩溃。

### switch_container（原 925-926 → 现 945-946）

| 前 | 后 |
|----|----|
| `const containers = this.configStore ? this.configStore.get('containers', []) : [];` | `const container = getContainersLazy().find(c => c.id === containerId);` |
| `const container = containers.find(c => c.id === containerId);` | （合并为上行） |

后续 `throw new Error(`容器不存在: ${containerId}`)`（Phase 20 预存在文案）与 `windowManager.switchContainer(mainWindow.id, containerId, container)`、`container.name` 下游消费原样保留（getContainers() 返回纯配置对象，与 store 数据形状一致）。

### open_link（原 1172-1173 → 现 1203-1205）

| 前 | 后 |
|----|----|
| `const containers = this.configStore ? this.configStore.get('containers', []) : [];` | `const container = getContainersLazy().find(c => c.id === containerId);` |
| `const container = containers.find(c => c.id === containerId);` | （合并为上行） |

后续 `throw new Error('指定容器不存在或已删除')`（UI-SPEC 契约文案）原样保留。

## 文案挂载位置（Gap #2）

| 工具 | 位置 | 条件 | 挂载文案 |
|------|------|------|----------|
| read_page_content | ai-manager.js:1054-1058（100KB 截断块之后、return 之前） | `!data.content` | `页面无可读内容，可能是纯应用页面或空白页` |
| extract_links | ai-manager.js:1151-1155（JSON.parse 之后、return 之前） | `data.total === 0` | `未找到有效链接（仅保留 http/https 协议）` |

两条 message 直接附加在 data 对象上，经既有 `JSON.stringify(data, null, 2)` 随结果返回；不 throw、不改变 return 结构（details.totalLinks / contentLength 逻辑不变）。与 22-UI-SPEC.md:147-148 逐字一致（MD5 比对：`ce59f00c…`、`12388d52…` 双侧相同）。

## FRESH-PROFILE 模拟（Gap #1 验收）

脚本 `/tmp/fresh-profile-sim.js`：Module._load stub `electron`（session.fromPartition 返回空对象、app.getPath 返回临时目录 — cookie-manager 顶层依赖）与 `electron-store`（可 new 的 class，get 恒返回传入默认值 = 全新 profile 无任何键、set 空操作），再 require('./container-manager') 并调用 initContainers()。

输出：

```
[Realm] 初始化容器: 默认 (persist:container-default)
[Realm] 初始化容器: 工作 (persist:container-work)
[Realm] 初始化容器: 个人 (persist:container-personal)
[Realm] 初始化容器: 金融 (persist:container-finance)
new data source finds default: true (默认)
old data source finds default: undefined (bug path)
FRESH-PROFILE PASS
```

新数据源（getContainers()）在 store 无 containers 键时仍可找到 default；旧数据源（空数组兜底）失败路径 `[].find(...) === undefined` 同步记录作 bug 对比。

## grep 验证记录

| 检查 | 命令 | 期望 | 实际 |
|------|------|------|------|
| 权威 helper 接入 | `grep -c "getContainersLazy" ai-manager.js` | ≥3 | 3（定义 1 + 调用 2） |
| 权威调用唯一 | `grep -c "require('./container-manager')\.getContainers()" ai-manager.js` | 1 | 1 |
| 反模式消除 | `grep -c "get('containers', \[\])" ai-manager.js` | 0 | 0（含注释复核亦为 0） |
| extract_links 文案 | `grep -c "未找到有效链接（仅保留 http/https 协议）" ai-manager.js` | 1 | 1 |
| read_page_content 文案 | `grep -c "页面无可读内容，可能是纯应用页面或空白页" ai-manager.js` | 1 | 1 |
| 挂载位置 | `grep -n "data.total === 0" / "!data.content" ai-manager.js` | 各 1 且位于 JSON.parse 后、return 前 | 1153 / 1056 ✓ |
| UI-SPEC 8 条文案 | grep ai-manager.js + cdp-manager.js | 全部命中 | 8/8 ✓ |
| 语法 | `node --check ai-manager.js` | 退出 0 | ✓ |
| 注册 | `_buildRealmTools()` 8 工具含 open_link/switch_container | PASS | PASS（两任务后各跑一次） |

## Decisions Made

- 遵循计划既定方案：经 `getContainersLazy()` 间接调用而非顶层 require（计划强制约束，守护 22-VERIFICATION 自动检查 #3 的纯 Node 注册验证链路）
- 空状态 message 挂载在 data 对象上随 JSON 返回，无 UI 侧改动（UI-SPEC 空状态契约的呈现载体即工具结果 JSON）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。两处 Edit 一次命中，全部自动检查首跑通过。

## User Setup Required

None - no external service configuration required.

## Threat Flags

None。修复收敛而非扩大攻击面：容器校验路径不再受 realm-config.json 磁盘篡改影响（threat model T-22-04-01，disposition: accept 已记录于 PLAN）。无新增网络端点、认证路径或文件访问模式。

## Known Stubs

None。无占位符、无硬编码空值流入 UI。

## Next Phase Readiness

- 22-VERIFICATION.md Gaps #1（3 项 missing）与 Gaps #2（2 项 missing）全部落地，复跑 `/gsd:verify-phase 22` 时两个 gap 应判定关闭
- 运行时端到端验证（真实窗口 open_link 双模式 + 全新 profile 回归、read_page_content/extract_links 真实页面提取、DevTools 冲突提示、性能）属 22-VERIFICATION Human Verification #1-6，需 Electron GUI 环境随 UAT 一并执行，不在本计划自动化范围内
- 明确延期项（非本计划工作）：WR-01（cdp-manager dev-mode 占用 debugger 槽位误导文案）、WR-03（open_link URL 校验大小写/trim）、IN-01~07

## Self-Check: PASSED

- FOUND: .planning/phases/22-cdp/22-04-SUMMARY.md
- FOUND: 42ddcac（Task 1 commit）
- FOUND: bfa56f9（Task 2 commit）

---
*Phase: 22-cdp*
*Completed: 2026-08-02*
