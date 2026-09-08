# 直播录制转码 mp4 时长截断排查实录（CDN 毒应答分片）

> 2026-09-08 · Realm Browser · 影响文件：`media-record-engine.js` / `media-remuxer.js` / `tests/test-media-record-segment-sniff.js`（新增）/ `tests/test-media-remuxer.js`

## 现象

B 站直播（miniav1，HLS+fMP4 形态）长时间录制后转码出的 mp4 **时长明显偏短**：
52 分钟的录制只显示 24 分钟、11 分钟，但**文件大小与正常产物几乎一样**。
同一直播间的第一次录制（52 分钟）完全正常；后两次录制期间疑似有暂停/刷新操作。

**特征**：

- 时长截断点位置无规律（47%、22% 处都有），不是固定时长上限；
- 文件字节一个不少（产物 size = init + 全部分片 size 精确相等）；
- ffprobe/播放器解析到某处即停，之后的数据全在但不可见；
- 短录制不复现——时间越长越容易踩中。

---

## ✅ 结论（2026-09-08 修复）

**B 站 CDN 偶发把分片请求以 HTTP 200 应答为当前 m3u8 清单文本**（签名过期/节点
切换边缘场景，暂停+刷新后旧签名追流更容易触发），录制引擎 `downloadSegment`
对下载内容零校验直接落盘，清单文本（几百字节的 `#EXTM3U...`）混进 moof/mdat
字节流。`concatFmp4ToMp4` 纯字节拼接原样写入产物，fMP4 解析器（播放器、
ffprobe、box walker 同理）走到第一个毒分片即判定 box 畸形**解析中断**——
产物时长 = 首个毒分片之前的内容，之后的数据全部不可见但字节都在。

三段同场录制的全量分片扫描（证据）：

| 录制 | 分片数 | 毒分片（内容 = `#EXTM3U` 清单） | 产物时长 |
|------|--------|------|------|
| b1bb2b1d（正常） | 3121 | 0 | 3121s ✅ |
| 4ed043b1 | 3139 | 2 个（idx 1473、2373） | 1473s（恰好截在 idx 1473）❌ |
| 06dc73b8 | 3197 | 3 个（idx 700 起） | 700s（恰好截在 idx 700）❌ |

毒分片特征：634~719 字节，以 `#EXTM3U` 开头，内容就是当时的直播清单
（`#EXT-X-MEDIA-SEQUENCE` 与所求 seq 接近）。源数据本身时间戳完全连续
（tfdt 逐分片校验无回退无重置），Phase 45 的 rebase 逻辑无问题。

### 判别签名（复发时先看这个）

- mp4 时长 << meta.json `totalDuration`，但 mp4 size ≈ meta `totalSize` + init；
- 产物按 top-level box 遍历时在某一偏移量戛然而止，该偏移映射回的分片
  不是 moof 开头而是文本（`head -c 8` 见 `#EXTM3U`）；
- 扫描 segments 目录找非 moof/非 0x47 开头的文件即可定位全部毒分片。

### 修复（两层防御）

1. **录制侧根治**（`media-record-engine.js`）：新增 `isPlausibleSegment()`，
   `downloadSegment` 落盘前嗅探——`#EXTM3U` 毒应答拒绝；已知 fMP4 录制
   （mapUri 已捕获）要求合法 box 头（moof/styp/ftyp/sidx + size 不越界）；
   TS 认 `0x47`。**校验不过即 throw：不写盘、不记 seen**，下轮轮询自动重试
   同一 seq（清单窗口内可补回），失败计数复用 D-18 既有语义。
2. **转码侧纵深防御**（`media-remuxer.js`）：新增 `isFmp4Fragment()`，
   `concatFmp4ToMp4` 逐分片校验 box 头，毒分片**跳过不写入**并计数
   （resolve 新增 `skipped`），产物只损失该分片约 1s，rebase 时间轴正常跨越；
   全毒分片时产物仅剩 init、终检 moof 计数为 0 → `empty_output` 拒转。

### 已有坏录制的修复方法（一次性脚本，已执行）

1. 扫 meta.json `segments` 逐条 `isFmp4Fragment(readFileSync)` 嗅探，删除毒分片文件；
2. 从 meta.json 移除对应条目并同步 `totalSize`/`totalDuration`；
3. 用 `concatFmp4ToMp4`（init + 剩余分片按序）重转码覆盖原产物。
   效果：两段 52 分钟录制完整恢复（3139s/3197s），只在坏点处各少约 1s。

> 注意：嗅探必须读**完整文件**校验（box 声明 size 需 ≤ 实际文件长度），
> 只读头部 64 字节会把合法分片（moof ~300B）误判为毒分片。

### 测试

- `tests/test-media-record-segment-sniff.js`（新增 5 例）：嗅探纯函数 +
  端到端「毒应答不落盘不记 seen → 下轮重试同一 seq 补回 → meta 只含合法分片」；
- `tests/test-media-remuxer.js` +3 例：毒分片跳过且产物字节精确 / 全毒
  `empty_output` / `isFmp4Fragment` 边界；
- 回归：remuxer 54、record-duration 6、cache 34、task-registry 26 全绿。

---

## 伴生问题（非本 bug，记录备查）

### QuickLook 预览仍显示旧时长 → 缓存

修复后 QuickLook/Finder 预览可能仍显示旧的截断时长（11 分钟）——
**QuickLook 缓存的是旧文件的预览**，文件本身三方验证（ffprobe/afinfo/mpv）
时长都正确。`qlmanage -r cache && qlmanage -r` 后恢复正常。

### mpv/ffmpeg 开头一堆 AV1 报错 → 流本身特性

```
[ffmpeg] NULL: Missing reference frame needed for show_existing_frame ...
[ffmpeg/video] libdav1d: Error parsing OBU data
Error while decoding frame!（×N，约前 2 秒）
```

**正常的录制产物也有同样报错**（同场第一段无问题的 1754.mp4 完全一致）。
录制从直播边缘开始，起始分片的帧用 `show_existing_frame` 引用**录制开始
之前**的参考帧，解码器报错至首个关键帧恢复（mpv 实测 Dropped: 92 ≈ 2s），
之后全程干净。Chromium 内置 dav1d 行为相同（开头 1~2s 黑屏/花屏后正常）。

可选增强（未做）：B 站清单 `EXT-BILI-AUX ...|K|...` 标记关键帧分片，录制
引擎可让首个落盘分片必须带 K 标记，产物即从关键帧起步。
