/**
 * Realm Browser - AI Bash 命令三档权限策略（纯函数引擎，零依赖）
 *
 * 三档裁决（evaluateBashCommand）：
 * - allow   ：拆段后所有段命中白名单（前缀通配或精确匹配）→ 免确认执行
 * - confirm ：存在危险段（DANGEROUS_PATTERNS / DANGEROUS_INTERPRETERS）
 *             → 强制确认，即使命中白名单也无效（danger）
 *             默认未命中白名单（default）
 *
 * 诚实边界：静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 $() 等），
 * 本引擎定位为「降低误执行概率」的启发式，不是安全边界。真正的安全边界是
 * 确认卡片 + agent-workspace 硬沙箱。
 */

/**
 * 命令段规范化：trim + 连续空白折叠为单空格（匹配口径统一）
 * @param {string} seg - 命令段
 * @returns {string} 规范化后的命令段
 */
function normalizeSegment(seg) {
  return String(seg || '').trim().replace(/\s+/g, ' ');
}

/**
 * 引号感知拆段：引号外的 ; && || | & 处拆分，引号内的分隔符按字面保留
 *
 * 规则：
 * - 单引号内一切字符字面（POSIX shell 语义，无转义）
 * - 双引号内除 \$ \` \" \\ 外字面，反斜杠转义下一字符
 * - 引号外反斜杠转义下一字符；&& || 两字符贪心匹配；孤立的 & 与 | 同样拆段
 * - 段 trim 后为空则跳过；引号字符在段内原样保留（危险词匹配需要看到真实命令）
 *
 * @param {string} cmd - 完整 bash 命令
 * @returns {string[]} 拆分后的命令段列表（可能为空）
 */
function splitCommandPipeline(cmd) {
  const text = String(cmd || '');
  const segments = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  const flush = () => {
    const seg = current.trim();
    if (seg) segments.push(seg);
    current = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inSingle) {
      if (ch === "'") inSingle = false;
      current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '\\' && i + 1 < text.length) {
        current += ch + text[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inDouble = false;
      current += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === '\\') {
      current += ch + (text[i + 1] || '');
      i++;
      continue;
    }
    if (ch === ';') {
      flush();
      continue;
    }
    if (ch === '&' || ch === '|') {
      if (text[i + 1] === ch) {
        flush();
        i++; // 两字符运算符（&& / ||）跳过第二个
      } else {
        flush();
      }
      continue;
    }
    current += ch;
  }
  flush();
  return segments;
}

/**
 * 提取命令段的命令名：跳过 KEY=VALUE 环境变量赋值前缀 token，
 * 首个 token 按 / 分割取 basename（./x.sh → x.sh）
 * @param {string} seg - 规范化后的命令段
 * @returns {string} 命令名；空段返回空字符串
 */
function extractCommandName(seg) {
  const tokens = normalizeSegment(seg).split(' ').filter(Boolean);
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_]\w*=/.test(tokens[i])) i++;
  if (i >= tokens.length) return '';
  const first = tokens[i];
  const base = first.split('/').pop();
  return base || first;
}

/**
 * 白名单匹配（主流语义，对齐 Claude Code Bash(brew:*) 类规则）：
 * - 裸条目按命令前缀匹配：'brew' 命中 'brew' 本身与 'brew info wget' 等
 *   以 'brew ' 开头的命令（空格边界保证不误中 'brewx'）
 * - '' *'' 结尾的条目同样按前缀匹配（'npm run *' ≡ 前缀 'npm run '），
 *   两种写法并存兼容；条目中间的 * 按字面处理（不做 glob）
 *
 * @param {string} seg - 规范化后的命令段
 * @param {string[]} list - 白名单条目列表
 * @returns {boolean} 是否命中
 */
function matchesWhitelist(seg, list) {
  if (!Array.isArray(list)) return false;
  const n = normalizeSegment(seg);
  if (!n) return false;
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const e = normalizeSegment(entry);
    if (!e) continue;
    // 'xxx *' / 'xxx*' 为显式通配写法：前缀匹配（'npm run *' → 前缀 'npm run '，
    // 含尾空格所以不误中 'npm runx'；'brew*' → 前缀 'brew'，允许 brewx）
    if (e.endsWith(' *')) {
      if (n.startsWith(e.slice(0, -1))) return true;
      continue;
    }
    if (e.endsWith('*')) {
      if (n.startsWith(e.slice(0, -1))) return true;
      continue;
    }
    // 裸条目：命令前缀语义——命中命令本身或「条目 + 空格」开头的一切命令
    // （'brew' 命中 'brew info wget'；空格边界保证不误中 'brewx'）
    if (n === e || n.startsWith(e + ' ')) return true;
  }
  return false;
}

/**
 * 危险命令模式表（对规范化后的段做词边界正则匹配）
 *
 * rm 全系入表而非仅 rm -rf：bash 的 rm 不经 FileSystem 沙箱（可删工作区外
 * 任意文件），且 rm file.txt 与 rm -rf dir 破坏力同级不可恢复。
 * 判定语义是「强制确认」而非「拒绝」——用户确认后仍执行。
 */
const DANGEROUS_PATTERNS = [
  { pattern: /\brm\b/, name: '删除文件（rm）' },
  { pattern: /\bsudo\b/, name: '提权执行（sudo）' },
  { pattern: /\bsu\s+\S/, name: '切换用户（su）' },
  { pattern: /\b(dd|mkfs\.\w+)\b/, name: '磁盘写入（dd/mkfs）' },
  { pattern: /\b(kill|killall|pkill)\b/, name: '终止进程（kill）' },
  { pattern: /\b(shutdown|reboot|halt)\b/, name: '系统电源控制' },
  { pattern: /\b(hdiutil|diskutil|launchctl|csrutil|nvram|pmset)\b/, name: '系统配置工具' },
  { pattern: /\b(chmod|chown|chflags)\b/, name: '权限变更（chmod/chown）' },
  { pattern: /\bdefaults\s+write\b/, name: '系统偏好写入（defaults write）' },
  // 重定向覆盖到根下非 tmp 路径（> /etc/xx、>> /Users/xx）；> /tmp/x 不拦
  { pattern: /(^|\s)>{1,2}\s*\/(?!tmp\b)/, name: '重定向覆盖系统路径' },
];

/**
 * 解释器执行命令名表：管道/组合命令中出现以解释器为命令名的段即视为危险
 * （curl x | sh、node -e ... 等把任意文本当代码执行的场景）
 */
const DANGEROUS_INTERPRETERS = new Set([
  'sh', 'bash', 'zsh', 'dash', 'eval', 'source',
  'osascript', 'python', 'python3', 'node', 'ruby', 'perl',
]);

/**
 * 判定单个命令段是否危险
 * @param {string} seg - 命令段（原始文本即可，内部会规范化）
 * @returns {string|null} 命中返回危险名称（中文），未命中返回 null
 */
function matchDangerous(seg) {
  const n = normalizeSegment(seg);
  if (!n) return null;
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(n)) return name;
  }
  const cmdName = extractCommandName(n);
  if (cmdName && DANGEROUS_INTERPRETERS.has(cmdName)) {
    return `解释器执行（${cmdName}）`;
  }
  return null;
}

/**
 * 三档裁决入口：拆段后逐段判定
 *
 * @param {string} command - 完整 bash 命令
 * @param {string[]} whitelist - 白名单条目列表
 * @returns {{level: 'allow'|'confirm', reason?: string, dangerNames: string[]}}
 *   任一段危险 → confirm/danger（白名单失效）；
 *   全部段命中白名单 → allow；
 *   否则 → confirm/default
 */
function evaluateBashCommand(command, whitelist) {
  const segments = splitCommandPipeline(command);
  if (segments.length === 0) {
    return { level: 'confirm', reason: 'empty', dangerNames: [] };
  }
  const dangerNames = [];
  for (const seg of segments) {
    const hit = matchDangerous(seg);
    if (hit) dangerNames.push(hit);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames };
  }
  const allAllowed = segments.every((seg) => matchesWhitelist(seg, whitelist));
  if (allAllowed) {
    return { level: 'allow', dangerNames: [] };
  }
  return { level: 'confirm', reason: 'default', dangerNames: [] };
}

/**
 * 校验白名单列表形状（设置页服务端双保险用）
 * @param {*} value - 待校验值
 * @returns {{valid: boolean, reason?: string}} 校验结果
 */
function validateWhitelistList(value) {
  if (!Array.isArray(value)) {
    return { valid: false, reason: 'aiBashWhitelist 必须是字符串数组' };
  }
  for (const v of value) {
    if (typeof v !== 'string' || !v.trim()) {
      return { valid: false, reason: '白名单条目必须是非空字符串' };
    }
    if (v.length > 200) {
      return { valid: false, reason: '白名单单条目不能超过 200 字符' };
    }
    if (/[\r\n\0]/.test(v)) {
      return { valid: false, reason: '白名单条目不能包含换行或控制字符' };
    }
  }
  return { valid: true };
}

module.exports = {
  normalizeSegment,
  splitCommandPipeline,
  extractCommandName,
  matchesWhitelist,
  matchDangerous,
  DANGEROUS_PATTERNS,
  DANGEROUS_INTERPRETERS,
  evaluateBashCommand,
  validateWhitelistList,
};
