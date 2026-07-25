/**
 * postinstall：用项目自定义图标替换 dev 模式下 Electron.app 的默认图标。
 *
 * 原因：dev 模式跑的是 node_modules/electron/dist/Electron.app，
 * macOS Dock 在应用退出瞬间会回读 bundle 静态图标（electron.icns），
 * 导致关闭时闪回默认图标。替换该文件后，dev 全程显示项目图标。
 *
 * 仅 macOS 生效；其他平台直接跳过。
 */
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const src = path.join(__dirname, '..', 'icons', 'icon.icns');
const dest = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist',
  'Electron.app', 'Contents', 'Resources', 'electron.icns'
);

if (!fs.existsSync(src) || !fs.existsSync(dest)) {
  process.exit(0);
}

fs.copyFileSync(src, dest);
// 触发 LaunchServices 刷新图标缓存
const appPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app');
const now = new Date();
fs.utimesSync(appPath, now, now);

console.log('[postinstall] Electron.app 图标已替换为 icons/icon.icns');
