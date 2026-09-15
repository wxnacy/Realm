<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 2 行 —— 裸 `.env`（`/\.env\b/`）：
  实测误伤 **9** 处，实例 `skill-creator/scripts/check_env.mjs`、`claude-api/shared/anthropic-cli.md`。

  合法技能**必须**能告诉用户在本地建一个 `.env` 并从中读配置。
-->

# 本地开发环境配置

1. 在项目根目录新建一个名为 `.env` 的文件。
2. 把下面的键填进该文件（值用你自己的）：

```ini
DATABASE_URL=postgres://localhost:5432/app
LOG_LEVEL=debug
```

3. 启动脚本会自动读取该文件；如果目录里没有它，脚本会打印一条提示并回落到默认值。
4. 请把这个文件加入 `.gitignore`。

> 提示：生产环境请改用平台提供的密钥管理设施，不要提交任何本地配置文件。
