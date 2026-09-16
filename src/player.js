/**
 * Realm Player - 播放器核心逻辑
 *
 * 实现格式检测与按需库加载（hls.js/mpegts.js/dash.js/原生）、
 * 沉浸式暗色控制栏、键盘快捷键、画中画、播放列表切换、资源释放。
 */

// ==================== 状态管理 ====================

/**
 * 播放器全局状态
 * @type {Object}
 */
const state = {
  /** @type {string} 当前播放的视频 URL */
  currentUrl: '',
  /** @type {Array<{url: string, type: string, source: string}>} 播放列表 */
  mediaList: [],
  /** @type {string} 来源容器 ID */
  containerId: '',
  /** @type {string} 来源容器名称（标题显示用） */
  containerName: '',
  /** @type {number} 当前在播放列表中的索引 */
  currentIndex: -1,
  /** @type {boolean} 是否正在拖拽进度条 */
  isDragging: false,
  /** @type {boolean} 控制栏是否应该隐藏 */
  controlsHidden: false,
  /** @type {boolean} 当前流是否为直播（HLS LEVEL_LOADED 更新，直播刷新不恢复进度） */
  isLive: false,
  /** @type {boolean} 独立窗口 localhost 模式（Phase 44 D-02 mode=independent，进度上报/缓存降级仅此模式启用） */
  isIndependentMode: false,
  /** @type {string} 当前显示标题（进度上报 title 字段来源） */
  currentTitle: '',
  /** @type {number} hls.js fatal network error 重试计数（Phase 44 D-10，initPlayer 时归零） */
  hlsRetryCount: 0,
  /** @type {string|null} 当前 URL 对应的运行中录制任务 ID（Phase 44 D-20/D-21，红点数据源；null=当前视频未在录） */
  recordingTaskId: null,
  /** @type {string|null} 当前录制任务实际使用的源 URL（目录源透明切换后与 currentUrl 不同——
   *  currentUrl 是用户选中的 master playlist，recordUrl 是 hls.js 选中的 variant 子清单；
   *  initPlayer 切流时复位，syncRecordUi 红点匹配以它为准） */
  recordUrl: null,
};

/**
 * 当前播放引擎实例
 * @type {{ engine: any, destroy: () => void } | null}
 */
let currentEngine = null;

/**
 * 控制栏自动隐藏定时器
 * @type {number | null}
 */
let hideTimer = null;

/**
 * 双击检测定时器（区分单击播放/暂停和双击全屏）
 * @type {number | null}
 */
let clickTimer = null;

// ==================== DOM 元素引用 ====================

/** @type {HTMLVideoElement} */
const video = document.getElementById('player');
const playerContainer = document.getElementById('player-container');
const titleBar = document.getElementById('title-bar');
const titleText = document.getElementById('title-text');
const playOverlay = document.getElementById('play-overlay');
const controlsContainer = document.getElementById('controls-container');
const progressContainer = document.getElementById('progress-container');
const progressTrack = document.getElementById('progress-track');
const progressPlayed = document.getElementById('progress-played');
const progressBuffered = document.getElementById('progress-buffered');
const progressHandle = document.getElementById('progress-handle');
const progressPreview = document.getElementById('progress-preview');
const timeDisplay = document.getElementById('time-display');
const btnPlay = document.getElementById('btn-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnVolume = document.getElementById('btn-volume');
const iconVolumeHigh = document.getElementById('icon-volume-high');
const iconVolumeLow = document.getElementById('icon-volume-low');
const iconVolumeMute = document.getElementById('icon-volume-mute');
const volumeSlider = document.getElementById('volume-slider');
const btnSpeed = document.getElementById('btn-speed');
const speedMenu = document.getElementById('speed-menu');
const btnPip = document.getElementById('btn-pip');
const btnFullscreen = document.getElementById('btn-fullscreen');
const iconFullscreenEnter = document.getElementById('icon-fullscreen-enter');
const iconFullscreenExit = document.getElementById('icon-fullscreen-exit');
const btnCopyUrl = document.getElementById('btn-copy-url');
const btnRefresh = document.getElementById('btn-refresh');
const errorHint = document.getElementById('error-hint');
const errorText = document.getElementById('error-text');
const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
const btnMaximize = document.getElementById('btn-maximize');
// Phase 44 录制与抽屉（D-14~D-16/D-18/D-21）
const btnRecord = document.getElementById('btn-record');
const iconRecord = document.getElementById('icon-record');
const iconStop = document.getElementById('icon-stop');
const recordDot = document.getElementById('record-dot');
const recordDotTooltip = document.getElementById('record-dot-tooltip');
const btnDrawer = document.getElementById('btn-drawer');
const drawerPanel = document.getElementById('drawer-panel');
const drawerList = document.getElementById('drawer-list');
const drawerEmpty = document.getElementById('drawer-empty');
const btnDrawerClose = document.getElementById('btn-drawer-close');
const drawerDeleteDialog = document.getElementById('drawer-delete-dialog');
const drawerDeleteText = document.getElementById('drawer-delete-text');
const drawerDeleteEntry = document.getElementById('drawer-delete-entry');
const btnDrawerDeleteCancel = document.getElementById('btn-drawer-delete-cancel');
const btnDrawerDeleteConfirm = document.getElementById('btn-drawer-delete-confirm');

// ==================== 格式检测与库初始化 ====================

/**
 * 根据 URL 后缀判断视频格式
 * @param {string} url - 视频 URL
 * @returns {'hls'|'mpegts'|'dash'|'native'|'unknown'} 格式标识
 */
function detectFormat(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) return 'hls';
    if (pathname.endsWith('.flv') || pathname.endsWith('.ts')) return 'mpegts';
    if (pathname.endsWith('.mpd')) return 'dash';
    if (pathname.endsWith('.mp4') || pathname.endsWith('.webm')) return 'native';
  } catch (e) {
    console.error('[Realm Player] URL 解析失败:', e);
  }
  return 'unknown';
}

/**
 * 初始化播放器，按格式分支加载对应播放库
 * @param {string} url - 视频 URL
 */
async function initPlayer(url) {
  // 先销毁旧引擎实例（Pitfall 2: 窗口复用时旧库实例未销毁）
  if (currentEngine) {
    try {
      currentEngine.destroy();
    } catch (e) {
      console.error('[Realm Player] 销毁旧引擎失败:', e);
    }
    currentEngine = null;
  }

  // 重置视频元素
  video.src = '';
  video.load();

  // 隐藏错误提示
  errorHint.style.display = 'none';

  const format = detectFormat(url);
  state.currentUrl = url;
  // 录制源随切流复位（新流的录制归属新 URL，旧 recordUrl 不能带过去）
  state.recordUrl = null;
  // 直播属性随新加载的流重新判定，旧值不能带到下一次播放
  state.isLive = false;
  // D-10 重试计数随新流归零
  state.hlsRetryCount = 0;

  // 标题优先取嗅探列表项 title（用户「传过去的名称」），无匹配/空标题回落 URL 文件名
  const matched = state.mediaList.find((item) => item.url === url);
  const fileName = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const baseTitle = (matched && matched.title) || fileName;
  // 窗口标题栏保留容器名前缀（肉眼可验证 D-22 容器隔离）
  const displayTitle = state.containerName ? `${state.containerName} - ${baseTitle}` : baseTitle;
  titleText.textContent = displayTitle;
  document.title = `Realm Player - ${displayTitle}`;
  // 进度上报/录制任务/转码命名的 title 来源（D-13）：纯标题，不带容器前缀
  state.currentTitle = baseTitle;

  console.log('[Realm Player] 初始化播放, 格式:', format, 'URL:', url);

  switch (format) {
    case 'hls': {
      try {
        const Hls = window.Hls || (await import('hls.js')).default;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(proxiedUrl(url));
          hls.attachMedia(video);
          // 清单解析完成后自动播放（D-14 打开即播；切换上一个/下一个时也靠它续播，
          // 否则新视频停在暂停态，播放按钮图标/覆盖层与实际状态不一致）
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch((e) => console.error('[Realm Player] HLS 自动播放失败:', e));
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('[Realm Player] hls.js 致命错误:', data);
              // Phase 44 D-10：断网/源站失效时已缓存分片照播（缓存读盘链路
              // 天然生效）——独立窗口缓存模式下 fatal network error 不打断播放，
              // 重试拉流并显示降级提示条；webview tab 模式行为不变（D-01）
              if (state.isIndependentMode && data.type === Hls.ErrorTypes.NETWORK_ERROR && !state.isLive) {
                if (state.hlsRetryCount < 3) {
                  state.hlsRetryCount++;
                  showCacheFallbackBanner();
                  hls.startLoad();
                  return;
                }
                showCacheFallbackBanner();
                return;
              }
              showError('HLS 播放失败');
            }
          });
          // 记录直播/点播属性：默认配置（liveDurationInfinity:false）下直播流的
          // video.duration 可能是持续增长的有限值，不能只靠 isFinite 判断
          hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            state.isLive = data.details.live;
          });
          // WR-06（CR-01 断网照播 missing 点名）：成功拉到分片即复位重试计数——
          // 分片数据到达 = 最精确的「网络恢复」信号（粒度优于 LEVEL_LOADED），
          // 避免长会话累计 3 次瞬时错误后 D-10 降级重试永久失效（各次均自恢复）
          hls.on(Hls.Events.FRAG_LOADED, () => {
            state.hlsRetryCount = 0;
          });
          currentEngine = { engine: hls, destroy: () => hls.destroy() };
        } else {
          console.warn('[Realm Player] HLS 不受支持，尝试原生播放');
          video.src = url;
          video.play().catch(() => {});
          currentEngine = { engine: null, destroy: () => { video.src = ''; video.load(); } };
        }
      } catch (e) {
        console.error('[Realm Player] hls.js 加载失败:', e);
        showError('HLS 库加载失败');
      }
      break;
    }

    case 'mpegts': {
      try {
        const mpegts = window.mpegts || (await import('mpegts.js')).default;
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer({ type: 'flv', url });
          player.attachMediaElement(video);
          player.load();
          player.play();
          currentEngine = {
            engine: player,
            destroy: () => {
              player.unload();
              player.detachMediaElement();
              player.destroy();
            },
          };
        } else {
          showError('当前环境不支持 MPEG-TS/FLV 播放');
        }
      } catch (e) {
        console.error('[Realm Player] mpegts.js 加载失败:', e);
        showError('MPEG-TS 库加载失败');
      }
      break;
    }

    case 'dash': {
      try {
        const dashjs = window.dashjs || (await import('dashjs')).default;
        const player = dashjs.MediaPlayer().create();
        player.initialize(video, url, true);
        currentEngine = { engine: player, destroy: () => player.reset() };
      } catch (e) {
        console.error('[Realm Player] dash.js 加载失败:', e);
        showError('DASH 库加载失败');
      }
      break;
    }

    case 'native': {
      video.src = url;
      video.play().catch((e) => {
        console.error('[Realm Player] 原生播放失败:', e);
      });
      currentEngine = { engine: null, destroy: () => { video.src = ''; video.load(); } };
      break;
    }

    case 'unknown':
    default:
      showError('无法播放 — 不支持的视频格式');
      break;
  }

  // 更新播放列表按钮状态
  updatePlaylistButtons();

  // Phase 44 D-20：切视频后红点按当前 URL 的任务实况同步（在录任务本身不受
  // 影响——切走后红点消失但任务页仍 running；切回来自动恢复显示）
  syncRecordUi();
}

/**
 * 显示错误提示
 * @param {string} message - 错误信息
 */
function showError(message) {
  errorText.textContent = message;
  errorHint.style.display = 'block';
}

// ==================== IPC 数据接收 / URL 参数模式 ====================

/**
 * 检测当前运行环境：独立窗口（playerAPI）或 webview tab（URL 参数）
 */
const urlParams = new URLSearchParams(window.location.search);
const paramUrl = urlParams.get('url');

// 传输层语义（44-09 G-44-2，D-01）：webview tab 模式播放器直连拉流，不经 /proxy；
// 仅独立窗口经 /proxy 同源代理（token 鉴权、Referer 可控、分片缓存仅此链路，
// m3u8 清单由代理重写，分片/密钥请求同样走代理）。
// CR-06 限制（修正原注释「像网页自身播放一样 / Cookie 由 session 天然携带」的错误声明）：
// 直连请求由 hls.js 以 XHR 发出，受 CORS 门控——webview 仅 contextIsolation=yes、
// webSecurity 默认开启，源站不返回 ACAO 即被拦；跨源 XHR 默认不带凭据，容器 Cookie
// 不会随之发送；Referer 为播放器页 localhost 而非源页面，防盗链站点会拒。故
// 「无 ACAO / 校验 Referer / Cookie 门控」的源站可能不可用（UAT 仅覆盖开放 CORS 源）。

// Phase 44 D-02：独立窗口 localhost 化后出现第三形态——http: 加载的独立窗口。
// mode=independent 参数区分：保留标题栏与红绿灯（不进 webview tab 的隐藏标题栏
// 分支，Pitfall 1），token/container/referer/cache 从 URL 参数取，mediaList 仍经
// playerAPI.onPlayUrl 接收
const isIndependentMode = urlParams.get('mode') === 'independent';

/**
 * 将视频源 URL 转换为 /proxy 代理 URL（仅独立播放器窗口 mode=independent）
 * token/container/referer/cache 从播放器页面 URL 透传
 * @param {string} url - 原始视频 URL
 * @returns {string} 代理 URL 或原 URL
 */
function proxiedUrl(url) {
  if (!isIndependentMode || !/^https?:\/\//i.test(url)) return url;
  const proxyUrl = new URL('/proxy', location.origin);
  proxyUrl.searchParams.set('url', url);
  for (const key of ['token', 'container', 'referer', 'cache']) {
    const v = urlParams.get(key);
    if (v) proxyUrl.searchParams.set(key, v);
  }
  return proxyUrl.toString();
}

if (paramUrl && !isIndependentMode) {
  // webview tab 模式：从 URL 参数读取播放地址，隐藏标题栏
  console.log('[Realm Player] webview tab 模式，URL 参数:', paramUrl);
  document.body.classList.add('webview-player');
  state.mediaList = [];
  state.containerId = '';
  state.containerName = '';
  state.currentIndex = 0;
  initPlayer(paramUrl);
} else if (window.playerAPI && window.playerAPI.onPlayUrl) {
  // 独立窗口模式（file:// 或 Phase 44 D-02 localhost）：通过 IPC 接收播放数据。
  // mode=independent 时保留标题栏与红绿灯（不进 webview-player 分支，Pitfall 1），
  // token/container/referer/cache 从 URL 参数取（proxiedUrl 透传），mediaList 仍走 IPC
  state.isIndependentMode = isIndependentMode;
  window.playerAPI.onPlayUrl((data) => {
    console.log('[Realm Player] 收到播放数据:', data.url);

    state.mediaList = data.mediaList || [];
    state.containerId = data.containerId;
    state.containerName = data.containerName || '';

    // 计算当前在播放列表中的索引
    state.currentIndex = state.mediaList.findIndex((item) => item.url === data.url);
    if (state.currentIndex === -1 && state.mediaList.length > 0) {
      state.currentIndex = 0;
    }

    // Phase 44 D-12：先查观看历史再起播，loadedmetadata 后续播 seek
    initPlayerWithResume(data.url);
  });
}

// ==================== 播放/暂停控制 ====================

/**
 * 切换播放/暂停状态
 */
function togglePlay() {
  if (video.paused) {
    video.play().catch((e) => console.error('[Realm Player] 播放失败:', e));
  } else {
    video.pause();
  }
}

// 播放按钮点击
btnPlay.addEventListener('click', togglePlay);

// 播放覆盖层点击
playOverlay.addEventListener('click', togglePlay);

// 视频 play 事件：更新 UI
video.addEventListener('play', () => {
  iconPlay.style.display = 'none';
  iconPause.style.display = 'block';
  playOverlay.classList.remove('visible');
  // 启动控制栏隐藏定时器
  startHideTimer();
});

// 视频 pause 事件：更新 UI
video.addEventListener('pause', () => {
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
  playOverlay.classList.add('visible');
  // 暂停时始终显示控制栏
  showControls();
  clearTimeout(hideTimer);
});

// 视频 ended 事件：显示播放覆盖，尝试播放下一个
video.addEventListener('ended', () => {
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
  playOverlay.classList.add('visible');
  // 自动播放下一个
  if (state.currentIndex < state.mediaList.length - 1) {
    playNext();
  }
});

// ==================== 进度条控制 ====================

/**
 * 格式化时间为 HH:MM:SS 或 MM:SS 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 更新进度条位置和时间显示
 */
function updateProgress() {
  if (!video.duration || state.isDragging) return;
  const percent = (video.currentTime / video.duration) * 100;
  progressPlayed.style.width = `${percent}%`;
  progressHandle.style.left = `${percent}%`;
  timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
}

video.addEventListener('timeupdate', updateProgress);

// 视频元数据加载后更新时间显示
video.addEventListener('loadedmetadata', () => {
  timeDisplay.textContent = `00:00 / ${formatTime(video.duration)}`;
});

// 缓冲进度更新
video.addEventListener('progress', () => {
  if (video.buffered.length > 0 && video.duration) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const percent = (bufferedEnd / video.duration) * 100;
    progressBuffered.style.width = `${percent}%`;
  }
});

/**
 * 从进度条容器的鼠标事件获取对应的时间
 * @param {MouseEvent} e - 鼠标事件
 * @returns {number} 对应的视频时间（秒）
 */
function getTimeFromEvent(e) {
  const rect = progressTrack.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const percent = x / rect.width;
  return percent * (video.duration || 0);
}

// 进度条点击跳转
progressContainer.addEventListener('click', (e) => {
  if (state.isDragging) return;
  video.currentTime = getTimeFromEvent(e);
});

// 进度条拖拽
progressContainer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  state.isDragging = true;
  progressContainer.classList.add('dragging');
  video.currentTime = getTimeFromEvent(e);
});

document.addEventListener('mousemove', (e) => {
  if (state.isDragging) {
    video.currentTime = getTimeFromEvent(e);
  }

  // 时间预览气泡
  if (progressContainer.matches(':hover') || state.isDragging) {
    const rect = progressTrack.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const time = percent * (video.duration || 0);
    progressPreview.textContent = formatTime(time);
    // 限制气泡位置不超出容器
    const previewLeft = Math.max(0, Math.min(x, rect.width - 40));
    progressPreview.style.left = `${previewLeft}px`;
  }
});

document.addEventListener('mouseup', () => {
  if (state.isDragging) {
    state.isDragging = false;
    progressContainer.classList.remove('dragging');
  }
});

// ==================== 音量控制 ====================

/**
 * 更新音量图标
 */
function updateVolumeIcon() {
  iconVolumeHigh.style.display = 'none';
  iconVolumeLow.style.display = 'none';
  iconVolumeMute.style.display = 'none';

  if (video.muted || video.volume === 0) {
    iconVolumeMute.style.display = 'block';
  } else if (video.volume < 0.5) {
    iconVolumeLow.style.display = 'block';
  } else {
    iconVolumeHigh.style.display = 'block';
  }
}

// 音量滑块变化
volumeSlider.addEventListener('input', () => {
  video.volume = parseFloat(volumeSlider.value);
  video.muted = false;
  volumeSlider.style.setProperty('--volume-percent', `${video.volume * 100}%`);
  updateVolumeIcon();
});

// 音量按钮点击切换静音
btnVolume.addEventListener('click', () => {
  video.muted = !video.muted;
  volumeSlider.value = video.muted ? 0 : video.volume;
  volumeSlider.style.setProperty('--volume-percent', `${(video.muted ? 0 : video.volume) * 100}%`);
  updateVolumeIcon();
});

// 音量变化事件
video.addEventListener('volumechange', () => {
  if (!video.muted) {
    volumeSlider.value = video.volume;
    volumeSlider.style.setProperty('--volume-percent', `${video.volume * 100}%`);
  }
  updateVolumeIcon();
});

// 初始化音量显示
volumeSlider.style.setProperty('--volume-percent', '100%');

// ==================== 倍速控制 ====================

// 倍速按钮点击：切换菜单显示/隐藏
btnSpeed.addEventListener('click', (e) => {
  e.stopPropagation();
  speedMenu.classList.toggle('visible');
});

// 倍速菜单项点击
speedMenu.addEventListener('click', (e) => {
  const option = e.target.closest('.speed-option');
  if (!option) return;
  const speed = parseFloat(option.dataset.speed);
  video.playbackRate = speed;
  btnSpeed.textContent = `${speed}x`;

  // 更新选中状态
  speedMenu.querySelectorAll('.speed-option').forEach((opt) => opt.classList.remove('active'));
  option.classList.add('active');

  speedMenu.classList.remove('visible');
});

// 点击其他地方关闭倍速菜单
document.addEventListener('click', (e) => {
  if (!speedMenu.contains(e.target) && e.target !== btnSpeed) {
    speedMenu.classList.remove('visible');
  }
});

// ==================== 全屏控制 ====================

/**
 * 更新全屏按钮图标和 body 全屏类
 * @param {boolean} isFullscreen
 */
function updateFullscreenUI(isFullscreen) {
  iconFullscreenEnter.style.display = isFullscreen ? 'none' : 'block';
  iconFullscreenExit.style.display = isFullscreen ? 'block' : 'none';
  document.body.classList.toggle('fullscreen', isFullscreen);
}

/**
 * 切换全屏状态
 * 使用 playerAPI 调用主进程 BrowserWindow.setFullScreen()
 */
async function toggleFullscreen() {
  if (window.playerAPI && window.playerAPI.toggleFullscreen) {
    const result = await window.playerAPI.toggleFullscreen();
    updateFullscreenUI(result.fullscreen);
  }
}

btnFullscreen.addEventListener('click', toggleFullscreen);

// 监听主进程广播的全屏状态变化（覆盖系统 fullscreenchange 事件在 Electron setFullScreen 下不触发的问题）
if (window.playerAPI && window.playerAPI.onFullscreenChanged) {
  window.playerAPI.onFullscreenChanged((isFullscreen) => {
    updateFullscreenUI(isFullscreen);
  });
}

// 保留系统 fullscreenchange 作为兜底（如将来改用 DOM Fullscreen API）
document.addEventListener('fullscreenchange', () => {
  updateFullscreenUI(!!document.fullscreenElement);
});

// ==================== 画中画控制 ====================

// 如果不支持 PiP，隐藏按钮
if (!video.requestPictureInPicture) {
  btnPip.style.display = 'none';
}

btnPip.addEventListener('click', async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  } catch (e) {
    console.error('[Realm Player] 画中画切换失败:', e);
  }
});

video.addEventListener('enterpictureinpicture', () => {
  btnPip.title = '退出画中画';
  btnPip.querySelector('svg').style.opacity = '0.7';
});

video.addEventListener('leavepictureinpicture', () => {
  btnPip.title = '画中画';
  btnPip.querySelector('svg').style.opacity = '1';
});

// ==================== 复制 URL ====================

/**
 * 复制当前播放的视频 URL 到剪贴板
 * 复制成功后按钮短暂变色反馈
 */
btnCopyUrl.addEventListener('click', async () => {
  if (!state.currentUrl) return;

  try {
    await navigator.clipboard.writeText(state.currentUrl);
    // 复制成功反馈：短暂变绿
    btnCopyUrl.classList.add('copy-success');
    btnCopyUrl.title = '已复制';
    setTimeout(() => {
      btnCopyUrl.classList.remove('copy-success');
      btnCopyUrl.title = '复制链接';
    }, 1500);
  } catch (e) {
    console.error('[Realm Player] 复制 URL 失败:', e);
  }
});

// ==================== 刷新当前流 ====================

/**
 * 刷新当前播放地址：按原 URL 重新走一遍 initPlayer 加载管线（销毁旧引擎重建）。
 * 点播（有限时长）恢复到刷新前的播放位置；直播流不恢复进度，回到直播边缘。
 */
function refreshCurrent() {
  if (!state.currentUrl) return;
  const resumeTime = (!state.isLive && isFinite(video.duration)) ? video.currentTime : 0;
  initPlayer(state.currentUrl);
  if (resumeTime > 0) {
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = resumeTime;
    }, { once: true });
  }
}

btnRefresh.addEventListener('click', refreshCurrent);

// ==================== 续播与进度上报（Phase 44 D-12/D-13） ====================

/**
 * 独立窗口模式起播（D-12）：先按 playbackKey（origin+pathname，query 时效
 * token 不参与）查观看历史，initPlayer 后在 loadedmetadata 时 seek 到上次
 * 位置（非直播；直播流回到边缘）。复用 refreshCurrent 的 resume 模式。
 * @param {string} url - 视频 URL
 */
async function initPlayerWithResume(url) {
  let resumePosition = 0;
  try {
    if (window.playerAPI && window.playerAPI.getResumePosition) {
      const r = await window.playerAPI.getResumePosition(url);
      if (r && r.position > 0) resumePosition = r.position;
    }
  } catch (e) {
    console.warn('[Realm Player] 续播位置查询失败:', e);
  }
  initPlayer(url);
  if (resumePosition > 0) {
    video.addEventListener('loadedmetadata', () => {
      if (!state.isLive) {
        video.currentTime = resumePosition;
        console.log('[Realm Player] 续播 seek 到:', resumePosition);
      }
    }, { once: true });
  }
}

/**
 * 立即上报一次播放进度（D-13）。仅独立窗口模式启用——webview tab 模式的
 * 发送方不是播放器窗口，主进程 assertPlayerSender 会拒绝。
 */
function reportProgressNow() {
  if (!state.isIndependentMode || !state.currentUrl) return;
  if (!window.playerAPI || !window.playerAPI.reportProgress) return;
  try {
    window.playerAPI.reportProgress({
      url: state.currentUrl,
      title: state.currentTitle || '',
      position: video.currentTime || 0,
      duration: isFinite(video.duration) ? video.duration : 0,
    });
  } catch (e) {
    console.warn('[Realm Player] 进度上报失败:', e);
  }
}

// 每 5 秒节流上报（播放中）
setInterval(() => {
  if (!video.paused && state.currentUrl) reportProgressNow();
}, 5000);

// 暂停即报
video.addEventListener('pause', reportProgressNow);

// 关窗兜底（Pitfall 6）：主进程 close 拦截后索取最终进度，ack 在
// onRequestFinalProgress 桥接内发出（send 有序，进度先于 ack 到达主进程）
if (window.playerAPI && window.playerAPI.onRequestFinalProgress) {
  window.playerAPI.onRequestFinalProgress(reportProgressNow);
}

// ==================== 缓存降级提示条（Phase 44 D-10 / UI-SPEC Component 5） ====================

/** 降级提示条元素（动态创建，避免改 player.html） */
const cacheFallbackBanner = document.createElement('div');
cacheFallbackBanner.className = 'cache-fallback-banner';
// 文案由 showCacheFallbackBanner 按「当前视频是否真有缓存」逐次决定（UI 评审：
// 零缓存的新视频首次遇网络错误时不得声称「已缓存部分可继续观看」）
cacheFallbackBanner.style.display = 'none';
playerContainer.appendChild(cacheFallbackBanner);

/** 提示条自动隐藏定时器 @type {number|null} */
let bannerTimer = null;

/**
 * 显示降级提示条：断网/源站失效时告知用户已缓存部分可继续观看，
 * 约 4 秒自动消失，不打断播放
 */
/**
 * 显示缓存降级提示条（D-10）
 *
 * UI 评审：原实现固定文案「部分分片加载失败，已缓存部分可继续观看」，但对**未缓存过
 * 的新视频**首次播放遇网络错误同样显示，此时并没有任何缓存可看——文案与真实状态矛盾。
 * 改为按当前视频是否已有缓存分档（复用既有 playerAPI.getDrawerList 的 cacheSize，
 * 不新增通道）；查询失败按「无缓存」处理（更保守，不声称有缓存）。
 */
async function showCacheFallbackBanner() {
  let hasCache = false;
  try {
    if (window.playerAPI && window.playerAPI.getDrawerList && state.currentUrl) {
      const key = playbackKeyOfUrl(state.currentUrl);
      const items = (await window.playerAPI.getDrawerList()) || [];
      const item = items.find((it) => it.playbackKey === key);
      hasCache = !!(item && item.cacheSize > 0);
    }
  } catch { /* 查询失败按无缓存处理 */ }

  cacheFallbackBanner.textContent = hasCache
    ? '部分分片加载失败，已缓存部分可继续观看'
    : '网络不稳定，部分分片加载失败，正在重试…';
  cacheFallbackBanner.style.display = 'flex';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    cacheFallbackBanner.style.display = 'none';
  }, 4000);
}

// ==================== 直播录制（Phase 44 D-18/D-20/D-21 / UI-SPEC Component 1/2） ====================

/**
 * 续播匹配 key（与主进程 D-12 语义一致）：origin + pathname，query 时效 token 不参与
 * @param {string} rawUrl - 视频 URL
 * @returns {string} playbackKey
 */
function playbackKeyOfUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return rawUrl || '';
  }
}

/**
 * 还原 /proxy 形态 URL 中的直连地址（独立播放器链路：hls.js 请求的清单经
 * 主进程 rewriteM3u8ForProxy 改写，variant 子清单地址形如
 * `/proxy?url=<直连地址>&token=...`；录制引擎需要直连地址自己回源）。
 * 非 /proxy 形态（webview tab 直连）原样返回绝对化结果。
 * @param {string} u - hls.js level 里的 URL（可能相对）
 * @returns {string|null} 直连 http(s) URL；取不到返回 null
 */
function directUrlFromProxy(u) {
  if (!u || typeof u !== 'string') return null;
  try {
    const abs = new URL(u, location.origin);
    if (abs.origin === location.origin && abs.pathname === '/proxy') {
      const inner = abs.searchParams.get('url');
      return inner && /^https?:\/\//i.test(inner) ? inner : null;
    }
    return /^https?:$/i.test(abs.protocol) ? abs.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 录制源 URL 决策（2026-09-16，目录源透明切换）：
 * 用户从嗅探面板选中的可能是多码率 master playlist（Twitch usher）——hls.js
 * 能播（自己选 variant），但录制引擎只认 media playlist。此处优先取 hls.js
 * 当前选中清晰度（currentLevel，未选定取首条）的 variant 子清单直连地址作为
 * 录制源，选错目录也能录成；非 hls 引擎/levels 未就绪回退 currentUrl。
 * 直连 media playlist 时 level 地址还原后与 currentUrl 等价，行为不变。
 * @returns {string} 传给 startRecord 的 URL
 */
function resolveRecordUrl() {
  const hls = currentEngine && currentEngine.engine;
  if (hls && Array.isArray(hls.levels) && hls.levels.length > 0) {
    const idx = typeof hls.currentLevel === 'number' && hls.currentLevel >= 0 ? hls.currentLevel : 0;
    const level = hls.levels[idx];
    const levelUrl = level && Array.isArray(level.url) ? level.url[0] : null;
    const direct = directUrlFromProxy(levelUrl);
    if (direct) return direct;
  }
  return state.currentUrl;
}

/**
 * 字节数格式化（红点 tooltip / 抽屉元信息）：
 * <1GB 显示 xxxMB，≥1GB 显示 x.xGB
 * @param {number} bytes - 字节数
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * 红点/录制按钮 UI 同步（红点显隐、按钮图标与 tooltip 文案）
 */
function updateRecordUi() {
  const recording = !!state.recordingTaskId;
  recordDot.classList.toggle('visible', recording);
  iconRecord.style.display = recording ? 'none' : 'block';
  iconStop.style.display = recording ? 'block' : 'none';
  btnRecord.title = recording ? '停止录制' : '开始录制';
}

/**
 * 按主进程任务实况同步录制状态（initPlayer/状态广播后调用）：
 * 当前 URL 的 playbackKey 命中运行中录制任务 → 红点显示（D-19 keep-recording
 * 关窗后重开同一视频也由此恢复红点）。仅独立窗口模式调用——webview tab 的
 * 发送方会被主进程 assertPlayerSender 拒绝。
 */
async function syncRecordUi() {
  if (!state.isIndependentMode || !window.playerAPI || !window.playerAPI.getRecordList) return;
  try {
    const list = await window.playerAPI.getRecordList();
    // 目录源透明切换后录制归属 recordUrl（variant 子清单），不是 currentUrl（master）——
    // 红点匹配以实际录制源为准，否则 running 中的任务匹配不到、红点点不亮；
    // 窗口重开（recordUrl 尚未建立）时用 resolveRecordUrl 现场还原 variant 兜底恢复
    const key = playbackKeyOfUrl(state.recordUrl || resolveRecordUrl());
    const active = (list || []).find((t) => t.playbackKey === key);
    state.recordingTaskId = active ? active.taskId : null;
    updateRecordUi();
  } catch (e) {
    console.warn('[Realm Player] 录制状态同步失败:', e);
  }
}

// 录制按钮点击：未录制 → 发起录制；录制中 → 停止并保存（与红点点击等价）
btnRecord.addEventListener('click', async () => {
  if (state.recordingTaskId) {
    await stopCurrentRecording();
    return;
  }
  if (!state.currentUrl || !window.playerAPI || !window.playerAPI.startRecord) return;
  try {
    // 目录源（master playlist）透明切换：取 hls.js 当前清晰度的 variant 子清单
    // 直连地址录制；直连源时与 currentUrl 等价
    const recordUrl = resolveRecordUrl();
    const r = await window.playerAPI.startRecord({
      url: recordUrl,
      title: state.currentTitle || '',
      containerId: state.containerId || '',
      referer: urlParams.get('referer') || '',
    });
    if (r && r.success) {
      state.recordingTaskId = r.taskId;
      state.recordUrl = recordUrl;
      updateRecordUi();
    } else {
      showError((r && r.error) || '录制启动失败');
    }
  } catch (e) {
    console.error('[Realm Player] 发起录制失败:', e);
    showError('录制启动失败');
  }
});

/**
 * 停止当前 URL 对应的录制任务（红点点击/录制按钮/状态广播共用）
 */
async function stopCurrentRecording() {
  const taskId = state.recordingTaskId;
  if (!taskId || !window.playerAPI || !window.playerAPI.stopRecord) return;
  try {
    await window.playerAPI.stopRecord(taskId);
  } catch (e) {
    console.error('[Realm Player] 停止录制失败:', e);
  }
  // 终态广播会再次触发 syncRecordUi，这里先乐观复位红点
  state.recordingTaskId = null;
  updateRecordUi();
}

// 红点点击 = 停止录制（D-21 可点击停止）
recordDot.addEventListener('click', stopCurrentRecording);

// 红点 hover：tooltip 定时刷新（已录时长≈分片数×targetDuration、已录大小——D-21）
let recordTooltipTimer = null;
async function refreshRecordTooltip() {
  if (!state.recordingTaskId) return;
  try {
    const s = await window.playerAPI.getRecordStatus(state.recordingTaskId);
    if (s && s.status === 'running') {
      recordDotTooltip.textContent = `已录 ${formatTime(s.durationSeconds)} · ${formatBytes(s.totalBytes)}`;
    }
  } catch { /* tooltip 刷新失败静默 */ }
}
recordDot.addEventListener('mouseenter', () => {
  refreshRecordTooltip();
  recordTooltipTimer = setInterval(refreshRecordTooltip, 1000);
});
recordDot.addEventListener('mouseleave', () => {
  clearInterval(recordTooltipTimer);
  recordTooltipTimer = null;
});

// 录制任务状态变化（主进程 media-task:changed 过滤 type=record）：D-20 播放状态
// 不影响录制——这里只按任务终态同步红点；失败任务给出可转提示（UI-SPEC Copywriting）
if (window.playerAPI && window.playerAPI.onRecordStateChanged) {
  window.playerAPI.onRecordStateChanged((task) => {
    if (task.id === state.recordingTaskId && task.status !== 'running') {
      state.recordingTaskId = null;
      updateRecordUi();
      if (task.status === 'failed') {
        const reason = task.error === 'network' ? '网络错误' : (task.error || '未知原因');
        showError(`录制失败：${reason}。已录部分仍可转换为 MP4`);
      }
    }
    syncRecordUi();
  });
}

// ==================== 本地媒体库抽屉（Phase 44 D-14~D-16 / UI-SPEC Component 3/4） ====================

/** 待删除的抽屉条目 playbackKey（删除确认框确认后消费） @type {string|null} */
let pendingDeleteKey = null;

/** 待删除的抽屉条目标题（G-44-8：checkbox 勾选联动文案读取） @type {string|null} */
let pendingDeleteTitle = null;

/**
 * 最近观看时间格式化：同年省略年份（MM-DD HH:mm），跨年带年份
 * @param {number} ts - 毫秒时间戳
 * @returns {string}
 */
function formatWatchedTime(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}-${md}`;
}

/**
 * 填充抽屉条目元信息（缓存大小 · 完整度 + 时钟图标时间）——renderDrawer 初渲
 * 与 refreshDrawerProgress 实时刷新共用（G-44-6：图标只替代「最近观看」四个字，
 * 时间文本始终可见；title 保留完整提示）
 * @param {HTMLElement} meta - .drawer-item-meta 元素
 * @param {Object} item - 抽屉条目数据
 */
function fillDrawerMeta(meta, item) {
  meta.textContent = '';
  const parts = [];
  if (item.cacheSize > 0) {
    parts.push(formatBytes(item.cacheSize) + (item.completeness != null ? ` · 完整度 ${Math.round(item.completeness)}%` : ''));
  } else {
    parts.push('未缓存');
  }
  meta.textContent = parts.join(' · ');
  const watched = formatWatchedTime(item.lastWatched);
  if (watched) {
    meta.appendChild(document.createTextNode(' · '));
    const watchedIcon = document.createElement('span');
    watchedIcon.className = 'drawer-item-watched';
    watchedIcon.title = `最近观看 ${watched}`;
    watchedIcon.innerHTML = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.75" stroke="currentColor" stroke-width="1.1" fill="none"/><path d="M6 3.6V6l1.8 1.1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    watchedIcon.appendChild(document.createTextNode(watched));
    meta.appendChild(watchedIcon);
  }
}

/**
 * 同步抽屉条目转换按钮（D-17/D-24）：分片齐全（完整度 100%）可见——隐藏而非
 * 置灰（UI-SPEC Disabled）；点击经主进程服务端复校后弹框选目录。AES-128 加密源
 * 同样显示：主进程有解密材料（key_hex）即解密转换，密钥缺失按 key_unavailable
 * 文案反馈。renderDrawer 初渲与实时刷新共用：完整度跨 100% 时增删按钮。
 * @param {HTMLElement} el - .drawer-item 元素
 * @param {Object} item - 抽屉条目数据
 */
function syncDrawerConvertButton(el, item) {
  const show = item.cacheSize > 0 && item.completeness != null && item.completeness >= 100;
  let convert = el.querySelector('.drawer-item-convert');
  if (!show) {
    if (convert) convert.remove();
    return;
  }
  if (convert) return;
  convert = document.createElement('button');
  convert.className = 'drawer-item-convert';
  convert.textContent = '转换为 MP4';
  convert.title = '转换为 MP4';
  convert.addEventListener('click', async (e) => {
    e.stopPropagation();
    convert.disabled = true;
    try {
      const r = await window.playerAPI.startConvert({ entryId: item.playbackKey });
      // cancelled = 用户在弹框取消，静默即可；其余失败主进程已补中文 error（UI Top2：
      // 主 CTA 不能无声失败，用户点了按钮必须看到反馈）
      if (r && r.ok === false && r.reason !== 'cancelled') {
        showError(`MP4 转换失败：${r.error || '未知原因'}`);
      }
    } catch (err) {
      showError(`MP4 转换失败：${err && err.message ? err.message : '未知原因'}`);
    } finally {
      convert.disabled = false;
    }
  });
  // 删除按钮之前插入（保持 转换 → 删除 的 DOM 序）
  const del = el.querySelector('.drawer-item-delete');
  el.insertBefore(convert, del || null);
}

/**
 * 抽屉条目标题（renderDrawer 初始渲染与 refreshDrawerProgress 就地刷新共用同一
 * fallback 语义：嗅探/上报标题 → URL 文件名 → 未知视频）
 * @param {Object} item - 抽屉条目
 * @returns {string}
 */
function drawerItemTitle(item) {
  return item.title || decodeURIComponent((item.url || '').split('/').pop().split('?')[0]) || '未知视频';
}

/**
 * 渲染抽屉列表（缓存库 + 观看历史合并、最近观看优先——44-01 player:drawer:list 契约）
 */
async function renderDrawer() {
  if (!window.playerAPI || !window.playerAPI.getDrawerList) return;
  let items = [];
  try {
    items = (await window.playerAPI.getDrawerList()) || [];
  } catch (e) {
    console.warn('[Realm Player] 抽屉列表获取失败:', e);
  }
  drawerList.innerHTML = '';
  drawerEmpty.classList.toggle('visible', items.length === 0);
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'drawer-item';
    // playbackKey 标记供实时刷新按条目定位（不重建 DOM，保住滚动位与 hover 态）
    el.dataset.playbackKey = item.playbackKey || '';

    const title = document.createElement('div');
    title.className = 'drawer-item-title';
    title.textContent = drawerItemTitle(item);
    title.title = title.textContent;
    el.appendChild(title);

    // 续播进度条：3px accent 填充（duration 未知时不显示）
    if (item.duration > 0) {
      const progress = document.createElement('div');
      progress.className = 'drawer-item-progress';
      const fill = document.createElement('div');
      fill.className = 'drawer-item-progress-fill';
      fill.style.width = `${Math.min(100, (item.lastPosition / item.duration) * 100)}%`;
      progress.appendChild(fill);
      el.appendChild(progress);
    }

    const meta = document.createElement('div');
    meta.className = 'drawer-item-meta';
    fillDrawerMeta(meta, item);
    el.appendChild(meta);

    syncDrawerConvertButton(el, item);

    // 删除按钮：hover 显示（aria-label「删除缓存」——UI-SPEC checker 建议 ②）
    const del = document.createElement('button');
    del.className = 'drawer-item-delete';
    del.setAttribute('aria-label', '删除缓存');
    del.title = '删除缓存';
    del.innerHTML = '<svg viewBox="0 0 12 12"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteConfirm(item);
    });
    el.appendChild(del);

    // 条目点击：关抽屉并按原 URL 加载（续播自动生效——initPlayerWithResume 的
    // D-12 链路：loadedmetadata 后 seek 到上次位置）
    el.addEventListener('click', () => {
      closeDrawer();
      if (item.url) initPlayerWithResume(item.url);
    });

    drawerList.appendChild(el);
  }
}

/** 抽屉缓存进度实时刷新间隔（播放中分片持续落盘，2s 轮询足够跟手且低耗） */
const DRAWER_PROGRESS_REFRESH_MS = 2000;

/** @type {number|null} 抽屉打开期间的进度轮询定时器 */
let drawerProgressTimer = null;

/**
 * 抽屉打开期间的缓存进度实时刷新：拉最新抽屉数据，按 playbackKey 命中已渲染
 * 条目就地更新元信息/转换按钮（不重建列表——重建会丢滚动位与 hover 态）。
 */
async function refreshDrawerProgress() {
  if (!window.playerAPI || !window.playerAPI.getDrawerList) return;
  let items = [];
  try {
    items = (await window.playerAPI.getDrawerList()) || [];
  } catch {
    return;
  }
  const byKey = new Map(items.map((it) => [it.playbackKey || '', it]));
  for (const el of drawerList.querySelectorAll('.drawer-item')) {
    const item = byKey.get(el.dataset.playbackKey || '');
    if (!item) continue;
    // 标题也要就地刷新——起播后 player:progress 才会把真实标题落进历史/缓存，
    // 开着的抽屉不更新标题会一直显示旧名（文件名兜底或上次会话残值）
    const titleEl = el.querySelector('.drawer-item-title');
    if (titleEl) {
      titleEl.textContent = drawerItemTitle(item);
      titleEl.title = titleEl.textContent;
    }
    const meta = el.querySelector('.drawer-item-meta');
    if (meta) fillDrawerMeta(meta, item);
    const fill = el.querySelector('.drawer-item-progress-fill');
    if (fill && item.duration > 0) {
      fill.style.width = `${Math.min(100, (item.lastPosition / item.duration) * 100)}%`;
    }
    syncDrawerConvertButton(el, item);
  }
}

function openDrawer() {
  drawerPanel.classList.add('open');
  renderDrawer();
  showControls();
  // 缓存进度实时刷新：播放中分片持续落盘，轮询就地更新条目（关抽屉即停）
  clearInterval(drawerProgressTimer);
  drawerProgressTimer = setInterval(refreshDrawerProgress, DRAWER_PROGRESS_REFRESH_MS);
}

function closeDrawer() {
  drawerPanel.classList.remove('open');
  clearInterval(drawerProgressTimer);
  drawerProgressTimer = null;
}

function toggleDrawer() {
  if (drawerPanel.classList.contains('open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

btnDrawer.addEventListener('click', toggleDrawer);
btnDrawerClose.addEventListener('click', closeDrawer);

/**
 * 打开删除缓存确认框（原生 dialog + showModal，AGENTS.md 弹框居中约定）
 * 默认文案按 UI-SPEC Copywriting Contract（逐字）：「删除缓存「{标题}」？观看历史保留，下次播放将重新缓存」；
 * 勾选「同时删除条目」后由 change 监听切换警示文案（G-44-8）。每次打开 checkbox 复位为不勾选。
 * @param {{ title: string, playbackKey: string }} item - 抽屉条目
 */
function openDeleteConfirm(item) {
  pendingDeleteKey = item.playbackKey || null;
  pendingDeleteTitle = item.title || '该视频';
  drawerDeleteEntry.checked = false;
  drawerDeleteText.textContent = `删除缓存「${pendingDeleteTitle}」？观看历史保留，下次播放将重新缓存`;
  drawerDeleteDialog.showModal();
}

// G-44-8：checkbox 勾选联动文案（绑定一次）
drawerDeleteEntry.addEventListener('change', () => {
  if (pendingDeleteTitle == null) return;
  drawerDeleteText.textContent = drawerDeleteEntry.checked
    ? `删除缓存「${pendingDeleteTitle}」？将同时删除观看历史条目，不可恢复`
    : `删除缓存「${pendingDeleteTitle}」？观看历史保留，下次播放将重新缓存`;
});

btnDrawerDeleteCancel.addEventListener('click', () => {
  pendingDeleteKey = null;
  pendingDeleteTitle = null;
  drawerDeleteDialog.close();
});

btnDrawerDeleteConfirm.addEventListener('click', async () => {
  const key = pendingDeleteKey;
  const deleteEntry = drawerDeleteEntry.checked;
  pendingDeleteKey = null;
  pendingDeleteTitle = null;
  drawerDeleteDialog.close();
  if (!key || !window.playerAPI || !window.playerAPI.deleteCacheEntry) return;
  try {
    // G-44-8：第二参透传勾选态（缺省/false = 仅删缓存 D-16 原语义；true = 连观看历史条目删除）
    const r = await window.playerAPI.deleteCacheEntry(key, deleteEntry);
    // IN-06：IPC 已把 historyDeleted 计入返回值——勾选「同时删除条目」却未删成功
    //（db 异常等）时不能静默，否则确认框承诺未兑现且续播进度会「复活」
    if (deleteEntry && r && r.historyDeleted === false) {
      showError('观看历史删除失败');
    }
  } catch (e) {
    // UI Top2：删除缓存失败不能在 UI 上静默（文件占用等 IPC 失败用户无感知）
    showError(`删除缓存失败：${e && e.message ? e.message : '未知原因'}`);
  }
  renderDrawer();
});

// Esc 关闭确认框时清理待删状态（dialog cancel 事件）
drawerDeleteDialog.addEventListener('cancel', () => {
  pendingDeleteKey = null;
  pendingDeleteTitle = null;
});

// webview tab 模式下录制/抽屉按钮隐藏（CSS 兜底已写，这里把 file:// 兜底加载
// 且无 playerAPI 的场景一并隐藏——通道不存在点了也无效）
if (!window.playerAPI || !window.playerAPI.startRecord) {
  btnRecord.style.display = 'none';
  btnDrawer.style.display = 'none';
}

// ==================== 双击全屏（D-13） ====================

/**
 * 双击视频区域切换全屏
 * 使用 300ms 延迟区分单击播放/暂停和双击全屏
 */
video.addEventListener('click', (e) => {
  // 抽屉打开时点击视频画面：只收起抽屉，不改变播放状态（不触发播放/暂停切换，
  // 也不排单击定时器——避免 300ms 后误 togglePlay）
  if (drawerPanel.classList.contains('open')) {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    closeDrawer();
    return;
  }
  if (clickTimer) {
    // 这是双击的第二次点击，由 dblclick 事件处理
    return;
  }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    // 300ms 内没有第二次点击，视为单击
    togglePlay();
  }, 300);
});

video.addEventListener('dblclick', (e) => {
  // 取消单击定时器
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  // 抽屉打开时双击：只收起抽屉，不进全屏
  if (drawerPanel.classList.contains('open')) {
    closeDrawer();
    return;
  }
  toggleFullscreen();
});

// ==================== 控制栏自动隐藏（D-03, Pattern 3） ====================

/**
 * 显示控制栏和标题栏
 */
function showControls() {
  controlsContainer.classList.add('visible');
  titleBar.classList.add('visible');
  state.controlsHidden = false;
}

/**
 * 隐藏控制栏和标题栏
 */
function hideControls() {
  // 暂停时不隐藏
  if (video.paused) return;
  // 拖拽进度条时不隐藏
  if (state.isDragging) return;
  // 倍速菜单打开时不隐藏
  if (speedMenu.classList.contains('visible')) return;
  // Phase 44：抽屉面板打开时不隐藏（UI-SPEC Component 3「打开时控制栏保持可见」）
  if (drawerPanel.classList.contains('open')) return;

  controlsContainer.classList.remove('visible');
  titleBar.classList.remove('visible');
  state.controlsHidden = true;
}

/**
 * 启动控制栏隐藏定时器
 */
function startHideTimer() {
  clearTimeout(hideTimer);
  showControls();
  hideTimer = setTimeout(hideControls, 3000);
}

// 鼠标移动：显示控制栏，重置隐藏定时器
playerContainer.addEventListener('mousemove', (e) => {
  // 忽略重复的 mousemove（微小移动不触发）
  showControls();
  startHideTimer();
});

// 鼠标离开：如果视频在播放则隐藏
playerContainer.addEventListener('mouseleave', () => {
  if (!video.paused) {
    hideControls();
  }
});

// 视频播放时启动隐藏定时器
video.addEventListener('play', () => {
  startHideTimer();
});

// ==================== 播放列表控制（D-16） ====================

/**
 * 更新播放列表上一个/下一个按钮状态
 */
function updatePlaylistButtons() {
  const hasPlaylist = state.mediaList.length > 1;
  btnPrev.style.display = hasPlaylist ? '' : 'none';
  btnNext.style.display = hasPlaylist ? '' : 'none';

  if (hasPlaylist) {
    btnPrev.classList.toggle('disabled', state.currentIndex <= 0);
    btnNext.classList.toggle('disabled', state.currentIndex >= state.mediaList.length - 1);
  }
}

/**
 * 播放上一个视频
 */
function playPrev() {
  if (state.currentIndex <= 0) return;
  state.currentIndex--;
  const url = state.mediaList[state.currentIndex].url;
  initPlayer(url);
}

/**
 * 播放下一个视频
 */
function playNext() {
  if (state.currentIndex >= state.mediaList.length - 1) return;
  state.currentIndex++;
  const url = state.mediaList[state.currentIndex].url;
  initPlayer(url);
}

btnPrev.addEventListener('click', playPrev);
btnNext.addEventListener('click', playNext);

// ==================== 键盘快捷键（D-12） ====================

document.addEventListener('keydown', (e) => {
  // 忽略输入框内的按键
  if (e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
      break;
    case 'ArrowRight':
      e.preventDefault();
      video.currentTime = Math.min(video.duration, video.currentTime + 5);
      break;
    case 'ArrowUp':
      e.preventDefault();
      video.volume = Math.min(1, video.volume + 0.05);
      break;
    case 'ArrowDown':
      e.preventDefault();
      video.volume = Math.max(0, video.volume - 0.05);
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    case 'm':
    case 'M':
      video.muted = !video.muted;
      break;
  }
});

// ==================== 资源释放（D-21, PLAYER-10） ====================

window.addEventListener('beforeunload', () => {
  // 销毁播放库实例
  if (currentEngine) {
    try {
      currentEngine.destroy();
    } catch (e) {
      console.error('[Realm Player] 销毁引擎失败:', e);
    }
    currentEngine = null;
  }

  // 释放原生视频资源
  video.src = '';
  video.load();

  // 清除所有定时器
  clearTimeout(hideTimer);
  clearTimeout(clickTimer);
});

// ==================== 自定义标题栏交互 ====================

// 关闭按钮
btnClose.addEventListener('click', () => {
  if (window.playerAPI && window.playerAPI.closeWindow) {
    window.playerAPI.closeWindow();
  }
});

// 最小化按钮
btnMinimize.addEventListener('click', () => {
  if (window.playerAPI && window.playerAPI.minimizeWindow) {
    window.playerAPI.minimizeWindow();
  }
});

// 最大化按钮
btnMaximize.addEventListener('click', async () => {
  if (window.playerAPI && window.playerAPI.maximizeWindow) {
    const result = await window.playerAPI.maximizeWindow();
    if (result && result.maximized) {
      btnMaximize.title = '还原';
    } else {
      btnMaximize.title = '最大化';
    }
  }
});

// ==================== 初始化完成 ====================

console.log('[Realm Player] 播放器脚本已加载');
