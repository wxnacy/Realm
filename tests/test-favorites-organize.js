#!/usr/bin/env node
/**
 * applyOrganizePlan 数据层自动化测试
 *
 * 测试收藏整理方案的写库逻辑：
 * - 正常路径（建文件夹 + 移动收藏）
 * - 幂等去重（同名同父文件夹复用）
 * - 失败隔离（不存在的收藏 id）
 * - 嵌套 parentId
 * - 边界（空 plan / 缺文件夹名）
 *
 * 用法: node tests/test-favorites-organize.js
 */

const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.pragma('foreign_keys = ON');

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

/**
 * 插入测试收藏
 * @param {string} url - 收藏 URL
 * @param {string} title - 收藏标题
 * @returns {number} 收藏 ID
 */
function addFav(url, title) {
  return favoritesManager.addRecord({ url, title }).id;
}

// 触发表创建（ensureTable 是内部函数，调用任意 API 初始化）
favoritesManager.listFolders();

describe('1. 正常路径：建文件夹 + 移动收藏', () => {
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  const id1 = addFav('https://github.com', 'GitHub');
  const id2 = addFav('https://stackoverflow.com', 'Stack Overflow');
  const id3 = addFav('https://news.ycombinator.com', 'Hacker News');

  const result = favoritesManager.applyOrganizePlan([
    { folderName: '开发工具', parentId: 0, bookmarkIds: [id1, id2] },
    { folderName: '资讯', parentId: 0, bookmarkIds: [id3] },
  ]);

  assertEqual(result.movedCount, 3, '移动 3 条收藏');
  assertEqual(result.folderCount, 2, '涉及 2 个文件夹');
  assertEqual(result.createdFolders.length, 2, '新建 2 个文件夹');
  assertEqual(result.failures.length, 0, '无失败');

  const devFolder = favoritesManager.findFolderByName('开发工具', 0);
  const newsFolder = favoritesManager.findFolderByName('资讯', 0);
  assert(devFolder !== null, '「开发工具」文件夹已创建');
  assert(newsFolder !== null, '「资讯」文件夹已创建');

  const devItems = favoritesManager.listRecords({ folderId: devFolder });
  assertEqual(devItems.length, 2, '开发工具内有 2 条收藏');
  assert(devItems.every(r => typeof r.sort_order === 'string' && r.sort_order !== '0'),
    '落位 sort_order 为 fractional 文本键');

  const newsItems = favoritesManager.listRecords({ folderId: newsFolder });
  assertEqual(newsItems.length, 1, '资讯内有 1 条收藏');
});

describe('2. 幂等去重：重复应用复用同名文件夹', () => {
  const id1 = addFav('https://gitlab.com', 'GitLab');

  const first = favoritesManager.applyOrganizePlan([
    { folderName: '开发工具', parentId: 0, bookmarkIds: [id1] },
  ]);
  assertEqual(first.createdFolders.length, 0, '第二次应用不新建文件夹');

  const folders = favoritesManager.listFolders().filter(f => f.name === '开发工具');
  assertEqual(folders.length, 1, '同名文件夹不重复创建');

  const id2 = addFav('https://npmjs.com', 'npm');
  favoritesManager.applyOrganizePlan([
    { folderName: '开发工具', parentId: 0, bookmarkIds: [id2] },
  ]);
  const devFolder = favoritesManager.findFolderByName('开发工具', 0);
  assertEqual(favoritesManager.listRecords({ folderId: devFolder }).length, 4,
    '复用文件夹内累计 4 条收藏（describe1 的 2 条 + GitLab + npm）');
});

describe('3. 失败隔离：不存在的收藏 id', () => {
  const id1 = addFav('https://example.com', 'Example');

  const result = favoritesManager.applyOrganizePlan([
    { folderName: '测试组', parentId: 0, bookmarkIds: [id1, 99999, 88888] },
  ]);

  assertEqual(result.movedCount, 1, '有效收藏仍成功移动');
  assertEqual(result.failures.length, 2, '2 条无效 id 记入 failures');
  assert(result.failures.every(f => f.reason === '收藏不存在'), '失败原因标注正确');

  const folder = favoritesManager.findFolderByName('测试组', 0);
  assertEqual(favoritesManager.listRecords({ folderId: folder }).length, 1,
    '文件夹内只有 1 条收藏');

  // 已移动过的收藏再次出现（跨组去重）
  const result2 = favoritesManager.applyOrganizePlan([
    { folderName: '组A', parentId: 0, bookmarkIds: [id1] },
    { folderName: '组B', parentId: 0, bookmarkIds: [id1] },
  ]);
  assertEqual(result2.movedCount, 1, '跨组重复 id 只处理首次');
  assertEqual(result2.failures.length, 0, '重复 id 不记失败');
  const folderA = favoritesManager.findFolderByName('组A', 0);
  assertEqual(favoritesManager.listRecords({ folderId: folderA }).length, 1,
    '收藏落在首次出现的组');
});

describe('4. 嵌套 parentId：指向另一文件夹', () => {
  const parent = favoritesManager.createFolder({ name: '父文件夹' });
  const id1 = addFav('https://child.example.com', 'Child');

  const result = favoritesManager.applyOrganizePlan([
    { folderName: '子文件夹', parentId: parent.id, bookmarkIds: [id1] },
  ]);

  assertEqual(result.createdFolders.length, 1, '子文件夹创建成功');
  assertEqual(result.createdFolders[0].parentId, parent.id, '子文件夹父级正确');
  assertEqual(result.movedCount, 1, '收藏移入子文件夹');

  // parentId 不存在时 createFolder 报 not_found，收藏记失败
  const id2 = addFav('https://orphan.example.com', 'Orphan');
  const result2 = favoritesManager.applyOrganizePlan([
    { folderName: '孤儿组', parentId: 424242, bookmarkIds: [id2] },
  ]);
  assertEqual(result2.movedCount, 0, '父文件夹不存在时不移动');
  assertEqual(result2.failures.length, 1, '收藏记入 failures');
  assert(result2.failures[0].reason.includes('创建文件夹失败'), '失败原因为创建文件夹失败');
});

describe('5. 边界：空 plan / 缺文件夹名', () => {
  const empty = favoritesManager.applyOrganizePlan([]);
  assertEqual(empty.movedCount, 0, '空 plan 返回零计数');
  assertEqual(empty.createdFolders.length, 0, '空 plan 不建文件夹');

  const id1 = addFav('https://noname.example.com', 'NoName');
  const result = favoritesManager.applyOrganizePlan([
    { folderName: '', parentId: 0, bookmarkIds: [id1] },
  ]);
  assertEqual(result.movedCount, 0, '缺文件夹名不移动');
  assertEqual(result.failures.length, 1, '缺文件夹名记入 failures');
});

describe('6. listEmptyFolders：空文件夹查询', () => {
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  // 空文件夹 A（完全空）
  const emptyA = favoritesManager.createFolder({ name: '空A' });
  // 文件夹 B 含收藏（非空）
  const withFav = favoritesManager.createFolder({ name: '有收藏B' });
  const favId = addFav('https://empty-test.example.com', 'EmptyTest');
  favoritesManager.moveFavoriteInto(favId, { folderId: withFav.id });
  // 文件夹 C 含空子文件夹 C1（C 本身不算空，C1 算空）
  const parentC = favoritesManager.createFolder({ name: '父C' });
  favoritesManager.createFolder({ name: '子C1', parentId: parentC.id });
  // 根目录收藏自身不属于任何文件夹，不影响

  const emptyFolders = favoritesManager.listEmptyFolders();
  const emptyIds = emptyFolders.map(f => f.id);
  assert(emptyIds.includes(emptyA.id), '完全空的文件夹被识别');
  assert(emptyIds.includes(favoritesManager.findFolderByName('子C1', parentC.id)),
    '只含空子级的叶子文件夹被识别');
  assert(!emptyIds.includes(withFav.id), '含收藏的文件夹不算空');
  assert(!emptyIds.includes(parentC.id), '含子文件夹的父级不算空');
});

describe('7. reorderFavorites：文件夹内重排', () => {
  db.exec('DELETE FROM favorites');
  db.exec('DELETE FROM favorite_folders');

  const f1 = favoritesManager.createFolder({ name: '排序组' });
  const f2 = favoritesManager.createFolder({ name: '别组' });
  const a = addFav('https://sort-a.example.com', 'A');
  const b = addFav('https://sort-b.example.com', 'B');
  const c = addFav('https://sort-c.example.com', 'C');
  favoritesManager.moveFavoriteInto(a, { folderId: f1.id });
  favoritesManager.moveFavoriteInto(b, { folderId: f1.id });
  favoritesManager.moveFavoriteInto(c, { folderId: f1.id });
  const other = addFav('https://sort-other.example.com', 'Other');
  favoritesManager.moveFavoriteInto(other, { folderId: f2.id });

  // 正常：完整列表重排为 C, A, B
  const r1 = favoritesManager.reorderFavorites([c, a, b]);
  assertEqual(r1.success, true, '完整列表重排成功');
  assertEqual(r1.count, 3, '重排 3 条');
  assertEqual(r1.folderId, f1.id, 'folderId 正确');
  let items = favoritesManager.listRecords({ folderId: f1.id });
  assertEqual(items.map(r => r.id), [c, a, b], '按目标顺序落位');
  assert(items.every(r => typeof r.sort_order === 'string' && r.sort_order !== '0'),
    '生成全新 fractional 键');

  // 部分列表被拒（文件夹共 3 条只提交 2 条）
  const r2 = favoritesManager.reorderFavorites([b, a]);
  assertEqual(r2.success, false, '部分列表被拒绝');
  assert(r2.error.includes('完整顺序'), '错误信息提示需要完整列表');

  // 跨文件夹被拒
  const r3 = favoritesManager.reorderFavorites([a, b, c, other]);
  assertEqual(r3.success, false, '跨文件夹列表被拒绝');
  assert(r3.error.includes('跨多个文件夹'), '错误信息提示跨文件夹');

  // 幻觉 id 丢弃 + 重复 id 去重后仍满足完整列表（提交 c,a,b + 无效 99999 + 重复 c）
  const r4 = favoritesManager.reorderFavorites([c, a, b, 99999, c]);
  assertEqual(r4.success, true, '幻觉/重复 id 清洗后正常排序');
  assertEqual(r4.count, 3, '有效数量为 3');
  assert(r4.droppedIds.includes(99999), '幻觉 id 记入 droppedIds');

  // 空列表 / 单条
  assertEqual(favoritesManager.reorderFavorites([]).success, false, '空列表被拒绝');
  assertEqual(favoritesManager.reorderFavorites([a]).success, false, '单条无法排序');
});

describe('8. 回归：折叠原有功能仍正常', () => {
  const folders = favoritesManager.getFolderTree();
  assert(Array.isArray(folders), 'getFolderTree 仍正常');
  const count = favoritesManager.getCount();
  assert(count > 0, '收藏计数正常');
});

// ==================== 汇总 ====================

console.log('\n' + '═'.repeat(50));
console.log(`测试完成: ${passCount}/${testCount} 通过, ${failCount} 失败`);
process.exit(failCount > 0 ? 1 : 0);
