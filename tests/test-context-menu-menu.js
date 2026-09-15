/**
 * Realm Browser - 网页右键菜单模板测试
 *
 * 用 mock electron 加载 context-menu-manager.js，直接断言 Menu.buildFromTemplate
 * 收到的模板（菜单项序列、分隔符、label、点击后发出的 IPC）。
 *
 * 覆盖的行为契约：
 * - 专属分组按可同时成立的维度拼接：图片 → 链接 → 选中文本，组间无连续分隔符
 * - 图片链接（`<a><img></a>`）必须同时拿到图片组与链接组（曾是单值分类丢失链接组）
 * - 容器子菜单 label 只放容器名（曾把语义 icon 名拼成「briefcase 工作」）
 * - 选中文本进 label 前压平并截断，点击发送的仍是未截断原文
 *
 * 运行：`node --test tests/test-context-menu-menu.js`
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

// ==================== electron mock ====================

let captured = null;
const sent = [];
const clipboardWritten = [];

const fakeElectron = {
  Menu: {
    buildFromTemplate: (template) => {
      captured = template;
      return { popup: () => {} };
    },
  },
  clipboard: {
    writeText: (text) => clipboardWritten.push(text),
    writeImage: () => {},
  },
  nativeImage: {
    createFromBuffer: () => ({ isEmpty: () => true }),
    createFromDataURL: () => ({ isEmpty: () => true }),
  },
  webContents: { fromId: () => null },
  dialog: { showSaveDialog: async () => ({ canceled: true }) },
  net: { request: () => ({ on: () => {}, end: () => {} }) },
  BrowserWindow: function () {
    return {
      loadURL: async () => {},
      webContents: { executeJavaScript: async () => {} },
      destroy: () => {},
    };
  },
};

/**
 * 在拦截 electron 的前提下加载被测模块
 * @returns {Object} context-menu-manager 的导出
 */
function loadContextMenuManager() {
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return fakeElectron;
    return origLoad.apply(this, arguments);
  };
  try {
    return require(path.join(__dirname, '..', 'context-menu-manager.js'));
  } finally {
    Module._load = origLoad;
  }
}

const cm = loadContextMenuManager();

const fakeMainWindow = {
  webContents: {
    isDestroyed: () => false,
    send: (channel, data) => sent.push([channel, data]),
  },
};

// ==================== 期望序列 ====================

const GENERAL_TAIL = [
  '后退', '前进', '刷新', '停止加载', '---',
  '另存为…', '打印…', '添加到收藏夹', '---',
  '查看页面源代码', '检查元素', '---',
  '剪切', '复制', '粘贴', '全选',
];

const IMAGE_GROUP = [
  '在新标签页中打开图片', '将图片另存为…', '复制图片', '复制图片地址', '---',
];

const LINK_GROUP = [
  '在新标签页中打开链接', '在后台标签页中打开', '---',
  '在新容器标签页中打开', '---', '复制链接地址', '---',
];

const CONTAINERS_FIXTURE = [
  { id: 'default', name: '默认', icon: 'fingerprint' },
  { id: 'work', name: '工作', icon: 'briefcase' },
];

const MEDIA_GROUP_VIDEO = [
  '在新标签页中打开视频', '将视频另存为…', '复制媒体地址', '---',
];

/**
 * 构建菜单并返回模板（separator 折叠成 '---' 便于断言序列）
 * @param {Object} contextInfo - 右键上下文
 * @returns {Array<string>} 菜单项 label 序列
 */
function menuLabels(contextInfo) {
  captured = null;
  sent.length = 0;
  cm.buildWebMenu(contextInfo, fakeMainWindow);
  assert.ok(Array.isArray(captured), 'buildWebMenu 应调用 Menu.buildFromTemplate');
  return captured.map((item) => (item.type === 'separator' ? '---' : item.label));
}

/**
 * 构建菜单并返回原始模板项
 * @param {Object} contextInfo - 右键上下文
 * @returns {Array<Object>} 原始模板项
 */
function menuItems(contextInfo) {
  captured = null;
  sent.length = 0;
  cm.buildWebMenu(contextInfo, fakeMainWindow);
  return captured;
}

/**
 * 取指定 label 的菜单项
 * @param {Array<Object>} items - 模板项
 * @param {string} label - 目标 label
 * @returns {Object} 菜单项
 */
function itemByLabel(items, label) {
  const found = items.find((item) => item.label === label);
  assert.ok(found, `模板应包含「${label}」`);
  return found;
}

// ==================== 分组拼接 ====================

test('图片链接：图片组与链接组同时给出（图片组在前）', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: true, hasLink: true,
      srcURL: 'https://a.test/i.png', linkURL: 'https://a.test/target',
      mediaType: 'image', containers: CONTAINERS_FIXTURE,
    }),
    [...IMAGE_GROUP, ...LINK_GROUP, ...GENERAL_TAIL]
  );
});

test('图片链接：不出现连续分隔符', () => {
  const labels = menuLabels({
    hasImage: true, hasLink: true,
    srcURL: 'https://a.test/i.png', linkURL: 'https://a.test/target',
    mediaType: 'image', containers: CONTAINERS_FIXTURE,
  });
  const doubled = labels.filter((v, i) => v === '---' && labels[i - 1] === '---');
  assert.deepEqual(doubled, [], '组接缝处不应出现两个相邻分隔符');
});

test('纯图片：仅图片组 + 通用', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: true, hasLink: false,
      srcURL: 'https://a.test/i.png', linkURL: '', mediaType: 'image',
    }),
    [...IMAGE_GROUP, ...GENERAL_TAIL]
  );
});

test('纯链接：仅链接组 + 通用', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: true,
      srcURL: '', linkURL: 'https://a.test/x', mediaType: 'none',
      containers: CONTAINERS_FIXTURE,
    }),
    [...LINK_GROUP, ...GENERAL_TAIL]
  );
});

test('普通区域：仅通用菜单', () => {
  assert.deepEqual(
    menuLabels({ hasImage: false, hasLink: false, srcURL: '', linkURL: '', mediaType: 'none' }),
    GENERAL_TAIL
  );
});

// ==================== 点击动作 ====================

test('「在新标签页中打开链接」发送 linkURL（而非图片 srcURL）', () => {
  const items = menuItems({
    hasImage: true, hasLink: true,
    srcURL: 'https://a.test/i.png', linkURL: 'https://a.test/target',
    mediaType: 'image', containers: CONTAINERS_FIXTURE,
  });
  itemByLabel(items, '在新标签页中打开链接').click();
  assert.deepEqual(sent, [['context-menu:open-in-new-tab', { url: 'https://a.test/target' }]]);
});

// ==================== 容器子菜单 ====================

test('容器子菜单 label 只放容器名，不拼语义 icon 名', () => {
  const items = menuItems({
    hasImage: false, hasLink: true, srcURL: '', linkURL: 'https://a.test/x', mediaType: 'none',
    containers: CONTAINERS_FIXTURE,
  });
  const submenu = itemByLabel(items, '在新容器标签页中打开').submenu;
  assert.deepEqual(submenu.map((i) => i.label), ['默认', '工作']);
});

test('无可用容器时子菜单回落为禁用的提示项', () => {
  const items = menuItems({
    hasImage: false, hasLink: true, srcURL: '', linkURL: 'https://a.test/x', mediaType: 'none',
    containers: [],
  });
  const submenu = itemByLabel(items, '在新容器标签页中打开').submenu;
  assert.deepEqual(submenu.map((i) => [i.label, i.enabled]), [['无可用容器', false]]);
});

test('容器子菜单项点击后发送对应容器 id', () => {
  const items = menuItems({
    hasImage: false, hasLink: true, srcURL: '', linkURL: 'https://a.test/x', mediaType: 'none',
    containers: CONTAINERS_FIXTURE,
  });
  const submenu = itemByLabel(items, '在新容器标签页中打开').submenu;
  submenu[1].click();
  assert.deepEqual(sent, [
    ['context-menu:open-in-container', { url: 'https://a.test/x', containerId: 'work' }],
  ]);
});

// ==================== 选中文本 ====================

test('选中文本：搜索项位于专属组之后、通用组之前', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: false, srcURL: '', linkURL: '', mediaType: 'none',
      selectionText: 'hello world',
    }),
    ['搜索"hello world"', '---', ...GENERAL_TAIL]
  );
});

test('图片 + 选中文本：组序为图片 → 搜索 → 通用', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: true, hasLink: false, srcURL: 'https://a.test/i.png', linkURL: '',
      mediaType: 'image', selectionText: 'look',
    }),
    [...IMAGE_GROUP, '搜索"look"', '---', ...GENERAL_TAIL]
  );
});

test('选中文本进 label 前压平换行并按上限截断', () => {
  const longText = '第一行\n\n  第二行  ' + 'x'.repeat(40);
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: '', linkURL: '', mediaType: 'none',
    selectionText: longText,
  });
  const label = items[0].label;
  assert.equal(/[\r\n]/.test(label), false, 'label 不应含换行');
  assert.equal(label.length, '搜索"…"'.length + 24, 'label 文本部分应为 24 字符 + 省略号');
  assert.ok(label.endsWith('…"'), 'label 应以省略号结尾');
});

test('选中文本：点击发送未截断原文', () => {
  const longText = '第一行\n\n  第二行  ' + 'x'.repeat(40);
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: '', linkURL: '', mediaType: 'none',
    selectionText: longText,
  });
  items[0].click();
  assert.deepEqual(sent, [['context-menu:search-text', { text: longText }]]);
});

test('无选中文本：不出现搜索项', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: false, srcURL: '', linkURL: '', mediaType: 'none',
      selectionText: '',
    }),
    GENERAL_TAIL
  );
});

// ==================== 媒体元素 ====================

test('video 直链：媒体组 + 通用', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: false, srcURL: 'https://a.test/clip.mp4', linkURL: '',
      mediaType: 'video',
    }),
    [...MEDIA_GROUP_VIDEO, ...GENERAL_TAIL]
  );
});

test('audio 直链：label 用「音频」', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: false, srcURL: 'https://a.test/song.mp3', linkURL: '',
      mediaType: 'audio',
    }),
    ['在新标签页中打开音频', '将音频另存为…', '复制媒体地址', '---', ...GENERAL_TAIL]
  );
});

test('MSE 流（blob:）：打开与另存为均置灰', () => {
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: 'blob:https://a.test/abc-123', linkURL: '',
    mediaType: 'video',
  });
  assert.equal(itemByLabel(items, '在新标签页中打开视频').enabled, false);
  assert.equal(itemByLabel(items, '将视频另存为…（流媒体不支持）').enabled, false);
});

test('HLS 清单（.m3u8）：另存为置灰且说明原因，打开仍可用', () => {
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: 'https://a.test/live.m3u8?token=1', linkURL: '',
    mediaType: 'video',
  });
  assert.equal(itemByLabel(items, '将视频另存为…（流媒体不支持）').enabled, false);
  assert.equal(itemByLabel(items, '在新标签页中打开视频').enabled, true);
});

test('媒体 + 链接：媒体组排在链接组之前', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: true, srcURL: 'https://a.test/clip.mp4',
      linkURL: 'https://a.test/page', mediaType: 'video', containers: CONTAINERS_FIXTURE,
    }),
    [...MEDIA_GROUP_VIDEO, ...LINK_GROUP, ...GENERAL_TAIL]
  );
});

test('「复制媒体地址」写入剪贴板', () => {
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: 'https://a.test/clip.mp4', linkURL: '',
    mediaType: 'video',
  });
  clipboardWritten.length = 0;
  itemByLabel(items, '复制媒体地址').click();
  assert.deepEqual(clipboardWritten, ['https://a.test/clip.mp4']);
});

test('「在新标签页中打开视频」发送 srcURL', () => {
  const items = menuItems({
    hasImage: false, hasLink: false, srcURL: 'https://a.test/clip.mp4', linkURL: '',
    mediaType: 'video',
  });
  itemByLabel(items, '在新标签页中打开视频').click();
  assert.deepEqual(sent, [['context-menu:open-in-new-tab', { url: 'https://a.test/clip.mp4' }]]);
});

test('mediaType 非 video/audio：不出现媒体组', () => {
  assert.deepEqual(
    menuLabels({
      hasImage: false, hasLink: false, srcURL: 'https://a.test/x', linkURL: '',
      mediaType: 'none',
    }),
    GENERAL_TAIL
  );
});

test('renderer 的搜索项接线走统一导航入口 openUrl', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const start = src.indexOf("case 'context-menu:search-text':");
  assert.ok(start > 0, 'renderer 应有 context-menu:search-text 分支');
  const branch = src.slice(start, src.indexOf('break;', start));
  assert.match(
    branch,
    /openUrl\(data\.text,\s*\{\s*disposition:\s*'new-tab'\s*\}\)/,
    '搜索项须走 openUrl 漏斗（new-tab）——直接 createTab 会绕过容器分配规则'
  );
});
