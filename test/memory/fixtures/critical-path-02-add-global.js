/**
 * critical-path-02: add → global 层落盘（AI-SPEC §5 composition 关键路径 2）
 *
 * 跨容器通用约定应写入 MEMORY.md（target:'global'），不落用户画像。
 */
module.exports = {
  name: 'critical-path-02: add → global 层落盘',
  activeContainer: 'work',
  turns: [
    {
      user: '记住一个通用约定：这个项目统一用 pnpm 管理依赖，不要用 npm。',
      expect: {
        toolCalls: [
          { name: 'memory', params: { action: 'add', target: 'global' } },
        ],
        fileState: {
          'MEMORY.md': { exists: true, match: 'pnpm' },
          'USER.md': { exists: false },
        },
      },
    },
  ],
};
