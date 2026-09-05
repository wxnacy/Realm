/**
 * ai-attachments-manager 模块单元测试（node:test，纯 Node 环境）
 *
 * 覆盖：classifyMime 图片判定（mime 前缀/扩展名兜底/空 type）、sanitizeFilename
 * 净化（路径分隔符/控制字符/超长/空名/中文保留）、isDeniedSourcePath 敏感路径
 * 屏蔽、buildAttachmentMarkers marker 文本、registerFiles/registerBlob 集成
 * （复制快照/symlink 拒绝/不存在拒绝/sourceKey 去重/目录递归/sha256 去重/
 * 未知 id）、快照落点 resolveInside 断言。
 * 全部用例经 setWorkspaceDir 注入临时目录，不触碰真实 userData。
 *
 * 用法: node tests/test-ai-attachments.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspace = require('../agent-workspace');
const manager = require('../ai-attachments-manager');

/** 建一次性临时根目录并在测试结束后清理 */
function withTempRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-att-test-'));
  t.after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    workspace.setWorkspaceDir(null);
  });
  workspace.setWorkspaceDir(dir);
  manager._resetRegistryForTest();
  return dir;
}

describe('classifyMime 图片判定', () => {
  test('mime image/ 前缀直接判定', () => {
    assert.strictEqual(manager.classifyMime('a.bin', 'image/png'), true);
    assert.strictEqual(manager.classifyMime('a.txt', 'image/svg+xml'), true);
  });

  test('扩展名兜底（空 type，macOS Finder 拖拽场景）', () => {
    assert.strictEqual(manager.classifyMime('photo.jpg', ''), true);
    assert.strictEqual(manager.classifyMime('shot.PNG', ''), true);
    assert.strictEqual(manager.classifyMime('pic.webp', null), true);
  });

  test('非图片 mime 与非图片扩展名排除', () => {
    assert.strictEqual(manager.classifyMime('doc.pdf', 'application/pdf'), false);
    assert.strictEqual(manager.classifyMime('doc.pdf', ''), false);
    assert.strictEqual(manager.classifyMime('file', 'application/octet-stream'), false);
  });
});

describe('sanitizeFilename 净化', () => {
  test('剥离路径分隔符（防 ../ 与 Windows 反斜杠穿越）', () => {
    assert.strictEqual(manager.sanitizeFilename('../../etc/passwd'), 'etcpasswd');
    assert.strictEqual(manager.sanitizeFilename('a\\b\\c.txt'), 'abc.txt');
  });

  test('剥离控制字符（marker 按行解析）', () => {
    assert.strictEqual(manager.sanitizeFilename('re\nport.txt'), 'report.txt');
    assert.strictEqual(manager.sanitizeFilename('a\x00b'), 'ab');
  });

  test('保留中文与常规字符', () => {
    assert.strictEqual(manager.sanitizeFilename('项目报告-2026_final.pdf'), '项目报告-2026_final.pdf');
  });

  test('限长 80', () => {
    const long = 'x'.repeat(200) + '.txt';
    const out = manager.sanitizeFilename(long);
    assert.ok(out.length <= 80);
  });

  test('空名回落 file', () => {
    assert.strictEqual(manager.sanitizeFilename(''), 'file');
    assert.strictEqual(manager.sanitizeFilename('../..'), 'file');
    assert.strictEqual(manager.sanitizeFilename(null), 'file');
  });
});

describe('isDeniedSourcePath 敏感路径屏蔽', () => {
  test('home 下敏感目录拒绝', () => {
    const home = os.homedir();
    assert.strictEqual(manager.isDeniedSourcePath(path.join(home, '.ssh', 'id_rsa')), true);
    assert.strictEqual(manager.isDeniedSourcePath(path.join(home, '.gnupg')), true);
    assert.strictEqual(manager.isDeniedSourcePath(path.join(home, '.aws', 'credentials')), true);
    assert.strictEqual(manager.isDeniedSourcePath(path.join(home, '.kube', 'config')), true);
    assert.strictEqual(manager.isDeniedSourcePath(path.join(home, 'Library', 'Keychains', 'x.db')), true);
  });

  test('未展开的 ~ 写法兜底拒绝', () => {
    assert.strictEqual(manager.isDeniedSourcePath('~/.ssh/id_rsa'), true);
    assert.strictEqual(manager.isDeniedSourcePath('~/.aws/credentials'), true);
  });

  test('任意层敏感文件名拒绝', () => {
    assert.strictEqual(manager.isDeniedSourcePath('/Users/x/proj/.env'), true);
    assert.strictEqual(manager.isDeniedSourcePath('/Users/x/.zsh_history'), true);
    assert.strictEqual(manager.isDeniedSourcePath('/Users/x/.bash_history'), true);
  });

  test('正常路径放行', () => {
    assert.strictEqual(manager.isDeniedSourcePath('/Users/x/Desktop/report.pdf'), false);
    assert.strictEqual(manager.isDeniedSourcePath('/tmp/notes.txt'), false);
    assert.strictEqual(manager.isDeniedSourcePath('/Users/x/Documents/.env.example'), false);
  });
});

describe('buildAttachmentMarkers marker 文本', () => {
  test('图片/文件/目录三种形态', () => {
    const out = manager.buildAttachmentMarkers([
      { path: '/w/attachments/a.png', name: 'a.png', isImage: true, isDirectory: false },
      { path: '/w/attachments/b.pdf', name: 'b.pdf', isImage: false, isDirectory: false },
      { path: '/w/attachments/dir', name: 'dir', isImage: false, isDirectory: true },
    ]);
    const lines = out.split('\n');
    assert.strictEqual(lines.length, 3);
    assert.ok(lines[0].startsWith('[attached_image: /w/attachments/a.png]'));
    assert.ok(lines[0].includes('已同步附于消息'));
    assert.ok(lines[1].startsWith('[attached_file: /w/attachments/b.pdf] b.pdf'));
    assert.ok(lines[2].startsWith('[attached_file: /w/attachments/dir/] dir/'));
    assert.ok(lines[2].includes('目录'));
  });

  test('多附件换行拼接；空数组返回空串；无效项跳过', () => {
    assert.strictEqual(manager.buildAttachmentMarkers([]), '');
    assert.strictEqual(manager.buildAttachmentMarkers(null), '');
    assert.strictEqual(manager.buildAttachmentMarkers([{ path: '', name: 'x' }]), '');
    assert.strictEqual(manager.buildAttachmentMarkers([{ name: 'no-path' }]), '');
  });

  test('imageMode=fallback: 中性措辞要求模型如实说看不到，不谎称已附于消息', () => {
    const atts = [
      { path: '/w/attachments/a.png', name: 'a.png', isImage: true, isDirectory: false },
    ];
    const out = manager.buildAttachmentMarkers(atts, { imageMode: 'fallback' });
    const line = out.split('\n')[0];
    // 中性措辞：不谎称「已同步附于消息」，也不承诺「已转写」
    assert.ok(line.includes('已随消息附上'));
    assert.ok(line.includes('不要猜测或编造'));
    assert.ok(!line.includes('已同步附于消息'));
    assert.ok(!line.includes('视觉模型转写'));
  });

  test('imageMode=described: 图片措辞改为视觉转写，缺省措辞回归不变', () => {
    const atts = [
      { path: '/w/attachments/a.png', name: 'a.png', isImage: true, isDirectory: false },
      { path: '/w/attachments/b.pdf', name: 'b.pdf', isImage: false, isDirectory: false },
    ];
    const described = manager.buildAttachmentMarkers(atts, { imageMode: 'described' });
    const describedLines = described.split('\n');
    assert.ok(describedLines[0].includes('已由视觉模型转写为文字描述'));
    assert.ok(describedLines[0].includes('<image-descriptions>'));
    assert.ok(!describedLines[0].includes('已同步附于消息'));
    // 非图片附件措辞不受 imageMode 影响
    assert.ok(describedLines[1].startsWith('[attached_file: /w/attachments/b.pdf] b.pdf'));

    // 缺省（inline）与显式 inline 均维持现状文案
    for (const out of [
      manager.buildAttachmentMarkers(atts),
      manager.buildAttachmentMarkers(atts, {}),
      manager.buildAttachmentMarkers(atts, { imageMode: 'inline' }),
    ]) {
      assert.ok(out.split('\n')[0].includes('已同步附于消息'));
      assert.ok(!out.includes('视觉模型'));
    }
  });
});

describe('registerFiles 集成', () => {
  test('正常复制文件快照并登记', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'source.txt');
    fs.writeFileSync(src, 'hello attachment');

    const { attachments, errors } = await manager.registerFiles([src]);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(attachments.length, 1);
    const meta = attachments[0];
    assert.ok(meta.id);
    assert.strictEqual(meta.name, 'source.txt');
    assert.strictEqual(meta.isDirectory, false);
    assert.strictEqual(meta.isImage, false);
    assert.strictEqual(meta.size, 16);
    // 快照内容一致且落在 attachments 目录
    assert.ok(meta.path.startsWith(path.join(root, 'attachments') + path.sep));
    assert.strictEqual(fs.readFileSync(meta.path, 'utf8'), 'hello attachment');
    // 登记表反查一致
    assert.strictEqual(manager.getAttachment(meta.id).path, meta.path);
  });

  test('快照路径过 resolveInside 断言', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'a.txt');
    fs.writeFileSync(src, 'x');
    const { attachments } = await manager.registerFiles([src]);
    assert.ok(workspace.resolveInside(root, attachments[0].path));
  });

  test('symlink 拒绝', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'real.txt');
    fs.writeFileSync(src, 'x');
    const link = path.join(root, 'link.txt');
    fs.symlinkSync(src, link);
    const { attachments, errors } = await manager.registerFiles([link]);
    assert.strictEqual(attachments.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].reason, /symlink/);
  });

  test('不存在路径拒绝', async (t) => {
    withTempRoot(t);
    const { attachments, errors } = await manager.registerFiles(['/nonexistent/really/x.txt']);
    assert.strictEqual(attachments.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].reason, /不存在/);
  });

  test('敏感路径拒绝', async (t) => {
    withTempRoot(t);
    const { errors } = await manager.registerFiles([path.join(os.homedir(), '.ssh', 'id_rsa')]);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].reason, /敏感/);
  });

  test('sourceKey 去重：同文件二次登记返回同 id 不重复复制', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'dup.txt');
    fs.writeFileSync(src, 'same');
    const first = await manager.registerFiles([src]);
    const second = await manager.registerFiles([src]);
    assert.strictEqual(first.attachments[0].id, second.attachments[0].id);
    const snaps = fs.readdirSync(path.join(root, 'attachments'));
    assert.strictEqual(snaps.length, 1);
  });

  test('目录递归复制并累计大小', async (t) => {
    const root = withTempRoot(t);
    const dir = path.join(root, 'mydir');
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.txt'), '12345');
    fs.writeFileSync(path.join(dir, 'sub', 'b.txt'), '1234567890');
    const { attachments, errors } = await manager.registerFiles([dir]);
    assert.strictEqual(errors.length, 0);
    const meta = attachments[0];
    assert.strictEqual(meta.isDirectory, true);
    assert.strictEqual(meta.size, 15);
    assert.strictEqual(fs.readFileSync(path.join(meta.path, 'sub', 'b.txt'), 'utf8'), '1234567890');
  });

  test('部分成功语义：好路径与坏路径混合', async (t) => {
    withTempRoot(t);
    const root = workspace.getWorkspaceDir();
    const good = path.join(root, 'good.txt');
    fs.writeFileSync(good, 'ok');
    const { attachments, errors } = await manager.registerFiles([good, '/no/such/file']);
    assert.strictEqual(attachments.length, 1);
    assert.strictEqual(errors.length, 1);
  });

  test('图片文件判定 isImage 且 mime 带子类型', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'pic.jpg');
    fs.writeFileSync(src, Buffer.from('89504e47', 'hex'));
    const { attachments } = await manager.registerFiles([src]);
    assert.strictEqual(attachments[0].isImage, true);
    assert.strictEqual(attachments[0].mimeType, 'image/jpeg');
  });
});

describe('registerBlob 集成', () => {
  test('base64 落盘并登记为图片', async (t) => {
    const root = withTempRoot(t);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const { attachment, error } = await manager.registerBlob({ name: '粘贴图片', mimeType: 'image/png', base64: png });
    assert.strictEqual(error, undefined);
    assert.strictEqual(attachment.isImage, true);
    assert.strictEqual(attachment.mimeType, 'image/png');
    assert.strictEqual(fs.readFileSync(attachment.path).toString('base64'), png);
    assert.ok(attachment.path.startsWith(path.join(root, 'attachments') + path.sep));
  });

  test('sha256 去重：同内容二次登记返回同 id', async (t) => {
    withTempRoot(t);
    const png = Buffer.from([1, 2, 3, 4]).toString('base64');
    const first = await manager.registerBlob({ mimeType: 'image/png', base64: png });
    const second = await manager.registerBlob({ mimeType: 'image/png', base64: png });
    assert.strictEqual(first.attachment.id, second.attachment.id);
  });

  test('剥离 dataURL 前缀', async (t) => {
    withTempRoot(t);
    const dataUrl = `data:image/png;base64,${Buffer.from([9, 9]).toString('base64')}`;
    const { attachment } = await manager.registerBlob({ mimeType: 'image/png', base64: dataUrl });
    assert.strictEqual(attachment.size, 2);
  });

  test('空 base64 返回错误', async (t) => {
    withTempRoot(t);
    const { attachment, error } = await manager.registerBlob({ base64: '' });
    assert.strictEqual(attachment, null);
    assert.ok(error);
  });
});

describe('readImageDataUrl 内联渲染（id/路径双入口 + 路径校验）', () => {
  test('按登记 id 读取图片返回 data URL', async (t) => {
    withTempRoot(t);
    const png = Buffer.from([1, 2, 3]).toString('base64');
    const { attachment } = await manager.registerBlob({ mimeType: 'image/png', base64: png });
    const dataUrl = await manager.readImageDataUrl({ id: attachment.id });
    assert.ok(dataUrl && dataUrl.startsWith('data:image/png;base64,'));
  });

  test('按路径读取（历史恢复场景，registry 已空）', async (t) => {
    const root = withTempRoot(t);
    const png = Buffer.from([4, 5, 6]).toString('base64');
    const { attachment } = await manager.registerBlob({ mimeType: 'image/png', base64: png });
    // 模拟重启后 registry 为空
    manager._resetRegistryForTest();
    const dataUrl = await manager.readImageDataUrl({ path: attachment.path });
    assert.ok(dataUrl && dataUrl.startsWith('data:image/png;base64,'));
  });

  test('attachments 目录外的路径拒绝（防伪造路径读任意文件）', async (t) => {
    withTempRoot(t);
    const root = workspace.getWorkspaceDir();
    fs.mkdirSync(path.join(root, 'ai-memory'), { recursive: true });
    const outside = path.join(root, 'ai-memory', 'USER.md');
    fs.writeFileSync(outside, 'secret');
    assert.strictEqual(await manager.readImageDataUrl({ path: outside }), null);
    assert.strictEqual(await manager.readImageDataUrl({ path: '/etc/passwd' }), null);
    assert.strictEqual(await manager.readImageDataUrl({ path: '' }), null);
    assert.strictEqual(await manager.readImageDataUrl({}), null);
  });

  test('非图片附件与不存在路径返回 null', async (t) => {
    const root = withTempRoot(t);
    const src = path.join(root, 'doc.txt');
    fs.writeFileSync(src, 'text');
    const { attachments } = await manager.registerFiles([src]);
    assert.strictEqual(await manager.readImageDataUrl({ id: attachments[0].id }), null);
    assert.strictEqual(await manager.readImageDataUrl({ path: '/nonexistent/img.png' }), null);
  });
});

describe('getAttachment / readPreviewDataUrl', () => {
  test('未知 id 返回 null', (t) => {
    withTempRoot(t);
    assert.strictEqual(manager.getAttachment('nope'), null);
    assert.strictEqual(manager.getAttachment(''), null);
    assert.strictEqual(manager.getAttachment(null), null);
  });

  test('图片预览返回 data URL；超限与非图片返回 null', async (t) => {
    const root = withTempRoot(t);
    const png = Buffer.from([1, 2, 3]).toString('base64');
    const { attachment } = await manager.registerBlob({ mimeType: 'image/png', base64: png });
    const dataUrl = await manager.readPreviewDataUrl(attachment.id);
    assert.ok(dataUrl.startsWith('data:image/png;base64,'));

    // 非图片附件
    const src = path.join(root, 'plain.txt');
    fs.writeFileSync(src, 'text');
    const { attachments } = await manager.registerFiles([src]);
    assert.strictEqual(await manager.readPreviewDataUrl(attachments[0].id), null);

    // 未知 id
    assert.strictEqual(await manager.readPreviewDataUrl('unknown'), null);
  });
});
