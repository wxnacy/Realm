<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：「❌ 看似危险但实测不能收」表第 4 行 —— `/\brm\s+-[a-z]*r[a-z]*f/`：
  实测误伤 **4** 处，实例 `web-artifacts-builder/scripts/bundle-artifact.sh` 的清理步骤。

  构建脚本「先清空产物目录」是标准做法。
-->

# 构建与打包

## 清理上次的产物

```bash
rm -rf dist build .cache
```

清理是**幂等**的：目录不存在时该命令也会正常返回。

## 打包

```bash
npm run bundle
```

打包脚本会：

1. 把 `src/` 下的资源复制到 `dist/`；
2. 压缩成 `build/artifact.zip`；
3. 打印产物大小与校验和。

## 校验

```bash
ls -lh build/artifact.zip
```
