# Phase 45: B 站直播 fMP4 转录支持 - Research

**Researched:** 2026-09-07
**Domain:** HLS fMP4 (CMF) 分片纯 JS 拼接转封装（Electron 主进程，无打包器）
**Confidence:** HIGH（核心问题均经真实 B 站流实测 + 本地播放器解码验证）

<user_constraints>
## User Constraints (from 45-CONTEXT.md)

### Locked Decisions
- **D-01:** fMP4 转录走**纯 JS 拼接**——init.mp4 + moof/mdat 顺序拼接，产物为 fMP4 容器。零新依赖，不引 ffmpeg，不做 moof/trun 解析重打包常规 MP4
- **D-02:** 产物兼容性目标 = 「能看就行」（mpv/IINA/VLC/QuickTime 可播 fMP4），不进剪辑软件
- **D-03:** 录制链路 + 缓存链路两链路都覆盖，共用 EXT-X-MAP 捕获与拼接模块；tracer 先走录制链路端到端
- **D-04:** 加密 fMP4（SAMPLE-AES/FairPlay）不支持——维持既有拒转语义
- **D-05:** `#EXT-X-MAP` 捕获是全链路前置：parser 增加 MAP URI 捕获；录制引擎下载 init 分片并写入 meta.json；缓存层对 MAP URI 特殊处理（参照 44-18 key URI 先例）
- **D-06:** 拼接实现为独立模块/函数（不动 mux.js TS 路径）；`sniffContainerFormat` 的 fMP4 拒转语义改为「分流」；任务编排/进度/取消令牌/产物命名/通知全盘复用 Phase 44 convert 任务管线
- **D-07:** init 分片不计入完整度分母；拼接顺序 = init.mp4 在前 + 分片按播放序

### Claude's Discretion
- init 分片在缓存/录制目录的具体存放形态（meta 同级文件 vs segments 特殊键）、拼接模块命名与文件归属、测试夹具构造方式——按 Phase 44 既有先例自行决定

### Deferred Ideas (OUT OF SCOPE)
- 常规 MP4 重打包（完整 moov）
- ffmpeg 可选依赖兜底（除非纯 JS 拼接在真实 B 站流上被证伪——本研究已实测证其可行，该分叉关闭）
- 加密 fMP4 转录
- 44-REVIEW.md 技术债
</user_constraints>

## Summary

本阶段的核心未知——「B 站直播 fMP4 流长什么样、init+moof/mdat 直接字节拼接能不能播」——已通过**真实 B 站直播间实测 + 本地 mpv/VLC 解码验证**得到确定性答案：B 站直播 HLS fMP4 清单带恒定 `#EXT-X-MAP`（相对 URI、`.m4s` 后缀、无 BYTERANGE），媒体分片是纯 `moof+mdat` 序列（无 ftyp/styp），**逐字节原样拼接 init + 分片即可被 mpv/VLC 正常解码播放**（本机实测，h264 720p + AAC 均解码成功）。纯 JS 拼接路线（D-01）可行性已从假设升级为实测结论，无需任何新依赖。

两个已量化确认的产物瑕疵（均在 D-02「能看就行」容忍带内）：① 播放器总时长显示为垃圾值（mpv 显示 85:23:50）——根因是 B 站分片 tfdt（baseMediaDecodeTime）为 epoch 级大数，而 init 的 mvhd duration=0 恰是 RFC 8216 强制要求，**不是 bug 不要修 moov**；② VLC 报 `Fragment sequence discontinuity` 警告（mfhd 序号跨分片文件不连续）——仅警告不影响播放。

工程落地上，EXT-X-MAP 捕获与 init 留存可以完全复刻 Phase 44 的 EXT-X-KEY/key_uris 先例（parser 行级正则加法、meta 附加字段向后兼容不升版本、storeBuffer O(1) 成员判定跳过）。拼接执行体约 50 行流式字节拼接，复用 convertToMp4 的执行体契约（同步 fd 产物创建/取消令牌/进度回调/empty_output 终检）。最大回归风险点已定位：`tests/test-media-remuxer.js:176` 的「fMP4 box 分片拒转 unsupported_container」断言与 D-06 分流语义直接冲突，本阶段必须同步改写该测试。

**Primary recommendation:** convertToMp4 增加 `initPath` 入参并保持单一入口——嗅探命中 fMP4 box 特征时分流到新增的 `concatFmp4ToMp4` 纯字节拼接分支（init 缺失则新 reason `init_missing` 拒转）；parser/录制引擎/缓存层按 44-18 key URI 先例全链路捕获并留存 EXT-X-MAP init 分片。

## Findings

### Q1: B 站直播 HLS fMP4 流真实形态 —— 全部问题有实测答案

**调研方法（VERIFIED，2026-09-07 实测）：** 经 `api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=6&protocol=0,1&format=0,1,2&codec=0,1&platform=h5`（需 `Referer: https://live.bilibili.com/`，否则 -352 风控）取得 `http_hls / fmp4 / avc` 流地址（`https://d1--cn-gotcha208.bilivideo.com/live-bvc/…/index.m3u8?<token>`），curl 拉取清单两轮（间隔 ~87s）+ 下载 init 与媒体分片做 box 级解析。**无降级，全部为真实流一手数据。**

实测清单全文（632 字节，URL token 不落文档；分片为相对 URI 本身无 token）：

```m3u8
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-START:TIME-OFFSET=0
#EXT-X-MEDIA-SEQUENCE:1788796260
#EXT-X-TARGETDURATION:1
#EXT-X-MAP:URI="h1788488973.m4s"
#EXT-BILI-AUX:1250faff|K|1cdf5|a9a7bf95
#EXTINF:1.00,1cdf5|a9a7bf95
1788796260.m4s
#EXT-BILI-AUX:1250fee7|N|d35a|c0e40d8b
#EXTINF:1.00,d35a|c0e40d8b
1788796261.m4s
…（共 6 个分片）…
```

| 问题 | 实测答案 | 证据 |
|------|---------|------|
| 清单有没有 EXT-X-MAP？ | **有**，紧跟 TARGETDURATION 之后 | 上方清单第 6 行 |
| init 分片 URI 形态 | **相对 URI**，`h<时间戳>.m4s`（`h1788488973.m4s`），`.m4s` 后缀 | 清单 + curl 200（1142 字节） |
| EXT-X-MAP 带 BYTERANGE？ | **不带** | 清单原文 |
| MAP 在滑动窗口中是否恒定 | **恒定**——87s 后重拉（MEDIA-SEQUENCE 1788796260→1788796347），MAP URI 不变 | 两轮清单 diff |
| 媒体分片单 moof 还是多 moof？ | **多 moof**——一个 1s `.m4s` 文件内含 **4 个 moof+mdat 对**（实测分片 113483 字节 = moof×4 + mdat×4 严丝合缝到 EOF） | box 解析输出 |
| 有没有 styp？ | **没有**——分片首 8 字节即 moof（`00000148 moof`），全文件无 styp/ftyp | hexdump + 字节检索 |
| 分片时长/窗口大小 | EXTINF 1.00s，TARGETDURATION 1，**窗口 6 片**，无 ENDLIST（live） | 清单统计 |
| init 结构 | `ftyp`(32B, major=isom, brands=isom/mp42/avc1/**dash**) + `moov`{mvhd(v0, timescale=90000, **duration=0**), trak×2（视频+音频）, mvex{trex×2}} | box 解析输出 |
| 自定义标签 | `#EXT-BILI-AUX:…`（B 站私有）——parser 对未知 `#` 行安全忽略，无影响 | 清单 + media-m3u8-parser.js:49-90 逻辑 |
| MEDIA-SEQUENCE 形态 | epoch 秒级大数（1788796260），seq 补零 8 位（SEQ_PAD=8）文件名够用 | 清单 |

**对 D-01 的直接意义：** B 站分片无 ftyp/styp，拼接**不需要剥任何 box**——init + 各分片原始字节顺序写出即合法 fMP4。「是否需要剥重复 ftyp/styp」这一风险对 B 站形态不存在；对其他来源可在拼接分支加一个「跳过非首片开头的 ftyp box」的防御（可选，见 Routes）。

**对 parser 的直接意义：** `#EXT-X-MAP:URI="..."` 行级正则即可捕获，与 44-18 的 `#EXT-X-KEY:` 同款加法；`#EXT-BILI-AUX` 已证明 parser 的未知标签忽略逻辑不需要改动。

### Q2: 纯 JS 拼接产物可播放性 —— 本机 mpv/VLC 实测通过

**调研方法（VERIFIED，2026-09-07 本机实测）：** 下载 init + 连续 5 个真实分片，`cat init.m4s seg0..4.m4s > concat.mp4`（923,598 字节），本机 mpv 0.40 / VLC 3.x / ffprobe 验证。

| 验证项 | 结果 | 证据 |
|--------|------|------|
| ffprobe 识别 | ✅ h264 1280x720 30fps High@3.1 + AAC 2ch 48000Hz，两轨均识别 | `ffprobe -show_streams` 输出 |
| mpv 解码 | ✅ videotoolbox 硬解，视频帧与音频均解码输出（`--vo=null --ao=null` 解码测试 exit 0） | mpv 日志：`Decoder format: 1280x720 nv12 bt.709` |
| VLC 解码 | ✅ videotoolbox 解码 h264，正常播放退出 | VLC 日志：`Using Video Toolbox to decode 'h264'` |
| QuickTime | ⚠️ 未测（无 headless 手段） | [ASSUMED] AVFoundation 支持 fMP4（HLS fMP4 即苹果自家格式），但拼接裸文件 + duration=0 moov 的实际表现须 UAT 人工开一次确认——列入 UAT checkpoint |
| IINA | 未安装；IINA = mpv 前端，mpv 通过可高置信推断 | [ASSUMED] |

**关键风险逐项回答：**

1. **mvhd duration=0 时进度条/总时长表现（已实测）：** mpv 显示总时长 `85:23:50`（垃圾值）。**根因不是 moov**——RFC 8216 §3.3 强制 init 的 mvhd/tkhd duration=0 [CITED: datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.5]；垃圾时长来自分片 tfdt（baseMediaDecodeTime）为 epoch 级大数（ffprobe start_time=307426s ≈ 85.4h，与 mpv 显示吻合）。播放/解码不受影响，进度条拖动体验受损。可选增强是 tfdt rebase（解析 moof/traf/tfdt 减去最小基线，中等复杂度），**建议 MVP 不做**（D-02），记入 Routes 供用户后续决定。
2. **mdat 是否按 moof 对齐无额外字节（已实测）：** 是。实测分片 box 边界严丝合缝（328+75459=75787 恰为下一 moof 起点；末 mdat 终点 102362+11121=113483=文件大小），拼接无对齐风险。
3. **要不要剥后续分片的重复 ftyp/styp（已实测）：** B 站分片无 ftyp/styp，原样拼接即可。其他来源若每片自带 ftyp，中段 ftyp 对 mpv/ffmpeg 系播放器无害（宽容解析），可作可选防御。
4. **VLC fragment 序号警告（已实测）：** `mp4 demux: Fragment sequence discontinuity detected 1229674 != 0`——各分片文件内 mfhd 序号从各自基线起编、跨文件跳变。仅 demux 警告，播放正常，无需处理。

### Q3: npm 生态现成能力 —— mux.js 自带 probe/generator 够用，零新依赖成立

**mux.js 6.3.0（已装，dist bundle 在纯 Node 主进程实测可用）[VERIFIED: node 直接 require 运行]：**

- `muxjs.mp4.probe` 暴露：`findBox, parseType, timescale, startTime, compositionStartTime, videoTrackIds, tracks, getTimescaleFromMediaHeader, getEmsgID3`。对真实 B 站拼接产物实测：`findBox` → ftyp×1 / moov×1 / moof×20；`tracks` → video(id 1) + audio(id 2)；`timescale` → {1:90000, 2:48000}。**可直接用作拼接产物终检**（比裸 ftyp 头 + 大小校验强一档：能确认 moov 存在且 moof 数量 ≥ 分片数）。
- `muxjs.mp4.generator` 暴露：`ftyp, mdat, moof, moov, initSegment`。实测 `initSegment([track])` 生成 658 字节合法 init、`moof(seq,[track])`+`mdat(bytes)` 生成 probe 可解析的 133/108 字节片段——**测试夹具的最佳来源**（见 Test Strategy）。
- 拼接本身不需要 mux.js 参与：纯字节写盘（`fs.openSync` fd + `createWriteStream` + 逐分片 `readFileSync` + `write`），与 convertToMp4 的流式契约（T-44-17 不全量入内存）完全一致。

**mp4box.js 评估（备选，不推荐引入）：** npm `mp4box@2.4.1`，GPAC 官方仓库（github.com/gpac/mp4box.js），2015 年创建、持续维护、无 postinstall 脚本 [VERIFIED: npm registry]。能力是完整的 ISOBMFF 解析/改写——对「字节拼接」这个需求是杀鸡用牛刀；且 D-01 明确零新依赖。**结论：不引入。**（若未来做 tfdt rebase 或常规 MP4 重打包，可重新评估。）

**自写拼接 vs 引 mp4box 取舍：** 拼接逻辑 ~50 行（校验 init 以 ftyp 开头 → 写 init → 逐分片写），无格式解析负担（不解析 moof/trun）；引库换来的能力本阶段用不上，还增加打包/维护面。自写完胜。

### Q4: EXT-X-MAP 解析细节 —— RFC 8216 §4.3.2.5

[CITED: datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.5，原文要点]

- **URI 属性 REQUIRED**（quoted-string）；**BYTERANGE 属性 OPTIONAL**——「if it is not present, the byte range is the entire resource indicated by the URI」。
- **作用域：**「It applies to every Media Segment that appears after it in the Playlist until the next EXT-X-MAP tag or until the end of the Playlist.」——清单中 MAP 可变，需在每次解析时取「当前生效」的 MAP。
- **fMP4 强制：**「Each fMP4 Segment in a Media Playlist MUST have an EXT-X-MAP tag applied to it.」——即 fMP4 清单必有 MAP，反之有 MAP 即应按 fMP4 处理。
- **init 结构规范（§3.3）：** init MUST 含 ftyp（brand 兼容 iso6+）+ moov；moov 每 traf 对应 trak；**mvhd/tkhd duration MUST be zero**；mvex MUST 存在；init MUST NOT 含 sample data。B 站实测 init 完全吻合（ftyp isom/mp42/avc1/dash + moov + mvex，mvhd duration=0）。

**本项目要不要支持 BYTERANGE 形态的 MAP？** B 站不用（实测无 BYTERANGE 属性）。建议：parser 捕获 `mapByterange` 原样字符串备用，拼接链路只支持「整个资源 = init」形态；遇 BYTERANGE 非空按新 reason 拒转（defer，极罕见）。**MAP 变化频率：** B 站实测 87s 窗口内恒定；按 RFC 语义应支持「取最新 MAP」，录制链路按「mapUri 变化时重新下载 init」处理最稳（实测不会触发，成本一行判断）。

**重写链路现状：** `rewriteM3u8ForProxy`（main.js:284）对任意 `#` 行的 `URI="([^"]+)"` 全局替换——EXT-X-MAP 行已被覆盖，init 请求会照常过 /proxy 并携带 cache/vid 参数 [VERIFIED: main.js:280-297 本会话 Read]。

### Q5: 两链路落地设计草案

#### Parser（media-m3u8-parser.js，同款 44-18 加法）

```js
// 行级捕获，参照 EXT-X-KEY 写法：
if (trimmed.startsWith('#EXT-X-MAP:')) {
  const attrs = trimmed.slice('#EXT-X-MAP:'.length);
  const uriMatch = attrs.match(/(?:^|,)URI="([^"]*)"/);
  if (uriMatch) result.mapUri = uriMatch[1];            // 取最新一个（覆盖语义 = RFC 作用域）
  const brMatch = attrs.match(/(?:^|,)BYTERANGE="([^"]*)"/);
  result.mapByterange = brMatch ? brMatch[1] : null;
  continue;
}
// 返回值新增字段：mapUri: string|null, mapByterange: string|null（缺省 null，向后兼容）
```

#### 录制链路（media-record-engine.js）

- pollLoop 解析后：`pl.mapUri` 非空且（首次见到 或 与已存不同）→ 下载 init 落盘。**必须在 D-21 首轮 baseline 也下载**——init 不是媒体分片，baseline 语义只豁免分片回溯；漏掉则该录制任务永远 init_missing（Pitfall 3）。
- 存放形态（Discretion，建议）：taskDir 下 `init` 文件（与 segments/ 同级），meta.json 附加字段 `mapUri`（原始 URI）、`initFile: 'init'`、`mapByterange`——附加字段向后兼容不升版本（44 先例：hasEncryption/key_uris）。
- meta.json 参照 44-18 字段风格：

```json
{ "mapUri": "h1788488973.m4s", "initFile": "init", "hasEncryption": false, … }
```

- 分片落盘命名维持 `<seq 补零>.ts`（嗅探按内容不按扩展名，无需改）。
- `readRecordTaskSegments`（main.js:3045）读出 meta.initFile → 拼 initPath 传入 startConvertTask。

#### 缓存链路（media-cache-manager.js + main.js /proxy）

- **MAP URI 必须像 key URI 一样从 segments 排除**（D-05/D-07）：init 若进 segments map 会污染 `playlist_order.length === allKeys.length` 对齐判定与完整度分母（44-18 key URI 同款坑，G-44-7 注释明确写过）。
- `updatePlaylistIndex`：新增 `meta.map_uris = [segmentKeyOf(resolveUri(mapUri))]`（数组形态与 key_uris 对齐，容忍 MAP 轮换）；同时记 `meta.has_fmp4_map = true`（可选，供 UI/诊断）。
- `storeBuffer`：命中 map_uris 时**跳过 segments 登记但必须留存 init 本体**——与 key 不同，init 是拼接必需品。建议：写入 `<videoDir>/init`（videoDir 根，不占 segments 目录），登记 `meta.init_segment = { size, sha256, uri_key }`；重复 init 请求跳过重写（D-10 增量语义）。`lookup()` 需同步放行 init 请求的命中回放（查 meta.init_segment 读 `<videoDir>/init`），否则 hls.js 每次播放都回源拉 init（功能不受影响，仅多一次回源——可作为 Wave 2 优化，MVP 允许 miss 回源+留存）。
- `getConvertInfo`：返回新增 `initPath`（`<videoDir>/init` 存在性校验后）与 `hasFmp4Map`。
- **历史无 init 的 fMP4 缓存条目：** meta 无 init_segment → getConvertInfo.initPath=null → 转换入口早拒，新 reason `init_missing`，文案建议「fMP4 视频缺少初始化段，请重新播放该视频后再转换」（参照 key_unavailable 文案链路先例）。不做「从分片反推 init」的自愈（不可能——init 信息不在媒体分片里）。

#### 拼接执行体（media-remuxer.js，D-06 独立函数 + sniff 分流）

- **新函数 `concatFmp4ToMp4({ initPath, segmentPaths, outputPath, onProgress, shouldCancel })`**——与 convertToMp4 同契约（同步 fd 产物创建/fail 清理/协作式取消/进度回调/empty_output 终检），Promise resolve `{ outputPath, segments }`。
- **分流点：** convertToMp4 增加可选入参 `initPath`；首片嗅探命中 fMP4 box 特征时——`initPath` 存在 → 转 concatFmp4ToMp4 分支；缺失 → `init_missing` 拒转。TS 路径（0x47 放行）零改动。main.js 编排层保持单入口调用 convertToMp4，两链路只是多传一个 initPath。
- **拼接内容：** 校验 init 以 ftyp box 开头（前 8 字节 size+`ftyp`，非法则 `invalid_init` 拒转）→ 写 init → 逐分片原样写出。（可选防御：非首片若自带 ftyp box 则跳过该 box——B 站不需要，见 Routes。）
- **产物终检（建议）：** size > initSize 且产物头部 ftyp 存在（基线，对齐 G-44-4b）；**加强档**用 `muxjs.mp4.probe.findBox` 校验 moov 存在 + moof 计数 ≥ 1（Q3 已实测 probe 对真实 B 站产物工作）。建议采用加强档——成本一行调用，能拦住「init 损坏/分片全丢」类静默坏产物。
- **新 reason → CONVERT_FAIL_TEXT 同步**（有测试断言先例，test-media-remuxer.js:262）：`init_missing`、`invalid_init`（若采纳）、`map_byterange_unsupported`（若采纳 BYTERANGE 拒转）。

#### ⚠️ 既有测试冲突（必须在计划中改写）

`tests/test-media-remuxer.js:176`「fMP4 box 分片拒转 reason=unsupported_container 且产物清理」与 D-06 分流语义**直接冲突**：改造后同一输入（伪造 ftyp 分片、无 initPath）应得 `init_missing`（或维持 unsupported_container——建议新 reason 更清晰）。该测试必须同步更新；同文件 :164 的「取消 < 嗅探 < push」源码结构断言与 :246「取消先于嗅探」语义**必须保留**（44-08 契约）。`main.js` CONVERT_FAIL_TEXT 覆盖测试（:262）的 reason 列表需扩新条目。

### Q6: 测试策略

**夹具构造（Discretion，推荐方案已实测可行）：** 不入库二进制文件（仓库无 fixtures 目录先例），用 mux.js generator 在测试内确定性生成：

- init：`muxjs.mp4.generator.initSegment([videoTrack])`（实测 658 字节，probe 可解析）；
- 媒体分片：`generator.moof(seq, [track]) + generator.mdat(payload)`（实测 133/108 字节，findBox 可解析）；
- **B 站形态复刻**：一个「分片文件」= 两个 moof+mdat 对拼接（复刻实测的多 moof 形态）+ 无 styp/ftyp；
- 负面夹具：手写 4 字节 size+`ftyp` 头（沿用 :179 既有写法）构造 init_missing 场景。

**分层覆盖：**

| 层 | 内容 | 参照先例 |
|----|------|---------|
| parser 单测 | EXT-X-MAP URI/BYTERANGE 捕获、缺省 null、多 MAP 取最新、EXT-BILI-AUX 不影响 | 44-18 EXT-X-KEY 用例 |
| concatFmp4ToMp4 单测 | 字节级产物 = init+seg1+seg2 精确相等；多 moof 分片原样通过；取消中途清理；init 缺失/非法拒转 reason；empty 终检；probe 终检断言 moov+moof 计数 | test-media-remuxer.js 既有模式 |
| 分流单测 | convertToMp4 传 initPath + fMP4 分片 → 走拼接成功；不传 → init_missing；TS 路径回归 | 改造 :176 用例 |
| 录制链路 e2e | 注入 fetchPage stub（带 EXT-X-MAP 清单 + init + 分片），断言 init 在首轮 baseline 也下载、meta.json 含 initFile/mapUri、segments 不含 init | test-media-record-duration.js 注入模式 |
| 缓存链路 | updatePlaylistIndex 登记 map_uris；storeBuffer 对 MAP key 跳过 segments 但留存 init；完整性分母不含 init；getConvertInfo 返回 initPath | test-media-cache.js key_uris 用例 |
| 文案链路 | CONVERT_FAIL_TEXT 覆盖全部新 reason | :262 既有断言扩展 |

**真实流依赖红线：** B 站流 URL 带 expires token 且直播间时开时关——任何自动化测试**不得**打真实网络，全部 stub/fixture。真实流验证只属于 UAT（tracer：B 站直播录制 → 停止 → 转 MP4 → mpv/VLC/QuickTime 打开）。

## Routes

| 路线 | 内容 | 结论 |
|------|------|------|
| **A. 纯 JS 字节拼接（D-01 锁定）** | init + 分片原样顺序写出 | ✅ **采纳**——真实 B 站流实测可播（Q2），零新依赖 |
| B. tfdt rebase 可选增强 | 解析 moof/traf/tfdt，减去最小基线，修复进度条总时长显示（85h 垃圾值） | 🕐 **建议 defer**——D-02「能看就行」容忍；中等复杂度（要动 traf 内部 box）；若用户 UAT 后对进度条不满再立小项 |
| C. 引 mp4box.js | 完整 ISOBMFF 库 | ❌ **否决**（D-01 零新依赖；Q3 评估杀鸡用牛刀） |
| D. BYTERANGE 形态 MAP | init 为大资源的字节区间 | 🕐 **defer**——B 站实测不用；遇之则新 reason 拒转 |
| E. 非首片剥 ftyp 防御 | 其他来源分片可能自带 ftyp/styp | 🕐 **可选**——B 站实测无此形态；中段 ftyp 对主流播放器无害；要做仅数行（解析首个 box header 跳过） |
| F. QuickTime 兼容性 | 无法 headless 验证 | ⚠️ **UAT checkpoint**——人工用 QuickTime 打开一次拼接产物确认（[ASSUMED] AVFoundation 支持 fMP4，预期可播） |

**CONTEXT 中「纯 JS 拼接被真实流证伪则回报用户重议 ffmpeg」的分叉点：已关闭**——实测证明可行（Q2）。

## Recommended Approach

1. **Parser 先行（全链路地基）：** media-m3u8-parser.js 增加 `mapUri`/`mapByterange` 捕获（Q5 代码草案），单测覆盖。
2. **拼接执行体：** media-remuxer.js 新增 `concatFmp4ToMp4`（独立函数，convertToMp4 内 sniff 分流调用）；convertToMp4 增加 `initPath` 入参；新 reason `init_missing`（+ 可选 `invalid_init`）；main.js CONVERT_FAIL_TEXT 同步文案；改写 :176 冲突测试。
3. **录制链路（tracer 先行，D-03）：** record-engine pollLoop 下载 init（首轮 baseline 也下）+ meta.json 附加字段；readRecordTaskSegments 传出 initPath；startConvertTask 透传。
4. **缓存链路：** updatePlaylistIndex 登记 map_uris；storeBuffer 排除+留存 init（`<videoDir>/init` + meta.init_segment）；getConvertInfo 返回 initPath；startConvertFromInput 透传；历史条目 initPath=null → init_missing 文案引导重播。
5. **UAT：** tracer = B 站直播录制 → 停止 → 转 MP4 → mpv/VLC/QuickTime 打开可播；缓存链路 fMP4 VOD 条目转换随后。

## Pitfalls

1. **首轮 baseline 漏下 init（最高危）：** D-21「首轮只记基线不落盘」若被误套到 init 上，录制任务永远 init_missing。init 不是分片，必须在第一次见到 mapUri 时即下载（含首轮）。
2. **init 混入 segments 污染完整性判定：** 缓存链路若让 init 走普通分片落盘，`playlist_order` 对齐判定与完整度分母全乱（G-44-7 key URI 同款坑，该注释原话：「16 字节密钥混入 segments 会污染 playlist_order 完整性判定」——init 同理）。
3. **把 mvhd duration=0 当 bug 修：** 那是 RFC 强制形态；时长垃圾来自 tfdt epoch 基线。修 moov 是错方向，rebase tfdt 才是正解（且建议 defer）。
4. **取消/嗅探/push 顺序契约破坏：** 44-08 契约（取消检查先于嗅探）有源码结构断言测试；分流改造别把 concat 分支插到取消检查之前。
5. **新 reason 忘配文案：** CONVERT_FAIL_TEXT 缺条目 → 任务页落「未知原因」；有测试断言该映射（:262），新增 reason 必须同步。
6. **:176 拒转测试不改导致红：** D-06 分流直接推翻「fMP4 → unsupported_container」旧语义，该测试必须同 PR 改写，否则测试套件红。
7. **真实流写进自动化测试：** token 过期 + 直播间时开时关 = 测试闪烁。一律 stub。
8. **MAP 轮换假设为常量：** 实测 B 站恒定，但 RFC 允许变化；parser 取「最新生效」、录制侧「变化即重下 init」，缓存侧 map_uris 用数组——三处都按可变设计，实测不变也不亏。
9. **probe 终检对空 tracks 的 init 误判：** mux.js probe.timescale/tracks 依赖 moov/trak 结构，终检只断言 ftyp+moov 存在 + moof 计数，不要断言具体 track 数（音频-only 流也合法）。

## Test Strategy

见 Q6 分层表。Quick run：`node tests/test-media-remuxer.js && node tests/test-media-cache.js && node tests/test-media-record-duration.js`（全 < 30s，纯 Node，无 Electron）。Wave 0 无需新框架——node:test 既有基建覆盖全部需求，仅需新增夹具生成 helper（可放 tests/helpers/ 或各测试文件内）。

## Package Legitimacy Audit

本阶段**零新依赖**（D-01）。评估过的包：

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| mux.js@6.3.0 | npm | 已装（package.json:52） | 既有依赖 | github.com/videojs/mux.js | OK | 复用 probe/generator，无新增 |
| mp4box@2.4.1 | npm | 11 年（2015-04 创建，2026-06 仍维护） | — | github.com/gpac/mp4box.js，无 postinstall | OK | **不引入**（D-01 否决，仅评估记录） |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 全部测试/执行体 | ✓ | （项目既有） | — |
| mux.js 6.3.0 | probe 终检/夹具生成 | ✓ 已装 | 6.3.0 | 终检降级为 ftyp 头+大小校验 |
| mpv / VLC / ffprobe | **仅本研究实测与 UAT 人工验证** | ✓（开发机） | mpv 0.40 / VLC 3.x / ffmpeg 8.x | 生产代码与自动化测试均不依赖 |
| QuickTime Player | UAT 兼容性确认 | macOS 自带 | — | 无（人工项） |

**Missing dependencies with no fallback:** none——执行体与测试均为纯 Node + 既有依赖。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test（Node 内置，零依赖，项目既有） |
| Config file | none——直接 `node tests/test-*.js` |
| Quick run command | `node tests/test-media-remuxer.js` |
| Full suite command | `node tests/test-media-remuxer.js && node tests/test-media-cache.js && node tests/test-media-record-duration.js` |

### Phase Requirements → Test Map
| 需求 | Test Type | Automated Command | File Exists? |
|------|-----------|-------------------|-------------|
| EXT-X-MAP 解析 | unit | `node tests/test-media-remuxer.js`（或独立 parser 测试文件） | ❌ 新增用例 |
| fMP4 拼接执行体 | unit | `node tests/test-media-remuxer.js` | ❌ 新增用例（含改写 :176） |
| 录制链路 init 留存 | unit/e2e（stub fetchPage） | `node tests/test-media-record-duration.js` | ❌ 新增用例 |
| 缓存链路 MAP 排除+留存 | unit | `node tests/test-media-cache.js` | ❌ 新增用例 |
| 真实 B 站流端到端 | manual-only（token 时效+直播偶发，Pitfall 7） | UAT tracer | — |

### Wave 0 Gaps
- [ ] 夹具生成 helper（mux.js generator 封装：makeInit()/makeFmp4Segment()）——新建，建议 tests/helpers/ 或测试文件内联
- [ ] :176 拒转用例改写为分流语义

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | 远端 m3u8 清单与 init/分片字节为不可信输入——parser 行级正则（既有模式）、init ftyp 头校验、MAX_SEGMENT_BYTES（64MB）上限沿用、分片文件名纯数字 seq（T-44-11 先例，远端 URI 不进路径） |
| V6 Cryptography | no（本阶段不涉加解密；加密 fMP4 维持拒转 D-04） | — |
| V1 Architecture | yes | init 文件存放复用 _safePath 路径越界校验（缓存链路）；录制链路 init 文件名固定常量不进远端输入 |

### Known Threat Patterns（沿用 Phase 44 口径）
| Pattern | Mitigation |
|---------|-----------|
| 恶意清单超大/畸形分片 DoS | MAX_SEGMENT_BYTES 上限 + 流式写盘不全量入内存（T-44-17/T-44-03 沿用） |
| 远端 URI 路径注入 | 落盘文件名只用 seq 数字/固定常量（T-44-11）+ cache 链路 _safePath + segKey sha256 |
| 畸形 init/分片致拼接崩溃 | init ftyp 头校验 fail-fast；probe 终检拦静默坏产物；拼接不解析 moof/trun 内部（攻击面=字节拷贝） |

## Sources

### Primary (HIGH confidence)
- **真实 B 站直播流实测（2026-09-07，房间 6，qn 250 avc fmp4）**——清单两轮抓取、init/分片 box 解析、MAP 恒定性（本研究一手数据，清单片段已贴 Q1）
- **本机播放器实测（2026-09-07）**——mpv/ffprobe/VLC 对 init+5 分片拼接产物的解码验证（Q2 表格）
- **mux.js 6.3.0 本地实测**——probe.findBox/timescale/tracks 对真实拼接产物、generator.initSegment/moof/mdat 夹具生成（Q3/Q6，node 直接运行输出）
- 本会话 Read 的源码：media-remuxer.js、media-m3u8-parser.js、media-cache-manager.js、media-record-engine.js、main.js:240-430/3015-3285、tests/test-media-remuxer.js

### Secondary (MEDIUM confidence)
- [CITED: datatracker.ietf.org/doc/html/rfc8216#section-4.3.2.5]——EXT-X-MAP 属性/作用域/fMP4 init 结构规范（Q4 引用原文）
- npm registry（mp4box@2.4.1 元数据，Q3）

### Tertiary (LOW confidence)
- [ASSUMED] QuickTime Player 对拼接裸 fMP4 的实际表现——AVFoundation 支持 fMP4 系推断，未实测，列为 UAT checkpoint
- [ASSUMED] IINA 可播——由 mpv 通过推断（IINA 为 mpv 前端）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | QuickTime 可播拼接 fMP4 | Q2/F | 低——D-02 四选一播放器少一个，mpv/VLC 已实测兜底；UAT 人工确认 |
| A2 | IINA 可播（mpv 前端推断） | Q2 | 极低 |
| A3 | B 站其他清晰度/HEVC 流 MAP 形态与 avc 一致 | Q1 | 低——实测仅 avc qn250；hevc 流清单结构预期同构（同 CDN 体系），tracer 用 avc 即可 |
| A4 | B 站 VOD fMP4（缓存链路）与直播形态一致 | Q5 缓存链路 | 中——VOD 形态未实测；缓存链路 tracer 验证时若形态差异（如带 BYTERANGE），按 reason 拒转兜底不静默坏 |

## Open Questions

1. **QuickTime 实际表现？**——UAT checkpoint 人工打开一次即可关闭此问。
2. **B 站 VOD fMP4 缓存条目是否同样形态（MAP 无 BYTERANGE、分片无 styp）？**——未实测；缓存链路实现按直播形态假设，tracer 第二轮验证。若遇 BYTERANGE/差异形态：拒转+文案兜底（不静默产坏产物），回报用户决定是否扩展。
3. **tfdt rebase 要不要做？**——建议 defer 到 UAT 后用户看实际进度条体验再定（Route B）。

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH——零新依赖，mux.js 既有能力本机实测
- Architecture: HIGH——全链路落点均有 44-18 key URI 先例可直接复刻，源码本会话全部 Read
- Pitfalls: HIGH——核心坑（baseline 漏 init/segments 污染/测试冲突）均从源码与实测定位
- 产物兼容性: HIGH（mpv/VLC 实测）/ MEDIUM（QuickTime ASSUMED 待 UAT）

**Research date:** 2026-09-07
**Valid until:** 2026-10-07（B 站 CDN 形态可能随版本变化，实测数据 30 天内高置信）

## Self-Check: PASSED

- [x] 6 个研究问题全部作答，核心结论有实测/引用来源
- [x] 真实流实测数据（清单片段、box 结构、播放器验证）贴入文档，URL token 未落文档
- [x] 未改任何生产代码（只读 + 写本文件）
- [x] 网络调研标注来源；ASSUMED 项明示并入 Assumptions Log
- [x] 既有回归测试冲突（:176）定位并给出改写方向


