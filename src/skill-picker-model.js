/**
 * Realm Browser - `/` 面板与 `/skill:` 语法的纯逻辑模型（双模式导出）
 *
 * **为什么抽出独立模块**：本阶段最容易出**静默错**的三处规则是「args 的 token 取值」
 * （`48-RESEARCH.md` 事实 2：现状缺陷式在 `/skill:` 形态下吞掉 args 开头）、
 * 「显式语法 / 裸名的严格边界」（D-04）与「本地命令优先」。它们必须表驱动覆盖；
 * 留在 `src/renderer.js` 里（浏览器脚本、无 `module.exports`）只能靠 Playwright
 * 或人工验证。抽到这里后 `node --test tests/test-skill-picker-model.js` 秒级可跑。
 *
 * **双模式导出**：`<script src="skill-picker-model.js">` 暴露 `window.SkillPickerModel`；
 * 纯 Node 测试 `require('src/skill-picker-model.js')` 取**同一个 api 对象引用** ——
 * 规则只此一份，不存在「renderer 一份、main 一份」的漂移面。
 *
 * **依赖纪律**：本文件**零 import / 零 require**（不依赖 electron / SDK / DOM），
 * 因此两个宿主都无需任何桩即可加载。
 *
 * 语法文法（D-04 / D-19，与 main 侧 `ai-manager.parseSkillInvocationText` 同源）：
 *   `/skill:<name>[ <args>]`  —— name = `skill:` 之后、首个空白之前，必须匹配 ^[a-z0-9-]+$
 *   `/<name>[ <args>]`        —— name = 首个空白之前的完整 token（严格前缀 + 空白边界）
 *   本地命令（`clear` / `compact`）优先于同名技能
 */
(function () {
  'use strict';

  /** 显式技能调用的语法前缀（`/skill:name`） */
  const SKILL_PREFIX = 'skill:';

  /** 合法技能名字符集（与 SDK validateName 的字符集一致；46 D-08 的目录名权威同款） */
  const SKILL_NAME_RE = /^[a-z0-9-]+$/;

  /**
   * 取输入框文本 token 之后的剩余文本（args）—— **token 取值法**（事实 2）
   *
   * 取「斜杠后、首个空白前的完整 token」，其后的全部文本（trim 后）即 args。
   * **不得**改用「按已知名字长度切一刀、再正则剥掉首个非空白段」的旧式写法 ——
   * 那式假设「输入 token 长度 == 已知名字长度」，在 `/skill:` 形态下会把 args 的开头
   * 当作 token 的剩余部分吞掉（`/skill:find 帮我找 X` → `X`）。
   *
   * @param {string} inputValue - 输入框原文（可含前导 `/`）
   * @returns {string} args 原文（trim 后）；非 `/` 开头返回空串
   */
  function extractArgs(inputValue) {
    if (typeof inputValue !== 'string' || !inputValue.startsWith('/')) return '';
    return splitToken(inputValue).args;
  }

  /**
   * 拆分「token + args」—— `parseSkillRef` / `extractArgs` 的唯一共享实现
   *
   * @param {string} text - 以 `/` 开头的文本
   * @returns {{token: string, args: string}} token 为首个空白前的完整文本（不含前导 `/`）
   */
  function splitToken(text) {
    const token = text.slice(1).split(/\s/)[0];
    return { token, args: text.slice(1 + token.length).trim() };
  }

  /**
   * 本地命令的严格前缀 + 空白边界判定（D-04；沿用 `src/renderer.js:8674` 既有语义）
   *
   * @param {string} text - 以 `/` 开头的文本
   * @param {string} name - 本地命令名
   * @returns {boolean} 是否严格命中
   */
  function matchesCommand(text, name) {
    return text === '/' + name || text.startsWith('/' + name + ' ');
  }

  /**
   * 解析一次斜杠输入：本地命令 / `/skill:` 显式语法 / 裸名（D-04 / D-19）
   *
   * 判定顺序不可调换：
   *   ① 本地命令优先 —— 严格前缀 + 空白边界命中即返回 `{kind:'command'}`（同名技能让位）
   *   ② `/skill:` 显式语法 —— 名字须过 `^[a-z0-9-]+$`，不过则返回 `null`
   *   ③ 裸名 —— token 整体即技能名（`split(/\s/)[0]` 天然满足严格边界）
   *
   * **③ 的歧义护栏**：token 以某个本地命令名**开头**但不构成严格边界命中时
   * （如 `/foobar` 对 `foo`、`/clearx` 对 `clear`），用户意图在「命令 + 参数」与
   * 「另一个技能名」之间不可判定 → 返回 `null`，由调用方走「未知命令」提示路径
   * （不静默误判为命令，也不让它冒充同名技能）。
   *
   * @param {string} text - 输入框原文
   * @param {string[]} [commandNames] - 本地命令名集合（`SLASH_COMMANDS.map(c => c.name)`）
   * @returns {{kind: 'command', name: string, args: string}
   *          | {kind: 'skill', name: string, args: string, syntax: 'skill-colon'|'bare'}
   *          | null}
   */
  function parseSkillRef(text, commandNames) {
    if (typeof text !== 'string' || !text.startsWith('/')) return null;
    const { token, args } = splitToken(text);
    if (!token) return null;
    const names = Array.isArray(commandNames) ? commandNames : [];

    // ① 本地命令优先（D-04）
    for (const name of names) {
      if (typeof name === 'string' && name && matchesCommand(text, name)) {
        return { kind: 'command', name, args };
      }
    }

    // ② 显式语法 `/skill:<name>`
    if (token.startsWith(SKILL_PREFIX)) {
      const name = token.slice(SKILL_PREFIX.length);
      if (!SKILL_NAME_RE.test(name)) return null;
      return { kind: 'skill', name, args, syntax: 'skill-colon' };
    }

    // ③ 裸名：token 以某本地命令名开头但不成立严格边界 → 歧义，交未知命令路径
    for (const name of names) {
      if (typeof name === 'string' && name && token.startsWith(name)) return null;
    }
    return { kind: 'skill', name: token, args, syntax: 'bare' };
  }

  /**
   * 解析显式技能调用（**main 侧权威解析**的同源实现，D-19）
   *
   * main 不掌握本地命令注册表（本地命令优先由 renderer 侧截走），故按空命令集调用
   * 同一份实现 —— 两个宿主因此共用「token 取值 + 严格边界」的唯一定义。
   *
   * @param {string} text - 完整语法文本（renderer 发往主进程的原始消息）
   * @returns {{name: string, args: string, syntax: 'skill-colon'|'bare'} | null}
   */
  function parseSkillInvocationText(text) {
    const ref = parseSkillRef(text, []);
    if (!ref || ref.kind !== 'skill') return null;
    return { name: ref.name, args: ref.args, syntax: ref.syntax };
  }

  const api = {
    SKILL_PREFIX,
    SKILL_NAME_RE,
    extractArgs,
    parseSkillRef,
    parseSkillInvocationText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
})();
