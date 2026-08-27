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
const errorHint = document.getElementById('error-hint');
const errorText = document.getElementById('error-text');
const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
const btnMaximize = document.getElementById('btn-maximize');

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

  // 更新窗口标题为 {容器名} - {文件名}（肉眼可验证 D-22 容器隔离）
  const fileName = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const displayTitle = state.containerName ? `${state.containerName} - ${fileName}` : fileName;
  titleText.textContent = displayTitle;
  document.title = `Realm Player - ${displayTitle}`;

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
              showError('HLS 播放失败');
            }
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

// webview tab 模式（http 协议加载；独立窗口为 file://）下，hls.js 请求经
// /proxy 同源代理：播放器页面源是 localhost，直接 XHR 外部视频源会被 CORS 拦截，
// 且防盗链站点校验 Referer——代理由主进程 ses.fetch 发出，Referer 可控、
// 容器 session 携带 Cookie。m3u8 清单由代理重写，分片/密钥请求同样走代理
const isWebviewMode = location.protocol === 'http:' || location.protocol === 'https:';

/**
 * 将视频源 URL 转换为 /proxy 代理 URL（仅 webview tab 模式）
 * token/container/referer 从播放器页面 URL 透传
 * @param {string} url - 原始视频 URL
 * @returns {string} 代理 URL 或原 URL
 */
function proxiedUrl(url) {
  if (!isWebviewMode || !/^https?:\/\//i.test(url)) return url;
  const proxyUrl = new URL('/proxy', location.origin);
  proxyUrl.searchParams.set('url', url);
  for (const key of ['token', 'container', 'referer']) {
    const v = urlParams.get(key);
    if (v) proxyUrl.searchParams.set(key, v);
  }
  return proxyUrl.toString();
}

if (paramUrl) {
  // webview tab 模式：从 URL 参数读取播放地址，隐藏标题栏
  console.log('[Realm Player] webview tab 模式，URL 参数:', paramUrl);
  document.body.classList.add('webview-player');
  state.mediaList = [];
  state.containerId = '';
  state.containerName = '';
  state.currentIndex = 0;
  initPlayer(paramUrl);
} else if (window.playerAPI && window.playerAPI.onPlayUrl) {
  // 独立窗口模式：通过 IPC 接收播放数据
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

    initPlayer(data.url);
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

// ==================== 双击全屏（D-13） ====================

/**
 * 双击视频区域切换全屏
 * 使用 300ms 延迟区分单击播放/暂停和双击全屏
 */
video.addEventListener('click', (e) => {
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
