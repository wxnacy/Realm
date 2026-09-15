<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 5 行 —— `/\bsudo\b/`：
  实测误伤 **3** 处，实例 `claude-api/shared/anthropic-cli.md`。

  系统级工具的安装说明必然出现 `sudo`。
-->

# 安装命令行工具

## macOS

```bash
sudo installer -pkg ./tools.pkg -target /
```

## Linux

```bash
sudo apt-get update && sudo apt-get install -y ./tools.deb
```

## 验证

```bash
tools --version
```

如果提示权限不足，说明上一步没有成功；请检查当前账号是否在管理员组里。
