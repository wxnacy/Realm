#!/usr/bin/env node
/**
 * UAT 驱动（Phase 49 · 49-08 / `UI-49-W6-01`）——
 * 「折叠的 `manage_skill` 卡片内不存在不可见的键盘停靠点」的真实渲染 + 真实键盘门禁。
 *
 * 用途
 * ----
 * 闭合 `49-UI-REVIEW.md` 的 BLOCKER `UI-49-W6-01`：49-02 给共享构建函数
 * `renderSkillContentBox` 的折叠块 header 补了 `role="button"` + `tabindex="0"`，
 * 但当它被放进**卡片语境**（`renderer.js:9739`）时落在 `.tool-card-content`
 * 这个默认折叠的容器内 —— 该容器用 `max-height: 0; overflow: hidden` 实现折叠
 * （为保住 200ms 过渡），而 `overflow: hidden` **不会**把后代移出顺序焦点导航。
 * 结果是折叠卡片上出现一个零可见高度的 Tab 停靠点：焦点环被祖先裁掉、
 * 命中测试取不到它，而它是卡片内唯一的键盘入口。
 *
 * 本驱动以**真实渲染 + 真实 Tab 遍历**判定该不变式：不是源码扫描、不是声明扫描。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-49-g49-4-card-a11y-tab-order.js
 *
 * 可选环境变量：
 *   `G49_4_ROUND=red|green`  证据 JSON 里的轮次标记（红轮 = 未修复树 / 绿轮 = 修复后）
 *   `G49_4_LOG=<path>`       完整输出额外落盘（终端输出仍然保留）
 *
 * 依赖全局 `playwright`（`_electron`）——只启动**本进程自己拉起的** realm-dev 子进程
 * （独立 userData `~/Library/Application Support/realm-dev/`）。收尾固定
 * `electronApp.close()` + `process.exit(code)`（含超时兜底 + 自身子进程 `SIGKILL`）。
 * **严禁** `pkill` / `pgrep` 模式匹配杀进程 —— 撰写本驱动时用户正运行正式版
 * `/Applications/Realm.app`。
 *
 * 为什么不能用「源码扫描 / 声明扫描」替代
 * ------------------------------------
 * 本阶段（49）已反复记录：**子串存在 ≠ 行为成立**、**属性声明存在 ≠ 焦点可见**。
 * 具体到本 gap：
 *   - 「有没有 tabindex」是源码事实，而「按 Tab 时焦点实际停在哪、那个位置画的是谁」
 *     是**运行时**事实 —— 只有真实 `_electron` + 真实 `keyboard.press('Tab')` 能给；
 *   - 「祖先盒子高 0」这一条在源码里看得见（`max-height: 0`），但「后代是否仍在 Tab 序内」
 *     是**浏览器语义**（`display: none` 才会移出，`max-height: 0` 不会），源码层面不可判定；
 *   - 旧的同型假绿（G-49-3 的 `noteNotClipped`）正是「判据取错对象」：比的是元素自身的
 *     `scrollWidth`/`clientWidth`，而裁切发生在其**祖先**。本驱动因此把判据落在
 *     「真实停靠点的外接矩形高 + 其中心点的命中测试」上，并要求红轮先红。
 *
 * 断言非恒真的自证（R6）
 * --------------------
 * 绿轮可能**空真**（卡片内零停靠点 ⇒ 「凡卡片内停靠点都可见」是空集真）。故：
 *   ① `R1` 断言遍历本身有效（停靠点总数 ≥ 20 且至少一站非 `BODY`）；
 *   ② `R6` 把红轮定义为**单点变异态**（= 把卡片调用点的 `{ interactive: false }` 去掉），
 *      并在证据 JSON 里显式记录 `mutation`；`R2` 断言前提（卡片确实折叠、容器确实 0 高）。
 * **若红轮 R3 不红，说明驱动取错了判据对象 —— 必须先修驱动，不得改源码。**
 *
 * 脚本命名
 * -------
 * 文件名以 `uat-` 开头 ⇒ **永不被** `test-*.js` 类套件（`node --test tests/` 等）拾取；
 * 它只在需要真实渲染时手工 / 受控运行。
 *
 * 产物（**不覆盖** `evidence.json` / `evidence3.json` / `evidence-g49-3.json`）
 * -----------------------------------------------------------------------
 *   /tmp/uat49/evidence-g49-4.json   前置自检 + Tab 全量明细 + R1–R6 + mutation + 红/绿两轮
 *
 * 退出码：全部断言通过 → 0；任一条失败 → 非零（并在输出尾部打印逐条布尔表）。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/tmp/uat49';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-g49-4.json');
const CONV_DB = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'realm-dev',
  'ai-conversations.db'
);
/**
 * 本仓自带的 Electron 可执行文件（`node_modules/electron` 的导出即二进制路径）。
 * playwright 装在**全局**（`NODE_PATH="$(npm root -g)"`），它自身找不到本仓的 electron，
 * 故必须显式传 `executablePath` —— 否则 launch 直接以
 * "Electron executablePath not found!" 失败。
 */
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));

/** Tab 遍历站数上限（审计实测 46 站；80 留足余量，且足以往返一轮） */
const TAB_STOPS = 80;
/** 复用路径最多尝试切换多少个历史对话 */
const MAX_CONV_SWITCH = 12;
/** 轮次标记（红轮 = 未修复树，绿轮 = 修复后） */
const ROUND = process.env.G49_4_ROUND || 'unknown';
/** 可选：完整输出额外落盘的路径 */
const LOG_PATH = process.env.G49_4_LOG || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 输出：终端 + 可选落盘（`G49_4_LOG`），落盘内容与终端逐字一致
// ---------------------------------------------------------------------------
const logBuffer = [];
const log = (...a) => {
  const line = a
    .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
    .join(' ');
  logBuffer.push(line);
  console.log(line);
};
const logError = (...a) => {
  const line = a
    .map((x) => (typeof x === 'string' ? x : (x && x.stack) || JSON.stringify(x)))
    .join(' ');
  logBuffer.push(line);
  console.error(line);
};

/**
 * 前置自检（在启动动作**之前**逐条判定，各带独立失败码）
 * - `E-PW`      全局 playwright / `_electron` 不可得 → **硬退出**
 * - `E-DATA-DB` 会话库里不存在任何「含 success 的 `manage_skill` 工具调用且带 content」
 *               的会话 → **硬退出**（缺了它目标卡片必然不可得，此时任何「全绿」都是假绿）
 * @returns {{preflight: object, pwOk: boolean, dataDbOk: boolean}}
 */
function preflight() {
  const pf = {};
  let bubbleCandidates = [];

  let pwOk = false;
  let pwDetail = '';
  try {
    // 与 `NODE_PATH="$(npm root -g)" node -e "!!require('playwright')._electron"` 同一判据
    pwOk = !!require('playwright')._electron;
    pwDetail = 'playwright._electron 可用';
  } catch (err) {
    pwOk = false;
    pwDetail = 'require("playwright") 失败: ' + err.message;
  }
  pf['E-PW'] = { ok: pwOk, detail: pwDetail, fatal: true };

  let dataDbOk = false;
  let dbDetail = '';
  try {
    const Database = require(path.join(REPO_ROOT, 'node_modules', 'better-sqlite3'));
    const db = new Database(CONV_DB, { readonly: true });
    // 判据按**会话**聚合：`tool_calls` 与 `tool_results` 落在同一会话的不同消息行上
    // （助手行带 tool_calls、toolResult 行带 tool_results）—— 逐行判定必然取空。
    const rows = db
      .prepare(
        'SELECT conversation_id, tool_calls, tool_results FROM messages ' +
          "WHERE tool_calls LIKE '%\"manage_skill\"%' OR tool_results LIKE '%\"manage_skill\"%'"
      )
      .all();
    /** @type {Map<string, {contentCall: boolean, okResult: boolean}>} */
    const byConv = new Map();
    const slot = (id) => {
      const key = String(id);
      if (!byConv.has(key)) byConv.set(key, { contentCall: false, okResult: false });
      return byConv.get(key);
    };
    const parseArr = (raw) => {
      try {
        const v = JSON.parse(raw || '[]');
        if (Array.isArray(v)) return v;
        // `tool_results` 落库的是**单个对象**（不是数组）—— 只认数组会静默取空 0 个候选
        return v && typeof v === 'object' ? [v] : [];
      } catch (_) {
        return [];
      }
    };
    for (const row of rows) {
      const entry = slot(row.conversation_id);
      for (const call of parseArr(row.tool_calls)) {
        if (
          call &&
          call.name === 'manage_skill' &&
          call.arguments &&
          typeof call.arguments.content === 'string' &&
          call.arguments.content.length > 0
        ) {
          entry.contentCall = true; // 卡片会渲染正文折叠块（create / update 且非失败态）
        }
      }
      for (const result of parseArr(row.tool_results)) {
        if (result && result.toolName === 'manage_skill' && result.isError === false) {
          entry.okResult = true; // 至少一次成功（失败态卡片不渲染折叠块）
        }
      }
    }
    const candidates = [...byConv.entries()]
      .filter(([, v]) => v.contentCall && v.okResult)
      .map(([id]) => id);
    dataDbOk = candidates.length > 0;
    dbDetail = `会话库候选会话 ${candidates.length} 个：[${candidates.join(', ')}]`;

    // 气泡实例的候选会话：入库的技能调用 user 行（`<skill name="…" location="…">`）⇒
    // 重载链路会经 `_decorateSkillUserMessage` 还原出气泡内的正文折叠块。
    // **为什么需要它**：R4 的对照必须落在**气泡实例**上，而本仓 realm-dev 里
    // 「含 manage_skill 成功卡片」的会话与「含技能调用气泡」的会话**没有交集**，
    // 故 R4 需切换到这些会话之一（按最近使用排序，前几个必在历史下拉的可视范围内）。
    bubbleCandidates = db
      .prepare(
        "SELECT c.id AS id, c.updated_at AS updated_at FROM conversations c " +
          "WHERE EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id " +
          "AND m.content LIKE '%<skill name=%') ORDER BY c.updated_at DESC LIMIT 8"
      )
      .all()
      .map((r) => r.id);
    db.close();
  } catch (err) {
    dataDbOk = false;
    dbDetail = '读取会话库失败: ' + err.message;
  }
  pf['E-DATA-DB'] = { ok: dataDbOk, detail: dbDetail, fatal: true };
  pf['E-BUBBLE-DB'] = {
    ok: bubbleCandidates.length > 0,
    detail: `气泡实例候选会话 ${bubbleCandidates.length} 个（R4 的对照对象）：[${bubbleCandidates.join(
      ', '
    )}]`,
    fatal: false,
  };

  return { preflight: pf, pwOk, dataDbOk, bubbleCandidates };
}

/** 读取上一次运行的证据（红 / 绿两轮各自保留，互不覆盖） */
function readEvidence() {
  try {
    const prior = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
    if (prior && typeof prior === 'object') return prior;
  } catch (_) {
    /* 首次运行 */
  }
  return null;
}

/**
 * 写出证据 JSON：**累积式** —— 红轮与绿轮的记录都留在 `runs[]` 里，
 * 顶层 `tabStops` 为最近一轮的全量明细。
 * @param {object} evidence
 */
function writeEvidence(evidence) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
}

/**
 * 页面内探针：当前 `document.activeElement` 的全部判定量。
 *
 * `R3` 的判据体（**唯一承重处**）：
 *   - `rectH` = 停靠点自身外接矩形高（被祖先裁切的元素**仍报自己的布局盒高**，
 *     所以这一条单独不足以判「可见」—— 必须配命中测试）；
 *   - `hitIsSelfOrDescendant` = 其中心点的 `document.elementFromPoint` 是否落回
 *     它自身或其后代（**不接受祖先**：被 `overflow: hidden` + `max-height: 0` 裁掉的
 *     后代，其中心点的真正命中对象恰恰是**承载裁切的祖先** —— 把祖先算作「落回自身」
 *     会让判据恒真。本驱动第一版即此自毁形态，在**未修复树**上就判绿，已修正）。
 * 中心点若不在视口内，先 `scrollIntoView` 再复测（Tab 聚焦本会自带滚动，
 * 这里是防「判据因视口外而假红」的护栏，并记录 `scrolledIntoView`）。
 * @returns {object}
 */
function stopProbe() {
  const el = document.activeElement;
  const out = {
    tag: el ? el.tagName : null,
    className: el && typeof el.className === 'string' ? el.className : '',
    text: el ? String(el.textContent || '').slice(0, 30) : '',
    isContentBoxHeader: !!(
      el &&
      el.classList &&
      el.classList.contains('ai-skill-content-box-header')
    ),
    inToolCard: false,
    cardClass: null,
    rectH: null,
    rectW: null,
    centerInViewport: null,
    scrolledIntoView: false,
    hitTag: null,
    hitClass: null,
    hitText: '',
    hitIsSelfOrDescendant: null,
    hitIsAncestorOfEl: null,
    hitInsideToolCard: null,
    note: '',
  };

  if (!el || el === document.body || el === document.documentElement) {
    out.note = 'body-or-null';
    return out;
  }

  const card = el.closest ? el.closest('.tool-card') : null;
  out.inToolCard = !!card;
  out.cardClass = card ? String(card.className) : null;
  if (!out.inToolCard) return out;

  const rectOf = (node) => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const inView = (x, y) =>
    x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;

  let r = rectOf(el);
  let cx = r.left + r.width / 2;
  let cy = r.top + r.height / 2;
  out.centerInViewport = inView(cx, cy);
  if (!out.centerInViewport) {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    r = rectOf(el);
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    out.centerInViewport = inView(cx, cy);
    out.scrolledIntoView = true;
  }
  out.rectH = r.height;
  out.rectW = r.width;

  const hit = document.elementFromPoint(cx, cy);
  if (!hit) {
    out.hitIsSelfOrDescendant = false;
    out.hitInsideToolCard = false;
    out.note = 'elementFromPoint 返回 null';
    return out;
  }
  out.hitTag = hit.tagName;
  out.hitClass = typeof hit.className === 'string' ? hit.className : '';
  out.hitText = String(hit.textContent || '').slice(0, 30);
  // **判据体（唯一承重处）**：这个位置上画的必须**就是它自己或它的后代**。
  // 为什么**不接受祖先**：元素被祖先用 `overflow: hidden` + `max-height: 0` 裁掉时，
  // `elementFromPoint` 会返回**该祖先**（它才是这个位置上真正被绘制的东西）——
  // 把祖先算作「落回自身」会让判据恒真（本驱动第一版正是这么写的，实测在**未修复树**
  // 上就判绿，属自毁形态，已修正）。这也是 49-07 记录的「判据取错对象」的同型陷阱。
  out.hitIsSelfOrDescendant = hit === el || el.contains(hit);
  out.hitIsAncestorOfEl = el.contains(hit) ? false : hit.contains(el);
  out.hitInsideToolCard = !!hit.closest('.tool-card');
  return out;
}

/**
 * 页面内探针：候选目标卡片的标识与前提量。
 * @returns {Array<object>}
 */
function targetProbe() {
  const cards = Array.from(document.querySelectorAll('.tool-card.tool-card-manage')).filter(
    (c) => c.querySelector('.ai-skill-content-box-header') !== null
  );
  return cards.map((card, index) => {
    const content = card.querySelector('.tool-card-content');
    const status = card.querySelector('.tool-card-status');
    const header = card.querySelector('.ai-skill-content-box-header');
    const box = card.querySelector('.ai-skill-content-box');
    return {
      index,
      cardClass: String(card.className),
      statusText: status ? status.textContent : null,
      headerText: header ? header.textContent : null,
      cardExpanded: card.classList.contains('expanded'),
      contentMaxHeight: content ? getComputedStyle(content).maxHeight : null,
      contentRectH: content ? content.getBoundingClientRect().height : null,
      boxCollapsed: box ? box.classList.contains('collapsed') : null,
      headerTabindex: header ? header.getAttribute('tabindex') : null,
      headerRole: header ? header.getAttribute('role') : null,
      headerAriaExpanded: header ? header.getAttribute('aria-expanded') : null,
    };
  });
}

/**
 * 页面内探针：气泡语境的折叠块 header（不在任何 `.tool-card` 内 —— 48-UI-REVIEW
 * Pillar 6 的修复在本计划中必须原位保留）。
 * @returns {object|null}
 */
function bubbleProbe() {
  const headers = Array.from(document.querySelectorAll('.ai-skill-content-box-header'));
  const el = headers.find((h) => !h.closest('.tool-card'));
  if (!el) return null;
  const box = el.closest('.ai-skill-content-box');
  return {
    className: String(el.className),
    role: el.getAttribute('role'),
    tabindex: el.getAttribute('tabindex'),
    ariaExpanded: el.getAttribute('aria-expanded'),
    boxCollapsed: box ? box.classList.contains('collapsed') : null,
  };
}

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pf = preflight();
  if (!pf.pwOk) {
    writeEvidence({
      driver: 'tests/uat-49-g49-4-card-a11y-tab-order.js',
      started,
      preflight: pf.preflight,
      aborted: 'E-PW',
      runs: [],
    });
    logError('E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }
  if (!pf.dataDbOk) {
    writeEvidence({
      driver: 'tests/uat-49-g49-4-card-a11y-tab-order.js',
      started,
      preflight: pf.preflight,
      aborted: 'E-DATA-DB',
      runs: [],
    });
    logError('E-DATA-DB ' + pf.preflight['E-DATA-DB'].detail);
    logError('E-DATA-DB 目标卡片必然不可得 —— 拒绝在缺前提的树上判绿');
    process.exit(12);
  }
  log(`[preflight] E-PW ${pf.preflight['E-PW'].ok} | E-DATA-DB ${pf.preflight['E-DATA-DB'].ok}`);
  log('[preflight] ' + pf.preflight['E-DATA-DB'].detail);
  log('[preflight] ' + pf.preflight['E-BUBBLE-DB'].detail);

  const { _electron: electronLauncher } = require('playwright');
  const pageErrors = [];
  let electronApp = null;
  /** @type {import('playwright').Page|null} */
  let page = null;
  let exitCode = 1;

  const assertions = {};
  const tabStops = [];
  let targetCards = [];
  let targetIndex = -1;
  let target = null;
  let r3Detail = null;
  let dataOk = false;

  const evidence = {
    driver: 'tests/uat-49-g49-4-card-a11y-tab-order.js',
    round: ROUND,
    started,
    finished: null,
    repo: REPO_ROOT,
    node: process.version,
    preflight: pf.preflight,
    targetConversation: null,
    sourcePath: null,
    bubbleCandidates: pf.bubbleCandidates,
    targetCards: [],
    targetIndex: -1,
    tabStops: [],
    assertions: {},
    assertionsPass: false,
    r3Detail: null,
    bubble: null,
    // R6：红轮本身就是**单点变异态**（把卡片调用点的 `{ interactive: false }` 去掉）
    mutation: {
      name: 'card-call-without-interactive-false',
      expectR3Red: true,
      note:
        '红轮 = 未修复树（卡片调用点未传 interactive: false）⇒ 等价于把该选项去掉的变异态。' +
        'R3 必须在该态下为红，否则判据取错了对象。',
    },
    pageErrors,
    exitCode: null,
    thrown: null,
  };

  try {
    electronApp = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
      timeout: 60000,
    });

    // 主窗口 = index.html（其余窗口一律忽略）
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline && !page) {
      for (const w of electronApp.windows()) {
        if (w.url().includes('index.html')) {
          page = w;
          break;
        }
      }
      if (!page) await sleep(300);
    }
    if (!page) throw new Error('未找到 index.html 主窗口（45s 内）');
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

    await page.waitForSelector('#aiPanel', { timeout: 20000 });
    await page.waitForSelector('#aiInput', { timeout: 20000 });

    // 面板可能处于持久化的隐藏态 → 用真实点击打开（不直接改 DOM 状态）
    let panelVisible = await page.$eval('#aiPanel', (el) => !el.classList.contains('hidden'));
    if (!panelVisible) {
      await page.click('#aiPanelBtn');
      await sleep(800);
      panelVisible = await page.$eval('#aiPanel', (el) => !el.classList.contains('hidden'));
      if (!panelVisible) throw new Error('点击 #aiPanelBtn 后面板仍不可见');
    }

    /**
     * 当前 DOM 里是否存在「`manage_skill` 卡片 + 正文折叠块」的目标卡片。
     * @returns {Promise<boolean>}
     */
    const hasTargetCard = () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.tool-card.tool-card-manage')).some(
            (c) => c.querySelector('.ai-skill-content-box-header') !== null
          )
      );

    const dropOpen = () =>
      page.$eval('#aiConvDropdown', (el) => getComputedStyle(el).display !== 'none');

    // ---- 定位目标会话：优先复用已渲染的会话；否则遍历历史下拉 ----
    if (await hasTargetCard()) {
      evidence.sourcePath = 'already-rendered';
      evidence.targetConversation = '(already-rendered)';
      log('[locate] 当前已渲染的会话中即含目标卡片（复用路径命中）');
    } else {
      // **必须先展开历史下拉** —— 否则 `$$eval('#aiConvList .ai-conv-item')` 读到 0 项
      if (!(await dropOpen())) {
        await page.click('#aiHistoryBtn');
        await sleep(400);
      }
      const ids = await page.$$eval('#aiConvList .ai-conv-item', (els) =>
        els.map((e) => e.dataset.conversationId).filter(Boolean)
      );
      log(`[locate] 历史对话 ${ids.length} 个，逐个打开查找目标卡片（上限 ${MAX_CONV_SWITCH}）`);
      for (const id of ids.slice(0, MAX_CONV_SWITCH)) {
        if (!(await dropOpen())) {
          await page.click('#aiHistoryBtn');
          await sleep(300);
        }
        const sel = `#aiConvList .ai-conv-item[data-conversation-id="${id}"]`;
        const item = await page.$(sel);
        if (!item) continue;
        await item.click().catch(() => {});
        await sleep(700);
        if (await hasTargetCard()) {
          evidence.targetConversation = id;
          evidence.sourcePath = 'reuse';
          dataOk = true;
          log(`[locate] 复用路径命中：对话 ${id}`);
          break;
        }
      }
      if (!(await hasTargetCard())) {
        logError('E-DATA 历史下拉（' + ids.length + ' 个会话）中找不到任何含 '
          + '`.tool-card.tool-card-manage` + `.ai-skill-content-box-header` 的会话');
        evidence.errored = 'E-DATA';
        exitCode = 12;
        throw new Error('E-DATA');
      }
      dataOk = true;
    }
    evidence.preflight['E-DATA'] = {
      ok: dataOk,
      detail:
        '会话 ' + evidence.targetConversation + ' 内存在 manage_skill 卡片 + 正文折叠块（sourcePath=' + evidence.sourcePath + '）',
      fatal: true,
    };

    // ---- 收敛到唯一一张目标卡片并记录其标识 ----
    targetCards = await page.evaluate(targetProbe);
    evidence.targetCards = targetCards;
    if (targetCards.length === 0) throw new Error('目标卡片在探针阶段消失');
    // 最后一张 = DOM 顺序里最新的那次 manage_skill 调用（确定性选择）
    targetIndex = targetCards.length - 1;
    target = targetCards[targetIndex];
    evidence.targetIndex = targetIndex;
    log(
      `[locate] 候选卡片 ${targetCards.length} 张；目标 index=${targetIndex} · status=${JSON.stringify(
        target.statusText
      )} · header=${JSON.stringify(target.headerText)} · 全部候选索引=[${targetCards
        .map((c) => c.index)
        .join(',')}]`
    );

    // 目标卡片滚入视口（滚动只影响视口位置，不影响布局尺寸）
    await page
      .evaluate((idx) => {
        const cards = Array.from(document.querySelectorAll('.tool-card.tool-card-manage')).filter(
          (c) => c.querySelector('.ai-skill-content-box-header') !== null
        );
        const card = cards[idx];
        if (card) card.scrollIntoView({ block: 'center' });
      }, targetIndex)
      .catch(() => {});
    await sleep(250);

    // ---- P 组 · 前提断言 ----
    const pre = (await page.evaluate(targetProbe))[targetIndex];
    const p1 = pre.cardExpanded === false;
    const p2 = pre.contentMaxHeight === '0px' && pre.contentRectH === 0;
    assertions.P1 = {
      pass: p1,
      detail: `目标卡片处于折叠态（cardExpanded=${pre.cardExpanded}）`,
    };
    assertions.P2 = {
      pass: p2,
      detail: `.tool-card-content computed maxHeight=${JSON.stringify(
        pre.contentMaxHeight
      )} · 外接矩形高=${pre.contentRectH}`,
    };
    if (!p1 || !p2) {
      logError('E-STATE 前提不成立（P1/P2）—— 会拿一张已展开的卡片判绿，硬退出');
      evidence.errored = 'E-STATE';
      exitCode = 13;
      throw new Error('E-STATE');
    }

    // ---- 真实 Tab 遍历（R 组 · 承重）----
    // 遍历前把历史下拉收起（若展开）：遮罩/浮层会盖住卡片，让命中测试取到浮层而假红。
    if (await dropOpen()) {
      await page.click('#aiHistoryBtn');
      await sleep(300);
      log('[tab] 历史下拉已收起（避免浮层遮挡命中测试）');
    }
    const startActive = await page.evaluate(() => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      // 把顺序焦点导航的**起点**钉到文档开头：`tabindex="-1"` 让 body 可被 focus()
      // 但不把 body 加进 Tab 序。不加这一句时浏览器会把起点留在上一次点击处，
      // 遍历起点随交互漂移（本驱动首轮实测：起点落在卡片域内，前 43 站只覆盖了半个环）。
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      return {
        tag: document.activeElement ? document.activeElement.tagName : null,
        className:
          document.activeElement && typeof document.activeElement.className === 'string'
            ? document.activeElement.className
            : '',
      };
    });
    log(`[tab] 起始 activeElement=${startActive.tag}.${startActive.className}`);
    evidence.tabTraversal = {
      stops: TAB_STOPS,
      startActiveElement: startActive,
      bodyTabindexInjected: true,
    };

    for (let i = 0; i < TAB_STOPS; i += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(stopProbe);
      stop.index = i;
      tabStops.push(stop);
    }
    // 遍历期间页面滚动过；把目标卡片重新滚回视口供后续断言（R5 的真实点击）
    await page
      .evaluate((idx) => {
        const cards = Array.from(document.querySelectorAll('.tool-card.tool-card-manage')).filter(
          (c) => c.querySelector('.ai-skill-content-box-header') !== null
        );
        const card = cards[idx];
        if (card) card.scrollIntoView({ block: 'center' });
      }, targetIndex)
      .catch(() => {});
    await sleep(200);
    evidence.tabStops = tabStops;

    const nonBody = tabStops.filter((s) => s.tag && s.tag !== 'BODY' && s.tag !== 'HTML');
    const inCard = tabStops.filter((s) => s.inToolCard === true);
    const r1 = tabStops.length >= 20 && nonBody.length >= 1;
    assertions.R1 = {
      pass: r1,
      detail: `非空真 · 遍历有效性：停靠点总数 ${tabStops.length}（≥20）· 非 body/html 站数 ${nonBody.length}（≥1）`,
    };
    assertions.R2 = {
      pass: p1 && p2,
      detail: `前提在遍历前成立：P1=${p1} P2=${p2}`,
    };

    // R3 —— **方向无关**：凡在卡片内的停靠点都必须可见。
    // 不写成「卡片内不得有停靠点」—— 否则日后 a11y 改善（卡片头部成为可聚焦入口）
    // 反而会让门禁转红。只有「不可见的停靠点」才失败。
    const r3Violations = inCard.filter(
      (s) => !(s.rectH !== null && s.rectH > 0 && s.hitIsSelfOrDescendant === true)
    );
    r3Detail = {
      inCardCount: inCard.length,
      violationCount: r3Violations.length,
      criterion: 'rectH > 0 && elementFromPoint(center) ∈ {self, descendant}',
      stops: inCard.map((s) => ({
        index: s.index,
        tag: s.tag,
        className: s.className,
        text: s.text,
        isContentBoxHeader: s.isContentBoxHeader,
        cardClass: s.cardClass,
        rectH: s.rectH,
        rectW: s.rectW,
        centerInViewport: s.centerInViewport,
        scrolledIntoView: s.scrolledIntoView,
        hitTag: s.hitTag,
        hitClass: s.hitClass,
        hitText: s.hitText,
        hitIsSelfOrDescendant: s.hitIsSelfOrDescendant,
        hitIsAncestorOfEl: s.hitIsAncestorOfEl,
        hitInsideToolCard: s.hitInsideToolCard,
        note: s.note,
      })),
    };
    evidence.r3Detail = r3Detail;
    assertions.R3 = {
      pass: r3Violations.length === 0,
      detail:
        `承重判据（方向无关）：卡片域内停靠点 ${inCard.length} 站 · 违反 ${r3Violations.length} 站` +
        (r3Violations.length
          ? ' → ' +
            r3Violations
              .map(
                (s) =>
                  `[#${s.index} ${s.className || s.tag} rectH=${s.rectH} 中心点命中=${s.hitTag}.${
                    s.hitClass
                  }「${s.hitText}」]`
              )
              .join(' ')
          : ''),
    };

    // R5 —— 语境一致性：卡片实例的折叠块 header 在任何卡片状态下都不带焦点语义
    // **先于 R4 执行**：气泡实例与目标卡片**不在同一个会话**（本仓 realm-dev 里
    // 「含 manage_skill 成功卡片」的会话与「含技能调用气泡」的会话无交集），
    // R4 需要切换会话，故卡片侧断言必须先做完。
    const attrsNull = (o) =>
      o.headerTabindex === null && o.headerRole === null && o.headerAriaExpanded === null;
    const collapsedState = (await page.evaluate(targetProbe))[targetIndex];
    const r5a = attrsNull(collapsedState);

    // 真实点击展开卡片（`.tool-card-header`），再看三个属性
    await page.evaluate((idx) => {
      const cards = Array.from(document.querySelectorAll('.tool-card.tool-card-manage')).filter(
        (c) => c.querySelector('.ai-skill-content-box-header') !== null
      );
      const card = cards[idx];
      if (card) card.querySelector('.tool-card-header').click();
    }, targetIndex);
    await sleep(500);
    const expandedState = (await page.evaluate(targetProbe))[targetIndex];
    const r5b = attrsNull(expandedState);
    const expandedOk =
      expandedState.cardExpanded === true && expandedState.contentMaxHeight !== '0px';
    assertions.R5 = {
      pass: r5a && r5b && expandedOk,
      detail:
        `语境一致性：折叠态属性 ${JSON.stringify({
          tabindex: collapsedState.headerTabindex,
          role: collapsedState.headerRole,
          ariaExpanded: collapsedState.headerAriaExpanded,
        })}（应全为 null）· 真实点击展开后 cardExpanded=${expandedState.cardExpanded} maxHeight=${JSON.stringify(
          expandedState.contentMaxHeight
        )} 属性 ${JSON.stringify({
          tabindex: expandedState.headerTabindex,
          role: expandedState.headerRole,
          ariaExpanded: expandedState.headerAriaExpanded,
        })}（应全为 null）`,
    };

    // R4 —— 对照 · 防过度修复（气泡实例的 48 增量必须原位保留）
    let bubbleConversation = evidence.targetConversation;
    let bubbleBefore = await page.evaluate(bubbleProbe);
    if (!bubbleBefore) {
      // 本会话没有气泡实例 → 切到「入库的技能调用 user 行」所在会话
      for (const id of evidence.bubbleCandidates || []) {
        if (!(await dropOpen())) {
          await page.click('#aiHistoryBtn');
          await sleep(300);
        }
        const item = await page.$(`#aiConvList .ai-conv-item[data-conversation-id="${id}"]`);
        if (!item) continue;
        await item.click().catch(() => {});
        await sleep(700);
        const probe = await page.evaluate(bubbleProbe);
        if (probe) {
          bubbleBefore = probe;
          bubbleConversation = id;
          log(`[R4] 气泡实例来自会话 ${id}`);
          break;
        }
      }
    }
    let bubbleAfter = null;
    let bubbleToggleOk = false;
    if (bubbleBefore) {
      await page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('.ai-skill-content-box-header'));
        const el = headers.find((h) => !h.closest('.tool-card'));
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.focus();
        }
      });
      await sleep(150);
      await page.keyboard.press('Enter');
      await sleep(200);
      bubbleAfter = await page.evaluate(bubbleProbe);
      bubbleToggleOk =
        !!bubbleAfter && bubbleAfter.boxCollapsed === false && bubbleAfter.ariaExpanded === 'true';
    }
    const bubbleAttrsOk =
      !!bubbleBefore &&
      bubbleBefore.role === 'button' &&
      bubbleBefore.tabindex === '0' &&
      bubbleBefore.ariaExpanded === 'false' &&
      bubbleBefore.boxCollapsed === true;
    assertions.R4 = {
      pass: bubbleAttrsOk && bubbleToggleOk,
      detail:
        `对照 · 防过度修复（气泡实例，会话 ${bubbleConversation}）：before=${JSON.stringify(
          bubbleBefore
        )} · 真实 Enter 后=${JSON.stringify(bubbleAfter)} · ` +
        `折叠被切换且 aria-expanded 同步=${bubbleToggleOk}`,
    };

    evidence.bubble = { conversation: bubbleConversation, before: bubbleBefore, after: bubbleAfter };

    // R6 —— 单点变异自检（非空真的承担者：红轮即变异态；绿轮要求 R3 无违反且前提/遍历有效）
    assertions.R6 = {
      pass: true,
      detail:
        `单点变异自检：mutation=${evidence.mutation.name} expectR3Red=${evidence.mutation.expectR3Red} · ` +
        `本轮 R3 ${assertions.R3.pass ? '绿' : '红'}（红轮必须为红；绿轮必须为绿且 R1/R2 为绿）· ` +
        `卡片域内 ${r3Detail.inCardCount} 站 / 违反 ${r3Detail.violationCount} 站`,
    };
    // 红轮的「自检」语义：R3 红是**预期**；绿轮的 R6 依附 R1/R2/R3 的有效性
    if (ROUND === 'red') {
      assertions.R6.pass = assertions.R3.pass === false;
      if (!assertions.R6.pass) {
        assertions.R6.detail +=
          ' · ⚠ 红轮 R3 竟为绿 —— 判据取错对象（必须修驱动，不得改源码）';
      }
    } else {
      assertions.R6.pass = assertions.R3.pass === true && assertions.R1.pass === true;
    }

    evidence.assertions = assertions;
    evidence.assertionsPass = Object.values(assertions).every((a) => a.pass);
  } catch (err) {
    evidence.thrown = String(err && err.message ? err.message : err);
    if (!evidence.errored) {
      logError('[error] ' + evidence.thrown);
    }
  } finally {
    evidence.finished = new Date().toISOString();
    if (exitCode === 1) exitCode = evidence.assertionsPass ? 0 : 1;
    evidence.exitCode = exitCode;

    // 证据 JSON 累积写：红 / 绿两轮各留一条 run（顶层 tabStops = 最近一轮）
    try {
      const prior = readEvidence();
      const priorRuns = prior && Array.isArray(prior.runs) ? prior.runs : [];
      const runs = priorRuns.filter((r) => r && r.round !== ROUND);
      runs.push({
        round: ROUND,
        started: evidence.started,
        finished: evidence.finished,
        exitCode,
        sourcePath: evidence.sourcePath,
        targetConversation: evidence.targetConversation,
        targetCards: evidence.targetCards,
        targetIndex: evidence.targetIndex,
        assertions: evidence.assertions,
        assertionsPass: evidence.assertionsPass,
        r3Detail: evidence.r3Detail,
        bubble: evidence.bubble,
        mutation: evidence.mutation,
        tabStops: evidence.tabStops,
        thrown: evidence.thrown,
        pageErrors: evidence.pageErrors,
      });
      const merged = Object.assign({}, prior || {}, evidence, { runs });
      merged.tabStops = evidence.tabStops.length
        ? evidence.tabStops
        : (prior && prior.tabStops) || [];
      writeEvidence(merged);
    } catch (e) {
      logError('写证据 JSON 失败: ' + e.message);
    }

    if (electronApp) {
      try {
        await Promise.race([electronApp.close(), sleep(6000)]);
      } catch (e) {
        logError('electronApp.close() 失败: ' + (e && e.message ? e.message : e));
      }
      // 兜底：只 kill **本进程自己拉起的** 子进程（绝不按模式匹配杀进程）
      try {
        const proc = electronApp.process();
        if (proc && proc.pid && proc.exitCode === null && !proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch (_) {
        /* 已退出 */
      }
    }
  }

  // ---------------- 输出 ----------------
  log('');
  log(`[result] round=${ROUND} · 目标会话=${evidence.targetConversation} · 来源路径=${evidence.sourcePath}`);
  log(`[result] 候选卡片 ${evidence.targetCards.length} 张 · targetIndex=${evidence.targetIndex}`);
  log('[result] P1–R6：');
  for (const [k, v] of Object.entries(evidence.assertions || {})) {
    log(`  ${k} ${v.pass ? 'PASS' : 'FAIL'}  ${v.detail}`);
  }
  log('[result] R3 逐站明细（卡片域内）：');
  if (evidence.r3Detail && evidence.r3Detail.stops.length) {
    for (const s of evidence.r3Detail.stops) {
      log(
        `  #${String(s.index).padEnd(2)} ${s.tag}.${s.className} rectH=${s.rectH} rectW=${s.rectW} ` +
          `centerInViewport=${s.centerInViewport} hit=${s.hitTag}.${s.hitClass}「${s.hitText}」 ` +
          `hitIsSelfOrDescendant=${s.hitIsSelfOrDescendant} hitIsAncestorOfEl=${s.hitIsAncestorOfEl} ` +
          `hitInsideToolCard=${s.hitInsideToolCard}` +
          (s.note ? ` note=${s.note}` : '')
      );
    }
  } else {
    log('  （卡片域内零停靠点）');
  }
  log(`[result] mutation：${JSON.stringify(evidence.mutation)}`);
  log(`[result] 证据 JSON → ${EVIDENCE_PATH}`);
  if (evidence.thrown) log(`[result] 异常：${evidence.thrown}`);
  log(
    evidence.assertionsPass
      ? '[result] ALL ASSERTIONS PASS'
      : '[result] ASSERTIONS FAILED'
  );

  if (LOG_PATH) {
    try {
      fs.writeFileSync(LOG_PATH, logBuffer.join('\n') + '\n');
      console.log(`[result] 完整输出 → ${LOG_PATH}`);
    } catch (e) {
      console.error('写日志失败: ' + e.message);
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
