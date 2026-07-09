# InfiniSynapse 长任务生命周期与 SSE 参考

> 配合 [api-index.md](api-index.md) 使用。本文聚焦「SSE 长连接 + 消息投递」异步模式的完整时序、事件语义、恢复与取消。
> 事实来源：`upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` 第 2、9、10 节。

## 心智模型

AI 任务是**异步**的：`POST /api/ai/message` 本身只返回执行结果，真正的进度和产物**通过 SSE 推送**。所以顺序是铁律：

```text
先 GET /api/ai/events（SSE）  →  再 POST /api/ai/message（newTask）
```

反过来（先发任务再连 SSE）会丢掉早期事件，`state.ready` 和首批 `message.partial` 可能永远收不到。

## SSE 事件类型

每条格式为 `event: <event>\ndata: <JSON>\n\n`。

| event | data | 处理建议 |
| --- | --- | --- |
| `message.add` | `{ taskId, message }` | 追加一条消息 |
| `message.update` | `{ taskId, message }` | 更新已有消息 |
| `message.partial` | `{ taskId, message }` | 流式增量；按 `taskId + message.ts` 覆盖/合并，避免重复拼接或落库爆量 |
| `message.remove` | `{ taskId, messageTs: number[] }` | 移除指定消息 |
| `state.ready` | `{ taskId }` | 状态就绪，可随后 `GET /api/ai_task/tasks` 全量拉取 |
| `notification` | `{ type, title, message, duration? }` | `type==='error'` 视为任务失败；`type==='success'` 且消息表明完成时也可作为完成信号 |
| `heartbeat` | `"ping"` | 保活，忽略 |

> 如果同一 SSE 连接收到其他任务的事件，必须按 `data.taskId` 过滤到当前业务任务。不要把旧任务事件写进当前业务状态。

## Agent 消息字段（消费 `message.add` / `message.partial` 里的 `data.message`）

| 字段 | 取值 | 含义 |
| --- | --- | --- |
| `message.type` | `say` / `ask` | `say`=Agent 输出；`ask`=等待客户端响应 |
| `message.text` | 字符串 | 流式或最终文本；`partial=true` 时为增量/覆盖 |
| `message.say` | `completion_result` | 任务完成信号之一 |
| `message.ask` | `completion_result` | 任务完成信号之一 |
| `message.ask` | `plan_mode_response` | PLAN MODE 下的计划输出信号；仅当 `text`/payload 内有非空 `response` 或完整计划正文时，才可作为"等待人工审批"的完成点 |
| `message.ask` | `upload_file_to_sandbox` | Agent 请求把本地文件上传到当前任务沙箱 |
| `message.ask` | `api_req_failed` | 上游模型/余额/额度请求失败；应标记业务任务失败并落库错误 |

> 完成判定：收到 `message.say==='completion_result'` **或** `message.ask==='completion_result'`。两者都要判，不要只判一个。部分运行会以 `notification.type==='success'` + "完成" 类消息结束，也要作为完成信号兜底。两段式 plan/act 中，非空 `message.ask==='plan_mode_response'` 表示计划可交给用户审批，不等同于 act 已完成；空 `response`、`message.partial` 里的工具重试片段、以及服务端回显的原始 prompt 都不能直接当作计划完成。

## 标准时序

```text
0. （可选）准备资源与 Skill：数据库/RAG list+enabled；需要长期复用的方法论先装用户级 Skill
   （/api/ai_skill/install 或 upload）；只对单次任务生效的 SKILL.md 上下文走任务文件上传链路。
1. 生成 connId（UUID）。需要并发安全/稳定轮询时，同时预生成 taskId（UUID）。
2. GET /api/ai/events?connId=<connId>            # 建立 SSE，等待 state.ready 或短超时（如 3s）
3. POST /api/ai/message                          # type=newTask, text, connId, taskId?, chatSettings:{mode:"act"}
4. 循环消费 SSE：
     message.partial / message.add  → 先按 taskId 过滤，再推进 UI 进度、按 ts 合并文本
     notification.type==="error" 或 message.ask==="api_req_failed" → 标记失败、结束
     message.ask==="upload_file_to_sandbox" → 见下方「Agent 请求上传」
     message.say/ask==="completion_result" 或 success notification → 跳出循环
5. 读取产物（不要只用最后一条文本）：
     GET  /api/ai_task/getTaskWorkspace/:taskId   # 枚举 .md/.pdf/.docx/图表
     POST /api/ai_task/previewFile                # { taskId, fileName } 预览文本
     GET  /api/tools/storage/downloadTaskFile/:taskId?path=  # 下载二进制
```

`getTaskWorkspace` 的 `files` 在不同部署/版本中可能返回 `"scorecard.json"` 这样的字符串路径，也可能返回 `{ path/name/type/... }` 对象。下游应统一提取 `path ?? name ?? string` 后再匹配产物名。

### Agent 请求上传（`upload_file_to_sandbox`）

```text
收到 message.type==="ask" 且 message.ask==="upload_file_to_sandbox"
  → POST /api/ai/upload?taskId=<taskId>          # multipart 字段 file
  → POST /api/ai/message                          # type=askResponse, askResponse="messageResponse",
                                                   #   同一 taskId+connId, text=上传结果 JSON
```

### 多轮追问 / 修订

```text
POST /api/ai/message  # type=askResponse, taskId（同一个）, askResponse="messageResponse", text=新要求
```

继续**同一个 `taskId`**，不要每轮新建任务（会丢上下文）。

### 取消

```text
POST /api/ai/message  # type=cancelTask, taskId=<taskId>
```

优先走 `/api/ai/message` 的 `cancelTask` 类型。部分部署上的 `/api/ai_task/cancelTask?taskId=` 可能不可用；若兼容旧代码，可把它作为 fallback。取消前后都要在自己业务库标记任务状态。

## 恢复设计（必须前置）

mini-app 刷新页面后要能恢复，服务端至少持久化：`businessUserId`、`taskId`、`connId`、`status`、`userInput`、`uploadedFiles`、`workspaceFiles`、`finalArtifactPath`、`error`。

恢复路径：

```text
GET /api/ai_task/getUiMessageById?id=<taskId>   # 瘦身 UI 消息，判断是否已 completion_result
GET /api/ai_task/getTaskWorkspace/:taskId       # 重新枚举产物
```

## 健壮性清单

- **SSE 重连**：连接断开要带同一 `connId` 重连；重连后用 `getUiMessageById` 补齐错过的消息。
- **SSE 建连超时、流不限时**：`GET /api/ai/events` 的建连（响应头返回前）要设超时（如 30s，与普通 REST 一致），否则握手挂死会永久占用 consumer；建连成功后**不要**给流本身设总超时——长任务事件流可持续数小时，流的生命周期交给调用方的 AbortSignal + idle 超时判定（见"心跳"条）。
- **"先 SSE 后 newTask"收敛为单点 launcher**：业务后端若有多条任务提交路径（主任务、复核子任务、深研 child task……），不要在每条路径手写时序——封装一个 launcher 模板（openEvents → 注册 consumer → 记录已连接 → createTask → 记录已提交 → 后台消费；任一步失败则 abort + 注销 consumer + 原样抛错，失败后的业务补偿留在调用方），铁律只在这一个函数里强制。配一个 mock client 按调用顺序断言的测试（如 `["openEvents","createTask"]` 序列断言），任何新增提交路径改动都无法绕过时序检查。
- **阶段切换后继续消费**：plan 阶段为了进入人工审批可能会停止当前 consumer；approve 后、发送 act prompt 前要重新建立/确认 SSE consumer。
- **首事件超时**：连上 SSE 后等 `state.ready` 设 2~3s 超时兜底，超时也继续发 `newTask`（文档允许）。
- **心跳**：`heartbeat` 仅保活；长时间无任何事件（含心跳）才判定连接死亡。
- **业务总超时和预算守卫**：除 SSE idle timeout 外，产品层还要有总耗时、可识别工具事件、child task 数、repair 轮数等预算。Prompt 中的"最多搜索 N 次/最多引用 N 个来源"只是软目标，不是服务端硬限制；真正的硬边界要由业务后端计时、计数并在超限时调用 `/api/ai/message` `type=cancelTask`。
- **超时恢复**：取消或失败后不要只丢弃任务；先用 `getTaskWorkspace` 枚举已有产物，`previewFile` 校验必需文件和 schema。产物完整可按业务规则归档，产物不完整则保留失败状态和可审计错误。
- **错误即终止**：`notification.type==='error'`、`message.ask==='api_req_failed'` 或信封 `code` 非 200 要终止并落库。`Insufficient account balance` 属于账户余额/额度问题，需要换 Key 或充值后重试。
- **下载是二进制**：`downloadTaskFile`/`downloadZip`/`storage/download` 返回流，不要按 `{code,message,data}` 解析（见 api-index.md 末尾清单）。
- **资源先于任务**：数据库/RAG 要在 `newTask` **之前** list+enabled，否则 Agent 看不到。
- **后台通知不是 provider webhook**：按当前公开 Server API，InfiniSynapse 通过 SSE 和查询接口暴露完成状态；如果业务产品要在用户离开页面后继续运行并发送邮件/站内信，必须由业务后端 worker 托管 SSE 生命周期。后端重启后用 `getUiMessageById` + `getTaskWorkspace` 恢复，再幂等发送通知。
- **产物目录语义由业务侧定义**：InfiniSynapse 只返回 workspace 文件列表，不理解 `working/`、`final/` 或你的报告 schema。报告类产品若让 Agent 写中间草稿，应由业务侧只收集 `final/` 下的 canonical artifacts，并兼容旧任务的根目录产物。

## 与产品模式的对应

| 产品 | 是否需 Browser Use | 完成后主要读什么 | 恢复 |
| --- | --- | --- | --- |
| 高考助手 / 表单报告 | 否 | `getTaskWorkspace` → `downloadTaskFile`（PDF） | `getUiMessageById` |
| 购物比价 / 网页研究 | 是（先查 `/api/ai_browser/session`） | SSE 实时消息为主 | `getUiMessageById` |
| 报告快写 | 否 | `getTaskWorkspace` + `previewFile` + `inline=1` 预览 | `getUiMessageById` + workspace |

产品级编排详见 `.agents/skills/infinisynapse-product-patterns/SKILL.md`。
