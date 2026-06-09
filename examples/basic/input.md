---
title: 发布控制台更新
description: TwoRiver 团队的发布说明
---

# 发布控制台

TwoRiver 使用 Fastify 提供 API，并把内容索引写入 SQLite。

运行 `pnpm build` 后，检查 [发布清单](https://example.com/releases)。

```ts
const table = "posts";
console.log(`Syncing ${table}`);
```

![TwoRiver dashboard](./dashboard.png)
