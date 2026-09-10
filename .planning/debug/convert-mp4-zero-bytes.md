---
status: diagnosed
trigger: "G-44-7: https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8 缓存完成转录 mp4 还是0字节"
created: 2026-09-07T20:47:28+08:00
updated: 2026-09-07T21:05:00+08:00
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: diagnosed
---

## Current Focus

hypothesis: (已确认) 双因链：① 该源是 AES-128 加密 HLS（EXT-X-KEY METHOD=AES-128），缓存分片是密文，mux.js 无解密链路，转换永远不可能成功——44-13 嗅探正确拒绝并标记任务失败；② media-remuxer.js fail() 的 unlinkSync 与 createWriteStream 的异步 open 竞态：嗅探拒绝发生在同一同步 tick 内，此时 open() 还没执行，unlinkSync 抛 ENOENT 被静默吞掉，随后排队中的 open() 执行创建出 0 字节文件——0 字节半成品从每条「stream 创建后才失败」的路径泄漏
test: 最小复现脚本（真实 media-remuxer + 现场密文分片）→ REJECTED encrypted_stream 后文件存在且 0 字节，>>> 0-BYTE LEAK CONFIRMED
expecting: (已证实)
next_action: "find_root_cause_only —— 返回 ROOT CAUSE FOUND 给 plan-phase --gaps"
bug_class: Bohrbug（确定性复现）
goal: find_root_cause_only

## Symptoms

expected: 缓存完成后点「转换为 MP4」，产物为可播放的非 0 字节 mp4；不可转格式应显式报错且不留 0 字节半成品
actual: 缓存抽屉显示缓存完成，转换后产物 mp4 为 0 字节
errors: 任务页实际显示「MP4 转换失败：分片为加密数据，暂不支持转换」（44-13 修复后）；但 Downloads 留下 0 字节 mp4 文件，用户以「0 字节产物」感知失败
reproduction: 播放 https://hn.bfvvs.com/play/b2k7JoJd/index.m3u8（VOD，AES-128）→ 缓存完成 → 转换为 MP4 → 保存 → 0 字节文件残留
started: 上一轮已出现（9/6 23:25、9/7 00:26 两条 completed+0 字节历史任务），44-13 修复后仍复现（9/7 20:14：任务 failed encrypted_stream + 0 字节文件残留）

## Eliminated

- hypothesis: 「任务状态机把失败任务标成 completed」（debug_context 假设 2/3）
  evidence: media-tasks.json 现场记录——bfvvs 两次 44-13 前转换（996441db/3da03d03）确为 completed（当时无 empty_output 终检），但 44-13 后的 fa53643f 正确落 failed + encrypted_stream 文案；状态机无缺陷
  timestamp: 2026-09-07T20:58
- hypothesis: 「showSaveDialog 占位文件/产物路径不一致」（debug_context 假设 1/4）
  evidence: 复现证明 0 字节文件由 convertToMp4 自己的 createWriteStream 在 fail() 之后异步创建，路径即 savePath，与任务记录 outputPath 一致（da1864c9 等正常 completed 任务同路径机制写出非 0 文件）
  timestamp: 2026-09-07T21:02

## Evidence

- timestamp: 2026-09-07T20:52
  checked: dev userData media-cache 现场条目 5a61ed254379c9e7（m3u8_url=bfvvs/b2k7JoJd）
  found: meta.segments 53 个「分片」中混入 16 字节 ASCII 文件（Qhm1fP5RqZPC4wCD，contentType application/octet-stream）= EXT-X-KEY 的 enc.key 本体被当成分片缓存；playlist_order 52 ≠ segs 53 → 顺序索引回退 stored_at 序
  implication: 源为 AES-128 加密；缓存层把 key 请求误分类为分片（次要数据质量问题，导致完整性误判与顺序回退）
- timestamp: 2026-09-07T20:53
  checked: 全部 52 个真实分片首字节 + 首个存储分片（9d5b1c7f）熵采样
  found: 无一分片以 0x47 开头（密文特征）；首片前 4KB 不同字节值 256 ≥ 阈值 240 → 嗅探必然落 encrypted_stream 拒绝
  implication: 该源转换注定失败，44-13 嗅探行为符合设计
- timestamp: 2026-09-07T20:54
  checked: curl 源 m3u8
  found: #EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x0…0；VOD 52 片
  implication: 确证 AES-128 加密源；缓存的是解密前密文（网络层拦截），mux.js 无解密链路
- timestamp: 2026-09-07T20:56
  checked: dev media-tasks.json 全部 convert 任务 + ~/Downloads 产物文件大小对照
  found: bfvvs 历史 2 任务（9/6 23:25、9/7 00:26）completed 且对应文件 0 字节（44-13 前无终检）；今日 20:14 fa53643f failed「分片为加密数据」但 Downloads「未命名 2026-09-07 2014.mp4」仍为 0 字节；同期正常源（scte35）completed 产物 1.4M/1.9M/114M 非零
  implication: 44-13 后失败路径仍泄漏 0 字节文件——泄漏点在 remuxer 内部而非状态机
- timestamp: 2026-09-07T21:02
  checked: 最小复现脚本 /tmp/repro-zero-byte.js（真实 media-remuxer.convertToMp4 + 现场密文分片）
  found: REJECTED encrypted_stream 后 100ms 检查：文件存在且 0 字节 → 0-BYTE LEAK CONFIRMED
  implication: 机制确证：convertToMp4 同步执行体内 createWriteStream(outputPath) 的新建 open()（O_CREAT）经 nextTick 排队尚未执行 → 嗅探拒绝 → fail() 同步 unlinkSync 抛 ENOENT 被 catch 静默吞掉 → 随后事件循环执行排队的 open() 创建 0 字节文件；stream.destroy() 在 open 完成前调用无法取消已入 libuv 队列的 open 系统调用

## Resolution

root_cause: 双因链（AND）：①【格式层】hn.bfvvs.com/play/b2k7JoJd 是 AES-128 加密 HLS（#EXT-X-KEY METHOD=AES-128），缓存分片为解密前密文，mux.js 无解密链路，转换对该源永远不可能成功——44-13 嗅探正确拒绝、任务落 failed；②【泄漏层·用户看到的 0 字节】media-remuxer.js convertToMp4 在 sniff 检查点之前已执行 fs.createWriteStream(outputPath)，其异步 open()（O_CREAT）经 nextTick 排队；嗅探拒绝后 fail() 在同一同步 tick 内调 fs.unlinkSync(outputPath)，此时文件尚未创建 → ENOENT 被 `catch { /* 文件可能未创建 */ }` 静默吞掉 → 事件循环随后执行排队的 open() 创建出 0 字节文件且无人再清理。凡「stream 创建后、首条 data 写盘前」失败（encrypted_stream/unsupported_container/cancelled/早期 transmux 异常）均触发此泄漏。次要共因：缓存层把 enc.key（16 字节）误分类为分片落库，致 segs(53)>total(52)、playlist_order 失配回退 stored_at 序
fix: （未实施——plan-phase --gaps 处理）
verification: 最小复现 100% 稳定（真实代码 + 现场密文分片）
files_changed: []
