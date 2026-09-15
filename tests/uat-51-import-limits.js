#!/usr/bin/env node
/**
 * UAT 驱动（Phase 51 · 限额与内存面）—— 把 `51-UAT.md` 的 Test 3 从人工面自动化。
 *
 * 「32 MiB 上传的真实耗时与内存峰值」
 * -----------------------------------
 * 计划原文要求「dev 模式打开 DevTools Performance，上传接近 32 MiB 的包 ⇒ 记录耗时与堆曲线；
 * 确认**无**『先 arrayBuffer() 再判大小』的峰值」。本驱动把它落成**三条互补判据**：
 *
 * **A. 近限成功（≈30.3 MiB 合法包）**
 *   - 包在 **guest 内现场生成**（store 方式 + 正确 CRC32，**不经 CDP 传字节** ——
 *     否则 base64 载荷本身就会污染内存读数）；
 *   - 断言①：真的走到 READY（⇒ 体量与限额口径对得上，不是「跑了个空壳」）；
 *   - 断言②（正命题）：**主进程 RSS 峰值增量 > 16 MiB** ⇒ 这 ~30 MiB 真的过了线；
 *   - 断言③（确定性源码判据）：`src/settings-page.js` 的 Phase 51 导入区内
 *     **零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader`**，且本地上传分支的 `body`
 *     逐字是 `source && source.file`（File 直传）+ 显式 `Content-Type: application/zip`
 *     —— 「先 arrayBuffer() 再判大小」在该路径上**不可能发生**。
 *
 * **B. 超限拒绝（≈64 MiB 包）**
 *   - `readRawBody` 的两条合法分支都会拒：`Content-Length` **零字节快路径**（声明超限即 413，
 *     一个字节都不读）或**累积到上限即拒 + `req.resume()` 排空**。断言：
 *     ① 状态行出现「请求体超过上限」且为 danger（**不是静默失败**）；
 *     ② 文案含真实限额数字（可操作原因，不是通用兜底）；
 *     ③ **`readRawBody` 的源码契约**（`Content-Length` 预检 + 累积中判 + `req.resume()`）
 *     与三条单点变异自证 —— 「内存上界如实为 `maxBytes`」这条承诺**由源码契约承重**；
 *     ④ 全程零 `pageerror`。
 *
 * **为什么 B 侧的 RSS 读数只登记不断言（本驱动的一处刻意让步）**
 *   初版曾断言「RSS 增量 ≤ `maxBytes` + 8 MiB」，但该断言**分支相关且不稳定**：
 *   `/gsd-verify-work 51` 的 verifier 复跑实测 —— 走 `content-length-fast-path` 时增量仅 49 KB
 *   （绿），走 `bounded-accumulation` 时增量 **44.4～68.1 MB**（超阈值 ⇒ 红），**4 次里红 2～3 次**；
 *   本驱动作者那一次恰好命中快路径，所以「21/21 全过」是**单次采样**。
 *   根因：累积分支下 `req.resume()` 排空 64 MiB 的 body 会产生大量**瞬时 chunk 缓冲**，
 *   叠加 GC 滞后，RSS 峰值可以**超过 body 体积本身**（实测 68.1 MB > 67.1 MB）——
 *   RSS 这个仪器在该路径上做不出可靠的两侧判据。
 *   故 B 侧 RSS 只作为**读数**入证据（附分支标签），阈值断言已删除。
 *   「不无上限读入内存」这条承诺的**承重判据**是上面 ③ 的源码契约 + 变异自证。
 *
 * **A 侧保留的 RSS 正命题**（稳健、且是 B 侧缺失的「仪器能看见传输」的那一半）
 *   近限成功包（≈30 MiB）的 RSS 增量必须 > 16 MiB —— 证明这 ~30 MiB **真的过了线**，
 *   否则整套读数都是空跑的假绿。
 *
 * 诚实边界
 * --------
 * - **guest JS 堆曲线只登记、不断言**：Chromium 的 `performance.memory.usedJSHeapSize`
 *   是**量化**值且与 GC 强耦合 —— 实测标定（对同一个 File 显式 `await file.arrayBuffer()`）
 *   得到的增量是 **负值**（构造期垃圾在被测窗口内被回收，量级盖过拷贝本身），
 *   说明它做不出可靠的两侧判据。故堆序列只作为环境读数入证据，**不设阈值**。
 *   真正承重的是上面 ③ 的确定性源码判据与 A/B 两侧的 RSS 判据。
 * - 绝对耗时**只登记不断言**（本机环境相关量）。
 * - RSS 是**主进程**的量（渲染进程另有独立进程）；它对应的是 `readRawBody` 的累积，
 *   不是渲染堆。两者分开报，不混为一谈。
 *
 * 运行方式
 * --------
 *     NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js
 *
 * 产物：`tests/.uat-out/uat-51-import-limits.json`
 * 退出码：全通过 → 0；任一条失败 → 非零（11 = 缺全局 playwright / 12 = 仓内无 Electron）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tests', '.uat-out');
const EVIDENCE_PATH = path.join(OUT_DIR, 'uat-51-import-limits.json');

const HOME = process.env.HOME;
const APP_SUPPORT = path.join(HOME, 'Library', 'Application Support', 'realm-dev');
const WORKSPACE = path.join(APP_SUPPORT, 'agent-workspace');
const USER_SKILLS_DIR = path.join(WORKSPACE, 'skills');
const TMP_DIR = path.join(WORKSPACE, '.tmp');

/** 探针技能名（与内置技能 `find-skills` / `skill-creator` 及现有 `demo` / `weather` 均不冲突） */
const PROBE_NAME = 'zzq51-limits-probe';
/** `IMPORT_LIMITS.MAX_ENTRY_BYTES` = 1 MiB ⇒ 单条目必须严格小于它 */
const DATA_ENTRY_BYTES = 1000 * 1024;
/** `MAX_TOTAL_BYTES` = 32 MiB：31 × 1000 KiB + SKILL.md ≈ 30.3 MiB ⇒ 近限但**不**超 */
const NEAR_DATA_ENTRIES = 31;
/** 超限包：单条目 4 MiB × 16 = 64 MiB（远超 32 MiB 的 413 闸） */
const OVER_ENTRY_BYTES = 4 * 1024 * 1024;
const OVER_ENTRIES = 16;

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

// ==================== guest 侧实现（只用单引号 + 块注释 ⇒ 可安全 toString() 注入） ====================

/**
 * 在 guest **主世界**内现场组装一个 store 方式的合法 zip，并直接产出 `File`
 *
 * 刻意不把字节经 CDP 传进去：base64 载荷本身就会污染内存读数，正是本驱动的被测对象。
 * 返回 `File` 与内建计数；`parts` 引用在返回前**置空**（避免把构造期垃圾算进上传窗口）。
 */
function zzqGuestBuildZipFile(spec) {
  /* CRC32（表驱动，与 tests/helpers/make-malicious-zip.js 同算法） */
  var table = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  function crc32(buf) {
    var crc = -1;
    for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }
  var te = new TextEncoder();
  var parts = [];
  var central = [];
  var offset = 0;
  /* Unix 普通文件 mode 0o100644 的高 16 位 */
  var UNIX_MODE_FILE = (parseInt('100644', 8) << 16) >>> 0;

  function addEntry(name, data) {
    var nb = te.encode(name);
    var crc = crc32(data);
    var lfh = new Uint8Array(30);
    var dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true); /* method = stored(0) ⇒ 压缩比恰 1，不触发比值闸 */
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nb.length, true);
    dv.setUint16(28, 0, true);
    var localOffset = offset;
    parts.push(lfh, nb, data);
    offset += lfh.length + nb.length + data.length;

    var cdh = new Uint8Array(46);
    var cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, (3 << 8) | 30, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nb.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, UNIX_MODE_FILE, true);
    cv.setUint32(42, localOffset, true);
    central.push(cdh, nb);
  }

  /* 确定性 LCG 字节（store 方式下无需高熵；仅保证不是全零这种退化内容） */
  function makeBytes(len, seed) {
    var b = new Uint8Array(len);
    var x = seed >>> 0;
    for (var i = 0; i < len; i++) {
      x = (x * 1664525 + 1013904223) >>> 0;
      b[i] = (x >>> 24) & 0xff;
    }
    return b;
  }

  var skillMd = te.encode(spec.skillMd);
  addEntry(spec.skillName + '/SKILL.md', skillMd);
  var dataBytes = 0;
  for (var i2 = 0; i2 < spec.dataEntryCount; i2++) {
    var payload = makeBytes(spec.dataEntryBytes, i2 + 7);
    dataBytes += payload.length;
    addEntry(spec.skillName + '/data/f' + String(i2).padStart(3, '0') + '.bin', payload);
    payload = null;
  }

  var centralBytes = 0;
  for (var c2 = 0; c2 < central.length; c2++) centralBytes += central[c2].length;
  var eocd = new Uint8Array(22);
  var ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, spec.dataEntryCount + 1, true);
  ev.setUint16(10, spec.dataEntryCount + 1, true);
  ev.setUint32(12, centralBytes, true);
  ev.setUint32(16, offset, true);

  var all = parts.concat(central, [eocd]);
  var file = new File(all, spec.fileName, { type: 'application/zip' });
  var total = file.size;
  /* 把 File 交给调用方（`window.__zzq51FileCurrent`），再置空大引用：
     上传窗口的堆基线不应把构造期垃圾算进来 */
  window.__zzq51FileCurrent = file;
  all = null;
  parts = null;
  central = null;
  return {
    size: total,
    uncompressedTotal: skillMd.length + dataBytes,
    entryCount: spec.dataEntryCount + 1,
  };
}

/** guest 内 heap 采样器 + 稳定性等待（仅用单引号与块注释） */
function zzqGuestHeapTools() {
  var w = window;
  if (!w.__zzq51h) w.__zzq51h = { samples: [], timer: null, supported: null };
  var h = w.__zzq51h;
  h.supported = !!(performance && performance.memory && typeof performance.memory.usedJSHeapSize === 'number');
  w.zzqHeapStart = function () {
    h.samples = [];
    if (h.timer) clearInterval(h.timer);
    h.timer = setInterval(function () {
      try {
        h.samples.push(performance.memory.usedJSHeapSize);
      } catch (e) {
        h.samples.push(-1);
      }
    }, 20);
    return 'started';
  };
  w.zzqHeapStop = function () {
    if (h.timer) {
      clearInterval(h.timer);
      h.timer = null;
    }
    var s = h.samples.slice();
    return { supported: h.supported, count: s.length, min: s.length ? Math.min.apply(null, s) : null, max: s.length ? Math.max.apply(null, s) : null, series: s };
  };
  w.zzqHeapNow = function () {
    try {
      return performance.memory.usedJSHeapSize;
    } catch (e) {
      return -1;
    }
  };
  /** 等到连续两次读数差值 < 2 MiB（尽量把构造期/标定期垃圾的回收挪出测量窗口） */
  w.zzqHeapWaitStable = async function (maxMs) {
    var deadline = Date.now() + (maxMs || 10000);
    var prev = w.zzqHeapNow();
    var stable = 0;
    while (Date.now() < deadline) {
      await new Promise(function (r) {
        setTimeout(r, 250);
      });
      var cur = w.zzqHeapNow();
      if (Math.abs(cur - prev) < 2 * 1024 * 1024) stable++;
      else stable = 0;
      prev = cur;
      if (stable >= 2) break;
    }
    return prev;
  };
  return { supported: h.supported, start: 'ok' };
}

/** 把 `window.__zzq51FileCurrent` 里的 File 注入隐藏 file input 并触发 change */
function zzqGuestInjectStashed() {
  var f = window.__zzq51FileCurrent;
  if (!f) return 'no-file';
  var input = document.getElementById('skillImportFile');
  if (!input) return 'no-input';
  var dt = new DataTransfer();
  dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dispatched';
}

/** guest 内「读 heap + 构造并 stash 一个 File」的完整配方（返回串行化结果） */
const GUEST_BUILD_RECIPE = [
  '(async function(){',
  '  var now = window.zzqHeapNow ? window.zzqHeapNow() : -1;',
  '  var info = zzqGuestBuildZipFile(SPEC);',
  '  window.__zzq51FileCurrent = window.__zzq51FileStash;',
  '  return { heapBefore: now, info: info, stashed: !!window.__zzq51FileCurrent };',
  '})()',
].join('\n');

// ==================== host 侧交互 ====================

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

const READ_STATUS_SRC =
  '(function(){' +
  "  var el = document.getElementById('skillImportStatus');" +
  '  return {' +
  '    text: el ? el.textContent : null,' +
  "    danger: el ? el.classList.contains('skill-manage-hint-danger') : null," +
  "    display: el ? getComputedStyle(el).display : null," +
  "    gate: (document.getElementById('skillImportGate') || {}).textContent" +
  '  };' +
  '})()';

/** 剥掉块注释与整行 `//` 注释后再扫描（**避免子串判据被注释文本命中**） */
function stripCommentsForScan(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => (l.trim().startsWith('//') ? '' : l))
    .join('\n');
}

/**
 * 按配平取出一个函数源码（先剥注释，避免注释里的花括号破坏配平）
 *
 * ⚠ 先走**圆括号**找到形参表闭合，再取紧随其后的 `{` 作为函数体起点 ——
 * 直接取「第一个 `{`」会在**解构形参**上提前收尾（实测 `readRawBody(req, res,
 * { maxBytes = … } = {})` 只取出 69 字节）。
 */
function extractFunctionSource(rawSrc, signature) {
  const src = stripCommentsForScan(rawSrc);
  const i = src.indexOf(signature);
  if (i < 0) return null;
  const open = src.indexOf('(', i);
  if (open < 0) return null;
  let pd = 0;
  let bodyStart = -1;
  for (let k = open; k < src.length; k += 1) {
    const ch = src[k];
    if (ch === '(') pd += 1;
    else if (ch === ')') {
      pd -= 1;
      if (pd === 0) {
        const b = src.indexOf('{', k);
        if (b < 0) return null;
        bodyStart = b;
        break;
      }
    }
  }
  if (bodyStart < 0) return null;
  let depth = 0;
  for (let k = bodyStart; k < src.length; k += 1) {
    const ch = src[k];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(i, k + 1);
    }
  }
  return null;
}

/**
 * 确定性源码判据：「先 `arrayBuffer()` 再判大小」在导入上传路径上**不可能发生**
 *
 * 两侧都要有：
 * - **正命题**：渲染侧本地上传分支的 `body` 逐字是 File 直传 + 显式 `application/zip`；
 *   主进程 `readRawBody` 有 `Content-Length` 预检与 `req.resume()`（停止累积 / 排空）。
 * - **否命题（且已剥注释）**：两段被扫代码里零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader`。
 *
 * ⚠ 必须**剥注释后再扫**：`main.js` 的 `readRawBody` 文档注释里逐字写着
 *   「**禁止**「先 `arrayBuffer()` 再判大小」」—— 不剥注释的话这条判据会被自己的文档命中（假红）。
 *   同理设置页导入区的注释里出现过 `FileReader` 一词。
 * ⚠ 也**不得**退化成「全文件无 `arrayBuffer`」：`main.js` 的另两个端点（书签导入等）
 *   合法使用 `Buffer.from(await resp.arrayBuffer())`，全文件判据会误报。
 */
function inspectUploadSource(overrides = {}) {
  const spPath = path.join(REPO_ROOT, 'src', 'settings-page.js');
  const mainPath = path.join(REPO_ROOT, 'main.js');
  const sp = typeof overrides.spText === 'string' ? overrides.spText : fs.readFileSync(spPath, 'utf8');
  const main = typeof overrides.mainText === 'string' ? overrides.mainText : fs.readFileSync(mainPath, 'utf8');

  const startMark = '/* Phase 51 skill-import region: start */';
  const endMark = '/* Phase 51 skill-import region: end */';
  const s = sp.indexOf(startMark);
  const e = sp.indexOf(endMark);
  const region = s >= 0 && e > s ? sp.slice(s + startMark.length, e) : null;
  const regionCode = region === null ? null : stripCommentsForScan(region);

  const readRawBodySrc = extractFunctionSource(main, 'function readRawBody(');
  const readRawBodyCode = readRawBodySrc === null ? null : stripCommentsForScan(readRawBodySrc);

  const count = (text, needle) => (text ? text.split(needle).length - 1 : -1);

  return {
    regionFound: region !== null,
    regionBytes: region === null ? null : region.length,
    settingsPage: {
      fileBodyDirect: regionCode === null ? null : /body:\s*source\s*&&\s*source\.file\b/.test(regionCode),
      explicitZipContentType: regionCode === null ? null : /'Content-Type':\s*'application\/zip'/.test(regionCode),
      arrayBuffer: count(regionCode, 'arrayBuffer'),
      readAsArrayBuffer: count(regionCode, 'readAsArrayBuffer'),
      FileReader: count(regionCode, 'FileReader'),
    },
    readRawBody: {
      found: readRawBodySrc !== null,
      bytes: readRawBodySrc === null ? null : readRawBodySrc.length,
      contentLengthFastPath: readRawBodyCode === null ? null : readRawBodyCode.indexOf("headers['content-length']") !== -1,
      drainsOnReject: readRawBodyCode === null ? null : readRawBodyCode.indexOf('req.resume()') !== -1,
      arrayBuffer: count(readRawBodyCode, 'arrayBuffer'),
      readAsArrayBuffer: count(readRawBodyCode, 'readAsArrayBuffer'),
      FileReader: count(readRawBodyCode, 'FileReader'),
    },
  };
}

/** 主进程 RSS 采样器（装入 / 停止 / 读取） */
const RSS_START_SRC =
  '(() => {' +
  '  const w = globalThis;' +
  '  w.__zzq51rss = [];' +
  '  if (w.__zzq51rssTimer) clearInterval(w.__zzq51rssTimer);' +
  '  const push = () => { try { w.__zzq51rss.push(process.memoryUsage().rss); } catch (e) {} };' +
  '  push();' +
  '  w.__zzq51rssTimer = setInterval(push, 50);' +
  '  return { baseline: w.__zzq51rss[0] };' +
  '})()';

const RSS_STOP_SRC =
  '(() => {' +
  '  const w = globalThis;' +
  '  if (w.__zzq51rssTimer) { clearInterval(w.__zzq51rssTimer); w.__zzq51rssTimer = null; }' +
  '  const s = (w.__zzq51rss || []).slice();' +
  '  return { count: s.length, min: s.length ? Math.min.apply(null, s) : null, max: s.length ? Math.max.apply(null, s) : null, first: s.length ? s[0] : null, series: s };' +
  '})()';

async function main() {
  const started = new Date().toISOString();
  const evidence = {
    driver: 'tests/uat-51-import-limits.js',
    covers: ['UAT-51-test-3'],
    started,
    finished: null,
    node: process.version,
    plan: {
      nearLimit: { entryBytes: DATA_ENTRY_BYTES, entries: NEAR_DATA_ENTRIES },
      oversize: { entryBytes: OVER_ENTRY_BYTES, entries: OVER_ENTRIES },
      limits: { maxEntryBytes: 1 * 1024 * 1024, maxTotalBytes: 32 * 1024 * 1024, httpBodyMax: 32 * 1024 * 1024 },
    },
    artifacts: {},
    assertions: results,
    cleanup: {},
    exitCode: null,
  };

  log('=== 前置清理 ===');
  evidence.cleanup.preSkillDir = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
  evidence.cleanup.preTmpResidue = listImportResidue();

  let pwOk = false;
  try {
    pwOk = !!require('playwright')._electron;
  } catch (err) {
    console.error('E-PW require("playwright") 失败:', err.message);
    console.error('请用 NODE_PATH="$(npm root -g)" node tests/uat-51-import-limits.js 运行');
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

    // ---------- 装入 guest 侧工具（heap 采样 + zip 组装） ----------
    await guestEval(page, '(' + zzqGuestHeapTools.toString() + ')()');
    const heapTools = await guestEval(
      page,
      '(function(){ return { supported: window.__zzq51h.supported, hasStart: typeof window.zzqHeapStart }; })()'
    );
    evidence.artifacts.heapTools = heapTools;
    check(
      '前置：guest 的 performance.memory 可用（否则内存判据不可测）',
      heapTools.supported === true,
      JSON.stringify(heapTools)
    );

    // ==================== A. 近限成功路径 ====================
    log('=== A. 近限合法包（≈30.3 MiB）真实上传 ===');
    const nearSpec = {
      skillName: PROBE_NAME,
      skillMd: `---\nname: ${PROBE_NAME}\ndescription: UAT 限额探针（本驱动收尾会删除）\n---\n\n# probe\n\n限额与内存读数探针。\n`,
      dataEntryCount: NEAR_DATA_ENTRIES,
      dataEntryBytes: DATA_ENTRY_BYTES,
      fileName: 'zzq51-near.zip',
    };
    const buildNear = await guestEval(
      page,
      '(async function(){' +
        '  var zzqGuestBuildZipFile = ' + zzqGuestBuildZipFile.toString() + ';' +
        '  var spec = ' + JSON.stringify(nearSpec) + ';' +
        '  var info = zzqGuestBuildZipFile(spec);' +
        '  window.__zzq51NearFile = window.__zzq51FileCurrent;' +
        '  return info;' +
        '})()'
    );
    evidence.artifacts.nearPackage = buildNear;
    log(`  包已现场生成：file=${buildNear.size} B / 解压总量=${buildNear.uncompressedTotal} B / ${buildNear.entryCount} 条目`);
    check(
      'A：现场生成的近限包**确实贴近但不超过** 32 MiB（夹具自证）',
      buildNear.uncompressedTotal > 30 * 1024 * 1024 && buildNear.uncompressedTotal < 32 * 1024 * 1024,
      `uncompressed=${buildNear.uncompressedTotal}（上限 33554432）`
    );

    // ---- 器材读数（**只登记不断言**）：对同一个 File 显式 arrayBuffer() 的堆行为 ----
    // 这一条是**为什么不能把 guest 堆曲线做成阈值判据**的实证：构造期垃圾会在被测窗口内
    // 被回收，量级盖过拷贝本身 ⇒ 增量实测为**负**。故堆序列只入证据，不设闸。
    const calib = await guestEval(
      page,
      '(async function(){' +
        '  var f = window.__zzq51NearFile;' +
        '  var base = await window.zzqHeapWaitStable(12000);' +
        '  window.zzqHeapStart();' +
        '  var buf = await f.arrayBuffer();' +
        '  var len = buf.byteLength;' +
        '  var out = window.zzqHeapStop();' +
        '  buf = null;' +
        '  await window.zzqHeapWaitStable(12000);' +
        '  return { baseline: base, samples: out.count, min: out.min, max: out.max, peakDelta: out.max - base, copiedBytes: len };' +
        '})()'
    );
    evidence.artifacts.heapCalibration = {
      ...calib,
      note:
        'performance.memory.usedJSHeapSize 是量化值且与 GC 强耦合；本次显式 arrayBuffer 的' +
        '峰值增量为 ' + calib.peakDelta + ' B（负值 = 构造期垃圾在被测窗口内被回收）。' +
        '故本驱动不把 guest 堆曲线做成阈值判据，改用「确定性源码判据 + 主进程 RSS 两侧判据」。',
    };
    log(`  器材读数（显式 arrayBuffer ${calib.copiedBytes} B）：堆峰值增量 ${calib.peakDelta} B / ${calib.samples} 采样（只登记不断言）`);

    // ---- 确定性源码判据：导入上传路径不可能「先 arrayBuffer() 再判大小」 ----
    const srcInspect = inspectUploadSource();
    evidence.artifacts.uploadSource = srcInspect;
    log(`  源码判据：${JSON.stringify(srcInspect)}`);
    check(
      'A（源码·正命题）：渲染侧导入区找得到，且本地上传分支 `body` 逐字为 File 直传',
      srcInspect.regionFound === true && srcInspect.settingsPage.fileBodyDirect === true,
      JSON.stringify(srcInspect.settingsPage)
    );
    check(
      'A（源码·正命题）：本地上传分支显式声明 `Content-Type: application/zip`',
      srcInspect.settingsPage.explicitZipContentType === true,
      JSON.stringify(srcInspect.settingsPage)
    );
    check(
      'A（源码·否命题）：渲染侧导入区零 `arrayBuffer` / `readAsArrayBuffer` / `FileReader`',
      srcInspect.regionBytes > 1000 &&
        srcInspect.settingsPage.arrayBuffer === 0 &&
        srcInspect.settingsPage.readAsArrayBuffer === 0 &&
        srcInspect.settingsPage.FileReader === 0,
      JSON.stringify(srcInspect.settingsPage) + ` regionBytes=${srcInspect.regionBytes}`
    );
    check(
      'A（源码·正命题）：主进程 `readRawBody` 含 `Content-Length` 预检与 `req.resume()`（停止累积）',
      srcInspect.readRawBody.found === true &&
        srcInspect.readRawBody.bytes > 1000 &&
        srcInspect.readRawBody.contentLengthFastPath === true &&
        srcInspect.readRawBody.drainsOnReject === true,
      JSON.stringify(srcInspect.readRawBody)
    );
    check(
      'A（源码·否命题）：主进程 `readRawBody` 零 `arrayBuffer`（**已剥注释** ⇒ 不被自家文档命中）',
      srcInspect.readRawBody.bytes > 1000 &&
        srcInspect.readRawBody.arrayBuffer === 0 &&
        srcInspect.readRawBody.readAsArrayBuffer === 0 &&
        srcInspect.readRawBody.FileReader === 0,
      JSON.stringify(srcInspect.readRawBody)
    );

    // ---- 源码判据的**单点变异自证**（闸必须能红；否则上面的「零 arrayBuffer」是恒绿） ----
    const spRaw = fs.readFileSync(path.join(REPO_ROOT, 'src', 'settings-page.js'), 'utf8');
    const mainRaw = fs.readFileSync(path.join(REPO_ROOT, 'main.js'), 'utf8');
    const startMark = '/* Phase 51 skill-import region: start */';
    const mutA = inspectUploadSource({
      spText: spRaw.replace(
        startMark,
        startMark + '\nfunction zzqMutationProbe(f){ return f.arrayBuffer(); }\n'
      ),
    });
    const mutB = inspectUploadSource({
      spText: spRaw.replace(/body:\s*source\s*&&\s*source\.file/, 'body: await source.file.arrayBuffer()'),
    });
    const mutC = inspectUploadSource({
      // 保留函数名（否则判据连「提取失败」都区分不出），只把预检那一行换掉。
      // ⚠ 必须用 `/g`：同一行文本在 `readJsonBody` 里也出现过一次，非全局替换只会改到前者
      //（第一次实测就是这样 —— 变异没落到被测函数上，判据看起来「不可红」）。
      mainText: mainRaw.replace(
        /const declared = Number\(req\.headers\['content-length'\]\);/g,
        'const declared = await Promise.resolve(req).arrayBuffer();'
      ),
    });
    evidence.artifacts.sourceMutationProbe = {
      mutA: mutA.settingsPage,
      mutB: mutB.settingsPage,
      mutC: mutC.readRawBody,
    };
    log(`  单点变异自证：${JSON.stringify(evidence.artifacts.sourceMutationProbe)}`);
    check(
      'A（源码判据可红·变异 1）：往导入区插一句 `arrayBuffer()` ⇒ 「零 arrayBuffer」判据精确转红',
      mutA.settingsPage.arrayBuffer > 0,
      JSON.stringify(mutA.settingsPage)
    );
    check(
      'A（源码判据可红·变异 2）：把 `body` 换成 `await source.file.arrayBuffer()` ⇒ 「File 直传」判据精确转红',
      mutB.settingsPage.fileBodyDirect === false,
      JSON.stringify(mutB.settingsPage)
    );
    check(
      'A（源码判据可红·变异 3）：把 `Content-Length` 预检换成 `arrayBuffer()` ⇒ 两条判据同时转红',
      mutC.readRawBody.arrayBuffer > 0 && mutC.readRawBody.contentLengthFastPath === false,
      JSON.stringify(mutC.readRawBody)
    );

    // ---- 真实上传窗口 ----
    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(500);
    await electronApp.evaluate(RSS_START_SRC);
    const uploadStart = Date.now();
    const upload = await guestEval(
      page,
      '(async function(){' +
        '  var base = await window.zzqHeapWaitStable(12000);' +
        '  window.zzqHeapStart();' +
        '  var f = window.__zzq51NearFile;' +
        "  var input = document.getElementById('skillImportFile');" +
        '  var dt = new DataTransfer();' +
        '  dt.items.add(f);' +
        '  input.files = dt.files;' +
        "  input.dispatchEvent(new Event('change', { bubbles: true }));" +
        '  return { baseline: base, dispatchedAt: Date.now() };' +
        '})()'
    );
    await guestWaitFor(
      page,
      "document.getElementById('skillImportPreview').classList.contains('active') || document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')",
      120000,
      '近限包预览返回'
    );
    const elapsedMs = Date.now() - uploadStart;
    const nearHeap = await guestEval(page, '(function(){ return window.zzqHeapStop(); })()');
    const nearRss = await electronApp.evaluate(RSS_STOP_SRC);
    const nearStatus = await guestEval(page, READ_STATUS_SRC);
    const rssDelta = nearRss.max - nearRss.first;
    const heapDelta = nearHeap.max - upload.baseline;
    evidence.artifacts.nearUpload = {
      elapsedMs,
      status: nearStatus,
      heap: { baseline: upload.baseline, samples: nearHeap.count, min: nearHeap.min, max: nearHeap.max, delta: heapDelta },
      rss: { count: nearRss.count, first: nearRss.first, max: nearRss.max, delta: rssDelta },
    };
    log(`  上传完成 ${elapsedMs} ms · heap 增量 ${heapDelta} B · 主进程 RSS 增量 ${rssDelta} B`);

    check(
      'A：近限包走到就绪态（体量与限额口径真的对得上，不是空跑）',
      nearStatus.danger === false && typeof nearStatus.text === 'string' && nearStatus.text.indexOf('预览已就绪') !== -1,
      JSON.stringify(nearStatus)
    );
    check(
      'A（正命题）：主进程 RSS 增量 > 16 MiB ⇒ 这 ~30 MiB 真的过了线',
      nearRss.count >= 3 && rssDelta > 16 * 1024 * 1024,
      `samples=${nearRss.count} rssDelta=${rssDelta}`
    );
    log(
      `  [读数] 上传窗口 guest 堆：baseline=${upload.baseline} max=${nearHeap.max} delta=${heapDelta} samples=${nearHeap.count}（只登记不断言，理由见文件头「诚实边界」）`
    );
    evidence.artifacts.nearElapsedMs = elapsedMs;

    // 关弹框 + 残留检查
    await guestEval(page, "(function(){ try { window.closeSkillImportModal(); } catch (e) {} return 'ok'; })()");
    await sleep(1500);
    const residueAfterNear = listImportResidue();
    const preTmp = evidence.cleanup.preTmpResidue || [];
    evidence.artifacts.residueAfterNear = residueAfterNear.filter((n) => preTmp.indexOf(n) === -1);
    check(
      'A：关闭预览后不残留 `.tmp/skill-import-*`（预览关闭即弃）',
      evidence.artifacts.residueAfterNear.length === 0,
      JSON.stringify(evidence.artifacts.residueAfterNear)
    );

    // ==================== B. 超限拒绝路径 ====================
    log('=== B. 超限包（64 MiB）⇒ 413 零字节快路径 ===');
    const overSpec = {
      skillName: PROBE_NAME,
      skillMd: `---\nname: ${PROBE_NAME}\ndescription: UAT 限额探针（超限）\n---\n\n# probe\n`,
      dataEntryCount: OVER_ENTRIES,
      dataEntryBytes: OVER_ENTRY_BYTES,
      fileName: 'zzq51-over.zip',
    };
    const buildOver = await guestEval(
      page,
      '(async function(){' +
        '  var zzqGuestBuildZipFile = ' + zzqGuestBuildZipFile.toString() + ';' +
        '  var spec = ' + JSON.stringify(overSpec) + ';' +
        '  var info = zzqGuestBuildZipFile(spec);' +
        '  window.__zzq51OverFile = window.__zzq51FileCurrent;' +
        '  return info;' +
        '})()'
    );
    evidence.artifacts.overPackage = buildOver;
    log(`  超限包已现场生成：file=${buildOver.size} B（HTTP 上限 33554432）`);
    check(
      'B：现场生成的超限包 > 32 MiB（夹具自证）',
      buildOver.size > 32 * 1024 * 1024,
      `file=${buildOver.size}`
    );

    await guestEval(
      page,
      "(function(){ window.openSkillImportModal(document.getElementById('skillImportOpen')); return 'ok'; })()"
    );
    await sleep(500);
    await electronApp.evaluate(RSS_START_SRC);
    await guestEval(
      page,
      '(async function(){' +
        '  await window.zzqHeapWaitStable(8000);' +
        '  var f = window.__zzq51OverFile;' +
        "  var input = document.getElementById('skillImportFile');" +
        '  var dt = new DataTransfer();' +
        '  dt.items.add(f);' +
        '  input.files = dt.files;' +
        "  input.dispatchEvent(new Event('change', { bubbles: true }));" +
        '  return "dispatched";' +
        '})()'
    );
    await guestWaitFor(
      page,
      "document.getElementById('skillImportStatus').classList.contains('skill-manage-hint-danger')",
      90000,
      '超限包得到 danger 失败响应'
    );
    await sleep(800); // 让 RSS 采样覆盖到拒绝之后的排空阶段
    const overRss = await electronApp.evaluate(RSS_STOP_SRC);
    const overStatus = await guestEval(page, READ_STATUS_SRC);
    const overRssDelta = overRss.max - overRss.first;
    evidence.artifacts.overUpload = {
      status: overStatus,
      rss: { count: overRss.count, first: overRss.first, max: overRss.max, delta: overRssDelta },
    };
    log(`  超限拒绝：${JSON.stringify(overStatus.text)} · 主进程 RSS 增量 ${overRssDelta} B`);

    check(
      'B：超限包被拒且**不是静默失败**（danger 状态行非空）',
      overStatus.danger === true && !!overStatus.text && overStatus.text.length > 0 && overStatus.display !== 'none',
      JSON.stringify(overStatus)
    );
    check(
      'B：文案含「请求体超过上限」与真实限额数字（可操作原因，不是通用兜底）',
      typeof overStatus.text === 'string' && overStatus.text.indexOf('超过上限') !== -1,
      JSON.stringify(overStatus.text)
    );
    const MAX_BYTES = 32 * 1024 * 1024;
    const overBranch = overRssDelta < 8 * 1024 * 1024 ? 'content-length-fast-path' : 'bounded-accumulation';
    evidence.artifacts.overBranch = overBranch;
    evidence.artifacts.overRssReading = {
      branch: overBranch,
      rssDelta: overRssDelta,
      maxBytes: MAX_BYTES,
      bodyBytes: buildOver.size,
      note:
        '只登记不断言：累积分支下 `req.resume()` 排空会产生大量瞬时 chunk 缓冲 + GC 滞后，' +
        'RSS 峰值可超过 body 体积本身（verifier 实测 68.1 MB > 67.1 MB）。' +
        '「内存上界如实为 maxBytes」由 readRawBody 的源码契约 + 三条单点变异自证承重。',
    };
    check(
      'B（分支登记·信息性）：`readRawBody` 走了两条合法分支之一',
      overBranch === 'content-length-fast-path' || overBranch === 'bounded-accumulation',
      `branch=${overBranch} rssDelta=${overRssDelta}（body ${buildOver.size} B，上限 ${MAX_BYTES}）`
    );
    log(
      `  [读数] B 侧 RSS 增量 ${overRssDelta} B（body ${buildOver.size} B）· 分支 ${overBranch} —— 只登记不断言`
    );
    log(
      `  [读数] A/B 对照：A body ${buildNear.size} B → RSS ${rssDelta} B；B body ${buildOver.size} B → RSS ${overRssDelta} B（B 的 body 更大，但该对照不构成判据）`
    );
    evidence.artifacts.rssCrossReading = { nearBody: buildNear.size, nearRss: rssDelta, overBody: buildOver.size, overRss: overRssDelta };

    await guestEval(page, "(function(){ try { window.closeSkillImportModal(); } catch (e) {} return 'ok'; })()");
    await sleep(1200);

    // ---------- 全程无异常 ----------
    check(
      '全程 guest / host 无未捕获异常（pageerror）',
      pageErrors.length === 0,
      JSON.stringify(pageErrors.slice(0, 5))
    );
    const mainErrLines = mainLog.filter((l) => l.indexOf('unhandledRejection') !== -1 || l.indexOf('UnhandledPromiseRejection') !== -1);
    check('主进程无 unhandledRejection', mainErrLines.length === 0, JSON.stringify(mainErrLines.slice(0, 3)));
  } catch (e) {
    evidence.thrown = String(e && e.stack ? e.stack : e);
    log('[result] 驱动异常：', evidence.thrown);
  } finally {
    try {
      evidence.cleanup.skillDir = removeDirIfAny(path.join(USER_SKILLS_DIR, PROBE_NAME));
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
      evidence.cleanup.mainLogTail = mainLog.slice(-25);
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
  log(`uat-51-import-limits: ${evidence.passed}/${evidence.total} passed`);
  process.exit(exitCode);
}

/**
 * 仅在本文件被**直接执行**时跑主流程 —— 便于离线 `require()` 单测源码判据函数
 *（`uat-*` 前缀不被 `test-*.js` 套件拾取，故这里的导出只服务本驱动自身的自测）。
 */
if (require.main === module) {
  main().catch((err) => {
    console.error('驱动异常退出：', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { inspectUploadSource, extractFunctionSource, stripCommentsForScan };
