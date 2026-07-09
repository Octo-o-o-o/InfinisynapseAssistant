# 术语表

> 把 InfiniSynapse 开发里易混的术语集中速查。每条只给一句话定义 + 指向权威文档，不复述细节。
> 事实来源：`upstream-docs/infinisynapse-site/zh/markdown/`。

## 任务与连接

| 术语 | 含义 | 见 |
| --- | --- | --- |
| `connId` | 客户端生成的 SSE 连接 ID（UUID），多 Tab/多连接各一个，服务端按它定向推送 | [task-lifecycle.md](task-lifecycle.md) |
| `taskId` | 任务 ID（UUID），服务端可自动生成，也可客户端预生成以便并发/恢复 | [task-lifecycle.md](task-lifecycle.md) |
| `newTask` / `askResponse` / `cancelTask` | `POST /api/ai/message` 的 `type`：新建 / 追问 / 取消 | [api-index.md](api-index.md) |
| `state.ready` | SSE 事件，状态就绪 | [task-lifecycle.md](task-lifecycle.md) |
| `completion_result` | 任务完成信号；`message.say` 或 `message.ask` 取此值都算完成（两个都要判） | [task-lifecycle.md](task-lifecycle.md) |
| `heartbeat` / `"ping"` | SSE 保活事件，可忽略 | [task-lifecycle.md](task-lifecycle.md) |

## 消息字段

| 术语 | 含义 | 见 |
| --- | --- | --- |
| `message.type` = `say` / `ask` | `say`=Agent 输出；`ask`=等待客户端响应 | [task-lifecycle.md](task-lifecycle.md) |
| `message.partial` | 流式增量/覆盖（同 `ts` 覆盖累积，别无脑拼接） | [task-lifecycle.md](task-lifecycle.md) |
| `upload_file_to_sandbox` | `message.ask` 的取值；Agent 请求把本地文件传到当前任务沙箱 | [task-lifecycle.md](task-lifecycle.md) |

## AI 调用路由

| 术语 | 含义 | 见 |
| --- | --- | --- |
| 非 agentic 调用 | 一问一答、摘要、改写、翻译、分类、抽取、轻量评分等短链路 LLM 调用 | [playbooks/llm-routing.md](../playbooks/llm-routing.md) |
| agentic 长任务 | 需要多步骤工具使用、异步恢复、Browser Use、workspace 产物或深度调研的任务 | [playbooks/llm-routing.md](../playbooks/llm-routing.md) |
| `LlmGateway` | 业务后端里的轻量 LLM 调用封装；provider key 只在服务端 | [playbooks/llm-routing.md](../playbooks/llm-routing.md) |
| `AgentTaskService` | 业务后端里的 InfiniSynapse 长任务适配层，负责 `taskId`、`connId`、SSE、workspace 和归档 | [playbooks/llm-routing.md](../playbooks/llm-routing.md) |

## 文件与存储

| 术语 | 含义 | 见 |
| --- | --- | --- |
| sandbox（沙箱） | 任务沙箱；响应 Agent `upload_file_to_sandbox` 时的上传位置（`/api/ai/upload`） | [playbooks/rag-file-placement.md](../playbooks/rag-file-placement.md) |
| workspace（工作区） | 任务工作目录；产物所在，用 `getTaskWorkspace` 枚举 | [playbooks/rag-file-placement.md](../playbooks/rag-file-placement.md) |
| `upload_documents` | `taskUpload` 主动归档资料的推荐子目录 | [playbooks/rag-file-placement.md](../playbooks/rag-file-placement.md) |
| 两类上传 | `/api/ai/upload`（被动响应 Agent）vs `/api/tools/taskUpload`（主动归档） | [api-index.md](api-index.md) §6 |
| `docDir` | RAG 知识库文档目录；SaaS 下必须是平台可访问位置，**不是本机 `/Users/...`** | [playbooks/rag-file-placement.md](../playbooks/rag-file-placement.md) |
| 二进制下载 | `downloadTaskFile`/`downloadZip`/`storage/download` 返回流，不走 JSON 信封 | [api-index.md](api-index.md) 末尾清单 |
| artifact store（自有产物库） | 业务侧对象存储/文件服务，用于长期下载、权限控制、留存和分析；provider workspace 只作来源索引 | [playbooks/artifact-archiving.md](../playbooks/artifact-archiving.md) |
| archive manifest | 归档索引文件，记录业务任务、provider path、自有 storage key、checksum、可见性和归档状态 | [playbooks/artifact-archiving.md](../playbooks/artifact-archiving.md) |
| scorecard version | 决策型产品里一次正式评分卡快照；Outcome 和 Watchlist delta 应绑定具体版本，避免后续修订污染历史判断 | [playbooks/decision-quality-loop.md](../playbooks/decision-quality-loop.md) |
| Outcome 回访 | 在完成决策后，到期记录真实结局并计算命中率/证伪率的业务闭环 | [playbooks/decision-quality-loop.md](../playbooks/decision-quality-loop.md) |
| Watchlist delta | 对确定性 connector baseline/current 快照做窄目标比对，只重评受影响模块的变化记录 | [playbooks/decision-quality-loop.md](../playbooks/decision-quality-loop.md) |

## 资源

| 术语 | 含义 | 见 |
| --- | --- | --- |
| 数据源（database）/ RAG | 任务可用的数据库连接 / 知识库；**必须在 `newTask` 前 list + `enabled`** | [capabilities.md](capabilities.md) |
| 市场订阅 | 共享数据源/知识库/Skill 的发现与订阅（account API：`/database-market`、`/rag-market`、`/skill/*`） | [api-index.md](api-index.md) §3/§4/§5 |
| 用户级 Skill | 通过 `/api/ai_skill/*` 安装/上传/启停的 Skill；active 后 Agent 可用 `use_skill` 跨任务复用 | [api-index.md](api-index.md) §5 |
| 任务级 Skill 上下文 | 单次任务临时带入的 `SKILL.md` 目录/方法论文档；目录树写进 prompt，文件走 `upload_file_to_sandbox` 链路，**不进用户 Skill 库** | [api-index.md](api-index.md) §5、上游 server-api §6.4 |
| `public-engine` | 默认公共计算资源 | [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) |
| 独占计算资源 | Create Exclusive Compute Resource，用于稳定配额/隔离/独占 | [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) |

## 鉴权与响应

| 术语 | 含义 | 见 |
| --- | --- | --- |
| API Key（Bearer Token） | 鉴权凭据，仅服务端持有 | [playbooks/secure-integration.md](../playbooks/secure-integration.md) |
| 统一信封 `{code,message,data}` | `code===200` 成功；非 200 视为错误；`1101`/`1105`=Token 失效 | [api-index.md](api-index.md) |
| `x-lang` | 可选语言头，默认 `zh_CN` | [api-index.md](api-index.md) |
| Partner SSO | 第三方产品「使用 InfiniSynapse 登录」：创建会话 → 用户在 app 域登录 → 一次性 `code` 换用户资料 | [api-index.md](api-index.md) §8 |
| `X-Client-Id` / `X-Client-Secret` | Partner SSO 服务端间鉴权头；`clientSecret` 只放服务端，泄露立即 rotate | [api-index.md](api-index.md) §8 |
| Partner API Key | `withApiKey:true` 时代用户签发的 `sk-` Key；归属用户本人、计费记用户账上、用户可吊销、可能签发失败需降级 | [api-index.md](api-index.md) §8 |

## 部署与工具

| 术语 | 含义 | 见 |
| --- | --- | --- |
| `AUTHING_SERVER_URL` | 私有化部署鉴权地址；变量名/浏览器可达/裸 `/api`/无尾斜杠 四条都要满足 | [playbooks/troubleshooting.md](../playbooks/troubleshooting.md) |
| `infini-sql` / InfiniSQL | 内存敏感组件，<32GB 内存需下调内存参数 | [playbooks/troubleshooting.md](../playbooks/troubleshooting.md) |
| `agent_infini` | CLI 工具，配置在 `~/.agent_infini/config.txt`（`server`/`console`/`api-key`/`prefer-language`） | `infinisynapse-cli` skill |
| `/tasks` | SaaS 控制台 + 开发者后台（ALL TASKS 回看任务） | [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) |
| Browser Use | 浏览器自动化扩展；用 `GET /api/ai_browser/session` 查是否在线 | `infinisynapse-browser-extension` skill |
