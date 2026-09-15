#!/usr/bin/env node
/**
 * UAT 驱动（Phase 50 · B 组）—— 100 条规模下的投影/渲染规模、启停四态与卸载弹框、
 * 800px 最小窗口的行布局 backstop。覆盖 `50-UAT.md` 的 Test 7 / 8 / 9。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-50-b-interactions-perf-layout.js
 *
 * 只启动**本进程自己拉起的** realm-dev 子进程。收尾固定 `electronApp.close()` +
 * `process.exit(0)`；**严禁** `pkill` / `pgrep` 模式匹配杀进程。
 *
 * ⚠ 本驱动会**临时写入** realm-dev userData：managed-skills 下 100 个 `zzp-*` 目录
 * （T7）、skills 下 1 个 `zzp-user-*` 用户技能（T8 卸载靶 + T9 遮蔽构造）。三轮
 * 收尾都必须删除；任何一轮中断后用下述命令人工复查：
 *     ls ~/Library/Application\ Support/realm-dev/agent-workspace/managed-skills | grep zzp
 *     ls ~/Library/Application\ Support/realm-dev/agent-workspace/skills | grep zzp
 *
 * 各 Test 的判据与「非恒真」设计
 * -----------------------------
 * **T7**（research A6 / D-13）
 *   造 100 条描述接近上限的技能（总条目数落到 ~122，纯为稳定承载 100 条目标行）。
 *   判据分两层，**先结构性、再记录实测值**：
 *   ① **结构性**（硬判据）：在每条技能的 `SKILL.md` **正文**里埋唯一 marker，
 *      断言 `/api/skills/list` 的响应体**不含**任何 marker ⇒ 投影确不含正文
 *      （这是「~200 KB 上界是估值、未经实测」可以退守成立的那个结构依据）；
 *   ② **实测值**（记录，不当阈值）：响应体字节数、首次渲染耗时、滚动离散步数与总耗时、
 *      单行高度、滚动容器 clientHeight/scrollHeight。
 *   不设主观阈值、不断言「流畅」—— 那不是可机械判定的量；数值如实落盘供人判读。
 *
 * **T8**（`behavior_unverified_items` 1/2）
 *   用**同 tick 判别器**（`<analysis>` 提到的 2026-09-13 手法）：在 `page.evaluate` 里
 *   `sw.click()` 后**在任何 await 之前**同步读回 `.on`/`aria-checked`/`disabled`
 *   —— 此时网络响应绝无可能已返回，故读到的只能是**同步的乐观翻转 + 在途态**。
 *   失败回滚：**先取证再验接线**。取证发现 `/api/skills/set-disabled` **不校验技能是否存在**
 *   （把技能目录改名消失后直接调用，实测 HTTP 200、该名字被写进 disabled 名单）⇒
 *   UI 的失败回滚分支**无法用「技能已被删除」这类真实服务端失败触发**；其余真实失败
 *   （403 需换 token 会连带列表拉不到 / 413 需 >1 MiB body / 503 需 aiManager 为 null）
 *   在运行中的应用内也不可构造。故回滚接线改用**对传输层 `window.skillsApi` 的 stub**
 *   验证，并在结论里**明确标注证据强度低于真实失败**。所有触及用户数据的副作用都复原。
 *
 * **T9**（E5 backstop）
 *   把窗口真实缩到 800px。**诚实边界**：UAT 原文要求「同一行同时命中诊断徽标 +
 *   「已遮蔽」状态标注 + 开关 + 卸载按钮」—— 该组合**在数据层不可构造**：
 *   卸载按钮只在 `tier === 'user'` 的行渲染（`settings-page.js:5033`），而「已遮蔽」
 *   落在**同名遮蔽的败者**上，败者必是 managed（顺序 managed 先、user 后 ⇒ user 胜出）。
 *   故本驱动改为在 800px 下断言**两类最宽真实行**（用户行：卸载+开关；遮蔽托管行：
 *   诊断徽标+「已遮蔽」+开关），并如实标注原文组合未覆盖。
 *
 * 产物：/tmp/uat50/evidence-b.json
 * 退出码：全部通过 → 0；任一条失败 → 非零。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = '/tmp/uat50';
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence-b.json');
const HOME = process.env.HOME;
const MANAGED_DIR = path.join(HOME, 'Library', 'Application Support', 'realm-dev', 'agent-workspace', 'managed-skills');
const USER_SKILLS_DIR = path.join(HOME, 'Library', 'Application Support', 'realm-dev', 'agent-workspace', 'skills');
const ELECTRON_EXECUTABLE = require(path.join(REPO_ROOT, 'node_modules', 'electron'));

/** T7：目标行数（技能总数 = REAL_BASE_COUNT + this） */
const PERF_SKILLS = 100;
/** T7 里的 description 长度（limits.maxDescriptionChars = 1024，取 1000 贴上限但留边界余量） */
const PERF_DESC_CHARS = 1000;
/** T7 里既有真实技能数量（demo/weather/find-skills/skill-creator/aa-budget-01..14/commit-style） */
const REAL_BASE_COUNT = 19;
/** T8/T9 临时用户技能名前缀 */
const USER_PROBE_PREFIX = 'zzp-user-';
/** 800px 档窗口宽度 */
const MIN_WINDOW_WIDTH = 800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

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

/** 写一个技能目录（返回 marker） */
function writeSkill(dir, name, marker) {
  const d = path.join(dir, name);
  fs.mkdirSync(d, { recursive: true });
  if (marker) {
    fs.writeFileSync(path.join(d, 'notes.md'), `# notes\n\n${marker}\n`);
  }
  fs.writeFileSync(path.join(d, 'SKILL.md'), '');
  return d;
}

function skillMd(name, marker) {
  const desc =
    `当需要处理与「${name}」相关的自动化任务时使用此技能。` +
    '本行用于把 description 写到接近上限，以检验管理面在 100 条规模下的投影体积与渲染耗时：'.repeat(12);
  const d = desc.slice(0, PERF_DESC_CHARS);
  return `---\nname: ${name}\ndescription: ${d}\n---\n\n# ${name}\n\n正文携带唯一 marker：${marker}\n`;
}

/** 删除所有以某前缀开头的目录 */
function removePrefixed(dir, prefix) {
  let removed = 0;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (_) {
    return { removed: 0, names: [] };
  }
  for (const n of names) {
    if (!n.startsWith(prefix)) continue;
    try {
      fs.rmSync(path.join(dir, n), { recursive: true, force: true });
      removed++;
    } catch (_) {
      /* 记录在 removed 计数差里 */
    }
  }
  return { removed, names: names.filter((n) => n.startsWith(prefix)) };
}

async function main() {
  const started = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  log('=== 前置清理（上一轮中断可能留下的残留） ===');
  log('managed zzp-* :', JSON.stringify(removePrefixed(MANAGED_DIR, 'zzp-')));
  log('user    zzp-* :', JSON.stringify(removePrefixed(USER_SKILLS_DIR, USER_PROBE_PREFIX)));

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
    driver: 'tests/uat-50-b-interactions-perf-layout.js',
    covers: [7, 8, 9],
    started,
    finished: null,
    node: process.version,
    t7: {},
    t8: {},
    t9: {},
    assertions: {},
    assertionsPass: false,
    pageErrors,
    mainLogTail: [],
    cleanup: {},
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
    await guestWaitFor(page, `typeof window.loadSkillManagement === 'function'`, 30000, '设置页脚本就绪');
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(page, `document.querySelectorAll('.skill-manage-row').length > 0`, 30000, '技能行出现');

    // 切到「AI 助手」子页，让技能管理区**进入布局**。
    // 不做这一步该区在 `display:none` 的面板里：行仍在 DOM 中（querySelector 找得到、
    // 开关 click 也照常触发监听器），但所有 getBoundingClientRect 恒为 0 ⇒ T9 的几何判据
    // 会变成「0 vs 0 全等」的假绿（实测首轮就是这样）。
    await guestEval(
      page,
      `(function(){ try { if (typeof window.switchSettingsPage === 'function') window.switchSettingsPage('ai-assistant'); return 'ok'; } catch (e) { return 'threw: ' + e.message; } })()`
    );
    await sleep(1400);
    await guestWaitFor(
      page,
      `document.querySelector('.skill-manage-row').getBoundingClientRect().height > 0`,
      20000,
      '技能管理区进入布局（行高 > 0）'
    );
    const layoutReady = await guestEval(
      page,
      `(function(){
         const r = document.querySelector('.skill-manage-row');
         const grp = document.getElementById('skillManageGroups');
         return {
           rowHeight: r ? r.getBoundingClientRect().height : null,
           groupsDisplay: grp ? getComputedStyle(grp).display : null,
           visibleRows: Array.from(document.querySelectorAll('.skill-manage-row')).filter(x => x.getBoundingClientRect().height > 0).length,
           totalRows: document.querySelectorAll('.skill-manage-row').length,
         };
       })()`
    );
    evidence.layoutReady = layoutReady;
    log('[setup] 技能管理区进入布局:', JSON.stringify(layoutReady));

    // ============================================================
    // T8-1 —— 启停：同 tick 乐观翻转 + 在途态，随后成功保持
    // ============================================================
    const t8syn = await guestEval(
      page,
      `(function(){
         const rows = Array.from(document.querySelectorAll('.skill-manage-row'));
         const row = rows.find(r => {
           const sw = r.querySelector('.ai-switch');
           return sw && !sw.disabled && sw.classList.contains('on');
         });
         if (!row) return { ok: false, reason: 'no-enabled-row' };
         const name = row.dataset.skillName;
         const sw = row.querySelector('.ai-switch');
         const t0 = performance.now();
         const pre = { on: sw.classList.contains('on'), aria: sw.getAttribute('aria-checked'), disabled: sw.disabled };
         sw.click();
         // —— 同 tick：以下读取在**任何 await 之前**发生，网络响应绝无可能已返回 ——
         const post = { on: sw.classList.contains('on'), aria: sw.getAttribute('aria-checked'), disabled: sw.disabled };
         return { ok: true, name, tier: row.dataset.skillTier, pre, post, syncElapsedMs: performance.now() - t0 };
       })()`
    );
    log('[T8-1] 同 tick 快照:', JSON.stringify(t8syn));
    // ⚠ `setSkillManageHint` 在 2000ms 后自动清空 textContent 并置 display:none
    // （settings-page.js 的 skillManageHintTimer）⇒ 必须在窗口内读取 hint，否则恒为 ''
    await sleep(1000);
    const t8settled = await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="' + ${JSON.stringify(t8syn.name || '')} + '"]');
         if (!row) return { found: false };
         const sw = row.querySelector('.ai-switch');
         const hint = document.getElementById('skillManageHint');
         return {
           found: true,
           on: sw.classList.contains('on'),
           aria: sw.getAttribute('aria-checked'),
           disabled: sw.disabled,
           inFlight: sw.disabled,
           hintText: hint ? hint.textContent : null,
           hintSuccess: hint ? hint.classList.contains('skill-manage-hint-success') : null,
         };
       })()`
    );
    log('[T8-1] 落定态:', JSON.stringify(t8settled));
    evidence.t8 = { sync: t8syn, settled: t8settled };

    // 复原：把它切回启用（保持用户数据不变）
    const t8restore = await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="' + ${JSON.stringify(t8syn.name || '')} + '"]');
         if (!row) return { ok: false, reason: 'row-not-found' };
         row.querySelector('.ai-switch').click();
         return { ok: true };
       })()`
    );
    await sleep(2500);
    evidence.t8.restore = t8restore;

    // ============================================================
    // T8-2 —— 启停失败回滚（真实服务端错误：把技能目录改名 ⇒ not_found）
    // ============================================================
    // 造一个临时用户技能当靶子（避免动用户的 demo/weather）
    const t8TargetName = `${USER_PROBE_PREFIX}t8`;
    const t8TargetMarker = `MARKER-T8-${Date.now()}`;
    const t8TargetDir = path.join(USER_SKILLS_DIR, t8TargetName);
    fs.mkdirSync(t8TargetDir, { recursive: true });
    fs.writeFileSync(path.join(t8TargetDir, 'SKILL.md'), skillMd(t8TargetName, t8TargetMarker));
    log('[T8-2] 造靶技能:', t8TargetName);
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(
      page,
      `document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]') !== null`,
      20000,
      'T8 靶技能行出现'
    );

    // ---- T8-2a：先**取证**「set-disabled 不校验存在性」这一事实 ----
    // 把靶目录改名后再直接打该 API。若返回 200，则「技能目录被删/改名」这条路
    // **不可能**产生失败 —— 于是 UI 的失败回滚分支无法用任何真实服务端失败触发。
    // 这是本项要如实报告的**发现**，不是「测试环境不具备」的豁免理由。
    const renamedTo = t8TargetDir + '.hidden';
    fs.renameSync(t8TargetDir, renamedTo);
    const t8ApiProbe = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: ${JSON.stringify(t8TargetName)}, disabled: true })
         });
         const text = await r.text();
         let body = null;
         try { body = JSON.parse(text); } catch (e) {}
         const items = [];
         for (const g of ((body && body.groups) || [])) for (const it of (g.items || [])) items.push(it.name);
         return { status: r.status, error: body && body.error, containsTarget: items.indexOf(${JSON.stringify(t8TargetName)}) !== -1, itemCount: items.length };
       })()`
    );
    log('[T8-2a] 技能目录已改名后直接调用 set-disabled →', JSON.stringify(t8ApiProbe));
    // 复原目录与名单（该 API 把名字写进了 disabled 名单）
    try {
      fs.renameSync(renamedTo, t8TargetDir);
    } catch (e) {
      log('[T8-2a] 复原目录失败:', e.message);
    }
    await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: ${JSON.stringify(t8TargetName)}, disabled: false })
         });
         return 'ok';
       })()`
    );
    await sleep(800);
    evidence.t8.apiProbeNonexistent = t8ApiProbe;
    evidence.t8.failureTarget = { name: t8TargetName, renamedTo };

    // ---- T8-2b：回滚接线的验证（**对传输层的 stub**，明确披露）----
    // 顶层 `function` 声明在 classic script 里挂在 window 上 ⇒ `window.skillsApi` 可覆写。
    // 之所以只能用 stub：T8-2a 已证明 set-disabled **没有**「技能不存在」这种真实失败；
    // 其余真实失败（403 需换 token 会连带列表拉不到 / 413 需超大 body / 503 需 aiManager 为 null）
    // 在运行中的应用内都不可构造。故这条证据强度**低于**真实失败，如实标注。
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(
      page,
      `document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]') !== null`,
      20000,
      'T8-2b 靶技能行出现'
    );
    const t8Stub = await guestEval(
      page,
      `(async () => {
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]');
         if (!row) return { ok: false, reason: 'row-not-found' };
         const sw = row.querySelector('.ai-switch');
         const orig = window.skillsApi;
         if (typeof orig !== 'function') return { ok: false, reason: 'skillsApi 不是可覆写的全局函数' };
         const before = { on: sw.classList.contains('on'), aria: sw.getAttribute('aria-checked'), disabled: sw.disabled };
         const samples = [];
         window.skillsApi = async () => {
           const e = new Error('注入的传输层失败（stub）');
           e.code = 'stub_transport';
           throw e;
         };
         try {
           sw.click();
           // 同 tick：同步的乐观翻转 + 在途态
           samples.push({ tag: 'same-tick', on: sw.classList.contains('on'), aria: sw.getAttribute('aria-checked'), disabled: sw.disabled });
           for (let i = 0; i < 6; i++) {
             await new Promise((r) => requestAnimationFrame(r));
             const hint = document.getElementById('skillManageHint');
             samples.push({
               tag: 'raf-' + i,
               on: sw.classList.contains('on'),
               aria: sw.getAttribute('aria-checked'),
               disabled: sw.disabled,
               hintText: hint ? hint.textContent : null,
               hintDanger: hint ? hint.classList.contains('skill-manage-hint-danger') : null,
             });
           }
           const rowAfter = document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]');
           return {
             ok: true,
             before,
             samples,
             rowPresentAfter: !!rowAfter,
             afterLast: samples[samples.length - 1],
           };
         } finally {
           window.skillsApi = orig;
         }
       })()`
    );
    evidence.t8.failureRollbackStub = t8Stub;
    log('[T8-2b] stub 回滚:', JSON.stringify(t8Stub));
    // 复原被 stub 干扰之外的副作用：stub 阶段没有真实写入，但保险起见把名单清一次
    await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         await fetch('/api/skills/set-disabled?token=' + encodeURIComponent(t), {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: ${JSON.stringify(t8TargetName)}, disabled: false })
         });
         return 'ok';
       })()`
    );
    await sleep(800);

    // ============================================================
    // T8-3 —— 卸载确认弹框：在途禁用 → 成功 → 行消失
    // ============================================================
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(
      page,
      `document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]') !== null`,
      20000,
      'T8-3 靶技能行出现'
    );
    const t8uninstall = await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]');
         const btn = row.querySelector('.skill-manage-danger-btn');
         if (!btn) return { ok: false, reason: 'uninstall-btn-missing', tier: row.dataset.skillTier };
         btn.click();
         const overlay = document.getElementById('skillManageConfirm');
         const okBtn = document.getElementById('skillManageConfirmOk');
         const open = { display: overlay.style.display, okDisabled: okBtn.disabled };
         okBtn.click();
         const afterClick = { okDisabled: okBtn.disabled, overlayDisplay: overlay.style.display };
         return { ok: true, open, afterClick };
       })()`
    );
    log('[T8-3] 弹框:', JSON.stringify(t8uninstall));
    await sleep(1200); // hint 2000ms 后自清，须在窗口内读
    const t8uninstallSettled = await guestEval(
      page,
      `(function(){
         const overlay = document.getElementById('skillManageConfirm');
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8TargetName}"]');
         const hint = document.getElementById('skillManageHint');
         return {
           overlayDisplay: overlay.style.display,
           rowPresent: !!row,
           hintText: hint ? hint.textContent : null,
           hintSuccess: hint ? hint.classList.contains('skill-manage-hint-success') : null,
         };
       })()`
    );
    evidence.t8.uninstall = { clickFlow: t8uninstall, settled: t8uninstallSettled };
    log('[T8-3] 落定:', JSON.stringify(t8uninstallSettled));

    // ============================================================
    // T8-4 —— 卸载失败（not_found）：弹框关闭 + danger hint + 行随重拉消失
    // ============================================================
    const t8fName = `${USER_PROBE_PREFIX}t8f`;
    const t8fDir = path.join(USER_SKILLS_DIR, t8fName);
    fs.mkdirSync(t8fDir, { recursive: true });
    fs.writeFileSync(path.join(t8fDir, 'SKILL.md'), skillMd(t8fName, `MARKER-T8F-${Date.now()}`));
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await guestWaitFor(
      page,
      `document.querySelector('.skill-manage-row[data-skill-name="${t8fName}"]') !== null`,
      20000,
      'T8-4 靶技能行出现'
    );
    // 在打开弹框后、确认前把目录改名
    const t8fFlow = await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8fName}"]');
         row.querySelector('.skill-manage-danger-btn').click();
         const overlay = document.getElementById('skillManageConfirm');
         return { ok: true, openDisplay: overlay.style.display };
       })()`
    );
    const t8fDirHidden = t8fDir + '.hidden';
    fs.renameSync(t8fDir, t8fDirHidden);
    const t8fConfirm = await guestEval(
      page,
      `(function(){
         const okBtn = document.getElementById('skillManageConfirmOk');
         okBtn.click();
         return { okDisabledAfterClick: okBtn.disabled };
       })()`
    );
    await sleep(1200); // hint 2000ms 后自清，须在窗口内读
    const t8fSettled = await guestEval(
      page,
      `(function(){
         const overlay = document.getElementById('skillManageConfirm');
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8fName}"]');
         const hint = document.getElementById('skillManageHint');
         return {
           overlayDisplay: overlay.style.display,
           rowPresent: !!row,
           hintText: hint ? hint.textContent : null,
           hintDanger: hint ? hint.classList.contains('skill-manage-hint-danger') : null,
         };
       })()`
    );
    // 再等一会儿读「行是否已被重拉移除」（不依赖 hint 存活）
    await sleep(2500);
    const t8fRowAfter = await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="${t8fName}"]');
         return { rowPresent: !!row };
       })()`
    );
    evidence.t8.uninstallFailure = { flow: t8fFlow, confirm: t8fConfirm, settled: t8fSettled, rowAfter: t8fRowAfter };
    log('[T8-4] 卸载失败落定:', JSON.stringify(t8fSettled));
    try {
      fs.renameSync(t8fDirHidden, t8fDir);
    } catch (e) {
      log('[T8-4] 复原目录失败:', e.message);
    }

    // 清理 T8 的靶技能
    evidence.cleanup.t8Target = removePrefixed(USER_SKILLS_DIR, USER_PROBE_PREFIX);
    log('[T8] 清理靶技能:', JSON.stringify(evidence.cleanup.t8Target));

    // ============================================================
    // T9 —— 最小窗口（800px）下的行布局 backstop
    // ============================================================
    // 构造「已遮蔽」：user 技能与既有 managed 技能同名 ⇒ managed 那个成为败者
    const shadowWinner = 'aa-budget-01';
    const t9Dir = path.join(USER_SKILLS_DIR, shadowWinner);
    fs.mkdirSync(t9Dir, { recursive: true });
    fs.writeFileSync(path.join(t9Dir, 'SKILL.md'), skillMd(shadowWinner, `MARKER-T9-${Date.now()}`));
    // 长名用户技能：**名字只有宽于可用宽度时才会走省略号** —— 没有它，T9E 的
    // 「缩到省略号」判据会因为 `aa-budget-01` 只有 94px 而恒真/恒假的假绿。
    const t9WideName = `${USER_PROBE_PREFIX}widest-row-layout-probe-aaaaaaaaaaaaaaaaaaaa`;
    const t9WideDir = path.join(USER_SKILLS_DIR, t9WideName);
    fs.mkdirSync(t9WideDir, { recursive: true });
    fs.writeFileSync(path.join(t9WideDir, 'SKILL.md'), skillMd(t9WideName, `MARKER-T9W-${Date.now()}`));
    // 记录**创建即登记**（供 finally 无条件清理）：清理逻辑若依赖「测量是否成功」，
    // 一旦中途抛错就会漏删（实测首轮 `manage is not defined` 中断后 aa-budget-01 残留）。
    evidence.t9Created = [shadowWinner, t9WideName];
    await guestEval(page, `(function(){ window.loadSkillManagement(); return 'ok'; })()`);
    await sleep(2500); // 等真实 fetch 回来并完成重渲染，再滚动/测量
    await guestEval(
      page,
      `(function(){
         const row = document.querySelector('.skill-manage-row[data-skill-name="${shadowWinner}"]');
         if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
         return 'ok';
       })()`
    );

    // 真实把窗口缩到 800px。
    // ⚠ 两条已知坑：① 本仓实测 `electronApp.evaluate` 的**位置参数传不进** evaluate 函数
    // （见项目记忆），故宽度用**字符串内插**进源码；② `app.evaluate` 主进程上下文里
    // 未必有全局 `require`，两条路径都试。方法按可靠性依次回退，并记录哪条生效。
    const resizeTo = async (w, h) => {
      const out = { requested: [w, h], methods: [] };
      try {
        await page.setViewportSize({ width: w, height: h });
        await sleep(700);
        const iw = await page.evaluate(() => window.innerWidth);
        const ok = Math.abs(iw - w) <= 2;
        out.methods.push({ method: 'page.setViewportSize', innerWidth: iw, ok });
        if (ok) {
          out.used = 'page.setViewportSize';
          out.innerWidth = iw;
          return out;
        }
      } catch (e) {
        out.methods.push({ method: 'page.setViewportSize', error: e.message });
      }
      try {
        const r = await electronApp.evaluate(`(async () => {
          let electron = null;
          try { electron = require('electron'); } catch (e) {}
          if (!electron || !electron.BrowserWindow) { try { electron = process.mainModule.require('electron'); } catch (e) {} }
          if (!electron || !electron.BrowserWindow) return { ok: false, reason: 'no BrowserWindow accessor' };
          const win = electron.BrowserWindow.getAllWindows().find(x => {
            try { return x.webContents.getURL().includes('index.html'); } catch (e) { return false; }
          });
          if (!win) return { ok: false, reason: 'no index window' };
          win.setSize(${w}, ${h});
          return { ok: true, width: win.getSize()[0], height: win.getSize()[1], minWidth: win.getMinimumSize ? win.getMinimumSize()[0] : null };
        })()`);
        await sleep(1000);
        const iw = await page.evaluate(() => window.innerWidth);
        const ok = Math.abs(iw - w) <= 2;
        out.methods.push({ method: 'BrowserWindow.setSize', result: r, innerWidth: iw, ok });
        if (ok) {
          out.used = 'BrowserWindow.setSize';
          out.innerWidth = iw;
          return out;
        }
      } catch (e) {
        out.methods.push({ method: 'BrowserWindow.setSize', error: e.message });
      }
      out.used = null;
      out.innerWidth = await page.evaluate(() => window.innerWidth).catch(() => null);
      return out;
    };
    const sized = await resizeTo(MIN_WINDOW_WIDTH, 900);
    log('[T9] 缩窗结果:', JSON.stringify(sized));

    // ⚠ 必须按 **(name, tier)** 双键定位：同名技能可以同时存在于 user 与 managed 两个分组
    // （T9 的遮蔽构造正是这样），`querySelector` 只会返回**第一个**（user 分组在前），
    // 首轮实测就是这么错测了 user 行、把遮蔽托管行的判据判红。
    const measureRow = (name, tier) => `(function(){
      const all = Array.from(document.querySelectorAll('.skill-manage-row[data-skill-name="' + ${JSON.stringify(name)} + '"]'));
      const row = ${tier ? `all.find(x => x.dataset.skillTier === ${JSON.stringify(tier)})` : 'all[0]'};
      if (!row) return { found: false, candidates: all.map(x => x.dataset.skillTier) };
      const main = row.querySelector('.skill-manage-row-main');
      const nameEl = row.querySelector('.skill-manage-name');
      const actions = row.querySelector('.skill-manage-actions');
      const status = row.querySelector('.skill-manage-status');
      const diag = row.querySelector('.skill-manage-diag-badge');
      const sw = row.querySelector('.ai-switch');
      const un = row.querySelector('.skill-manage-danger-btn');
      const r = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
      };
      // 单行基准：必须取**同 tier 且同操作簇构成**（是否带卸载按钮）的无标注行 ——
      // 交叉类型比头部高是错的：用户行操作簇含卸载按钮（实测头部 28px），
      // 托管行只有开关（实测 20px），两者本来就不同高，不是「换行」。
      // ⚠ 比的是 .skill-manage-row-main（**头部**）高，不是整行高 —— 整行还含描述，
      // 描述换行数因文案长度而不同（实测 64/66/67）。
      // （本段是**生成给 guest 执行的源码字符串**，内部不得出现反引号 —— 会提前终止外层模板。）
      const selfHasUn = !!row.querySelector('.skill-manage-danger-btn');
      const plain = Array.from(document.querySelectorAll('.skill-manage-row')).find(x =>
        x.dataset.skillName !== ${JSON.stringify(name)} &&
        x.dataset.skillTier === row.dataset.skillTier &&
        !!x.querySelector('.skill-manage-danger-btn') === selfHasUn &&
        !x.querySelector('.skill-manage-diag-badge') &&
        !x.querySelector('.skill-manage-status'));
      const plainMain = plain ? plain.querySelector('.skill-manage-row-main') : null;
      const cs = getComputedStyle(nameEl);
      return {
        found: true,
        tier: row.dataset.skillTier,
        row: r(row),
        main: r(main),
        nameEl: r(nameEl),
        actions: r(actions),
        hasStatus: !!status,
        statusText: status ? status.textContent : null,
        hasDiagBadge: !!diag,
        hasSwitch: !!sw,
        hasUninstall: !!un,
        nameScrollWidth: nameEl.scrollWidth,
        nameClientWidth: nameEl.clientWidth,
        nameTitle: nameEl.getAttribute('title'),
        nameTextContent: nameEl.textContent,
        nameWhiteSpace: cs.whiteSpace,
        nameTextOverflow: cs.textOverflow,
        mainScrollWidth: main.scrollWidth,
        mainClientWidth: main.clientWidth,
        plainRowHeight: plain ? plain.getBoundingClientRect().height : null,
        plainMainHeight: plainMain ? plainMain.getBoundingClientRect().height : null,
        mainHeight: main ? main.getBoundingClientRect().height : null,
        viewportWidth: window.innerWidth,
      };
    })()`;

    const t9 = {};
    // ① 遮蔽托管行（诊断徽标 + 「已遮蔽」+ 开关，无卸载）
    const rows9 = await guestEval(
      page,
      `(function(){ return Array.from(document.querySelectorAll('.skill-manage-row')).map(r => r.dataset.skillName + '|' + r.dataset.skillTier + (r.querySelector('.skill-manage-status') ? '|status' : '') + (r.querySelector('.skill-manage-diag-badge') ? '|diag' : '') + (r.querySelector('.skill-manage-danger-btn') ? '|un' : '')); })()`
    );
    evidence.t9.rowInventory = rows9;
    const shadowedEntry =
      (rows9 || []).find((s) => s.split('|')[1] === 'managed' && s.includes('|status') && s.includes('|diag')) || null;
    log('[T9] 行清点（含标注的行）:', JSON.stringify((rows9 || []).filter((s) => s.includes('|status') || s.includes('|diag'))));
    if (shadowedEntry) {
      const parts = shadowedEntry.split('|');
      t9.shadowedRowName = parts[0];
      t9.shadowedRowTier = parts[1];
      t9.shadowedRow = await guestEval(page, measureRow(parts[0], parts[1]));
    }
    // ② 用户行（卸载 + 开关）；遮蔽胜者即 user 同名的那一个
    t9.userRow = await guestEval(page, measureRow(shadowWinner, 'user'));
    // ③ 长名用户行（卸载 + 开关 + **必然需要省略号**的名字）：E5 backstop 的真正承重行
    t9.wideRow = await guestEval(page, measureRow(t9WideName, 'user'));
    t9.wideRowName = t9WideName;
    await page.screenshot({ path: path.join(OUT_DIR, 't9-800px.png') });
    evidence.screenshots = { t9: path.join(OUT_DIR, 't9-800px.png') };
    evidence.t9.resize = sized;
    evidence.t9.measurements = t9;
    log('[T9] 遮蔽托管行:', JSON.stringify(t9.shadowedRow));
    log('[T9] 用户行:', JSON.stringify(t9.userRow));

    // ============================================================
    // T7 —— 100 条技能规模：投影字节数 + 首渲染耗时 + 滚动 + 不含正文
    // ============================================================
    // 基线**动态取**：T9 已在本驱动内造过一个与 managed 同名的 user 技能，
    // 硬编码 REAL_BASE_COUNT 会漂移（首轮实测 120 vs 硬编码期望 119）。
    const t7Baseline = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
         const b = await r.json();
         let n = 0;
         for (const g of (b.groups || [])) n += (g.items || []).length;
         return n;
       })()`
    );
    log('[T7] 造技能前的基线条目数 =', t7Baseline);
    const t7Expected = t7Baseline + PERF_SKILLS;

    const t7Markers = [];
    for (let i = 0; i < PERF_SKILLS; i++) {
      const nm = `zzp-perf-${String(i).padStart(3, '0')}`;
      const marker = `PERFBODYMARKER${String(i).padStart(3, '0')}${Date.now()}`;
      t7Markers.push(marker);
      const d = writeSkill(MANAGED_DIR, nm, null);
      fs.writeFileSync(path.join(d, 'SKILL.md'), skillMd(nm, marker));
    }
    log('[T7] 已造', PERF_SKILLS, '条技能');

    // 从设置页 guest 拉一次真实投影并量字节
    const t7Fetch = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
         const text = await r.text();
         const body = JSON.parse(text);
         let total = 0;
         for (const g of (body.groups || [])) total += (g.items || []).length;
         return { status: r.status, bytes: text.length, rowCount: total, refreshedAt: body.refreshedAt };
       })()`
    );
    const t7BodyLeak = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
         const text = await r.text();
         const probes = ${JSON.stringify(t7Markers.slice(0, 5))};
         const previews = ${JSON.stringify(t7Markers.map((m) => m.slice(0, 17)))};
         let hitProbe = 0;
         for (const p of probes) if (text.indexOf(p) !== -1) hitProbe++;
         // 前缀扫描：所有 marker 的前 17 位（唯一）都出现才说明正文进了投影
         let hitPrefix = 0;
         for (const p of previews) if (text.indexOf(p) !== -1) hitPrefix++;
         return { hitProbe, hitPrefix, probeCount: probes.length, prefixCount: previews.length };
       })()`
    );
    log('[T7] 投影:', JSON.stringify(t7Fetch), '· 正文 marker 泄漏:', JSON.stringify(t7BodyLeak));

    // 首渲染耗时 + 滚动采样（用**真实**投影驱动真实渲染入口）
    const t7Render = await guestEval(
      page,
      `(async () => {
         const t = new URLSearchParams(location.search).get('token') || '';
         const r = await fetch('/api/skills/list?token=' + encodeURIComponent(t), { cache: 'no-store' });
         const body = await r.json();
         const scroller = document.querySelector('.settings-content');
         const t0 = performance.now();
         window.renderSkillManagement(body);
         const renderMs = performance.now() - t0;
         const rowCount = document.querySelectorAll('.skill-manage-row').length;
         const groupCount = document.querySelectorAll('.skill-manage-groups > *').length;
         const sampleRow = document.querySelector('.skill-manage-row');
         const rowH = sampleRow ? sampleRow.getBoundingClientRect().height : null;

         // 滚动采样：滚到底再回顶，量「离散步数与总耗时」（滚动流畅度的可记录代理量）
         const steps = 12;
         const t1 = performance.now();
         if (scroller) {
           for (let i = 0; i <= steps; i++) {
             scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) * (i / steps));
             await new Promise((res) => requestAnimationFrame(res));
           }
         }
         const scrollMs = performance.now() - t1;
         if (scroller) scroller.scrollTop = 0;
         return {
           renderMs,
           scrollMs,
           scrollSteps: steps,
           rowCount,
           groupCount,
           rowHeight: rowH,
           scrollClientHeight: scroller ? scroller.clientHeight : null,
           scrollHeight: scroller ? scroller.scrollHeight : null,
         };
       })()`
    );
    evidence.t7 = {
      createdSkills: PERF_SKILLS,
      descriptionChars: PERF_DESC_CHARS,
      baselineRows: t7Baseline,
      expectedTotalRows: t7Expected,
      fetch: t7Fetch,
      bodyLeak: t7BodyLeak,
      render: t7Render,
      markers: t7Markers,
    };
    log('[T7] 渲染:', JSON.stringify(t7Render));

    // 清理 100 条
    evidence.cleanup.t7 = removePrefixed(MANAGED_DIR, 'zzp-');
    log('[T7] 清理:', JSON.stringify(evidence.cleanup.t7));

    // ============================================================
    // 断言
    // ============================================================
    const a = {};
    a.T7A = {
      pass: t7Fetch.rowCount === t7Expected,
      detail: `投影条目数 = ${t7Fetch.rowCount}（期望 基线 ${t7Baseline} + 新造 ${PERF_SKILLS} = ${t7Expected}）`,
    };
    a.T7B = {
      pass: t7BodyLeak.hitProbe === 0 && t7BodyLeak.hitPrefix === 0,
      detail:
        `结构性判据（硬）：投影**不含正文** —— 5 个完整正文 marker 命中 ${t7BodyLeak.hitProbe} 个、` +
        `${t7BodyLeak.prefixCount} 个 marker 的 17 位唯一前缀命中 ${t7BodyLeak.hitPrefix} 个（期望均为 0）`,
    };
    a.T7C = {
      pass: typeof t7Fetch.bytes === 'number' && t7Fetch.bytes > 0,
      detail: `**实测**（非阈值）：/api/skills/list 响应体 ${t7Fetch.bytes} 字节（${t7Fetch.rowCount} 条；` +
        `UAT 原文的「~200 KB 上界」是未经实测的估值，此处只如实记录）`,
    };
    a.T7D = {
      pass: t7Render.rowCount === t7Expected && typeof t7Render.renderMs === 'number',
      detail: `**实测**：一次 renderSkillManagement 渲染 ${t7Render.rowCount} 行 / ${t7Render.groupCount} 组耗时 ${t7Render.renderMs.toFixed(1)} ms；` +
        `滚动 ${t7Render.scrollSteps} 步耗时 ${t7Render.scrollMs.toFixed(1)} ms；单行高 ${t7Render.rowHeight}px；` +
        `滚动容器 clientHeight=${t7Render.scrollClientHeight} / scrollHeight=${t7Render.scrollHeight}。` +
        `「滚动流畅度」不是可机械判定的量，故此处只记录离散步数与耗时，不设主观阈值。`,
    };
    // T8
    a.T8A = {
      pass:
        t8syn.ok === true && t8syn.pre.on === true && t8syn.post.on === false &&
        t8syn.pre.aria === 'true' && t8syn.post.aria === 'false' &&
        t8syn.pre.disabled === false && t8syn.post.disabled === true,
      detail:
        `同 tick 判别器（读回发生在任何 await 之前，网络响应不可能已返回）：` +
        `pre=${JSON.stringify(t8syn.pre)} → post=${JSON.stringify(t8syn.post)}（期望 .on true→false、aria true→false、disabled false→true）` +
        `· 同步耗时 ${t8syn.syncElapsedMs !== undefined ? t8syn.syncElapsedMs.toFixed(2) : '?'} ms`,
    };
    a.T8B = {
      pass: t8settled.found === true && t8settled.disabled === false && t8settled.on === false,
      detail: `成功保持：落定态 ${JSON.stringify(t8settled)}（期望 on=false、disabled=false —— 在途态已解除）· hint=${JSON.stringify(t8settled.hintText)}`,
    };
    const stub = evidence.t8.failureRollbackStub || {};
    const stubFirst = (stub.samples && stub.samples[0]) || {};
    const stubLast = stub.afterLast || {};
    a.T8C = {
      pass:
        t8ApiProbe.status === 200 &&
        stub.ok === true &&
        stubFirst.on === false && stubFirst.disabled === true &&
        stubLast.on === true && stubLast.aria === 'true' && stubLast.disabled === false &&
        stubLast.hintDanger === true && typeof stubLast.hintText === 'string' && stubLast.hintText.length > 0 &&
        stub.rowPresentAfter === true,
      detail:
        `**发现（先取证）**：技能目录改名消失后**直接**调用 \`/api/skills/set-disabled\` → HTTP ${t8ApiProbe.status} ` +
        `${JSON.stringify(t8ApiProbe.error || null)}（**不是** not_found）⇒ 该端点**不校验存在性**，` +
        `于是 UI 的失败回滚分支（settings-page.js:5361-5364）**无法用「技能已被删除」这类真实服务端失败触发**；` +
        `其余真实失败在运行中的应用内也不可构造（403 需换 token 会连带列表拉不到 / 413 需 >1MiB body / 503 需 aiManager 为 null）。\n  ` +
        `**回滚接线验证（对传输层 \`window.skillsApi\` 的 stub，证据强度低于真实失败）**：` +
        `同 tick → ${JSON.stringify(stubFirst)}（乐观翻转 + 在途态）；6 帧后 → ${JSON.stringify(stubLast)} ` +
        `（期望回滚为 on=true / aria="true" / disabled=false、danger hint 非空、行仍在=${stub.rowPresentAfter}）`,
    };
    a.T8D = {
      pass:
        t8uninstall.ok === true && t8uninstall.open.display === 'flex' &&
        t8uninstall.open.okDisabled === false && t8uninstall.afterClick.okDisabled === true &&
        t8uninstall.afterClick.overlayDisplay === 'flex',
      detail:
        `卸载弹框：打开后 display=${t8uninstall.open && t8uninstall.open.display}（期望 flex）、确认前 ok 按钮 disabled=${t8uninstall.open && t8uninstall.open.okDisabled}（期望 false）；` +
        `点击确认后 ok 按钮 disabled=${t8uninstall.afterClick && t8uninstall.afterClick.okDisabled}（期望 true）、弹框 display=${t8uninstall.afterClick && t8uninstall.afterClick.overlayDisplay}（期望仍 flex ⇒ 响应到达前保持打开）`,
    };
    a.T8E = {
      pass: t8uninstallSettled.overlayDisplay === 'none' && t8uninstallSettled.rowPresent === false,
      detail: `卸载成功：弹框 display=${t8uninstallSettled.overlayDisplay}（期望 none）、靶技能行 ${
        t8uninstallSettled.rowPresent ? '仍在' : '已消失'
      } · hint=${JSON.stringify(t8uninstallSettled.hintText)}（success 类=${t8uninstallSettled.hintSuccess}）`,
    };
    a.T8F = {
      pass:
        t8fSettled.overlayDisplay === 'none' && t8fSettled.hintDanger === true &&
        typeof t8fSettled.hintText === 'string' && t8fSettled.hintText.length > 0 &&
        t8fRowAfter.rowPresent === false,
      detail:
        `卸载失败（not_found）：弹框 display=${t8fSettled.overlayDisplay}（期望 none ⇒ 失败即关闭）、` +
        `danger hint 类=${t8fSettled.hintDanger} 文案=${JSON.stringify(t8fSettled.hintText)}（期望非空）、` +
        `该行 rowPresent=${t8fSettled.rowPresent} → 2.5s 后 ${t8fRowAfter.rowPresent}（期望 false —— not_found 后重拉自然消失）`,
    };
    // T9
    const t9user = t9.userRow || {};
    const t9sh = t9.shadowedRow || {};
    const t9wide = t9.wideRow || {};
    a.T9A = {
      pass: t9user.found === true && t9user.hasUninstall === true && t9user.hasSwitch === true && t9user.viewportWidth <= MIN_WINDOW_WIDTH + 2,
      detail: `视口宽度实际为 ${t9user.viewportWidth}px（请求 ${MIN_WINDOW_WIDTH}px；缩窗方法=${sized.used}，逐法记录 ${JSON.stringify(sized.methods)}）· ` +
        `用户行：found=${t9user.found} · 有卸载按钮=${t9user.hasUninstall} · 有开关=${t9user.hasSwitch} · tier=${t9user.tier}`,
    };
    a.T9B = {
      pass: t9sh.found === true && t9sh.hasDiagBadge === true && t9sh.hasStatus === true && String(t9sh.statusText || '').indexOf('已遮蔽') !== -1,
      detail: t9sh.found
        ? `800px 下遮蔽托管行「${t9.shadowedRowName}」：诊断徽标=${t9sh.hasDiagBadge} · 状态标注=${JSON.stringify(t9sh.statusText)}（期望含「已遮蔽」）· 开关=${t9sh.hasSwitch} · 卸载按钮=${t9sh.hasUninstall}`
        : `未构造出遮蔽行（rowInventory=${JSON.stringify((rows9 || []).filter((s) => s.includes('status') || s.includes('diag')))})`,
    };
    const singleLine = (m) =>
      !!m && m.found === true && m.plainMainHeight !== null && m.mainHeight !== null &&
      Math.abs(m.mainHeight - m.plainMainHeight) < 1 &&
      m.mainScrollWidth <= m.mainClientWidth + 1 &&
      m.actions && m.row && m.actions.right <= m.row.right + 0.5 &&
      m.nameClientWidth > 0;
    const geom = (label, m) =>
      `${label}「${m.nameTextContent}」：头部高 ${m.mainHeight} vs 最简行头部高 ${m.plainMainHeight}（期望差 <1px）· ` +
      `头部横向溢出 ${(m.mainScrollWidth - m.mainClientWidth).toFixed(2)}px（期望 ≤1）· ` +
      `操作簇右缘 ${m.actions.right.toFixed(2)} vs 行右缘 ${m.row.right.toFixed(2)}（期望 ≤）· ` +
      `名称 clientWidth=${m.nameClientWidth} scrollWidth=${m.nameScrollWidth} title=${JSON.stringify(m.nameTitle)}`;
    a.T9C = {
      pass: singleLine(t9wide),
      detail: t9wide.found
        ? geom('800px 下**长名**用户行（卸载+开关，E5 backstop 的承重行）', t9wide)
        : `未测到长名用户行（candidates=${JSON.stringify(t9wide.candidates)}）`,
    };
    a.T9D = {
      pass: t9sh.found ? singleLine(t9sh) : false,
      detail: t9sh.found ? geom('800px 下遮蔽托管行（诊断徽标+已遮蔽+开关）', t9sh) : '未测到遮蔽行',
    };
    a.T9E = {
      pass:
        t9wide.nameWhiteSpace === 'nowrap' && t9wide.nameTextOverflow === 'ellipsis' &&
        t9wide.nameScrollWidth > t9wide.nameClientWidth &&
        t9wide.nameTitle === t9wide.nameTextContent,
      detail:
        `仅技能名缩到省略号且 title 可读全名（判据落在**必然需要截断**的长名行上）：` +
        `white-space=${t9wide.nameWhiteSpace} · text-overflow=${t9wide.nameTextOverflow} · ` +
        `scrollWidth ${t9wide.nameScrollWidth} > clientWidth ${t9wide.nameClientWidth}（确实被截断）· ` +
        `title=${JSON.stringify(t9wide.nameTitle)} === 文本 ${JSON.stringify(t9wide.nameTextContent)}`,
    };
    a.T9F = {
      pass: String(evidence.t9.rowInventory || '') !== '' && !(evidence.t9.rowInventory || []).some((s) => s.includes('status') && s.includes('|un')),
      detail:
        `**诚实边界**：UAT 原文要求「同一行同时命中诊断徽标 + 「已遮蔽」+ 开关 + 卸载按钮」的组合` +
        `**在数据层不可构造** —— 卸载按钮只在 tier==='user' 行渲染（settings-page.js:5033），而「已遮蔽」落在同名遮蔽的` +
        `**败者**上、败者必为 managed（顺序 managed 先 / user 后 ⇒ user 胜出）。` +
        `故本项以两类最宽**真实**行替代（用户行覆盖卸载+开关，遮蔽托管行覆盖诊断徽标+已遮蔽+开关），` +
        `并断言清单里**不存在**任何「同时有状态标注与卸载按钮」的行以证明该组合确实不可得。`,
    };

    evidence.assertions = a;
    evidence.assertionsPass = Object.values(a).every((x) => x.pass);
  } catch (err) {
    evidence.thrown = String((err && err.message) || err);
    log('[error]', evidence.thrown);
  } finally {
    // 兜底清理（无论成功失败都清掉 zzp-* 残留）
    try {
      evidence.cleanup.finalManaged = removePrefixed(MANAGED_DIR, 'zzp-');
      evidence.cleanup.finalUser = removePrefixed(USER_SKILLS_DIR, USER_PROBE_PREFIX);
      evidence.cleanup.finalUserAaBudget01 = (() => {
        // 按**创建时登记的名字**无条件清理（不依赖「测量是否成功」—— 依赖它会在中途抛错时漏删）
        const created = Array.isArray(evidence.t9Created) ? evidence.t9Created : [];
        if (created.length === 0) return 'not-created';
        const res = [];
        for (const n of created) {
          const p = path.join(USER_SKILLS_DIR, n);
          try {
            if (fs.existsSync(p)) {
              fs.rmSync(p, { recursive: true, force: true });
              res.push(n + ':removed');
            } else {
              res.push(n + ':absent');
            }
          } catch (e) {
            res.push(n + ':failed(' + e.message + ')');
          }
        }
        return res.join(', ');
      })();
    } catch (e) {
      log('[cleanup] 失败:', e.message);
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
  log('[result] 清理:', JSON.stringify(evidence.cleanup));
  if (evidence.t9 && evidence.t9.rowInventory) {
    log('[result] 800px 行清点:', JSON.stringify(evidence.t9.rowInventory));
  }
  log('[result] 证据 JSON →', EVIDENCE_PATH);
  if (evidence.thrown) log('[result] 异常：', evidence.thrown);
  log(evidence.assertionsPass ? '[result] ALL ASSERTIONS PASS' : '[result] ASSERTIONS FAILED');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('驱动异常退出：', err && err.stack ? err.stack : err);
  process.exit(1);
});
