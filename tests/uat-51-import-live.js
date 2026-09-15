#!/usr/bin/env node
/**
 * UAT 驱动（Phase 51 · 真实网络面）—— 把 `51-UAT.md` 的 Test 1 与 Test 2 从人工面自动化。
 *
 * 覆盖
 * ----
 * **Test 1（真实 GitHub 端到端成功路径）**
 *   ① Node 侧**真实交叉核对** zipball：下载 `codeload.github.com/anthropics/skills/zip/refs/heads/main`
 *      → 用 `yauzl` 读 entry 名单 → 断言**全部** entry 的顶层前缀恰为 `skills-main/`（`<repo>-<ref>/`
 *      形态）且 `skills-main/skills/pdf/SKILL.md` 是该 scope 下**唯一**的 SKILL.md，
 *      并记下它的 `sha256` 供落盘后逐字节比对。
 *   ② 经**真实设置页 UI**（网络地址模式）发起导入：预览六字段 → 必勾 → 确认 → 落盘。
 *   ③ 落盘断言：`agent-workspace/skills/pdf/SKILL.md` 存在，且 `sha256` 与上游**逐字节相同**
 *      （证明 zipball 的 `skills-main/` 前缀与 scopeRel 都被正确剥离 —— 落点不是
 *      `skills/skills-main-skills-pdf/`）。
 *   ④ 组件列表（设置页「技能管理」）出现该技能 → `/` 面板出现该技能行。
 *   ⑤ 「下一条消息技能进 prompt」：**真实发送** `/skill:pdf …`，在主进程侧捕获
 *      provider 请求体，断言其中含技能块（含技能名与正文片段）。
 *      发送走真实 provider（`ai.activeProvider` 的 Key 由环境变量 `XIAOMI_API_KEY` 注入），
 *      捕获是**旁路观测**，不改写请求、不伪造响应 —— 请求真的发出去、真的拿到回复。
 *
 * **Test 2（403 / 429 / 404 的可操作文案）**
 *   - **真实 404**：`github.com/anthropics/skills/tree/<不存在的 ref>/skills/pdf` ⇒ codeload 真返 404。
 *   - **403 / 429**：导入链路只打 `codeload.github.com`（**不打 `api.github.com`**），
 *     无法在不压垮真实配额的前提下真实触发 ⇒ 用 `net.fetch` 的单点替身返回带
 *     `x-ratelimit-remaining: 0` / `retry-after` 的真实形状响应，**其余全部走真链路**
 *     （白名单 → 逐跳私网校验 → 跳数 → 状态分类 → HTTP 序列化 → 设置页文案表 → 状态行渲染）。
 *     ⚠ 这三条替代路径在证据里标 `substituted: true`，不得读成「真实触发过 GitHub 限流」。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js
 *
 * `playwright` **只在全局**；取 Electron 走**裸说明符** `require('electron')`
 * （拼绝对路径在 worktree 内会 MODULE_NOT_FOUND —— 见 `docs/dev/branching-spec.md` 第三节）。
 *
 * 只启动**本进程自己拉起的** realm-dev 子进程；收尾固定 `electronApp.close()` +
 * `process.exit(code)`，**严禁** `pkill` / `pgrep` 模式匹配杀进程。
 *
 * ⚠ 本驱动会**真实写入** realm-dev userData：`agent-workspace/skills/pdf/`
 * （来自 anthropics/skills 的公开技能）。开跑前与收尾都清一次；中断后人工复查：
 *     ls ~/Library/Application\ Support/realm-dev/agent-workspace/skills | grep pdf
 * 它还会**真实发送一次 AI 消息**到 `ai.activeProvider`（消耗一次真实额度）。
 *
 * 产物：`tests/.uat-out/uat-51-import-live.json`
 * 退出码：全通过 → 0；任一条失败 → 非零（11 = 缺全局 playwright / 12 = 仓内无 Electron）。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tests', '.uat-out');
const EVIDENCE_PATH = path.join(OUT_DIR, 'uat-51-import-live.json');

const HOME = process.env.HOME;
const APP_SUPPORT = path.join(HOME, 'Library', 'Application Support', 'realm-dev');
const WORKSPACE = path.join(APP_SUPPORT, 'agent-workspace');
const USER_SKILLS_DIR = path.join(WORKSPACE, 'skills');
const TMP_DIR = path.join(WORKSPACE, '.tmp');

/** 上游：含**恰好一个**技能根的公开仓库子目录（`skills/pdf` 子树恰 1 个 SKILL.md） */
const UPSTREAM = {
  owner: 'anthropics',
  repo: 'skills',
  ref: 'main',
  scope: 'skills/pdf',
  skillName: 'pdf',
};
const ZIPBALL_URL = `https://codeload.github.com/${UPSTREAM.owner}/${UPSTREAM.repo}/zip/refs/heads/${UPSTREAM.ref}`;
/** zipball 顶层前缀形态 `<repo>-<ref>/`（本驱动第一判据的真值） */
const EXPECTED_TOP_PREFIX = `${UPSTREAM.repo}-${UPSTREAM.ref}/`;
/** 用户在设置页粘贴的地址（`tree/<ref>/<path>` 形态） */
const TREE_URL = `https://github.com/${UPSTREAM.owner}/${UPSTREAM.repo}/tree/${UPSTREAM.ref}/${UPSTREAM.scope}`;
/** 真实 404：ref 不存在 ⇒ codeload 真返 404（不靠替身） */
const REAL_404_URL = `https://github.com/${UPSTREAM.owner}/${UPSTREAM.repo}/tree/zzq51-no-such-ref-9f3a/${UPSTREAM.scope}`;
/** 403 / 429 的替身命中域名（白名单内、走真链路；响应由 net.fetch 替身给出） */
const STUB_403_URL = 'https://github.com/zzq51-stub/rate-limited-403';
const STUB_429_URL = 'https://github.com/zzq51-stub/rate-limited-429';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: String(detail == null ? '' : detail) });
  log(`  [${pass ? 'ok' : '!!'}] ${name} — ${detail}`);
  return !!pass;
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

// ==================== ① Node 侧真实交叉核对 zipball（零 Electron） ====================

/** 下载 zipball 到临时文件（直连：本机 `NO_PROXY` 不含 github，Node 侧不要走代理） */
function downloadToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(res.statusCode)));
      })
      .on('error', (e) => {
        file.close();
        reject(e);
      });
  });
}

/** 读 zip entry 名单 + 指定 entry 的正文（yauzl 走 lazyEntries 顺序读） */
function readZipEntries(zipPath, wantedEntry) {
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) {
        reject(err);
        return;
      }
      const names = [];
      let wanted = null;
      zip.on('entry', (entry) => {
        names.push(entry.fileName);
        if (entry.fileName === wantedEntry) {
          zip.openReadStream(entry, (e2, stream) => {
            if (e2) {
              reject(e2);
              return;
            }
            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => {
              wanted = Buffer.concat(chunks);
              zip.readEntry();
            });
          });
          return;
        }
        zip.readEntry();
      });
      zip.on('end', () => resolve({ names, wanted }));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

// ==================== guest 交互（与 tests/uat-51-import-modal.js 同款） ====================

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
      // 设置页 webview 尚未挂进 DOM（no settings webview）也是「尚未就绪」，不是断言失败
      last = 'not-ready: ' + (e && e.message ? e.message : e);
    }
    if (last === true) return true;
    await sleep(300);
  }
  throw new Error(`等待超时（${label}）：最后取值 = ${JSON.stringify(last)}`);
}

/** 触发一轮真实的「获取预览」（URL 模式，真实网络） */
function fetchPreviewScript(url) {
  return (
    '(function(){' +
    "  document.getElementById('skillImportTabUrl').click();" +
    "  var u = document.getElementById('skillImportUrl');" +
    "  u.value = '" + url + "';" +
    "  u.dispatchEvent(new Event('input', { bubbles: true }));" +
    "  document.getElementById('skillImportFetch').click();" +
    "  return 'requested';" +
    '})()'
  );
}

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

/** 读弹框状态行（danger/success 类名 + 文本 + 是否可见 + 预览是否就绪） */
const READ_STATUS_SRC =
  '(function(){' +
  "  var el = document.getElementById('skillImportStatus');" +
  "  var pv = document.getElementById('skillImportPreview');" +
  '  return {' +
  '    text: el ? el.textContent : null,' +
  "    danger: el ? el.classList.contains('skill-manage-hint-danger') : null," +
  "    success: el ? el.classList.contains('skill-manage-hint-success') : null," +
  "    display: el ? getComputedStyle(el).display : null," +
  "    previewActive: pv ? pv.classList.contains('active') : null," +
  "    gate: (document.getElementById('skillImportGate') || {}).textContent" +
  '  };' +
  '})()';

async function main() {
  const started = new Date().toISOString();
  const evidence = {
    driver: 'tests/uat-51-import-live.js',
    covers: ['UAT-51-test-1', 'UAT-51-test-2'],
    started,
    finished: null,
    node: process.version,
    upstream: { ...UPSTREAM, zipballUrl: ZIPBALL_URL, treeUrl: TREE_URL, real404Url: REAL_404_URL },
    preflight: {},
    artifacts: {},
    assertions: results,
    cleanup: {},
    exitCode: null,
  };

  log('=== 前置清理（上一轮中断可能留下的残留） ===');
  evidence.cleanup.preSkillDir = removeDirIfAny(path.join(USER_SKILLS_DIR, UPSTREAM.skillName));
  evidence.cleanup.preTmpResidue = listImportResidue();

  let pwOk = false;
  try {
    pwOk = !!require('playwright')._electron;
  } catch (err) {
    console.error('E-PW require("playwright") 失败:', err.message);
    console.error('请用 NODE_PATH="$(npm root -g)" node tests/uat-51-import-live.js 运行');
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
  /** AI 侧栏的原可见性（在 try 内赋值、在 finally 里用于还原 ⇒ 必须声明在 try 之外） */
  let panelWasHidden = null;
  /** 应用自身退出的记录（区分「应用退出」与「页面被关」） */
  let appExit = null;
  let launchAt = Date.now();

  try {
    // ---------- ① Node 侧真实交叉核对（先证明夹具与上游事实，避免把网络问题误判为 UI 失败） ----------
    log('=== ① 真实 zipball 交叉核对（Node 侧，零 Electron） ===');
    const zipPath = path.join(os.tmpdir(), `zzq51-upstream-${process.pid}.zip`);
    const t0 = Date.now();
    await downloadToFile(ZIPBALL_URL, zipPath);
    const downloadMs = Date.now() - t0;
    const zipBytes = fs.statSync(zipPath).size;
    const wantedRel = `${EXPECTED_TOP_PREFIX}${UPSTREAM.scope}/SKILL.md`;
    const { names, wanted } = await readZipEntries(zipPath, wantedRel);
    const topPrefixes = Array.from(new Set(names.map((n) => n.split('/')[0])));
    const skillMdCount = names.filter((n) => n.startsWith(`${EXPECTED_TOP_PREFIX}${UPSTREAM.scope}/`) && n.endsWith('/SKILL.md')).length;
    const upstreamSha = wanted ? crypto.createHash('sha256').update(wanted).digest('hex') : null;
    evidence.artifacts.upstream = {
      zipBytes,
      downloadMs,
      entryCount: names.length,
      topPrefixes,
      skillMdCountInScope: skillMdCount,
      wantedRel,
      skillMdBytes: wanted ? wanted.length : null,
      skillMdSha256: upstreamSha,
      firstEntries: names.slice(0, 4),
    };
    log(`  zipball ${zipBytes} B / ${names.length} entry / ${downloadMs} ms → 顶层前缀 ${JSON.stringify(topPrefixes)}`);

    check(
      '交叉核对：zipball 顶层前缀恰为单一 `<repo>-<ref>/`（skills-main/）',
      topPrefixes.length === 1 && topPrefixes[0] === `${UPSTREAM.repo}-${UPSTREAM.ref}`,
      JSON.stringify(topPrefixes)
    );
    check(
      '交叉核对：scope 子树下恰有 1 个 SKILL.md（「恰好一个技能根」的前提成立）',
      skillMdCount === 1 && !!wanted,
      `count=${skillMdCount} rel=${wantedRel} bytes=${wanted ? wanted.length : 0}`
    );
    check(
      '交叉核对：上游 SKILL.md 可读且非空（落盘比对的基准存在）',
      !!wanted && wanted.length > 0,
      `sha256=${upstreamSha}`
    );
    try {
      fs.rmSync(zipPath, { force: true });
    } catch (_e) {
      /* 临时文件删不掉不影响判据 */
    }

    // ---------- ② 启动真实 dev 应用 ----------
    log('=== ② 启动真实 dev 应用 ===');
    launchAt = Date.now();
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
      // 追踪应用自身的退出（窗口在等待期间消失时，用来区分「应用退出」与「页面被关」）
      proc.on('exit', (code, signal) => {
        appExit = { code, signal, at: new Date().toISOString(), elapsedMs: Date.now() - launchAt };
      });
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
      '技能管理区进入布局（行高 > 0）'
    );

    // ==================== ③ Test 1：真实 GitHub 端到端 ====================
    log('=== ③ Test 1：真实 GitHub 端到端（网络地址导入） ===');
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(300);
    const beforeCount = await guestEval(page, "document.querySelectorAll('.skill-manage-row').length");
    evidence.artifacts.managementRowsBefore = beforeCount;

    const tImport = Date.now();
    await guestEval(page, fetchPreviewScript(TREE_URL));
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active') || document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')",
      120000,
      '真实网络预览返回（就绪或明确失败）'
    );
    const importMs = Date.now() - tImport;

    const preview = await guestEval(
      page,
      "(function(){" +
        "  var labels = Array.from(document.querySelectorAll('#skillImportPreview .skill-import-label')).map(function(e){return e.textContent;});" +
        "  var values = Array.from(document.querySelectorAll('#skillImportPreview .skill-import-value')).map(function(e){return e.textContent;});" +
        '  return {' +
        "    status: document.getElementById('skillImportStatus').textContent," +
        "    danger: document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')," +
        "    previewActive: document.getElementById('skillImportPreview').classList.contains('active')," +
        '    labels: labels,' +
        '    values: values,' +
        "    confirmDisabled: document.getElementById('skillImportConfirm').disabled," +
        "    ackPresent: document.getElementById('skillImportAck').childElementCount > 0," +
        "    conflictPresent: document.getElementById('skillImportConflict').childElementCount > 0," +
        '    name: (window.skillImportTarget && window.skillImportTarget.preview) ? window.skillImportTarget.preview.name : null' +
        '  };' +
        '})()'
    );
    evidence.artifacts.importPreview = { ...preview, elapsedMs: importMs };

    check(
      'Test1：真实网络导入进入就绪态（非 danger、预览已渲染）',
      preview.previewActive === true && preview.danger === false,
      `elapsed=${importMs}ms status=${JSON.stringify(preview.status)}`
    );
    {
      const expectedLabels = ['技能名', '落点', '描述', '目录', '体积', '脚本'];
      const missing = expectedLabels.filter((l) => preview.labels.indexOf(l) === -1);
      check(
        'Test1：预览六字段齐备（技能名 / 落点 / 描述 / 目录 / 体积 / 脚本）',
        missing.length === 0,
        `missing=${JSON.stringify(missing)} labels=${JSON.stringify(preview.labels)}`
      );
      const joined = preview.labels.map((l, i) => l + '=' + preview.values[i]).join(' | ');
      evidence.artifacts.fieldPairs = joined;
      const idx = preview.labels.indexOf('技能名');
      check(
        'Test1：技能名 = pdf（来自上游 frontmatter，不是 zipball 目录名）',
        idx >= 0 && String(preview.values[idx]).indexOf(UPSTREAM.skillName) !== -1,
        joined
      );
    }
    check(
      'Test1：同名冲突区**未**渲染（realm-dev 无同名技能 ⇒ 走无冲突档）',
      preview.conflictPresent === false,
      `conflictPresent=${preview.conflictPresent}`
    );

    // 预览未就绪 ⇒ 后续「确认 → 落盘 → 列表 → `/` 面板 → prompt」整条链**依赖**它，
    // 全部跳过并注明阻塞原因（不假装通过，也不因一条失败丢掉 Test 2 的判据）。
    const previewReady = preview.previewActive === true && preview.danger === false;
    const landedPath = path.join(USER_SKILLS_DIR, UPSTREAM.skillName, 'SKILL.md');
    let landedExists = false;
    let landedBuf = null;
    let landedSha = null;
    let landedDirEntries = 0;
    let badPrefixes = [];
    let successHint = null;
    let managementRows = { total: 0, hitCount: 0, hitText: null, beforeCount: beforeCount };
    let picker = { rowCount: 0, skillRowNames: [], skipped: true };

    if (!previewReady) {
      log(`  [skip] 预览未就绪（status=${JSON.stringify(preview.status)}）⇒ 跳过确认 / 落盘 / 列表 / 面板 / prompt 五腿`);
    } else {
      const confirmRes = await guestEval(
        page,
        "(function(){" +
          "  var box = document.querySelector('#skillImportAck input[type=checkbox]');" +
          "  if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); }" +
          "  var confirm = document.getElementById('skillImportConfirm');" +
          '  var beforeDisabled = confirm.disabled;' +
          '  confirm.click();' +
          '  return { beforeDisabled: beforeDisabled, ackExisted: !!box };' +
          '})()'
      );
      evidence.artifacts.confirmClick = confirmRes;
      await guestWaitFor(
        page,
        "getComputedStyle(document.getElementById('skillImportModal')).display === 'none'",
        60000,
        '导入提交后弹框关闭'
      );
      // 区级 hint 有 2000ms 自动清空窗口 ⇒ 关闭后立刻读
      successHint = await guestEval(
        page,
        "(function(){ var el = document.getElementById('skillManageHint'); return el ? el.textContent : null; })()"
      );
      evidence.artifacts.successHint = successHint;

      landedExists = fs.existsSync(landedPath);
      landedBuf = landedExists ? fs.readFileSync(landedPath) : null;
      landedSha = landedBuf ? crypto.createHash('sha256').update(landedBuf).digest('hex') : null;
      landedDirEntries = fs.existsSync(path.join(USER_SKILLS_DIR, UPSTREAM.skillName))
        ? fs.readdirSync(path.join(USER_SKILLS_DIR, UPSTREAM.skillName)).length
        : 0;
      badPrefixes = fs.existsSync(USER_SKILLS_DIR)
        ? fs.readdirSync(USER_SKILLS_DIR).filter((n) => n.indexOf('skills-main') !== -1)
        : [];
    }
    evidence.artifacts.landed = {
      landedPath,
      exists: landedExists,
      bytes: landedBuf ? landedBuf.length : null,
      sha256: landedSha,
      dirEntries: landedDirEntries,
      badNameDirs: badPrefixes,
    };

    if (previewReady) {
      check('Test1：落盘 `agent-workspace/skills/pdf/SKILL.md` 存在', landedExists, landedPath);
      check(
        'Test1：落盘正文与上游**逐字节相同**（sha256 相等）',
        !!landedSha && landedSha === upstreamSha,
        `落盘=${landedSha} 上游=${upstreamSha}`
      );
      check(
        'Test1：zipball 顶层 `<repo>-<ref>/` 前缀与 scopeRel 都被剥离（无 skills-main* 目录）',
        badPrefixes.length === 0,
        `bad=${JSON.stringify(badPrefixes)}`
      );
      check(
        'Test1：技能目录回读可见（含 SKILL.md 之外的条目）',
        landedDirEntries > 1,
        `entries=${landedDirEntries}`
      );
      check(
        'Test1：提交后区级 hint 报「已导入」（弹框关闭后走区级提示）',
        typeof successHint === 'string' &&
          successHint.indexOf('已导入') !== -1 &&
          successHint.indexOf(UPSTREAM.skillName) !== -1,
        JSON.stringify(successHint)
      );

      // 组件列表（设置页「技能管理」）
      await guestEval(page, "(function(){ window.loadSkillManagement(); return 'ok'; })()");
      await sleep(2000);
      managementRows = await guestEval(
        page,
        "(function(){" +
          "  var rows = Array.from(document.querySelectorAll('.skill-manage-row'));" +
          "  var hit = rows.filter(function(r){ var n = r.querySelector('.skill-manage-name'); return n && n.textContent.trim() === '" + UPSTREAM.skillName + "'; });" +
          '  return {' +
          '    total: rows.length,' +
          '    hitCount: hit.length,' +
          "    hitText: hit.length ? hit[0].textContent.slice(0, 160) : null," +
          '    beforeCount: ' + beforeCount +
          '  };' +
          '})()'
      );
      evidence.artifacts.managementRows = managementRows;
      check(
        'Test1：组件列表（技能管理）出现该技能，且总数 +1',
        managementRows.hitCount === 1 && managementRows.total === beforeCount + 1,
        `hit=${managementRows.hitCount} total=${managementRows.total} (before=${beforeCount})`
      );

      // ==================== ④ `/` 面板 ====================
      picker = await page.evaluate(() => {
        const panel = document.getElementById('aiPanel');
        if (panel && panel.classList.contains('hidden') && typeof window.toggleAIPanel === 'function') {
          window.toggleAIPanel();
        }
        const input = document.getElementById('aiInput');
        if (input) {
          input.value = '/';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (typeof window.openSlashPicker === 'function') window.openSlashPicker();
        const list = document.getElementById('slashPickerList');
        const rows = list ? Array.from(list.querySelectorAll('.slash-picker-row')) : [];
        return {
          panelHidden: panel ? panel.classList.contains('hidden') : null,
          pickerOpen: typeof window.openSlashPicker === 'function',
          rowCount: rows.length,
          skillRowNames: rows
            .filter((r) => r.classList.contains('slash-picker-row-skill'))
            .map((r) => {
              const n = r.querySelector('.slash-picker-name');
              return n ? n.textContent.trim() : '';
            }),
        };
      });
      evidence.artifacts.slashPicker = picker;
      check(
        'Test1：`/` 面板出现该技能（技能行 `/pdf`）',
        picker.skillRowNames.indexOf('/' + UPSTREAM.skillName) !== -1,
        `rows=${picker.rowCount} skills=${JSON.stringify(picker.skillRowNames.slice(0, 20))}`
      );
    } else {
      log('  [skip] 落盘 / 回读 / 组件列表 / `/` 面板 四腿因预览未就绪而跳过');
    }

    // ==================== ⑤ 下一条消息技能进 prompt ====================
    log('=== ⑤ 下一条消息技能进 prompt（真实发送 / 旁路捕获） ===');
    // 主进程侧：旁路捕获 provider 请求体（不改写请求、不伪造响应）
    //
    // `net.fetch` 的替身同时**只拦** `zzq51-stub` 域名（Test 2 的 403 / 429），其余 URL 一律转发。
    // 故本段必须装在 Test 2 之前、且 Test 2 的真实 404 用例前先卸掉。
    const PATCH_SRC =
      '(() => {' +
      '  const w = globalThis;' +
      '  if (!w.__zzq51) w.__zzq51 = { hits: 0, hitsNet: 0, matched: [], seenUrls: [] };' +
      '  const s = w.__zzq51;' +
      '  const getElectronNet = () => {' +
      '    const cands = [];' +
      "    try { if (typeof require === 'function') cands.push(require('electron')); } catch (e) {}" +
      "    try { if (process.mainModule) cands.push(process.mainModule.require('electron')); } catch (e) {}" +
      "    try { cands.push(process.mainModule.require('module').createRequire(process.execPath)('electron')); } catch (e) {}" +
      '    for (const c of cands) { if (c && c.net && typeof c.net.fetch === "function") return c.net; }' +
      '    return null;' +
      '  };' +
      "  const unwrap = (input) => { try { return typeof input === 'string' ? input : ((input && input.url) ? String(input.url) : String(input)); } catch (e) { return ''; } };" +
      '  const inspect = (u, init) => {' +
      '    s.hits++;' +
      '    if (s.seenUrls.length < 40) s.seenUrls.push(u);' +
      "    let body = null; try { body = init && init.body; } catch (e) { body = null; }" +
      '    const isStr = typeof body === "string";' +
      /* ⚠ 请求体是 **JSON**，技能块里的引号被转义成 \\" ⇒ 必须先把 \\" 还原再搜
         （否则 `<skill name="pdf"` 恒搜不到，而正文本句能搜到 —— 表现为
         hasSkillBody=true / hasSkillBlock=false 的诡异一半绿）。 */
      '    const text = isStr ? body.split("\\\\\\"").join("\\"") : null;' +
      '    const hasSkillBlock = !!text && text.indexOf("<skill name=\\"' + UPSTREAM.skillName + '\\"") !== -1;' +
      '    const hasSkillBody = !!text && text.indexOf("Use this skill whenever the user wants to do anything with PDF files") !== -1;' +
      '    let blockSnippet = null;' +
      '    if (text) { const at = text.indexOf("<skill name="); if (at >= 0) blockSnippet = text.slice(at, at + 120); }' +
      '    if (hasSkillBlock || hasSkillBody) s.matched.push({ url: u, bodyType: typeof body, bodyLen: isStr ? text.length : null, hasSkillBlock: hasSkillBlock, hasSkillBody: hasSkillBody, blockSnippet: blockSnippet });' +
      '  };' +
      '  if (!s.patchedGlobal && typeof w.fetch === "function") {' +
      '    s.origGlobal = w.fetch;' +
      '    w.fetch = function (input, init) { try { inspect(unwrap(input), init); } catch (e) {} return s.origGlobal.apply(this, arguments); };' +
      '    s.patchedGlobal = true;' +
      '  }' +
      '  const electronNet = getElectronNet();' +
      '  if (!electronNet) s.netPatchError = "no-electron-net";' +
      '  if (electronNet && !s.patchedNet && typeof electronNet.fetch === "function") {' +
      '    s.origNet = electronNet.fetch;' +
      '    s.origNetThis = electronNet;' +
      '    electronNet.fetch = function (input, init) {' +
      '      try {' +
      '        s.hitsNet++;' +
      '        const u = unwrap(input);' +
      '        if (u.indexOf("zzq51-stub") !== -1) {' +
      '          const is429 = u.indexOf("429") !== -1;' +
      '          const hdr = { "content-type": "application/json", "x-ratelimit-remaining": is429 ? "57" : "0", "x-ratelimit-limit": "60" };' +
      '          if (is429) hdr["retry-after"] = "42";' +
      '          return Promise.resolve({ status: is429 ? 429 : 403, headers: { get: (n) => hdr[String(n).toLowerCase()] || null } });' +
      '        }' +
      '        inspect(u, init);' +
      '      } catch (e) {}' +
      '      return s.origNet.apply(s.origNetThis, arguments);' +
      '    };' +
      '    s.patchedNet = true;' +
      '  }' +
      '  return { patchedGlobal: !!s.patchedGlobal, patchedNet: !!s.patchedNet, netPatchError: s.netPatchError || null };' +
      '})()';

    const patchRes = await electronApp.evaluate(PATCH_SRC);
    evidence.artifacts.patch = patchRes;
    log('  [patch]', JSON.stringify(patchRes));
    check(
      'Test1/2 前置：provider 请求捕获器已装入主进程（globalThis.fetch）',
      patchRes.patchedGlobal === true,
      JSON.stringify(patchRes)
    );
    check(
      'Test2 前置：`net.fetch` 替身已装入（403 / 429 的替代路径可用）',
      patchRes.patchedNet === true,
      JSON.stringify(patchRes)
    );

    let promptLegError = null;
    // 记下 AI 侧栏的原状态：本腿会把它打开（否则 `/` 面板无宿主），收尾必须还原 ——
    // 否则 `aiPanelOpen` 会被持久化，后续驱动的窗口宽度→guest 宽度映射被侧栏宽度整体偏移。
    try {
      panelWasHidden = await page.evaluate(() => {
        const p = document.getElementById('aiPanel');
        return p ? p.classList.contains('hidden') : null;
      });
      evidence.artifacts.aiPanelWasHidden = panelWasHidden;
      await page.evaluate(async () => {
        const panel = document.getElementById('aiPanel');
        if (panel && panel.classList.contains('hidden') && typeof window.toggleAIPanel === 'function') {
          window.toggleAIPanel();
        }
        if (typeof window.closeSlashPicker === 'function') window.closeSlashPicker();
        const input = document.getElementById('aiInput');
        input.value = '/skill:' + 'pdf' + ' 请总结这个技能的第一节';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await window.handleSendAIMessage();
        return 'sent';
      });
    } catch (e) {
      promptLegError = String(e && e.message ? e.message : e);
    }
    evidence.artifacts.promptLegError = promptLegError;
    await sleep(12000); // 给真实 provider 往返留出窗口（捕获发生在请求发出的那一刻）

    const capture = await electronApp.evaluate(
      '(() => { const s = globalThis.__zzq51 || {}; return { hits: s.hits || 0, hitsNet: s.hitsNet || 0, matched: s.matched || [], seenUrls: s.seenUrls || [] }; })()'
    );
    evidence.artifacts.promptCapture = capture;
    log('  [capture]', JSON.stringify({ hits: capture.hits, hitsNet: capture.hitsNet, matched: capture.matched.length }));

    check(
      'Test1：主进程真的发出了 provider 请求（捕获器有命中，不是空跑）',
      capture.hits + capture.hitsNet > 0,
      `global=${capture.hits} net=${capture.hitsNet} urls=${JSON.stringify(capture.seenUrls.slice(0, 5))}`
    );
    check(
      'Test1：下一条消息的请求体**含技能块**（`<skill name="pdf"`）',
      capture.matched.length > 0 && capture.matched.some((m) => m.hasSkillBlock === true),
      JSON.stringify(capture.matched.slice(0, 3))
    );
    check(
      'Test1：请求体含该技能的**真实正文**（上游 SKILL.md 首句）',
      capture.matched.some((m) => m.hasSkillBody === true),
      JSON.stringify(capture.matched.slice(0, 3))
    );

    // 收尾：只卸 `globalThis.fetch` 的捕获器（provider 腿已结束）。
    // ⚠️ **必须留着 `net.fetch` 的替身** —— Test 2 的 403 / 429 还要靠它。
    // 实测教训：这里一起卸掉会让 403 / 429 走到真实 fetch（拿到 codeload 的真 404），
    // 表现为「替身装了却 hitsNet=0、文案是 404 的」。
    const unpatchRes = await electronApp.evaluate(
      '(() => { const s = globalThis.__zzq51 || {};' +
        ' if (s.patchedGlobal && s.origGlobal) globalThis.fetch = s.origGlobal;' +
        ' s.patchedGlobal = false;' +
        ' return { restoredGlobal: true, netStubStillArmed: !!s.patchedNet }; })()'
    );
    evidence.artifacts.unpatch = unpatchRes;
    check(
      'Test2 前置：`net.fetch` 替身在 provider 腿收尾后**仍然装着**（403 / 429 要用它）',
      unpatchRes.netStubStillArmed === true,
      JSON.stringify(unpatchRes)
    );

    // ==================== ⑥ Test 2：403 / 429 / 404 ====================
    log('=== ⑥ Test 2：403 / 429 / 404 的可操作文案 ===');
    // net.fetch 的替身已在上一步装好（只拦 zzq51-stub 域名，其余全放行）
    const stubCases = [
      { key: '403', url: STUB_403_URL, expect: /403/, must: /重试|改用本地上传/ },
      { key: '429', url: STUB_429_URL, expect: /429/, must: /限流/ },
      { key: '404-real', url: REAL_404_URL, expect: /404/, must: /ref|不存在/ },
    ];
    const stubResults = {};
    for (const c of stubCases) {
      if (c.key === '404-real') {
        // 真实 404 需要真 net.fetch ⇒ 先卸替身（只卸 net 一侧；globalThis.fetch 的捕获器留到最后）
        await electronApp.evaluate(
          '(() => { const s = globalThis.__zzq51 || {};' +
            " try { const c = process.mainModule.require('electron'); if (s.patchedNet && s.origNet && c && c.net) c.net.fetch = s.origNet; } catch (e) {}" +
            ' s.patchedNet = false; return { patchedNet: false }; })()'
        );
      }
      await guestEval(
        page,
        "(function(){ try { window.closeSkillImportModal(); } catch (e) {} window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
      );
      await sleep(400);
      await guestEval(page, fetchPreviewScript(c.url));
      await guestWaitFor(
        page,
        "document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')",
        c.key === '404-real' ? 120000 : 60000,
        `${c.key} 得到 danger 失败响应`
      );
      const st = await guestEval(page, READ_STATUS_SRC);
      stubResults[c.key] = st;
      log(`  [${c.key}] ${JSON.stringify(st)}`);
      check(
        `Test2（${c.key}）：失败文案上屏且**不是静默失败**`,
        !!st.text && st.text.length > 0 && st.danger === true && st.display !== 'none',
        JSON.stringify(st)
      );
      check(
        `Test2（${c.key}）：文案含状态码 ${c.expect.source} 与可操作指引`,
        c.expect.test(String(st.text)) && c.must.test(String(st.text)),
        JSON.stringify(st.text)
      );
      check(
        `Test2（${c.key}）：失败后预览不进入就绪态（不留半成品）`,
        st.previewActive !== true,
        `previewActive=${st.previewActive}`
      );
    }
    evidence.artifacts.stubCases = stubResults;
    evidence.artifacts.test2Boundary = {
      real: ['404-real（真实 codeload 404）'],
      substituted: [
        '403：由 net.fetch 单点替身返回真实形状响应（导入链路只打 codeload，真实 60 req/h 限流打在 api.github.com，二者不是同一配额域）',
        '429：同上（带 retry-after: 42）',
      ],
    };

    // ==================== 收尾：关弹框 + 卸替身 ====================
    await guestEval(
      page,
      "(function(){ try { window.closeSkillImportModal(); } catch (e) {} return 'ok'; })()"
    );
    await sleep(500);
    await electronApp.evaluate(
      '(() => { const s = globalThis.__zzq51 || {};' +
        " if (s.patchedGlobal && s.origGlobal) globalThis.fetch = s.origGlobal;" +
        " try { const n = process.mainModule.require('electron').net; if (s.patchedNet && s.origNet) n.fetch = s.origNet; } catch (e) {}" +
        ' s.patchedGlobal = false; s.patchedNet = false; return true; })()'
    );
  } catch (e) {
    evidence.thrown = String(e && e.stack ? e.stack : e);
    log('[result] 驱动异常：', evidence.thrown);
  } finally {
    // ---------- 收尾清理（只按本驱动登记过的路径删） ----------
    try {
      // AI 侧栏状态还原（**必须在关掉 Electron 之前**，否则持久化的是「打开」）
      if (panelWasHidden === true && page) {
        try {
          await page.evaluate(() => {
            const p = document.getElementById('aiPanel');
            if (p && !p.classList.contains('hidden') && typeof window.toggleAIPanel === 'function') {
              window.toggleAIPanel();
            }
            return true;
          });
          evidence.cleanup.aiPanelRestored = 'closed';
        } catch (e) {
          evidence.cleanup.aiPanelRestored = 'failed: ' + e.message;
        }
      } else {
        evidence.cleanup.aiPanelRestored = 'not-needed';
      }
      evidence.cleanup.skillDir = removeDirIfAny(path.join(USER_SKILLS_DIR, UPSTREAM.skillName));
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
          /* 计入 removed 差值 */
        }
      }
      evidence.cleanup.residueFound = residue;
      evidence.cleanup.residueRemoved = removed;
      evidence.cleanup.pageErrors = pageErrors;
      evidence.cleanup.mainLogTail = mainLog.slice(-25);
      evidence.cleanup.appExit = appExit;
      evidence.cleanup.windowsAtEnd = electronApp ? electronApp.windows().map((w) => w.url()).slice(0, 8) : null;
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
  log(`uat-51-import-live: ${evidence.passed}/${evidence.total} passed`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
