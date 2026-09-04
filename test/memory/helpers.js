/**
 * test/memory 公共夹具
 *
 * withTempMemoryDir：mkdtemp 临时目录注入 ai-memory-manager 基目录，
 * 测试结束自动清理并恢复默认路径解析。这是全计划临时目录注入的唯一入口
 * （RESEARCH Wave 0 架构性前置：manager 的 userData 路径必须可注入）。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const aiMemoryManager = require('../../ai-memory-manager');

/**
 * 为单个测试注入临时记忆目录
 * @param {string} testName - 测试名（归一化为安全字符后作临时目录前缀，便于排查残留）
 * @param {import('node:test').TestContext} t - node:test 上下文（用于注册 t.after 清理）
 * @returns {string} 临时目录绝对路径
 */
function withTempMemoryDir(testName, t) {
  const safePrefix = String(testName)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'test';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `realm-ai-memory-${safePrefix}-`));
  aiMemoryManager.setBaseDir(tmp);
  t.after(() => {
    aiMemoryManager.setBaseDir(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  return tmp;
}

module.exports = { withTempMemoryDir };
