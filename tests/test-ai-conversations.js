#!/usr/bin/env node
/**
 * Phase 42: AI 对话存储 - 自动化测试（Nyquist 缺口补齐）
 *
 * 覆盖缺口：
 * - CONV-01（42-01/42-04/42-06）：对话存储基础 + 归一化管线
 *   （saveMessages 写入侧按角色提取、旧 JSON 块数组行兼容、
 *    getMessages 同回合 assistant 行合并、getAgentMessages 注入形状 + CR-01 配对闭合）
 * - CONV-03（42-01）：对话全局共享（无 container_id、跨容器可见）
 * - CONV-04（42-01/42-04）：对话标题管理（惰性建行 + D-04 自动命名、
 *   renameConversation、message_count 维护）
 *
 * 用法: node tests/test-ai-conversations.js
 *
 * electron 依赖处理（不修改实现文件）：
 * ai-conversations-manager.js 顶层 require('electron') 取 app.getPath('userData')，
 * ai-manager.js 及其依赖链 require electron/electron-store。
 * 参考 42-06 冒烟方式，在 require 之前用 Module._load 拦截注入 stub，
 * userData 指向临时目录，数据库走真实 better-sqlite3 文件。
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ==================== electron / electron-store stub ====================

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-ai-conv-test-'));

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => tmpDir,
        whenReady: () => Promise.resolve(),
        setName() {},
        on() {},
        quit() {},
      },
      webContents: { getAllWebContents: () => [], fromId: () => null },
      ipcMain: { handle() {}, on() {}, once() {}, removeAllListeners() {} },
      BrowserWindow: class BrowserWindowStub {},
      screen: {
        getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }),
        getAllDisplays: () => [],
      },
      net: { fetch: () => Promise.reject(new Error('electron stub: net.fetch 不可用')) },
      session: { fromPartition: () => ({}) },
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      nativeTheme: {},
      clipboard: {},
      shell: { openExternal: async () => {} },
    };
  }
  if (request === 'electron-store') {
    return class FakeStore {
      constructor(opts = {}) {
        this._data = {};
        this.path = path.join(tmpDir, (opts.name || 'config') + '.json');
      }
      get(_key, fallback) { return fallback; }
      set() {}
      has() { return false; }
      delete() {}
      clear() {}
    };
  }
  return origLoad.apply(this, arguments);
};

const Database = require('better-sqlite3');

// 被测模块（stub 已就位，initDatabase 落临时目录）
const conversationStore = require('../ai-conversations-manager');
conversationStore.initDatabase();

// 第二连接：直接读/写库，用于断言原始列值与插入旧格式行（不经过被测函数）
const rawDb = new Database(path.join(tmpDir, 'ai-conversations.db'));

// AIManager：constructor 为纯状态初始化（不触发 Agent/LLM），
// 用于测 CONV-04 惰性建行 / D-04 自动命名 / renameConversation
const AIManager = require('../ai-manager');

// ==================== 测试工具 ====================

let testCount = 0;
let passCount = 0;
let failCount = 0;

/**
 * 断言函数
 * @param {boolean} condition - 条件
 * @param {string} message - 测试描述
 */
function assert(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failCount++;
    console.log(`  ✗ ${message}`);
  }
}

/**
 * 断言相等
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 * @param {string} message - 测试描述
 */
function assertEqual(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    console.log(`    期望: ${JSON.stringify(expected)}`);
    console.log(`    实际: ${JSON.stringify(actual)}`);
  }
  assert(pass, message);
}

/**
 * 运行测试组
 * @param {string} name - 测试组名称
 * @param {Function} fn - 测试函数
 */
function describe(name, fn) {
  console.log(`\n${name}`);
  console.log('─'.repeat(50));
  fn();
}

/**
 * 按行序读取某对话的原始消息行（第二连接，绕过被测函数）
 * @param {string} conversationId - 对话 ID
 * @returns {Array} 原始行
 */
function rawRows(conversationId) {
  return rawDb.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC'
  ).all(conversationId);
}

// 固定时间戳基准（毫秒），保证顺序确定
const T = 1700000000000;

// ==================== 测试用例 ====================

describe('1. 表结构：对话全局共享（CONV-03）', () => {
  const convCols = rawDb.prepare('PRAGMA table_info(conversations)').all().map(c => c.name);
  const msgCols = rawDb.prepare('PRAGMA table_info(messages)').all().map(c => c.name);

  assert(!convCols.includes('container_id'), 'conversations 表无 container_id 列（D-03）');
  assert(!msgCols.includes('container_id'), 'messages 表无 container_id 列');
  assertEqual(
    convCols.sort(),
    ['created_at', 'id', 'model', 'provider', 'title', 'token_total', 'updated_at'],
    'conversations 表列为 D-02 设计的 7 列'
  );

  // 惰性生命周期（G-42-1）：全新库无任何自动建行
  assertEqual(conversationStore.getConversations().length, 0, '全新库 conversations 零行（启动不自动建对话）');
});

describe('2. saveMessages 写入侧按角色归一化（CONV-01 / 42-04）', () => {
  const conv = conversationStore.createConversation({ model: 'test-model', provider: 'test-provider' });

  const transcript = [
    { role: 'user', content: '帮我查询天气', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '思考内容不应落库' },
        { type: 'text', text: '我来帮你查询。' },
        { type: 'toolCall', id: 'call-1', name: 'get_weather', arguments: { city: '北京' } },
      ],
      timestamp: T + 2,
    },
    {
      role: 'toolResult',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      content: [{ type: 'text', text: '晴，25度' }],
      details: { temp: 25 },
      timestamp: T + 3,
    },
    { role: 'assistant', content: [{ type: 'text', text: '北京今天是晴天，25度。' }], timestamp: T + 4 },
  ];
  const saved = conversationStore.saveMessages(conv.id, transcript);
  assertEqual(saved, 4, 'saveMessages 返回保存条数 4');

  const rows = rawRows(conv.id);
  assertEqual(rows.length, 4, '库中恰好 4 行');

  // user 行：content 列纯文本
  assertEqual(rows[0].role, 'user', '行 1 角色为 user');
  assertEqual(rows[0].content, '帮我查询天气', 'user 行 content 列为纯文本（非 JSON 块数组）');

  // assistant 行（工具回合首行）：content 纯文本、tool_calls 结构化、thinking 不落库
  assertEqual(rows[1].role, 'assistant', '行 2 角色为 assistant');
  assertEqual(rows[1].content, '我来帮你查询。', 'assistant 行 content 列为纯文本（content 块提取）');
  assertEqual(
    JSON.parse(rows[1].tool_calls),
    [{ id: 'call-1', name: 'get_weather', arguments: { city: '北京' } }],
    'assistant 行 tool_calls 列为结构化 [{id,name,arguments}]（camelCase）'
  );
  assert(!rows[1].content.includes('思考内容'), 'thinking 块不落入 content 列');
  assert(!(rows[1].tool_calls || '').includes('thinking'), 'thinking 块不落入 tool_calls 列');

  // toolResult 行：content 纯文本、tool_results 含元数据
  assertEqual(rows[2].role, 'toolResult', '行 3 角色为 toolResult');
  assertEqual(rows[2].content, '晴，25度', 'toolResult 行 content 列为 text 块拼接文本');
  assertEqual(
    JSON.parse(rows[2].tool_results),
    { toolCallId: 'call-1', toolName: 'get_weather', isError: false, details: { temp: 25 } },
    'toolResult 行 tool_results 列含 toolCallId/toolName/isError/details'
  );

  // 最终 assistant 行：纯文本、无 tool_calls
  assertEqual(rows[3].content, '北京今天是晴天，25度。', '最终 assistant 行 content 列为纯文本');
  assertEqual(rows[3].tool_calls, null, '最终 assistant 行无工具调用时 tool_calls 列为 NULL');

  // 全量替换：重存更短 transcript 后行数减少，无重复行（G-42-2）
  conversationStore.saveMessages(conv.id, transcript.slice(0, 2));
  assertEqual(rawRows(conv.id).length, 2, '全量替换：重存 2 条后库中仅 2 行');
  // 恢复完整 transcript 供后续用例使用
  conversationStore.saveMessages(conv.id, transcript);
});

describe('3. getMessages 同回合 assistant 行合并（CONV-01 / 42-06 G-42-8）', () => {
  // Test 1：标准工具回合 user → assistant(toolCall) → toolResult → assistant(text)
  const conv1 = conversationStore.createConversation();
  conversationStore.saveMessages(conv1.id, [
    { role: 'user', content: '查天气', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'c1', name: 'get_weather', arguments: { city: '上海' } }],
      timestamp: T + 2,
    },
    {
      role: 'toolResult',
      toolCallId: 'c1',
      toolName: 'get_weather',
      content: [{ type: 'text', text: '上海多云 20度' }],
      timestamp: T + 3,
    },
    { role: 'assistant', content: [{ type: 'text', text: '上海今天多云，20度。' }], timestamp: T + 4 },
  ]);

  const display1 = conversationStore.getMessages(conv1.id);
  assertEqual(display1.length, 2, '标准工具回合：2 条显示消息（1 user + 1 assistant）');
  assertEqual(display1[0].role, 'user', '第 1 条为 user 消息');
  assertEqual(display1[1].role, 'assistant', '第 2 条为 assistant 消息');
  assertEqual(display1[1].content, '上海今天多云，20度。', 'assistant 消息 content = 最终文本');
  assertEqual(display1[1].toolExecutions.length, 1, 'toolExecutions 恰 1 张卡片');
  assertEqual(
    display1[1].toolExecutions[0],
    {
      id: 'c1', name: 'get_weather', status: 'completed',
      params: { city: '上海' }, result: '上海多云 20度',
    },
    '工具卡片 id/name/params/status/result 完整回填'
  );
  assert(!display1.some(m => m.role === 'assistant' && !m.content), '不产出 content 为空的 assistant 显示消息');

  // Test 7：合并消息 id/timestamp 取回合首行锚点
  const anchorRow = rawRows(conv1.id)[1]; // 第一条 assistant 行
  assertEqual(display1[1].id, anchorRow.id, '合并消息 id = 回合首行 id（工具卡片锚点）');
  assertEqual(display1[1].timestamp, anchorRow.created_at, '合并消息 timestamp = 回合首行 created_at');

  // Test 2：多轮工具回合（toolCall A、B → toolResult A、B → 最终文本）
  const conv2 = conversationStore.createConversation();
  conversationStore.saveMessages(conv2.id, [
    { role: 'user', content: '多工具', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [
        { type: 'toolCall', id: 'a', name: 'tool_a', arguments: { q: 1 } },
        { type: 'toolCall', id: 'b', name: 'tool_b', arguments: { q: 2 } },
      ],
      timestamp: T + 2,
    },
    { role: 'toolResult', toolCallId: 'a', toolName: 'tool_a', content: [{ type: 'text', text: '结果A' }], timestamp: T + 3 },
    { role: 'toolResult', toolCallId: 'b', toolName: 'tool_b', content: [{ type: 'text', text: '结果B' }], timestamp: T + 4 },
    { role: 'assistant', content: [{ type: 'text', text: '两个工具都完成了。' }], timestamp: T + 5 },
  ]);
  const display2 = conversationStore.getMessages(conv2.id);
  assertEqual(display2.length, 2, '多轮工具回合：合并为 1 条 assistant 显示消息');
  assertEqual(display2[1].content, '两个工具都完成了。', '多轮回合 content = 最终文本');
  assertEqual(display2[1].toolExecutions.length, 2, 'toolExecutions 2 张卡片');
  assertEqual(display2[1].toolExecutions[0].result, '结果A', '卡片 A result 正确回填');
  assertEqual(display2[1].toolExecutions[1].result, '结果B', '卡片 B result 正确回填');

  // Test 3：纯文本对话无回归
  const conv3 = conversationStore.createConversation();
  conversationStore.saveMessages(conv3.id, [
    { role: 'user', content: '你好', timestamp: T + 1 },
    { role: 'assistant', content: [{ type: 'text', text: '你好！有什么可以帮你？' }], timestamp: T + 2 },
  ]);
  const display3 = conversationStore.getMessages(conv3.id);
  assertEqual(display3.length, 2, '纯文本对话仍为 2 条消息（回归不变）');
  assertEqual(display3[1].content, '你好！有什么可以帮你？', '纯文本 assistant 消息内容不变');
  assertEqual(display3[1].toolExecutions, [], '纯文本 assistant 消息 toolExecutions 为空数组（渲染零张卡片）');

  // Test 4：同回合两条都含文本 → 保守不合并，任何情况下无空 content 消息
  const conv4 = conversationStore.createConversation();
  conversationStore.saveMessages(conv4.id, [
    { role: 'user', content: '两条文本', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: '先说结论。' },
        { type: 'toolCall', id: 't4', name: 'tool_x', arguments: {} },
      ],
      timestamp: T + 2,
    },
    { role: 'toolResult', toolCallId: 't4', toolName: 'tool_x', content: [{ type: 'text', text: '工具输出' }], timestamp: T + 3 },
    { role: 'assistant', content: [{ type: 'text', text: '补充说明。' }], timestamp: T + 4 },
  ]);
  const display4 = conversationStore.getMessages(conv4.id);
  assertEqual(display4.length, 3, '两条都含文本：保持 3 条显示消息（不合并）');
  assertEqual(display4[1].content, '先说结论。', '第一条 content 非空');
  assertEqual(display4[1].toolExecutions.length, 1, '第一条带工具卡片');
  assertEqual(display4[1].toolExecutions[0].result, '工具输出', '第一条卡片 result 回填');
  assertEqual(display4[2].content, '补充说明。', '第二条为最终文本');
  assert(!display4.some(m => m.role === 'assistant' && m.content === ''), '任何情况下不产生 content 空串消息');

  // Test 5：中断回合尾部纯工具行（toolCall 后无文本行）→ 保留 content:'' + 卡片
  const conv5 = conversationStore.createConversation();
  conversationStore.saveMessages(conv5.id, [
    { role: 'user', content: '被打断的回合', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'c5', name: 'tool_z', arguments: { p: 1 } }],
      timestamp: T + 2,
    },
    { role: 'toolResult', toolCallId: 'c5', toolName: 'tool_z', content: [{ type: 'text', text: '工具已执行' }], timestamp: T + 3 },
  ]);
  const display5 = conversationStore.getMessages(conv5.id);
  assertEqual(display5.length, 2, '中断回合：1 user + 1 assistant 显示消息');
  assertEqual(display5[1].role, 'assistant', '残留行为 assistant 消息');
  assertEqual(display5[1].content, '', '中断回合尾部允许 content 空串（渲染层守卫承接）');
  assertEqual(display5[1].toolExecutions.length, 1, '残留行工具卡片保留');
  assertEqual(display5[1].toolExecutions[0].result, '工具已执行', '残留行卡片 result 回填');
});

describe('4. 旧 JSON 块数组行兼容读出（CONV-01 / 42-04 G-42-3 + WR-04）', () => {
  const conv = conversationStore.createConversation();

  // 直接入库 42-01 落库形态的旧格式行：content = 原始块数组 JSON，tool_calls/tool_results 恒 NULL
  const insert = rawDb.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, page_snapshots, created_at)
    VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?)
  `);
  insert.run('legacy-user-1', conv.id, 'user',
    JSON.stringify([{ type: 'text', text: '旧格式提问' }]), T + 1);
  insert.run('legacy-assistant-1', conv.id, 'assistant',
    JSON.stringify([
      { type: 'thinking', thinking: '旧思考' },
      { type: 'text', text: '旧格式回复' },
      { type: 'toolCall', id: 'legacy-1', name: 'legacy_tool', arguments: { q: 'x' } },
    ]), T + 2);

  const display = conversationStore.getMessages(conv.id);
  assertEqual(display.length, 2, '旧格式行：2 条显示消息');
  assertEqual(display[0].content, '旧格式提问', '旧格式 user 行显示文本正确提取（非原始 JSON 字符串）');
  assertEqual(display[1].content, '旧格式回复', '旧格式 assistant 行显示文本正确提取');
  assertEqual(display[1].toolExecutions.length, 1, '旧格式 toolCall 块映射为工具卡片');
  assertEqual(
    { id: display[1].toolExecutions[0].id, name: display[1].toolExecutions[0].name, params: display[1].toolExecutions[0].params },
    { id: 'legacy-1', name: 'legacy_tool', params: { q: 'x' } },
    '旧格式工具卡片 id/name/params 正确'
  );
  assert(!display[0].content.startsWith('['), 'user 行不再显示原始 JSON 文本');

  // WR-04：用户正文恰为普通 JSON 数组文本时按原文处理，不走旧格式分支
  const convPlain = conversationStore.createConversation();
  insert.run('plain-user-1', convPlain.id, 'user', '[1, 2, 3]', T + 1);
  const displayPlain = conversationStore.getMessages(convPlain.id);
  assertEqual(displayPlain.length, 1, '普通 JSON 数组正文：1 条显示消息');
  assertEqual(displayPlain[0].content, '[1, 2, 3]', '普通 JSON 数组正文按原文显示（WR-04 启发式）');

  // 旧格式行注入形状：tool_results 恒 NULL → 孤儿 toolCall 合成占位 toolResult（CR-01）
  const agentMsgs = conversationStore.getAgentMessages(conv.id);
  assertEqual(agentMsgs.length, 3, '旧格式行注入：assistant 前后配对闭合共 3 条 AgentMessage');
  assertEqual(agentMsgs[0].role, 'user');
  assertEqual(agentMsgs[0].content, '旧格式提问', '旧格式 user 行注入文本正确');
  assertEqual(agentMsgs[1].role, 'assistant');
  assertEqual(agentMsgs[1].content, [
    { type: 'text', text: '旧格式回复' },
    { type: 'toolCall', id: 'legacy-1', name: 'legacy_tool', arguments: { q: 'x' } },
  ], '旧格式 assistant 行 content = text 块 + toolCall 块原样（thinking 已过滤）');
  assertEqual(agentMsgs[2].role, 'toolResult', '孤儿 toolCall 紧随合成占位 toolResult');
  assertEqual(agentMsgs[2].toolCallId, 'legacy-1', '合成 toolResult 的 toolCallId 与孤儿配对');
  assertEqual(agentMsgs[2].content, [{ type: 'text', text: '（历史工具结果未记录）' }], '合成占位 toolResult 文本');
});

describe('5. getAgentMessages 注入形状逐字段 + CR-01 配对（CONV-01 / D-14）', () => {
  const conv = conversationStore.createConversation();
  conversationStore.saveMessages(conv.id, [
    { role: 'user', content: '帮我查询天气', timestamp: T + 1 },
    {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call-1', name: 'get_weather', arguments: { city: '北京' } }],
      timestamp: T + 2,
    },
    {
      role: 'toolResult',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      content: [{ type: 'text', text: '晴，25度' }],
      details: { temp: 25 },
      timestamp: T + 3,
    },
    { role: 'assistant', content: [{ type: 'text', text: '北京今天是晴天，25度。' }], timestamp: T + 4 },
  ]);

  const msgs = conversationStore.getAgentMessages(conv.id);
  assertEqual(msgs.length, 4, '注入形状：4 条 AgentMessage（行级结构，不合并）');

  // user
  assertEqual(
    { role: msgs[0].role, content: msgs[0].content, timestamp: msgs[0].timestamp },
    { role: 'user', content: '帮我查询天气', timestamp: T + 1 },
    'user AgentMessage 形状正确'
  );

  // assistant（工具回合首行）
  assertEqual(msgs[1].role, 'assistant', '消息 2 为 assistant');
  assertEqual(msgs[1].content, [
    { type: 'toolCall', id: 'call-1', name: 'get_weather', arguments: { city: '北京' } },
  ], 'assistant content = toolCall 块（无文本时不产空 text 块）');
  assertEqual(msgs[1].api, 'unknown', 'assistant api 占位 unknown');
  assertEqual(msgs[1].model, '', 'assistant model 占位空串');
  assertEqual(
    msgs[1].usage,
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    'assistant usage 占位全零'
  );
  assertEqual(msgs[1].stopReason, 'stop', 'assistant stopReason 占位 stop');
  assertEqual(msgs[1].timestamp, T + 2, 'assistant timestamp = 行 created_at');

  // toolResult
  assertEqual(msgs[2].role, 'toolResult', '消息 3 为 toolResult');
  assertEqual(
    {
      toolCallId: msgs[2].toolCallId, toolName: msgs[2].toolName,
      content: msgs[2].content, isError: msgs[2].isError, details: msgs[2].details,
    },
    {
      toolCallId: 'call-1', toolName: 'get_weather',
      content: [{ type: 'text', text: '晴，25度' }], isError: false, details: { temp: 25 },
    },
    'toolResult AgentMessage 逐字段正确（D-14 工具结果入上下文）'
  );

  // assistant（最终文本）
  assertEqual(msgs[3].content, [{ type: 'text', text: '北京今天是晴天，25度。' }], '最终 assistant content = text 块');

  // CR-01 配对相邻：每个 toolCall 的下一条消息即其 toolResult
  let pairOk = true;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const block of m.content) {
        if (block.type !== 'toolCall') continue;
        const next = msgs[i + 1];
        if (!next || next.role !== 'toolResult' || next.toolCallId !== block.id) pairOk = false;
      }
    }
  }
  assert(pairOk, 'CR-01：toolCall 与 toolResult 严格配对且相邻');

  // 反向孤儿：toolCallId 无任何 assistant 引用的 toolResult 行被跳过
  const convOrphan = conversationStore.createConversation();
  conversationStore.saveMessages(convOrphan.id, [
    {
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'real-1', name: 'real_tool', arguments: {} }],
      timestamp: T + 1,
    },
    { role: 'toolResult', toolCallId: 'real-1', toolName: 'real_tool', content: [{ type: 'text', text: '真实结果' }], timestamp: T + 2 },
  ]);
  rawDb.prepare(
    'INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)'
  ).run('orphan-row-1', convOrphan.id, 'toolResult', '孤儿结果文本',
    JSON.stringify({ toolCallId: 'orphan-x', toolName: 'ghost_tool', isError: false }), T + 3);

  const msgsOrphan = conversationStore.getAgentMessages(convOrphan.id);
  assertEqual(msgsOrphan.length, 2, '反向孤儿 toolResult 行被跳过（共 2 条）');
  assert(!msgsOrphan.some(m => m.toolCallId === 'orphan-x'), '无任何 toolCall 引用的 toolResultId 不出现');
});

describe('6. 对话标题管理：惰性建行 + D-04 + rename + message_count（CONV-04）', () => {
  const am = new AIManager();
  am.activeModelId = 'test-model';
  am.activeProvider = 'test-provider';

  // 路径 a：无当前对话 → 首条消息惰性建行，标题 = 前 30 字符
  const countBefore = conversationStore.getConversations(1000).length;
  const longMsg = '这是一条用来验证 D-04 自动命名只截取前三十个字符的测试消息，后面这部分不应该出现在标题里。';
  const expectedTitle = longMsg.trim().substring(0, 30);
  am.currentConversationId = null;
  const cid = am._ensureConversation(longMsg);

  assert(!!cid && typeof cid === 'string', '惰性建行返回对话 ID');
  assertEqual(conversationStore.getConversations(1000).length, countBefore + 1, '首条消息时才建行（惰性，恰好新增 1 行）');
  const convA = conversationStore.getConversation(cid);
  assert(!!convA, '对话行真实落库');
  assertEqual(convA.title, expectedTitle, '标题 = 首条用户消息前 30 字符（D-04）');
  assertEqual(convA.title.length, 30, '标题恰好 30 字符（不含后文）');
  assertEqual(convA.model, 'test-model', '建行记录 model 元数据');
  assertEqual(convA.provider, 'test-provider', '建行记录 provider 元数据');

  // 路径 b：已有「新对话」行 → 首条消息落地时自动改名
  const convB = conversationStore.createConversation(); // 默认标题「新对话」
  assertEqual(convB.title, '新对话', '默认建行标题为「新对话」');
  am.currentConversationId = convB.id;
  am._ensureConversation('认领后的首条消息文本');
  assertEqual(
    conversationStore.getConversation(convB.id).title,
    '认领后的首条消息文本',
    '「新对话」行被首条消息自动命名'
  );

  // 用户重命名过的行不被自动命名覆盖
  am.renameConversation(convB.id, '手动改的名字');
  assertEqual(conversationStore.getConversation(convB.id).title, '手动改的名字', 'renameConversation 生效');
  am._ensureConversation('再来一条不同的消息');
  assertEqual(conversationStore.getConversation(convB.id).title, '手动改的名字', '重命名过的标题不被自动命名覆盖');

  // _deriveConversationTitle 边界：空串保持默认标题
  assertEqual(am._deriveConversationTitle('   '), '新对话', '空白消息标题回退「新对话」');

  // renameConversation 参数校验
  let threw = false;
  try { am.renameConversation(cid, ''); } catch { threw = true; }
  assert(threw, 'renameConversation 空标题抛错');

  // message_count 维护（G-42-2）
  conversationStore.saveMessages(cid, [
    { role: 'user', content: 'm1', timestamp: T + 1 },
    { role: 'assistant', content: 'r1', timestamp: T + 2 },
    { role: 'user', content: 'm2', timestamp: T + 3 },
    { role: 'assistant', content: 'r2', timestamp: T + 4 },
  ]);
  assertEqual(
    conversationStore.getConversations(1000).find(c => c.id === cid).message_count,
    4,
    'getConversations 返回真实 message_count = 4'
  );
  conversationStore.saveMessages(cid, [
    { role: 'user', content: 'm1', timestamp: T + 1 },
    { role: 'assistant', content: 'r1', timestamp: T + 2 },
  ]);
  assertEqual(
    conversationStore.getConversations(1000).find(c => c.id === cid).message_count,
    2,
    '全量替换后 message_count 同步更新 = 2'
  );
});

describe('7. 跨容器可见（CONV-03 全局共享）', () => {
  // 模拟容器 work 与 personal 各建一个对话：存储层无容器概念，全局可见
  const convWork = conversationStore.createConversation({ title: '来自 work 容器的问题' });
  const convPersonal = conversationStore.createConversation({ title: '来自 personal 容器的问题' });

  const all = conversationStore.getConversations(1000);
  assert(all.some(c => c.id === convWork.id), 'work 容器创建的对话可见');
  assert(all.some(c => c.id === convPersonal.id), 'personal 容器创建的对话可见');

  // getMessages 仅凭 conversationId 即可读取，无容器过滤参数
  conversationStore.saveMessages(convWork.id, [
    { role: 'user', content: 'work 里的消息', timestamp: T + 1 },
  ]);
  assertEqual(conversationStore.getMessages(convWork.id).length, 1, '任意对话仅凭 ID 可读消息（无容器作用域）');

  // 删除 CASCADE：删一个不影响另一个（对话生命周期用户完全控制，D-16）
  conversationStore.deleteConversation(convPersonal.id);
  const after = conversationStore.getConversations(1000);
  assert(!after.some(c => c.id === convPersonal.id), '删除的对话消失');
  assert(after.some(c => c.id === convWork.id), '另一对话不受影响');
  assertEqual(rawDb.prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ?').get(convPersonal.id).n, 0, '删除对话消息级联清空');
});

// ==================== 测试结果 ====================

console.log('\n' + '═'.repeat(50));
console.log('测试结果');
console.log('═'.repeat(50));
console.log(`总计: ${testCount} 项测试`);
console.log(`通过: ${passCount} 项`);
console.log(`失败: ${failCount} 项`);
console.log('═'.repeat(50));

// 清理
rawDb.close();

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (err) {
  // 临时目录清理失败不影响测试判定
}

// 退出码
process.exit(failCount > 0 ? 1 : 0);
