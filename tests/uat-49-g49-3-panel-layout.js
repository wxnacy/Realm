#!/usr/bin/env node
/**
 * UAT 驱动（Phase 49 · G-49-3）—— 「AI 面板最小宽度下卡片头部标注完整可读」的真实渲染门禁。
 *
 * 用途
 * ----
 * 闭合 `49-UAT.md` 的 `G-49-3`：`--ai-panel-min-width`（280px）下，同时带来源徽标 +
 * 超预算标注的 `manage_skill` 卡片头部，标注被祖先 `.tool-card-name` 的 `overflow: hidden`
 * 裁掉右端 19px，且唯一可压缩项 `.tool-card-name-text` 被压到 0（技能名整段消失、连省略号
 * 都没有）。本驱动以**真实渲染的几何量**判定该不变式是否成立。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-49-g49-3-panel-layout.js
 *
 * 依赖全局 `playwright`（`_electron`）——只启动**本进程自己拉起的** realm-dev 子进程
 * （独立 userData `~/Library/Application Support/realm-dev/`）。收尾固定
 * `electronApp.close()` + `process.exit(0)`；**严禁** `pkill` / `pgrep` 模式匹配杀进程
 * （用户可能正在运行正式版 `/Applications/Realm.app`）。
 *
 * 为什么不能用「源码扫描 / 声明扫描」替代
 * ------------------------------------
 * 本阶段（49）已记录的教训：**子串存在 ≠ 最小宽度下布局成立**，**声明存在 ≠ 生效**。
 * 具体到本 gap：
 *   - 旧驱动的 `noteNotClipped` 判据比的是标注自身的 `scrollWidth` / `clientWidth`
 *     （实测 100 / 100 —— 标注自身永远「不裁切」），而裁切发生在**祖先**上 ⇒ 该判据是假绿；
 *   - `M14` / `M15` 只查 `.tool-card-manage-note` 基类的五条属性存在与窗口内无
 *     `overflow` / `text-overflow`，对「祖先盒子窄于内容」完全无检出力；
 *   - `A1`–`A7` 全部按**元素外接矩形与 textContent** 判定（盒子窄于文本时字形画到盒外，
 *     矩形判据看不见）；因此「CSS 声明零改动」这条约束由 `A9`（全轮**声明投影** sha 相等，
 *     能检出任意位置的声明改动）+ `<verify>` 的 `css-decl-freeze` 门禁共同承担。
 *
 * 断言非恒真的自证
 * --------------
 * 执行顺序固定为「先写驱动 → 在**未修复的当前树**上跑出红证据（`/tmp/uat49/g49-3-red.log`，
 * A1/A2/A3 为红）→ 再改源码 → 重跑得绿」。红轮缺失即视为判据未成立。
 *
 * 脚本命名
 * -------
 * 文件名以 `uat-` 开头 ⇒ **永不被** `test-*.js` 类套件（`node --test tests/`、`npm test` 等）
 * 拾取；它只在需要真实渲染时手工/受控运行。
 *
 * 产物（**不覆盖** UAT 已引用的 `evidence3.json` 与 `uat49-t3-*.png`）
 * ---------------------------------------------------------------
 *   /tmp/uat49/evidence-g49-3.json      四档完整几何量 + 全轮 cssDeclProjection sha + preflight
 *   /tmp/uat49/g49-3-card-280.png       280px 档目标卡片（元素级）
 *   /tmp/uat49/g49-3-card-520.png       520px 档目标卡片（对照）
 *   /tmp/uat49/g49-3-window-280.png     280px 档窗口级
 *   /tmp/uat49/g49-3-zoom-280-header.png 280px 档头部 4× 放大（magick）
 *
 * 退出码：全部断言通过 → 0；任一条失败 → 非零（并在输出尾部打印逐条布尔表）。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/tmp/uat49';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-g49-3.json');
const CSS_PATH = path.join(REPO_ROOT, 'src', 'styles', 'main.css');
const MANAGED_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'realm-dev',
  'agent-workspace',
  'managed-skills'
);
/**
 * 本仓自带的 Electron 可执行文件（`node_modules/electron` 的导出即二进制路径）。
 * playwright 装在**全局**（`NODE_PATH="$(npm root -g)"`），它自身找不到本仓的 electron，
 * 故必须显式传 `executablePath` —— 否则 launch 直接以 "Electron executablePath not found!" 失败。
 */
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));

/** 采集档位（面板宽度，px）——260 档用于证明 280 的下限钳制 */
const ROUNDS = [520, 420, 280, 260];
/** 复用路径最多尝试切换多少个历史对话（目标会话是最近一次 UAT 运行产生的，通常在首位） */
const MAX_CONV_SWITCH = 12;
/** 兜底真实 LLM 往返的等待上限（ms） */
const LLM_TIMEOUT_MS = 240000;
/** 几何量比较容差（px） */
const EPS = 0.5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/**
 * `src/styles/main.css` 的**声明投影**：整体剔除 `/* … *\/` 注释后的文本。
 * 只动注释 ⇒ 投影逐字不变 ⇒ sha 相等；改动任意声明（含 `.tool-card-header` /
 * `.tool-card-name-text` 等其它规则块）⇒ sha 变化。这是「CSS 声明零改动」的可核对面之一。
 * @returns {string} sha256 十六进制
 */
function cssDeclProjectionSha() {
  const text = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 第 0 步 · 前置自检（在任何启动动作之前逐条判定，各带独立失败码）
 * - `E-PW`   全局 playwright / `_electron` 不可得 → 硬退出（需 NODE_PATH="$(npm root -g)"）
 * - `E-KEY`  `XIAOMI_API_KEY` 未设 → **warning**（仅兜底路径需要），走到兜底再以该码退出
 * - `E-DATA` managed-skills 下的预算占位技能缺失 → **硬退出**（缺了它目标卡片必然不可得，
 *            此时任何「全绿」都是假绿）
 * @returns {{preflight: object, dataOk: boolean, keyOk: boolean, pwOk: boolean}}
 */
function preflight() {
  const pf = {};

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

  const keyOk = typeof process.env.XIAOMI_API_KEY === 'string' && process.env.XIAOMI_API_KEY.length > 0;
  pf['E-KEY'] = {
    ok: keyOk,
    detail: keyOk
      ? `XIAOMI_API_KEY 已设置（len=${process.env.XIAOMI_API_KEY.length}）；仅兜底路径（真实 LLM 往返）需要`
      : 'XIAOMI_API_KEY 未设 —— 复用路径可用时不影响；兜底路径会以 E-KEY 退出',
    fatal: false,
  };

  let names = [];
  let readErr = '';
  try {
    names = fs.readdirSync(MANAGED_DIR);
  } catch (err) {
    readErr = err.message;
  }
  const hasCommitStyle = names.includes('commit-style');
  const budgetCount = names.filter((n) => /^aa-budget-\d+$/.test(n)).length;
  const dataOk = hasCommitStyle && budgetCount >= 14;
  pf['E-DATA'] = {
    ok: dataOk,
    detail: readErr
      ? `读取 ${MANAGED_DIR} 失败: ${readErr}`
      : `commit-style=${hasCommitStyle} · aa-budget-*=${budgetCount}/14（这两项是把 commit-style 推入 promptOmitted 的唯一前提）`,
    fatal: true,
  };

  return { preflight: pf, dataOk, keyOk, pwOk };
}

/**
 * 写出证据 JSON（每次运行前/后各写一次 —— 前置自检结果必须先落盘）。
 * @param {object} evidence
 */
function writeEvidence(evidence) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
}

/**
 * 在页面内测量目标卡片的几何量（**唯一有效判据来源**）。
 * @param {string} noteSel - 标注选择器（`-limit` 或 `-error`）
 * @returns {object|null}
 */
function measureInPage(noteSel) {
  const card = Array.from(document.querySelectorAll('.tool-card')).find(
    (c) => c.querySelector(noteSel) !== null
  );
  if (!card) return null;
  const header = card.querySelector('.tool-card-header');
  const nameWrap = card.querySelector('.tool-card-name.tool-card-name-skill');
  const nameText = card.querySelector('.tool-card-name-text');
  const badge = card.querySelector('.slash-picker-source-badge');
  const note = card.querySelector(noteSel);
  const status = card.querySelector('.tool-card-status');
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  };
  const noteClass = note.className;
  const list = document.getElementById('aiMessageList');
  const bubble = card.closest('.ai-message-content');
  return {
    panelWidth: document.getElementById('aiPanel').offsetWidth,
    cardWidth: card.getBoundingClientRect().width,
    // 容器宽度的上下文（2026-09-13 UAT 实测 `.tool-card-name` clientWidth = 129，
    // 本次复跑为 136 —— 差 7px 来自气泡可用宽，记录来源以便逐项核对而非猜）
    geometryContext: {
      windowInnerWidth: window.innerWidth,
      docClientWidth: document.documentElement.clientWidth,
      messageListClientWidth: list ? list.clientWidth : null,
      messageListScrollWidth: list ? list.scrollWidth : null,
      messageListOffsetWidth: list ? list.offsetWidth : null,
      bubbleWidth: bubble ? Math.round(bubble.getBoundingClientRect().width) : null,
    },
    header: {
      offsetHeight: header.offsetHeight,
      scrollHeight: header.scrollHeight,
      clientHeight: header.clientHeight,
      rect: rect(header),
    },
    nameWrap: {
      scrollWidth: nameWrap.scrollWidth,
      clientWidth: nameWrap.clientWidth,
      rect: rect(nameWrap),
    },
    nameText: {
      scrollWidth: nameText.scrollWidth,
      clientWidth: nameText.clientWidth,
      rect: rect(nameText),
    },
    badge: badge
      ? {
          scrollWidth: badge.scrollWidth,
          clientWidth: badge.clientWidth,
          rect: rect(badge),
          textContent: badge.textContent,
          className: badge.className,
        }
      : null,
    note: {
      scrollWidth: note.scrollWidth,
      clientWidth: note.clientWidth,
      rect: rect(note),
      textContent: note.textContent,
      className: noteClass,
    },
    statusText: status ? status.textContent : null,
  };
}

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pf = preflight();
  if (!pf.pwOk) {
    writeEvidence({
      driver: 'tests/uat-49-g49-3-panel-layout.js',
      started,
      preflight: pf.preflight,
      aborted: 'E-PW',
    });
    console.error('E-PW 全局 playwright / _electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }
  if (!pf.dataOk) {
    writeEvidence({
      driver: 'tests/uat-49-g49-3-panel-layout.js',
      started,
      preflight: pf.preflight,
      aborted: 'E-DATA',
    });
    console.error('E-DATA ' + pf.preflight['E-DATA'].detail);
    console.error('E-DATA 目标卡片必然不可得 —— 拒绝在缺前提的树上判绿');
    process.exit(12);
  }
  log('[preflight] E-PW', pf.preflight['E-PW'].ok, '| E-KEY', pf.preflight['E-KEY'].ok, '| E-DATA', pf.preflight['E-DATA'].ok);
  log('[preflight]', pf.preflight['E-DATA'].detail);

  // A9 的红轮基准：首次运行即「改源码之前」，此后各轮把它原样带过来做比较
  let priorRed = null;
  try {
    const prior = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
    if (prior && Array.isArray(prior.cssDeclProjection)) {
      priorRed = prior.cssDeclProjection.find((e) => e.round === 'red') || null;
    }
  } catch (_) {
    priorRed = null;
  }
  const shaAtStart = cssDeclProjectionSha();
  const redRecord = priorRed
    ? { round: 'red', sha: priorRed.sha, note: 'carried forward from the pre-fix run（红轮，改源码之前）' }
    : { round: 'red', sha: shaAtStart, note: '本次运行的起始投影（首次运行 = 未修复的当前树）' };

  const { _electron: electronLauncher } = require('playwright');
  const mainLog = [];
  const pageErrors = [];
  let electronApp = null;
  /** @type {import('playwright').Page|null} */
  let page = null;
  let exitCode = 1;
  /** 面板四档实测宽度（拖拽目标 → 实得）；在 try 外声明以便输出段使用 */
  let panelWidths = {};

  const evidence = {
    driver: 'tests/uat-49-g49-3-panel-layout.js',
    started,
    finished: null,
    repo: REPO_ROOT,
    node: process.version,
    preflight: pf.preflight,
    targetConversation: null,
    sourcePath: null,
    rounds: [],
    cssDeclProjection: [redRecord],
    errorNoteCovered: false,
    errorNoteRounds: [],
    assertions: {},
    assertionsPass: false,
    screenshots: {},
    zoom: null,
    pageErrors,
    mainLogTail: [],
  };

  try {
    electronApp = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
      timeout: 60000,
    });
    const proc = electronApp.process();
    if (proc) {
      const push = (d) => {
        String(d)
          .split('\n')
          .forEach((l) => {
            if (l.trim()) mainLog.push(l);
          });
      };
      if (proc.stdout) proc.stdout.on('data', push);
      if (proc.stderr) proc.stderr.on('data', push);
    }

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
    await page.waitForSelector('#aiPanelResizeHandle', { state: 'visible', timeout: 10000 });

    /**
     * 目标卡片是否已渲染（含终态）
     * @returns {Promise<boolean>}
     */
    const hasTargetCard = () =>
      page.evaluate(() => {
        const card = Array.from(document.querySelectorAll('.tool-card')).find(
          (c) => c.querySelector('.tool-card-manage-note-limit') !== null
        );
        return !!card;
      });

    const dropOpen = () =>
      page.$eval('#aiConvDropdown', (el) => getComputedStyle(el).display !== 'none');

    // ---- 定位目标卡片：优先复用已持久化的会话（真实链路：切换对话 → 重载卡片）----
    if (!(await hasTargetCard())) {
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
          log(`[locate] 复用路径命中：对话 ${id}`);
          break;
        }
      }
    } else {
      evidence.sourcePath = 'reuse';
      evidence.targetConversation = '(already-rendered)';
      log('[locate] 当前已渲染的会话中即含目标卡片（复用路径命中）');
    }

    // ---- 兜底（复用时找不到才走）：真实 LLM 往返，要求模型用 manage_skill 更新 commit-style ----
    if (evidence.sourcePath === null) {
      if (!pf.keyOk) {
        console.error('E-KEY 复用路径未命中目标卡片，且 XIAOMI_API_KEY 未设 —— 无法走兜底真实 LLM 往返');
        evidence.errored = 'E-KEY';
        exitCode = 13;
        throw new Error('E-KEY');
      }
      log('[locate] 复用路径未命中 → 走真实 LLM 兜底（manage_skill 更新 commit-style）');
      await page.click('#aiInput');
      await page.fill(
        '#aiInput',
        '请使用 manage_skill 工具更新 commit-style 技能，把它的 description 改成：当需要撰写符合 Conventional Commits 规范的 git 提交信息时使用此技能。'
      );
      await sleep(200);
      await page.keyboard.press('Enter');
      const llmDeadline = Date.now() + LLM_TIMEOUT_MS;
      let hit = false;
      while (Date.now() < llmDeadline) {
        await sleep(2000);
        hit = await page.evaluate(() => {
          const card = Array.from(document.querySelectorAll('.tool-card')).find(
            (c) => c.querySelector('.tool-card-manage-note-limit') !== null
          );
          if (!card) return false;
          const st = card.querySelector('.tool-card-status');
          return !!st && st.textContent === '完成';
        });
        if (hit) break;
      }
      if (!hit) {
        console.error('目标卡片不可得：复用路径（已尝试前 ' + MAX_CONV_SWITCH + ' 个历史对话）与兜底真实 LLM 往返均未产出带 -limit 标注的 manage_skill 卡片');
        evidence.errored = 'target-card-unavailable';
        exitCode = 14;
        throw new Error('target-card-unavailable');
      }
      evidence.sourcePath = 'llm';
      log('[locate] 兜底路径命中：真实 LLM 往返产出了目标卡片');
    }

    // ---- 目标卡片的前置断言（状态 / 徽标 / 标注计数）----
    const pre = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('.tool-card')).find(
        (c) => c.querySelector('.tool-card-manage-note-limit') !== null
      );
      const status = card.querySelector('.tool-card-status');
      const badge = card.querySelector('.slash-picker-source-badge');
      return {
        statusText: status ? status.textContent : null,
        badgeText: badge ? badge.textContent : null,
        noteCount: card.querySelectorAll('.tool-card-manage-note').length,
      };
    });
    log('[locate] 目标卡片前置断言：', JSON.stringify(pre));
    if (pre.statusText !== '完成' || pre.badgeText !== '托管' || pre.noteCount !== 1) {
      throw new Error(
        `目标卡片前置断言不成立（需要 完成 / 托管 / 恰 1 个标注，实得 ${JSON.stringify(pre)}）`
      );
    }

    // ---- 真实拖拽 resize handle（每次拖拽前**重新取** boundingBox）----
    const dragPanelTo = async (target) => {
      const handle = page.locator('#aiPanelResizeHandle');
      const box = await handle.boundingBox();
      if (!box) throw new Error('resize handle 无 boundingBox');
      const startWidth = await page.$eval('#aiPanel', (el) => el.offsetWidth);
      const startX = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + Math.min(box.height / 2, 300));
      const dx = -(target - startWidth);
      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(startX + dx, y, { steps: 12 });
      await page.mouse.up();
      await sleep(250);
      const actual = await page.$eval('#aiPanel', (el) => el.offsetWidth);
      log(`[drag] →${target} 实得宽度=${actual}（起始 ${startWidth}）`);
      return actual;
    };

    const cardLocator = page.locator('.tool-card:has(.tool-card-manage-note-limit)').first();
    panelWidths = {};

    for (const round of ROUNDS) {
      const actual = await dragPanelTo(round);
      panelWidths[round] = actual;

      // 目标卡片滚入视口后测量（滚动只影响视口位置，不影响布局尺寸）
      await page
        .evaluate(() => {
          const card = Array.from(document.querySelectorAll('.tool-card')).find(
            (c) => c.querySelector('.tool-card-manage-note-limit') !== null
          );
          if (card) card.scrollIntoView({ block: 'center' });
        })
        .catch(() => {});
      await sleep(200);

      const m = await page.evaluate(measureInPage, '.tool-card-manage-note-limit');
      if (!m) throw new Error(`第 ${round}px 档：目标卡片消失`);
      m.round = round;
      m.expectedWidth = round;
      m.actualPanelWidth = actual;
      evidence.rounds.push(m);

      const sha = cssDeclProjectionSha();
      evidence.cssDeclProjection.push({ round, sha });

      // A8（条件性）：同一渲染下若存在带 -error 标注的**真实**失败卡片，一并判 A1/A2
      const em = await page
        .evaluate(measureInPage, '.tool-card-manage-note-error')
        .catch(() => null);
      if (em) {
        evidence.errorNoteCovered = true;
        em.round = round;
        evidence.errorNoteRounds.push(em);
      }

      if (round === 520) {
        try {
          await cardLocator.screenshot({ path: path.join(OUT_DIR, 'g49-3-card-520.png') });
          evidence.screenshots.card520 = path.join(OUT_DIR, 'g49-3-card-520.png');
        } catch (e) {
          evidence.screenshots.card520Error = e.message;
        }
      }
      if (round === 280) {
        try {
          await cardLocator.screenshot({ path: path.join(OUT_DIR, 'g49-3-card-280.png') });
          await page.screenshot({ path: path.join(OUT_DIR, 'g49-3-window-280.png') });
          evidence.screenshots.card280 = path.join(OUT_DIR, 'g49-3-card-280.png');
          evidence.screenshots.window280 = path.join(OUT_DIR, 'g49-3-window-280.png');
          const headerPng = path.join(OUT_DIR, 'g49-3-header-280.png');
          await page
            .locator('.tool-card:has(.tool-card-manage-note-limit) .tool-card-header')
            .first()
            .screenshot({ path: headerPng });
          execFileSync(
            '/opt/homebrew/bin/magick',
            [headerPng, '-resize', '400%', path.join(OUT_DIR, 'g49-3-zoom-280-header.png')],
            { stdio: 'ignore' }
          );
          evidence.zoom = path.join(OUT_DIR, 'g49-3-zoom-280-header.png');
        } catch (e) {
          evidence.zoom = 'failed: ' + e.message;
        }
      }
      log(
        `[measure:${round}] panel=${m.panelWidth} card=${Math.round(m.cardWidth)} ` +
          `nameWrap=${m.nameWrap.clientWidth}/${m.nameWrap.scrollWidth} ` +
          `nameText=${m.nameText.clientWidth} badge=${m.badge ? m.badge.clientWidth : '-'} ` +
          `note=${m.note.clientWidth} text=${JSON.stringify(m.note.textContent)}`
      );
    }

    // ---------------- 断言集（0.5px 容差；A1–A3 在 280px 档判定）----------------
    const at = (w) => evidence.rounds.find((r) => r.round === w);
    const r280 = at(280);
    const r520 = at(520);
    const assertions = {};

    const noteOverflowPx = r280.nameWrap.rect.right - r280.note.rect.right; // >0 ⇒ 越界
    assertions.A1 = {
      pass: r280.note.rect.right <= r280.nameWrap.rect.right + EPS,
      detail: `标注右缘 ${r280.note.rect.right.toFixed(2)} vs 裁切祖先右缘 ${r280.nameWrap.rect.right.toFixed(2)}（越界 ${(-noteOverflowPx).toFixed(2)}px）`,
    };
    assertions.A2 = {
      pass: r280.nameWrap.scrollWidth <= r280.nameWrap.clientWidth,
      detail: `祖先 scrollWidth ${r280.nameWrap.scrollWidth} <= clientWidth ${r280.nameWrap.clientWidth}`,
    };
    assertions.A3 = {
      pass: r280.nameText.clientWidth > 0,
      detail: `技能名文本 clientWidth = ${r280.nameText.clientWidth}（>0 才可能有省略号）`,
    };
    assertions.A4 = {
      pass:
        r280.header.offsetHeight === 36 &&
        r520.header.offsetHeight === 36 &&
        r280.header.scrollHeight <= r280.header.clientHeight,
      detail: `头部高 520=${r520.header.offsetHeight} / 280=${r280.header.offsetHeight}；280 档 scrollHeight ${r280.header.scrollHeight} <= clientHeight ${r280.header.clientHeight}`,
    };
    assertions.A5 = {
      pass:
        r280.badge !== null &&
        r280.badge.scrollWidth <= r280.badge.clientWidth &&
        r280.badge.rect.right <= r280.nameWrap.rect.right + EPS,
      detail: r280.badge
        ? `徽标「${r280.badge.textContent}」scrollWidth ${r280.badge.scrollWidth} <= clientWidth ${r280.badge.clientWidth}；右缘 ${r280.badge.rect.right.toFixed(2)} <= ${(r280.nameWrap.rect.right + EPS).toFixed(2)}`
        : '未找到徽标',
    };
    assertions.A6 = {
      pass:
        r280.note.textContent === '超预算' &&
        r280.note.className.includes('tool-card-manage-note-limit'),
      detail: `标注 textContent=${JSON.stringify(r280.note.textContent)}（期望 "超预算"）· className=${JSON.stringify(r280.note.className)}`,
    };
    assertions.A7 = {
      pass: panelWidths[260] === 280 && panelWidths[280] === 280,
      detail: `拖到 260 → 实得 ${panelWidths[260]}（期望 280）；拖到 280 → 实得 ${panelWidths[280]}`,
    };
    const err280 = evidence.errorNoteRounds.find((r) => r.round === 280);
    assertions.A8 = err280
      ? {
          pass:
            err280.note.rect.right <= err280.nameWrap.rect.right + EPS &&
            err280.nameWrap.scrollWidth <= err280.nameWrap.clientWidth,
          detail: `失败卡片（-error）280 档：标注右缘 ${err280.note.rect.right.toFixed(2)} <= ${err280.nameWrap.rect.right.toFixed(2)}；祖先 ${err280.nameWrap.scrollWidth} <= ${err280.nameWrap.clientWidth}`,
          covered: true,
        }
      : {
          pass: true,
          detail: 'errorNoteCovered: false —— 未定位到带 -error 标注的真实失败卡片（如实记录未覆盖，不用合成 DOM 节点代替）',
          covered: false,
        };
    const shas = evidence.cssDeclProjection.map((e) => e.sha);
    assertions.A9 = {
      pass: shas.every((s) => s === shas[0]),
      detail: `cssDeclProjection 全轮 sha ${shas.every((s) => s === shas[0]) ? '相等' : '不等'}：${evidence.cssDeclProjection
        .map((e) => `${e.round}=${e.sha.slice(0, 12)}`)
        .join(' ')}`,
    };

    evidence.assertions = assertions;
    evidence.assertionsPass = Object.values(assertions).every((a) => a.pass);
    evidence.roundWidths = panelWidths;
    evidence.arithmetic = {
      panelWidth: r280.panelWidth,
      cardWidth: Math.round(r280.cardWidth),
      nameWrapClientWidth: r280.nameWrap.clientWidth,
      badgeWidth: r280.badge ? r280.badge.clientWidth : null,
      noteWidthMeasured: r280.note.clientWidth,
      sum: (r280.badge ? r280.badge.clientWidth : 0) + 8 + r280.note.clientWidth + 8,
      fits: (r280.badge ? r280.badge.clientWidth : 0) + 8 + r280.note.clientWidth + 8 <= r280.nameWrap.clientWidth,
    };
  } catch (err) {
    evidence.thrown = String(err && err.message ? err.message : err);
    if (!evidence.errored) {
      log('[error]', evidence.thrown);
    }
  } finally {
    evidence.finished = new Date().toISOString();
    evidence.mainLogTail = mainLog.slice(-25);
    if (exitCode === 1) exitCode = evidence.assertionsPass ? 0 : 1;
    evidence.exitCode = exitCode;
    try {
      writeEvidence(evidence);
    } catch (e) {
      console.error('写证据 JSON 失败:', e.message);
    }
    if (electronApp) {
      try {
        await Promise.race([electronApp.close(), sleep(6000)]);
      } catch (e) {
        console.error('electronApp.close() 失败:', e.message);
      }
    }
  }

  // ---------------- 输出 ----------------
  log('');
  log('[result] 面板四档实测宽度：', JSON.stringify(evidence.roundWidths || panelWidths));
  log('[result] A1–A9：');
  for (const [k, v] of Object.entries(evidence.assertions || {})) {
    log(`  ${k} ${v.pass ? 'PASS' : 'FAIL'}  ${v.detail}`);
  }
  log('[result] cssDeclProjection：');
  for (const e of evidence.cssDeclProjection) {
    log(`  ${String(e.round).padEnd(5)} ${e.sha}${e.note ? '  # ' + e.note : ''}`);
  }
  log('[result] 来源路径：', evidence.sourcePath, '· 目标会话：', evidence.targetConversation);
  log('[result] errorNoteCovered：', evidence.errorNoteCovered);
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(
    evidence.assertionsPass
      ? '[result] ALL ASSERTIONS PASS'
      : '[result] ASSERTIONS FAILED'
  );

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
