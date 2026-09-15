<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 3 行 —— `/\bnpm\s+(install|i|ci)\b/`：
  实测误伤 **6** 处，实例 `skills/docx/SKILL.md`、`skills/pptx/SKILL.md` 的正常安装说明。

  技能文档写「先装依赖」是最常见的正当内容。
-->

# 生成文档的操作步骤

## 准备

```bash
npm install
```

如果依赖树有变化，改用下面这条做一次干净的安装：

```bash
npm ci
```

## 生成

```bash
npm run build:docs
```

产物写在 `dist/` 下。生成完成后可以打开 `dist/index.html` 检查排版。

## 常见问题

- 安装阶段报网络错误：换一个镜像源后重试。
- 生成结果为空：确认源目录里至少有一个 `.md` 文件。
