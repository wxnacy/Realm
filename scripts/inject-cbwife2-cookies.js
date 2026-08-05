/**
 * Cookie 注入脚本：将外部应用的 cookie 注入到 Realm Browser 容器
 *
 * 源格式 (cbwife/cbwife2.app):
 *   [{name, value, domain, path, secure, expires, httpOnly}]
 *
 * 目标格式 (Realm):
 *   [{name, value, domain, path, expirationDate, secure, httpOnly, sameSite, hostOnly, url}]
 *
 * 用法:
 *   node scripts/inject-cbwife2-cookies.js <appName> <containerId> [domainFilter] [--env dev|prod]
 *
 * 参数:
 *   appName       - 源应用名称 (如 com.cbwife.app, com.cbwife2.app)
 *   containerId   - 目标容器 ID (如 wife, wife2)
 *   domainFilter  - 可选，域名过滤关键词，逗号分隔 (如 codebuddy,workbuddy)
 *   --env         - 可选，目标环境: dev(测试,默认) 或 prod(正式)
 *
 * 示例:
 *   node scripts/inject-cbwife2-cookies.js com.cbwife.app wife codebuddy,workbuddy
 *   node scripts/inject-cbwife2-cookies.js com.cbwife.app wife codebuddy,workbuddy --env prod
 *   node scripts/inject-cbwife2-cookies.js com.cbwife2.app wife2
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 解析命令行参数
const rawArgs = process.argv.slice(2);

// 提取 --env 参数
let env = 'dev';
const args = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--env' && i + 1 < rawArgs.length) {
    env = rawArgs[i + 1];
    i++;  // 跳过 --env 的值
  } else {
    args.push(rawArgs[i]);
  }
}

// 验证 env 参数
if (!['dev', 'prod'].includes(env)) {
  console.error(`错误: --env 参数必须是 dev 或 prod，当前值: ${env}`);
  process.exit(1);
}

if (args.length < 2) {
  console.log('用法: node scripts/inject-cbwife2-cookies.js <appName> <containerId> [domainFilter] [--env dev|prod]');
  console.log('');
  console.log('参数:');
  console.log('  appName       - 源应用名称 (如 com.cbwife.app, com.cbwife2.app)');
  console.log('  containerId   - 目标容器 ID (如 wife, wife2)');
  console.log('  domainFilter  - 可选，域名过滤关键词，逗号分隔 (如 codebuddy,workbuddy)');
  console.log('  --env         - 可选，目标环境: dev(测试,默认) 或 prod(正式)');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/inject-cbwife2-cookies.js com.cbwife.app wife codebuddy,workbuddy');
  console.log('  node scripts/inject-cbwife2-cookies.js com.cbwife.app wife codebuddy,workbuddy --env prod');
  console.log('  node scripts/inject-cbwife2-cookies.js com.cbwife2.app wife2');
  process.exit(1);
}

const appName = args[0];
const containerId = args[1];
const domainFilter = args[2] ? args[2].split(',') : null;

// 根据环境确定目标应用名称
const targetAppName = env === 'prod' ? 'realm' : 'realm-dev';

// 构建路径
const SOURCE_PATH = path.join(
  os.homedir(),
  `Library/Application Support/${appName}/cookies.json`
);

const TARGET_DIR = path.join(
  os.homedir(),
  `Library/Application Support/${targetAppName}/containers/${containerId}`
);
const TARGET_PATH = path.join(TARGET_DIR, 'cookies.json');

/**
 * 将外部应用格式的 cookie 转换为 Realm 格式
 * @param {Object} cookie - 源 cookie 对象
 * @returns {Object} Realm 格式的 cookie 对象
 */
function convertCookie(cookie) {
  // 构建 URL: protocol://domain/path
  const protocol = cookie.secure ? 'https' : 'http';
  const domain = cookie.domain.startsWith('.')
    ? cookie.domain.slice(1)
    : cookie.domain;
  const url = `${protocol}://${domain}${cookie.path || '/'}`;

  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    expirationDate: cookie.expires,  // expires → expirationDate
    secure: cookie.secure || false,
    httpOnly: cookie.httpOnly || false,
    sameSite: 'unspecified',
    hostOnly: false,
    url: url,
  };
}

/**
 * 检查 cookie 域名是否匹配过滤条件
 * @param {Object} cookie - cookie 对象
 * @param {string[]} filters - 过滤关键词数组
 * @returns {boolean} 是否匹配
 */
function matchesDomainFilter(cookie, filters) {
  if (!filters || filters.length === 0) {
    return true;
  }
  return filters.some(filter => cookie.domain.includes(filter));
}

/**
 * 主函数
 */
function main() {
  console.log('=== Cookie 注入脚本 ===\n');
  console.log(`源应用: ${appName}`);
  console.log(`目标容器: ${containerId}`);
  console.log(`目标环境: ${env === 'prod' ? '正式 (realm)' : '测试 (realm-dev)'}`);
  if (domainFilter) {
    console.log(`域名过滤: ${domainFilter.join(', ')}`);
  }
  console.log('');

  // 1. 检查源文件
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`错误: 源文件不存在: ${SOURCE_PATH}`);
    process.exit(1);
  }

  // 2. 读取源文件
  console.log(`读取源文件: ${SOURCE_PATH}`);
  const sourceData = fs.readFileSync(SOURCE_PATH, 'utf8');
  let sourceCookies;
  try {
    sourceCookies = JSON.parse(sourceData);
  } catch (e) {
    console.error(`错误: 源文件 JSON 解析失败: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(sourceCookies)) {
    console.error('错误: 源文件格式不是数组');
    process.exit(1);
  }

  console.log(`源文件包含 ${sourceCookies.length} 个 cookie`);

  // 3. 域名过滤
  let filteredCookies = sourceCookies;
  if (domainFilter) {
    filteredCookies = sourceCookies.filter(cookie => matchesDomainFilter(cookie, domainFilter));
    console.log(`过滤后: ${filteredCookies.length} 个 cookie`);
  }

  if (filteredCookies.length === 0) {
    console.log('没有符合条件的 cookie，退出');
    process.exit(0);
  }

  // 4. 格式转换
  console.log('转换格式: expires → expirationDate, 补充缺失字段...');
  const convertedCookies = filteredCookies.map(convertCookie);

  // 5. 确保目标目录存在
  if (!fs.existsSync(TARGET_DIR)) {
    console.log(`创建目标目录: ${TARGET_DIR}`);
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 6. 写入目标文件
  console.log(`写入目标文件: ${TARGET_PATH}`);
  fs.writeFileSync(TARGET_PATH, JSON.stringify(convertedCookies, null, 2));

  // 7. 统计信息
  const domains = new Set(convertedCookies.map(c => c.domain));
  const secureCount = convertedCookies.filter(c => c.secure).length;
  const httpOnlyCount = convertedCookies.filter(c => c.httpOnly).length;
  const withExpiry = convertedCookies.filter(c => c.expirationDate != null).length;

  console.log('\n=== 注入完成 ===');
  console.log(`总计: ${convertedCookies.length} 个 cookie`);
  console.log(`域名数: ${domains.size}`);
  console.log(`Secure: ${secureCount}`);
  console.log(`HttpOnly: ${httpOnlyCount}`);
  console.log(`有过期时间: ${withExpiry}`);
  console.log(`会话 Cookie: ${convertedCookies.length - withExpiry}`);
  console.log(`\n域名列表:`);
  const domainCounts = {};
  convertedCookies.forEach(c => {
    domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;
  });
  Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} 个`);
    });

  const nextCmd = env === 'prod' ? 'npm start' : 'npm run dev';
  console.log(`\n下一步: 启动 ${nextCmd}，${containerId} 容器会自动加载这些 cookie`);
}

main();
