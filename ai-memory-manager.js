/**
 * Realm Browser - AI 记忆管理模块
 *
 * 管理三层条目式持久记忆（per docs/plan/ai-memory-system.md D-01~D-11）：
 * - 用户画像：USER.md（全局一份，冻结快照注入 system prompt）
 * - 全局记忆：MEMORY.md（全局一份，冻结快照注入 system prompt）
 * - 容器记忆：memories/<containerId>.md（每容器一份，懒创建，按需读取不进 prompt）
 *
 * 条目格式：`[M1] 内容`（编号写入磁盘文件格式，D-09；稳定编号不回收 D-10）。
 * 全部为同步 fs 操作（单文件 ≤ 各层字符预算，<1ms），写入用 tmp+rename 原子替换。
 * 校验失败一律 throw（fail-closed）——调用方（pi-agent-core 工具 execute）抛出的
 * 错误会以 isError:true 的 toolResult 回给 LLM，不得返回错误文本冒充成功。
 */

const fs = require('fs');
const path = require('path');

/** 各层字符预算（D-07/D-08 全项目唯一来源；单位按 JS string.length 计数） */
const BUDGETS = { user: 1375, global: 2200, container: 2200 };

/** 合法容器 ID 形态（防路径穿越：containerId 直接拼接文件名） */
const CONTAINER_ID_RE = /^[\w-]+$/;

/** 条目编号行首匹配（D-09 编号定位语义） */
const ENTRY_LINE_RE = /^\[M(\d+)\]\s?/;

/** 基目录覆写（测试注入；null 表示回落默认 userData/ai-memory） */
let _baseDirOverride = null;

/**
 * 解析记忆基目录
 *
 * electron app 依赖惰性获取：纯 Node 环境（node:test）下 require('electron')
 * 不可加载，必须延迟到真正需要路径时才 require。
 *
 * @returns {string} 记忆基目录
 */
function getBaseDir() {
  if (_baseDirOverride) return _baseDirOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'ai-memory');
}

/**
 * 覆写记忆基目录（测试临时目录注入唯一入口，经 test/memory/helpers.js 调用）
 * @param {string|null} dir - 基目录绝对路径；null 恢复默认 userData 路径
 */
function setBaseDir(dir) {
  _baseDirOverride = dir;
}

/**
 * 解析某层记忆对应的磁盘文件路径
 * @param {string} target - 记忆层：'user' | 'global' | 'container'
 * @param {string} [containerId] - container 层必填
 * @returns {string} 文件绝对路径
 * @throws {Error} target 非法、container 层缺 containerId 或 containerId 非法
 */
function resolveFile(target, containerId) {
  const base = getBaseDir();
  if (target === 'user') return path.join(base, 'USER.md');
  if (target === 'global') return path.join(base, 'MEMORY.md');
  if (target === 'container') {
    if (!containerId || !CONTAINER_ID_RE.test(containerId)) {
      throw new Error(`非法的容器 ID: ${containerId}`);
    }
    return path.join(base, 'memories', `${containerId}.md`);
  }
  throw new Error(`未知的记忆层 target: ${target}（合法值：user / global / container）`);
}

/**
 * 原子写盘：mkdir 懒创建 → 写临时文件 → rename 原子替换（T-43-04）
 * @param {string} file - 目标文件绝对路径
 * @param {string} content - 完整文件内容
 */
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/**
 * 读取文本文件，不存在返回 null
 * @param {string} file - 文件绝对路径
 * @returns {string|null} 文件内容或 null
 */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * 解析条目：按行首编号提取（D-09 编号定位语义）
 * @param {string} text - 记忆文件全文
 * @returns {Array<{id: string, num: number, line: string}>} 条目列表
 */
function parseEntries(text) {
  const entries = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(ENTRY_LINE_RE);
    if (m) {
      entries.push({ id: `M${m[1]}`, num: parseInt(m[1], 10), line });
    }
  }
  return entries;
}

/**
 * 写入记忆条目（fail-closed：业务校验失败一律 throw）
 *
 * target:'container' 的 containerId 由调用方（工具 execute）按当时活跃容器
 * 解析后传入（D-02 调用时解析语义），manager 不自行推断。
 *
 * @param {{action: string, target: string, content?: string, entryId?: string, containerId?: string}} params - 写入参数
 * @returns {{entryId: string, budget: number, remaining: number}} 写入结果与预算余量
 * @throws {Error} 参数非法 / 超出该层字符预算（D-07/D-08）
 */
function write(params) {
  const { action, target, content, containerId } = params || {};
  if (target !== 'user' && target !== 'global' && target !== 'container') {
    throw new Error(`未知的记忆层 target: ${target}（合法值：user / global / container）`);
  }
  if (action !== 'add') {
    throw new Error(`暂不支持的写入操作: ${action}（当前仅支持 add）`);
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('add 操作缺少 content 参数，请提供条目正文');
  }

  const file = resolveFile(target, containerId);
  const existing = readText(file) || '';
  const entries = parseEntries(existing);
  const budget = BUDGETS[target];
  const nextNum = entries.reduce((max, e) => Math.max(max, e.num), 0) + 1;
  const base = existing ? (existing.endsWith('\n') ? existing : `${existing}\n`) : '';
  const merged = `${base}[M${nextNum}] ${content.trim()}\n`;

  if (merged.length > budget) {
    throw new Error(`记忆已达字符上限（${budget}），写入被拒绝。请先整理旧记忆（用 replace 或 remove）再添加新条目`);
  }

  atomicWrite(file, merged);
  return { entryId: `M${nextNum}`, budget, remaining: budget - merged.length };
}

/**
 * 读取容器记忆全文
 * @param {string} containerId - 容器 ID
 * @returns {string|null} 文件内容；文件不存在返回 null（空态由调用方翻译文案）
 */
function readContainer(containerId) {
  return readText(resolveFile('container', containerId));
}

/**
 * 构建全局两层冻结快照（D-03/D-04）
 *
 * 必须保持同步函数：Agent 创建路径（initialState.systemPrompt 组装处）
 * 不可异步化——动态 import 后 this.agent 在微任务才赋值，同步帧内恒 null
 * （G-42-4 实录）。只读 USER.md + MEMORY.md 两层，容器记忆不进快照（D-03）。
 *
 * @returns {string} XML 风格快照段 + 容器记忆索引指引
 */
function buildGlobalSnapshot() {
  const userText = (readText(resolveFile('user')) || '').trim();
  const globalText = (readText(resolveFile('global')) || '').trim();
  const lines = [
    '<persistent-memory>',
    '## 用户画像（USER.md）',
    userText || '（暂无内容）',
    '## 全局记忆（MEMORY.md）',
    globalText || '（暂无内容）',
    '</persistent-memory>',
    '',
    '## 容器记忆指引',
    '各容器有独立持久记忆。处理容器相关任务前，先调用 memory_read 读取容器记忆'
      + '（可传 containerId；省略时读当前活跃容器）。多容器任务对每个涉及的容器各读一次。',
  ];
  return lines.join('\n');
}

module.exports = {
  BUDGETS,
  setBaseDir,
  resolveFile,
  parseEntries,
  write,
  readContainer,
  buildGlobalSnapshot,
};
