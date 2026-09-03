/**
 * CLI 工具函数
 *
 * 提供配置文件读取等共享功能
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 获取 userData 目录路径
 * macOS: ~/Library/Application Support/<appName>/
 *
 * @param {string} appName - 应用名称
 * @returns {string} userData 目录路径
 */
function getUserDataPath(appName) {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  } else {
    return path.join(os.homedir(), '.config', appName);
  }
}

/**
 * 加载容器配置
 *
 * 环境判断优先级：
 * 1. env 参数（--env/-e）
 * 2. NODE_ENV 环境变量
 * 3. 默认正式环境
 *
 * @param {string} env - 环境名称：dev/nightly/prod（可选）
 * @returns {Array} 容器配置数组
 */
function loadContainers(env) {
  const configFileName = 'realm-config.json';

  // 判断环境
  let appName;
  if (env === 'dev') {
    appName = 'realm-dev';
  } else if (env === 'nightly') {
    appName = 'realm-nightly';
  } else if (env === 'prod') {
    appName = 'realm';
  } else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'debug') {
    appName = 'realm-dev';
  } else if (process.env.NODE_ENV === 'nightly') {
    appName = 'realm-nightly';
  } else {
    appName = 'realm';
  }
  const configPath = path.join(getUserDataPath(appName), configFileName);

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      return config.containers || [];
    } catch (err) {
      console.error(`读取配置文件失败: ${configPath}`);
      console.error(err.message);
    }
  }

  // 如果没有找到配置文件，返回默认容器
  return getDefaultContainers();
}

/**
 * 获取默认容器配置
 *
 * @returns {Array} 默认容器配置数组
 */
function getDefaultContainers() {
  return [
    { id: 'default', name: '默认', color: '#6B7280', icon: '🌐', phone: '', email: '', notes: '', envVars: [] },
    { id: 'work', name: '工作', color: '#3B82F6', icon: '💼', phone: '', email: '', notes: '', envVars: [] },
    { id: 'personal', name: '个人', color: '#10B981', icon: '👤', phone: '', email: '', notes: '', envVars: [] },
    { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦', phone: '', email: '', notes: '', envVars: [] },
  ];
}

module.exports = {
  getUserDataPath,
  loadContainers,
  getDefaultContainers,
};
