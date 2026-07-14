---
name: infinisynapse-server-api
description: |
  InfiniSynapse Server HTTP API、SSE 长任务、任务管理、数据源、RAG、Skill 管理、上传下载、Partner SSO、SDK 和后端集成。
  激活条件:
    - 用户写 SDK、后端 route、API proxy、mini-app 或直接 curl 调 InfiniSynapse
    - 代码出现 /api/ai/events、/api/ai/message、taskId、connId、SSE
    - 用户问数据源、RAG、Skill、文件上传、workspace 产物、下载预览
    - 用户要做「使用 InfiniSynapse 登录」或代用户发起任务（Partner SSO）
---

# InfiniSynapse Server API

先读:

- `docs/reference/capabilities.md`（平台能做什么）+ `docs/reference/api-index.md`（端点总目录）+ `docs/reference/task-lifecycle.md`（SSE/任务时序）— 先定位
- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` — 详细原文
- `upstream-docs/infinisynapse-site/markdown/server-api-reference.md` 作为英文补充参考
- `docs/QUICK-REFERENCE.md`
- 桌面 / 原生 BYOK 场景另读 `docs/playbooks/desktop-native-byok.md`

可复制的参考实现: `samples/sdk/typescript/`、`samples/sdk/python/`、`samples/templates/curl-quickstart.md`。

## 基本约束

- Base URL 中国大陆: `https://app.infinisynapse.cn`
- Base URL 海外: `https://app.infinisynapse.com`
- 私有化部署: 替换为自有服务地址。
- 所有 Server API endpoint 都以 `/api` 开始。
- 默认认证: `Authorization: Bearer <API Key>`。
- API Key 必须在服务端或本机可信原生层，不能进 renderer / WebView / 前端 bundle。
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
- For desktop/native BYOK, renderer/WebView only calls controlled IPC/native bridge; the trusted main/native side stores the key, opens SSE, and sends messages.
- Use `chatSettings: { "mode": "act" }` when a product should run an acting Agent flow; use `mode: "plan"` plus explicit approve/toggle when a human must review the plan first.
- Cancel through `POST /api/ai/message` with `type: "cancelTask"`; keep `/api/ai_task/cancelTask?taskId=` only as legacy fallback.
- Read workspace artifacts for reports, charts, PDFs, Word files, and images.
- On worker crash, SSE idle, or product-level timeout, re-read task state/workspace and salvage complete required artifacts before marking the business task failed; user-initiated cancellation normally skips user-facing salvage unless the product explicitly promises partial delivery.
- Use one shared artifact finalization writer for normal completion, salvage, recovery cron, and backfill; cross-process recovery should claim work with an atomic conditional update before finalizing.
- Configure ordinary JSON requests, SSE response-header connect, multipart upload, binary download, and product runtime as separate timeout layers; calibrate bounded connect/request windows from production latency and proxy budgets. After SSE connects, use AbortSignal plus idle/runtime guards instead of a stream-wide HTTP timeout.
- A client timeout on `/api/ai/message` does not prove that `newTask`, `askResponse`, mode toggle, or cancel was rejected upstream. Without a provider idempotency key, do not auto-replay writes; persist dispatch state and reconcile by `taskId` before deciding whether a retry is safe.
- Treat `downloadTaskFile` / `downloadZip` as untrusted binary streams: check `Content-Length` before reading when present, count bytes while streaming when absent, and abort when single-file or task-level byte budgets are exceeded.
- In production products with their own artifact store, user downloads should prefer archived storage and fail closed with a clear product error when the archived object is missing or oversized; provider workspace fallback is for internal recovery/backfill, not a long-term download SLA.

## Upload modes

| Endpoint | When to use |
| --- | --- |
| `/api/ai/upload?taskId=` | Agent asks for `upload_file_to_sandbox` |
| `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` | Product proactively archives source documents |
| `/api/upload/:directory` | Generic file upload |

## Skill 管理（上游 server-api §6）

- 用户级 Skill：`/api/ai_skill/install|update|uninstall|toggleStatus|installedVersions|list`；本地上传 `/api/ai_skill/upload`（zip 内任意层级须含 `SKILL.md`）、`editLocal`、`deleteLocal/:id`。active 后 Agent 可 `use_skill` 跨任务复用。
- Skill 市场发现走账号 API（`https://api.infinisynapse.cn/api`）：`/skill/public/getSkillList`、`/skill/getSkillTags`、`/skill/downloadSkill`。
- **两类 Skill 别混**：单次任务的方法论/`SKILL.md` 上下文（如报告快写）不装用户级 Skill——目录树写进任务 prompt，文件走 `upload_file_to_sandbox` 响应链路，只影响本次任务。
- 需要长期复用才安装用户级 Skill；与数据源/RAG 一样，在 `newTask` 前准备好。

## Partner SSO（何时用，端点见 `docs/reference/api-index.md` §8）

- 产品需要「使用 InfiniSynapse 登录」或代用户发起任务（计费记用户账上）时使用；普通自有账号体系 + 自持 API Key 的产品不需要。
- 走账号 API：`POST /api/auth/partner/sessions` → 用户在 app 域登录 → 回调一次性 `code`（5 分钟）→ `POST /api/auth/partner/token` 换用户资料；服务端间鉴权用 `X-Client-Id` + `X-Client-Secret`。
- `withApiKey: true` 可签发该用户的 Partner API Key（`sk-` 开头）：归属用户本人、用户可吊销、可能签发失败要降级；与 `clientSecret` 一样只能放服务端。
- 换到的 Partner API Key 调开放 API 时用主应用域名（`https://app.infinisynapse.cn/api/...`），不是 `api.` 域名；`newTask` 建议服务端预生成 `taskId`（UUID）做幂等。
- 必须校验 `state` 防 CSRF；Webhook `partner.session.completed` 用 `X-Infini-Signature`（HMAC-SHA256）验签，且只作异步通知，登录主流程以 code 兑换为准。

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

If an endpoint is not in the upstream snapshots, search before using it:

```bash
rg "/api/<name>|<keyword>" upstream-docs/infinisynapse-site/zh/markdown/
```

Partner SSO 端点在 `partner-sso-integration-guide.md`；Skill 管理在 `server-api-reference.md` §6；官方浓缩版综合指南在 `vibe-coding-guide.md`。
