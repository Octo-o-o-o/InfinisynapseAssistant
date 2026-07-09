# InfiniSynapse Mock Server

零依赖（Node 18+）的 InfiniSynapse Server API 模拟器，用于在**没有真实 API Key** 的环境（本地开发、CI）给业务集成代码跑离线集成测试：先连 SSE → `newTask` → 消费事件 → 读 workspace 产物 → 下载二进制。

> **边界声明**：这不是官方模拟器。它只模拟本仓库 `docs/reference/` 已文档化的行为子集（SSE 事件格式、统一信封、二进制下载、两类上传的路由形状），没有真实 Agent、扣费、沙箱和权限。联调、验收和性能评估必须以真实 API 为准，方法见 `docs/playbooks/testing-and-evaluation.md`。

## 用法

### CLI

```bash
node samples/mock-server/server.mjs --port 8787
# 然后把业务后端 / SDK 的 baseUrl 指到 http://127.0.0.1:8787
```

### 测试内程序化启动

```js
import { startMockServer } from "../mock-server/server.mjs";

const srv = await startMockServer({ port: 0, stepDelayMs: 10 }); // port 0 = 随机端口
// ... new InfiniSynapseClient({ apiKey: "test-key", baseUrl: srv.url }) ...
await srv.close();
```

参考用例：`samples/sdk/typescript/test/integration-mock.test.ts`（已纳入 `npm test`）。

## 已模拟的端点

| 端点 | 行为 |
| --- | --- |
| `GET /api/ai/events?connId=` | SSE 流；heartbeat 保活（默认 15s，可配 `heartbeatMs`） |
| `POST /api/ai/message` | `newTask`（触发场景事件）/ `askResponse`（继续 upload 场景）/ `cancelTask` |
| `GET /api/ai/ping` | `{ ok: true }` |
| `GET /api/ai_task/getUiMessageById?id=` | 任务累计消息（断线恢复用） |
| `GET /api/ai_task/getTaskWorkspace/:id` | `{ cwd, files }` |
| `POST /api/ai_task/previewFile` | `{ content, fileType }` |
| `GET /api/tools/storage/downloadTaskFile/:taskId?path=` | 二进制流（不走 JSON 信封） |
| `POST /api/ai/upload?taskId=` | sandbox 上传占位（不解析 multipart 内容） |
| `POST /api/tools/taskUpload/:taskId` | 主动归档上传占位 |

缺 `Authorization: Bearer` 头一律返回 `code 1101`，可用来测试 token 失效分支。

## 场景（用 `newTask` 的 `text` 触发）

| text 标记 | 行为 |
| --- | --- |
| （默认） | `state.ready` → `message.partial` → `message.add` → 写 `report.md` → `completion_result` |
| `[mock:upload]` | 先发 `ask=upload_file_to_sandbox`，等收到 `askResponse` 后再走完成流程 |
| `[mock:error]` | 发 `notification` `type=error` |
