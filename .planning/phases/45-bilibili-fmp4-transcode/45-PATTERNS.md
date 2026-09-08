# Phase 45: B 站直播 fMP4 转录支持 - Pattern Map

**Mapped:** 2026-09-07
**Files analyzed:** 10（9 修改 + 1 新建）
**Analogs found:** 9 / 10

本阶段全部为**既有文件的自扩展**（每条改动都有同文件内的 44-18/G-44-7 先例可复刻），唯一无 analog 的是测试夹具 helper（新建）。每个文件的「Closest Analog」即其自身在 Phase 44 加入的对应区段——规划时直接引用下列行号与摘录。

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `media-m3u8-parser.js` | utility（纯函数 parser） | transform（行级解析） | 自身 EXT-X-KEY 段（lines 55-73，44-18 加法先例） | exact |
| `media-remuxer.js` | service（转封装执行体） | transform / file-I/O（流式写盘） | 自身 `convertToMp4`（lines 251-405）+ `sniffContainerBuffer`（lines 125-149） | exact |
| `media-record-engine.js` | service（录制引擎） | streaming（轮询追分片）+ file-I/O | 自身 `downloadSegment`/`writeMeta`/`pollLoop`（lines 143-265） | exact |
| `media-cache-manager.js` | service（缓存层） | file-I/O + CRUD（meta.json 索引） | 自身 key_uris 先例：`updatePlaylistIndex`（611-643）/ `storeBuffer`（391-433）/ `getConvertInfo`（658-724） | exact |
| `main.js` | controller（任务编排/IPC 桥） | request-response + event-driven（任务终态） | 自身 `CONVERT_FAIL_TEXT`（3022-3037）/ `readRecordTaskSegments`（3045-3079）/ `startConvertTask`（3082-3190）/ `startConvertFromInput`（3215-3273） | exact |
| `tests/test-media-remuxer.js` | test | batch（node:test） | 自身（:176 拒转用例改写、:262 文案断言扩展、AES describe 326-445） | exact |
| `tests/test-media-cache.js` | test | batch | 自身「密钥 URI 排除」describe（411-499）与「AES-128 解密材料」describe（501-586） | exact |
| `tests/test-media-record-duration.js` | test | batch（stub fetchPage e2e） | 自身 `makeHarness` + 注入 parsePlaylist 模式（30-45, 94-120） | exact |
| `tests/test-m3u8-playlist-parser.js` | test | batch | 自身「EXT-X-KEY 加密检测」describe（148-175+） | exact |
| 夹具 helper（新建，建议内联或 `tests/helpers/`） | test utility | batch | — | **no analog**（仓库无 fixtures/helpers 先例；RESEARCH Q6 建议 mux.js generator 生成，可内联各测试文件） |

## Pattern Assignments

### `media-m3u8-parser.js`（utility，transform）

**改动：** `parsePlaylist` 增加 `mapUri`/`mapByterange` 捕获（D-05），返回值新增缺省 null 字段。

**Analog:** 自身 EXT-X-KEY 捕获段（44-18 同款加法）

**行级捕获模式**（lines 55-73，新 MAP 分支照此插在 `#` 分支内）:
```javascript
// EXT-X-KEY：METHOD ≠ NONE 即加密流（容忍引号与属性顺序）；
// 加密行的 URI="..." 原始值收集进 keyUris（METHOD=NONE 不收集）
if (trimmed.startsWith('#EXT-X-KEY:')) {
  const attrs = trimmed.slice('#EXT-X-KEY:'.length);
  const methodMatch = attrs.match(/(?:^|,)METHOD="?([^",]+)"?/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : '';
  if (method && method !== 'NONE') {
    result.hasEncryption = true;
    const uriMatch = attrs.match(/(?:^|,)URI="([^"]*)"/);
    if (uriMatch) result.keyUris.push(uriMatch[1]);
    ...
  }
  continue;
}
```

**结果结构缺省字段模式**（lines 30-39，新字段在此追加 `mapUri: null, mapByterange: null`）:
```javascript
const result = {
  mediaSequence: 0,
  targetDuration: DEFAULT_TARGET_DURATION,
  ended: false,
  isLive: true,
  hasEncryption: false,
  keyUris: [],
  keyIv: null,
  segments: [],
};
```

**约束：** 顶层无 electron/原生 require（文件头注释 line 9：「纯 Node 可加载（44-VALIDATION Wave 0 硬约束）」）；未知 `#` 行（如 `#EXT-BILI-AUX`）安全忽略是既有行为（lines 84-89 落到 EXTINF 匹配后 continue），无需改动。JSDoc 返回类型（lines 15-28）必须同步补新字段说明。

---

### `media-remuxer.js`（service，transform / file-I/O）

**改动：** 新增 `concatFmp4ToMp4`（独立函数，D-06）；`convertToMp4` 增加 `initPath` 入参；嗅探 fMP4 命中从拒转改为**分流**；新 reason `init_missing`（+可选 `invalid_init`）。

**Analog:** 自身 `convertToMp4` 执行体契约 + `sniffContainerBuffer`

**remuxError 工厂**（lines 71-75，新 reason 复用同一工厂，新文案进 main.js CONVERT_FAIL_TEXT）:
```javascript
function remuxError(reason, detail) {
  const err = new Error(detail ? `${reason}: ${detail}` : reason);
  err.reason = reason;
  return err;
}
```

**嗅探判定序**（lines 125-149，fMP4 分支（②）从「返回 unsupported_container」改为向调用方暴露「这是 fMP4」供分流——TS 放行（①）与高熵拒转（③）零改动）:
```javascript
function sniffContainerBuffer(buf) {
  // ① MPEG-TS 同步字节：放行（宽松判定，保持既有 TS 路径零回归）
  if (buf.length > 0 && buf[0] === 0x47) return null;
  // ② fMP4 box 特征 ASCII：HLS+fMP4（CMF）分片以 box 开头、无同步字节
  for (const tag of ['ftyp', 'styp', 'moof', 'moov', 'sidx']) {
    if (buf.indexOf(Buffer.from(tag, 'ascii')) !== -1) {
      return remuxError('unsupported_container', 'fMP4 分片暂不支持转封装（仅支持 MPEG-TS）');
    }
  }
  ...
}
```

**执行体契约——concatFmp4ToMp4 必须逐项复刻的骨架**（convertToMp4 lines 251-405）:
```javascript
// ① 入参 fail-fast（lines 253-270）：discontinuity/no_segments/invalid_output/segment_missing
//    —— concat 分支对应：initPath 缺失 → init_missing；init 非 ftyp 开头 → invalid_init
// ② 产物同步 fd 创建（lines 279-287，G-44-7 竞态修复，新执行体必须同款）：
let outFd;
try {
  outFd = fs.openSync(outputPath, 'w');
} catch (err) {
  reject(remuxError('write_failed', err.message));
  return;
}
const stream = fs.createWriteStream(outputPath, { fd: outFd });
// ③ fail() 统一清理（lines 293-300）：
const fail = (err) => {
  if (settled) return;
  settled = true;
  try { stream.destroy(); } catch { /* 已销毁 */ }
  try { fs.unlinkSync(outputPath); } catch { /* 文件可能未创建 */ }
  reject(err);
};
// ④ 协作式取消检查点（lines 347-350，每分片迭代开始前，先于任何分片 IO）：
if (typeof shouldCancel === 'function' && shouldCancel()) {
  fail(remuxError('cancelled', '用户取消转换'));
  return;
}
// ⑤ 进度回调异常不阻断（lines 376-380）：
if (typeof onProgress === 'function') {
  try { onProgress(processed, segmentPaths.length); } catch { /* 进度回调异常不阻断 */ }
}
// ⑥ empty_output 终检（lines 387-400，写盘收尾后 statSync 校验）：
stream.end(() => {
  if (settled) return;
  let outSize = 0;
  try { outSize = fs.statSync(outputPath).size; } catch { /* 按空产物处理 */ }
  if (outSize === 0) { settled = true; try { fs.unlinkSync(outputPath); } catch {} 
    reject(remuxError('empty_output', '转封装产物为空（无有效媒体数据）')); return; }
  settled = true;
  resolve({ outputPath, segments: processed });
});
```

**拼接本体**（RESEARCH Q5 草案，~50 行）：校验 init 前 8 字节 size+`ftyp` → 写 init → 逐分片 `fs.readFileSync` + `stream.write`（流式，T-44-17 不全量入内存）。产物终检加强档用已装依赖 `muxjs.mp4.probe.findBox`（moov 存在 + moof 计数 ≥1，RESEARCH Q3 实测可用；注意 Pitfall 9：不断言具体 track 数）。**分流位置约束（Pitfall 4 + :164 源码结构断言）**：concat 分支调用点必须在「取消检查之后、TS push 之前」，即现 lines 366-372 的 `if (i === 0)` 嗅探块内——fMP4 命中时在此转向 concat 分支，不得插到取消检查之前。

**module.exports**（line 407）：新函数需加入导出（测试直接 require 调用）。

---

### `media-record-engine.js`（service，streaming + file-I/O）

**改动：** pollLoop 解析后捕获 `pl.mapUri` → 首次见到或变化即下载 init 落盘（**首轮 baseline 也下**，Pitfall 1 最高危）；meta.json 附加 `mapUri`/`initFile`/`mapByterange` 字段。

**Analog:** 自身 `downloadSegment` / `writeMeta` / pollLoop 首轮分支

**下载+落盘模式**（lines 143-160，init 下载复刻此结构：fetchPage → writeFileSync → 状态登记；差异：init 文件名是固定常量 `'init'` 不进 seq 命名、不进 `st.seen`/`st.recorded`）:
```javascript
async function downloadSegment(st, seg) {
  const absUrl = resolveUri(seg.uri, st.url);
  const buf = await fetchPage(absUrl, { referer: st.referer, containerId: st.containerId });
  const name = `${String(seg.seq).padStart(SEQ_PAD, '0')}.ts`;
  fs.writeFileSync(path.join(st.segmentsDir, name), buf);
  st.seen.add(seg.seq);
  st.recorded.set(seg.seq, { file: name, size: buf.length, duration: seg.duration });
  st.totalBytes += buf.length;
  ...
}
```

**meta.json 附加字段模式**（lines 174-188，新字段照 `hasDiscontinuity`/`hasEncryption` 先例追加——向后兼容不升版本，旧 meta 缺字段 = fMP4 能力缺省关闭）:
```javascript
const meta = {
  ...
  // 44-05 转封装消费：含不连续片段的流转封装时间轴跳变（Pitfall 5），直接拒转
  hasDiscontinuity: !!st.hasDiscontinuity,
  // G-44-7：加密流（EXT-X-KEY METHOD≠NONE）无解密链路，转换入口早拒
  hasEncryption: !!st.hasEncryption,
  finishedAt: new Date().toISOString(),
};
```

**首轮/追新分支结构**（lines 219-240，init 下载的检查点应放在 `st.consecutiveFailures = 0` 之后、首轮/追新分支**之外**——每轮都检查 `pl.mapUri` 与已存是否一致，变化即重下，实测 B 站恒定只触发一次）:
```javascript
if (st.firstRound) {
  // D-21 从直播边缘开始：首轮清单只记基线不落盘（历史分片不回溯）
  for (const seg of pl.segments) st.seen.add(seg.seq);
  st.firstRound = false;
} else {
  for (const seg of pl.segments) { ... }
}
```

**约束：** `fetchPage` 注入依赖契约（文件头 lines 18-20）不变；init 下载失败的容错口径参照分片失败（计 consecutiveFailures 或容忍当轮失败下轮重试——规划决策点，RESEARCH 未锁定）。

---

### `media-cache-manager.js`（service，file-I/O + CRUD）

**改动：** `updatePlaylistIndex` 登记 `map_uris`（segKey 数组）；`storeBuffer` 对 MAP key 跳过 segments 登记但**留存 init 本体**（`<videoDir>/init` + `meta.init_segment`）；`getConvertInfo` 返回 `initPath`/`hasFmp4Map`。

**Analog:** 自身 44-18 key URI 先例（三处一一对应）

**updatePlaylistIndex 登记模式**（lines 611-643，`map_uris` 照 `key_uris` 复刻——同源的 `segmentKeyOf(resolveUri(...))`，数组形态容忍 MAP 轮换，Pitfall 8）:
```javascript
// G-44-7：加密标记 + 密钥 URI 键集合（与 meta.segments 同源的 segKey）。
// key_uris 供 storeBuffer O(1) 成员判定跳过密钥落库、getConvertInfo 读取侧过滤。
meta.has_encryption = !!pl.hasEncryption;
const keyUris = [];
for (const uri of pl.keyUris || []) {
  try {
    keyUris.push(segmentKeyOf(resolveUri(uri, m3u8Url)));
  } catch { /* 非法 URI 跳过 */ }
}
meta.key_uris = keyUris;
```

**storeBuffer 排除+留存模式**（lines 417-432，MAP URI 分支照此复刻；**关键差异**：key 只留 16 字节 hex 进 meta，init 必须把本体写盘 `<videoDir>/init` 并登记 `meta.init_segment = { size, sha256, uri_key }`，重复 init 请求走 D-10 增量语义跳过重写）:
```javascript
// G-44-7：密钥 URI（EXT-X-KEY 的 enc.key 等）不落 segments 库——它不是分片，
// 16 字节密钥混入 segments 会污染 playlist_order 完整性判定。
// 时序依据：hls.js 先请求清单（updatePlaylistIndex 此刻已把 key_uris 落盘）
// 后请求密钥/分片，故判定所依赖的 key_uris 必然先行就绪。
if (Array.isArray(mMeta.key_uris) && mMeta.key_uris.includes(segKey)) {
  if (buffer.length === 16 && !mMeta.key_hex) {
    mMeta.key_hex = buffer.toString('hex');
    this._writeMeta(videoId, mMeta);
  }
  console.debug(`[Realm] 密钥 URI 跳过落盘: ${finalUrl}`);
  return { ok: true, skipped: true, reason: 'key_uri' };
}
```

**getConvertInfo 读取侧过滤+返回模式**（lines 663-676 + 返回对象 lines 712-724，`map_uris` 加入剔除集、`initPath` 存在性校验后透出）:
```javascript
const keyUris = Array.isArray(meta.key_uris) ? meta.key_uris : null;
const allKeys = keyUris
  ? Object.keys(segs).filter((k) => !keyUris.includes(k))
  : Object.keys(segs);
let keys = null;
if (Array.isArray(meta.playlist_order) && meta.playlist_order.length === allKeys.length) {
  keys = meta.playlist_order.filter((k) => segs[k]);
  ...
}
```

**路径安全约束：** init 文件写 `<videoDir>/init` 必须走既有 `_safePath`（lines 137-162，resolve+realpath 双基准），文件名固定常量不进远端输入（T-44-11 同款）；`lookup()` 放行 init 命中回放是 Wave 2 可选项（MVP 允许 miss 回源+留存，RESEARCH Q5）。**Pitfall 2**：init 绝不进 `segments` map——`playlist_order.length === allKeys.length` 对齐判定与完整度分母（lines 668-670 + completeness 计算 lines 690-693）会因一个多余 key 全乱。

---

### `main.js`（controller，request-response + event-driven）

**改动：** `CONVERT_FAIL_TEXT` 增 `init_missing`（+可选 `invalid_init`）文案；`readRecordTaskSegments` 读 `meta.initFile` 拼 initPath；`startConvertTask` 接 `initPath` 透传 `convertToMp4`；`startConvertFromInput` 缓存链路 `getConvertInfo().initPath` 透传 + 历史条目 `initPath=null` 时新 reason 早拒。

**Analog:** 自身 convert 编排段（3019-3273）

**CONVERT_FAIL_TEXT 映射**（lines 3022-3037，新 reason 在此追加——有测试断言覆盖，Pitfall 5；文案参照 `key_unavailable` 的「引导重播」口吻）:
```javascript
const CONVERT_FAIL_TEXT = {
  discontinuity: '直播流含不连续片段，暂不支持转换',
  ...
  // AES-128 解密链路：密钥未缓存（重新播放一次即会经 /proxy 留存）/ 解密失败
  key_unavailable: '解密密钥未缓存，请重新播放该视频后再转换',
  decrypt_failed: '分片解密失败',
  empty_output: '转换产物为空',
};
```

**早拒语义模式**（startConvertTask lines 3086-3093 / startConvertFromInput lines 3258-3264，入口校验返回 `{ ok:false, reason }`——缓存链路 `hasFmp4Map && !initPath` 的 `init_missing` 早拒照 `key_unavailable` 先例插在同一位置）:
```javascript
let decryption = null;
if (info.hasEncryption) {
  if (!info.keyHex) return { ok: false, reason: 'key_unavailable' };
  decryption = {
    keyHex: info.keyHex,
    ivHex: info.keyIvHex || null,
    mediaSequence: info.mediaSequence || 0,
  };
}
```

**meta 读取+路径拼接模式**（readRecordTaskSegments lines 3069-3077，`meta.initFile` 读出后 `path.join(recordDir, meta.initFile)` + `fs.existsSync` 校验照 `segments[].file` 同款）:
```javascript
const segmentPaths = (Array.isArray(meta.segments) ? meta.segments : [])
  .map((s) => (s && typeof s.file === 'string' ? path.join(recordDir, 'segments', s.file) : null))
  .filter((p) => p && fs.existsSync(p));
if (segmentPaths.length === 0) return null;
return { segmentPaths, meta };
```

**编排透传零改动点：** 弹框选目录/任务注册/取消令牌（`convertCancelTokens`）/进度节流（`lastPct`）/终态流转/cancelled 拦截（lines 3163-3169）全盘复用，唯一变化是 `convertToMp4({...})` 调用多传 `initPath`（现 lines 3138-3156）。

---

### `tests/test-media-remuxer.js`（test，batch）

**改动：** 改写 :176「fMP4 box 分片拒转 unsupported_container」为分流语义（Pitfall 6，必须同 PR）；新增 concatFmp4ToMp4 用例组；:262 文案断言扩新 reason。

**Analog:** 自身（全文件即模式库）

**⚠️ 冲突用例改写**（lines 176-195，同一输入（伪造 ftyp 分片、无 initPath）改造后应得 `init_missing`；产物清理断言保留）:
```javascript
test('fMP4 box 分片拒转 reason=unsupported_container 且产物清理', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-remux-fmp4-'));
  try {
    // 手工构造 fMP4 分片：4 字节 size + 'ftyp' + 'isom' + 填充（首字节 0x00 非同步字节）
    const seg = path.join(dir, 'seg.ts');
    fs.writeFileSync(seg, Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x14]),
      Buffer.from('ftypisom', 'ascii'),
      Buffer.alloc(12, 0x00),
    ]));
    const out = path.join(dir, 'out.mp4');
    await assert.rejects(
      () => remuxer.convertToMp4({ segmentPaths: [seg], outputPath: out }),
      (err) => err.reason === 'unsupported_container'   // ← 改为 init_missing
    );
    assert.strictEqual(fs.existsSync(out), false, '拒转后半成品 mp4 应被清理');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

**必须保留的源码结构断言**（lines 164-174 取消<嗅探<push 优先序、lines 246-260 取消先于嗅探语义——44-08 契约，分流改造不得破坏）:
```javascript
assert.ok(cancelIdx < sniffIdx, '取消检查必须先于嗅探（44-08 取消契约）');
assert.ok(sniffIdx < pushIdx, '嗅探必须先于 push（不可转容器在进入 mux.js 前拒绝）');
```

**CONVERT_FAIL_TEXT 文案断言模式**（lines 262-270 + 436-444，新 reason 加入循环列表）:
```javascript
test('main.js CONVERT_FAIL_TEXT 覆盖三个新 reason（任务页文案不落「未知原因」）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  for (const reason of ['unsupported_container', 'encrypted_stream', 'empty_output']) {
    assert.ok(
      src.includes(`${reason}: '`),
      `main.js CONVERT_FAIL_TEXT 缺少 ${reason} 文案映射`
    );
  }
});
```

**标准测试骨架**（全文件统一：mkdtempSync + try/finally rmSync + assert.rejects reason 断言 + existsSync 产物清理断言）；夹具生成新模式见「No Analog Found」。

---

### `tests/test-media-cache.js`（test，batch）

**改动：** 新增 MAP URI 用例组——`updatePlaylistIndex` 登记 `map_uris`、`storeBuffer` 跳过+留存 init、完整性分母不含 init、`getConvertInfo` 返回 initPath。

**Analog:** 自身「密钥 URI 排除与加密标记（G-44-7）」describe（lines 411-499）与「AES-128 解密材料」describe（lines 501-586）——四个新用例与既有 key 用例一一对应（登记断言 ↔ :423、跳过+留存 ↔ :434/:533、读取侧过滤 ↔ :459、透出 ↔ :514）。

**登记+断言模式**（lines 423-432）:
```javascript
test('含 EXT-X-KEY 清单 → meta.has_encryption=true 且 key_uris 含密钥键', () => {
  ...
  c.updatePlaylistIndex(M3U8, PLAYLIST);
  ...
  assert.deepStrictEqual(meta.key_uris, [keySeg]);
});
```

**storeBuffer 排除+留存模式**（lines 533-550，init 用例对应改动点：断言本体落盘 `<videoDir>/init` 而非仅 meta hex 字段）:
```javascript
test('storeBuffer 16 字节密钥 → meta.key_hex 留存（不进 segments）；二次密钥不覆盖', () => {
  ...
  const rk = c.storeBuffer('https://a.com/enc/enc.key', vid, makeBuffer(16, 9));
  ...
  assert.strictEqual(meta.key_hex, makeBuffer(16, 9).toString('hex'));
  // 二次不同内容密钥请求：不覆盖已留存 key_hex（首密钥为准）
```

---

### `tests/test-media-record-duration.js`（test，batch / stub e2e）

**改动：** 新增录制链路 init 留存用例——注入带 `mapUri` 的 parsePlaylist stub + fetchPage stub 区分清单/init/分片 URL，断言**首轮 baseline 也下载 init**、meta.json 含 `initFile`/`mapUri`、segments 不含 init。

**Analog:** 自身 harness + 注入模式

**harness 构造**（lines 30-45）:
```javascript
function makeHarness({ fetchPage, parsePlaylist }) {
  const recordRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-record-dur-'));
  const taskManager = createMediaTaskManager({ persist: () => {} });
  const engine = createRecordEngine({ fetchPage, parsePlaylist, taskManager, recordRoot });
  return { engine, taskManager, recordRoot,
    cleanup: () => fs.rmSync(recordRoot, { recursive: true, force: true }) };
}
function metaOf(recordRoot, taskId) {
  return JSON.parse(fs.readFileSync(path.join(recordRoot, taskId, 'meta.json'), 'utf8'));
}
```

**轮次控制注入模式**（lines 94-120，`++call === 1 ? plBaseline : plNext` 控制首轮/次轮清单；init 用例的 parsePlaylist stub 返回对象需带 `mapUri` 字段，fetchPage stub 按 URL 区分返回清单/分片/init 字节）:
```javascript
let call = 0;
const seg = { uri: 'https://cdn.example.com/seg.ts', duration: 3 };
const plBaseline = { targetDuration: 2, ended: false, segments: [{ ...seg, seq: 1 }] };
const plNext = { targetDuration: 2, ended: false,
  segments: [{ ...seg, seq: 1 }, { ...seg, seq: 2 }, { ...seg, seq: 3 }] };
const h = makeHarness({
  fetchPage: async () => Buffer.alloc(188, 0x47),
  parsePlaylist: () => (++call === 1 ? plBaseline : plNext),
});
```

**注意：** 注入的自定义 parsePlaylist stub 不返回 `mapUri` 时引擎行为应保持现状（参照 hasEncryption 的原始清单正则兜底 lines 212-216——MAP 是否需要同款兜底是规划决策点）。轮询等待用 `sleep(3200)`（MIN_POLL_INTERVAL_MS=2000 钳制）同款节奏。

---

### `tests/test-m3u8-playlist-parser.js`（test，batch）

**改动：** 新增 EXT-X-MAP 用例组（URI/BYTERANGE 捕获、缺省 null、多 MAP 取最新、`#EXT-BILI-AUX` 等未知标签不影响）。

**Analog:** 自身「parsePlaylist 加密检测（EXT-X-KEY，G-44-7）」describe（lines 148-175）

**行拼接清单 + 字段断言模式**（lines 149-159）:
```javascript
test('AES-128 + 相对 URI → hasEncryption=true 且 keyUris=["enc.key"]', () => {
  const text = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x00000000000000000000000000000001',
    '#EXTINF:5.0,',
    'seg0.ts',
  ].join('\n');
  const r = parser.parsePlaylist(text);
  assert.strictEqual(r.hasEncryption, true);
  assert.deepStrictEqual(r.keyUris, ['enc.key']);
});
```

## Shared Patterns

### 附加 meta 字段向后兼容（不升 META_VERSION / 不改 schema 版本）
**Source:** `media-cache-manager.js` lines 605-610（注释）、`media-record-engine.js` lines 183-187
**Apply to:** record meta.json 与 cache meta.json 的全部新字段（mapUri/initFile/mapByterange/map_uris/init_segment）
```
旧 meta 缺字段 = 该能力缺省关闭（缓存链路 initPath=null → 入口 init_missing 早拒；
录制链路无 initFile → convertToMp4 无 initPath → fMP4 命中时 init_missing 拒转）。
```

### reason → CONVERT_FAIL_TEXT 文案同步（有测试断言，硬约束）
**Source:** `main.js` lines 3022-3037；断言在 `tests/test-media-remuxer.js` lines 262-270/436-444
**Apply to:** 所有新 reason（`init_missing` 必加；`invalid_init`/`map_byterange_unsupported` 若采纳必加）
**Pitfall 5：** 缺条目 → 任务页落「未知原因」且测试红。

### storeBuffer O(1) 成员判定排除非分片 URI
**Source:** `media-cache-manager.js` lines 417-432（key_uris 先例）
**Apply to:** MAP URI 排除。时序前提直接继承：hls.js 先请求清单（updatePlaylistIndex 已落盘 map_uris）后请求 init/分片。**关键差异点：** key 本体只留 hex 进 meta，init 本体必须写盘 `<videoDir>/init`（拼接必需品）——排除是同款，留存形态不同。

### 执行体契约六件套（convert 任务任何新执行分支）
**Source:** `media-remuxer.js` convertToMp4 lines 251-405
**Apply to:** `concatFmp4ToMp4` 全项复刻——①入参 fail-fast ②`fs.openSync(outputPath,'w')` 同步 fd 产物创建（G-44-7 竞态修复，禁退回 createWriteStream 隐式 open）③fail() destroy+unlink 统一清理 ④每分片迭代开头 shouldCancel 协作式取消 ⑤onProgress try/catch 不阻断 ⑥stream.end 回调内 empty_output 终检。

### 取消 < 嗅探 < push 检查点优先序（44-08 契约，源码结构断言保护）
**Source:** `media-remuxer.js` lines 344-372；断言在 `tests/test-media-remuxer.js` lines 164-174
**Apply to:** 分流改造的插入点——concat 分支只能在 `if (i === 0)` 嗅探块内转向，不得前移到取消检查之前（Pitfall 4）。

### 安全域沿用（Phase 44 口径，零新增）
**Apply to:** 全链路——远端 URI 不进落盘文件名（seq 数字 / 固定常量 'init'，T-44-11）；缓存链路路径经 `_safePath` 双基淮校验（T-44-01/02）；MAX_SEGMENT_BYTES 64MB 上限沿用（T-44-03）；流式写盘不全量入内存（T-44-17）；拼接不解析 moof/trun 内部（攻击面=字节拷贝）。

### node:test 标准骨架
**Source:** 三个测试文件统一
```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-<name>-'));
try { /* 用例 */ } finally { fs.rmSync(dir, { recursive: true, force: true }); }
```
**硬约束：** 全部 stub/fixture，禁止真实 B 站网络（token 时效+直播偶发，Pitfall 7）；纯 Node 可加载（被测模块顶层无 electron require，Wave 0）。

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| fMP4 测试夹具 helper（`makeInit()`/`makeFmp4Segment()`，建议内联各测试文件或 `tests/helpers/`） | test utility | batch | 仓库无 fixtures 目录与共享 test helper 先例（RESEARCH Q6 明示「仓库无 fixtures 目录先例」）。按 RESEARCH 推荐用已装 mux.js generator 确定性生成：`muxjs.mp4.generator.initSegment([videoTrack])`（实测 658B）、`generator.moof(seq,[track]) + generator.mdat(payload)`（实测 133/108B）；B 站形态复刻 = 单分片文件内拼多个 moof+mdat 对、无 styp/ftyp。参考 RESEARCH.md Q6 与 mux.js API（`media-remuxer.js` line 25 的 require 方式）。 |

## Metadata

**Analog search scope:** 项目根目录（media-*.js, main.js）、tests/
**Files scanned:** 8 源文件 + 4 测试文件（全部 git ls-files 验证为 tracked，无镜像路径）
**Pattern extraction date:** 2026-09-07
