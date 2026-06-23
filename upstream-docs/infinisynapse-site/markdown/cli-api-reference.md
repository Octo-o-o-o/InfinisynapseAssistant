# InfiniSynapse CLI API Reference


`agent_infini` is the command-line tool of the InfiniSynapse platform, intended for end users and AI Agent workflows. This document organizes **all the backend service endpoints** the CLI calls during operation, including endpoint addresses, request methods, parameters, purposes, and the CLI commands they correspond to—making it easy to troubleshoot issues, build secondary integrations, or verify network connectivity for on-premises deployments.

## 1. Service Endpoint Overview

The CLI communicates with two types of services:

| Service | Default address | Role |
|----|----|----|
| Main application service (Server) | `https://app.infinisynapse.cn` | Core capabilities such as task conversations, database/RAG management, workspace files, etc. |
| Console authentication service (Console) | `https://api.infinisynapse.cn/api` | Validates the API Key and obtains the user identity (`userId`) |

Both addresses can be overridden in `~/.agent_infini/config.txt`: `server` corresponds to the main application service, and `console` corresponds to the console authentication service.

### Common Request Conventions

- **Authentication**: unless otherwise noted, all requests carry the `Authorization: Bearer <api-key>` request header.
- **Language**: main application requests include the `x-lang` header (taken from the `prefer-language` configuration, default `zh_CN`).
- **Content type**: `Content-Type: application/json`.
- **Unified response body**: main application endpoints return `{ code, message, data }`, where `code != 200` is treated as an error; a `code` of `1101` / `1105` indicates the Token has expired or is invalid.
- **Timeout**: 100 seconds for ordinary requests; no timeout for SSE streaming connections; 15 seconds for console authentication requests.

## 2. Console Authentication Service

### 2.1 Get User Information

- **Endpoint**: `GET {console}/user/profile`
- **Purpose**: validate the API Key and retrieve the `userId` during `agent_infini init`, writing it to the local configuration.
- **Request header**: `Authorization: Bearer <api-key>`
- **Response**: `{ code, message, data: { userId } }`
- **Corresponding command**: `agent_infini init --api-key <key>`

> This is the only endpoint that calls the console service; all other commands only access the main application service.

## 3. Main Application Service Endpoints

### 3.1 AI Task Conversation (Streaming)

Multi-turn conversation uses a combination of "SSE subscription + POST to send messages": first establish an SSE long connection to listen for events, then deliver instructions via the message endpoint, and the server pushes replies in real time to the SSE channel.

#### Subscribe to the Event Stream

- **Endpoint**: `GET /api/ai/events?connId=<uuid>`
- **Method**: SSE (`Accept: text/event-stream`), long connection with no timeout.
- **Purpose**: receive events such as `message.partial` / `message.add` / `message.update` / `state.ready` / `notification` / `heartbeat`.
- **Corresponding commands**: `agent_infini task new`, `agent_infini task ask`

#### Send a Message

- **Endpoint**: `POST /api/ai/message`
- **Request body**: `WebviewMessage`, distinguished by `type` according to the scenario:
  - `newTask`: create a new task, carrying `text` (the query content) and `connId`
  - `askResponse`: follow up within an existing task, carrying `text`, `connId`, `taskId`, `askResponse: "messageResponse"`
  - `cancelTask`: cancel a running task, carrying `taskId`
- **Corresponding commands**: `task new`, `task ask`, `task cancel`

### 3.2 AI Task Management

| Endpoint | Method | Purpose | Corresponding command |
|----|----|----|----|
| `/api/ai_task/list` | GET | Paginated query of the task list, parameters `page`, `pageSize`, `field=updated_at`, `order=desc`, optional `task_name` (search by name) | `task ls` |
| `/api/ai_task/getTaskInfo/{taskId}` | GET | Query task details and status | `task show`, status supplement after `task new`/`task ask` finishes |
| `/api/ai_task/getUiMessageById?id={taskId}` | GET | Fetch the task's UI message list, used to extract the latest valid message | `task show` |
| `/api/ai_task/getTaskWorkspace/{taskId}` | GET | Get task workspace information (`cwd` and the file list) | `task show`, `task file`, and supplemented after the conversation ends |
| `/api/ai_task/deleteTaskWithId` | POST | Batch delete tasks, request body `{ ids: [...] }` | `task rm` |
| `/api/ai_task/previewFile` | POST | Preview workspace file content, request body `{ taskId, fileName }`, returns `{ content, fileType }` | `task preview` |

### 3.3 Database Connection Management

| Endpoint | Method | Purpose | Corresponding command |
|----|----|----|----|
| `/api/ai_database/list` | GET | List database connections, parameters `page`, `pageSize`, `field`, `order`, `source=all`, optional `name`, `type`, `enabled` (`1`/`0`) | `db ls`, `task context` |
| `/api/ai_database/enabled` | POST | Enable/disable databases, request body `{ ids: [...], enabled: 1|0 }` | `db enable`, `db disable` |

Supported database types: `mysql`, `postgres`, `sqlite`, `sqlserver`, `clickhouse`, `snowflake`, `doris`, `starrocks`, `gbase`, `kingbase`, `dm`, `supabase`, `deltalake`, `file`.

### 3.4 RAG Knowledge Base Management

| Endpoint | Method | Purpose | Corresponding command |
|----|----|----|----|
| `/api/ai_rag_sdk` | GET | List RAG knowledge bases, parameters `page`, `pageSize`, `field`, `order`, `source=all`, optional `keyword`, `enabled` | `rag ls`, `task context` |
| `/api/ai_rag_sdk/enabled` | POST | Enable/disable RAG, request body `{ ids: [...], enabled: 1|0 }` | `rag enable`, `rag disable` |

### 3.5 Workspace File Download

- **Endpoint**: `GET /api/tools/storage/downloadTaskFile/{taskId}?path=<fileName>`
- **Purpose**: download a file from the task workspace to local, returning a raw binary stream (not the unified JSON response).
- **Corresponding command**: `agent_infini task download <taskId> <fileName> -o <dir>`

## 4. Command-to-Endpoint Quick Reference

| CLI command | Endpoint(s) called |
|----|----|
| `init` | `GET {console}/user/profile` |
| `task new` | `GET /api/ai/events`, `POST /api/ai/message`(newTask), then `getTaskInfo`, `getTaskWorkspace` after finishing |
| `task ask` | `GET /api/ai/events`, `POST /api/ai/message`(askResponse), then `getTaskInfo`, `getTaskWorkspace` after finishing |
| `task cancel` | `POST /api/ai/message`(cancelTask) |
| `task ls` | `GET /api/ai_task/list` |
| `task show` | `getTaskInfo`, `getUiMessageById`, `getTaskWorkspace` (concurrent) |
| `task rm` | `POST /api/ai_task/deleteTaskWithId` |
| `task context` | `GET /api/ai_database/list`, `GET /api/ai_rag_sdk` (concurrent) |
| `task file` | `GET /api/ai_task/getTaskWorkspace/{taskId}` |
| `task preview` | `POST /api/ai_task/previewFile` |
| `task download` | `GET /api/tools/storage/downloadTaskFile/{taskId}` |
| `db ls` | `GET /api/ai_database/list` |
| `db enable` / `db disable` | `POST /api/ai_database/enabled` |
| `rag ls` | `GET /api/ai_rag_sdk` |
| `rag enable` / `rag disable` | `POST /api/ai_rag_sdk/enabled` |
| `version` / `skill` / `--help` | Local commands, no network request |

## 5. Authentication and Troubleshooting

- **Token expired / invalid** (response `code` of `1101`, `1105`): re-run `agent_infini init` or modify the `api-key` in `~/.agent_infini/config.txt`.
- **Service unreachable**: check the `server` address and network connectivity; on-premises deployments must ensure the above endpoint paths are accessible to the CLI.
- **Task not found**: use `task ls` to get a valid `taskId`.
- **No available resources**: first use `task context` to check the enabled databases and RAG, then use `db enable` / `rag enable` to enable them.
