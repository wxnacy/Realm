/**
 * Realm Browser - 容器默认定义（单一数据源）
 *
 * 单独成模块的原因：container-manager.js 顶层 require 了 cookie-manager.js，
 * 而 cookie-manager.js 与 main.js 也需要这份默认值。若让它们反向顶层
 * require container-manager.js，会形成循环依赖 —— 加载顺序靠后的一方拿到的
 * 是尚未填充的 module.exports（空对象），默认值会静默变成 undefined。
 *
 * 本模块零依赖，任何模块都可在顶层安全引用。
 *
 * 约定：消费端**只读**。需要增删改（如 createContainer 的 push、
 * updateContainer 的按下标赋值）时必须先自行拷贝，否则会污染该常量，
 * 使后续所有读取者看到被改过的"默认值"。
 */

/**
 * 全新环境（realm-config.json 中尚无 containers 键，即用户从未增删改过容器）
 * 使用的初始容器列表。
 */
const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: 'fingerprint', phone: '', email: '', notes: '', envVars: [] },
  { id: 'work', name: '工作', color: '#3B82F6', icon: 'briefcase', phone: '', email: '', notes: '', envVars: [] },
  { id: 'personal', name: '个人', color: '#10B981', icon: 'user', phone: '', email: '', notes: '', envVars: [] },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: 'bank', phone: '', email: '', notes: '', envVars: [] },
];

module.exports = { DEFAULT_CONTAINERS };
