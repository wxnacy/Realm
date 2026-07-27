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

  const containers = configStore.get('containers', []);
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
    const mergedCookies = [...formattedSessionCookies, ...preservedCookies];

    // 保存合并后的结果
    fs.writeFileSync(filePath, JSON.stringify(mergedCookies, null, 2));

    console.log(`[Realm] 保存容器 Cookie: ${containerId} (${formattedSessionCookies.length} session + ${preservedCookies.length} 保留 = ${mergedCookies.length} 总计)`);

    return { success: true, count: mergedCookies.length };
  } catch (error) {
    console.error(`[Realm] 保存容器 Cookie 失败: ${containerId}`, error);
    return { success: false, count: 0, error: error.message };
  }
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

    // 按域名过滤（与渲染层 applyDomainFilter 的 subdomain 过滤语义对齐，同一集合）
    const filteredCookies = sessionCookies.filter(cookie => {
      // 剥离前导点后再比较（.example.com 与 example.com 视为同一域）
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      if (includeSubdomains) {
        // Cookie 所属域是当前域名本身或其父域（即面板"含子域名"过滤显示的集合）
        return cookieDomain === domain || domain.endsWith(`.${cookieDomain}`);
      } else {
        // 仅精确匹配
        return cookieDomain === domain;
      }
    });

    // 格式化过滤后的 Cookie
    const formattedCookies = filteredCookies.map(cookie => ({
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
    const mergedCookies = [...formattedCookies, ...preservedCookies];

    // 保存合并后的结果
    fs.writeFileSync(filePath, JSON.stringify(mergedCookies, null, 2));

    console.log(`[Realm] 保存域名 Cookie: ${containerId} / ${domain} (${formattedCookies.length} 匹配 + ${preservedCookies.length} 保留 = ${mergedCookies.length} 总计)`);

    return { success: true, count: formattedCookies.length };
  } catch (error) {
    console.error(`[Realm] 保存域名 Cookie 失败: ${containerId} / ${domain}`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * 保存所有容器的 Cookie
 * @returns {Promise<{success: boolean, saved: number}>}
 */
async function saveAllCookies() {
  try {
    const containers = configStore.get('containers', []);
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
    const cookies = JSON.parse(data);

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
    const containers = configStore.get('containers', []);
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
 * @param {Array<string>} validContainerIds - 当前有效容器 ID 列表
 * @returns {{removed: number}}
 */
function cleanupOrphanPartitions(validContainerIds) {
  const partitionsRoot = path.join(app.getPath('userData'), 'Partitions');
  if (!fs.existsSync(partitionsRoot)) {
    return { removed: 0 };
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
  migrateLegacyCookies,
  getContainerDir,
  getCookieFilePath,
  CONTAINERS_DIR,
  LEGACY_COOKIE_DIR,
};
