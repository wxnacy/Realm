# 录制源取到 master playlist → 0 分片空转至 token 过期才失败（Twitch usher）

> 2026-09-13 · Realm Browser（正式环境实测）· 影响文件：`media-record-engine.js` / `media-m3u8-parser.js` / `src/player.js`
> **状态：未修复**（用户 2026-09-13 决定不做修改，本文档供后续接手者定位）

## 现象

Twitch 直播间录制启动后**看起来在正常跑**：任务页显示 `running`、无报错、红点点亮，
但 `segments/` 目录**一个分片都不落**，进度恒为 0。一直空转到源 URL 里的 token 过期
（约 20 分钟），才突然变成 `failed / network`。此时直播内容已经过去，**数据 0 字节，不可救**。

对用户而言最糟的是「失败来得极晚且原因误导」：报的是 `network`（像是断网），
实际是源 URL 形态不对，从第一秒起就没可能录到东西。

## 结论（根因）

录制拿到的源是 **多码率 master playlist**（Twitch 的
`https://usher.ttvnw.net/api/v2/channel/hls/<channel>.m3u8?...token=...`），
它只含 `EXT-X-STREAM-INF` 变体条目，**本身不含任何分片（无 EXTINF）**。

`media-record-engine.js` 的轮询循环假设输入就是 media playlist：

| 环节 | 代码 | master playlist 下的行为 |
|------|------|------|
| 清单解析 | `media-m3u8-parser.js:38 parsePlaylist` | 不识别 `EXT-X-STREAM-INF`，无 variants 输出；`segments: []`、`ended: false`、`targetDuration` 取默认 6（`DEFAULT_TARGET_DURATION = 6`，与 `st.targetDuration` 初值同值，无法据此区分） |
| 首轮起点 | `media-record-engine.js:357 firstRoundStartIndex(pl.segments)` | 空数组 → 返回 -1 → 基线循环与下载循环都不执行 |
| 追新下载 | `media-record-engine.js:361 for (const seg of pl.segments)` | 空数组，一轮也不下载 |
| VOD 转正 | `if (pl.ended)` | master 无 `EXT-X-ENDLIST` → 永不 complete |
| 轮询间隔 | `computePollIntervalMs(6, 0)` | `max(2000, min(6,6)*1000)` = 6s → 每 6 秒白拉一次清单 |

于是进入「拉清单 → 空 → 等 6s」的死循环。等到 token `expires` 时刻，Twitch 对 usher
请求返回 403，`fetchPage`（`main.js:3027`，`if (!resp.ok) throw new Error('HTTP ' + status)`）
抛错 → `catch` → `consecutiveFailures++` → 达 `maxRetries: 5`（`main.js:3033`）
→ `failTask(st.taskId, 'network')`。空转时长 = token 有效期剩余时间。

## 判别签名（复发时先看这四条）

1. `media-tasks.json` 里 `type: record` 且 `status: failed`、`error: "network"`、
   `progress: 0`、`outputPath: null`；
2. `media-records/<taskId>/segments/` **空目录**，meta.json 里
   `segments: []`、`totalDuration: 0`、`totalSize: 0`、`targetDuration: 6`（默认值未被覆盖）；
3. meta.json 的 `url` / 任务 `playbackKey` 是 **usher 域名且 path 以 `/api/v2/channel/hls/<channel>.m3u8` 结尾**
   （playbackKey = `origin + pathname`，query 被剥掉，所以只看这一串即可）；
4. 任务的 `updatedAt`（失败时刻）**紧邻 token expires**——usher URL query 里的
   `token=` 是 URL 编码的 JSON，内含 `"expires": <unix 秒>`；解码后与 `updatedAt` 相差
   几十秒到 1 分钟内即可定性。

## 实测数据（正式环境，2026-09-13）

| 任务 | 时间 | playbackKey | 结果 |
|------|------|-------------|------|
| `3a0ca226` | 15:21:12 → 15:41:13 | `usher.ttvnw.net/api/v2/channel/hls/lck_carry.m3u8` | failed / network，**0 分片**，token `expires` = 1789285254（15:40:54，失败前 19s） |
| `7519e192` | 16:15:35 起 | 同上 | running 但 16:28 复查 **仍 0 分片**（13 分钟），同型空转 |
| `e2da4f29`（对照·成功） | 14:16:29 → 15:06:38 | `apn11.playlist.ttvnw.net/v1/playlist/<token>.m3u8` | completed，1491 个 ts / 2.2GB |

正常节奏参照：Twitch 分片 EXTINF ≈ 2s，13 分钟应有 300+ 个文件。**起录后 30 秒内
segments 目录仍为空，即可判定失败**（TS 形态首个分片通常在首轮轮询就落盘）。

## 为什么这次会拿到 master playlist

录制入口是独立播放器窗口：`src/player.js:883` 用 `state.currentUrl` 发起
`player:record/start`，而 `state.currentUrl`（`src/player.js:158`）就是**用户在媒体
嗅探面板里选中的那条 URL**。Twitch 页面加载时最先请求的就是 usher master，嗅探列表里
会同时存在 master 与后续实际播放的 `*.playlist.ttvnw.net/v1/playlist/<token>.m3u8` 条目
（本次两条的标题也不同：master 那条是 `lck_carry - Twitch`，media playlist 那条是
`LCK_Carry - Twitch`）。hls.js 能播 master（它自己选 variant），但录制引擎不会，
于是「面板里能播」≠「能录」。

## 修复方向（三选一或组合）

**A. 引擎侧支持 master（完整解）**——`media-m3u8-parser.js` 解析 `EXT-X-STREAM-INF`
并输出 `variants[]`，`pollLoop` 首轮检测到 master 就按策略选一条 variant
（带宽最高 / 首个 / 可配置）并把 `st.url` 切到它，再走既有 media playlist 流程。
注意点：
- `st.url` 切换后 `resolveUri`（分片相对 URI 基准）与 `playbackKey`（D-18 去重、
  `isVideoActive` 豁免）都要跟着更新或明确保持原值，避免去重/淘汰语义漂移；
- master 里 variant URL 同样带 token，过期后需要重新拉 master 换 variant；
- 首轮起点策略 `firstRoundStartIndex` 在切换后才有意义。

**B. 入口侧早拒（最小改动，推荐至少做这层）**——`startRecord` 前先拉一次清单，
检测到 `EXT-X-STREAM-INF` 即返回结构化拒绝（如 `reason: 'master_playlist'`），
UI 提示「该源为多码率索引，请从实际播放的清晰度源录制」。把 20 分钟空转变成
即时反馈，即使不做 A 也不会再出现「录了半小时才发现是空的」。

**C. 嗅探/入口侧优选 media playlist**——让可录条目优先给 media playlist（或给
master 条目打「不可录」标记）。需评估是否所有站点都能抓到 media playlist，
否则会把「只有 master」的站点变成完全不能录。

建议：**B 打底 + A 完整支持**，两者不冲突。

## 复现与验证

1. 打开 Twitch 直播间，等嗅探列表出现条目；
2. 选 `usher.ttvnw.net/.../lck_carry.m3u8` 那条进播放器并点录制；
3. 观察 `userData/media-records/<taskId>/segments/` —— 修复前应 30s 内仍为空，
   修复后（A）应开始出现 `0000xxxx.ts`；（B）应在点录制时即被拒绝并给出提示。

回归测试建议加在 `tests/test-media-record-*.js`（引擎去 Electron 化，可纯 Node 注入
`fetchPage`）：master playlist 文本作为 `fetchPage` 返回值，断言要么选 variant 后有分片
落盘（A），要么 `startRecord` 返回明确 reason 且**不进入轮询循环**（B）。

## 相关

- 证据与产物路径（正式环境）：`~/Library/Application Support/realm/media-tasks.json`、
  `~/Library/Application Support/realm/media-records/<taskId>/{meta.json,segments/}`
- 同类「录制看起来成功、产物却坏」的排查：
  [live-record-poison-segment-truncated-mp4.md](live-record-poison-segment-truncated-mp4.md)、
  [twitch-record-avfoundation-hang-audio-first-moof.md](twitch-record-avfoundation-hang-audio-first-moof.md)
- 另有一个独立问题（未修）：应用内转码大素材会产出精确 4294967296 字节（2³²）的截断坏文件，
  任务状态却显示 completed，详见 `project_remux_4gb_truncation` 记忆条目。
