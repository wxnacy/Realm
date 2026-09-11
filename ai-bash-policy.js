/**
 * Realm Browser - AI Bash 命令三档权限策略（纯函数引擎，零依赖）
 *
 * 三档裁决（evaluateBashCommand）：
 * - allow   ：拆段后所有段命中白名单（前缀通配或精确匹配）→ 免确认执行
 * - confirm ：强制确认，即使命中白名单也无效。本档有**两个互不包含的触发源**：
 *             ① 危险命令表（DANGEROUS_PATTERNS / DANGEROUS_INTERPRETERS）→ reason 'danger'
 *                语义：本机破坏性操作（rm / sudo / chmod …）
 *             ② 包管理器安装表（PACKAGE_MANAGER_INSTALL_PATTERNS）→ reason 'install'
 *                语义：从网络获取并执行第三方代码（npx / npm i / pip install / brew install …）
 *             默认未命中白名单 → reason 'default'
 *
 * 档位数量仍是**三档**：level 只有 'allow' / 'confirm' 两个取值，上述 ①② 是
 * 第三档内的 reason 细分（互不包含），不是新的 level。
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
 * 包管理器安装模式表（SEC-01 / D-13 / D-14 / D-16）
 *
 * ① 定位：与 DANGEROUS_PATTERNS **平行但语义分离** —— 危险表表达「本机破坏性操作」
 *    （rm / sudo / chmod …），本表表达「从网络获取并执行第三方代码」。二者命中同样
 *    强制确认（reason 分别为 'danger' / 'install'），但确认卡片的 title 与文案必须
 *    能区分（见 ai-manager.js 的三分支），否则 `brew install wget` 与 `rm -rf` 在
 *    UI 上无法区分。
 *
 * ② 为什么 `curl … | sh` **不收录**在本表：管道右侧的 `sh` / `bash` 已经在
 *    DANGEROUS_INTERPRETERS 里，danger 分支先于 install 分支返回 —— 收录进来会是一条
 *    **永不触发的死模式**，只会掩盖真实判据。「下载并管道执行」的文本扫描器在技能侧
 *    （builtin-skills-seeder 的禁用词表），与本表无关。**不要「补上这个遗漏」。**
 *
 * ③ 匹配粒度 = 命令名 + 子命令，且只匹配安装 / 包执行语义的子命令。裸命令名
 *    （`npm` 不带子命令时只会打印帮助）与只读子命令（run / test / ls / view / audit /
 *    outdated / init / info / list / search / show）**刻意不命中** —— 误伤
 *    `npm run dev` 这类日常命令会驱动用户把 `npm` 整个加进白名单，反而一次性放开
 *    安装档（D-16）。旗标容忍片段 `(?:\s+-\S+(?:\s+(?!-)\S+)?)*` 让 `npm -g i x` /
 *    `npm --prefix ./app i x` / `pnpm --filter a add b` / `brew --quiet install x` 也被
 *    覆盖；它消费的每一组 token 都以 `-` 起头（一组 = 旗标 + 至多一个取值 token），
 *    因此**不会吞掉子命令本身**。
 *
 * ④ 为什么 `npm ci` **计入**安装档：它从 lockfile 恢复依赖、不取新代码，但**会执行所有
 *    依赖的 `postinstall` 脚本** —— 「不取新代码」不等于「不执行任意代码」。这正是它
 *    与 `npm run` 待遇不同的原因：前者必然触发依赖的安装生命周期脚本，后者只跑项目
 *    自己定义的脚本。
 *
 * ⑤ 维护约定：新增包管理器家族 = 在下面的数组里追加一条 `{ pattern, name }`，
 *    **不需要**改 evaluateBashCommand 的流水线结构（install 的收集与短路是通用的）。
 *
 * ⑥ **表内顺序即优先级**（matchInstall 首次命中即返回）：复合家族（`python -m pip install`、
 *    `uv pip install`）必须排在通用的 `pip3? install` **之前**，否则 `uv pip install x` 会被
 *    更早的 pip 条目命中、卡片上标出错误的家族名。新增条目时把更具体的模式放在前面。
 */
const PACKAGE_MANAGER_INSTALL_PATTERNS = [
  { pattern: /\bnpx\b/, name: '包执行器（npx）' },
  { pattern: /\bnpm\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(i|install|ci|exec|add)\b/, name: 'npm 安装依赖' },
  { pattern: /\bpnpm\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|i|dlx|exec)\b/, name: 'pnpm 安装依赖' },
  { pattern: /\byarn\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|dlx|exec)\b/, name: 'yarn 安装依赖' },
  { pattern: /\bbun\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|x|i)\b/, name: 'bun 安装依赖' },
  { pattern: /\bpython3?\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+-m\s+pip\s+install\b/, name: 'python -m pip 安装包' },
  { pattern: /\buv\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+(pip\s+install|add|tool\s+install|sync)\b/, name: 'uv 安装包' },
  { pattern: /\buvx\b/, name: 'uv 包执行器（uvx）' },
  { pattern: /\bpip3?\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+install\b/, name: 'pip 安装包' },
  { pattern: /\bbrew\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+(install|upgrade|reinstall)\b/, name: 'Homebrew 安装包' },
  { pattern: /\bcargo\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+install\b/, name: 'cargo 安装包' },
  { pattern: /\bgo\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+install\b/, name: 'go 安装包' },
  { pattern: /\bgem\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+install\b/, name: 'gem 安装包' },
];

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
 * 命令段首 token 的引号剥离（**只在 matchInstall 内部使用**）
 *
 * 用途：覆盖 `'npm' i x` / `"pip3" install x` 这类**用 shell 引号包裹命令名**的形态 ——
 * 不剥离则引号会插在命令名与子命令之间，`\bnpm\b(?:…)\s+\binstall\b` 的衔接错位，
 * 安装档会漏检。
 * 边界：只剥离开头一对引号、且引号内须是命令字形态（`[A-Za-z][\w.-]*`）；
 * `echo "npm install"` 这类字面量不会被它改写。
 * **不要**把它提到 normalizeSegment 层做统一处理 —— 那会同时移动 matchDangerous 与
 * matchesWhitelist 的匹配口径，而这两者的行为由既有断言（32 例）锁定。
 *
 * @param {string} seg - 命令段
 * @returns {string} 剥离首 token 引号后的命令段
 */
function stripLeadingQuotes(seg) {
  return normalizeSegment(seg).replace(/^(['"])([A-Za-z][\w.-]*)\1/, '$2');
}

/**
 * 判定单个命令段是否为包管理器安装 / 包执行
 * @param {string} seg - 命令段（原始文本即可，内部会规范化）
 * @returns {string|null} 命中返回安装档名称（中文），未命中返回 null
 */
function matchInstall(seg) {
  const n = stripLeadingQuotes(seg);
  if (!n) return null;
  for (const { pattern, name } of PACKAGE_MANAGER_INSTALL_PATTERNS) {
    if (pattern.test(n)) return name;
  }
  return null;
}

/**
 * 三档裁决入口：拆段后逐段判定
 *
 * 返回顺序（固定，不可调换）：
 * 1. 空命令 → confirm/empty
 * 2. 任一段危险 → confirm/danger（**先于 install**：'sudo npm i x' 是 danger）
 * 3. 任一段命中安装档 → confirm/install（**先于 matchesWhitelist** —— 白名单不可越过安装档）
 * 4. 全部段命中白名单 → allow
 * 5. 否则 → confirm/default
 *
 * 形状：**所有分支**都返回 installNames（完整形状，消费方无需做存在性判断）。
 *
 * @param {string} command - 完整 bash 命令
 * @param {string[]} whitelist - 白名单条目列表
 * @returns {{level: 'allow'|'confirm', reason?: string, dangerNames: string[], installNames: string[]}}
 *   任一段危险 → confirm/danger（白名单失效）；
 *   任一段命中安装档 → confirm/install（白名单失效）；
 *   全部段命中白名单 → allow；
 *   否则 → confirm/default
 */
function evaluateBashCommand(command, whitelist) {
  const segments = splitCommandPipeline(command);
  if (segments.length === 0) {
    return { level: 'confirm', reason: 'empty', dangerNames: [], installNames: [] };
  }
  const dangerNames = [];
  const installNames = [];
  for (const seg of segments) {
    const danger = matchDangerous(seg);
    if (danger) dangerNames.push(danger);
    const install = matchInstall(seg);
    if (install) installNames.push(install);
  }
  if (dangerNames.length > 0) {
    return { level: 'confirm', reason: 'danger', dangerNames, installNames };
  }
  if (installNames.length > 0) {
    return { level: 'confirm', reason: 'install', dangerNames, installNames };
  }
  const allAllowed = segments.every((seg) => matchesWhitelist(seg, whitelist));
  if (allAllowed) {
    return { level: 'allow', dangerNames: [], installNames: [] };
  }
  return { level: 'confirm', reason: 'default', dangerNames: [], installNames: [] };
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
  PACKAGE_MANAGER_INSTALL_PATTERNS,
  matchInstall,
  evaluateBashCommand,
  validateWhitelistList,
};
