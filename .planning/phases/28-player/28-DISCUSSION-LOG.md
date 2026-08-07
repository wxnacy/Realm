# Phase 28: 播放器窗口 - Discussion Log

**Date:** 2026-08-07
**Mode:** default (interactive)

## Area 1: 播放器 UI 风格

| Question | Options | Selection |
|----------|---------|-----------|
| 视觉风格 | 沉浸式暗色 / 统一主题色 / 毛玻璃效果 | 沉浸式暗色 |
| 控件布局 | 底部单行 / 底部左右分组 / 双层底部 | 底部左右分组 |
| 控件显隐 | 自动隐藏 / 始终显示 / 覆盖不隐藏 | 自动隐藏 |
| 窗口 Chrome | 无边框窗口 / 保留原生标题栏 / 混合模式 | 无边框窗口 |

## Area 2: 格式检测与库选择

| Question | Options | Selection |
|----------|---------|-----------|
| 格式检测 | URL 后缀匹配 / URL+Content-Type / 文件头嗅探 | URL 后缀优先+Content-Type 回退 |
| HLS 方案 | hls.js / Chromium 原生 / Shaka Player | hls.js |
| FLV 方案 | mpegts.js / 不单独处理 / flv.js(已停维) | mpegts.js |
| DASH 支持 | 不支持 DASH / 增加 dash.js / Shaka 统一 | 增加 dash.js |

## Area 3: 控制栏功能细节

| Question | Options | Selection |
|----------|---------|-----------|
| 进度条 | 进度条+时间预览 / 进度条+缩略图 / 纯进度条 | 进度条+时间预览 |
| 键盘快捷键 | 标准快捷键 / 无 / 最简 | 标准快捷键 |
| 额外功能 | 双击全屏 / PiP / 拖拽预览 / 仅基础 | 双击全屏+PiP+拖拽预览 |
| 播放列表 | 单视频 / 列表+上/下一首 | 播放列表+上/下一首 |

## Area 4: 窗口行为与生命周期

| Question | Options | Selection |
|----------|---------|-----------|
| 窗口尺寸 | 16:9 默认 / 跟随视频 / 记忆上次 | 16:9 默认 |
| 多窗口 | 允许多个 / 复用已有 / 关旧开新 | 复用已有窗口 |
| 资源释放 | 关闭即销毁 / 延迟 30 秒 | 关闭即销毁 |
| 容器隔离 | 跟随来源容器 / 独立空白 Session | 跟随来源容器 |

## Key Decisions Summary

- **UI:** 沉浸式暗色 + 底部左右分组 + 自动隐藏控件 + 无边框窗口
- **格式:** URL 后缀+Content-Type 回退 + hls.js + mpegts.js + dash.js (新增)
- **控制:** 进度条+时间预览 + 标准快捷键 + 双击全屏/PiP/拖拽预览 + 播放列表
- **窗口:** 16:9 默认 + 复用已有窗口 + 关闭即销毁 + 跟随来源容器

## Deferred Ideas

None

---
*Discussion completed: 2026-08-07*
