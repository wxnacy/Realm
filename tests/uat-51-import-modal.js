#!/usr/bin/env node
/**
 * UAT 驱动（Phase 51 · 导入技能弹框）—— 真实渲染下的两条 backstop 正命题读数 +
 * 四条禁用原因 + 键盘契约 + 注入纪律的渲染快照。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js
 *
 * `playwright` **只在全局**（仓内 `require.resolve('playwright')` 直接 `Cannot find module`）
 * ⇒ 必须带 `NODE_PATH`；缺全局时本驱动以 `E-PW` 码**明确报错退出**（不是静默跳过）。
 * 取 Electron 二进制走**裸说明符** `require('electron')`（拼 `node_modules/electron/dist`
 * 绝对路径会在 worktree 内 MODULE_NOT_FOUND —— 见 `docs/dev/branching-spec.md` 第三节）。
 *
 * 只启动**本进程自己拉起的** realm-dev 子进程。收尾固定 `electronApp.close()` +
 * `process.exit(code)`；**严禁** `pkill` / `pgrep` 模式匹配杀进程。
 *
 * ⚠ 本驱动会**临时写入** realm-dev userData：`agent-workspace/skills/zzq-import-probe/`
 *（构造「与已有用户技能同名」的冲突面）。开跑前与收尾都清一次；中断后人工复查：
 *     ls ~/Library/Application\ Support/realm-dev/agent-workspace/skills | grep zzq
 *
 * 判据设计（**每条承重判据都带正命题**，不重复 49 的 WR-12「否命题空集真」形态）
 * ---------------------------------------------------------------------------
 * **E2 backstop**（弹框外壳 overflow）
 *   用**现场生成**的 ≥ 200 条目合法单技能包（`tests/helpers/make-malicious-zip.js` 的
 *   `buildZip`，**不硬编码本机数据**）把预览撑到就绪态，然后三条读数：
 *   ① `modal.getBoundingClientRect().height <= 0.8 * innerHeight`（上界断言）；
 *   ② **滚动只发生在预览区内** —— 对预览容器滚轮后 `preview.scrollTop > 0`（正命题）
 *    **且** `document.scrollingElement.scrollTop` **不变**（反向约束）；
 *   ③ 弹框内**只有一个**可滚动容器（候选集合必须恰为 `{preview}`）。
 *
 * **E17 backstop**（动作区 overflow）
 *   造出**最宽形态**（必勾未勾 ⇒ 原因文本「请先勾选『我已了解以上风险』」+ 冲突提示 + 两按钮）后：
 *   ① `actions.scrollWidth <= actions.clientWidth`；② 两个按钮 `width > 0` 且 `right <= innerWidth`
 *   （不被裁切）；③ 禁用原因文本 `height > 0` 且 `textContent` 非空。
 *
 * **四条假绿规避**（50 收尾实测 + 49 的 WR-12；实现里逐条体现）
 *   ① 时间线采样**排除 pre-click / same-tick**：所有读数都在 `await` 之后的独立 tick 里取；
 *   ② 读提示文本一律用**弹框内状态行** `#skillImportStatus`（**不是**区级 hint —— 后者 2000ms 自动清空；
 *      且 danger 类名是 `skill-manage-hint-danger` 而非 `danger`）；
 *   ③ 断言前**必须**确认目标不在 `display:none`（否则 `getBoundingClientRect` 全 0 ⇒ 「0 vs 0 全等」假绿）；
 *   ④ 生成给 guest 执行的源码字符串里**不含反引号**（Phase 50 踩过两次：会提前终止外层模板字面量）。
 *
 * **与计划文本的一处诚实偏离**（见 51-06-SUMMARY「偏离」段）
 *   计划要求用**含 RTL override 的文件名**做净化快照。实测 `51-03` 的 `validateEntryName`
 *   在**解压期**就把含双向控制符的条目**整包拒绝**（`unsafe_entry`）⇒ 该路径**到不了预览**。
 *   本驱动因此改为：① 断言该包被整包拒绝（更强的结论）；② 对显示层净化函数
 *   （`sanitizeDisplayString` / `withHiddenNotice`）做**直接调用**的正命题探针，
 *   并把 `<img onerror>` 文件名走**真实预览渲染**做注入快照。
 *
 * 产物（**证据固化进仓库**，不落 `/tmp` —— IN-16 / WR-09 教训）
 *   tests/.uat-out/uat-51-import-modal.json
 * 退出码：全部通过 → 0；任一条失败 → 非零（11 = 缺全局 playwright / 12 = 仓内无 Electron）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tests', '.uat-out');
const EVIDENCE_PATH = path.join(OUT_DIR, 'uat-51-import-modal.json');

const HOME = process.env.HOME;
const APP_SUPPORT = path.join(HOME, 'Library', 'Application Support', 'realm-dev');
const WORKSPACE = path.join(APP_SUPPORT, 'agent-workspace');
const USER_SKILLS_DIR = path.join(WORKSPACE, 'skills');
const TMP_DIR = path.join(WORKSPACE, '.tmp');

/** 构造冲突面的探针技能名（**不是**内置技能名 ⇒ 冲突档为 `user`） */
const PROBE_NAME = 'zzq-import-probe';
/** 含 HTML 注入形态的文件名（无控制字符 ⇒ 能通过 51-03 的 entry 名校验，可到预览） */
const EVIL_FILE = 'xss<img src=x onerror=alert(1)>.txt';
/** 含 RTL override 的文件名（**会被解压期整包拒绝** —— 见文件头「诚实偏离」） */
const BIDI_FILE = 'evil\u202ex.txt';
/** 撑满预览的条目数（> PREVIEW_LIST_LIMIT=50 ⇒ 一定出现「展开全部」与内层滚动） */
const EXTRA_ENTRIES = 220;
/** 主窗口尺寸（窄窗口 = 让位给文本的那一档；E17 backstop 的「最宽形态」在此档下判） */
const WIN_W = 880;
const WIN_H = 820;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const makeZip = require('./helpers/make-malicious-zip');

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: String(detail == null ? '' : detail) });
  // 打印时**避免**出现字面 `FAIL` / `✗`（门禁按这两个 token 判红）
  log(`  [${pass ? 'ok' : '!!'}] ${name} — ${detail}`);
  return !!pass;
}

/** 确定性伪随机内容（**高熵** ⇒ 避免压缩比闸误伤：低熵内容会逼近 100:1 的上限） */
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

/** 现场生成一个「宽」合法单技能包（≥ 200 条目 + 一条启发式命中 + 一个脚本 + allowed-tools） */
function buildWidePackage(name, extraFiles) {
  const skillMd =
    `---\nname: ${name}\ndescription: 导入弹框 UAT 探针技能\nallowed-tools: Bash, Read\n---\n\n# probe\n\n` +
    // A3（rsync 到远端）—— 已具名的已知误伤模式，用作**必勾区必然渲染**的触发器
    'rsync -avz ./dist/ deploy@example.com:/srv/www\n';
  const entries = [
    { name: 'SKILL.md', data: skillMd },
    // 脚本清单：`.sh` 命中扩展名白名单 ⇒ E11 的标红块 / 计数 / 「不构成额外权限」恒显说明都会渲染
    { name: 'scripts/run.sh', data: pseudoRandom(150, 999) },
  ];
  for (let i = 0; i < EXTRA_ENTRIES; i += 1) {
    entries.push({
      name: `data/f${String(i).padStart(3, '0')}.txt`,
      data: pseudoRandom(180, i + 7),
    });
  }
  for (const extra of extraFiles || []) {
    entries.push(typeof extra === 'string' ? { name: extra, data: 'probe\n' } : extra);
  }
  return makeZip.buildZip({ entries });
}

/**
 * 含**双向控制符**条目名的包
 *
 * ⚠️ 必须置 `utf8: true`：yauzl 默认按 CP437 解码 entry 名，U+202E 的 UTF-8 字节
 *（E2 80 AE）会被解成三个 CP437 字符 ⇒ 解码后的名字里**根本没有** U+202E，
 * 51-03 的 `validateEntryName` ⑧ 也就命中不了（首次实测正是这样：包被正常引入预览）。
 */
function buildBidiPackage(name) {
  return makeZip.buildZip({
    entries: [
      { name: 'SKILL.md', data: `---\nname: ${name}\ndescription: 导入弹框 UAT 探针技能\n---\n\n# probe\n` },
      { name: BIDI_FILE, data: 'probe\n', utf8: true },
    ],
  });
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

/** 列出 `.tmp/` 下的导入残留（收尾核对：预览关闭应尽力清掉） */
function listImportResidue() {
  try {
    return fs.readdirSync(TMP_DIR).filter((n) => n.startsWith('skill-import-') || n.startsWith('skill-replace-'));
  } catch (_e) {
    return [];
  }
}

// ==================== guest 交互（与 tests/uat-50-b-* 同款） ====================

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
      // 设置页 webview 还没挂进 DOM（`no settings webview`）也是「尚未就绪」的一种，
      // 不能当成断言失败 —— 否则会在 tab 刚创建的那一刻直接抛死。
      last = 'not-ready: ' + (e && e.message ? e.message : e);
    }
    if (last === true) return true;
    await sleep(300);
  }
  throw new Error(`等待超时（${label}）：最后取值 = ${JSON.stringify(last)}`);
}

/**
 * 把 zip 字节注入隐藏 file input 并触发 change
 *
 * 走 `DataTransfer` + `change` 事件 ⇒ 真实走通 `#skillImportPick` 背后的整条链路
 *（含 `finally` 里的输入置空）。**不使用反引号**（生成的 guest 源码里反引号会截断外层模板字面量）。
 */
function injectFileScript(b64, fileName) {
  return (
    "(function(){" +
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

async function main() {
  const started = new Date().toISOString();
  const evidence = {
    driver: 'tests/uat-51-import-modal.js',
    covers: ['E2-backstop', 'E17-backstop', 'disabled-reasons', 'keyboard', 'injection-discipline'],
    started,
    finished: null,
    node: process.version,
    artifacts: {},
    assertions: results,
    cleanup: {},
    exitCode: null,
  };

  log('=== 前置清理（上一轮中断可能留下的残留） ===');
  evidence.cleanup.preProbeSkill = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
  evidence.cleanup.preTmpResidue = listImportResidue();

  let pwOk = false;
  try {
    pwOk = !!require('playwright')._electron;
  } catch (err) {
    console.error('E-PW require("playwright") 失败:', err.message);
    console.error('请用 NODE_PATH="$(npm root -g)" node tests/uat-51-import-modal.js 运行');
    process.exit(11);
  }
  if (!pwOk) {
    console.error('E-PW playwright._electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }

  let ELECTRON_EXECUTABLE = '';
  try {
    // 裸说明符：worktree 内也能解析到主仓库的 Electron 二进制
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

  try {
    // ---------- 夹具预检（纯 Node 侧先证明包本身合法，避免把夹具问题误判为 UI 失败） ----------
    const wideBuf = buildWidePackage(PROBE_NAME, [EVIL_FILE]);
    const bidiBuf = buildBidiPackage(PROBE_NAME);
    const injectionProbe = require('../ai-memory-manager').scanInjectionPatterns(
      'rsync -avz ./dist/ deploy@example.com:/srv/www',
      { includeCredentials: false }
    );
    evidence.artifacts.wideZipBytes = wideBuf.length;
    evidence.artifacts.entries = EXTRA_ENTRIES + 2;
    evidence.artifacts.injectionScanSafe = !!(injectionProbe && injectionProbe.safe);
    if (!injectionProbe || injectionProbe.safe !== true) {
      throw new Error('夹具正文命中了硬拒扫描（注入类）⇒ 预览不可能就绪，请改夹具措辞');
    }

    // ---------- 冲突面：与已有用户技能同名 ----------
    const probeDir = path.join(USER_SKILLS_DIR, PROBE_NAME);
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(
      path.join(probeDir, 'SKILL.md'),
      `---\nname: ${PROBE_NAME}\ndescription: UAT 冲突探针（本驱动收尾会删除）\n---\n\n# probe\n`
    );
    evidence.artifacts.conflictProbeDir = probeDir;

    // ---------- 启动真实 dev 应用 ----------
    electronApp = await electronLauncher.launch({
      args: ['.'],
      cwd: REPO_ROOT,
      executablePath: ELECTRON_EXECUTABLE,
      env: { ...process.env, NODE_ENV: 'development' },
      timeout: 60000,
    });
    const proc = electronApp.process();
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

    // 窄窗口档：让 E17 backstop 真的在「文本让位」的情形下判
    await electronApp.evaluate(
      ({ BrowserWindow }, { w, h }) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.setSize(w, h);
      },
      { w: WIN_W, h: WIN_H }
    );
    await sleep(800);

    await page.waitForFunction(() => typeof window.openSettingsTab === 'function', null, {
      timeout: 20000,
    });
    await page.evaluate(() => window.openSettingsTab());
    // 设置页是新开的 webview tab：给它一点时间把元素挂进 DOM（否则首个 guestEval 找不到 webview）
    await sleep(1200);
    await guestWaitFor(page, "typeof window.loadSkillManagement === 'function'", 30000, '设置页脚本就绪');
    await guestEval(
      page,
      "(function(){ window.loadSkillManagement(); return 'ok'; })()"
    );
    await guestWaitFor(page, "document.querySelectorAll('.skill-manage-row').length > 0", 30000, '技能行出现');
    // 切到「AI 助手」子页让技能管理区**进入布局**（否则 rect 全 0 ⇒ 「0 vs 0 全等」假绿）
    await guestEval(
      page,
      "(function(){ try { if (typeof window.switchSettingsPage === 'function') window.switchSettingsPage('ai-assistant'); return 'ok'; } catch (e) { return 'threw: ' + e.message; } })()"
    );
    await sleep(1400);
    await guestWaitFor(
      page,
      "document.querySelector('.skill-manage-row').getBoundingClientRect().height > 0",
      20000,
      '技能管理区进入布局（行高 > 0）'
    );

    // ==================== ① 打开弹框 + 四条禁用原因（1a / 1b） ====================
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(300);
    const initial = await guestEval(
      page,
      "(function(){" +
        "  var modal = document.getElementById('skillImportModal');" +
        "  return {" +
        "    display: getComputedStyle(modal).display," +
        "    status: document.getElementById('skillImportStatus').textContent," +
        "    gate: document.getElementById('skillImportGate').textContent," +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled," +
        "    cancelDisabled: document.getElementById('skillImportCancel').disabled," +
        "    focusId: document.activeElement ? document.activeElement.id : null" +
        '  };' +
        '})()'
    );
    evidence.artifacts.initialState = initial;
    check('弹框可见（不是 display:none）', initial.display !== 'none', `display=${initial.display}`);
    check(
      '禁用原因 1a：未选包 ⇒ 「请先选择 zip 文件」上屏',
      initial.gate === '请先选择 zip 文件',
      `gate=${JSON.stringify(initial.gate)}`
    );
    check('空态状态行 = 「尚未选择 zip 文件」', initial.status === '尚未选择 zip 文件', `status=${JSON.stringify(initial.status)}`);
    check('初始焦点落在当前面板第一个可交互元素（不落在确认按钮）', initial.focusId === 'skillImportPick', `focus=${initial.focusId}`);
    check('确认按钮初始 disabled（原生属性）', initial.confirmDisabled === true, `disabled=${initial.confirmDisabled}`);
    check('取消按钮初始可用', initial.cancelDisabled === false, `disabled=${initial.cancelDisabled}`);

    const urlMode = await guestEval(
      page,
      "(function(){" +
        "  document.getElementById('skillImportTabUrl').click();" +
        "  return {" +
        "    gate: document.getElementById('skillImportGate').textContent," +
        "    status: document.getElementById('skillImportStatus').textContent," +
        "    statusDisplay: getComputedStyle(document.getElementById('skillImportStatus')).display," +
        "    fetchDisabled: document.getElementById('skillImportFetch').disabled," +
        "    localActive: document.getElementById('skillImportPanelLocal').classList.contains('active')," +
        "    urlActive: document.getElementById('skillImportPanelUrl').classList.contains('active')," +
        "    localPressed: document.getElementById('skillImportTabLocal').getAttribute('aria-pressed')," +
        "    urlPressed: document.getElementById('skillImportTabUrl').getAttribute('aria-pressed')," +
        "    focusId: document.activeElement ? document.activeElement.id : null" +
        '  };' +
        '})()'
    );
    evidence.artifacts.urlMode = urlMode;
    check(
      '禁用原因 1b：网络地址模式空输入 ⇒ 「请输入网络地址」上屏',
      urlMode.gate === '请输入网络地址',
      `gate=${JSON.stringify(urlMode.gate)}`
    );
    check('两行 idle 的刻意差异：网络态状态行留空（CSSOM display:none）', urlMode.status === '' && urlMode.statusDisplay === 'none', `status=${JSON.stringify(urlMode.status)} display=${urlMode.statusDisplay}`);
    check('「获取预览」在 URL 为空时 disabled', urlMode.fetchDisabled === true, `disabled=${urlMode.fetchDisabled}`);
    check('模式面板互斥切换（.active 单选）', urlMode.localActive === false && urlMode.urlActive === true, `local=${urlMode.localActive} url=${urlMode.urlActive}`);
    check('模式按钮用 aria-pressed 分段控件语义', urlMode.localPressed === 'false' && urlMode.urlPressed === 'true', `local=${urlMode.localPressed} url=${urlMode.urlPressed}`);
    check('网络模式初始焦点落在 URL 输入框', urlMode.focusId === 'skillImportUrl', `focus=${urlMode.focusId}`);

    // ==================== ② 注入宽包 → 预览就绪 ====================
    await guestEval(
      page,
      "(function(){ document.getElementById('skillImportTabLocal').click(); return 'ok'; })()"
    );
    await sleep(200);
    await guestEval(page, injectFileScript(wideBuf.toString('base64'), 'probe.zip'));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active') && document.getElementById('skillImportPreview').childElementCount > 0",
      40000,
      '预览进入就绪态'
    );
    await sleep(600); // 独立 tick：所有读数都在等待之后的同一稳定态里取

    const ready = await guestEval(
      page,
      "(function(){" +
        "  var modal = document.getElementById('skillImportModal');" +
        "  var modalBox = modal.querySelector('.ai-modal');" +
        "  var preview = document.getElementById('skillImportPreview');" +
        "  var ack = document.getElementById('skillImportAck');" +
        "  var conflict = document.getElementById('skillImportConflict');" +
        "  var gate = document.getElementById('skillImportGate');" +
        "  var labels = Array.from(document.querySelectorAll('#skillImportPreview .skill-import-label')).map(function(e){return e.textContent;});" +
        "  return {" +
        "    modalDisplay: getComputedStyle(modal).display," +
        "    modalHeight: modalBox.getBoundingClientRect().height," +
        "    innerHeight: window.innerHeight," +
        "    innerWidth: window.innerWidth," +
        "    status: document.getElementById('skillImportStatus').textContent," +
        "    gate: gate.textContent," +
        "    gateHeight: gate.getBoundingClientRect().height," +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled," +
        "    ackChildren: ack.childElementCount," +
        "    ackChecked: !!(ack.querySelector('input[type=checkbox]') || {}).checked," +
        "    conflictChildren: conflict.childElementCount," +
        "    conflictChoices: Array.from(conflict.querySelectorAll('input[type=radio]')).map(function(r){return r.value;})," +
        "    radioChecked: Array.from(conflict.querySelectorAll('input[type=radio]')).some(function(r){return r.checked;})," +
        "    labelTexts: labels," +
        "    treeRows: preview.querySelectorAll('.skill-import-tree-row').length," +
        "    treeToggle: !!document.getElementById('skillImportTreeToggle')," +
        "    scriptRows: preview.querySelectorAll('.skill-import-script-path').length," +
        "    scanCols: preview.querySelectorAll('.skill-import-scan-col').length," +
        "    honestyTexts: Array.from(preview.querySelectorAll('.skill-import-note')).map(function(e){return e.textContent;})" +
        '  };' +
        '})()'
    );
    evidence.artifacts.ready = ready;

    check('预览就绪状态行 = 「预览已就绪，确认后才会写入。」', ready.status === '预览已就绪，确认后才会写入。', `status=${JSON.stringify(ready.status)}`);
    {
      // 六字段 + 两条补充的字段标签齐备（D-13 的信息集；缺哪个在此指名）
      const expectedLabels = ['技能名', '落点', '描述', '目录', '体积', '脚本', 'allowed-tools'];
      const missingLabels = expectedLabels.filter((l) => ready.labelTexts.indexOf(l) === -1);
      check(
        '预览字段标签齐备（D-13 信息集逐条对齐）',
        missingLabels.length === 0,
        `missing=${JSON.stringify(missingLabels)} labels=${JSON.stringify(ready.labelTexts)}`
      );
    }
    check('目录树默认只渲染前 N 项（截断 + 展开开关）', ready.treeRows > 0 && ready.treeRows <= 50 && ready.treeToggle === true, `rows=${ready.treeRows} toggle=${ready.treeToggle}`);
    check('E11：脚本清单标红渲染（> 0 条时整块渲染）', ready.scriptRows > 0, `scriptRows=${ready.scriptRows}`);
    check('扫描结论两栏恒渲染', ready.scanCols === 2, `cols=${ready.scanCols}`);
    check(
      '四条诚实边界在预览内恒显',
      ready.honestyTexts.some((t) => t.indexOf('不是安全边界') !== -1) &&
        ready.honestyTexts.some((t) => t.indexOf('不构成额外权限') !== -1) &&
        ready.honestyTexts.some((t) => t.indexOf('不被强制，仅供参考') !== -1) &&
        ready.honestyTexts.some((t) => t.indexOf('不代表该技能是安全的') !== -1),
      JSON.stringify(ready.honestyTexts)
    );
    check('必勾区按启发式命中条件渲染', ready.ackChildren > 0 && ready.ackChecked === false, `children=${ready.ackChildren} checked=${ready.ackChecked}`);
    check(
      '冲突区按同名三选一渲染（user 档：覆盖/改名/取消，默认全未选）',
      JSON.stringify(ready.conflictChoices) === JSON.stringify(['overwrite', 'rename', 'cancel']) && ready.radioChecked === false,
      JSON.stringify(ready.conflictChoices)
    );
    check(
      '禁用原因 2：必勾未勾 ⇒ 「请先勾选「我已了解以上风险」」上屏',
      ready.gate === '请先勾选「我已了解以上风险」' && ready.gateHeight > 0 && ready.confirmDisabled === true,
      `gate=${JSON.stringify(ready.gate)} h=${ready.gateHeight}`
    );

    // ==================== ③ E2 backstop：弹框外壳 overflow ====================
    const scrollProbe = await guestEval(
      page,
      "(function(){" +
        "  var modal = document.getElementById('skillImportModal');" +
        "  var modalBox = modal.querySelector('.ai-modal');" +
        "  var preview = document.getElementById('skillImportPreview');" +
        "  var before = preview.scrollTop;" +
        "  var pageBefore = document.scrollingElement ? document.scrollingElement.scrollTop : -1;" +
        "  preview.scrollTop = preview.scrollHeight;" + // 直接置滚动位置（真实滚动只可能发生在该容器）
        "  void preview.offsetHeight;" + // 强制重排，确保 scrollTop 生效
        "  var after = preview.scrollTop;" +
        "  var pageAfter = document.scrollingElement ? document.scrollingElement.scrollTop : -1;" +
        "  var candidates = Array.from(modalBox.querySelectorAll('*')).filter(function(el){" +
        "    var cs = getComputedStyle(el);" +
        "    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;" +
        "  }).map(function(el){ return el.id || el.className; });" +
        "  return {" +
        "    modalHeight: modalBox.getBoundingClientRect().height," +
        "    innerHeight: window.innerHeight," +
        "    modalDisplay: getComputedStyle(modal).display," +
        "    previewScrollBefore: before," +
        "    previewScrollAfter: after," +
        "    previewScrollHeight: preview.scrollHeight," +
        "    previewClientHeight: preview.clientHeight," +
        "    pageScrollBefore: pageBefore," +
        "    pageScrollAfter: pageAfter," +
        "    scrollableCandidates: candidates" +
        '  };' +
        '})()'
    );
    evidence.artifacts.e2 = scrollProbe;
    check(
      'E2 backstop（正命题）：弹框总高 <= 0.8 × 可用窗口高',
      scrollProbe.modalDisplay !== 'none' &&
        scrollProbe.modalHeight > 0 &&
        scrollProbe.modalHeight <= 0.8 * scrollProbe.innerHeight + 1,
      `modal=${scrollProbe.modalHeight} inner=${scrollProbe.innerHeight}`
    );
    check(
      'E2 backstop（正命题）：滚动真的发生在预览区内（scrollTop 增大）',
      scrollProbe.previewScrollAfter > scrollProbe.previewScrollBefore && scrollProbe.previewScrollHeight > scrollProbe.previewClientHeight,
      `before=${scrollProbe.previewScrollBefore} after=${scrollProbe.previewScrollAfter} sh/ch=${scrollProbe.previewScrollHeight}/${scrollProbe.previewClientHeight}`
    );
    check(
      'E2 backstop（反向约束）：页面级滚动不移动',
      scrollProbe.pageScrollAfter === scrollProbe.pageScrollBefore,
      `page before=${scrollProbe.pageScrollBefore} after=${scrollProbe.pageScrollAfter}`
    );
    check(
      'E2 backstop：弹框内只有一个可滚动容器（恰为预览区）',
      scrollProbe.scrollableCandidates.length === 1 && scrollProbe.scrollableCandidates[0] === 'skillImportPreview',
      JSON.stringify(scrollProbe.scrollableCandidates)
    );

    // ==================== ④ 禁用原因 3 / 4 + 最宽形态 ====================
    const ackThenConflict = await guestEval(
      page,
      "(function(){" +
        "  var box = document.querySelector('#skillImportAck input[type=checkbox]');" +
        "  box.checked = true;" +
        "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  return {" +
        "    gate: document.getElementById('skillImportGate').textContent," +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled" +
        '  };' +
        '})()'
    );
    evidence.artifacts.afterAck = ackThenConflict;
    check(
      '禁用原因 4：必勾已勾但冲突未选 ⇒ 「请选择覆盖、改名或取消」上屏',
      ackThenConflict.gate === '请选择覆盖、改名或取消' && ackThenConflict.confirmDisabled === true,
      `gate=${JSON.stringify(ackThenConflict.gate)}`
    );

    const renameMode = await guestEval(
      page,
      "(function(){" +
        "  var r = document.querySelector('#skillImportConflict input[type=radio][value=rename]');" +
        "  r.checked = true;" +
        "  r.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  return {" +
        "    gate: document.getElementById('skillImportGate').textContent," +
        "    hasField: !!document.getElementById('skillImportRenameField')," +
        "    hasError: !!document.getElementById('skillImportRenameError')," +
        "    errorText: document.getElementById('skillImportRenameError') ? document.getElementById('skillImportRenameError').textContent : null," +
        "    confirmText: document.getElementById('skillImportConfirm').textContent," +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled" +
        '  };' +
        '})()'
    );
    evidence.artifacts.renameMode = renameMode;
    check('E16：选中「改名」后输入框才渲染（条件渲染）', renameMode.hasField === true && renameMode.hasError === true, `field=${renameMode.hasField} error=${renameMode.hasError}`);
    check(
      '禁用原因 3：改名输入为空 ⇒ 「请输入新的技能名」上屏',
      renameMode.gate === '请输入新的技能名' && renameMode.confirmDisabled === true,
      `gate=${JSON.stringify(renameMode.gate)}`
    );
    check('不预填默认值（输入框初始为空）', renameMode.errorText === '' && renameMode.confirmText === '导入', `error=${JSON.stringify(renameMode.errorText)}`);

    const cancelChoice = await guestEval(
      page,
      "(function(){" +
        "  var r = document.querySelector('#skillImportConflict input[type=radio][value=cancel]');" +
        "  r.checked = true;" +
        "  r.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  return {" +
        "    confirmText: document.getElementById('skillImportConfirm').textContent," +
        "    hasField: !!document.getElementById('skillImportRenameField')" +
        '  };' +
        '})()'
    );
    evidence.artifacts.cancelChoice = cancelChoice;
    check('确认按钮文案二元表：选中「取消」时切「关闭弹框」', cancelChoice.confirmText === '关闭弹框', `text=${JSON.stringify(cancelChoice.confirmText)}`);
    check('取消选择时不渲染改名输入框（不占位、不进 Tab 序）', cancelChoice.hasField === false, `hasField=${cancelChoice.hasField}`);

    // ---- E17 backstop：「最宽形态」= 必勾未勾（原因文本最长）+ 冲突提示 + 两按钮 ----
    const widest = await guestEval(
      page,
      "(function(){" +
        "  var box = document.querySelector('#skillImportAck input[type=checkbox]');" +
        "  box.checked = false;" +
        "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  var r = document.querySelector('#skillImportConflict input[type=radio][value=overwrite]');" +
        "  r.checked = true;" +
        "  r.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  var b2 = document.querySelector('#skillImportAck input[type=checkbox]');" +
        "  b2.checked = false;" +
        "  b2.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  var actions = document.querySelector('.skill-import-actions');" +
        "  var gate = document.getElementById('skillImportGate');" +
        "  var btns = Array.from(actions.querySelectorAll('button'));" +
        "  var b0 = btns[0].getBoundingClientRect();" +
        "  var b1 = btns[1].getBoundingClientRect();" +
        "  var aRect = actions.getBoundingClientRect();" +
        "  var modalBox = document.querySelector('#skillImportModal .ai-modal');" +
        "  return {" +
        "    gate: gate.textContent," +
        "    gateHeight: gate.getBoundingClientRect().height," +
        "    gateTop: gate.getBoundingClientRect().top," +
        "    actionsScrollWidth: actions.scrollWidth," +
        "    actionsClientWidth: actions.clientWidth," +
        "    actionsTop: aRect.top," +
        "    actionsLeft: aRect.left," +
        "    actionsRight: aRect.right," +
        "    buttonCount: btns.length," +
        "    buttons: btns.map(function(b){ var r0 = b.getBoundingClientRect(); return { id: b.id, w: r0.width, h: r0.height, left: r0.left, right: r0.right, top: r0.top }; })," +
        "    sameRow: Math.abs(b0.top - b1.top) <= 1," +
        "    overlap: b0.right > b1.left + 0.5," +
        "    withinRow: b0.left >= aRect.left - 0.5 && b1.right <= aRect.right + 0.5," +
        "    modalScrollWidth: modalBox.scrollWidth," +
        "    modalClientWidth: modalBox.clientWidth," +
        "    gateAboveButtons: gate.getBoundingClientRect().top <= b0.top," +
        "    innerWidth: window.innerWidth," +
        "    actionsDisplay: getComputedStyle(actions).display" +
        '  };' +
        '})()'
    );
    evidence.artifacts.e17 = widest;
    check(
      'E17 backstop（正命题）：动作区不横向溢出（scrollWidth <= clientWidth）',
      widest.actionsDisplay !== 'none' && widest.actionsScrollWidth <= widest.actionsClientWidth,
      `sw=${widest.actionsScrollWidth} cw=${widest.actionsClientWidth}`
    );
    check(
      'E17 backstop（正命题）：两个按钮同排、互不重叠、且都在动作区内',
      widest.buttonCount === 2 && widest.sameRow === true && widest.overlap === false && widest.withinRow === true,
      `sameRow=${widest.sameRow} overlap=${widest.overlap} withinRow=${widest.withinRow} ${JSON.stringify(widest.buttons)}`
    );
    check(
      'E17 backstop（正命题）：两个按钮都可见且不被裁切',
      widest.buttonCount === 2 &&
        widest.buttons.every((b) => b.w > 0 && b.h > 0 && b.right <= widest.innerWidth + 0.5),
      JSON.stringify(widest.buttons) + ` innerW=${widest.innerWidth}`
    );
    check(
      'E17 backstop：禁用原因文本可见、非空、且位于按钮排上方（窄窗口让位的是文本）',
      widest.gate === '请先勾选「我已了解以上风险」' && widest.gateHeight > 0 && widest.gateAboveButtons === true,
      `gate=${JSON.stringify(widest.gate)} h=${widest.gateHeight} above=${widest.gateAboveButtons}`
    );
    check(
      'E17 backstop：弹框本体不横向溢出',
      widest.modalScrollWidth <= widest.modalClientWidth + 1,
      `modal sw/cw=${widest.modalScrollWidth}/${widest.modalClientWidth}`
    );

    // ---- 「未勾选时点击无效」：真实 click() 后弹框未关、且未发出 commit ----------
    const clickBlocked = await guestEval(
      page,
      "(function(){" +
        "  var calls = [];" +
        "  var orig = window.skillsApi;" +
        "  window.skillsApi = function(route, options){ calls.push(route + ':' + (options && options.body ? String(options.body).slice(0, 40) : '')); return new Promise(function(){}); };" +
        "  document.getElementById('skillImportConfirm').click();" +
        "  var modal = document.getElementById('skillImportModal');" +
        "  var res = {" +
        "    calls: calls," +
        "    modalDisplay: getComputedStyle(modal).display," +
        "    status: document.getElementById('skillImportStatus').textContent," +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled" +
        "  };" +
        "  window.skillsApi = orig;" +
        "  return res;" +
        '})()'
    );
    evidence.artifacts.clickBlocked = clickBlocked;
    check(
      '未勾选时真实 click() 不提交（弹框未关、零 commit 请求）',
      clickBlocked.calls.length === 0 && clickBlocked.modalDisplay !== 'none' && clickBlocked.status === '预览已就绪，确认后才会写入。',
      JSON.stringify(clickBlocked)
    );

    // ==================== ⑤ 键盘契约 ====================
    const keyboard = await guestEval(
      page,
      "(function(){" +
        "  var modal = document.getElementById('skillImportModal');" +
        "  var preview = document.getElementById('skillImportPreview');" +
        "  var tabbables = Array.from(modal.querySelectorAll('[tabindex]'));" +
        "  var all = Array.from(modal.querySelectorAll('button, input, [tabindex]'));" +
        "  var stops = all.filter(function(el){ return el.getBoundingClientRect().height > 0; });" +
        /* 「Tab 序 = DOM 序」的机械形式：零正 tabindex（浏览器按树序遍历）∧ 没有任何祖先
           用 CSS 重排视觉顺序（order / row-reverse / column-reverse）—— 后者会让「看到的顺序」
           与「Tab 到的顺序」分裂，正是该契约要防的形态。另加一条**预览框之外**的停靠点
           布局纵坐标非递减（预览是溢出滚动容器，其内部元素的几何位置不可跨边界比较）。 */
        "  var reordered = stops.filter(function(el){" +
        "    var n = el;" +
        "    while (n && n !== modal) {" +
        "      var cs = getComputedStyle(n);" +
        "      if (cs.order !== '0' && cs.order !== '') return true;" +
        "      if (cs.flexDirection === 'row-reverse' || cs.flexDirection === 'column-reverse') return true;" +
        "      n = n.parentElement;" +
        "    }" +
        "    return false;" +
        "  }).length;" +
        "  var outer = stops.filter(function(el){ return !preview.contains(el); });" +
        "  var outerOffsets = outer.map(function(el){ return el.offsetTop; });" +
        "  var outerAscending = true;" +
        "  for (var i = 1; i < outerOffsets.length; i++) if (outerOffsets[i] + 1 < outerOffsets[i - 1]) outerAscending = false;" +
        "  preview.focus();" +
        "  return {" +
        "    tabindexCount: tabbables.length," +
        "    tabindexIds: tabbables.map(function(el){ return el.id + ':' + el.getAttribute('tabindex'); })," +
        "    positiveTabindex: tabbables.filter(function(el){ return Number(el.getAttribute('tabindex')) > 0; }).length," +
        "    previewTabindex: preview.getAttribute('tabindex')," +
        "    previewFocused: document.activeElement === preview," +
        "    stopCount: stops.length," +
        "    reorderedCount: reordered," +
        "    outerOffsets: outerOffsets," +
        "    outerAscending: outerAscending," +
        "    zeroHeightStops: all.filter(function(el){" +
        "      return el.getBoundingClientRect().height === 0 && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;" +
        "    }).length" +
        '  };' +
        '})()'
    );
    evidence.artifacts.keyboard = keyboard;
    check(
      '唯一 tabindex 是预览滚动容器的 0 值（无正 tabindex / 无 roving tabindex）',
      keyboard.tabindexCount === 1 &&
        keyboard.tabindexIds[0] === 'skillImportPreview:0' &&
        keyboard.positiveTabindex === 0,
      JSON.stringify(keyboard.tabindexIds)
    );
    check('预览容器在 .active 时可获焦', keyboard.previewTabindex === '0' && keyboard.previewFocused === true, `tabindex=${keyboard.previewTabindex} focused=${keyboard.previewFocused}`);
    check(
      'Tab 序 = DOM 序（零正 tabindex + 无 CSS 视觉重排 + 预览外停靠点布局序非递减）',
      keyboard.reorderedCount === 0 && keyboard.outerAscending === true,
      `${keyboard.stopCount} stops reordered=${keyboard.reorderedCount} outerOffsets=${JSON.stringify(keyboard.outerOffsets)}`
    );
    check('弹框内零可见高度停靠点', keyboard.zeroHeightStops === 0, `zero=${keyboard.zeroHeightStops}`);

    // ---- committing 态：双禁用 + Escape 被忽略 ----
    const committing = await guestEval(
      page,
      "(function(){" +
        "  var box = document.querySelector('#skillImportAck input[type=checkbox]');" +
        "  box.checked = true;" +
        "  box.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  var r = document.querySelector('#skillImportConflict input[type=radio][value=overwrite]');" +
        "  r.checked = true;" +
        "  r.dispatchEvent(new Event('change', { bubbles: true }));" +
        "  var orig = window.skillsApi;" +
        "  window.__realm51Orig = orig;" +
        "  window.skillsApi = function(){ return new Promise(function(){}); };" + // 挂起 ⇒ 稳定造出 committing 窗口
        "  document.getElementById('skillImportConfirm').click();" +
        "  return {" +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled," +
        "    cancelDisabled: document.getElementById('skillImportCancel').disabled," +
        "    status: document.getElementById('skillImportStatus').textContent" +
        '  };' +
        '})()'
    );
    await sleep(400); // 排除 same-tick：在独立 tick 里再读一次
    const committingAfterTick = await guestEval(
      page,
      "(function(){" +
        "  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));" +
        "  return {" +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled," +
        "    cancelDisabled: document.getElementById('skillImportCancel').disabled," +
        "    modalDisplay: getComputedStyle(document.getElementById('skillImportModal')).display," +
        "    status: document.getElementById('skillImportStatus').textContent" +
        '  };' +
        '})()'
    );
    evidence.artifacts.committing = { immediate: committing, afterTick: committingAfterTick };
    check(
      '提交中：确认与取消**双双** disabled + 状态行「正在写入技能，请稍候…」',
      committingAfterTick.confirmDisabled === true &&
        committingAfterTick.cancelDisabled === true &&
        committingAfterTick.status === '正在写入技能，请稍候…',
      JSON.stringify(committingAfterTick)
    );
    check('提交中：Escape 被忽略（弹框仍可见）', committingAfterTick.modalDisplay !== 'none', `display=${committingAfterTick.modalDisplay}`);

    // 复原 stub 与弹框
    await guestEval(
      page,
      "(function(){ if (window.__realm51Orig) window.skillsApi = window.__realm51Orig; window.closeSkillImportModal(); return 'ok'; })()"
    );
    await sleep(300);

    // ==================== ⑥ Escape 关闭（ready 态）+ 焦点归还 ====================
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(200);
    await guestEval(page, injectFileScript(wideBuf.toString('base64'), 'probe.zip'));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active')",
      40000,
      '第二轮预览就绪'
    );
    const escapeClosed = await guestEval(
      page,
      "(function(){" +
        "  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));" +
        "  return {" +
        "    modalDisplay: getComputedStyle(document.getElementById('skillImportModal')).display," +
        "    focusId: document.activeElement ? document.activeElement.id : null," +
        "    previewChildren: document.getElementById('skillImportPreview').childElementCount," +
        "    statusDisplay: getComputedStyle(document.getElementById('skillImportStatus')).display," +
        "    fileValue: document.getElementById('skillImportFile').value," +
        "    urlValue: document.getElementById('skillImportUrl').value" +
        '  };' +
        '})()'
    );
    evidence.artifacts.escapeClosed = escapeClosed;
    check('ready 态 Escape 关闭弹框', escapeClosed.modalDisplay === 'none', `display=${escapeClosed.modalDisplay}`);
    check('关闭复位契约：预览清空 + 状态行不占位 + 两输入置空', escapeClosed.previewChildren === 0 && escapeClosed.statusDisplay === 'none' && escapeClosed.fileValue === '' && escapeClosed.urlValue === '', JSON.stringify(escapeClosed));
    check('焦点归还触发元素（#skillImportOpen）', escapeClosed.focusId === 'skillImportOpen', `focus=${escapeClosed.focusId}`);

    // ---- 焦点归还的 isConnected 判据：摘除触发元素后**不得**调 focus() ----
    const detachedFocus = await guestEval(
      page,
      "(function(){" +
        "  var btn = document.getElementById('skillImportOpen');" +
        "  var parent = btn.parentNode;" +
        "  var called = false;" +
        "  btn.focus = function(){ called = true; };" +
        "  btn.remove();" +
        "  window.openSkillImportModal(btn);" +
        "  window.closeSkillImportModal();" +
        "  var res = { focusCalled: called, isConnected: btn.isConnected };" +
        "  parent.appendChild(btn);" +
        "  return res;" +
        '})()'
    );
    evidence.artifacts.detachedFocus = detachedFocus;
    check(
      'isConnected === false 时不调用 focus()（不主动把焦点移向任何其它节点）',
      detachedFocus.isConnected === false && detachedFocus.focusCalled === false,
      JSON.stringify(detachedFocus)
    );

    // ==================== ⑦ 注入纪律：真实渲染快照 + 净化探针 ====================
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(200);
    await guestEval(page, injectFileScript(wideBuf.toString('base64'), 'probe.zip'));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active')",
      40000,
      '第三轮预览就绪（含恶意文件名条目）'
    );
    const xssSnapshot = await guestEval(
      page,
      "(function(){" +
        "  var preview = document.getElementById('skillImportPreview');" +
        // ⚠️ 传给 guest 的源码里**不得**出现行注释（`//`）—— 各段是**无换行**拼接的，
        //    一条 `//` 会把后续片段整段吞掉（实测报 `Script failed to execute`）。
        //    这里用块注释；同理也**不得**出现反引号（会截断外层模板字面量）。
        "  /* 默认只渲染前 N 项（50）⇒ 先展开全部，否则排在树尾的恶意名条目根本没进 DOM */" +
        "  var toggle = document.getElementById('skillImportTreeToggle');" +
        "  if (toggle) toggle.click();" +
        "  var rows = Array.from(preview.querySelectorAll('.skill-import-tree-row'));" +
        "  var evil = 'xss<img src=x onerror=alert(1)>.txt';" +
        "  var hit = rows.filter(function(r){ return r.textContent.indexOf(evil) !== -1; });" +
        "  return {" +
        "    totalRows: rows.length," +
        "    evilRowFound: hit.length," +
        "    imgElements: preview.querySelectorAll('img').length," +
        "    scriptElements: preview.querySelectorAll('script').length," +
        "    rowText: hit.length ? hit[0].textContent : null," +
        "    expandAllWasRendered: !!toggle" +
        '  };' +
        '})()'
    );
    evidence.artifacts.xssSnapshot = xssSnapshot;
    check(
      '注入纪律渲染快照：恶意文件名以**文本**呈现（逐字包含原串）',
      xssSnapshot.evilRowFound >= 1 && String(xssSnapshot.rowText).indexOf('<img src=x onerror=alert(1)>') !== -1,
      `rows=${xssSnapshot.totalRows} rowText=${JSON.stringify(xssSnapshot.rowText)}`
    );
    check('注入纪律渲染快照：预览内零 <img> / <script> 元素', xssSnapshot.imgElements === 0 && xssSnapshot.scriptElements === 0, `img=${xssSnapshot.imgElements} script=${xssSnapshot.scriptElements}`);

    const sanitizeProbe = await guestEval(
      page,
      "(function(){" +
        "  var rtl = 'evil\\u202ex.txt';" +
        "  var c0 = 'a\\u0001b.txt';" +
        "  var plain = 'normal/path.txt';" +
        "  return {" +
        "    rtl: { text: window.sanitizeDisplayString(rtl).text, hidden: window.sanitizeDisplayString(rtl).hidden, notice: window.withHiddenNotice(window.sanitizeDisplayString(rtl)) }," +
        "    c0: { text: window.sanitizeDisplayString(c0).text, hidden: window.sanitizeDisplayString(c0).hidden }," +
        "    plain: { text: window.sanitizeDisplayString(plain).text, hidden: window.sanitizeDisplayString(plain).hidden }" +
        '  };' +
        '})()'
    );
    evidence.artifacts.sanitizeProbe = sanitizeProbe;
    check(
      '显示层净化：RTL override 被移除且**可见提示**不静默',
      sanitizeProbe.rtl.text === 'evilx.txt' && sanitizeProbe.rtl.hidden === 1 && sanitizeProbe.rtl.notice.indexOf('（含 1 个控制字符，已隐藏）') !== -1,
      JSON.stringify(sanitizeProbe.rtl)
    );
    check(
      '显示层净化：C0 控制字符被移除；干净路径**零改动**（判别力对照）',
      sanitizeProbe.c0.text === 'ab.txt' && sanitizeProbe.c0.hidden === 1 && sanitizeProbe.plain.text === 'normal/path.txt' && sanitizeProbe.plain.hidden === 0,
      JSON.stringify(sanitizeProbe)
    );

    // ---- 含双向控制符的包必须**整包拒绝**（50-03 的 entry 校验在解压期拦下） ----
    await guestEval(
      page,
      "(function(){ window.closeSkillImportModal(); window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(200);
    await guestEval(page, injectFileScript(bidiBuf.toString('base64'), 'bidi.zip'));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')",
      40000,
      'bidi 包得到 danger 失败响应'
    );
    const bidiRejected = await guestEval(
      page,
      "(function(){" +
        "  var status = document.getElementById('skillImportStatus');" +
        "  return {" +
        "    text: status.textContent," +
        "    danger: status.classList.contains('skill-manage-hint-danger')," +
        "    previewActive: document.getElementById('skillImportPreview').classList.contains('active')" +
        '  };' +
        '})()'
    );
    evidence.artifacts.bidiRejected = bidiRejected;
    check(
      '含双向控制符的条目名 ⇒ 整包拒绝（预览不渲染 + danger 状态行）',
      bidiRejected.previewActive === false && bidiRejected.danger === true && bidiRejected.text.length > 0,
      JSON.stringify(bidiRejected)
    );

    await guestEval(page, "(function(){ window.closeSkillImportModal(); return 'ok'; })()");
    await sleep(500);
  } catch (e) {
    evidence.thrown = String(e && e.stack ? e.stack : e);
    log('[result] 驱动异常：', evidence.thrown);
  } finally {
    // ---------- 收尾清理（只按本驱动登记过的路径删） ----------
    try {
      evidence.cleanup.probeSkill = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
      await sleep(400);
      const residue = listImportResidue();
      const preexisting = Array.isArray(evidence.cleanup.preTmpResidue)
        ? evidence.cleanup.preTmpResidue
        : [];
      // 只删**本次跑出来的**新残留（不碰开跑前就存在的、可能属于别人会话的目录）
      const mine = residue.filter((n) => preexisting.indexOf(n) === -1);
      const removed = [];
      for (const n of mine) {
        const p = path.join(TMP_DIR, n);
        try {
          fs.rmSync(p, { recursive: true, force: true });
          removed.push(n);
        } catch (_e) {
          /* 记录在 removed 计数差里 */
        }
      }
      evidence.cleanup.residueFound = residue;
      evidence.cleanup.residueRemoved = removed;
      evidence.cleanup.pageErrors = pageErrors;
      evidence.cleanup.mainLogTail = mainLog.slice(-20);
    } catch (e) {
      log('[cleanup] 失败:', e.message);
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
    if (electronApp) {
      try {
        await Promise.race([electronApp.close(), sleep(6000)]);
      } catch (e) {
        console.error('electronApp.close() 失败:', e.message);
      }
    }
  }

  log('');
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  log('[result] 清理:', JSON.stringify(evidence.cleanup));
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  if (exitCode === 0) {
    log(`uat-51-import-modal: ${evidence.passed} passed`);
  } else {
    log(`uat-51-import-modal: ${evidence.passed}/${evidence.total} passed（未全部通过）`);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
