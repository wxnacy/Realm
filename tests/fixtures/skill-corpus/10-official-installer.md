<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 10 行 —— `/\|\s*(ba)?sh\b/`：
  实测误伤 **1** 处，实例 `anthropic-cli.md` 里的**官方安装说明**。

  「把官方安装脚本管道给 shell」是产品官网给出的标准安装方式，把这条收进模式表
  会让所有含官方安装说明的技能无法导入。
-->

# 安装

## 官方安装脚本

```bash
curl -fsSL https://downloads.example.com/tool/install.sh | sh
```

## Homebrew

```bash
brew install example-tool
```

## 校验安装结果

```bash
example-tool --version
```

## 卸载

用包管理器安装的走 `brew uninstall example-tool`；
用官方脚本安装的，运行 `example-tool uninstall`。
