# 容器删除时 Partitions 目录未完全清理

**状态：** 已修复（待 UAT 回归验证）
**发现时间：** 2026-07-24
**修复时间：** 2026-07-24
**相关文件：** cookie-manager.js, container-manager.js, main.js, src/renderer.js

## 问题描述

删除容器时，`~/Library/Application Support/realm/Partitions/container-{id}/` 目录未被删除，或删除后被自动重建。

## 根本原因（经三轮排查确认）

### 第一层：存活 webview 持有句柄

删除容器时渲染进程从未关闭该容器下的 Tab/webview，存活 guest 进程持有目录句柄并持续写入，`rmSync` 后被重建；且 `clearStorageData()` 未 await 存在竞态。

### 第二层：InterestGroup 存储（FLEDGE/Privacy Sandbox）

第一层修复后目录能删掉但过会儿重建，内容为 `InterestGroups` SQLite 库 + WAL（173KB）。页面广告脚本调用 `navigator.joinAdInterestGroup()`，数据由 **Chromium 网络服务进程**写入；Electron 32 `clearStorageData()` 的 storages 仅 7 种，不含 interest groups。

### 第三层：网络服务核心组件（架构限制，运行中不可根治）

禁用 FLEDGE 后再次实测，重建内容变为 `Cache/`（HTTP 缓存索引）、`Code Cache/`（JS 字节码缓存索引）、`Network Persistent State`（HTTP/2/QUIC 服务器属性，含浏览过的域名元数据）。这些是 Chromium 网络服务为**每个存活 session** 维护的核心组件：

- `session.fromPartition()` 创建的 session 在 Electron 进程内**永久存活**，无销毁 API
- 这些组件不能用 disable-features 禁用（除非全局禁用 HTTP 缓存）
- 只要进程活着，就会定期/事件驱动地为已删容器刷盘重建目录

**结论：运行期间目录重建无法阻止；进程退出后无人能重建，此时删除即永久。**

> 注：第二轮测试时修复代码曾被 `git stash`（"local changes before merge"）移出工作区，测试实际跑的是原始代码。已用 `git stash apply` 恢复（stash@{0} 仍保留备份，确认无误后可 drop）。

## 最终修复方案（六层）

1. **禁用 Privacy Sandbox 广告 API**（main.js，app ready 前）：`disable-features=InterestGroupStorage,Fledge,PrivacySandboxAdsAPIs,Topics,AttributionReporting,SharedStorage`。源头阻止 InterestGroups 写入，附隐私收益。
2. **渲染进程先销毁 webview**（src/renderer.js `confirmDeleteContainer`）：删除容器前关闭该容器所有 Tab，guest 进程退出释放句柄。
3. **主进程全程 await**（container-manager.js `deleteContainer`）：`await clearStorageData()` 刷盘完成后再删文件。
4. **删除前等待句柄释放**（cookie-manager.js `deleteCookies`）：`rmSync` 前等待 300ms；运行中这次删除会清掉 Cookie/缓存等全部数据（此后网络服务重建的只是空索引壳，无凭证无内容）。
5. **退出时物理删除**（main.js `before-quit`，关键层）：`app.quit()` 前调用 `cleanupOrphanPartitions`，网络服务进程随退出终止，删除即永久。
6. **启动时兜底清理**（main.js `whenReady` + cookie-manager.js `cleanupOrphanPartitions`）：`initContainers` 之前扫描 `Partitions/`，删除所有不在配置中的 `container-*` 目录，双保险。

## 预期行为（UAT 验收标准修正）

- 运行中删除容器：Cookie/登录态/缓存**数据立即清除**；目录可能以空壳形式暂时重建（仅空缓存索引 + 网络元数据），这是架构限制
- **退出应用后：目录物理删除，永久消失**
- 重新创建同名容器：无旧 Cookie/登录态残留
