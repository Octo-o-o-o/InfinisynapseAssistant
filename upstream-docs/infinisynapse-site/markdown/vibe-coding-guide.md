# InfiniSynapse Vibe Coding Guide


This is a one-stop development guide for Vibe Coding contest participants, organized in the Agent Skill format. It distills three parts: using the CLI, calling the Server API, and integrating InfiniSynapse into your own product. You can save this entire document as `SKILL.md` and drop it into the skills directory of Cursor / Claude Code / Codex or other AI coding tools, so your AI assistant calls InfiniSynapse following these conventions.

Below is the Skill metadata (frontmatter); place it at the very top of the file when saving as `SKILL.md`:

```
---
name: infinisynapse-vibe-coding
description: Run multi-turn AI data-analysis tasks via the InfiniSynapse CLI (agent_infini) or the Server HTTP API, manage data sources and RAG knowledge bases, read task workspace artifacts, and integrate InfiniSynapse into your own application as a long-task Agent layer. Use when the user mentions InfiniSynapse, agent_infini, the Vibe Coding contest, or wants to build apps on InfiniSynapse.
---
```


## Core concepts

InfiniSynapse is an AI Agent platform: you kick off a task with a single prompt, the Agent executes multi-step work in a server-side sandbox (querying databases, retrieving knowledge bases, writing code, generating reports), progress is pushed in real time over SSE, and artifacts (Markdown, PDF, charts, data files) accumulate in the **task workspace**, ready to preview and download.

Three integration paths — pick what fits:

| Path | Best for |
|----|----|
| CLI (`agent_infini`) | Command-line usage, script automation, AI Agent workflows; fastest to start |
| Server HTTP API | Building your own app/mini-app that issues HTTP requests and consumes SSE directly |
| Product integration | Wiring InfiniSynapse into an existing mature product as a controlled long-task Agent layer |

## Prerequisite: get an API Key

1.  Open and sign in to <https://app.infinisynapse.com/tasks> (use `.cn` for mainland China).
2.  Click the gear icon at the bottom left and choose **API Key Management**.
3.  Click **Create API Key** to create a new key.
4.  Send `Authorization: Bearer <your API Key>` on every request.

Service endpoints (use `.com` overseas, `.cn` in mainland China; replace with your own address for private deployments):

| Service | Default address | Purpose |
|----|----|----|
| Main application server | `https://app.infinisynapse.com` | Task conversations, data source/RAG management, workspace files |
| Account/market service (Console) | `https://api.infinisynapse.com/api` | API Key verification; data source / RAG / Skill marketplaces |

Security baseline: **keep the API Key on the server side or in local config only.** Never put it in frontend code, public repos, or client bundles. If a key leaks, delete it in API Key Management and create a new one.

During development, <https://app.infinisynapse.com/tasks> doubles as your admin console: every task created through the API shows up in the **ALL TASKS** list on the left, where you can review messages, execution steps, and workspace artifacts. The top-right corner lets you check your quota, top up, or create an exclusive compute resource.

## Part 1: Using the CLI (agent_infini)

`agent_infini` is the InfiniSynapse command-line tool. Default install location: `~/.infini/bin/agent_infini` (Windows: `%USERPROFILE%\.infini\bin\agent_infini.exe`). If it is not on PATH, call it by full path.

### Initialization

Initialize the config once before first use:

```
agent_infini init --api-key "your_api_key"
```


The config is written to `~/.agent_infini/config.txt`. Use `--server` / `--console` / `--prefer-language` to override the default addresses and language.

### Recommended workflow

1.  Initialize: `agent_infini init --api-key "your_api_key"`
2.  List resources: `agent_infini db ls` / `agent_infini rag ls`
3.  Check context: `agent_infini task context`; enable resources with `db enable` / `rag enable` if needed
4.  Multi-turn chat: `agent_infini task new "..."`, then `agent_infini task ask <taskId> "..."`
5.  Manage tasks and files: `task ls` / `task show` / `task file` / `task download`

### Command reference

Tasks:

```
agent_infini task new "Analyze user growth trend"      # create a task (SSE streaming)
agent_infini task ask <taskId> "Show it as a bar chart" # continue the conversation
agent_infini task ls [--page N] [--search Q]           # list tasks
agent_infini task show <taskId>                        # task details
agent_infini task context                              # show enabled DBs and RAGs
agent_infini task cancel <taskId>                      # cancel a running task
agent_infini task rm <id1> [id2 ...]                   # delete tasks in batch
agent_infini task file <taskId>                        # list workspace files
agent_infini task preview <taskId> <fileName>          # preview file content
agent_infini task download <taskId> <fileName> [-o dir]  # download file to local disk
```


Databases and RAG knowledge bases:

```
agent_infini db ls [--name N] [--type T] [--enabled] [--disabled]
agent_infini db enable <id> [id...]
agent_infini db disable <id> [id...]

agent_infini rag ls [--keyword K] [--enabled] [--disabled]
agent_infini rag enable <id> [id...]
agent_infini rag disable <id> [id...]
```


Supported database types: `mysql, postgres, sqlite, sqlserver, clickhouse, snowflake, doris, starrocks, gbase, kingbase, dm, supabase, deltalake, file`.

### Output format

JSON output by default (`--table` switches to table view). Success is `{"success": true, "data": {...}}`, failure is `{"success": false, "error": "..."}`. List commands can be piped to `jq`:

```
agent_infini task ls | jq '.items[].task_name'
```


### Common scenarios

```
# Enable a database, then start analysis
agent_infini db ls
agent_infini db enable <id>
agent_infini task new "What tables are in my database?"

# Multi-turn analysis
agent_infini task new "Analyze the users table schema"
agent_infini task ask <taskId> "Now show me the top 10 users by activity"
agent_infini task ask <taskId> "Generate a summary report"

# Work with workspace files
agent_infini task file <taskId>
agent_infini task preview <taskId> analysis.py
agent_infini task download <taskId> report.csv -o ./results/
```


### CLI troubleshooting

- Token expired/invalid: re-run `agent_infini init` or edit `api-key` in `~/.agent_infini/config.txt`
- Server unreachable: check the `--server` URL and network connectivity
- Task not found: use `task ls` to find a valid `taskId`
- No enabled resources: check with `task context`, then enable via `db enable` / `rag enable`

## Part 2: Calling the Server API

Use this when your application issues HTTP requests directly. All endpoints start with `/api`; send `Authorization: Bearer <API Key>` on every request, optionally with `x-lang` (`zh_CN` default / `en` / `ja` / `ko` / `ru` / `ar`).

### Unified response envelope

```
{ "code": 200, "message": "success", "data": { } }
```


- `code === 200` means success; the payload is in `data`.
- `code` `1101` / `1105`: token expired or invalid — replace the API Key.
- Parameter validation failures return HTTP `422`; file-download endpoints return raw binary streams and bypass the envelope.
- List endpoints accept `page`, `pageSize`, `field`, `order` pagination parameters; responses contain `items` + `meta`.

### Core pattern: connect SSE first, then send messages

AI conversations use an asynchronous "SSE long connection + message dispatch" combo. **The order must not be reversed:**

```
# Step 1: subscribe to the event stream (generate your own connId, e.g. a UUID)
curl -N "https://app.infinisynapse.com/api/ai/events?connId=<uuid>" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Accept: text/event-stream"

# Step 2: create a task (with the same connId)
curl -X POST "https://app.infinisynapse.com/api/ai/message" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"newTask","text":"Analyze last month sales trend","connId":"<uuid>"}'

# Multi-turn follow-up
curl -X POST "https://app.infinisynapse.com/api/ai/message" \
  -H "Authorization: Bearer <your API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"askResponse","taskId":"<taskId>","askResponse":"messageResponse","text":"Break it down by region"}'
```


Key SSE events: `message.add` / `message.partial` (messages and streaming increments), `state.ready` (state ready), `notification` (`type=error` means task failure), `heartbeat` (keep-alive).

Key signals inside messages:

| Signal | Meaning and handling |
|----|----|
| `message.type=say` | Agent output; `message.text` carries the text |
| `message.ask=upload_file_to_sandbox` | Agent asks for a local file: call an upload endpoint first, then send the upload result JSON back via `askResponse` |
| `message.ask/say=completion_result` | Task complete — go read the workspace artifacts |

Other common `type` values for `POST /api/ai/message`: `cancelTask` (cancel), `optionsResponse` (multi-choice reply), `togglePlanActMode` (switch plan/act mode). When creating a task, include `chatSettings: { "mode": "act" }` and `autoApprovalSettings` to reduce confirmation round-trips.

### Recommended integration flow

1.  The client generates a `connId` (pre-generate a `taskId` too for concurrent scenarios).
2.  Establish `GET /api/ai/events?connId=<uuid>`.
3.  `POST /api/ai/message` with `type=newTask` and the same `connId`.
4.  Read progress from SSE `message.partial` / `message.add`.
5.  On `upload_file_to_sandbox`, upload the file first, then reply via `askResponse`.
6.  On `completion_result`, read reports, charts, PDFs, and other artifacts through the task file endpoints.

### Endpoint quick reference

Task management (prefix `/api/ai_task`):

| Endpoint | Method | Description |
|----|----|----|
| `/api/ai_task/list` | GET | Paginated task list, searchable by `task_name` |
| `/api/ai_task/getTaskInfo/:id` | GET | Task metadata and status |
| `/api/ai_task/getUiMessageById?id=` | GET | Task UI message list (for resuming progress after refresh) |
| `/api/ai_task/getTaskWorkspace/:id` | GET | Workspace directory and file list `{ cwd, files }` |
| `/api/ai_task/previewFile` | POST | `{ taskId, fileName }` preview file content |
| `/api/ai_task/cancelTask?taskId=` | GET/POST | Cancel a running task |
| `/api/ai_task/deleteTaskWithId` | POST | `{ ids: [] }` batch delete |
| `/api/ai_task/downloadZip?taskId=` | GET | Download entire task directory as ZIP (binary stream) |
| `/api/ai_task/setShare` | POST | `{ taskId, isPublic }` toggle public sharing |

File upload and download:

| Endpoint | Method | Description |
|----|----|----|
| `/api/ai/upload?taskId=` | POST | Multipart upload into the task sandbox; used to answer the Agent's `upload_file_to_sandbox` |
| `/api/tools/taskUpload/:taskId` | POST | Proactively archive material into the task workspace; supports `subdir`, `naming` |
| `/api/tools/storage/downloadTaskFile/:taskId?path=` | GET | Download a workspace file; add `inline=1` to render images/PDFs inline |

Data sources and RAG (prefixes `/api/ai_database`, `/api/ai_rag_sdk`):

| Endpoint | Method | Description |
|----|----|----|
| `/api/ai_database/list` | GET | Data source list; filter by `name`, `type`, `enabled`, `source` |
| `/api/ai_database/add` / `update` / `delete` | POST | Data source CRUD |
| `/api/ai_database/enabled` | POST | `{ ids: [], enabled: 1|0 }` batch enable/disable |
| `/api/ai_database/testConnection` | POST | Test a connection |
| `/api/ai_database/upload/:databaseId` | POST | Upload a data file (≤1GB) |
| `/api/ai_rag_sdk` | GET | Knowledge base list; filter by `keyword`, `enabled` |
| `/api/ai_rag_sdk/create` / `update/:id` / `delete` | POST | Knowledge base CRUD |
| `/api/ai_rag_sdk/enabled` | POST | Batch enable/disable |

Skill management (prefix `/api/ai_skill`): `install` (from marketplace), `upload` (local zip containing a `SKILL.md` at any level), `toggleStatus` (enable/disable), `list` (installed Skills). For methodology/templates that only apply to a single task, use the task file upload path instead of installing a user-level Skill.

Marketplace endpoints (discovery and subscription for data sources / RAG / Skills) live on the account service `https://api.infinisynapse.com/api`, e.g. `/database-market/public`, `/rag-market/subscribe`, `/skill/public/getSkillList`. After subscribing, return to the Server API and use `list` + `enabled` to activate the resource.

**Note: databases and knowledge bases must be listed and enabled before `newTask`, otherwise the Agent will not see them.**

### Error handling

| Symptom | Suggested handling |
|----|----|
| `code` `1101` / `1105` | Token expired or invalid; replace the API Key and retry |
| HTTP `422` | Request validation failed; `message` explains the cause |
| HTTP `400` | Business validation failed (file too large, illegal name, etc.) |
| HTTP `404` | Resource/file missing or no access |
| SSE silent | Check the `Authorization` header; make sure `/api/ai/events` is connected before sending messages |

## Part 3: Integration practice (wiring InfiniSynapse into your app)

One-sentence rule: **do not treat InfiniSynapse as a reason to rewrite your product; wire it in as a controlled long-task Agent layer.** Your application keeps hosting users, permissions, core data, and deterministic business state; InfiniSynapse handles multi-step research, report generation, workspace artifacts, and optional RAG / data source collaboration.

### Responsibility boundary

| Stays in your app | Goes to InfiniSynapse |
|----|----|
| Users, permissions, audit, billing, risk control | Long-task Agent execution, SSE progress, task workspace |
| Core business data, state machines, primary records | Multi-step research, report writing, option generation |
| Low-latency structured LLM calls, deterministic rules | Work that needs exploration, synthesis, writing, artifact files |

Rule of thumb: capabilities that must return with low latency, be verifiable field by field, or obey row-level permissions stay in your app; long-running, cross-source synthesis producing Markdown/PDF/tables goes to InfiniSynapse.

### Recommended architecture

Add a backend adapter layer. Do not let business code call InfiniSynapse from everywhere, and never let the frontend call it directly:

```
Frontend -> Your backend API -> InfiniSynapse adapter -> InfiniSynapse Server API
                              -> Your DB / queue / artifact store
```


The adapter is responsible for: unifying the base URL and API Key; generating and persisting `taskId` / `connId` / input snapshots / upload mappings / workspace file indexes; connecting SSE before sending `newTask`; translating SSE into your product's task states; and reading artifacts into indexed records on completion.

### Key engineering practices

- **SSE first, then newTask**: reversing the order loses early messages.
- **`newTask` is an external side effect**: pre-generate `taskId` / `connId` and persist them before enqueuing; on worker crash recovery, check `getUiMessageById` and `getTaskWorkspace` first — never blindly resend `newTask`.
- **Credentials stay server-side**: the frontend calls your backend with your own business task ID; do not treat the InfiniSynapse `taskId` as a frontend-accessible authorization token.
- **Multi-tenant boundary**: a single API Key maps to one InfiniSynapse account and does not give each business user physical isolation; enforce access with your own user/permission system, and do not mix multiple users' private files into one long-lived RAG.
- **Two kinds of uploads**: `/api/ai/upload?taskId=` answers the Agent's sandbox upload requests; `/api/tools/taskUpload/:taskId` is for proactively archiving material.
- **Results come from the workspace**: for download, preview, or export, use `getTaskWorkspace` + `previewFile` + `downloadTaskFile`; treat download endpoints as binary streams, not JSON.
- **Design recovery up front**: persist `taskId`, `connId`, user input, upload file mappings, and last state; after a page refresh, restore via `getUiMessageById` and `getTaskWorkspace`.
- **Privacy minimization**: store input digests, content hashes, and artifact indexes; be cautious about persisting sensitive raw text (resumes, contracts) or full Agent intermediate messages.

### Phased rollout

- **P0 — one low-risk loop**: pick a small-scope, manually reviewable long task (e.g. "generate a deep report"). Feature flag off by default; create your own `AgentTask` table; API routes only enqueue; the worker connects SSE before `newTask`; read the workspace into artifact records on completion.
- **P1 — recovery, reuse, cancellation**: deduplicate by input hash per user; support `cancelTask` and mark the state in your own DB; version the artifacts.
- **P2 — then add RAG, data sources, sharing, and Browser Use**: RAG/data sources must be listed and enabled before `newTask`; confirm on the business side before `setShare`; only wire Browser Use when you truly need to operate the user's browser (check `GET /api/ai_browser/session` for plugin liveness first).

### Things not to do by default

- Do not convert your entire business flow into InfiniSynapse long tasks.
- Do not use Browser Use for problems solvable with backend APIs, file uploads, or database queries.
- Do not auto-execute external write actions such as submissions, payments, publishing, or deletion; high-risk actions need approval.
- Do not invent APIs — only use endpoints explicitly documented.

### Integration checklist

- Is the API Key server-side only, with the frontend talking only to your backend?
- Are `taskId`, `connId`, input hashes, upload mappings, and workspace snapshots persisted?
- Does the worker connect SSE before `newTask` and avoid blind retries of external side effects?
- Is the single-API-Key multi-tenant boundary covered by your business permissions?
- Are RAG / Browser Use wired in on demand rather than enabled by default?
- Do you have feature flags, usage limits, cancellation, recovery, and redacted logging?

## Further reading

This document distills three reference docs. Consult the originals for complete endpoint definitions, request body fields, and more examples:

- [InfiniSynapse CLI API Reference](/en/docs/InfiniSynapse%20CLI%20API%20Reference): every CLI command mapped to the endpoints it calls
- [InfiniSynapse Server API Reference](/en/docs/InfiniSynapse%20Server%20API%20Reference): the full Server API reference, including marketplace subscription, Skill management, and API combinations from shipped apps
- [InfiniSynapse Existing Product Integration Playbook](/en/docs/InfiniSynapse%20Existing%20Product%20Integration%20Playbook): the complete playbook for integrating into mature products, covering multi-tenancy, idempotency, privacy, and phased rollout
