# Phase 44: 播放器视频缓存与本地媒体库 - Research

**Researched:** 2026-09-06
**Domain:** Electron 主进程 HTTP 代理层缓存 / HLS 分片存储 / mux.js TS→fMP4 转封装 / 后台任务中心 / realm:// 内部页面
**Confidence:** HIGH（集成点全部实读源码；唯一新依赖 mux.js 已过 registry + legitimacy 双重验证）

## Summary

本阶段在既有 `/proxy` 代理（main.js `handleProxyRequest`）上叠加四块能力：① 独立播放窗口从 `file://` 加载改为 localhost 加载（D-02），使 `player.js` 既有 `proxiedUrl` 链路自动生效；② `/proxy` 层按视频组织的分片磁盘缓存（D-03~D-10）；③ 双层观看历史与精确续播（D-11~D-13）；④ media-task-manager 统一注册表（直播录制 + mux.js 转封装）+ `realm://tasks` 任务页（D-18~D-26）。

代码侧集成点非常清晰：代理入口只有一个（`main.js:277 handleProxyRequest`），m3u8 重写已完备（`main.js:234 rewriteM3u8ForProxy`），独立窗口创建只有一处（`ipc-handlers.js:2040 loadFile`），续播 resume 模式可直接复用（`player.js:627 refreshCurrent`）。缓存层的正确挂法是**在 `handleProxyRequest` 内、`ses.fetch` 成功后按响应类型分流**：m3u8 短缓存/直通、分片命中读盘未命中落盘透传。

最大的两个工程风险点（planner 必须在任务里显式处理）：**(1) D-02 之后 `player.js` 的双模式判定语义变化**——独立窗口 localhost 化后 `isWebviewMode`（`player.js:263`）恒为 true，若复用 webview tab 模式的 `paramUrl` 分支会隐藏标题栏（`body.webview-player #title-bar`），必须引入模式区分信号；**(2) mux.js 转封装的时序连续性**——`Transmuxer` 实例跨分片保持解码时间轴，必须顺序 push 且先注册 `data` 监听再 push（README 原文警告），且须以单一实例流式写盘避免内存爆掉。

唯一新增运行时依赖 mux.js@6.3.0（videojs 官方，118 万周下载，纯 JS 无 postinstall）已通过 package-legitimacy seam 验证为 OK，无需 asarUnpack。

**Primary recommendation:** 缓存层做成独立模块 `media-cache-manager.js`（纯逻辑：索引/淘汰/校验可无 Electron 测试），`handleProxyRequest` 只加一个 ~30 行的分流钩子；录制与转封装走 `media-task-manager.js` 统一状态机；`player.js` 的模式判定改造放在最前（其他播放器功能都依赖它）。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 架构收口（2026-09-06 方案讨论定稿）

- **D-01:** 缓存能力只在独立播放器窗口；webview tab 模式保持现状直连不做缓存 — **Reversibility:** reversible — 后续想扩展到 webview 只需让 webview 流量也带 cache 标记
- **D-02:** 独立播放窗口改从 localhost 加载 player 页面（不再 file://），注入 token，hls.js 请求统一走 `/proxy` — 顺带解决独立窗口防盗链/Cookie 隐患；两种模式数据流统一
- **D-03:** 缓存层挂主进程 `/proxy`（main.js handleProxyRequest），仅对带 cache 标记的播放器流量落盘，webview 流量保持透传 — **Reversibility:** costly — 缓存目录结构与元数据格式落盘后，改动需要迁移已有缓存
- **D-04:** mp4 转封装用 **mux.js 纯 JS**（TS→fMP4），不用 ffmpeg-static — 避免原生二进制打包风险（参考 nodejieba 事故，asarUnpack + 发布实机验证成本）

#### 缓存与淘汰（本次讨论）

- **D-05:** 缓存目录按视频组织：`<缓存目录>/<视频ID>/segments/` + 元数据（m3u8 地址、标题、分片索引、总大小、最后播放进度/时间）；默认缓存目录在 userData 下（三环境隔离自动生效），设置页可改
- **D-06:** 默认容量上限 **10GB**（设置页可改）
- **D-07:** 淘汰策略：按**最后观看时间** FIFO（最久没看的先删），按视频粒度整目录删除；正在缓存/录制的视频（活跃任务）**豁免**淘汰，任务结束后下一轮淘汰生效
- **D-08:** 磁盘满时：写盘失败先触发一轮强制淘汰（豁免规则仍生效）腾空间重试，仍失败则任务失败并在任务页标明原因
- **D-09:** 分片完整性：写盘时记录大小/哈希，读取时校验失败即删该分片回源重拉，播放不中断
- **D-10:** 未缓存完整的视频重开后**增量续存**——播放到哪补到哪，不推倒重来；断网/源站失效时已缓存分片照播，未缓存分片重试后报错并提示「已缓存部分可看」

#### 观看历史与续播（本次讨论）

- **D-11:** 双层设计——缓存库条目（随淘汰消失）+ 独立观看历史记录（纯记录，很小，不随淘汰消失）；历史记录含 { 标准化URL, 标题, 最后位置/时长, 观看时间 }
- **D-12:** 续播匹配 key = `origin + pathname`（query 带时效 token 不参与匹配），原 URL 存记录里供命中缓存；`loadedmetadata` 后 seek 到上次位置（复用 refreshCurrent 的 resume 模式，player.js:627）
- **D-13:** 进度上报：渲染进程节流写（每 5 秒 + 暂停/关窗时），IPC 给主进程更新元数据

#### 抽屉列表交互（本次讨论）

- **D-14:** 条目信息：精简（标题 + 续播进度条 + 缓存大小）+ 完整度百分比
- **D-15:** 排序：最近观看优先
- **D-16:** 删除：hover 条目显示删除按钮
- **D-17:** 仅分片齐全的视频可转 mp4（录制中断例外——已录部分照常转，见 D-22）

#### 直播录制（本次讨论）

- **D-18:** 录制 = 显式后台任务，主进程 player-record-manager（并入 media-task-manager）：并发上限、同 URL 去重（已在录则拒绝）、网络错误重试 N 次后停录、任务注册表持久化（崩溃重启标记「已中断」，已落盘分片仍可转 mp4）
- **D-19:** 关播放器窗口时弹一次「继续后台录制 / 停止并保存」，记住选择作为默认；应用退出有活跃任务时弹确认
- **D-20:** 录制与播放状态**完全解耦**——播放/暂停/刷新/切视频均不影响录制（任务在主进程独立追分片，按 URL+媒体序列号去重落盘）；播放器内红点可点击停止，任务页也有停止按钮
- **D-21:** 录制从直播边缘开始（历史分片不回溯），录制中自动追新分片直到停止；播放器内展示红点闪烁 + 已录时长，hover 显示已录大小
- **D-22:** 停止录制后**自动**派生转码任务（completed → convert 接力），产物命名「标题 + 时间戳」（如「直播间标题 2026-09-06 1430.mp4」），同名追加序号
- **D-23:** 录制中自动追分片写盘与缓存共用分片存储格式，但录制目录独立于缓存库（不受容量淘汰影响，产物由用户弹框选目录落盘）

#### mp4 产物与任务中心（方案讨论定稿）

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

### Deferred Ideas (OUT OF SCOPE)

- FLV/DASH 格式的缓存与录制 — Phase 28 DASH 播放 gap 修复后再议
- mp4 直链（native）缓存 — 整文件落盘 + 本地 Range 服务，二期
- webview tab 模式缓存扩展 — 若独立窗口模式验证成功且用户有需求
- 观看历史跨设备同步 / 导入导出 — 远期
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| /proxy 缓存读写（分片落盘/命中/淘汰） | Main Process（HTTP server） | — | 唯一流量收口点 handleProxyRequest；渲染进程无感知 |
| m3u8 重写与短 TTL | Main Process | — | rewriteM3u8ForProxy 已存在，缓存分支在此扩展 |
| 独立窗口 localhost 化 + token 注入 | Main Process（media:play handler） | player.js 模式判定 | loadFile → loadURL 一处改动；player.js 需配合区分模式 |
| 续播 seek / 进度节流上报 | Renderer（player.js） | Main（IPC 落盘） | 播放状态在 renderer；主进程只持久化 |
| 直播录制追分片 | Main Process（media-task-manager） | — | 与播放解耦（D-20），主进程独立轮询 m3u8 |
| TS→fMP4 转封装 | Main Process（media-task-manager） | — | require('mux.js') CJS 直接可用，Node 侧写盘 |
| 抽屉列表 / 录制红点 UI | Renderer（player.js + player.css） | — | 播放器窗口自有 token 体系（UI-SPEC 双 token 约定） |
| realm://tasks 任务页 | Renderer（新 tasks-page.js） | Main（/api/tasks/* 端点） | 与 downloads/history 同构：realm:// → localhost + token |
| 设置页缓存分区 | Renderer（settings-page.js） | Main（configStore + dialog） | electron-store 即改即存惯例 |
| 主窗口角标 | Renderer（renderer.js） | Main（broadcast 推送） | 主窗口不 fetch HTTP（AGENTS.md），走 realmAPI IPC |
| 系统通知 | Main Process（Electron Notification） | — | 代码库现无 Notification 用例，属新引入 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hls.js | ^1.6.17（已装 1.6.17，最新 1.7.2） | HLS 拉流播放（既有） | 已是播放器引擎，缓存层对它透明 [VERIFIED: node_modules/hls.js/package.json + npm view] |
| mux.js | ^6.3.0（新增，唯一新依赖） | TS→fMP4 转封装（D-04 定稿） | videojs 官方库，1,178,431 周下载，CJS 入口 `./cjs/index.js` 可主进程直接 require，纯 JS 无原生模块 [VERIFIED: npm registry + package-legitimacy seam] |
| electron-store（configStore） | ^8.1.0（已装） | 缓存目录/容量/关窗默认选择设置项 | 项目既有配置存储惯例（main.js:112） |
| better-sqlite3 | ^13.0.2（已装） | 观看历史记录（D-11，若选 SQLite 方案） | 项目数据层惯例（history/favorites/downloads 同款） |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | 内置 | 视频 ID 生成（sha256(origin+pathname)）、分片哈希校验（D-09） | 全程，零依赖 |
| Electron Notification / dialog / shell | Electron 43 内置 | D-24/D-26 通知与产物定位 | 无需安装 |
| Node http/fs（既有 realmServer） | — | 缓存读写与 /api/tasks 端点 | 既有服务器扩展 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mux.js | ffmpeg-static | D-04 已否决：原生二进制 asarUnpack + 发布实机验证成本（nodejieba 事故） |
| 手写 m3u8 解析库（hls-parser npm） | 手写 ~40 行行解析器 | 推荐**手写最小解析器**：项目已有先例（rewriteM3u8ForProxy 就是行级 split），录制只需要 MEDIA-SEQUENCE/TARGETDURATION/分片 URI/ENDLIST 四个标签，引依赖不值 |
| SQLite 观看历史 | electron-store JSON | 记录需按观看时间排序 + 按 key upsert，SQLite 更稳；但记录量极小，JSON 亦可——planner 定夺，两方案都不违规 |

**Installation:**
```bash
npm install mux.js@^6.3.0
```

**Version verification:** `npm view mux.js version` → 6.3.0（2026-08-26 modified）；`npm view hls.js version` → 1.7.2（项目锁 ^1.6.17，无需升级，本阶段不触碰 hls.js 升级）。

## Package Legitimacy Audit

> 已运行 `gsd_run query package-legitimacy check --ecosystem npm mux.js`（2026-09-06）。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| mux.js | npm | 10+ yrs（首版 2015-10-22，最新 6.3.0 发布 2023-02） | 1,178,431/wk | github.com/videojs/mux.js | OK | Approved（postinstall: null，无原生模块） |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*无其他新增依赖。播放器 UMD 加载链（player.html 引 hls.js/mpegts.js/dashjs）不变，mux.js 只在主进程 `require` 使用，不进 renderer，不触发 asarUnpack。*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── 播放器窗口（独立窗口，D-02 localhost 化）───────────────────────────┐
│  player.html (http://localhost:PORT/player/?url=…&token=…&container=…&mode=independent)      │
│  player.js：initPlayer → hls.loadSource(proxiedUrl(url))                                      │
│  工具栏：录制按钮 / 抽屉列表按钮 │ 红点（录制中）│ 进度节流上报（5s + 暂停/关窗，D-13）│
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │ XHR（同源）
                                               ▼
┌────────────────────────────── 主进程 realmServer（127.0.0.1:随机端口）─────────────────────────┐
│  /proxy?token&url&container&referer&cache=1                                                    │
│    handleProxyRequest（main.js:277）                                                            │
│      ├─ token 校验（main.js:279）                                                               │
│      ├─ m3u8 响应 → 短 TTL 缓存 + rewriteM3u8ForProxy（main.js:234）→ 回写                       │
│      └─ 分片响应 ──► media-cache-manager.js ──┬─ 命中：读盘（校验大小/哈希，D-09）→ 206/200      │
│                                               └─ 未命中：ses.fetch 回源 → 落盘 + 流式透传        │
│                                                    └─ 写盘失败 → 强制淘汰重试（D-08）            │
│  /api/tasks/* （token 鉴权）◄── realm://tasks 页                                                │
│  media-task-manager.js（持久化注册表，D-25）                                                    │
│    ├─ record 任务：轮询直播 m3u8 → 追新分片（MEDIA-SEQUENCE 去重）→ 录制目录（D-23）             │
│    └─ convert 任务：mux.js Transmuxer 顺序转封装 → showSaveDialog 产物路径（D-24）               │
│  player-history-manager（观看历史，D-11，不随淘汰消失）                                          │
│  淘汰器：按最后观看 FIFO、视频粒度整删、活跃任务豁免（D-07）                                      │
└───────────────┬──────────────────────────────────────────────┬────────────────────────────────┘
                │ IPC（realmAPI/playerAPI）                     │ Notification + shell.showItemInFolder
                ▼                                               ▼
   主窗口角标（renderer.js，realmAPI IPC）                        系统通知（D-24/D-26）
```

主用例追踪（重开秒开）：抽屉条目点击 → 关抽屉 → initPlayer(原URL) → 主进程读观看历史最后进度 → loadedmetadata seek（D-12，复用 player.js:627 模式）→ hls.js 请求分片 → /proxy 命中缓存读盘 → 秒开。

### Recommended Project Structure

```
main.js                      # handleProxyRequest 加缓存分流钩子；before-quit 扩展活跃任务确认（D-19）
media-cache-manager.js       # 新增：缓存索引/读写/校验/淘汰（纯逻辑，可无 Electron 测试）
media-task-manager.js        # 新增：record+convert 统一注册表（D-25），持久化 + 事件广播
media-record-engine.js       # 新增（可并入 task-manager）：直播 m3u8 轮询追分片
media-remuxer.js             # 新增（可并入 task-manager）：mux.js TS→fMP4 封装
player-history-manager.js    # 新增：观看历史（D-11），upsert by origin+pathname
ipc-handlers.js              # media:play 改 loadURL（D-02）；player:record/start-stop；player:progress 等
src/tasks.html + tasks-page.js  # 新增：realm://tasks（与 downloads 同构）
src/player.js                # 模式判定改造、录制按钮/红点、抽屉、进度上报、关窗确认
src/player.css               # 抽屉/红点样式（--player- token，UI-SPEC）
src/settings.html/.js        # 多媒体分区：缓存目录/容量 + 任务列表入口
src/preload.js               # playerAPI/realmAPI 新通道
tests/test-media-cache.js    # 新增：索引/淘汰/校验纯逻辑测试（见 Validation Architecture）
```

### Pattern 1: /proxy 缓存分流钩子（挂载点语义）

**What:** 在 `handleProxyRequest` 的 m3u8 分支与流式透传分支之间插入缓存判断；仅当请求带 cache 标记（D-01：独立窗口流量）时启用。
**When to use:** 所有缓存读写都在这里收口，webview tab 流量不带标记零改动（D-01/D-03）。
**Example:**

```js
// main.js handleProxyRequest 内（示意，基于既有代码 main.js:322-356 结构）
const cacheEnabled = reqUrl.searchParams.get('cache') === '1';
if (resp.ok && isM3u8) {
  // 既有重写逻辑不变（main.js:332-338）；可另存原始 text 供短 TTL 缓存
  // ...
}
// 分片/密钥：非 Range 请求才可整段落盘（Range 请求走既有透传或读盘切片）
if (cacheEnabled && resp.ok && !isM3u8) {
  const hit = await mediaCache.lookup(finalUrl);   // key = 重定向后最终 URL
  if (hit) { /* 读盘响应（D-09 校验失败则删片回源） */ }
  else { /* Readable.fromWeb(resp.body) tee：一边 pipe 给 res，一边写盘 */ }
}
```

### Pattern 2: 统一内部页面三件套（realm://tasks）

**What:** 新内部页面 = 路由映射（main.js:2421-2464 惯例）+ `/api/*` token 端点 + renderer `realmUrlToHttp` 转换（renderer.js:350）。
**When to use:** tasks 页完整套用；数据端点全部 `token` 校验（与 main.js:279 同款）。
**Example:**

```js
// main.js 服务器路由（加在 /downloads 分支之后，照抄结构）
} else if (reqPath === '/tasks' || reqPath === '/tasks/') {
  filePath = path.join(__dirname, 'src', 'tasks.html');
} else if (reqPath.startsWith('/tasks/')) {
  filePath = path.join(__dirname, 'src', reqPath.replace('/tasks/', ''));
}
```

### Pattern 3: mux.js 顺序转封装（流式写盘）

**What:** 单一 `Transmuxer` 实例跨全部分片顺序 push 保持时间轴连续；`data` 事件里首段写 initSegment + data，后续只写 data；产物 = init.mp4 + 各 moof/mdat 顺序拼接即合法 fMP4 文件。
**When to use:** convert 任务（D-22/D-24）。
**Example:**

```js
// media-remuxer.js（主进程，require('mux.js') → muxjs.mp4.Transmuxer）
// Source: github.com/videojs/mux.js README（官方）
const muxjs = require('mux.js');
const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
let wroteInit = false;
transmuxer.on('data', (segment) => {
  if (!wroteInit) { stream.write(Buffer.from(segment.initSegment)); wroteInit = true; }
  stream.write(Buffer.from(segment.data));           // moof/mdat
});
// ⚠️ README 原文：必须先注册 'data' 监听，再 push（"It is important to push
// after your event listener has been defined."）
for (const tsFile of sortedSegmentFiles) {
  transmuxer.push(new Uint8Array(fs.readFileSync(tsFile)));
  transmuxer.flush();                                 // 每分片 flush 触发 data 事件
}
stream.end();
```

### Pattern 4: before-quit 活跃任务确认（复用既有退出协程）

**What:** main.js before-quit 已有「preventDefault → 异步收尾 → 显式 app.quit()」协程（WR-6 Cookie 保存）；活跃录制任务确认插进同一协程。
**When to use:** D-19 应用退出确认。
**Example:**

```js
// main.js:3548 既有 handler 内（cookiesSaved 分支之前/之后按 planner 结构定）
app.on('before-quit', async (event) => {
  if (mediaTaskManager.hasActiveTasks() && !quitConfirmed) {
    event.preventDefault();          // 既有注释：before-quit 不会等待 async handler 返回（main.js:3538）
    const { response } = await dialog.showMessageBox({ /* D-19 文案 */ });
    if (response !== 0) return;      // 取消退出
    quitConfirmed = true;
    setImmediate(() => app.quit());  // 既有模式：跳出 before-quit 异步续体（main.js:3600-3602 注释）
    return;
  }
  // …既有 Cookie 保存流程…
});
```

### Anti-Patterns to Avoid

- **在 player.js 直接 fetch /api/tasks**：主窗口/播放器数据一律走 preload IPC 或 realm:// 同源 /api（AGENTS.md「主窗口不能 fetch HTTP API」事故，Phase 38）。
- **缓存目录用原始 URL 拼路径**：必须 sha256 hex 做 `<视频ID>`/`<分片名>`，杜绝路径穿越与非法文件名字符。
- **淘汰时不管活跃任务**：D-07 豁免是硬约束，淘汰器必须查询 media-task-manager。
- **录制的 m3u8 轮询直接照搬 hls.js**：录制在主进程独立实现（D-20 解耦），不依赖 hls.js 实例。
- **mux.js 每个 TS 分片 new 一个 Transmuxer**：时间轴会断（每实例从 0 重排时间戳），必须单实例顺序 push。
- **在 markup 写内联 style（tasks/settings 页）**：realm:// CSP `style-src 'self'` 拦截（AGENTS.md「内部页面 CSP」）。
- **把播放器弹框画成全屏 div 遮罩**：关窗确认框用原生 `<dialog>` + `showModal()` + 显式 `margin:auto`（AGENTS.md 弹框居中约定，UI-SPEC 约定 2）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TS→fMP4 转封装 | 手写 MP4 box 生成器 | mux.js Transmuxer（D-04 定稿） | moov/moof/mdat 编码、AV 时间轴对齐、CEA-608 处理都已在库内 |
| 分片哈希/视频 ID | 自创哈希 | node:crypto sha256 | 标准库零风险 |
| 直播 m3u8 解析 | 引 hls-parser 等依赖 | ~40 行行解析器（先例：rewriteM3u8ForProxy main.js:234 就是行级处理） | 录制只需 MEDIA-SEQUENCE/TARGETDURATION/URI/ENDLIST 四标签，依赖不值 |
| 配置存储/目录选择/通知 | 自造存储或窗口 | electron-store + dialog.showOpenDialog/showSaveDialog + Electron Notification | 平台内置；dialog 用法项目已有 5 处先例（download-manager.js:416 等） |
| 缓存淘汰数据结构 | 复杂 LRU | 按最后观看时间 FIFO（D-07 定稿） | 需求就是 FIFO，整目录删除，无需 LRU 链表 |

**Key insight:** 本阶段唯一「真正难」的算法问题（转封装）已被 D-04 决策外包给 mux.js；其余全是工程粘合，复杂度控制在行级解析 + 文件索引即可。

## Common Pitfalls

### Pitfall 1: D-02 后 player.js 双模式判定语义冲突（最高优先）
**What goes wrong:** 独立窗口改从 localhost 加载后，`isWebviewMode = location.protocol === 'http:'` [VERIFIED: src/player.js:263] 恒为 true，`proxiedUrl` 自动生效（好事）；但若直接复用 webview tab 的 `paramUrl` 分支（player.js:282-290），会走 `document.body.classList.add('webview-player')` → 标题栏被 `body.webview-player #title-bar` 规则隐藏，且 `state.containerId = ''`，独立窗口失去红绿灯标题栏和容器信息。
**Why it happens:** 现在只有两种模式（file:// 独立窗口 / http: webview tab），localhost 化产生第三种形态「http: 加载的独立窗口」。
**How to avoid:** 独立窗口 URL 加显式参数（如 `&mode=independent`），player.js 判定顺序：`mode=independent` → 独立窗口 localhost 模式（保留标题栏、token/container/referer 从 URL 参数取，仍走 playerAPI.onPlayUrl 接收 mediaList）；`paramUrl && !mode` → webview tab（现状不动）。
**Warning signs:** 联调时独立窗口没有标题栏/红绿灯；containerId 传空导致 /proxy 回源不带 Cookie。

### Pitfall 2: 直播 m3u8 被缓存导致永远落后
**What goes wrong:** live 播放列表是滑动窗口（旧分片被服务端移除），若把 m3u8 响应当普通资源缓存，重载会拿到过期列表。
**Why it happens:** `handleProxyRequest` 用 `/mpegurl|m3u8/i` 判定清单（main.js:330），但清单本身不携带 live/VOD 标记直到解析内容。
**How to avoid:** m3u8 缓存仅存**原始文本**（重写每次现做，rewrite 是廉价行处理）；live 判定 = 文本不含 `EXT-X-ENDLIST`；live 清单要么不缓存、要么 TTL ≤ 一个 targetDuration（D-27 自由裁量区）。重开秒开场景真正需要的是**分片**缓存，不是清单缓存。
**Warning signs:** 重开直播卡在旧画面；抽屉里直播条目完整度虚高。

### Pitfall 3: Range 请求与整段缓存的语义冲突
**What goes wrong:** hls.js loader 支持 rangeStart/rangeEnd（EXT-X-BYTERANGE 分片）[CITED: hls.js docs/API.md loader context]；若对带 Range 头的请求做「未命中→整段落盘→返回 200」会破坏 206 语义，导致解码失败。
**How to avoid:** 带 Range 的请求永远不做整段缓存写盘（走透传）；读盘命中时可按 Range 切片返回 206，或干脆对 Range 请求绕过缓存（最稳）。主流 TS 分片不带 Range，覆盖面不受影响。
**Warning signs:** 某些站点视频能下不能播；响应头 Content-Range 缺失。

### Pitfall 4: ses.fetch 透明解压导致缓存内容与 Content-Length 失真
**What goes wrong:** 代理层已注释「ses.fetch 透明解压后 content-length 会失真」（main.js:346-350）；若缓存写入时信任上游 Content-Length 会写坏索引。
**How to avoid:** 缓存索引记录**实际落盘字节数**（写入完成后 stat），读盘服务时用实际大小设 Content-Length；索引里的期望大小/哈希（D-09）在写完后计算再登记。
**Warning signs:** 命中分片播放中途截断；校验全失败。

### Pitfall 5: mux.js 时间轴断裂与监听器时序
**What goes wrong:** ① 每分片新建 Transmuxer → 各段时间戳都从 0 起，拼出的 mp4 进度条错乱/跳帧；② push 先于 `data` 监听注册 → 事件丢失（README 原文明确警告）；③ 含 `EXT-X-DISCONTINUITY` 的流转封装时间轴跳变。
**Why it happens:** Transmuxer 状态（PES 时间戳基线）跨 push 累积。
**How to avoid:** 单实例顺序 push（见 Pattern 3）；监听器先注册； discontinuity 场景 v1 可直接标记转换失败原因（D-17 允许隐藏转换按钮）；`keepOriginalTimestamps: false`（默认）让库统一归零时间轴。
**Warning signs:** 转出的 mp4 在 QuickTime 里时长/进度异常；偶发空产物。

### Pitfall 6: 关窗/退出时进度与注册表不落盘
**What goes wrong:** D-13 要求暂停/关窗时上报进度；直接依赖 renderer 的 async IPC 在窗口销毁后完成会丢最后一次写入。
**How to avoid:** 关窗确认流程本身在主进程 `close` 事件拦截（playerWindow 现只有 `closed` 清理，ipc-handlers.js:2049-2052），拦截时可先向 renderer 要一次进度（带超时兜底）再放行；应用退出沿用 before-quit preventDefault 协程 [VERIFIED: main.js:3538-3555]。
**Warning signs:** 重开后总是回到几十秒前的位置。

### Pitfall 7: 容器 session 的 HTTP 缓存与自建缓存双写
**What goes wrong:** 播放器窗口使用 `persist:container-X` session（ipc-handlers.js:2034），localhost 页面对 /proxy 的响应也可能进 Chromium HTTP 缓存，形成双缓存与磁盘浪费。
**How to avoid:** /proxy 与 /api/* 响应统一加 `Cache-Control: no-store`（内部流量无二次请求收益）。
**Warning signs:** userData/Partitions 下出现大量 localhost 缓存条目。

### Pitfall 8: 通知在 dev 环境不弹
**What goes wrong:** Electron Notification 在未打包的二进制（`npm run dev` 直跑）上 macOS 可能被系统静默。
**How to avoid:** 通知实现照常写，UAT 验收放在 `make install` 打包版做（AGENTS.md「发布前必查」惯例）；通知失败不阻断任务状态更新。
**Warning signs:** dev 下测试通知永远不出现，误判功能坏。

## Code Examples

### 分片缓存 key 与视频 ID（自由裁量区推荐实现）

```js
// media-cache-manager.js
// Source: 项目内既定决策 D-05/D-12 + node:crypto
const crypto = require('crypto');
/** 续播匹配 key（D-12）：query 时效 token 不参与 */
function playbackKey(rawUrl) {
  const u = new URL(rawUrl);
  return `${u.origin}${u.pathname}`;
}
/** 视频目录 ID（D-05：origin+pathname 哈希即可） */
function videoId(rawUrl) {
  return crypto.createHash('sha256').update(playbackKey(rawUrl)).digest('hex').slice(0, 16);
}
```

### 直播录制轮询（主进程，D-18/D-20/D-21）

```js
// media-record-engine.js（示意）
// Source: RFC 8216 滑动窗口语义 [ASSUMED] + 既有 ses.fetch 代理惯例
const SEGMENT_RE = /^(?!#)(\S+)/;
async function pollOnce(session, playlistUrl, referer, seenSeqs) {
  const text = await fetchViaProxy(session, playlistUrl, referer); // 复用容器 session
  const mediaSeq = Number((text.match(/EXT-X-MEDIA-SEQUENCE:(\d+)/) || [])[1] || 0);
  const ended = text.includes('EXT-X-ENDLIST');
  const uris = text.split('\n').filter((l) => l && !l.startsWith('#'));
  uris.forEach((uri, i) => {
    const seq = mediaSeq + i;
    if (seenSeqs.has(seq)) return;
    seenSeqs.add(seq);
    downloadSegment(new URL(uri, playlistUrl).toString(), seq); // 去重落盘（D-20）
  });
  return { ended, targetDuration: Number((text.match(/EXT-X-TARGETDURATION:(\d+)/) || [])[1] || 6) };
}
// 轮询间隔 ≈ targetDuration；重试 N 次后停录（D-18）；录制目录独立于缓存库（D-23）
```

### 播放器进度节流上报（renderer，D-13）

```js
// player.js（示意）
setInterval(() => {
  if (!video.paused && state.currentUrl) {
    window.playerAPI.reportProgress({
      url: state.currentUrl,
      position: video.currentTime,
      duration: video.duration || 0,
    }); // ipcRenderer.send 单向即可，无需 await
  }
}, 5000);
video.addEventListener('pause', reportNow);  // 暂停即报
```

### 任务页数据端点（与既有 /api 分支同构）

```js
// main.js 服务器 handler（示意，照抄 /api/bookmarks-bar/toggle 的 token+sendJson 结构 main.js:2394-2410）
if (reqPath === '/api/tasks/list' && req.method === 'GET') {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) { sendJson(res, 403, { error: 'Forbidden' }); return; }
  sendJson(res, 200, mediaTaskManager.listTasks());
  return;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 独立窗口 file:// 直连拉流（防盗链/Cookie 裸奔） | localhost player 页 + /proxy 统一代理（D-02） | 本阶段 | 两模式数据流统一，isWebviewMode 分支简化 |
| 无本地缓存，重开重新拉流 | 分片级磁盘缓存 + 秒开续播 | 本阶段 | 新增 media-cache-manager 模块 |
| ffmpeg-static 做转封装（早期 multimedia-plan.md 设想） | mux.js 纯 JS（D-04） | 2026-09-06 定稿 | 避开原生模块打包风险 |
| docs/multimedia-plan.md 第二阶段「边播边缓存」设想（protocol.interceptStreamProtocol） | /proxy 应用层缓存（D-03） | 2026-09-06 定稿 | 挂在既有 HTTP 服务器而非协议拦截，改动面小 |

**Deprecated/outdated:**
- `docs/multimedia-plan.md` 第二阶段方案（session.protocol.interceptStreamProtocol + ffmpeg）——已被 44-CONTEXT.md 决策取代，勿按旧文档实施。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RFC 8216 语义：live 播放列表靠 EXT-X-MEDIA-SEQUENCE 滑动窗口，服务端会移除旧分片；轮询间隔取 targetDuration 可靠 | Pitfall 2 / 录制 Pattern | 低——若个别站点不守规范，重试与序列号去重可兜底 |
| A2 | VOD 播放列表只加载一次（hls.js 文档该节截断未直接验证） | Pitfall 2 | 低——m3u8 短 TTL 策略对 VOD 多拉一次无害 |
| A3 | mux.js 在 Node 主进程可长期稳定运行（纯 JS，CJS 入口已验证；未做实机长时间转封装验证） | Standard Stack | 中——convert 任务首跑需真机验证；失败可降级为「拼接 .ts + 提示」不阻塞主链路 |
| A4 | 含 PAT/PMT 缺失/乱序分片的流会让 mux.js 转封装失败（README 未记载，属社区常见问题） | Pitfall 5 | 低——D-17 允许对不齐/不可转条目隐藏按钮，失败有文案兜底 |
| A5 | Electron Notification 在打包版正常、dev 版可能静默（macOS 通知权限行为） | Pitfall 8 | 低——通知失败不影响任务状态；UAT 放打包版 |
| A6 | 观看历史记录量极小，SQLite 与 JSON 两方案皆可承载（D-11 未定存储介质，属 planner 裁量） | Standard Stack | 低 |
| A7 | hls.js 对同一分片不会并发重复请求到需要主进程去重的程度（in-flight 合并是稳健性优化非常量依赖） | Pitfall（并发） | 低 |

## Open Questions (RESOLVED)

> 三个问题的 Recommendation 均已被采纳进计划任务，无遗留未决项。

1. **独立窗口 localhost 化后 mediaList 的传递方式** — ✅ 已采纳：保留 IPC 通道传 mediaList（仅列表数据），导航参数（url/token/container/referer/cache）走 URL 参数（44-01 Task 1 action 1）。
   - What we know: 现有链路是 `did-finish-load` 后 `playerWindow.webContents.send('media:play-url', …)`（ipc-handlers.js:2043-2046）；webview 模式从 URL 参数取 url/token/container/referer。
   - What's unclear: mode=independent 下播放列表（上一个/下一个）仍走 IPC 还是也参数化。
   - Recommendation: 保留 IPC 通道传 mediaList（仅列表数据），导航参数（url/token/container/referer/cache）走 URL 参数——与 webview 模式参数语义对齐，改动最小。

2. **观看历史存储介质（SQLite 表 vs electron-store JSON）** — ✅ 已采纳：SQLite（独立小库），按 playbackKey 主键 upsert（44-01 Task 3 action 1）。
   - What we know: D-11 说「纯记录，很小」；项目 SQLite 惯例成熟。
   - What's unclear: 是否需要与容器关联（播放器窗口本身有 containerId）。
   - Recommendation: SQLite（独立小库或 history.db 加表），按 playbackKey 主键 upsert；A6 已标注可裁量。

3. **cache 标记的传递格式** — ✅ 已采纳：把 `'cache'` 加入 main.js:241 透传白名单，播放器页 proxiedUrl 附加 `cache=1`（44-01 Task 1 action 2）。
   - What we know: D-01/D-03 要求「带 cache 标记的播放器流量」落盘；rewriteM3u8ForProxy 的参数透传白名单是 `['token', 'container', 'referer']`（main.js:241）。
   - What's unclear: cache 标记加进透传白名单（`q.set('cache', …)`）还是独立参数。
   - Recommendation: 把 `'cache'` 加入 main.js:241 的透传白名单数组，播放器页 proxiedUrl 附加 `cache=1`——分片/密钥/子清单请求自动继承标记，零额外状态。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程全模块 | ✓ | v22.22.0（nvm，tests 引用同款） | — |
| Electron | 运行时 | ✓ | 43.3.0（package.json devDependencies） | — |
| better-sqlite3 | 观看历史（若选 SQLite） | ✓ | ^13.0.0 已装（asarUnpack 现只含 nodejieba，better-sqlite3 是否需 unpack 沿用现状即可——已被主进程正常使用） | JSON 存储 |
| mux.js | 转封装 | ✗（未安装） | 6.3.0 待装 | 无需 fallback（纯 JS） |
| 全局 playwright | UI 冒烟测试（既有惯例） | ✓ | 全局安装（tests/test-unified-navigation.js 引用） | — |

**Missing dependencies with no fallback:** none（mux.js 由计划任务 `npm install` 即可）
**Missing dependencies with fallback:** —

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 独立 node 断言脚本（tests/*.js，无框架）+ `node --test`（memory 子目录先例）|
| Config file | none — 沿用现有 `node tests/test-*.js` 惯例 |
| Quick run command | `node tests/test-media-cache.js` |
| Full suite command | `node tests/test-media-cache.js && node tests/test-m3u8-playlist-parser.js && node tests/test-media-task-registry.js && node tests/test-unified-navigation.js` |

### Phase Requirements → Test Map
> 本阶段 REQUIREMENTS.md 未映射需求 ID（TBD），以下按 CONTEXT.md 交付物映射。

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-05/07/08/09 | 缓存索引、FIFO 淘汰（豁免活跃任务）、磁盘满强淘、哈希校验删片 | unit（纯逻辑） | `node tests/test-media-cache.js` | ❌ Wave 0 |
| 录制解析 | m3u8 行解析：MEDIA-SEQUENCE/分片列举/ENDLIST/targetDuration | unit | `node tests/test-m3u8-playlist-parser.js` | ❌ Wave 0 |
| D-25 | 任务注册表状态机 running→completed/failed/cancelled/interrupted + 持久化 + record→convert 接力 | unit | `node tests/test-media-task-registry.js` | ❌ Wave 0 |
| D-12/续播 | 续播 key = origin+pathname（query token 不参与匹配） | unit（可并入 test-media-cache） | `node tests/test-media-cache.js` | ❌ Wave 0 |
| D-02 导航回归 | 既有导航入口不回归（角标/设置入口收敛 openUrl） | integration（playwright _electron） | `node tests/test-unified-navigation.js` | ✅ 既有 |

### Sampling Rate
- **Per task commit:** `node tests/test-media-cache.js`
- **Per wave merge:** 完整 suite（上方 Full suite command）
- **Phase gate:** 全 suite 绿 + 打包版（`make install`）真机启动验证（通知/转封装涉及系统行为，AGENTS.md 发布前必查惯例）

### Wave 0 Gaps
- [ ] `tests/test-media-cache.js` — 覆盖 D-05~D-10、D-12（要求 media-cache-manager 纯逻辑与 Electron 解耦，constructor 注入根目录）
- [ ] `tests/test-m3u8-playlist-parser.js` — 覆盖录制解析
- [ ] `tests/test-media-task-registry.js` — 覆盖 D-25 状态机（media-task-manager 同样去 Electron 化设计）
- [ ] Framework install: none needed

## Security Domain

### Applicable ASVS Categories（security_asvs_level: 1）

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | 本地单用户应用，无账号体系 |
| V3 Session Management | no | — |
| V4 Access Control | yes（部分） | /proxy 与 /api/tasks/* 全部 REALM_TOKEN 校验（既有 main.js:279 模式）；IPC 侧沿用 assertTrustedSender / assertPlayerSender |
| V5 Input Validation | yes | 视频ID/分片名一律 sha256 hex（禁原始 URL 入路径）；设置页容量数字校验、缓存目录 showOpenDialog 选取（不手输路径）；沿用 43 期 containerId `/^[\w-]+$/` 校验先例 |
| V6 Cryptography | yes（哈希仅完整性） | node:crypto sha256 做分片完整性校验（D-09），不涉加密原语自造 |
| V7/V9（日志/通信） | yes（部分） | /proxy 绑定 127.0.0.1 + token 防「开放代理」扫描（既有注释 main.js:278）；错误日志沿用 console.warn 惯例 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| localhost 端口扫描把应用当开放代理/写盘跳板 | Tampering/Elevation | token 鉴权既有；缓存 key 哈希化（无路径注入面）；写盘范围限定缓存根目录内 |
| 恶意 m3u8 超大清单/分片撑爆磁盘 | DoS | D-06 容量上限 + D-08 强制淘汰；分片写盘前可选大小上限（planner 裁量） |
| 缓存目录被替换为 symlink | Elevation | 写盘前 realpath 校验仍落在缓存根内（参考 agent-workspace resolveInside 先例） |
| 录制产物路径注入（标题含 / 等字符） | Tampering | 产物文件名 sanitize（标题白名单替换 + 时间戳后缀） |

## Sources

### Primary (HIGH confidence)
- 源码实读（本会话 Read）：main.js:85-120/220-420/520-595/2390-2530/3525-3555；ipc-handlers.js:1960-2089；src/player.js:80-240/230-310/580-700；src/player.html（全）；src/settings.html:530-575；src/renderer.js:340-406；package.json；download-manager.js:416
- mux.js 官方 GitHub README（github.com/videojs/mux.js）— Transmuxer API/选项/时序警告
- npm registry：mux.js 6.3.0（main=./cjs/index.js）、hls.js 1.7.2；package-legitimacy seam verdict OK

### Secondary (MEDIUM confidence)
- hls.js docs/API.md（github.com/video-dev/hls.js）— live 重载/重试策略/loader range 支持（部分章节截断）
- 44-UI-SPEC.md（已 approved）— UI 契约与 executor 约束
- docs/debug/m3u8-webview-player-route-a.md、docs/debug/player-video-fullscreen-and-url-intercept.md — 播放器路由改造史（preventDefault 后 setImmediate loadURL、拦截策略用户决策）

### Tertiary (LOW confidence)
- RFC 8216 直播滑动窗口语义（训练知识，未本会话核对原文）→ A1
- mux.js Node 侧长时间运行稳定性、PAT/PMT 缺失问题（社区经验）→ A3/A4

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 唯一新依赖双重验证；其余全部既有
- Architecture: HIGH — 全部集成点实读源码并给出行号锚点
- Pitfalls: HIGH — Pitfall 1/3/4/6/7 源自本仓库代码与历史事故文档；Pitfall 2/5 部分 [ASSUMED] 已入 Assumptions Log

**Research date:** 2026-09-06
**Valid until:** 2026-10-06（mux.js 6.3.0 为 2023 年稳定版，无快速漂移风险）
