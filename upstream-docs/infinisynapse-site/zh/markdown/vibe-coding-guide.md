# InfiniSynapse Vibe Coding Guide


本文是为 Vibe Coding 大赛参赛者准备的一站式开发指南，按 Agent Skill 的格式组织，提炼汇总了三部分内容：CLI 的使用、Server API 的调用、以及把 InfiniSynapse 集成进自己产品的实践。你可以把本文全文保存为 `SKILL.md`，放进 Cursor / Claude Code / Codex 等 AI 编程工具的 skills 目录，让 AI 助手按本文规范帮你调用 InfiniSynapse。

以下是 Skill 的元信息（frontmatter），保存为 `SKILL.md` 时置于文件最顶部：

```
---
name: infinisynapse-vibe-coding
description: 通过 InfiniSynapse CLI（agent_infini）或 Server HTTP API 运行多轮 AI 数据分析任务、管理数据源与 RAG 知识库、读取任务工作区产物，并把 InfiniSynapse 作为长任务 Agent 层集成到自己的应用中。当用户提到 InfiniSynapse、agent_infini、Vibe Coding 大赛，或需要基于 InfiniSynapse 构建应用时使用。
---
```


## 核心概念

InfiniSynapse 是一个 AI Agent 平台：你用一句话发起任务，Agent 在服务端沙箱里多步骤执行（查数据库、检索知识库、写代码、生成报告），过程通过 SSE 实时推送，产物（Markdown、PDF、图表、数据文件）沉淀在**任务工作区**（workspace）中，可预览和下载。

三条接入路径，按需选择：

| 路径 | 适合场景 |
|----|----|
| CLI（`agent_infini`） | 命令行使用、脚本自动化、AI Agent 工作流，最快上手 |
| Server HTTP API | 自己写应用/mini-app，需要直接发 HTTP 请求、消费 SSE |
| 产品集成 | 已有成熟产品，把 InfiniSynapse 接成受控的长任务 Agent 层 |

## 准备工作：获取 API Key

1.  打开并登录 <https://app.infinisynapse.cn/tasks>（海外用 `.com`）。
2.  点击左下角「设置」齿轮图标，选择 **API Key Management**。
3.  点击 **Create API Key** 创建新的 Key。
4.  所有请求携带请求头 `Authorization: Bearer <你的 API Key>`。

服务地址一览（国内用 `.cn`，海外用 `.com`，私有化部署替换为自己的地址）：

| 服务 | 默认地址 | 作用 |
|----|----|----|
| 主应用服务（Server） | `https://app.infinisynapse.cn` | 任务对话、数据源/RAG 管理、工作区文件 |
| 账号/市场服务（Console） | `https://api.infinisynapse.cn/api` | API Key 校验、数据源/RAG/Skill 市场 |

安全底线：**API Key 只保存在服务端或本地配置**，不要写入前端代码、公开仓库或客户端。泄露后应在 API Key Management 中删除旧 Key 并重建。

开发调试时，`https://app.infinisynapse.cn/tasks` 就是你的后台控制台：通过 API 发起的任务都会出现在左侧 **ALL TASKS** 列表，可回看消息记录、执行过程和工作区产物；右上角可查看额度、充值，或创建独占计算资源。

## 第一部分：CLI 的使用（agent_infini）

`agent_infini` 是 InfiniSynapse 的命令行工具，默认安装位置 `~/.infini/bin/agent_infini`（Windows：`%USERPROFILE%\.infini\bin\agent_infini.exe`）。不在 PATH 里时用完整路径调用。

### 初始化

首次使用前初始化一次配置：

```
agent_infini init --api-key "your_api_key"
```


配置写入 `~/.agent_infini/config.txt`，可用 `--server` / `--console` / `--prefer-language` 覆盖默认地址与语言。

### 推荐工作流

1.  初始化：`agent_infini init --api-key "your_api_key"`
2.  列出资源：`agent_infini db ls` / `agent_infini rag ls`
3.  检查上下文：`agent_infini task context`；需要时用 `db enable` / `rag enable` 启用
4.  多轮对话：`agent_infini task new "..."`，然后 `agent_infini task ask <taskId> "..."`
5.  管理任务与文件：`task ls` / `task show` / `task file` / `task download`

### 命令速查

任务相关：

```
agent_infini task new "分析用户增长趋势"          # 新建任务（SSE 流式输出）
agent_infini task ask <taskId> "改成柱状图展示"    # 在同一任务里多轮追问
agent_infini task ls [--page N] [--search Q]      # 任务列表
agent_infini task show <taskId>                   # 任务详情
agent_infini task context                         # 查看已启用的数据库与 RAG
agent_infini task cancel <taskId>                 # 取消运行中的任务
agent_infini task rm <id1> [id2 ...]              # 批量删除任务
agent_infini task file <taskId>                   # 列出工作区文件
agent_infini task preview <taskId> <fileName>     # 预览文件内容
agent_infini task download <taskId> <fileName> [-o dir]  # 下载文件到本地
```


数据库与 RAG 知识库：

```
agent_infini db ls [--name N] [--type T] [--enabled] [--disabled]
agent_infini db enable <id> [id...]
agent_infini db disable <id> [id...]

agent_infini rag ls [--keyword K] [--enabled] [--disabled]
agent_infini rag enable <id> [id...]
agent_infini rag disable <id> [id...]
```


支持的数据库类型：`mysql, postgres, sqlite, sqlserver, clickhouse, snowflake, doris, starrocks, gbase, kingbase, dm, supabase, deltalake, file`。

### 输出格式

默认 JSON 输出（`--table` 可切换表格），成功为 `{"success": true, "data": {...}}`，失败为 `{"success": false, "error": "..."}`，列表命令可直接管道给 `jq`：

```
agent_infini task ls | jq '.items[].task_name'
```


### 典型场景

```
# 启用数据库后开始分析
agent_infini db ls
agent_infini db enable <id>
agent_infini task new "我的数据库里有哪些表？"

# 多轮分析
agent_infini task new "分析 users 表结构"
agent_infini task ask <taskId> "找出最活跃的前 10 个用户"
agent_infini task ask <taskId> "生成一份总结报告"

# 处理工作区文件
agent_infini task file <taskId>
agent_infini task preview <taskId> analysis.py
agent_infini task download <taskId> report.csv -o ./results/
```


### CLI 排错

- Token 过期/失效：重新执行 `agent_infini init` 或修改 `~/.agent_infini/config.txt` 中的 `api-key`
- 服务不可达：检查 `--server` 地址与网络
- 任务找不到：用 `task ls` 获取有效的 `taskId`
- 无可用资源：先 `task context` 检查，再 `db enable` / `rag enable` 启用

## 第二部分：Server API 的调用

需要在自己的应用里直接发 HTTP 请求时使用。所有接口以 `/api` 开头，请求头带 `Authorization: Bearer <API Key>`，可选 `x-lang`（`zh_CN` 默认 / `en` / `ja` / `ko` / `ru` / `ar`）。

### 统一响应结构

```
{ "code": 200, "message": "success", "data": { } }
```


- `code === 200` 成功，业务数据在 `data` 中。
- `code` 为 `1101` / `1105`：Token 过期或失效，需更换 API Key。
- 参数校验失败返回 HTTP `422`；文件下载类接口直接返回二进制流，不走该信封。
- 列表接口支持 `page`、`pageSize`、`field`、`order` 分页参数，响应含 `items` + `meta`。

### 核心模式：先连 SSE，再发消息

AI 对话是「SSE 长连接 + 消息投递」的异步组合，**顺序不能反**：

```
# 第 1 步：订阅事件流（客户端自己生成 connId，如 UUID）
curl -N "https://app.infinisynapse.cn/api/ai/events?connId=<uuid>" \
  -H "Authorization: Bearer <你的 API Key>" \
  -H "Accept: text/event-stream"

# 第 2 步：新建任务（带同一个 connId）
curl -X POST "https://app.infinisynapse.cn/api/ai/message" \
  -H "Authorization: Bearer <你的 API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"newTask","text":"分析最近一个月的销售趋势","connId":"<uuid>"}'

# 多轮追问
curl -X POST "https://app.infinisynapse.cn/api/ai/message" \
  -H "Authorization: Bearer <你的 API Key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"askResponse","taskId":"<taskId>","askResponse":"messageResponse","text":"再按地区拆分"}'
```


SSE 关键事件：`message.add` / `message.partial`（消息与流式增量）、`state.ready`（状态就绪）、`notification`（`type=error` 视为任务失败）、`heartbeat`（保活）。

消息里的关键信号：

| 信号 | 含义与处理 |
|----|----|
| `message.type=say` | Agent 输出，`message.text` 为文本内容 |
| `message.ask=upload_file_to_sandbox` | Agent 请求上传本地文件：先调上传接口，再用 `askResponse` 把上传结果 JSON 回传 |
| `message.ask/say=completion_result` | 任务完成，可以去读取工作区产物 |

`POST /api/ai/message` 其他常用 `type`：`cancelTask`（取消）、`optionsResponse`（多选项回复）、`togglePlanActMode`（切换规划/执行模式）。新建任务时建议带 `chatSettings: { "mode": "act" }` 和 `autoApprovalSettings` 减少确认交互。

### 集成建议流程

1.  客户端生成 `connId`（并发场景可同时预生成 `taskId`）。
2.  建立 `GET /api/ai/events?connId=<uuid>`。
3.  `POST /api/ai/message`，`type=newTask`，带同一个 `connId`。
4.  从 SSE 的 `message.partial` / `message.add` 读取进度。
5.  收到 `upload_file_to_sandbox` 时先上传文件，再用 `askResponse` 回传结果。
6.  收到 `completion_result` 后，用任务文件接口读取报告、图表、PDF 等产物。

### 常用接口速查

任务管理（前缀 `/api/ai_task`）：

| 接口 | 方法 | 说明 |
|----|----|----|
| `/api/ai_task/list` | GET | 分页任务列表，可按 `task_name` 搜索 |
| `/api/ai_task/getTaskInfo/:id` | GET | 任务元信息与状态 |
| `/api/ai_task/getUiMessageById?id=` | GET | 任务 UI 消息列表（页面刷新后恢复进度用） |
| `/api/ai_task/getTaskWorkspace/:id` | GET | 工作区目录与文件列表 `{ cwd, files }` |
| `/api/ai_task/previewFile` | POST | `{ taskId, fileName }` 预览文件内容 |
| `/api/ai_task/cancelTask?taskId=` | GET/POST | 取消运行中的任务 |
| `/api/ai_task/deleteTaskWithId` | POST | `{ ids: [] }` 批量删除 |
| `/api/ai_task/downloadZip?taskId=` | GET | 整个任务目录打包下载（二进制流） |
| `/api/ai_task/setShare` | POST | `{ taskId, isPublic }` 设置任务公开分享 |

文件上传与下载：

| 接口 | 方法 | 说明 |
|----|----|----|
| `/api/ai/upload?taskId=` | POST | multipart 上传到任务沙箱，用于响应 Agent 的 `upload_file_to_sandbox` |
| `/api/tools/taskUpload/:taskId` | POST | 应用主动把资料归档到任务工作区，支持 `subdir`、`naming` |
| `/api/tools/storage/downloadTaskFile/:taskId?path=` | GET | 下载工作区文件；加 `inline=1` 可内联渲染图片/PDF |

数据源与 RAG（前缀 `/api/ai_database`、`/api/ai_rag_sdk`）：

| 接口 | 方法 | 说明 |
|----|----|----|
| `/api/ai_database/list` | GET | 数据源列表，支持 `name`、`type`、`enabled`、`source` 筛选 |
| `/api/ai_database/add` / `update` / `delete` | POST | 数据源增删改 |
| `/api/ai_database/enabled` | POST | `{ ids: [], enabled: 1|0 }` 批量启停 |
| `/api/ai_database/testConnection` | POST | 测试连接 |
| `/api/ai_database/upload/:databaseId` | POST | 上传数据文件（≤1GB） |
| `/api/ai_rag_sdk` | GET | 知识库列表，支持 `keyword`、`enabled` 筛选 |
| `/api/ai_rag_sdk/create` / `update/:id` / `delete` | POST | 知识库增删改 |
| `/api/ai_rag_sdk/enabled` | POST | 批量启停 |

Skill 管理（前缀 `/api/ai_skill`）：`install`（市场安装）、`upload`（本地 zip 上传，包内任意层级含 `SKILL.md`）、`toggleStatus`（启停）、`list`（已安装列表）。只对单次任务生效的方法论/模板，走任务文件上传链路即可，不必安装为用户级 Skill。

市场类接口（数据源/RAG/Skill 的发现与订阅）走账号服务 `https://api.infinisynapse.cn/api`，如 `/database-market/public`、`/rag-market/subscribe`、`/skill/public/getSkillList`。订阅完成后回到 Server API 用 `list` + `enabled` 启用。

**注意：数据库和知识库必须在 `newTask` 之前完成 list + enabled，否则 Agent 看不到这些资源。**

### 错误处理

| 现象 | 处理建议 |
|----|----|
| `code` 为 `1101` / `1105` | Token 过期或失效，更换 API Key 后重试 |
| HTTP `422` | 请求参数校验失败，`message` 为具体原因 |
| HTTP `400` | 业务校验失败（文件超限、命名非法等） |
| HTTP `404` | 资源/文件不存在或无权访问 |
| SSE 无数据 | 检查 `Authorization` 头，确认先建立 `/api/ai/events` 再发消息 |

## 第三部分：集成实践（把 InfiniSynapse 接进你的应用）

一句话规则：**不要把 InfiniSynapse 当作重写产品的理由，把它接成受控的长任务 Agent 层**。你的应用继续托管用户、权限、核心数据和确定性业务状态；InfiniSynapse 负责多步骤研究、报告生成、workspace 产物、可选的 RAG / 数据源协作。

### 职责边界

| 留在自己的应用                    | 交给 InfiniSynapse                      |
|-----------------------------------|-----------------------------------------|
| 用户、权限、审计、计费、风控      | 长任务 Agent 执行、SSE 进度、任务工作区 |
| 业务主数据、状态机、核心记录      | 多步骤研究、报告写作、方案生成          |
| 低延迟结构化 LLM 调用、确定性规则 | 需要探索、归纳、写作、产物文件的任务    |

判断标准：必须低延迟返回、逐字段可验证、受行级权限控制的能力留在自己的应用；长耗时、跨资料综合、产出 Markdown/PDF/表格的工作交给 InfiniSynapse。

### 推荐架构

新增一个后端适配层，不要让业务代码到处直连 InfiniSynapse，更不要让前端直连：

```
前端 -> 你的后端 API -> InfiniSynapse 适配层 -> InfiniSynapse Server API
                      -> 你的数据库 / 队列 / 产物存储
```


适配层负责：统一 Base URL 与 API Key、生成并持久化 `taskId` / `connId` / 输入快照 / 上传映射 / workspace 文件索引、先连 SSE 再发 `newTask`、把 SSE 转成自己产品的任务状态、完成后读取产物并落库索引。

### 关键工程实践

- **先 SSE 后 newTask**：顺序反了会错过早期消息。
- **`newTask` 是外部副作用**：入队前预生成 `taskId` / `connId` 写入自己的数据库；worker 崩溃恢复时先查 `getUiMessageById` 和 `getTaskWorkspace`，不要盲目重发 `newTask`。
- **凭据只在服务端**：前端用自己的业务任务 ID 调自己的后端；不要把 InfiniSynapse `taskId` 当作前端可直接访问的授权凭证。
- **多租户边界**：单个 API Key 对应同一个 InfiniSynapse 账号，不等于给每个业务用户做了物理隔离；必须用自己的用户/权限体系控制业务任务与产物访问，不要把多个用户的私密文件混存到同一个长期 RAG。
- **区分两类上传**：`/api/ai/upload?taskId=` 用于响应 Agent 的沙箱上传请求；`/api/tools/taskUpload/:taskId` 用于应用主动归档资料。
- **结果优先走工作区**：需要下载、预览、导出时用 `getTaskWorkspace` + `previewFile` + `downloadTaskFile`；下载类接口按二进制流处理，不要按 JSON 解析。
- **恢复能力前置设计**：保存 `taskId`、`connId`、用户输入、上传文件映射和最后状态，页面刷新后用 `getUiMessageById` 与 `getTaskWorkspace` 恢复。
- **隐私最小化**：数据库里保存输入摘要、内容 hash、产物索引即可；简历、合同等敏感原文和 Agent 中间消息全文要谨慎保存。

### 分阶段路线

- **P0 一个低风险闭环**：选一个小范围、可手动复核的长任务（如"生成深度报告"）。feature flag 默认关闭；建自己的 `AgentTask` 表；API 路由只入队，worker 先 SSE 再 `newTask`；完成后读 workspace 形成产物记录。
- **P1 恢复、复用和取消**：用输入 hash 做同用户同输入去重；支持 `cancelTask` 并在自己数据库标记状态；产物做版本化。
- **P2 再加 RAG、数据源、分享和 Browser Use**：RAG/数据源必须在 `newTask` 前 list + enabled；`setShare` 前做业务侧公开确认；Browser Use 只在明确需要操作用户浏览器时才接（先查 `GET /api/ai_browser/session` 确认插件在线）。

### 不要默认做的事

- 不要把全部业务流改成 InfiniSynapse 长任务。
- 不要用 Browser Use 解决本可由后端 API、文件上传或数据库查询完成的问题。
- 不要自动执行投递、付款、发布、删除等外部写入动作；高风险动作需要审批。
- 除非文档中有明确 endpoint，否则不要编造 API。

### 集成检查清单

- API Key 是否只在服务端，前端是否只连自己的后端？
- 是否持久化 `taskId`、`connId`、输入 hash、上传映射和 workspace 快照？
- worker 是否先 SSE 后 `newTask`，并避免盲目重试外部副作用？
- 单 API Key 多租户边界是否被业务权限兜住？
- RAG / Browser Use 是否按需接入，而不是一开始默认启用？
- 是否有 feature flag、用量限制、取消、恢复和脱敏日志？

## 延伸阅读

本文是三篇参考文档的提炼汇总，需要完整端点定义、请求体字段和更多示例时查阅原文：

- [InfiniSynapse CLI API Reference](/zh/docs/InfiniSynapse%20CLI%20API%20Reference)：CLI 全部命令与其背后调用的接口对照
- [InfiniSynapse Server API Reference](/zh/docs/InfiniSynapse%20Server%20API%20Reference)：Server API 完整参考，含市场订阅、Skill 管理、已落地 App 的 API 组合场景
- [InfiniSynapse Existing Product Integration Playbook](/zh/docs/InfiniSynapse%20Existing%20Product%20Integration%20Playbook)：成熟产品接入的完整 playbook，含多租户、幂等、隐私与分阶段路线
