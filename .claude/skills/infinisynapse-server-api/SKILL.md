---
name: infinisynapse-server-api
description: |
  InfiniSynapse Server HTTP API、SSE 长任务、任务管理、数据源、RAG、上传下载、SDK 和后端集成。
  激活条件:
    - 用户写 SDK、后端 route、API proxy、mini-app 或直接 curl 调 InfiniSynapse
    - 代码出现 /api/ai/events、/api/ai/message、taskId、connId、SSE
    - 用户问数据源、RAG、文件上传、workspace 产物、下载预览
---

# InfiniSynapse Server API

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md`
- `upstream-docs/infinisynapse-site/markdown/server-api-reference.md` 作为英文补充参考
- `docs/QUICK-REFERENCE.md`

## 基本约束

- Base URL 中国大陆: `https://app.infinisynapse.cn`
- Base URL 海外: `https://app.infinisynapse.com`
- 私有化部署: 替换为自有服务地址。
- 所有 Server API endpoint 都以 `/api` 开始。
- 默认认证: `Authorization: Bearer <API Key>`。
- 默认响应 envelope: `{ code, message, data }`，但下载接口直接返回二进制。
- SaaS API Key 在 `https://app.infinisynapse.cn/tasks` 左下角设置菜单的 **API Key Management** 里创建和查看。
- `https://app.infinisynapse.cn/tasks` 可作为开发者后台: API 创建的任务会出现在 **ALL TASKS**，可回看状态、消息、执行过程和工作区产物。
- 默认计算资源是 `public-engine`；需要稳定配额、资源隔离或独占执行环境时，创建并切换独占计算资源。

## 长任务标准流程

```text
GET /api/ai/events?connId=<uuid>
POST /api/ai/message { type: "newTask", text, connId, taskId? }
SSE: message.partial / message.add / notification / heartbeat
POST /api/ai/message { type: "askResponse", taskId, connId, askResponse: "messageResponse", text? }
GET /api/ai_task/getTaskWorkspace/:id
POST /api/ai_task/previewFile
GET /api/tools/storage/downloadTaskFile/:taskId?path=
```

## Implementation rules

- Always connect SSE before `newTask`.
- Generate `connId`; generate `taskId` yourself if resume/polling/concurrency matters.
- Treat `notification.type=error` as task failure.
- Persist `taskId`, `connId`, upload file mappings, and final artifact paths in your own DB.
- Do not expose API Key to frontend.
- Use `chatSettings: { "mode": "act" }` when a product should run an acting Agent flow.
- Read workspace artifacts for reports, charts, PDFs, Word files, and images.

## Upload modes

| Endpoint | When to use |
| --- | --- |
| `/api/ai/upload?taskId=` | Agent asks for `upload_file_to_sandbox` |
| `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` | Product proactively archives source documents |
| `/api/upload/:directory` | Generic file upload |

## Common endpoints

- `GET /api/ai/events`
- `POST /api/ai/message`
- `GET /api/ai/state?taskId=`
- `GET /api/ai_browser/session`
- `GET /api/ai_task/list`
- `GET /api/ai_task/getUiMessageById?id=`
- `GET /api/ai_task/getTaskWorkspace/:id`
- `POST /api/ai_task/previewFile`
- `GET /api/ai_database/list`
- `POST /api/ai_database/enabled`
- `GET /api/ai_rag_sdk`
- `POST /api/ai_rag_sdk/enabled`

## Do not invent

If an endpoint is not in `server-api-reference.md`, search before using it:

```bash
rg "/api/<name>|<keyword>" upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md
```
