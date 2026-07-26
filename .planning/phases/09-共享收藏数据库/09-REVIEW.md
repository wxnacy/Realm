---
status: issues-found
phase: 09-共享收藏数据库
reviewed_at: 2026-07-26T03:00:26Z
depth: standard
files_reviewed: [ipc-handlers.js, scripts/test-ipc-favorites.js]
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
---

# Phase 09: Code Review Report（gap closure plan 09-03）

**Reviewed:** 2026-07-26T03:00:26Z
**Depth:** standard
**Files Reviewed:** 2（交叉核对 favorites-manager.js / src/preload.js / src/renderer.js / src/favorites-page.js）
**Status:** issues-found（0 Critical — 不阻塞交付）

## Summary

09-03 的签名对齐是**正确且完整**的：逐一核对了全部 8 个 `favorites:*` handler 的 manager 调用与 favorites-manager.js 新签名（`checkUrl(url)`、`addRecord({...})`、`updateRecord(id,{title})`、`deleteRecord(id)`、`deleteRecords(ids)`、`listRecords({...})`、`searchRecords({...})`、`getCount()`），实参个数与字段名全部精确匹配；preload.js 8 个 payload 与 handler 入参逐字段吻合；JSDoc 中无 `containerId` 残留；`assertTrustedSender` 在每个 handler 首行保留；history/tab/container 段未受影响。冒烟测试实测 8/8 PASS（exit 0）。核心 gap 已闭合，无 Critical 问题。

发现的问题集中在 **IPC 边界入参校验韧性**：重构保留了「仅校验 data 是对象」的基线，导致非标量入参（缺失 title、非字符串 url 等）会穿透到 better-sqlite3 抛出原始 TypeError/约束错误，而非文件一贯的 `无效的参数` 干净校验——当前渲染层调用均合法，故定级 Warning 而非 Critical。

## Critical

无。

## Warning

### WR-01: `favorites:update` / `favorites:delete` 未校验标量类型，非法输入穿透为 better-sqlite3 原始异常

**File:** `ipc-handlers.js:772-792`
**Issue:** `favorites:update` 直接透传 `favoritesManager.updateRecord(data.id, { title: data.title })`：
- `data.title === undefined` → better-sqlite3 抛出 `TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null`；
- `data.title === null` → 命中 `title TEXT NOT NULL` 约束，抛 `SqliteError: NOT NULL constraint failed`；
- `data.id` 为 undefined/object（`favorites:delete` 同）→ 绑定类型错误。

这些原始 DB 异常经 IPC 抛回渲染层，与本文件统一的 `无效的参数` 校验风格（及 WR-13 确立的「边界校验」先例）不一致。当前 renderer（renderer.js:309）始终发送合法值，可达性仅限 DevTools/被注入的主窗口渲染进程，故为 Warning。`favorites:list` / `favorites:search` 的 `offset`/`limit`（ipc-handlers.js:820-843）属同类（非数值字符串绑定进 `LIMIT ?` 触发 datatype mismatch），但沿用 history 段既有模式，一并记录。

**Fix:**
```javascript
ipcMain.handle('favorites:update', (event, data) => {
  assertTrustedSender(event);
  if (!data || typeof data !== 'object'
      || typeof data.id !== 'number'
      || typeof data.title !== 'string') {
    throw new Error('无效的参数');
  }
  return favoritesManager.updateRecord(data.id, { title: data.title });
});
// favorites:delete 同理补 typeof data.id !== 'number' 校验
```

### WR-02: `favorites:check` / `favorites:add` 未校验 `data.url` 类型与空值，可写入空 URL 脏行

**File:** `ipc-handlers.js:737-763`
**Issue:** 两处仅做 `data.url || ''` 兜底：
1. 非字符串真值 url（对象/数组）→ better-sqlite3 绑定 TypeError（同 WR-01 类）；
2. **空字符串 url 会被 `favorites:add` 正常插入**——`UNIQUE(url)` 约束下全局仅能存在一条 `url=''` 脏行，此后所有空 url 写入永久返回 `{error:'duplicate'}`。对照 `history:add`（ipc-handlers.js:604）按 D-23 显式跳过空 url/about:blank/realm://，favorites 段无等价防线。渲染层 UI 已有守卫（renderer.js:219、301），但边界自身不设防。

**Fix:**
```javascript
ipcMain.handle('favorites:add', (event, data) => {
  assertTrustedSender(event);
  if (!data || typeof data !== 'object'
      || typeof data.url !== 'string' || data.url.trim() === '') {
    throw new Error('无效的参数');
  }
  ...
});
// favorites:check 可同步加 typeof data.url !== 'string' 校验（空串查询无害但无意义）
```

### WR-03: `faviconUrl` 边界零校验，下游 `favorites-page.js` 属性上下文转义不完整（存储型 XSS 隐患，当前不可达）

**File:** `ipc-handlers.js:758-762`（边界）；下游 sink：`src/favorites-page.js:237`
**Issue:** `favorites:add` 原样接受 `data.faviconUrl` 入库；收藏页渲染时拼入 `<img src="${escapeHtml(faviconSrc)}">`。`escapeHtml`（textContent→innerHTML 技巧）只转义 `& < >`，**不转义双引号**——含 `" onerror="alert(1)` 的 favicon_url 可逃逸 src 属性注入事件处理器，在 realm://favorites 页面构成存储型 XSS。缓解事实：当前唯一写入方硬编码 `faviconUrl: ''`（renderer.js:317），且 assertTrustedSender 限定主窗口渲染进程，**今日不可达**；但本文件 WR-13 已确立「渲染层会把值写入属性 ⇒ 边界必须白名单校验」的先例（容器 color/icon），faviconUrl 属同一模式却无任何校验/长度限制，属应尽早闭合的纵深防御缺口（history 段 faviconUrl 同病，sink 在 history-page.js:296）。

**Fix（边界侧，sink 转义建议另开 issue 一并修 history/favorites 两处）:**
```javascript
// favorites:add 内
const faviconUrl = typeof data.faviconUrl === 'string'
  && /^https?:\/\//.test(data.faviconUrl)
  && data.faviconUrl.length <= 2048
  ? data.faviconUrl : '';
```
sink 侧根治：`escapeHtml` 增补 `.replace(/"/g, '&quot;')`（或属性改用 DOM 赋值 `img.src = faviconSrc`）。

## Info

### IN-01: 冒烟测试未接入任何运行入口，「持久回归护栏」实际只能靠人记得手动跑

**File:** `scripts/test-ipc-favorites.js`（package.json:6-12）
**Issue:** 文件头注释自述目的是「持久回归护栏」，但 package.json 无 `test`（或任何）script 引用它，亦无 CI。下一次 IPC 签名漂移时该护栏大概率不会被执行——正是它要防的那类事故。
**Fix:** package.json scripts 增加 `"test": "node scripts/test-ipc-favorites.js"`（或 `test:ipc`），后续测试脚本统一挂入。

### IN-02: 测试未护栏其自述的 T-09-03 缓解（`assertTrustedSender` 首行），且无负向用例

**File:** `scripts/test-ipc-favorites.js:45-48, 105-154`
**Issue:** 打桩使 `BrowserWindow.fromWebContents`/`getMainWindow` 恒返回同 id——守卫永远通过。若未来某次编辑从某个 favorites handler 删掉 `assertTrustedSender` 首行，测试**仍然全绿**，其声称守护的 T-09-03 缓解无回归保护；亦无任何负向用例（如 `null` payload 应抛 `无效的参数`）。
**Fix:** 增加一组用例：将 `windowManagerStub.getMainWindow` 临时改为 `() => null`，断言每个 favorites handler 抛 `不受信任的 IPC 来源`；另加 1-2 个非法 payload 用例断言校验抛出。

---

_Reviewed: 2026-07-26T03:00:26Z_
_Reviewer: CodeBuddy (gsd-code-reviewer)_
_Depth: standard_
