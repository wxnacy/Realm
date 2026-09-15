<!--
  语料夹具（Phase 51 SEC-06 · **已知误伤清单**）——**本仓自撰**，不复制上游字节。

  ⚠️ **本文件是「已知误伤」样本，被零误伤回归**显式排除**——
  它**故意**命中 `A3`（`scp` / `rsync` 把内容推到远端）。

  来源：`51-RESEARCH.md` 实测 7 的 A3 条目 —— A3 **不是零误伤**：它会命中一个合法部署技能
  （实测 `rsync -az dist/ deploy@staging:/srv/app/`）。因 D-12 的效力是「高亮而非拒绝」
  故仍然收，但**必须在产品文档点名它**。

  测试侧的两条判据（缺一即无法防「清单腐化」）：
  ① 零误伤回归把本文件排除；
  ② 另有一条**正命题**断言本文件确实命中 `A3` —— 若某次改动让 A3 永不命中，
     第一条会静默变成「无意义排除」，第二条会转红。
-->

# 部署到 staging

```bash
npm run build
rsync -az dist/ deploy@staging:/srv/app/
```

部署完成后到 staging 上跑一次冒烟：

```bash
ssh deploy@staging 'cd /srv/app && ./smoke.sh'
```

回滚：把上一版产物重新 `rsync` 上去即可（产物目录本身是幂等的）。
