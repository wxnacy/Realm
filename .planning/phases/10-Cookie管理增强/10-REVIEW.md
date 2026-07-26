---
phase: 10-Cookie管理增强
reviewed: 2026-07-26T17:38:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - cookie-manager.js
  - ipc-handlers.js
  - scripts/test-save-domain-cookies.js
  - src/index.html
  - src/preload.js
  - src/renderer.js
  - src/styles/main.css
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-26T17:38:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

审查范围为 phase-10 全部变更（08746ab^..HEAD，+1595/-101）：Cookie 管理后端增强（cookie-manager.js 新增 getSessionCookies / getFileCookies / editCookie / deleteSingleCookie / saveDomainCookies / migrateLegacyCookies）、IPC 通道、Cookie 面板 UI（来源标签页、域名过滤、分页、编辑/删除）、保存按钮域名过滤对齐、暗色主题可读性修复及新增回归测试脚本。

正面确认：
- 两个 UAT 缺口的修复方向正确。saveDomainCookies 过滤语义（当前域 + 父域）与渲染层 applyDomainFilter 的 subdomain 模式逐行比对一致；`endsWith('.' + cookieDomain)` 正确拒绝后缀伪装域（.baidu.com.evil.com）和子串伪装域（notbaidu.com）。回归测试脚本 15/15 实际运行通过，含安全用例，handleSaveToFile 的域名提取已与 showCookiesModal 同源。
- Cookie 渲染全部走 DOM API + textContent，攻击者可控的 cookie name/value/domain 未拼入 innerHTML（仅静态 SVG 字符串使用 innerHTML）；所有新增 IPC 通道均有 assertTrustedSender 校验。
- settingsBtn 从侧边栏迁移到工具栏后，HTML/CSS/JS 无残留引用；migrateLegacyCookies 在 main.js 有被调用，非死代码。

**但发现一个 BLOCKER：删除单个 Cookie 的操作无法持久化**——已通过打桩 PoC 实际运行证实。另有 3 个 WARNING（编辑 domain/path 产生重复 Cookie、保存按钮忽略当前过滤器、删除后页码越界）。**建议修复 CR-01 后再合入。**

## Critical Issues

### CR-01: deleteSingleCookie 删除不持久化——saveCookies 合并保留逻辑使已删除 Cookie 在文件中复活

**File:** `cookie-manager.js:636-658`（与 `cookie-manager.js:128-150` 的合并逻辑交互）
**Issue:** `deleteSingleCookie` 先从 session 删除 Cookie，再调用 `saveCookies` 同步文件。但 `saveCookies` 的合并逻辑会"保留 cookies.json 中存在但 session 中没有的未过期 Cookie"（136-147 行）——刚被删除的 Cookie 恰好满足这个条件（文件中存在、session 中已没有、未过期），于是被原样写回文件。

已用打桩 PoC 实际运行证实（session 桩模拟真实 Electron cookies 存储语义）：

```
PoC1 deleteSingleCookie result: {"success":true,"message":"Cookie 已删除"}
PoC1 session 中 X 已删除: true
PoC1 文件中 X 仍存在（缺陷=删除未持久化，重启后复活）: true
```

实际后果：
1. 任何**曾被保存到文件**的 Cookie（应用退出时自动保存、或用户点过"保存到文件"），在面板点删除后 Toast 提示"Cookie 已删除"，但 File 标签页仍显示它，且下次启动 `loadCookies` 会将其复活进 session——删除操作对持久层完全无效；
2. 在 **File 标签页**上点删除时，若该 Cookie 不在 session 中，`ses.cookies.remove` 是 no-op，整个删除操作对文件也是 no-op——File 来源的删除按钮形同虚设。

**Fix:** 删除操作必须显式从 cookies.json 中剔除目标 key，而不是走通用合并保存。例如在 `deleteSingleCookie` 中替换 `await saveCookies(containerId)` 为直接更新文件：

```javascript
// 从 Session 中删除
await ses.cookies.remove(url, cookieData.name);

// 显式从文件中剔除（避免 saveCookies 合并逻辑将其保留复活）
const filePath = getCookieFilePath(containerId);
if (fs.existsSync(filePath)) {
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const targetKey = `${cookieData.domain}|${cookieData.name}|${cookieData.path || '/'}`;
  const remaining = existing.filter(c => `${c.domain}|${c.name}|${c.path}` !== targetKey);
  fs.writeFileSync(filePath, JSON.stringify(remaining, null, 2));
}
```

## Warnings

### WR-01: editCookie 修改 Domain/Path 会产生重复 Cookie（旧条目残留）

**File:** `cookie-manager.js:591-623`；表单入口 `src/index.html:330,334`（Domain/Path 为可编辑文本框）
**Issue:** Cookie 的唯一键是 `domain|name|path`，而编辑模态框仅禁用 Name，Domain 和 Path 均可编辑。用户修改其中任一个后，`ses.cookies.set` 会以新键**创建**一条新 Cookie，旧键的 Cookie 仍留在 session；随后的 `saveCookies` 合并（session 为主 + 文件保留）把两条都写入文件。已用 PoC 证实：

```
PoC2 文件中 Y 的条数（缺陷=2 表示 domain 编辑产生重复）: 2
PoC2 文件内容: [{"name":"Y","domain":"a.com","value":"v1"},{"name":"Y","domain":"b.com","value":"v2"}]
```

同名 Cookie 存在于两个域可能导致站点收到非预期的 Cookie 组合（父域 Cookie 会发送到所有子域）。

**Fix:** 二选一：
1. 编辑前先用原始 `domain|name|path` 调用 `ses.cookies.remove` 删除旧条目，文件中旧 key 的剔除依赖 CR-01 的修复（同一机制）；或
2. 更简单稳妥：将编辑模态框的 Domain/Path 输入框也设为 `disabled`（与 Name 一致），只允许修改 value/过期时间/标志位——这是 Cookie 管理工具的常见做法，可彻底回避键迁移问题。

### WR-02: "保存到文件"按钮硬编码 includeSubdomains=true，忽略面板当前过滤器

**File:** `src/renderer.js:2290`（handleSaveToFile）
**Issue:** 保存按钮始终调用 `saveDomainCookies(container, domain, true)`，无论用户在面板上选择了哪个过滤器。用户选"仅当前域名"时，实际保存的却包含父域 Cookie（保存数 > 显示数）；用户选"全部"时，实际只保存当前域相关（保存数 < 显示数）。UAT 缺口要求保存集合与"含子域名"（默认过滤器）对齐，hardcode 满足了默认场景，但过滤器被切换后"所见即所得"的对应关系再次断裂——这正是当初 test 6 暴露的同类问题（保存数 ≠ 面板显示数）在另外两个过滤器下的重现。

**Fix:** 让保存范围跟随当前过滤器状态：

```javascript
let result;
if (!domain || cookieState.filter === 'all') {
  result = await window.realmAPI.saveCookie(state.currentContainer);
} else {
  result = await window.realmAPI.saveDomainCookies(
    state.currentContainer, domain, cookieState.filter === 'subdomain');
}
```

（Toast 文案也建议带上范围说明，如"含父域"/"仅当前域名"。）

### WR-03: 删除末页最后一条后页码越界，列表误显"暂无 Cookie"且分页消失

**File:** `src/renderer.js:2071-2080`（renderCookiesList 切片）、`2252-2269`（handleDeleteCookie）
**Issue:** `handleDeleteCookie` 成功后调用 `refreshCookiesList()`，但不重置 `cookieState.page`。场景：26 个 Cookie（2 页），用户在第 2 页删掉唯一的 1 条 → 过滤后剩 25 个、总页数变为 1，而 `cookieState.page` 仍为 2 → `slice(25, 50)` 返回空数组 → 列表显示"暂无 Cookie"；同时 `renderPagination` 因 totalPages ≤ 1 清空分页控件（2137-2140 行），用户**没有任何途径返回第 1 页**，只能关闭重开模态框或切换过滤器。编辑保存后同样可能触发（编辑不影响数量，但切换来源标签页会重置页码，删除路径是唯一遗漏）。

**Fix:** 渲染前钳制页码，放在 `renderCookiesList` 开头（或 `refreshCookiesList` 过滤之后）：

```javascript
const totalPages = Math.max(1, Math.ceil(cookieState.filteredCookies.length / cookieState.pageSize));
if (cookieState.page > totalPages) cookieState.page = totalPages;
```

## Info

### IN-01: 过期时间输入未做数字校验，NaN 直接送入主进程

**File:** `src/renderer.js:2225`
**Issue:** `cookieExpirationInput` 是 `type="text"`，用户输入非数字（如 "abc"）时 `Number(...)` 得 `NaN`，随 IPC 传入 `ses.cookies.set({ expirationDate: NaN })`，行为依赖 Electron 内部校验，用户只会看到笼统的"编辑失败"Toast。负数和过去时间戳同样未拦截。
**Fix:** 提交前校验：`const n = Number(v); if (v && (!Number.isFinite(n) || n <= 0)) { showToast('过期时间需为正数 Unix 时间戳', 'error'); return; }`

### IN-02: cookie:save-domain 的 JSDoc 注释语义与实际实现相反

**File:** `ipc-handlers.js:459-460`、`src/preload.js:234-238`
**Issue:** 两处注释写"只保存当前域名及其**子域名**的 Cookie"/"是否包含子域名"，而实现（cookie-manager.js:186-188）匹配的是当前域名及其**父域**（与面板"含子域名"过滤集合一致）。cookie-manager.js 自身的注释是正确的，但 IPC 层和 preload 层的错误注释会误导后续维护者按相反语义理解该通道（这正是 test 6 曾经踩过的坑）。
**Fix:** 统一改为"保存当前页面可见的域名 Cookie（当前域名及其父域，与面板'含子域名'过滤集合一致）"。

### IN-03: cookie:edit / cookie:delete-single 仅校验 name，domain/path 缺失时抛 TypeError

**File:** `ipc-handlers.js:435`、`ipc-handlers.js:452`
**Issue:** 两个通道只检查 `cookieData.name`。若 `cookieData.domain` 为 undefined，`cookie-manager.js` 内 `cookieData.domain.startsWith('.')` 抛 TypeError——虽被各自 try/catch 兜住返回失败消息，但错误文案（"startsWith of undefined"）对排查无意义，且校验风格与文件内其他通道不一致。
**Fix:** 在 IPC 层补齐校验：`typeof cookieData.domain === 'string' && cookieData.domain.length > 0`（delete-single 还需 `path` 可选但须为 string）。

### IN-04: 新增 cookie:save-domain 未校验 containerId 字符集（深度防御）

**File:** `ipc-handlers.js:466-475`
**Issue:** `containerId` 仅校验非空字符串即传入 `path.join(CONTAINERS_DIR, containerId)` 拼路径。assertTrustedSender 已限制只能来自主窗口渲染进程，现实风险低，但一旦渲染层出现 XSS，形如 `../../` 的 containerId 可在用户目录任意位置写文件。该模式在本文件所有 cookie 通道中一致存在，属系统性欠账而非本次引入，但新通道是收紧校验的合理切入点。
**Fix:** 对 containerId 加白名单校验（如 `/^[a-z0-9-]+$/`），或与 `configStore.get('containers')` 中的现有容器比对。

### IN-05: realm:// 内部页面提取出伪域名，产生误导性保存结果

**File:** `src/renderer.js:2279-2285`
**Issue:** `new URL('realm://history').hostname` 返回 `'history'`（非空），因此活动标签为内部页面（历史/收藏/设置页）时，保存按钮会走 `saveDomainCookies(container, 'history', true)` 分支，匹配 0 条并 Toast"已保存 0 个 history 的 Cookie 到文件"。结果无害（合并保留逻辑不动文件），但文案令人困惑；`about:blank` 等场景 hostname 为空、会落入 save-all 分支，两类非 http 页面行为还不一致。
**Fix:** 域名提取处限定协议：`if (url.protocol === 'http:' || url.protocol === 'https:') domain = url.hostname;`，非 http(s) 页面统一走 save-all 分支或禁用保存按钮。

---

_Reviewed: 2026-07-26T17:38:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
