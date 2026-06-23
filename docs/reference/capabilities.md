# InfiniSynapse 能力总览

> 从官方文档提炼的**能力视角**索引：一个平台能做什么，对应哪些端点/CLI。
> 与 [api-index.md](api-index.md)（端点视角）互补——这里回答"能做什么"，那里回答"端点是哪个"。
> 事实来源：`upstream-docs/infinisynapse-site/zh/markdown/`。最后核对：2026-06-23。

## 能力一览

| 能力 | 能做什么 | 关键端点 / CLI | 出处 |
| --- | --- | --- | --- |
| AI 长任务 / Agent 执行 | SSE 长连接 + 消息投递的异步多轮对话；规划/执行模式、自动审批、快照回滚、编辑首条重发 | `GET /api/ai/events`、`POST /api/ai/message`(`newTask`/`askResponse`/`cancelTask`/`togglePlanActMode`/`rollback*`) | server-api §2 |
| 数据源管理 | 连接/测试/启用 14 种数据库（测试连接另支持 mongodb/elasticsearch），上传数据文件，与 RAG 互绑 | `/api/ai_database/{add,update,delete,enabled,testConnection,upload/:id,bindRags}`；CLI `db ls/enable` | server-api §4 |
| RAG 知识库 | 按目录+扩展名建库、设相关度阈值、与数据库互绑、file/oss/s3 文件树与下载 | `/api/ai_rag_sdk/{create,update,delete,enabled,bindDatabases,fileTree,download}`；CLI `rag ls/enable` | server-api §5 |
| 文件上传 | 三类：通用目录、任务 sandbox（响应 Agent）、任务工作区主动归档 | `/api/upload/:directory`、`/api/ai/upload?taskId=`、`/api/tools/taskUpload/:taskId` | server-api §6 |
| 工作区产物与下载 | 枚举任务产物、预览文本、二进制下载、内联渲染图片/PDF、打包 ZIP | `getTaskWorkspace/:id`、`previewFile`、`/api/tools/storage/downloadTaskFile/:taskId?path=`(+`inline=1`)、`downloadZip` | server-api §3.5、§7 |
| 任务管理 | 列表/详情/UI 消息/单条完整消息/删除/分类/SQL 重跑与变量执行/存入 RAG | `/api/ai_task/{list,tasks,getTaskInfo,getUiMessageById,messagePayload,deleteTaskWithId,category/*,rerunSqlTask,runExtractSql,saveToRag}` | server-api §3 |
| 浏览器自动化 Browser Use | AI 像真人操作浏览器：采集、填表、多步网页流程（需装 Chrome 扩展） | `GET /api/ai_browser/session` | chrome-plugin-install；server-api §2.3 |
| 任务分享（公开只读） | 设为公开后免鉴权读数据/消息/文件树/下载 | `setShare`、`publicTask`、`publicMessagePayload`、`publicTaskFileTree`、`publicPreviewFile`、`publicDownloadTaskFile`、`publicDownloadZip` | server-api §3.6 |
| 数据源 / RAG 市场 | 发现、订阅、查详情共享数据源与知识库 | `/database-market/*`、`/rag-market/*`（account API base） | server-api §4.5、§5.5 |
| CLI（agent_infini） | 终端 / Agent 工作流：任务、数据库、RAG、工作区下载 | `init`、`task new/ask/cancel/ls/show/rm/file/preview/download`、`db`、`rag`、`task context` | cli-api §4 |
| 私有化部署 | Docker Compose 一键部署；初始化管理员、备份、升级、排错 | `private-deployment-guide.md` 全流程 | private-deployment |

## 支持的数据库类型

`mysql`、`postgres`、`sqlite`、`sqlserver`、`clickhouse`、`snowflake`、`doris`、`starrocks`、`gbase`、`kingbase`、`dm`、`supabase`、`deltalake`、`file`（`testConnection` 另支持 `mongodb`、`elasticsearch`）。出处：server-api §4。

## 接着读什么

| 想做的事 | 去哪 |
| --- | --- |
| 跑通一个长任务（SSE→newTask→产物） | [task-lifecycle.md](task-lifecycle.md) |
| 查具体端点/方法/字段 | [api-index.md](api-index.md) |
| SaaS 接入、控制台、计算资源、请求头速查 | [../QUICK-REFERENCE.md](../QUICK-REFERENCE.md) |
| RAG 资料 / 上传文件放哪里 | [../playbooks/rag-file-placement.md](../playbooks/rag-file-placement.md) |
| 出错了怎么排查 | [../playbooks/troubleshooting.md](../playbooks/troubleshooting.md) |
| 直接抄可跑代码 | `samples/sdk/`、`samples/templates/curl-quickstart.md` |
