#!/usr/bin/env node
/**
 * Phase 14: 收藏夹文件夹数据库层 - 自动化测试
 *
 * 测试 favorites-manager.js 的所有新增功能：
 * - 文件夹 CRUD（创建、重命名、删除、列出、树形结构）
 * - 收藏项移动（单个、批量）
 * - 级联删除
 * - 循环引用检测
 * - 排序功能
 *
 * 用法: node tests/test-favorites-folders.js
 */

const path = require('path');
const fs = require('fs');

// 使用内存数据库进行测试
const Database = require('better-sqlite3');
const db = new Database(':memory:');

// 启用外键约束
db.pragma('foreign_keys = ON');

// 加载 favorites-manager
const favoritesManager = require('../favorites-manager');
favoritesManager.setDatabase(db);

// ==================== 测试工具 ====================

let testCount = 0;
let passCount = 0;
let failCount = 0;

/**
 * 断言函数
 * @param {boolean} condition - 条件
 * @param {string} message - 测试描述
 */
function assert(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failCount++;
    console.log(`  ✗ ${message}`);
  }
}

/**
 * 断言相等
 * @param {*} actual - 实际值
 * @param {*} expected - 期望值
 * @param {string} message - 测试描述
 */
function assertEqual(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    console.log(`    期望: ${JSON.stringify(expected)}`);
    console.log(`    实际: ${JSON.stringify(actual)}`);
  }
  assert(pass, message);
}

/**
 * 运行测试组
 * @param {string} name - 测试组名称
 * @param {Function} fn - 测试函数
 */
function describe(name, fn) {
  console.log(`\n${name}`);
  console.log('─'.repeat(50));
  fn();
}

// ==================== 测试用例 ====================

describe('1. 表结构初始化', () => {
  // 调用一个函数来触发表创建（ensureTable 是内部函数）
  favoritesManager.listFolders();

  // 验证 favorite_folders 表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='favorite_folders'
  `).all();
  assert(tables.length === 1, 'favorite_folders 表已创建');

  // 验证 favorites 表有 folder_id 字段
  const columns = db.prepare('PRAGMA table_info(favorites)').all();
  const hasFolderId = columns.some(c => c.name === 'folder_id');
  const hasSortOrder = columns.some(c => c.name === 'sort_order');
  assert(hasFolderId, 'favorites 表有 folder_id 字段');
  assert(hasSortOrder, 'favorites 表有 sort_order 字段');

  // 验证索引
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='index' AND name='idx_favorites_folder_id'
  `).all();
  assert(indexes.length === 1, 'idx_favorites_folder_id 索引已创建');
});

describe('2. 文件夹 CRUD', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建文件夹
  const folder1 = favoritesManager.createFolder({ name: '工作' });
  assert(folder1.id > 0, '创建文件夹返回有效 ID');

  // 创建子文件夹
  const folder2 = favoritesManager.createFolder({ name: '项目A', parentId: folder1.id });
  assert(folder2.id > 0, '创建子文件夹成功');

  // 列出文件夹
  const folders = favoritesManager.listFolders();
  assertEqual(folders.length, 1, '根目录下有 1 个文件夹');
  assertEqual(folders[0].name, '工作', '文件夹名称正确');

  // 列出子文件夹
  const subFolders = favoritesManager.listFolders(folder1.id);
  assertEqual(subFolders.length, 1, '子目录下有 1 个文件夹');
  assertEqual(subFolders[0].name, '项目A', '子文件夹名称正确');

  // 重命名文件夹
  const renameResult = favoritesManager.renameFolder(folder1.id, { name: '工作相关' });
  assert(renameResult === true, '重命名文件夹返回 true');

  // 验证重命名
  const renamedFolders = favoritesManager.listFolders();
  assertEqual(renamedFolders[0].name, '工作相关', '文件夹名称已更新');

  // 获取文件夹树
  const tree = favoritesManager.getFolderTree();
  assertEqual(tree.length, 1, '树结构有 1 个根节点');
  assertEqual(tree[0].name, '工作相关', '根节点名称正确');
  assertEqual(tree[0].children.length, 1, '根节点有 1 个子节点');
  assertEqual(tree[0].children[0].name, '项目A', '子节点名称正确');
});

describe('3. 删除文件夹（级联删除收藏项）', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建文件夹和收藏
  const folder = favoritesManager.createFolder({ name: '待删除' });
  favoritesManager.addRecord({ url: 'https://example1.com', title: '示例1' });
  favoritesManager.addRecord({ url: 'https://example2.com', title: '示例2' });

  // 移动收藏到文件夹
  favoritesManager.moveFavorite(1, { folderId: folder.id });
  favoritesManager.moveFavorite(2, { folderId: folder.id });

  // 验证收藏已移动
  const favsBefore = db.prepare('SELECT * FROM favorites WHERE folder_id = ?').all(folder.id);
  assertEqual(favsBefore.length, 2, '文件夹中有 2 个收藏');

  // 删除文件夹
  const deleteResult = favoritesManager.deleteFolder(folder.id);
  assert(deleteResult.success === true, '删除文件夹返回 success: true');

  // 验证收藏已被级联删除
  const favsAfter = db.prepare('SELECT * FROM favorites WHERE id IN (1, 2)').all();
  assertEqual(favsAfter.length, 0, '收藏项已被级联删除');

  // 验证文件夹已删除
  const foldersAfter = favoritesManager.listFolders();
  assertEqual(foldersAfter.length, 0, '文件夹已被删除');
});

describe('4. 移动收藏到文件夹', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建文件夹和收藏
  const folder1 = favoritesManager.createFolder({ name: '文件夹A' });
  const folder2 = favoritesManager.createFolder({ name: '文件夹B' });
  const fav1Result = favoritesManager.addRecord({ url: 'https://example-move.com', title: '示例' });

  // 移动到文件夹 A
  const moveResult1 = favoritesManager.moveFavorite(fav1Result.id, { folderId: folder1.id });
  assert(moveResult1 === true, '移动收藏返回 true');

  // 验证位置
  const fav1 = db.prepare('SELECT folder_id FROM favorites WHERE id = ?').get(fav1Result.id);
  assertEqual(fav1.folder_id, folder1.id, '收藏在文件夹 A 中');

  // 批量移动
  const fav2Result = favoritesManager.addRecord({ url: 'https://example-move2.com', title: '示例2' });
  const fav3Result = favoritesManager.addRecord({ url: 'https://example-move3.com', title: '示例3' });
  const batchMoveResult = favoritesManager.moveFavorites([fav2Result.id, fav3Result.id], { folderId: folder2.id });
  assertEqual(batchMoveResult, 2, '批量移动返回移动数量');

  // 验证批量移动
  const favsInB = db.prepare('SELECT * FROM favorites WHERE folder_id = ?').all(folder2.id);
  assertEqual(favsInB.length, 2, '文件夹 B 中有 2 个收藏');
});

describe('5. 循环引用检测', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建文件夹层级: root -> child -> grandchild
  const root = favoritesManager.createFolder({ name: '根' });
  const child = favoritesManager.createFolder({ name: '子', parentId: root.id });
  const grandchild = favoritesManager.createFolder({ name: '孙', parentId: child.id });

  // 尝试将根移到孙（应失败）
  const moveResult = favoritesManager.moveFolder(root.id, { parentId: grandchild.id });
  assert(moveResult.success === false, '移动到后代返回 success: false');
  assert(moveResult.message.includes('循环引用'), '返回循环引用错误信息');

  // 验证位置未变
  const rootFolder = db.prepare('SELECT parent_id FROM favorite_folders WHERE id = ?').get(root.id);
  assertEqual(rootFolder.parent_id, 0, '根文件夹位置未变');
});

describe('6. 排序功能', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建文件夹
  const folder1 = favoritesManager.createFolder({ name: '文件夹1' });
  const folder2 = favoritesManager.createFolder({ name: '文件夹2' });
  const folder3 = favoritesManager.createFolder({ name: '文件夹3' });

  // 验证默认排序
  const folders = favoritesManager.listFolders();
  assertEqual(folders[0].name, '文件夹1', '默认排序第1');
  assertEqual(folders[1].name, '文件夹2', '默认排序第2');
  assertEqual(folders[2].name, '文件夹3', '默认排序第3');

  // 更新排序（设为 0，比其他文件夹的 sort_order 都小）
  favoritesManager.updateFolderSort(folder3.id, { sortOrder: 0 });
  const foldersAfter = favoritesManager.listFolders();
  assertEqual(foldersAfter[0].name, '文件夹3', '更新排序后第1');
});

describe('7. 不能删除根目录', () => {
  const result = favoritesManager.deleteFolder(0);
  assert(result.success === false, '删除根目录返回 success: false');
  assert(result.message.includes('根目录'), '返回正确的错误信息');
});

// ==================== 测试结果 ====================

console.log('\n' + '═'.repeat(50));
console.log('测试结果');
console.log('═'.repeat(50));
console.log(`总计: ${testCount} 项测试`);
console.log(`通过: ${passCount} 项`);
console.log(`失败: ${failCount} 项`);
console.log('═'.repeat(50));

// 清理
db.close();

// 退出码
process.exit(failCount > 0 ? 1 : 0);
