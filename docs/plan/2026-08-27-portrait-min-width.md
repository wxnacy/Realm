# 竖屏半屏最小宽度限制调查报告

日期：2026-08-27

## 问题现象

用户在竖屏显示器（实测宽度 **1080px**，截图分辨率 1080 × 1886）上无法将窗口宽度贴到半屏（约 540px）。对照：同环境下 Chrome 可正常贴半屏至约 540px 宽。

## 根因一：主进程窗口硬下限

`window-manager.js:141`：

```js
minWidth: 800,
minHeight: 600,
```

Electron 窗口 `minWidth` 是硬性下限，系统分屏（snap 到半屏）也受它约束。竖屏 1080 宽 → 半屏仅 540px < 800px，因此系统贴半屏时被 Electron 钳制回 800px，表现为「拖不到一半宽」。

## 根因二：工具栏 UI 实际下限约 560px

仅下调 `minWidth` 不够，地址栏所在工具栏本身在 ~560px 以下会挤坏。

### 地址栏输入框本身无最小宽度

- `.url-input-wrapper` 显式 `min-width: 0`（`src/styles/main.css:423`）
- `.url-input` 无 `min-width` 声明

→ 输入框本身可缩到接近 0。

### 但左右按钮群形成实际下限

- `.toolbar-left` / `.toolbar-right` **未设** `min-width: 0`，flex 默认 `min-width: auto` → 不会缩到比内容小。
- 按钮数：左侧 3 个（后退/前进/刷新），右侧 9 个（收藏/历史/收藏夹/Cookie/快速存/设置/媒体/下载/AI），每个 `.btn-icon` = 32px（`src/styles/main.css:173`）。

固定占用估算：

| 部分 | 估算宽度 |
|------|---------|
| 左侧按钮组（3×32 + 间隙） | ~104px |
| 右侧按钮组（9×32 + 间隙） | ~320px |
| 中间 container-indicator | ~90px |
| 工具栏 padding（24）+ 组间隙（16） | ~40px |
| **合计** | **~554px** |

窗口宽度低于 ~560px 时，左右按钮群占满空间，地址栏输入框被挤至 0，表现为地址栏「消失/重叠」。

## 结论

- 地址栏输入框**没有**显式最小宽度；
- 工具栏因左右 12 个固定按钮（默认 `min-width: auto`）存在**约 560px 的实际下限**；
- 因此仅将 `minWidth` 改为 540 仍会挤坏地址栏。

## 建议修复方向（待实施）

1. **下调主窗口 `minWidth`**：`window-manager.js:141` 从 800 改为匹配半屏的值（如 540）。
2. **工具栏响应式**：
   - 给 `.toolbar-left` / `.toolbar-right` 加 `min-width: 0` 并 `overflow: hidden`，允许压缩；
   - 窄屏下隐藏 `container-indicator` 或将部分按钮收进「更多」菜单 / 允许横向滚动；
   使 540px 半屏下地址栏仍可正常使用。

## 参考截图

`/Users/wxnacy/Downloads/ScreenShot_2026-08-27_114816_999.png`（Chrome 竖屏半屏约 540px）

---

# 实施计划

## 目标
1. 主窗口最小宽度下调，支持竖屏半屏（~540px）及更小宽度
2. 工具栏右侧按钮在宽度不足时自动收起，通过 `»` 下拉按钮访问

## 修改文件清单

### 1. `window-manager.js`（1 处）
- 第 141 行：`minWidth: 800` → `minWidth: 400`
- 理由：竖屏 1080px 半屏约 540px，设 400 给更极端场景留余量

### 2. `src/styles/main.css`（多处新增/修改）
- `.toolbar-left, .toolbar-right` 追加 `min-width: 0;`（解除 flex 默认 auto 下限）
- `.toolbar-right` 追加 `overflow: hidden; position: relative;`
- `.toolbar-right .btn-icon` 追加 `flex-shrink: 0;`
- 新增 `.toolbar-overflow-btn` 样式（默认 `display:none`，有溢出时 `.visible` 显示）
- 新增 `.toolbar-overflow-menu` / `.toolbar-overflow-menu-item` 样式（复用 bookmarks-dropdown 视觉风格）

### 3. `src/index.html`（1 处）
- 在 `.toolbar-right` 末尾添加 `<button class="btn-icon toolbar-overflow-btn" id="toolbarOverflowBtn" title="更多">»</button>`

### 4. `src/renderer.js`（新增逻辑）
- 新增 `calculateToolbarOverflow()` 函数：
  - 获取 `.toolbar-right` 宽度，预留 `»` 按钮宽度（30px）
  - 保护阈值：可用宽度 < 30px 时直接返回
  - 先让所有右侧按钮 `display = ''`，逐项 `getBoundingClientRect()` 累加
  - 溢出项 `display = 'none'`，并收集到 `overflowToolbarButtons` 数组
  - 有溢出则 `#toolbarOverflowBtn` 加 `.visible`
- 新增 `showToolbarOverflowMenu()` 函数：
  - 动态创建下拉菜单，每项对应一个被隐藏的按钮
  - 菜单项文本取原按钮的 `title`
  - 点击菜单项时 `btn.dispatchEvent(new Event('click'))` 复用原事件逻辑
  - 定位在 `»` 按钮下方，右对齐，带遮罩层，点击外部关闭
- 初始化：
  - DOM ready 后通过双重 `requestAnimationFrame` 首次计算
  - `ResizeObserver` 监听 `.toolbar` 宽度变化，自动重算
  - `#toolbarOverflowBtn` 绑定点击事件

## 实现细节

### 溢出检测算法（仿 bookmarks-bar.js）
```
available = toolbarRight.width - overflowBtnWidth - gaps
for each btn in toolbarRight.children (排除 overflowBtn):
    btn.display = ''              // 先全部可见以测量
for each btn:
    w = btn.getBoundingClientRect().width + gap
    if used + w > available && i > 0:
        overflowStart = i
        break
    used += w
隐藏 overflowStart 起的所有按钮，记录到数组
```

### 下拉菜单设计
- 不耦合任何业务逻辑，纯代理层
- 菜单项 = 被隐藏按钮的 `title` + 原按钮点击代理
- 视觉风格复用 `.bookmarks-dropdown`，保持项目内一致性
- 菜单关闭时不需要恢复按钮状态（它们仍保持 `display:none`，由 ResizeObserver 管理）

### 地址栏保护
- 左侧 3 个导航按钮 + 中间 container-indicator 保持始终可见
- 只有 `.toolbar-right` 内的 9 个功能按钮参与溢出计算
- 窗口 400px 时，左侧+中间约 200px，地址栏仍剩约 200px 可用空间

## 验收标准
- [ ] 窗口可贴到竖屏半屏（540px）及以下（最小 400px）
- [ ] 540px 宽度下地址栏输入框可见且可正常输入
- [ ] 宽度缩小时右侧按钮依次被隐藏，`»` 按钮出现
- [ ] 点击 `»` 弹出下拉菜单，菜单项点击行为与原按钮一致
- [ ] 宽度恢复后按钮自动重新显示，`»` 按钮隐藏
- [ ] 不影响现有按钮徽标（下载/media/AI 等）和事件绑定

---

# 实施总结（2026-08-27）

## 已完成的改动

### 1. `window-manager.js`
- 第 141 行 `minWidth: 800` → `minWidth: 400`。窗口已可贴到竖屏半屏（~540px）及以下。

### 2. `src/styles/main.css`
- `.toolbar-left, .toolbar-right`、`.toolbar-center` 补充 `min-width: 0`，解除 flex 默认 `auto` 下限。
- `.toolbar-right` 增加 `overflow: hidden; position: relative;`。
- `.toolbar-right .btn-icon` 增加 `flex-shrink: 0`。
- 新增 `.toolbar-overflow-btn`（默认 `display:none`，溢出时 `.visible`）、
  `.toolbar-overflow-menu`、`.toolbar-overflow-menu-item` 及滚动条样式。

### 3. `src/index.html`
- `.toolbar-right` 末尾新增 `»` 溢出按钮 `#toolbarOverflowBtn`。

### 4. `src/renderer.js`
- 新增 `calculateToolbarOverflow()`：测量右侧每个按钮宽度，逐个累加，超出 `.toolbar-right` 可用宽度（预留 `»` 30px）者 `display:none`，有溢出则显示 `»`。
- 新增 `showToolbarOverflowMenu()`：下拉菜单，菜单项点击通过 `btn.dispatchEvent(new Event('click'))` 原样代理原按钮行为。
- 新增 `closeToolbarOverflowMenu()`、`initToolbarOverflow()`（`ResizeObserver` 监听 `.toolbar` 宽度 + 双重 `requestAnimationFrame` 首算）。
- 在 `init()` 末尾调用 `initToolbarOverflow()`。

### 验证
- `node --check src/renderer.js` 通过。
- 实测：最小宽度下调、按钮收起/展开、`»` 菜单点击均正常。

## 已知问题（已修复，2026-08-27 二轮）

**按钮收起缺乏"平滑自适应"**（已修复）：原算法按 `.toolbar-right` 的可用宽度做硬性截断，且测量基准是 `.toolbar-right` 自身的 `getBoundingClientRect().width`——其宽度随按钮显隐变化形成「测量—收起」反馈，临界宽度处出现"只剩 1 个按钮、其余全进 `»`"的跳变。

二轮修复（`src/renderer.js` `calculateToolbarOverflow` 重写）：

- **放弃一切可用宽度估算**（首版估算公式与真实 flex 布局误差在临界处仍会放大成 9→6 跳变，实测验证），改为**实测布局驱动、逐步逼近**：
  - 收起：观测到右侧按钮组被 flex 裁切（`scrollWidth > clientWidth`）或地址栏实测宽度 < 120px 时，从末尾逐个隐藏，每步强制重排后重测；
  - 展开：逐个「试恢复 → 实测 → 不达标回退」，自然覆盖「最后一个恢复时 » 同步消失释放占位」的场景，无需估算净成本。
- `.toolbar-left` 加 `flex-shrink: 0`：左侧导航按钮组固定不参与压缩，使 `.toolbar-right` 成为唯一裁切观测点。
- 媒体面板按钮的功能开关隐藏（D-12）改用 `data-feature-hidden` 标记，溢出计算跳过此类按钮，`updateMediaPlayerVisibility` 变更后触发重算。

三轮修复（» 按钮一直显示 + 首个收起双跳）：

- **» 一直显示的根因**：`main.css:4875` AI 模型分组区重复定义了全局 `.btn-icon` 规则（`display: inline-flex; width: 28px`），位置在 `.toolbar-overflow-btn { display:none }`（4349 行）之后且特异性相同，将其覆盖。修复：溢出按钮选择器提升为 `.toolbar-right .toolbar-overflow-btn`（特异性 0,2,0）。
- **首个收起双跳（9→7）的根因**：上述重复规则使所有工具栏按钮实际是 28px（非 32px），» 也是 28px——首个收起时 » 恰好顶替被藏按钮的槽位，净收益为 0，必须再收一个才有收益。修复：» 宽度收窄为 20px，首个收起净收益 12px > 0，保证一次只收一个。

**实测验证**（playwright `_electron` 驱动 dev 应用）：

- 10px 步进（1150↔1000）：9→8→7→6→5 逐个收起/展开，两方向完全一致（无滞回）；
- 50px 步进（1200↔400）：两方向结果一致，» 在全部按钮可容纳时正确隐藏（computed display: none）；
- 地址栏宽度在有按钮可收时始终 ≥ 123px。

验证脚本：`/tmp/realm-toolbar-overflow-test.js`（50px）、`/tmp/realm-toolbar-fine-test.js`（10px）。

## 验收结论
- [x] 最小宽度下调至 400px（竖屏半屏可用）
- [x] 按钮收起 / `»` 下拉 / 菜单点击功能正常
- [x] 收起过程随宽度连续平滑（二轮修复，实测通过）
- [x] 全部按钮可容纳时 » 正确隐藏（三轮修复，实测通过）

