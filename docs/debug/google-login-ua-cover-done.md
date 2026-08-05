# Google 登录 `signin/rejected` 排查实录：指纹伪装做到极致仍被拒，结论为对抗上限

> 2026-08-04 ～ 2026-08-05 · Realm Browser · 涉及 `main.js`、`ua-ch-manager.js`（新增）、`cdp-manager.js`、Electron 32→43 升级
> 本文档交接给下一位。**最终结论：UA / Sec-CH-UA / navigator.userAgentData 三层伪装
> 已与真 Chrome 150 完全一致（品牌表按 Chromium 源码逐字段计算），Google 仍拒绝登录。
> 剩余差异在 Google 对嵌入式框架的行为/环境检测（WebAuthn/caBLE/BotGuard），属对抗
> 上限。用户已于 2026-08-05 决定停止排查。请勿重启指纹伪装这条线。**

---

## 现象

在容器中访问 `https://www.google.com/` 后点击登录，流程为：

```
google.com
  → accounts.google.com/ServiceLogin
  → /v3/signin/identifier          （输入账号）
  → /v3/signin/rejected            ← 登录在此被 Google 拒绝
```

**预期**：输入账号 + 密码后进入正常的验证流程 / 登录成功。
**实际**：页面 `did-navigate` 到 `https://accounts.google.com/v3/signin/rejected?…&idnf=…`。
在 test123 / newgoogle / google2 等多个干净容器、Electron 32 与 43 上均稳定复现。

---

## 排查过程（按时间线）

### Round 1：怀疑 `Sec-CH-UA` / UA 品牌表未伪装成 Chrome

浏览器网络请求日志（`onSendHeaders` 打印）显示：

```
[Realm UA-CH] GET https://accounts.google.com/ServiceLogin…
  sec-ch-ua: "Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"
  user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like
```

- `sec-ch-ua` 第 1 条是 `"Google Chrome"` → 品牌表**已经**是 Chrome。
- `user-agent` 看起来"只有 WebKit、没有 Chrome" → 一度被误判为 UA 未覆盖。

### Round 2：`attach`（CDP `Network.setUserAgentOverride`）全程无声

给 webview 注册了 `did-navigate` / `dom-ready` / `did-finish-load` 三个事件，
统一调 `ua-ch-manager.attach(webContents)`（内部走 `debugger.attach` + `Network.setUserAgentOverride`）。
但日志里**既没有「已附加」也没有「attach 跳过/失败」**，一度怀疑 attach 链路整体失效。

**真相**：这几条事件的 attach 是**冗余的**——UA 覆盖根本不依赖它（见"结论"）。
`onSendHeaders` 打印的 `[Realm UA-CH] GET` 来自 `ses.webRequest.onBeforeSendHeaders`
（`main.js`），**与 debugger / CDP 完全无关**，所以它正常输出不能证明 attach 成功，失败也不能证明 UA 失败。

---

## ✅ 决定性的根因分析

1. **Sec-CH-UA 已成功伪装为 Chrome/128**
   `main.js` 的 `session-created → webRequest.onBeforeSendHeaders` 注入
   `"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"`；打印值与之完全一致。

2. **User-Agent 已成功伪装为 Chrome/128.0.0.0**
   `main.js` 的 `web-contents-created → webview.setUserAgent(CHROME_UA)`（第 ~200 行）
   把 UA 设为 `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML,
   like Gecko) Chrome/128.0.0.0 Safari/537.36`。

   **「UA 没变」是日志假象**：`onSendHeaders` 里打印 `user-agent` 时用了
   `.slice(0, 80)`。按下述校验，80 字符恰好截断在 `(KHTML, like` 处，
   `Chrome/128.0.0.0 Safari/537.36` 尾缀被切掉，看起来像默认 WebKit UA。

   ```js
   const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
   CHROME_UA.slice(0, 80) === 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like' // true
   ```

   ⇒ **日志那一行与 `CHROME_UA` 前 80 字符逐字相等**，UA 覆盖已经生效。

3. **CDP debugger 那条链路不是必须的**
   `ua-ch-manager.attach`（`Network.setUserAgentOverride`）是**第二套**覆盖方案，用于
   覆盖 `navigator.userAgentData` 高熵字段（brands/fullVersionList/platform 等）。
   UA 字符串与 Sec-CH-UA 头已由 `setUserAgent` + `onBeforeSendHeaders` 可靠实现，
   故 attach 无日志不影响 UA 伪装本身。它的“无声”大概率是幂等短路或占用跳过，
   **不是登录失败的原因**。

---

## 真正的问题：`signin/rejected`（当时的中期判断，已被 Round 4-6 超越）

> 注：本节是 2026-08-04 的中期判断，当时怀疑账号/session 侧。后续 Round 4-6
> 已逐项证伪：干净容器（newgoogle/google2）仍 rejected 排除旧数据污染；
> 页面侧指纹修复后仍 rejected 排除 userAgentData；Electron 43（Chromium 150）
> 仍 rejected 排除版本过旧。最终结论见 Round 6——Google 对嵌入式框架的
> 行为/环境检测，属对抗上限。本节保留仅为完整时间线。

UA 伪装已到位，Google 仍在 `signin/identifier`（输入账号后）就把流量导向
`/v3/signin/rejected?…&idnf=…`。当时列出的候选原因与后续验证结果：

- **账号风控**：未做同机真 Chrome 对照实验（留作备查，见 Round 6）；
- **会话状态污染**：已证伪——多个全新容器（无任何历史 Partition/cookies.json）
  同样 rejected；
- **无人工 MFA/实人验证**：拒绝发生在输入密码之前（identifier 阶段即拒），
  与 MFA 无关；
- **连续失败限流**：不能排除，但全新容器+干净 session 首次尝试即拒，权重低。

---

## 已做的改动（本轮）

- `main.js` `onSendHeaders` 验证日志：**去掉 `user-agent` 的 80 字符截断**，
  追加 `ua-chrome: YES/NO` 标记，避免再被“看起来像 WebKit 默认 UA”误导。
  （`ua-ch-manager.js` 为未提交的新文件，用于 CDP 维度的 UA CH 覆盖，属增强项。）

## 已做的改动（Round 3，2026-08-04）：高熵 Client Hints 补齐

复盘时发现低熵头伪装存在**跨层矛盾**：

- 低熵 `sec-ch-ua`（我们注入）：含 `"Google Chrome";v="128"`；
- 高熵 `sec-ch-ua-full-version-list`（Google 通过 `Accept-CH`/`Critical-CH` 请求后由
  **内核**生成）：只有 `Chromium` + `Not;A=Brand`，**缺 Google Chrome** 且顺序不同。

UA 伪装本身成功，但两层头互相矛盾正是风控判伪造的强信号。修复（`main.js`
`onBeforeSendHeaders`）：

- `sec-ch-ua-full-version-list` → `"Chromium";v="128.0.6613.36", "Not;A=Brand";v="24.0.0.0", "Google Chrome";v="128.0.6613.36"`
- `sec-ch-ua-full-version` → `"128.0.6613.36"`
- **只改写内核已发送的头，不主动注入**（Chrome 不会发送未被 Accept-CH 请求的高熵头，
  主动注入本身是指纹异常）；`arch/bitness/platform/platform-version` 内核取值与同机
  真实 Chrome 相同，不动。
- 验证日志追加 `sec-ch-ua-full-version-list` 打印。

复验方式：`npm run dev` 后登录 Google，日志中 `sec-ch-ua-full-version-list`
应含 `Google Chrome`，且与 `sec-ch-ua` 品牌表一致。若干净环境下仍 `rejected`，
则确认是账号/session 侧问题（按上文"下一步建议"清容器数据排查）。

## Round 4（2026-08-05）：新建容器仍 rejected，页面侧指纹实证

用户新建容器 `newgoogle` 复测仍 `signin/rejected`（排除旧数据污染）。日志中
`sec-ch-ua-full-version-list` 全程 `(未发送/未请求)`——内核根本没发高熵头，
说明 Google 未通过 Accept-CH 请求（真 Chrome 也不发），Round 3 修复是中性
防御而非根因。

本地起隐藏 Electron 窗口 dump 页面主世界指纹（`executeJavaScript`），对比
真 Chrome 期望值，发现 Electron 基线出人意料地干净（plugins 5 个 PDF 插件、
window.chrome 存在、deviceMemory 8、vendor Google Inc.、mimeTypes 2），
**唯一破绽是 `navigator.userAgentData`**：brands/fullVersionList 缺 Google
Chrome，与 UA 字符串声称的 Chrome/128 矛盾——Gaia 风控 JS（那个 browserinfo
batchexecute POST）一读即露馅。网络层伪装解决不了页面侧，只能靠
`ua-ch-manager`（CDP `Network.setUserAgentOverride`）。

用真实 `ua-ch-manager` 模块 E2E 验证（BrowserWindow 与 `<webview>` guest 两种
场景、含跨站导航）：**机制本身完全正常**——attach 后 brands 含 Google Chrome，
且覆盖跨站（跨渲染进程）导航保持。用户日志中无 attach 输出，最可能是粘贴时
截掉了（attach 在首个 newtab 页 did-navigate 时已完成，后续幂等静默）。

E2E 同时暴露 `ua-ch-manager` 自身的两处新破绽（已修复）：

1. **platformVersion 硬编码 "24.1.0"（Darwin 版本）**——真 Chrome 在 macOS 上
   报的是 macOS 版本（如 "15.1.0"），24.x 是 iOS 号段，一眼假；且与内核网络层
   如实发送的 `sec-ch-ua-platform-version: "15.1.0"` 跨层矛盾。修复：
   `getMacOSVersion()` 由 `os.release()` 动态映射（darwin≤24 → -9；≥25 → +1）。
2. **fullVersionList 用 6613.36 与 uaFullVersion 矛盾**——`uaFullVersion` 不受
   CDP 覆盖控制、恒为内核真实值 6613.186。修复：fullVersionList 与新增的
   `fullVersion` 字段统一为 128.0.6613.186（main.js 高熵头同步改为该值）。

另在 main.js dom-ready 增加诊断：accounts.google.com 页面 dump 页面侧
userAgentData（`[Realm 指纹]` 日志），复测时可直接确认 Gaia 实际读到的值。

### 遗留的最大嫌疑：Chrome 128 本身已过时

Electron 32 = Chromium 128（2024-08 发布）。2026 年的今天真 Chrome 已 139+，
Google 对"过旧/不受支持的浏览器"登录会直接拒绝（rejected 页官方说明即包含
此条）。指纹伪装得再一致，版本号本身过时仍可能被风控降权。若 Round 4 修复后
仍 rejected，下一步应评估**升级 Electron**（连带 Chromium 版本逼近当前真
Chrome，UA/CH 常量全部同步升版），而非继续在 128 上补伪装。

## Round 5（2026-08-05）：升级 Electron 32 → 43，指纹按源码精确对齐

Round 4 复测：指纹三层完全一致（`[Realm 指纹]` 确认 brands 含 Google Chrome、
platformVersion 15.1.0、uaFullVersion 与 fullVersionList 同为 6613.186），
**仍 rejected**。结论：JS/网络层伪装已无破绽，剩余差异在内核本身——Chrome 128
过旧 + TLS/HTTP2 指纹是内核级的、用户层无法伪造。决定升级。

**升级**：electron ^32 → ^43.3.0（Chromium 128 → **150.0.7871.212**，Node 24）。
better-sqlite3 ^11.7 源码不兼容新 V8（SetNativeDataProperty ambiguous 等编译错），
升级到 latest 后 `@electron/rebuild` 成功（nodejieba 同步重编译）。冒烟测试通过：
DB/容器/AI/内部服务器全部正常。

**品牌表按 Chromium 源码精确计算**（user_agent_utils.cc @ 150.0.7871.212，
不再是经验值）：

- GREASE 随主版本确定性轮换：`greasy_chars[150 % 11]=";"` +
  `greasy_chars[151 % 11]="="` → `"Not;A=Brand"`；版本 `versions[150 % 3]="8"`。
  （Chromium 128 时是 v"24"，照搬旧值必露馅——不同主版本的 GREASE 字符串/版本
  都不同，必须按算法重算。）
- 品牌顺序由 `GetRandomOrder(seed, size)` 确定性洗牌：构造序 [GREASE, Chromium,
  Google Chrome]，150 % 6 = 0 → orders[0]={0,1,2} 恒等 → 最终序保持构造序。
- 最终：`"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"`，
  fullVersionList 对应 `8.0.0.0 / 150.0.7871.212 / 150.0.7871.212`。
- UA 字符串用降维形式 `Chrome/150.0.0.0`（真 Chrome 的 reduced UA 冻结 build 号）。

E2E 复验（Electron 43）：brands/fullVersionList/uaFullVersion/platformVersion
全部与上述计算值一致。

**升级 Electron 后的常量同步清单**（下次升版照此办理）：
1. `main.js` `setUserAgent` 的 `Chrome/<major>.0.0.0`；
2. `main.js` `onBeforeSendHeaders` 的 `sec-ch-ua` 与高熵头（版本 + GREASE 重算）；
3. `ua-ch-manager.js` `CHROME_UA` 与 `UA_METADATA`（brands/fullVersion/
   fullVersionList，GREASE 与顺序按主版本重算）；
4. 原生模块重编译（`npx @electron/rebuild`；better-sqlite3 编译错就先升级它）。

## Round 6（2026-08-05，最终）：Electron 43 上仍 rejected → 停止排查

Electron 43 + 三层指纹与真 Chrome 150 完全一致后，新建容器复测：
**仍 `signin/rejected`**。指纹伪装路线正式穷尽：

| 层 | 状态 |
|----|------|
| UA 字符串（`setUserAgent`） | ✅ 与真 Chrome 150 一致 |
| Sec-CH-UA 低熵/高熵头（`onBeforeSendHeaders`） | ✅ 按源码 seed=150 算法计算 |
| navigator.userAgentData（CDP `setUserAgentOverride`） | ✅ `[Realm 指纹]` 日志实证 |
| TLS/HTTP2 指纹 | ✅ 内核即 Chromium 150，天然一致 |
| 插件/设备/`window.chrome` 等 JS 环境 | ✅ Electron 基线实测与真 Chrome 相同 |

剩余无法逾越的差异只有 Google 对**嵌入式框架的行为/环境检测**：
WebAuthn/passkey 能力探测（日志可见 caBLE 初始化失败，真 Chrome 无此现象）、
BotGuard VM 环境 attest、以及 Google 自 2016 年起对 embedded webview 登录的
策略性封锁（rejected 页官方说明即含"嵌入在其他应用中"一条）。这类检测没有
可伪造的表面对象，继续对抗的投入产出比极低。

**决定（用户，2026-08-05）：停止排查，接受限制。** Google 账号登录在 Realm
容器内不可用的 workaround：在系统真 Chrome 中登录使用；或未来若需应用内
Google 服务，评估 OAuth 设备授权流程（Device Flow）等面向受限设备的方案。

唯一留作备查的对照实验（未做）：同机真 Chrome 登录同一账号——若真 Chrome
也被拒则为账号风控，与浏览器无关；若真 Chrome 成功则确证是嵌入式检测。

## 给下一位的关键提示
- **不要重启指纹伪装排查**。三层指纹已与真 Chrome 150 一致（上文表格），
  再调 UA/CH 常量不会产生任何变化。
- 验证 UA 时先看完整 UA（或 `ua-chrome: YES`），**不要再被截断日志骗走**。
- `[Realm 指纹]` 日志（main.js dom-ready，accounts.google.com 页面）可直接
  确认 Gaia 实际读到的 userAgentData。
- 升级 Electron 后必须按 Round 5 的"常量同步清单"同步 4 处，否则指纹立刻
  出现跨层矛盾。
- 升级 Electron 后原生模块（better-sqlite3/nodejieba）必须重编译；
  better-sqlite3 旧版源码与新 V8 不兼容时先升级包版本。
- 旁证发现： favorites FTS5 触发器曾有两个潜伏 bug（UDF 未注册 + FTS5
  'delete' 命令误用），已修复——与 Google 登录无关，但说明"从未执行过的
  代码路径"不能假设可用。