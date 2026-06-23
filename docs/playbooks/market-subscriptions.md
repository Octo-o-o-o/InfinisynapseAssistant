# 市场订阅 Playbook

> 特定用法总结：把"共享数据源 / 知识库市场的发现 → 订阅 → 回 Server API 启用"合并成默认流程。
> 关键坑：市场 API 走**账号 API base**（`https://api.infinisynapse.cn/api`），与 Server API（`https://app.infinisynapse.cn`）不是同一个地址。端点见 `docs/reference/api-index.md` §3/§4 末尾。

## 一句话规则

要用共享数据源/知识库，先在市场**订阅**（只订确认免费的），再回 Server API `list` + `enabled`，**最后才** `newTask`。

## 两套 base URL 别搞混

| 用途 | Base URL |
| --- | --- |
| 任务 / 数据源管理 / RAG 管理（Server API） | `https://app.infinisynapse.cn`（海外 `.com`） |
| 市场发现与订阅（账号 API） | `https://api.infinisynapse.cn/api`（海外 `.com/api`） |

两者鉴权都用 `Authorization: Bearer <token>`。

## 市场端点

| 数据源市场 | RAG 市场 | 用途 |
| --- | --- | --- |
| `GET /database-market/my` | `GET /rag-market/my` | 已拥有/已订阅条目（分页 + `keyword`） |
| `GET /database-market/public` | `GET /rag-market/public` | 公开条目（分页 + `keyword`） |
| `GET /database-market/is-subscribed/:id` | `GET /rag-market/is-subscribed/:id` | 是否已订阅 |
| `GET /database-market/detail/:id` | `GET /rag-market/detail/:id` | 详情：价格、名称、描述、审批快照 |
| `POST /database-market/subscribe` `{database_market_id}` | `POST /rag-market/subscribe` `{ragMarketId}` | 订阅 |

## 自动化订阅流程（安全）

1. 先查 `my`，确认是否已拥有/已订阅，避免重复。
2. 再查 `public`（按 `keyword`）找到目标条目。
3. 用 `detail/:id` **确认价格**。
4. **只对确认免费的条目** `subscribe`。
5. 若 `subscribe` 返回 `orderId` / `url` / `paymentUrl` → 表示**需要支付或进一步确认**，停下交人工，不要自动继续。
6. 订阅成功后**回到 Server API**找到并启用：
   - 数据源：`GET /api/ai_database/list?source=all&subscribeSource=all&name=<name>` → `POST /api/ai_database/enabled` `{ids, enabled:1}`
   - RAG：`GET /api/ai_rag_sdk?source=all&subscribeSource=all&keyword=<name>` → `POST /api/ai_rag_sdk/enabled` `{ids, enabled:1}`
7. 资源 `enabled` 之后，**才** `newTask`（否则 Agent 看不到）。

## 常见反模式

- 对未确认价格的市场条目直接 `subscribe`，可能产生扣费。
- 把市场 API 发到 Server API 的 `app.` 地址（应发 `api.` 账号地址）。
- 订阅后没回 Server API `enabled`，Agent 本轮任务看不到资源。
- 在 `newTask` 之后才订阅/启用。

## 检查清单

- 市场请求是否发到账号 API base（`api.infinisynapse.cn/api`）？
- 是否先 `my` 再 `public`，并用 `detail` 确认了价格？
- 是否只自动订阅了确认免费的条目？返回 `paymentUrl` 是否停下交人工？
- 订阅后是否回 Server API `list` 找到并 `enabled`？
- 资源是否在 `newTask` 之前已启用？
