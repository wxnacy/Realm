# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），已集成 AI Agent SDK，并在此之上逐步叠加 AI 联网搜索与抓取、历史对话、条目记忆，以及本地媒体库（嗅探 / 独立播放器 / 分片缓存 / 直播录制转封装）。

v2.6 把 AI 助手推进到**可扩展能力体系**：接入 pi-agent-core 原生 Skill 层，让技能目录落在 agent 工作区硬沙箱内、随包分发自审计过的内置技能、支持 `/skill:name` 显式调用与模型自动匹配、让 AI 用 `manage_skill` 自主创建技能，并提供 zip / 网络地址两条**经过恶意包加固**的用户导入通道。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)
- ✅ **v2.0 收藏夹文件夹支持 + AI Agent 集成** — Phases 14-21 (shipped 2026-08-01)
- ✅ **v2.1 AI CDP 增强 + Tabbrowser 功能集成** — Phases 22-25 (shipped 2026-08-04)
- ✅ **v2.2 多媒体功能集成** — Phases 26-29 (shipped 2026-08-11)
- ✅ **v2.3 浏览器基础功能补全** — Phases 30-33 (shipped 2026-08-14)
- ✅ **v2.4 多窗口支持** — Phases 34-39 (shipped 2026-08-24)
- ✅ **v2.5 AI 网络搜索功能** — Phases 40-45 (shipped 2026-09-10)
- ✅ **v2.6 AI 助手技能（Skill）能力** — Phases 46-51 (shipped 2026-09-15)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Core Container Management + Architecture Refactoring — completed 2026-07-23
- [x] Phase 2: Browser Core - URL Navigation + Multi-Tab — completed 2026-07-23
- [x] Phase 3: Data Isolation + Cookie Persistence — completed 2026-07-23
- [x] Phase 4: Convenience Features — completed 2026-07-24

</details>

<details>
<summary>✅ v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面 (Phases 5-9) — SHIPPED 2026-07-26</summary>

- [x] Phase 5: 容器属性扩展 — completed 2026-07-25
- [x] Phase 6: 浏览历史记录 — completed 2026-07-25
- [x] Phase 7: 收藏夹管理 — completed 2026-07-25
- [x] Phase 8: 常用网站推荐 + 设置页面 — completed 2026-07-25
- [x] Phase 9: 共享收藏数据库 — completed 2026-07-26

</details>

<details>
<summary>✅ v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式 (Phases 10-12) — SHIPPED 2026-07-27</summary>

- [x] Phase 10: Cookie 管理增强 — completed 2026-07-26
- [x] Phase 11: 设置页面重构 — completed 2026-07-27
- [x] Phase 12: 开发者模式 — completed 2026-07-27

</details>

<details>
<summary>✅ v1.3 右键菜单增强 (Phase 13) — SHIPPED 2026-07-27</summary>

- [x] Phase 13: 右键菜单增强 — completed 2026-07-27

</details>

<details>
<summary>✅ v2.0 收藏夹文件夹支持 + AI Agent 集成 (Phases 14-21) — SHIPPED 2026-08-01</summary>

- [x] Phase 14: 收藏夹文件夹 - 数据库层实现 — completed 2026-07-28
- [x] Phase 15: 收藏夹文件夹 - UI 交互 — completed 2026-07-28
- [x] Phase 16: 收藏夹文件夹 - 增强功能 — completed 2026-07-29
- [x] Phase 17: Chrome 书签导入 — completed 2026-07-30
- [x] Phase 18: 收藏栏功能 — completed 2026-07-30
- [x] Phase 19: AI Agent 集成 - 基础验证 — completed 2026-07-31
- [x] Phase 20: AI Agent 集成 - 核心功能 — completed 2026-08-01
- [x] Phase 21: AI Agent 集成 - 聊天 UI — completed 2026-08-01

</details>

<details>
<summary>✅ v2.1 AI CDP 增强 + Tabbrowser 功能集成 (Phases 22-25) — SHIPPED 2026-08-04</summary>

- [x] Phase 22: CDP 管理器扩展 + 基础网页操控工具 (5/5 plans) — completed 2026-08-02
- [x] Phase 23: 智能上下文引用 + 全文检索 (2/2 plans) — completed 2026-08-02
- [x] Phase 24: 任务自主执行 (4/4 plans) — completed 2026-08-02
- [x] Phase 25: 脚本生成 + 智能标签整理 (7/7 plans) — completed 2026-08-04

</details>

<details>
<summary>✅ v2.2 多媒体功能集成 (Phases 26-29) — SHIPPED 2026-08-11</summary>

- [x] Phase 26: 视频源检测 + IPC 基础 (2/2 plans) — completed 2026-08-06
- [x] Phase 27: 媒体面板 (2/2 plans) — completed 2026-08-07
- [x] Phase 28: 播放器窗口 (2/2 plans) — completed 2026-08-08
- [x] Phase 29: 多媒体播放器设置控制 (5/5 plans) — completed 2026-08-08

</details>

<details>
<summary>✅ v2.3 浏览器基础功能补全 (Phases 30-33) — SHIPPED 2026-08-14</summary>

- [x] Phase 30: 下载管理器 — 核心引擎 (2/2 plans) — completed 2026-08-11
- [x] Phase 31: 下载管理器 — 用户交互 (3/3 plans) — completed 2026-08-12
- [x] Phase 32: 自动填充 — 凭据引擎 (2/2 plans) — completed 2026-08-13
- [x] Phase 33: 自动填充 — 增强 + Bug 修复 (3/3 plans) — completed 2026-08-14

</details>

<details>
<summary>✅ v2.4 多窗口支持 (Phases 34-39) — SHIPPED 2026-08-24</summary>

- [x] Phase 34: 窗口管理基础 (4/4 plans) — completed 2026-08-16
- [x] Phase 35: Tab 窗口关联 (3/3 plans) — completed 2026-08-15
- [x] Phase 36: Tab 拖拽与跨窗口移动 (3/3 plans) — completed 2026-08-15
- [x] Phase 37: 地址栏地址补全功能 (2/2 plans) — completed 2026-08-21
- [x] Phase 38: AI 助手供应商管理 (3/3 plans) — completed 2026-08-23
- [x] Phase 39: Vimium 键盘操作功能 (4/4 plans) — completed 2026-08-24

</details>

<details>
<summary>✅ v2.5 AI 网络搜索功能 (Phases 40-45) — SHIPPED 2026-09-10</summary>

- [x] Phase 40: 搜索基础设施 + web_search 工具 (3/3 plans) — completed 2026-08-28
- [x] Phase 41: web_fetch 工具 + 搜索配置 UI (2/2 plans) — completed 2026-08-27
- [x] Phase 42: AI 历史对话管理功能 (6/6 plans) — completed 2026-09-02
- [x] Phase 43: AI 记忆系统集成（条目记忆 MVP） (5/5 plans) — completed 2026-09-04
- [x] Phase 44: 播放器视频缓存与本地媒体库 (18/18 plans) — completed 2026-09-10
- [x] Phase 45: B 站直播 fMP4 转录支持 (4/4 plans) — completed 2026-09-08

</details>

<details>
<summary>✅ v2.6 AI 助手技能（Skill）能力 (Phases 46-51) — SHIPPED 2026-09-15</summary>

- [x] Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入） (4/4 plans) — completed 2026-09-11
- [x] Phase 47: 内置技能播种 + bash 策略加固 (6/6 plans) — completed 2026-09-11
- [x] Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`） (8/8 plans) — completed 2026-09-13
- [x] Phase 49: `manage_skill` 工具（AI 自建技能） (8/8 plans) — completed 2026-09-14
- [x] Phase 50: 设置页技能管理区 + `/api/skills/*` (5/5 plans) — completed 2026-09-15
- [x] Phase 51: 用户技能导入管线（zip + 网络地址） (7/7 plans) — completed 2026-09-15

</details>
