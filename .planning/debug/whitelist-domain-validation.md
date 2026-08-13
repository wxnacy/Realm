---
status: fixed
trigger: "UAT Test 4: 白名单输入 test 也通过了，基本的域名格式应该校验下"
created: 2026-08-10T00:00:00Z
updated: 2026-08-10T00:00:00Z
---

## Current Focus

hypothesis: addWhitelistDomain 的校验正则 `/[^\w.\-]/` 只拒绝非法字符，不做域名结构校验，裸词 test 全部命中 \w 直接放行
test: 阅读 addWhitelistDomain 源码 + 对照消费端 isDomainWhitelisted 匹配语义
expecting: 确认正则只过滤字符集、无结构校验；确认脏数据进入白名单的实际影响
next_action: 返回 ROOT CAUSE FOUND（goal: find_root_cause_only，不修复）

## Symptoms

expected: 输入域名（如 example.com）回车或点「添加」→ 出现蓝色 pill 标签；输入含非法字符（空格、斜杠等）被拒绝并提示；无点的裸词（test）应被拒绝
actual: 输入 test 也通过了，被接受为白名单 tag
errors: None
reproduction: realm://settings → 多媒体页 → 白名单输入框输入 "test" → 添加成功
started: Phase 29（多媒体播放器设置控制）引入该功能时即存在

## Eliminated

- hypothesis: 是 hint 文案/placeholder 误导用户以为 test 合法
  evidence: placeholder 写明 "输入域名，如 example.com"，提示文案正确；问题在校验逻辑本身（settings-page.js:1518）
  timestamp: 2026-08-10
- hypothesis: 消费端 main.js isDomainWhitelisted 会兜底过滤无效条目
  evidence: main.js:347-357 只做 `hostname === domain || hostname.endsWith('.' + domain)` 匹配，不过滤/不校验白名单条目本身；脏条目原样存储并参与匹配
  timestamp: 2026-08-10

## Evidence

- timestamp: 2026-08-10
  checked: src/settings-page.js:1509-1528 addWhitelistDomain
  found: 校验仅三道：① 非空 ② `/[^\w.\-]/` 字符黑名单（拒绝空格、斜杠等非法字符）③ 去重。`test` 全部由 `\w`（[A-Za-z0-9_]）组成，不触发字符黑名单，直接通过
  implication: 缺第四道「域名结构」校验（至少含一个点、标签合法、TLD 形状等）。该正则还会放行 `..`、`-`、`_`、`a..b`、`.com`、`com` 等结构性垃圾

- timestamp: 2026-08-10
  checked: main.js:347-357 isDomainWhitelisted（白名单消费端）
  found: 匹配语义为 `hostname === domain || hostname.endsWith('.' + domain)`；空数组 = 全部探测
  implication: 脏条目不只是无害摆设——输入 `com` 会匹配所有 `.com` 站点（白名单形同虚设）；输入 `test` 则永远匹配不到任何真实域名（用户以为白名单生效，实际探测被静默放空）。两类都是静默错误行为，用户无感知

- timestamp: 2026-08-10
  checked: src/settings-page.js:1238-1257 addDomain（开发者模式抓取域名）
  found: 使用几乎相同的弱校验 `/\s/` + `/[^\w.-]/`，同样放行裸词
  implication: 同文件存在同构缺陷；修复时可考虑抽一个共享的域名结构校验函数，两处（甚至未来同类输入）复用——但范围由 planner 决定

- timestamp: 2026-08-10
  checked: src/settings.html:308-318 白名单输入区 UI
  found: placeholder "输入域名，如 example.com" 与描述文案（自动包含子域名）已正确；hint 元素仅用于空列表提示
  implication: UI 文案无需大改；修复点在 settings-page.js 的校验函数，toast 文案「域名格式不合法」可复用或细化为「请输入合法域名，如 example.com」

- timestamp: 2026-08-10
  checked: .planning/debug/knowledge-base.md（Phase 0）
  found: 无相关知识库条目（文件不存在或无匹配）
  implication: 按开放假设流程调查

## Resolution

root_cause: addWhitelistDomain（src/settings-page.js:1518）的校验是「字符黑名单」而非「域名结构校验」——`/[^\w.\-]/` 只排除空格/斜杠等非法字符，任何纯 `[A-Za-z0-9_.\-]` 组合（含无点裸词 test）都被放行
fix: （未修复，goal: find_root_cause_only）
verification: （未验证，goal: find_root_cause_only）
files_changed: []

bug_class: Bohrbug（确定性，任何无点裸词必现）
specialist_hint: typescript（JS/Electron renderer，无专门 javascript hint，用 general 亦可）
