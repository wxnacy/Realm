/**
 * boundary-01: 空容器 memory_read 返回空态（AI-SPEC §5 边界 1）
 *
 * 容器记忆文件不存在时 memory_read 返回「该容器暂无记忆」（D-05 空态，
 * 全链路唯一不 throw 例外），且不得凭空创建文件。
 */
module.exports = {
  name: 'boundary-01: 空容器 memory_read 空态',
  activeContainer: 'work',
  turns: [
    {
      user: '读一下当前容器的记忆，里面都记了些什么？',
      expect: {
        toolCalls: [
          { name: 'memory_read' },
        ],
        fileState: {
          'memories/work.md': { exists: false },
        },
      },
    },
  ],
};
