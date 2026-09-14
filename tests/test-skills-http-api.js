/**
 * `/api/skills/*` 写入端点与 `/api/settings/update` 双键校验的测试套件（node:test，**纯 Node 环境**）
 *
 * ## 为什么独立成文件（不并进 tests/test-skills-management.js）
 *
 * SEC-09 的 413 组与 token 403 组是 **HTTP / 传输层**关注点，与管理**数据面**
 * （投影 / 三态判据 / 谓词值域）职责不同；且独立文件才有独立的 `# tests` 计数可入账本。
 *
 * ## 本套件对 HTTP 面的验证分两层
 *
 * ① **源码扫描**（`main.js`）—— `handleSkillsApi` 的两个写子路由、token 首行鉴权、
 *    `{ error, code }` 错误形状、两处「**转发到同一 manager 方法**」的调用；
 *    `/api/settings/update` 的双键校验分支，以及「**拒绝时在 `configStore.set` 之前
 *    return**」的语句顺序（「校验失败但仍落盘」的机械判据）。
 * ② **对可 require 的纯逻辑做行为断言** —— `validateDisabledListForSettings` 的全部
 *    拒绝面（两种键形态共用同一份判据，取值路径分别模拟）。
 *
 * ⚠️ 为什么 ① 只能停在源码层：`handleSkillsApi` 与 `handleSettingsApi` 都住在 `main.js`
 * 的 `realmServer` 闭包内、**不可 require**。行为级端点测试需要真实起 server 的探针，
 * 那属 SEC-09 组（Phase 50-03 续写）——本套件**不复制** `main.js` 的 `realmServer`。
 *
 * 全部断言**逐条喂真实数据形状**（计划明文要求）：不用「手工构造一个实现从不构造的对象」
 * 式断言。
 *
 * 用法: node tests/test-skills-http-api.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const aiSkills = require('../ai-skills-manager');

/** 仓库根目录（源码扫描型断言用） */
const REPO_ROOT = path.join(__dirname, '..');

/** 读取仓库根源码 */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/**
 * 取 `main.js` 里「校验循环 → settings:updated 广播」之间的窗口（双键判据的判读窗口）
 *
 * 与计划自带门禁同款口径：**只在这段窗口内**判键形态是否存在，
 * 避免与文件别处（如下发分支 / 注释）的同名字面量混淆。
 */
function settingsUpdateLoopWindow(src) {
  const start = src.indexOf('for (const [key, value] of Object.entries(updates)) {');
  assert.ok(start >= 0, 'main.js 必须含 /api/settings/update 的校验循环（口径失效）');
  const end = src.indexOf("broadcast('settings:updated'", start);
  assert.ok(end > start, 'main.js 的校验循环必须仍然位于 settings:updated 广播之前（口径失效）');
  return src.slice(start, end);
}

// ==================== ① 源码扫描：写路由与双键校验 ====================

describe('写路由（源码扫描）：handleSkillsApi 的两个 POST 子路由与转发目标', () => {
  test('两个子路由同时存在，且都插在 list 分支之后、404 兜底之前', () => {
    const src = readSource('main.js');
    const start = src.indexOf('async function handleSkillsApi(');
    assert.ok(start >= 0, 'main.js 必须定义 handleSkillsApi');
    const body = src.slice(start, src.indexOf('\n  }\n', start));

    for (const route of ['list', 'set-disabled', 'uninstall']) {
      assert.ok(
        new RegExp(`route === '${route}'`).test(body),
        `handleSkillsApi 必须含 ${route} 子路由`
      );
    }
    // 顺序即判定顺序：写子路由必须在 404 兜底之前（否则永远不可达）
    const idx404 = body.indexOf("sendJson(res, 404, { error: 'Not Found' })");
    assert.ok(idx404 > 0, '缺 404 兜底');
    assert.ok(body.indexOf("route === 'set-disabled'") < idx404, 'set-disabled 必须在 404 兜底之前');
    assert.ok(body.indexOf("route === 'uninstall'") < idx404, 'uninstall 必须在 404 兜底之前');
  });

  test('两处转发调用逐字存在（handler 只是转发层，判据全在 manager）', () => {
    const src = readSource('main.js');
    assert.ok(
      src.includes('await aiManager.setSkillDisabled(name, disabled)'),
      'set-disabled 必须转发到 aiManager.setSkillDisabled（不得在 handler 里另写一份判定）'
    );
    assert.ok(
      src.includes('await aiManager.uninstallUserSkill(name)'),
      'uninstall 必须转发到 aiManager.uninstallUserSkill（判据在 manager 的 deleteUserSkill）'
    );
  });

  test('token 首行鉴权 + 错误形状 { error, code }（设置页按 code 查表，不解析 message）', () => {
    const src = readSource('main.js');
    const start = src.indexOf('async function handleSkillsApi(');
    const head = src.slice(start, start + 700);
    assert.ok(
      /searchParams\.get\('token'\)\s*!==\s*REALM_TOKEN/.test(head),
      'handleSkillsApi 首段必须做 token 鉴权（无 token / 错 token ⇒ 任何副作用之前 403）'
    );
    assert.ok(
      /sendJson\(res, 400, \{ error: err\.message, code: err\.code \|\| undefined \}\)/.test(src),
      '技能域 HTTP 400 必须回传 { error, code } 形状（UI 按 code 查表）'
    );
  });
});

describe('双键校验（源码扫描）：/api/settings/update 同时覆盖 aiSkills.disabled 与 aiSkills', () => {
  test('校验循环内两种键形态都存在（书写形式无关：独立 if / || 表达式均可）', () => {
    const win = settingsUpdateLoopWindow(readSource('main.js'));
    assert.ok(
      /key\s*===\s*['"]aiSkills\.disabled['"]/.test(win),
      '校验循环未覆盖 aiSkills.disabled 键形态'
    );
    assert.ok(
      /key\s*===\s*['"]aiSkills['"]/.test(win),
      '校验循环未覆盖 aiSkills 键形态（只覆盖点号键会让 { aiSkills: {…} } 整体覆写绕过校验）'
    );
  });

  test('两种形态共用同一份判据（单源，main.js 零第二份正则）', () => {
    const src = readSource('main.js');
    assert.ok(
      /aiSkillsManager\.validateDisabledListForSettings\(/.test(src),
      'main.js 必须复用 manager 的名单校验器（第二份实现必然漂移）'
    );
    // 负向：main.js 不得出现第二个技能名形态校验实现
    assert.strictEqual(
      /\^\[a-z0-9-\]\+\$/.test(src),
      false,
      'main.js 不得内联技能名字符集正则（那是 ai-skills-manager 的单源职责）'
    );
  });

  test('拒绝路径**在 configStore.set 之前 return**（「校验失败但仍落盘」的机械判据）', () => {
    const win = settingsUpdateLoopWindow(readSource('main.js'));
    const branch = win.indexOf("key === 'aiSkills.disabled' || key === 'aiSkills'");
    assert.ok(branch > 0, '缺双键校验分支（口径失效）');
    const branchBody = win.slice(branch);

    const reject = branchBody.indexOf('sendJson(res, 400, { error: check.reason })');
    const guard = branchBody.indexOf('if (!check.valid)');
    const write = branchBody.indexOf("configStore.set('settings.aiSkills.disabled', list)");

    assert.ok(guard > 0, '缺 valid === false 的守卫');
    assert.ok(reject > guard, '守卫体内必须先 sendJson(400)');
    assert.ok(write > reject, '拒绝分支必须 **在 configStore.set 之前 return**（否则校验失败仍落盘）');
    assert.ok(
      /return;/.test(branchBody.slice(reject, write)),
      'sendJson(400) 之后必须紧跟 return（否则会继续执行到 set）'
    );
    // 反向：该分支**不得**落到循环尾的整体覆写（会静默冲掉 settings.aiSkills 上的其它字段）
    assert.ok(
      /configStore\.set\('settings\.aiSkills\.disabled', list\);\s*\n\s*continue;/.test(branchBody),
      'aiSkills 形态必须显式落子键后 continue，不得整体覆写 settings.aiSkills'
    );
  });
});

// ==================== ② 行为断言：两种键形态共用同一份判据 ====================

describe('validateDisabledListForSettings：两种键形态的取值路径与拒绝面（真实数据形状）', () => {
  /*
   * 两条键形态在 `main.js` 里的取值路径（源码见上面那条 `const list =` 三元表达式）：
   * - `key === 'aiSkills.disabled'` ⇒ `list = value`（值本体就是名单）
   * - `key === 'aiSkills'`          ⇒ `list = value.disabled`（值是子对象，取 disabled 子键）
   * 本组把两条路径**分别模拟**一遍喂给同一个校验器，证明「共用一份判据」在行为上也成立。
   */

  /** 模拟 main.js 的取值路径（与源码同形：`key === 'aiSkills' ? value.disabled : value`） */
  function listOf(key, value) {
    return key === 'aiSkills' ? (value ? value.disabled : undefined) : value;
  }

  test('aiSkills.disabled 形态：合法数组通过', () => {
    for (const payload of [
      [],
      ['alpha-skill'],
      ['My_Skill', 'plain name'],
      Array(100).fill('a'),
    ]) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills.disabled', payload));
      assert.strictEqual(check.valid, true, `${JSON.stringify(payload).slice(0, 50)} 必须通过`);
    }
  });

  test('aiSkills.disabled 形态：拒绝面逐条（非数组 / 非字符串项 / 超长 / 路径样串 / 超条数）', () => {
    const rejects = [
      'not-an-array',
      {},
      null,
      42,
      ['ok-name', 42],
      ['ok-name', ''],
      ['a'.repeat(65)],
      ['../escape'],
      ['a/b'],
      ['a\\b'],
      Array(101).fill('a'),
    ];
    for (const payload of rejects) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills.disabled', payload));
      assert.strictEqual(check.valid, false, `${JSON.stringify(payload).slice(0, 50)} 必须被拒`);
      assert.ok(check.reason && check.reason.length > 0, '拒绝必须带可读原因（UI 直接展示）');
    }
  });

  test('aiSkills 形态（子对象取值路径）：合法与拒绝面与点号键形态**逐条同宽**', () => {
    // 合法：子对象里带合法 disabled
    for (const payload of [{ disabled: [] }, { disabled: ['alpha-skill'] }, { disabled: Array(100).fill('a') }]) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills', payload));
      assert.strictEqual(check.valid, true, `${JSON.stringify(payload).slice(0, 50)} 必须通过`);
    }
    // 拒绝：与点号键形态同一批形状（含「无 disabled 子键」这一形态 —— 实现里写死为拒绝）
    const rejects = [
      {},
      { other: 1 },
      { disabled: 'not-an-array' },
      { disabled: ['ok-name', 42] },
      { disabled: ['ok-name', ''] },
      { disabled: ['a'.repeat(65)] },
      { disabled: ['../escape'] },
      { disabled: Array(101).fill('a') },
    ];
    for (const payload of rejects) {
      const check = aiSkills.validateDisabledListForSettings(listOf('aiSkills', payload));
      assert.strictEqual(check.valid, false, `${JSON.stringify(payload).slice(0, 60)} 必须被拒`);
    }
    // 「无 disabled 子键」必须被拒（不得落到默认的整体覆写路径上）—— 与源码注释写死的口径一致
    assert.strictEqual(listOf('aiSkills', {}), undefined, '取值路径口径：无子键 ⇒ undefined');
    assert.strictEqual(
      aiSkills.validateDisabledListForSettings(undefined).valid,
      false,
      'undefined 必须被拒（`aiSkills` 形态缺 disabled 子键时 fail-closed）'
    );
  });

  test('条数上限是既有两项常量之和（100），不是第六项新额度', () => {
    assert.strictEqual(aiSkills.MAX_DISABLED_SKILLS, 100);
    assert.strictEqual(
      aiSkills.MAX_DISABLED_SKILLS,
      aiSkills.LIMITS.MAX_USER_SKILLS + aiSkills.LIMITS.MAX_MANAGED_SKILLS,
      '条数上限必须由既有 LIMITS 派生（不得改既有五项数值）'
    );
    assert.strictEqual(aiSkills.validateDisabledListForSettings(Array(100).fill('a')).valid, true);
    assert.strictEqual(aiSkills.validateDisabledListForSettings(Array(101).fill('a')).valid, false);
  });
});
