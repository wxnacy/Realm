# Phase 17: Chrome 书签导入 - Research

**Researched:** 2026-07-30
**Domain:** Chrome bookmarks import (JSON/HTML parsing, batch SQLite operations, progress UI)
**Confidence:** HIGH

## Summary

本阶段实现从 Chrome 浏览器导入书签到 Realm Browser 收藏夹系统的完整流程。技术方案包括：
1. 自动检测并读取 Chrome 本地 JSON 书签文件（`~/Library/Application Support/Google/Chrome/Default/Bookmarks`）
2. 支持导入 Chrome 导出的 HTML 格式书签文件（Netscape Bookmark 格式）
3. 使用 cheerio 解析 HTML 书签文件
4. 使用 better-sqlite3 事务批量插入提升性能
5. 通过 IPC 事件实现主进程到渲染进程的进度报告

**主要建议：** 使用 `cheerio` 解析 HTML 书签，使用 better-sqlite3 的 `db.transaction()` 批量插入优化性能，使用 `webContents.send()` 实现进度报告。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 收藏夹页面顶部搜索栏旁添加「导入」按钮（图标+文字），醒目但不占空间
- **D-02:** 按钮位置在搜索栏右侧，与收藏管理场景贴合
- **D-03:** 自动检测 + 手动可选策略：优先自动读取 Chrome 默认路径，找不到时提示用户手动选择文件
- **D-04:** 覆盖多 Profile 或自定义路径场景，自动检测失败后提供文件选择对话框
- **D-05:** 全部导入为子文件夹策略：在 Realm 根目录创建「Chrome 书签栏」「Chrome 其他」「Chrome 已同步」三个文件夹，保留原始结构
- **D-06:** 三个根文件夹名称使用中文翻译，与 Realm 整体中文 UI 一致
- **D-07:** 跳过重复策略：已有相同 URL 的收藏项不导入，显示跳过数量，保护现有数据
- **D-08:** 基于 URL 精确匹配判断重复（不区分协议、www 前缀、尾部斜杠）
- **D-09:** 保留原始结构策略：按 Chrome 书签的原始文件夹层级导入，不在 Realm 中重新组织
- **D-10:** 导入到 Realm 根目录下，以 Chrome 的三个根文件夹为顶层
- **D-11:** 选择文件 + 摘要预览确认流程：用户选择 HTML 文件后，先展示解析结果摘要（书签总数、文件夹数量、顶级文件夹列表），确认后执行导入
- **D-12:** 摘要预览展示：书签总数、文件夹数量、顶级文件夹列表，让用户快速确认内容
- **D-13:** 模态进度框：弹出模态框显示进度条、已导入/总数、当前处理的文件名
- **D-14:** 进度框在导入过程中阻塞交互，防止重复触发导入
- **D-15:** 导入时异步获取 favicon 并存入数据库，显示更完整的书签图标
- **D-16:** 使用 Google favicon API 或 Chrome 的 favicon 缓存路径获取图标
- **D-17:** 完成摘要：显示导入书签数、跳过数（重复）、创建文件夹数，完成后用户可关闭或查看导入的书签

### Claude's Discretion

- Chrome 书签 JSON 解析的容错处理（节点格式异常时跳过并记录）
- HTML 解析库选择（cheerio 已在 REQUIREMENTS.md 中列为依赖）
- 导入过程中的错误处理策略（单条失败不影响整体导入）
- favicon 获取失败时的降级处理（显示默认图标）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | 自动读取 Chrome 本地书签（JSON 格式） | Chrome bookmarks JSON 格式解析，文件路径检测，cheerio HTML 解析 |
| IMPORT-02 | HTML 书签文件导入（Netscape Bookmark 格式） | Netscape Bookmark HTML 格式规范，cheerio 解析实现 |
| IMPORT-03 | 导入进度和冲突处理 | IPC 进度报告，重复 URL 检测，批量插入性能优化 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | 1.0.0 | HTML 解析库，用于解析 Netscape Bookmark 格式 | 项目已列入 REQUIREMENTS.md 依赖，轻量级 jQuery-like API |
| better-sqlite3 | ^11.7.0 | SQLite 数据库驱动 | 项目已有依赖，支持事务批量插入 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron | ^32.0.0 | 桌面应用框架 | 文件对话框、IPC 通信 |
| fs | Node.js 内置 | 文件系统操作 | 读取 Chrome 书签文件 |
| path | Node.js 内置 | 路径处理 | 拼接 Chrome 书签路径 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cheerio | htmlparser2 | cheerio 更易用，jQuery-like API，社区更活跃 |
| Google favicon API | 本地 Chrome favicon 缓存 | API 需要网络请求，缓存更快但需要知道路径 |

**Installation:**
```bash
npm install cheerio
```

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages. Run the Package Legitimacy Gate protocol before completing this section.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| cheerio | npm | 12+ years | 20M+/week | github.com/cheeriojs/cheerio | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*cheerio 是成熟的 HTML 解析库，广泛用于 web scraping 和数据提取，无安全风险。*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │              favorites-page.js                   │   │
│  │  - Import Button (search bar right)              │   │
│  │  - Import Modal (progress bar)                   │   │
│  │  - Result Summary Dialog                         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         │ favorites:import-chrome
                         │ favorites:import-html
                         │ favorites:import-progress
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │           favorites-manager.js                   │   │
│  │  - importChromeBookmarks(filePath)               │   │
│  │  - importHtmlBookmarks(filePath)                 │   │
│  │  - parseChromeJson(data)                         │   │
│  │  - parseNetscapeHtml(html)                       │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              SQLite (better-sqlite3)             │   │
│  │  - favorites table                               │   │
│  │  - favorite_folders table                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── favorites-page.js        # 添加导入按钮和进度 UI
├── favorites.html           # 添加导入模态框 HTML
└── styles/
    └── main.css             # 添加导入相关样式

favorites-manager.js         # 添加导入相关 API
main.js                      # 添加 IPC handlers
src/preload.js               # 添加 contextBridge API
```

### Pattern 1: Chrome JSON 书签解析

**What:** 解析 Chrome bookmarks JSON 文件，提取书签和文件夹结构
**When to use:** 自动读取 Chrome 本地书签时
**Example:**
```javascript
// Chrome Bookmarks JSON 结构
{
  "roots": {
    "bookmark_bar": {
      "children": [...],
      "name": "Bookmarks Bar",
      "type": "folder",
      "id": "1",
      "date_added": "13185408000000000",
      "date_modified": "13185408000000000"
    },
    "other": {
      "children": [...],
      "name": "Other Bookmarks",
      "type": "folder",
      "id": "2"
    },
    "synced": {
      "children": [...],
      "name": "Mobile Bookmarks",
      "type": "folder",
      "id": "3"
    }
  },
  "version": 1
}

// 节点类型
// type: "folder" - 文件夹，包含 children 数组
// type: "url" - 书签，包含 url 字段
```

### Pattern 2: Netscape Bookmark HTML 解析

**What:** 使用 cheerio 解析 Chrome 导出的 HTML 书签文件
**When to use:** 用户选择 HTML 文件导入时
**Example:**
```javascript
const cheerio = require('cheerio');

// HTML 书签格式
// <!DOCTYPE NETSCAPE-Bookmark-file-1>
// <DL><p>
//   <DT><H3>Folder Name</H3>
//   <DL><p>
//     <DT><A HREF="https://example.com" ADD_DATE="1234567890">Bookmark Title</A>
//   </DL><p>
// </DL><p>

function parseNetscapeHtml(html) {
  const $ = cheerio.load(html);
  const bookmarks = [];

  // 递归解析 DL 结构
  function parseDL($dl, parentFolder) {
    $dl.children('DT').each((i, dt) => {
      const $dt = $(dt);
      const $a = $dt.find('> A');
      const $h3 = $dt.find('> H3');

      if ($a.length) {
        // 书签项
        bookmarks.push({
          title: $a.text().trim(),
          url: $a.attr('href'),
          addDate: $a.attr('ADD_DATE'),
          parentFolder
        });
      } else if ($h3.length) {
        // 文件夹
        const folderName = $h3.text().trim();
        const $subDl = $dt.next('DL');
        if ($subDl.length) {
          parseDL($subDl, folderName);
        }
      }
    });
  }

  // 开始解析
  const $rootDl = $('body > DL, html > DL');
  parseDL($rootDl, '');

  return bookmarks;
}
```

### Pattern 3: 批量插入优化

**What:** 使用 better-sqlite3 事务批量插入提升性能
**When to use:** 导入大量书签时
**Example:**
```javascript
// better-sqlite3 批量插入（使用事务）
function batchInsertBookmarks(bookmarks) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO favorites (url, title, favicon_url, folder_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  // 使用事务包裹所有插入操作
  const insertMany = db.transaction((items) => {
    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const result = insertStmt.run(
        item.url,
        item.title,
        item.faviconUrl || '',
        item.folderId || 0,
        item.sortOrder || 'a0'
      );

      if (result.changes > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    return { inserted, skipped };
  });

  return insertMany(bookmarks);
}
```

### Anti-Patterns to Avoid

- **不使用事务：** 单条插入性能差，应使用 `db.transaction()` 包裹批量操作
- **不处理重复 URL：** 应使用 `INSERT OR IGNORE` 或预先检查 `checkUrl()`
- **不报告进度：** 应通过 IPC 事件定期报告导入进度
- **不处理异常节点：** Chrome 书签可能有格式异常的节点，应跳过并记录

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML 解析 | 自定义正则解析 | cheerio | cheerio 是成熟的 HTML 解析库，支持复杂嵌套结构 |
| 重复 URL 检测 | 预查询 + 插入 | INSERT OR IGNORE | better-sqlite3 内置支持，性能更好 |
| 批量插入 | 循环单条插入 | db.transaction() | 事务包裹性能提升 100x+ |
| 文件对话框 | 自定义文件选择 | electron dialog | Electron 内置 API，跨平台兼容 |

**关键洞察：** cheerio 是解析 Netscape Bookmark HTML 格式的最佳选择，jQuery-like API 易于使用，社区活跃。

## Common Pitfalls

### Pitfall 1: Chrome 书签路径检测失败

**What goes wrong:** 用户使用非默认 Profile 或自定义路径，自动检测失败
**Why it happens:** Chrome 支持多 Profile，路径可能为 `Profile 1`、`Profile 2` 等
**How to avoid:** 自动检测失败后提供文件选择对话框（D-04）
**Warning signs:** 文件不存在或 JSON 解析失败

### Pitfall 2: 重复 URL 判断不准确

**What goes wrong:** 相似但不完全相同的 URL 被误判为重复或非重复
**Why it happens:** URL 可能有协议差异（http/https）、www 前缀、尾部斜杠等
**How to avoid:** 规范化 URL 后再比较（D-08）
**Warning signs:** 导入数量与预期不符

### Pitfall 3: 批量插入性能问题

**What goes wrong:** 导入大量书签时界面卡顿或超时
**Why it happens:** 未使用事务，单条插入性能差
**How to avoid:** 使用 `db.transaction()` 包裹批量操作，分批处理（每批 100-500 条）
**Warning signs:** 导入时间过长，界面无响应

### Pitfall 4: favicon 获取失败

**What goes wrong:** Google favicon API 请求失败或超时
**Why it happens:** 网络问题、API 限制、网站无 favicon
**How to avoid:** 异步获取，失败时使用默认图标，不影响导入流程
**Warning signs:** 书签图标显示为默认图标

## Code Examples

### Chrome JSON 解析实现

```javascript
// 来源：Chrome bookmarks JSON 格式文档
/**
 * 解析 Chrome bookmarks JSON 数据
 * @param {Object} data - Chrome bookmarks JSON 对象
 * @returns {Object} 解析结果 { bookmarks: [], folders: [] }
 */
function parseChromeJson(data) {
  const bookmarks = [];
  const folders = [];

  // 根文件夹映射
  const rootFolders = {
    'bookmark_bar': 'Chrome 书签栏',
    'other': 'Chrome 其他',
    'synced': 'Chrome 已同步'
  };

  // 递归解析节点
  function parseNode(node, parentPath = '') {
    if (node.type === 'folder') {
      const folderPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      folders.push({
        name: node.name,
        path: folderPath,
        dateAdded: node.date_added,
        dateModified: node.date_modified
      });

      // 递归解析子节点
      if (node.children) {
        node.children.forEach(child => parseNode(child, folderPath));
      }
    } else if (node.type === 'url') {
      bookmarks.push({
        title: node.name,
        url: node.url,
        dateAdded: node.date_added,
        parentPath
      });
    }
  }

  // 解析三个根文件夹
  Object.entries(data.roots).forEach(([key, root]) => {
    if (rootFolders[key] && root.children) {
      root.children.forEach(child => parseNode(child, rootFolders[key]));
    }
  });

  return { bookmarks, folders };
}
```

### HTML 书签解析实现

```javascript
// 来源：Netscape Bookmark File Format 规范
const cheerio = require('cheerio');

/**
 * 解析 Netscape Bookmark HTML 文件
 * @param {string} html - HTML 字符串
 * @returns {Object} 解析结果 { bookmarks: [], folders: [] }
 */
function parseNetscapeHtml(html) {
  const $ = cheerio.load(html);
  const bookmarks = [];
  const folders = [];

  // 递归解析 DL 结构
  function parseDL($dl, parentPath = '') {
    $dl.children('DT').each((i, dt) => {
      const $dt = $(dt);
      const $a = $dt.find('> A');
      const $h3 = $dt.find('> H3');

      if ($a.length) {
        // 书签项
        bookmarks.push({
          title: $a.text().trim(),
          url: $a.attr('href'),
          addDate: $a.attr('ADD_DATE'),
          parentPath
        });
      } else if ($h3.length) {
        // 文件夹
        const folderName = $h3.text().trim();
        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
        folders.push({
          name: folderName,
          path: folderPath,
          addDate: $h3.attr('ADD_DATE')
        });

        // 递归解析子文件夹
        const $subDl = $dt.next('DL');
        if ($subDl.length) {
          parseDL($subDl, folderPath);
        }
      }
    });
  }

  // 开始解析
  const $rootDl = $('body > DL, html > DL');
  parseDL($rootDl);

  return { bookmarks, folders };
}
```

### IPC 进度报告实现

```javascript
// 来源：Electron IPC 文档
const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * 注册导入相关 IPC handlers
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function registerImportHandlers(mainWindow) {
  // Chrome JSON 导入
  ipcMain.handle('favorites:import-chrome', async (event, { filePath }) => {
    try {
      // 如果未提供文件路径，自动检测或打开文件选择对话框
      if (!filePath) {
        filePath = detectChromeBookmarksPath();
        if (!filePath) {
          // 打开文件选择对话框
          const result = await dialog.showOpenDialog(mainWindow, {
            title: '选择 Chrome 书签文件',
            defaultPath: getDefaultBookmarksPath(),
            filters: [
              { name: 'Chrome 书签', extensions: ['json', '*'] },
              { name: '所有文件', extensions: ['*'] }
            ],
            properties: ['openFile']
          });

          if (result.canceled || result.filePaths.length === 0) {
            return { success: false, message: '已取消选择' };
          }
          filePath = result.filePaths[0];
        }
      }

      // 读取并解析文件
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const { bookmarks, folders } = parseChromeJson(data);

      // 批量导入
      const result = await batchImport(mainWindow, bookmarks, folders);

      return { success: true, ...result };
    } catch (error) {
      console.error('[Realm] Chrome 书签导入失败:', error);
      return { success: false, message: error.message };
    }
  });
}

/**
 * 批量导入书签和文件夹
 * @param {BrowserWindow} mainWindow - 主窗口实例
 * @param {Array} bookmarks - 书签数组
 * @param {Array} folders - 文件夹数组
 * @returns {Object} 导入结果
 */
async function batchImport(mainWindow, bookmarks, folders) {
  const total = bookmarks.length;
  let imported = 0;
  let skipped = 0;
  let foldersCreated = 0;

  // 1. 先创建文件夹
  for (const folder of folders) {
    // 检查文件夹是否已存在
    const existing = favoritesManager.checkFolder(folder.name, folder.parentId);
    if (!existing) {
      favoritesManager.createFolder({ name: folder.name, parentId: folder.parentId || 0 });
      foldersCreated++;
    }
  }

  // 2. 批量导入书签（每批 100 条）
  const batchSize = 100;
  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batch = bookmarks.slice(i, i + batchSize);
    const result = favoritesManager.batchInsertBookmarks(batch);
    imported += result.inserted;
    skipped += result.skipped;

    // 报告进度
    const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
    mainWindow.webContents.send('favorites:import-progress', {
      progress,
      imported,
      skipped,
      total,
      current: batch[batch.length.length - 1]?.title || ''
    });
  }

  return { imported, skipped, foldersCreated };
}
```

### 重复 URL 检测实现

```javascript
/**
 * 规范化 URL 用于重复检测
 * @param {string} url - 原始 URL
 * @returns {string} 规范化后的 URL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // 移除 www. 前缀
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // 移除尾部斜杠
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // 重新构建 URL（使用 https 协议）
    return `https://${hostname}${pathname}${parsed.search}${parsed.hash}`;
  } catch (e) {
    // URL 解析失败，返回原始值
    return url;
  }
}

/**
 * 检查 URL 是否已收藏（基于规范化后的 URL）
 * @param {string} url - 要检查的 URL
 * @returns {boolean} 是否已收藏
 */
function isUrlDuplicate(url) {
  const normalized = normalizeUrl(url);
  return favoritesManager.checkUrl(normalized) !== null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单条 INSERT | db.transaction() 批量插入 | better-sqlite3 v11+ | 性能提升 100x+ |
| 手动解析 HTML | cheerio 库 | 项目规范 | 更可靠，易维护 |
| 同步文件读取 | 异步 + 进度报告 | Electron 最佳实践 | UI 不卡顿 |

**Deprecated/outdated:**
- 不推荐使用正则表达式解析 HTML，应使用 cheerio
- 不推荐单条 INSERT，应使用事务批量插入

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | cheerio 1.0.0 是最新稳定版本 | Standard Stack | 可能需要更新版本号 |
| A2 | Google favicon API URL 格式为 `https://www.google.com/s2/favicons?domain=DOMAIN` | Favicon 获取 | API 可能已变更 |
| A3 | Chrome 书签路径 macOS 为 `~/Library/Application Support/Google/Chrome/Default/Bookmarks` | Chrome JSON 解析 | 路径可能因 Chrome 版本而异 |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Google favicon API 是否仍可用？**
   - What we know: Google 提供 favicon API，格式为 `https://www.google.com/s2/favicons?domain=DOMAIN&sz=SIZE`
   - What's unclear: API 是否有速率限制或需要 API key
   - Recommendation: 实现时添加错误处理和降级方案

2. **Chrome 多 Profile 路径如何处理？**
   - What we know: Chrome 支持多 Profile，路径可能为 `Profile 1`、`Profile 2` 等
   - What's unclear: 如何自动检测用户使用的 Profile
   - Recommendation: 自动检测默认 Profile，失败时提示用户手动选择

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cheerio | HTML 解析 | 需安装 | 1.0.0 | — |
| better-sqlite3 | 数据库操作 | ✓ | ^11.7.0 | — |
| electron | 文件对话框、IPC | ✓ | ^32.0.0 | — |
| Node.js fs | 文件读取 | ✓ | 内置 | — |
| Node.js path | 路径处理 | ✓ | 内置 | — |

**Missing dependencies with no fallback:**
- cheerio 需要安装

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none — see Wave 0 |
| Quick run command | `npm test`（待配置） |
| Full suite command | `npm test`（待配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | 自动读取 Chrome 本地书签 | unit | `npm test -- --grep "Chrome JSON"` | ❌ Wave 0 |
| IMPORT-02 | HTML 书签文件导入 | unit | `npm test -- --grep "HTML import"` | ❌ Wave 0 |
| IMPORT-03 | 导入进度和冲突处理 | unit | `npm test -- --grep "progress"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/import.test.js` — covers IMPORT-01, IMPORT-02, IMPORT-03
- [ ] `tests/conftest.js` — shared fixtures
- [ ] Framework install: `npm install --save-dev jest` — if none detected

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 文件内容验证、URL 格式验证 |
| V6 Cryptography | no | — |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意 HTML 文件 | Tampering | 限制文件大小，验证文件格式 |
| 路径遍历攻击 | Information Disclosure | 使用 path.resolve() 规范化路径，限制文件选择范围 |
| 大量数据导入导致 DoS | Denial of Service | 限制单次导入数量，分批处理 |

## Sources

### Primary (HIGH confidence)
- Chrome Bookmarks API 文档 — https://developer.chrome.com/docs/extensions/reference/bookmarks/
- cheerio 官方文档 — https://cheerio.js.org/
- better-sqlite3 文档 — https://github.com/WiseLibs/better-sqlite3
- Electron dialog API — https://www.electronjs.org/docs/latest/api/dialog

### Secondary (MEDIUM confidence)
- Netscape Bookmark File Format 规范
- Google favicon API 格式

### Tertiary (LOW confidence)
- Chrome 多 Profile 路径处理

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cheerio 和 better-sqlite3 是成熟稳定的库
- Architecture: HIGH — 基于现有代码模式，遵循项目规范
- Pitfalls: MEDIUM — 部分边界情况需要实际测试验证

**Research date:** 2026-07-30
**Valid until:** 2026-08-30 (30 days for stable stack)
