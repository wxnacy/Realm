/**
 * Realm Browser - 地址管理器核心模块
 *
 * 负责收货地址的加密存储、查询和删除。
 * 使用 Electron safeStorage API（macOS Keychain）加密地址数据，
 * 地址元数据存储在 history.db 的 addresses 表中（单表 + container_id 列）。
 *
 * 每个容器独立存储一个地址（覆盖写入，per D-06）。
 *
 * 依赖：better-sqlite3, electron (safeStorage, app)
 * 数据库路径：{userData}/history.db（与 history-manager、download-manager、credential-manager 共享）
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
 * 初始化数据库连接，创建 addresses 表，设置 WAL 模式
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

  // 创建 addresses 表（单表 + container_id 列）
  // UNIQUE 约束 (container_id)：每个容器只保存一个地址（per D-06）
  // encrypted_name/encrypted_phone/encrypted_address 使用 BLOB 类型存储 safeStorage 加密后的 Buffer
  db.exec(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL UNIQUE,
      encrypted_name BLOB NOT NULL DEFAULT X'',
      encrypted_phone BLOB NOT NULL DEFAULT X'',
      encrypted_address BLOB NOT NULL DEFAULT X'',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_addresses_container_id ON addresses (container_id);
  `);

  console.log('[Realm] 地址管理器数据库已初始化');
}

// ==================== 加密/解密工具函数 ====================

/**
 * 使用 safeStorage 加密字符串
 * @param {string} plainText - 明文文本
 * @returns {Promise<Buffer|null>} 加密后的 Buffer，不可用时返回 null
 */
async function encryptField(plainText) {
  try {
    return await safeStorage.encryptStringAsync(plainText);
  } catch (err) {
    console.error('[Realm] 加密地址字段失败:', err.message);
    return null;
  }
}

/**
 * 使用 safeStorage 解密字段
 * @param {Buffer} encryptedBuffer - 加密的 Buffer
 * @returns {Promise<{result: string, shouldReEncrypt: boolean}|null>} 解密结果
 */
async function decryptField(encryptedBuffer) {
  if (!encryptedBuffer || encryptedBuffer.length === 0) {
    return null;
  }
  try {
    return await safeStorage.decryptStringAsync(encryptedBuffer);
  } catch (err) {
    console.error('[Realm] 解密地址字段失败:', err.message);
    return null;
  }
}

// ==================== 核心函数 ====================

/**
 * 保存地址到数据库
 * per D-06：每个容器单地址（覆盖写入），使用 INSERT OR REPLACE
 * per AF-06：使用 safeStorage 加密姓名、手机号、地址
 *
 * @param {string} containerId - 容器 ID
 * @param {string} name - 收件人姓名
 * @param {string} phone - 手机号
 * @param {string} address - 详细地址
 * @returns {Promise<{success: boolean, error?: string}>} 操作结果
 */
async function saveAddress(containerId, name, phone, address) {
  if (!db) return { success: false, error: '数据库未初始化' };

  // 参数校验
  if (!containerId || !name || !phone || !address) {
    return { success: false, error: '缺少必要参数' };
  }

  // 检查加密可用性
  let isAvailable;
  try {
    isAvailable = await safeStorage.isAsyncEncryptionAvailable();
  } catch {
    isAvailable = false;
  }
  if (!isAvailable) {
    return { success: false, error: 'safeStorage 加密不可用，无法保存地址' };
  }

  // 加密三个字段
  const [encryptedName, encryptedPhone, encryptedAddress] = await Promise.all([
    encryptField(name),
    encryptField(phone),
    encryptField(address),
  ]);

  if (!encryptedName || !encryptedPhone || !encryptedAddress) {
    return { success: false, error: '加密地址数据失败' };
  }

  try {
    // INSERT OR REPLACE：同一 container_id 覆盖（per D-06）
    db.prepare(`
      INSERT OR REPLACE INTO addresses
      (container_id, encrypted_name, encrypted_phone, encrypted_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      containerId,
      encryptedName,
      encryptedPhone,
      encryptedAddress,
      Date.now(),
      Date.now()
    );

    console.log(`[Realm] 地址已保存: container=${containerId}`);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 保存地址失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 查询并解密地址
 * per AF-06：返回解密后的姓名、手机号、地址
 *
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{name: string, phone: string, address: string}|null>} 地址或 null
 */
async function getAddress(containerId) {
  if (!db) return null;

  if (!containerId) return null;

  try {
    const row = db.prepare(`
      SELECT id, encrypted_name, encrypted_phone, encrypted_address
      FROM addresses
      WHERE container_id = ?
    `).get(containerId);

    if (!row) return null;

    // 解密三个字段
    const [nameResult, phoneResult, addressResult] = await Promise.all([
      decryptField(row.encrypted_name),
      decryptField(row.encrypted_phone),
      decryptField(row.encrypted_address),
    ]);

    if (!nameResult || !phoneResult || !addressResult) {
      console.error('[Realm] 地址解密失败，返回 null');
      return null;
    }

    // 密钥轮转懒更新（与 credential-manager 保持一致）
    if (nameResult.shouldReEncrypt || phoneResult.shouldReEncrypt || addressResult.shouldReEncrypt) {
      console.log('[Realm] 密钥已轮转，重新加密地址数据');
      const [reEncName, reEncPhone, reEncAddr] = await Promise.all([
        encryptField(nameResult.result),
        encryptField(phoneResult.result),
        encryptField(addressResult.result),
      ]);
      if (reEncName && reEncPhone && reEncAddr) {
        try {
          db.prepare(`
            UPDATE addresses SET encrypted_name = ?, encrypted_phone = ?, encrypted_address = ?, updated_at = ? WHERE id = ?
          `).run(reEncName, reEncPhone, reEncAddr, Date.now(), row.id);
        } catch (updateErr) {
          console.error('[Realm] 重新加密地址数据失败:', updateErr.message);
        }
      }
    }

    return {
      name: nameResult.result,
      phone: phoneResult.result,
      address: addressResult.result,
    };
  } catch (err) {
    console.error('[Realm] 查询地址失败:', err.message);
    return null;
  }
}

/**
 * 删除地址记录
 *
 * @param {string} containerId - 容器 ID
 * @returns {{success: boolean}} 操作结果
 */
function deleteAddress(containerId) {
  if (!db) return { success: false };

  if (!containerId) return { success: false };

  try {
    const result = db.prepare(`
      DELETE FROM addresses WHERE container_id = ?
    `).run(containerId);

    console.log(`[Realm] 地址已删除: container=${containerId}, changes=${result.changes}`);
    return { success: true };
  } catch (err) {
    console.error('[Realm] 删除地址失败:', err.message);
    return { success: false };
  }
}

// ==================== 导出 ====================

module.exports = {
  initDatabase,
  saveAddress,
  getAddress,
  deleteAddress,
};
