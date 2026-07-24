/**
 * Realm Browser - Cookie 管理模块
 *
 * 管理容器 Cookie 的保存、加载、导出和导入
 * 每个容器的 Cookie 独立存储为 JSON 文件
 */

const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

// 配置存储实例
const configStore = new Store({ name: 'realm-config' });

// Cookie 存储目录
const COOKIE_DIR = path.join(app.getPath('userData'), 'cookies');

/**
 * 确保 Cookie 目录存在
 */
function ensureCookieDir() {
  if (!fs.existsSync(COOKIE_DIR)) {
    fs.mkdirSync(COOKIE_DIR, { recursive: true });
  }
}

/**
 * 保存容器 Cookie 到 JSON 文件
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{success: boolean, count: number}>}
 */
async function saveCookies(containerId) {
  try {
    ensureCookieDir();

    const partition = `persist:container-${containerId}`;
    const ses = session.fromPartition(partition);

    // 获取所有 Cookie
    const cookies = await ses.cookies.get({});

    // 格式化 Cookie（包含完整属性）
    const formattedCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,      // D-05: SameSite 属性
      hostOnly: cookie.hostOnly,      // D-06: hostOnly 属性
      url: cookie.url,                // 用于 set 操作
    }));

    // 保存到文件
    const filePath = path.join(COOKIE_DIR, `${containerId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(formattedCookies, null, 2));

    console.log(`[Realm] 保存容器 Cookie: ${containerId} (${cookies.length} 个)`);

    return { success: true, count: cookies.length };
  } catch (error) {
    console.error(`[Realm] 保存容器 Cookie 失败: ${containerId}`, error);
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
    const filePath = path.join(COOKIE_DIR, `${containerId}.json`);

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
    ensureCookieDir();

    const sourcePath = path.join(COOKIE_DIR, `${containerId}.json`);

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
    ensureCookieDir();

    // 读取文件
    const data = fs.readFileSync(filePath, 'utf8');
    const cookies = JSON.parse(data);

    // 验证格式
    if (!Array.isArray(cookies)) {
      return { success: false, message: '无效的 Cookie 文件格式' };
    }

    // 保存到容器 Cookie 文件
    const targetPath = path.join(COOKIE_DIR, `${containerId}.json`);
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
    const filePath = path.join(COOKIE_DIR, `${containerId}.json`);

    // D-01: 删除 Cookie JSON 文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Realm] 删除容器 Cookie 文件: ${containerId}`);
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
  COOKIE_DIR,
};
