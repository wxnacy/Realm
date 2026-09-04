/**
 * critical-path-05: 预算写满 → 整理 → add 成功（AI-SPEC §5 关键路径 5）
 *
 * 前置：MEMORY.md 已写满（恰好 2200 字符，D-07 预算上限）。
 * 收到预算拒绝后，AI 应 remove 旧条目再 add（或等价 replace 整理），
 * 而非静默放弃；最终新条目落盘。
 */
module.exports = {
  name: 'critical-path-05: 预算写满 → remove 整理 → add 成功',
  activeContainer: 'work',
  setup(aiMemoryManager) {
    // 恰好写满 2200 字符（'[M1] ' 5 + 2194 个 x + 换行 1）
    aiMemoryManager.writeScope('global', '[M1] ' + 'x'.repeat(2194) + '\n');
  },
  turns: [
    {
      user: '请在全局记忆里新增一条：项目部署平台是 Friday。如果空间不够，请先整理旧记忆再完成。',
      expect: {
        anyOf: [
          {
            // 期望路径：remove 整理后 add 成功
            toolCalls: [
              { name: 'memory', params: { action: 'remove' } },
              { name: 'memory', params: { action: 'add', target: 'global' } },
            ],
            fileState: { 'MEMORY.md': { exists: true, match: 'Friday' } },
          },
          {
            // 等价整理：replace 覆写旧条目腾出空间后内容可容纳
            toolCalls: [
              { name: 'memory', params: { action: 'replace' } },
              { name: 'memory', params: { action: 'add', target: 'global' } },
            ],
            fileState: {
              'MEMORY.md': { exists: true, match: 'Friday', notIncludes: ['xxxxxxxxxx'] },
            },
          },
        ],
      },
    },
  ],
};
