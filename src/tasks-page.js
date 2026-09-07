/**
 * Realm Browser - 媒体任务页面（realm://tasks）
 *
 * 通过 /api/tasks/* 同源 API 获取媒体任务（录制/转封装）列表，
 * 三区渲染（进行中/已完成/失败已中断）+ 5s 轮询刷新。
 * 参考 src/downloads-page.js 的数据获取模式。
 */

// ==================== 状态 ====================

/** @type {string} API 鉴权 token */
let realmToken = null;

/** @type {number|null} 轮询定时器 */
let pollTimer = null;

/** @type {number|null} 反馈条自动消失定时器（新操作覆盖重挂） */
let feedbackTimer = null;

// ==================== 主题同步 ====================

/**
 * 应用主题（与 settings-page.js 保持一致）
 * @param {string} theme - 主题值：'light', 'dark', 'system'
 */
function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = theme || 'light';
  }
}

/**
 * 同步主题设置
 * 从主进程获取当前主题并应用
 */
async function syncTheme() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    const res = await fetch(`/api/settings/get?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const settings = await res.json();
      applyTheme(settings.theme || 'light');

      if (settings.theme === 'system') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          applyTheme('system');
        });
      }
    }
  } catch (error) {
    console.error('[Realm] 同步主题失败:', error);
    applyTheme('light');
  }
}

// 立即同步主题，避免页面闪烁
syncTheme();

// ==================== 初始化 ====================

/**
 * 页面初始化入口
 * 从 URL 参数获取 token（createTab 经 realmUrlToHttp 注入），然后加载数据。
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  realmToken = params.get('token');

  if (!realmToken) {
    console.error('[Tasks Page] 缺少 token 参数');
    return;
  }

  bindZoneActions();

  await loadTasks();

  // 5s 轮询刷新（任务进度/终态无主动推送通道到 realm:// 页面，沿用轮询惯例）
  pollTimer = setInterval(loadTasks, 5000);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
}

/**
 * 绑定三区列表的事件委托（仅绑定一次）
 */
function bindZoneActions() {
  for (const zoneId of ['tasksRunningList', 'tasksCompletedList', 'tasksFailedList']) {
    const zoneEl = document.getElementById(zoneId);
    if (!zoneEl) continue;
    zoneEl.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-id]');
      if (!target) return;
      e.stopPropagation();

      // 停止/取消任务
      if (target.classList.contains('task-cancel-btn')) {
        await apiAction(`/api/tasks/cancel`, { taskId: target.dataset.id });
        return;
      }

      // 定位产物
      if (target.classList.contains('task-show-folder-btn')) {
        await apiAction(`/api/tasks/show-in-folder`, { taskId: target.dataset.id });
        return;
      }

      // 已落盘部分续转（44-05 落地前端点返回 404，此处仅透传错误）
      if (target.classList.contains('task-resume-convert-btn')) {
        await apiAction(`/api/tasks/convert-resume`, { taskId: target.dataset.id });
        return;
      }
    });
  }
}

// ==================== 数据加载 ====================

/**
 * 拉取任务列表并渲染三区
 */
async function loadTasks() {
  try {
    const response = await fetch(`/api/tasks/list?token=${realmToken}`);
    const data = await response.json();

    if (data.success) {
      renderTasks(data.tasks || []);
    } else {
      console.error('[Tasks Page] 获取任务列表失败:', data.error);
    }
  } catch (error) {
    console.error('[Tasks Page] 请求任务列表失败:', error);
  }
}

// ==================== 渲染 ====================

/**
 * 渲染三区任务列表 + 空状态
 * @param {Array} tasks - 任务快照数组（updatedAt 降序）
 */
function renderTasks(tasks) {
  const running = tasks.filter((t) => t.status === 'running');
  const completed = tasks.filter((t) => t.status === 'completed');
  const failed = tasks.filter((t) => ['failed', 'cancelled', 'interrupted'].includes(t.status));

  renderZone('tasksRunningSection', 'tasksRunningList', running);
  renderZone('tasksCompletedSection', 'tasksCompletedList', completed);
  renderZone('tasksFailedSection', 'tasksFailedList', failed);

  // 整页空态：无任何任务时隐藏三区、显示空态文案（UI-SPEC Copywriting Contract）
  const emptyEl = document.getElementById('tasksEmptyState');
  if (emptyEl) {
    if (tasks.length === 0) {
      emptyEl.classList.remove('hidden');
      for (const sectionId of ['tasksRunningSection', 'tasksCompletedSection', 'tasksFailedSection']) {
        const el = document.getElementById(sectionId);
        if (el) el.classList.add('hidden');
      }
    } else {
      emptyEl.classList.add('hidden');
    }
  }
}

/**
 * 渲染单个分区（空分区隐藏）
 * @param {string} sectionId - 分区容器 id
 * @param {string} listId - 列表容器 id
 * @param {Array} tasks - 分区内任务
 */
function renderZone(sectionId, listId, tasks) {
  const sectionEl = document.getElementById(sectionId);
  const listEl = document.getElementById(listId);
  if (!sectionEl || !listEl) return;

  if (tasks.length === 0) {
    sectionEl.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  sectionEl.classList.remove('hidden');
  listEl.innerHTML = tasks.map((task) => renderTaskCard(task)).join('');
}

/**
 * 渲染单个任务卡片
 * @param {Object} task - 任务快照
 * @returns {string} HTML 字符串
 */
function renderTaskCard(task) {
  const badge = renderStatusBadge(task.status);
  const typeLabel = task.type === 'record' ? '直播录制' : 'MP4 转换';

  // 进度条（仅 running 显示）
  let progressHtml = '';
  if (task.status === 'running') {
    const progress = Math.max(0, Math.min(100, task.progress || 0));
    progressHtml = `
      <div class="task-progress">
        <div class="task-progress-bar accent" style="width: ${progress}%"></div>
      </div>`;
  }

  // 失败原因
  let errorHtml = '';
  if (task.error && ['failed', 'interrupted'].includes(task.status)) {
    errorHtml = `<div class="task-error">${escapeHtml(task.error)}</div>`;
  }

  // 产物路径
  let pathHtml = '';
  if (task.outputPath) {
    pathHtml = `<div class="task-path" title="${escapeHtml(task.outputPath)}">${escapeHtml(task.outputPath)}</div>`;
  }

  return `
    <div class="task-card" data-id="${escapeHtml(task.id)}">
      <div class="task-card-header">
        <span class="task-badge ${task.status}">${badge}</span>
        <span class="task-type">${escapeHtml(typeLabel)}</span>
        <span class="task-time">${formatRelativeTime(Math.floor((task.updatedAt || 0) / 1000))}</span>
      </div>
      <div class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
      ${progressHtml}
      ${errorHtml}
      ${pathHtml}
      <div class="task-actions">${renderActions(task)}</div>
    </div>`;
}

/**
 * 渲染状态徽标文案（UI-SPEC Copywriting Contract，D-26）
 * @param {string} status - 任务状态
 * @returns {string} 状态文案
 */
function renderStatusBadge(status) {
  switch (status) {
    case 'running': return '进行中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    case 'cancelled': return '已取消';
    case 'interrupted': return '已中断';
    default: return status;
  }
}

/**
 * 渲染操作按钮
 * running：停止/取消；completed/interrupted：定位；record 任务（中断/失败/完成）额外：已落盘部分续转
 * @param {Object} task - 任务快照
 * @returns {string} HTML 字符串
 */
function renderActions(task) {
  let html = '';
  if (task.status === 'running') {
    html += `
      <button class="btn btn-secondary btn-sm task-cancel-btn" data-id="${escapeHtml(task.id)}">停止</button>`;
  } else if (task.status === 'completed' || task.status === 'interrupted') {
    if (task.outputPath) {
      html += `
        <button class="btn btn-secondary btn-sm task-show-folder-btn" data-id="${escapeHtml(task.id)}">定位</button>`;
    }
  }
  // 已落盘部分续转（D-22/D-18）：record 任务已中断/失败（崩溃不白录）或
  // 已完成（弹框取消后补转）均可再次发起转换——仅 record 类型（convert 无分片可续）
  if (task.type === 'record' &&
      (task.status === 'interrupted' || task.status === 'failed' || task.status === 'completed')) {
    html += `
      <button class="btn btn-primary btn-sm task-resume-convert-btn" data-id="${escapeHtml(task.id)}">已落盘部分续转</button>`;
  }
  return html;
}

// ==================== API 操作 ====================

/**
 * 执行 API 操作
 * @param {string} path - API 路径
 * @param {Object} body - 请求体
 */
async function apiAction(path, body = {}) {
  try {
    const response = await fetch(`${path}?token=${realmToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (data.success) {
      await loadTasks();
      return true;
    }
    console.error(`[Tasks Page] API 操作失败: ${path}`, data.error);
    showTaskFeedback(data.error || '操作失败，请重试');
    await loadTasks();
    return false;
  } catch (error) {
    console.error(`[Tasks Page] API 请求失败: ${path}`, error);
    showTaskFeedback('请求失败，请重试');
    return false;
  }
}

/**
 * 展示任务页操作失败反馈条（G-44-9：不做无声失败）
 * textContent 写入（零 HTML 解析，防后端 error 字符串注入）；
 * 移除 hidden 显示，4s 自动恢复隐藏；新操作覆盖旧反馈——定时器先清
 * 再重挂，文案立即被新内容替换
 * @param {string} message - 反馈文案（后端 error 字段或兜底文案）
 */
function showTaskFeedback(message) {
  const el = document.getElementById('taskFeedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    el.classList.add('hidden');
    feedbackTimer = null;
  }, 4000);
}

// ==================== 工具函数 ====================

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * 格式化相对时间
 * @param {number} timestamp - Unix 时间戳（秒）
 * @returns {string} 相对时间文本
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';

  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ==================== 启动 ====================

document.addEventListener('DOMContentLoaded', init);
