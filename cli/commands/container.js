/**
 * 容器管理命令
 *
 * 提供容器的增删改查功能
 */

'use strict';

const { loadContainers } = require('../utils');

/**
 * 打印容器列表（表格形式）
 *
 * 默认显示：ID、名称、手机、邮箱
 * 可通过 --fields 追加显示其他字段（如 notes, envVars）
 *
 * @param {object} options - 选项 { fields, env }
 */
async function listContainers(options = {}) {
  const containers = loadContainers(options.env);
  const extraFields = options.fields || [];

  if (containers.length === 0) {
    console.log('没有找到容器配置');
    return;
  }

  // 默认列定义（宽度动态计算）
  const defaultCols = {
    id: {
      label: 'ID',
      width: Math.max(2, ...containers.map(c => String(c.id || '').length), 8),
    },
    name: {
      label: '名称',
      width: Math.max(4, ...containers.map(c => String(c.name || '').length), 8),
    },
  };

  // 动态列（用户通过 --fields 指定的字段）
  const dynamicCols = {};
  extraFields.forEach(field => {
    const labelWidth = field.length;
    const maxValueWidth = Math.max(
      ...containers.map(c => {
        const val = getFieldValue(c, field);
        const str = formatValue(val);
        return str.length;
      })
    );
    dynamicCols[field] = {
      label: field,
      width: Math.max(labelWidth, maxValueWidth, 8),
    };
  });

  const allCols = { ...defaultCols, ...dynamicCols };

  // 计算实际宽度（考虑中文字符）
  function strWidth(str) {
    let width = 0;
    for (const char of str) {
      width += /[一-龥]/.test(char) ? 2 : 1;
    }
    return width;
  }

  function padRight(str, targetWidth) {
    const currentWidth = strWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
  }

  // 格式化单元格值
  function formatValue(val) {
    if (val === undefined || val === null || val === '') return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  /**
   * 获取字段值
   * 优先从顶级属性获取，如果没有则从 envVars 中按 key 查找
   */
  function getFieldValue(container, field) {
    // 顶级属性
    if (container[field] !== undefined) {
      return container[field];
    }

    // 从 envVars 中按 key 查找
    if (Array.isArray(container.envVars)) {
      const envVar = container.envVars.find(v => v.key === field);
      if (envVar) {
        return envVar.value;
      }
    }

    return undefined;
  }

  // 打印表头
  const header = Object.values(allCols).map(col => padRight(col.label, col.width)).join(' │ ');
  const separator = Object.values(allCols).map(col => '─'.repeat(col.width)).join('─┼─');

  console.log(header);
  console.log(separator);

  // 打印每行
  containers.forEach(c => {
    const defaultValues = [
      padRight(c.id || '', defaultCols.id.width),
      padRight(c.name || '', defaultCols.name.width),
    ];

    const dynamicValues = extraFields.map(field => {
      const col = dynamicCols[field];
      return padRight(formatValue(getFieldValue(c, field)), col.width);
    });

    console.log([...defaultValues, ...dynamicValues].join(' │ '));
  });

  console.log(`\n共 ${containers.length} 个容器`);
}

/**
 * 显示单个容器详情
 *
 * @param {string} id - 容器 ID
 * @param {object} options - 选项 { env }
 */
async function showContainer(id, options = {}) {
  if (!id) {
    console.error('错误: 请指定容器 ID');
    console.error('用法: realm container show <id>');
    process.exit(1);
  }

  const containers = loadContainers(options.env);
  const container = containers.find(c => c.id === id);

  if (!container) {
    console.error(`错误: 容器 "${id}" 不存在`);
    process.exit(1);
  }

  console.log('容器详情:');
  console.log(`  ID:    ${container.id}`);
  console.log(`  名称:  ${container.name}`);
  console.log(`  颜色:  ${container.color}`);
  console.log(`  图标:  ${container.icon}`);
  console.log(`  手机:  ${container.phone || '-'}`);
  console.log(`  邮箱:  ${container.email || '-'}`);
  console.log(`  备注:  ${container.notes || '-'}`);
}

/**
 * 命令路由
 *
 * @param {string} subcommand - 子命令
 * @param {object} options - 解析后的选项 { fields, env }
 * @param {string[]} positionals - 位置参数
 */
async function run(subcommand, options = {}, positionals = []) {
  switch (subcommand) {
    case 'list':
    case 'ls':
    case 'l':
      await listContainers(options);
      break;

    case 'show':
    case 's':
      await showContainer(positionals[0], options);
      break;

    default:
      console.error(`未知子命令: ${subcommand || '(空)'}`);
      console.error('可用子命令: list, show');
      process.exit(1);
  }
}

module.exports = { run };
