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

describe('3. 删除文件夹（级联删除收藏项与子文件夹）', () => {
  // 清理数据
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 创建三层文件夹：待删除 → 子 → 孙
  const folder = favoritesManager.createFolder({ name: '待删除' });
  const child = favoritesManager.createFolder({ name: '子', parentId: folder.id });
  const grandchild = favoritesManager.createFolder({ name: '孙', parentId: child.id });
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

  // 子/孙文件夹必须随之删净。parent_id 上**没有**外键（parent_id=0 是虚拟根，
  // 历史迁移已把该约束去掉）⇒ 没有可依赖的 ON DELETE CASCADE；只删自身会让
  // 后代成为「没有任何展开路径可达」的悬空孤儿（UI 里隐形但永久留在库里）
  const descendantsLeft = db.prepare(
    'SELECT id FROM favorite_folders WHERE id IN (?, ?)'
  ).all(child.id, grandchild.id);
  assertEqual(descendantsLeft.length, 0, '子/孙文件夹一并删净（不留悬空后代）');

  const danglingAnywhere = db.prepare(`
    SELECT f.id FROM favorite_folders f
    LEFT JOIN favorite_folders p ON p.id = f.parent_id
    WHERE f.parent_id != 0 AND p.id IS NULL
  `).all();
  assertEqual(danglingAnywhere.length, 0, '全库不存在悬空文件夹');
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

describe('8. 新增收藏时指定文件夹', () => {
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  const folder = favoritesManager.createFolder({ name: '新增目标' });
  const intoRoot = favoritesManager.addRecord({ url: 'https://add-root.com', title: '根' });
  const intoFolder = favoritesManager.addRecord({
    url: 'https://add-folder.com',
    title: '夹内',
    folderId: folder.id,
  });

  const rootRow = db.prepare('SELECT folder_id FROM favorites WHERE id = ?').get(intoRoot.id);
  const folderRow = db.prepare('SELECT folder_id FROM favorites WHERE id = ?').get(intoFolder.id);
  assertEqual(rootRow.folder_id, 0, '未指定 folderId 时落在根目录（0）');
  assertEqual(folderRow.folder_id, folder.id, '指定 folderId 时写入该文件夹');

  // 落位在目标文件夹末尾：再插一条，新条目的 sort_order 必须更大
  const second = favoritesManager.addRecord({
    url: 'https://add-folder-2.com',
    title: '夹内2',
    folderId: folder.id,
  });
  const keys = db.prepare(
    'SELECT id, sort_order FROM favorites WHERE folder_id = ? ORDER BY sort_order ASC'
  ).all(folder.id);
  assertEqual(keys.length, 2, '目标文件夹内有 2 条收藏');
  assertEqual(keys[1].id, second.id, '后插入者排在该文件夹末尾');

  // 目标文件夹不存在：必须拒绝，不得写入孤儿 folder_id
  const bad = favoritesManager.addRecord({
    url: 'https://add-orphan.com',
    title: '孤儿',
    folderId: 999999,
  });
  assertEqual(bad.error, 'folder_not_found', '不存在的文件夹返回 folder_not_found');
  const orphan = db.prepare('SELECT id FROM favorites WHERE url = ?').get('https://add-orphan.com');
  assert(orphan === undefined, '拒绝时未落库（不产生孤儿收藏）');
});

describe('9. 更新收藏的文件夹', () => {
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  const folderA = favoritesManager.createFolder({ name: 'A' });
  const folderB = favoritesManager.createFolder({ name: 'B' });

  // 文件夹 A 内放两条，用于验证「改标题不重排」
  const first = favoritesManager.addRecord({ url: 'https://u1.com', title: '一', folderId: folderA.id });
  favoritesManager.addRecord({ url: 'https://u2.com', title: '二', folderId: folderA.id });

  const before = db.prepare('SELECT folder_id, sort_order FROM favorites WHERE id = ?').get(first.id);

  // ① 只改标题（不传 folderId）—— 旧语义
  const okTitleOnly = favoritesManager.updateRecord(first.id, { title: '一改' });
  assert(okTitleOnly === true, '只改标题返回 true');
  const afterTitleOnly = db.prepare('SELECT folder_id, sort_order FROM favorites WHERE id = ?').get(first.id);
  assertEqual(afterTitleOnly.sort_order, before.sort_order, '只改标题：sort_order 不变');
  assertEqual(afterTitleOnly.folder_id, folderA.id, '只改标题：folder_id 不变');

  // ② 传与当前相同的 folderId —— 星标弹窗的常规路径，必须同样不重排
  const okSame = favoritesManager.updateRecord(first.id, { title: '一改2', folderId: folderA.id });
  assert(okSame === true, 'folderId 与当前相同时返回 true');
  const afterSame = db.prepare('SELECT folder_id, sort_order FROM favorites WHERE id = ?').get(first.id);
  assertEqual(afterSame.sort_order, before.sort_order, 'folderId 未变：sort_order 不变（不被甩到末尾）');

  // ③ 传字符串形式的同一 folderId（IPC 边界形态）—— 归一化后同样不得重排
  favoritesManager.updateRecord(first.id, { title: '一改3', folderId: String(folderA.id) });
  const afterString = db.prepare('SELECT folder_id, sort_order FROM favorites WHERE id = ?').get(first.id);
  assertEqual(afterString.sort_order, before.sort_order, '字符串 folderId 归一化后不触发重排');

  // ④ 改到另一个文件夹：folder_id 更新且追加到目标末尾
  const okMove = favoritesManager.updateRecord(first.id, { title: '一改4', folderId: folderB.id });
  assert(okMove === true, '改文件夹返回 true');
  const moved = db.prepare('SELECT folder_id, sort_order, title FROM favorites WHERE id = ?').get(first.id);
  assertEqual(moved.folder_id, folderB.id, 'folder_id 已更新到目标文件夹');
  assertEqual(moved.title, '一改4', '标题同时更新');
  const inB = db.prepare(
    'SELECT id FROM favorites WHERE folder_id = ? ORDER BY sort_order ASC'
  ).all(folderB.id);
  assertEqual(inB.length, 1, '目标文件夹内出现该收藏');

  // ⑤ 目标文件夹不存在 / 记录不存在：拒绝且不改变任何字段
  const snapshot = db.prepare('SELECT * FROM favorites WHERE id = ?').get(first.id);
  const badFolder = favoritesManager.updateRecord(first.id, { title: '不该生效', folderId: 999999 });
  assertEqual(badFolder, false, '目标文件夹不存在时返回 false');
  const afterBad = db.prepare('SELECT * FROM favorites WHERE id = ?').get(first.id);
  assertEqual(afterBad.title, snapshot.title, '拒绝时标题未变');
  assertEqual(afterBad.folder_id, snapshot.folder_id, '拒绝时 folder_id 未变');

  const missing = favoritesManager.updateRecord(999999, { title: 'x', folderId: folderB.id });
  assertEqual(missing, false, '记录不存在时返回 false');

  // ⑥ checkUrl 透出 folder_id（星标弹窗据此显示当前文件夹）
  const checked = favoritesManager.checkUrl('https://u1.com');
  assertEqual(checked.folder_id, folderB.id, 'checkUrl 返回 folder_id');
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
