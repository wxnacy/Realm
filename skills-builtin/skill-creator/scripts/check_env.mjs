#!/usr/bin/env node
/**
 * check_env.mjs — skill-creator 的环境预检探针（Realm 版）
 *
 * 本文件由 Realm 自研（**不是**上游 anthropics/skills 的快照），以 MIT 许可证随
 * Realm Browser 分发。归属说明见仓库根 THIRD_PARTY_NOTICES.md。
 *
 * 职责：按 capability 分组报告「本技能的 Python 脚本在当前环境里能不能跑」——
 * 探测 Python 解释器与版本、检查包是否可导入、检查外部命令是否在 PATH 上，
 * 并把结果以 JSON 打到 stdout，用退出码表达成败（0 = ok，1 = 不 ok）。
 *
 * 三条不变式：
 *  1. **只读探测**。包检查用 `importlib.util.find_spec`（不真 import，避免副作用），
 *     解释器检查只跑一段打印版本号的代码。本脚本**绝不安装任何东西**（P1 门禁的语义
 *     延伸：随包脚本自己装依赖等于把安装语义装回随包内容）。
 *  2. **未知输入不得静默忽略**（ASVS V5）。未知的 `--capability` / `--package` /
 *     `--command` 一律返回 `unknown_requirement` 且非零退出，绝不「假装检查过了」。
 *  3. **零新增权限机制**（SKILL-09）。脚本经既有的 bash 工具执行 —— 它的 shebang 是
 *     `node`，而 `node` 在 `ai-bash-policy.js` 的 `DANGEROUS_INTERPRETERS` 内，所以每次
 *     调用都会弹确认卡片。这是设计预期，不是缺陷。
 *
 * 用法：node scripts/check_env.mjs [--capability name] [--package name] [--command name] [--json]
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** 指定解释器路径的环境变量（由用户自己设置 → 只做形态校验，不校验路径合法性） */
const ENV_VAR = 'REALM_SKILL_CREATOR_PYTHON';
const MIN_PYTHON_VERSION = [3, 10, 0];
const MIN_PYTHON_VERSION_TEXT = `${MIN_PYTHON_VERSION[0]}.${MIN_PYTHON_VERSION[1]}`;
const CHECK_TIMEOUT_MS = 10_000;

/** 需要探测的 Python 包：`moduleName` 是 import 名（≠ 包名，pyyaml → yaml） */
const PACKAGE_SPECS = {
  pyyaml: {
    packageName: 'pyyaml',
    moduleName: 'yaml',
    purpose: 'SKILL.md frontmatter validation',
  },
  anthropic: {
    packageName: 'anthropic',
    moduleName: 'anthropic',
    purpose: 'description optimization loop',
  },
};

/**
 * capability 分组（Realm 版收缩为 4 组，D-47-03-c）
 *
 * 参照实现里的 `run-eval` / `run-loop` 已去掉：它们依赖 `claude` CLI，Realm 不分发
 * 也不假设该 CLI 存在。缺口不会静默 —— `--command` 或 `missing_command` 失败码会如实暴露。
 */
const CAPABILITIES = {
  baseline: { packages: [], commands: [] },
  'quick-validate': { packages: ['pyyaml'], commands: [] },
  'eval-viewer': { packages: [], commands: [] },
  'description-optimize': { packages: ['anthropic'], commands: [] },
};

/**
 * `--command` 的允许集合
 *
 * 只列入 Realm 版确实依赖的可执行文件：探针自身的运行时（node）与解释器家族（python3）。
 * 上游参照实现里的 `claude` CLI **刻意不在此列**，所以 `--command claude` 会得到
 * `unknown_requirement` 而不是「缺失」——如实表达「它不属于本技能的工具链」。
 */
const KNOWN_COMMANDS = ['node', 'python3'];

/** 失败码集合（8 个）。常量单源：全部经此表引用，避免字面量写错。 */
const FAILURE_CODES = Object.freeze({
  PYTHON_NOT_FOUND: 'python_not_found',
  PYTHON_VERSION_UNSUPPORTED: 'python_version_unsupported',
  MISSING_DEPENDENCY: 'missing_dependency',
  MISSING_COMMAND: 'missing_command',
  INVALID_ARGUMENTS: 'invalid_arguments',
  UNKNOWN_REQUIREMENT: 'unknown_requirement',
  INVALID_ENVIRONMENT: 'invalid_environment',
  DEPENDENCY_CHECK_FAILED: 'dependency_check_failed',
});

const VERSION_SCRIPT = `
import json
import sys
version = sys.version_info
print(json.dumps({
    "version": "%d.%d.%d" % (version[0], version[1], version[2]),
    "major": int(version[0]),
    "minor": int(version[1]),
    "micro": int(version[2]),
    "executable": sys.executable,
}))
`;

/**
 * 包检查脚本：用 importlib.util.find_spec 判定「能不能 import」
 *
 * **不要改成真的 `import`** —— find_spec 只查解析结果，不执行模块顶层代码，
 * 因而不触发任何导入副作用（这是本探针「只读」承诺的一部分）。
 */
const IMPORT_SCRIPT = `
import importlib.util
import json
import sys
specs = json.loads(sys.argv[1])
packages = {}
for item in specs:
    package_name = item["packageName"]
    module_name = item["moduleName"]
    packages[package_name] = {
        "packageName": package_name,
        "moduleName": module_name,
        "ok": importlib.util.find_spec(module_name) is not None,
    }
print(json.dumps({"packages": packages}))
`;

/** 按 capability 分组的静态声明（结果里的 catalog 字段） */
function capabilityCatalog() {
  const catalog = {};
  for (const [name, spec] of Object.entries(CAPABILITIES)) {
    catalog[name] = { packages: [...spec.packages], commands: [...spec.commands] };
  }
  return catalog;
}

function parseArgs(argv) {
  const capabilities = [];
  const packages = [];
  const commands = [];
  const unknown = [];
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = (flag) => {
      const value = argv[index + 1];
      index += 1;
      if (!value || value.startsWith('--')) {
        unknown.push(flag);
        return null;
      }
      return value;
    };

    if (arg === '--capability') {
      const value = readValue(arg);
      if (value) capabilities.push(value);
    } else if (arg.startsWith('--capability=')) {
      capabilities.push(arg.slice('--capability='.length));
    } else if (arg === '--package') {
      const value = readValue(arg);
      if (value) packages.push(value);
    } else if (arg.startsWith('--package=')) {
      packages.push(arg.slice('--package='.length));
    } else if (arg === '--command') {
      const value = readValue(arg);
      if (value) commands.push(value);
    } else if (arg.startsWith('--command=')) {
      commands.push(arg.slice('--command='.length));
    } else if (arg === '--json') {
      // JSON 本就是唯一输出格式；该旗标存在的意义是让调用方可以显式表达「我要机器可读输出」。
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      unknown.push(arg);
    }
  }

  return { capabilities, packages, commands, unknown, help };
}

function helpResult() {
  return {
    ok: true,
    code: 'ok',
    message: [
      'Usage: node scripts/check_env.mjs [--capability name] [--package name] [--command name] [--json]',
      `Requires Python ${MIN_PYTHON_VERSION_TEXT}+ for the bundled skill-creator scripts.`,
      `Capabilities: ${Object.keys(CAPABILITIES).join(', ')}`,
      `Packages: ${Object.keys(PACKAGE_SPECS).join(', ')}`,
      `Commands: ${KNOWN_COMMANDS.join(', ')}`,
    ].join('\n'),
  };
}

/**
 * 由 `REALM_SKILL_CREATOR_PYTHON` 构造解释器候选
 *
 * **只做形态校验**（非空字符串），**不校验路径合法性** —— 该变量由用户自己设置，
 * 设置它就等于授权执行该路径上的程序。它不是远程输入，因此不构成漏洞面。
 */
function parsePythonCommand(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error(`${ENV_VAR} is set but empty; unset it or point it at a Python executable.`);
  }
  return { command: trimmed, args: [], label: trimmed, source: ENV_VAR };
}

function pythonCandidates() {
  const candidates = [];
  const override = process.env[ENV_VAR];
  if (override !== undefined) {
    // 用户显式指定 → 优先且**唯一**，跳过自动探测（避免「指定的解释器不合格却悄悄回落到另一个」）
    return [parsePythonCommand(override)];
  }

  if (process.platform === 'win32') {
    candidates.push(
      { command: 'py', args: ['-3'], label: 'py -3', source: 'PATH' },
      { command: 'python', args: [], label: 'python', source: 'PATH' },
      { command: 'python3', args: [], label: 'python3', source: 'PATH' },
    );
  } else {
    candidates.push(
      { command: 'python3', args: [], label: 'python3', source: 'PATH' },
      { command: 'python', args: [], label: 'python', source: 'PATH' },
    );
  }
  return candidates.filter(Boolean);
}

function runPython(candidate, code, args = []) {
  return spawnSync(candidate.command, [...candidate.args, '-c', code, ...args], {
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
  });
}

function parseJsonOutput(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function versionAtLeast(found) {
  const parts = [found.major, found.minor, found.micro];
  for (let index = 0; index < MIN_PYTHON_VERSION.length; index += 1) {
    if (parts[index] > MIN_PYTHON_VERSION[index]) return true;
    if (parts[index] < MIN_PYTHON_VERSION[index]) return false;
  }
  return true;
}

/**
 * 探测可用的 Python 解释器
 *
 * `result.error || result.status !== 0` 是**双判**，两个分支语义不同、必须都判：
 *  - `result.error` 是 **`Error` 对象**（不是字符串）：进程根本没起来（`ENOENT`），
 *    或传了 `timeout` 后被超时杀掉 —— 超时这一支 `status` 会是 `null`；
 *  - `result.status` 是**子进程退出码**（`number | null`）：进程起来了但非零退出。
 * 只判其一会漏掉整整一类失败，**请勿「简化」成单判**。
 */
function findPython() {
  const attempted = [];
  let unsupported = null;

  for (const candidate of pythonCandidates()) {
    const result = runPython(candidate, VERSION_SCRIPT);
    const attempt = {
      command: candidate.label,
      source: candidate.source,
      status: result.status,
      error: result.error ? result.error.message : undefined,
    };
    attempted.push(attempt);

    if (result.error || result.status !== 0) {
      continue;
    }

    const version = parseJsonOutput(result.stdout);
    if (!version) {
      attempt.error = 'Python version probe returned no JSON.';
      continue;
    }

    const python = {
      ok: true,
      command: candidate.label,
      source: candidate.source,
      executable: version.executable,
      version: version.version,
      major: Number(version.major),
      minor: Number(version.minor),
      micro: Number(version.micro),
      minimumVersion: MIN_PYTHON_VERSION_TEXT,
    };

    if (versionAtLeast(python)) {
      return { ok: true, python, runner: candidate, attempted };
    }
    unsupported ??= { python, attempted };
  }

  if (unsupported) {
    return {
      ok: false,
      code: FAILURE_CODES.PYTHON_VERSION_UNSUPPORTED,
      python: { ...unsupported.python, ok: false },
      attempted,
      message: `Skill Creator scripts require Python ${MIN_PYTHON_VERSION_TEXT}+; found ${unsupported.python.version} at ${unsupported.python.command}.`,
    };
  }

  return {
    ok: false,
    code: FAILURE_CODES.PYTHON_NOT_FOUND,
    python: { ok: false, minimumVersion: MIN_PYTHON_VERSION_TEXT },
    attempted,
    message: `Skill Creator scripts require Python ${MIN_PYTHON_VERSION_TEXT}+. Expose a Python interpreter on PATH, or set ${ENV_VAR} to one, then retry.`,
  };
}

function collectRequirements(capabilities, packages, commands) {
  const allPackages = new Set(packages);
  const allCommands = new Set(commands);

  for (const capability of capabilities) {
    const spec = CAPABILITIES[capability];
    for (const packageName of spec.packages) allPackages.add(packageName);
    for (const commandName of spec.commands) allCommands.add(commandName);
  }

  return { packages: [...allPackages], commands: [...allCommands] };
}

function checkPackages(runner, packageNames) {
  if (packageNames.length === 0) return {};

  const specs = packageNames.map((packageName) => PACKAGE_SPECS[packageName]);
  const result = runPython(runner, IMPORT_SCRIPT, [JSON.stringify(specs)]);
  // 同 findPython 的双判：error（Error 对象，超时/ENOENT）与 status（退出码 number|null）
  if (result.error || result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : '';
    throw new Error(
      `Python package probe failed: ${result.error ? result.error.message : stderr || 'unknown error'}`
    );
  }

  const parsed = parseJsonOutput(result.stdout);
  if (!parsed || !parsed.packages) {
    throw new Error('Python package probe returned no parsable JSON.');
  }
  return parsed.packages;
}

function checkCommands(commandNames) {
  const status = {};
  const missing = [];

  for (const command of commandNames) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: CHECK_TIMEOUT_MS });
    // 同上：error（Error 对象）与 status（退出码）是两种不同的失败
    const ok = !result.error && result.status === 0;
    status[command] = {
      ok,
      status: result.status,
      error: result.error ? result.error.message : undefined,
      stdout: result.stdout ? String(result.stdout).trim().slice(0, 200) : undefined,
    };
    if (!ok) missing.push(command);
  }

  return { status, missing };
}

function unknownRequirementResult(kind, values) {
  return {
    ok: false,
    code: FAILURE_CODES.UNKNOWN_REQUIREMENT,
    capabilities: { catalog: capabilityCatalog(), requested: [], status: {} },
    message: `Unknown ${kind}: ${values.join(', ')}`,
    known: {
      capabilities: Object.keys(CAPABILITIES),
      packages: Object.keys(PACKAGE_SPECS),
      commands: [...KNOWN_COMMANDS],
    },
  };
}

/**
 * 组装输出对象
 *
 * 顶层字段固定为 ok / code / python / packages / commands / capabilities /
 * installGuidance / message —— `capabilities` 恒在（含 4 组静态声明），
 * `installGuidance` 恒在（无缺失时为空数组），调用方不必做存在性分支。
 */
function buildResult({ ok, code, python, requirements, packages, commands, capabilities, installGuidance, message, attempted }) {
  return {
    ok,
    code,
    python: python || null,
    packages: packages || {},
    commands: commands || {},
    capabilities: capabilities || { catalog: capabilityCatalog(), requested: [], status: {} },
    installGuidance: installGuidance || [],
    message: message || '',
    requirements: requirements || { packages: [], commands: [] },
    // 探测过哪些解释器候选（含每个候选的退出码 / 启动错误）—— 用于回答「为什么没找到 Python」，
    // 也是「REALM_SKILL_CREATOR_PYTHON 生效时自动探测被跳过」的机械证据（此时只有 1 条）。
    attempted: attempted || [],
  };
}

/** 按请求过的 capability 逐个算「满足 / 缺什么」（未请求的组不进 status） */
function capabilityStatus(requested, packageStatus, commandStatus) {
  const status = {};
  for (const capability of requested) {
    const spec = CAPABILITIES[capability];
    const missingPackages = spec.packages.filter((name) => !packageStatus[name]?.ok);
    const missingCommands = spec.commands.filter((name) => !commandStatus[name]?.ok);
    status[capability] = {
      ok: missingPackages.length === 0 && missingCommands.length === 0,
      packages: [...spec.packages],
      commands: [...spec.commands],
      missingPackages,
      missingCommands,
    };
  }
  return status;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return helpResult();

  if (args.unknown.length > 0) {
    return buildResult({
      ok: false,
      code: FAILURE_CODES.INVALID_ARGUMENTS,
      message: `Unknown or incomplete argument(s): ${args.unknown.join(', ')}. Run with --help for usage.`,
    });
  }

  // ASVS V5：未知需求值不得静默忽略
  const unknownCapabilities = args.capabilities.filter((name) => !CAPABILITIES[name]);
  if (unknownCapabilities.length > 0) return unknownRequirementResult('capability', unknownCapabilities);

  const unknownPackages = args.packages.filter((name) => !PACKAGE_SPECS[name]);
  if (unknownPackages.length > 0) return unknownRequirementResult('package', unknownPackages);

  const unknownCommands = args.commands.filter((name) => !KNOWN_COMMANDS.includes(name));
  if (unknownCommands.length > 0) return unknownRequirementResult('command', unknownCommands);

  let pythonResult;
  try {
    pythonResult = findPython();
  } catch (error) {
    return buildResult({
      ok: false,
      code: FAILURE_CODES.INVALID_ENVIRONMENT,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!pythonResult.ok) {
    return buildResult({
      ok: false,
      code: pythonResult.code,
      python: pythonResult.python,
      attempted: pythonResult.attempted,
      message: pythonResult.message,
    });
  }

  const requirements = collectRequirements(args.capabilities, args.packages, args.commands);

  let packageStatus;
  try {
    packageStatus = checkPackages(pythonResult.runner, requirements.packages);
  } catch (error) {
    return buildResult({
      ok: false,
      code: FAILURE_CODES.DEPENDENCY_CHECK_FAILED,
      python: pythonResult.python,
      requirements,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const missingPackages = requirements.packages
    .filter((name) => !packageStatus[name]?.ok)
    .map((name) => PACKAGE_SPECS[name]);

  if (missingPackages.length > 0) {
    const names = missingPackages.map((item) => item.packageName).join(', ');
    return buildResult({
      ok: false,
      code: FAILURE_CODES.MISSING_DEPENDENCY,
      python: pythonResult.python,
      attempted: pythonResult.attempted,
      requirements,
      packages: packageStatus,
      capabilities: {
        catalog: capabilityCatalog(),
        requested: args.capabilities,
        status: capabilityStatus(args.capabilities, packageStatus, {}),
      },
      // 这两行是**禁止安装**的声明（语义与 P1 门禁一致）。扫描器的行级豁免清单
      // 就是为它们登记的 —— 理由见 tests/test-builtin-skills-seeder.js 的 EXEMPTIONS。
      installGuidance: [
        `Install the skill-creator Python dependencies yourself, in the Python environment reported above (confirm with the user first): ${names}.`,
        'Do not auto-install dependencies from this skill.',
      ],
      message: `Missing Python package(s): ${names}.`,
    });
  }

  const commandStatus = checkCommands(requirements.commands);
  if (commandStatus.missing.length > 0) {
    return buildResult({
      ok: false,
      code: FAILURE_CODES.MISSING_COMMAND,
      python: pythonResult.python,
      requirements,
      packages: packageStatus,
      commands: commandStatus.status,
      capabilities: {
        catalog: capabilityCatalog(),
        requested: args.capabilities,
        status: capabilityStatus(args.capabilities, packageStatus, commandStatus.status),
      },
      installGuidance: [
        `Expose the missing command(s) on PATH before using this capability: ${commandStatus.missing.join(', ')}.`,
      ],
      message: `Missing command(s): ${commandStatus.missing.join(', ')}.`,
    });
  }

  return buildResult({
    ok: true,
    code: 'ok',
    python: pythonResult.python,
    attempted: pythonResult.attempted,
    requirements,
    packages: packageStatus,
    commands: commandStatus.status,
    capabilities: {
      catalog: capabilityCatalog(),
      requested: args.capabilities,
      status: capabilityStatus(args.capabilities, packageStatus, commandStatus.status),
    },
    message: 'Skill Creator environment is ready for the requested capability.',
  });
}

const result = main();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(result.ok ? 0 : 1);
