# Electron 32 → 43 升级记录与待观察项

> 2026-08-05 · 关联：docs/debug/google-login-ua-cover-done.md（Round 5/6）

## 版本变更

| 组件 | 升级前 | 升级后 |
|------|--------|--------|
| electron | ^32.0.0（实际 32.3.3） | ^43.3.0 |
| Chromium | 128.0.6613.186 | 150.0.7871.212 |
| Node（内核） | 20.x | 24.18.1 |
| better-sqlite3 | ^11.7.0 | latest（旧版源码与新 V8 不兼容，被迫升级） |
| nodejieba | 不变 | 重编译（ABI 匹配） |

## 随升级同步的改动

- `main.js` / `ua-ch-manager.js` 的 UA/Sec-CH-UA 常量全部按 Chromium 150 重算
  （GREASE `"Not;A=Brand";v="8"`、品牌顺序 GREASE→Chromium→Google Chrome，
  算法见调试文档 Round 5，**下次升版必须按该清单同步 4 处**）
- `favorites-manager.js`：修复两个潜伏 bug（FTS5 UDF 未注册 + 'delete' 命令误用），
  触发器改为每次启动 DROP+CREATE 无条件刷新

## 已验证（冒烟 + E2E）

- 应用启动、容器初始化、内部页面服务器、AI Manager ✅
- history.db / favorites（better-sqlite3 重编译后读写正常）✅
- FTS5 中文分词（nodejieba）insert/update/delete 触发器链路 ✅
- UA 指纹三层与真 Chrome 150 一致 ✅

## 待观察项（未完整回归，使用中留意）

- [ ] **Google 登录仍 rejected**（预期内，指纹路线已穷尽，不再投入；见调试文档 Round 6）
- [ ] webview 相关：跨 11 个大版本，webview 标签行为/事件可能有细微变化，
      留意标签页加载、新窗口拦截（setWindowOpenHandler）、will-navigate 规则跳转
- [ ] CDP 链路：`ua-ch-manager` attach / `cdp-manager` AI 工具与抓包的
      suspend/resume 协调（webContents.debugger 单客户端语义在 43 上未专项回归）
- [ ] AI 工具执行（fill_form 等 CDP Input 命令在新内核上的行为）
- [ ] 快捷键注册（globalShortcut）与应用菜单
- [ ] Cookie 持久化（cookie-manager session ↔ cookies.json 合并）
- [ ] 偶发 SSL `handshake failed; net_error -100`：用户环境出现过一阵，
      初判与升级无关（ML-KEM 自 Chromium 124 起默认开启）；**若持续集中在
      某域名出现需排查**（可能是中间网络设备与新 TLS 指纹的兼容性）
- [ ] 生产构建未验证：`npm run build:mac`（electron-builder 24 对 Electron 43
      的支持）未跑过，发版前必须先验证
- [ ] Node 24 的 DEP0180（fs.Stats）弃用警告，无害，后续清理
- [ ] `npm audit` 报 12 个漏洞（11 high 1 critical），本次未处理
