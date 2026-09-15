#!/usr/bin/env node
/**
 * UAT 驱动（Phase 50 · A 组）—— 管理面读路径 / 启停跨进程可见性 / 多设置页 / 请求体体积闸
 * 的真实运行期门禁，覆盖 `50-UAT.md` 的 Test 2 / 4 / 5 / 6。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-50-a-manage-read-write.js
 *
 * 只启动**本进程自己拉起的** realm-dev 子进程（独立 userData）。收尾固定
 * `electronApp.close()` + `process.exit(0)`；**严禁** `pkill` / `pgrep` 模式匹配杀进程
 * （用户可能正在运行正式版 `/Applications/Realm.app`）。
 *
 * 各 Test 的判据与「非恒真」设计
 * -----------------------------
 * **T2**（D-19：未配 provider 仍能列出盘上技能）
 *   前提**先验证**：读 `realm-dev/realm-config.json` 确认 `settings.ai` 不存在
 *   （"未配置 provider" 不是假设，是判据的一部分）。再从设置页 guest 真实 `fetch`
 *   `/api/skills/list` 断言 `refreshedAt > 0` 且 builtin 组含两个内置技能，
 *   并断言 DOM 里两个内置技能各有真实行、且**没有**落在「技能列表尚未加载」空态。
 *
 * **T4**（ROADMAP 成功标准 #2 的「不再进 `/` 列表」）
 *   两段独立证据：
 *   ① **广播路径**：禁用后**不开面板**，只等一小会儿读主窗口 `state.aiSkills` ——
 *      面板未打开 ⇒ 打开路径的后台刷新不可能跑过 ⇒ 该字段的变化只能来自
 *      `skills:changed` 广播（`renderer.js:4405` → `pullAiSkillsSnapshot`）。
 *   ② **用户可见面**：真的打开 `/` 面板（`#aiInput` 填 `/` 派发 `input`），
 *      断言 `#slashPickerList` 里没有该技能。
 *   再重新启用并断言两条面都恢复 ⇒ 排除「恰好一开始就没有」的假绿。
 *
 * **T5**（D-18：多设置页不即时同步，但重进即同步）
 *   造**两个**设置页 guest，A 禁用 → B **reload** → 断言 B 的行状态已同步。
 *   刻意**不**断言「A 改动后 B 即时刷新」—— 那是 D-18 明确不做的。
 *
 * **T6**（SEC-09 / research A4：413 拒收在 Electron 内可复现）
 *   ① 真发 1.5 MiB body → 断言 413 + JSON（含 `limit` = 1048576）。
 *   ② **反向对照**：同一路由发**小** body（不存在的技能名）→ 断言**不是 413**
 *      而是走通到管理器的 400+code ⇒ 排除「路由本身坏了也返回 413」的假绿。
 *   ③ 连发 5 次大 body，读**主进程** `process.memoryUsage().heapUsed`，
 *      断言增量远小于 5 × 1.5 MiB（不线性持有 body）。数值如实记录。
 *
 * 产物：/tmp/uat50/evidence-a.json（含每项断言的 detail 与原始观测值）
 * 退出码：全部通过 → 0；任一条失败 → 非零。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/tmp/uat50';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-a.json');
const DEV_CONFIG = path.join(
  process.env.HOME,
  'Library',
  'Application Support',
  'realm-dev',
  'realm-config.json'
);
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));

/** 每轮大 body 的字节数（> MAX_JSON_BODY_BYTES = 1 MiB） */
const BIG_BODY_BYTES = 1536 * 1024;
/** 期望的体积闸上限（main.js 的 MAX_JSON_BODY_BYTES） */
const EXPECTED_LIMIT = 1024 * 1024;
/** 大 body 连发次数（用于主进程堆观测） */
const BIG_ROUNDS = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/** 在设置页 guest 的主世界里执行一段代码（返回 JSON 可序列化值） */
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

/** 轮询直到 guest 内条件成立（用 guest 自评表达式字符串） */
async function guestWaitFor(page, expr, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await guestEval(page, `(function(){ try { return !!(${expr}); } catch (e) { return 'threw: ' + e.message; } })()`);
    if (last === true) return true;
    await sleep(300);
  }
  throw new Error(`等待超时（${label}）：最后取值 = ${JSON.stringify(last)}`);
}

/** 从 guest 拉一次真实管理面投影（走真实 HTTP + token） */
async function fetchManagement(page) {
  return guestEval(
    page,
    `(async () => {
       const t = new URLSearchParams(location.search).get('token') || '';
       const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
       const text = await r.text();
       let body = null;
       try { body = JSON.parse(text); } catch (e) { body = null; }
       return { status: r.status, bytes: text.length, body };
     })()`
  );
}

/** 把投影拍平为 [{name, tier, disabled, shadowed, overLimit, promptOmitted}] */
function flatten(proj) {
  const out = [];
  for (const g of (proj && proj.groups) || []) {
    for (const it of (g.items || [])) {
      out.push({
        name: it.name,
        tier: it.tier !== undefined ? it.tier : g.tier,
        disabled: it.disabled === true,
        shadowed: it.shadowed === true,
        overLimit: it.overLimit === true,
        promptOmitted: it.promptOmitted === true,
      });
    }
  }
  return out;
}

/** 读磁盘上的 disabled 名单（真实持久化面，用来验「无残留」） */
function readDisabledList() {
  try {
    const c = JSON.parse(fs.readFileSync(DEV_CONFIG, 'utf8'));
    const l = c && c.settings && c.settings.aiSkills && c.settings.aiSkills.disabled;
    return Array.isArray(l) ? l : [];
  } catch (_) {
    return null;
  }
}

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });

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
  if (!fs.existsSync(ELECTRON_EXECUTABLE)) {
    console.error('E-EXE 本仓 electron 不可得:', ELECTRON_EXECUTABLE);
    process.exit(12);
  }

  const { _electron: electronLauncher } = require('playwright');
  const mainLog = [];
  const pageErrors = [];
  let electronApp = null;
  let page = null;
  let exitCode = 1;

  const evidence = {
    driver: 'tests/uat-50-a-manage-read-write.js',
    covers: [2, 4, 5, 6],
    started,
    finished: null,
    repo: REPO_ROOT,
    node: process.version,
    t2: {},
    t4: {},
    t5: {},
    t6: {},
    assertions: {},
    assertionsPass: false,
    initialDisabledList: null,
    finalDisabledList: null,
    pageErrors,
    mainLogTail: [],
  };

  const disabledAtStart = readDisabledList();
  evidence.initialDisabledList = disabledAtStart;

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

    // ---- 打开设置页 ----
    await page.waitForFunction(() => typeof window.openSettingsTab === 'function', null, { timeout: 20000 });
    await page.evaluate(() => window.openSettingsTab());
    await guestWaitFor(page, `typeof window.loadSkillManagement === 'function'`, 30000, '设置页脚本就绪');

    // 让设置页完成一次真实加载并渲染出列表
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(page, `document.querySelectorAll('.skill-manage-row').length > 0`, 30000, '技能行出现');

    // ============================================================
    // T2 —— D-19：未配 provider 仍能列出盘上的技能
    // ============================================================
    const providerConfigured = (() => {
      try {
        const c = JSON.parse(fs.readFileSync(DEV_CONFIG, 'utf8'));
        return !!(c && c.settings && c.settings.ai);
      } catch (_) {
        return null;
      }
    })();
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await sleep(1500);
    const proj2 = await fetchManagement(page);
    const flat2 = flatten(proj2.body);
    const dev2 = await guestEval(
      page,
      `(function(){
         const names = Array.from(document.querySelectorAll('.skill-manage-row')).map(r => r.dataset.skillName);
         const st = document.getElementById('skillManageState');
         const t = st ? st.querySelector('.skill-manage-state-title') : null;
         const groups = Array.from(document.querySelectorAll('.skill-manage-group-title, .skill-manage-groups > * > *')).map(e => e.textContent);
         return { rowNames: names, stateTitle: t ? t.textContent : null, groupTexts: groups.slice(0, 12) };
       })()`
    );
    evidence.t2 = {
      providerConfigured,
      configPath: DEV_CONFIG,
      apiStatus: proj2.status,
      refreshedAt: proj2.body ? proj2.body.refreshedAt : null,
      bytes: proj2.bytes,
      errorsIsArray: !!(proj2.body && Array.isArray(proj2.body.errors)),
      items: flat2,
      dom: dev2,
    };
    log('[T2] providerConfigured =', providerConfigured, '· refreshedAt =', evidence.t2.refreshedAt);
    log('[T2] 投影条目:', flat2.map((i) => `${i.name}(${i.tier})`).join(', '));

    const builtinNames = flat2.filter((i) => i.tier === 'builtin').map((i) => i.name).sort();
    const beforeDisable = flat2.map((i) => i.name);

    // ============================================================
    // T4 —— 禁用后不再进 `/` 列表（广播路径 + 用户可见面）
    // ============================================================
    // 目标技能：优先 user 档（真实存在于盘上且在面板里），回退到任意非 shadowed 的技能
    const target =
      flat2.find((i) => i.tier === 'user' && !i.shadowed && !i.disabled) ||
      flat2.find((i) => !i.shadowed && !i.disabled);
    if (!target) throw new Error('E-TARGET 找不到可禁用的目标技能');
    log('[T4] 目标技能 =', target.name, '(', target.tier, ')');

    const readPanelState = () =>
      page.evaluate(() => {
        const panel = document.getElementById('slashPickerPanel');
        const list = document.getElementById('slashPickerList');
        const rowNames = list
          ? Array.from(list.querySelectorAll('.slash-picker-row .slash-picker-name')).map((e) => e.textContent.replace(/^\//, ''))
          : [];
        let aiSkills = null;
        try {
          // 保留 `disabled` 字段：主进程的面板投影**有意保留** disabled 条目（带 disabled:true），
          // 剔除发生在 buildPickerItems → filterPickerItems。所以「广播是否重拉了快照」
          // 的判据是**该条的 disabled 从 false 变 true**，不是「该条消失」。
          aiSkills = Array.isArray(state.aiSkills)
            ? state.aiSkills.map((s) => ({ name: s && s.name, disabled: !!(s && s.disabled === true) }))
            : null;
        } catch (_) {
          aiSkills = null;
        }
        return {
          panelVisible: panel ? getComputedStyle(panel).display !== 'none' : null,
          rowNames,
          aiSkills,
        };
      });

    const openPanel = async () => {
      await page.click('#aiInput');
      await page.fill('#aiInput', '/');
      await page.evaluate(() => {
        const el = document.getElementById('aiInput');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(900);
    };
    const closePanel = async () => {
      await page.fill('#aiInput', '');
      await page.evaluate(() => {
        const el = document.getElementById('aiInput');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(400);
    };

    // 基线：面板里**有**该技能（否则后面的「不在」无法归因）
    await openPanel();
    const panelBase = await readPanelState();
    await closePanel();
    log('[T4] 基线面板行数 =', panelBase.rowNames.length, '· 含目标 =', panelBase.rowNames.includes(target.name));

    // 真实点击设置页该行的开关
    const clickSwitch = (name) =>
      guestEval(
        page,
        `(function(){
           const row = document.querySelector('.skill-manage-row[data-skill-name="' + ${JSON.stringify(name)} + '"]');
           if (!row) return { ok: false, reason: 'row-not-found' };
           const sw = row.querySelector('.ai-switch');
           if (!sw) return { ok: false, reason: 'switch-not-found' };
           const before = { on: sw.classList.contains('on'), ariaChecked: sw.getAttribute('aria-checked'), disabled: sw.disabled };
           sw.click();
           const after = { on: sw.classList.contains('on'), ariaChecked: sw.getAttribute('aria-checked'), disabled: sw.disabled };
           return { ok: true, before, after };
         })()`
      );

    const click4 = await clickSwitch(target.name);
    log('[T4] 点击开关:', JSON.stringify(click4));
    await sleep(2500);

    // ① 广播路径：面板**未打开**，只读 state.aiSkills
    const broadcastPath = await readPanelState();
    // ② 用户可见面：真开面板
    await openPanel();
    const panelAfterDisable = await readPanelState();
    await closePanel();

    // 重新启用并复验
    const click4b = await clickSwitch(target.name);
    await sleep(2500);
    await openPanel();
    const panelAfterEnable = await readPanelState();
    await closePanel();

    evidence.t4 = {
      target: target.name,
      targetTier: target.tier,
      clickDisable: click4,
      clickEnable: click4b,
      panelBaseline: panelBase,
      broadcastPathWhileClosed: broadcastPath,
      panelAfterDisable,
      panelAfterEnable,
      disabledListAfterDisable: readDisabledList(),
    };
    log('[T4] 禁用后面板含目标 =', panelAfterDisable.rowNames.includes(target.name));
    log('[T4] 启用后面板含目标 =', panelAfterEnable.rowNames.includes(target.name));

    // ============================================================
    // T5 —— 两个设置页之间：重进即同步（不要求即时同步）
    // ============================================================
    const beforeTabs = await page.evaluate(() => {
      let ids = null;
      try {
        ids = Array.from(state.tabs.keys());
      } catch (_) {
        ids = null;
      }
      return { tabIds: ids };
    });
    // 造第二个设置页 tab
    const created = await page.evaluate(async () => {
      try {
        const id = await createTab('default', 'realm://settings');
        return { ok: true, tabId: String(id) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    log('[T5] 建第二个设置页:', JSON.stringify(created));
    await sleep(3000);

    const guestCount = await page.evaluate(() =>
      Array.from(document.querySelectorAll('webview')).filter((w) => {
        try {
          return w.getURL().indexOf('/settings') !== -1;
        } catch (_) {
          return false;
        }
      }).length
    );
    evidence.t5 = { created, guestCount, tabsBefore: beforeTabs };

    // A = 第一个（先出现的）设置页；B = 最后一个
    const evalOnGuestIndex = async (idx, src) =>
      page.evaluate(
        async ({ i, code }) => {
          const wvs = Array.from(document.querySelectorAll('webview')).filter((w) => {
            try {
              return w.getURL().indexOf('/settings') !== -1;
            } catch (_) {
              return false;
            }
          });
          const wv = wvs[i];
          if (!wv) throw new Error('no settings webview at index ' + i);
          return wv.executeJavaScript(code);
        },
        { i: idx, code: src }
      );

    await evalOnGuestIndex(0, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await evalOnGuestIndex(guestCount - 1, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await sleep(1800);

    // 清空 disabled 名单，确保 T5 有一个干净的初始态（并把原值留档）
    const clearDisabled = async () => {
      const cur = readDisabledList() || [];
      for (const n of cur) {
        await guestEval(
          page,
          `(async () => {
             const t = new URLSearchParams(location.search).get('token') || '';
             await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ name: ${JSON.stringify(n)}, disabled: false })
             });
             return 'ok';
           })()`
        );
      }
      await sleep(1200);
    };
    await clearDisabled();

    const t5Target = target.name;
    // A 禁用
    const t5ClickA = await evalOnGuestIndex(
      0,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="' + ${JSON.stringify(t5Target)} + '"]');
         if (!row) return { ok: false, reason: 'row-not-found-A' };
         row.querySelector('.ai-switch').click();
         return { ok: true };
       })()`
    );
    await sleep(2500);
    const disabledAfterA = readDisabledList();

    // 读 B 的状态（**重进前**）
    const readBRow = `(function(){
      const row = document.querySelector('.skill-manage-row[data-skill-name="' + ${JSON.stringify(t5Target)} + '"]');
      if (!row) return { found: false };
      const sw = row.querySelector('.ai-switch');
      return { found: true, on: sw.classList.contains('on'), ariaChecked: sw.getAttribute('aria-checked') };
    })()`;
    const bBeforeReenter = await evalOnGuestIndex(guestCount - 1, readBRow);

    // B 手动重进该页（reload）
    await page.evaluate(async (i) => {
      const wvs = Array.from(document.querySelectorAll('webview')).filter((w) => {
        try {
          return w.getURL().indexOf('/settings') !== -1;
        } catch (_) {
          return false;
        }
      });
      const wv = wvs[i];
      if (wv) wv.reload();
      return 'ok';
    }, guestCount - 1);
    await sleep(4500);
    await evalOnGuestIndex(guestCount - 1, `(function(){ if (typeof window.loadSkillManagement === 'function') window.loadSkillManagement(); return 'ok'; })()`);
    await sleep(2000);
    const bAfterReenter = await evalOnGuestIndex(guestCount - 1, readBRow);

    evidence.t5.clickA = t5ClickA;
    evidence.t5.disabledListAfterA = disabledAfterA;
    evidence.t5.target = t5Target;
    evidence.t5.bBeforeReenter = bBeforeReenter;
    evidence.t5.bAfterReenter = bAfterReenter;
    log('[T5] A 禁用后名单 =', JSON.stringify(disabledAfterA));
    log('[T5] B 重进前 =', JSON.stringify(bBeforeReenter), '→ 重进后 =', JSON.stringify(bAfterReenter));

    // 复原：清空 disabled 名单
    await clearDisabled();
    evidence.t5.disabledListAfterCleanup = readDisabledList();

    // 关闭本探针创建的第二个设置页 tab —— 否则 tabs.json 会持久化它，
    // 下次运行（或用户下次打开 dev 应用）会多出一个残留 tab（实测发生过：连跑两轮后
    // 出现 3 个设置页 guest）。只关**自己创建的那个** tabId，不动用户既有的 tab。
    const closed = await page.evaluate(async (tabId) => {
      try {
        if (typeof closeTab !== 'function') return { ok: false, reason: 'closeTab 不是全局函数' };
        await closeTab(tabId);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }, created.tabId);
    await sleep(800);
    evidence.t5.closedCreatedTab = closed;
    log('[T5] 关闭自建 tab:', JSON.stringify(closed));

    // ============================================================
    // T6 —— 413 拒收探针（Electron 内）+ 反向对照 + 主进程堆
    // ============================================================
    const heap0 = await electronApp.evaluate(() => process.memoryUsage().heapUsed);

    const bigResult = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const pad = 'a'.repeat(${BIG_BODY_BYTES});
         const r = await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: 'zz-probe-nonexistent', disabled: true, pad })
         });
         const text = await r.text();
         let body = null;
         try { body = JSON.parse(text); } catch (e) { body = null; }
         return { status: r.status, bytes: text.length, body };
       })()`
    );
    log('[T6] 大 body →', bigResult.status, JSON.stringify(bigResult.body));

    // 反向对照：小 body 走在**同一路由**上，必须不是 413，而是走通到管理器后回 4xx。
    // 用**格式非法**的名字（含 `/`）构造 —— 该值在 setSkillDisabled 的**首行**校验就被拒
    // （MANAGE_SKILL_ERROR.INVALID_NAME），因此**零副作用**、不写名单。
    // 首版探针误用了「格式合法但不存在的名字」：set-disabled **不校验存在性**，
    // 那会返回 200 并把该名字写进 disabled 名单（实测污染，已清理）—— 记录在案。
    const disabledListBeforeControl = readDisabledList();
    const smallControl = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: 'bad/name', disabled: true })
         });
         const text = await r.text();
         let body = null;
         try { body = JSON.parse(text); } catch (e) { body = null; }
         return { status: r.status, body };
       })()`
    );
    const disabledListAfterControl = readDisabledList();
    log('[T6] 小 body（反向对照，格式非法名）→', smallControl.status, JSON.stringify(smallControl.body));

    // 连发大 body，观察主进程堆
    const heapSamples = [heap0];
    for (let i = 0; i < BIG_ROUNDS; i++) {
      await guestEval(
        page,
        `(async () => {
           const t = new URLSearchParams(location.search).get('token') || '';
           const pad = 'b'.repeat(${BIG_BODY_BYTES});
           const r = await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: 'zz-probe-nonexistent', disabled: true, pad })
           });
           await r.text();
           return r.status;
         })()`
      );
      heapSamples.push(await electronApp.evaluate(() => process.memoryUsage().heapUsed));
    }
    const heapGrowth = heapSamples[heapSamples.length - 1] - heapSamples[0];
    const heapDrops = [];
    for (let i = 1; i < heapSamples.length; i++) heapDrops.push(heapSamples[i] - heapSamples[i - 1]);
    const maxDropBytes = heapDrops.length ? Math.min(...heapDrops) : 0;
    evidence.t6 = {
      bigBodyBytes: BIG_BODY_BYTES,
      bigResult,
      smallControl,
      disabledListBeforeControl,
      disabledListAfterControl,
      heapSamples,
      heapDrops,
      maxDropBytes,
      heapGrowthBytes: heapGrowth,
      linearBoundBytes: BIG_ROUNDS * BIG_BODY_BYTES,
      expectedLimit: EXPECTED_LIMIT,
    };
    log('[T6] 主进程堆采样:', heapSamples.map((h) => Math.round(h / 1048576) + 'MB').join(' → '), '· 增量', Math.round(heapGrowth / 1024) + 'KB');

    // ============================================================
    // 断言集
    // ============================================================
    const a = {};
    a.T2A = {
      pass: providerConfigured === false,
      detail: `T2 的前提：「未配置任何 AI provider」—— realm-config.json 的 settings.ai ${
        providerConfigured === false ? '不存在（前提成立）' : providerConfigured === null ? '读不到（无法确认前提）' : '存在（前提不成立）'
      }`,
    };
    a.T2B = {
      pass: typeof evidence.t2.refreshedAt === 'number' && evidence.t2.refreshedAt > 0,
      detail: `/api/skills/list 的 refreshedAt = ${evidence.t2.refreshedAt}（期望 > 0，即「已加载」而非空态 A）`,
    };
    a.T2C = {
      pass: builtinNames.length === 2 && builtinNames.includes('find-skills') && builtinNames.includes('skill-creator'),
      detail: `builtin 档技能 = ${JSON.stringify(builtinNames)}（期望恰好 ["find-skills","skill-creator"]；src/skills-builtin 下就这两个目录）`,
    };
    a.T2D = {
      pass: evidence.t2.dom && evidence.t2.dom.stateTitle === null &&
        evidence.t2.dom.rowNames.includes('find-skills') && evidence.t2.dom.rowNames.includes('skill-creator'),
      detail: `渲染面：#skillManageState 标题 = ${JSON.stringify(evidence.t2.dom && evidence.t2.dom.stateTitle)}（期望 null，即**不是**「技能列表尚未加载」）· 行含两个内置技能 = ${
        evidence.t2.dom ? evidence.t2.dom.rowNames.includes('find-skills') && evidence.t2.dom.rowNames.includes('skill-creator') : 'n/a'
      }`,
    };

    a.T4A = {
      pass: panelBase.rowNames.includes(target.name),
      detail:
        `T4 基线（非恒真的前提）：启用**之前**，` + '`/` 面板里确实有「' + target.name + '」—— 面板行数 ' + panelBase.rowNames.length +
        '；同时主窗口 state.aiSkills 里该条的 disabled = ' +
        JSON.stringify((panelBase.aiSkills || []).find((x) => x.name === target.name) || null),
    };
    const t4EntryAfterDisable = (broadcastPath.aiSkills || []).find((x) => x.name === target.name);
    const t4EntryAtBaseline = (panelBase.aiSkills || []).find((x) => x.name === target.name);
    a.T4B = {
      pass: !!t4EntryAfterDisable && t4EntryAfterDisable.disabled === true && (!t4EntryAtBaseline || t4EntryAtBaseline.disabled === false),
      detail:
        `广播路径（面板**未打开**时读 state.aiSkills，故打开路径的后台刷新不可能跑过）：` +
        `该条的 disabled 由 baseline ${JSON.stringify(t4EntryAtBaseline)} 变为 ${JSON.stringify(t4EntryAfterDisable)}` +
        `（期望 baseline.disabled=false → after.disabled=true，即 skills:changed 广播确实重拉了快照）`,
    };
    a.T4C = {
      pass: panelAfterDisable.panelVisible === true && !panelAfterDisable.rowNames.includes(target.name),
      detail:
        '用户可见面：禁用后打开面板（panelVisible=' +
        panelAfterDisable.panelVisible +
        '），面板行数 ' +
        panelAfterDisable.rowNames.length +
        '，含「' +
        target.name +
        '」= ' +
        panelAfterDisable.rowNames.includes(target.name) +
        '（期望 false —— filterPickerItems 剔除 disabled === true）',
    };
    a.T4D = {
      pass: panelAfterEnable.rowNames.includes(target.name),
      detail: `恢复面：重新启用后面板又含「${target.name}」= ${panelAfterEnable.rowNames.includes(target.name)}`,
    };
    a.T4E = {
      pass:
        JSON.stringify((readDisabledList() || []).slice().sort()) ===
        JSON.stringify(((disabledAtStart || [])).slice().sort()),
      detail: `无残留：探测结束时 settings.aiSkills.disabled = ${JSON.stringify(readDisabledList())}；起始值 = ${JSON.stringify(disabledAtStart)}`,
    };

    a.T5A = {
      pass: evidence.t5.guestCount >= 2 && t5ClickA && t5ClickA.ok === true,
      detail: `造出两个设置页 guest（实得 ${evidence.t5.guestCount} 个）并在 A 成功点击开关：${JSON.stringify(t5ClickA)}`,
    };
    a.T5B = {
      pass: Array.isArray(disabledAfterA) && disabledAfterA.includes(t5Target),
      detail: `A 禁用后持久化名单 = ${JSON.stringify(disabledAfterA)}（期望含「${t5Target}」，即写盘成功）`,
    };
    a.T5C = {
      pass: bAfterReenter && bAfterReenter.found === true && bAfterReenter.ariaChecked === 'false',
      detail: `B **重进该页**后行状态：${JSON.stringify(bAfterReenter)}（期望 found=true 且 ariaChecked="false"）· 重进前 = ${JSON.stringify(bBeforeReenter)}`,
    };

    a.T6A = {
      pass: bigResult.status === 413 && !!bigResult.body && typeof bigResult.body.error === 'string',
      detail: `${BIG_BODY_BYTES} 字节 body → HTTP ${bigResult.status}，body = ${JSON.stringify(bigResult.body)}（期望 413 + JSON error）`,
    };
    a.T6B = {
      pass: !!bigResult.body && bigResult.body.limit === EXPECTED_LIMIT,
      detail: `413 回传的 limit = ${bigResult.body && bigResult.body.limit}（期望 ${EXPECTED_LIMIT}，即 main.js 的 MAX_JSON_BODY_BYTES）`,
    };
    a.T6C = {
      pass:
        smallControl.status !== 413 &&
        smallControl.status >= 400 &&
        smallControl.status < 500 &&
        smallControl.body &&
        smallControl.body.code === 'invalid_name' &&
        JSON.stringify(disabledListAfterControl) === JSON.stringify(disabledListBeforeControl),
      detail:
        `反向对照：同一路由的小 body（名字含 "/" ⇒ 首行校验即拒）→ HTTP ${smallControl.status} ` +
        `${JSON.stringify(smallControl.body)}（期望 400 + code="invalid_name"，**不是** 413 ⇒ 排除「路由坏了也返回 413」）· ` +
        `名单未被污染：${JSON.stringify(disabledListBeforeControl)} → ${JSON.stringify(disabledListAfterControl)}`,
    };
    a.T6D = {
      pass: heapGrowth < BIG_ROUNDS * BIG_BODY_BYTES,
      detail:
        `主进程堆：连发 ${BIG_ROUNDS} × ${BIG_BODY_BYTES} 字节后增量 ${heapGrowth} 字节 < 线性上界 ${BIG_ROUNDS * BIG_BODY_BYTES} 字节` +
        `（采样 ${heapSamples.map((h) => Math.round(h / 1048576) + 'MB').join(' → ')}；出现过的最大单步回落 ${maxDropBytes} 字节 ⇒ 确有回收发生）。` +
        `⚠ 本判据是**弱信号**：进程堆采样受 GC 时机影响、非确定性；` +
        `「堆不随 body 线性增长」的**确定性**覆盖在 tests/test-skills-http-api.js（纯 Node，含反向对照），此处是 Electron 内的交叉复核。`,
    };

    evidence.assertions = a;
    evidence.assertionsPass = Object.values(a).every((x) => x.pass);
    evidence.finalDisabledList = readDisabledList();
    evidence.beforeDisableSkills = beforeDisable;
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

  log('');
  log('[result] 断言：');
  for (const [k, v] of Object.entries(evidence.assertions || {})) {
    log(`  ${k} ${v.pass ? 'PASS' : 'FAIL'}  ${v.detail}`);
  }
  log('[result] disabled 名单：起始', JSON.stringify(evidence.initialDisabledList), '→ 结束', JSON.stringify(evidence.finalDisabledList));
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(evidence.assertionsPass ? '[result] ALL ASSERTIONS PASS' : '[result] ASSERTIONS FAILED');
  process.exit(exitCode);

  function writeEvidence(ev) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(ev, null, 2));
  }
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
