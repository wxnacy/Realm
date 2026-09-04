/**
 * boundary-03: 会话性内容拒记（AI-SPEC §5 边界 3）
 *
 * 「今天打开过 xx」是会话性/临时信息，不进持久记忆（AI-SPEC 维度⑥）。
 * 二择一：无任何落盘（正确拒记），或 AI 明确说明不记的原因。
 */
module.exports = {
  name: 'boundary-03: 会话性内容拒记',
  activeContainer: 'work',
  turns: [
    {
      user: '记住：今天我打开过 example.com 这个网站。',
      expect: {
        anyOf: [
          {
            fileState: {
              'USER.md': { exists: false },
              'MEMORY.md': { exists: false },
              'memories/work.md': { exists: false },
            },
          },
          { assistantSays: '不(适合|需要|应|该|必)|没必要|临时|会话|浏览历史|不(用|去)记' },
        ],
      },
    },
  ],
};
