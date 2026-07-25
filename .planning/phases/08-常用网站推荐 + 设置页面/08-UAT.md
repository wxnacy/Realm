---
status: complete
phase: 08-常用网站推荐 + 设置页面
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-07-25T12:27:38Z
updated: 2026-07-25T13:47:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出应用后重新启动，启动无报错，新标签页（realm://newtab）正常加载渲染
result: pass
note: "初次报告网格样式问题（未居中/长标题溢出），修复 main.css 后用户验证通过"

### 2. 新标签页展示常用网站网格
expected: 打开新 Tab，页面展示"常用网站"网格（最多 6x2=12 个），按 frecency（访问频率×时间衰减）排序，最常访问的网站排在前面；若无历史记录则显示空状态提示
result: pass

### 3. 常用网站 favicon 与降级
expected: 常用网站卡片显示对应网站的 favicon 图标；图标加载失败时降级显示域名首字母
result: pass
note: "降级目标经用户决定改为应用图标：/api/frequent-sites/favicon 代理识别 Google 默认地球图后回退 icons/icon.png，重启验证通过"

### 4. 点击常用网站卡片导航
expected: 点击任一常用网站卡片，当前 Tab 直接导航到对应网站页面
result: pass

### 5. 新标签页搜索框
expected: 在搜索框输入完整 URL（如 example.com）回车 → 直接导航到该网站；输入关键词回车 → 跳转 Google 搜索结果页
result: pass
note: "初次报告裸域名被当搜索词，补 normalizeUrl 对齐地址栏逻辑后验证通过"

### 6. 工具栏设置按钮打开设置页面
expected: 点击工具栏的设置按钮，在新 Tab 中打开设置页面（realm://settings）；重复点击时切换到已存在的设置 Tab 而不是重复打开
result: pass
note: "初次报告按钮在左下角且图标非齿轮，移至工具栏末尾并换齿轮图标后验证通过"

### 7. 设置页面读取配置
expected: 设置页面正确显示当前配置：历史记录保留天数、默认容器选项（容器列表动态加载）
result: pass
note: "初次报告容器列表为空（/api/containers/list 端点缺失），补端点后验证通过"

### 8. 设置保存并生效
expected: 修改历史记录保留天数或默认容器，保存后出现 Toast 提示；重新打开设置页面，修改后的值被正确保留
result: pass

### 9. 默认浏览器引导
expected: 设置页面显示当前是否为默认浏览器；若未设为默认，显示引导按钮，点击后系统弹出默认浏览器设置流程
result: pass
note: "初次报告注册 realm:// 协议造成假象，改为 http+https 触发系统弹框后验证通过"

### 10. 关闭所有 Tab 自动创建新标签页
expected: 关闭最后一个 Tab 时，应用自动创建一个新 Tab（realm://newtab），窗口保持打开而不是关闭或空白
result: pass

### 11. 外部链接在新 Tab 打开
expected: 当 Realm 已是默认浏览器时，从外部应用（如终端 `open https://example.com` 或其他应用点击链接）打开链接，Realm 在当前容器的活动窗口中以新 Tab 打开该链接
result: pass
note: "初次报告固定容器不生效 + 哨兵值撞名，主进程 open-url 消费设置并改 'last-used' 后验证通过"

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "新标签页常用网站网格居中展示，长名称省略，所有卡片图标完整可见"
  status: resolved
  reason: "User reported: 样式太难看了，没有居中，并且名字一长右边的图标都没有展示全，名称做下省略，调整下样式"
  severity: major
  test: 1
  root_cause: "grid 轨道 repeat(6, 1fr) 等价于 minmax(auto, 1fr)，nowrap 长标题把轨道撑破导致网格溢出容器；卡片 min-width: auto 不允许收缩；标题省略号因父级不约束宽度而失效"
  resolution: "2026-07-25 修复 main.css（minmax(0,1fr) 轨道 + 卡片 min-width: 0 + 标题 width: 100%），用户刷新验证通过"

- truth: "无 favicon 的网站应降级显示应用图标，而非 Google 默认地球占位图"
  status: resolved
  reason: "User reported: 无 favicon 的网站（如 mbd.baidu.com）显示的是 Google favicon 服务的默认地球占位图，不像 icon 也不是首字母；用户决定统一使用软件本身 icon"
  severity: major
  test: 3
  root_cause: "google.com/s2/favicons 对无图标域名返回 404 + 有效 PNG 地球占位图，浏览器可解码即显示，不触发 onerror，首字母降级逻辑失效"
  resolution: "2026-07-25 实现 /api/frequent-sites/favicon 代理（识别默认地球 md5/非 200 回退应用图标，内存缓存），前端改指代理 API，用户重启验证通过"

- truth: "搜索框输入裸域名（baidu.com）应补全 https:// 直接导航，与地址栏逻辑一致"
  status: resolved
  reason: "User reported: 输入 baidu.com 没有导航到 https://baidu.com 而是进入 google 搜索，应该跟地址栏一个逻辑才对"
  severity: major
  test: 5
  root_cause: "newtab-page.js 搜索框仅识别 http(s):// 前缀，裸域名被当作搜索词；未复用地址栏 normalizeUrl 的域名模式判断"
  resolution: "2026-07-25 newtab-page.js 新增 normalizeUrl（与 renderer.js:189 地址栏逻辑一致），回车统一走该函数，用户刷新验证通过"

- truth: "设置按钮应在工具栏可见，图标为齿轮"
  status: resolved
  reason: "User reported: 工具栏没看到设置按钮，只点击窗口左下角的按钮才进入的页面，并且按钮图标也不是"齿轮""
  severity: major
  test: 6
  root_cause: "settingsBtn 被放在侧栏底部 .sidebar-footer 而非工具栏 .toolbar-right，且 SVG 为准星图案而非齿轮"
  resolution: "2026-07-25 settingsBtn 移至 toolbar-right 末尾并换用标准齿轮 SVG，删除 sidebar-footer 及其 CSS，用户验证通过"

- truth: "设置页面默认容器下拉应动态加载容器列表"
  status: resolved
  reason: "User reported: 默认容器选项只有"使用上次打开的容器"没有容器列表"
  severity: major
  test: 7
  root_cause: "settings-page.js 调用的 /api/containers/list 端点在 main.js 中从未实现，请求 404 后前端 catch 静默返回空数组，只渲染默认选项"
  resolution: "2026-07-25 main.js 新增 handleContainersApi + /api/containers/ 路由（list 返回 containerManager.getContainers()），用户重启验证通过"

- truth: "点击设为默认浏览器应触发 macOS 系统确认弹框，确认后真正生效"
  status: resolved
  reason: "User reported: 点击直接显示 realm 已经是默认浏览器，但其实没有生效。期望出现系统确认弹框"
  severity: major
  test: 9
  root_cause: "实现注册的是 realm:// 自定义协议而非 http/https，无法成为默认网页浏览器且静默成功；前端收到 success 立即标记'已是默认浏览器'造成假象"
  resolution: "2026-07-25 is/set-default-browser 改为 http+https（触发系统弹框），前端改为提示确认并延迟 3s 重查状态，用户验证通过"

- truth: "默认容器设置固定容器时，外部链接应在指定容器打开"
  status: resolved
  reason: "User reported: 选择使用"使用上次打开的容器"时是正确打开的。但是选择某个固定容器，不生效。打开网页还是在上次打开容器中打开"
  severity: major
  test: 11
  root_cause: "open-url 链路完全未消费 defaultContainer 设置，一律在当前容器打开；且'使用上次打开的容器'哨兵值 'default' 与内置容器 id 撞名，下拉里两项 value 相同无法区分"
  resolution: "2026-07-25 主进程 open-url 读取设置并发送 {url, containerId}，renderer 按 containerId 建 Tab；哨兵值改为 'last-used'，用户重启验证通过"
