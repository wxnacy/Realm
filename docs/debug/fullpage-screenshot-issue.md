# 全页面截图问题排查记录

## 问题描述

AI 工具的 `screenshot` 操作在 `fullPage: true` 时，截图结果不是真实的全页面内容，而是当前视口内容的重复拼接。

**期望效果**：截取从页面顶部到底部的完整内容
**实际效果**：当前视口内容被重复拼接，不是真实的全页面内容。例如"五大焦点看点"区域只有第一行数据正确，下方内容缺失。

## 根因分析

### 根因 1：CDP `captureBeyondViewport` 在 Electron webview 中不工作

Electron webview 的 guest WebContents 中，`Page.captureScreenshot({ captureBeyondViewport: true })` 无论是否配合 `Emulation.setDeviceMetricsOverride`，截图结果都是当前可见视口的内容被重复填充到 clip 区域。这是 Electron webview 的实现限制，与 Chromium 版本无关。

### 根因 2：Canvas 尺寸超限导致截断

即使改用滚动拼接方案，拼接用的 HTML5 Canvas 有浏览器硬性限制（最大 16384x16384）。`webContents.capturePage()` 返回的是**物理像素**（已乘 DPR），当 DPR=2 且 CSS 页面高度为 10000 时，canvas 高度 = 20000，超出限制，导致底部内容被静默截断。

### 根因 3：懒加载内容在初始测量时未渲染（部分页面成立）

页面中的某些组件依赖 IntersectionObserver，只有滚动进入视口后才会渲染完整内容；基于初始 `scrollHeight` 计算截图范围时，这些组件的高度在截图过程中还会动态增加。

> 注：此条仅对确实含懒加载的页面成立。第五次修复用**纯静态测试页**（无任何 JS）复现后发现，静态页也出现同样的"末尾重复"，说明真正的根因是下方的根因 4（滚动钳制错位），而非懒加载。前几次修复的预滚动/等待只是碰巧改变了高度与时序。

### 根因 4：最后一段滚动钳制错位（真正根因）

当 `scrollHeight` 不是 `clientHeight` 整数倍时，最后一段计划滚动位置 `(steps-1)*clientHeight` 超过最大滚动位置 `scrollHeight - clientHeight`，`scrollTo` 被浏览器静默钳制到页面底部；而拼接时仍把该截图的**顶部**画到计划偏移处，导致末尾重复前面内容、真实底部丢失。详见下方"第五次修复"。

## 修复迭代过程

### 第一次修复（2026-08-26）：改用滚动拼接

**思路**：放弃 CDP `captureBeyondViewport`，改用滚动页面 + 逐视口截图 + Canvas 拼接。

**实现**：
- 新增 `captureFullPageByScrolling()`：获取页面尺寸 → 逐视口 `capturePage()` → 收集 Data URL
- 新增 `stitchScreenshots()`：创建 offscreen BrowserWindow → 用 HTML5 Canvas `drawImage` 垂直拼接 → `toDataURL()` 导出

**结果**：重复拼接问题消失，但出现新 bug —— 底部内容（第三屏"五大焦点看点"）不完整。

### 第二次修复（2026-08-26）：预滚动触发懒加载 + 增加等待时间

**思路**：截图前先滚动到底部触发懒加载，重新测量 `scrollHeight`；每次滚动后多等待一会儿。

**修改**：
- 预滚动到底部：`window.scrollTo(0, scrollHeight)` + 等待 1s + 触发 `scroll` 事件
- 重新测量 `scrollHeight`
- 每次截图滚动后等待从 200ms 延长到 500ms

**结果**：懒加载问题有所改善，但 canvas 超限导致截断的问题浮出水面。

### 第三次修复（2026-08-26）：根据 canvas 限制反推最大 CSS 高度

**思路**：在截取第一张截图、知道物理像素尺寸后，根据 `MAX_CANVAS_DIMENSION * clientHeight / screenshotHeight` 反推允许的最大 CSS 高度并截断。

**修改**：
```javascript
const maxCSSHeightByCanvas = Math.floor(
  MAX_CANVAS_DIMENSION * metrics.clientHeight / screenshotHeight
);
if (totalHeightCSS > maxCSSHeightByCanvas) {
  totalHeightCSS = maxCSSHeightByCanvas;
}
```

**结果**：不再报 canvas 超限错误，但对于高 DPR 屏幕（如 DPR=2），总 CSS 高度被截断到约 8192，超长页面底部仍然缺失。

### 第四次修复（2026-08-26）：超限时临时降低缩放因子

**思路**：不再截断 CSS 高度。第一张截图后若预测 canvas 高度超 16384，按 `MAX_CANVAS_DIMENSION / 预测高度 × 0.98` 的比例临时调低 `webContents.setZoomFactor`（下限 0.25），让完整页面高度等比缩小进 canvas 限制内。内容完整保留，代价是整体分辨率降低。原截断逻辑降级为兜底（缩放已到下限仍超限的极端情况）。

**实现要点**：
- zoom 改变布局视口尺寸（`clientHeight` 变大），调整后必须重新测量 `clientHeight`/`scrollHeight` 并重截第一张，后续滚动步进全部用新值
- `finally` 中恢复 `setZoomFactor(originalZoomFactor)` 和滚动位置，异常路径也覆盖
- 懒加载预滚动移到 zoom 调整之后，预滚动后的高度兜底截断仍保留（缩放余量 2% 之外的极端增长才触发）

**结果**：DPR=2 下 ~10000 CSS px（约 11 屏）的页面可完整截取，缩放因子约降到 0.8；不再截断底部。

### 第五次修复（2026-08-26）：最后一段滚动钳制错位（真正根因）

**背景**：用纯静态测试页（无任何 JS/懒加载）复现时，"五大焦点看点"第一行之后拼接的竟是重复的时间线内容。独立 Electron 复现脚本带滚动 readback 日志，抓到关键证据：

```
[seg 4] scrollTo=2800 readback=2172   ← 滚动被浏览器静默钳制
```

**真正根因**：当 `scrollHeight` 不是 `clientHeight` 整数倍时，最后一段计划滚动位置 `(steps-1)×clientHeight` 超出最大滚动位置 `scrollHeight - clientHeight`，`scrollTo` 被静默钳制，拍到的是**页面底部视口**；但拼接时仍把这张截图的**顶部**画到计划偏移处 → 末尾出现前面内容的重复，真实底部永远丢失。只要页面高度不是视口整数倍就必现（即几乎所有页面）。

此前第一版滚动拼接就有此 bug，第二/三次修复的"懒加载 IntersectionObserver"诊断对静态测试页并不成立——懒加载预滚动只是碰巧改变了页面高度/时序，没有触及根因。

**修复**（两处配合）：
1. 滚动循环：`scrollCSS = min(i×stepCSS, totalHeightCSS - clientHeight)`，最后一段锚定页面底部
2. `stitchScreenshots`：最后一段从顶部对齐改为**底部对齐**——取截图的底部 `drawHeight` 区域画到末尾

**验证**：独立脚本复现 → 修复后 `seg 4 scrollTo=2172 readback=2172`，拼接图三行焦点卡片 + footer 完整、无重复。

## 当前状态

**已修复（2026-08-26，第五次修复定位真正根因）。**

- **普通截图（非 fullPage）**：正常，仍使用 CDP `Page.captureScreenshot`
- **全页面截图**：
  - 不再有重复拼接问题（根因：最后一段滚动钳制错位，已改为底部锚定截取 + 底部对齐拼接）
  - 不再有 canvas 超限报错
  - **超长页面不再截断**：超 16384 物理像素时临时降低缩放因子等比缩小（第四次修复）
  - 极端情况（缩放已到下限 0.25 仍超限，即约 30000+ CSS px）仍走兜底截断

## 遗留问题（待后续修复）

### 问题 1：动态高度页面

页面在逐段截图过程中高度发生变化（如虚拟列表、内容折叠），仍会导致滚动位置与拼接偏移错位。当前实现假设截图期间 `scrollHeight` 稳定。

### 问题 2：固定定位元素重复

`position: fixed/sticky` 的元素（如导航栏）会在每张截图中都出现，拼接后会重复显示。这是滚动拼接的固有限制，Puppeteer 也有同样问题。

### 问题 2：水平滚动内容

当前实现只处理垂直滚动，未处理水平溢出内容。

## 相关代码

### 新增/修改的函数

| 函数 | 文件 | 行号 | 说明 |
|------|------|------|------|
| `captureFullPageByScrolling` | `cdp-manager.js` | ~562-724 | 滚动截图主逻辑（含降缩放因子处理） |
| `stitchScreenshots` | `cdp-manager.js` | ~482-555 | offscreen Canvas 拼接（最后一段底部对齐） |
| `executeAction` (screenshot) | `cdp-manager.js` | ~1711-1718 | 调用入口，fullPage 走新方案 |

### 关键代码位置

- `cdp-manager.js:24` — `MAX_CANVAS_DIMENSION = 16384` 模块常量
- `cdp-manager.js:482-555` — `stitchScreenshots` 实现（最后一段底部对齐）
- `cdp-manager.js:603-631` — 超限时降低缩放因子 + 重新测量
- `cdp-manager.js:562-724` — `captureFullPageByScrolling` 实现
- `cdp-manager.js:688-696` — 滚动循环（scrollCSS 钳制到 maxScroll）
- `cdp-manager.js:1711-1718` — `executeAction` 中 screenshot 分支的调用逻辑

### 原始方案（已删除）

原 `executeAction` 中 fullPage 分支使用 CDP `Page.captureScreenshot` + `captureBeyondViewport: true` + `Emulation.setDeviceMetricsOverride` 的代码已在 2026-08-26 被替换为调用 `captureFullPageByScrolling`。

## 技术背景

### CDP 截图相关 API

1. **`Page.captureScreenshot`**
   - `format`: 图片格式（png/jpeg）
   - `quality`: 图片质量
   - `captureBeyondViewport`: 是否截取超出视口的内容
   - `clip`: 截取区域 { x, y, width, height, scale }

2. **`Page.getLayoutMetrics`**
   - 返回页面布局信息，包括 `contentSize`（完整内容尺寸）

3. **`Emulation.setDeviceMetricsOverride`**
   - 设置设备视口尺寸

### Electron 相关 API

1. **`webContents.capturePage([rect, opts])`**
   - 仅捕获**可见页面**（visible page）
   - 返回 `Promise<NativeImage>`，尺寸为**物理像素**（已乘 DPR）
   - 无 `fullPage` 参数

2. **Canvas 尺寸限制**
   - Chrome 中 Canvas 最大维度为 16384
   - 超过此限制时 `drawImage`/`toDataURL` 行为未定义（通常静默失败或截断）

## 已验证的失败方案

### 方案 1：直接使用 captureBeyondViewport

```javascript
const result = await executeCommand(webContentsId, 'Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 }
});
```

**结果**：当前视口内容被重复拼接填充 clip 区域。

### 方案 2：先设置视口大小再截图

```javascript
await executeCommand(webContentsId, 'Emulation.setDeviceMetricsOverride', {
  width: Math.round(contentSize.width),
  height: Math.round(height),
  deviceScaleFactor: 1,
  mobile: false,
});
const result = await executeCommand(webContentsId, 'Page.captureScreenshot', {
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: contentSize.width, height: height, scale: 1 }
});
await executeCommand(webContentsId, 'Emulation.clearDeviceMetricsOverride');
```

**结果**：仍然是当前视口的重复拼接。

## 参考资料

- [Chrome DevTools Protocol - Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)
- [Puppeteer 全页面截图实现](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/api/Page.ts)
- [CDP captureBeyondViewport 问题](https://github.com/nicedoc/puppeteer-full-page-screenshot)

## 复现步骤

1. 启动 Realm Browser（`npm run dev`），打开任意高度不是视口整数倍的页面
   - 测试页：`/Users/wxnacy/WorkBuddy/2026-08-25-11-20-40/lpl_2026_summary.html`（纯静态，无任何 JS）
2. 让 AI 执行 `screenshot` 操作并传 `fullPage: true`（如发"完整页面截图"）
3. 观察拼接结果：
   - **修复前**："五大焦点看点"第一行之后拼接的是重复的"季后赛赛程时间线"内容，真实底部（焦点卡片后两行 + footer）丢失
   - **修复后**：从页头到 footer 完整连续，无重复、无截断
4. 独立复现脚本（带滚动 readback，无需启动完整应用）：
   `npx electron /tmp/realm-screenshot-debug/repro.js`，产物在 `/tmp/realm-screenshot-debug/`（seg-*.png 单段、stitched.png 拼接结果）
