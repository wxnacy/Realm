# API Coverage — Phase 44

No external API integration: 本阶段只与本地媒体流（HLS m3u8/TS，经既有 `/proxy` 127.0.0.1 代理回源）和 Electron/Node 内置能力交互；新增的 `/api/tasks/*`、`/player` 均为本机 realmServer 内部端点（REALM_TOKEN 鉴权），唯一新依赖 mux.js 是纯 JS 转封装库（非 API/服务，package-legitimacy 已验证 OK）。
