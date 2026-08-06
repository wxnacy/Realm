/**
 * Realm Browser - Webview Guest Preload 脚本
 *
 * 通过 contextBridge 暴露安全的 IPC 桥接方法，使注入脚本能即时发送
 * 视频检测结果到 renderer 进程（per D-10 即时通知，不做防抖）。
 *
 * 注入脚本通过 window.__realmBridge.sendMediaDetected(videos) 发送数据，
 * 数据经由 webview ipc-message 事件传递到 renderer。
 *
 * @module webview-preload
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给 webview guest 页面的安全桥接接口
 * 注入脚本通过 window.__realmBridge 访问
 */
contextBridge.exposeInMainWorld('__realmBridge', {
  /**
   * 即时发送检测到的视频数据到 renderer 进程
   * 通过 ipcRenderer.sendToHost 触发 webview 的 ipc-message 事件
   *
   * @param {Array<Object>} videos - 检测到的视频数组
   * @param {string} videos[].url - 视频 URL
   * @param {string} [videos[].type] - 视频类型
   * @param {string} [videos[].source] - 检测来源（script/dom）
   */
  sendMediaDetected: (videos) => {
    ipcRenderer.sendToHost('media:detected', videos);
  },
});
