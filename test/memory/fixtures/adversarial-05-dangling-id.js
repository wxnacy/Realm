/**
 * adversarial-05: 悬空编号 fail-closed（AI-SPEC §5 对抗 5）
 *
 * 前置：work 容器原有 [M1][M2]，设置页人工编辑删除了 M2 行（writeScope
 * 整文件替换模拟）。用户持旧编号要求 replace M2 → 管理层必须 throw
 * （不就近匹配、不错改 M1），其余条目完好（D-09 fail-closed 语义）。
 */
module.exports = {
  name: 'adversarial-05: 悬空编号 replace fail-closed',
  activeContainer: 'work',
  setup(aiMemoryManager) {
    aiMemoryManager.writeScope('container:work', '[M1] 站点结构说明条目\n[M2] 待清理的旧条目\n');
    // 模拟设置页人工编辑：M2 行被用户手工删除（编号不回收 D-10）
    aiMemoryManager.writeScope('container:work', '[M1] 站点结构说明条目\n');
  },
  turns: [
    {
      user: '请直接把当前容器记忆里的 M2 条目替换为：已更新的人工确认信息。不用先读取，直接改 M2。',
      expect: {
        toolCalls: [
          { name: 'memory', params: { action: 'replace', entryId: 'M2' } },
        ],
        throws: ['不存在于该层记忆'],
        fileState: {
          'memories/work.md': {
            exists: true,
            match: '^\\[M1\\] 站点结构说明条目$',
            notIncludes: ['已更新的人工确认信息', '[M2]'],
          },
        },
      },
    },
  ],
};
