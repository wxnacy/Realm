# Phase 44: 播放器视频缓存与本地媒体库 - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

独立播放器的 HLS 本地媒体库能力，本阶段交付：

1. **独立窗口 proxy 收口** — 独立播放窗口改从 localhost 加载 player 页面（注入 token），hls.js 请求统一走 `/proxy`
2. **分片级磁盘缓存** — `/proxy` 层对播放器窗口流量落盘：按视频组织目录（segments + 元数据），重开秒开、不重复请求；设置页可配缓存目录/容量（默认 10GB）
3. **观看历史式精确续播** — 缓存库条目 + 独立观看历史记录双层，重开同一视频 seek 到上次位置
4. **直播录制** — 播放器工具栏录制按钮，显式后台任务（media-task-manager 注册表），停止后自动转 mp4
5. **mp4 转封装** — mux.js 纯 JS（TS→fMP4），showSaveDialog 弹框选产物目录，后台转换
6. **统一媒体任务中心** — media-task-manager（录制+转码统一注册表）+ `realm://tasks` 任务页 + 设置页多媒体分区入口 + 主窗口角标
7. **播放器抽屉列表** — 本地可看视频列表（缓存库 + 观看历史）

**明确不包含**：webview tab 模式（m3u8 导航拦截打开的播放器页）保持现状直连，不做缓存；FLV/DASH 格式；mp4 直链（native）缓存；播放列表内视频下载管理之外的其他下载功能。

</domain>

<decisions>
## Implementation Decisions

### 架构收口（2026-09-06 方案讨论定稿）

- **D-01:** 缓存能力只在独立播放器窗口；webview tab 模式保持现状直连不做缓存 — **Reversibility:** reversible — 后续想扩展到 webview 只需让 webview 流量也带 cache 标记
- **D-02:** 独立播放窗口改从 localhost 加载 player 页面（不再 file://），注入 token，hls.js 请求统一走 `/proxy` — 顺带解决独立窗口防盗链/Cookie 隐患；两种模式数据流统一
- **D-03:** 缓存层挂主进程 `/proxy`（main.js handleProxyRequest），仅对带 cache 标记的播放器流量落盘，webview 流量保持透传 — **Reversibility:** costly — 缓存目录结构与元数据格式落盘后，改动需要迁移已有缓存
- **D-04:** mp4 转封装用 **mux.js 纯 JS**（TS→fMP4），不用 ffmpeg-static — 避免原生二进制打包风险（参考 nodejieba 事故，asarUnpack + 发布实机验证成本）

### 缓存与淘汰（本次讨论）

- **D-05:** 缓存目录按视频组织：`<缓存目录>/<视频ID>/segments/` + 元数据（m3u8 地址、标题、分片索引、总大小、最后播放进度/时间）；默认缓存目录在 userData 下（三环境隔离自动生效），设置页可改
- **D-06:** 默认容量上限 **10GB**（设置页可改）
- **D-07:** 淘汰策略：按**最后观看时间** FIFO（最久没看的先删），按视频粒度整目录删除；正在缓存/录制的视频（活跃任务）**豁免**淘汰，任务结束后下一轮淘汰生效
- **D-08:** 磁盘满时：写盘失败先触发一轮强制淘汰（豁免规则仍生效）腾空间重试，仍失败则任务失败并在任务页标明原因
- **D-09:** 分片完整性：写盘时记录大小/哈希，读取时校验失败即删该分片回源重拉，播放不中断
- **D-10:** 未缓存完整的视频重开后**增量续存**——播放到哪补到哪，不推倒重来；断网/源站失效时已缓存分片照播，未缓存分片重试后报错并提示「已缓存部分可看」

### 观看历史与续播（本次讨论）

- **D-11:** 双层设计——缓存库条目（随淘汰消失）+ 独立观看历史记录（纯记录，很小，不随淘汰消失）；历史记录含 { 标准化URL, 标题, 最后位置/时长, 观看时间 }
- **D-12:** 续播匹配 key = `origin + pathname`（query 带时效 token 不参与匹配），原 URL 存记录里供命中缓存；`loadedmetadata` 后 seek 到上次位置（复用 refreshCurrent 的 resume 模式，player.js:627）
- **D-13:** 进度上报：渲染进程节流写（每 5 秒 + 暂停/关窗时），IPC 给主进程更新元数据

### 抽屉列表交互（本次讨论）

- **D-14:** 条目信息：精简（标题 + 续播进度条 + 缓存大小）+ 完整度百分比
- **D-15:** 排序：最近观看优先
- **D-16:** 删除：hover 条目显示删除按钮
- **D-17:** 仅分片齐全的视频可转 mp4（录制中断例外——已录部分照常转，见 D-22）

### 直播录制（本次讨论）

- **D-18:** 录制 = 显式后台任务，主进程 player-record-manager（并入 media-task-manager）：并发上限、同 URL 去重（已在录则拒绝）、网络错误重试 N 次后停录、任务注册表持久化（崩溃重启标记「已中断」，已落盘分片仍可转 mp4）
- **D-19:** 关播放器窗口时弹一次「继续后台录制 / 停止并保存」，记住选择作为默认；应用退出有活跃任务时弹确认
- **D-20:** 录制与播放状态**完全解耦**——播放/暂停/刷新/切视频均不影响录制（任务在主进程独立追分片，按 URL+媒体序列号去重落盘）；播放器内红点可点击停止，任务页也有停止按钮
- **D-21:** 录制从直播边缘开始（历史分片不回溯），录制中自动追新分片直到停止；播放器内展示红点闪烁 + 已录时长，hover 显示已录大小
- **D-22:** 停止录制后**自动**派生转码任务（completed → convert 接力），产物命名「标题 + 时间戳」（如「直播间标题 2026-09-06 1430.mp4」），同名追加序号
- **D-23:** 录制中自动追分片写盘与缓存共用分片存储格式，但录制目录独立于缓存库（不受容量淘汰影响，产物由用户弹框选目录落盘）

### mp4 产物与任务中心（方案讨论定稿）

- **D-24:** mp4 产物 `dialog.showSaveDialog` 弹框选目录（默认下载目录或 last-used，记住选择），转换放后台任务，完成后系统通知 + `shell.showItemInFolder`
- **D-25:** media-task-manager 统一注册表：`{ type: 'record' | 'convert', title, containerId, status: running|completed|failed|cancelled|interrupted, progress, 产物路径, 时间戳 }`，主进程持久化
- **D-26:** `realm://tasks` 任务页（新内部页面，与 downloads/history 同构）：进行中（进度+停止/取消）、已完成（产物定位）、失败/已中断（原因 + 已落盘部分续转）；入口 = 设置页多媒体分区「任务列表」按钮；主窗口角标（有活跃任务时）被动提醒，点击跳任务页；任务完成发系统通知（Electron Notification）

### Claude's Discretion

- 缓存分片命中/回源的 HTTP 语义细节（Range 透传、content-type 转发、m3u8 短 TTL 策略）
- 视频ID 的生成规则（m3u8 origin+pathname 哈希即可）
- 分片哈希算法选择与校验时机（写盘时算 or 后台校验）
- mux.js 转封装的具体调用方式、失败重试策略
- 抽屉/任务页的具体样式（遵循项目现有暗色风格与弹框居中约定）
- 设置页「缓存目录/容量」分区的布局与校验
- 独立窗口创建链路的改造细节（token 注入方式）
- 进度节流的具体实现（合并写、防抖）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 方案讨论定稿（本阶段最高优先）
- `.planning/ROADMAP.md` §Phase 44 Goal — 方案骨架与全部定稿决策的权威记录
- 本文件 `<decisions>` 节 — 2026-09-06 两轮讨论（方案 + 灰区）的完整决策

### 现有代码（集成点）
- `main.js` §handleProxyRequest（约 :277）— /proxy 代理实现，缓存层挂载点；`rewriteM3u8ForProxy`（:234）m3u8 重写
- `src/player.js` — 播放器核心（双模式检测 :263、proxiedUrl :272、refreshCurrent resume 模式 :627、initPlayer 引擎分支 :115）
- `src/player.html` — 播放器 UI 结构（工具栏按钮、CSP 策略）
- `main.js` §独立窗口创建链路 — 独立播放窗口 file:// 加载处（D-02 改造点）
- `AGENTS.md` — 项目现行约定（弹框居中、realm:// CSP、导航入口、三环境 userData）

### 项目模式参照
- download-manager 相关模块 — 后台任务/进度/通知的既有模式（D-18 任务管理器参照）
- `src/settings-page.js` + `src/settings.html` — 设置页分区布局惯例（多媒体分区入口）
- `.planning/phases/43-ai-mvp/43-CONTEXT.md` — realm:// 内部页面 + /api/* + token 鉴权模式的最近先例

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`/proxy` 代理（main.js）** — 已有 ses.fetch + Referer/Cookie/容器 session 逻辑，缓存分支直接挂这里，播放器零改动受益
- **`rewriteM3u8ForProxy`** — m3u8 重写已覆盖分片/密钥/子清单回指代理，缓存命中判断可按改写后 URL 做 key
- **refreshCurrent 的 resume 模式（player.js:627）** — loadedmetadata once + currentTime 恢复，D-12 续播直接复用
- **realm:// 内部页面模式 + /api/* token 鉴权** — realm://tasks 页与设置页数据源直接套用

### Established Patterns
- **双模式播放器（isWebviewMode）** — D-02 收口后独立窗口与 webview 同为 localhost 源，proxiedUrl 逻辑可简化
- **后台任务 + 系统通知 + 角标** — download-manager 先例
- **暗色主题 + hover 交互** — 抽屉列表/任务页样式遵循现有控制栏风格

### Integration Points
- `main.js` handleProxyRequest — 缓存读写、cache 标记分发
- 独立窗口创建链路（main.js）— localhost 化 + token 注入
- `src/player.js` — 工具栏录制按钮、抽屉面板、进度节流上报、录制红点
- `src/settings-page.js/.html` — 多媒体分区（缓存目录/容量 + 任务列表入口）
- 主窗口 index.html/renderer.js — 任务角标

</code_context>

<specifics>
## Specific Ideas

- 重开秒开的完整链路：重开视频 → 元数据读最后进度 → loadedmetadata seek → 分片命中缓存秒开，四步串起来是本阶段核心体验
- 「已缓存部分可看」的降级提示：断网时不是白屏报错，明确告诉用户能看多少
- 录制红点 hover 显示已录大小——不可知问题的播放器内答案
- 任务页对失败/中断任务展示原因 + 「已落盘部分仍可转 mp4」操作，崩溃不白录

</specifics>

<deferred>
## Deferred Ideas

- FLV/DASH 格式的缓存与录制 — Phase 28 DASH 播放 gap 修复后再议
- mp4 直链（native）缓存 — 整文件落盘 + 本地 Range 服务，二期
- webview tab 模式缓存扩展 — 若独立窗口模式验证成功且用户有需求
- 观看历史跨设备同步 / 导入导出 — 远期

</deferred>

---

*Phase: 44-播放器视频缓存与本地媒体库*
*Context gathered: 2026-09-06*
