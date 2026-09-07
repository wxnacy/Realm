# 导航入口清单（Navigation Entry Points）

> **维护约定（重要）**：本文档是 Realm 浏览器所有"加载一个 URL"入口的唯一权威清单。
> **以后新增任何导航入口、或修改导航/分配规则/容器决策相关功能时，必须同步更新本文档，
> 并确认新入口与其他入口的行为一致**（规则匹配、URL 规整、m3u8 转换、tab 归属）。
> 不要让"收藏栏点击绕过分配规则"这类入口间行为分裂问题再靠手动发现。
>
> 行号截至 2026-09-04（openUrl 统一入口落地日），仅作辅助定位；以函数名为准。

## 一、统一导航入口 openUrl（已落地，2026-09-04）

renderer 侧所有"加载一个 URL"的入口收敛到 **`openUrl(url, options)`**（src/renderer.js，createTab 之前）：

```js
openUrl(url, {
  disposition: 'current-tab' | 'new-tab' | 'background-tab',  // 缺省 current-tab
  sourceTabId,            // current-tab 宿主 tab（缺省 state.activeTabId）
  explicitContainerId,    // 用户显式选容器，优先于规则
  bypassRules,            // 显式跳过规则
})
```

**流水线（顺序固定）**：normalizeUrl 归一化 → WR-9 白名单（http(s)/realm/file/view-source:http(s)，拒绝 javascript: 等）→ 内部 URL 豁免（realm://、file://、view-source:、内部 localhost 页面不查规则）→ 分配规则匹配（`realmAPI.matchRule`，即 ipc-handlers.js `rule:match`）→ 竞态守卫（`state.navSeq`：连续导航只让最后一次生效，过期直接丢弃）→ 容器决策（**explicitContainerId > 规则匹配 > 来源 tab 容器(current-tab) / 当前容器(new/background-tab)**）→ disposition 分支执行。

**行为语义**：
- `current-tab`：命中规则且目标容器 ≠ 来源 tab 容器 → **取消当前加载，在匹配容器新建 tab（前台切换），原 tab 保持不动**（与主进程 will-navigate 规则重定向一致；技术约束：当前 webview partition 绑定来源容器，不能跨容器加载）
- `new-tab`：createTab 前台切换
- `background-tab`：createTab 后焦点切回原 tab
- URL 规整由执行层承接：createTab 路径经 `createWebviewForTab`（scheme 白名单 → realmUrlToHttp → maybePlayerUrl）；current-tab 路径经 `navigateCurrentTab`（realm 转换 + m3u8 包装 + loadURL + tab.url 存原始 URL + updateTab）

**主进程发起的导航**（AI open_link、OS open-url）经 `open-url-in-tab` / `open-external-url` 通道落到 renderer 的 openUrl 链路，主进程发送前先 `assignmentRules.matchUrl` 解析容器（AI open_link newTab=false 命中其他容器时不发起 wc.loadURL，改发 open-url-in-tab）。guest 页面内导航保持 will-navigate / setWindowOpenHandler 拦截链路不变。

**规则匹配生效范围（迁移后）**：所有 http(s) 入口均查规则；内部 URL、显式容器、bypassRules 豁免；快照恢复类入口不入漏斗（见第四节）。

## 二、已迁移到 openUrl 的入口（✅ 规则生效）

| 入口 | 位置 | openUrl 调用 |
|------|------|-------------|
| 地址栏回车（有活动 tab） | renderer.js `urlInput` keydown | `current-tab` |
| 地址栏回车（无活动 tab） | 同上 | `new-tab` |
| 自动补全选中（`selectAutocompleteItem`，有/无 tab） | renderer.js | `current-tab` / `new-tab` |
| 新标签页搜索框回车 | renderer.js `newTabSearch` keydown | `new-tab` |
| 收藏栏收藏项普通点击（`handleBookmarkClick`） | src/bookmarks-bar.js | `current-tab` |
| 收藏栏 Cmd/Ctrl+点击 | src/bookmarks-bar.js | `new-tab`（规则命中时建到匹配容器——**预期行为变化**，原固定当前容器） |
| 菜单内收藏项点击（`_handleMenuBookmarkClick`） | src/bookmarks-bar-menu.js | `current-tab` / Cmd+点击 `new-tab` |
| 网页右键「在新标签页打开」 | renderer.js `context-menu:open-in-new-tab` | `new-tab` |
| 网页右键「后台标签打开」 | renderer.js `context-menu:open-in-bg-tab` | `background-tab` |
| 网页右键「在指定容器打开」 | renderer.js `context-menu:open-in-container` | `new-tab` + `explicitContainerId`（显式优先于规则） |
| Vim hint F 后台打开（`openInBgTab`） | renderer.js | `background-tab` |
| AI 聊天消息链接点击 | renderer.js aiMessageList click | `new-tab` |
| 收藏项右键「在新标签页打开」 | renderer.js `bookmarks-bar:navigate` IPC | `new-tab` |
| 收藏「全部打开」 | renderer.js `bookmarks-bar:open-all` IPC | 循环 `background-tab` + `explicitContainerId: 当前容器`（整组收藏不拆容器），完成后切到首个新 tab |
| OS 外部链接（SETT-03） | renderer.js `onExternalUrlOpen` | `new-tab` + `explicitContainerId: data.containerId`（null='last-used' → 漏斗内查规则） |
| guest window.open 拦截转发（D-09） | renderer.js `handleOpenUrlInTab` | 容器三级解析段（规则结果 > guestId 反查 partition > currentContainer）原样保留，末尾改 `new-tab` + `explicitContainerId: 解析结果`（主进程已 matchUrl，null 时漏斗内兜底再查） |
| 主窗口媒体任务角标点击（Phase 44 D-26） | renderer.js `initMediaTaskBadge` | `current-tab`（`openUrl('realm://tasks')`；无活动 tab 时自然落到 new-tab 分支；realm:// 内部 URL 豁免规则匹配，无容器参数） |
| 设置页多媒体分区「任务列表」按钮（Phase 44 D-26） | src/settings-page.js `mediaTasksListBtn` | guest `window.open('realm://tasks', '_blank')` → main.js `setWindowOpenHandler` → `handleOpenUrlInTab` → `new-tab`（realm:// 内部 URL 豁免规则匹配，tab 归属来源容器，无容器参数） |

## 三、主进程入口（✅ 已接入规则）

| 位置 | 场景 | 行为 |
|------|------|------|
| ai-manager.js `open_link` newTab=true | AI 工具新标签打开 | containerId 未指定时先 `matchUrl`（命中且容器存在 → 匹配容器）；窗口选择改为**聚焦受管窗口优先**（`getFocusedWindow` + `isManagedWindow`），fallback `getMainWindow()`（修复多窗口发错窗口） |
| ai-manager.js `open_link` newTab=false | AI 工具当前页导航 | `wc.loadURL` 前 `matchUrl`，命中其他容器 → **不发起加载**，改发 `open-url-in-tab`（返回 `redirected: true`）；未命中/命中当前容器维持 loadURL |
| main.js `app.on('open-url')` | OS 级 realm:// 协议唤起 | `getFocusedWindow() \|\| getMainWindow()` fallback（修复无聚焦窗口静默丢弃）；固定默认容器照传（显式优先），'last-used' 传 null → renderer 漏斗内查规则 |

## 四、不入漏斗的入口（保持原样，附理由）

| 入口 | 位置 | 理由 |
|------|------|------|
| restoreTabs 会话恢复 | renderer.js:3387 | 恢复语义：URL+容器是关闭时快照，重定向违背预期 |
| Vim duplicateTab | renderer.js:2930 | 复制当前 tab（同容器同 URL）语义明确 |
| 重开已关闭 tab | renderer.js:2645/3461 | 关闭时快照恢复 |
| goBack / goForward / reload | renderer.js:1973/1979/1985 等 | 历史栈操作，不产生新 URL 决策 |
| 容器切换建空 tab | renderer.js `handleContainerSwitched` | 无 URL 可匹配 |
| 收藏栏「导入」按钮复用 favorites tab | bookmarks-bar.js:196 | realm:// 内部页 + 复用 tab 特殊语义 |
| guest 页面内链接/表单/location | main.js:537 `will-navigate` | 主进程拦截链路已生效规则，保持不动 |
| guest `window.open` / target=_blank | main.js:491 `setWindowOpenHandler` | 同上（realm:// 内部页间跳转如 settings-page.js:1273 走此路） |
| 独立/工具窗口 loadURL | ipc-handlers.js:1936 `media:play`、search-manager.js:1101 等 | 与 tab 分配无关 |

## 五、m3u8 双实现说明（有意保留两份）

- renderer 版 `maybePlayerUrl`（renderer.js:385）：URL 预包装，openUrl/createWebviewForTab 链路用
- 主进程版（main.js:549-573 will-navigate 内联）：导航事件流拦截，preventDefault 后 setImmediate 延迟 loadURL（防 ERR_FAILED），多 referer 防盗链参数
- 运行上下文与时机不同，**不合并**；两处注释互引，改动时两份同步
- 包装出的 webview tab 播放器页面直连拉流，不走 /proxy（G-44-2 修复，D-01）；仅独立播放器窗口经 /proxy（分片缓存仅此链路）

## 六、历史问题存档（openUrl 落地前的不一致点，已全部修复）

1. 收藏栏点击/地址栏回车（loadURL）静默绕过分配规则 → 已收敛 openUrl
2. 「新标签页打开」语义分裂（window.open 查规则、renderer createTab 不查）→ 已统一
3. AI open_link 完全绕过 + 多窗口发错窗口 → 已接 matchUrl + 聚焦窗口优先
4. 两个「新标签页搜索框」行为不同（overlay 不查规则 vs newtab guest 查规则）→ 已统一
5. Vim hint 两模式规则行为不一致 → 已统一（后台打开也查规则）
6. OS open-url 无聚焦窗口静默丢弃 → 已加 fallback

## 七、回归验证

```bash
node tests/test-unified-navigation.js   # 32 项断言，playwright _electron 驱动真实 dev 应用
```

覆盖：规则命中其他容器（current-tab → 匹配容器新建 tab、原 tab 不动）、命中当前容器、未命中、显式容器优先、realm:// 豁免、m3u8 原始 URL 持久化、background-tab 焦点切回、seq 竞态守卫、bypassRules、地址栏回车与收藏栏点击 UI 链路、matchRule IPC 链路冒烟。

**新增/修改导航入口时的检查清单**：
- [ ] 入口是否收敛到 openUrl（或属于第四节豁免类，理由已记录）
- [ ] 本文档是否已更新（位置、触发场景、openUrl 参数）
- [ ] `node tests/test-unified-navigation.js` 是否全绿
