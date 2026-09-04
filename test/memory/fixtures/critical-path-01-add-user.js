/**
 * critical-path-01: add → user 层落盘（AI-SPEC §5 composition 关键路径 1）
 *
 * 用户稳定事实应写入 USER.md（target:'user'）。
 */
module.exports = {
  name: 'critical-path-01: add → user 层落盘',
  activeContainer: 'work',
  turns: [
    {
      user: '记住一个我的偏好：回复风格要简洁，不需要寒暄和铺垫。',
      expect: {
        toolCalls: [
          { name: 'memory', params: { action: 'add', target: 'user' } },
        ],
        fileState: {
          'USER.md': {
            exists: true,
            match: '简洁|精简|精炼|简短',
          },
          'MEMORY.md': { exists: false },
        },
      },
    },
  ],
};
