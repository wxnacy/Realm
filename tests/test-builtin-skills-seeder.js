/**
 * builtin-skills-seeder 内置技能播种单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：端到端纵切（真实 skills-builtin/ → seedBuiltinSkills → 临时 managed-skills
 * → refreshSkills 零诊断识别 → 因 disable-model-invocation 不进 system prompt）、
 * 差异检测 IO fail-safe、源码不变式（导出面 / 惰性 electron require / 零硬编码 /
 * main.js 调用位序 / package.json asarUnpack 成对）。
 * 全部用例经 setWorkspaceDir/setBuiltinDepsForTest 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-builtin-skills-seeder.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const aiSkills = require('../ai-skills-manager');
const seeder = require('../builtin-skills-seeder');

/** 仓库根目录 */
const REPO_ROOT = path.join(__dirname, '..');

/** 真实的随包内置技能源目录（端到端纵切必须用真源，不用合成目录） */
const REAL_BUILTIN_SRC = path.join(REPO_ROOT, 'skills-builtin');

/** skill-creator 的随包目录（47-03 落地） */
const SKILL_CREATOR_DIR = path.join(REAL_BUILTIN_SRC, 'skill-creator');

/** skill-creator 的环境预检探针（Realm 自研，Task 2 产出） */
const CHECK_ENV_MJS = path.join(SKILL_CREATOR_DIR, 'scripts', 'check_env.mjs');

/**
 * 上游 skill-creator 的 **17 个逐字快照文件**与字节数
 *
 * 字节数来自 47-RESEARCH.md §B-5 的实测清单（固定 SHA
 * `b0cbd3df1533b396d281a6886d5132f623393a9c`）。这 17 个文件**不得有任何改动**，
 * 因此字节数必须**精确**相等 —— 它是「快照没取错版本」的护栏。
 *
 * **计数口径（唯一）**：17（下表）+ 1（`SKILL.md`，唯一被受控改写的上游文件）= **18 个上游文件**。
 * `scripts/check_env.mjs` 由 **Task 2** 产出、**不属于**本表；全量 19 项的核对由 Task 2 补齐。
 */
const UPSTREAM_SKILL_CREATOR_FILES = [
  { rel: 'LICENSE.txt', bytes: 11357 },
  { rel: 'agents/analyzer.md', bytes: 10376 },
  { rel: 'agents/comparator.md', bytes: 7287 },
  { rel: 'agents/grader.md', bytes: 9049 },
  { rel: 'assets/eval_review.html', bytes: 7058 },
  { rel: 'eval-viewer/generate_review.py', bytes: 16365 },
  { rel: 'eval-viewer/viewer.html', bytes: 44998 },
  { rel: 'references/schemas.md', bytes: 12061 },
  // 上游就是 0 字节的空 `__init__.py`（仅作包标记）→ 只断言精确字节数，不断言「非空」
  { rel: 'scripts/__init__.py', bytes: 0 },
  { rel: 'scripts/aggregate_benchmark.py', bytes: 14386 },
  { rel: 'scripts/generate_report.py', bytes: 12847 },
  { rel: 'scripts/improve_description.py', bytes: 11116 },
  { rel: 'scripts/package_skill.py', bytes: 4234 },
  { rel: 'scripts/quick_validate.py', bytes: 3972 },
  { rel: 'scripts/run_eval.py', bytes: 11464 },
  { rel: 'scripts/run_loop.py', bytes: 13605 },
  { rel: 'scripts/utils.py', bytes: 1661 },
];

/**
 * `SKILL.md` 是唯一被改写的上游文件（六处受控改动 + `## Reference files` 清单同步）
 * → 字节数**不可能**再等于上游的 33,168，只能用**区间**护栏（不得被清理成空壳）。
 */
const UPSTREAM_SKILL_MD_BYTES = { min: 30000, max: 40000 };

/**
 * 零安装语义禁用模式表（逐字照抄 47-RESEARCH.md §A-4，不要重新设计正则）
 *
 * 扫描语义：任一行命中即判失败（第 1 段零容忍 / 第 2 段可经 EXEMPTIONS 豁免）。
 */
const FORBIDDEN_PATTERNS = [
  // —— 英文 CLI / 包管理器形态 ——
  { re: /\bnpx\b/i, why: 'npx 包执行器' },
  { re: /\bnpm\s+(i|install|ci|exec|add)\b/i, why: 'npm 安装/执行（含 npm exec 即时执行别名）' },
  { re: /\bpnpm\s+(add|install|dlx|exec)\b/i, why: 'pnpm 安装/执行' },
  { re: /\byarn\s+(add|install|dlx|exec)\b/i, why: 'yarn 安装/执行' },
  { re: /\bbun\s+(add|install|x)\b/i, why: 'bun 安装/执行' },
  { re: /\bpip3?\s+install\b/i, why: 'pip 安装' },
  { re: /\bpython3?\s+-m\s+pip\s+install\b/i, why: 'python -m pip 安装' },
  { re: /\buv\s+(pip\s+install|add|tool\s+install)\b/i, why: 'uv 安装' },
  { re: /\buvx\b/i, why: 'uv 包执行器（uvx）' },
  { re: /\bbrew\s+(install|upgrade|reinstall)\b/i, why: 'Homebrew 安装' },
  { re: /\bcargo\s+install\b/i, why: 'cargo 安装' },
  { re: /\bgo\s+install\b/i, why: 'go 安装' },
  { re: /\bgem\s+install\b/i, why: 'gem 安装' },
  { re: /curl[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行（curl）' },
  { re: /wget[^\n|]*\|\s*(sh|bash|zsh|python3?|node)\b/i, why: '下载并管道执行（wget）' },
  { re: /\bapt(-get)?\s+install\b/i, why: 'apt 安装' },
  // —— 危险旗标（任何命令上下文里都禁止）——
  { re: /(^|\s)-y(\s|$)/, why: '无需确认旗标 -y' },
  { re: /--yes\b/, why: '无需确认旗标 --yes' },
  { re: /(^|\s)-g(\s|$)/, why: '全局位置旗标 -g' },
  { re: /--global\b/, why: '全局位置旗标 --global' },
  // —— 中文语义等价写法 ——
  { re: /安装到全局/, why: '全局安装（中文）' },
  { re: /下载并执行/, why: '下载并执行（中文）' },
  { re: /自动安装/, why: '自动安装（中文）' },
  { re: /执行安装命令/, why: '执行安装命令（中文）' },
  { re: /跳过确认/, why: '绕过确认（中文）' },
  { re: /装到系统/, why: '装到系统（中文）' },
];

/** 执行安装的祈使句（英文 + 中文，逐字照抄 §A-4） */
const INSTALL_IMPERATIVES = [
  { re: /\b(install|add|update)\s+(the\s+)?skill\b/i, why: '安装技能的祈使句' },
  { re: /\brun\s+the\s+following\s+command\b/i, why: '「运行以下命令」祈使句（英文）' },
  { re: /请执行以下命令/, why: '「请执行以下命令」祈使句（中文）' },
  { re: /运行以下命令/, why: '「运行以下命令」祈使句（中文）' },
];

/**
 * 行级豁免清单（只作用于**第 2 段**扫描，第 1 段零容忍、绝不消费本表）
 *
 * 三元组：`file`（相对仓库根的路径）+ `line`（匹配该行的**正则**）+ `why`（豁免理由，必须写死）。
 *
 * **匹配方式必须是「对该行内容做正则匹配」，绝不能用固定行号** —— 行号会随文件编辑整体
 * 位移，用行号等于给下次改动埋一个静默失效点。正则也要匹配**整段相关文本**（而不是只匹配
 * `install` 这个词），否则同一行里其它真正的违规内容会被一并豁免。
 *
 * 已知必须豁免的例外（来源：47-RESEARCH.md §A-4「已知需要白名单豁免的例外」）：
 * - `skill-creator/scripts/check_env.mjs` 的 `installGuidance` 文案：缺依赖时提示**用户**
 *   在他自己的 Python 环境里装包，并紧跟一句 `Do not auto-install dependencies from this
 *   skill.`。这是**禁止**安装的声明，语义与 P1 门禁相反，却会被「安装技能的祈使句」模式
 *   命中（`install the skill…` 无法区分「装这个技能」与「装这个技能的依赖」）。
 * - `skill-creator/SKILL.md` 的 `Package and Present` 段落引用 `package_skill.py`：
 *   `package` ≠ `install`，且该脚本生成 `.zip` 不安装任何东西。
 *   （注：`SKILL.md` 属第 1 段扫描面且实测 0 命中，此条仅作为备用登记。）
 *
 * **两类条目的性质不同，别混为一谈**：
 * - 第 1 条是**承重**的 —— 去掉它，`check_env.mjs` 的那一行会立刻被第 2 段扫出来（见
 *   「豁免机制精确生效」用例的反向验证与 47-03-SUMMARY 记录的错误输出原文）。
 * - 第 2 条是**防御性登记** —— 逐字声明行当前不命中任何模式（模式表里没有裸 `install` 模式），
 *   它登记在此是为了让「日后收紧模式表」不会静默地把一句反向声明判成违规。
 */
const EXEMPTIONS = [
  {
    file: 'skills-builtin/skill-creator/scripts/check_env.mjs',
    line: /Install the skill-creator Python dependencies yourself/,
    why: '这是 check_env.mjs 给**用户**的安装指引（在他自己的 Python 环境里装依赖），紧跟一句 Do not auto-install —— 命中「安装技能的祈使句」模式但语义相反（D-05）。注意是让**用户**装，不是让模型装。',
  },
  {
    file: 'skills-builtin/skill-creator/scripts/check_env.mjs',
    line: /Do not auto-install dependencies from this skill\./,
    why: '逐字保留的反向声明（本技能绝不自动安装依赖）—— P1 门禁语义的正面证据。当前不命中任何模式，登记在此防「模式表收紧后静默判违规」。',
  },
];

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-seeder-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
    seeder.setBuiltinDepsForTest(null);
    seeder._resetForTest();
    // 模块级 _cache 跨用例污染会让后续「零诊断」断言假失败
    aiSkills._resetCacheForTest();
  });
  workspace.setWorkspaceDir(dir);
  return dir;
}

/** 读取仓库根源码（源码扫描型断言用） */
function readSource(file) {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/** 取函数体文本（从 `function <name>(` 到下一个行首 `}`） */
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `源码中应存在 function ${name}(`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

/** 剥离注释后的源码（注释里允许出现代码中被禁的字样） */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** 递归收集目录下全部文件绝对路径 */
function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(abs));
    else out.push(abs);
  }
  return out;
}

/** glob 式收集 skills-builtin 下指定 basename 的文件（扫描面的权威口径） */
function globBuiltinByBasename(basename) {
  return collectFiles(REAL_BUILTIN_SRC).filter((f) => path.basename(f) === basename);
}

/**
 * 解析 `SKILL.md` 的 `## Reference files` 章，抽出清单里列出的**相对路径**
 *
 * 只认「反引号包裹 + 无空白 + 已知扩展名」的 token —— 这样正文里提到目录名
 * （`scripts/`）或 `python -m scripts.<name>` 这类片段不会被误当成清单条目。
 */
function parseReferenceFileList(markdown) {
  const anchor = markdown.indexOf('\n## Reference files');
  assert.ok(anchor > 0, 'SKILL.md 应含 `## Reference files` 章');
  const rest = markdown.slice(anchor + 1);
  // 章边界取「下一个 ## 标题」与「下一条 --- 分隔线」里更靠前的那个 —— 只取前者会在
  // `## Reference files` 是最后一章时一路吞到文件尾，把尾部散文也算进清单。 
  const nextHeading = rest.indexOf('\n## ', 1);
  const nextRule = rest.indexOf('\n---\n');
  const bounds = [nextHeading, nextRule].filter((idx) => idx > 0);
  const end = bounds.length > 0 ? Math.min(...bounds) : -1;
  const section = end > 0 ? rest.slice(0, end) : rest;

  const paths = [];
  for (const match of section.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1];
    if (/\s/.test(token)) continue;
    if (!/\.(md|py|mjs|html|txt)$/.test(token)) continue;
    paths.push(token);
  }
  return { section, paths: [...new Set(paths)].sort() };
}

/** 把一个目录树复制到目标（测试内造合成源用） */
function copyTree(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}

/**
 * 造一个只含 find-skills 的合成源目录
 *
 * 恒等于真实随包内容（真源复制），但落点可控 —— 后续用例要往里塞坏目录，
 * 不能动仓库里的 `skills-builtin/`。
 */
function makeSyntheticSrc(root) {
  const srcDir = path.join(root, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  copyTree(path.join(REAL_BUILTIN_SRC, 'find-skills'), path.join(srcDir, 'find-skills'));
  return srcDir;
}

/** 列出目录下残留的临时/备份目录（断言原子性用） */
function listResidue(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.includes('.tmp_') || n.includes('.bak_'));
}

/** check_env.mjs 探测解释器所用的环境变量名（与探针源码里的常量单源对应） */
const ENV_VAR_NAME = 'REALM_SKILL_CREATOR_PYTHON';

/**
 * 以子进程跑一次 check_env.mjs
 *
 * 默认**清掉** `REALM_SKILL_CREATOR_PYTHON`，否则宿主机上的该变量会让用例结果不可复现。
 */
function runCheckEnv(args = [], env = {}) {
  const childEnv = { ...process.env, ...env };
  if (!(ENV_VAR_NAME in env)) delete childEnv[ENV_VAR_NAME];
  return require('node:child_process').spawnSync(process.execPath, [CHECK_ENV_MJS, ...args], {
    encoding: 'utf8',
    env: childEnv,
    timeout: 30000,
  });
}

/**
 * 造一个「假的 Python 解释器」：版本够新，但对任何包都报 `find_spec is None`
 *
 * 用来在**本机装了全部依赖**的情况下仍然打出 `missing_dependency` 分支 —— 该分支的
 * `installGuidance` 文案正是第 2 段扫描豁免的对象，必须能被真实触发而不是只存在于源码里。
 * 它只读、只打印，不安装任何东西（与真实探针的行为契约一致）。
 */
function makeFakePython(dir, { version = '3.11.0', packages = ['pyyaml'], packageOk = false } = {}) {
  const file = path.join(dir, 'fake-python');
  const [major, minor, micro] = version.split('.').map(Number);
  const versionJson = JSON.stringify({
    version,
    major,
    minor,
    micro,
    executable: file,
  });
  const packageJson = JSON.stringify({
    packages: Object.fromEntries(
      packages.map((name) => [
        name,
        { packageName: name, moduleName: name === 'pyyaml' ? 'yaml' : name, ok: packageOk },
      ])
    ),
  });
  fs.writeFileSync(
    file,
    [
      '#!/bin/sh',
      'case "$2" in',
      `  *version_info*) printf '%s\\n' '${versionJson}' ;;`,
      `  *) printf '%s\\n' '${packageJson}' ;;`,
      'esac',
      '',
    ].join('\n')
  );
  fs.chmodSync(file, 0o755);
  return file;
}

/**
 * 第 1 段扫描面：`skills-builtin/**` 下**全部** `SKILL.md` 与 `LICENSE.txt`
 *
 * **必须按 glob 递归得到，不得写死单技能路径** —— 47-03 会新增 skill-creator 的
 * `SKILL.md` 与 `LICENSE.txt`，写死文件名会让新技能静默逃出扫描面。
 * 本段**零容忍、零豁免**（P1 门禁的字面判据）。
 */
function stage1Files() {
  return [
    ...globBuiltinByBasename('SKILL.md'),
    ...globBuiltinByBasename('LICENSE.txt'),
  ].sort();
}

/**
 * 第 2 段扫描面：`skills-builtin/**` 下**尚未被第 1 段覆盖的全部内容**
 *
 * **用排除法表达，而不是列举 `scripts/` + `resources/`** —— 列举法会漏掉
 * `agents/` / `assets/` / `eval-viewer/` / `references/` 四类目录（47-03 会落地）。
 * SEED-03 说的是「内置技能文本」，未限定文件类型。
 */
function stage2Files() {
  const covered = new Set(stage1Files());
  return collectFiles(REAL_BUILTIN_SRC).filter((f) => !covered.has(f)).sort();
}

/**
 * 逐行扫描一组文件，返回命中记录（含文件相对路径 + 行号 + 命中模式 + 理由）
 *
 * @param {string[]} files - 待扫描文件绝对路径
 * @param {Array<{re: RegExp, why: string}>} patterns - 禁用模式表
 * @param {Array<{file: string, line: RegExp, why: string}>} [exemptions] - 行级豁免清单
 */
function scanFiles(files, patterns, exemptions = []) {
  const hits = [];
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (exemptions.some((e) => e.file === rel && e.line.test(line))) return;
      for (const { re, why } of patterns) {
        if (re.test(line)) {
          hits.push({ file: rel, line: i + 1, pattern: re.source, why, text: line.trim() });
        }
      }
    });
  }
  return hits;
}

describe('端到端纵切（tracer）', () => {
  test('真实随包 skills-builtin → 播种 → managed-skills → 零诊断加载 → 不进 prompt', async (t) => {
    const root = withTempRoot(t);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir });

    seeder.seedBuiltinSkills();
    assert.deepStrictEqual(seeder.getSeedDiagnostics(), [], '首次播种应为零诊断');

    const seededSkill = path.join(managedDir, 'find-skills', 'SKILL.md');
    assert.ok(fs.existsSync(seededSkill), '播种后 managed-skills/find-skills/SKILL.md 应存在');
    assert.strictEqual(
      fs.readFileSync(seededSkill, 'utf8'),
      fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8'),
      '播种产物应与随包源逐字节相同'
    );
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'LICENSE.txt')),
      '播种是整目录复制，LICENSE.txt 应随之落盘'
    );

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snapshot = aiSkills.getSkillsSnapshot();
    const entry = snapshot.skills.find((e) => e.skill.name === 'find-skills');
    assert.ok(entry, '技能加载器应零诊断识别 find-skills');
    assert.strictEqual(entry.source, 'managed', 'seeded 技能来源应为 managed');
    assert.deepStrictEqual(snapshot.diagnostics, [], '加载应零诊断');
    assert.deepStrictEqual(snapshot.errors, [], '加载应零错误');
    assert.strictEqual(
      aiSkills.buildSkillsPrompt(),
      '',
      'disable-model-invocation: true → 该技能不进 system prompt（SEED-04 机械证据）'
    );
  });

  test('随包源缺失 → realm_builtin_src_missing 且不 throw（不阻断启动）', (t) => {
    const root = withTempRoot(t);
    seeder.setBuiltinDepsForTest({
      srcDir: path.join(root, 'no-such-builtin-src'),
      managedDir: path.join(root, 'managed-skills'),
    });
    assert.doesNotThrow(() => seeder.seedBuiltinSkills(), '源缺失不得 throw');
    const diags = seeder.getSeedDiagnostics();
    const hit = diags.find((d) => d.code === 'realm_builtin_src_missing');
    assert.ok(hit, '应产 realm_builtin_src_missing');
    assert.strictEqual(hit.level, 'error');
  });

  test('seeded 身份 = 随包目录名集合（只认含 SKILL.md 的目录，零状态文件）', (t) => {
    const root = withTempRoot(t);
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(path.join(srcDir, 'has-skill'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'has-skill', 'SKILL.md'), '---\nname: has-skill\n---\n');
    fs.mkdirSync(path.join(srcDir, 'no-skill'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'no-skill', 'README.md'), 'x');
    fs.mkdirSync(path.join(srcDir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, '.hidden', 'SKILL.md'), '---\nname: x\n---\n');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir: path.join(root, 'managed-skills') });
    assert.deepStrictEqual(seeder.getSeededSkillNames(), ['has-skill']);
  });
});

describe('差异检测 IO fail-safe（D-09 / 评审裁决项）', () => {
  test('不可读文件 → detectDiff 返回 different 且不抛错', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    const dst = path.join(root, 'dst');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(dst, { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'same-content');
    fs.writeFileSync(path.join(dst, 'a.txt'), 'same-content');

    const victim = path.join(src, 'a.txt');
    fs.chmodSync(victim, 0o000);
    try {
      assert.doesNotThrow(() => {
        const verdict = seeder.detectDiff(src, dst);
        assert.strictEqual(verdict, 'different', 'IO 错误应 fail-safe 判 different（按需重同步）');
      }, 'detectDiff 遇 IO 错误不得抛错');
    } finally {
      fs.chmodSync(victim, 0o644);
    }
  });

  test('目标不存在 → missing；内容全同 → same；内容不同 → different', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    const dst = path.join(root, 'dst');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'A');
    fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'B');

    assert.strictEqual(seeder.detectDiff(src, dst), 'missing');

    copyTree(src, dst);
    assert.strictEqual(seeder.detectDiff(src, dst), 'same');

    fs.writeFileSync(path.join(dst, 'a.txt'), 'A-changed');
    assert.strictEqual(seeder.detectDiff(src, dst), 'different');

    fs.writeFileSync(path.join(dst, 'a.txt'), 'A');
    fs.rmSync(path.join(dst, 'sub', 'b.txt'));
    assert.strictEqual(seeder.detectDiff(src, dst), 'different', '文件缺失应判 different');
  });
});

describe('源码不变式（导出面 / 惰性 electron require / 零硬编码）', () => {
  test('5 个内部函数齐备，module.exports 含全部 6 个公开导出', () => {
    const src = readSource('builtin-skills-seeder.js');
    for (const fn of [
      'seedBuiltinSkills',
      'resolveBuiltinSkillsSrc',
      'getSeededSkillNames',
      'safeCopyDir',
      'detectDiff',
    ]) {
      assert.ok(src.includes(`function ${fn}(`), `源码中应存在 function ${fn}(`);
    }
    const exportsBlock = src.slice(src.indexOf('module.exports = {'));
    for (const name of [
      'seedBuiltinSkills',
      'resolveBuiltinSkillsSrc',
      'getSeededSkillNames',
      'getSeedDiagnostics',
      'setBuiltinDepsForTest',
      '_resetForTest',
    ]) {
      assert.ok(exportsBlock.includes(name), `module.exports 应含 ${name}`);
    }
  });

  test('detectDiff 带 IO fail-safe 分支，并有「为什么不用 mtime」的注释', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'detectDiff');
    assert.ok(body.includes("return 'different'"), 'IO 错误分支应返回 different');
    assert.ok(body.includes('safeCopyDir'), '注释应点名 safeCopyDir（覆盖会重写 mtime 的成因）');
    assert.ok(body.includes('mtime'), '注释应说明为什么不用 mtime');
  });

  test('safeCopyDir 带源目录存在性提前返回分支', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'safeCopyDir');
    assert.ok(body.includes('fs.existsSync(src)'), 'safeCopyDir 应有源存在性检查');
  });

  test('setBuiltinDepsForTest 的注释写明注入器覆盖的是两个函数返回值', () => {
    const src = readSource('builtin-skills-seeder.js');
    const idx = src.indexOf('function setBuiltinDepsForTest(');
    assert.ok(idx > 0);
    const doc = src.slice(Math.max(0, idx - 1500), idx);
    assert.ok(doc.includes('resolveBuiltinSkillsSrc()'), '注释应写明 srcDir 覆盖 resolveBuiltinSkillsSrc()');
    assert.ok(doc.includes('getManagedSkillsDir()'), '注释应写明 managedDir 覆盖 getManagedSkillsDir()');
  });

  test('resolveBuiltinSkillsSrc 三条路径不变式齐备，且 electron require 不在模块顶层', () => {
    const src = readSource('builtin-skills-seeder.js');
    const body = functionBody(src, 'resolveBuiltinSkillsSrc');
    assert.ok(body.includes('app.isPackaged'), '应含打包态判定');
    assert.ok(body.includes('process.resourcesPath'), '应含 resourcesPath 路径分支');
    assert.ok(body.includes('__dirname'), '应含开发态 __dirname 回落');

    const matches = [...src.matchAll(/require\('electron'\)/g)];
    assert.strictEqual(matches.length, 1, "require('electron') 只应出现一次（模块顶层禁止）");
    const lineNo = src.slice(0, matches[0].index).split('\n').length;
    assert.ok(lineNo > 20, `require('electron') 应在文件头 20 行之后（实际第 ${lineNo} 行）`);
  });

  test('零硬编码：builtin-skills-seeder.js 不出现任何内置技能名字面量', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    assert.ok(!stripped.includes("'find-skills'"), '不得硬编码 find-skills');
    assert.ok(!stripped.includes('"find-skills"'), '不得硬编码 find-skills');
    assert.ok(!stripped.includes("'skill-creator'"), '不得硬编码 skill-creator');
    assert.ok(!stripped.includes('"skill-creator"'), '不得硬编码 skill-creator');
  });

  test('package.json 的 build.asarUnpack 两侧成对（nodejieba 保留 + skills-builtin 新增）', () => {
    const pkg = JSON.parse(readSource('package.json'));
    assert.ok(Array.isArray(pkg.build.asarUnpack));
    assert.ok(pkg.build.asarUnpack.includes('node_modules/nodejieba/**'), '既有条目不得被删');
    assert.ok(pkg.build.asarUnpack.includes('skills-builtin/**'), '应新增 skills-builtin/**');
  });

  test('main.js 中播种调用位于 migrateAiMemory() 之后、new AIManager() 之前', () => {
    const src = readSource('main.js');
    const iMigrate = src.indexOf('agentWorkspace.migrateAiMemory()');
    const iSeed = src.indexOf('builtinSkillsSeeder.seedBuiltinSkills()');
    const iNewAI = src.indexOf('new AIManager()');
    assert.ok(iMigrate > 0, 'main.js 应含 migrateAiMemory()');
    assert.ok(iSeed > 0, 'main.js 应含 seedBuiltinSkills()');
    assert.ok(iNewAI > 0, 'main.js 应含 new AIManager()');
    assert.ok(iMigrate < iSeed, '播种必须在 migrateAiMemory() 之后');
    assert.ok(iSeed < iNewAI, '播种必须在 new AIManager() 之前（否则首轮 refreshSkills 看不到）');
  });

  test('find-skills/SKILL.md 含 disable-model-invocation 且禁令段在正文最前', () => {
    const md = fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8');
    assert.ok(md.includes('disable-model-invocation: true'), 'SEED-04 强制字段');
    assert.ok(md.includes('绝不执行任何安装'), '首段禁令必须显式写明「绝不执行任何安装」');
    const boundaryIdx = md.indexOf('绝不执行任何安装');
    const firstH2 = md.search(/^## /m);
    assert.ok(boundaryIdx > firstH2 && boundaryIdx < md.indexOf('\n## ', firstH2 + 1), '禁令段应是最靠前的章节');
  });
});

describe('播种原子性与差异诊断（SEED-02 / D-08 / D-09 / D-10）', () => {
  test('幂等：连续两次播种，第二次零差异零诊断，产物字节不变', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    assert.deepStrictEqual(seeder.getSeedDiagnostics(), [], '首次播种（missing）应零诊断');
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    const before = fs.readFileSync(target, 'utf8');

    seeder.seedBuiltinSkills();
    const second = seeder.getSeedDiagnostics();
    assert.ok(
      !second.some((d) => d.code === 'realm_builtin_seed_overwritten'),
      'detectDiff === same → 重启不重复写、不得产 realm_builtin_seed_overwritten'
    );
    assert.strictEqual(fs.readFileSync(target, 'utf8'), before, '产物字节不得变化');
  });

  test('不静默覆盖：手改后重跑 → warning 诊断「且」目标被覆盖为随包版本', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    fs.writeFileSync(target, '---\nname: find-skills\ndescription: 被手改过\n---\n\n手改正文\n');

    seeder.seedBuiltinSkills();
    const hit = seeder.getSeedDiagnostics().find((d) => d.code === 'realm_builtin_seed_overwritten');
    assert.ok(hit, 'D-09：手改后必须产 realm_builtin_seed_overwritten');
    assert.strictEqual(hit.level, 'warning', 'D-09：覆盖诊断是 warning 不是 error');
    assert.strictEqual(hit.skillName, 'find-skills');
    assert.ok(hit.message.includes('已被随包版本覆盖'), 'message 必须说明已被覆盖');
    assert.ok(hit.message.includes('禁用'), 'warning 必须给出正确做法（停用走设置页）');
    assert.strictEqual(
      fs.readFileSync(target, 'utf8'),
      fs.readFileSync(path.join(srcDir, 'find-skills', 'SKILL.md'), 'utf8'),
      '诊断与覆盖同时发生（D-09 与 O4 的分野：不静默，但不阻断覆盖）'
    );
  });

  test('自愈重播：手删目录后重跑 → 目录重现且不产覆盖诊断（missing 语义）', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });

    seeder.seedBuiltinSkills();
    fs.rmSync(path.join(managedDir, 'find-skills'), { recursive: true, force: true });
    assert.ok(!fs.existsSync(path.join(managedDir, 'find-skills')));

    seeder.seedBuiltinSkills();
    const target = path.join(managedDir, 'find-skills', 'SKILL.md');
    assert.ok(fs.existsSync(target), 'D-10：手删后下次播种应自愈重播');
    assert.strictEqual(
      fs.readFileSync(target, 'utf8'),
      fs.readFileSync(path.join(srcDir, 'find-skills', 'SKILL.md'), 'utf8')
    );
    assert.ok(
      !seeder.getSeedDiagnostics().some((d) => d.code === 'realm_builtin_seed_overwritten'),
      "detectDiff === missing 是「本来就没有」，不算「覆盖了用户的修改」，不得产该诊断"
    );
  });

  test('原子性：safeCopyDir 失败不留半成品，也不残留 .tmp_* / .bak_*', (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), 'new-content');

    // 场景 A：dst 已存在且完整 → 失败后必须仍是旧的完整技能（不是半成品）
    const roParent = path.join(root, 'ro-existing');
    const dstA = path.join(roParent, 'skill-a');
    fs.mkdirSync(dstA, { recursive: true });
    fs.writeFileSync(path.join(dstA, 'SKILL.md'), 'old-content');
    fs.chmodSync(roParent, 0o555);
    try {
      assert.throws(() => seeder.safeCopyDir(src, dstA), '只读父目录下替换必须失败');
    } finally {
      fs.chmodSync(roParent, 0o755);
    }
    assert.strictEqual(
      fs.readFileSync(path.join(dstA, 'SKILL.md'), 'utf8'),
      'old-content',
      '失败后目标必须保持旧的完整内容（不留半成品）'
    );
    assert.deepStrictEqual(listResidue(roParent), [], '不得残留 .tmp_* / .bak_*');

    // 场景 B：dst 不存在 → 失败后必须仍然不存在（不是「有目录但缺 SKILL.md」）
    const roParent2 = path.join(root, 'ro-missing');
    fs.mkdirSync(roParent2, { recursive: true });
    const dstB = path.join(roParent2, 'skill-b');
    fs.chmodSync(roParent2, 0o555);
    try {
      assert.throws(() => seeder.safeCopyDir(src, dstB), '只读父目录下新建必须失败');
    } finally {
      fs.chmodSync(roParent2, 0o755);
    }
    assert.ok(!fs.existsSync(dstB), '失败后目标目录不得存在');
    assert.deepStrictEqual(listResidue(roParent2), [], '不得残留 .tmp_* / .bak_*');
  });

  test('symlink fail-closed：含 symlink 的技能被跳过并产 seed_failed，同批其余技能照常播种', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const evil = path.join(srcDir, 'evil-skill');
    fs.mkdirSync(evil, { recursive: true });
    fs.writeFileSync(path.join(evil, 'SKILL.md'), '---\nname: evil-skill\ndescription: x\n---\n');
    fs.symlinkSync('/etc/hosts', path.join(evil, 'leak.txt'));

    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });
    assert.doesNotThrow(() => seeder.seedBuiltinSkills(), 'symlink 不得让播种整体抛出');

    const diags = seeder.getSeedDiagnostics();
    assert.ok(
      diags.some((d) => d.code === 'realm_builtin_seed_failed' && d.skillName === 'evil-skill'),
      '含 symlink 的技能应产 realm_builtin_seed_failed'
    );
    assert.ok(!fs.existsSync(path.join(managedDir, 'evil-skill')), '含 symlink 的技能不得落盘');
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'SKILL.md')),
      '同批其余技能仍应正常播种（单技能失败不 abort）'
    );
  });

  test('realm_builtin_src_invalid 真实触发：缺 SKILL.md 的源子目录 → error 诊断且不阻断其余技能', (t) => {
    const root = withTempRoot(t);
    const srcDir = makeSyntheticSrc(root);
    const broken = path.join(srcDir, 'broken-skill');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'README.md'), 'this dir has no SKILL.md');

    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir, managedDir });
    seeder.seedBuiltinSkills();

    const hit = seeder.getSeedDiagnostics().find((d) => d.code === 'realm_builtin_src_invalid');
    assert.ok(hit, '评审裁决项 1：该 code 必须真实可达（独立源目录扫描先于过滤）');
    assert.strictEqual(hit.level, 'error');
    assert.strictEqual(hit.path, broken, 'path 应指向缺 SKILL.md 的那个源子目录');
    assert.ok(
      fs.existsSync(path.join(managedDir, 'find-skills', 'SKILL.md')),
      '该诊断不得阻断同批合法技能的播种'
    );
  });
});

describe('诊断 code 与源码不变式（Task 2）', () => {
  test('4 个诊断 code 齐备，realm_builtin_seed_overwritten 的 level 是 warning', () => {
    const src = readSource('builtin-skills-seeder.js');
    for (const code of [
      'realm_builtin_src_missing',
      'realm_builtin_seed_overwritten',
      'realm_builtin_seed_failed',
      'realm_builtin_src_invalid',
    ]) {
      assert.ok(src.includes(code), `源码应含诊断 code ${code}`);
    }
    const idx = src.indexOf("code: 'realm_builtin_seed_overwritten'");
    assert.ok(idx > 0);
    const block = src.slice(Math.max(0, idx - 200), idx);
    assert.ok(block.includes("level: 'warning'"), '覆盖诊断必须是 warning（不得升级为 error）');
  });

  test('剥离注释后不出现 mtime / mtimeMs / birthtime（D-09 机械不变式）', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    for (const token of ['mtime', 'mtimeMs', 'birthtime']) {
      assert.ok(
        !stripped.includes(token),
        `代码行不得出现 ${token}（每次启动都覆盖 → mtime 必变 → 100% 误报）；该字样只能出现在说明性注释里`
      );
    }
  });

  test('safeCopyDir 的 tmp/bak 基于 dst 派生（同父目录 → 同卷），不用 os.tmpdir()', () => {
    const body = functionBody(readSource('builtin-skills-seeder.js'), 'safeCopyDir');
    assert.ok(body.includes('.tmp_'), '应含 .tmp_ 命名');
    assert.ok(body.includes('.bak_'), '应含 .bak_ 命名');
    assert.ok(body.includes('${dst}.tmp_'), 'tmp 必须由 dst 派生（同父目录 / 同卷）');
    assert.ok(body.includes('${dst}.bak_'), 'bak 必须由 dst 派生');
    assert.ok(!body.includes('tmpdir('), '不得使用 os.tmpdir()（macOS 可能异卷 → EXDEV）');
  });

  test('ROADMAP §Phase 47 成功判据 1 已改写为 D-08/D-09/D-10/D-11 语义', () => {
    const roadmap = readSource('.planning/ROADMAP.md');
    const start = roadmap.indexOf('### Phase 47:');
    const end = roadmap.indexOf('### Phase 48:');
    assert.ok(start > 0, 'ROADMAP 应含 §Phase 47');
    assert.ok(end > start, 'ROADMAP 应含 §Phase 48（用于截取段落边界）');
    const section = roadmap.slice(start, end);
    assert.ok(!section.includes('版本戳登记表'), '不得再出现「版本戳登记表」（O4 已被 D-08 取代）');
    assert.ok(section.includes('realm_builtin_seed_overwritten'), '判据应点名覆盖诊断 code');
    assert.ok(section.includes('settings.aiSkills.disabled'), '判据应指名停用语义的唯一存储键');
    assert.ok(section.includes('无条件覆盖'), '判据应写明无条件覆盖语义');
  });
});

describe('零安装语义扫描（SEED-03 / P1 门禁字面判据）', () => {
  test('第 1 段（零容忍无豁免）：SKILL.md + LICENSE.txt 全量零命中', () => {
    const files = stage1Files();
    assert.ok(files.length >= 2, `至少应扫到 find-skills 的两份受扫文件（实际 ${files.length}）`);
    const hits = scanFiles(files, FORBIDDEN_PATTERNS.concat(INSTALL_IMPERATIVES));
    if (hits.length > 0) {
      assert.fail(
        '零安装语义扫描命中（P1 门禁失守）：\n'
        + hits.map((h) => `  ${h.file}:${h.line} [${h.why}] /${h.pattern}/ → ${h.text}`).join('\n')
      );
    }
  });

  test('扫描范围按 glob 递归（写死单技能路径会让 47-03 的新技能静默逃出扫描面）', () => {
    const src = readSource('tests/test-builtin-skills-seeder.js');
    assert.ok(
      !functionBody(src, 'globBuiltinByBasename').includes('find-skills'),
      '扫描面枚举不得写死任何技能名'
    );
    const stage1Body = functionBody(src, 'stage1Files');
    assert.ok(!stage1Body.includes('find-skills'), 'stage1Files 不得写死单技能路径');
    assert.ok(stage1Body.includes("globBuiltinByBasename('SKILL.md')"), '应按 SKILL.md basename 递归收集');
    assert.ok(stage1Body.includes("globBuiltinByBasename('LICENSE.txt')"), '应按 LICENSE.txt basename 递归收集');

    const expected = collectFiles(REAL_BUILTIN_SRC)
      .filter((f) => ['SKILL.md', 'LICENSE.txt'].includes(path.basename(f)))
      .sort();
    assert.deepStrictEqual(stage1Files(), expected, '实际扫描文件数必须等于 glob 命中数');
  });

  test('PITFALLS P1 靶心：skills-builtin/** 内不存在 `npx skills` 的任意变体', () => {
    const variant = /\bnpx\s+skills\b/i;
    const hits = [];
    for (const file of collectFiles(REAL_BUILTIN_SRC)) {
      const rel = path.relative(REPO_ROOT, file);
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (variant.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
    assert.deepStrictEqual(hits, [], '`npx skills` 的任意变体（大小写 / 任意空白）都不得出现');
  });

  test('评审补齐项：npm 家族模式覆盖 npm exec（防止正则被「精简」掉）', () => {
    const npmPattern = FORBIDDEN_PATTERNS.find((p) => p.why.includes('npm'));
    assert.ok(npmPattern, 'FORBIDDEN_PATTERNS 应含 npm 家族模式');
    for (const sample of ['npm exec x', 'npm i x', 'npm install x', 'npm ci', 'npm add x']) {
      assert.strictEqual(npmPattern.re.test(sample), true, `npm 家族模式应覆盖: ${sample}`);
    }
  });

  test('第 2 段（带行级豁免）扫描器就位：排除法覆盖第 1 段之外的全部内容', () => {
    const files = stage2Files();
    assert.ok(
      files.length > 0,
      '47-03 落地 skill-creator 的 scripts/ / agents/ / assets/ / eval-viewer/ / references/ 之后，第 2 段集合不再是空集'
    );
    // 排除法的覆盖面证据：不列举目录名，只断言这些目录类确实落进了第 2 段
    const rels = files.map((f) => path.relative(REPO_ROOT, f));
    for (const prefix of [
      'skills-builtin/skill-creator/scripts/',
      'skills-builtin/skill-creator/agents/',
      'skills-builtin/skill-creator/assets/',
      'skills-builtin/skill-creator/eval-viewer/',
      'skills-builtin/skill-creator/references/',
    ]) {
      assert.ok(
        rels.some((r) => r.startsWith(prefix)),
        `第 2 段应覆盖 ${prefix}（排除法而非列举 scripts/ + resources/）`
      );
    }
    assert.deepStrictEqual(
      scanFiles(files, FORBIDDEN_PATTERNS.concat(INSTALL_IMPERATIVES), EXEMPTIONS),
      [],
      '第 2 段在豁免生效下应零命中'
    );

    assert.ok(EXEMPTIONS.length > 0, '豁免清单必须是非空表（47-03 的 check_env.mjs 反向语义条目已预登记）');
    for (const e of EXEMPTIONS) {
      assert.ok(typeof e.file === 'string' && e.file.length > 0, '豁免条目必须带文件相对路径');
      assert.ok(e.line instanceof RegExp, '豁免条目必须带行匹配正则');
      assert.ok(typeof e.why === 'string' && e.why.length > 0, '每条豁免必须写死豁免理由');
    }

    // 豁免清单不得削弱第 1 段：任何豁免条目的文件都不在第 1 段扫描面内
    const stage1Rel = new Set(stage1Files().map((f) => path.relative(REPO_ROOT, f)));
    for (const e of EXEMPTIONS) {
      assert.ok(!stage1Rel.has(e.file), `豁免条目 ${e.file} 不得落在第 1 段（零容忍）扫描面内`);
    }
  });
});

describe('门禁断言（SEED-04 / D-11 / SKILL-09 反向证据）', () => {
  test('SEED-04：每个内置技能 frontmatter 含 disable-model-invocation: true 且 description 含中文', () => {
    const skillMds = globBuiltinByBasename('SKILL.md');
    assert.ok(skillMds.length >= 1, '至少应有一个内置技能 SKILL.md');
    for (const file of skillMds) {
      const rel = path.relative(REPO_ROOT, file);
      const content = fs.readFileSync(file, 'utf8');
      assert.ok(
        /^disable-model-invocation:\s*true\s*$/m.test(content),
        `${rel} 的 frontmatter 应含 disable-model-invocation: true（不进 system prompt）`
      );
      const descMatch = content.match(/^description:\s*(.+)$/m);
      assert.ok(descMatch, `${rel} 应有 description`);
      assert.ok(
        /[\u4e00-\u9fff]/.test(descMatch[1]),
        `${rel} 的 description 应含至少一个 CJK 字符（D-04：面向 / 面板与设置页的人眼可读性）`
      );
    }
  });

  test('禁令段不含任何被扫 token（写禁令段时手滑引用命令名会在此定位）', () => {
    const md = fs.readFileSync(path.join(REAL_BUILTIN_SRC, 'find-skills', 'SKILL.md'), 'utf8');
    for (const token of ['npx', 'npm exec', '--global', '--yes']) {
      assert.ok(!md.includes(token), `SKILL.md 不得出现字面 token: ${token}`);
    }
    for (const re of [/(^|\s)-g(\s|$)/m, /(^|\s)-y(\s|$)/m]) {
      assert.ok(!re.test(md), `SKILL.md 不得出现危险旗标: /${re.source}/`);
    }
  });

  test('D-11 零硬编码：播种模块剥离注释后不含内置技能名字面量', () => {
    const stripped = stripComments(readSource('builtin-skills-seeder.js'));
    for (const name of ['find-skills', 'skill-creator']) {
      assert.ok(!stripped.includes(`'${name}'`), `builtin-skills-seeder.js 不得硬编码 '${name}'`);
      assert.ok(!stripped.includes(`"${name}"`), `builtin-skills-seeder.js 不得硬编码 "${name}"`);
    }
  });

  test('SKILL-09 反向证据：技能脚本经既有 bash 工具执行，零新增权限机制', () => {
    const policy = require('../ai-bash-policy');
    assert.ok(policy.DANGEROUS_INTERPRETERS.has('node'), 'node 仍须在 DANGEROUS_INTERPRETERS 内');
    assert.ok(policy.DANGEROUS_INTERPRETERS.has('python3'), 'python3 仍须在 DANGEROUS_INTERPRETERS 内');
  });
});

describe('内置技能上游快照与归属（SEED-01 / SEED-05 / P10）', () => {
  test('两个技能都被加载：播种零诊断 → 零诊断零错误识别 → 均 source === managed', async (t) => {
    const root = withTempRoot(t);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir });

    seeder.seedBuiltinSkills();
    assert.deepStrictEqual(
      seeder.getSeedDiagnostics(),
      [],
      '首次播种应为零诊断 —— skill-creator 的 LICENSE.txt / scripts/ / agents/ / eval-viewer/ 不得产生诊断（Pitfall 7）'
    );

    for (const name of ['find-skills', 'skill-creator']) {
      assert.ok(fs.existsSync(path.join(managedDir, name, 'SKILL.md')), `${name}/SKILL.md 应落盘`);
      assert.ok(fs.existsSync(path.join(managedDir, name, 'LICENSE.txt')), `${name}/LICENSE.txt 应随整目录复制落盘（P10-5 的前置）`);
    }
    // 嵌套资源也要完整落盘：整目录复制天然携带，不是只复制 SKILL.md
    for (const rel of [
      'scripts/quick_validate.py',
      'scripts/__init__.py',
      'agents/grader.md',
      'references/schemas.md',
      'eval-viewer/viewer.html',
      'assets/eval_review.html',
    ]) {
      assert.ok(fs.existsSync(path.join(managedDir, 'skill-creator', rel)), `skill-creator/${rel} 应落盘`);
    }

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snapshot = aiSkills.getSkillsSnapshot();
    for (const name of ['find-skills', 'skill-creator']) {
      const entry = snapshot.skills.find((e) => e.skill.name === name);
      assert.ok(entry, `技能加载器应零诊断识别 ${name}`);
      assert.strictEqual(entry.source, 'managed', `${name} 的来源应为 managed`);
    }
    assert.deepStrictEqual(snapshot.diagnostics, [], '加载应零诊断（LICENSE.txt 与嵌套 scripts/ 不产生诊断）');
    assert.deepStrictEqual(snapshot.errors, [], '加载应零错误');
  });

  test('两个都不进 prompt：buildSkillsPrompt() === ""（disable-model-invocation 对两个技能都生效）', async (t) => {
    const root = withTempRoot(t);
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir: path.join(root, 'managed-skills') });
    seeder.seedBuiltinSkills();

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    const snapshot = aiSkills.getSkillsSnapshot();
    assert.strictEqual(snapshot.skills.length, 2, '两个内置技能都应被识别');
    assert.strictEqual(
      aiSkills.buildSkillsPrompt(),
      '',
      'SEED-04：两个内置技能都有 disable-model-invocation: true → prompt 段为空（skill-creator 的英文 description 不得无条件进入每次请求）'
    );
  });

  test('18 个上游文件全部存在且逐字节等于固定 SHA 快照（SKILL.md 例外，用区间）', () => {
    assert.strictEqual(
      UPSTREAM_SKILL_CREATOR_FILES.length + 1,
      18,
      '计数口径唯一为 18 = 17 个逐字快照文件 + SKILL.md（本计划唯一被改写的上游文件）；scripts/check_env.mjs 由 Task 2 产出，不属于本表'
    );

    for (const { rel, bytes } of UPSTREAM_SKILL_CREATOR_FILES) {
      const abs = path.join(SKILL_CREATOR_DIR, rel);
      assert.ok(fs.existsSync(abs), `上游文件 ${rel} 应存在`);
      assert.strictEqual(
        fs.statSync(abs).size,
        bytes,
        `${rel} 字节数应精确等于上游实测值 ${bytes}（不符即说明取错了版本、或该文件被改动过）`
      );
    }

    const skillMd = path.join(SKILL_CREATOR_DIR, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), 'skill-creator/SKILL.md 应存在');
    const size = fs.statSync(skillMd).size;
    assert.ok(
      size >= UPSTREAM_SKILL_MD_BYTES.min && size <= UPSTREAM_SKILL_MD_BYTES.max,
      `SKILL.md 字节数应落在 [${UPSTREAM_SKILL_MD_BYTES.min}, ${UPSTREAM_SKILL_MD_BYTES.max}]（上游 33,168 加减受控改动），实际 ${size}`
    );

    // D-47-03-a：agents/ 随包 —— `## Advanced: Blind comparison` 章对它们的三处引用不得断链
    for (const rel of ['agents/analyzer.md', 'agents/comparator.md', 'agents/grader.md']) {
      assert.ok(fs.existsSync(path.join(SKILL_CREATOR_DIR, rel)), `${rel} 必须随包（否则正文引用断链）`);
    }
  });

  test('LICENSE.txt 是上游 Apache-2.0 全文逐字副本（精确 11,357 字节，不得摘要化）', () => {
    const license = path.join(SKILL_CREATOR_DIR, 'LICENSE.txt');
    assert.ok(fs.existsSync(license), 'skills-builtin/skill-creator/LICENSE.txt 应随包');

    const text = fs.readFileSync(license, 'utf8');
    assert.strictEqual(Buffer.byteLength(text, 'utf8'), 11357, 'LICENSE.txt 必须精确等于上游 11,357 字节');
    assert.ok(text.includes('Apache License'), 'LICENSE.txt 开头应是 Apache License');
    assert.ok(text.includes('Version 2.0, January 2004'), 'LICENSE.txt 应含 Apache-2.0 版本行');
    assert.ok(
      text.includes('APPENDIX: How to apply the Apache License to your work'),
      'LICENSE.txt 必须是完整全文（含 APPENDIX），不是自写摘要'
    );
  });

  test('SKILL.md 的六处受控改动与「英文正文 × 中文 description」边界（D-06 × D-04）', () => {
    const markdown = fs.readFileSync(path.join(SKILL_CREATOR_DIR, 'SKILL.md'), 'utf8');
    const parts = markdown.split(/^---$/m);
    const frontmatter = parts[1] || '';
    const body = parts.slice(2).join('---');

    // ① Apache-2.0 §4(b) 的显著修改声明，点名来源 SHA 并列出改动类别
    assert.ok(markdown.includes('Modified for Realm Browser'), '文首必须有显著的修改声明（Apache-2.0 §4(b)）');
    assert.ok(
      markdown.includes('b0cbd3df1533b396d281a6886d5132f623393a9c'),
      '修改声明必须点名来源固定 SHA（否则归属表述无法与 THIRD_PARTY_NOTICES.md 对齐）'
    );

    // ② 新增 Environment Preflight 章
    assert.ok(markdown.includes('## Environment Preflight'), '应新增 `## Environment Preflight` 章');

    // ③ 三章已删除（Realm 无 present_files 工具、也不是 Claude.ai / Cowork）
    for (const gone of ['present_files', 'Claude.ai-specific', 'Cowork-Specific']) {
      assert.ok(!markdown.includes(gone), `已删除的三章不得残留标题子串：${gone}`);
    }

    // ④ 两处评测章各加了前置句
    for (const anchor of [
      '## Running and evaluating test cases\n\nThis section is an optional evaluation path',
      '## Description Optimization\n\nThis section is an optional evaluation path',
    ]) {
      assert.ok(markdown.includes(anchor), `评测章开头应加「可选路径 + 先跑 check_env.mjs」的前置句（锚点：${anchor.split('\n')[0]}）`);
    }

    // ⑤ frontmatter 新增 disable-model-invocation（SEED-04）
    assert.ok(
      /^disable-model-invocation:\s*true\s*$/m.test(frontmatter),
      'SEED-04：frontmatter 应含 disable-model-invocation: true（否则约 350 字符的英文 description 会无条件进 system prompt）'
    );

    // ⑥ frontmatter 的 description 改中文，且 ≤1024 字符（SDK 的 MAX_DESCRIPTION_LENGTH）
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    assert.ok(descMatch, 'frontmatter 应有 description');
    assert.ok(
      /[\u4e00-\u9fff]/.test(descMatch[1]),
      'D-04：内置技能的 description 应为中文（面向 / 面板与设置页的人眼可读性）'
    );
    assert.ok(descMatch[1].length <= 1024, `description 长度须 ≤1024 字符，实际 ${descMatch[1].length}`);

    // D-06 的机械边界：中文只在 description，正文（frontmatter 之后）必须保持上游英文
    const cjkLines = body
      .split('\n')
      .map((line, i) => (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(line) ? `第 ${i + 1} 行: ${line.slice(0, 60)}` : null))
      .filter(Boolean);
    assert.deepStrictEqual(
      cjkLines,
      [],
      'D-06：正文必须保持上游英文原文（新增章节与前置句也要用英文写）—— 中文只允许出现在 frontmatter 的 description'
    );
  });

  test('`## Reference files` 清单与随包文件集同步（逐项存在性核对，不止匹配一个字符串）', () => {
    const markdown = fs.readFileSync(path.join(SKILL_CREATOR_DIR, 'SKILL.md'), 'utf8');
    const { section, paths } = parseReferenceFileList(markdown);

    assert.ok(paths.includes('scripts/check_env.mjs'), '清单必须包含 Realm 自研的 scripts/check_env.mjs');
    for (const deleted of ['present_files', 'Claude.ai', 'Cowork']) {
      assert.ok(!section.includes(deleted), `Reference files 清单不得再引用已删除的三章（命中 ${deleted}）`);
    }
    assert.strictEqual(
      paths.length,
      18,
      `清单应列出 18 个随包相对路径（SKILL.md 自身不计入），实际 ${paths.length} 个：${paths.join(', ')}`
    );

    // **逐项**存在性核对 —— 不是只看清单里有没有 check_env.mjs 这一个字符串
    for (const rel of paths) {
      // 显式跳过：scripts/check_env.mjs 由 Task 2 产出。本用例保持 Task 1 的口径（清单其余
      // 条目逐项核对），**全量**核对（含 check_env.mjs）在下面的「check_env.mjs 环境预检」组里。
      if (rel === 'scripts/check_env.mjs') continue;
      assert.ok(
        fs.existsSync(path.join(SKILL_CREATOR_DIR, rel)),
        `## Reference files 列出的 ${rel} 必须真实存在（清单断链会让模型按清单找文件落空）`
      );
    }
  });
});

describe('check_env.mjs 环境预检（D-05 / D-07 / SKILL-09）', () => {
  test('无参运行：退出 0，stdout 是可解析 JSON 且含 ok(boolean) 与 capabilities 分组', () => {
    const run = runCheckEnv();
    assert.strictEqual(run.status, 0, `无参运行应退出 0；stderr: ${run.stderr}`);
    const result = JSON.parse(run.stdout);
    assert.strictEqual(typeof result.ok, 'boolean', 'ok 必须是 boolean 而不是字符串');
    assert.strictEqual(result.ok, true, '本机 Python ≥3.10 且无依赖要求 → 应为 ok');
    assert.ok(result.capabilities && result.capabilities.catalog, '应含 capabilities 分组');
    assert.deepStrictEqual(
      Object.keys(result.capabilities.catalog).sort(),
      ['baseline', 'description-optimize', 'eval-viewer', 'quick-validate'],
      'capability 面收缩为 4 组（D-47-03-c：去掉依赖 claude CLI 的 run-eval / run-loop）'
    );
    assert.ok(result.python && result.python.version, '应报告解释器与版本');
  });

  test('--capability quick-validate 输出 pyyaml 的检查结果', () => {
    const run = runCheckEnv(['--capability', 'quick-validate']);
    const result = JSON.parse(run.stdout);
    assert.ok(result.packages && 'pyyaml' in result.packages, '--capability quick-validate 应检查 pyyaml');
    assert.strictEqual(typeof result.packages.pyyaml.ok, 'boolean');
    assert.deepStrictEqual(result.capabilities.requested, ['quick-validate']);
    assert.ok(
      typeof result.capabilities.status['quick-validate'].ok === 'boolean',
      'capability 分组应给出该组是否满足'
    );
  });

  test('未知 --capability / --package / --command 一律 unknown_requirement 且非零退出（ASVS V5）', () => {
    for (const args of [
      ['--capability', 'no-such-capability'],
      ['--package', 'no-such-package'],
      ['--command', 'no-such-command'],
    ]) {
      const run = runCheckEnv(args);
      assert.notStrictEqual(run.status, 0, `未知需求不得静默忽略：${args.join(' ')}`);
      const result = JSON.parse(run.stdout);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.code, 'unknown_requirement');
      assert.ok(result.known.capabilities.includes('quick-validate'), '应回报已知值清单供调用方纠正');
    }

    const incomplete = runCheckEnv(['--capability']);
    assert.notStrictEqual(incomplete.status, 0);
    assert.strictEqual(JSON.parse(incomplete.stdout).code, 'invalid_arguments');
  });

  test('REALM_SKILL_CREATOR_PYTHON 生效时优先且跳过自动探测', (t) => {
    const root = withTempRoot(t);
    const fake = makeFakePython(root, { version: '3.11.0', packages: ['pyyaml'], packageOk: true });

    const run = runCheckEnv([], { [ENV_VAR_NAME]: fake });
    assert.strictEqual(run.status, 0, `指定的解释器应被直接采用；stderr: ${run.stderr}`);
    const result = JSON.parse(run.stdout);
    assert.strictEqual(result.python.source, ENV_VAR_NAME, 'source 应为环境变量而非 PATH');
    assert.strictEqual(result.python.command, fake);
    assert.strictEqual(
      result.python.version,
      '3.11.0',
      '版本应来自被指定的解释器（证明确实跳过了 PATH 上的真实解释器）'
    );
    assert.strictEqual(result.attempted.length, 1, '指定环境变量后只应探测 1 个候选（自动探测被跳过）');
  });

  test('缺依赖路径真实可达：missing_dependency + installGuidance 的「禁止自动安装」声明', (t) => {
    const root = withTempRoot(t);
    const fake = makeFakePython(root, { packages: ['pyyaml'], packageOk: false });

    const run = runCheckEnv(['--capability', 'quick-validate'], { [ENV_VAR_NAME]: fake });
    assert.notStrictEqual(run.status, 0, '缺依赖必须非零退出');
    const result = JSON.parse(run.stdout);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'missing_dependency');
    assert.strictEqual(result.packages.pyyaml.ok, false);
    assert.strictEqual(result.capabilities.status['quick-validate'].ok, false);

    assert.ok(Array.isArray(result.installGuidance), 'installGuidance 应是数组');
    assert.strictEqual(result.installGuidance.length, 2, 'installGuidance 应为两行');
    assert.ok(
      result.installGuidance.some((line) => line.includes('Do not auto-install dependencies from this skill.')),
      '必须逐字含 Do not auto-install dependencies from this skill.（禁止安装声明的文字体现）'
    );
    assert.ok(
      result.installGuidance.some((line) => line.includes('pyyaml')),
      '指引应点名缺失的包，用户才知道装什么'
    );

    // 空的环境变量 → invalid_environment（形态校验的真实可达路径）
    const empty = runCheckEnv([], { [ENV_VAR_NAME]: '   ' });
    assert.notStrictEqual(empty.status, 0);
    assert.strictEqual(JSON.parse(empty.stdout).code, 'invalid_environment');
  });

  test('源码断言：ENV 变量名 / 4 个 capability / 8 个失败码 / find_spec / 禁止安装声明齐备', () => {
    const src = fs.readFileSync(CHECK_ENV_MJS, 'utf8');
    assert.ok(src.startsWith('#!/usr/bin/env node'), '应有 node shebang');

    for (const token of [
      'REALM_SKILL_CREATOR_PYTHON',
      'baseline',
      'quick-validate',
      'eval-viewer',
      'description-optimize',
      'python_not_found',
      'python_version_unsupported',
      'missing_dependency',
      'missing_command',
      'invalid_arguments',
      'unknown_requirement',
      'invalid_environment',
      'dependency_check_failed',
      'importlib.util.find_spec',
      'Do not auto-install dependencies from this skill.',
    ]) {
      assert.ok(src.includes(token), `check_env.mjs 应含 ${token}`);
    }

    for (const flag of ['--capability', '--package', '--command', '--json']) {
      assert.ok(src.includes(flag), `check_env.mjs 应支持 ${flag}`);
    }
  });

  test('源码断言：绝不调用任何安装命令（安装动词只出现在给用户的指引文案里）', () => {
    const src = fs.readFileSync(CHECK_ENV_MJS, 'utf8');
    for (const forbidden of [
      /\bpip3?\s+install\b/i,
      /\bnpm\s+(i|install|ci|exec|add)\b/i,
      /\bbrew\s+(install|upgrade|reinstall)\b/i,
      /\buv\s+(pip\s+install|add|tool\s+install)\b/i,
      /spawnSync\(\s*['"](?:npm|pip3?|brew|uv)['"]/,
    ]) {
      assert.ok(!forbidden.test(src), `不得出现安装调用形态：/${forbidden.source}/`);
    }
    // spawnSync 的调用目标只能是「候选解释器」与「被测命令」这两种变量，绝不是包管理器
    const spawnTargets = [...src.matchAll(/spawnSync\(([^,]+),/g)].map((m) => m[1].trim());
    assert.ok(spawnTargets.length > 0, 'check_env.mjs 应通过 spawnSync 做只读探测');
    for (const target of spawnTargets) {
      assert.ok(
        ['candidate.command', 'command'].includes(target),
        `spawnSync 的调用目标应是候选解释器或被测命令变量，实际为 ${target}`
      );
    }
  });

  test('源码断言：spawnSync 失败必须「双判」，并注释说明 error 与 status 的语义差异', () => {
    const src = fs.readFileSync(CHECK_ENV_MJS, 'utf8');
    assert.ok(
      /result\.error \|\| result\.status !== 0/.test(src),
      '应含 result.error || result.status !== 0 形态的双判'
    );
    assert.ok(
      src.includes('`Error` 对象'),
      '注释应说明 result.error 是 Error 对象（超时/ENOENT 走这一支，此时 status 为 null）'
    );
    assert.ok(src.includes('number | null'), '注释应说明 result.status 是退出码（number | null）');
    assert.ok(
      src.includes('请勿「简化」成单判') || src.includes('只判其一会漏掉整整一类失败'),
      '注释应写明为什么不能简化成单判'
    );
  });

  test('豁免机制精确生效：第 1 条豁免是承重的（去掉它该行立刻被扫出）', () => {
    const file = 'skills-builtin/skill-creator/scripts/check_env.mjs';
    const abs = path.join(REPO_ROOT, file);
    const lines = fs.readFileSync(abs, 'utf8').split('\n');

    const exempted = EXEMPTIONS[0];
    assert.ok(exempted.line instanceof RegExp, '豁免条目必须用行内容正则，不得用行号');
    const index = lines.findIndex((l) => exempted.line.test(l));
    assert.ok(index >= 0, `第 1 条豁免的正则应匹配到 ${file} 的某一行（否则就是死条目）`);

    const patterns = FORBIDDEN_PATTERNS.concat(INSTALL_IMPERATIVES);
    assert.deepStrictEqual(
      scanFiles([abs], patterns, EXEMPTIONS),
      [],
      '第 2 段扫描在豁免生效时对 check_env.mjs 应零失败'
    );

    const withoutExemption = scanFiles([abs], patterns, []);
    assert.ok(withoutExemption.length > 0, '去掉豁免后该文件必须被扫出命中（证明豁免机制是承重的，不是死代码）');
    assert.ok(
      withoutExemption.some((h) => h.line === index + 1),
      `去掉豁免后第 ${index + 1} 行必须被报出`
    );

    // 豁免正则必须匹配整段文本，而不是 install 这一个关键词 —— 否则同行其它违规内容会被一并豁免
    for (const entry of EXEMPTIONS) {
      assert.ok(entry.line instanceof RegExp, '豁免条目的匹配字段必须是 RegExp（不得是 number 类型行号）');
      assert.ok(
        entry.line.source.length > 'install'.length,
        `豁免正则须匹配整段文本而非单个关键词，实际 /${entry.line.source}/（${entry.line.source.length} 字符）`
      );
    }
  });

  test('全量文件集：skill-creator 的 19 项全部存在，Reference 清单全部条目（含 check_env.mjs）真实存在', () => {
    const actual = collectFiles(SKILL_CREATOR_DIR)
      .map((f) => path.relative(SKILL_CREATOR_DIR, f))
      .sort();
    const expected = UPSTREAM_SKILL_CREATOR_FILES.map((item) => item.rel)
      .concat('SKILL.md', 'scripts/check_env.mjs')
      .sort();

    assert.strictEqual(
      actual.length,
      19,
      `skill-creator 应为 19 个文件（18 上游 + 1 自研），实际 ${actual.length}：${actual.join(', ')}`
    );
    assert.deepStrictEqual(actual, expected, '18 个上游文件 + scripts/check_env.mjs，无缺失、无多余');

    // 补齐 Task 1 显式跳过的条目：清单里的 scripts/check_env.mjs 现在必须真实存在
    const markdown = fs.readFileSync(path.join(SKILL_CREATOR_DIR, 'SKILL.md'), 'utf8');
    const { paths } = parseReferenceFileList(markdown);
    assert.ok(paths.includes('scripts/check_env.mjs'), '全量口径下清单必须含 scripts/check_env.mjs');
    for (const rel of paths) {
      assert.ok(
        fs.existsSync(path.join(SKILL_CREATOR_DIR, rel)),
        `## Reference files 列出的 ${rel} 必须真实存在（本用例为全量口径，含 scripts/check_env.mjs）`
      );
    }
  });

  test('SKILL-09：脚本入口是 node/python3，两者都在 DANGEROUS_INTERPRETERS 内 → 每次执行必弹确认卡片', () => {
    const policy = require('../ai-bash-policy');
    const skillMd = fs.readFileSync(path.join(SKILL_CREATOR_DIR, 'SKILL.md'), 'utf8');

    assert.ok(
      skillMd.includes('node scripts/check_env.mjs'),
      '正文应写明脚本入口是 node scripts/check_env.mjs（SKILL-09 的真实载体）'
    );
    assert.ok(
      policy.DANGEROUS_INTERPRETERS.has('node'),
      '本计划**没有**为了让技能脚本跑得顺而放宽解释器危险表：node 仍在'
    );
    assert.ok(
      policy.DANGEROUS_INTERPRETERS.has('python3'),
      '本计划**没有**为了让技能脚本跑得顺而放宽解释器危险表：python3 仍在'
    );
  });
});

describe('P10 归属门禁（THIRD_PARTY_NOTICES.md）', () => {
  /** 读归属声明全文（P10 的判据是「归属完整」，所以断言都落在文档内容上） */
  function notices() {
    return readSource('THIRD_PARTY_NOTICES.md');
  }

  test('P10-1：文件位于 repo 根，且同时含 find-skills 与 skill-creator 两节', () => {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'THIRD_PARTY_NOTICES.md')), 'repo 根应有 THIRD_PARTY_NOTICES.md');
    const text = notices();
    assert.ok(text.includes('find-skills'), '应含 find-skills 一节');
    assert.ok(text.includes('skill-creator'), '应含 skill-creator 一节');
    assert.ok(/^## 1\. find-skills/m.test(text), 'find-skills 应是编号小节');
    assert.ok(/^## 2\. skill-creator/m.test(text), 'skill-creator 应是编号小节');
  });

  test('P10-4：两个固定 SHA 逐字出现（防手误抄错，且必须与下载源一致）', () => {
    const text = notices();
    // 这两个值必须与制造快照时用的 raw.githubusercontent.com/<repo>/<sha>/... 完全一致，
    // 否则归属记录与实际分发物不符（T-47-03-04 / T-47-03-05）
    assert.ok(text.includes('773fb2c7bbf16781670a3520affc4abd0c6151ae'), 'find-skills 的固定 SHA 应逐字出现');
    assert.ok(text.includes('b0cbd3df1533b396d281a6886d5132f623393a9c'), 'skill-creator 的固定 SHA 应逐字出现');
    assert.ok(text.includes('2026-07-10'), 'find-skills 的 SHA 时点应记录');
    assert.ok(text.includes('2026-03-06'), 'skill-creator 的 SHA 时点应记录');
  });

  test('P10-3：两个技能都标 modified，且文档不出现把已修改说成未修改的措辞', () => {
    const text = notices();
    assert.ok(!text.includes('unmodified'), 'fail-safe：文档不得出现把已修改说成未修改的措辞');
    const modifiedCount = (text.match(/modified/g) || []).length;
    assert.ok(modifiedCount >= 2, `两个技能条目都应变标 modified（实际出现 ${modifiedCount} 次）`);
    assert.ok(text.includes('Realm 化改写版'), 'find-skills 的修改说明应具体到「Realm 化改写」');
    for (const item of ['移除全部 CLI 与安装语义', 'disable-model-invocation', 'web_fetch']) {
      assert.ok(text.includes(item), `find-skills 的修改说明应逐项写明：${item}`);
    }
  });

  test('P10-2：五要素关键词齐备（来源仓库 / 固定 SHA / 许可证 / 是否修改 / 修改说明）', () => {
    const text = notices();
    for (const token of [
      'https://github.com/vercel-labs/skills',
      'https://github.com/anthropics/skills',
      '773fb2c7bbf16781670a3520affc4abd0c6151ae',
      'b0cbd3df1533b396d281a6886d5132f623393a9c',
      'MIT',
      'Apache License 2.0',
      'modified',
      '来源仓库',
      '固定 commit SHA',
      '许可证',
      '是否修改',
      '修改说明',
      'skills-builtin/find-skills/LICENSE.txt',
      'skills-builtin/skill-creator/LICENSE.txt',
    ]) {
      assert.ok(text.includes(token), `五要素关键词缺失：${token}`);
    }
    // skill-creator 的修改说明必须逐条列出（①..⑪ 的编号形式）
    for (const marker of ['环境预检', 'Environment Preflight', 'Reference files', 'agents/', 'check_env.mjs']) {
      assert.ok(text.includes(marker), `skill-creator 的修改说明应覆盖：${marker}`);
    }
  });

  test('P10-5：两个 LICENSE.txt 随播种逐字节落到 managed-skills/<name>/，skill-creator 精确 11,357 字节', async (t) => {
    const root = withTempRoot(t);
    const managedDir = path.join(root, 'managed-skills');
    seeder.setBuiltinDepsForTest({ srcDir: REAL_BUILTIN_SRC, managedDir });
    seeder.seedBuiltinSkills();

    const env = await workspace.createSandboxEnv({ cwd: root });
    await aiSkills.refreshSkills(env, {
      rootDirs: [workspace.getManagedSkillsDir(), workspace.getSkillsDir()],
    });

    for (const name of ['find-skills', 'skill-creator']) {
      const seeded = path.join(managedDir, name, 'LICENSE.txt');
      const source = path.join(REAL_BUILTIN_SRC, name, 'LICENSE.txt');
      // 「LICENSE.txt 不产生诊断」这条断言**不能**证明文件存在（文件缺失同样无诊断），
      // 所以这里直接断言落盘内容逐字节相同 —— 否则 P10 的自家信号行不可绑定。
      assert.ok(fs.existsSync(seeded), `${name}/LICENSE.txt 应随播种落盘`);
      assert.strictEqual(
        fs.readFileSync(seeded, 'utf8'),
        fs.readFileSync(source, 'utf8'),
        `${name}/LICENSE.txt 应与随包源逐字节相同`
      );
    }

    assert.strictEqual(
      fs.statSync(path.join(managedDir, 'skill-creator', 'LICENSE.txt')).size,
      11357,
      'skill-creator 的 Apache-2.0 全文落盘后仍应精确 11,357 字节（不得被摘要化）'
    );
    assert.deepStrictEqual(seeder.getSeedDiagnostics(), [], '许可证文件不得产生播种诊断');
  });

  test('易错事实说明三处齐备（上游无独立 LICENSE / ThirdPartyNoticeText 不随包 / spdx_id 为 null）', () => {
    const text = notices();
    for (const token of ['没有独立 LICENSE', 'ThirdPartyNoticeText', '不随包', 'spdx_id']) {
      assert.ok(text.includes(token), `易错事实说明缺失关键词：${token}`);
    }
    assert.ok(text.includes('license.spdx_id'), '应点名 GitHub API 的 license.spdx_id 字段');
    assert.ok(text.includes('vercel-labs'), 'find-skills 的补录版权行应记 vercel-labs');
  });

  test('Python 运行时依赖单列一节并声明不由 Realm 分发', () => {
    const text = notices();
    assert.ok(text.includes('不由 Realm 分发'), '应有「不由 Realm 分发」的明确声明');
    assert.ok(text.includes('pyyaml'), '应点名 pyyaml');
    assert.ok(text.includes('anthropic'), '应点名 anthropic');
    assert.ok(text.includes('run-eval') && text.includes('run-loop'), '应说明 capability 面已去掉 run-eval / run-loop');
  });

  test('最后更新日期字段（YYYY-MM-DD）与升级上游版本检查清单（≥4 步）', () => {
    const text = notices();
    assert.ok(/最后更新日期[:：]\s*\d{4}-\d{2}-\d{2}/.test(text), '应有「最后更新日期」字段且为 YYYY-MM-DD 形态');

    const anchor = text.indexOf('升级上游版本时的检查清单');
    assert.ok(anchor > 0, '应有「升级上游版本时的检查清单」一节');
    const section = text.slice(anchor);
    const steps = (section.match(/^\d+\.\s/gm) || []).length;
    assert.ok(steps >= 4, `检查清单应至少 4 步，实际 ${steps} 步`);
    // 这四步有机械兜底：改 SHA 不同步文档 / 改文档不同步文件集，P10 断言都会红
    assert.ok(section.includes('node tests/test-builtin-skills-seeder.js'), '检查清单应写明重跑 P10 断言组');
    assert.ok(section.includes('机械兜底'), '应写明这四步有测试层面的机械兜底，而非仅文档承诺');
  });

  test('check_env.mjs 的自研条目同时写明「自研」与「MIT」（不会被读成「没有许可证」）', () => {
    const text = notices();
    const paragraph = text
      .split(/\n{2,}/)
      .find((block) => block.includes('check_env.mjs') && block.includes('自研'));
    assert.ok(paragraph, '应有一处同时提到 check_env.mjs 与「自研」的段落');
    assert.ok(paragraph.includes('MIT'), '该段必须写明它以 MIT 许可证随 Realm Browser 分发');
  });
});
