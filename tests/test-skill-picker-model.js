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

  test('技能预检分支：拒绝条件只有 disabled === true（不含禁用调用旗标）', () => {
    const body = asyncFunctionBody(rendererSrc, 'handleSendAIMessage');
    const guardIdx = body.indexOf('kind === \'skill\'');
    assert.ok(guardIdx >= 0, '预检必须按 kind 判别分流');
    // 只看代码行（注释里可以说明「不因 disableModelInvocation 拒绝」，那不是判定条件）
    const segment = body
      .slice(guardIdx, guardIdx + 1400)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    assert.ok(segment.includes('disabled === true'), '必须按 disabled 拒绝（D-10）');
    assert.strictEqual(
      segment.includes('disableModelInvocation'),
      false,
      'disableModelInvocation 不参与拒绝条件（DISC-07 clause ③：仅显式技能仍可手打调用）'
    );
    assert.strictEqual(
      segment.includes('已遮蔽'),
      false,
      'shadowed 在按 name 查找时不可达（46 D-08 name 唯一性），不得为它加错误分支'
    );
    assert.ok(segment.includes('未找到技能「'), '未找到 → 未找到文案');
    assert.ok(segment.includes('已被禁用，可在 设置 → AI → 技能管理 重新启用'), '禁用 → 禁用文案');
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

    // 两处渲染都由 renderAIMessages 的 isUser 分支挂载（ pill 在正文前、折叠块在附件后）
    const renderBody = functionBody(rendererSrc, 'renderAIMessages');
    const userIdx = renderBody.indexOf('if (isUser) {');
    const segment = renderBody.slice(userIdx, renderBody.indexOf('} else if (content)', userIdx));
    const pillCall = segment.indexOf('renderAISkillPill(');
    const textCall = segment.indexOf('textDiv.textContent');
    const boxCall = segment.indexOf('renderSkillContentBox(');
    assert.ok(pillCall >= 0 && boxCall >= 0, 'isUser 分支必须挂载 pill 与折叠块');
    assert.ok(pillCall < textCall, 'pill 必须在正文之前');
    assert.ok(boxCall > textCall, '折叠块必须在正文/附件之后');
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

  test('skills:changed 监听：只重拉快照、面板关闭时早退、绝不触发刷新（P-48-06）', () => {
    const idx = rendererSrc.indexOf("onIpcMessage('skills:changed'");
    assert.ok(idx >= 0, '必须新增 skills:changed 监听');
    const segment = rendererSrc.slice(idx, idx + 300);
    assert.ok(segment.includes('if (!state.slashPickerOpen)'), '面板关闭时必须早退');
    assert.strictEqual(segment.includes('refreshSkills'), false, '绝不自激（广播 → 刷新 → 再广播）');
    assert.ok(segment.includes('pullAiSkillsSnapshot('), '监听只重拉快照');

    const pull = asyncFunctionBody(rendererSrc, 'pullAiSkillsSnapshot');
    assert.ok(pull.includes('realmAPI.ai.getSkills()'), '重拉实现必须是零 IO 的 getSkills');
    assert.ok(pull.includes('aiSkillsDigest'), 'digest 相同必须原地返回（不重渲染、不丢 activeIndex）');
    assert.strictEqual(
      rendererSrc.includes('.refreshSkills('),
      false,
      'renderer 绝不触发主进程重扫（自激回路）'
    );
  });

  test('启动预热：skills:changed 挂载点同处 fire-and-forget 拉一次快照', () => {
    const idx = rendererSrc.indexOf("onIpcMessage('skills:changed'");
    const segment = rendererSrc.slice(idx, idx + 300);
    assert.ok(
      (segment.match(/pullAiSkillsSnapshot\(\)/g) || []).length >= 2,
      '挂载点同处必须有一次预热调用（否则从未开过面板的用户手打 /skill: 会被误判为未找到）'
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
});

