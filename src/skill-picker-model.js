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

  /**
   * 由 `{name, args}` 反向组装完整语法文本（`/skill:{name}[ {args}]`）
   *
   * **`parseSkillRef` / `extractArgs` 的反向唯一实现** —— 语法文本与 `{name, args}` 是一对
   * 互逆映射，两个方向各自只在本文件定义一次。**不得**在 renderer 手拼 `'/' + name + …`
   * （会成为第二份实现，与正向解析必然漂移）。
   *
   * 用途：重发路径（重新生成 / 错误重试）把**显示值**（气泡正文 = args）还原为权威载荷；
   * args 为空时结果恰为 `/skill:{name}`（非空，绝不产生空载荷）。
   *
   * @param {string} name - 技能名
   * @param {string} args - args 原文（可为空串 / 含空行）
   * @returns {string} `/skill:{name}` 或 `/skill:{name} {args}`
   */
  function buildSkillSyntaxText(name, args) {
    const base = '/' + SKILL_PREFIX + name;
    const trimmed = typeof args === 'string' ? args.trim() : '';
    return trimmed ? base + ' ' + trimmed : base;
  }

  // ==================== `/` 面板模型（48-02 D-01 / D-03 / D-10 / D-11 / D-12） ====================

  /**
   * 可选中行的扁平索引集合（UI-SPEC 由 D-11 推导）
   *
   * ↑↓ 导航与 Enter 命中判据**只**认这个集合 —— 不可选中行（被遮蔽 / 与本地命令同名）
   * 不得成为 `slashPickerActiveIndex` 的落点（否则 Enter 变死键）。
   *
   * @param {Array<{selectable?: boolean}>} items - 展平单数组（`state.slashPickerItems`）
   * @returns {number[]} 可选中行的扁平索引（升序）
   */
  function buildSelectableIndexes(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((it, i) => (it && it.selectable === true ? i : -1)).filter(i => i >= 0);
  }

  /**
   * 在可选中索引集合上取模（↑↓ 一步）
   *
   * - 集合为空（全部不可选中）→ `-1`，调用方据此回落既有 false 路径（UI-SPEC）
   * - `current` 不在集合内（越界收缩 / 初始 `-1`）→ 按方向取**最近**的可选中行：
   *   `delta > 0` 取首个大于 `current` 的索引，`delta < 0` 取末个小于 `current` 的索引；
   *   该方向上没有则回绕到集合另一端
   * - `current` 在集合内 → `(pos + delta + len) % len`（首尾回绕、长度 1 自指）
   *
   * @param {number[]} selectable - `buildSelectableIndexes` 的结果
   * @param {number} current - 当前 `activeIndex`
   * @param {1|-1} delta - 方向（ArrowDown = 1 / ArrowUp = -1）
   * @returns {number} 下一步的扁平索引；无任何可选中行时返回 -1
   */
  function nextSelectableIndex(selectable, current, delta) {
    const sel = Array.isArray(selectable) ? selectable : [];
    if (sel.length === 0) return -1;
    const dir = delta < 0 ? -1 : 1;
    const pos = sel.indexOf(current);
    if (pos >= 0) return sel[(pos + dir + sel.length) % sel.length];
    if (dir > 0) {
      for (const idx of sel) {
        if (idx > current) return idx;
      }
      return sel[0];
    }
    for (let i = sel.length - 1; i >= 0; i--) {
      if (sel[i] < current) return sel[i];
    }
    return sel[sel.length - 1];
  }

  /**
   * 面板过滤（D-03 两档 / D-10 面板隐藏 / `/skill:` token 分流）
   *
   * - 技能侧：先剔除 `disabled === true`（D-10 —— 纯消费主进程布尔，不重判）；
   *   过滤 token 为 `/skill:` 形态时按 `SKILL_PREFIX` 长度剥离后使用。
   *   前缀档 = `q === '' || name.startsWith(q)`；描述档 = 非前缀命中且 description
   *   子串命中。返回 `[...前缀档, ...描述档]`，**各档内保持入参原序**（即
   *   `ai-skills-manager.bySkillPriority` 已定的确定性全序）。
   * - 命令侧：`name.startsWith(rawFilter)` —— **用原 token**，逐字节沿用既有语义。
   *
   * @param {Array<object>} skills - 主进程收窄投影条目
   * @param {Array<{name: string}>} commands - 本地命令注册表（`SLASH_COMMANDS`）
   * @param {string} rawFilter - 输入框 `/` 后首个空白前的 token（已小写）
   * @returns {{skills: Array<object>, commands: Array<object>}}
   */
  function filterPickerItems(skills, commands, rawFilter) {
    const list = Array.isArray(skills) ? skills : [];
    const cmds = Array.isArray(commands) ? commands : [];
    const raw = typeof rawFilter === 'string' ? rawFilter : '';
    const q = raw.startsWith(SKILL_PREFIX) ? raw.slice(SKILL_PREFIX.length) : raw;

    const prefixTier = [];
    const descTier = [];
    for (const s of list) {
      if (!s || s.disabled === true) continue;
      const name = typeof s.name === 'string' ? s.name : '';
      const desc = typeof s.description === 'string' ? s.description.toLowerCase() : '';
      if (q === '' || name.startsWith(q)) {
        prefixTier.push(s);
        continue;
      }
      if (desc.includes(q)) descTier.push(s);
    }

    return {
      skills: prefixTier.concat(descTier),
      commands: cmds.filter(c => c && typeof c.name === 'string' && c.name.startsWith(raw)),
    };
  }

  /** 行尾状态标注四条定长文案（UI-SPEC §Copywriting，唯一权威） */
  const STATUS_TEXT = Object.freeze({
    shadowed: '已遮蔽 · 由用户同名技能胜出',
    nameClash: '与本地命令同名 · 本地命令优先',
    promptOmitted: '未进提示词 · 超预算',
    overLimit: '超数量上限',
  });

  /**
   * `manage_skill` 卡片头部**超预算标注**的 ≤ 4 字短形态（Phase 49 · G-49-3 的收口）——
   * 上面那张表的 `promptOmitted` 条目**第二段的机械投影**，不是第二份文案。
   *
   * ① **它是投影而非新写**：取值按分隔符切分上表的面板串后取末段派生 ⇒ 面板串改了，卡片形态
   *    随之改变，两处不可能分叉。48 的 `D-12` 原文与「照写不统一」契约只约束 `/` 面板那条
   *    （`promptOmitted` 逐字未变）；卡片头部是本阶段新增的**另一个表面**。
   * ② **为什么要短形态**：卡片头部在 AI 面板最小宽度（`--ai-panel-min-width` 280px）下
   *    `.tool-card-name` 只有 129px，而完整的两段式标注实测 100px，与徽标 32px 及两处 8px
   *    间隙合计 148px > 129px —— 溢出的 19px 被该容器继承的 `overflow: hidden` 裁掉，且唯一
   *    可压缩项（技能名文本）先被压到 0。面板行可换行、宽 ≥ 280px 且**没有结果区**，因此面板
   *    保留长文案；卡片有结果区承载完整语义（「暂未进入模型提示词（技能段预算已满），仍可用
   *    /skill:{name} 手动调用」），头部标注只是**可扫读的短标签**。
   * ③ **「不新写」的可核对面不是 `includes`**（写死第二份字面量同样能通过该断言），而是源码级
   *    两条：取值的书写形式必须是「该常量名 + 赋值 + 对上面那张表的 `promptOmitted` 条目调用
   *    `split(`」这一**引用 + 投影**形态（形态沿用本仓既有先例 —— 短原因表的
   *    `limit_exceeded` 同样写成对 `STATUS_TEXT.overLimit` 的**引用**而非第二份拷贝），且本文件
   *    中**不存在**被引号包裹的该值独立字面量（注释里也不许写 —— 门禁扫的是**全文含注释**）。
   *    第二条是**承重判据**：它同时封掉「声明处写成引用、导出处写死一份」的形态。第一条的门禁
   *    正则锚在源码上，故**本 JSDoc 刻意不逐字复写那条正则所匹配的字符串** —— 一旦复写，
   *    关于代码的断言就会被同一文件里的散文满足（本 phase 反复记录过的假绿形态）。
   * ④ `49-UI-SPEC.md` 的 E1 overflow 处置要求短原因 ≤ 4 字；本投影的字符数 = 3。
   */
  const PROMPT_OMITTED_CARD_NOTE = STATUS_TEXT.promptOmitted.split(' · ').pop();

  /**
   * 展平单数组（D-01 的唯一顺序权威）
   *
   * 顺序 = `[...技能分区, ...命令分区]`，**数组顺序即视觉渲染顺序**（分组标题只在渲染层
   * 插入、不占索引）。技能项的 `selectable` / `statusText` / `statusTone` 判定规则：
   *
   * - 可选中性 = 非 `shadowed` 且非「与本地命令同名」（后者是**纯名字集合查询**，
   *   不重新定义任何优先级 / 遮蔽 / 限额判定 —— 那些一律消费主进程字段，46 D-06）
   * - 状态标注优先级：`shadowed` > 与本地命令同名 > `promptOmitted` > `overLimit`
   *
   * @param {Array<object>} skills - 主进程收窄投影条目
   * @param {Array<object>} commands - 本地命令注册表（`SLASH_COMMANDS`）
   * @param {string} rawFilter - 输入框 `/` 后首个空白前的 token（已小写）
   * @returns {{items: Array<object>, skillCount: number, commandCount: number}}
   */
  function buildPickerItems(skills, commands, rawFilter) {
    const cmds = Array.isArray(commands) ? commands : [];
    const filtered = filterPickerItems(skills, cmds, rawFilter);

    const commandNames = new Set(
      cmds.map(c => (c && typeof c.name === 'string' ? c.name : null)).filter(n => n !== null)
    );

    const skillItems = filtered.skills.map(s => {
      const shadowed = s.shadowed === true;
      const nameClash = commandNames.has(s.name);
      let statusText;
      let statusTone;
      if (shadowed) {
        statusText = STATUS_TEXT.shadowed;
        statusTone = 'muted';
      } else if (nameClash) {
        statusText = STATUS_TEXT.nameClash;
        statusTone = 'muted';
      } else if (s.promptOmitted === true) {
        statusText = STATUS_TEXT.promptOmitted;
        statusTone = 'limit';
      } else if (s.overLimit === true) {
        statusText = STATUS_TEXT.overLimit;
        statusTone = 'limit';
      }
      return {
        kind: 'skill',
        name: s.name,
        description: s.description,
        tier: s.tier,
        disableModelInvocation: s.disableModelInvocation,
        selectable: !(shadowed || nameClash),
        statusText,
        statusTone,
      };
    });

    const commandItems = filtered.commands.map(c => ({
      kind: 'command',
      name: c.name,
      description: c.description,
      takesArg: c.takesArg,
      handler: c.handler,
      selectable: true,
      statusText: undefined,
    }));

    return {
      items: skillItems.concat(commandItems),
      skillCount: skillItems.length,
      commandCount: commandItems.length,
    };
  }

  /**
   * 三档来源徽标的唯一权威查表（D-14 的消费方）
   *
   * 面板行（48-02）与 `read` 工具卡片技能变体（48-03）**共用**本表取 `label` / `className`
   * / `title`，从而满足 UI-SPEC「不得另起第二份徽标实现」。`className` 是三个固定白名单
   * class 名，**取值不参与字符串拼接**；表外 / 缺失 tier → 渲染时跳过徽标（不得产出
   * `undefined` 字面量进 class）。
   */
  const TIER_BADGE = Object.freeze({
    user: Object.freeze({
      label: '用户',
      className: 'slash-picker-source-badge-user',
      title: '用户技能（agent-workspace/skills/），同名时优先于内置与托管',
    }),
    builtin: Object.freeze({
      label: '内置',
      className: 'slash-picker-source-badge-builtin',
      title: '随包内置技能，每次启动自愈播种',
    }),
    managed: Object.freeze({
      label: '托管',
      className: 'slash-picker-source-badge-managed',
      title: '托管技能（AI 自建，存于 managed-skills/）',
    }),
  });

  /**
   * `manage_skill` 三动作的卡片标题模板（Phase 49 D-02）—— **跨进程单源**
   *
   * `ai-manager.js`（工具事件生成侧）与 renderer（卡片渲染侧）**共用** `window.SkillPickerModel`
   * / `module.exports` 的**同一个** api 对象（与 `TIER_BADGE` 同款），不得在任一侧另写一份映射。
   *
   * 纪律：
   * - **闭合白名单**：表外键取值为 `undefined`（不回落任何默认文案）—— 渲染端判定「整个
   *   `manage_skill` 技能变体不成立」并回落既有普通卡片（标题 = 工具名），零回归。
   * - 模板含**一个** `{name}` 占位符，由**渲染端**替换（主进程不拼 DOM 文案）；
   *   `name` 一律经 `textContent` 注入，**不得**进 `innerHTML` / 属性值（TD-48-01 的教训面）。
   */
  const MANAGE_SKILL_ACTION_LABEL = Object.freeze({
    create: '创建技能「{name}」',
    update: '更新技能「{name}」',
    delete: '删除技能「{name}」',
  });

  /**
   * `manage_skill` 三动作的**中文短名**（Phase 49 UI-SPEC §卡片结构契约的参数区）
   *
   * 与上一张表**同址**（不新立第三张表）：参数摘要的第一行「动作：创建」即取本表。
   * 不从 `MANAGE_SKILL_ACTION_LABEL` 反推（剥掉 `技能「…」` 后缀是不可靠的字符串手术）。
   * 同样是**闭合白名单**（表外键 `undefined`）。
   */
  const MANAGE_SKILL_ACTION_NAME = Object.freeze({
    create: '创建',
    update: '更新',
    delete: '删除',
  });

  /**
   * `manage_skill` 九条失败原因码 → 卡片头部**短原因**（Phase 49 D-07）—— **跨进程单源**
   *
   * 纪律：
   * - **闭合白名单**：表外 code → 渲染端**不渲染标注**（不得回落到 `undefined` 字面量）。
   * - 短原因一律**定长 ≤ 6 字、不含技能名、不含变量** —— 这是卡片头部「恒 36px 单行」不变式
   *   在 AI 面板最小宽度下成立的前提（完整文案由主进程的业务错误消息单点产出）。
   * - `limit_exceeded` 与面板行尾标注 `STATUS_TEXT.overLimit` **同值**：此处**引用同一常量**
   *   （而非重复字面量）—— 这是「同值」的机械保证，不得改写成第二份拷贝。
   */
  const MANAGE_SKILL_SHORT_REASON = Object.freeze({
    seeded_protected: '内置不可改删',
    user_owned_conflict: '用户技能占用',
    already_exists: '已存在',
    not_found: '不存在',
    limit_exceeded: STATUS_TEXT.overLimit,
    invalid_name: '名称不合法',
    invalid_description: '描述不合法',
    oversize: '正文超限',
    unscannable: '内容含风险',
  });

  /**
   * `manage_skill` 卡片标记的**终态并入**（Phase 49 UI-SPEC 硬约束 1；CR-01 的修复点）——
   * **渲染端事件映射与纯 Node 测试共用的唯一合并实现**
   *
   * **为什么必须并入而不是覆盖**：`manage_skill` 的标记分**两个时点**给出 ——
   * `tool_execution_start` 给 `{action, name}`（标题必须运行中即可见，那是唯一携带 `params`
   * 的时点），`tool_execution_end` 只给终态三键 `{tier?, code?, promptIncluded?}`（`create`
   * 的目标在调用前并不存在，档位只能等磁盘判定之后）。渲染端若把终态载荷**覆盖**写进标记，
   * `action` 与 `name` 立刻丢失 ⇒ `MANAGE_SKILL_ACTION_LABEL[undefined]` 为 `undefined`
   * ⇒ 整个技能变体不成立，卡片退回工具名标题 + 整份 `content` 的 JSON 墙（CR-01）。
   *
   * **单源理由**（与文件头的双模式导出同款）：本 phase 的假绿成因正是「测试手搓期望对象、
   * 渲染端另有实现」。把合并抽成这里的纯函数后，测试与渲染端调用的是**同一个对象引用上的
   * 同一个函数**，守卫才在表达实现语义而不是意图。
   *
   * **契约**：
   * - `incoming` 为假值（`null` / `undefined`）→ **原样返回 `prev`**（同一引用）——
   *   这是「后续不带标记字段的 update 事件不得把已写入的标记抹掉」的机械保证。
   * - `prev` 为假值、`incoming` 非空 → 返回 `incoming` 的**浅拷贝**（不返回同一引用，
   *   避免调用方后续改动串到事件载荷上）。
   * - 两者都非空 → `{ ...prev, ...incoming }`：同名键 `incoming` 胜出，异名键两边都保留。
   * - **不修改任何入参**，每次（非原样返回的路径）都返回**新对象**。
   *
   * **纯数据形状运算**：不读路径、不读磁盘、不读技能集，因此**零来源 / 撞名 / 限额判定**
   * （判定只在主进程 —— UI-SPEC 硬约束 4 / 48-03 的既有纪律）。
   *
   * @param {object|null|undefined} prev - 已有标记（start 事件写入的 `{action, name}` 等）
   * @param {object|null|undefined} incoming - 新到的标记载荷（终态三键或 null）
   * @returns {object|null|undefined} 并入后的新对象；`incoming` 为空时即 `prev` 本体
   */
  function mergeManageSkillMarker(prev, incoming) {
    if (!incoming) return prev;
    if (!prev) return { ...incoming };
    return { ...prev, ...incoming };
  }

  const api = {
    SKILL_PREFIX,
    SKILL_NAME_RE,
    extractArgs,
    parseSkillRef,
    parseSkillInvocationText,
    buildSkillSyntaxText,
    buildSelectableIndexes,
    nextSelectableIndex,
    filterPickerItems,
    buildPickerItems,
    TIER_BADGE,
    STATUS_TEXT,
    PROMPT_OMITTED_CARD_NOTE,
    MANAGE_SKILL_ACTION_LABEL,
    MANAGE_SKILL_ACTION_NAME,
    MANAGE_SKILL_SHORT_REASON,
    mergeManageSkillMarker,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkillPickerModel = api;
})();
