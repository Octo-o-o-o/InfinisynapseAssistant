# InfiniSynapse Server API Reference


This document is the HTTP API reference for the InfiniSynapse Server, intended for external users/SDKs. With a single API Key (Bearer Token) you can directly invoke it to run multi-turn AI task conversations, manage data sources, manage RAG knowledge bases, upload and download files, and more—without relying on any frontend UI.

> If you only need command-line integration, refer to the "InfiniSynapse CLI API Reference" first; this document targets developers who need to issue HTTP requests directly.

## 1. Getting Started

### Basic Information

| Item | Value |
|----|----|
| Base URL (Mainland China) | `https://app.infinisynapse.cn` |
| Base URL (Overseas) | `https://app.infinisynapse.com` |
| Global path prefix | All endpoints start with `/api` |
| Authentication | HTTP header `Authorization: Bearer <API Key>` |
| Default content type | `application/json` (file uploads use `multipart/form-data`) |

> Users in Mainland China should use the `.cn` domain, and overseas users should use the `.com` domain; for on-premises deployments, replace it with your own service address. The examples below consistently use the `.cn` domain; for overseas environments, simply replace it with `.com`.

### Authentication

All business endpoints require a Bearer Token in the request header:

```
Authorization: Bearer <your API Key>
```


The server parses the user identity (`userId`) from the Token's `sub` claim, and all resources (tasks, data sources, knowledge bases, files) are isolated per user. A few endpoints marked "public read-only" require no authentication.

### Language

The optional request header `x-lang` controls the language of the prompt text returned by the server. Possible values: `zh_CN` (default), `en`, `ar`, `ja`, `ko`, `ru`.

```
x-lang: zh_CN
```


### Unified Response Structure

Most endpoints return a unified envelope:

```
{
  "code": 200,
  "message": "success",
  "data": { }
}
```


- `code === 200` indicates success, and the business data is in `data`.
- `code` of `1101` / `1105`: the Token has expired or is invalid, and the API Key needs to be replaced.
- Parameter validation failures return HTTP `422`, with `message` being the first validation error message.
- File download endpoints return a binary stream directly (`application/octet-stream` or `application/zip`) and do not use this envelope.

### Pagination Conventions

List endpoints (inheriting from the common pagination parameters) support the following Query parameters:

| Parameter | Type | Default | Description |
|----|----|----|----|
| `page` | number | 1 | Page number (starting from 1) |
| `pageSize` | number | 10 | Items per page (generally capped at 100; the data source list is capped at 10000) |
| `field` | string | \- | Sort field, e.g. `updated_at` |
| `order` | string | desc | Sort direction `asc` / `desc` |

The `data` structure of a paginated response:

```
{
  "items": [ ],
  "meta": {
    "itemCount": 10,
    "totalItems": 42,
    "itemsPerPage": 10,
    "totalPages": 5,
    "currentPage": 1
  }
}
```


### Quick Start Example

```
curl -X GET "https://app.infinisynapse.cn/api/ai_database/list?page=1&pageSize=10&source=all" \
  -H "Authorization: Bearer <your API Key>" \
  -H "x-lang: zh_CN"
```


## 2. AI Conversation and Task Execution

AI conversation uses an asynchronous "SSE long connection + message delivery" model: first subscribe to the event stream to receive real-time pushes, then send instructions via the message endpoint.

### 2.1 Subscribe to the Event Stream (SSE)

- **`GET /api/ai/events`**
- Establishes a Server-Sent Events long connection; the server actively pushes message changes, state-ready signals, notifications, and more.

**Query parameters**

| Parameter | Required | Description |
|----|----|----|
| `connId` | No | A client-generated connection ID (e.g. a UUID); use one per tab/connection for multiple tabs/connections so the server can target pushes. If omitted, the server generates one automatically |

**Request headers**: `Authorization: Bearer <token>` is required; `Accept: text/event-stream` is recommended.

**Event types** (each formatted as `event: <event>\ndata: <JSON>\n\n`)

| event | data | Description |
|----|----|----|
| `message.add` | `{ taskId, message }` | Append a message to the task |
| `message.update` | `{ taskId, message }` | Update an existing message |
| `message.partial` | `{ taskId, message }` | Streaming incremental update (overwrite or append at the same ts) |
| `message.remove` | `{ taskId, messageTs: number[] }` | Remove the specified messages |
| `state.ready` | `{ taskId }` | State is ready; it is recommended to subsequently call `/api/ai_task/tasks` for a full fetch |
| `notification` | `{ type, title, message, duration? }` | Global notification |
| `heartbeat` | `"ping"` | Keep-alive; can be ignored |

**Agent message fields**

mini-apps or SDKs usually only need to consume `data.message` inside `message.add` / `message.partial`:

| Field | Example | Description |
|----|----|----|
| `message.type` | `say` / `ask` | `say` means Agent output; `ask` means the Agent is waiting for a client response |
| `message.text` | `"..."` | Streaming or final text; when `partial=true`, it is incremental/overwriting content |
| `message.say` | `completion_result` | One task completion signal |
| `message.ask` | `completion_result` | One task completion signal |
| `message.ask` | `upload_file_to_sandbox` | The Agent asks the client to upload a local file to the current task sandbox; after uploading, send the upload result back with `askResponse` |

```
curl -N "https://app.infinisynapse.cn/api/ai/events?connId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Accept: text/event-stream"
```


### 2.2 Send a Message

- **`POST /api/ai/message`**
- Dispatches to different logic based on the body's `type`. Replies are pushed in real time to the SSE channel; this endpoint itself only returns the execution result.

**Common `type` values and fields**

| type | Required fields | Optional fields | Description |
|----|----|----|----|
| `newTask` | `text` | `taskId`, `connId`, `images`, `files`, `autoApprovalSettings`, `chatSettings` | Create a new task (performs data source billing validation and idempotency). The server can generate `taskId`, but clients may pre-generate a UUID for reliable polling in concurrent scenarios |
| `askResponse` | `taskId`, `askResponse` | `text`, `images`, `files`, `connId` | Reply to the Agent's question and continue the multi-turn conversation; `askResponse` is generally `messageResponse` |
| `cancelTask` | `taskId` | \- | Cancel a running task |
| `clearTask` | \- | `taskId` | Clear a task; if `taskId` is omitted, clear all |
| `optionsResponse` | `taskId`, `connId`, `text` | \- | Multiple-choice reply |
| `togglePlanActMode` | `chatSettings` | `taskId` | Toggle planning/execution mode |
| `autoApprovalSettings` | `autoApprovalSettings` | \- | Update the auto-approval configuration |
| `rollbackToSnapshot` | `taskId`, `snapshotTs` | \- | Roll back to the specified snapshot |
| `rollbackAndSendMessage` | `taskId`, `snapshotTs`, `text` | `images`, `files` | Roll back and send a new message |
| `editFirstMessageAndResend` | `taskId`, `text` | `images`, `files` | Edit the first message and re-execute |

**Response**

- Success is usually `{ "success": true }`;
- `newTask`, rollback, editing the first message, etc. include `{ success: true, state, forceReplace? }`;
- Failure may be `{ success: false, error }` or `{ success: false, notification: { type, title, message } }` (e.g. when billing validation fails).

```
# Create a new task
curl -X POST "https://app.infinisynapse.cn/api/ai/message" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"newTask","text":"分析最近一个月的销售趋势","connId":"550e8400-..."}'

# Multi-turn follow-up
curl -X POST "https://app.infinisynapse.cn/api/ai/message" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"askResponse","taskId":"task-001","askResponse":"messageResponse","text":"再按地区拆分"}'
```


**Recommended mini-app / Agent integration flow**

1.  Generate a `connId`; if you need concurrency-safe resume or polling, also generate a `taskId`.
2.  Open `GET /api/ai/events?connId=<uuid>` first, and wait for `state.ready` or a short timeout.
3.  Call `POST /api/ai/message` with `type=newTask`, the same `connId`, task `text`, optional `taskId`, `images`, `autoApprovalSettings`, and `chatSettings: { "mode": "act" }`.
4.  Read progress from SSE `message.partial` / `message.add`; treat `notification.type=error` as task failure.
5.  If you receive `message.type=ask` with `message.ask=upload_file_to_sandbox`, upload the file first, then send the upload result JSON back with `type=askResponse`, `askResponse=messageResponse`, the same `taskId`, and the same `connId`.
6.  After `message.ask=completion_result` or `message.say=completion_result`, read generated reports, charts, PDFs, Word files, and other artifacts through the task file endpoints.

### 2.3 Other Conversation Helper Endpoints

| Endpoint | Method | Description |
|----|----|----|
| `/api/ai/state?taskId=` | GET | Get the complete frontend state for the specified task (or globally): apiConfiguration, the current task, the message list, auto-approval, conversation mode, todo, etc. |
| `/api/ai/settings` | POST | Update the API configuration, custom instructions, and auto-approval settings; when `taskId` is provided, also update that task's model |
| `/api/ai/configuration` | GET | Get the `apiConfiguration` saved by the current user |
| `/api/ai/models` | GET | Request the OpenAI-compatible `/models` according to the current API configuration, returning an array of available model IDs |
| `/api/ai/ping` | GET | A lightweight heartbeat that returns `{ ok: true }`, used to probe connection liveness |
| `/api/ai_browser/session` | GET | Get the current user's connected browser extension session `{ uid, clientId, status, connectedAt, lastActivityAt, browserName, version, activeSessionCount, activeSessionIds }`; shopping and web-research apps can use it to verify that the Chrome extension is online |

## 3. Task Management

Controller prefix: `/api/ai_task`.

### 3.1 Task Queries

| Endpoint | Method | Parameters | Description |
|----|----|----|----|
| `/api/ai_task/list` | GET | Pagination parameters + `task_name`, `category_name`, `category_id`, `is_in_rag`, `virtual_echart_category` (all optional, fuzzy match) | Get the task list with pagination |
| `/api/ai_task/tasks?taskId=` | GET | `taskId` (required) | Get the full task data (`taskInfo` + `messages` + `isRunning`) |
| `/api/ai_task/getTaskInfo/:id` | GET | Path `id` | Get task metadata (without creating a running instance) |
| `/api/ai_task/showTaskWithId/:id` | GET | Path `id` | Get task details |
| `/api/ai_task/getUiMessageById?id=` | GET | `id` (task ID) | Get the task's UI message list (slimmed down) |
| `/api/ai_task/messagePayload?taskId=&messageTs=` | GET | `taskId`, `messageTs` | Get the full `text` of a single message (not slimmed down) |
| `/api/ai_task/getTaskWorkspace/:id` | GET | Path `id` | Get the task working directory and file list `{ cwd, files }` |

### 3.2 Task Operations

#### Delete Tasks

- **`POST /api/ai_task/deleteTaskWithId`**

```
{ "ids": ["task-001", "task-002"] }
```


#### Cancel a Task

- **`GET /api/ai_task/cancelTask?taskId=task-001`** (`taskId` as a Query parameter; some older clients may also use `POST /api/ai/message` with `type=cancelTask`)

#### Rerun a SQL Task

- **`POST /api/ai_task/rerunSqlTask`**

```
{ "id": "task-001", "chat_index": 0 }
```


#### Run Extracted SQL

- **`POST /api/ai_task/runExtractSql`**

```
{
  "variables": { "startDate": "2024-01-01", "endDate": "2024-12-31" },
  "register_tables": "orders,users",
  "databases": "main_db",
  "sqls": "SELECT * FROM orders WHERE created_at BETWEEN :startDate AND :endDate"
}
```


### 3.3 Tasks and RAG

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_task/saveToRag` | POST | `{ taskId, action }`, where `action` is `save`/`remove` | Save or remove a task to/from RAG |
| `/api/ai_task/isSavedToRag?taskId=` | GET | `taskId` | Returns a boolean indicating whether the task has been saved to RAG |

### 3.4 Task Categories

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_task/category/add` | POST | `{ category_name }` | Add a category |
| `/api/ai_task/category/update` | POST | `{ id, category_name }` | Update a category |
| `/api/ai_task/category/delete` | POST | `{ ids: [] }` | Delete categories |
| `/api/ai_task/category/list` | GET | Pagination parameters + `category_name` | Get categories with pagination |
| `/api/ai_task/category/getAllCategories` | GET | \- | Get all categories |
| `/api/ai_task/getCatetoryById/:id` | GET | Path `id` | Category details |
| `/api/ai_task/getCatetoryByTaskId/:id` | GET | Path `id` (task ID) | Get the categories associated with a task |
| `/api/ai_task/updateCategoryByTaskId` | POST | `{ id, category_ids: [] }` | Update the categories associated with a task |

### 3.5 Task Files

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_task/previewFile` | POST | `{ taskId, fileName }` | Preview the file content, returning `{ content, fileType }` |
| `/api/ai_task/getTaskWorkspace/:id` | GET | Path `id` | Get the task working directory and flat file list `{ cwd, files }`; usually call this first to discover generated `.md`, `.pdf`, `.docx`, and chart files |
| `/api/ai_task/downloadZip?taskId=` | GET | `taskId` | Download the entire task directory as a ZIP (returns a binary stream) |

### 3.6 Task Sharing (public read-only, no authentication required)

| Endpoint | Method | Description |
|----|----|----|
| `/api/ai_task/setShare` | POST | `{ taskId, isPublic }` sets the task as public/private (requires owner authentication) |
| `/api/ai_task/shareStatus?taskId=` | GET | Query the sharing status (requires owner authentication) |
| `/api/ai_task/publicTask?taskId=` | GET | Public read-only retrieval of task data |
| `/api/ai_task/publicMessagePayload?taskId=&messageTs=` | GET | Public read-only retrieval of the full content of a single message |
| `/api/ai_task/publicTaskFileTree/:taskId` | GET | Public read-only retrieval of the file tree |
| `/api/ai_task/publicPreviewFile` | POST | Public read-only file preview |
| `/api/ai_task/publicDownloadTaskFile/:taskId?path=` | GET | Public read-only file download |
| `/api/ai_task/publicDownloadZip?taskId=` | GET | Public read-only download of the task ZIP |

## 4. Data Source Management

Controller prefix: `/api/ai_database`. Supported database types: `mysql`, `postgres`, `sqlite`, `sqlserver`, `clickhouse`, `snowflake`, `doris`, `starrocks`, `gbase`, `kingbase`, `dm`, `supabase`, `deltalake`, `file` (connection testing also supports `mongodb`, `elasticsearch`).

### 4.1 List Query

- **`GET /api/ai_database/list`**

**Query parameters**: pagination parameters + the following optional items

| Parameter | Description |
|----|----|
| `name` | Database name (fuzzy) |
| `type` | Database type |
| `enabled` | Whether enabled: `1` / `0` |
| `source` | Source: `local` / `remote` / `subscribed` / `all` (default `all`) |
| `subscribeSource` | Subscription source: `created` / `subscribed` / `all` (default `created`) |

### 4.2 Create, Update, Delete

| Endpoint | Method | Body | Description |
|----|----|----|----|
| `/api/ai_database/add` | POST | `DatabaseAddDto` | Create a database connection |
| `/api/ai_database/update` | POST | `DatabaseEditDto` (includes `id`) | Update the database configuration |
| `/api/ai_database/delete` | POST | `{ ids: [] }` | Batch delete |
| `/api/ai_database/enabled` | POST | `{ ids: number[], enabled }` | Batch enable/disable |

Example `add` request body:

```
{
  "name": "production_db",
  "type": "mysql",
  "config": "{\"mysql_host\":\"127.0.0.1\",\"mysql_port\":3306,\"mysql_username\":\"root\",\"mysql_password\":\"***\",\"mysql_database\":\"sales\"}",
  "enabled": 1,
  "description": "生产环境数据库",
  "nickname": "销售数据源"
}
```


> Note: the database `name` must not start with `remote_` or `subscribe_`.

### 4.3 Connection Testing and Queries

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_database/testConnection` | POST | `{ type, config }` | Test the connection, returning `{ success, message, latencyMs }` |
| `/api/ai_database/getDatabaseById/:id` | GET | Path `id` | Query details by ID |
| `/api/ai_database/getDatabaseByName/:name` | GET | Path `name` | Query details by name |

### 4.4 File and Knowledge Base Binding

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_database/upload/:databaseId` | POST | `multipart/form-data`, field `file` (≤1GB) | Upload a data file to the specified database |
| `/api/ai_database/bindRags` | POST | `{ databaseId, ragIds: [] }` | Set the knowledge bases associated with the database |
| `/api/ai_database/getBindRags/:databaseId` | GET | Path `databaseId` | Get the list of knowledge bases bound to the database |

## 5. RAG Knowledge Base Management

Controller prefix: `/api/ai_rag_sdk`.

### 5.1 Queries

| Endpoint | Method | Parameters | Description |
|----|----|----|----|
| `/api/ai_rag_sdk` | GET | Pagination parameters + `keyword`, `enabled`, `source`, `subscribeSource` | Get the knowledge base list with pagination |
| `/api/ai_rag_sdk/all` | GET | \- | Get all knowledge bases (no pagination) |
| `/api/ai_rag_sdk/:id` | GET | Path `id` | Knowledge base details |

### 5.2 Create, Update, Delete

| Endpoint | Method | Body | Description |
|----|----|----|----|
| `/api/ai_rag_sdk/create` | POST | `RagSdkCreateDto` | Create a knowledge base |
| `/api/ai_rag_sdk/update/:id` | POST | `RagSdkUpdateDto` | Update a knowledge base |
| `/api/ai_rag_sdk/delete` | POST | `{ ids: [] }` | Batch delete |
| `/api/ai_rag_sdk/enabled` | POST | `{ ids: [], enabled }` | Batch enable/disable |

Example `create` request body:

```
{
  "name": "sales_kb",
  "nickname": "销售知识库",
  "description": "销售相关文档",
  "ragDocFilterRelevance": "0.5",
  "requiredExts": [".pdf", ".docx", ".txt"],
  "docDir": "/path/to/docs",
  "enabled": 1,
  "database_ids": ["uuid-1", "uuid-2"]
}
```


### 5.3 Database Binding

| Endpoint | Method | Body/Parameters | Description |
|----|----|----|----|
| `/api/ai_rag_sdk/bindDatabases` | POST | `{ ragId, databaseIds: [] }` | Set the databases associated with the knowledge base |
| `/api/ai_rag_sdk/getBindDatabases/:ragId` | GET | Path `ragId` | Get the list of databases bound to the knowledge base |

### 5.4 File Operations (supports file / oss / s3)

| Endpoint | Method | Body | Description |
|----|----|----|----|
| `/api/ai_rag_sdk/fileTree` | POST | `ListDirectoryDto` | List the directory file tree |
| `/api/ai_rag_sdk/download` | POST | `DownloadFileDto` | Download a file (returns a binary stream) |
| `/api/ai_rag_sdk/deleteRemoteFile` | POST | `DeleteRemoteFileDto` | Delete a remote file (OSS/S3 only) |

Example `fileTree` request body (remote OSS):

```
{
  "file_system": "oss",
  "directory": "/docs",
  "endpoint": "https://oss-cn-hangzhou.aliyuncs.com",
  "access_key_id": "***",
  "access_key_secret": "***",
  "filter": "both"
}
```


## 6. File Upload

The upload-related endpoints are registered under the root path (i.e. `/api/...`). Except for task uploads, ordinary uploads are organized by "directory".

| Endpoint | Method | Parameters | Description |
|----|----|----|----|
| `/api/upload/:directory` | POST | `multipart/form-data` field `file` (≤1GB) | Upload a file to the specified directory, returning `{ filename }` |
| `/api/ai/upload?taskId=` | POST | `multipart/form-data` field `file` + Query `taskId` | Upload a local file to the specified task sandbox, commonly used to respond to the Agent's `upload_file_to_sandbox` request |
| `/api/tools/taskUpload/:taskId` | POST | `file` + Query `subdir`, `naming` (`original`/`hash`) | Upload a file to the task working directory, returning `{ filename, assetId, logicalPath, name, size }`; report-writing apps can use `subdir=upload_documents` to archive user documents |
| `/api/createDirectory` | POST | `CreateDirectoryDto` | Create a directory |
| `/api/deleteDirectory` | DELETE | `DeleteDirectoryDto` | Delete a directory |
| `/api/directories` | GET | \- | Get the directory list |
| `/api/fileTree?keyword=` | GET | `keyword` (optional) | Get the file tree structure |
| `/api/taskFileTree/:taskId` | GET | Path `taskId` | Get the task working directory file tree |
| `/api/uploadConfig` | GET | \- | Get the upload limit configuration `{ maxFileSizeMB, maxFileSizeBytes, chat }` |

```
curl -X POST "https://app.infinisynapse.cn/api/upload/my-folder" \
  -H "Authorization: Bearer <your API Key>" \
  -F "file=@./data.csv"
```


```
# Upload to a task sandbox so the Agent can continue reading it
curl -X POST "https://app.infinisynapse.cn/api/ai/upload?taskId=task-001" \
  -H "Authorization: Bearer <your API Key>" \
  -F "file=@./attachment.pdf"

# Upload to a specific subdirectory in the task workspace
curl -X POST "https://app.infinisynapse.cn/api/tools/taskUpload/task-001?subdir=upload_documents&naming=original" \
  -H "Authorization: Bearer <your API Key>" \
  -F "file=@./report-source.docx"
```


## 7. File Storage and Download

Generic file storage uses the `/api/storage` prefix; task workspace downloads use `/api/tools/storage` in the current Server API.

| Endpoint | Method | Parameters | Description |
|----|----|----|----|
| `/api/storage/delete` | POST | `{ ids: [] }` | Delete files |
| `/api/storage/download/:id` | GET | Path `id` (format `directory/filename`, URL-encoded) | Download a file (returns a binary stream) |
| `/api/tools/storage/downloadTaskFile/:taskId?path=` | GET | Path `taskId` + Query `path` (file relative path, URL-encoded) | Download a file from the task working directory |
| `/api/tools/storage/downloadTaskFile/:taskId?path=&inline=1` | GET | Optional `inline=1` | Return previewable files such as images, SVGs, and PDFs inline; useful for rendering charts or images in report preview pages |

```
curl "https://app.infinisynapse.cn/api/tools/storage/downloadTaskFile/task-001?path=data%2Fresult.csv" \
  -H "Authorization: Bearer <your API Key>" \
  -o result.csv
```


## 8. Error Handling

| Symptom | Recommended handling |
|----|----|
| `code` of `1101` / `1105` | The Token has expired or is invalid; replace the API Key and retry |
| HTTP `422` | Request parameter validation failed; `message` is the specific reason |
| HTTP `400` | Business validation failed (e.g. file too large, illegal naming, no file uploaded, etc.) |
| HTTP `404` | The resource/file does not exist or you do not have access |
| No SSE data | Check the `Authorization` header and the network, and make sure you established the `/api/ai/events` connection before sending messages |

## 9. Typical Call Flow

1.  Establish an SSE connection: `GET /api/ai/events?connId=<uuid>`.
2.  Prepare resources: `GET /api/ai_database/list`, `GET /api/ai_rag_sdk`, and enable as needed via `POST /api/ai_database/enabled`, `POST /api/ai_rag_sdk/enabled`.
3.  Create a new task: `POST /api/ai/message` (`type=newTask`), and receive real-time replies from SSE.
4.  If the Agent requests local file upload: `POST /api/ai/upload?taskId=` or `POST /api/tools/taskUpload/:taskId`, then send the upload result back with `POST /api/ai/message` (`type=askResponse`).
5.  Multi-turn follow-up: `POST /api/ai/message` (`type=askResponse`).
6.  Cancel a task: `GET /api/ai_task/cancelTask?taskId=`.
7.  View results: `GET /api/ai_task/getTaskWorkspace/:id` to list the artifacts, `POST /api/ai_task/previewFile` to preview, and `GET /api/tools/storage/downloadTaskFile/:taskId?path=` to download.

## 10. API Scenarios and Compositions from Production mini-apps

Real mini-apps should not expose the API Key in the browser. The recommended pattern is to implement your own server-side business route: keep the API Key on the server, assemble prompts there, proxy uploads, and read task artifacts. The frontend only talks to your own business route.

### 10.1 Common Agent Task Skeleton

Use this for any long-running Agent application, including Gaokao assistants, shopping comparison, and report writing.

1.  The frontend calls your server route; the server generates a `connId` and, when resume or polling matters, also pre-generates a `taskId`.
2.  The server opens `GET /api/ai/events?connId=<uuid>` first and starts consuming SSE.
3.  The server calls `POST /api/ai/message` with `type=newTask`, the same `connId`, task `text`, optional `taskId`, `autoApprovalSettings`, and `chatSettings: { "mode": "act" }`.
4.  Use SSE `message.partial` / `message.add` to advance state; transform `message.text` into progress, conclusions, or structured frontend results.
5.  When `message.ask=upload_file_to_sandbox`, upload the file first, then send the upload result back to the Agent with `POST /api/ai/message` (`type=askResponse`).
6.  After `message.ask=completion_result` or `message.say=completion_result`, read messages, workspace files, or downloads according to the task type.
7.  When the user stops the run, call `GET /api/ai_task/cancelTask?taskId=` and mark the business task state in your own database.

### 10.2 Gaokao Assistants: Form Input + Optional Files + PDF Result

Gaokao school/major consulting apps are centered on "one form submission generates a structured report." These apps usually do not need the browser extension.

| Stage | API composition | Usage |
|----|----|----|
| Create task | `GET /api/ai/events` + `POST /api/ai/message` | Put score, province, subject choices, preferences, and constraints into `text`, then create a `newTask` |
| Optional upload | `POST /api/ai/upload?taskId=` + `POST /api/ai/message` | When the Agent asks for `upload_file_to_sandbox`, upload score sheets, school lists, or other files to the task sandbox and send the upload result back |
| Progress recovery | `GET /api/ai_task/getUiMessageById?id=` | After page refresh or polling, retrieve slim UI messages and check whether `completion_result` has appeared |
| Read result | `GET /api/ai_task/getTaskWorkspace/:id` + `POST /api/ai_task/previewFile` | Discover generated Markdown, PDF, or data files; preview before displaying them |
| Download result | `GET /api/tools/storage/downloadTaskFile/:taskId?path=` | Download PDFs, images, or other final files |
| Share result | `POST /api/ai_task/setShare` | When a public read-only result page is needed, make the task public and then read through public task endpoints |

### 10.3 Shopping Comparison Assistant: Chrome Extension + Realtime Agent + Message Result

Shopping apps need the Agent to see the product page, search page, or multiple e-commerce pages the user is browsing. Usually check whether the Chrome extension is online before starting the task.

| Stage | API composition | Usage |
|----|----|----|
| Extension check | `GET /api/ai_browser/session` | Show whether the Chrome extension is connected; if not, guide the user to install or open it |
| Create comparison task | `GET /api/ai/events` + `POST /api/ai/message` | In `text`, include budget, product links, preferences, price sensitivity, and comparison dimensions; use `chatSettings.mode=act` |
| Web/file supplement | `message.ask=upload_file_to_sandbox` + `POST /api/ai/upload?taskId=` | If the user adds screenshots, order pages, or product material, upload them when the Agent asks and send the result back |
| Realtime display | SSE `message.partial` / `message.add` | Show comparison progress, candidate products, risk warnings, and purchase recommendations in real time |
| Resume and polling | `GET /api/ai_task/getUiMessageById?id=` | When the user returns to the page, restore recent messages by task ID |
| Stop task | `GET /api/ai_task/cancelTask?taskId=` | Cancel the running Agent when the user changes product, budget, or no longer wants to continue |

### 10.4 Report Writer: Batch Document Upload + Knowledge/Data Resources + Workspace Artifacts

Report-writing apps do not just need a text answer. They let the Agent continuously create Markdown, charts, PDFs, Word files, and other artifacts in the task workspace.

| Stage | API composition | Usage |
|----|----|----|
| Upload user material | `POST /api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` | Archive Word, PDF, Markdown, spreadsheets, and other source files into a fixed task workspace directory so the Agent can reference them |
| Enable resources | `GET /api/ai_database/list`, `POST /api/ai_database/enabled`, `GET /api/ai_rag_sdk`, `POST /api/ai_rag_sdk/enabled` | If the report needs databases or knowledge bases, list and enable the relevant resources before creating the task |
| Create writing task | `GET /api/ai/events` + `POST /api/ai/message` | In `text`, specify report goal, audience, structure, citation requirements, and uploaded file directories; use `autoApprovalSettings` to reduce tool-call confirmations |
| Supplement material | `POST /api/ai/upload?taskId=` + `POST /api/ai/message` | For temporary files requested by the Agent during the conversation, upload to sandbox and continue with `askResponse` |
| Inspect workspace | `GET /api/ai_task/getTaskWorkspace/:id` | Enumerate task artifacts and discover the latest `.md`, `.pdf`, `.docx`, chart, and image files |
| Preview content | `POST /api/ai_task/previewFile` | Preview Markdown, text, and readable files; the frontend can render them as a report preview |
| Download/inline render | `GET /api/tools/storage/downloadTaskFile/:taskId?path=` | Download final files; add `inline=1` for images, SVGs, and PDFs embedded in report preview pages |
| Multi-turn revision | `POST /api/ai/message` (`type=askResponse`) | When the user asks for revisions, continue the same task instead of creating a new one and losing context |

### 10.5 Composition Principles

- **Connect SSE before sending the task**: the most reliable long-task order is to establish `/api/ai/events` first, then call `/api/ai/message`, so early state is not missed.
- **Keep credentials and state server-side**: API Key, `taskId`, file paths, share state, and business user ID should stay on your server. The frontend should only receive business results.
- **Separate the two upload modes**: `/api/ai/upload?taskId=` responds to Agent sandbox upload requests; `/api/tools/taskUpload/:taskId` is better when the app proactively archives source material into the task workspace.
- **Prefer the workspace for deliverables**: SSE messages are enough for text-only display; use `getTaskWorkspace`, `previewFile`, and `downloadTaskFile` when you need download, preview, versioning, or export.
- **Enable resources before the task**: databases and knowledge bases should be listed and enabled before `newTask`, otherwise the Agent may not see the expected resources.
- **Design recovery from the beginning**: mini-apps should persist `taskId`, `connId`, user input, uploaded file mappings, and last status; after refresh, recover with `getUiMessageById` and `getTaskWorkspace`.
