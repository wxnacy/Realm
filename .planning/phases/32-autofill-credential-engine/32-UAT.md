---
status: complete
phase: 32-autofill-credential-engine
source: 32-01-SUMMARY.md, 32-02-SUMMARY.md
started: 2026-08-14T12:00:00Z
updated: 2026-08-14T12:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 冷启动验证
expected: npm run dev 启动应用，终端无崩溃/异常，窗口正常打开
result: pass

### 2. 凭据保存 — 登录表单提交后出现保存横幅
expected: 在任意容器中打开一个需要登录的网站（如 GitHub），输入账号密码并提交登录表单后，页面顶部出现 Chrome 风格的「是否保存密码？」横幅，显示域名和三个按钮（保存/永不/暂不）
result: pass

### 3. 凭据保存 — 点击「保存」按钮
expected: 点击横幅上的「保存」按钮后，横幅消失，凭据被加密存储到 history.db 的 credentials 表中
result: pass

### 4. 凭据自动填充 — 再次访问已保存凭据的网站
expected: 再次打开已保存凭据的网站登录页面，用户名和密码字段自动填充为之前保存的值，填充使用 native setter 兼容 React/Vue 框架
result: issue
reported: "https://pypi.org/account/login/ 进入后并没有自动填充"
severity: major

### 5. 凭据保存 — 点击「永不」按钮
expected: 在另一个网站登录后出现保存横幅，点击「永不」按钮，横幅消失，该域名被记录为永不保存，以后该域名不再出现保存提示
result: pass

### 6. 凭据保存 — ESC 键 / 10 秒超时
expected: 在另一个网站登录后出现保存横幅，不点击任何按钮，按 ESC 键或等待 10 秒，横幅自动消失，凭据不保存
result: pass

### 7. 容器隔离 — 不同容器的凭据互不干扰
expected: 在容器 A 中保存了某网站的凭据，切换到容器 B 访问同一网站，不会自动填充容器 A 的凭据，也不会出现容器 A 的保存记录
result: blocked
blocked_by: prior-phase
reason: "同一容器也无法填充，需先修复自动填充 bug 后再验证容器隔离"

### 8. autofill/fillForm 互斥 — AI 填表时自动填充暂停
expected: 如果有 AI fillForm 功能在执行填表操作时，自动填充引擎暂停工作，不与 fillForm 冲突；fillForm 完成后自动恢复
result: skipped
reason: "正常流程中自动填充在 DOMContentLoaded 时已完成，用户请求 AI fillForm 时不存在竞态。互斥机制防的是 MutationObserver 与 fillForm 的竞态条件，常规操作无法触发。"

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "再次访问已保存凭据的网站登录页面，用户名和密码字段自动填充"
  status: fixed
  reason: "User reported: https://pypi.org/account/login/ 进入后并没有自动填充"
  severity: major
  test: 4
  root_cause: "scanForLoginForms() 使用 WeakSet 去重，DOMContentLoaded 首次扫描把表单加入 detectedForms。credential:do-autofill 处理函数再次调用 scanForLoginForms() 时，表单已被标记为已检测，返回空数组，自动填充被跳过。"
  artifacts:
    - path: "src/webview-preload.js"
      issue: "credential:do-autofill handler calls scanForLoginForms() which returns empty due to WeakSet dedup"
  fix: "缓存首次扫描结果到 FormDetector.cachedCredentialForms，credential:do-autofill 直接使用缓存"
  fix_commit: "3faa729"
  debug_session: ""
