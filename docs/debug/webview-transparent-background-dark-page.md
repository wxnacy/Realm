# 部分网站整页漆黑排查实录（webview 透明背景透出窗口底色）

> 2026-08-16 · Realm Browser · 影响文件：`src/styles/main.css`（一行 CSS 修复）

## 现象

在 Realm Browser 中打开部分网站（如 `https://api-docs.deepseek.com/zh-cn/quick_start/pricing/`），
整页渲染为漆黑背景：正文文字不可见（深色文字落在深色背景上），只剩蓝色超链接、白色表格边框
隐约可见；同一网址在其他浏览器（Chrome/Safari）中正常显示浅色模式，且网站右上角主题切换按钮
显示当前为浅色模式。

**特征**：只有"一些网站"中招，多数网站（B 站、GitHub 等）显示正常。

---

## ✅ 结论（2026-08-16 修复并验证）

**根因**：不是主题问题，也不是加载问题，是**合成底色问题**——

1. 中招网站的正文区域（`html`/`body`/`#__docusaurus`/`main`）**不显式设置背景色**
   （实测均为 `rgba(0, 0, 0, 0)`），依赖浏览器默认的白色画布兜底；
2. Electron 的 webview guest **默认背景是透明的**——普通浏览器在透明页面底下垫白色画布，
   所以正常；
3. Realm 主窗口设置了 `backgroundColor: '#1a1a1a'`（`window-manager.js:144`），
   `.browser-view` 容器也是深色（`--bg-primary`）→ 页面透明区域直接透出深色窗口底色，
   正文深色文字"消失"。

即：页面确实处于浅色主题（guest 实测 `data-theme="light"`、
`matchMedia('(prefers-color-scheme: dark)').matches === false`），黑的不是主题，是"底板"。

**为什么只有部分网站中招**：绝大多数网站会显式给 `body`/`html` 画背景色，盖住窗口底色；
只有少数依赖默认白底的网站（如该 Docusaurus 站点——实测只有 `nav.navbar` 显式白底、
`footer` 显式深灰底，正文区全透明）会透出黑色。

**修复**（`src/styles/main.css`）：

```css
/* webview guest 默认背景透明，会透出窗口深色底色（window-manager.js backgroundColor: #1a1a1a），
 * 导致不显式设置背景的网页（如部分 Docusaurus 站点）正文区变漆黑。显式白底对齐普通浏览器行为。 */
.browser-view webview {
  background: #ffffff;
}
```

白色只是"兜底画布"：网页自身背景不透明时会完全盖住它——深色主题网站依然深色，不受影响。
可预期副作用：页面加载完成前 webview 区域短暂显白而非黑色（与 Chrome 加载白闪行为一致）。

**验证**：playwright `_electron` 驱动 dev 应用实测（脚本见下文"验证方法"）——

| 状态 | 结果 |
|------|------|
| 修复前截图 | 与用户的 ds-error 截图完全一致（正文漆黑、导航栏白底割裂） |
| 给 webview 加白底后截图 | 页面恢复完整浅色渲染，与正常浏览器一致 |
| 用户复测 | ✓ 显示正常 |

---

## 排查过程

### 第一轮：代码全局搜索（排除 6 类嫌疑）

对代码库彻底搜索后逐一排除：

| 嫌疑点 | 结论 |
|--------|------|
| `nativeTheme.themeSource` 强制 dark | 代码中从未设置，默认 `system` |
| `Emulation.setEmulatedMedia`（CDP 模拟深色） | 未使用 |
| UA Client Hints 携带 `Sec-CH-Prefers-Color-Scheme` | `ua-ch-manager.js` 的 `UA_METADATA` 不含偏好类 hint；`onBeforeSendHeaders` 只改写 `sec-ch-ua` 族 |
| webview `darkTheme` 属性 / 命令行 `force-dark-mode` | 均未使用 |
| `insertCSS` 注入样式 | 零命中 |
| `webRequest` 改响应头 | 无 `onHeadersReceived` |

### 第二轮：系统外观与 per-app 覆盖（排除）

- `defaults read -g AppleInterfaceStyle` → macOS 处于**浅色**模式，`themeSource: system` 应判 light；
- `Realm.app/Contents/Info.plist` 有 `NSRequiresAquaSystemAppearance = false`
  （electron-builder `darkModeSupport` 构建产物），表示"支持跟随系统深色"——系统浅色时不构成影响。

### 第三轮：playwright `_electron` 实测（定位根因）

驱动 dev 应用，从主进程拿到 webview guest 并加载问题页面，`executeJavaScript` 取证：

```
[main]  nativeTheme: themeSource=system, shouldUseDarkColors=false
[host]  prefers-color-scheme dark = false
[guest] darkMQ=false, dataTheme="light", bodyColor=rgb(28,30,33)（浅色主题深色文字）
        html/body/#__docusaurus/main 背景 = rgba(0,0,0,0)  ← 全透明
        nav.navbar = rgb(255,255,255)（显式白底），footer = rgb(48,56,70)（显式深灰底）
```

**关键一击**：页面处于浅色主题、文字是深色，但正文区背景全透明——漆黑的来源只剩
"guest 底下的东西"，即深色窗口底色。截图证实修复前画面与用户截图一致，给 webview 元素
加白底后立即恢复正常。

### 网站侧机制（curl 取证）

该站点为 Docusaurus v3，内联脚本 `data-theme` 默认 `"light"`（无 localStorage 时），
hydration 后按配置跟随 `prefers-color-scheme`。本案例中媒体查询始终为 light，
主题链路无任何异常——进一步佐证问题不在主题判定。

---

## 🎯 关键点

- **Electron webview guest 默认背景透明**，普通浏览器垫白画布、Realm 垫的是深色窗口底色。
  排查"网页整体偏色/发黑"类问题时，优先用 `executeJavaScript` 读
  `getComputedStyle(document.body).backgroundColor`——若为 `rgba(0,0,0,0)` 即中招。
- **窗口 `backgroundColor` 不只是"启动闪屏色"**：webview/BrowserView 透明时会透出它，
  改它需要评估对所有嵌入式内容的视觉影响。
- **"主题切换按钮显示浅色"不代表页面处于浅色渲染异常**：本次实测 guest 的 `data-theme`、
  `prefers-color-scheme` 全部正常，问题完全在合成层。先取证（computed style）再下结论，
  避免在主题/UA/指纹方向空转。

## 验证方法（可复现）

playwright `_electron` 驱动 dev 应用（方法详见 memory：renderer 顶层变量不在 window 上、
窗口选择要过滤 devtools、`process.exit(0)` 退出）：

```js
// 主进程侧取 guest 并取证
const guest = webContents.getAllWebContents().find(wc => wc.getType() === 'webview');
await guest.loadURL('<问题页面>');
await guest.executeJavaScript(`(() => ({
  darkMQ: matchMedia('(prefers-color-scheme: dark)').matches,
  dataTheme: document.documentElement.getAttribute('data-theme'),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  bodyColor: getComputedStyle(document.body).color,
}))()`);
```

修复验证：host 窗口 `document.querySelectorAll('webview').forEach(wv => wv.style.background = '#fff')`
后截图对比。

---

## 相关文件

- `src/styles/main.css`：`.browser-view webview { background: #ffffff }`（本次修复）
- `window-manager.js:144`：主窗口 `backgroundColor: '#1a1a1a'`（透出底色的来源，未改动）
- `src/renderer.js:870`：webview 元素创建处（所有 webview 都挂在 `#browserView` 下，CSS 全覆盖）
