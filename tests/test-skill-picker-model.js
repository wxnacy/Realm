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

const model = require('../src/skill-picker-model');
const aiManager = require('../ai-manager');

/** 本地命令名集合（与 `src/renderer.js` 的 `SLASH_COMMANDS` 同形，测试内自建） */
const COMMAND_NAMES = ['clear', 'compact'];

describe('A 组 · extractArgs —— token 取值法（事实 2 七组表逐行）', () => {
  /**
   * 七组表逐行照抄 `48-RESEARCH.md`「事实 2」的实测表。
   *
   * 现状缺陷式（`value.slice(1 + cmd.name.length).replace(/^\S*/, '').trim()`）在
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
