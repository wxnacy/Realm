/**
 * 恶意 / 边界 zip 样本生成器（Phase 51 夹具，**纯 Node、零外部依赖**）
 *
 * ## 为什么手写字节（而不是用现成库 / python3）
 *
 * `51-RESEARCH.md` 的实测 1 结论：`validateFileName` 只拦三类、`validateEntrySizes` 不拦
 * `0xFFFFFFFF`、`chrdev` / `fifo` / `socket` 三种 mode 完全不报错 —— 要**表达这些形态**
 * 就必须能逐字节控制 local header / central directory / EOCD（`external_attr`、
 * 声明的 `uncompressedSize`、data descriptor、加密位、任意压缩方法号、任意 entry 名）。
 *
 * **不得**依赖 `python3` / `zip` 命令行：新机器必须能直接
 * `node tests/test-skills-import.js`（CR-12 的可复现性纪律 + `IN-16` / `WR-09` 的教训 ——
 * 夹具只留 `/tmp` 等于结论不可重跑复核）。
 *
 * ## 覆盖的形态（对齐 CR-12 的清单）
 *
 * symlink（file / dir / 混装）、非普通文件（chrdev `0o020000` / fifo `0o010000` /
 * socket `0o140000`）、Windows 造包（`versionMadeBy = 0x0014` ⇒ 高 16 位无 Unix mode）、
 * 逃逸族 12 例、冲突名 4 例（大小写 2 + NFC/NFD 2）、炸弹 3 例（高压缩比 / 多条目 /
 * 深目录）、`0xFFFFFFFF` 声明、加密条目（gpb bit0）、不支持的压缩方法（method 12）、
 * 空包（只有 EOCD，22 B）、data descriptor（gpb bit3）、正常 zip64。
 *
 * 用法: `const { buildZip, skillPackage, ... } = require('./helpers/make-malicious-zip')`
 */

const zlib = require('zlib');

// ==================== CRC32（纯表驱动，零依赖） ====================

let CRC_TABLE = null;

/** 标准 CRC-32（IEEE 802.3，多项式 0xEDB88320） */
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

// ==================== 常量 ====================

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** 合法 zip64 EOCD（生成器在本文件里不写 zip64 结构，仅登记常量供用例引用） */
const ZIP64_EOCD_LOCATOR_SIG = 0x07064b50;

/** Unix 造包默认 versionMadeBy（高字节 3 = Unix） */
const VERSION_MADE_BY_UNIX = (3 << 8) | 30;
/** Windows 造包 versionMadeBy（高字节 0 ⇒ 高 16 位无 Unix mode） */
const VERSION_MADE_BY_WINDOWS = 0x0014;

/** 固定 DOS 时间戳（1980-01-01 00:00:00，合法最小值） */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

/** 普通文件的 Unix mode（含 external_attr 高 16 位）：`0o100644` */
const UNIX_MODE_FILE = (0o100644 << 16) >>> 0;
/** 目录的 Unix mode：`0o040755` */
const UNIX_MODE_DIR = (0o040755 << 16) >>> 0;
/** 符号链接的 Unix mode：`0o120777`（`S_IFLNK | 0777`） */
const UNIX_MODE_SYMLINK = (0o120777 << 16) >>> 0;
/** 字符设备 / FIFO / socket（非普通文件族，yauzl 实测不报错） */
const UNIX_MODE_CHRDEV = (0o020644 << 16) >>> 0;
const UNIX_MODE_FIFO = (0o010644 << 16) >>> 0;
const UNIX_MODE_SOCKET = (0o140644 << 16) >>> 0;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
/** 不支持 / 不可解码的压缩方法号（BZIP2；yauzl `canDecodeFileData()` 会返回 false） */
const METHOD_UNSUPPORTED = 12;

// ==================== 核心：buildZip ====================

/**
 * 组装一个 zip（逐字节控制）
 *
 * @param {{entries: Array<object>, withEocd?: boolean}} params
 *   `entries` 每项字段：
 *   - `name`（string **或** Buffer —— Buffer 用于表达 NUL / 控制字符 / RTL 原始字节）
 *   - `data`（Buffer | string，默认空）
 *   - `method`（默认 `deflate`；`stored` = 0）
 *   - `externalFileAttributes`（默认按是否以 `/` 结尾自动取 file / dir 的 Unix mode）
 *   - `versionMadeBy`（默认 Unix）
 *   - `generalPurposeBitFlag`（默认 0；`encrypted: true` ⇒ 置 bit0，`utf8: true` ⇒ 置 bit11，
 *     `dataDescriptor: true` ⇒ 置 bit3 且把 local header 的 crc/csize/usize 写 0）
 *   - `declaredUncompressedSize` / `declaredCompressedSize`（覆盖 central directory 的声明值；
 *     用于炸弹与 `0xFFFFFFFF` 样本）
 *   - `crc`（覆盖；默认按真实数据算）
 *   - `isDirectory`（以 `/` 结尾自动判）
 * @returns {Buffer} zip 字节
 */
function buildZip({ entries = [], withEocd = true } = {}) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const spec of entries) {
    const nameBuf = Buffer.isBuffer(spec.name)
      ? spec.name
      : Buffer.from(String(spec.name), 'utf8');
    const raw = Buffer.isBuffer(spec.data)
      ? spec.data
      : Buffer.from(String(spec.data == null ? '' : spec.data), 'utf8');

    const method = spec.method === undefined ? METHOD_DEFLATE : spec.method;
    const isDirectory =
      spec.isDirectory !== undefined ? spec.isDirectory : String(spec.name || '').endsWith('/');

    // 压缩：stored 原样，deflate 用 deflateRaw（zip 的 deflate 不含 zlib 头）
    let payload;
    if (method === METHOD_STORED) payload = raw;
    else if (method === METHOD_DEFLATE) payload = zlib.deflateRawSync(raw);
    else payload = raw; // 任意方法号：数据原样写（表达「方法不可解码」的形态）

    const crc = spec.crc !== undefined ? spec.crc >>> 0 : crc32(raw);
    const csize = spec.declaredCompressedSize !== undefined ? spec.declaredCompressedSize : payload.length;
    const usize = spec.declaredUncompressedSize !== undefined ? spec.declaredUncompressedSize : raw.length;

    let gpb = spec.generalPurposeBitFlag || 0;
    if (spec.encrypted) gpb |= 0x0001;
    if (spec.dataDescriptor) gpb |= 0x0008;
    if (spec.utf8) gpb |= 0x0800;

    const versionMadeBy =
      spec.versionMadeBy === undefined ? VERSION_MADE_BY_UNIX : spec.versionMadeBy;
    const extAttr =
      spec.externalFileAttributes !== undefined
        ? spec.externalFileAttributes >>> 0
        : isDirectory
          ? UNIX_MODE_DIR
          : UNIX_MODE_FILE;

    // ---- local file header ----
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(SIG_LOCAL, 0);
    lfh.writeUInt16LE(20, 4); // versionNeeded
    lfh.writeUInt16LE(gpb, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(DOS_TIME, 10);
    lfh.writeUInt16LE(DOS_DATE, 12);
    // data descriptor 形态：local header 的 crc / 尺寸写 0（真实值经 descriptor 给）
    lfh.writeUInt32LE(spec.dataDescriptor ? 0 : crc, 14);
    lfh.writeUInt32LE(spec.dataDescriptor ? 0 : csize, 18);
    lfh.writeUInt32LE(spec.dataDescriptor ? 0 : usize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extraLen

    const localOffset = offset;
    localParts.push(lfh, nameBuf, payload);
    offset += lfh.length + nameBuf.length + payload.length;

    if (spec.dataDescriptor) {
      const dd = Buffer.alloc(16);
      dd.writeUInt32LE(0x08074b50, 0); // data descriptor signature（可选，yauzl 接受）
      dd.writeUInt32LE(crc, 4);
      dd.writeUInt32LE(csize, 8);
      dd.writeUInt32LE(usize, 12);
      localParts.push(dd);
      offset += dd.length;
    }

    // ---- central directory header ----
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(SIG_CENTRAL, 0);
    cdh.writeUInt16LE(versionMadeBy, 4);
    cdh.writeUInt16LE(20, 6); // versionNeeded
    cdh.writeUInt16LE(gpb, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(DOS_TIME, 12);
    cdh.writeUInt16LE(DOS_DATE, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(csize, 20);
    cdh.writeUInt32LE(usize, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extraLen
    cdh.writeUInt16LE(0, 32); // commentLen
    cdh.writeUInt16LE(0, 34); // diskNo
    cdh.writeUInt16LE(0, 36); // internalAttr
    cdh.writeUInt32LE(extAttr, 38);
    cdh.writeUInt32LE(localOffset, 42);
    centralParts.push(cdh, nameBuf);
  }

  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);

  if (!withEocd) return Buffer.concat([localBuf, centralBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

// ==================== 合法包 ====================

/**
 * 组一个**合法**的单技能包：`<name>/SKILL.md`（+ 可选附加条目）
 *
 * @param {{name?: string, description?: string, body?: string, extraEntries?: Array<object>,
 *          frontmatterName?: string, wrapPrefix?: string}} params
 *   `wrapPrefix` 模拟 GitHub zipball 的恒定顶层前缀（`<repo>-<ref>/`）
 * @returns {Buffer} zip 字节
 */
function skillPackage({
  name = 'demo-skill',
  description = '演示技能：用于测试导入管线',
  body = '# demo\n\n正文\n',
  extraEntries = [],
  frontmatterName,
  wrapPrefix = '',
} = {}) {
  const fmName = frontmatterName === undefined ? name : frontmatterName;
  const skillMd = `---\nname: ${fmName}\ndescription: ${description}\n---\n\n${body}`;
  const base = wrapPrefix ? `${wrapPrefix}/${name}` : name;
  return buildZip({
    entries: [{ name: `${base}/SKILL.md`, data: skillMd }, ...extraEntries],
  });
}

/** 空包：只有 EOCD（22 字节，合法但零条目） */
function emptyZip() {
  return buildZip({ entries: [] });
}

// ==================== 恶意样本族 ====================

/** 含一个 symlink 条目的包（`versionMadeBy` 高字节 3 + mode `0o120777`） */
function symlinkZip(targetName = 'demo-skill', extra = []) {
  return buildZip({
    entries: [
      { name: `${targetName}/SKILL.md`, data: '---\nname: x\ndescription: y\n---\n\n' },
      { name: `${targetName}/evillink`, data: '/etc/passwd', externalFileAttributes: UNIX_MODE_SYMLINK },
      ...extra,
    ],
  });
}

/** 含目录型 symlink 的包 */
function symlinkDirZip() {
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n' },
      { name: 'demo-skill/linkdir/', data: '', externalFileAttributes: UNIX_MODE_SYMLINK },
    ],
  });
}

/** 含非普通文件（chrdev / fifo / socket）的包 */
function specialFileZip(kind = 'fifo') {
  const modes = { chrdev: UNIX_MODE_CHRDEV, fifo: UNIX_MODE_FIFO, socket: UNIX_MODE_SOCKET };
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n' },
      { name: `demo-skill/weird-${kind}`, data: '', externalFileAttributes: modes[kind] },
    ],
  });
}

/** 高压缩比炸弹（1 MiB 的零字节 deflate 到 ~1 KiB，压缩比远超 100:1） */
function ratioBombZip() {
  const big = Buffer.alloc(1024 * 1024, 0x00);
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n' },
      { name: 'demo-skill/big.bin', data: big },
    ],
  });
}

/** 多条目炸弹（entry 数超 `MAX_ENTRIES`） */
function manyEntriesZip(count = 2500) {
  const entries = [{ name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n', method: METHOD_STORED }];
  for (let i = 0; i < count; i += 1) {
    entries.push({ name: `demo-skill/f${i}.txt`, data: 'x', method: METHOD_STORED });
  }
  return buildZip({ entries });
}

/** 深目录炸弹（技能根相对深度远超 `MAX_NESTING_DEPTH`） */
function deepZip(depth = 20) {
  const segments = [];
  for (let i = 0; i < depth; i += 1) segments.push(`d${i}`);
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n', method: METHOD_STORED },
      { name: `${segments.join('/')}/deep.txt`, data: 'x', method: METHOD_STORED },
    ],
  });
}

/**
 * 逃逸族 12 例（逐条对应 `51-RESEARCH.md` 实测 1 的 ④ 样本表）
 *
 * ⚠️ 其中 `../evil.txt` / `a/b/../../../evil.txt` / `./../../evil.txt` / 绝对路径 /
 * 盘符 / UNC 六类由 **yauzl 自身**在枚举期拦下（`invalid relative path` / `absolute path`），
 * 其余六类**由 yauzl 放行**、必须靠 Realm 自建的 `validateEntryName` 拦下 —— 两类都要有例。
 */
const ESCAPE_NAMES = [
  '../evil.txt',
  'a/b/../../../evil.txt',
  './../../evil.txt',
  '/tmp/evil.txt',
  'C:/evil.txt',
  'C:\\evil.txt',
  '\\\\srv\\share\\e',
  '//srv/share/e',
  'a//tmp/x.txt',
  'evil.txt:ads',
  'ctl\x01evil/SKILL.md',
  'nul\x00evil/SKILL.md',
  'evil.',
  'evil ',
  'x\u202ey/SKILL.md',
];

/** 用给定 entry 名单造包（每个 entry 都包一个合法 SKILL.md，保证失败只可能来自该名单） */
function escapeZip(entryName) {
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n', method: METHOD_STORED },
      { name: entryName, data: 'x', method: METHOD_STORED },
    ],
  });
}

/** 归一化冲突包：同一包内两个归一化后同名的 entry */
function collisionZip(pair = ['Skill/SKILL.md', 'skill/SKILL.md']) {
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: '---\nname: x\ndescription: y\n---\n\n', method: METHOD_STORED },
      { name: pair[0], data: 'a', method: METHOD_STORED },
      { name: pair[1], data: 'b', method: METHOD_STORED },
    ],
  });
}

/** 声明 `uncompressedSize = 0xFFFFFFFF`（缺 zip64 extra field ⇒ yauzl 静默放行） */
function zip64DeclaredZip() {
  return buildZip({
    entries: [
      {
        name: 'demo-skill/SKILL.md',
        data: '---\nname: x\ndescription: y\n---\n\n',
        declaredUncompressedSize: 0xffffffff,
      },
    ],
  });
}

/** 加密条目（gpb bit0，yauzl `canDecodeFileData()` 返回 false） */
function encryptedZip() {
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: 'secret', encrypted: true },
    ],
  });
}

/** 不支持的压缩方法（method 12 = BZIP2） */
function unsupportedMethodZip() {
  return buildZip({
    entries: [
      { name: 'demo-skill/SKILL.md', data: 'x', method: METHOD_UNSUPPORTED },
    ],
  });
}

/** data descriptor 形态（gpb bit3）—— 实测**正常接受**，尺寸取自 central directory */
function dataDescriptorZip() {
  return buildZip({
    entries: [
      {
        name: 'demo-skill/SKILL.md',
        data: '---\nname: x\ndescription: y\n---\n\n',
        method: METHOD_STORED,
        dataDescriptor: true,
      },
    ],
  });
}

/** 正常 zip64 包（声明真实尺寸，走小包路径；用于证明 zip64 **本身**不被拒） */
function normalZip64Zip() {
  return buildZip({
    entries: [
      {
        name: 'demo-skill/SKILL.md',
        data: '---\nname: x\ndescription: y\n---\n\n',
        method: METHOD_STORED,
      },
    ],
  });
}

module.exports = {
  buildZip,
  skillPackage,
  emptyZip,
  crc32,
  // 恶意样本族
  symlinkZip,
  symlinkDirZip,
  specialFileZip,
  ratioBombZip,
  manyEntriesZip,
  deepZip,
  escapeZip,
  collisionZip,
  zip64DeclaredZip,
  encryptedZip,
  unsupportedMethodZip,
  dataDescriptorZip,
  normalZip64Zip,
  ESCAPE_NAMES,
  // 常量（用例引用）
  SIG_LOCAL,
  SIG_CENTRAL,
  SIG_EOCD,
  ZIP64_EOCD_LOCATOR_SIG,
  VERSION_MADE_BY_UNIX,
  VERSION_MADE_BY_WINDOWS,
  UNIX_MODE_FILE,
  UNIX_MODE_DIR,
  UNIX_MODE_SYMLINK,
  UNIX_MODE_CHRDEV,
  UNIX_MODE_FIFO,
  UNIX_MODE_SOCKET,
  METHOD_STORED,
  METHOD_DEFLATE,
  METHOD_UNSUPPORTED,
};
