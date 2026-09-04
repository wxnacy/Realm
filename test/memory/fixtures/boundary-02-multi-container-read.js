/**
 * boundary-02: 多容器任务对每个容器各 memory_read 一次（AI-SPEC §5 边界 2）
 *
 * 前置：work / research 两容器各有一.seed条目。用户跨容器提问时，
 * AI 应对每个涉及的容器显式传 containerId 各读一次（D-03 容器记忆
 * 不进快照，只经显式读取进入上下文），且不得误写任何文件。
 */
module.exports = {
  name: 'boundary-02: 多容器任务各读一次',
  activeContainer: 'work',
  setup(aiMemoryManager) {
    aiMemoryManager.writeScope('container:work', '[M1] 工作区条目标记-A1：日常用内部 GitLab\n');
    aiMemoryManager.writeScope('container:research', '[M1] 研究区条目标记-B2：常用 arXiv 与 Zotero\n');
  },
  turns: [
    {
      user: '分别看一下 work 和 research 两个容器各自记了什么，汇总给我。',
      expect: {
        toolCalls: [
          { name: 'memory_read', params: { containerId: 'work' } },
          { name: 'memory_read', params: { containerId: 'research' } },
        ],
        fileState: {
          'memories/work.md': { exists: true, match: '条目标记-A1', notIncludes: ['条目标记-B2'] },
          'memories/research.md': { exists: true, match: '条目标记-B2', notIncludes: ['条目标记-A1'] },
        },
      },
    },
  ],
};
