# 成熟产品接入 InfiniSynapse Playbook

> 特定用法总结：面向已经有用户、数据库、权限、队列、业务状态或自研 AI 能力的 SaaS / 老项目。本文回答"InfiniSynapse 应该接在哪里、哪些不要替换、如何处理多租户和长任务副作用"。端点事实以 `docs/reference/api-index.md`、`docs/reference/task-lifecycle.md` 和上游中文 SaaS 文档为准。

## 一句话规则

不要把 InfiniSynapse 当作重写成熟产品的理由；把它接成受控的长任务 Agent 层。自有产品继续托管用户、权限、核心数据、计费、确定性业务状态和短链路能力，InfiniSynapse 负责多步骤研究、报告生成、workspace 产物、可选 Browser Use 和可选 RAG / 数据源协作。

## 什么时候适用

- 产品已经有业务数据库、用户体系、权限边界、订阅/用量或管理后台。
- 已有短链路 LLM、结构化抽取、匹配、评分、RAG 或规则引擎，且延迟/可控性要求高。
- 新能力是"多步骤、长耗时、需要产物沉淀"的 Agent 任务，例如深度研究、报告包、材料整合、策略生成、批量分析。
- 需要把 InfiniSynapse 产物纳入自有业务流程，而不是只在 InfiniSynapse 控制台手工使用。

不适用的情况：只是一次性脚本或 demo，可以直接按 `samples/sdk/` 的最小长任务骨架做；需要浏览器操作时另读 [browser-use.md](browser-use.md)。

## 职责边界

| 留在自有产品 | 交给 InfiniSynapse |
| --- | --- |
| 用户、组织、权限、审计、计费、用量、风控 | 长任务 Agent 执行、SSE 进度、任务工作区 |
| 业务主数据、状态机、投递/订单/项目等核心记录 | 多步骤研究、报告写作、候选方案生成 |
| 低延迟结构化 LLM 调用、可缓存评分、确定性规则 | 需要探索、归纳、写作、产物文件的任务 |
| 已有带行级权限和来源证据的业务知识系统 | 仅在确认隔离和复用边界后启用的 RAG / 数据源 |
| 业务侧文件权限和敏感数据最小化 | 当前任务 workspace、最终报告和附件 |

判断标准：如果一个能力必须严格遵循业务状态机、低延迟返回、逐字段可验证或受行级权限控制，默认留在自有产品；如果它是长耗时、需要跨资料综合、产出 Markdown/PDF/表格/附件的工作，优先考虑 InfiniSynapse。

## 推荐接入层

成熟产品应新增一个后端适配层，而不是让业务代码到处直接调 InfiniSynapse：

```text
Frontend -> Product API -> AgentTaskService / InfiniSynapseAdapter -> InfiniSynapse Server API
                         -> Product DB / Queue / Artifact Store
```

适配层负责：

- 统一 Base URL、API Key、请求 envelope、二进制下载、错误归一化。
- 生成并持久化 `taskId`、`connId`、业务输入快照、上传映射、workspace 文件索引、错误信息。
- 先连 SSE，再发送 `newTask`。
- 把 InfiniSynapse SSE 转成自有产品的任务状态和前端进度。
- 完成后读取 `getTaskWorkspace` / `previewFile` / `downloadTaskFile`，保存产物索引。

## 分阶段路线

### P0：一个低风险闭环

先接一个小范围用户、单业务流、可手动复核的长任务，例如"生成深度报告"或"材料分析包"：

1. 后端 feature flag 默认关闭，API Key 缺失时 fail closed。
2. 新建自有 `AgentTask` 表，保存 `taskId`、`connId`、输入哈希、状态、workspace snapshot、错误。
3. API route 只创建业务任务和入队，不在请求线程里跑完整长任务。
4. Worker 先建立 SSE，再发 `newTask`，实时落库进度。
5. 完成后读取 workspace，形成业务可展示的 artifact 记录。
6. 前端只展示自有业务任务 ID，不让用户直接调用 InfiniSynapse endpoint。

### P1：恢复、复用和取消

- 用 `input_hash` 做同用户同输入去重：已完成任务可复用，进行中任务返回已有记录。
- 支持 `cancelTask`，并在自有数据库标记 `cancelled`。
- worker 崩溃后先查 `getUiMessageById` 和 `getTaskWorkspace`，不要盲目重发 `newTask`。
- 对产物做版本化或快照，避免后续任务覆盖业务展示。

### P2：RAG、数据源、分享和 Browser Use

只有在 P0/P1 稳定后再加：

- RAG / 数据源：必须在 `newTask` 前 list + enabled；私密资料默认不要进入共享长期 RAG。
- 任务分享：用 `setShare` 前先做业务侧公开确认，不要默认公开含隐私的任务。
- Browser Use：只有明确需要操作用户浏览器时才接；建任务前查 `/api/ai_browser/session`。
- ZIP / 文件下载：下载类接口按二进制流处理，不按 JSON envelope 解析。

## 多租户和单 API Key 边界

在 SaaS 形态下，一个 InfiniSynapse API Key 通常对应同一个 InfiniSynapse 账号/控制台视角。它能让自有后端安全地代理请求，但不等于给每个业务用户创建了物理隔离的 InfiniSynapse 租户。

默认约束：

- 自有产品必须用自己的用户/组织权限控制业务任务和产物访问。
- 不要把 InfiniSynapse `taskId` 当作前端可直接访问的授权凭证；前端用自有 `agentTaskId` 调自有后端。
- 普通多租户 SaaS 默认只做"业务侧逻辑隔离"；高敏场景需要评估私有化部署、per-tenant API Key 或独立环境。独占计算资源只能改善资源稳定性和执行环境边界，不能自动替代业务租户隔离。
- 不要默认把多个用户的私密文件或简历、合同、客户资料保存到同一个长期 RAG。
- Browser Use session 可能与 InfiniSynapse 账号/插件连接相关；没有确认 per-user session 隔离前，不要把浏览器自动化开放给所有租户用户。

## 长任务 worker 和幂等

`newTask` 是外部副作用。队列重试不能按普通纯函数任务处理。

推荐做法：

- 在入队前预生成 `taskId` 和 `connId`，并写入自有数据库。
- 队列 `jobId` 使用自有任务 ID，避免重复入队。
- 默认不要让 worker 在崩溃后自动无限重发 `newTask`；恢复时先查 `getUiMessageById`、`getTaskWorkspace` 和本地状态。
- 如果必须 retry，先判断同一 `taskId` 是否已经出现消息或 workspace 产物，再决定继续监听、标记待人工处理或显式创建新任务。
- 长 SSE worker 要有足够长的 lock、心跳/续锁、graceful shutdown 和超时策略。
- 错误对象和日志只保存脱敏摘要，不保存完整 API Key、完整敏感输入或下载文件内容。

## 输入快照和隐私

业务数据库需要可恢复，但不应无节制保存敏感原文。

推荐保存：

- 业务对象 ID、版本 ID、输入摘要、内容 hash、prompt version、用户补充要求。
- 上传文件到 task workspace 后的映射和文件名/大小/类型。
- workspace 产物路径、产物类型、生成时间和可展示摘要。

谨慎保存：

- 完整简历、合同、聊天记录、客户资料、联系方式、证件号等敏感原文。
- Agent 中间消息全文。确需审计时应做脱敏、保留期限和访问控制。

## 与已有 AI / RAG 系统共存

成熟产品常已有自研抽取、匹配、评分或知识系统。不要为了接入 InfiniSynapse 把它们全部替换。

保留已有能力的典型理由：

- 已有结构化 schema、缓存、测试样例和回归指标。
- 已有来源证据、人工审核、行级权限或业务规则。
- 用户交互需要秒级返回，而不是长任务。
- 下游状态机依赖确定性字段。

InfiniSynapse 更适合补强：

- 把多个已有结果整合成可交付报告。
- 对单个复杂对象做深度研究和推理。
- 生成用户可下载、可分享、可追踪的产物。
- 在用户确认后，把稳定成果保存为后续任务可复用资料。

## 不要默认做的事

- 不要把全部业务流改成 InfiniSynapse 长任务。
- 不要用 Browser Use 解决本来可以由后端 API、文件上传或数据库查询完成的问题。
- 不要在公开 SaaS 单 Key 下默认混存多用户长期 RAG。
- 不要假设存在未公开的原生 mini-app / 插件市场发布 API；除非上游文档明确新增接口，否则按自有后端 + Server API 实现。
- 不要自动执行投递、付款、发布、删除、发送消息等外部写入动作；高风险动作需要计划/审批，见 [plan-act-approval.md](plan-act-approval.md)。

## 检查清单

- 是否明确了哪些能力保留在自有产品，哪些交给 InfiniSynapse？
- API Key 是否只在服务端，前端是否只连自有后端？
- 是否持久化 `taskId`、`connId`、输入 hash、上传映射、workspace snapshot 和错误？
- worker 是否先 SSE 后 `newTask`，并避免盲目重试外部副作用？
- 单 API Key 多租户边界是否被业务权限和产物访问控制兜住？
- RAG / Browser Use 是否按需接入，而不是 P0 默认启用？
- 是否有 feature flag、用量限制、取消、恢复和脱敏日志？
