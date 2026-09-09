# Twitch 直播转录 mp4 预览打不开排查实录（mux.js 产物三处 AVF 不兼容）

> 2026-09-09 · Realm Browser · 影响文件：`media-remuxer.js` / `tests/test-media-remuxer.js`

## 现象

Twitch 直播（HLS+MPEG-TS 形态）录制转录出的 mp4 在 mac 上连环出问题：

1. 第一版产物：预览/QuickTime/QuickLook **全部打不开**（一直转圈），mpv 可播；
2. 修复①后第二版产物：预览能打开但**总时长显示 13.3 小时**、**播放 2 秒就卡住**，
   mpv 显示 6 秒且可正常播完；
3. B 站直播（HLS+fMP4 形态）转录的 mp4 预览始终正常。

ffprobe 解析所有产物全部正常（编码参数、时长、流结构均无异常）——问题全部在
fMP4 容器结构与 AVFoundation 的交互上。

## ✅ 结论（2026-09-09 修复）：mux.js 产物对 AVFoundation 的三处结构不兼容

两条转录链路的产物结构差异：B 站走 fMP4 纯字节拼接，源分片 moov/moof 由 B 站
编码器生成，天然规避了全部三个坑；Twitch 走 TS→mux.js Transmuxer 转封装，
mux.js 的产物面向浏览器 MSE 优化，与 AVF 的文件解析有三处冲突：

### 缺陷①：音频 moof 排在视频前 → AVF 打开即死等

mux.js CoalesceStream **故意**把音频 boxes `unshift` 到视频前
（`node_modules/mux.js/cjs/mp4/transmuxer.js:671-684`，注释自述是绕 Chrome 75
MSE bug）。AVFoundation 打开 fMP4 时用文件里第一个 moof 建立时间轴基准，首
moof 为音频轨（且视频轨在其后）时陷入 semaphore 死等——mac 预览/QuickTime/
QuickLook 全部打不开（mpv/ffmpeg 系扫描全部 moof 自建索引，不在乎顺序）。

### 缺陷②：mvhd/tkhd/mdhd duration=0xFFFFFFFF → 时长显示 13.3 小时

mux.js 生成的 init 段把 duration 写为 0xFFFFFFFF（"未知时长"惯例）。
AVFoundation 把 moov 声明的时长当作**实体媒体段**，与后续分片时长**累加**：
0xFFFFFFFF@90000 ≈ 47721s ≈ 13.3 小时（moof 里的几秒媒体排在 47721s 之后）。
**原地改写成真实总时长同样错误**——实测 AVF 时间轴变为 声明时长+分片时长
（6.05+6.04≈12.1s，双倍拉伸、半速播放）。唯一正确值是 **0**（B 站 init 段
形态/RFC 8216 §3.3 直播强制形态），播放器从分片推导时长。

### 缺陷③：mfhd sequence_number 跨轨重复且从 0 起 → 播放 2 秒卡住

mux.js 音/视频轨各自维护从 0 起的 fragment 计数——产物 moof 序为
`0(V) 0(A) 1(V) 1(A)…`（spec 要求自 1 严格递增）。AVF 按 sequence_number
建分片索引，**重复序号的后到分片被丢弃**：实测 6s 产物 AVAssetReader 只读出
首个分片（125 帧 ≈ 2.08s）即停，错误码 -11800/-12842——正是"播放 2 秒卡住"。

### 实验矩阵（本机实测）

| 样本 | qlmanage | AVAssetReader 视频 | AVAssetReader 音频 | AVF 时长 |
|---|---|---|---|---|
| Twitch 原始产物（①②③全有） | 挂起 >7min | — | — | — |
| 仅修①（视频在前） | 0.15s ✅ | 125 帧 @2s 停 ❌ | 0 帧 ❌ | 47724s ❌ |
| ①+③（seq 重编号） | — | 365 帧全量 ✅ | 5 块但 PTS 89484s ❌ | 47728s ❌ |
| ①+②（时长改真实值） | — | 125 帧停 ❌ | 0 帧 ❌ | 双倍拉伸 ❌ |
| ①+②+③（时长归零+重编号，**最终方案**） | 0.15s ✅ | 360 帧 6.00s 全量 ✅ | 281 帧 5.99s 全量 ✅ | 6.04s ✅ |
| B 站拼接产物（对照） | 0.2s ✅ | 2010 帧全量 ✅ | 3141 帧全量 ✅ | 67.0s ✅ |
| ffmpeg -c copy 重封装（对照） | 0.26s ✅ | 364 帧全量 ✅ | 282 帧全量 ✅ | 6.01s ✅ |

> AVF 音频读取按块合批（B 站 67s 仅 270 块），判完整性要看
> CMSampleBufferGetNumSamples 帧数与时长总和，不能看 chunk 数。

### 判别签名（复发时先看这个）

- 产物 ffprobe 全绿但 `qlmanage -t` 挂起 → 缺陷①（遍历顶层 box 看 moof 序
  是否 `音频,视频…`）；
- 预览总时长 ≈13.3 小时 → 缺陷②（mvhd duration=0xFFFFFFFF@90000）；
- 预览播放固定卡在首个分片边界（如 2s）→ 缺陷③（mfhd seq 跨轨重复）；
- 本机有 pyobjc 时可用 AVAssetReader 直接量化：`AVAssetReader` +
  `AVAssetReaderTrackOutput` 逐轨读样本，对比帧数/时长总和与 ffprobe。

### 修复（`media-remuxer.js`，全部在 convertToMp4 TS 转封装路径）

1. `extractVideoTrackId`（init 段 moov 解析视频轨 track_ID）+
   `reorderVideoFirst`（每个 combined data 事件切成 moof+mdat 组，稳定排序
   视频组在前）——修缺陷①；
2. `zeroFragmentedMovieDurations`（init 段写盘前 mvhd/tkhd/mdhd duration
   原位归零，v0/v1 均处理）——修缺陷②；
3. `renumberFragmentSequence`（每个 data 事件的 moof 按写盘顺序改写 mfhd
   seq 为全局严格递增，跨事件累乘计数）——修缺陷③。

三处修复均为**等长原位改写/整组字节块移动**，不新增 box、不改样本数据；
单轨流、无视频轨、任何解析异常一律原样通过——修补绝不搞挂转封装。

`concatFmp4ToMp4`（B 站路径）源分片天然无三缺陷，产物零改动，仅终检保留
「首 moof 首 traf 非视频轨」非阻断 warn 观测点。

### 已有坏产物

不批量修复，需要时用修复后代码重转（录制分片仍在
`userData/media-records/<taskId>/`）。

### 验证

- 问题录制（dev 84a7a872，3 个 TS 分片）重转：mvhd duration=0、moof 序
  `1(V) 2(A) 3(V) 4(A) 5(V) 6(A)`；AVAssetReader 双轨全量（V 360 帧 6.00s /
  A 281 帧 5.99s）；AVF asset.duration=6.036s；qlmanage 0.15s；
- 旧录制（nightly ee1e6cf4）重转同样双轨全量；
- B 站录制（nightly bfb37ff5，67 分片）重转：与旧产物**逐位字节一致**
  （fMP4 路径零回归），无 warn；
- `tests/test-media-remuxer.js` 66 例全绿（两轮共 +12 例）；回归
  record-duration 6、cache 34、task-registry 26、segment-sniff 5 全绿。

### 伴生问题（非本 bug，记录备查）

**录制 10 秒只录到 6 秒**：本次录制 meta.json `totalDuration=6`（3 个分片），
产物完整保留了全部已录数据，丢的 4 秒在录制引擎侧（疑为启动建链延迟——
清单拉取/首个分片落盘前的开播时间不计入）。与转封装无关，待单独排查。
