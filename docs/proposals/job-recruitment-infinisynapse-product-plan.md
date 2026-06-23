# 基于 InfiniSynapse 的求职招聘智能体产品方案

## 结论

值得做，但不建议把 InfiniSynapse 作为高频、强确定性的主爬虫系统来替代现有 JobSub。

更合适的方向是新写一个“求职招聘任务型智能体”项目，让 InfiniSynapse 负责长任务 Agent、Browser Use、临时网页研究、简历/JD 分析、报告产物生成和多轮求职工作流；结构化职位库、去重、版本化、订阅、用户数据和计费仍由自有业务系统负责。

如果目标是“每天稳定抓取大量企业招聘站，建立可搜索职位数据库”，InfiniSynapse 不应做主引擎。JobSub 现有的 BullMQ、平台适配器、source health、去重、版本化和订阅链路更适合这类稳定 ETL。

如果目标是“用户给目标公司、岗位、简历、偏好，系统自动完成研究、分析、报告和投递辅助”，InfiniSynapse 非常合适。

## 背景观察

现有 `~/WorkSpace/JobSub/` 已经具备较完整的求职产品能力：

- Next.js / Prisma / PostgreSQL / Redis / BullMQ 技术栈。
- 企业招聘官网与多租户招聘门户采集。
- `JobPlatform`、`CrawlSource`、`CrawlTask`、`JobPosting`、`JobPostingVersion` 等结构化数据模型。
- 默认 job worker 与 browser worker 分离。
- source health、officiality signal、下线检测、版本化、跨源去重。
- 简历解析、ATS/JD 适配、职位匹配、投递记录、面试准备、投递信、Career Knowledge。
- 公职考试域单独建模，包含官方来源、附件解析、行级溯源和 PII 防护。

这些能力说明 JobSub 已经是一个稳定业务系统，而不是缺少基础设施的原型。因此，新项目不应简单“用 InfiniSynapse 重写 JobSub”，而应把 InfiniSynapse 放在它最擅长的位置。

## InfiniSynapse 的角色

### 1. 长任务 Agent 编排器

InfiniSynapse 适合处理一次耗时较长、需要多步骤推理和工具调用的求职任务，例如：

- 研究目标公司近期招聘变化。
- 对比多个岗位与用户简历匹配度。
- 生成岗位申请策略报告。
- 生成面试准备包。
- 对一个岗位生成定制简历修改建议和投递信。

产品后端负责生成 `connId` / `taskId`，先建立 `/api/ai/events` SSE，再调用 `/api/ai/message` 创建 `newTask`。前端只连接自家后端，不直接持有 InfiniSynapse API Key。

### 2. Browser Use 的补充采集层

InfiniSynapse Browser Use 适合：

- 用户临时指定某个招聘页面，让 Agent 查看页面并提取关键信息。
- 目标公司官网结构复杂，短期内不值得写专用 adapter。
- 用户需要从登录态页面、动态页面或多步骤页面中提取信息。
- 做候选公司/岗位研究，而不是长期批量采集。

不适合：

- 大规模、周期性、强稳定的职位库采集。
- 需要严格 robots / 限流 / source health / 版本化的主数据链路。
- 需要毫秒级或秒级返回的搜索列表。

### 3. 简历、JD 和职业素材分析器

JobSub 已有 Career Knowledge 和 ATS/JD 分析能力。新项目可以借鉴该数据结构，但把复杂的报告型任务交给 InfiniSynapse：

- 批量上传简历、作品集、项目说明、证书等文件到任务工作区。
- 让 Agent 产出 Markdown / PDF / Word 报告。
- 通过 `getTaskWorkspace`、`previewFile`、`downloadTaskFile` 获取最终产物。
- 将最终结论回写到业务数据库，保留可追踪的 `taskId`、输入 hash 和文件路径。

### 4. 求职研究报告生成器

InfiniSynapse 的报告快写模式适合输出：

- 公司招聘画像报告。
- 岗位匹配分析报告。
- 简历优化建议报告。
- 面试准备包。
- 求职策略周报。
- 投递后续跟进建议。

### 5. 任务资产化与历史复用层

InfiniSynapse 的任务不只是一次性对话。Server API 提供任务列表、任务分类、任务详情、UI 消息恢复、任务工作区、任务分享和保存到 RAG 等能力。求职产品可以把每次 Agent 运行沉淀为可管理的“求职资产”：

- `岗位分析任务`：围绕单个 JD 的能力拆解、匹配分、风险和建议。
- `公司研究任务`：围绕目标公司招聘趋势、岗位结构和机会判断。
- `投递包任务`：围绕一批岗位生成优先级、投递信和面试准备。
- `求职周报任务`：围绕本周新增岗位、投递记录和下一步行动。

建议把 InfiniSynapse 的 `taskId` 映射到自有业务任务，并在自有系统中保留分类、标签、输入 hash、workspace 快照和最终产物。用户后续可以搜索、恢复、下载、分享或复用历史分析。

### 6. 个人 Career RAG 与职位数据源层

如果产品发展到第二阶段，InfiniSynapse 的 RAG 和数据源能力可以承担“用户长期上下文”和“岗位事实查询”的部分能力：

- 用户简历、项目经历、作品集、证书、历史投递分析可以沉淀为用户私有 Career RAG。
- JobSub 或自有职位库可以暴露脱敏只读数据库，作为 Agent 可查询的数据源。
- 已完成的高质量岗位分析可以调用 `saveToRag` 保存，供后续相似岗位比较使用。
- 数据源和 RAG 必须在 `newTask` 之前完成 list / enabled，否则 Agent 看不到对应资源。

边界要收紧：SaaS 阶段不建议直接连接生产主库，也不建议把包含简历隐私、联系方式、投递记录的完整数据库暴露给 Agent。更稳妥的方式是提供脱敏只读视图，或者在私有化部署中连接内部数据源。

### 7. 计划 / 执行模式与人工确认

求职场景里有些动作只读、低风险，有些动作涉及登录态、表单、投递和个人隐私。建议把 InfiniSynapse 的 `chatSettings`、`togglePlanActMode` 和 `autoApprovalSettings` 设计进产品流程：

- 默认先进入计划阶段：Agent 说明将读取哪些网页、哪些文件、产出哪些报告。
- 用户确认后再进入执行阶段：创建实际研究或报告任务。
- 对读取本地已上传文件、生成报告这类动作可设置较宽松的自动审批。
- 对浏览器登录、自动填写、外部提交、投递动作必须人工确认。

这能把 InfiniSynapse 从“黑盒执行器”变成“可审阅的求职工作流引擎”。

### 8. 快照、回滚与多版本策略

Server API 支持 `rollbackToSnapshot`、`rollbackAndSendMessage`、`editFirstMessageAndResend` 等任务重跑能力。求职产品可以用它做多版本策略：

- 同一个岗位生成“保守版 / 进攻版 / 转行版”求职建议。
- 用户修改求职方向后，从同一任务快照重跑，不必完全新建。
- 对同一批岗位按不同偏好重新排序，例如薪资优先、成长优先、稳定性优先。

自有业务库需要记录每个版本的输入、prompt、产物路径和用户采纳情况。

### 9. 分享、ZIP 导出与预览

InfiniSynapse 支持任务公开只读分享、任务文件树、`downloadZip`、`downloadTaskFile` 和 `inline=1` 预览。求职产品可以提供：

- 一键下载“投递包 ZIP”：岗位分析、投递信、面试准备、简历建议。
- 只读分享链接：给导师、朋友、内推人或职业顾问查看。
- 内联预览 PDF、图片、SVG、图表，减少下载后再打开的摩擦。

分享默认应是私有的，只有用户主动打开 `setShare` 后才生成公开只读访问。

## 推荐产品定位

项目名可暂定为：`JobAgent` 或 `CareerResearchAgent`。

一句话定位：

> 面向个人求职者的职位研究、简历适配和投递准备智能体。

它不是职位搜索引擎，也不是 JobSub 的替代品。它是一个任务型求职助手，聚焦“针对一个用户和一批目标岗位，完成深度分析和行动建议”。

## 目标用户

- 正在集中投递互联网、AI、产品、研发、运营岗位的求职者。
- 应届生、转行者、社招跳槽者。
- 需要针对某个岗位做材料优化和面试准备的用户。
- 需要研究目标公司招聘趋势、岗位结构和能力要求的用户。

## 核心场景

### 场景 1：目标岗位深度分析

输入：

- 岗位链接或 JD 文本。
- 用户简历。
- 求职目标和约束。

输出：

- 岗位要求拆解。
- 必备能力、加分能力、风险点。
- 简历匹配度。
- 简历修改建议。
- 投递信草稿。
- 面试准备问题。

InfiniSynapse 作用：

- 长任务推理。
- 按需读取网页。
- 分析上传文件。
- 生成结构化报告和最终文件。

### 场景 2：公司招聘情报研究

输入：

- 公司名。
- 招聘官网 URL。
- 目标职能或地区。
- 时间范围。

输出：

- 当前活跃岗位列表摘要。
- 岗位分布。
- 招聘强度判断。
- 适合用户的机会点。
- 需要补足的能力。

InfiniSynapse 作用：

- 使用 Browser Use 浏览目标公司页面。
- 将网页发现过程通过 SSE 展示。
- 输出研究报告。

JobSub 或自有系统作用：

- 保存公司、岗位、研究任务、结果摘要。
- 对稳定来源做结构化采集。
- 支持后续搜索、订阅和历史对比。

### 场景 3：多岗位投递策略

输入：

- 5 到 20 个岗位链接或来自职位库的岗位 ID。
- 用户简历和偏好。

输出：

- 岗位排序。
- 每个岗位的匹配理由和风险。
- 推荐投递优先级。
- 简历版本建议。
- 每个岗位的投递信/内推话术。

InfiniSynapse 作用：

- 长任务批量分析。
- 多文件产物生成。
- 多轮修订。

业务系统作用：

- 限制批量规模。
- 缓存 JD 分析。
- 保存应用层决策和投递记录。

### 场景 4：求职周报

输入：

- 用户本周收藏/投递/浏览记录。
- 新增岗位。
- 用户简历画像。

输出：

- 本周机会总结。
- 适合投递的岗位。
- 风险提醒。
- 下周行动清单。

InfiniSynapse 作用：

- 报告生成。
- 多源材料综合。
- 输出 Markdown / PDF。

## 推荐架构

```text
Frontend
  -> JobAgent Backend
    -> PostgreSQL / Redis
    -> Optional JobSub Job Ingestion API
    -> InfiniSynapse Server API
       -> Browser Use
       -> Task Workspace
       -> RAG / 数据源
```

### 服务边界

| 模块 | 负责方 | 说明 |
| --- | --- | --- |
| 用户、会员、权限 | 自有后端 | 不交给 InfiniSynapse |
| API Key 管理 | 自有后端 | InfiniSynapse API Key 只放服务端 |
| 长任务执行 | InfiniSynapse | SSE + `newTask` + workspace |
| 前端实时进度 | 自有后端转发 | 不让前端直连 InfiniSynapse |
| 稳定职位库采集 | JobSub / 自建采集服务 | 保留强确定性 ETL |
| 临时网页研究 | InfiniSynapse Browser Use | 适合低频、复杂、动态页面 |
| 文件归档 | InfiniSynapse workspace + 自有存储 | 两边都记录映射 |
| 最终报告 | InfiniSynapse workspace | 下载后可归档到自有系统 |
| 历史任务资产 | 自有数据库 + InfiniSynapse 任务系统 | 分类、恢复、分享、保存到 RAG |
| 长期职业上下文 | 自有 Career Knowledge + InfiniSynapse RAG | SaaS 阶段建议只放脱敏材料 |
| 业务状态 | 自有数据库 | `taskId`、`connId`、输入 hash、结果路径 |

## 关键数据模型建议

### `agent_tasks`

记录 InfiniSynapse 任务与业务任务的映射。

| 字段 | 说明 |
| --- | --- |
| `id` | 自有业务任务 ID |
| `user_id` | 用户 ID |
| `task_kind` | `job_analysis` / `company_research` / `application_pack` / `weekly_report` |
| `infini_task_id` | InfiniSynapse `taskId` |
| `infini_conn_id` | InfiniSynapse `connId` |
| `status` | `queued` / `running` / `waiting_user` / `completed` / `failed` / `cancelled` |
| `input_hash` | 去重和复用 |
| `input_json` | 用户输入快照 |
| `workspace_snapshot` | workspace 文件索引快照 |
| `final_artifacts` | 最终报告路径 |
| `share_enabled` | 是否开启 InfiniSynapse 公开只读分享 |
| `saved_to_rag` | 是否已保存到 RAG |
| `category_ids` | InfiniSynapse 或自有分类映射 |
| `error_message` | 错误信息 |

### `job_research_reports`

保存岗位/公司研究结果。

| 字段 | 说明 |
| --- | --- |
| `id` | 报告 ID |
| `user_id` | 用户 ID |
| `agent_task_id` | 对应任务 |
| `subject_type` | `job` / `company` / `batch` |
| `subject_ref` | 岗位 ID、公司 ID 或 URL |
| `summary` | 摘要 |
| `score_json` | 匹配、机会、风险评分 |
| `recommendations_json` | 行动建议 |
| `evidence_json` | 引用来源、URL、文件、行号 |
| `report_md_path` | Markdown 路径 |
| `report_pdf_path` | PDF 路径 |

### `uploaded_materials`

保存用户上传材料与任务工作区的映射。

| 字段 | 说明 |
| --- | --- |
| `id` | 材料 ID |
| `user_id` | 用户 ID |
| `agent_task_id` | 关联任务 |
| `kind` | `resume` / `portfolio` / `jd` / `screenshot` / `other` |
| `original_name` | 原始文件名 |
| `storage_path` | 自有存储路径 |
| `infini_logical_path` | InfiniSynapse workspace 路径 |
| `content_hash` | 幂等 |

### `career_rag_assets`

保存进入长期 Career RAG 的材料或任务结果。

| 字段 | 说明 |
| --- | --- |
| `id` | 资产 ID |
| `user_id` | 用户 ID |
| `source_type` | `resume` / `portfolio` / `job_analysis` / `company_research` / `application_pack` |
| `source_ref` | 简历 ID、任务 ID、报告 ID 等 |
| `rag_id` | InfiniSynapse RAG ID |
| `infini_task_id` | 来源任务 ID |
| `sensitivity` | `public` / `private` / `sensitive` |
| `enabled_for_agent` | 是否允许后续 Agent 使用 |

## InfiniSynapse API 流程

### 创建长任务

1. 后端生成 `connId` 和 `taskId`。
2. 如果有用户材料，先用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 上传到任务工作区。
3. 后端建立 `GET /api/ai/events?connId=<uuid>`。
4. 后端调用 `POST /api/ai/message`，`type=newTask`，`chatSettings: { "mode": "act" }`。
5. 后端消费 SSE，把状态映射为业务任务状态。
6. 如 Agent 请求 `upload_file_to_sandbox`，使用 `/api/ai/upload?taskId=` 上传并 `askResponse`。
7. 完成后调用 `getTaskWorkspace`。
8. 使用 `previewFile` 读取 Markdown 或文本报告。
9. 使用 `downloadTaskFile` 下载 PDF、Word、图片等最终文件。
10. 如果需要完整交付包，调用 `downloadZip` 下载整个任务目录。
11. 如果用户希望复用该分析，调用 `saveToRag` 保存任务到 RAG，或把报告文件归档到用户 Career RAG。
12. 如果用户需要分享，调用 `setShare` 开启公开只读，再使用公开任务文件接口展示。
13. 将结果摘要、workspace 路径、RAG 状态、分享状态和报告文件写入自有数据库。

### Browser Use 检查

对于需要打开用户浏览器页面的任务：

1. 后端先调用 `GET /api/ai_browser/session`。
2. 如果未连接，不创建任务，前端提示用户安装或打开插件。
3. 如果已连接，将浏览器上下文需求写入 prompt。
4. 任务执行中通过 SSE 展示网页研究进度。

## Prompt 设计原则

每个任务 prompt 应包含：

- 任务目标。
- 输入材料列表和路径。
- 目标用户背景。
- 输出格式。
- 必须引用的证据要求。
- 不确定信息的处理方式。
- 禁止编造数据。
- 最终产物要求，例如 `report.md`、`report.pdf`、`application-pack.md`。

示例骨架：

```text
你是求职研究助手。请基于以下材料，为用户生成岗位分析和投递准备包。

用户目标:
- ...

岗位信息:
- ...

已上传材料:
- upload_documents/resume.pdf
- upload_documents/portfolio.md

要求:
1. 先拆解 JD 的硬性要求、软性要求、加分项。
2. 对照用户材料给出匹配、缺口和风险。
3. 输出简历修改建议，不能编造经历。
4. 输出投递信草稿。
5. 输出 10 个面试准备问题和建议回答方向。
6. 最终在工作区生成 Markdown 报告；如可行，同时生成 PDF。
```

## MVP 范围

### P0：单岗位分析

- 输入 JD 文本或 URL。
- 上传简历文件。
- 创建 InfiniSynapse 长任务。
- 前端展示 SSE 进度。
- 完成后展示 Markdown 报告并支持下载。
- 保存 `taskId`、`connId`、输入和产物路径。

### P1：公司招聘研究

- 输入公司官网或招聘页。
- Browser Use 检查和引导。
- 生成公司招聘画像报告。
- 保存引用 URL 和截图/文件证据。
- 支持将公司研究任务分类，并保存到 RAG 供后续相似公司比较。

### P2：多岗位投递包

- 支持多个岗位链接或从职位库选择岗位。
- 生成岗位优先级、投递策略、投递信和面试准备包。
- 支持多轮修订同一个 `taskId`。
- 支持 ZIP 导出完整投递包。

### P3：与 JobSub 集成

- JobSub 提供稳定职位库或快照 API。
- 新项目消费 JobSub 的职位 ID 和 JD 内容。
- InfiniSynapse 只做深度分析和报告产物。
- 分析结果可回写 JobSub 的应用记录或匹配记录。
- 可选把 JobSub 的脱敏只读职位视图接入 InfiniSynapse 数据源。

### P4：Career RAG 和历史任务资产

- 把用户确认可复用的简历、项目经历、历史岗位分析保存为私有 RAG。
- 支持按岗位、公司、投递阶段筛选历史 InfiniSynapse 任务。
- 支持从历史任务快照生成不同版本的求职策略。
- 支持用户主动开启只读分享或导出完整任务 ZIP。

## 不建议放进 MVP 的内容

- 自建完整职位搜索引擎。
- 大规模定时采集系统。
- 复杂会员/支付系统。
- 全自动投递。
- 未经用户确认的浏览器自动表单提交。

## 风险与应对

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| 成本不可控 | 长任务和浏览器任务可能较贵 | 设任务额度、文件大小限制、批量上限 |
| 结果不可复现 | Agent 研究过程可能有波动 | 保存 prompt、输入 hash、SSE 摘要、workspace 产物 |
| 网页采集不稳定 | 动态页面和登录态依赖用户浏览器 | Browser Use 只做补充层，核心职位库仍走结构化采集 |
| 合规风险 | 招聘页面、用户简历、个人隐私敏感 | 用户确认、PII 脱敏、最小化保存、日志脱敏 |
| 幻觉风险 | 可能编造岗位要求或公司信息 | 强制引用来源、区分事实/推断/建议 |
| 任务恢复缺失 | 用户刷新页面后丢进度 | 保存 `taskId`、`connId`，用 UI 消息和 workspace 恢复 |
| RAG 污染 | 错误分析进入长期上下文后影响后续任务 | 只有用户确认的报告才能保存到 RAG，支持移除 |
| 分享泄露 | 公开分享可能暴露简历或岗位策略 | 默认私有，分享前二次确认并提示敏感信息 |

## 成功指标

- 单岗位分析完成率。
- 从创建任务到首个 SSE 事件的时间。
- 报告生成成功率。
- 用户下载或保存报告比例。
- 用户采纳的简历修改建议数量。
- 多轮修订次数。
- 投递后续转化：收藏、投递、面试准备、投递信生成。

## 推荐下一步

1. 不直接重写 JobSub。
2. 新建轻量项目，只做 `single-job-analysis` MVP。
3. 使用 InfiniSynapseAssistant 作为 AI 规则包，先实现服务端代理层。
4. 把 JobSub 中的简历/JD/匹配 schema 思路作为参考，但不要迁移完整业务。
5. MVP 阶段先不接长期 RAG，只保存任务和产物。
6. 等 MVP 验证后，再决定是否与 JobSub 做职位库集成。
7. 第二阶段再加入 Career RAG、任务分享、ZIP 导出和多版本重跑。
