/**
 * src/skill-picker-model.js 纯逻辑单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：A 组（`extractArgs` 的 token 取值法 —— 48-RESEARCH.md 事实 2 的七组表逐行、
 * `parseSkillRef` 的正例 / 边界反例 / 本地命令优先）、跨进程契约（`parseSkillRef` 与
 * main 侧 `ai-manager.parseSkillInvocationText` 对同一组输入产出相同的 `{name, args}`）。
 *
 * **为什么单独一个文件**：`src/renderer.js` 是浏览器脚本、无 `module.exports`，纯 Node
 * 无法 require；把「args token 取值」「显式语法与裸名的边界」「本地命令优先」这三处最易
 * 静默错的规则抽到 `src/skill-picker-model.js`（双模式导出）后，即可在纯 Node 下秒级
 * 表驱动覆盖（无需 Playwright / GUI）。
 *
 * `src/skill-picker-model.js` **零项目内 import**（不依赖 electron / SDK / DOM），
 * 因此本文件不需要任何桩。
 *
 * 用法: node --test tests/test-skill-picker-model.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const model = require('../src/skill-picker-model');
const aiManager = require('../ai-manager');

/** 本地命令名集合（与 `src/renderer.js` 的 `SLASH_COMMANDS` 同形，测试内自建） */
const COMMAND_NAMES = ['clear', 'compact'];

describe('A 组 · extractArgs —— token 取值法（事实 2 七组表逐行）', () => {
  /**
   * 七组表逐行照抄 `48-RESEARCH.md`「事实 2」的实测表。
   *
   * 旧式取值（按命令名长度切一刀、再正则剥掉首个非空白段）在
   * `/skill:find 帮我找 X` 上只取到 `X`（吞掉「帮我找 」）；token 取值法必须全对。
   */
  const TABLE = [
    { input: '/skill:find 帮我找 X', expected: '帮我找 X' },
    { input: '/skill:fin 帮我找 X', expected: '帮我找 X' },
    { input: '/skill:find-skills 帮我找 X', expected: '帮我找 X' },
    { input: '/fin 帮我找 X', expected: '帮我找 X' },
    { input: '/skill:fi 帮我找 X', expected: '帮我找 X' },
    { input: '/cle x', expected: 'x' },
    { input: '/compact 重点保留登录', expected: '重点保留登录' },
  ];

  for (const { input, expected } of TABLE) {
    test(`extractArgs(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
      assert.strictEqual(model.extractArgs(input), expected);
    });
  }

  test('无 args 形态：token 之后为空 → 空串（无尾随空白）', () => {
    assert.strictEqual(model.extractArgs('/clear'), '');
    assert.strictEqual(model.extractArgs('/skill:find-skills'), '');
    assert.strictEqual(model.extractArgs('/skill:find-skills   '), '');
  });

  test('非斜杠前缀不做解析：返回空串（不吞普通文本）', () => {
    assert.strictEqual(model.extractArgs('帮我找 X'), '');
    assert.strictEqual(model.extractArgs(''), '');
  });

  test('多空白分隔：args 内部逐字符保留（含换行）', () => {
    assert.strictEqual(model.extractArgs('/skill:a 第一段\n\n第二段'), '第一段\n\n第二段');
    assert.strictEqual(model.extractArgs('/skill:a   x  y'), 'x  y');
  });
});

describe('A 组 · parseSkillRef —— 正例', () => {
  test("/skill:foo → {kind:'skill', name:'foo', args:'', syntax:'skill-colon'}", () => {
    const ref = model.parseSkillRef('/skill:foo', COMMAND_NAMES);
    assert.ok(ref, '应命中 /skill: 语法');
    assert.strictEqual(ref.kind, 'skill');
    assert.strictEqual(ref.name, 'foo');
    assert.strictEqual(ref.args, '');
    assert.strictEqual(ref.syntax, 'skill-colon');
  });

  test("/skill:foo a b → args 为 token 之后的剩余文本", () => {
    const ref = model.parseSkillRef('/skill:foo a b', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'skill');
    assert.strictEqual(ref.name, 'foo');
    assert.strictEqual(ref.args, 'a b');
    assert.strictEqual(ref.syntax, 'skill-colon');
  });

  test("/foo a b → 裸名整体即技能名，args 为剩余文本", () => {
    const ref = model.parseSkillRef('/foo a b', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'skill');
    assert.strictEqual(ref.name, 'foo');
    assert.strictEqual(ref.args, 'a b');
    assert.strictEqual(ref.syntax, 'bare');
  });

  test('/foo → 裸名无 args', () => {
    const ref = model.parseSkillRef('/foo', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'skill');
    assert.strictEqual(ref.name, 'foo');
    assert.strictEqual(ref.args, '');
    assert.strictEqual(ref.syntax, 'bare');
  });
});

describe('A 组 · parseSkillRef —— 边界反例', () => {
  test("/foobar 对 foo 不命中（严格前缀 + 空白边界）", () => {
    // 「不命中 foo」= 既不是 foo 命令、也不是名为 foo 的技能解析结果
    const ref = model.parseSkillRef('/foobar', ['foo']);
    assert.notStrictEqual(ref && ref.kind, 'command', '不得宽松前缀命中本地命令 foo');
    assert.notStrictEqual(ref && ref.name, 'foo', '不得解析为名为 foo 的调用');
    assert.strictEqual(ref, null, '本地命令名构成裸名前缀但不成立严格边界 → 歧义，按未知命令处理');
  });

  test("/foo-bar 对 foo 不命中", () => {
    assert.strictEqual(model.parseSkillRef('/foo-bar', ['foo']), null);
  });

  test("'/' → null（无 token）", () => {
    assert.strictEqual(model.parseSkillRef('/', COMMAND_NAMES), null);
  });

  test("'/skill:' → null（空名）", () => {
    assert.strictEqual(model.parseSkillRef('/skill:', COMMAND_NAMES), null);
  });

  test("'/skill:Foo' → null（违反 ^[a-z0-9-]+$）", () => {
    assert.strictEqual(model.parseSkillRef('/skill:Foo', COMMAND_NAMES), null);
  });

  test("'/Skill:foo' → 按裸名处理且不命中 'foo'（前缀大小写敏感）", () => {
    const ref = model.parseSkillRef('/Skill:foo', COMMAND_NAMES);
    assert.ok(ref, '应作为裸名解析（前缀大小写敏感，不是 /skill: 语法）');
    assert.strictEqual(ref.kind, 'skill');
    assert.strictEqual(ref.name, 'Skill:foo');
    assert.strictEqual(ref.syntax, 'bare');
    assert.notStrictEqual(ref.name, 'foo', '不得解析为名为 foo 的调用');
  });

  test('非斜杠前缀 / 非字符串 → null', () => {
    assert.strictEqual(model.parseSkillRef('clear', COMMAND_NAMES), null);
    assert.strictEqual(model.parseSkillRef('', COMMAND_NAMES), null);
    assert.strictEqual(model.parseSkillRef(null, COMMAND_NAMES), null);
    assert.strictEqual(model.parseSkillRef(undefined, COMMAND_NAMES), null);
  });
});

describe('A 组 · parseSkillRef —— 本地命令优先（D-04）', () => {
  test("/clear → {kind:'command', name:'clear'}（本地命令优先，即使存在同名技能）", () => {
    const ref = model.parseSkillRef('/clear', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'command');
    assert.strictEqual(ref.name, 'clear');
  });

  test("/clear x → 本地命令 + args", () => {
    const ref = model.parseSkillRef('/clear x', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'command');
    assert.strictEqual(ref.name, 'clear');
  });

  test("/compact 重点保留登录 → 本地命令（带 args）", () => {
    const ref = model.parseSkillRef('/compact 重点保留登录', COMMAND_NAMES);
    assert.strictEqual(ref.kind, 'command');
    assert.strictEqual(ref.name, 'compact');
  });

  test('严格边界：/clearx 不吃 /clear 命令', () => {
    const ref = model.parseSkillRef('/clearx', COMMAND_NAMES);
    assert.notStrictEqual(ref && ref.kind, 'command');
  });

  test('/compact-helper 以命令名 compact 开头 → 歧义返回 null（不得误判为本地命令）', () => {
    const ref = model.parseSkillRef('/compact-helper', COMMAND_NAMES);
    assert.notStrictEqual(ref && ref.kind, 'command');
    assert.strictEqual(ref, null);
  });
});

describe('A 组 · 跨进程契约：renderer 与 main 共用同一份 token / 边界规则', () => {
  const SHARED_INPUTS = [
    '/skill:foo',
    '/skill:foo a b',
    '/skill:find-skills 帮我找 X',
    '/foo',
    '/foo a b',
    '/skill:',
    '/skill:Foo',
    '/',
  ];

  test('ai-manager.parseSkillInvocationText 已导出为函数', () => {
    assert.strictEqual(typeof aiManager.parseSkillInvocationText, 'function');
  });

  test('同一组输入产出相同的 {name, args}（防 renderer / main 规则漂移）', () => {
    for (const input of SHARED_INPUTS) {
      const rendererRef = model.parseSkillRef(input, COMMAND_NAMES);
      const mainRef = aiManager.parseSkillInvocationText(input);
      if (!rendererRef || !mainRef) {
        assert.strictEqual(
          rendererRef, mainRef,
          `${input}: renderer 与 main 的可解析性判定必须一致`
        );
        continue;
      }
      assert.strictEqual(mainRef.name, rendererRef.name, `${input}: name 必须一致`);
      assert.strictEqual(mainRef.args, rendererRef.args, `${input}: args 必须一致`);
    }
  });

  test('main 侧不识别本地命令（本地命令优先由 renderer 侧保证）', () => {
    // main 只认 /skill: 与裸名两条文法；/clear 在 main 侧是裸名 'clear'
    const mainRef = aiManager.parseSkillInvocationText('/clear');
    assert.ok(mainRef, 'main 侧裸名仍应解析（renderer 已在本地命令处截走）');
    assert.strictEqual(mainRef.name, 'clear');
    assert.strictEqual(mainRef.args, '');
  });

  test('同一目标的不同语法形态产出相同 {name, args}（/skill:foo x ≡ /foo x）', () => {
    const colon = aiManager.parseSkillInvocationText('/skill:foo x');
    const bare = aiManager.parseSkillInvocationText('/foo x');
    assert.strictEqual(colon.name, bare.name);
    assert.strictEqual(colon.args, bare.args);
  });
});

describe('A 组 · 双模式导出（同一 api 对象引用）', () => {
  test('SKILL_PREFIX 常量与 api 形状', () => {
    assert.strictEqual(model.SKILL_PREFIX, 'skill:');
    assert.strictEqual(typeof model.extractArgs, 'function');
    assert.strictEqual(typeof model.parseSkillRef, 'function');
    assert.strictEqual(typeof model.parseSkillInvocationText, 'function');
  });

  test('require 取到的 api 是普通对象（无 thenable / 无副作用）', () => {
    assert.strictEqual(typeof model, 'object');
    assert.strictEqual(model.then, undefined);
  });
});

// ==================== 48-01 C 组：renderer 半边（反向映射 / 预检分支 / 重发载荷） ====================

describe('C 组 · buildSkillSyntaxText 往返（语法文本 ↔ {name, args} 的互逆映射）', () => {
  const TABLE = [
    ['alpha', ''],
    ['alpha', '帮我找 X'],
    ['alpha', '第一段\n\n第二段'],
    ['a-b', 'x  y'],
  ];

  for (const [name, args] of TABLE) {
    test(`parseSkillRef(buildSkillSyntaxText(${JSON.stringify(name)}, ${JSON.stringify(args)})) 还原同一 {name, args}`, () => {
      const text = model.buildSkillSyntaxText(name, args);
      const ref = model.parseSkillRef(text, COMMAND_NAMES);
      assert.ok(ref, '反向组装的语法文本必须能被正向解析');
      assert.strictEqual(ref.kind, 'skill');
      assert.strictEqual(ref.name, name);
      assert.strictEqual(ref.args, args, 'args 必须逐字符往返（含空行与多空格）');
    });
  }

  test('空 args 例：结果恰为 `/skill:{name}`，无尾随空格', () => {
    const text = model.buildSkillSyntaxText('alpha', '');
    assert.strictEqual(text, '/skill:alpha');
    assert.strictEqual(/\s$/.test(text), false, '不得有尾随空格');
  });

  test('与 parseSkillInvocationText（main 侧）同样互为逆映射', () => {
    const text = model.buildSkillSyntaxText('find-skills', '帮我找 X');
    const mainRef = aiManager.parseSkillInvocationText(text);
    assert.strictEqual(mainRef.name, 'find-skills');
    assert.strictEqual(mainRef.args, '帮我找 X');
  });
});

describe('C 组 · renderer 源码护栏（预检分支 / 重发载荷 / 气泡渲染）', () => {
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

  /** 取函数体文本（`function <name>(` 到下一个行首 `}`） */
  function functionBody(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `源码中应存在 function ${name}(`);
    const end = source.indexOf('\n}', start);
    return source.slice(start, end);
  }

  /** 取 async 函数体（`async function <name>(` 到下一个行首 `}`） */
  function asyncFunctionBody(source, name) {
    const start = source.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, `源码中应存在 async function ${name}(`);
    const end = source.indexOf('\n}', start);
    return source.slice(start, end);
  }

  test('SLASH_COMMANDS 数组字面量仍是 clear / compact 两条（技能不得并入，P-48-02）', () => {
    const start = rendererSrc.indexOf('const SLASH_COMMANDS = [');
    assert.ok(start >= 0, '应存在 SLASH_COMMANDS 声明');
    const block = rendererSrc.slice(start, rendererSrc.indexOf('];', start));
    const names = [...block.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
    assert.deepStrictEqual(names, ['clear', 'compact'], '技能必须作为第二命令源经 kind 判别，不得并入注册表');
  });

  test('技能分支：只按 kind 分流，无本地否决（48 G-48-3）', () => {
    const body = asyncFunctionBody(rendererSrc, 'handleSendAIMessage');
    const guardIdx = body.indexOf("kind === 'skill'");
    assert.ok(guardIdx >= 0, '技能分支必须按 kind 判别分流');
    // 只看代码行（注释里可以说明「为何不做本地否决」，那不是判定条件）。
    // 区域取到 `} else {`（未知命令分支）之前，不用固定长度窗口（避免卷进 else 分支）
    const segment = body
      .slice(guardIdx, body.indexOf('} else {', guardIdx))
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    assert.ok(segment.includes('abortAIIfStreaming('), '技能分支仍需中止上一轮后发起调用');
    assert.strictEqual(
      segment.includes('state.aiSkills'),
      false,
      '发送路径不得读快照（G-48-3：快照可能陈旧，调用那一刻实时读盘是硬约束）'
    );
    assert.strictEqual(
      segment.includes('pushSystemNote('),
      false,
      '渲染端不得复制失败文案 / 本地出系统提示（文案与判定单源在主进程）'
    );
    assert.strictEqual(
      segment.includes('disableModelInvocation'),
      false,
      'disableModelInvocation 不参与任何拒绝条件（DISC-07 clause ③：仅显式技能仍可手打调用）'
    );
    assert.strictEqual(
      segment.includes('已遮蔽'),
      false,
      'shadowed 不再是拒绝条件（46 D-08 name 唯一性下本就不可达）'
    );
    // 跨文件护栏：两条失败文案与判定入口的唯一来源仍是主进程 —— 删除本地否决后，
    // 任一 侧被删都会让本断言变红（防两侧同时消失后 UX 静默丢失）
    const aiManagerSrc = fs.readFileSync(path.join(__dirname, '..', 'ai-manager.js'), 'utf8');
    assert.ok(aiManagerSrc.includes('skillErrorFromReason'), '主进程必须仍是判定与文案的唯一来源');
  });

  test('双变量解耦：气泡正文取 args、IPC 载荷取完整语法文本（D-19 / D-06）', () => {
    const body = asyncFunctionBody(rendererSrc, 'handleSendAIMessage');
    const bubbleIdx = body.indexOf('const bubbleContent = skillRef ? skillRef.args : text;');
    assert.ok(bubbleIdx >= 0, '必须显式写开「气泡正文」变量（技能路径 = args 原文）');
    assert.ok(body.includes('content: bubbleContent,'), 'user 消息对象的 content 取气泡正文变量');
    const ipcIdx = body.indexOf('window.realmAPI.ai.prompt(text)');
    assert.ok(ipcIdx >= 0, 'IPC 载荷必须仍是完整语法文本 text（D-19）');
    assert.ok(ipcIdx > bubbleIdx, '气泡先渲染（content 赋值在 IPC 调用之前，响应只回填元数据）');
    assert.ok(body.includes('message: text,'), 'promptWithContext 的载荷同样是 text');
    assert.strictEqual(body.includes('window.realmAPI.ai.prompt(bubbleContent)'), false, '不得把显示值当 IPC 载荷');
    assert.strictEqual(body.includes('ai.prompt(skillRef.args)'), false, '不得把 args 当 IPC 载荷');

    // 气泡正文不含 `/skill:` 前缀（content 逐字符等于 parseSkillRef(text).args）
    const ref = model.parseSkillRef('/skill:alpha 帮我找 X', COMMAND_NAMES);
    assert.strictEqual(ref.args, '帮我找 X');
    assert.strictEqual(ref.args.includes('/skill:'), false, 'args 不得含语法前缀');
    assert.strictEqual(ref.args.includes('@'), false, 'args 不得含引用/marker 残留');
  });

  test('响应只回填 skillInvocation、不改写 content；skillError 走回滚 + system-note', () => {
    const body = asyncFunctionBody(rendererSrc, 'handleSendAIMessage');
    assert.ok(body.includes('result.skillInvocation'), '必须消费响应回传的 skillInvocation');
    assert.ok(body.includes('result.skillError'), '必须消费结构化 skillError');
    assert.strictEqual(
      /result\.skillInvocation[\s\S]{0,120}?\.content\s*=/.test(body),
      false,
      '不得用响应改写 user 消息的 content（content 恒为 args）'
    );
    assert.ok(body.includes('pushSystemNote(result.skillError.message)'), '错误文案由 main 给、renderer 只呈现');
  });

  test('气泡渲染：pill + 折叠块走 DOM API / textContent，零 innerHTML（T-48-03）', () => {
    const pill = functionBody(rendererSrc, 'renderAISkillPill');
    const box = functionBody(rendererSrc, 'renderSkillContentBox');

    assert.ok(pill.includes('ai-skill-pill'), 'pill 复用 .ai-message-ref-pill 并加 .ai-skill-pill');
    assert.ok(pill.includes('ai-skill-pill-badge'), '必须渲染「技能」微标');
    assert.ok(pill.includes('textContent'), '技能名必须经 textContent 注入');
    assert.strictEqual(pill.includes('innerHTML'), false, 'pill 一律 DOM API + textContent');

    assert.ok(box.includes('ai-skill-content-box'), '必须渲染技能正文折叠块');
    assert.ok(
      box.includes('skillInvocation.content.length'),
      '折叠块 N 口径必须是 JS String.length'
    );
    assert.ok(box.includes('textContent'), '正文必须经 textContent 注入');
    assert.strictEqual(box.includes('innerHTML'), false, '折叠块一律 DOM API + textContent');

    assert.strictEqual(rendererSrc.includes('Buffer.byteLength'), false, '不得改用字节数');
    assert.strictEqual(rendererSrc.includes('TextEncoder'), false, '不得改用字节数');

    // 顺序契约迁到**用户气泡构建单源** `buildUserMessageContent`（G-48-6：整列渲染与
    // 定向重绘共用同一份；顺序即契约 —— pill 在正文前、折叠块在附件后）
    assert.strictEqual(
      (rendererSrc.match(/function buildUserMessageContent\(/g) || []).length,
      1,
      'buildUserMessageContent 必须只有一份实现（不得复制第二份）'
    );
    const userBubble = functionBody(rendererSrc, 'buildUserMessageContent');
    const pillCall = userBubble.indexOf('renderAISkillPill(');
    const textCall = userBubble.indexOf('textDiv.textContent');
    const boxCall = userBubble.indexOf('renderSkillContentBox(');
    assert.ok(pillCall >= 0 && boxCall >= 0, 'buildUserMessageContent 必须挂载 pill 与折叠块');
    assert.ok(pillCall < textCall, 'pill 必须在正文之前');
    assert.ok(boxCall > textCall, '折叠块必须在正文/附件之后');

    // 已迁出：renderAIMessages 内不得再有第二份构建逻辑（防实现复活）
    const renderBody = functionBody(rendererSrc, 'renderAIMessages');
    assert.ok(renderBody.includes('buildUserMessageContent('), '整列渲染必须委派单源构建');
    assert.strictEqual(
      renderBody.includes('renderAISkillPill('),
      false,
      'renderAIMessages 不得保留第二份 pill 构建（已迁至 buildUserMessageContent）'
    );
    assert.strictEqual(
      renderBody.includes('renderSkillContentBox('),
      false,
      'renderAIMessages 不得保留第二份折叠块构建（已迁至 buildUserMessageContent）'
    );
  });

  test('回填后立即刷新该条气泡（G-48-6：三处调用点都在 skillInvocation 赋值之后）', () => {
    // 发送路径：回填 result.skillInvocation → 立即刷新
    const send = asyncFunctionBody(rendererSrc, 'handleSendAIMessage');
    const sendRefill = send.indexOf('userMsg.skillInvocation = result.skillInvocation');
    const sendRefresh = send.indexOf('refreshUserMessageBubble(userMsgId)');
    assert.ok(sendRefill >= 0, 'handleSendAIMessage 必须回填响应的 skillInvocation');
    assert.ok(sendRefresh >= 0, 'handleSendAIMessage 必须在回填后刷新该条气泡');
    assert.ok(sendRefresh > sendRefill, '刷新必须在回填**之后**（回填前刷新拿不到 pill / 折叠块）');

    // 重发路径（重新生成）
    const regen = asyncFunctionBody(rendererSrc, 'regenerateMessage');
    const regenRefill = regen.indexOf('resent.skillInvocation = res.skillInvocation');
    const regenRefresh = regen.indexOf('refreshUserMessageBubble(resentUserId)');
    assert.ok(regenRefill >= 0, 'regenerateMessage 必须用本次读盘结果覆盖折叠块正文');
    assert.ok(regenRefresh >= 0, 'regenerateMessage 必须在回填后刷新该条气泡');
    assert.ok(regenRefresh > regenRefill, '重发生路径的刷新同样必须在回填之后');

    // 重发路径（错误重试按钮处理器）
    const retryStart = rendererSrc.indexOf('retryBtn.addEventListener');
    assert.ok(retryStart >= 0, '应存在错误重试处理器');
    const retryEnd = rendererSrc.indexOf('errorDiv.appendChild(errorText)', retryStart);
    assert.ok(retryEnd > retryStart, '重试处理器区域应可界定');
    const retry = rendererSrc.slice(retryStart, retryEnd);
    const retryRefill = retry.indexOf('target.skillInvocation = res.skillInvocation');
    const retryRefresh = retry.indexOf('refreshUserMessageBubble(retryUserMsg.id)');
    assert.ok(retryRefill >= 0, '错误重试必须回填 skillInvocation');
    assert.ok(retryRefresh >= 0, '错误重试必须在回填后刷新该条气泡');
    assert.ok(retryRefresh > retryRefill, '重试路径的刷新同样必须在回填之后');
  });

  test('refreshUserMessageBubble 是定向更新（replaceChild，不整列清空重建）', () => {
    const body = functionBody(rendererSrc, 'refreshUserMessageBubble');
    assert.ok(body.includes('buildUserMessageContent('), '必须复用单源构建（不得另写一份）');
    assert.ok(body.includes('replaceChild'), '必须只替换该条的 .ai-message-content');
    assert.ok(
      /if \(!wrapper\) \{\s*renderAIMessages\(\);\s*return;/.test(body),
      '取不到 wrapper 时必须回落整列重绘（与 updateAIStreamingBubble 的竞态容错一致）'
    );
    assert.strictEqual(
      body.includes("innerHTML = ''"),
      false,
      '不得整列清空重建（会丢滚动位置与正在流式的气泡节点）'
    );
    assert.ok(
      body.includes("msg.role !== 'user'"),
      '非 user 消息直接返回（本函数只服务用户气泡）'
    );
  });

  test('重发路径：buildResendPayload 是唯一实现，两条路径共用且带 await', () => {
    const defs = (rendererSrc.match(/function buildResendPayload\(/g) || []).length;
    assert.strictEqual(defs, 1, 'buildResendPayload 必须只有一份实现');
    const body = functionBody(rendererSrc, 'buildResendPayload');
    assert.ok(body.includes('buildSkillSyntaxText('), '重发载荷必须由反向唯一实现重组');
    assert.ok(body.includes('skillInvocation'), '技能调用消息必须走重组分支');

    const regen = asyncFunctionBody(rendererSrc, 'regenerateMessage');
    assert.ok(regen.includes('buildResendPayload('), 'regenerateMessage 必须共用该函数');
    assert.ok(regen.includes('await window.realmAPI.ai.prompt(payload)'), '重发必须 await 且载荷为 payload');
    assert.ok(regen.includes('if (!payload)'), '空值守卫必须以 payload 为判据（空 args 不得静默不动作）');
    assert.strictEqual(
      regen.includes('if (!userMsgContent) return;'),
      false,
      '不得再以 content 判空（技能调用在 args 为空时载荷仍非空）'
    );
    assert.ok(regen.includes('res.skillError'), '必须消费 skillError');
    assert.ok(regen.includes('res.skillInvocation'), '必须用本次读盘结果覆盖折叠块正文');

    const retryIdx = rendererSrc.indexOf('retryBtn.addEventListener');
    assert.ok(retryIdx >= 0, '应存在错误重试处理器');
    const retry = rendererSrc.slice(retryIdx, retryIdx + 1600);
    assert.ok(retry.includes('buildResendPayload('), '错误重试必须共用该函数');
    assert.ok(retry.includes('await window.realmAPI.ai.prompt(payload)'), '重试必须 await 且载荷为 payload');
  });

  test('skills:changed 监听：无条件重拉快照、绝不触发刷新（P-48-06 / G-48-3）', () => {
    const idx = rendererSrc.indexOf("onIpcMessage('skills:changed'");
    assert.ok(idx >= 0, '必须新增 skills:changed 监听');
    const segment = rendererSrc.slice(idx, idx + 300);
    assert.strictEqual(
      segment.includes('if (!state.slashPickerOpen)'),
      false,
      '不得再有面板关闭早退（G-48-3：广播到达即无条件重拉快照）'
    );
    assert.ok(
      /=>\s*\{\s*pullAiSkillsSnapshot\(\);\s*\}/.test(segment),
      '处理器体内直接重拉快照（无前置早退 / 无附加分支）'
    );
    assert.strictEqual(segment.includes('refreshSkills'), false, '绝不自激（广播 → 刷新 → 再广播）');
    assert.ok(segment.includes('pullAiSkillsSnapshot('), '监听只重拉快照');

    const pull = asyncFunctionBody(rendererSrc, 'pullAiSkillsSnapshot');
    assert.ok(pull.includes('realmAPI.ai.getSkills()'), '重拉实现必须是零 IO 的 getSkills');
    assert.ok(pull.includes('aiSkillsDigest'), 'digest 相同必须原地返回（不重渲染、不丢 activeIndex）');

    // 广播路径之外，renderer 只允许**一处**主进程重扫调用点：openSlashPicker 的
    // stale-while-revalidate 刷新半边（D-17 / P8 触发点）。广播处理器内绝不刷新，
    // 否则「广播 → 刷新 → 再广播」自激（P-48-06）。
    assert.strictEqual(
      (rendererSrc.match(/\.refreshSkills\(/g) || []).length,
      1,
      'renderer 只允许 openSlashPicker 一处重扫调用点'
    );
    assert.ok(
      functionBody(rendererSrc, 'openSlashPicker').includes('ai.refreshSkills'),
      '唯一的调用点必须在 openSlashPicker 的后台刷新半边'
    );
  });

  test('启动预热：skills:changed 挂载点同处 fire-and-forget 拉一次快照', () => {
    const idx = rendererSrc.indexOf("onIpcMessage('skills:changed'");
    const segment = rendererSrc.slice(idx, idx + 300);
    assert.ok(
      (segment.match(/pullAiSkillsSnapshot\(\)/g) || []).length >= 2,
      '挂载点同处必须有一次预热调用（面板首帧用内存快照同步渲染，预热让首次打开不出现空态闪烁）'
    );
  });

  test('renderer / preload / ipc-handlers 三文件零限额字面量（限额单源在 ai-skills-manager）', () => {
    for (const file of ['src/renderer.js', 'src/preload.js', 'ipc-handlers.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      for (const literal of ['64 * 1024', '65536', '8000', 'MAX_USER_SKILLS']) {
        assert.strictEqual(src.includes(literal), false, `${file} 不得出现限额字面量 ${literal}`);
      }
      // 数值 50 在普通代码里大量合法出现，故只断言「技能语境下的 50」不存在
      for (const line of src.split('\n')) {
        if (/skill/i.test(line)) {
          assert.strictEqual(
            /(?<![0-9])50(?![0-9])/.test(line),
            false,
            `${file} 的技能相关行不得出现 50 这个限额数值：${line.trim()}`
          );
        }
      }
    }
  });

  test('单一数据权威：renderer 不得重算技能集状态（优先级 / 遮蔽 / 定序）', () => {
    for (const forbidden of ['bySkillPriority', 'shadowedBy', 'localeCompare']) {
      assert.strictEqual(
        rendererSrc.includes(forbidden),
        false,
        `renderer 不得重实现 ${forbidden}（46 D-06：判定只在主进程一份）`
      );
    }
  });
});

// ==================== 48-02 B 组：面板纯逻辑模型（过滤两档 / 展平 / selectable / 导航 / 徽标表） ====================

describe('B 组 · 展平与分区计数（D-01 单数组不变式）', () => {
  /** 本地命令注册表同形（renderer 的 SLASH_COMMANDS 为零改动的唯一来源） */
  const COMMANDS = [
    { name: 'clear', description: '开启新对话', takesArg: false, handler: () => {} },
    { name: 'compact', description: '压缩上下文', takesArg: true, handler: () => {} },
  ];

  /** 主进程收窄投影条目（48-01 的形状，renderer 只消费不重算） */
  function skill(name, extra = {}) {
    return {
      name,
      description: `${name} 描述`,
      tier: 'user',
      disableModelInvocation: false,
      disabled: false,
      shadowed: false,
      overLimit: false,
      promptOmitted: false,
      ...extra,
    };
  }

  test('技能 0 项 → items 恰为命令分区，skillCount 0 / commandCount 2', () => {
    const built = model.buildPickerItems([], COMMANDS, '');
    assert.deepStrictEqual(built.items.map((i) => i.name), ['clear', 'compact']);
    assert.strictEqual(built.skillCount, 0);
    assert.strictEqual(built.commandCount, 2);
    assert.ok(built.items.every((i) => i.kind === 'command'));
  });

  test('技能 1 项 → 技能项在数组最前（顺序 = 视觉顺序，标题不占索引）', () => {
    const built = model.buildPickerItems([skill('alpha')], COMMANDS, '');
    assert.strictEqual(built.items[0].name, 'alpha');
    assert.strictEqual(built.items[0].kind, 'skill');
    assert.deepStrictEqual(built.items.slice(1).map((i) => i.name), ['clear', 'compact']);
    assert.strictEqual(built.skillCount, 1);
    assert.strictEqual(built.commandCount, 2);
    assert.strictEqual(built.items.length, 3, 'items 长度 = 技能 + 命令，分组标题不占位');
  });

  test('技能多项 → 技能分区在命令分区之前且保留投影原序', () => {
    const built = model.buildPickerItems(
      [skill('alpha'), skill('beta'), skill('gamma')],
      COMMANDS,
      ''
    );
    assert.deepStrictEqual(
      built.items.map((i) => i.name),
      ['alpha', 'beta', 'gamma', 'clear', 'compact']
    );
    assert.strictEqual(built.skillCount, 3);
    assert.strictEqual(built.commandCount, 2);
  });

  test('技能项形状：kind / name / description / tier / disableModelInvocation / selectable / statusText / statusTone', () => {
    const built = model.buildPickerItems([skill('alpha', { tier: 'builtin' })], COMMANDS, '');
    const item = built.items[0];
    assert.strictEqual(item.kind, 'skill');
    assert.strictEqual(item.name, 'alpha');
    assert.strictEqual(item.description, 'alpha 描述');
    assert.strictEqual(item.tier, 'builtin');
    assert.strictEqual(item.disableModelInvocation, false);
    assert.strictEqual(item.selectable, true);
    assert.strictEqual(item.statusText, undefined);
    assert.strictEqual(item.statusTone, undefined);
  });

  test('命令项形状：kind=command 且 selectable 恒为 true（命令行行为零变化）', () => {
    const built = model.buildPickerItems([], COMMANDS, '');
    for (const item of built.items) {
      assert.strictEqual(item.kind, 'command');
      assert.strictEqual(item.selectable, true);
      assert.strictEqual(item.statusText, undefined);
      assert.strictEqual(typeof item.handler, 'function');
      assert.strictEqual(item.takesArg, item.name === 'compact');
    }
  });

  test('disabled === true 的条目不出现在 items 中（D-10 面板隐藏）', () => {
    const built = model.buildPickerItems(
      [skill('alpha'), skill('off', { disabled: true }), skill('beta')],
      COMMANDS,
      ''
    );
    assert.deepStrictEqual(built.items.map((i) => i.name), ['alpha', 'beta', 'clear', 'compact']);
    assert.strictEqual(built.skillCount, 2);
  });

  test('仅显式 gating：flag 只影响标记输出条件，不改变可选中性且原样透传（DISC-07 clause ③）', () => {
    const built = model.buildPickerItems(
      [
        skill('explicit-only', { disableModelInvocation: true }),
        skill('auto-ok', { disableModelInvocation: false }),
      ],
      COMMANDS,
      ''
    );
    const only = built.items.find((i) => i.name === 'explicit-only');
    const auto = built.items.find((i) => i.name === 'auto-ok');
    assert.strictEqual(only.disableModelInvocation, true);
    assert.strictEqual(auto.disableModelInvocation, false);
    assert.strictEqual(only.selectable, true, '仅显式技能仍可被显式调用（不得剥夺可选中性）');
    assert.strictEqual(auto.selectable, true);
    assert.strictEqual(only.statusText, undefined, '仅显式不是行尾状态标注，不得与行尾标注混放');
  });
});

describe('B 组 · 过滤两档（name 前缀命中在前 / description 子串命中在后）（D-03）', () => {
  const COMMANDS = [
    { name: 'clear', description: '开启新对话' },
    { name: 'compact', description: '压缩上下文' },
  ];

  function skill(name, description) {
    return { name, description, tier: 'user', disabled: false, shadowed: false };
  }

  test('前缀命中在前档、仅描述命中在后档，各档内保持入参原序', () => {
    const skills = [
      skill('alpha', '含 fin 的描述'),
      skill('find-skills', '查找技能'),
      skill('finder', '另一个含 fin 的描述'),
    ];
    const out = model.filterPickerItems(skills, COMMANDS, 'fin');
    assert.deepStrictEqual(out.skills.map((s) => s.name), ['find-skills', 'finder', 'alpha']);
    // finder 也是前缀命中（fin 开头）—— 与 alpha（仅描述命中）分属两档
  });

  test('仅描述命中的条目排在所有前缀命中条目之后（跨入参顺序）', () => {
    const skills = [
      skill('alpha', '描述含 zeta'),
      skill('zeta-one', '前缀命中'),
      skill('beta', '描述也含 zeta'),
    ];
    const out = model.filterPickerItems(skills, COMMANDS, 'zeta');
    assert.deepStrictEqual(out.skills.map((s) => s.name), ['zeta-one', 'alpha', 'beta']);
  });

  test('空过滤 → 全部技能进前缀档（描述档为空），顺序 = 入参原序', () => {
    const skills = [skill('alpha', 'x'), skill('beta', 'y')];
    const out = model.filterPickerItems(skills, COMMANDS, '');
    assert.deepStrictEqual(out.skills.map((s) => s.name), ['alpha', 'beta']);
  });

  test('命令分区对照：与既有 startsWith 语义逐项相等（防顺手改语义）', () => {
    for (const rawFilter of ['', 'c', 'cl', 'co', 'comp', 'clear', 'z', 'skill:fo']) {
      const mine = model.filterPickerItems([], COMMANDS, rawFilter).commands;
      const legacy = COMMANDS.filter((c) => c.name.startsWith(rawFilter));
      assert.deepStrictEqual(mine, legacy, `rawFilter=${JSON.stringify(rawFilter)} 必须与既有语义逐项相等`);
    }
  });

  test('/skill:<q> token：前缀按 SKILL_PREFIX 长度剥离用于技能分区，命令分区仍用原 token（命中 0 项）', () => {
    const skills = [
      { name: 'foxtrot', description: '前缀命中' },
      { name: 'alpha', description: '描述含 fo' },
    ];
    const out = model.filterPickerItems(skills, COMMANDS, 'skill:fo');
    assert.deepStrictEqual(out.skills.map((s) => s.name), ['foxtrot', 'alpha'], '技能按剥离后的 fo 过滤');
    assert.deepStrictEqual(out.commands, [], '命令分区按原 token skill:fo 过滤 → 0 项（标题不渲染）');
  });

  test('过滤不改变 disabled 剔除（D-10 发生在过滤之前）', () => {
    const skills = [
      { name: 'alpha', description: 'a', disabled: true },
      { name: 'alpine', description: 'b', disabled: false },
    ];
    const out = model.filterPickerItems(skills, COMMANDS, 'alp');
    assert.deepStrictEqual(out.skills.map((s) => s.name), ['alpine']);
  });
});

describe('B 组 · selectable 判定与状态标注优先级（D-11 / D-12 / D-04 推导）', () => {
  const COMMANDS = [
    { name: 'clear', description: '开启新对话' },
    { name: 'compact', description: '压缩上下文' },
  ];

  function skill(name, extra = {}) {
    return { name, description: `${name} 描述`, tier: 'user', disabled: false, shadowed: false, ...extra };
  }

  test('正常技能 → selectable true 且无状态标注', () => {
    const built = model.buildPickerItems([skill('alpha')], COMMANDS, '');
    assert.strictEqual(built.items[0].selectable, true);
    assert.strictEqual(built.items[0].statusText, undefined);
    assert.strictEqual(built.items[0].statusTone, undefined);
  });

  test('shadowed → selectable false + 「已遮蔽 · 由用户同名技能胜出」/ tone muted', () => {
    const built = model.buildPickerItems([skill('alpha', { shadowed: true, shadowedBy: 'alpha' })], COMMANDS, '');
    const item = built.items[0];
    assert.strictEqual(item.selectable, false);
    assert.strictEqual(item.statusText, '已遮蔽 · 由用户同名技能胜出');
    assert.strictEqual(item.statusTone, 'muted');
  });

  test('与本地命令同名 → selectable false + 「与本地命令同名 · 本地命令优先」/ tone muted', () => {
    const built = model.buildPickerItems([skill('clear')], COMMANDS, '');
    const item = built.items.find((i) => i.kind === 'skill');
    assert.strictEqual(item.selectable, false);
    assert.strictEqual(item.statusText, '与本地命令同名 · 本地命令优先');
    assert.strictEqual(item.statusTone, 'muted');
  });

  test('overLimit → 可选中 + 「超数量上限」/ tone limit（显式调用是它唯一可用路径，D-12）', () => {
    const built = model.buildPickerItems([skill('alpha', { overLimit: true })], COMMANDS, '');
    const item = built.items[0];
    assert.strictEqual(item.selectable, true);
    assert.strictEqual(item.statusText, '超数量上限');
    assert.strictEqual(item.statusTone, 'limit');
  });

  test('promptOmitted → 可选中 + 「未进提示词 · 超预算」/ tone limit（D-12 原文两段式，照写不统一）', () => {
    const built = model.buildPickerItems([skill('alpha', { promptOmitted: true })], COMMANDS, '');
    const item = built.items[0];
    assert.strictEqual(item.selectable, true);
    assert.strictEqual(item.statusText, '未进提示词 · 超预算');
    assert.strictEqual(item.statusTone, 'limit');
  });

  test('优先级 shadowed > 与本地命令同名 > promptOmitted > overLimit（同时命中取更高档）', () => {
    const built = model.buildPickerItems(
      [
        skill('clear', { shadowed: true, promptOmitted: true, overLimit: true }),
        skill('compact', { promptOmitted: true, overLimit: true }),
        skill('zeta', { promptOmitted: true, overLimit: true }),
      ],
      COMMANDS,
      ''
    );
    const byName = Object.fromEntries(built.items.filter((i) => i.kind === 'skill').map((i) => [i.name, i]));
    assert.strictEqual(byName.clear.statusText, '已遮蔽 · 由用户同名技能胜出');
    assert.strictEqual(byName.clear.statusTone, 'muted');
    assert.strictEqual(byName.compact.statusText, '与本地命令同名 · 本地命令优先');
    assert.strictEqual(byName.compact.statusTone, 'muted');
    assert.strictEqual(byName.zeta.statusText, '未进提示词 · 超预算');
    assert.strictEqual(byName.zeta.statusTone, 'limit');
  });

  test('四条行尾状态文案只在本模块定义（唯一权威，防两处硬编码漂移）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
    const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
    for (const text of [
      '已遮蔽 · 由用户同名技能胜出',
      '与本地命令同名 · 本地命令优先',
      '未进提示词 · 超预算',
      '超数量上限',
    ]) {
      assert.strictEqual(
        (src.match(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
        1,
        `skill-picker-model.js 中「${text}」必须恰出现一次`
      );
      assert.strictEqual(rendererSrc.includes(text), false, `renderer.js 不得硬编码「${text}」`);
    }
  });
});

describe('B 组 · 导航取模只在可选中集合上（UI-SPEC 由 D-11 推导）', () => {
  test('buildSelectableIndexes：只收 selectable === true 的扁平索引', () => {
    assert.deepStrictEqual(
      model.buildSelectableIndexes([{ selectable: true }, { selectable: false }, { selectable: true }]),
      [0, 2]
    );
    assert.deepStrictEqual(model.buildSelectableIndexes([]), []);
    assert.deepStrictEqual(model.buildSelectableIndexes([{ selectable: false }]), []);
  });

  test('nextSelectableIndex：正常循环（含首尾回绕）', () => {
    assert.strictEqual(model.nextSelectableIndex([0, 2], 0, 1), 2);
    assert.strictEqual(model.nextSelectableIndex([0, 2], 2, 1), 0);
    assert.strictEqual(model.nextSelectableIndex([0, 2], 0, -1), 2);
    assert.strictEqual(model.nextSelectableIndex([0, 2], 2, -1), 0);
  });

  test('nextSelectableIndex：集合为空 → -1（全部不可选中）', () => {
    assert.strictEqual(model.nextSelectableIndex([], 0, 1), -1);
    assert.strictEqual(model.nextSelectableIndex([], -1, -1), -1);
  });

  test('nextSelectableIndex：current 不在集合内 → 按方向取最近可选中行（向后取更大索引、向前取更小索引）', () => {
    assert.strictEqual(model.nextSelectableIndex([0, 2], 1, 1), 2);
    assert.strictEqual(model.nextSelectableIndex([0, 2], 1, -1), 0);
    assert.strictEqual(model.nextSelectableIndex([0, 2], -1, 1), 0, '[-1] 起点向后 → 首个可选中行');
    assert.strictEqual(model.nextSelectableIndex([0, 2], -1, -1), 2, '[-1] 起点向前 → 末个可选中行');
    assert.strictEqual(model.nextSelectableIndex([0, 2], 9, 1), 0, '越界向后 → 回绕到首个可选中行');
  });

  test('nextSelectableIndex：集合长度 1 → 循环自指', () => {
    assert.strictEqual(model.nextSelectableIndex([7], 7, 1), 7);
    assert.strictEqual(model.nextSelectableIndex([7], 7, -1), 7);
    assert.strictEqual(model.nextSelectableIndex([7], 3, 1), 7);
  });

  test('nextSelectableIndex：密集集合上逐步行进（跨分区连续导航）', () => {
    const sel = [0, 1, 2, 5, 6]; // 3 / 4 为不可选中行（被跳过）
    assert.strictEqual(model.nextSelectableIndex(sel, 0, 1), 1);
    assert.strictEqual(model.nextSelectableIndex(sel, 2, 1), 5, '必须跳过 3 / 4 两个不可选中行');
    assert.strictEqual(model.nextSelectableIndex(sel, 5, -1), 2, '反向同样跳过');
    assert.strictEqual(model.nextSelectableIndex(sel, 6, 1), 0, '末尾回绕到首个可选中行');
    assert.strictEqual(model.nextSelectableIndex(sel, 3, 1), 5, '落点恰在不可选中行 → 向后取下一个可选中');
    assert.strictEqual(model.nextSelectableIndex(sel, 4, -1), 2, '落点恰在不可选中行 → 向前取上一个可选中');
  });

  test('buildSelectableIndexes 与 buildPickerItems 串起来：灰显行被排除在导航集合外', () => {
    const commands = [{ name: 'clear', description: '开启新对话' }];
    const skills = [
      { name: 'alpha', description: 'a', tier: 'user', disabled: false, shadowed: false },
      { name: 'shadow', description: 's', tier: 'managed', disabled: false, shadowed: true },
      { name: 'clear', description: 'c', tier: 'user', disabled: false, shadowed: false },
    ];
    const built = model.buildPickerItems(skills, commands, '');
    const sel = model.buildSelectableIndexes(built.items);
    assert.deepStrictEqual(
      sel,
      [0, 3],
      '仅 alpha（技能）与 clear（命令）可选中；shadow 与被遮蔽 / 同名行均被排除'
    );
    assert.strictEqual(built.items[1].selectable, false);
    assert.strictEqual(built.items[2].selectable, false);
  });
});

describe('B 组 · TIER_BADGE 三档徽标唯一权威查表（D-14 消费方）', () => {
  test('恰有三个键 user / builtin / managed', () => {
    assert.deepStrictEqual(Object.keys(model.TIER_BADGE).sort(), ['builtin', 'managed', 'user']);
  });

  test('label 依次为 用户 / 内置 / 托管，且 className 两两不同', () => {
    assert.strictEqual(model.TIER_BADGE.user.label, '用户');
    assert.strictEqual(model.TIER_BADGE.builtin.label, '内置');
    assert.strictEqual(model.TIER_BADGE.managed.label, '托管');
    const classNames = ['user', 'builtin', 'managed'].map((t) => model.TIER_BADGE[t].className);
    assert.strictEqual(new Set(classNames).size, 3, '三个白名单 class 必须两两不同');
    for (const t of ['user', 'builtin', 'managed']) {
      assert.strictEqual(typeof model.TIER_BADGE[t].title, 'string');
      assert.ok(model.TIER_BADGE[t].title.length > 0, `${t} 必须有固定 title 文案`);
    }
  });

  test('三档 label 字面量在模块内各出现恰一次（徽标文案唯一权威）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
    for (const label of ["'用户'", "'内置'", "'托管'"]) {
      assert.strictEqual(
        (src.split(label).length - 1),
        1,
        `skill-picker-model.js 中 ${label} 必须恰出现一次（TIER_BADGE 定义处）`
      );
    }
  });
});

describe('B 组 · MANAGE_SKILL_* 两张白名单表（Phase 49 / D-02 / D-07，跨进程单源）', () => {
  test('MANAGE_SKILL_ACTION_LABEL：恰三键、值域逐字、模板恰一个 {name} 占位符、已冻结', () => {
    const table = model.MANAGE_SKILL_ACTION_LABEL;
    assert.ok(table, '必须导出 MANAGE_SKILL_ACTION_LABEL');
    assert.strictEqual(Object.isFrozen(table), true, '动作标题表必须是 Object.freeze（闭合白名单）');
    assert.deepStrictEqual(Object.keys(table).sort(), ['create', 'delete', 'update']);
    assert.strictEqual(table.create, '创建技能「{name}」');
    assert.strictEqual(table.update, '更新技能「{name}」');
    assert.strictEqual(table.delete, '删除技能「{name}」');
    for (const action of ['create', 'update', 'delete']) {
      assert.strictEqual(
        (table[action].match(/\{name\}/g) || []).length,
        1,
        `${action} 的模板必须恰含一个 {name} 占位符（渲染端 replace 只替换首个）`
      );
    }
  });

  test('MANAGE_SKILL_SHORT_REASON：恰九键、值域逐字、已冻结', () => {
    const table = model.MANAGE_SKILL_SHORT_REASON;
    assert.ok(table, '必须导出 MANAGE_SKILL_SHORT_REASON');
    assert.strictEqual(Object.isFrozen(table), true, '短原因表必须是 Object.freeze（闭合白名单）');
    assert.strictEqual(Object.keys(table).length, 9, '短原因表必须恰九条（D-07 的九码，不增不减）');
    assert.deepStrictEqual(table, {
      seeded_protected: '内置不可改删',
      user_owned_conflict: '用户技能占用',
      already_exists: '已存在',
      not_found: '不存在',
      limit_exceeded: '超数量上限',
      invalid_name: '名称不合法',
      invalid_description: '描述不合法',
      oversize: '正文超限',
      unscannable: '内容含风险',
    });
  });

  test('短原因一律定长 ≤ 6 字且不含技能名占位符（头部单行不变式的前提）', () => {
    const table = model.MANAGE_SKILL_SHORT_REASON;
    for (const [code, text] of Object.entries(table)) {
      assert.ok(text.length <= 6, `${code} 的短原因「${text}」超过 6 字（会挤破卡片头部的单行不变式）`);
      assert.strictEqual(
        text.includes('{name}') || text.includes('{'),
        false,
        `${code} 的短原因不得含变量 / 技能名（必须是定长文案）`
      );
    }
  });

  test('闭合白名单：表外键取值为 undefined（不回落任何默认文案）；limit_exceeded 与 STATUS_TEXT.overLimit 同值', () => {
    assert.strictEqual(model.MANAGE_SKILL_ACTION_LABEL.rename, undefined);
    assert.strictEqual(model.MANAGE_SKILL_ACTION_LABEL[''], undefined);
    assert.strictEqual(model.MANAGE_SKILL_SHORT_REASON.unknown_code, undefined);
    assert.strictEqual(
      model.MANAGE_SKILL_SHORT_REASON.limit_exceeded,
      model.STATUS_TEXT.overLimit,
      'limit_exceeded 必须与面板行尾标注 STATUS_TEXT.overLimit **同值**（查同一张表，不新写一份）'
    );
    // 同值时也必须真的是「复用同一常量」而非巧合同文案：源码里该键的值必须是引用形式
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
    assert.ok(
      /limit_exceeded:\s*STATUS_TEXT\.overLimit/.test(src),
      'limit_exceeded 的取值必须写成 STATUS_TEXT.overLimit（引用同一常量，机械保证同值）'
    );
  });

  // ===== G-49-3 收口（Phase 49 07）：卡片头部超预算标注的 ≤ 4 字投影 =====
  // 这 6 组是 280px 布局的前提条件护栏（标注必须短到 129px 预算内），**不替代**真实渲染门禁
  // （tests/uat-49-g49-3-panel-layout.js 的 A1–A9）。

  test('G-49-3 · PROMPT_OMITTED_CARD_NOTE 的值域：是 STATUS_TEXT.promptOmitted 的第二段投影', () => {
    const note = model.PROMPT_OMITTED_CARD_NOTE;
    assert.strictEqual(typeof note, 'string', 'PROMPT_OMITTED_CARD_NOTE 必须导出为字符串');
    assert.strictEqual(
      model.STATUS_TEXT.promptOmitted.includes(note),
      true,
      '短形态必须是面板长串的子串（值域护栏，**不是**「不新写」的证明 —— 写死第二份字面量同样满足本条）'
    );
    assert.strictEqual(
      model.STATUS_TEXT.promptOmitted.split(' · ').pop(),
      note,
      '短形态必须是该串按分隔符切分后的**第二段**（第一段 5 字，不满足 E1 的 ≤ 4 字）'
    );
  });

  test('G-49-3 · 「不新写」的机械保证：源码级两条同时成立（引用形式 + 零第二份字面量）', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
    assert.ok(
      /PROMPT_OMITTED_CARD_NOTE\s*=\s*STATUS_TEXT\.promptOmitted\.split\(/.test(src),
      "短形态的唯一合法书写是 STATUS_TEXT.promptOmitted.split(' · ').pop() 的**引用形式**（形态沿用本仓既有先例 MANAGE_SKILL_SHORT_REASON.limit_exceeded: STATUS_TEXT.overLimit）；写成被引号包裹的独立字符串会让本断言转红"
    );
    assert.strictEqual(
      /['"]超预算['"]/.test(src),
      false,
      'skill-picker-model.js 中不得存在第二个被引号包裹的短形态独立字面量（**注释里也不许写**）—— 这条同时封掉「声明处写成引用、导出处写死一份」的形态'
    );
  });

  test('G-49-3 · E1 的 ≤ 4 字收口：短形态 length <= 4（实测 3）', () => {
    const len = model.PROMPT_OMITTED_CARD_NOTE.length;
    assert.ok(
      len <= 4,
      `49-UI-SPEC.md 的 E1 overflow 处置要求短原因 ≤ 4 字，且 280px 面板下 .tool-card-name 仅 129px —— 实得 ${len} 字`
    );
  });

  test('G-49-3 · 48 D-12 原文冻结：STATUS_TEXT.promptOmitted 逐字未变（防「顺手统一」面板串）', () => {
    assert.strictEqual(
      model.STATUS_TEXT.promptOmitted,
      '未进提示词 · 超预算',
      '这是 48-CONTEXT.md D-12 的**原文**与 48-UI-SPEC.md「照写不统一」的契约面 —— 本轮只新增派生键，不得改动该串'
    );
  });

  test('G-49-3 · STATUS_TEXT 另三键契约冻结（shadowed / nameClash / overLimit 逐字未变）', () => {
    assert.strictEqual(model.STATUS_TEXT.shadowed, '已遮蔽 · 由用户同名技能胜出');
    assert.strictEqual(model.STATUS_TEXT.nameClash, '与本地命令同名 · 本地命令优先');
    assert.strictEqual(model.STATUS_TEXT.overLimit, '超数量上限');
  });

  test('P50 · STATUS_TEXT 第 5 条 disabled = 已禁用（消费方只有设置页）', () => {
    assert.strictEqual(
      model.STATUS_TEXT.disabled,
      '已禁用',
      '设置页「技能管理」区的行尾标注取本键；`/` 面板根本不列出被禁用技能（48 D-10）—— 同一张表的不同消费者，不是第二份文案'
    );
    // 该表**刻意没有键数断言**（UI-SPEC D-12 明文：新增第 5 键不得打翻既有断言）。
    // 既有 4 键的逐字冻结由上面两条用例承担，此处不重复、也不新增计数断言。
  });

  test('P50 · SETTINGS_STATUS_CHAIN 链序即契约（disabled > shadowed > overLimit > promptOmitted）', () => {
    assert.deepStrictEqual(
      model.SETTINGS_STATUS_CHAIN,
      ['disabled', 'shadowed', 'overLimit', 'promptOmitted'],
      '链序是 D-12 的锁定行为，不得重排（把 disabled 挪到链尾或调换 overLimit/promptOmitted 必须转红）；' +
        '且必须是冻结数组（Object.freeze —— 链是契约数据，不是可变配置）'
    );
    assert.strictEqual(Object.isFrozen(model.SETTINGS_STATUS_CHAIN), true);
    assert.strictEqual(
      model.SETTINGS_STATUS_CHAIN.includes('nameClash'),
      false,
      'nameClash 依赖本地命令表（SLASH_COMMANDS），`realm://` guest 拿不到 ⇒ 它是 `/` 面板独有维度，不在本链上'
    );
  });

  test('P50 · pickStatusKey：多命中取首条（用户主动意图优先），文案经 STATUS_TEXT 单源', () => {
    assert.strictEqual(typeof model.pickStatusKey, 'function', 'pickStatusKey 必须导出（设置页的唯一判据）');

    // RESEARCH 明文要求的用例：同时命中 disabled + overLimit ⇒ 只显示「已禁用」
    const both = { disabled: true, overLimit: true };
    assert.strictEqual(model.pickStatusKey(both), 'disabled');
    assert.strictEqual(model.STATUS_TEXT[model.pickStatusKey(both)], '已禁用');

    // 用户主动意图优先于环境判定（遮蔽）
    assert.strictEqual(model.pickStatusKey({ shadowed: true, disabled: true }), 'disabled');

    // 单命中与链序的其余顺序
    assert.strictEqual(model.pickStatusKey({ shadowed: true, promptOmitted: true }), 'shadowed');
    assert.strictEqual(model.pickStatusKey({ promptOmitted: true, overLimit: true }), 'overLimit');
    assert.strictEqual(model.pickStatusKey({ promptOmitted: true }), 'promptOmitted');

    // 一个都不命中 / 非法输入 ⇒ null（渲染端据此不渲染标注，不回落任何默认文案）
    assert.strictEqual(model.pickStatusKey({}), null);
    assert.strictEqual(model.pickStatusKey({ disabled: false }), null);
    assert.strictEqual(model.pickStatusKey(null), null);
    assert.strictEqual(model.pickStatusKey(undefined), null);
  });

  test('P50 · 链与表不漂移：链上每个键都存在于 STATUS_TEXT', () => {
    for (const key of model.SETTINGS_STATUS_CHAIN) {
      assert.strictEqual(
        typeof model.STATUS_TEXT[key],
        'string',
        `链上的 ${key} 必须在 STATUS_TEXT 里有对应文案 —— 否则 pickStatusKey 会返回一个查不到文案的键`
      );
      assert.ok(model.STATUS_TEXT[key].length > 0, `${key} 的文案不得为空`);
    }
  });

  test('G-49-3 · 九码短原因长度上限：每值非空字符串且 ≤ 6 字；limit_exceeded 引用同一常量', () => {
    const table = model.MANAGE_SKILL_SHORT_REASON;
    for (const [code, text] of Object.entries(table)) {
      assert.strictEqual(typeof text, 'string', `${code} 的短原因必须是字符串`);
      assert.ok(text.length > 0, `${code} 的短原因不得为空`);
      assert.ok(
        text.length <= 6,
        `${code} 的短原因「${text}」超过 6 字 —— 卡片头部 129px 预算下最宽 6 字（字体度量**估算** ≈ 66px）仍成立，任何加长都会在这里被拦下`
      );
    }
    assert.strictEqual(
      table.limit_exceeded,
      model.STATUS_TEXT.overLimit,
      '同值必须引用同一常量（不得改写成第二份拷贝）'
    );
  });
});

describe('B 组 · 面板接线源码扫描（renderer 侧消费点）', () => {
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');

  /** 取函数体文本（`function <name>(` 到下一个行首 `}`） */
  function bodyOf(name) {
    const start = rendererSrc.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `源码中应存在 function ${name}(`);
    return rendererSrc.slice(start, rendererSrc.indexOf('\n}', start));
  }

  test('renderSlashPickerList：消费 buildPickerItems / buildSelectableIndexes，且扁平索引直绑（P-48-04）', () => {
    const body = bodyOf('renderSlashPickerList');
    for (const key of ['buildPickerItems(', 'buildSelectableIndexes(', 'escapeHtml(', 'data-index=']) {
      assert.ok(body.includes(key), `renderSlashPickerList 必须包含 ${key}`);
    }
    assert.strictEqual(body.includes('data-cmd'), false, '不得再用旧的名字属性');
    assert.strictEqual(
      /findIndex\([\s\S]{0,80}?dataset\./.test(body),
      false,
      '不得再按名字反查索引（同名两行会点错行）'
    );
  });

  test('executeActiveSlashCommand：args 走 extractArgs token 取值法，且 handler 只在命令分支', () => {
    const body = bodyOf('executeActiveSlashCommand');
    assert.ok(body.includes('extractArgs('), 'args 必须由 token 取值法取出（P-48-01）');
    assert.strictEqual(
      body.includes('1 + cmd.name.length'),
      false,
      '按名长切片的旧形态必须消失（/skill: 形态下会吞掉 args 开头）'
    );
    assert.ok(body.includes('buildSkillSyntaxText('), '技能行必须组装完整语法文本（D-19）');
    assert.ok(body.includes('handleSendAIMessage()'), '技能行走既定发送链路');
    const commandBranchIdx = body.indexOf("kind === 'command'");
    const handlerIdx = body.indexOf('cmd.handler(');
    assert.ok(commandBranchIdx >= 0, '必须有显式的命令分支判别');
    assert.ok(handlerIdx > commandBranchIdx, 'cmd.handler( 必须落在 kind === \'command\' 分支内');
  });

  test('handleAIInputKeydown：↑↓ 只在可选中集合上取模（跳过不可选中行），Enter 回落路径逐字节保留', () => {
    const body = bodyOf('handleAIInputKeydown');
    assert.ok(body.includes('state.slashPickerSelectable'), '导航必须消费可选中索引集合');
    assert.ok(body.includes('nextSelectableIndex('), '取模必须走纯函数（集合为空 → -1）');
    assert.strictEqual(
      body.includes('state.slashPickerItems.length'),
      false,
      '不得再在全量索引上取模（会落在灰显行上）'
    );
    assert.ok(
      /if \(next < 0\) \{[\s\S]{0,160}?state\.slashPickerActiveIndex = -1;[\s\S]{0,40}?return;/.test(body),
      '全部不可选中 → 置 -1 后直接返回（不新增分支或空态文案）'
    );
    assert.ok(
      body.includes('if (!executeActiveSlashCommand()) {\n        closeSlashPicker();\n        handleSendAIMessage();\n      }'),
      'Enter 分支必须逐字符保持既有回落路径（全部不可选中时走系统提示）'
    );
  });

  test('openSlashPicker：打开即用快照渲染 + 后台刷新 + 失败 catch（无 loading 态、无自激）', () => {
    const body = bodyOf('openSlashPicker');
    assert.ok(body.includes('renderSlashPickerList();'), '第一步必须同步渲染内存快照');
    assert.ok(body.includes('ai.refreshSkills()'), '必须发起一次后台刷新（D-17 刷新半边）');
    assert.ok(/\.catch\(/.test(body), '刷新失败必须 catch（保留旧快照，不渲染成空态）');
    assert.strictEqual(/spinner|skeleton|加载中/.test(body), false, '不得有 loading 态占位');
    assert.strictEqual(
      (rendererSrc.match(/\.refreshSkills\(/g) || []).length,
      1,
      '刷新调用点唯一（广播处理器内不得再刷新 —— 自激回路）'
    );
  });
});

describe('B 组 · 双模式导出扩展（四个新函数挂在同一 api 对象上）', () => {
  test('新函数与 TIER_BADGE 均已导出，且模块仍是单一 IIFE + 单一 api 对象', () => {
    for (const k of ['buildSelectableIndexes', 'nextSelectableIndex', 'filterPickerItems', 'buildPickerItems']) {
      assert.strictEqual(typeof model[k], 'function', `缺少导出 ${k}`);
    }
    assert.strictEqual(typeof model.TIER_BADGE, 'object');
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
    assert.strictEqual((src.match(/const api = \{/g) || []).length, 1, '必须只有一个 api 对象字面量');
    assert.strictEqual((src.match(/module\.exports = api/g) || []).length, 1, 'module.exports 必须导出同一 api');
    assert.strictEqual(
      (src.match(/window\.SkillPickerModel = api/g) || []).length,
      1,
      'window.SkillPickerModel 必须导出同一 api'
    );
    assert.strictEqual((src.match(/^\(function \(\) \{/gm) || []).length, 1, '不得新开第二个 IIFE');
    assert.strictEqual((src.match(/^  const api = \{/gm) || []).length, 1, '不得新增第二份导出对象');
  });
});

// ==================== 48-02 面板渲染层：五要素 / 转义 / sticky 前提 / 样式契约 ====================

describe('B 组 · 面板五要素行与转义护栏（T-48-07）', () => {
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const modelSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'main.css'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');

  const panelBody = (() => {
    const start = rendererSrc.indexOf('function renderSlashPickerList()');
    assert.ok(start >= 0, '应存在 renderSlashPickerList');
    return rendererSrc.slice(start, rendererSrc.indexOf('\n}', start));
  })();

  /** 行构造区（徽标 → 状态 的局部变量 + 最终 html 拼接），转义窗口断言只看这一段 */
  const rowRegion = (() => {
    const start = panelBody.indexOf('const badge =');
    const end = panelBody.indexOf('list.innerHTML = html');
    assert.ok(start >= 0 && end > start, 'renderSlashPickerList 应含行构造区');
    return panelBody.slice(start, end);
  })();

  /** 最终 html 拼接模板（五要素顺序与插值转义的断点） */
  const rowTemplate = (() => {
    const tplStart = rowRegion.indexOf("html += '<div class=\"' +");
    assert.ok(tplStart >= 0, '行构造区应含最终 html 拼接');
    return rowRegion.slice(tplStart);
  })();

  /** 取一条 CSS 规则的文本（选择器 → 首个 `}`） */
  function rule(css, selector) {
    const i = css.indexOf(selector);
    assert.ok(i >= 0, `CSS 中应存在规则 ${selector}`);
    return css.slice(i, css.indexOf('}', i) + 1);
  }

  test('行五要素齐备：名称 / 来源徽标 / 仅显式标记 / 描述 / 行尾状态标注', () => {
    for (const cls of [
      'slash-picker-name',
      'slash-picker-source-badge',
      'slash-picker-tag-explicit',
      'slash-picker-desc',
      'slash-picker-status',
    ]) {
      assert.ok(panelBody.includes(cls), `行模板必须包含 ${cls}`);
    }
    // 结构顺序：名称 → 徽标 → 仅显式 → 描述 → 状态（只看最终 html 拼接模板）
    const order = ['slash-picker-name', 'badgeHtml', 'explicitTag', 'slash-picker-desc', 'statusHtml']
      .map((k) => rowTemplate.indexOf(k));
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i - 1] >= 0 && order[i] > order[i - 1], `五要素必须按 UI-SPEC 顺序拼接（${i}）`);
    }
  });

  test('分组标题：空分区整个不输出，且不占索引（无 data-index）', () => {
    assert.ok(
      panelBody.includes('index === 0 && built.skillCount > 0'),
      '技能标题只在 skillCount > 0 时输出'
    );
    assert.ok(
      panelBody.includes('index === built.skillCount && built.commandCount > 0'),
      '命令标题只在 commandCount > 0 时输出'
    );
    const headerSeg = panelBody.slice(
      panelBody.indexOf('slash-picker-group-header'),
      panelBody.indexOf('slash-picker-group-header') + 60
    );
    assert.strictEqual(headerSeg.includes('data-index'), false, '分组标题不得带 data-index（不占索引）');
    assert.strictEqual(panelBody.includes('cursor: pointer'), false, '分组标题不得声明 cursor:pointer');
  });

  test('全部磁盘来源插值经 escapeHtml（name / description / statusText / row title / 徽标 label·title）', () => {
    for (const wrapped of [
      'escapeHtml(item.name)',
      "escapeHtml(item.description || '')",
      'escapeHtml(item.statusText)',
      "escapeHtml('/skill:' + item.name + ' 可显式调用')",
      'escapeHtml(badge.title)',
      'escapeHtml(badge.label)',
    ]) {
      assert.ok(panelBody.includes(wrapped), `插值必须经转义：${wrapped}`);
    }
    // 行模板内：剥掉全部 escapeHtml(...) 调用后，不得再有未经转义的磁盘来源插值
    const tplStripped = rowTemplate.replace(/escapeHtml\([^)]*\)/g, 'ESC');
    for (const key of ['item.name', 'item.description', 'item.statusText', 'badge.title', 'badge.label']) {
      assert.strictEqual(tplStripped.includes(key), false, `行模板内存在未经 escapeHtml 的插值：${key}`);
    }
  });

  test('tier → class 走白名单查表，不把 tier 值拼进 class（T-48-07）', () => {
    assert.ok(panelBody.includes('TIER_BADGE[item.tier]'), '徽标必须查 TIER_BADGE');
    assert.strictEqual(
      /source-badge[\s\S]{0,40}?\$\{item\.tier\}/.test(panelBody),
      false,
      '不得把 tier 值直接拼进 class 字符串'
    );
    for (const label of ["'用户'", "'内置'", "'托管'"]) {
      assert.strictEqual(
        panelBody.includes(label),
        false,
        `徽标文案不得在渲染层硬编码（${label}）—— 一律取 TIER_BADGE[tier].label`
      );
      assert.strictEqual(
        modelSrc.split(label).length - 1,
        1,
        `${label} 在 skill-picker-model.js 中必须恰出现一次（TIER_BADGE 定义处）`
      );
    }
  });

  test('「仅显式」标记只由 disableModelInvocation 决定，且文案不在数据层', () => {
    // 断言范围限定在徽标/标记渲染上下文（renderSlashPickerList 函数体）——
    // 不得对 renderer.js 全文件做计数断言：该文件其它位置有既有提及。
    assert.strictEqual(
      (panelBody.split('仅显式').length - 1),
      1,
      '「仅显式」在面板渲染函数体内恰出现一次（条件标记，权威在渲染侧）'
    );
    assert.strictEqual(
      (panelBody.split('该技能不进模型提示词，只能手动调用（/skill:名字）').length - 1),
      1,
      '其 title 文案在面板渲染函数体内恰出现一次'
    );
    const tagIdx = panelBody.indexOf('slash-picker-tag-explicit');
    const window = panelBody.slice(Math.max(0, tagIdx - 200), tagIdx + 200);
    assert.ok(window.includes('disableModelInvocation'), '标记必须受该 flag 条件约束，不得无条件拼接');
    assert.strictEqual(modelSrc.includes('仅显式'), false, '该文案不与行尾状态标注混放');
  });

  test('空态为单行提示条（沿用行骨架，不引入 heading/body 两段）', () => {
    assert.ok(panelBody.includes('无匹配技能或命令，输入 / 查看全部'), '空态文案原文');
    assert.ok(panelBody.includes('slash-picker-row-empty'), '空态沿用 .slash-picker-row 形态');
  });

  test('sticky 前提与面板高度零改动（UI-SPEC 硬约束）', () => {
    const panel = rule(cssSrc, '.slash-picker-panel {');
    assert.ok(/max-height:\s*220px/.test(panel), 'max-height 必须保持 220px');
    assert.ok(/overflow-y:\s*auto/.test(panel), '面板必须仍是唯一滚动容器');
    assert.strictEqual(
      /^\.slash-picker-list\s*\{/m.test(cssSrc),
      false,
      '.slash-picker-list 不得声明任何规则（尤其不得有 overflow，会静默打断 sticky）'
    );
    assert.strictEqual(
      /overflow\s*:\s*(hidden|auto)/.test(rule(cssSrc, '.slash-picker-group-header {')),
      false,
      '分组标题自身不得带 overflow'
    );
    assert.ok(
      /slash-picker-panel[\s\S]{0,200}slash-picker-list/.test(htmlSrc),
      '#slashPickerList 必须直接位于 .slash-picker-panel 内（无中间包裹元素）'
    );
  });

  test('样式契约：标题 sticky + 显式背景；行换行；名称/描述/标注的压缩规则；灰显不参与高亮', () => {
    const header = rule(cssSrc, '.slash-picker-group-header {');
    assert.ok(/position:\s*sticky/.test(header), '标题必须 sticky');
    assert.ok(/top:\s*0/.test(header), '标题 sticky 落点 top: 0');
    assert.ok(/background:\s*var\(--bg-secondary\)/.test(header), '标题必须显式声明背景');

    assert.ok(/flex-wrap:\s*wrap/.test(rule(cssSrc, '.slash-picker-row {')), '行必须可换行');
    assert.ok(/flex-shrink:\s*0/.test(rule(cssSrc, '.slash-picker-name {')), '名称不压缩（nowrap 配套）');
    const desc = rule(cssSrc, '.slash-picker-desc {');
    assert.ok(/flex:\s*1/.test(desc) && /min-width:\s*0/.test(desc), '描述承担全部压缩');
    const status = rule(cssSrc, '.slash-picker-status {');
    assert.ok(/margin-left:\s*auto/.test(status), '标注右对齐（换第二行时）');
    assert.ok(/white-space:\s*nowrap/.test(status), '标注永不截断');
    assert.ok(/flex-shrink:\s*0/.test(status), '标注不压缩');

    assert.ok(/opacity:\s*0\.6/.test(rule(cssSrc, '.slash-picker-row-disabled {')), '灰显行 opacity 0.6');
    const hover = rule(cssSrc, '.slash-picker-row:not(.slash-picker-row-disabled):hover {');
    assert.ok(hover.includes('background'), '高亮必须限定在可选中行上');
    assert.ok(
      cssSrc.includes('.slash-picker-row:not(.slash-picker-row-disabled).active'),
      '.active 高亮必须同样限定在可选中行上'
    );
    for (const tone of ['.slash-picker-status-limit', '.slash-picker-status-muted']) {
      assert.ok(rule(cssSrc, tone + ' {').includes('color:'), `${tone} 必须有文字色`);
    }
    assert.ok(
      rule(cssSrc, '.slash-picker-status-limit {').includes('var(--skill-limit-text)'),
      '超限标注取 --skill-limit-text'
    );
    assert.ok(
      rule(cssSrc, '.slash-picker-status-muted {').includes('var(--text-muted)'),
      '遮蔽/同名标注取 --text-muted'
    );
  });

  test('缓存失效：index.html 的 styles/main.css?v= 序号已推进', () => {
    const m = htmlSrc.match(/styles\/main\.css\?v=(\d+)/);
    assert.ok(m, 'index.html 应带 ?v= 缓存失效序号');
    assert.ok(Number(m[1]) >= 7, '本计划的 CSS 改动必须推进序号（≥ 7）');
  });

  test('三档徽标修饰类与令牌：白名单 class 名与 TIER_BADGE 一致，令牌集合随阶段单调增长', () => {
    for (const tier of ['user', 'builtin', 'managed']) {
      const cls = model.TIER_BADGE[tier].className;
      assert.ok(cssSrc.includes('.' + cls), `CSS 缺少白名单 class .${cls}`);
      const def = rule(cssSrc, '.' + cls + ' {');
      assert.ok(def.includes(`var(--skill-source-${tier})`), `.${cls} 必须消费 --skill-source-${tier}`);
      assert.ok(/color-mix\(in srgb/.test(def), `.${cls} 必须用 color-mix 低饱和底`);
    }
    // 令牌集合必须**恰为**截至本阶段的已知集合：48-01 的四个 + 49-02 的 --skill-error-text
    // + 50-01 的 --skill-success-text。
    // 新增令牌时只允许在此处**追加**（并同时写入两个主题块）—— 不得悄悄引入未登记的令牌。
    const declared = [...cssSrc.matchAll(/^\s*(--skill-[a-z-]+):/gm)].map((m) => m[1]);
    assert.deepStrictEqual(
      [...new Set(declared)].sort(),
      [
        '--skill-error-text',
        '--skill-limit-text',
        '--skill-source-builtin',
        '--skill-source-managed',
        '--skill-source-user',
        '--skill-success-text',
      ],
      '令牌集合必须恰为「48-01 已落的四个 + 49-02 的 --skill-error-text + 50-01 的 --skill-success-text」'
    );
  });
});

describe('C 组 · mergeManageSkillMarker（Phase 49 / CR-01 的单一并入实现）', () => {
  const merge = model.mergeManageSkillMarker;
  const pickerSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'skill-picker-model.js'), 'utf8');

  test('导出面：mergeManageSkillMarker 是挂在同一 api 对象上的函数（纯 Node 可 require ⇒ 零 DOM / 零 electron）', () => {
    assert.strictEqual(
      typeof merge,
      'function',
      '必须导出 mergeManageSkillMarker（渲染端经 window.SkillPickerModel 取到的是同一个函数引用）'
    );
    assert.ok(
      pickerSrc.includes('mergeManageSkillMarker,'),
      'api 对象里必须列出 mergeManageSkillMarker（双模式导出的同一对象）'
    );
  });

  test('incoming 为空 → 原样返回 prev 本体（同一引用）：不带标记字段的后续 update 事件不得抹掉已写入的标记', () => {
    const prev = { action: 'create', name: 'alpha' };
    assert.strictEqual(merge(prev, null), prev, 'incoming = null 必须原样返回 prev（同一引用）');
    assert.strictEqual(merge(prev, undefined), prev, 'incoming = undefined 必须原样返回 prev（同一引用）');
    assert.strictEqual(
      merge(prev, null),
      merge(prev, undefined),
      '两次调用返回的必须是**同一个对象**（不是两份等价拷贝）'
    );
    assert.strictEqual(merge(undefined, null), undefined, 'prev 也为空 ⇒ 原样返回（undefined）');
    assert.strictEqual(merge(null, null), null, 'prev 为 null ⇒ 原样返回 null');
  });

  test('prev 为空、incoming 非空 → 返回新对象且取值等于 incoming（不返回同一引用）', () => {
    const incoming = { tier: 'managed', promptIncluded: false };
    const out = merge(undefined, incoming);
    assert.notStrictEqual(out, incoming, '必须返回新对象（不把事件载荷本身交给调用方）');
    assert.deepStrictEqual(out, incoming, '取值必须逐字等于 incoming');
    assert.strictEqual(merge(null, incoming).constructor, Object);
  });

  test('两者都非空 → 同名键 incoming 胜出、异名键两边都保留（契约示例逐字）', () => {
    assert.deepStrictEqual(
      merge({ action: 'create', name: 'alpha' }, { tier: 'managed', promptIncluded: false }),
      { action: 'create', name: 'alpha', tier: 'managed', promptIncluded: false },
      '成功行的两时点并入：start 的 action / name 保留，end 的终态三键叠加'
    );
    assert.deepStrictEqual(
      merge({ action: 'create', name: 'alpha' }, { code: 'seeded_protected', tier: 'builtin' }),
      { action: 'create', name: 'alpha', code: 'seeded_protected', tier: 'builtin' },
      '失败行的两时点并入：短原因 code 与可判定的 tier 一并叠加'
    );
    assert.deepStrictEqual(
      merge({ action: 'update', name: 'a', tier: 'managed' }, { tier: 'user' }),
      { action: 'update', name: 'a', tier: 'user' },
      '同名键必须由 incoming 覆盖'
    );
  });

  test('不修改任何入参，每次返回新对象', () => {
    const prev = { action: 'create', name: 'alpha' };
    const incoming = { tier: 'managed', promptIncluded: false };
    const prevBefore = JSON.stringify(prev);
    const incomingBefore = JSON.stringify(incoming);
    const out = merge(prev, incoming);
    assert.strictEqual(JSON.stringify(prev), prevBefore, '入参 prev 必须逐字未被修改');
    assert.strictEqual(JSON.stringify(incoming), incomingBefore, '入参 incoming 必须逐字未被修改');
    assert.notStrictEqual(out, prev);
    assert.notStrictEqual(out, incoming);
    out.tier = 'tampered';
    assert.strictEqual(
      incoming.tier,
      'managed',
      '返回的新对象与入参不共享可写状态（改返回值不得串到事件载荷）'
    );
  });

  test('CR-01 反例（本 phase 的靶心）：并入后 action 与 name 仍在 ⇒ 卡片技能变体在终态仍成立', () => {
    // 覆盖写法（`{ manageSkill: event.manage_skill }`）在此输入下会产出
    // `{tier:'managed', promptIncluded:false}` —— 于是 `MANAGE_SKILL_ACTION_LABEL[undefined]`
    // 为 undefined、`manageSkillOk` 恒 false，整张卡片退回工具名标题 + 整份 content 的 JSON 墙。
    // 本行把「并入」这一语义钉死：改回覆盖语义必然转红（Task 3 的反向验证路径 B）。
    const startMarker = { action: 'create', name: 'alpha' };
    const endTerminal = { tier: 'managed', promptIncluded: false };
    const merged = merge(startMarker, endTerminal);
    assert.strictEqual(merged.action, 'create', 'CR-01 反例：action 不得被终态载荷抹掉');
    assert.strictEqual(merged.name, 'alpha', 'CR-01 反例：name 不得被终态载荷抹掉');
    assert.strictEqual(
      model.MANAGE_SKILL_ACTION_LABEL[merged.action],
      '创建技能「{name}」',
      '标题模板必须仍可查得（manageSkillOk 成立的前提）'
    );
    assert.deepStrictEqual(
      Object.keys(merged).sort(),
      ['action', 'name', 'promptIncluded', 'tier'],
      '键集合必须是 start 两键 + 终态三键（不多不少）'
    );
  });
});

