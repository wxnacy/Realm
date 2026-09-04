/**
 * critical-path-04: replace 更新过时信息（AI-SPEC §5 关键路径 4）
 *
 * 前置：USER.md 已有 [M1] 过时条目（快照注入后模型可见编号）。
 * 用户更正后应 replace 原条目：新文本存在、旧文本消失、编号保持 M1（D-09/D-10）。
 */
module.exports = {
  name: 'critical-path-04: replace 更新过时信息（编号不变）',
  activeContainer: 'work',
  setup(aiMemoryManager) {
    aiMemoryManager.writeScope('user', '[M1] 用户的首选编程语言是 Python\n');
  },
  turns: [
    {
      user: '我的首选编程语言已经换成 TypeScript 了，请更新你的用户画像记忆：直接改写原条目，不要新增一条。',
      expect: {
        toolCalls: [
          { name: 'memory', params: { action: 'replace', target: 'user' } },
        ],
        fileState: {
          'USER.md': {
            exists: true,
            match: 'TypeScript',
            notIncludes: ['Python'],
          },
        },
      },
    },
    {
      user: '确认一下：更新后我的编号条目还是 M1 吗？不要新增编号。',
      expect: {
        fileState: {
          'USER.md': {
            exists: true,
            match: '^\\[M1\\]',
            notIncludes: ['[M2]'],
          },
        },
      },
    },
  ],
};
