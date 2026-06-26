# LLM 调用路由 Playbook

> 特定用法总结：面向已有大模型调用层的成熟产品，以及还没有自有 LLM 层的新项目。本文回答"轻量问答和长任务是否都走 InfiniSynapse"。端点事实以 `docs/reference/api-index.md`、`docs/reference/task-lifecycle.md` 和上游中文 SaaS 文档为准。

## 一句话规则

按工作负载分流，不按项目新旧分流：**非 agentic 的一问一答、低延迟结构化调用默认直连 LLM；agentic 的深度调研、长任务、工具使用和产物型工作默认走 InfiniSynapse**。

即使新项目还没有自有大模型调用层，也建议保留一个最小 server-side LLM gateway。不要为了省一层封装，把所有轻量调用都包装成 InfiniSynapse 长任务。

## 为什么默认分流

| 维度 | 轻量直连 LLM | 长任务走 InfiniSynapse |
| --- | --- | --- |
| 成本 | 单次调用链路短，容易按 prompt/token/cache 控制 | 适合高价值任务；需要业务侧加总耗时、工具次数和取消 guard |
| 性能 | 适合秒级返回、流式聊天、简单分类、结构化抽取 | 适合分钟级/更长的多步骤研究、写作和文件生成 |
| 稳定性 | 少一层任务状态和 SSE 恢复，失败面更小 | 有任务工作区、SSE 进度、恢复、上传、Browser Use、RAG/数据源协作 |
| 产品语义 | 返回一段文本或 JSON，通常没有长期产物 | 返回报告、表格、PDF、证据台账、workspace 文件和可归档产物 |

InfiniSynapse 的价值不在于替代所有模型调用，而在于承接需要 Agent 编排、异步恢复和工作区产物的任务。

## 路由决策表

| 调用类型 | 默认路由 | 判断标准 |
| --- | --- | --- |
| 普通聊天、一问一答、改写、摘要、翻译 | 直连 LLM | 单轮或短上下文，不需要工具、不需要任务恢复、不产生正式产物 |
| 分类、打标签、字段抽取、轻量评分 | 直连 LLM | schema 稳定、可缓存、延迟敏感、失败可快速重试 |
| 简单 RAG 问答 | 直连 LLM 或自有 RAG | 已有权限边界、检索链路和来源展示，返回文本为主 |
| 深度调研、尽调、证据驱动决策包 | InfiniSynapse | 需要多轮搜索、阅读、比较、推理、来源台账和最终报告 |
| 报告写作、材料整合、PDF/DOCX/表格产物 | InfiniSynapse | 需要 workspace、上传资料、阶段性草稿和最终文件归档 |
| 网页研究、购物比价、需要操作浏览器 | InfiniSynapse | 需要 Browser Use 或用户浏览器上下文 |
| 高风险外部写入动作 | InfiniSynapse + 业务审批 | 先 plan/act 审批；真正的写入权限、审计和撤销仍由业务系统控制 |

边界不清时先问一个工程问题：如果没有 `taskId`、SSE、workspace 和恢复，这个调用是否仍能稳定交付？能，默认直连 LLM；不能，默认走 InfiniSynapse。

## 新项目还没有 LLM 层时

推荐仍从两个后端能力开始，而不是所有 AI 调用都走 InfiniSynapse：

```text
Frontend
  -> Your Backend
    -> LlmGateway              # 非 agentic、短链路、结构化调用
    -> AgentTaskService        # InfiniSynapse 长任务、SSE、workspace、产物归档
```

`LlmGateway` 可以很薄，只需要统一模型供应商、API Key、超时、重试、日志脱敏和 token/cost 记录。它的存在是为了让轻量能力保持低延迟和低成本，不代表要先建设复杂 AI 平台。

`AgentTaskService` 负责 InfiniSynapse 侧的 `taskId`、`connId`、SSE、上传、取消、恢复、workspace 枚举和 artifact 归档。不要把这两类调用塞进同一个"chat"接口里，否则前端状态、计费和错误处理会混在一起。

## 已有项目有 LLM 层时

保留原有短链路 LLM 层，把 InfiniSynapse 接成受控的长任务 Agent 层：

- 已有聊天、分类、抽取、轻量评分、业务 RAG、规则引擎继续走原系统。
- 新增深度研究、报告包、材料整合、网页/浏览器任务、可下载产物时走 InfiniSynapse。
- 业务数据库仍保存用户、权限、计费、任务状态、产物索引和审计记录。
- 不要把已有 LLM 层整体迁移到 InfiniSynapse，除非目标调用本身已经变成 agentic 长任务。

成熟产品的多租户、worker 幂等、产物归档和计费补偿边界见 [existing-product-integration.md](existing-product-integration.md)。

## 安全边界

直连 LLM 不等于前端直连模型供应商。所有 provider API Key 都应留在服务端；前端只调用自家后端业务路由。

两类密钥都要按服务端密钥管理处理：

- LLM provider key：只给 `LlmGateway` 使用。
- InfiniSynapse API Key：只给 `AgentTaskService` / backend worker 使用。

日志里不要输出完整 prompt 中的敏感原文、provider token、InfiniSynapse API Key、数据库密码、Mongo URI、Redis 密码或 JWT secret。

## 例外

可以临时让轻量调用走 InfiniSynapse 的情况：

- 内部 demo 或 spike，只为了快速验证一个端到端 Agent 能力。
- 轻量问题依赖同一个 InfiniSynapse 任务上下文，且必须沿用同一 `taskId` 的 workspace。
- 供应商、合规或私有化部署要求所有模型能力都通过同一个平台出口。

即使有例外，也要把它记录成产品级选择，不要让它成为默认架构。

## 检查清单

- 是否把非 agentic 一问一答、结构化抽取、轻量评分默认放在直连 LLM？
- 是否把深度调研、长任务、工具使用、Browser Use、workspace 产物默认放在 InfiniSynapse？
- 新项目是否至少有一个 server-side `LlmGateway`，避免前端持有模型 key？
- InfiniSynapse 长任务是否仍按先 SSE 后 `newTask`、完成后读 workspace 的流程实现？
- 两类调用的状态、计费、超时、日志脱敏和错误处理是否分开？
- 是否避免把"省一层封装"作为所有调用都走 InfiniSynapse 的理由？
