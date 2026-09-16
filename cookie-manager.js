/**
 * Realm Browser - Cookie 管理模块
 *
 * 管理容器 Cookie 的保存、加载、导出和导入
 * 每个容器的 Cookie 独立存储在容器目录下的 cookies.json 文件
 */

const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const { DEFAULT_CONTAINERS } = require('./container-defaults');

// 配置存储实例
const configStore = new Store({ name: 'realm-config' });

// 容器目录根路径
const CONTAINERS_DIR = path.join(app.getPath('userData'), 'containers');

// 旧版 Cookie 存储目录（用于迁移）
const LEGACY_COOKIE_DIR = path.join(app.getPath('userData'), 'cookies');

/**
 * 获取容器目录路径
 * @param {string} containerId - 容器 ID
 * @returns {string} 容器目录路径
 */
function getContainerDir(containerId) {
  return path.join(CONTAINERS_DIR, containerId);
}

/**
 * 获取容器 Cookie 文件路径
 * @param {string} containerId - 容器 ID
 * @returns {string} Cookie 文件路径
 */
function getCookieFilePath(containerId) {
  return path.join(getContainerDir(containerId), 'cookies.json');
}

/**
 * 确保容器目录存在
 * @param {string} containerId - 容器 ID
 */
function ensureContainerDir(containerId) {
  const containerDir = getContainerDir(containerId);
  if (!fs.existsSync(containerDir)) {
    fs.mkdirSync(containerDir, { recursive: true });
  }
}

/**
 * 迁移旧版 Cookie 文件到新版容器目录
 * 仅在旧文件存在且新文件不存在时执行迁移
 */
function migrateLegacyCookies() {
  if (!fs.existsSync(LEGACY_COOKIE_DIR)) {
    return;
  }

  const containers = configStore.get('containers', DEFAULT_CONTAINERS);
  for (const container of containers) {
    const legacyPath = path.join(LEGACY_COOKIE_DIR, `${container.id}.json`);
    const newPath = getCookieFilePath(container.id);

    // 仅迁移旧文件存在且新文件不存在的情况
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      try {
        ensureContainerDir(container.id);
        fs.copyFileSync(legacyPath, newPath);
        console.log(`[Realm] 迁移 Cookie 文件: ${container.id}`);
      } catch (error) {
        console.error(`[Realm] 迁移 Cookie 文件失败: ${container.id}`, error);
      }
    }
  }
}

/**
 * 清理 session 中 .www 重复 cookie
 *
 * 当同一 name|path 的裸域 cookie 和 .www domain cookie 同时存在时，
 * 删除 .www 版本，只保留裸域版本。
 *
 * 使用 set-expired 方式删除（设置过期时间为过去），
 * 因为 cookies.remove(url, name) 对 .www domain cookie 匹配不可靠。
 *
 * @param {Electron.Session} ses - 目标 session
 * @param {string} containerId - 容器 ID（仅用于日志）
 * @returns {Promise<number>} 清理数量
 */
async function cleanWWWDuplicates(ses, containerId) {
  try {
    const sessionCookies = await ses.cookies.get({});
    const sessionSet = new Set(
      sessionCookies
        .filter(c => !c.domain.startsWith('.'))
        .map(c => `${c.name}|${c.path}|${c.domain}`)
    );

    let cleaned = 0;
    for (const sc of sessionCookies) {
      if (!sc.domain.startsWith('.')) continue;
      const bareDomain = sc.domain.slice(1);
      const dedupKey = `${sc.name}|${sc.path}|${bareDomain}`;
      if (sessionSet.has(dedupKey)) {
        const protocol = sc.secure ? 'https' : 'http';
        const url = `${protocol}://${sc.domain.slice(1)}${sc.path || '/'}`;
        try {
          // 设置过期时间为过去，强制删除（比 cookies.remove 更可靠）
          await ses.cookies.set({
            url,
            name: sc.name,
            value: '',
            domain: sc.domain,
            path: sc.path || '/',
            expirationDate: 0,
            secure: sc.secure,
            httpOnly: sc.httpOnly,
          });
          cleaned++;
          console.log(`[Realm] Session 去重: 移除 ${sc.domain}|${sc.name}`);
        } catch (e) {
          console.warn(`[Realm] Session 去重失败: ${sc.domain}|${sc.name}: ${e.message}`);
        }
      }
    }
    if (cleaned > 0) console.log(`[Realm] Session 去重完成: ${containerId} 移除 ${cleaned} 个 .www cookie`);
    return cleaned;
  } catch (e) {
    console.warn(`[Realm] Session Cookie 去重失败: ${containerId}`, e.message);
    return 0;
  }
}

/**
 * 保存容器 Cookie 到 JSON 文件（合并模式）
 *
 * 合并逻辑：
 * 1. 从 session 获取当前所有 cookie
 * 2. 从 cookies.json 读取已保存的 cookie
 * 3. 以 session 为主，但保留 cookies.json 中存在但 session 中没有的 cookie
 * 4. 保存合并后的结果
 *
 * 这样可以避免只访问部分网站时丢失其他网站的 cookie
 *
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{success: boolean, count: number}>}
 */
async function saveCookies(containerId) {
  try {
    ensureContainerDir(containerId);

    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 获取 session 中的所有 Cookie
    const sessionCookies = await ses.cookies.get({});

    // 格式化 session Cookie
    const formattedSessionCookies = sessionCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      hostOnly: cookie.hostOnly,
      url: cookie.url,
    }));

    // 读取已保存的 cookies.json
    const filePath = getCookieFilePath(containerId);
    let existingCookies = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        existingCookies = JSON.parse(data);
      } catch (e) {
        console.warn(`[Realm] 读取 cookies.json 失败，将使用空数组: ${containerId}`, e.message);
      }
    }

    // 合并逻辑：以 session 为主
    // 创建 session cookie 的唯一标识集合
    const sessionCookieKeys = new Set(
      formattedSessionCookies.map(c => `${c.domain}|${c.name}|${c.path}`)
    );

    // 保留 cookies.json 中存在但 session 中没有的 cookie（未过期的）
    const now = Date.now() / 1000;
    const preservedCookies = existingCookies.filter(cookie => {
      const key = `${cookie.domain}|${cookie.name}|${cookie.path}`;
      // 如果 session 中已有，则不保留
      if (sessionCookieKeys.has(key)) {
        return false;
      }
      // 如果已过期，则不保留
      if (cookie.expirationDate && cookie.expirationDate < now) {
        return false;
      }
      return true;
    });

    // 合并：session cookie + 保留的旧 cookie
    let mergedCookies = [...formattedSessionCookies, ...preservedCookies];

    // 去重：当同一 name|path 同时存在于 www.xxx.cn 和 .www.xxx.cn 时，
    // 只保留无前导点的 host-only 版本
    const deduped = [];
    const seen = new Map();
    let removedCount = 0;

    for (const cookie of mergedCookies) {
      const bareDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const key = `${cookie.name}|${cookie.path}|${bareDomain}`;

      if (seen.has(key)) {
        const existingIdx = seen.get(key);
        const existing = deduped[existingIdx];
        if (cookie.domain.startsWith('.') && !existing.domain.startsWith('.')) {
          removedCount++;
          continue;
        }
        if (!cookie.domain.startsWith('.') && existing.domain.startsWith('.')) {
          deduped[existingIdx] = cookie;
          removedCount++;
          continue;
        }
      }

      seen.set(key, deduped.length);
      deduped.push(cookie);
    }

    if (removedCount > 0) {
      mergedCookies = deduped;
    }

    // 保存合并后的结果
    fs.writeFileSync(filePath, JSON.stringify(mergedCookies, null, 2));

    // 清理 session 中的 .www 重复项（运行时服务端可能重新设 .www cookie）
    await cleanWWWDuplicates(ses, containerId);

    console.log(`[Realm] 保存容器 Cookie: ${containerId} (${formattedSessionCookies.length} session + ${preservedCookies.length} 保留 = ${mergedCookies.length} 总计)`);

    return { success: true, count: mergedCookies.length };
  } catch (error) {
    console.error(`[Realm] 保存容器 Cookie 失败: ${containerId}`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * 按域名过滤 Cookie 并格式化为存储结构
 * 与渲染层 applyDomainFilter 的过滤语义对齐（同一集合）
 * @param {Array} cookies - 原始 Cookie 数组（session 或文件格式均可）
 * @param {string} domain - 目标域名
 * @param {boolean} includeSubdomains - true=当前域名及其父域（面板"含子域名"），false=仅精确匹配
 * @returns {Array} 格式化后的 Cookie 数组
 */
function filterAndFormatDomainCookies(cookies, domain, includeSubdomains = true) {
  return cookies
    .filter(cookie => {
      // 剥离前导点后再比较（.example.com 与 example.com 视为同一域）
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      if (includeSubdomains) {
        // Cookie 所属域是当前域名本身或其父域（即面板"含子域名"过滤显示的集合）
        return cookieDomain === domain || domain.endsWith(`.${cookieDomain}`);
      }
      // 仅精确匹配
      return cookieDomain === domain;
    })
    .map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      hostOnly: cookie.hostOnly,
      url: cookie.url,
    }));
}

/**
 * 保存指定域名的 Cookie 到文件
 * 保存当前页面可见的域名 Cookie（当前域名及其父域，与 Cookie 管理面板"含子域名"过滤集合一致）
 * @param {string} containerId - 容器 ID
 * @param {string} domain - 目标域名
 * @param {boolean} includeSubdomains - 是否包含父域（对齐面板"含子域名"过滤）
 * @returns {Promise<{success: boolean, count: number}>}
 */
async function saveDomainCookies(containerId, domain, includeSubdomains = true) {
  try {
    ensureContainerDir(containerId);

    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 获取 session 中的所有 Cookie
    const sessionCookies = await ses.cookies.get({});

    // 按域名过滤并格式化（与渲染层 applyDomainFilter 的 subdomain 过滤语义对齐，同一集合）
    const formattedCookies = filterAndFormatDomainCookies(sessionCookies, domain, includeSubdomains);

    // 读取已保存的 cookies.json
    const filePath = getCookieFilePath(containerId);
    let existingCookies = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        existingCookies = JSON.parse(data);
      } catch (e) {
        console.warn(`[Realm] 读取 cookies.json 失败，将使用空数组: ${containerId}`, e.message);
      }
    }

    // 合并逻辑：以过滤后的 session cookie 为主
    const sessionCookieKeys = new Set(
      formattedCookies.map(c => `${c.domain}|${c.name}|${c.path}`)
    );

    // 保留 cookies.json 中存在但不在本次保存范围的 cookie
    const now = Date.now() / 1000;
    const preservedCookies = existingCookies.filter(cookie => {
      const key = `${cookie.domain}|${cookie.name}|${cookie.path}`;
      // 如果已在本次保存的 session cookie 中，则不保留旧的
      if (sessionCookieKeys.has(key)) {
        return false;
      }
      // 如果已过期，则不保留
      if (cookie.expirationDate && cookie.expirationDate < now) {
        return false;
      }
      return true;
    });

    // 合并：过滤后的 session cookie + 保留的旧 cookie
    let mergedCookies = [...formattedCookies, ...preservedCookies];

    // 去重：当同一 name|path 同时存在于 www.xxx.cn 和 .www.xxx.cn 时，
    // 只保留无前导点的 host-only 版本
    const deduped = [];
    const seen = new Map();
    let removedCount = 0;

    for (const cookie of mergedCookies) {
      const bareDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const key = `${cookie.name}|${cookie.path}|${bareDomain}`;

      if (seen.has(key)) {
        const existingIdx = seen.get(key);
        const existing = deduped[existingIdx];
        if (cookie.domain.startsWith('.') && !existing.domain.startsWith('.')) {
          removedCount++;
          continue;
        }
        if (!cookie.domain.startsWith('.') && existing.domain.startsWith('.')) {
          deduped[existingIdx] = cookie;
          removedCount++;
          continue;
        }
      }

      seen.set(key, deduped.length);
      deduped.push(cookie);
    }

    if (removedCount > 0) {
      mergedCookies = deduped;
    }

    // 保存合并后的结果
    fs.writeFileSync(filePath, JSON.stringify(mergedCookies, null, 2));

    // 清理 session 中的 .www 重复项（运行时服务端可能重新设 .www cookie）
    await cleanWWWDuplicates(ses, containerId);

    console.log(`[Realm] 保存域名 Cookie: ${containerId} / ${domain} (${formattedCookies.length} 匹配 + ${preservedCookies.length} 保留 = ${mergedCookies.length} 总计)`);

    return { success: true, count: formattedCookies.length };
  } catch (error) {
    console.error(`[Realm] 保存域名 Cookie 失败: ${containerId} / ${domain}`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * 比较指定域名的 session Cookie 与 cookies.json 文件是否完全同步
 * 过滤集合与 saveDomainCookies 的 subdomain 语义一致（当前域名及其父域）
 *
 * 判定规则：
 * - 遍历 session 的每个 cookie，检查 file 中是否存在同名同 path 且 value + expirationDate 相同的条目
 * - file 可以比 session 多（累积存储），只要 session 中的都在 file 中且值一致即视为同步
 * - file 侧排除已过期项（对齐保存时的合并逻辑）
 *
 * @param {string} containerId - 容器 ID
 * @param {string} domain - 目标域名
 * @returns {Promise<{inSync: boolean, sessionCount: number, fileCount: number}>}
 */
async function compareDomainCookies(containerId, domain) {
  try {
    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    const sessionCookies = await ses.cookies.get({});
    let formattedSession = filterAndFormatDomainCookies(sessionCookies, domain, true);

    // 读取 cookies.json 并过滤同一域名集合，排除已过期项
    const filePath = getCookieFilePath(containerId);
    let fileCookies = [];
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        fileCookies = JSON.parse(data);
      } catch (e) {
        console.warn(`[Realm] 读取 cookies.json 失败，将使用空数组: ${containerId}`, e.message);
      }
    }
    const now = Date.now() / 1000;
    let formattedFile = filterAndFormatDomainCookies(fileCookies, domain, true)
      .filter(c => !c.expirationDate || c.expirationDate >= now);

    // 键 bareDomain|name|path → 值 value|expirationDate
    // 使用裸域名（去掉前导点），使得 .www.codebuddy.cn 和 www.codebuddy.cn 视为同一域名
    const toMap = (arr) => {
      const map = new Map();
      const seen = new Map();
      const result = [];
      for (const c of arr) {
        const bareDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        const key = `${c.name}|${c.path}|${bareDomain}`;
        // 同一裸域名下去重：优先保留无前导点的 host-only 版本
        if (seen.has(key)) {
          const existingIdx = seen.get(key);
          const existing = result[existingIdx];
          if (c.domain.startsWith('.') && !existing.domain.startsWith('.')) continue;
          if (!c.domain.startsWith('.') && existing.domain.startsWith('.')) {
            result[existingIdx] = c;
            continue;
          }
        }
        seen.set(key, result.length);
        result.push(c);
      }
      for (const c of result) {
        const bareDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        map.set(`${bareDomain}|${c.name}|${c.path}`, `${c.value}|${c.expirationDate ?? ''}`);
      }
      return map;
    };
    const sessionMap = toMap(formattedSession);
    const fileMap = toMap(formattedFile);

    // 单向子集检查：session 中的每个 cookie 都必须在 file 中存在且值一致
    // file 可以比 session 多（累积存储），不影响同步状态
    let inSync = true;
    for (const [key, val] of sessionMap) {
      const fileVal = fileMap.get(key);
      if (fileVal !== val) {
        inSync = false;
        console.log(`[Realm] Cookie 同步检查失败: ${domain}`);
        console.log(`  不同步项: ${key}`);
        console.log(`  session: ${val}`);
        console.log(`  file:    ${fileVal}`);
        console.log(`  session keys: ${[...sessionMap.keys()].join(', ')}`);
        console.log(`  file keys: ${[...fileMap.keys()].join(', ')}`);
        break;
      }
    }

    return { inSync, sessionCount: formattedSession.length, fileCount: formattedFile.length };
  } catch (error) {
    console.error(`[Realm] 比较域名 Cookie 失败: ${containerId} / ${domain}`, error);
    return { inSync: false, sessionCount: 0, fileCount: 0, error: error.message };
  }
}

/**
 * 保存所有容器的 Cookie
 * @returns {Promise<{success: boolean, saved: number}>}
 */
async function saveAllCookies() {
  try {
    const containers = configStore.get('containers', DEFAULT_CONTAINERS);
    let saved = 0;

    for (const container of containers) {
      const result = await saveCookies(container.id);
      if (result.success) {
        saved++;
      }
    }

    console.log(`[Realm] 保存所有容器 Cookie 完成: ${saved}/${containers.length}`);

    return { success: true, saved };
  } catch (error) {
    console.error('[Realm] 保存所有容器 Cookie 失败:', error);
    return { success: false, saved: 0, error: error.message };
  }
}

/**
 * 从 JSON 文件加载容器 Cookie
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{success: boolean, count: number}>}
 */
async function loadCookies(containerId) {
  try {
    const filePath = getCookieFilePath(containerId);

    // 如果文件不存在，返回
    if (!fs.existsSync(filePath)) {
      return { success: true, count: 0 };
    }

    // 读取文件
    const data = fs.readFileSync(filePath, 'utf8');
    let cookies = JSON.parse(data);

    // 去重：当同一 name|path 同时存在于 www.xxx.cn 和 .www.xxx.cn 时，
    // 只保留无前导点的 host-only 版本，丢弃 .www.xxx.cn 的 domain 版本
    // 原因：服务端（Keycloak）可能同时往两个域设 cookie，导致请求头翻倍超限
    const deduped = [];
    const seen = new Map(); // key: name|path|bareDomain → index in deduped
    let removedCount = 0;

    for (const cookie of cookies) {
      const bareDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const key = `${cookie.name}|${cookie.path}|${bareDomain}`;

      if (seen.has(key)) {
        const existingIdx = seen.get(key);
        const existing = deduped[existingIdx];
        // 当前 cookie 是 .www 版本，已有的是 www 版本 → 丢弃当前
        if (cookie.domain.startsWith('.') && !existing.domain.startsWith('.')) {
          removedCount++;
          continue;
        }
        // 当前 cookie 是 www 版本，已有的是 .www 版本 → 替换
        if (!cookie.domain.startsWith('.') && existing.domain.startsWith('.')) {
          deduped[existingIdx] = cookie;
          removedCount++;
          continue;
        }
      }

      seen.set(key, deduped.length);
      deduped.push(cookie);
    }

    if (removedCount > 0) {
      cookies = deduped;
      fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
      console.log(`[Realm] Cookie 去重: ${containerId} (移除 ${removedCount} 个 .www 重复项)`);
    }

    // 获取容器的 session
    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 设置每个 Cookie
    let loaded = 0;
    for (const cookie of cookies) {
      try {
        // 构建完整的 URL
        const protocol = cookie.secure ? 'https' : 'http';
        const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
        const url = `${protocol}://${domain}${cookie.path || '/'}`;

        // 设置 Cookie（包含完整属性）
        await ses.cookies.set({
          url: cookie.url || url,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          expirationDate: cookie.expirationDate,
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'unspecified',  // D-05
          hostOnly: cookie.hostOnly || false,          // D-06
        });
        loaded++;
      } catch (err) {
        console.error(`[Realm] 设置 Cookie 失败: ${cookie.name}`, err.message);
      }
    }

    // 清理 session 中已有的 .www 重复项（partition 数据库可能残留旧数据）
    await cleanWWWDuplicates(ses, containerId);

    console.log(`[Realm] 加载容器 Cookie: ${containerId} (${loaded}/${cookies.length} 个)`);

    return { success: true, count: loaded };
  } catch (error) {
    console.error(`[Realm] 加载容器 Cookie 失败: ${containerId}`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * 加载所有容器的 Cookie
 * @returns {Promise<{success: boolean, loaded: number}>}
 */
async function loadAllCookies() {
  try {
    const containers = configStore.get('containers', DEFAULT_CONTAINERS);
    let loaded = 0;

    for (const container of containers) {
      const result = await loadCookies(container.id);
      if (result.success) {
        loaded++;
      }
    }

    console.log(`[Realm] 加载所有容器 Cookie 完成: ${loaded}/${containers.length}`);

    return { success: true, loaded };
  } catch (error) {
    console.error('[Realm] 加载所有容器 Cookie 失败:', error);
    return { success: false, loaded: 0, error: error.message };
  }
}

/**
 * 导出容器 Cookie 到指定路径
 * @param {string} containerId - 容器 ID
 * @param {string} filePath - 导出文件路径
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function exportCookies(containerId, filePath) {
  try {
    const sourcePath = getCookieFilePath(containerId);

    // 如果源文件不存在，先保存一次
    if (!fs.existsSync(sourcePath)) {
      await saveCookies(containerId);
    }

    // 复制文件
    fs.copyFileSync(sourcePath, filePath);

    console.log(`[Realm] 导出容器 Cookie: ${containerId} -> ${filePath}`);

    return { success: true, message: '导出成功' };
  } catch (error) {
    console.error(`[Realm] 导出容器 Cookie 失败: ${containerId}`, error);
    return { success: false, message: '导出失败: ' + error.message };
  }
}

/**
 * 导入 Cookie 到容器
 * @param {string} containerId - 容器 ID
 * @param {string} filePath - 导入文件路径
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function importCookies(containerId, filePath) {
  try {
    ensureContainerDir(containerId);

    // 读取文件
    const data = fs.readFileSync(filePath, 'utf8');
    const cookies = JSON.parse(data);

    // 验证格式
    if (!Array.isArray(cookies)) {
      return { success: false, message: '无效的 Cookie 文件格式' };
    }

    // 保存到容器目录下的 cookies.json
    const targetPath = getCookieFilePath(containerId);
    fs.writeFileSync(targetPath, JSON.stringify(cookies, null, 2));

    // 加载到 session
    await loadCookies(containerId);

    console.log(`[Realm] 导入容器 Cookie: ${filePath} -> ${containerId} (${cookies.length} 个)`);

    return { success: true, message: `导入成功，共 ${cookies.length} 个 Cookie` };
  } catch (error) {
    console.error(`[Realm] 导入容器 Cookie 失败: ${containerId}`, error);
    return { success: false, message: '导入失败: ' + error.message };
  }
}

/**
 * 延迟等待 Electron 释放 partition 文件句柄
 * webview guest 销毁与 clearStorageData 刷盘均为异步，
 * 立即 rmSync 会撞句柄占用或删除后被重建
 * @param {number} ms - 等待毫秒数
 * @returns {Promise<void>}
 */
function waitForHandleRelease(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 删除容器的 Cookie 文件和 Session 数据
 * D-01: 删除容器时直接删除 cookie JSON 文件
 * D-02: 调用方须先 clearStorageData() 并销毁该容器全部 webview，
 *       此处不再调用 session.fromPartition()（获取即触发 Electron 重建目录）
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{success: boolean}>}
 */
async function deleteCookies(containerId) {
  try {
    // D-01: 删除容器目录下的 Cookie 文件
    const cookieFilePath = getCookieFilePath(containerId);
    if (fs.existsSync(cookieFilePath)) {
      fs.unlinkSync(cookieFilePath);
      console.log(`[Realm] 删除容器 Cookie 文件: ${containerId}`);
    }

    // 删除容器目录（如果为空）
    const containerDir = getContainerDir(containerId);
    if (fs.existsSync(containerDir)) {
      const files = fs.readdirSync(containerDir);
      if (files.length === 0) {
        fs.rmdirSync(containerDir);
        console.log(`[Realm] 删除空容器目录: ${containerId}`);
      }
    }

    // D-02: 删除 Partitions 目录（Electron 内部存储）
    // 等待 guest 进程退出与存储刷盘完成后再删，避免句柄占用导致失败
    const partitionDir = path.join(app.getPath('userData'), 'Partitions', `container-${containerId}`);
    if (fs.existsSync(partitionDir)) {
      await waitForHandleRelease(300);
      fs.rmSync(partitionDir, { recursive: true, force: true });
      console.log(`[Realm] 删除容器 Partitions 目录: ${containerId}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`[Realm] 删除容器 Cookie 失败: ${containerId}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 清理孤儿 Partitions 目录
 * 应用启动时调用（initContainers 之前，此时无任何 partition session 被创建，
 * 目录无句柄占用，删除必定成功且不会被重建）。
 * 运行中删除失败的残留目录由下一次启动在此处兜底清理。
 *
 * 空列表入参一律拒绝执行：有效容器列表不可能为空（default 容器不可删除，
 * 见 container-manager.deleteContainer），因此空列表只可能来自「配置缺失
 * + 调用点回了空默认值」，而非「用户没有容器」。按后者处理会删光所有
 * 容器的 Partitions 目录（含 localStorage/IndexedDB/cookie）。
 *
 * @param {Array<string>} validContainerIds - 当前有效容器 ID 列表（不得为空）
 * @returns {{removed: number, skipped?: boolean}}
 */
function cleanupOrphanPartitions(validContainerIds) {
  const partitionsRoot = path.join(app.getPath('userData'), 'Partitions');
  if (!fs.existsSync(partitionsRoot)) {
    return { removed: 0 };
  }

  // 纵深防御：即便调用点传错，也不允许把「配置缺失」当成「没有容器」执行全量删除
  if (!Array.isArray(validContainerIds) || validContainerIds.length === 0) {
    console.warn('[Realm] 有效容器列表为空，跳过孤儿 Partitions 清理（避免误删全部容器数据）');
    return { removed: 0, skipped: true };
  }

  const validDirs = new Set(validContainerIds.map(id => `container-${id}`));
  let removed = 0;

  for (const entry of fs.readdirSync(partitionsRoot)) {
    // 只处理本应用创建的 container-* 目录，不触碰其他 partition
    if (!entry.startsWith('container-') || validDirs.has(entry)) {
      continue;
    }
    try {
      fs.rmSync(path.join(partitionsRoot, entry), { recursive: true, force: true });
      removed++;
      console.log(`[Realm] 清理孤儿 Partitions 目录: ${entry}`);
    } catch (error) {
      console.error(`[Realm] 清理孤儿 Partitions 目录失败: ${entry}`, error);
    }
  }

  return { removed };
}

/**
 * 获取容器的 Session Cookie 列表
 * 从 Electron Session 中实时读取当前所有 Cookie
 * @param {string} containerId - 容器 ID
 * @returns {Promise<Array>} Cookie 数组
 */
async function getSessionCookies(containerId) {
  try {
    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);
    const cookies = await ses.cookies.get({});

    // 格式化 Cookie 数据
    return cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      hostOnly: cookie.hostOnly,
      url: cookie.url,
    }));
  } catch (error) {
    console.error(`[Realm] 获取 Session Cookie 失败: ${containerId}`, error);
    return [];
  }
}

/**
 * 获取容器的 File Cookie 列表
 * 从 cookies.json 文件中读取持久化的 Cookie
 * @param {string} containerId - 容器 ID
 * @returns {Array} Cookie 数组
 */
function getFileCookies(containerId) {
  try {
    const filePath = getCookieFilePath(containerId);

    // 文件不存在时返回空数组
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const cookies = JSON.parse(data);

    // 验证格式
    if (!Array.isArray(cookies)) {
      return [];
    }

    return cookies;
  } catch (error) {
    console.error(`[Realm] 读取 File Cookie 失败: ${containerId}`, error);
    return [];
  }
}

/**
 * 编辑单个 Cookie
 * 更新 Session 中的 Cookie，然后同步保存到文件
 * @param {string} containerId - 容器 ID
 * @param {Object} cookieData - Cookie 数据
 * @param {string} cookieData.name - Cookie 名称（只读，用于定位）
 * @param {string} cookieData.value - Cookie 值
 * @param {string} cookieData.domain - Cookie 域名
 * @param {string} cookieData.path - Cookie 路径
 * @param {number} [cookieData.expirationDate] - 过期时间戳（秒）
 * @param {boolean} [cookieData.secure] - 是否仅 HTTPS
 * @param {boolean} [cookieData.httpOnly] - 是否仅 HTTP
 * @param {string} [cookieData.sameSite] - SameSite 属性
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function editCookie(containerId, cookieData) {
  try {
    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 构建 Cookie URL
    const protocol = cookieData.secure ? 'https' : 'http';
    const domain = cookieData.domain.startsWith('.') ? cookieData.domain.slice(1) : cookieData.domain;
    const url = `${protocol}://${domain}${cookieData.path || '/'}`;

    // 更新 Session Cookie
    await ses.cookies.set({
      url: url,
      name: cookieData.name,
      value: cookieData.value,
      domain: cookieData.domain,
      path: cookieData.path || '/',
      expirationDate: cookieData.expirationDate,
      secure: cookieData.secure || false,
      httpOnly: cookieData.httpOnly || false,
      sameSite: cookieData.sameSite || 'unspecified',
    });

    // 同步保存到文件
    await saveCookies(containerId);

    console.log(`[Realm] 编辑 Cookie: ${containerId} - ${cookieData.name}`);
    return { success: true, message: 'Cookie 已更新' };
  } catch (error) {
    console.error(`[Realm] 编辑 Cookie 失败: ${containerId}`, error);
    return { success: false, message: '编辑失败: ' + error.message };
  }
}

/**
 * 删除单个 Cookie
 * 从 Session 中删除 Cookie，并显式从文件中剔除同一条目
 * （saveCookies 的合并逻辑会保留文件中存在但 session 中缺失的未过期
 * Cookie，若走通用保存会将刚删除的 Cookie 原样写回、重启后复活）
 * @param {string} containerId - 容器 ID
 * @param {Object} cookieData - Cookie 数据
 * @param {string} cookieData.name - Cookie 名称
 * @param {string} cookieData.domain - Cookie 域名
 * @param {string} cookieData.path - Cookie 路径
 * @param {boolean} [cookieData.secure] - 是否仅 HTTPS
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteSingleCookie(containerId, cookieData) {
  try {
    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 构建 Cookie URL
    const protocol = cookieData.secure ? 'https' : 'http';
    const domain = cookieData.domain.startsWith('.') ? cookieData.domain.slice(1) : cookieData.domain;
    const url = `${protocol}://${domain}${cookieData.path || '/'}`;

    // 从 Session 中删除
    await ses.cookies.remove(url, cookieData.name);

    // 显式从文件中剔除目标条目（唯一键：domain|name|path）
    const filePath = getCookieFilePath(containerId);
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const targetKey = `${cookieData.domain}|${cookieData.name}|${cookieData.path || '/'}`;
      const remaining = existing.filter(c => `${c.domain}|${c.name}|${c.path}` !== targetKey);
      fs.writeFileSync(filePath, JSON.stringify(remaining, null, 2));
    }

    console.log(`[Realm] 删除 Cookie: ${containerId} - ${cookieData.name}`);
    return { success: true, message: 'Cookie 已删除' };
  } catch (error) {
    console.error(`[Realm] 删除 Cookie 失败: ${containerId}`, error);
    return { success: false, message: '删除失败: ' + error.message };
  }
}

// 模块导出
module.exports = {
  saveCookies,
  saveAllCookies,
  loadCookies,
  loadAllCookies,
  exportCookies,
  importCookies,
  deleteCookies,
  cleanupOrphanPartitions,
  getSessionCookies,
  getFileCookies,
  editCookie,
  deleteSingleCookie,
  saveDomainCookies,
  compareDomainCookies,
  migrateLegacyCookies,
  getContainerDir,
  getCookieFilePath,
  CONTAINERS_DIR,
  LEGACY_COOKIE_DIR,
};
