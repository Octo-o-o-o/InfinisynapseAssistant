# InfiniSynapse TypeScript SDK（参考实现）

零运行时依赖的 InfiniSynapse Server API 客户端，用 Node 18+ 原生 `fetch`。**仅服务端使用**——不要把带 API Key 的代码打进前端 bundle。

契约对齐 [`docs/reference/api-index.md`](../../../docs/reference/api-index.md) 与 [`task-lifecycle.md`](../../../docs/reference/task-lifecycle.md)。这是教学/起步骨架，不是官方发布的 npm 包。

## 文件

| 文件 | 作用 |
| --- | --- |
| `src/client.ts` | `InfiniSynapseClient`：覆盖文档端点、信封/错误处理、multipart 上传、二进制下载 |
| `src/sse.ts` | 纯函数 SSE 解析器（`SseParser`）+ 流消费器，无 I/O，可离线测试 |
| `src/accumulate.ts` | `TextAccumulator`：按 `ts` 覆盖合并流式文本快照 |
| `src/reconnect.ts` | 重连纯函数：指数退避、断点续传消息挑选 |
| `src/runTask.ts` | 高阶 `runTask()`：强制「先连 SSE → 发 newTask → 驱动到完成 → 读产物」铁律 |
| `src/types.ts` | API 类型定义 |
| `examples/express-proxy.ts` | 后端代理路由骨架（前端 → 你的后端 → InfiniSynapse） |
| `examples/live-smoke.ts` | opt-in 真实 API 冒烟（需 Key，会计费；`npm run smoke:live`） |
| `test/sse.test.ts` 等 4 个 `*.test.ts` | 离线单测：SSE 解析 / 文本累积 / 重连 / 取消（不触网） |
| `test/integration-mock.test.ts` | 集成测试：用 `samples/mock-server/` 走真实 HTTP + SSE 全链路（不触外网） |

## 快速开始

```ts
import { InfiniSynapseClient, runTask } from "./src/index.ts";

const client = new InfiniSynapseClient({
  apiKey: process.env.INFINISYNAPSE_API_KEY!, // 仅服务端
  region: "cn", // 海外用 "com"；私有化部署用 baseUrl
});

const result = await runTask(client, {
  text: "分析最近一个月的销售趋势，输出 PDF 报告",
  onText: (t) => process.stdout.write(t), // 实时进度
});

console.log(result.status); // "completed" | "error" | "aborted"
// 产物来自工作区，不是只读最后一条文本：
for (const f of result.workspace?.files ?? []) {
  console.log("产物:", f.path ?? f.name);
}
```

`runTask` 自动处理：生成 `connId`/`taskId`、先连 SSE 再发 `newTask`、按 `ts` 累积文本（避免快照重复拼接）、`upload_file_to_sandbox` 回调（按 ts 去重）、`completion_result` 完成判定、`notification.type=error` 失败、完成后读 `getTaskWorkspace`。

SDK 会过滤带有其他 `taskId` 的用户级 SSE 广播；旧事件缺少 `taskId` 时为兼容而放行。普通请求、SSE 建连、multipart 上传和二进制下载分别使用 `timeoutMs`（30s）、`sseConnectTimeoutMs`（30s）、`uploadTimeoutMs`（120s）和 `downloadTimeoutMs`（300s），SSE 建连成功后的流不设总超时。任务未完成即因外部 abort/超时/重连耗尽退出时，`runTask` 默认 best-effort 调用 `cancelTask`；恢复交接或优雅停机请传 `cancelOnExit:false`。

### SSE 重连（默认开启）

长任务连接可能中途断开。`runTask` 内置重连：

- **指数退避**：`baseDelayMs * 2^(n-1)`，封顶 `maxDelayMs`，连续失败超过 `maxRetries` 才放弃。
- **心跳看门狗**：`heartbeatTimeoutMs` 内没有任何事件（含 heartbeat）就判定连接死亡并重连。
- **断点续传**：重连后用 `getUiMessageById` 补回断线期间错过的消息（按 `ts` 去重）。
- 收到任意事件会把失败计数清零；`result.reconnects` 记录重连次数。

```ts
const result = await runTask(client, {
  text,
  reconnect: { maxRetries: 5, baseDelayMs: 500, maxDelayMs: 10000, heartbeatTimeoutMs: 30000 },
});
// 关闭重连：reconnect: { enabled: false }
```

纯函数 `nextBackoffMs` / `selectMissedMessages` 可离线测试（见 `test/reconnect.test.ts`，含 fake-client 真实走一遍断开→重连→完成）。

## 直接用底层 client

```ts
const stream = await client.openEvents(connId);        // 1. 先连 SSE
await client.newTask({ text, connId, taskId });         // 2. 再发任务
// ... consumeSseStream(stream, onEvent) 驱动 ...
const ws = await client.getTaskWorkspace(taskId);       // 3. 读产物
const bytes = await client.downloadTaskFile(taskId, ws.files[0].path!); // 二进制
```

## 后端代理架构（默认）

```text
前端 / mini-app  →  你的后端（持有 API Key）  →  InfiniSynapse Server API
```

见 `examples/express-proxy.ts`。要点：API Key 只在后端；`taskId`/`connId`/产物路径落自家库；前端只拿业务结果。

## 验证

```bash
npm test           # 离线单测 + mock server 集成测试（Node >= 22.6）
npm run check      # 对每个 src/*.ts 做语法检查
npm run typecheck  # 需先 npm i；express-proxy 依赖可选 express，已从类型检查排除

# 拿到真实 Key 后的端到端冒烟（opt-in，会创建真实任务并计费）
INFINISYNAPSE_API_KEY=sk-xxx npm run smoke:live
```

> `npm test` 不连真实 API：单测验证纯函数契约，集成测试跑在本地 `samples/mock-server/` 上（只覆盖已文档化行为子集）。接入真实环境时把 `apiKey` 放进服务端密钥管理，并先在 `https://app.infinisynapse.cn/tasks` 的 **API Key Management** 创建 Key，再用 `smoke:live` 验证。

## 安全红线

- API Key 只放服务端，绝不进前端/移动端/截图/公开仓库。
- 下载端点（`downloadTaskFile`/`downloadZip`）返回二进制，不要当 `{code,message,data}` 解析。
- 区分两类上传：`uploadToSandbox`（响应 Agent）vs `taskUpload`（主动归档）。
