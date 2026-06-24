# InfiniSynapse Server API 端点总目录

> 单一事实基准。本表只收录 `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` 中明确出现的端点。
> SDK 示例、扫描器和产品方案都以本表为准。**不在本表里的端点不要直接使用，先 `rg` 搜上游文档确认。**
>
> 最后核对：2026-06-23，对应 `server-api-reference.md` 快照。

## 全局约定

| 项 | 值 |
| --- | --- |
| 国内 Base URL | `https://app.infinisynapse.cn` |
| 海外 Base URL | `https://app.infinisynapse.com` |
| 账号/市场 API（国内） | `https://api.infinisynapse.cn/api` |
| 账号/市场 API（海外） | `https://api.infinisynapse.com/api` |
| 全局前缀 | 所有 Server API 端点以 `/api` 开头 |
| 鉴权 | `Authorization: Bearer <API Key>`（少数「公开只读」端点除外） |
| 默认内容类型 | `application/json`；上传为 `multipart/form-data` |
| 可选语言头 | `x-lang`：`zh_CN`(默认)/`en`/`ar`/`ja`/`ko`/`ru` |
| 统一响应信封 | `{ code, message, data }`，`code===200` 成功 |
| 例外 | **下载类端点直接返回二进制流（`application/octet-stream` / `application/zip`），不走信封** |

## 1. AI 对话与任务执行

| 端点 | 方法 | 关键参数 | 用途 |
| --- | --- | --- | --- |
| `/api/ai/events` | GET (SSE) | `connId?` | 订阅事件流，**必须先于发消息建立** |
| `/api/ai/message` | POST | body `type` 分发 | 发送指令（见下方 `type` 表） |
| `/api/ai/state` | GET | `taskId?` | 获取任务/全局完整前端状态 |
| `/api/ai/settings` | POST | API 配置/自动审批/`taskId?` | 更新配置 |
| `/api/ai/configuration` | GET | - | 获取 `apiConfiguration` |
| `/api/ai/models` | GET | - | 列出当前配置下可用模型 ID |
| `/api/ai/ping` | GET | - | 心跳，返回 `{ ok: true }` |
| `/api/ai_browser/session` | GET | - | 浏览器插件会话状态（购物/网页研究类用） |

### `POST /api/ai/message` 的 `type`

| type | 必填字段 | 可选字段 | 说明 |
| --- | --- | --- | --- |
| `newTask` | `text` | `taskId`,`connId`,`images`,`files`,`autoApprovalSettings`,`chatSettings` | 新建任务（会做扣费校验与幂等） |
| `askResponse` | `taskId`,`askResponse` | `text`,`images`,`files`,`connId` | 回复 Agent 提问；`askResponse` 一般为 `messageResponse` |
| `cancelTask` | `taskId` | - | 取消运行中任务（推荐路径） |
| `clearTask` | - | `taskId` | 清除任务；不传清空全部 |
| `optionsResponse` | `taskId`,`connId`,`text` | - | 多选项回复 |
| `togglePlanActMode` | `chatSettings` | `taskId`,`connId` | 切换规划/执行模式 |
| `autoApprovalSettings` | `autoApprovalSettings` | `taskId`,`connId` | 更新自动审批配置；建任务前可先发全局/连接级设置，执行阶段建议带任务上下文 |
| `rollbackToSnapshot` | `taskId`,`snapshotTs` | - | 回滚到快照 |
| `rollbackAndSendMessage` | `taskId`,`snapshotTs`,`text` | `images`,`files` | 回滚并发消息 |
| `editFirstMessageAndResend` | `taskId`,`text` | `images`,`files` | 编辑首条并重发 |

详细 SSE 事件类型和消息字段见 [task-lifecycle.md](task-lifecycle.md)。

## 2. 任务管理（前缀 `/api/ai_task`）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/ai_task/list` | GET | 分页任务列表（`task_name`/`category_*`/`is_in_rag` 等可选过滤） |
| `/api/ai_task/tasks?taskId=` | GET | 任务完整数据 `{ taskInfo, messages, isRunning }` |
| `/api/ai_task/getTaskInfo/:id` | GET | 任务元信息（不创建运行实例） |
| `/api/ai_task/showTaskWithId/:id` | GET | 任务详情 |
| `/api/ai_task/getUiMessageById?id=` | GET | 瘦身后的 UI 消息列表（**恢复进度首选**） |
| `/api/ai_task/messagePayload?taskId=&messageTs=` | GET | 单条消息完整 `text`（未瘦身） |
| `/api/ai_task/getTaskWorkspace/:id` | GET | 工作目录 + 文件列表 `{ cwd, files }`（**发现产物首选**） |
| `/api/ai_task/deleteTaskWithId` | POST | `{ ids: [] }` 批量删除 |
| `/api/ai_task/cancelTask?taskId=` | GET 或 POST | 旧取消入口（`taskId` 走 Query）；部分部署可能不可用，产品集成优先用 `/api/ai/message` `type=cancelTask` |
| `/api/ai_task/rerunSqlTask` | POST | `{ id, chat_index }` |
| `/api/ai_task/runExtractSql` | POST | `{ variables, register_tables, databases, sqls }` |
| `/api/ai_task/saveToRag` | POST | `{ taskId, action: save\|remove }` |
| `/api/ai_task/isSavedToRag?taskId=` | GET | 布尔 |
| `/api/ai_task/category/*` | GET/POST | 分类增删改查 |
| `/api/ai_task/previewFile` | POST | `{ taskId, fileName }` → `{ content, fileType }` |
| `/api/ai_task/downloadZip?taskId=` | GET | 下载整个任务目录 ZIP（**二进制**） |

### 任务分享（公开只读，无需鉴权）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/ai_task/setShare` | POST | `{ taskId, isPublic }`（需所有者鉴权） |
| `/api/ai_task/shareStatus?taskId=` | GET | 分享状态（需所有者鉴权） |
| `/api/ai_task/publicTask?taskId=` | GET | 公开读任务数据 |
| `/api/ai_task/publicMessagePayload?taskId=&messageTs=` | GET | 公开读单条消息 |
| `/api/ai_task/publicTaskFileTree/:taskId` | GET | 公开读文件树 |
| `/api/ai_task/publicPreviewFile` | POST | 公开读预览 |
| `/api/ai_task/publicDownloadTaskFile/:taskId?path=` | GET | 公开读下载（**二进制**） |
| `/api/ai_task/publicDownloadZip?taskId=` | GET | 公开读下载 ZIP（**二进制**） |

## 3. 数据源管理（前缀 `/api/ai_database`）

支持类型：`mysql`/`postgres`/`sqlite`/`sqlserver`/`clickhouse`/`snowflake`/`doris`/`starrocks`/`gbase`/`kingbase`/`dm`/`supabase`/`deltalake`/`file`（测试连接另支持 `mongodb`/`elasticsearch`）。

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/ai_database/list` | GET | 分页 + `name`/`type`/`enabled`/`source`/`subscribeSource` |
| `/api/ai_database/add` | POST | `DatabaseAddDto`（`name` 不能以 `remote_`/`subscribe_` 开头） |
| `/api/ai_database/update` | POST | `DatabaseEditDto`（含 `id`） |
| `/api/ai_database/delete` | POST | `{ ids: [] }` |
| `/api/ai_database/enabled` | POST | `{ ids: number[], enabled }` 批量启用/禁用 |
| `/api/ai_database/testConnection` | POST | `{ type, config }` → `{ success, message, latencyMs }` |
| `/api/ai_database/getDatabaseById/:id` | GET | 详情 |
| `/api/ai_database/getDatabaseByName/:name` | GET | 详情 |
| `/api/ai_database/upload/:databaseId` | POST | `multipart` 字段 `file`（≤1GB） |
| `/api/ai_database/bindRags` | POST | `{ databaseId, ragIds: [] }` |
| `/api/ai_database/getBindRags/:databaseId` | GET | 绑定的知识库 |

### 数据源市场（账号 API，base `https://api.infinisynapse.cn/api`）

`/database-market/my`、`/public`、`/is-subscribed/:id`、`/detail/:id`(GET)，`/subscribe`(POST `{ database_market_id }`)。自动化：先查 `my` 再查 `public`，只对确认免费的条目 `subscribe`，订阅后回 `GET /api/ai_database/list?source=all&subscribeSource=all` 找到并 `enabled`。

## 4. RAG 知识库管理（前缀 `/api/ai_rag_sdk`）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/ai_rag_sdk` | GET | 分页 + `keyword`/`enabled`/`source`/`subscribeSource` |
| `/api/ai_rag_sdk/all` | GET | 全量（不分页） |
| `/api/ai_rag_sdk/:id` | GET | 详情 |
| `/api/ai_rag_sdk/create` | POST | `RagSdkCreateDto` |
| `/api/ai_rag_sdk/update/:id` | POST | `RagSdkUpdateDto` |
| `/api/ai_rag_sdk/delete` | POST | `{ ids: [] }` |
| `/api/ai_rag_sdk/enabled` | POST | `{ ids: [], enabled }` |
| `/api/ai_rag_sdk/bindDatabases` | POST | `{ ragId, databaseIds: [] }` |
| `/api/ai_rag_sdk/getBindDatabases/:ragId` | GET | 绑定数据库 |
| `/api/ai_rag_sdk/fileTree` | POST | `ListDirectoryDto`（file/oss/s3） |
| `/api/ai_rag_sdk/download` | POST | `DownloadFileDto`（**二进制**） |
| `/api/ai_rag_sdk/deleteRemoteFile` | POST | `DeleteRemoteFileDto`（仅 OSS/S3） |

### RAG 市场（账号 API，base `https://api.infinisynapse.cn/api`）

`/rag-market/my`、`/public`、`/is-subscribed/:id`、`/detail/:id`(GET)，`/subscribe`(POST `{ ragMarketId }`)。订阅后回 `GET /api/ai_rag_sdk?source=all&subscribeSource=all` 找到并 `enabled`。

## 5. 文件上传（注册在根 `/api`）

| 端点 | 方法 | 用途 | 区分 |
| --- | --- | --- | --- |
| `/api/upload/:directory` | POST | 通用目录上传，返回 `{ filename }` | 与任务无关 |
| `/api/ai/upload?taskId=` | POST | **响应** Agent 的 `upload_file_to_sandbox` 请求 | 被动：Agent 要文件时用 |
| `/api/tools/taskUpload/:taskId?subdir=&naming=` | POST | **主动**把资料归档到任务工作区，返回 `{ filename, assetId, logicalPath, name, size }` | 主动：产品归档资料用（`subdir=upload_documents`,`naming=original`） |
| `/api/createDirectory` | POST | 创建目录 | |
| `/api/deleteDirectory` | DELETE | 删除目录 | |
| `/api/directories` | GET | 目录列表 | |
| `/api/fileTree?keyword=` | GET | 文件树 | |
| `/api/taskFileTree/:taskId` | GET | 任务工作目录文件树 | |
| `/api/uploadConfig` | GET | 上传限制 `{ maxFileSizeMB, maxFileSizeBytes, chat }` | |

> 两类任务上传别混：`/api/ai/upload` 是**被动响应** Agent 的 sandbox 请求；`/api/tools/taskUpload` 是产品**主动归档**。

## 6. 文件存储与下载

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/storage/delete` | POST | `{ ids: [] }` |
| `/api/storage/download/:id` | GET | 下载（`id` 为 `目录/文件名`，需 URL 编码）（**二进制**） |
| `/api/tools/storage/downloadTaskFile/:taskId?path=` | GET | 下载任务工作目录文件（`path` 需 URL 编码）（**二进制**） |
| `/api/tools/storage/downloadTaskFile/:taskId?path=&inline=1` | GET | `inline=1` 内联返回图片/SVG/PDF，适合报告预览页嵌入 |

## 7. 错误码

| 现象 | 处理 |
| --- | --- |
| `code` = `1101` / `1105` | Token 过期/失效，更换 API Key |
| HTTP `422` | 参数校验失败，`message` 为具体原因 |
| HTTP `400` | 业务校验失败（文件超限、命名非法、无文件等） |
| HTTP `404` | 资源不存在或无权访问 |
| SSE 无数据 | 检查 `Authorization` 与网络，确认**先连 SSE 再发消息** |
| SSE `message.ask=api_req_failed` 且文本含 `Insufficient account balance` | 账户余额/额度不足；充值或更换有余额的 API Key 后重试 |

## 标注「二进制」的端点清单（不要当 JSON 解析）

- `/api/ai_task/downloadZip`
- `/api/ai_task/publicDownloadTaskFile/:taskId`
- `/api/ai_task/publicDownloadZip`
- `/api/ai_rag_sdk/download`
- `/api/storage/download/:id`
- `/api/tools/storage/downloadTaskFile/:taskId`
