---
phase: 24-task-autonomous
plan: 03
subsystem: cdp-manager / ai-manager
tags: [captcha, 2fa, security, cdp, ai-agent]
dependency:
  requires: [24-02]
  provides: [captcha-detection, 2fa-detection]
  affects: [cdp-manager.js, ai-manager.js]
tech_stack:
  added: []
  patterns: [dual-verification, polling-recovery]
key_files:
  created: []
  modified: [cdp-manager.js, ai-manager.js]
decisions:
  - "双重验证策略：DOM 特征 + 关键词双重验证减少误报，仅关键词需 >=2 个才判定"
  - "预检不阻塞策略：_preCheckCaptcha 异常时仅 warn 不阻塞操作"
  - "轮询恢复机制：3 秒间隔、120 秒超时的 CAPTCHA 消失检测"
metrics:
  duration: ~5m
  completed: "2026-08-02T14:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
status: complete
---

# Phase 24 Plan 03: CAPTCHA/2FA Detection Summary

## One-Liner

CAPTCHA/2FA 页面检测与暂停机制 — AI 遇到验证码时暂停任务、提示用户手动操作，支持轮询等待恢复。

## What Was Built

### detectCaptcha CDP Method (cdp-manager.js)

新增 `detectCaptcha(webContentsId)` 异步方法，通过 Runtime.evaluate 在页面上下文执行检测脚本：

- **DOM 特征检测**：reCAPTCHA（`.g-recaptcha`, `iframe[src*="recaptcha"]`）、hCaptcha（`.h-captcha`）、Turnstile（`.cf-turnstile`）
- **关键词检测**：中文（验证码、机器人检测、安全验证等）+ 英文（CAPTCHA、verify you are human 等）
- **2FA 页面检测**：`input[type="tel"]` + 周围文本关键词、`input[inputmode="numeric"]` + maxlength 范围检测
- **双重验证逻辑**：DOM 特征 → high confidence；仅关键词（>=2）→ medium confidence；2FA → medium confidence

### CAPTCHA Pre-check Integration (ai-manager.js)

- `_preCheckCaptcha(webContentsId, tabUrl)`: 预检辅助方法，调用 detectCaptcha 并格式化结果
- `fill_form` 执行前自动调用预检，检测到 CAPTCHA 时返回 `captchaDetected: true` 暂停任务
- `execute_action` 执行前自动调用预检，检测到 CAPTCHA 时返回 `captchaDetected: true` 暂停任务
- `wait_for_captcha_completion(webContentsId)`: 轮询等待方法，3 秒间隔检测，最多 120 秒
- 系统提示词更新：告知 AI CAPTCHA 检测行为

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 双重验证策略（DOM + 关键词） | 单一检测易误报，双重验证提高准确率（per D-15） |
| 仅关键词需 >=2 个才判定 | 单个关键词误报率高，阈值 2 平衡灵敏度和准确率 |
| 预检异常不阻塞操作 | detectCaptcha 失败不应阻止正常表单填写，仅 warn 记录 |
| 轮询间隔 3 秒、超时 120 秒 | 平衡实时性和资源消耗，120 秒覆盖大多数验证码场景 |

## Verification Results

- [x] `detectCaptcha` 方法已导出，类型为 function
- [x] `fill_form` 工具已注册
- [x] `execute_action` 工具已注册
- [x] `wait_for_captcha_completion` 方法已添加
- [x] `_preCheckCaptcha` 辅助方法已添加

## Known Stubs

None — all functionality is fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: captcha-bypass | cdp-manager.js | detectCaptcha 检测逻辑依赖 DOM 特征和关键词，理论上可通过自定义 CAPTCHA 实现绕过。但此为设计意图 — AI 不应尝试绕过验证码，仅需检测并暂停。 |
