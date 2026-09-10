---
status: fixed
trigger: "Cookie 管理面板中 Cookie 列表显示区域背景色过深（接近纯黑），文字颜色也是深色调，导致文字与背景对比度不足，文字难以阅读。"
created: 2026-07-27T00:10:00Z
updated: 2026-07-27T00:20:00Z
audit_acknowledged:
  milestone: v2.5
  at: 2026-09-10
  status: fixed
---

## Current Focus

hypothesis: Cookie 行文本无显式 color，继承 `<dialog>` UA 默认 color: black（已确认）
test: 截图像素采样 + CSS 规则审查
expecting: 若假设成立，行文本字形像素应为 #000000，背景应为 #3a3a3a（符合设计）
next_action: 返回 ROOT CAUSE FOUND 给 team-lead（diagnose-only 模式）

## Symptoms

expected: Cookie 管理面板宽度 750px，标签页、过滤栏、列表、分页控件样式与应用整体深色主题一致，且文字清晰可读（足够对比度）。
actual: cookie 显示区域背景太黑了，文字有点看不清（列表区背景过深，与文字对比度不足）。截图见 /Users/wxnacy/Downloads/ScreenShot_2026-07-27_000605_155.png
errors: None reported
reproduction: Test 7 in UAT - 打开 Cookie 管理面板查看 Cookie 列表
started: Discovered during UAT Phase 10

## Eliminated

- hypothesis: 背景色被错误设置为近黑色（CSS 变量被覆盖/重定义）
  evidence: 像素采样显示列表背景实际为 #3a3a3a（= --bg-tertiary，符合 UI-SPEC）；main.css 仅一个 :root 块，无变量重定义；无内联样式
  timestamp: 2026-07-27T00:18:00Z
- hypothesis: 渲染使用了未定义 class 导致背景回退
  evidence: index.html/renderCookiesList 的 class 与 CSS 完全匹配（.cookies-list/.cookie-item/.cookie-col-*）
  timestamp: 2026-07-27T00:18:00Z

## Evidence

- timestamp: 2026-07-27T00:12:00Z
  checked: src/styles/main.css :root（L7-39）与 Cookie 相关规则（L546-783）
  found: 变量唯一定义（--bg-tertiary:#3a3a3a, --text-primary:#f0f0f0）。.cookie-col-name/.cookie-col-value/.cookie-col-domain（L620-646）只定义宽度/overflow，**未定义 color**；.cookie-item（L656-662）也无 color。旧类 .cookie-name/.cookie-value/.cookie-domain（L761-783）定义了颜色但 renderer 未使用（死代码）
  implication: 渲染出的行单元格没有任何显式文字颜色
- timestamp: 2026-07-27T00:13:00Z
  checked: src/renderer.js renderCookiesList()（L2071-2127）
  found: 行渲染使用 cookie-col-name/cookie-col-value/cookie-col-domain 类名，无内联样式
  implication: 文字颜色完全依赖继承
- timestamp: 2026-07-27T00:14:00Z
  checked: src/index.html Cookie 模态框（L270-313）
  found: 结构为 `<dialog class="modal">` > `.modal-content.modal-xlarge` > `.cookies-list`；.modal（L328-334）只覆盖 background/border/padding，**未覆盖 color**
  implication: Chromium UA 样式 `dialog { color: black }` 直接命中元素，后代无 color 的元素全部继承为黑色
- timestamp: 2026-07-27T00:17:00Z
  checked: 截图像素采样（Python PIL）
  found: 模态表面=#2a2a2a ✓；列表头背景=#3a3a3a ✓；行背景=#3a3a3a ✓；表头字形=#a0a0a0（--text-secondary）✓；**行文本（name/value/domain）字形主色=(0,0,0) 纯黑**
  implication: 背景全部符合设计，真正的问题是行文字被渲染成黑色（#000 on #3a3a3a，对比度仅 1.9:1），用户把"黑字深底"感知为"背景太黑"
- timestamp: 2026-07-27T00:19:00Z
  checked: 对照组——表头 .cookie-list-header 有 color: var(--text-secondary)；.btn-icon/.btn-danger-icon 有显式 color
  found: 这些元素在截图中均可读（灰色表头、灰/红图标）
  implication: 证实"凡显式设 color 的元素正常，只有行单元格因未设 color 继承 dialog 黑色"

## Resolution

root_cause: renderer.js 渲染的 Cookie 行单元格使用 .cookie-col-name/.cookie-col-value/.cookie-col-domain 类，这些类（及 .cookie-item/.cookies-list/.modal-content/.modal）均未设置 color。面板根元素是原生 `<dialog>`，Chromium UA 样式表为其设置 color: black，.modal 类只覆盖了 background 未覆盖 color，导致行文本继承为纯黑色，显示在 #3a3a3a 背景上（对比度 1.9:1）。背景色实际符合 UI-SPEC（#3a3a3a），用户感知的"背景太黑"实为"黑字深底"。Phase 10 将旧类 .cookie-name/.cookie-value/.cookie-domain（含颜色定义，现为死代码 L761-783）改名为 .cookie-col-* 时只迁移了布局属性，遗漏了颜色。
fix: (diagnose-only，未实施) 建议方向：为 .cookie-item 或 .cookie-col-* 添加显式 color（name→--text-primary，value/domain→--text-secondary）；并可在 .modal 上加 color: var(--text-primary) 防止所有 dialog 后代再次踩坑；清理死代码 .cookie-name/.cookie-value/.cookie-domain
verification: 像素级证据确认（截图采样：行字形 #000000，背景 #3a3a3a）
files_changed: []
