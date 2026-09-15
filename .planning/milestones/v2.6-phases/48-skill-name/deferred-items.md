# Phase 48 — Deferred Items（执行期发现的阶段外问题）

> 只记录**非当前任务引入**的既有问题（scope boundary：auto-fix 只覆盖当前任务直接造成的缺陷）。
> 不在本阶段修复，也不阻碍本阶段收尾。

## D-48-A · `tests/test-builtin-skills-seeder.js` 的 DOC-02 计数断言在 Node 22 下必然失败（既有环境问题）

**发现于**：48-01 Task 1 执行期（跑关联测试面时命中）

**现象**：`node --test tests/test-builtin-skills-seeder.js` →
`# fail 1`，失败项为
`AGENTS.md 的「测试：」行计数与实跑输出一致（唯一权威判据，不写死字面量）`，
断言 `应能从 node --test 的 TAP 输出解析出 \`# tests\``。

**根因**（已用最小复现确认，与 48-01 的改动无关）：
该用例在测试进程内 `spawnSync(process.execPath, ['--test', 'tests/test-ai-bash-policy.js'])`，
而 Node 22 的测试运行器会给子进程注入 `NODE_TEST_CONTEXT=child-v8`；
孙进程 `node --test` 继承该变量后不再向 stdout 输出 TAP 摘要（实测 `stdout` 长度为 0）。
最小复现（`/tmp/nested-spawn-probe.js`）在同一环境下稳定复现；把该测试文件**直接**跑（不经外
层 `node --test`）或用 `cwd: '.'` 手跑 spawnSync 时 `# tests 97` 正常出现。

**影响面**：仅该条文档计数断言；`tests/test-ai-bash-policy.js` 自身 97/97 全绿。

**建议修法（不属本阶段）**：在该用例的 `spawnSync` 选项里传
`env: { ...process.env, NODE_TEST_CONTEXT: undefined }`（或改用 `--test-reporter=tap` 显式指定），
使孙进程回到非嵌套路径。修的时候须同步核对 AGENTS.md「- 测试：」行的 bash-policy 计数。
