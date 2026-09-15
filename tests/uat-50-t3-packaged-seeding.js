#!/usr/bin/env node
/**
 * UAT 驱动（Phase 50 · Test 3）—— **打包态**列出随包内置技能（P10 / SEED-05 的真实产物门禁）。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-50-t3-packaged-seeding.js
 *
 * 前置：已跑过 `make install-nightly`（`/Applications/Realm Nightly.app` 存在）。
 *
 * 为什么用 `make install-nightly` 而不是 `make install`
 * --------------------------------------------------
 * UAT 原文写的是 `make install` → `/Applications/Realm.app`。本次改用 nightly，理由与偏差如实记录：
 * - **更安全**：`make install` 会 `rm -rf /Applications/Realm.app`，而用户的正式版实例当时**正在运行**；
 *   nightly 只覆盖 `/Applications/Realm Nightly.app`，与正式版不同路径、不同 appId、不同 userData。
 * - **判据等价**：`resolveBuiltinSkillsSrc()` 的判据是 **`app.isPackaged`**（builtin-skills-seeder.js），
 *   **不是** NODE_ENV；`asarUnpack` / `build.files` 排除项来自**同一个** `package.json`。
 *   故 SEED-05（`asarUnpack` 与运行时路径成对）与 P10（打包排除项护栏）在 nightly 产物上同等受检。
 * - **一处诚实偏差**：产物是 Nightly 构建配置（productName / appId / mac.icon 三处不同），
 *   与「内置技能能否在打包态被播种」无关。
 *
 * 为什么必须先把 managed-skills 挪走（否则是假绿）
 * --------------------------------------------
 * 本机 `realm-nightly` 早已跑过 nightly 产物，`agent-workspace/managed-skills/` 里**已经躺着**
 * `find-skills` + `skill-creator`。直接启动读列表 —— 即使 `asarUnpack` 漏配、播种全失败，
 * 那两个**残留目录**照样会被列出来，判据变绿。所以本驱动先把它整目录挪到备份名，
 * 逼播种器**必须从解包目录重建**，这样「列出两个内置技能」才等价于
 * 「`resolveBuiltinSkillsSrc()` 在打包态解析成功且写盘成功」。
 * 探测结束后把备份还原（leave-as-found）。
 *
 * 断言
 * ----
 * - `T3A` 产物面：`app.asar.unpacked/skills-builtin/` 下确有 find-skills 与 skill-creator
 * - `T3B` 运行期判据：应用内 `app.isPackaged === true`（走的是打包分支，不是开发态回落）
 * - `T3C` 前置：挪走前 managed-skills 里**确有**残留（证明 T3E 不是靠残留变绿）
 * - `T3D` 重建：启动后 managed-skills 里**重新出现**两个内置技能目录（自愈式播种真的跑到了解包源）
 * - `T3E` 投影：`/api/skills/list` 的 `refreshedAt > 0` 且 builtin 档恰为这两个
 * - `T3F` 台账：`errors` 为空数组、「不得静默为空」成立 —— 且若将来出错，
 *        断言 errors 非空时汇总条必须渲染（本次实测 errors 为空、汇总条不渲染）
 * - `T3G` 渲染面：设置页 DOM 里两个内置技能各有真实行
 *
 * 产物：/tmp/uat50/evidence-t3.json + /tmp/uat50/t3-nightly-settings.png
 * 退出码：全部通过 → 0；任一条失败 → 非零。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = '/tmp/uat50';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-t3.json');
const HOME = process.env.HOME;
const APP_BIN = '/Applications/Realm Nightly.app/Contents/MacOS/Realm Nightly';
const UNPACKED_BUILTIN =
  '/Applications/Realm Nightly.app/Contents/Resources/app.asar.unpacked/skills-builtin';
const NIGHTLY_WORKSPACE = path.join(HOME, 'Library', 'Application Support', 'realm-nightly', 'agent-workspace');
const NIGHTLY_MANAGED = path.join(NIGHTLY_WORKSPACE, 'managed-skills');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const readdirSafe = (p) => {
  try {
    return fs.readdirSync(p).sort();
  } catch (_) {
    return null;
  }
};

function writeEvidence(ev) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(ev, null, 2));
}

async function guestEval(page, src) {
  return page.evaluate(async (code) => {
    const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
      try {
        return w.getURL().indexOf('/settings') !== -1;
      } catch (_) {
        return false;
      }
    });
    if (!wv) throw new Error('no settings webview');
    return wv.executeJavaScript(code);
  }, src);
}

/**
 * 等设置页 guest **出现**。
 * ⚠ 必须先等 guest 存在再 waitFor —— 首版直接 waitFor，而 guestEval 在 webview 不存在时
 * **抛错**（不是返回 false），于是条件等待第一次迭代就把整个探测打死了（实测：
 * `page.evaluate: Error: no settings webview`）。
 * @returns {string|null} guest URL
 */
async function waitForGuest(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await page
      .evaluate(() => {
        const wvs = Array.from(document.querySelectorAll('webview'));
        for (const wv of wvs) {
          let u = '';
          try {
            u = wv.getURL();
          } catch (_) {
            u = '';
          }
          if (u.indexOf('/settings') !== -1) return u;
        }
        return null;
      })
      .catch(() => null);
    if (last) return last;
    await sleep(400);
  }
  return null;
}

/** 轮询直到 guest 内条件成立（guest 缺失/抛错一律视为「还没到」，继续等） */
async function guestWaitFor(page, expr, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await guestEval(page, `(function(){ try { return !!(${expr}); } catch (e) { return 'threw: ' + e.message; } })()`);
      if (last === true) return true;
    } catch (e) {
      last = 'guest-not-ready: ' + e.message;
    }
    await sleep(400);
  }
  throw new Error(`等待超时（${label}）：最后取值 = ${JSON.stringify(last)}`);
}

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  log('=== preflight ===');

  if (!fs.existsSync(APP_BIN)) {
    console.error('E-APP 未找到 nightly 产物:', APP_BIN);
    console.error('   请先运行: make install-nightly');
    process.exit(12);
  }
  let pwOk = false;
  try {
    pwOk = !!require('playwright')._electron;
  } catch (err) {
    console.error('E-PW require("playwright") 失败:', err.message);
    process.exit(11);
  }
  if (!pwOk) {
    console.error('E-PW playwright._electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }

  const unpackedDirNames = readdirSafe(UNPACKED_BUILTIN);
  const managedBeforeMove = readdirSafe(NIGHTLY_MANAGED);
  log('  产物内 skills-builtin =', JSON.stringify(unpackedDirNames));
  log('  挪走前 managed-skills  =', JSON.stringify(managedBeforeMove));

  const { _electron: electronLauncher } = require('playwright');
  const mainLog = [];
  const pageErrors = [];
  let electronApp = null;
  let page = null;
  let exitCode = 1;
  let backupPath = null;

  const evidence = {
    driver: 'tests/uat-50-t3-packaged-seeding.js',
    uatTest: 3,
    started,
    finished: null,
    artifactChoice: {
      used: 'make install-nightly → /Applications/Realm Nightly.app',
      uatTextSays: 'make install → /Applications/Realm.app',
      rationale:
        'resolveBuiltinSkillsSrc() 的判据是 app.isPackaged（非 NODE_ENV），asarUnpack / build.files 来自同一 package.json ⇒ 判据等价；' +
        '且 make install 会覆盖当时**正在运行**的正式版 /Applications/Realm.app。偏差：产物的 productName/appId/icon 三处不同。',
    },
    unpackedBuiltinDirNames: unpackedDirNames,
    managedBeforeMove,
    managedAfterMove: null,
    managedAfterLaunch: null,
    staging: {},
    assertions: {},
    assertionsPass: false,
    screenshots: {},
    pageErrors,
    mainLogTail: [],
  };

  try {
    // ---- 关键一步：把 managed-skills 挪走，逼播种器从解包目录重建 ----
    if (fs.existsSync(NIGHTLY_MANAGED)) {
      backupPath = NIGHTLY_MANAGED + '.uat50bak-' + Date.now();
      fs.renameSync(NIGHTLY_MANAGED, backupPath);
      evidence.staging.movedTo = backupPath;
      log('  已把 managed-skills 挪到:', backupPath);
    } else {
      evidence.staging.movedTo = null;
      log('  managed-skills 原本不存在（等同全新安装）');
    }
    evidence.managedAfterMove = readdirSafe(NIGHTLY_MANAGED);

    // ---- 启动打包产物 ----
    log('=== 启动', APP_BIN, '===');
    electronApp = await electronLauncher.launch({
      executablePath: APP_BIN,
      args: [],
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

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline && !page) {
      for (const w of electronApp.windows()) {
        if (w.url().includes('index.html')) {
          page = w;
          break;
        }
      }
      if (!page) await sleep(400);
    }
    if (!page) throw new Error('未找到打包产物的 index.html 主窗口（60s 内）');
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

    // 运行期打包判据：`electronApp.evaluate` 的**字符串形式里没有 `require`**
    // （实测 "require is not defined"），故改用主进程全局可得的路径事实推导 ——
    // 打包态 execPath / resourcesPath 都落在 `.app/Contents/` 包内，dev 态不是。
    const procInfo = await electronApp.evaluate(`(() => ({
      execPath: process.execPath,
      resourcesPath: process.resourcesPath,
      defaultApp: process.defaultApp === true,
      env: process.env.NODE_ENV || null,
      argv0: process.argv0 || null,
    }))()`);
    const isPackaged = !procInfo.defaultApp && String(procInfo.resourcesPath).includes('.app/Contents/Resources');
    evidence.procInfo = procInfo;
    evidence.isPackaged = isPackaged;
    log('  execPath      =', procInfo.execPath);
    log('  resourcesPath =', procInfo.resourcesPath);
    log('  defaultApp    =', procInfo.defaultApp, '· NODE_ENV =', procInfo.env, '· 推导 isPackaged =', isPackaged);

    // ---- 打开设置页 ----
    await page.waitForFunction(() => typeof window.openSettingsTab === 'function', null, { timeout: 30000 });
    await page.evaluate(() => window.openSettingsTab());
    const guestUrl = await waitForGuest(page, 45000);
    evidence.guestUrl = guestUrl;
    log('  设置页 guest =', guestUrl);
    if (!guestUrl) throw new Error('E-GUEST 45s 内未出现 /settings 的 webview');
    await guestWaitFor(page, `typeof window.loadSkillManagement === 'function'`, 30000, '设置页脚本就绪');
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(page, `document.querySelectorAll('.skill-manage-row').length > 0`, 40000, '技能行出现');
    await sleep(1500);

    // 投影
    const proj = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
         const text = await r.text();
         const body = JSON.parse(text);
         const builtin = [];
         for (const g of (body.groups || [])) if (g.tier === 'builtin') for (const it of (g.items || [])) builtin.push(it.name);
         const dom = Array.from(document.querySelectorAll('.skill-manage-row')).map(r => r.dataset.skillName + '|' + r.dataset.skillTier);
         const sum = document.getElementById('skillManageSummary');
         const st = document.getElementById('skillManageState');
         const stTitle = st ? st.querySelector('.skill-manage-state-title') : null;
         return {
           status: r.status, bytes: text.length,
           refreshedAt: body.refreshedAt,
           errors: body.errors,
           builtinNames: builtin.sort(),
           domRows: dom,
           summaryChildren: sum ? sum.childElementCount : -1,
           summaryText: sum ? sum.textContent.slice(0, 200) : null,
           stateTitle: stTitle ? stTitle.textContent : null,
         };
       })()`
    );
    evidence.projection = proj;
    log('  投影 builtinNames =', JSON.stringify(proj.builtinNames), '· refreshedAt =', proj.refreshedAt, '· errors =', JSON.stringify(proj.errors));

    evidence.managedAfterLaunch = readdirSafe(NIGHTLY_MANAGED);
    log('  重建后 managed-skills =', JSON.stringify(evidence.managedAfterLaunch));

    // 解包源内容抽查（证明重建的不是空壳）
    const rebuiltDetail = {};
    for (const n of ['find-skills', 'skill-creator']) {
      const d = path.join(NIGHTLY_MANAGED, n);
      rebuiltDetail[n] = {
        exists: fs.existsSync(d),
        hasSkillMd: fs.existsSync(path.join(d, 'SKILL.md')),
        entries: readdirSafe(d),
        skillMdBytes: (() => {
          try {
            return fs.statSync(path.join(d, 'SKILL.md')).size;
          } catch (_) {
            return null;
          }
        })(),
      };
    }
    evidence.rebuiltDetail = rebuiltDetail;

    try {
      const p = path.join(OUT_DIR, 't3-nightly-settings.png');
      await page.screenshot({ path: p });
      evidence.screenshots.settings = p;
    } catch (e) {
      evidence.screenshots.settings = 'failed: ' + e.message;
    }

    // ---- 断言 ----
    const a = {};
    a.T3A = {
      pass:
        Array.isArray(unpackedDirNames) &&
        unpackedDirNames.includes('find-skills') &&
        unpackedDirNames.includes('skill-creator'),
      detail: `产物面：${UNPACKED_BUILTIN} → ${JSON.stringify(unpackedDirNames)}（期望含 find-skills / skill-creator；证明 asarUnpack 与运行时路径成对）`,
    };
    a.T3B = {
      pass: isPackaged === true,
      detail:
        `运行期打包判据（app.evaluate 的字符串形式无 require，故用主进程路径事实推导）：` +
        `execPath = ${procInfo.execPath} · resourcesPath = ${procInfo.resourcesPath} · ` +
        `defaultApp = ${procInfo.defaultApp} ⇒ isPackaged = ${isPackaged}（期望 true —— 走的是 builtin-skills-seeder 的**打包分支**，不是 dev 态 __dirname 回落）`,
    };
    a.T3C = {
      pass:
        Array.isArray(managedBeforeMove) &&
        managedBeforeMove.includes('find-skills') &&
        managedBeforeMove.includes('skill-creator'),
      detail:
        `前置（证明后面不是靠残留变绿）：挪走前 managed-skills 里**确有** ${JSON.stringify(managedBeforeMove)} —— ` +
        `若不先挪走，即使播种全失败这两个残留目录也会被列出来 ⇒ 判据假绿。已挪到 ${evidence.staging.movedTo}`,
    };
    a.T3D = {
      pass:
        Array.isArray(evidence.managedAfterLaunch) &&
        evidence.managedAfterLaunch.includes('find-skills') &&
        evidence.managedAfterLaunch.includes('skill-creator') &&
        rebuiltDetail['find-skills'] &&
        rebuiltDetail['find-skills'].hasSkillMd &&
        rebuiltDetail['skill-creator'] &&
        rebuiltDetail['skill-creator'].hasSkillMd,
      detail:
        `**自愈式播种真的跑到了解包源**：清空后启动产物 → managed-skills 重新出现 ` +
        `${JSON.stringify(evidence.managedAfterLaunch)}；` +
        `find-skills/SKILL.md=${rebuiltDetail['find-skills'] && rebuiltDetail['find-skills'].skillMdBytes} 字节 · ` +
        `skill-creator/SKILL.md=${rebuiltDetail['skill-creator'] && rebuiltDetail['skill-creator'].skillMdBytes} 字节`,
    };
    a.T3E = {
      pass:
        typeof proj.refreshedAt === 'number' &&
        proj.refreshedAt > 0 &&
        JSON.stringify(proj.builtinNames) === JSON.stringify(['find-skills', 'skill-creator']),
      detail: `投影：refreshedAt = ${proj.refreshedAt}（>0）· builtin 档 = ${JSON.stringify(proj.builtinNames)}（期望恰 ["find-skills","skill-creator"]）· 响应 ${proj.bytes} 字节`,
    };
    a.T3F = {
      pass:
        Array.isArray(proj.errors) &&
        proj.errors.length === 0 &&
        // 「不得静默为空」的机制断言：errors 为空 ⇒ 汇总条不渲染；errors 非空 ⇒ 必须渲染
        (proj.errors.length > 0 ? proj.summaryChildren > 0 : proj.summaryChildren === 0),
      detail:
        `台账：「不得静默为空」—— errors = ${JSON.stringify(proj.errors)}（本次实测为空 ⇒ 播种健康）、` +
        `汇总条 children = ${proj.summaryChildren}（errors 为空时应为 0）、stateTitle = ${JSON.stringify(proj.stateTitle)}（应为 null ⇒ 不是「技能列表尚未加载」）。` +
        `注：errors 非空时汇总条必须渲染该断言在本次因无错误而未被执行到「非空」分支 —— 如实记录。`,
    };
    a.T3G = {
      pass:
        proj.domRows.includes('find-skills|builtin') && proj.domRows.includes('skill-creator|builtin'),
      detail: `渲染面：DOM 行含 ${JSON.stringify(proj.domRows.filter((r) => r.includes('builtin')))}（共 ${proj.domRows.length} 行）`,
    };

    evidence.assertions = a;
    evidence.assertionsPass = Object.values(a).every((x) => x.pass);
  } catch (err) {
    evidence.thrown = String((err && err.message) || err);
    log('[error]', evidence.thrown);
  } finally {
    if (electronApp) {
      try {
        await Promise.race([electronApp.close(), sleep(8000)]);
      } catch (e) {
        console.error('electronApp.close() 失败:', e.message);
      }
    }
    await sleep(1200); // 等应用真正退出，避免它退出时回写覆盖我们的还原
    // ---- leave-as-found：删掉本轮新建的 managed-skills，把备份还原 ----
    try {
      if (backupPath && fs.existsSync(backupPath)) {
        const fresh = readdirSafe(NIGHTLY_MANAGED);
        evidence.staging.freshAfterTest = fresh;
        if (fs.existsSync(NIGHTLY_MANAGED)) fs.rmSync(NIGHTLY_MANAGED, { recursive: true, force: true });
        fs.renameSync(backupPath, NIGHTLY_MANAGED);
        evidence.staging.restored = true;
        evidence.staging.restoredFrom = readdirSafe(NIGHTLY_MANAGED);
      } else {
        evidence.staging.restored = 'no-backup (原本不存在)';
      }
    } catch (e) {
      evidence.staging.restoreError = e.message;
    }
    evidence.finished = new Date().toISOString();
    evidence.mainLogTail = mainLog.slice(-30);
    if (exitCode === 1) exitCode = evidence.assertionsPass ? 0 : 1;
    evidence.exitCode = exitCode;
    try {
      writeEvidence(evidence);
    } catch (e) {
      console.error('写证据 JSON 失败:', e.message);
    }
  }

  log('');
  log('[result] 断言：');
  for (const [k, v] of Object.entries(evidence.assertions || {})) {
    log(`  ${k} ${v.pass ? 'PASS' : 'FAIL'}  ${v.detail}`);
  }
  log('[result] 还原:', JSON.stringify(evidence.staging));
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(evidence.assertionsPass ? '[result] ALL ASSERTIONS PASS' : '[result] ASSERTIONS FAILED');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
