/**
 * Realm Browser - AI Bash 命令三档权限策略（纯函数引擎，零依赖）
 *
 * 三档裁决（evaluateBashCommand）：
 * - allow   ：拆段后所有段命中白名单（前缀通配或精确匹配）→ 免确认执行
 * - confirm ：强制确认，即使命中白名单也无效。本档有**两个互不包含的触发源**：
 *             ① 危险命令表（DANGEROUS_PATTERNS / DANGEROUS_INTERPRETERS）→ reason 'danger'
 *                语义：本机破坏性操作（rm / sudo / chmod …）
 *             ② 包管理器安装档（PACKAGE_MANAGER_TOOLS / matchInstall）→ reason 'install'
 *                语义：从网络获取并执行第三方代码（npx / npm i / pip install / brew install …）。
 *                **判定规则是默认拒绝** —— 首 token（跳过 KEY=VALUE 赋值前缀、取 basename）
 *                命中包管理器工具集时，除该工具的**显式只读子命令**外一律强制确认；
 *                匹配前先做一次共用词法归一化（stripShellQuoting：去反斜杠转义 + 去引号），
 *                使 `brew "install" wget` 这类 argv 与 `brew install wget` 等价的写法判定相同。
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
 * - **空前缀条目一律跳过**（WR-01 设计性契约变更）：条目去掉尾部 `*` 后若只剩空白
 *   （单独的 `*` 或 ` *`），其前缀为空串 → `startsWith('')` 恒真 → 整份白名单退化为
 *   **全放行**（实测 `cat ~/.ssh/id_rsa` / `curl -o /tmp/x http://…` 全部 allow）。
 *   匹配层跳过它作为最后一道防御；权威校验在 `validateWhitelistList`（服务端），
 *   该函数直接拒绝这类条目。
 *
 * **变更边界**：本处只影响「前缀为空」这一退化输入；**没有**改变引号 / 反斜杠的匹配口径
 * （仍按原始文本做前缀匹配），既有 32 例断言逐条保持通过。
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
      const prefix = e.slice(0, -1);
      // WR-01：` *` 去尾 * 后只剩空白 → 空前缀 → startsWith('') 恒真 → 全放行，跳过
      if (!prefix.trim()) continue;
      if (n.startsWith(prefix)) return true;
      continue;
    }
    if (e.endsWith('*')) {
      const prefix = e.slice(0, -1);
      // WR-01：单独的 `*` → 空前缀 → 全放行，跳过（不做成通配一切）
      if (!prefix.trim()) continue;
      if (n.startsWith(prefix)) return true;
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
 * 旗标容忍片段（**共用**：纵深表 PACKAGE_MANAGER_INSTALL_PATTERNS 与只读正则 readOnlyRes
 * 使用同一份定义，防止两层口径漂移）。
 *
 * 语义：消费零到多组「旗标 + 至多一个取值 token」，每组都以 `-` 起头 ——
 * 因此 `npm -g i x` / `npm --prefix ./app i x` / `pnpm --filter a add b` 也能被覆盖。
 *
 * **结构性代价（具名残余）**：取值槽与子命令在词法上不可区分 ——
 * `pnpm --filter a run build` 的 `a` 是取值（既有锁定负例要求它判只读），
 * 同一机制会让 `npm -g install list` 被读成「旗标 `-g` 取值 `install`、子命令 `list`」。
 * 缓解手段是 matchInstall 内的**纵深优先**（先跑本表，命中即返回），
 * 残余部分写在 PACKAGE_MANAGER_TOOLS 的 JSDoc ⑤ 与三份用户文档的残余段。
 */
const FLAG_TOLERANCE = '(?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)*';

/**
 * 包管理器安装模式表（SEC-01 / D-13 / D-14 / D-16）
 *
 * ⚠️ **本表在默认拒绝规则落地后已退居「纵深」层**（见 PACKAGE_MANAGER_TOOLS 的 JSDoc ④）：
 *    matchInstall 的主判定是「首 token 命中工具集 → 显式只读清单降级，否则默认拒绝」；
 *    本表承担两类形态 —— ① 首 token **不是**包管理器但段内嵌有安装命令的形态
 *    （`echo "npm install"`、`echo y | npm i x`、`python3 -m pip install x`）；
 *    ② 工具命中时的**纵深优先**前置判定（既有表能识别的安装形态绝不被只读豁免降级）。
 *    **不得删除或空置本表** —— 上述两类形态只由它承接。
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
 *
 * ⑦ 本表**不覆盖**的形态（与文件头的「诚实边界」同一套定位：这是启发式，不是语法分析）。
 *    每条给出频率 / 绕过难度 / 实际后果：
 *
 *    a) **变量间接**（`NPM=npm $NPM i x`）：**不命中**本表。
 *       频率：低 —— 模型自发构造这种间接层的动机很弱（它要绕过的是确认卡片，而卡片由用户点击决定）；
 *       难度：高，且失败时并不划算；后果：**仍走 confirm/default 卡片，不会免确认** ——
 *       matchesWhitelist 对整段做前缀匹配，`NPM=npm …` 不以 `npm` 开头，白名单同样不命中。
 *    b) **命令替换 / 子 shell**（反引号包裹的 `npm i x`、`$(npm i x)`、`sh -c "npm i x"`）：
 *       实测**会命中**本表（`\bnpm\b` 在这些构造里仍是词边界）→ 走 install 档，属向安全侧倾斜的
 *       偏差。即便日后模式收紧到不再命中，它也仍然不命中白名单（整段不以 `npm` 开头）→ 落到
 *       confirm/default。
 *
 *       本表漏判后剩下的漏检类别只有**一条**：「首 token 不是包管理器」（变量间接
 *       `NPM=npm $NPM i x` 等）。该类**不命中白名单**（前缀不同）→ 仍走 confirm/default 卡片，
 *       **「漏检 ≠ 免确认」在它身上成立**。改前那些「命中白名单前缀」的漏检形态
 *       （子命令词法改写 `brew "install" wget`、中间 token `brew cask install`、
 *       未收录子命令 `npm update`）已被 PACKAGE_MANAGER_TOOLS 的**默认拒绝**规则消除 ——
 *       它们现在一律进 install 档，不再有「白名单命中 ⇒ 免确认」的通道。
 *    c) **字面量误报**（`echo "npm install"`、`grep -rn "pip install" docs/`、`echo npx`、
 *       `npm ci --dry-run`）：**会命中**。频率：中（AI 常把命令写进 echo / 注释 / 字符串）；
 *       难度：不适用（误报不是绕过，是代价）；后果：**多一次确认**而非漏放 —— 失败方向正确。
 *       刻意不为它加「引号内不判」的规则：那会同时放过 `sh -c "npm i x"`。
 *    d) **发行版包管理器**（apt / pacman / dnf / zypper / apk）不在本表：本阶段目标平台为 macOS，
 *       这些家族不涉及（属显式记录的范围限制，不是遗漏）。
 *
 *    ⑦-e) **只读豁免侧的结构性残余 —— 旗标取值与子命令词法不可区分**（本计划新增，具名记录）：
 *       形态为 `npm -g <未知动词> <只读同名词>`，典型如 `npm -g update ls`。
 *       频率：低 —— 需要「旗标 + 未知动词 + 名为只读动词的包名」三件事同时成立；
 *       难度：中，且达成后并不免确认（见后果）；后果：**只可能被判只读**（该形态本身仍不命中白名单
 *       前缀时走 confirm/default；命中白名单前缀时零卡片 —— 这是本条残余的真实代价）。
 *       **成因不可消除**：既有锁定负例要求 `pnpm --filter a run build` 判为只读（`a` 是 `--filter`
 *       的取值），同一 `FLAG_TOLERANCE` 取值槽必然也能吞掉子命令。已用 **纵深优先**
 *       （matchInstall 命中工具集后先跑本表）把可识别面压到最小 —— 本表能识别的三条真实安装命令
 *       `npm -g install list` / `npm --global install ls` / `brew --quiet install info` 均已被收回
 *       install 档；剩余部分如实告知（三份用户文档的残余段同步记录），不给绝对保证。
 *       诊断：改前亦为 `null`（**无回归**），两侧边界由测试同时钉住。
 */
const PACKAGE_MANAGER_INSTALL_PATTERNS = [
  { pattern: /\bnpx\b/, name: '包执行器（npx）' },
  { pattern: /\bnpm\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(i|install|ci|exec|add)\b/, name: 'npm 安装依赖' },
  { pattern: /\bpnpm\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|i|dlx|exec)\b/, name: 'pnpm 安装依赖' },
  { pattern: /\byarn\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|dlx|exec)\b/, name: 'yarn 安装依赖' },
  { pattern: /\bbun\b(?:\s+-\S+(?:\s+(?!-)\S+)?)*\s+\b(add|install|x|i)\b/, name: 'bun 安装依赖' },
  // `bunx` 用**裸形式**安全：它的 PACKAGE_MANAGER_TOOLS.readOnly 为 []，
  // 纵深层的裸条目不可能遮蔽一个不存在的只读清单（IN-01 / D-13 家族覆盖）。
  { pattern: /\bbunx\b/, name: '包执行器（bunx）' },
  // `pipx` **必须动词限定 + 旗标容忍**，不得用裸 /\bpipx\b/ —— 纵深优先意味着裸条目会先命中
  // 任何含 pipx 的段，使 pipx 的非空 readOnly（['list']）整个不可达（`pipx list` 变成安装档），
  // 与 PACKAGE_MANAGER_TOOLS 的表驱动断言、三份用户文档同时矛盾（checker blocker 1）。
  // 词表漏掉某个安装动词不会造成漏放（未命中纵深表即落**默认拒绝**），只可能多一次确认。
  { pattern: new RegExp('\\bpipx\\b' + FLAG_TOLERANCE + '\\s+\\b(install|install-all|reinstall|reinstall-all|upgrade|upgrade-all|inject|uninject|uninstall|uninstall-all|run|runpip|ensurepath)\\b'), name: '包执行器（pipx）' },
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
 * 共用词法归一化：抹平 shell 的引号与反斜杠转义（**只在 matchInstall 内部使用**）
 *
 * ① 用途：shell 的引号与反斜杠只影响 argv 的**词法拼装**，不影响 argv 本身。
 *    `/bin/sh -c 'set -- brew "install" wget; printf "%s " "$@"'` 与
 *    `/bin/sh -c 'set -- brew install wget; printf "%s " "$@"'` 的展开逐字相同。
 *    抹平词法噪音后，「工具名 + 子命令」的判定与 shell 的真实 argv 一致 ——
 *    **词法改写不再有安全后果**（GAP 1 / CR-01 的靶心）。
 * ② 覆盖形态：`brew "install" wget`（引号包裹）/ `brew \install wget`（反斜杠转义）/
 *    `brew ins""tall wget`（引号拼接）/ `'npm' i x`（命令名引号包裹）。
 * ③ 边界：**只在 `matchInstall` 的判定内使用**，不得提到 `normalizeSegment` /
 *    `matchesWhitelist` / `matchDangerous` 层做统一归一化 —— 那会同时移动白名单与危险判定的
 *    匹配口径，而这两者的行为由既有 32 例断言锁定（install 短路先于白名单，
 *    已足以消除词法改写的安全后果）。
 *
 * @param {string} seg - 命令段
 * @returns {string} 抹平词法噪音后的命令段
 */
function stripShellQuoting(seg) {
  return normalizeSegment(seg)
    .replace(/\\(?=\S)/g, '') // 去反斜杠转义（`brew \install` → `brew install`）
    .replace(/['"]/g, ''); // 去引号（覆盖包裹与拼接两种形态）
}

/**
 * 包管理器工具集（「首 token 默认拒绝」规则的判定表，D-13 家族覆盖 / D-16 强化实现）
 *
 * ① **为什么是默认拒绝**：GAP 1（REVIEW CR-01）的成因是安装档原先用**子命令黑名单**匹配 ——
 *    只要首 token 不变，任何中间 token（`brew cask install`）或子命令词法改写
 *    （`brew "install"` / `brew \install` / `brew ins""tall`）都能击穿；而白名单是**文本前缀**
 *    匹配，这些形态全部保留前缀 → 命中白名单 → `allow` 零卡片。改为「首 token 命中工具集 →
 *    默认强制确认，仅显式只读子命令降级」后，漏检面收敛到「首 token 不是包管理器」这一条
 *    可解释边界（该边界天然不命中白名单前缀），**D-14 的「install 短路先于 matchesWhitelist」
 *    才真正成立**。**不得**退回子命令黑名单 / 白名单式放行（未命中即 null）的形态。
 * ② **只读清单的准入判据**（D-16）：只收「**不取新代码** **且** **不执行第三方代码**」的子命令；
 *    存疑一律不收（不收 = 多一次确认，方向安全）。误报的代价是多一次确认，漏报的代价是零卡片。
 *    刻意不收的例子：`uv run`（隐式 sync 依赖）、`npm config`（`set` 可改 registry）、
 *    `npm publish` / `pack`（跑项目自身生命周期脚本）、`npm owner` / `team` / `dist-tag`（写操作）。
 * ③ **形态化**：一个词条若「只在部分形态下只读」，该词条必须**形态化** —— 词条留在 `readOnly`
 *    （文档与表驱动断言的单一来源），实现走 `guarded` 的带守卫正则：
 *      - `npm init`：`npm init <initializer>` 文档化等价于 `npx create-<initializer>`
 *        （联网下载并执行第三方代码）→ 只有 `init` 后**不出现位置参数**（只允许旗标到段尾）时才只读；
 *      - `npm` / `pnpm` 的 `audit`：`audit fix`（含 `--fix`）会安装修复版本（取新代码 +
 *        跑安装生命周期）→ 只有**不含 `fix` 形态**时才只读。
 *    **不重新审议 `run` / `test` 族**（D-16 已锁定为 read-only：误伤 `npm run dev` 会驱动用户把
 *    `npm` 整族加白名单）：本计划只做**同族补齐** —— `start` / `stop` / `restart` / `run-script`
 *    与 `run` / `test` 同判据（跑项目自身定义的脚本）。
 * ④ **纵深优先**：`matchInstall` 在工具命中后**先**遍历 `PACKAGE_MANAGER_INSTALL_PATTERNS`，
 *    命中即返回，未命中才查只读正则 —— 因为 `FLAG_TOLERANCE` 的取值槽与子命令在词法上
 *    不可区分：只读正则会把 `npm -g install list`（=`npm install list`）读成
 *    「旗标 `-g` 取值 `install`、子命令 `list`」而判只读。纵深优先把既有安装表能识别的
 *    形态全部收回 install 档（`npm -g install list` / `npm --global install ls` /
 *    `brew --quiet install info` / `pipx --quiet install list`）。
 * ⑤ **结构性残余（具名记录）**：旗标取值与子命令不可区分是 `FLAG_TOLERANCE` 的固有代价 ——
 *    既有锁定负例要求 `pnpm --filter a run build` 判只读（`a` 是 `--filter` 的取值），
 *    同一机制使 `npm -g <未知动词> <只读同名词>`（如 `npm -g update ls`）仍判只读
 *    （改前亦为 null，**无回归**）。已用纵深优先把可识别面压到最小，剩余部分如实记录在
 *    三份用户文档的残余段，不给绝对保证。
 * ⑥ **纵深层的条目不得遮蔽它自己的只读清单**：`pipx` 的 `readOnly` 非空（`['list']`），
 *    因此纵深表的 pipx 条目**必须动词限定** —— 裸 `/\bpipx\b/` 会在纵深优先的位置先命中，
 *    使该只读清单整个不可达（`pipx list` 变成安装档）。动词限定后两侧都可断言：
 *    `pipx list` 判只读（与 `pip list` / `brew list` 同族）、`pipx install black` 判安装。
 * ⑦ **本轮的取舍（不得静默扩散）**：`npm` 补入同族生命周期别名 `start` / `stop` / `restart` /
 *    `run-script`；`pnpm` / `yarn` / `bun` 的同类别名**不收录**（各 CLI 的别名语义未逐一核验，
 *    按「存疑一律不收」处理）→ `pnpm start` / `yarn start` / `bun start` 这类命令会落强制确认档，
 *    卡片文案「将从网络下载并运行第三方代码」对这族命令**不准确**。这是**已接受的保守误报**
 *    （方向安全：多一次卡片），不是遗漏。
 * ⑧ `python` / `python3` **刻意不入工具集**：它们的首 token 已被 DANGEROUS_INTERPRETERS 强制确认
 *    （danger 先于 install 返回），install 档无增量价值；`python3 -m pip install x` 的复合形态
 *    由纵深表承接。
 * ⑨ 残余（与本表无关，如实记录）：`NPM` / `RM` 等大写形态不命中（macOS 解析不区分大小写）——
 *    属 REVIEW WR-05，**不在本计划范围**。
 *
 * 字段语义：
 * - `tool`          首 token（`extractCommandName` 的 basename，跳过 `KEY=VALUE` 赋值前缀）
 * - `name`          安装档家族名（卡片上展示；**逐字沿用既有断言锁定的名字**）
 * - `readOnly`      显式只读子命令（**文档与表驱动断言的单一来源**；`guarded` 的词条同时列在此处）
 * - `bareIsInstall` 裸命令名（含纯旗标形态）是否算安装档：四个包执行器为 true（无「只读的裸形式」），
 *                   其余为 false（裸形式只打印帮助）
 * - `guarded`       形态化的只读词条 `{ verb, pattern }`（pattern 是完整正则源码字符串）
 * - `composite`     复合式只读 `{ verb, subVerbs }`（如 `uv pip list`）
 */
const PACKAGE_MANAGER_TOOLS = [
  { tool: 'npx', name: '包执行器（npx）', readOnly: [], bareIsInstall: true },
  { tool: 'bunx', name: '包执行器（bunx）', readOnly: [], bareIsInstall: true },
  { tool: 'uvx', name: 'uv 包执行器（uvx）', readOnly: [], bareIsInstall: true },
  { tool: 'pipx', name: '包执行器（pipx）', readOnly: ['list'], bareIsInstall: true },
  {
    tool: 'npm',
    name: 'npm 安装依赖',
    readOnly: [
      'run', 'test', 'start', 'stop', 'restart', 'run-script',
      'ls', 'list', 'view', 'audit', 'init', 'outdated', 'help', 'root', 'ping',
      'doctor', 'fund', 'version', 'whoami', 'dedupe', 'prune', 'completion',
      'search', 'docs', 'repo', 'bugs', 'explain', 'why', 'bin', 'prefix',
    ],
    guarded: [
      // `npm init <initializer>` ≡ `npx create-<initializer>`（取新代码）→ 只有「init 之后
      // 只允许旗标直到段尾」才只读；`npm init -y react-app` 因位置参数而不命中 → 默认拒绝。
      { verb: 'init', pattern: '\\bnpm\\b' + FLAG_TOLERANCE + '\\s+\\binit\\b(?:\\s+-{1,2}\\S+)*\\s*$' },
      // `audit fix` / `audit --fix` 安装修复版本（取新代码）→ 负向先行断言拒掉紧跟的 fix 形态。
      { verb: 'audit', pattern: '\\bnpm\\b' + FLAG_TOLERANCE + '\\s+\\baudit\\b(?!\\s+-{0,2}fix\\b)' },
    ],
    bareIsInstall: false,
  },
  {
    tool: 'pnpm',
    name: 'pnpm 安装依赖',
    readOnly: [
      'run', 'test', 'ls', 'list', 'why', 'outdated', 'audit',
      'licenses', 'root', 'bin', 'doctor', 'help', 'version',
    ],
    guarded: [
      { verb: 'audit', pattern: '\\bpnpm\\b' + FLAG_TOLERANCE + '\\s+\\baudit\\b(?!\\s+-{0,2}fix\\b)' },
    ],
    bareIsInstall: false,
  },
  {
    tool: 'yarn',
    name: 'yarn 安装依赖',
    readOnly: [
      'run', 'test', 'ls', 'list', 'why', 'info', 'outdated',
      'audit', 'licenses', 'bin', 'root', 'help', 'version',
    ],
    bareIsInstall: false,
  },
  {
    tool: 'bun',
    name: 'bun 安装依赖',
    readOnly: ['run', 'test', 'ls', 'list', 'help', 'version', 'why', 'outdated', 'audit'],
    bareIsInstall: false,
  },
  {
    tool: 'pip',
    name: 'pip 安装包',
    readOnly: ['list', 'show', 'freeze', 'check', 'help', 'version', 'debug'],
    bareIsInstall: false,
  },
  {
    tool: 'pip3',
    name: 'pip 安装包',
    readOnly: ['list', 'show', 'freeze', 'check', 'help', 'version', 'debug'],
    bareIsInstall: false,
  },
  {
    tool: 'uv',
    name: 'uv 安装包',
    // 动词式只读 + 复合式只读（`uv pip <sub>`）；`uv run` 刻意不收（隐式 sync 依赖 → 取新代码）。
    readOnly: [
      'tree', 'lock', 'export', 'version', 'help', 'init', 'cache',
      'list', 'show', 'freeze', 'check', 'inspect', 'debug',
    ],
    composite: { verb: 'pip', subVerbs: ['list', 'tree', 'show', 'freeze', 'check', 'inspect', 'debug'] },
    bareIsInstall: false,
  },
  {
    tool: 'brew',
    name: 'Homebrew 安装包',
    readOnly: [
      'info', 'list', 'search', 'config', 'doctor', 'outdated',
      'deps', 'uses', 'home', 'desc', 'cat', 'help', 'version',
    ],
    bareIsInstall: false,
  },
  {
    tool: 'cargo',
    name: 'cargo 安装包',
    readOnly: ['search', 'tree', 'metadata', 'version', 'help', 'locate-project'],
    bareIsInstall: false,
  },
  {
    tool: 'go',
    name: 'go 安装包',
    readOnly: ['list', 'env', 'version', 'doc', 'help'],
    bareIsInstall: false,
  },
  {
    tool: 'gem',
    name: 'gem 安装包',
    readOnly: ['list', 'search', 'info', 'environment', 'help', 'version'],
    bareIsInstall: false,
  },
];

/**
 * 工具名 → 只读正则集（模块加载时构造一次）
 *
 * `readOnlyRes` 的拼装次序**不可调换**，四条各司其职：
 *   1. **动词式**：`\b<tool>\b` + FLAG_TOLERANCE + `\s+\b(verbs)\b`，其中
 *      `verbs = readOnly.filter(v => !guardedVerbs.has(v))`。
 *      ⚠ **硬约束：`verbs` 为空时（`npx` / `bunx` / `uvx`）必须跳过构造** ——
 *      空捕获组 `\b()\b` 匹配空串，会让该工具**带至少一个参数**的一切形态都判只读
 *      （裸工具名不命中，式中有 `\s+`）。空 `readOnlyRes` 的语义才是「该工具没有只读形态」
 *      → `.some()` 恒 false → 默认拒绝。
 *   2. **守卫式**：形态化的只读词条（`guarded`），pattern 已在表内拼好。
 *   3. **复合式**：`uv pip list` 这类「工具 + 子工具 + 只读子命令」。
 *   4. **裸形式**：`\b<tool>\b` + FLAG_TOLERANCE + `\s*$` —— 同时覆盖裸命令名（`npm`）与
 *      纯旗标形态（`npm --version` / `uv --version` / `brew -v`），仅 `bareIsInstall === false`
 *      的工具生成。
 */
const PACKAGE_MANAGER_TOOL_MAP = new Map(
  PACKAGE_MANAGER_TOOLS.map((entry) => {
    const guardedVerbs = new Set((entry.guarded || []).map((g) => g.verb));
    const verbs = entry.readOnly.filter((v) => !guardedVerbs.has(v));
    const readOnlyRes = [];
    if (verbs.length > 0) {
      readOnlyRes.push(new RegExp('\\b' + entry.tool + '\\b' + FLAG_TOLERANCE + '\\s+\\b(' + verbs.join('|') + ')\\b'));
    }
    for (const g of entry.guarded || []) readOnlyRes.push(new RegExp(g.pattern));
    if (entry.composite) {
      readOnlyRes.push(new RegExp('\\b' + entry.tool + '\\b' + FLAG_TOLERANCE + '\\s+' + entry.composite.verb + '\\s+\\b(' + entry.composite.subVerbs.join('|') + ')\\b'));
    }
    if (!entry.bareIsInstall) {
      readOnlyRes.push(new RegExp('\\b' + entry.tool + '\\b' + FLAG_TOLERANCE + '\\s*$'));
    }
    return [entry.tool, { name: entry.name, readOnlyRes }];
  }),
);

/**
 * 判定单个命令段是否为包管理器安装 / 包执行（**默认拒绝**，D-13 / D-14 / D-16）
 *
 * 判定顺序（**顺序即语义，不得调换**）：
 * 1. `stripShellQuoting` 抹平引号 / 反斜杠 / 引号拼接三类词法噪音
 * 2. `extractCommandName` 取首 token（跳过 `KEY=VALUE` 赋值前缀 + 取 basename）
 * 3. 首 token **命中工具集**：
 *    a. **纵深优先** —— 先遍历 PACKAGE_MANAGER_INSTALL_PATTERNS，命中即返回（既有表能识别的
 *       安装形态绝不被只读豁免降级）；
 *    b. 未命中纵深表 → 查只读正则，命中则返回 `null`（降级为普通处理 / 白名单语义）；
 *    c. 都不命中 → **默认拒绝**返回家族名（未列入只读清单的包管理器子命令一律强制确认）。
 * 4. 首 token **未命中工具集**：仍按纵深表判定（`echo "npm install"` / `echo y | npm i x` /
 *    `python3 -m pip install x` 这类首 token 非包管理器的形态）。
 *
 * @param {string} seg - 命令段（原始文本即可，内部会规范化）
 * @returns {string|null} 命中返回安装档家族名（中文），未命中返回 null
 */
function matchInstall(seg) {
  const n = stripShellQuoting(seg);
  if (!n) return null;
  const toolName = extractCommandName(n);
  const entry = toolName ? PACKAGE_MANAGER_TOOL_MAP.get(toolName) : undefined;

  if (entry) {
    // 纵深优先：既有安装表命中即 install（只读豁免不得降级它）
    for (const { pattern, name } of PACKAGE_MANAGER_INSTALL_PATTERNS) {
      if (pattern.test(n)) return name;
    }
    if (entry.readOnlyRes.some((re) => re.test(n))) return null;
    // 默认拒绝：未列入只读清单的包管理器子命令一律强制确认
    return entry.name;
  }

  // 纵深：首 token 不是包管理器时仍按既有表判定
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
 *
 * 除形状校验外，**拒绝空前缀条目**（WR-01）：条目去掉尾部 `*` 后 `trim()` 为空
 * （即单独的 `*` / ` *`）不是命令前缀，`startsWith('')` 恒真会把白名单变成全放行。
 * `matchesWhitelist` 侧的 `continue` 是最后一道防御，这里是权威校验
 * （设置页 `src/settings-page.js` 的 tag 输入校验是重复的本地实现，不依赖它）。
 *
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
    // WR-01：`*` / ` *` 去掉尾部通配符后没有剩余前缀 → 空前缀 → 全放行，拒绝
    if (!v.replace(/\*+$/, '').trim()) {
      return { valid: false, reason: '白名单条目必须是具体命令前缀，不支持单独使用 *' };
    }
  }
  return { valid: true };
}

module.exports = {
  normalizeSegment,
  stripShellQuoting,
  splitCommandPipeline,
  extractCommandName,
  matchesWhitelist,
  matchDangerous,
  DANGEROUS_PATTERNS,
  DANGEROUS_INTERPRETERS,
  FLAG_TOLERANCE,
  PACKAGE_MANAGER_INSTALL_PATTERNS,
  PACKAGE_MANAGER_TOOLS,
  PACKAGE_MANAGER_TOOL_MAP,
  matchInstall,
  evaluateBashCommand,
  validateWhitelistList,
};
