# Phase 45: B 站直播 fMP4 转录支持 - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

让录制/缓存的 fMP4 分片序列（init.mp4 + moof/mdat，B 站直播 HLS 流形态）可经既有 convert 任务管线转为可播放的 mp4 产物。当前 mux.js Transmuxer 仅支持 MPEG-TS 输入，fMP4 分片被 `sniffContainerFormat` 按设计拒转（`unsupported_container`）；且 `#EXT-X-MAP`（init 分片 URI）在全链路（parser / 录制引擎 / 缓存层）完全没有捕获——录制/缓存的 fMP4 会话连 init 分片都没存，拼接无从下手。来源：Phase 44 Deferred Follow-Up（44-UAT.md，用户 2026-09-06 拍板要做）。

</domain>

<decisions>
## Implementation Decisions

### 技术路线
- **D-01:** fMP4 转录走**纯 JS 拼接**——init.mp4 + moof/mdat 顺序拼接，产物为 fMP4（fragmented MP4）容器。零新依赖，延续 D-04（Phase 44）「不用 ffmpeg-static 避免原生二进制打包风险」原则。**不引 ffmpeg**，**不做 moof/trun 解析重打包常规 MP4**（自写半个转封装器，工作量/风险最高）。— **Reversibility:** costly — 拼接产物形态（fMP4 vs 常规 MP4）是用户可见产物契约，改路线意味着替换整个转封装模块与重测两链路；但代码本身边界清晰（独立模块），不涉及数据迁移
- **D-02:** 产物兼容性目标 = 「能看就行」（mpv/IINA/VLC/QuickTime 可播 fMP4）。用户明确产物不进剪映/PR 等剪辑软件，不需要常规 MP4 的完整 moov

### 覆盖范围
- **D-03:** 录制链路 + 缓存链路**两链路都覆盖**，共用 EXT-X-MAP 捕获与拼接模块；tracer 先走录制链路端到端（B 站直播录制 → 停止 → 转 MP4 可播），缓存链路 fMP4 VOD 条目转换随后
- **D-04:** 加密 fMP4（SAMPLE-AES / FairPlay 等）不支持——维持既有拒转语义（encrypted/encrypted_stream 文案链路不变），本阶段不扩展

### 实施层面（讨论中无分歧，直接锁定）
- **D-05:** `#EXT-X-MAP` 捕获是全链路前置：parser 增加 MAP URI 捕获；录制引擎下载 init 分片并写入分片索引（meta.json）；缓存层对 MAP URI 特殊处理（参照 44-18 key URI 先例：不污染 segments 完整性判定，但 init 文件必须留存可取）
- **D-06:** 拼接实现为独立模块/函数（不改动 mux.js TS 路径）；`sniffContainerFormat` 的 fMP4 拒转语义改为「分流」——fMP4 分片进入拼接分支而非直接失败。任务编排/进度/取消令牌/产物命名/通知全盘复用 Phase 44 convert 任务管线
- **D-07:** 完整性判定口径：init 分片不计入完整度分母（与 key URI 同类）；拼接顺序 = init.mp4 在前 + 分片按播放序

### Claude's Discretion
- init 分片在缓存/录制目录的具体存放形态（meta 同级文件 vs segments 特殊键）、拼接模块命名与文件归属、测试夹具构造方式——按 Phase 44 既有先例自行决定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 44 决策与现状（本阶段的直接地基）
- `.planning/phases/44-/44-CONTEXT.md` — D-04 mux.js 纯 JS 原则（本阶段 D-01 延续）、convert 任务管线设计
- `.planning/phases/44-/44-UAT.md` §Deferred Follow-Ups — 本阶段来源记录（两条候选路线原文）
- `.planning/debug/convert-mp4-zero-bytes.md` — G-44-7 双因链诊断（fMP4 拒转语义的由来）

### 规范
- RFC 8216 (HLS) §4.3.2.5 EXT-X-MAP、§4.3.4.1 fMP4 分片语义 — init 分片与 moof/mdat 序列的拼接依据（研究者联网查证）
- ISO/IEC 14496-12 (ISOBMFF) — fMP4 容器结构（init segment = ftyp+moov 空样本表；media segment = styp+moof+mdat）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `media-remuxer.js convertToMp4`：任务执行体骨架（同步 fd 产物创建/fail 清理/嗅探检查点/协作式取消/进度回调/empty_output 终检）——拼接分支可直接复用同一执行体契约
- `media-m3u8-parser.js parsePlaylist`：行级解析器，44-18 已扩 EXT-X-KEY（hasEncryption/keyUris/keyIv）——EXT-X-MAP 捕获同款加法
- `media-cache-manager.js updatePlaylistIndex/storeBuffer`：key URI 排除先例（meta.key_uris 登记 + storeBuffer O(1) 成员判定跳过）——MAP URI 处理可完全复刻此模式
- `main.js startConvertTask / startConvertFromInput`：convert 任务编排（弹框选目录/任务注册/取消令牌/CONVERT_FAIL_TEXT 文案映射）——零改动复用或极小扩展

### Established Patterns
- 附加 meta 字段向后兼容不升 META_VERSION（旧条目缺字段 = 该能力缺省关闭）
- 失败原因 reason → CONVERT_FAIL_TEXT 文案映射，新增 reason 必须同步补文案（有测试断言）
- 分片级完整性判定：playlist_order 与 segments 对齐才给 completeness=100

### Integration Points
- `sniffContainerFormat`（media-remuxer.js）：fMP4 box 特征（ftyp/styp/moof/moov/sidx）当前 → `unsupported_container` 拒转，本阶段改为分流入口
- 录制引擎 `media-record-engine.js`：轮询追分片落盘 + meta.json 索引——需增 init 分片下载与索引
- 缓存链路 `main.js /proxy` 分支 + `media-cache-manager.js`：MAP URI 请求经 rewriteM3u8ForProxy 重写后照常过 /proxy（URI="..." 属性重写已覆盖 EXT-X-MAP 行）

</code_context>

<specifics>
## Specific Ideas

- 用户痛点原话（44-UAT Round 2 test 3）：「B 站直播（fMP4 流）停止录制后任务页显示『MP4 转换失败：分片格式暂不支持转换（仅支持 MPEG-TS）』」——本阶段要让这个场景转出能看的 mp4
- B 站直播 HLS 流 = fMP4 分片（init.mp4 + .m4s），研究者需用真实 B 站直播流验证清单形态（EXT-X-MAP 是否存在/init 分片 URL 形态/m4s 是否单 moof+mdat）

</specifics>

<deferred>
## Deferred Ideas

- 常规 MP4 重打包（完整 moov）——仅当未来用户需要把产物导入剪辑软件时再立阶段（D-02 已明确当前不需要）
- ffmpeg 可选依赖兜底——D-01 已否决，除非纯 JS 拼接在真实 B 站流上被证明不可行（那是研究阶段的分叉点，需回报用户重议）
- 加密 fMP4（SAMPLE-AES/FairPlay）转录——D-04 维持拒转
- 44-REVIEW.md 技术债（WR-08 关窗诊断日志门控 / WR-09 300ms 窗口 playerClosing 检查 / IN-09~11）——不属本阶段范围

</deferred>

---

*Phase: 45-bilibili-fmp4-transcode*
*Context gathered: 2026-09-07*
