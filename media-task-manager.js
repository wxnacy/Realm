/**
 * media-task-manager — 媒体任务统一注册表（Phase 44，D-25）
 *
 * record（直播录制）+ convert（mp4 转封装）统一状态机注册表：
 * running → completed/failed/cancelled/interrupted，非法流转拒绝；
 * 每次变更经注入的 persist 回调持久化（44-03 集成层写 userData/media-tasks.json）；
 * restoreTasks 支撑 D-18 崩溃重启「已中断」语义；onTaskCompleted 是 D-22
 * record→convert 接力的注册点；isVideoActive 是 D-07 逐视频淘汰豁免的查询源
 * （44-03 注入 media-cache-manager 构造参数）。
 *
 * **去 Electron 化**：顶层无 electron/原生 require，persist/now 均为注入依赖 ——
 * 纯 Node 可加载可测试（44-VALIDATION Wave 0 硬约束）。
 * 本注册表只管状态机与持久化，不含 IO；并发上限与同 URL 去重属 44-04
 * 录制引擎职责（单一职责）。
 */

const crypto = require('crypto');

/** 合法任务类型 */
const TASK_TYPES = ['record', 'convert'];

/** 合法任务状态 */
const TASK_STATUSES = ['running', 'completed', 'failed', 'cancelled', 'interrupted'];

/** 终态集合：进入后不可再流转 */
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'interrupted'];

/** restoreTasks 白名单字段（T-44-05：未知字段丢弃，防伪造字段注入） */
const RESTORE_FIELDS = [
  'id',
  'type',
  'title',
  'containerId',
  'playbackKey',
  'status',
  'progress',
  'outputPath',
  'error',
  'createdAt',
  'updatedAt',
];

/**
 * 创建媒体任务注册表
 * @param {Object} deps - 注入依赖
 * @param {Function} [deps.persist] - 持久化回调，每次变更后以 listTasks() 快照调用（同步或返回 Promise 均可）
 * @param {Function} [deps.now] - 时间源，缺省 Date.now
 * @returns {{ registerTask: Function, updateProgress: Function, completeTask: Function, failTask: Function, cancelTask: Function, markInterrupted: Function, restoreTasks: Function, listTasks: Function, hasActiveTasks: Function, isVideoActive: Function, onTaskCompleted: Function }}
 */
function createMediaTaskManager({ persist, now } = {}) {
  const timeSource = typeof now === 'function' ? now : Date.now;
  const tasks = new Map(); // id -> task
  const completedHooks = [];

  /** 触发 persist（异常吞掉不阻断任务状态机，仅告警） */
  function runPersist() {
    if (typeof persist !== 'function') return;
    try {
      const result = persist(listTasks());
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          console.warn('[Realm] media-task-manager persist 失败:', err.message);
        });
      }
    } catch (err) {
      console.warn('[Realm] media-task-manager persist 失败:', err.message);
    }
  }

  /**
   * 深冻结不可行，返回浅拷贝快照即可隔离内部 Map 引用
   */
  function snapshot(task) {
    return { ...task };
  }

  /** 按 updatedAt 降序的快照列表 */
  function listTasks() {
    return Array.from(tasks.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(snapshot);
  }

  /** 校验任务存在且处于 running 态，返回内部任务对象（非法流转拒绝，D-25） */
  function requireRunning(id) {
    const task = tasks.get(id);
    if (!task) throw new Error(`任务不存在: ${id}`);
    if (task.status !== 'running') {
      throw new Error(`非法流转: 任务 ${id} 已处于终态 ${task.status}，不可再变更`);
    }
    return task;
  }

  /** 应用终态流转：更新字段 + updatedAt + persist */
  function applyTransition(id, patch) {
    const task = requireRunning(id);
    Object.assign(task, patch, { updatedAt: timeSource() });
    runPersist();
    return snapshot(task);
  }

  /**
   * 注册新任务（running 态）
   * @param {Object} input - { type: 'record'|'convert', title, containerId, playbackKey?, progress? }
   * @returns {Object} 任务对象快照
   */
  function registerTask(input) {
    const { type, title, containerId } = input || {};
    if (!TASK_TYPES.includes(type)) {
      throw new Error(`非法任务类型: ${type}（允许: ${TASK_TYPES.join('/')}）`);
    }
    if (typeof title !== 'string' || !title) {
      throw new Error('任务 title 必须为非空字符串');
    }
    const ts = timeSource();
    const task = {
      id: crypto.randomUUID(),
      type,
      title,
      containerId: containerId || '',
      playbackKey: typeof input.playbackKey === 'string' && input.playbackKey ? input.playbackKey : null,
      status: 'running',
      progress: typeof input.progress === 'number' ? input.progress : 0,
      outputPath: null,
      error: null,
      createdAt: ts,
      updatedAt: ts,
    };
    tasks.set(task.id, task);
    runPersist();
    return snapshot(task);
  }

  /**
   * 更新任务进度（running 态）
   * @param {string} id - 任务 id
   * @param {number} progress - 进度（0-100）
   */
  function updateProgress(id, progress) {
    if (typeof progress !== 'number' || Number.isNaN(progress)) {
      throw new Error('progress 必须为数字');
    }
    return applyTransition(id, { progress });
  }

  /**
   * 完成任务（D-22 接力挂点：触发全部 onTaskCompleted 回调）
   * @param {string} id - 任务 id
   * @param {Object} [result] - { outputPath? }
   */
  function completeTask(id, result) {
    const task = applyTransition(id, {
      status: 'completed',
      progress: 100,
      outputPath: result && result.outputPath != null ? result.outputPath : null,
      error: null,
    });
    for (const hook of completedHooks) {
      try {
        hook(task);
      } catch (err) {
        console.warn('[Realm] media-task-manager onTaskCompleted 回调失败:', err.message);
      }
    }
    return task;
  }

  /** 任务失败（D-18：网络错误重试 N 次后停录等） */
  function failTask(id, error) {
    return applyTransition(id, {
      status: 'failed',
      error: error != null ? String(error) : null,
    });
  }

  /** 任务取消（用户停止录制等） */
  function cancelTask(id, error) {
    return applyTransition(id, {
      status: 'cancelled',
      error: error != null ? String(error) : null,
    });
  }

  /**
   * 标记任务已中断（D-18 崩溃重启语义；restoreTasks 内部也走这里）
   * @param {string} id - 任务 id
   */
  function markInterrupted(id) {
    return applyTransition(id, { status: 'interrupted' });
  }

  /**
   * 从持久化 JSON 恢复注册表（D-18：崩溃重启调用）
   * 字段类型白名单校验（T-44-05），未知字段丢弃、非法条目跳过；
   * saved 中 running 任务恢复后标记 interrupted，outputPath 保留供续转。
   * @param {string} savedJson - 持久化的任务列表 JSON
   * @returns {Array} 恢复后的任务快照列表
   */
  function restoreTasks(savedJson) {
    let arr = null;
    try {
      arr = JSON.parse(savedJson);
    } catch {
      return [];
    }
    if (!Array.isArray(arr)) return [];

    const ts = timeSource();
    for (const item of arr) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      if (typeof item.id !== 'string' || !item.id) continue;
      if (!TASK_TYPES.includes(item.type)) continue;
      if (!TASK_STATUSES.includes(item.status)) continue;
      if (typeof item.title !== 'string' || !item.title) continue;

      const task = {};
      for (const field of RESTORE_FIELDS) {
        if (field in item) task[field] = item[field];
      }
      task.id = item.id;
      task.type = item.type;
      task.title = item.title;
      task.status = item.status === 'running' ? 'interrupted' : item.status;
      task.containerId = typeof task.containerId === 'string' ? task.containerId : '';
      task.playbackKey = typeof task.playbackKey === 'string' && task.playbackKey ? task.playbackKey : null;
      task.progress = typeof task.progress === 'number' && !Number.isNaN(task.progress) ? task.progress : 0;
      task.outputPath = typeof task.outputPath === 'string' ? task.outputPath : null;
      task.error = typeof task.error === 'string' ? task.error : null;
      task.createdAt = typeof task.createdAt === 'number' ? task.createdAt : ts;
      task.updatedAt = typeof task.updatedAt === 'number' ? task.updatedAt : ts;
      tasks.set(task.id, task);
    }
    runPersist();
    return listTasks();
  }

  /** 是否存在 running 任务（D-19 应用退出确认的数据源） */
  function hasActiveTasks() {
    for (const task of tasks.values()) {
      if (task.status === 'running') return true;
    }
    return false;
  }

  /**
   * 查询某视频（playbackKey）是否被 running 任务占用
   * D-07 逐视频淘汰豁免的查询源：44-03 把本方法注入 media-cache-manager
   * 构造参数；任务进入终态后豁免自动解除。本模块不得反向依赖 media-cache-manager。
   * @param {string} playbackKey - origin+pathname 语义的播放 key（与 44-01 一致）
   * @returns {boolean}
   */
  function isVideoActive(playbackKey) {
    if (typeof playbackKey !== 'string' || !playbackKey) return false;
    for (const task of tasks.values()) {
      if (task.status === 'running' && task.playbackKey === playbackKey) return true;
    }
    return false;
  }

  /**
   * 注册 completed 接力回调（D-22 record→convert 派生挂点，可注册多个）
   * @param {Function} hook - 回调，入参为 completed 任务快照
   * @returns {Function} 取消注册函数
   */
  function onTaskCompleted(hook) {
    if (typeof hook !== 'function') return () => {};
    completedHooks.push(hook);
    return () => {
      const idx = completedHooks.indexOf(hook);
      if (idx !== -1) completedHooks.splice(idx, 1);
    };
  }

  return {
    registerTask,
    updateProgress,
    completeTask,
    failTask,
    cancelTask,
    markInterrupted,
    restoreTasks,
    listTasks,
    hasActiveTasks,
    isVideoActive,
    onTaskCompleted,
  };
}

module.exports = { createMediaTaskManager, TASK_TYPES, TASK_STATUSES, TERMINAL_STATUSES };
