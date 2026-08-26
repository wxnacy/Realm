# 全页面截图问题排查记录

## 问题描述

用户要求实现网页全页面截图功能（滚动截图，截取整个网页而不仅仅是当前视口）。

### 当前实现的问题

使用 CDP `Page.captureScreenshot` 的 `captureBeyondViewport: true` 参数时，截图结果不是真正的滚动截图，而是把当前屏幕的内容重复拼接了多次。

**期望效果**：截取从页面顶部到底部的完整内容
**实际效果**：当前视口内容被重复拼接，不是真实的全页面内容

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
   - 可用于强制调整视口大小

## 已尝试的修复方案

### 方案 1：直接使用 captureBeyondViewport

```javascript
const result = await executeCommand(webContentsId, 'Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: {
    x: 0,
    y: 0,
    width: contentSize.width,
    height: contentSize.height,
    scale: 1
  }
});
```

**结果**：截图内容是当前视口的重复拼接，不是真实全页面。

### 方案 2：先设置视口大小再截图

```javascript
// 1. 获取页面完整尺寸
const layoutResult = await executeCommand(webContentsId, 'Page.getLayoutMetrics');
const contentSize = layoutResult.result?.contentSize;

// 2. 设置视口大小为完整页面尺寸
await executeCommand(webContentsId, 'Emulation.setDeviceMetricsOverride', {
  width: Math.round(contentSize.width),
  height: Math.round(height),
  deviceScaleFactor: 1,
  mobile: false,
});

// 3. 截图
const result = await executeCommand(webContentsId, 'Page.captureScreenshot', {
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: contentSize.width, height: height, scale: 1 }
});

// 4. 恢复原始视口
await executeCommand(webContentsId, 'Emulation.clearDeviceMetricsOverride');
```

**结果**：仍然是当前视口的重复拼接。

## 可能的原因

1. **CDP 版本限制**：Electron 32 使用的 Chromium 版本可能对 `captureBeyondViewport` 支持不完整
2. **webview 限制**：Electron 的 webview 组件可能对截图有特殊限制
3. **页面懒加载**：页面内容可能需要滚动才能加载完整

## 可能的解决方案（待验证）

### 方案 A：滚动截图拼接

参考 Puppeteer 的实现方式，通过滚动页面并多次截图，然后在内存中拼接：

```javascript
// 伪代码
1. 获取页面完整高度
2. 获取当前视口高度
3. 计算需要截图的次数
4. 循环：
   a. 滚动到指定位置
   b. 等待内容加载
   c. 截取当前视口
   d. 保存截图
5. 拼接所有截图
```

### 方案 B：使用 Puppeteer/Playwright

如果 Electron 允许，可以引入 Puppeteer 或 Playwright 来处理全页面截图，它们已经有成熟的实现。

### 方案 C：强制重绘

在设置视口后，可能需要触发页面重绘：

```javascript
await executeCommand(webContentsId, 'Emulation.setDeviceMetricsOverride', { ... });
// 触发重绘
await executeCommand(webContentsId, 'Runtime.evaluate', {
  expression: 'window.dispatchEvent(new Event("resize"))'
});
await new Promise(resolve => setTimeout(resolve, 500));
```

## 相关文件

- `cdp-manager.js`: 截图功能实现（约第 1440-1520 行）
- `ai-manager.js`: AI 工具定义（execute_action 的 screenshot 操作）

## 参考资料

- [Chrome DevTools Protocol - Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)
- [Puppeteer 全页面截图实现](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/api/Page.ts)
- [CDP captureBeyondViewport 问题](https://github.com/nicedoc/puppeteer-full-page-screenshot)

## 复现步骤

1. 启动 Realm Browser
2. 打开一个有滚动内容的网页
3. 发送 AI 消息："完整页面截图"
4. 观察截图结果

## 期望结果

截图应该包含从页面顶部到底部的所有内容，就像用户手动滚动并截图拼接的效果。

## 当前状态

**未解决** - 需要进一步研究 CDP 截图机制或采用滚动拼接方案。
