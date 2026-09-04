/**
 * critical-path-03: add → container 层落当时活跃容器（AI-SPEC §5 关键路径 3）
 *
 * 容器特有知识应落 target:'container'，且写到当时活跃容器（work）的文件，
 * 不串其他容器（D-02 调用时解析语义）。
 */
module.exports = {
  name: 'critical-path-03: add → container 层落活跃容器',
  activeContainer: 'work',
  turns: [
    {
      user: '记住：在当前这个容器里 GitHub 已经登录，遇到 2FA 先问我。',
      expect: {
        toolCalls: [
          { name: 'memory', params: { action: 'add', target: 'container' } },
        ],
        fileState: {
          'memories/work.md': { exists: true, match: 'GitHub' },
          'memories/personal.md': { exists: false },
          'memories/research.md': { exists: false },
        },
      },
    },
  ],
};
