<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 6 行 ——
  `/\bexport\s+[A-Z_]*(TOKEN|SECRET|KEY|PASSWORD)/`：实测误伤 **5** 处，
  实例 `export ANTHROPIC_API_KEY` —— 合法技能**必须**教用户导出环境变量。

  本文件的 `export` 行只出现一次，且不伴随任何回显动作（`echo $…` / `printenv`）。
-->

# 配置 API 访问

在 shell 里导出你的访问凭据（把 `sk-...` 换成你自己的值）：

```bash
export EXAMPLE_SERVICE_KEY="sk-REPLACE_ME"
```

为了让它在每个新终端里都生效，可以把上面这行追加到 `~/.zshrc`。

> 不要把真实值写进技能文件、脚本或提交记录 —— 它们会随仓库一起公开。

验证凭据是否已生效：重新打开一个终端，运行 `env | grep -c EXAMPLE_SERVICE_KEY`，
输出 `1` 即表示已生效。
