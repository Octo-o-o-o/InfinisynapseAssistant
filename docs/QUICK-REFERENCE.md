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

## 长任务流程

1. `GET /api/ai/events?connId=<uuid>`
2. `POST /api/ai/message`，`type=newTask`
3. 消费 SSE：`message.partial`、`message.add`、`notification`、`heartbeat`
4. 需要继续回答时使用 `type=askResponse`
5. 用 `GET /api/ai_task/getTaskWorkspace/:id` 查看产物
6. 用 `POST /api/ai_task/previewFile` 预览
7. 用 `GET /api/tools/storage/downloadTaskFile/:taskId?path=` 下载

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
