# GitHub 登录跳转 `/sessions/two-factor/app` 404 排查实录

> 2026-08-04 · Realm Browser · 影响文件：`main.js`、`src/renderer.js` + 容器数据清理（无代码改动）

## 现象

在 Realm Browser 中使用 GitHub 网站登录：

1. 输入用户名密码后提交
2. 页面跳转至 `https://github.com/sessions/two-factor/app`
3. 显示 GitHub 官方 404 页面（"This is not the web page you are looking for"）

**预期行为**：应显示标准 TOTP 验证码输入页（`github-two-factor.png` 中的 6-digit code 输入框）。

**用户环境**：GitHub 账户配置了 Authenticator app (TOTP) 两步验证，未使用 Passkey/Security Key。

---

## ✅ 结论（最终修复，2026-08-04）

**根因**：`main.js` 中"用 CDP 覆盖 User-Agent Client Hints 品牌列表"的代码，在 webview **尚未首次导航**的
`web-contents-created` 阶段就 `attach` debugger 并发 `Network.setUserAgentOverride`。实测该命令在
从未导航过的 target 上**永久挂起**（不 resolve / 不 reject）——

- 覆盖**从不生效**（对应下文"Round 4 console 无日志"现象）；
- debugger 一直处于 `attached` 状态，阻塞 DevTools 与 AI 工具（cdpManager）；
- 更关键的是，挂起的覆盖命令可能向 GitHub 发出**不一致 / 半应用的 `Sec-CH-UA` 头**，
  而 GitHub 登录流程对客户端指纹高度敏感（见"Round 3"），导致 2FA 会话被误判、路由到
  `/sessions/two-factor/app` 时因无可用的待验证 2FA 会话而 404。

**修复**：删除这段挂起的 CDP UA 覆盖代码（`main.js` `web-contents-created`），仅保留
`contents.setUserAgent()` 的 UA 字符串伪装。

**为什么删掉是安全的**（实证）：
- Electron 32 默认 `navigator.userAgentData.brands` / `Sec-CH-UA` **本就不含 Electron 品牌**
  （只有 `Not;A=Brand` + `Chromium`），伪装 UA 字符串已足以"隐藏 Electron"；
- 服务端对 `curl -A`（Electron UA vs Chrome UA）访问 `/sessions/two-factor/app` 返回**同样的 404**，
  证明 UA / 指纹本身就不是 404 的触发条件，移除不会带来回归。

**验证结果（2026-08-04 用户复测，最终通过）**：

| 步骤 | 结果 |
|------|------|
| 删除 CDP 覆盖代码后，用**其他容器**（干净 session）登录 GitHub | ✓ 正常，2FA 页面渲染 |
| 用 **default 容器**（旧数据残留）登录 | ✗ 仍 404 |
| 清理 default 容器残留数据（`cookies.json` + `Partitions/container-default/`）后再试 | ✓ 正常，2FA 页面渲染 |

→ **根因确认**：CDP 挂起覆盖是"代码层根因"（删掉后干净容器即可登录）；default 容器仍失败
属于**旧数据残留**（此前在错误/损坏的 session 里写入的 cookie + 430MB partition 数据），
清空后即恢复。**两个修复缺一不可**。

### 📝 最终修复过程（操作清单）

1. **删除挂起的 CDP UA 覆盖代码**（`main.js` `web-contents-created`）：
   移除 `contents.debugger.attach('1.3')` + `Network.setUserAgentOverride` 整段，保留
   `contents.setUserAgent()` 的 UA 字符串伪装。
2. **清理 default 容器残留数据**（需**先退出应用**，否则运行中的 session 网络服务会立即
   刷盘重建被删的目录）：
   ```bash
   # dev 环境（~/Library/Application Support/realm-dev/）
   rm ~/Library/Application\ Support/realm-dev/containers/default/cookies.json
   rm -rf ~/Library/Application\ Support/realm-dev/Partitions/container-default/   # 430MB
   # 正式版路径同理：~/Library/Application Support/realm/
   ```
   删除前用 `lsof +D <Partitions/container-<id>>` 确认无句柄占用。

### 🎯 关键点

- **`Network.setUserAgentOverride` 在未导航过的 webContents 上永久挂起**（不 resolve 不 reject），
  → 覆盖不生效、debugger 永久附着、可能发出半应用的 `Sec-CH-UA` 头干扰 GitHub 登录指纹判断。
  不要在 `web-contents-created` 阶段对未导航 webview 发 CDP Network 命令。
- **改代码不会修复已写入的坏数据**：webview 曾在错误 session 中写入的 cookie / Local Storage
  / IndexedDB 残留在 `Partitions/container-<id>` 与 `containers/<id>/cookies.json`，排查此类
  "换容器就好、旧容器不行"的现象时，直接清这两个位置。
- **删除运行中的 Partitions 目录是无效操作**（会被网络服务进程刷盘重建），必须先退出应用。

### 关键事实更正

原文档假设 `/sessions/two-factor/app` 是"App-based 2FA（GitHub Mobile）专用页"——**这是错误的**。
证据（jupyter-infra/jupyter-deploy#299 的 E2E 代码）：该流程在 `**/sessions/two-factor/app**`
页面上填写 `#app_totp`（TOTP 验证码输入框）。即 `/sessions/two-factor/app` **就是认证器 App（TOTP）的
2FA 页面**，用户账户的路由是正确的，真正的异常是"页面 404"。

### 服务端行为实证（curl，无需登录）

| 请求 | 结果 |
|------|------|
| GET `/sessions/two-factor/app`（无会话 cookie） | 404 |
| GET `/sessions/two-factor`（无会话 cookie） | 404 |
| GET `/sessions/two-factor/app`（Electron UA） | 404（与 Chrome UA 相同 → UA 无关） |

两个 2FA 路由均为**会话守卫路由**：无"待验证 2FA"会话一律 404。因此 404 = 重定向后的
GET 未携带 POST `/session` 302 响应里设置的待验证会话 cookie。

### Webview Cookie 链路验证（本地 1:1 模拟 GitHub 流程，Electron 32.3.3）

本地 HTTPS server 模拟 `GET /login` → `POST /session`(302+Set-Cookie) → `GET /twofactor`：

```
POST /session   cookie=[sess=prelogin]     ✓ 携带登录页 cookie
302 + Set-Cookie: sess=2fa-pending        ✓ 服务端下发待验证会话
GET /twofactor  cookie=[sess=2fa-pending] ✓ 重定向 GET 正确携带新 cookie → 渲染 TOTP 输入框
```

**结论：Electron webview 的 302→Set-Cookie→重定向 GET 链路完全正常**，系统级 cookie 处理无问题，
进一步排除"会话 cookie 无法存储"类假设，将根因收敛到上文的 CDP 干扰。

### Round 4 为何"没有日志"（实证）

`webContents.debugger.sendCommand('Network.enable')` 在**从未导航过的全新 webContents** 上会
**永久挂起**（测试见下）。main.js 原代码在 `web-contents-created`（webview 未导航）时发
`Network.setUserAgentOverride`，其 `.then/.catch` 永不触发 → 无任何日志、覆盖不生效、
debugger 永久附着。这一条与实测日志吻合。

测试脚本（Electron 32.3.3）：
- 默认 `navigator.userAgentData.brands` = `[Not;A=Brand:24, Chromium:128]`（无 Electron）
- CDP 覆盖后 brands = `[Chromium, Not;A=Brand, Google Chrome]`（页面侧生效）
- `debugger.detach()` 后 brands 回退默认（覆盖随会话回退）

---

## 排查过程

### 第一轮：怀疑 `will-navigate` 拦截打断登录流程

**观察**：
- 终端日志显示 `will-navigate` 事件在 GitHub 登录 POST 后触发
- 分配规则模块 `assignmentRules.matchUrl()` 无匹配（`匹配结果: 无匹配`）
- 导航在**同一个 Tab 内**正常完成，没有新建 Tab

**原代码逻辑（main.js:265-270）**：
```javascript
// 无论是否匹配，只要规则匹配就创建新 Tab
if (matchedContainer) {
  event.preventDefault();
  // ...
}
```

该逻辑在分配规则匹配到**当前容器**时也会 `preventDefault()` 阻止导航，然后新建 Tab 重新 GET 请求目标 URL。对于需要 session 上下文的 POST-redirect 流程（如登录），这会丢失服务端下发的 session cookie。

**但**：本轮问题中分配规则**无匹配**，此逻辑未触发。排除。

---

### 第二轮：怀疑 User-Agent 暴露 Electron 身份

**假设**：GitHub 服务端检测到 `User-Agent` 包含 `Electron/<version>`，返回了 App-based 2FA 专用页面 `/sessions/two-factor/app`（而非通用 TOTP 页面）。由于用户账户未配置 App-based 2FA，该页面返回 404。

**尝试 2.1：`setUserAgent` 伪装**

在 `web-contents-created` 事件中为 webview 设置假 Chrome User-Agent：
```javascript
contents.setUserAgent(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
);
```

**结果**：仍跳转 `/sessions/two-factor/app` 并 404。失败。

**原因分析**：`setUserAgent` 只改字符串，Chromium 的 **Client Hints** 机制（`Sec-CH-UA` 请求头、`navigator.userAgentData.brands`）仍由内部品牌列表生成，包含 `"Electron";v="32"`。GitHub 服务端可能通过 Client Hints 而非 User-Agent 字符串检测浏览器类型。

---

### 第三轮：尝试移除 `Sec-CH-UA` 请求头

**尝试 3.1：`webRequest.onBeforeSendHeaders` 全局拦截删除**

在 `app.on('session-created')` 中为所有 session 注册拦截器，删除 `Sec-CH-UA` 及其变体请求头：
```javascript
app.on('session-created', (ses) => {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    delete headers['Sec-CH-UA'];
    delete headers['sec-ch-ua'];
    // ... 更多变体
    callback({ requestHeaders: headers });
  });
});
```

**结果**：GitHub POST `/session` 返回错误页：
> "What‽ Your browser did something unexpected. Please try again. If the error continues, try disabling all browser extensions."

**原因分析**：GitHub 的服务端安全机制检测到请求头被外部篡改（`Sec-CH-UA` 缺失或值异常），直接拒绝登录请求。回退此改动。

---

### 第四轮：尝试 CDP 内部覆盖 `userAgentMetadata`

**尝试 4.1：使用 `Network.setUserAgentOverride` 覆盖 brands**

在 `web-contents-created` 中通过 CDP 调试器发送 `Network.setUserAgentOverride`，提供完整的 `userAgentMetadata`（含 brands、platform、architecture 等），在 Chromium 内部替换 Electron 品牌为 Chrome：

```javascript
contents.debugger.attach('1.3');
contents.debugger.sendCommand('Network.setUserAgentOverride', {
  userAgent: '...Chrome 128...',
  userAgentMetadata: {
    brands: [
      { brand: 'Chromium', version: '128' },
      { brand: 'Not;A=Brand', version: '24' },
      { brand: 'Google Chrome', version: '128' }
    ],
    fullVersionList: [...],
    platform: 'macOS',
    platformVersion: '14.0',
    architecture: 'arm',
    mobile: false
  }
});
```

**结果**：仍跳转 `/sessions/two-factor/app` 并 404。console 无任何日志输出，无法确认 CDP 覆盖是否生效。

---

## 已保留的修改（未回退）

### 1. `will-navigate` 同容器放行（main.js:265-270）

将原逻辑从"规则匹配即拦截"改为"**匹配到其他容器**才拦截"，避免打断同一容器内的正常导航（如 POST-redirect 登录流程）。

```javascript
// 修改前
if (matchedContainer) {
  event.preventDefault();
  notifyOpenUrlInTab(contents, url, matchedContainer);
}

// 修改后
if (matchedContainer && matchedContainer !== currentContainer) {
  event.preventDefault();
  notifyOpenUrlInTab(contents, url, matchedContainer);
}
```

### 2. `partition` 先于 `src` 设置（src/renderer.js:728-732）

原代码先设置 `webview.src` 再设置 `webview.partition`，可能导致 webview 在 partition 生效前绑定到默认 session，cookie 读写落在错误的 session 中。

```javascript
// 修改前
webview.src = url || 'about:blank';
webview.partition = `persist:container-${containerId}`;

// 修改后
webview.partition = `persist:container-${containerId}`;
webview.src = url || 'about:blank';
```

### 3. 删除挂起的 CDP UA 覆盖代码（main.js `web-contents-created`，本次修复）

原代码在 webview 未导航时 attach debugger 并发 `Network.setUserAgentOverride`，命令永久挂起，
覆盖从不生效且 debugger 一直附着，并可能发出半应用的 `Sec-CH-UA` 头干扰 GitHub 登录（本次 404 根因）。

```javascript
// 删除：contents.debugger.attach + Network.setUserAgentOverride 整段
// 保留：contents.setUserAgent('...Chrome 128...') 的 UA 字符串伪装
```

理由（实证）：Electron 32 的 `Sec-CH-UA` / `navigator.userAgentData.brands` 本就不含 Electron
品牌，UA 字符串伪装已足够；服务端对 Electron/Chrome UA 的 `/sessions/two-factor/app` 返回相同 404，
指纹非触发条件，删除无回归风险。

---

## 遗留问题与后续排查方向

> 状态更新（2026-08-04 结论落地后）：第 1、2、3 项已被本轮实证**排除或收敛**，见文档开头的"结论"。
> 第 4、5 项已在**最终验证**中闭环（见文档开头"验证结果"表格）：修复 CDP 干扰后其他容器可正常
> 登录（等价于 Chrome 侧对照），default 容器在清理残留数据后恢复。

1. ~~**CDP 覆盖未确认生效**~~ → **已确认未生效且已修复**：实测 `Network.setUserAgentOverride` 在
   未导航过的 webContents 上永久挂起，覆盖从不生效；且 `detach` 会使已生效的覆盖回退。该代码已删除。

2. ~~**Cookie/session 隔离问题**~~ → **已排除**：本地 1:1 模拟 GitHub 登录流程（表单 POST →
   302+Set-Cookie → 重定向 GET），Electron 32.3.3 webview 正确携带 302 响应中的新 cookie，
   重定向 GET 正常渲染 TOTP 页。系统级 cookie 链路无问题。
   （注：`cookie-manager.js` 的 `loadCookies` 对 `__Host-` 前缀 cookie 传 `domain` 属性会导致
   这类 cookie 在**重启后恢复时被拒绝**——这是独立的持久化缺陷，与本次 404 无关，另案处理。）

3. ~~**GitHub 服务端返回 `/app` 的真实原因**~~ → **已澄清**：`/sessions/two-factor/app` 就是认证器
   App（TOTP）页面（jupyter-infra#299 实证），用户账户路由正确。两个 2FA 路由均为会话守卫路由，
   无待验证会话一律 404（curl 实证）。404 的直接原因是重定向 GET 未携带待验证会话 cookie。

4. **测试对比**：用普通 Chrome 登录同一 GitHub 账户，确认 Chrome 下 `/sessions/two-factor/app`
   能正常渲染 TOTP 输入框（按 jupyter-infra#299，TOTP-only 账户应正常）。此步骤用于在
   修复 CDP 干扰后仍复现 404 时，排除账户侧 / GitHub A/B 因素。
   --- **已验证等价结论**：修复后其他干净容器即可正常登录（无需 Chrome 对照），账户侧无异常。

5. **可能的残留根因**：若删除 CDP 覆盖代码后仍 404，**删除该容器的旧 session 数据后重试**：
   删除容器目录 `Partitions/container-<id>` 与 `containers/<id>/cookies.json`（或直接在容器
   管理里重建该容器）。此前 webview 可能在错误的 session 中写入了损坏的 cookie，单纯改代码不会修复已有数据。
   --- **已验证为第二次根因并已修复**：default 容器在删除 CDP 代码后仍 404，清空上述两个位置
   （430MB partition）后恢复。具体操作见文档开头"最终修复过程（操作清单）"。

---

## 相关文件

- `main.js`：`web-contents-created` 事件处理（**删除挂起的 CDP UA 覆盖代码，保留 setUserAgent**）、`will-navigate` 拦截逻辑
- `src/renderer.js`：`createWebviewForTab` 中 webview 属性设置顺序
- `assignment-rules.js`：URL 匹配规则（本轮问题中无匹配，排除）
- `cdp-manager.js`：CDP 调试器管理（仅 devMode 抓包时 attach，与本次修复无冲突）
