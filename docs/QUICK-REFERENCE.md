# 速查

## 私有化部署

- 推荐主机：8 核、32 GB RAM、100 GB 磁盘。
- 最低内存：16 GB，但需要降低 InfiniSQL 内存配置。
- 操作系统：推荐 Ubuntu 22.04 LTS。
- Docker：Docker >= 24，Compose plugin >= 2.20。
- 对外端口：`8088` 主应用、`80` 管理控制台、`3000` 认证 API。
- `AUTHING_SERVER_URL` 必须是浏览器可访问地址，通常是 `http://<server>:3000/api`。

## 基础地址

| 环境 | 基础地址 |
| --- | --- |
| 中国大陆 SaaS | `https://app.infinisynapse.cn` |
| 海外 SaaS | `https://app.infinisynapse.com` |
| 私有化部署 | 你的服务地址 |

所有 Server API endpoint 都以 `/api` 开头。

## SaaS 控制台

- API Key：打开 `https://app.infinisynapse.cn/tasks`，点击左下角设置，再进入 **API Key Management**。
- 通过 Server API 创建的任务会出现在 **ALL TASKS**。
- `public-engine` 是默认共享计算资源。
- 产品需要更稳定额度、资源隔离或独占执行时，使用 **Create Exclusive Compute Resource**。

## 请求头

```http
Authorization: Bearer <API Key>
Content-Type: application/json
x-lang: zh_CN
```

上传接口使用 `multipart/form-data`。

## LLM 调用路由

- 非 agentic 的一问一答、摘要、改写、翻译、分类、字段抽取、轻量评分，默认由业务后端直连 LLM。
- agentic 的深度调研、长任务、工具使用、Browser Use、报告/表格/PDF 等 workspace 产物，默认走 InfiniSynapse。
- 新项目即使还没有自有大模型调用层，也建议做最小 server-side `LlmGateway`；不要为了省一层封装，把所有轻量调用包装成 InfiniSynapse 任务。
- 两类 provider key 都只放服务端：LLM provider key 给 `LlmGateway`，InfiniSynapse API Key 给 `AgentTaskService` / backend worker。
- 详细决策表见 `docs/playbooks/llm-routing.md`。

## 长任务流程

1. `GET /api/ai/events?connId=<uuid>`
2. `POST /api/ai/message`，`type=newTask`
3. 消费 SSE：`message.partial`、`message.add`、`notification`、`heartbeat`
4. 需要继续回答时使用 `type=askResponse`
5. 用 `GET /api/ai_task/getTaskWorkspace/:id` 查看产物
6. 用 `POST /api/ai_task/previewFile` 预览
7. 用 `GET /api/tools/storage/downloadTaskFile/:taskId?path=` 下载
8. 取消时优先 `POST /api/ai/message`，`type=cancelTask`

## 成熟产品守卫

- prompt 中的"最多搜索 N 次 / 最多 N 个来源 / 控制 N 分钟"只是软目标，不是硬预算 API。
- 后端需要实现总耗时、SSE idle、可识别工具事件、child task、repair 轮数等 runtime guard。
- 超时或取消后先 `cancelTask`，再用 `getTaskWorkspace` 抢救已有产物；产物完整时进入 `validating` / `needs_review`，不要直接丢弃。
- 用户离开页面后继续运行和通知，需要业务后端 worker 托管 SSE；当前公开 Server API 不提供面向业务系统的完成 webhook。

## 上传模式

| Endpoint | 用途 |
| --- | --- |
| `/api/ai/upload?taskId=` | 响应 Agent sandbox 上传请求 |
| `/api/tools/taskUpload/:taskId?subdir=&naming=` | 产品主动把文件归档到 workspace |
| `/api/upload/:directory` | 通用目录上传 |

## RAG 与文件放置

- 短期任务资料放 task workspace，建议 `upload_documents` 子目录。
- Agent 执行中主动要文件时，才用 `/api/ai/upload?taskId=` 上传到 sandbox。
- 长期知识库资料放 InfiniSynapse 可访问的 RAG `docDir` 或 OSS/S3/file 后端。
- SaaS RAG 不能读取开发者本机 `/Users/...` 目录。
- 详细决策表见 `docs/playbooks/rag-file-placement.md`。

## 产物归档

- 简单问答、摘要、分类、改写、轻量抽取和短文本评分不要套用长任务 workspace 归档流程。
- workspace 是执行侧产物位置，不是成熟产品的唯一长期存储。
- 正式产品完成后应枚举 workspace，把必需最终产物归档到自有 artifact store（R2/S3/OSS/文件服务）；`manifest.json` / `workspace.zip` 是按需升级项。
- 业务库保存 `provider_path`、`storage_key`、`content_type`、`size`、`checksum`、`visibility` 和 `archive_status`。
- 用户下载优先读自有 storage；provider workspace 只作为恢复、补偿或 backfill 来源。
- 报告类任务可约定 `working/` 放草稿和中间材料，`final/` 放正式交付物；这是业务约定，不是 InfiniSynapse 原生语义。
- 开发环境可 fail-open；生产环境应明确必需产物归档失败是否阻断用户可下载完成态。
- 详细标准见 `docs/playbooks/artifact-archiving.md`。

## 常见错误

| 现象 | 优先检查 |
| --- | --- |
| `1101` / `1105` | API Key 是否过期或无效 |
| HTTP `422` | 请求参数校验错误 |
| HTTP `400` | 业务校验错误 |
| HTTP `404` | 资源不存在或无权限访问 |
| 没有 SSE 数据 | 鉴权是否正确，以及是否先连接 SSE 再发送任务 |
| 私有化部署后登录失败 / 空白页 | `AUTHING_SERVER_URL` |
| `infini-sql` OOM | 降低 InfiniSQL 内存环境变量 |
