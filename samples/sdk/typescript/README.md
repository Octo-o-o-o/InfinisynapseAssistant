# InfiniSynapse TypeScript SDK（参考实现）

零运行时依赖的 InfiniSynapse Server API 客户端，用 Node 18+ 原生 `fetch`。**仅服务端使用**——不要把带 API Key 的代码打进前端 bundle。

契约对齐 [`docs/reference/api-index.md`](../../../docs/reference/api-index.md) 与 [`task-lifecycle.md`](../../../docs/reference/task-lifecycle.md)。这是教学/起步骨架，不是官方发布的 npm 包。

## 文件

| 文件 | 作用 |
| --- | --- |
| `src/client.ts` | `InfiniSynapseClient`：覆盖文档端点、信封/错误处理、multipart 上传、二进制下载 |
| `src/sse.ts` | 纯函数 SSE 解析器（`SseParser`）+ 流消费器，无 I/O，可离线测试 |
| `src/runTask.ts` | 高阶 `runTask()`：强制「先连 SSE → 发 newTask → 驱动到完成 → 读产物」铁律 |
| `src/types.ts` | API 类型定义 |
| `examples/express-proxy.ts` | 后端代理路由骨架（前端 → 你的后端 → InfiniSynapse） |
| `test/sse.test.ts` | 离线 SSE 解析器单测（不触网） |

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

`runTask` 自动处理：生成 `connId`/`taskId`、等 `state.ready`（带超时兜底）、累积文本、`upload_file_to_sandbox` 回调、`completion_result` 完成判定、`notification.type=error` 失败、完成后读 `getTaskWorkspace`。

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
npm test       # 运行离线 SSE 单测（Node >= 22.6）
npm run check  # 对每个 src/*.ts 做语法检查
npm run typecheck  # 需要 npm i 装 typescript 后才能跑完整类型检查
```

> 这些示例不会连真实 API；它们演示正确的调用契约。接入真实环境时把 `apiKey` 放进服务端密钥管理，并先在 `https://app.infinisynapse.cn/tasks` 的 **API Key Management** 创建 Key。

## 安全红线

- API Key 只放服务端，绝不进前端/移动端/截图/公开仓库。
- 下载端点（`downloadTaskFile`/`downloadZip`）返回二进制，不要当 `{code,message,data}` 解析。
- 区分两类上传：`uploadToSandbox`（响应 Agent）vs `taskUpload`（主动归档）。
