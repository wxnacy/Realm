---
phase: 45-bilibili-fmp4-transcode
reviewed: 2026-09-08T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - media-m3u8-parser.js
  - media-remuxer.js
  - media-record-engine.js
  - media-cache-manager.js
  - main.js
  - tests/test-m3u8-playlist-parser.js
  - tests/test-media-remuxer.js
  - tests/test-media-record-duration.js
  - tests/test-media-cache.js
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-09-08
**Depth:** standard
**Files Reviewed:** 9 (5 production + 4 test)
**Status:** issues_found

## Summary

Reviewed the full fMP4 转录链路 (parser EXT-X-MAP 捕获 → concatFmp4ToMp4 纯字节拼接 → 录制/缓存 init 留存 → 编排层 initPath 透传) at standard depth: read every production change in context, traced the initPath data flow across all four hops (record meta.json → readRecordTaskSegments → startConvertFromRecordTask/startConvertFromInput → startConvertTask → convertToMp4), and re-ran all four test suites (38+28+34+6 = 106 pass, 0 fail).

**Security invariant code-level verification (all hold):**
- T-45-01 init ftyp fail-fast: media-remuxer.js:525-528 checks `length < 8 || ascii(4,8) !== 'ftyp'` before any write; probe 终检 (moov + moof≥1) with 4MB head cap and baseline degradation — correct.
- T-45-03/T-45-05 fixed `'init'` constant filename: record-engine.js:243 and cache-manager.js:443 both use literal constants; remote URI never enters the path. Holds for writes (but see WR-01 for the record-side read-back).
- T-45-05 `_safePath` dual-base resolve+realpath: cache-manager.js:137-162 verified — deepest-existing-ancestor realpath recheck, symlink escape rejected.
- T-45-06 map_uris O(1) exclusion: storeBuffer:438 intercepts before segments write; getConvertInfo:700-704 merges key_uris+map_uris into a single exclusion set consumed by allKeys/playlist_order/completeness — init never enters completeness math (test-locked).
- D-04 encrypted fMP4 keeps unsupported_container rejection: media-remuxer.js:383-386 verified.
- 44-08 contract (取消 < 嗅探 < push) preserved: diversion sits inside the i===0 sniff block after the cancel check.

No Critical issues. Two Warnings: an unvalidated meta-driven path join on the record side (inconsistent with the phase's own trust boundary claim and the cache-side implementation), and a map_uris overwrite that breaks the stated MAP-rotation tolerance.

## Warnings

### WR-01: readRecordTaskSegments trusts meta.initFile without whitelist — path traversal from declared-untrusted local meta

**File:** `main.js:3078-3079`
**Issue:** 45-SECURITY.md declares `缓存 meta.json → getConvertInfo/initPath` a trust boundary ("本地 meta 可被篡改（T-44 系列字段白名单校验语义沿用）"), and this very function already applies that standard: the CR-03 block at main.js:3055-3059 uuid-whitelists `task.id` precisely because "media-tasks.json 可被本地篡改，防补算路径穿越". The new initFile read-back does not follow it:

```js
if (typeof meta.initFile === 'string' && meta.initFile) {
  const p = path.join(recordDir, meta.initFile);   // 任意字符串直接拼路径
  if (fs.existsSync(p)) initPath = p;
}
```

A tampered meta.json with `"initFile": "../../some/file"` yields an arbitrary local path as initPath, which concatFmp4ToMp4 then reads and (if it passes the 8-byte ftyp check) splices into the user-saved mp4. The cache side does this correctly — `getConvertInfo` ignores any meta-provided name and uses the fixed constant `this._safePath(videoId, 'init')` (media-cache-manager.js:757-760). Impact is bounded (requires local write access to meta.json; target file must look like an fMP4 init), so this is a defense-in-depth/consistency gap rather than an exploitable remote vector — but the phase's own threat register claims whitelist semantics that this code path does not implement.

**Fix:**
```js
// initFile 为引擎写入的固定常量；本地 meta 可被篡改（CR-03 同款白名单语义），
// 只接受唯一合法值，杜绝 meta 驱动的路径穿越
let initPath = null;
if (meta.initFile === 'init') {
  const p = path.join(recordDir, 'init');
  if (fs.existsSync(p)) initPath = p;
}
```

### WR-02: updatePlaylistIndex overwrites map_uris instead of accumulating — stated MAP-rotation tolerance does not hold

**File:** `media-cache-manager.js:662-668`
**Issue:** The comment and 45-03 key-decision state "数组形态容忍 MAP 轮换（Pitfall 8）", and the storeBuffer side honors rotation (uri_key change overwrites the retained init). But the registration side rebuilds `meta.map_uris` with only the *current* MAP on every playlist update:

```js
if (pl.mapUri && !pl.mapByterange) {
  const mapUris = [];
  try { mapUris.push(segmentKeyOf(resolveUri(pl.mapUri, m3u8Url))); } catch { ... }
  meta.map_uris = mapUris;   // 覆盖，不保留旧 MAP 键
}
```

On rotation A→B, a late/repeat request for init A (in-flight when the playlist flipped, player re-request after seek, replay of a cached entry) misses `map_uris` and falls through to the normal segments write path — init A is registered in `meta.segments`, permanently breaking playlist_order alignment and completeness for that entry (`completeness < 100` → `segments_incomplete` at the convert entry, unrecoverable short of eviction). The array form was chosen specifically to tolerate this, but only the storeBuffer lookup is array-aware; the writer never keeps more than one element. Rare for B 站 (MAP 实测恒定), which is why this is a Warning not a Blocker.

**Fix:**
```js
if (pl.mapUri && !pl.mapByterange) {
  try {
    const k = segmentKeyOf(resolveUri(pl.mapUri, m3u8Url));
    const prev = Array.isArray(meta.map_uris) ? meta.map_uris : [];
    meta.map_uris = prev.includes(k) ? prev : [...prev, k];  // 累积容忍 MAP 轮换
  } catch { /* 非法 URI 跳过 */ }
}
```

## Info

### IN-01: pollLoop init 分支 `buf` 遮蔽外层清单 `buf`

**File:** `media-record-engine.js:241` (shadows the playlist buffer declared at line 213)
**Issue:** `const buf = await fetchPage(absUrl, ...)` inside the init block shadows the outer playlist `buf`. Currently harmless (outer `buf` is only used by the DISCONTINUITY/KEY regexes *before* the init block), but a future edit that references the playlist buffer after the init checkpoint will silently read init bytes instead.
**Fix:** Rename the inner binding, e.g. `const initBuf = await fetchPage(absUrl, ...)`.

### IN-02: 录制引擎 MAP 状态机在 RFC 合法迁移下留存不一致的 init 状态

**File:** `media-record-engine.js:229-249`
**Issue:** Two edge transitions of the `(st.mapUri, st.mapByterange, st.initFile)` triple are inconsistent: (a) BYTERANGE(A) → plain(A): guard `st.mapUri !== pl.mapUri` is false, so init is never downloaded and `st.mapByterange` stays set — meta carries `mapByterange` non-null forever even though the stream is now a supported form; (b) plain(A, downloaded) → BYTERANGE(B): the BYTERANGE branch registers `st.mapUri=B` but leaves `st.initFile='init'` (init A on disk), so meta advertises an init that belongs to the previous MAP and conversion may splice mismatched init+segments — the probe 终检 is structural only (moov+moof≥1) and would not catch an init/segment mismatch. Both require mid-recording MAP mutation (B 站 实测恒定, Pitfall 8 accepted risk), hence Info.
**Fix:** In the BYTERANGE branch also reset `st.initFile = null`; in the guard, treat "byterange→non-byterange" as a change worth (re)downloading, e.g. key the guard on both `pl.mapUri` and `pl.mapByterange`.

### IN-03: storeBuffer init 写盘绕过 _writeWithEvictRetry 且不计入 total_size

**File:** `media-cache-manager.js:443-447`
**Issue:** The init body is written with a bare `fs.writeFileSync(initFile, buffer)` — unlike segments it gets no ENOSPC/EDQUOT eviction retry (one full-cache moment loses the init until the next replay) and its bytes are not added to `meta.total_size`, so the capacity water-level accounting drifts by the init size (negligible per entry, but the accounting invariant "total_size = 磁盘口径" no longer strictly holds). Failure mode degrades gracefully (init_missing at convert, self-heals on replay).
**Fix:** Route the init write through `this._writeWithEvictRetry(initFile, buffer, videoId)` and add `buffer.length` to `mMeta.total_size` (or document the exclusion in the total_size JSDoc).

### IN-04: probe 结构校验失败复用 empty_output，文案误导

**File:** `media-remuxer.js:586`
**Issue:** When the strengthened final check fails because moov/moof is absent (e.g. all segments empty, or a mismatched init), the rejection reuses `empty_output` with message "转封装产物为空（无有效媒体数据）" even though the output may be megabytes of structurally-invalid data. Diagnosis in task-page logs will point at the wrong cause.
**Fix:** Emit a distinct reason for the probe-failure branch (e.g. `invalid_output_structure`) or adjust the message to cover "产物结构校验未通过"; remember to register any new reason in CONVERT_FAIL_TEXT (main.js:3024-3041) to avoid 任务页「未知原因」.

### IN-05: BYTERANGE 形态缓存条目的 init 请求落进 segments（磁盘浪费 + 污染，被早拒遮蔽）

**File:** `media-cache-manager.js:438-453` (absence of a map_byterange branch); test-documents the behavior at tests/test-media-cache.js BYTERANGE 用例
**Issue:** For BYTERANGE-form MAP entries, `map_uris` is intentionally not registered, so the player's init.mp4 request falls through to the normal segments path and is stored as a regular segment — wasted disk and a completeness-polluting segments entry. It is currently masked because startConvertFromInput rejects `hasFmp4Map && !initPath` with init_missing *before* the completeness check (main.js:3278), so no bad conversion can result; but the pollution persists in the cache entry.
**Fix:** In storeBuffer, when `mMeta.map_byterange` is set and the incoming segKey resolves to the MAP URI, skip storage with `{ ok:true, skipped:true, reason:'map_byterange_unsupported' }` (requires registering the byterange MAP key in a separate meta field, e.g. `map_uris_unsupported`).

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
