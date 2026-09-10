# Phase 45 — API Coverage Matrix

**Detector run (plan time):** `detected: false`（对 45-CONTEXT.md + ROADMAP phase scope 运行，2026-09-08）。本阶段为零新依赖的内部模块扩展（D-01 locked）；唯一外部 SDK 接触面是**既有依赖** mux.js 6.3.0 的新能力复用（Phase 44 已审已装，44-RESEARCH Package Legitimacy Audit verdict OK）。按「第二次集成同一需求从同一 full-coverage 基线出发」规则，对 mux.js 能力面记录减法决策如下：

| capability | decision | reason |
|---|---|---|
| `mp4.Transmuxer`（TS→fMP4 转封装） | INTEGRATE | Phase 44 已集成（44-05），本阶段零改动 |
| `mp4.probe.findBox`（box 探测） | INTEGRATE | 45-01 拼接产物终检（moov 存在 + moof 计数 ≥1） |
| `mp4.generator`（initSegment/moof/mdat） | INTEGRATE | 测试夹具生成（45-01/45-02/45-03 测试内联 helper），不进生产路径 |
| `mp4.probe.timescale/tracks/startTime` 等其余 probe 能力 | OPT-OUT | not needed——终检只断言 moov+moof 计数（RESEARCH Pitfall 9：不断言具体 track 数） |
| mp4box.js（ISOBMFF 完整库） | OPT-OUT | explicitly out of scope——D-01 零新依赖否决（RESEARCH Q3 评估杀鸡用牛刀） |
| ffmpeg / ffmpeg-static | OPT-OUT | explicitly out of scope——D-01 否决；纯 JS 拼接已经真实 B 站流实测可行（RESEARCH Q2），CONTEXT 重议分叉点已关闭 |
| B 站 getRoomPlayInfo API | OPT-OUT | not needed——仅 RESEARCH 调研期一次性取流使用；生产代码与自动化测试不打真实网络（Pitfall 7），真实流验证属 end-of-phase UAT 人工项 |
