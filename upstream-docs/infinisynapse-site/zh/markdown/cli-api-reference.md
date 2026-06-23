# InfiniSynapse CLI API Reference


`agent_infini` 是 InfiniSynapse 平台的命令行工具，面向终端用户与 AI Agent 工作流。本文梳理该 CLI 在运行过程中调用的**全部后端服务接口**，包括接口地址、请求方式、参数、用途，以及它们对应的 CLI 命令，方便排查问题、做二次集成或私有化部署时核对网络连通性。

## 1. 服务端点概览

CLI 会与两类服务通信：

| 服务 | 默认地址 | 作用 |
|----|----|----|
| 主应用服务（Server） | `https://app.infinisynapse.cn` | 任务对话、数据库/RAG 管理、工作区文件等核心能力 |
| 控制台鉴权服务（Console） | `https://api.infinisynapse.cn/api` | 校验 API Key 并获取用户身份（`userId`） |

地址均可在 `~/.agent_infini/config.txt` 中覆盖：`server` 对应主应用服务，`console` 对应控制台鉴权服务。

### 通用请求约定

- **鉴权**：除特殊说明外，所有请求都带 `Authorization: Bearer <api-key>` 请求头。
- **语言**：主应用请求附带 `x-lang` 头（取自配置 `prefer-language`，默认 `zh_CN`）。
- **内容类型**：`Content-Type: application/json`。
- **统一响应体**：主应用接口返回 `{ code, message, data }`，`code != 200` 视为错误；`code` 为 `1101` / `1105` 时表示 Token 过期或失效。
- **超时**：普通请求 100 秒；SSE 流式连接无超时；控制台鉴权请求 15 秒。

## 2. 控制台鉴权服务

### 2.1 获取用户信息

- **接口**：`GET {console}/user/profile`
- **用途**：在 `agent_infini init` 时校验 API Key 并取回 `userId`，写入本地配置。
- **请求头**：`Authorization: Bearer <api-key>`
- **响应**：`{ code, message, data: { userId } }`
- **对应命令**：`agent_infini init --api-key <key>`

> 这是唯一调用控制台服务的接口，其余命令均只访问主应用服务。

## 3. 主应用服务接口

### 3.1 AI 任务对话（流式）

多轮对话采用「SSE 订阅 + POST 发送消息」的组合：先建立 SSE 长连接监听事件，再通过消息接口投递指令，服务端把回复实时推送到 SSE 通道。

#### 订阅事件流

- **接口**：`GET /api/ai/events?connId=<uuid>`
- **方式**：SSE（`Accept: text/event-stream`），长连接无超时。
- **用途**：接收 `message.partial` / `message.add` / `message.update` / `state.ready` / `notification` / `heartbeat` 等事件。
- **对应命令**：`agent_infini task new`、`agent_infini task ask`

#### 发送消息

- **接口**：`POST /api/ai/message`
- **请求体**：`WebviewMessage`，按场景区分 `type`：
  - `newTask`：新建任务，携带 `text`（查询内容）、`connId`
  - `askResponse`：在已有任务中追问，携带 `text`、`connId`、`taskId`、`askResponse: "messageResponse"`
  - `cancelTask`：取消运行中的任务，携带 `taskId`
- **对应命令**：`task new`、`task ask`、`task cancel`

### 3.2 AI 任务管理

| 接口 | 方式 | 用途 | 对应命令 |
|----|----|----|----|
| `/api/ai_task/list` | GET | 分页查询任务列表，参数 `page`、`pageSize`、`field=updated_at`、`order=desc`、可选 `task_name`（按名称搜索） | `task ls` |
| `/api/ai_task/getTaskInfo/{taskId}` | GET | 查询任务详情与状态 | `task show`、`task new`/`task ask` 结束后补充状态 |
| `/api/ai_task/getUiMessageById?id={taskId}` | GET | 拉取任务的 UI 消息列表，用于提取最近一条有效消息 | `task show` |
| `/api/ai_task/getTaskWorkspace/{taskId}` | GET | 获取任务工作区信息（`cwd` 与文件列表） | `task show`、`task file`，及对话结束后补充 |
| `/api/ai_task/deleteTaskWithId` | POST | 批量删除任务，请求体 `{ ids: [...] }` | `task rm` |
| `/api/ai_task/previewFile` | POST | 预览工作区文件内容，请求体 `{ taskId, fileName }`，返回 `{ content, fileType }` | `task preview` |

### 3.3 数据库连接管理

| 接口 | 方式 | 用途 | 对应命令 |
|----|----|----|----|
| `/api/ai_database/list` | GET | 列出数据库连接，参数 `page`、`pageSize`、`field`、`order`、`source=all`，可选 `name`、`type`、`enabled`（`1`/`0`） | `db ls`、`task context` |
| `/api/ai_database/enabled` | POST | 启用/停用数据库，请求体 `{ ids: [...], enabled: 1|0 }` | `db enable`、`db disable` |

支持的数据库类型：`mysql`、`postgres`、`sqlite`、`sqlserver`、`clickhouse`、`snowflake`、`doris`、`starrocks`、`gbase`、`kingbase`、`dm`、`supabase`、`deltalake`、`file`。

### 3.4 RAG 知识库管理

| 接口 | 方式 | 用途 | 对应命令 |
|----|----|----|----|
| `/api/ai_rag_sdk` | GET | 列出 RAG 知识库，参数 `page`、`pageSize`、`field`、`order`、`source=all`，可选 `keyword`、`enabled` | `rag ls`、`task context` |
| `/api/ai_rag_sdk/enabled` | POST | 启用/停用 RAG，请求体 `{ ids: [...], enabled: 1|0 }` | `rag enable`、`rag disable` |

### 3.5 工作区文件下载

- **接口**：`GET /api/tools/storage/downloadTaskFile/{taskId}?path=<fileName>`
- **用途**：下载任务工作区中的文件到本地，返回原始二进制流（非统一 JSON 响应）。
- **对应命令**：`agent_infini task download <taskId> <fileName> -o <dir>`

## 4. 命令与接口对照速查

| CLI 命令 | 调用的接口 |
|----|----|
| `init` | `GET {console}/user/profile` |
| `task new` | `GET /api/ai/events`、`POST /api/ai/message`(newTask)，结束后 `getTaskInfo`、`getTaskWorkspace` |
| `task ask` | `GET /api/ai/events`、`POST /api/ai/message`(askResponse)，结束后 `getTaskInfo`、`getTaskWorkspace` |
| `task cancel` | `POST /api/ai/message`(cancelTask) |
| `task ls` | `GET /api/ai_task/list` |
| `task show` | `getTaskInfo`、`getUiMessageById`、`getTaskWorkspace`（并发） |
| `task rm` | `POST /api/ai_task/deleteTaskWithId` |
| `task context` | `GET /api/ai_database/list`、`GET /api/ai_rag_sdk`（并发） |
| `task file` | `GET /api/ai_task/getTaskWorkspace/{taskId}` |
| `task preview` | `POST /api/ai_task/previewFile` |
| `task download` | `GET /api/tools/storage/downloadTaskFile/{taskId}` |
| `db ls` | `GET /api/ai_database/list` |
| `db enable` / `db disable` | `POST /api/ai_database/enabled` |
| `rag ls` | `GET /api/ai_rag_sdk` |
| `rag enable` / `rag disable` | `POST /api/ai_rag_sdk/enabled` |
| `version` / `skill` / `--help` | 本地命令，不发起网络请求 |

## 5. 鉴权与排错

- **Token 过期 / 失效**（响应 `code` 为 `1101`、`1105`）：重新执行 `agent_infini init` 或修改 `~/.agent_infini/config.txt` 中的 `api-key`。
- **服务不可达**：检查 `server` 地址与网络连通性；私有化部署需确保上述接口路径可被 CLI 访问。
- **任务找不到**：用 `task ls` 获取有效的 `taskId`。
- **无可用资源**：先用 `task context` 检查已启用的数据库与 RAG，再用 `db enable` / `rag enable` 启用。
