#!/usr/bin/env node
/**
 * UAT 驱动（Phase 51 · 多尺寸档布局）—— 把 `51-UAT.md` 的 Test 4 从人工面自动化。
 *
 * 被测检查点
 * ----------
 * 「在设置页真实 CSP 下换**极窄 / 超宽**窗口复核预览弹框（目录树折叠、脚本标红、必勾、
 *   冲突三选一）⇒ 各尺寸档下弹框总高 ≤ 80vh、滚动只在预览区、动作区不横向溢出、
 *   按钮不被裁切。」
 *
 * `51-UAT.md` 原文记「52 项断言已在**单一**尺寸档实测通过，其余尺寸档未逐一取数」——
 * 本驱动把这份残余人工面补成**尺寸矩阵**：同一形态在 5 个窗口档下各取一次数。
 *
 * 判据在每一档下逐条独立判定（某一档红**不**掩盖其余档）：
 *   ① 弹框总高 ≤ `0.8 × guest innerHeight`（正命题 + 前提 `display !== none` 与非零高）；
 *   ② 滚动**只**发生在预览区：对预览置 `scrollTop` 后变大，且 `document.scrollingElement.scrollTop`
 *      **不变**；弹框内可滚动容器候选集**恰为** `{skillImportPreview}`；
 *   ③ 动作区不横向溢出（`scrollWidth <= clientWidth`）；两按钮同排、互不重叠、宽度 > 0、
 *      `right <= innerWidth`（不被裁切）；
 *   ④ 禁用原因文本可见（`height > 0` 且非空）且位于按钮排**上方**；
 *   ⑤ 四类必现元素齐备：目录树展开开关、脚本标红行、必勾区、冲突三选一（3 个 radio）。
 *
 * 反恒真（**本驱动的核心纪律**）
 * ----------------------------
 * 「多尺寸档」若各档实际拿到的 `innerWidth` 相同，整张矩阵就是**同一个尺寸测了 5 次**。
 * 故驱动**断言各档实测 `innerWidth` 至少有 3 个互不相同的取值**，并把逐档实测值写进证据。
 * 另：所有几何断言前先确认弹框**不在 `display:none`**（否则 rect 全 0 ⇒ 「0 vs 0 全等」假绿）。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js
 *
 * ⚠ 本驱动会**临时写入** realm-dev userData：`agent-workspace/skills/zzq51-size-probe/`
 * （构造冲突面）。开跑前与收尾都清一次；中断后人工复查：
 *     ls ~/Library/Application\ Support/realm-dev/agent-workspace/skills | grep zzq51
 *
 * 产物：`tests/.uat-out/uat-51-import-modal-sizes.json`
 * 退出码：全通过 → 0；任一条失败 → 非零（11 = 缺全局 playwright / 12 = 仓内无 Electron）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tests', '.uat-out');
const EVIDENCE_PATH = path.join(OUT_DIR, 'uat-51-import-modal-sizes.json');

const HOME = process.env.HOME;
const APP_SUPPORT = path.join(HOME, 'Library', 'Application Support', 'realm-dev');
const WORKSPACE = path.join(APP_SUPPORT, 'agent-workspace');
const USER_SKILLS_DIR = path.join(WORKSPACE, 'skills');
const TMP_DIR = path.join(WORKSPACE, '.tmp');

const makeZip = require('./helpers/make-malicious-zip');

/** 冲突探针技能名（不是内置技能名 ⇒ 冲突档为 `user`） */
const PROBE_NAME = 'zzq51-size-probe';
/** > `IMPORT_LIMITS.PREVIEW_LIST_LIMIT`(50) ⇒ 目录树一定出现「展开全部」折叠 */
const EXTRA_ENTRIES = 60;

/**
 * 尺寸矩阵：按**目标 guest 内容宽**定义（极窄 → 超宽）
 *
 * ⚠ 不能把「窗口尺寸」直接当「内容尺寸」：主窗口里侧栏（+ 可能还开着 AI 侧栏）会占宽，
 * 实测把窗口设成 480 时 guest 只拿到 **0**（被侧栏全吃掉）。故驱动先做一次**自标定**
 * （设一个已知尺寸 → 量 guest 实际内容宽 → 求偏移），再按目标内容宽反推请求尺寸。
 * 断言一律以**实测内容宽**为准，不以请求值为准。
 */
const TARGET_SIZES = [
  { label: '极窄', contentW: 420, contentH: 620 },
  { label: '窄', contentW: 600, contentH: 700 },
  { label: '基线', contentW: 880, contentH: 820 },
  { label: '宽', contentW: 1280, contentH: 900 },
  { label: '超宽', contentW: 1920, contentH: 1080 },
];

/** 标定用的已知窗口尺寸（足够大以避免被应用最小尺寸钳制而污染偏移估计） */
const CALIBRATION_WINDOW = { w: 1400, h: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: String(detail == null ? '' : detail) });
  log(`  [${pass ? 'ok' : '!!'}] ${name} — ${detail}`);
  return !!pass;
}

/**
 * 列出本机正在跑的 Electron 实例 PID（**只读探测**，不做任何杀进程）
 *
 * 本仓的 `realm-dev` userData 是**单例语义**：并存的第二个实例会与当前驱动共用同一份
 * 设置页 / 配置 / 技能目录。实测证据（2026-09-15）：一次驱动退出后留下的**孤儿实例**
 * 使随后一轮的「设置页 guest 被重新初始化」，表现为超限（413）用例间歇转红
 * （6 次实跑 1 红，红轮指纹 ≡ `location.reload()` 后态）。
 * 故驱动必须在开跑前登记这个数、收尾后再核对一次。
 */
function listElectronInstances() {
  try {
    const out = require('child_process').execSync(
      "ps -eo pid=,ppid=,command= | grep 'electron/dist/Electron.app/Contents/MacOS/Electron' | grep -v grep || true",
      { encoding: 'utf8' }
    );
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\d+)\s+(.*)$/);
        return m
          ? { pid: Number(m[1]), ppid: Number(m[2]), command: m[3].slice(0, 180) }
          : { raw: l.slice(0, 180) };
      });
  } catch (_e) {
    return null;
  }
}

/** PID 是否仍存活（`kill(pid, 0)` 不发信号，只做存在性探测） */
function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

function writeEvidence(ev) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(ev, null, 2) + '\n');
}

function removeDirIfAny(p) {
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      return 'removed';
    }
    return 'absent';
  } catch (e) {
    return `failed(${e.message})`;
  }
}

function listImportResidue() {
  try {
    return fs.readdirSync(TMP_DIR).filter((n) => n.startsWith('skill-import-') || n.startsWith('skill-replace-'));
  } catch (_e) {
    return [];
  }
}

/** 确定性伪随机内容（高熵 ⇒ 不触发压缩比闸） */
function pseudoRandom(len, seed) {
  let x = seed >>> 0;
  let out = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while (out.length < len) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += alphabet[x % alphabet.length];
  }
  return out.slice(0, len);
}

/** 现场生成「宽」合法单技能包：> 50 条目 + 一条脚本 + 一条启发式命中 ⇒ 四类元素齐备 */
function buildWidePackage(name) {
  const skillMd =
    `---\nname: ${name}\ndescription: 弹框多尺寸档 UAT 探针\nallowed-tools: Bash, Read\n---\n\n# probe\n\n` +
    'rsync -avz ./dist/ deploy@example.com:/srv/www\n';
  const entries = [
    { name: 'SKILL.md', data: skillMd },
    { name: 'scripts/run.sh', data: pseudoRandom(150, 999) },
  ];
  for (let i = 0; i < EXTRA_ENTRIES; i += 1) {
    entries.push({ name: `data/f${String(i).padStart(3, '0')}.txt`, data: pseudoRandom(180, i + 7) });
  }
  return makeZip.buildZip({ entries });
}

async function guestEval(page, src) {
  return page.evaluate(async (code) => {
    const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
      try {
        return w.getURL().indexOf('/settings') !== -1;
      } catch (_e) {
        return false;
      }
    });
    if (!wv) throw new Error('no settings webview');
    return wv.executeJavaScript(code);
  }, src);
}

async function guestWaitFor(page, expr, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await guestEval(
        page,
        `(function(){ try { return !!(${expr}); } catch (e) { return 'threw: ' + e.message; } })()`
      );
    } catch (e) {
      last = 'not-ready: ' + (e && e.message ? e.message : e);
    }
    if (last === true) return true;
    await sleep(300);
  }
  throw new Error(`等待超时（${label}）：最后取值 = ${JSON.stringify(last)}`);
}

/** 把 zip 字节注入隐藏 file input 并触发 change（**不使用反引号**） */
function injectFileScript(b64, fileName) {
  return (
    '(function(){' +
    "  var bin = atob('" + b64 + "');" +
    '  var arr = new Uint8Array(bin.length);' +
    '  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);' +
    "  var f = new File([arr], '" + fileName + "', { type: 'application/zip' });" +
    "  var input = document.getElementById('skillImportFile');" +
    '  var dt = new DataTransfer();' +
    '  dt.items.add(f);' +
    '  input.files = dt.files;' +
    "  input.dispatchEvent(new Event('change', { bubbles: true }));" +
    "  return 'dispatched';" +
    '})()'
  );
}

/** 造出「最宽形态」：必勾未勾（原因文本最长）+ 冲突已选 + 目录树展开 */
const WIDEST_STATE_SRC =
  '(function(){' +
  "  var box = document.querySelector('#skillImportAck input[type=checkbox]');" +
  "  if (box) { box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); }" +
  "  var r = document.querySelector('#skillImportConflict input[type=radio][value=overwrite]');" +
  "  if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }" +
  "  var box2 = document.querySelector('#skillImportAck input[type=checkbox]');" +
  "  if (box2) { box2.checked = false; box2.dispatchEvent(new Event('change', { bubbles: true })); }" +
  "  var t = document.getElementById('skillImportTreeToggle');" +
  '  if (t) t.click();' +
  "  return { toggled: !!t, gate: (document.getElementById('skillImportGate') || {}).textContent };" +
  '})()';

/** 一档尺寸下的全量几何读数 */
const MEASURE_SRC =
  '(function(){' +
  "  var modal = document.getElementById('skillImportModal');" +
  "  var box = document.querySelector('#skillImportModal .ai-modal');" +
  "  var preview = document.getElementById('skillImportPreview');" +
  "  var actions = document.querySelector('.skill-import-actions');" +
  "  var gate = document.getElementById('skillImportGate');" +
  "  if (!modal || !box || !preview || !actions) return { fatal: 'missing-node' };" +
  '  var bRec = box.getBoundingClientRect();' +
  '  var aRec = actions.getBoundingClientRect();' +
  "  var btns = Array.from(actions.querySelectorAll('button'));" +
  '  var rects = btns.map(function(b){ var r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height, left: r.left, right: r.right, top: r.top }; });' +
  /* ⚠ 必须先归零再置底：上一次测量会把 scrollTop 留在最大值，直接读「当前值」会让
     「置底后变大」这一条在**第二档起恒红**（实测：before=after=1800）。 */
  // ⚠ 上面这段说明**留在 Node 侧**：guest 源码由无换行的单引号片段拼成，
  //    跨行块注释会截断字符串（实测 SyntaxError）。
  '  preview.scrollTop = 0;' +
  '  void preview.offsetHeight;' +
  '  var before = preview.scrollTop;' +
  "  var pageBefore = document.scrollingElement ? document.scrollingElement.scrollTop : -1;" +
  '  preview.scrollTop = preview.scrollHeight;' +
  '  void preview.offsetHeight;' +
  '  var after = preview.scrollTop;' +
  "  var pageAfter = document.scrollingElement ? document.scrollingElement.scrollTop : -1;" +
  "  var candidates = Array.from(box.querySelectorAll('*')).filter(function(el){" +
  '    var cs = getComputedStyle(el);' +
  "    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;" +
  "  }).map(function(el){ return el.id || el.className; });" +
  '  return {' +
  '    modalDisplay: getComputedStyle(modal).display,' +
  '    innerWidth: window.innerWidth,' +
  '    innerHeight: window.innerHeight,' +
  '    modalWidth: bRec.width, modalHeight: bRec.height,' +
  '    modalScrollWidth: box.scrollWidth, modalClientWidth: box.clientWidth,' +
  '    previewScrollBefore: before, previewScrollAfter: after,' +
  '    previewScrollHeight: preview.scrollHeight, previewClientHeight: preview.clientHeight,' +
  '    pageScrollBefore: pageBefore, pageScrollAfter: pageAfter,' +
  '    scrollableCandidates: candidates,' +
  '    actionsDisplay: getComputedStyle(actions).display,' +
  '    actionsScrollWidth: actions.scrollWidth, actionsClientWidth: actions.clientWidth,' +
  '    actionsLeft: aRec.left, actionsRight: aRec.right,' +
  '    buttonCount: btns.length, buttons: rects,' +
  '    sameRow: rects.length === 2 ? Math.abs(rects[0].top - rects[1].top) <= 1 : false,' +
  '    overlap: rects.length === 2 ? rects[0].right > rects[1].left + 0.5 : false,' +
  '    gateText: gate ? gate.textContent : null,' +
  '    gateHeight: gate ? gate.getBoundingClientRect().height : -1,' +
  '    gateAboveButtons: gate && rects.length ? gate.getBoundingClientRect().top <= rects[0].top : false,' +
  "    treeToggle: !!document.getElementById('skillImportTreeToggle')," +
  "    treeRows: preview.querySelectorAll('.skill-import-tree-row').length," +
  "    scriptRows: preview.querySelectorAll('.skill-import-script-path').length," +
  "    ackChildren: document.getElementById('skillImportAck').childElementCount," +
  "    conflictChoices: Array.from(document.querySelectorAll('#skillImportConflict input[type=radio]')).map(function(x){ return x.value; }).join(',')" +
  '  };' +
  '})()';

async function main() {
  const started = new Date().toISOString();
  const evidence = {
    driver: 'tests/uat-51-import-modal-sizes.js',
    covers: ['UAT-51-test-4'],
    started,
    finished: null,
    node: process.version,
    targetSizes: TARGET_SIZES,
    sizeMatrix: [],
    perSize: [],
    artifacts: {},
    assertions: results,
    cleanup: {},
    exitCode: null,
  };

  log('=== 前置清理 ===');
  evidence.cleanup.instancesBefore = listElectronInstances();
  evidence.cleanup.preProbeSkill = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
  evidence.cleanup.preTmpResidue = listImportResidue();

  let pwOk = false;
  try {
    pwOk = !!require('playwright')._electron;
  } catch (err) {
    console.error('E-PW require("playwright") 失败:', err.message);
    console.error('请用 NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal-sizes.js 运行');
    process.exit(11);
  }
  if (!pwOk) {
    console.error('E-PW playwright._electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }
  let ELECTRON_EXECUTABLE = '';
  try {
    ELECTRON_EXECUTABLE = require('electron');
  } catch (err) {
    console.error('E-EXE 无法解析 electron:', err.message);
    process.exit(12);
  }
  if (typeof ELECTRON_EXECUTABLE !== 'string' || !fs.existsSync(ELECTRON_EXECUTABLE)) {
    console.error('E-EXE electron 二进制不可得:', ELECTRON_EXECUTABLE);
    process.exit(12);
  }

  const { _electron: electronLauncher } = require('playwright');
  const mainLog = [];
  const pageErrors = [];
  let electronApp = null;
  let page = null;
  let exitCode = 1;
  /** 本驱动自己拉起的 Electron 主进程 PID（收尾按精确 PID 核对） */
  let ownPid = null;

  try {
    // ---------- 夹具预检（纯 Node 侧先证明包本身合法） ----------
    const wideBuf = buildWidePackage(PROBE_NAME);
    const injectionProbe = require('../ai-memory-manager').scanInjectionPatterns(
      'rsync -avz ./dist/ deploy@example.com:/srv/www',
      { includeCredentials: false }
    );
    evidence.artifacts.wideZipBytes = wideBuf.length;
    evidence.artifacts.entries = EXTRA_ENTRIES + 2;
    if (!injectionProbe || injectionProbe.safe !== true) {
      throw new Error('夹具正文命中了硬拒扫描 ⇒ 必勾区不会渲染，四类元素判据不可能齐备');
    }

    // 冲突面：与已有用户技能同名
    const probeDir = path.join(USER_SKILLS_DIR, PROBE_NAME);
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(
      path.join(probeDir, 'SKILL.md'),
      `---\nname: ${PROBE_NAME}\ndescription: 多尺寸档 UAT 冲突探针（本驱动收尾会删除）\n---\n\n# probe\n`
    );
    evidence.artifacts.conflictProbeDir = probeDir;

    electronApp = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
      timeout: 60000,
    });
    const proc = electronApp.process();
    ownPid = proc ? proc.pid : null;
    if (proc) {
      const push = (d) =>
        String(d)
          .split('\n')
          .forEach((l) => {
            if (l.trim()) mainLog.push(l);
          });
      if (proc.stdout) proc.stdout.on('data', push);
      if (proc.stderr) proc.stderr.on('data', push);
    }

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

    await page.waitForFunction(() => typeof window.openSettingsTab === 'function', null, { timeout: 20000 });
    await page.evaluate(() => window.openSettingsTab());
    await sleep(1200);
    await guestWaitFor(page, "typeof window.loadSkillManagement === 'function'", 30000, '设置页脚本就绪');
    await guestEval(page, "(function(){ window.loadSkillManagement(); return 'ok'; })()");
    await guestWaitFor(page, "document.querySelectorAll('.skill-manage-row').length > 0", 30000, '技能行出现');
    await guestEval(
      page,
      "(function(){ try { if (typeof window.switchSettingsPage === 'function') window.switchSettingsPage('ai-assistant'); return 'ok'; } catch (e) { return 'threw: ' + e.message; } })()"
    );
    await sleep(1400);
    await guestWaitFor(
      page,
      "document.querySelector('.skill-manage-row').getBoundingClientRect().height > 0",
      20000,
      '技能管理区进入布局'
    );

    // ---------- 打开弹框并造出就绪态 ----------
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(300);
    await guestEval(page, injectFileScript(wideBuf.toString('base64'), 'probe.zip'));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active') && document.getElementById('skillImportPreview').childElementCount > 0",
      40000,
      '预览进入就绪态'
    );
    await sleep(600);

    const collapsed = await guestEval(
      page,
      "(function(){" +
        "  var pv = document.getElementById('skillImportPreview');" +
        '  return {' +
        "    modalDisplay: getComputedStyle(document.getElementById('skillImportModal')).display," +
        "    treeRows: pv.querySelectorAll('.skill-import-tree-row').length," +
        "    treeToggle: !!document.getElementById('skillImportTreeToggle')," +
        "    scriptRows: pv.querySelectorAll('.skill-import-script-path').length," +
        "    ackChildren: document.getElementById('skillImportAck').childElementCount," +
        "    conflictChoices: Array.from(document.querySelectorAll('#skillImportConflict input[type=radio]')).map(function(x){ return x.value; }).join(',')," +
        '    totalEntries: ' + (EXTRA_ENTRIES + 2) +
        '  };' +
        '})()'
    );
    evidence.artifacts.collapsedState = collapsed;
    log(`  就绪态（折叠）：treeRows=${collapsed.treeRows} toggle=${collapsed.treeToggle} scripts=${collapsed.scriptRows} ack=${collapsed.ackChildren} conflict=${JSON.stringify(collapsed.conflictChoices)}`);

    check(
      '前置：弹框可见且四类元素齐备（目录树折叠 / 脚本标红 / 必勾区 / 冲突三选一）',
      collapsed.modalDisplay !== 'none' &&
        collapsed.treeToggle === true &&
        collapsed.treeRows > 0 &&
        collapsed.treeRows <= 50 &&
        collapsed.scriptRows > 0 &&
        collapsed.ackChildren > 0 &&
        collapsed.conflictChoices === 'overwrite,rename,cancel',
      JSON.stringify(collapsed)
    );

    // 展开目录树（让预览内容最高 ⇒ 对 overflow 判据更严）
    const widestState = await guestEval(page, WIDEST_STATE_SRC);
    await sleep(600);
    const expanded = await guestEval(
      page,
      "(function(){" +
        "  var pv = document.getElementById('skillImportPreview');" +
        "  var rows = Array.from(pv.querySelectorAll('.skill-import-tree-row'));" +
        "  var txt = rows.map(function(r){ return r.textContent; }).join(' ');" +
        '  return {' +
        '    treeRows: rows.length,' +
        "    hasLastFile: txt.indexOf('f059.txt') !== -1," +
        "    hasSkillMd: txt.indexOf('SKILL.md') !== -1," +
        "    hasScript: txt.indexOf('scripts/run.sh') !== -1" +
        '  };' +
        '})()'
    );
    evidence.artifacts.widestState = { ...widestState, ...expanded };
    log(`  最宽形态：gate=${JSON.stringify(widestState.gate)} treeRows=${expanded.treeRows}（文件 62 + 目录 2）`);
    check(
      '前置：展开后目录树**越过折叠线**且末尾条目与脚本行都在 DOM 里（折叠不是静默截断）',
      expanded.treeRows > 50 && expanded.hasLastFile === true && expanded.hasSkillMd === true && expanded.hasScript === true,
      JSON.stringify(expanded)
    );

    // ---------- 关闭 AI 侧栏（否则窗口宽度→guest 宽度会被侧栏宽度整体偏移） ----------
    const layoutProbe = await page.evaluate(() => {
      const panel = document.getElementById('aiPanel');
      const wasHidden = panel ? panel.classList.contains('hidden') : null;
      let panelW = null;
      let sidebarW = null;
      if (panel) {
        panelW = panel.getBoundingClientRect().width;
        if (!wasHidden && typeof window.toggleAIPanel === 'function') window.toggleAIPanel();
      }
      const sb = document.getElementById('sidebar');
      if (sb) sidebarW = sb.getBoundingClientRect().width;
      return {
        wasHidden,
        nowHidden: panel ? panel.classList.contains('hidden') : null,
        aiPanelWidth: panelW,
        sidebarWidth: sidebarW,
      };
    });
    await sleep(900);
    evidence.artifacts.layoutProbe = layoutProbe;
    log(`  布局探针：${JSON.stringify(layoutProbe)}`);
    check(
      '前置：AI 侧栏已关闭（否则窗口宽度到 guest 宽度的映射被侧栏宽度整体偏移 ⇒ 尺寸矩阵名不副实）',
      layoutProbe.wasHidden === true || layoutProbe.nowHidden === true,
      JSON.stringify(layoutProbe)
    );

    // ---------- 自标定：求「窗口尺寸 → guest 内容尺寸」的偏移 ----------
    log('=== 自标定（窗口尺寸 → guest 内容尺寸的偏移） ===');
    await electronApp.evaluate(
      ({ BrowserWindow }, { w, h }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.setSize(w, h);
      },
      CALIBRATION_WINDOW
    );
    await sleep(1000);
    const calib = await guestEval(
      page,
      '(function(){ return { innerWidth: window.innerWidth, innerHeight: window.innerHeight }; })()'
    );
    const offsetW = CALIBRATION_WINDOW.w - calib.innerWidth;
    const offsetH = CALIBRATION_WINDOW.h - calib.innerHeight;
    evidence.artifacts.calibration = { window: CALIBRATION_WINDOW, measured: calib, offsetW, offsetH };
    log(`  请求 ${CALIBRATION_WINDOW.w}x${CALIBRATION_WINDOW.h} → 实测 ${calib.innerWidth}x${calib.innerHeight} ⇒ 偏移 ${offsetW}x${offsetH}`);
    check(
      '前置：自标定得到正的宽度偏移（窗口尺寸不能直接当内容尺寸，必须反推）',
      offsetW > 0 && offsetW < 800 && offsetH >= 0 && offsetH < 200,
      JSON.stringify(evidence.artifacts.calibration)
    );

    const SIZE_MATRIX = TARGET_SIZES.map((t) => ({
      label: t.label,
      targetContentW: t.contentW,
      targetContentH: t.contentH,
      w: t.contentW + offsetW,
      h: t.contentH + offsetH,
    }));
    evidence.sizeMatrix = SIZE_MATRIX;

    // ---------- 尺寸矩阵逐档取数 ----------
    log('=== 尺寸矩阵逐档取数 ===');
    for (const size of SIZE_MATRIX) {
      await electronApp.evaluate(
        ({ BrowserWindow }, { w, h }) => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win) win.setSize(w, h);
        },
        { w: size.w, h: size.h }
      );
      await sleep(900);
      const m = await guestEval(page, MEASURE_SRC);
      const row = { ...size, measured: m };
      evidence.perSize.push(row);
      const tag = `${size.label}(${size.w}x${size.h} → 实测 ${m.innerWidth}x${m.innerHeight})`;
      log(`  [${tag}] modalH=${m.modalHeight} 0.8vh=${(0.8 * m.innerHeight).toFixed(1)} scrollable=${JSON.stringify(m.scrollableCandidates)} actions sw/cw=${m.actionsScrollWidth}/${m.actionsClientWidth} btns=${JSON.stringify(m.buttons)}`);

      if (m.fatal) {
        check(`${tag}：弹框节点齐备`, false, JSON.stringify(m));
        continue;
      }
      /* 退化档守卫：宽度被钳到 0 / 高度不足时，几何量本身无意义 ——
         「0 vs 0 全等」会让布局判据**假绿**。该档只登记、不断言，另由末端的
         「非退化档 ≥ 3」保证矩阵没被退化档吃掉。 */
      if (m.innerWidth < 320 || m.innerHeight < 480) {
        row.degenerate = true;
        log(`    [skip] 退化档（innerWidth=${m.innerWidth} innerHeight=${m.innerHeight}）⇒ 只登记不断言`);
        continue;
      }
      check(
        `${tag}：弹框总高 > 0 且 ≤ 0.8 × 视口高`,
        m.modalDisplay !== 'none' && m.modalHeight > 0 && m.modalHeight <= 0.8 * m.innerHeight + 1,
        `modalH=${m.modalHeight} innerH=${m.innerHeight}`
      );
      check(
        `${tag}：滚动只在预览区（置 scrollTop 后变大 + 页面级滚动不动）`,
        m.previewScrollAfter > m.previewScrollBefore &&
          m.previewScrollHeight > m.previewClientHeight &&
          m.pageScrollAfter === m.pageScrollBefore,
        `before=${m.previewScrollBefore} after=${m.previewScrollAfter} sh/ch=${m.previewScrollHeight}/${m.previewClientHeight} page=${m.pageScrollBefore}->${m.pageScrollAfter}`
      );
      check(
        `${tag}：弹框内可滚动容器**恰为**预览区`,
        m.scrollableCandidates.length === 1 && m.scrollableCandidates[0] === 'skillImportPreview',
        JSON.stringify(m.scrollableCandidates)
      );
      check(
        `${tag}：动作区不横向溢出（scrollWidth ≤ clientWidth）`,
        m.actionsDisplay !== 'none' && m.actionsScrollWidth <= m.actionsClientWidth,
        `sw=${m.actionsScrollWidth} cw=${m.actionsClientWidth}`
      );
      check(
        `${tag}：两按钮同排、不重叠、宽度 > 0、右边界不超出视口（不被裁切）`,
        m.buttonCount === 2 &&
          m.sameRow === true &&
          m.overlap === false &&
          m.buttons.every((b) => b.w > 0 && b.h > 0 && b.right <= m.innerWidth + 0.5),
        `sameRow=${m.sameRow} overlap=${m.overlap} ${JSON.stringify(m.buttons)} innerW=${m.innerWidth}`
      );
      check(
        `${tag}：禁用原因文本可见、非空、且位于按钮排上方`,
        !!m.gateText && m.gateText.length > 0 && m.gateHeight > 0 && m.gateAboveButtons === true,
        `gate=${JSON.stringify(m.gateText)} h=${m.gateHeight} above=${m.gateAboveButtons}`
      );
      check(
        `${tag}：四类元素在**该档**仍齐备（目录树 / 脚本 / 必勾 / 冲突三选一）`,
        m.treeToggle === true && m.treeRows > 0 && m.scriptRows > 0 && m.ackChildren > 0 && m.conflictChoices === 'overwrite,rename,cancel',
        `tree=${m.treeRows} scripts=${m.scriptRows} ack=${m.ackChildren} conflict=${m.conflictChoices}`
      );
      check(
        `${tag}：弹框本体不横向溢出`,
        m.modalScrollWidth <= m.modalClientWidth + 1,
        `modal sw/cw=${m.modalScrollWidth}/${m.modalClientWidth}`
      );
    }

    // ---------- 反恒真：各档实测 innerWidth 必须真的不同 ----------
    const widths = evidence.perSize.map((r) => r.measured && r.measured.innerWidth).filter((x) => typeof x === 'number');
    const distinct = Array.from(new Set(widths));
    const usableRows = evidence.perSize.filter((r) => r.degenerate !== true && r.measured && !r.measured.fatal);
    const usableWidths = Array.from(new Set(usableRows.map((r) => r.measured.innerWidth)));
    evidence.artifacts.measuredWidths = widths;
    evidence.artifacts.distinctWidths = distinct;
    evidence.artifacts.usableWidths = usableWidths;
    evidence.artifacts.usableRowCount = usableRows.length;
    check(
      '反恒真：各档实测 `innerWidth` 至少 3 个互不相同的取值（矩阵真的是多档，不是同档测 5 次）',
      distinct.length >= 3,
      `widths=${JSON.stringify(widths)} distinct=${JSON.stringify(distinct)}`
    );
    check(
      '反恒真：**非退化**档至少 3 个且其 `innerWidth` 互不相同（退化档没吃掉矩阵）',
      usableRows.length >= 3 && usableWidths.length >= 3,
      `usable=${usableRows.length} widths=${JSON.stringify(usableWidths)} degenerate=${evidence.perSize.filter((r) => r.degenerate === true).length}`
    );
    const heights = Array.from(new Set(evidence.perSize.map((r) => r.measured && r.measured.innerHeight)));
    evidence.artifacts.distinctHeights = heights;
    check(
      '反恒真：各档实测 `innerHeight` 至少 2 个互不相同的取值',
      heights.length >= 2,
      JSON.stringify(heights)
    );

    await guestEval(page, "(function(){ try { window.closeSkillImportModal(); } catch (e) {} return 'ok'; })()");
    await sleep(600);
    check('全程 guest / host 无未捕获异常（pageerror）', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 5)));
  } catch (e) {
    evidence.thrown = String(e && e.stack ? e.stack : e);
    log('[result] 驱动异常：', evidence.thrown);
  } finally {
    try {
      evidence.cleanup.probeSkill = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
      await sleep(400);
      const residue = listImportResidue();
      const preexisting = Array.isArray(evidence.cleanup.preTmpResidue) ? evidence.cleanup.preTmpResidue : [];
      const mine = residue.filter((n) => preexisting.indexOf(n) === -1);
      const removed = [];
      for (const n of mine) {
        try {
          fs.rmSync(path.join(TMP_DIR, n), { recursive: true, force: true });
          removed.push(n);
        } catch (_e) {
          /* 计入差值 */
        }
      }
      evidence.cleanup.residueFound = residue;
      evidence.cleanup.residueRemoved = removed;
      evidence.cleanup.pageErrors = pageErrors;
      evidence.cleanup.mainLogTail = mainLog.slice(-20);
    } catch (e) {
      log('[cleanup] 失败:', e.message);
    }
    if (electronApp) {
      try {
        await Promise.race([electronApp.close(), sleep(6000)]);
      } catch (e) {
        console.error('electronApp.close() 失败:', e.message);
      }
      /* ⚠ 收尾必须确认**自己的**子进程真的没了：`process.exit()` 可能抢在异步 close 之前执行，
         留下 PPID=1 的孤儿实例 —— 它会与后续运行共用 realm-dev userData，并让设置页 guest
         被重新初始化（实测导致超限用例间歇转红）。只按**精确 PID** 收，不用模式匹配杀进程。 */
      if (isPidAlive(ownPid)) {
        try {
          process.kill(ownPid, 'SIGKILL');
          evidence.cleanup.orphanKilled = ownPid;
        } catch (e) {
          evidence.cleanup.orphanKilled = `failed(${e.message})`;
        }
      } else {
        evidence.cleanup.orphanKilled = null;
      }
      evidence.cleanup.instancesAfter = listElectronInstances();
    }
    evidence.finished = new Date().toISOString();
    evidence.passed = results.filter((r) => r.pass).length;
    evidence.total = results.length;
    evidence.exitCode = evidence.passed === evidence.total && !evidence.thrown ? 0 : 1;
    exitCode = evidence.exitCode;
    try {
      writeEvidence(evidence);
    } catch (e) {
      console.error('写证据 JSON 失败:', e.message);
    }
  }

  log('');
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  log('[result] 清理:', JSON.stringify(evidence.cleanup));
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(`uat-51-import-modal-sizes: ${evidence.passed}/${evidence.total} passed`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
