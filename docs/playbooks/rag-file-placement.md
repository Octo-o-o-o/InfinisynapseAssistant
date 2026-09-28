# RAG 与文件放置 Playbook

本文是特定用法总结：它把 Server API 文档中的任务工作区、文件上传、RAG、数据源和产物下载能力合并成产品开发时的默认判断。端点事实以 `docs/reference/api-index.md` 和上游中文 SaaS 文档为准。

## 一句话规则

短期任务资料放 `task workspace/upload_documents`；长期知识库资料放 InfiniSynapse 可访问的 RAG 文档目录或 OSS/S3；本机目录不是 SaaS RAG 的可访问位置。

## 决策表

| 场景 | 放置位置 | 主要接口 | 说明 |
| --- | --- | --- | --- |
| 单次报告、求职分析、项目调研的输入文件 | 当前任务 workspace，建议 `upload_documents` 子目录 | `POST /api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` | 适合本次任务使用，不默认沉淀为长期知识库。 |
| Agent 执行中要求补文件 | 当前任务 sandbox | `POST /api/ai/upload?taskId=`，随后用 `askResponse` 继续 | 只在 SSE 中收到文件请求时使用。 |
| 长期 RAG 知识库 | InfiniSynapse 可访问的 RAG `docDir`，或 OSS/S3/file 后端 | `/api/ai_rag_sdk/create`, `/api/ai_rag_sdk/enabled`, `/api/ai_rag_sdk/fileTree` | 适合可复用知识库、公司资料、长期产品文档。 |
| 结构化表格或数据库文件 | 任务 workspace 临时分析，或数据源/数据库 | `/api/tools/taskUpload/:taskId`, `/api/ai_database/upload/:databaseId` | 取决于是否需要长期复用和结构化查询。 |
| 方法论 / `SKILL.md` / 写作规范模板 | 单次任务：目录树写进 prompt + 文件走 sandbox 链路；长期复用：安装为用户级 Skill | 单次走 `upload_file_to_sandbox` 响应链路；长期用 `/api/ai_skill/upload`（zip 内任意层级含 `SKILL.md`）或 `/api/ai_skill/install` | 两类 Skill 别混：任务级上下文只影响本次任务；用户级 Skill active 后 Agent 可跨任务 `use_skill`。见 api-index §5 与上游 server-api §6.4。 |
| 任务生成的报告、图表、附件 | 当前任务 workspace；成熟产品再归档到自有 artifact store | `getTaskWorkspace`, `previewFile`, `downloadTaskFile`, `downloadZip` | 完成后不要只读最后一条文本，要枚举 workspace。需要产品历史、下载 SLA 或合规审计时，保存 provider path + 自有 storage key；完整标准见 [artifact-archiving.md](artifact-archiving.md)。 |

## SaaS 版本的边界

在 SaaS 版本中，`docDir` 不能写成开发者电脑上的 `/Users/...` 或本机相对路径。InfiniSynapse SaaS 服务端无法读取你的本地磁盘。

如果资料只服务于一次任务，应先创建或复用任务，再上传到 task workspace 的 `upload_documents` 子目录。如果资料需要被多个任务长期复用，应放到 InfiniSynapse 服务端可访问的位置，例如平台可访问的文件系统、OSS/S3/file 后端，或已经创建并启用的 RAG 知识库资源。

## 推荐流程

### 单次资料分析

1. 后端生成 `connId`，需要恢复或提前上传时同时生成 `taskId`。
2. 用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 上传用户资料。
3. 先建立 `/api/ai/events?connId=...` SSE。
4. 再发送 `/api/ai/message` 的 `newTask`，提示 Agent 使用当前任务 workspace 中的 `upload_documents`。
5. 完成后用 `getTaskWorkspace` 枚举产物，用 `previewFile` 或 `downloadTaskFile` 读取结果。

如果这是面向用户的正式产品能力，完成后还应把最终交付物复制到自有对象存储或文件服务。InfiniSynapse workspace path 适合作为来源索引；业务下载、权限校验、留存策略和删除策略应优先走自有 artifact 记录。PDF/DOCX/ZIP/图片等下载结果是二进制流，归档和转发时不要按 JSON 信封解析。完整归档策略见 [artifact-archiving.md](artifact-archiving.md)。

### 多文件任务的上下文与授权边界

多文件输入不能只解决“能否上传”，还要同时解决来源授权、上下文确定性和结果 provenance：

1. 前端传来的 `sourceIds`、`databaseIds` 或 RAG 资源 ID 只是选择提示，不是授权凭据。后端必须按当前 `workspaceId`/tenant 和 ID 集合重新查询并校验归属；发现任一 ID 不属于当前工作区就拒绝，不能静默降级到无作用域查询或整个工作区。
2. 通过校验的来源先生成不可变选择快照，再按稳定 ID/显示名排序。文件名要做安全清洗；同名文件追加短 ID 后缀，并保存“业务来源 ID ↔ 平台返回的 `logicalPath`/`filename`”映射，prompt 和结果引用只使用平台实际路径。
3. 上传前做文件数量、单文件大小和总字节数 preflight；多个文件默认顺序上传并及时释放中间 buffer，避免并发上传造成内存峰值或部分映射未落库。并行 child task 必须各自拥有独立 workspace，并接收完整的已授权上下文，不能只把文件发给其中一个 child。
4. prompt 应列出本次文件清单及每个文件的角色、期间、指标/口径；要求最终结果携带文件名或路径 provenance。不要暗示“所有文件都同等代表真相”，应明确主来源、辅助来源和冲突处理规则。

这套规则同样适用于数据库/RAG 资源：资源启用状态、查询范围和任务 prompt 必须绑定同一份选择快照，并在 `newTask` 前完成。

### 长期知识库问答

1. 确认文件位置能被 InfiniSynapse 服务端访问。
2. 创建或选择 RAG 配置。
3. 使用 RAG 相关接口查看文件树、启用知识库，并在创建任务前把相关资源设为 enabled。
4. 创建任务时让 Agent 明确使用已启用的知识库，而不是读取本地路径。

### 执行中补文件

1. 监听 SSE。
2. 收到 `message.ask=upload_file_to_sandbox` 时，调用 `/api/ai/upload?taskId=`。
3. 用 `/api/ai/message` 发送 `askResponse`，把上传结果返回给 Agent。
4. 继续监听 SSE，直到任务完成。

## 常见反模式

- 把 SaaS RAG 的 `docDir` 写成 `/Users/...`。
- 把一次性任务资料做成长期 RAG，导致知识库污染和权限边界变复杂。
- Agent 没有请求文件时滥用 `/api/ai/upload`。
- 上传了输入资料，但任务完成后只读最后一条 SSE 文本，不检查 workspace 产物。
- 只保存 InfiniSynapse workspace path，不归档关键交付物，导致业务历史下载依赖执行侧 workspace 的长期可用性。
- 创建任务后才临时启用 RAG 或数据源，导致 Agent 本轮任务不可见。
- 直接信任客户端 `sourceIds`，或只按 ID 查询而不带 `workspaceId`/tenant 过滤。
- 多个来源使用不稳定的原始文件名，导致同名覆盖、prompt 引用与实际上传路径不一致。
- 并行 child task 复用同一个 workspace，或只给部分 child 上传上下文。

## 检查清单

- 这份文件是单次使用还是长期复用？
- InfiniSynapse 服务端是否能访问文件所在位置？
- 如果是 SaaS，是否避免了本机路径？
- 上传接口是主动归档到 workspace，还是响应 Agent 的 sandbox 请求？
- RAG 或数据源是否在 `newTask` 前已经启用？
- 所有 `sourceIds`/database/RAG ID 是否已按业务工作区二次授权，并保存选择快照？
- 是否有确定性文件名、平台路径映射、数量/单文件/总大小 preflight 和 provenance？
- 并行 child 是否各自隔离 workspace，并收到完整上下文？
- 任务完成后是否读取了 workspace 产物？
- 正式产品的关键产物是否已归档到自有 artifact store，并保留 provider path？
