#!/usr/bin/env node

/**
 * Realm Browser CLI 入口
 *
 * 用法：realm <command> [options]
 *
 * 命令：
 *   container list    列出所有容器
 *   container show    显示容器详情
 *   help              显示帮助信息
 *   version           显示版本号
 */

'use strict';

const { version } = require('../package.json');
const containerCmd = require('../cli/commands/container');

/**
 * 解析命令行参数
 *
 * 支持：
 *   --fields phone,email   指定显示字段
 *   --env dev              指定环境（dev/prod）
 *   -e dev                 短参数
 *
 * @param {string[]} args - 原始参数数组
 * @returns {object} 解析结果 { command, subcommand, options, positionals }
 */
function parseArgs(args) {
  const result = {
    command: null,
    subcommand: null,
    options: {},
    positionals: [],
  };

  let i = 0;

  // 解析命令和子命令
  if (i < args.length && !args[i].startsWith('-')) {
    result.command = args[i++];
  }
  if (i < args.length && !args[i].startsWith('-')) {
    result.subcommand = args[i++];
  }

  // 解析选项
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--fields' || arg === '-f') {
      result.options.fields = args[++i].split(',');
    } else if (arg === '--env' || arg === '-e') {
      result.options.env = args[++i];
    } else if (arg.startsWith('-')) {
      // 未知选项
      console.error(`未知选项: ${arg}`);
      process.exit(1);
    } else {
      result.positionals.push(arg);
    }
    i++;
  }

  return result;
}

// 帮助信息
function showHelp() {
  console.log(`
Realm Browser CLI - 多容器隔离浏览器管理工具

用法：realm <command> [options]

命令：
  container list              列出所有容器
  container show <id>         显示容器详情
  help                        显示帮助信息
  version                     显示版本号

选项：
  --fields <fields>           指定显示字段（逗号分隔）
  --env, -e <env>             指定环境：dev（开发）/ prod（正式）
                              默认：正式环境

示例：
  realm container list
  realm container list --fields phone,email,notes
  realm container list -e dev
  realm container list --env dev --fields phone,email
  realm container show work
  `.trim());
}

// 主路由
async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  try {
    switch (parsed.command) {
      case 'container':
      case 'containers':
      case 'c':
        await containerCmd.run(parsed.subcommand, parsed.options, parsed.positionals);
        break;

      case 'version':
      case '-v':
      case '--version':
        console.log(`realm v${version}`);
        break;

      case 'help':
      case '-h':
      case '--help':
      case undefined:
        showHelp();
        break;

      default:
        console.error(`未知命令: ${parsed.command}`);
        console.error('运行 "realm help" 查看可用命令');
        process.exit(1);
    }
  } catch (err) {
    console.error(`错误: ${err.message}`);
    process.exit(1);
  }
}

main();
