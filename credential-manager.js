/**
 * Realm Browser - 凭据管理器核心模块
 *
 * 负责登录凭据的加密存储、查询和永不保存记录管理。
 * 使用 Electron safeStorage API（macOS Keychain）加密密码，
 * 凭据元数据存储在 history.db 的 credentials 表中（单表 + container_id 列，D-10）。
 *
 * 依赖：better-sqlite3, electron (safeStorage, app)
 * 数据库路径：{userData}/history.db（与 history-manager、download-manager 共享）
 */

const path = require('path');
const { app, safeStorage } = require('electron');

// better-sqlite3 延迟加载：原生模块必须在 app.whenReady 之后加载，
// 否则 Electron 早期启动阶段会导致 SIGSEGV 段错误
let Database = null;

// 数据库路径（延迟初始化，避免 app.getPath 在 ready 前调用）
let DB_PATH = null;

// 数据库连接实例
let db = null;

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库连接，创建 credentials 表，设置 WAL 模式
 * 应在 app.whenReady 之后调用
 */
function initDatabase() {
  if (db) return;

  // 延迟加载原生模块和路径，确保在 app.whenReady 之后执行
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }

  db = new Database(DB_PATH);
  // WAL 模式：提升并发读写性能
  db.pragma('journal_mode = WAL');
  // NORMAL 同步级别：平衡性能与数据安全
  db.pragma('synchronous = NORMAL');

  // 创建 credentials 表（单表 + container_id 列，D-10 决策）
  // encrypted_password 使用 BLOB 类型存储 safeStorage 加密后的 Buffer
  // UNIQUE 约束 (container_id, origin)：同一容器同一 origin 只保存一个凭据
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      url TEXT NOT NULL,
      origin TEXT NOT NULL,
      username TEXT NOT NULL,
      encrypted_password BLOB NOT NULL DEFAULT X'',
      never_save INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_credentials_container_id ON credentials (container_id);
    CREATE INDEX IF NOT EXISTS idx_credentials_origin ON credentials (origin);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_container_origin
      ON credentials (container_id, origin);
  `);

  console.log('[Realm] 凭据管理器数据库已初始化');
}

// ==================== 加密/解密工具函数 ====================

/**
 * 检查 safeStorage 异步加密是否可用
 * macOS Keychain 通常可用；Linux 需要 GNOME Keyring 或 KWallet
 * @returns {Promise<boolean>} 加密是否可用
 */
async function isEncryptionAvailable() {
  try {
    return await safeStorage.isAsyncEncryptionAvailable();
  } catch (err) {
    console.error('[Realm] 检查加密可用性失败:', err.message);
    return false;
  }
}

/**
 * 使用 safeStorage 加密密码字符串
 * @param {string} plainPassword - 明文密码
 * @returns {Promise<Buffer|null>} 加密后的 Buffer，不可用时返回 null
 */
async function encryptPassword(plainPassword) {
  const available = await isEncryptionAvailable();
  if (!available) {
    console.error('[Realm] safeStorage 加密不可用，拒绝存储凭据');
    return null;
  }
  try {
    return await safeStorage.encryptStringAsync(plainPassword);
  } catch (err) {
    console.error('[Realm] 加密密码失败:', err.message);
    return null;
  }
}

/**
 * 使用 safeStorage 解密密码
 * @param {Buffer} encryptedBuffer - 加密的 Buffer
 * @returns {Promise<{password: string, shouldReEncrypt: boolean}|null>} 解密结果，失败时返回 null
 */
async function decryptPassword(encryptedBuffer) {
  if (!encryptedBuffer || encryptedBuffer.length === 0) {
    return null;
  }
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encryptedBuffer);
    return { password: result, shouldReEncrypt };
  } catch (err) {
    console.error('[Realm] 解密凭据失败:', err.message);
    return null;
  }
}

// ==================== 核心函数 ====================

/**
 * 保存凭据到数据库
 * per D-04, AF-02：使用 safeStorage 加密密码，加密不可用时拒绝存储
 * per D-10：同一 container_id + origin 最后一个覆盖（INSERT OR REPLACE）
 *
 * @param {string} containerId - 容器 ID
 * @param {string} url - 页面完整 URL
 * @param {string} origin - 页面 origin（protocol + hostname + port）
 * @param {string} username - 用户名
 * @param {string} password - 明文密码
 * @returns {Promise<{success: boolean, error?: string}>} 操作结果
 */
async function saveCredential(containerId, url, origin, username, password) {
  if (!db) return { success: false, error: '数据库未初始化' };

  // 参数校验
  if (!containerId || !origin || !username || !password) {
    return { success: false, error: '缺少必要参数' };
  }

  // 加密密码（per D-04, T-32-01）
  const encryptedPassword = await encryptPassword(password);
  if (!encryptedPassword) {
    return { success: false, error: 'safeStorage 加密不可用，无法保存凭据' };
  }

  try {
    // INSERT OR REPLACE：同一 (container_id, origin) 覆盖（per D-10）
    db.prepare(`
      INSERT OR REPLACE INTO credentials
      (container_id, url, origin, username, encrypted_password, never_save, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      containerId,
      url || '',
      origin,
      username,
      encryptedPassword,
      Date.now(),
      Date.now()
    );

    console.log(`[Realm] 凭据已保存: origin=${origin}, container=${containerId}`);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 保存凭据失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 查询并解密凭据
 * per AF-03：查询凭据并返回解密后的用户名和密码
 * 密钥轮转懒更新：解密时检查 shouldReEncrypt，按需重新加密
 *
 * @param {string} containerId - 容器 ID
 * @param {string} origin - 页面 origin
 * @returns {Promise<{username: string, password: string}|null>} 凭据或 null
 */
async function getCredential(containerId, origin) {
  if (!db) return null;

  if (!containerId || !origin) return null;

  try {
    const row = db.prepare(`
      SELECT id, username, encrypted_password, never_save
      FROM credentials
      WHERE container_id = ? AND origin = ? AND never_save = 0
    `).get(containerId, origin);

    if (!row) return null;

    // 解密密码
    const decrypted = await decryptPassword(row.encrypted_password);
    if (!decrypted) {
      console.error('[Realm] 凭据解密失败，返回 null');
      return null;
    }

    // 密钥轮转懒更新（per D-15 状态同步）
    if (decrypted.shouldReEncrypt) {
      console.log('[Realm] 密钥已轮转，重新加密凭据');
      const reEncrypted = await encryptPassword(decrypted.password);
      if (reEncrypted) {
        try {
          db.prepare(`
            UPDATE credentials SET encrypted_password = ?, updated_at = ? WHERE id = ?
          `).run(reEncrypted, Date.now(), row.id);
        } catch (updateErr) {
          console.error('[Realm] 重新加密凭据失败:', updateErr.message);
        }
      }
    }

    return { username: row.username, password: decrypted.password };
  } catch (err) {
    console.error('[Realm] 查询凭据失败:', err.message);
    return null;
  }
}

/**
 * 标记 origin 为永不保存
 * per D-07：记录到凭据存储（按容器隔离），encrypted_password 为空 Buffer
 *
 * @param {string} containerId - 容器 ID
 * @param {string} origin - 页面 origin
 * @returns {{success: boolean}} 操作结果
 */
function markNeverSave(containerId, origin) {
  if (!db) return { success: false };

  if (!containerId || !origin) return { success: false };

  try {
    // INSERT OR REPLACE：覆盖已有记录（可能已有保存的凭据）
    db.prepare(`
      INSERT OR REPLACE INTO credentials
      (container_id, url, origin, username, encrypted_password, never_save, created_at, updated_at)
      VALUES (?, '', ?, '', X'', 1, ?, ?)
    `).run(containerId, origin, Date.now(), Date.now());

    console.log(`[Realm] 已标记永不保存: origin=${origin}, container=${containerId}`);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 标记永不保存失败:', err.message);
    return { success: false };
  }
}

/**
 * 检查 origin 是否在永不保存列表中
 *
 * @param {string} containerId - 容器 ID
 * @param {string} origin - 页面 origin
 * @returns {boolean} 是否永不保存
 */
function isNeverSave(containerId, origin) {
  if (!db) return false;

  if (!containerId || !origin) return false;

  try {
    const row = db.prepare(`
      SELECT 1 FROM credentials
      WHERE container_id = ? AND origin = ? AND never_save = 1
      LIMIT 1
    `).get(containerId, origin);

    return !!row;
  } catch (err) {
    console.error('[Realm] 检查永不保存状态失败:', err.message);
    return false;
  }
}

/**
 * 删除凭据记录
 *
 * @param {string} containerId - 容器 ID
 * @param {string} origin - 页面 origin
 * @returns {{success: boolean}} 操作结果
 */
function deleteCredential(containerId, origin) {
  if (!db) return { success: false };

  if (!containerId || !origin) return { success: false };

  try {
    const result = db.prepare(`
      DELETE FROM credentials WHERE container_id = ? AND origin = ?
    `).run(containerId, origin);

    console.log(`[Realm] 凭据已删除: origin=${origin}, container=${containerId}, changes=${result.changes}`);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 删除凭据失败:', err.message);
    return { success: false };
  }
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  saveCredential,
  getCredential,
  markNeverSave,
  isNeverSave,
  deleteCredential,
};
