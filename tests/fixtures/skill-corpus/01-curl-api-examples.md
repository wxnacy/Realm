<!--
  语料夹具（Phase 51 SEC-06 零误伤回归用）——**本仓自撰**，不复制上游字节。

  复刻条目：`51-RESEARCH.md` 实测 7 的「❌ 看似危险但实测不能收」表第 1 行
  —— 裸 `curl`（`/\bcurl\b/i`）：实测误伤 **25** 处，实例 `skills/claude-api/curl/examples.md`
  整篇是 curl 示例。

  本文件的全部内容都**必须零命中** `SKILL_THREAT_PATTERNS`：
  合法的 API 调用示例会自然地出现 `curl`，把裸 `curl` 收进模式表会让官方技能无法导入。
-->

# 调用示例（API 文档节选）

所有请求都需要 `authorization` 头。把示例里的占位符替换成你自己的值。

```bash
curl -X POST https://api.example.com/v1/messages \
  -H "content-type: application/json" \
  -H "authorization: Bearer YOUR_TOKEN_HERE" \
  --data-binary '{"model":"example-large","max_tokens":64,"messages":[{"role":"user","content":"hi"}]}'
```

也可以只做一次连通性检查：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.example.com/v1/health
```
