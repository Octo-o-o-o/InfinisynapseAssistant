# 排查 Playbook

> 特定用法总结：把 Server API、私有化部署、CLI 三处的错误码与症状合并成一张**症状→原因→处理**的排查表。
> 端点与错误码事实以 `docs/reference/api-index.md` 和上游中文 SaaS 文档为准；部署细节见 `infinisynapse-deployment` skill。

## 先按症状定位

| 症状 | 最可能原因 | 处理 |
| --- | --- | --- |
| 调用返回 `code` 为 `1101` / `1105` | API Key 过期或失效 | 换 Key；CLI 重跑 `agent_infini init` 或改 `~/.agent_infini/config.txt` 的 `api-key` |
| 调用返回 `code` 非 200（HTTP 200） | 业务错误，`message` 是原因 | 读 `message`；别把非 200 信封当成功（SDK 已按此抛错） |
| HTTP `422` | 请求参数校验失败 | 看 `message`（第一条校验错误），核对字段名/类型 |
| HTTP `400` | 业务校验失败 | 文件超限(>1GB)、命名非法（数据库名不能以 `remote_`/`subscribe_` 开头）、未带文件等 |
| HTTP `404` | 资源不存在或无权访问 | 核对 `taskId`/`id`；CLI 用 `task ls` 拿有效 ID |
| SSE 连上但收不到任何事件 | 鉴权错，或**没先连 SSE 再发任务** | 确认 `Authorization`；务必先 `GET /api/ai/events` 再 `POST /api/ai/message` |
| 任务跑完但结果不全 | 只读了最后一条 SSE 文本 | 用 `getTaskWorkspace` 枚举产物，`previewFile`/`downloadTaskFile` 取文件 |
| 下载到一堆"乱码 JSON" | 把二进制下载端点当 JSON 解析 | `downloadTaskFile`/`downloadZip`/`storage/download` 是二进制流，`-o file` 存盘 |
| Agent "看不到"数据源/知识库 | 资源没在建任务前启用 | `newTask` 前先 `list` + `enabled`（市场资源先订阅） |
| Agent 要文件但任务卡住 | 收到 `upload_file_to_sandbox` 没应答 | 先 `/api/ai/upload?taskId=` 上传，再 `askResponse` 回传结果 |
| Agent 反复修补被截断文件 / 写文件工具缺参数 | 产物过长、schema 字段不够明确，或 smoke 用例要求完整报告 | 收紧 prompt：固定小文件、字符/条数上限、逐字字段名；设置总超时并 `cancelTask`；随后用 `getTaskWorkspace` 恢复已有产物 |
| RAG 建库后检索不到本机文件 | SaaS 读不到本机路径 | `docDir` 必须是 InfiniSynapse 可访问位置；详见 [rag-file-placement.md](rag-file-placement.md) |

## 私有化部署专项

| 症状 | 最可能原因 | 处理 |
| --- | --- | --- |
| 登录失败 / 401 / 部署后空白页 | `AUTHING_SERVER_URL` 配错（**首要排查点**） | 四条都要满足：变量名是 `AUTHING_SERVER_URL`（不是 `AUTH_SERVER_URL`）、浏览器可达（非容器名/`127.0.0.1`）、端口 `3000` 路径 `/api`、无尾部 `/`。浏览器 DevTools Network 看请求是否走 `http://<server>:3000/api/...` |
| `infini-sql` 启动失败 / OOM | 内存不足（<32GB 未下调） | 下调 `.env` 的 `INFINI_SQL_SPARK_DRIVER_MEMORY`、`INFINI_SQL_MEM_LIMIT`、`INFINI_SQL_MEMSWAP_LIMIT` |
| 端口冲突 | `8088`/`80`/`3000` 被占 | 改 `.env` 的 `APP_PORT`、`PROXY_ADMIN_PORT` 等，并放行对外端口 |
| `infini-synapse-mysql-migrate` 显示 `Exited (0)` | 正常 | 这是一次性迁移任务，不是故障 |

扫描器规则对应：`INF-ENV-001/002/003`（见 `AGENTS.md` 第 8 节），改 `.env` 时 PostToolUse 钩子会提示。

## CLI 专项

| 症状 | 处理 |
| --- | --- |
| 服务不可达 | 检查 `~/.agent_infini/config.txt` 的 `server`（主应用）和 `console`（鉴权）地址与网络；私有化要确保接口路径可达 |
| 任务找不到 | `task ls` 拿有效 `taskId` |
| 无可用资源 | `task context` 看已启用的 DB/RAG，再 `db enable` / `rag enable` |
| 超时 | 普通请求 100s、控制台鉴权 15s、SSE 无超时；超时多为网络或服务端慢 |

## 用扫描器自查

```bash
npm run scan -- path/to/file        # 单文件查反模式
bash tools/test-suite.sh            # 跑回归
```

`INF-SEC-001/002`（Key 进前端/硬编码）、`INF-SSE-001`（发 newTask 没先连 SSE）、`INF-DL-001`（下载当 JSON）、`INF-ENV-*`（AUTHING_SERVER_URL）。
