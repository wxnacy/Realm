#!/usr/bin/env node
/**
 * UAT 驱动（Phase 50 · Test 1）—— 「设置页在 realm:// CSP 下加载 skill-picker-model.js」
 * 与「两个空态分支按 refreshedAt 而非『数组为空』判定」的真实运行期门禁。
 *
 * 闭合 `50-UAT.md` 的 Test 1（来源：`50-VERIFICATION.md` 的 research A3 / D-19 验收面）。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-50-t1-skill-picker-model-csp.js
 *
 * 依赖全局 `playwright`（`_electron`）——只启动**本进程自己拉起的** realm-dev 子进程
 * （独立 userData `~/Library/Application Support/realm-dev/`）。收尾固定
 * `electronApp.close()` + `process.exit(0)`；**严禁** `pkill` / `pgrep` 模式匹配杀进程
 * （用户可能正在运行正式版 `/Applications/Realm.app`）。
 *
 * 为什么这条判据必须在真实运行期上跑（静态面不足）
 * ----------------------------------------------
 * 设置页的相对脚本路径能否解析，取决于**两个只在运行期成立的链环**：
 *   ① `main.js` 的本地服务器路由表**没有**裸 `/skill-picker-model.js` 条目 ——
 *      只有 `/settings/` 前缀 → `src/<subPath>`（main.js:3037-3095）。裸路径会落到
 *      末尾 `res.writeHead(404)` 分支。
 *   ② 页面 URL 由 `realmUrlToHttp()` 生成为 `http://localhost:PORT/settings`（**无尾斜杠**），
 *      相对路径本会解析到 `/skill-picker-model.js` ⇒ 404。
 * 唯一让链路成立的是 `src/settings.html:7` 的 `<base href="/settings/">`。任何一环被改
 * （base 被删 / 路由前缀改名 / realmUrlToHttp 加尾斜杠语义变化）都会让脚本 404，而
 * 「settings.html 里有 <script src=…>」这类子串扫描**全程绿灯**。
 *
 * 空态判据的非恒真自证
 * -------------------
 * 断言 `T1D` 是核心判别器：喂**同一个 `groups: []`**（两轮数组都空），只改 `refreshedAt`
 * （0 → Date.now()），要求 A/B 两个空态**输出不同**。若实现是按「数组为空」分支，
 * 两轮输入在「空」这一维度上完全相同 ⇒ 输出必然相同 ⇒ T1D 转红。因此 T1D 的绿
 * 只能来自 `refreshedAt` 这一个自变量。
 *
 * 脚本命名
 * -------
 * 文件名以 `uat-` 开头 ⇒ **永不被** `test-*.js` 类套件（`node --test tests/` 等）拾取；
 * 它只在需要真实渲染时手工/受控运行。
 *
 * 产物
 * ----
 *   /tmp/uat50/evidence-t1.json                    全量断言 + 两轮空态 DOM 快照 + 资源计时
 *   /tmp/uat50/t1-settings-skill-manage.png        设置页「技能管理」区（切换+滚动后）
 *   /tmp/uat50/t1-settings-skill-manage-b.png      B 态（refreshedAt > 0）渲染后的同区截图
 *
 * 退出码：全部断言通过 → 0；任一条失败 → 非零（并在输出尾部打印逐条布尔表）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/tmp/uat50';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-t1.json');
/**
 * 本仓自带的 Electron 可执行文件（`node_modules/electron` 的导出即二进制路径）。
 * playwright 装在**全局**（`NODE_PATH="$(npm root -g)"`），它自身找不到本仓的 electron，
 * 故必须显式传 `executablePath` —— 否则 launch 直接以 "Electron executablePath not found!" 失败。
 */
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));

/** 设置页 guest 出现的等待上限（ms） */
const GUEST_TIMEOUT_MS = 30000;
/** 设置页自身完成首次数据加载的等待上限（ms） */
const PAGE_READY_TIMEOUT_MS = 30000;

/** A 态 / B 态的期望文案（与 settings-page.js:5563 的冻结字面量同源） */
const TITLE_NOT_LOADED = '技能列表尚未加载';
const TITLE_LOADED_BUT_EMPTY = '尚无任何技能';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/**
 * 第 0 步 · 前置自检（在任何启动动作之前逐条判定，各带独立失败码）
 * - `E-PW` 全局 playwright / `_electron` 不可得 → 硬退出（需 NODE_PATH="$(npm root -g)"）
 * - `E-EXE` 本仓 electron 二进制不可得 → 硬退出
 * @returns {{preflight: object, pwOk: boolean}}
 */
function preflight() {
  const pf = {};

  let pwOk = false;
  let pwDetail = '';
  try {
    pwOk = !!require('playwright')._electron;
    pwDetail = 'playwright._electron 可用';
  } catch (err) {
    pwOk = false;
    pwDetail = 'require("playwright") 失败: ' + err.message;
  }
  pf['E-PW'] = { ok: pwOk, detail: pwDetail, fatal: true };

  let exeOk = false;
  let exeDetail = '';
  try {
    exeOk = typeof ELECTRON_EXECUTABLE === 'string' && fs.existsSync(ELECTRON_EXECUTABLE);
    exeDetail = exeOk ? ELECTRON_EXECUTABLE : `不存在: ${ELECTRON_EXECUTABLE}`;
  } catch (err) {
    exeDetail = '解析 node_modules/electron 失败: ' + err.message;
  }
  pf['E-EXE'] = { ok: exeOk, detail: exeDetail, fatal: true };

  return { preflight: pf, pwOk: pwOk && exeOk };
}

/**
 * 写出证据 JSON。
 * @param {object} evidence
 */
function writeEvidence(evidence) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
}

/**
 * 在设置页 guest 内执行的探测代码（**唯一有效判据来源**）。
 *
 * 以字符串形式交给 `webview.executeJavaScript` —— 该调用在 guest 的**主世界**执行，
 * 因此拿到的是 `script-src 'self'` 这条 CSP **真实生效**下的结果（在 host 侧 stub
 * `window.SkillPickerModel` 会绕开 A3 要验的全部风险）。
 *
 * 返回可 JSON 序列化的对象；任何一步异常都收进 `error` 字段而不是抛出，
 * 以便把「哪个链环断了」如实带回 host。
 */
const GUEST_PROBE_SRC = `(async () => {
  const out = {};
  try {
    // ---------- 区块 1：脚本加载面（真实 CSP 下） ----------
    out.location = location.href;
    const baseEl = document.querySelector('base');
    out.baseHref = baseEl ? baseEl.getAttribute('href') : null;
    const cspEl = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    out.cspMeta = cspEl ? cspEl.getAttribute('content') : null;

    const tag = document.querySelector('script[src="skill-picker-model.js"]');
    out.scriptTagSrcAttr = tag ? tag.getAttribute('src') : null;
    out.scriptTagResolved = tag ? tag.src : null;

    out.skillPickerModelType = typeof window.SkillPickerModel;
    out.skillPickerModelKeys =
      window.SkillPickerModel && typeof window.SkillPickerModel === 'object'
        ? Object.keys(window.SkillPickerModel).sort()
        : null;

    // 资源计时：把「脚本请求是否真的 200」这一层也留证（404 时 responseStatus 为 404）
    try {
      const e = performance
        .getEntriesByType('resource')
        .find((r) => r.name.indexOf('skill-picker-model.js') !== -1);
      if (e) {
        out.resourceTiming = {
          name: e.name,
          responseStatus: typeof e.responseStatus === 'number' ? e.responseStatus : null,
          transferSize: typeof e.transferSize === 'number' ? e.transferSize : null,
          encodedBodySize: typeof e.encodedBodySize === 'number' ? e.encodedBodySize : null,
          durationMs: Math.round(e.duration),
        };
      } else {
        out.resourceTiming = null;
      }
    } catch (err) {
      out.resourceTimingError = String(err && err.message ? err.message : err);
    }

    // ---------- 区块 2：真实态（探测前的页面自身状态，只读上下文） ----------
    out.fnTypes = {
      renderSkillManagement: typeof window.renderSkillManagement,
      renderSkillManageEmptyState: typeof window.renderSkillManageEmptyState,
      loadSkillManagement: typeof window.loadSkillManagement,
    };
    out.realProjection = (function () {
      const sum = document.getElementById('skillManageSummary');
      const st = document.getElementById('skillManageState');
      const grp = document.getElementById('skillManageGroups');
      const t = st ? st.querySelector('.skill-manage-state-title') : null;
      return {
        stateTitle: t ? t.textContent : null,
        stateChildren: st ? st.childElementCount : -1,
        summaryChildren: sum ? sum.childElementCount : -1,
        groupChildren: grp ? grp.childElementCount : -1,
      };
    })();

    // ---------- 区块 3：两个空态分支的判别器 ----------
    if (typeof window.renderSkillManagement !== 'function') {
      out.error = 'renderSkillManagement 不是全局函数 —— 无法判定空态分支（settings-page.js 未加载或已被包裹）';
      return out;
    }
    const readState = () => {
      const st = document.getElementById('skillManageState');
      const sum = document.getElementById('skillManageSummary');
      const grp = document.getElementById('skillManageGroups');
      const t = st ? st.querySelector('.skill-manage-state-title') : null;
      const b = st ? st.querySelector('.skill-manage-state-body') : null;
      const sT = sum ? sum.querySelector('.ai-skill-content-box-title') : null;
      return {
        title: t ? t.textContent : null,
        bodyHead: b ? b.textContent.slice(0, 40) : null,
        stateChildren: st ? st.childElementCount : -1,
        summaryChildren: sum ? sum.childElementCount : -1,
        summaryHasContentBox: sum ? sum.classList.contains('ai-skill-content-box') : null,
        summaryTitle: sT ? sT.textContent : null,
        groupChildren: grp ? grp.childElementCount : -1,
      };
    };
    // **两轮共用同一个空数组引用** —— 这是 T1D 判别器的全部要点：
    // 「数组为空」这一维度在两轮之间完全相同，唯一自变量是 refreshedAt。
    const EMPTY_GROUPS = [];
    const diag = [{ level: 'warning', source: 'probe-synthetic', message: 'probe-diagnostic' }];

    window.renderSkillManagement({ groups: EMPTY_GROUPS, errors: [], refreshedAt: 0 });
    out.branchNotLoaded = readState();

    window.renderSkillManagement({
      groups: EMPTY_GROUPS,
      errors: diag,
      refreshedAt: Date.now(),
    });
    out.branchLoadedButEmpty = readState();

    out.expected = {
      notLoadedTitle: '${TITLE_NOT_LOADED}',
      loadedButEmptyTitle: '${TITLE_LOADED_BUT_EMPTY}',
    };
    return out;
  } catch (err) {
    out.error = String((err && err.stack) || err);
    return out;
  }
})()`;

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pf = preflight();
  if (!pf.pwOk) {
    writeEvidence({
      driver: 'tests/uat-50-t1-skill-picker-model-csp.js',
      started,
      preflight: pf.preflight,
      aborted: 'E-PW',
    });
    console.error('E-PW 全局 playwright / _electron 或本仓 electron 不可得 —— 请用 NODE_PATH="$(npm root -g)" 运行');
    process.exit(11);
  }
  log('[preflight] E-PW', pf.preflight['E-PW'].ok, '| E-EXE', pf.preflight['E-EXE'].ok);
  log('[preflight]', pf.preflight['E-EXE'].detail);

  const { _electron: electronLauncher } = require('playwright');
  const mainLog = [];
  const pageErrors = [];
  let electronApp = null;
  /** @type {import('playwright').Page|null} */
  let page = null;
  let exitCode = 1;
  let guest = null;

  const evidence = {
    driver: 'tests/uat-50-t1-skill-picker-model-csp.js',
    uatTest: 1,
    started,
    finished: null,
    repo: REPO_ROOT,
    node: process.version,
    preflight: pf.preflight,
    guest: null,
    probe: null,
    assertions: {},
    assertionsPass: false,
    screenshots: {},
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

    // 打开设置页（真实入口：设置按钮/Cmd+, 共用同一个 openSettingsTab）
    await page.waitForFunction(() => typeof window.openSettingsTab === 'function', null, {
      timeout: 20000,
    });
    log('[step] 调用 openSettingsTab()');
    await page.evaluate(() => window.openSettingsTab());

    // 等设置页 guest 出现
    const guestDeadline = Date.now() + GUEST_TIMEOUT_MS;
    while (Date.now() < guestDeadline && !guest) {
      guest = await page.evaluate(() => {
        const wvs = Array.from(document.querySelectorAll('webview'));
        for (const wv of wvs) {
          let u = '';
          try {
            u = wv.getURL();
          } catch (_) {
            u = '';
          }
          if (u.indexOf('/settings') !== -1) return { url: u };
        }
        return null;
      });
      if (!guest) await sleep(400);
    }
    if (!guest) throw new Error(`E-GUEST 未在 ${GUEST_TIMEOUT_MS}ms 内找到 /settings 的 webview`);
    evidence.guest = guest;
    log('[step] 设置页 guest:', guest.url);

    // 等页面自身脚本加载完（SkillPickerModel 是本驱动的第一判据，先等它出现或超时）
    const readyDeadline = Date.now() + PAGE_READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < readyDeadline && !ready) {
      ready = await page.evaluate(async () => {
        const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
          try {
            return w.getURL().indexOf('/settings') !== -1;
          } catch (_) {
            return false;
          }
        });
        if (!wv) return false;
        try {
          const r = await wv.executeJavaScript(
            `(function(){ return typeof window.loadSkillManagement === 'function'; })()`
          );
          return r === true;
        } catch (_) {
          return false;
        }
      });
      if (!ready) await sleep(400);
    }
    log('[step] 设置页脚本就绪 =', ready);

    // 让页面自身完成一次真实数据加载（这是真实的开放路径，探针不做任何 stub）
    await page
      .evaluate(async () => {
        const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
          try {
            return w.getURL().indexOf('/settings') !== -1;
          } catch (_) {
            return false;
          }
        });
        if (!wv) return null;
        return wv.executeJavaScript(
          `(function(){ try { if (typeof window.loadSkillManagement === 'function') { window.loadSkillManagement(); return 'called'; } return 'absent'; } catch (e) { return 'threw: ' + e.message; } })()`
        );
      })
      .catch((e) => log('[warn] 触发真实加载失败:', e.message));
    await sleep(2500);

    // 切到 AI 区并把「技能管理」滚进视口（只为截图取证；判据不依赖它）
    await page
      .evaluate(async () => {
        const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
          try {
            return w.getURL().indexOf('/settings') !== -1;
          } catch (_) {
            return false;
          }
        });
        if (!wv) return null;
        return wv.executeJavaScript(
          `(function(){
             try {
               if (typeof window.switchSettingsPage === 'function') window.switchSettingsPage('ai-assistant');
               const el = document.getElementById('skillManageGroups') || document.getElementById('skillManageState');
               if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
               return 'ok';
             } catch (e) { return 'threw: ' + e.message; }
           })()`
        );
      })
      .catch(() => {});
    await sleep(900);
    try {
      const p1 = path.join(OUT_DIR, 't1-settings-skill-manage.png');
      await page.screenshot({ path: p1 });
      evidence.screenshots.realState = p1;
    } catch (e) {
      evidence.screenshots.realState = 'failed: ' + e.message;
    }

    // ---- 主判据：在 guest 主世界执行探测（CSP 真实生效下）----
    const probe = await page.evaluate(async (src) => {
      const wv = Array.from(document.querySelectorAll('webview')).find((w) => {
        try {
          return w.getURL().indexOf('/settings') !== -1;
        } catch (_) {
          return false;
        }
      });
      if (!wv) throw new Error('no settings webview at probe time');
      return wv.executeJavaScript(src);
    }, GUEST_PROBE_SRC);
    evidence.probe = probe;
    log('[probe] 原始返回:', JSON.stringify(probe, null, 2));

    // B 态渲染后的取证截图（探测已把页面留在 B 态）
    try {
      const p2 = path.join(OUT_DIR, 't1-settings-skill-manage-b.png');
      await page.screenshot({ path: p2 });
      evidence.screenshots.branchB = p2;
    } catch (e) {
      evidence.screenshots.branchB = 'failed: ' + e.message;
    }

    // ---------------- 断言集 ----------------
    const a = {};
    const p = probe || {};
    const nl = p.branchNotLoaded || {};
    const le = p.branchLoadedButEmpty || {};

    a.T1A = {
      pass: p.skillPickerModelType === 'object',
      detail: `设置页 guest（${p.location}）的 typeof window.SkillPickerModel = ${JSON.stringify(
        p.skillPickerModelType
      )}（期望 "object"）`,
    };
    a.T1B = {
      pass:
        typeof p.skillPickerModelKeys === 'object' &&
        Array.isArray(p.skillPickerModelKeys) &&
        p.skillPickerModelKeys.length > 0,
      detail: `SkillPickerModel 导出键 ${
        Array.isArray(p.skillPickerModelKeys) ? p.skillPickerModelKeys.length : 0
      } 个：${JSON.stringify(p.skillPickerModelKeys)}`,
    };
    // 请求确实经 /settings/ 前缀命中 src/（404 时 responseStatus=404、ScriptPickerModel 也不会存在）
    a.T1C = {
      pass:
        !!p.resourceTiming &&
        p.resourceTiming.name.indexOf('/settings/skill-picker-model.js') !== -1 &&
        (p.resourceTiming.responseStatus === null || p.resourceTiming.responseStatus === 200),
      detail: p.resourceTiming
        ? `脚本请求 ${p.resourceTiming.name} · responseStatus=${p.resourceTiming.responseStatus} · transferSize=${p.resourceTiming.transferSize}`
        : `未取得 skill-picker-model.js 的资源计时（resourceTiming=null）· scriptTagResolved=${
            p.scriptTagResolved
          } · base=${p.baseHref}`,
    };
    a.T1D = {
      pass:
        nl.title === TITLE_NOT_LOADED &&
        le.title === TITLE_LOADED_BUT_EMPTY &&
        nl.title !== le.title,
      detail:
        `判别器（两轮 groups 均为同一个空数组，唯一自变量是 refreshedAt）：` +
        `refreshedAt=0 → ${JSON.stringify(nl.title)}；refreshedAt>0 → ${JSON.stringify(le.title)}` +
        `（期望 "${TITLE_NOT_LOADED}" / "${TITLE_LOADED_BUT_EMPTY}" 且两者不同）`,
    };
    a.T1E = {
      pass: nl.summaryChildren === 0 && le.summaryChildren > 0 && le.summaryHasContentBox === true,
      detail:
        `汇总条处置（A 态整条不渲染 / B 态可渲染）：` +
        `A 态 summaryChildren=${nl.summaryChildren}（期望 0）· ` +
        `B 态 summaryChildren=${le.summaryChildren}（期望 >0）· ` +
        `B 态 summaryTitle=${JSON.stringify(le.summaryTitle)}`,
    };
    a.T1F = {
      pass: nl.stateChildren > 0 && le.stateChildren > 0 && nl.groupChildren === 0 && le.groupChildren === 0,
      detail:
        `两个空态都真的渲染出状态块且列表容器为空：` +
        `A stateChildren=${nl.stateChildren} / B stateChildren=${le.stateChildren}（均期望 >0）· ` +
        `A groupChildren=${nl.groupChildren} / B groupChildren=${le.groupChildren}（均期望 0）`,
    };
    a.T1G = {
      pass: !p.error && p.fnTypes && p.fnTypes.renderSkillManagement === 'function',
      detail: p.error
        ? `guest 探测报错：${p.error}`
        : `guest 全局函数：renderSkillManagement=${p.fnTypes.renderSkillManagement} · renderSkillManageEmptyState=${p.fnTypes.renderSkillManageEmptyState} · loadSkillManagement=${p.fnTypes.loadSkillManagement}`,
    };

    evidence.assertions = a;
    evidence.assertionsPass = Object.values(a).every((x) => x.pass);
    evidence.realProjectionContext = p.realProjection || null;
  } catch (err) {
    evidence.thrown = String((err && err.message) || err);
    log('[error]', evidence.thrown);
  } finally {
    evidence.finished = new Date().toISOString();
    evidence.mainLogTail = mainLog.slice(-30);
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
  log('[result] 设置页 guest:', evidence.guest ? evidence.guest.url : '(未取得)');
  if (evidence.probe) {
    log('[result] base =', evidence.probe.baseHref, '· scriptTagResolved =', evidence.probe.scriptTagResolved);
    log('[result] 探测前真实态:', JSON.stringify(evidence.probe.realProjection));
  }
  log('[result] T1A–T1G：');
  for (const [k, v] of Object.entries(evidence.assertions || {})) {
    log(`  ${k} ${v.pass ? 'PASS' : 'FAIL'}  ${v.detail}`);
  }
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  if (evidence.screenshots && Object.keys(evidence.screenshots).length) {
    log('[result] 截图 →', JSON.stringify(evidence.screenshots));
  }
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(evidence.assertionsPass ? '[result] ALL ASSERTIONS PASS' : '[result] ASSERTIONS FAILED');

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
