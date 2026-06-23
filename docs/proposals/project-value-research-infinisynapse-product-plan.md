# 基于 InfiniSynapse 的项目价值调研产品方案

## 结论

非常适合基于 InfiniSynapse 新写一个项目。

“项目价值调研”天然是长任务、多资料、多网页、多轮判断、最终报告产物的场景。它不像职位库采集那样需要高频稳定 ETL，而是更需要：

- 打开网页、GitHub、产品官网、文档、定价页、竞品页面。
- 阅读用户上传的闭源项目材料。
- 把开源项目和闭源项目放到统一评估框架里。
- 产出可追踪证据、判断矩阵和最终报告。
- 支持多轮追问和修订。

这些正好对应 InfiniSynapse 的 Server API、SSE 长任务、Browser Use、文件上传、RAG/数据源和 workspace 产物能力。

## 推荐产品定位

项目名可暂定为：`ProjectValueLab` 或 `VentureScope`。

一句话定位：

> 一个面向独立开发者、产品负责人和投资/BD 场景的项目尽调与价值判断工作台。

它不是通用报告平台，也不是简单网页收藏工具，而是围绕“这个项目值不值得做、投、买、合作、fork、重写或继续投入”给出结构化判断。

## 目标用户

- 独立开发者：判断某个想法或开源项目是否值得做成产品。
- 产品负责人：评估竞品、替代方案、闭源内部项目价值。
- 投资/BD/合作人员：快速形成项目尽调初稿。
- 技术负责人：判断一个开源项目是否值得引入、fork 或二次开发。
- 个人项目组合管理者：定期复盘自己多个项目的价值和优先级。

## InfiniSynapse 的角色

### 1. 长任务研究执行器

项目调研通常不是单次问答，而是包含：

- 资料收集。
- 背景理解。
- 竞品查找。
- 技术可行性分析。
- 商业价值判断。
- 风险识别。
- 报告写作。

InfiniSynapse 适合承接这类长任务，用 SSE 回传阶段性进展，用 workspace 保存最终 Markdown、PDF、表格和图表。

### 2. Browser Use 网页研究员

对于开源项目，Agent 需要访问：

- GitHub 仓库。
- README / docs / issues / releases。
- 官网。
- 定价页。
- 社区讨论。
- 竞品页面。

对于闭源项目，Agent 可能需要访问：

- 产品官网。
- 登录后的后台页面。
- 用户提供的内部演示页面。
- 截图、文档、导出文件。

Browser Use 的价值在于让 Agent 可以像用户一样操作网页，尤其适合没有标准 API、需要点击和阅读的产品研究。

### 3. 文件和知识库处理层

闭源项目调研通常需要用户上传：

- PRD。
- 产品截图。
- 路线图。
- 财务或运营数据。
- 用户访谈。
- 技术架构说明。
- 客户沟通记录。
- 演示视频转写稿。

这些资料可以通过 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 归档到任务工作区，并在 prompt 中要求 Agent 引用材料路径和证据。

### 4. 报告产物生成器

最终交付不是一段聊天回复，而应是：

- `research.md`：事实调研。
- `evaluation.md`：价值判断。
- `scorecard.json`：结构化评分。
- `decision-memo.md`：是否继续的决策备忘录。
- `risks.md`：风险与验证项。
- `next-actions.md`：下一步任务。
- 可选 PDF / Word / 图表。

这些应通过 `getTaskWorkspace`、`previewFile`、`downloadTaskFile` 获取。

### 5. 历史知识库与项目记忆层

项目价值判断的复利不在单次报告，而在长期积累。InfiniSynapse 的 RAG、任务保存和数据源能力可以让这个产品形成“个人项目判断记忆”：

- 已完成的调研任务可以调用 `saveToRag` 保存，后续评估相似项目时作为历史案例。
- 用户自己的项目文档、历史 PRD、竞品资料、合作沟通记录可以进入私有 RAG。
- 开源项目观察、同类项目对比、历史打分结果可以沉淀为可检索知识库。
- 多个项目的评分和结论可以回流到自有数据库，用于组合管理和复盘。

RAG 的使用要有准入门槛：只有用户确认过的材料和报告才能进入长期知识库，失败任务、草稿、明显幻觉内容不应自动保存。

### 6. 数据源与结构化分析层

如果项目调研涉及结构化数据，例如 GitHub 指标快照、用户增长、收入、issue 分类、竞品表格、访谈标签，可以考虑使用 InfiniSynapse 数据源能力：

- 轻量阶段：把 CSV / XLSX / JSON 作为文件上传到任务工作区，由 Agent 读取和分析。
- 进阶阶段：把脱敏后的分析库或只读数据表接入 InfiniSynapse 数据源。
- 企业/闭源阶段：优先考虑私有化部署，再接内部数据库或对象存储。

数据源和 RAG 必须在 `newTask` 前完成 list / enabled。否则 Agent 创建任务时看不到这些资源。

### 7. 任务资产、分类和分享

InfiniSynapse 的任务管理能力可以直接用于项目调研产品的资产化：

- 用任务分类区分 `开源尽调`、`闭源尽调`、`竞品分析`、`投资判断`、`技术引入`。
- 用 `getUiMessageById` 和 `getTaskWorkspace` 恢复任务进度与最终产物。
- 用 `downloadZip` 导出完整尽调包。
- 用 `setShare` 生成公开只读报告，适合给合伙人、客户或团队成员查看。
- 用公开预览/下载接口构建只读报告页。

分享要默认关闭。闭源项目、商业计划、财务材料和内部截图都应默认禁止公开分享，除非用户主动确认。

### 8. 多视角重评和快照回滚

项目价值判断经常需要换框架重评。InfiniSynapse 的快照、回滚和编辑重发能力可以支持：

- 同一个项目按不同视角重评：独立开发者、投资人、BD 合作、技术引入、竞品防御。
- 调整评分权重后从同一快照重跑，而不是重新收集全部资料。
- 保留不同版本的 decision memo，比较“为什么这次判断和上次不同”。
- 对闭源项目补充新资料后，从上一个研究阶段继续，而不是新建孤立任务。

自有系统应保存每次重评的模式、权重、prompt、输入 hash、产物和最终建议。

### 9. 计划 / 执行模式与审批

项目价值调研可能访问公开网页，也可能读取敏感资料和登录态页面。建议产品层将 Agent 执行拆成两段：

- 计划阶段：Agent 先列出将访问的 URL、将读取的文件、拟产出文件和风险点。
- 执行阶段：用户确认后，Agent 才开始实际调研、浏览和生成报告。

对低风险读取和报告生成可以使用自动审批；对登录态页面、外部写入、下载大量敏感文件、公开分享等动作必须人工确认。

## 产品边界

### 本项目负责

- 调研任务创建和管理。
- 资料上传和整理。
- InfiniSynapse 长任务编排。
- Browser Use 连接状态检查。
- 报告和评分结果展示。
- 调研历史、版本和复盘。
- 证据、引用、判断和建议的结构化保存。

### 不负责

- 替代人工最终决策。
- 自动购买、投资或签约。
- 未授权访问闭源项目。
- 绕过登录、付费墙或访问控制。
- 直接把商业敏感资料暴露给前端或第三方。

## 核心评估对象

### 开源项目

输入可以是：

- GitHub URL。
- 官网 URL。
- NPM / PyPI / Docker Hub 包名。
- 用户补充的竞品或使用场景。

评估维度：

- 项目真实解决的问题。
- 活跃度：提交、release、issue、PR、维护者响应。
- 技术成熟度。
- 文档质量。
- 社区和生态。
- 商业化可能性。
- 与用户现有项目的能力重叠和增量。
- fork / 贡献 / 集成 / 重写的建议。
- 许可证和合规风险。

### 闭源项目

输入可以是：

- 产品官网。
- 用户上传的 PRD、截图、报价、演示文档。
- 内部代码结构摘要。
- 运营数据。
- 客户反馈。
- 竞品列表。

评估维度：

- 用户问题是否真实。
- 目标客户和使用场景。
- 竞争格局。
- 产品差异化。
- 技术壁垒。
- 交付难度。
- 商业化路径。
- 数据/合规/安全风险。
- 最小验证实验。
- 建议继续、暂停、转向或归档。

## 推荐架构

```text
Frontend
  -> ProjectValueLab Backend
    -> PostgreSQL / Redis
    -> Object Storage
    -> InfiniSynapse Server API
       -> SSE events
       -> Browser Use
       -> Task Workspace
       -> RAG / 数据源
```

### 架构原则

- API Key 只放服务端。
- 前端只连接自家后端。
- 自家后端保存所有业务任务状态。
- InfiniSynapse 负责 Agent 执行和产物生成。
- 用户上传资料既保存在自有存储，也映射到 InfiniSynapse workspace。
- 所有判断必须保留证据来源。
- RAG 和数据源必须在创建任务前启用。
- 敏感闭源资料优先使用私有化部署或独占计算资源。

## 核心模块

### 1. Intake

负责创建调研任务。

字段：

- 项目名称。
- 项目类型：开源 / 闭源 / 想法 / 竞品 / 内部项目。
- URL 列表。
- 上传材料。
- 调研模式：快速判断 / 深度尽调 / 与现有项目映射 / 投资/BD 视角。
- 输出格式。
- 约束：地区、行业、预算、时间、目标用户、现有产品背景。

### 2. Research Task Runner

负责调用 InfiniSynapse。

能力：

- 生成 `taskId` / `connId`。
- 上传资料到 workspace。
- 建立 SSE。
- 创建 `newTask`。
- 处理 `upload_file_to_sandbox`。
- 取消任务。
- 恢复任务。
- 枚举 workspace。
- 下载报告产物。

### 3. Evidence Store

负责保存证据。

证据类型：

- URL。
- 网页标题和摘要。
- 文件路径。
- 引用片段。
- 截图路径。
- GitHub 指标快照。
- 用户上传材料中的章节或行号。

### 4. Scorecard

负责结构化评分。

建议维度：

| 维度 | 说明 |
| --- | --- |
| 问题强度 | 用户痛点是否真实、频繁、刚需 |
| 市场空间 | 目标用户规模和付费可能 |
| 差异化 | 相比现有方案的明显增量 |
| 技术可行性 | 以现有能力能否做出 MVP |
| 数据可得性 | 是否能合法稳定获得关键数据 |
| 分发可行性 | 是否有可触达用户渠道 |
| 商业化路径 | 付费点是否清晰 |
| 维护成本 | 长期运营和技术债 |
| 风险 | 法务、隐私、依赖、平台政策 |
| 与现有资产协同 | 是否复用已有代码、数据、用户、品牌 |

### 5. Report Workspace

负责展示和下载产物。

报告类型：

- 事实调研报告。
- 价值判断报告。
- 竞品对比表。
- 风险清单。
- MVP 建议。
- 30/60/90 天路线图。
- 决策备忘录。

### 6. Knowledge Memory

负责管理长期知识库和历史案例。

能力：

- 把用户确认过的调研报告保存到 RAG。
- 管理哪些项目、材料、报告可被后续 Agent 检索。
- 从历史项目中提取相似案例和反例。
- 支持按行业、阶段、商业模式、技术栈、判断结果筛选历史调研。

### 7. Review & Share

负责审阅和分享。

能力：

- 公开分享前敏感信息检查。
- 私密只读链接或团队内分享。
- ZIP 尽调包下载。
- 多版本报告对比。

## 数据模型建议

### `research_projects`

| 字段 | 说明 |
| --- | --- |
| `id` | 项目 ID |
| `owner_id` | 用户 ID |
| `name` | 项目名 |
| `project_type` | `open_source` / `closed_source` / `idea` / `competitor` / `internal` |
| `primary_url` | 主 URL |
| `status` | `active` / `archived` |
| `tags` | 标签 |
| `summary` | 当前摘要 |
| `created_at` | 创建时间 |

### `research_runs`

| 字段 | 说明 |
| --- | --- |
| `id` | 调研运行 ID |
| `project_id` | 关联项目 |
| `mode` | `quick` / `deep` / `compare` / `evaluate` |
| `infini_task_id` | InfiniSynapse `taskId` |
| `infini_conn_id` | InfiniSynapse `connId` |
| `status` | `queued` / `running` / `waiting_user` / `completed` / `failed` / `cancelled` |
| `input_json` | 输入快照 |
| `input_hash` | 去重 |
| `workspace_snapshot` | workspace 快照 |
| `final_score` | 总分 |
| `recommendation` | `continue` / `pause` / `pivot` / `drop` / `watch` |
| `saved_to_rag` | 是否保存到 RAG |
| `share_enabled` | 是否开启公开只读分享 |
| `category_ids` | 任务分类 |
| `evaluation_lens` | `indie` / `investor` / `bd` / `tech_adoption` / `competitive` |
| `error_message` | 错误 |
| `created_at` | 创建时间 |
| `completed_at` | 完成时间 |

### `research_materials`

| 字段 | 说明 |
| --- | --- |
| `id` | 材料 ID |
| `project_id` | 项目 ID |
| `run_id` | 可选运行 ID |
| `kind` | `url` / `pdf` / `doc` / `screenshot` / `code_summary` / `metric_export` |
| `title` | 标题 |
| `source_url` | 来源 URL |
| `storage_path` | 自有存储路径 |
| `infini_logical_path` | InfiniSynapse workspace 路径 |
| `content_hash` | 内容 hash |
| `sensitivity` | `public` / `private` / `confidential` |
| `enabled_for_rag` | 是否允许进入长期 RAG |

### `research_findings`

| 字段 | 说明 |
| --- | --- |
| `id` | 发现 ID |
| `run_id` | 运行 ID |
| `category` | `market` / `product` / `tech` / `business` / `risk` / `evidence` |
| `claim` | 结论或发现 |
| `confidence` | 置信度 |
| `evidence_refs` | 证据引用 |
| `is_assumption` | 是否假设 |

### `research_artifacts`

| 字段 | 说明 |
| --- | --- |
| `id` | 产物 ID |
| `run_id` | 运行 ID |
| `artifact_type` | `markdown` / `pdf` / `docx` / `json` / `chart` |
| `title` | 标题 |
| `infini_path` | workspace 路径 |
| `storage_path` | 自有归档路径 |
| `is_final` | 是否最终产物 |

### `research_memory_assets`

保存进入长期项目记忆的材料、报告或任务。

| 字段 | 说明 |
| --- | --- |
| `id` | 记忆资产 ID |
| `project_id` | 项目 ID |
| `run_id` | 来源运行 |
| `asset_type` | `source_doc` / `research_report` / `scorecard` / `decision_memo` / `risk_note` |
| `rag_id` | InfiniSynapse RAG ID |
| `infini_task_id` | 来源任务 ID |
| `infini_path` | workspace 文件路径 |
| `review_status` | `pending` / `approved` / `rejected` |
| `enabled_for_future_runs` | 是否允许后续任务检索 |

## InfiniSynapse API 流程

### 开源项目调研

1. 用户输入 GitHub URL、官网、目标问题。
2. 后端生成 `taskId` / `connId`。
3. 后端检查是否需要 Browser Use；如果需要，调用 `/api/ai_browser/session`。
4. 后端建立 `/api/ai/events?connId=...`。
5. 后端调用 `/api/ai/message`，`type=newTask`，`chatSettings: { "mode": "act" }`。
6. SSE 实时展示：资料收集、README 阅读、issue/release 阅读、竞品搜索、评分、报告生成。
7. 完成后用 `getTaskWorkspace` 枚举产物。
8. 用 `previewFile` 展示 Markdown。
9. 用 `downloadTaskFile` 下载 PDF / Word / JSON。
10. 用 `downloadZip` 导出完整尽调包。
11. 后端解析 `scorecard.json`，写入结构化评分。
12. 用户确认后，可将任务调用 `saveToRag` 或把关键报告归档到项目 RAG。

### 闭源项目调研

1. 用户创建项目并上传 PRD、截图、运营数据、访谈、代码结构摘要。
2. 后端用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 归档资料。
3. 后端建立 SSE。
4. 后端创建 `newTask`，要求 Agent 只基于授权材料和用户提供的 URL 调研。
5. 如需要查看登录态页面，先检查 `/api/ai_browser/session`。
6. Agent 生成事实报告、评分卡、风险清单和下一步验证计划。
7. 后端读取 workspace 产物并归档。
8. 闭源材料默认不进入长期 RAG；只有用户明确批准后才保存。
9. 闭源报告默认不公开分享；分享前做敏感信息检查。

### 多视角重评

1. 用户选择已有 `research_run` 和新的评估视角。
2. 后端使用同一 `taskId` 的历史上下文，或基于快照调用回滚/重发能力。
3. Prompt 中声明新的 `evaluation_lens`、评分权重和输出要求。
4. 完成后生成新的 `decision-memo.md` 和 `scorecard.json`。
5. 自有系统保留版本对比，不覆盖旧判断。

## Prompt 设计

### 通用调研 prompt 骨架

```text
你是项目价值调研助手。请对目标项目进行结构化调研和价值判断。

目标项目:
- 名称:
- 类型:
- URL:
- 用户关注的问题:

可用资料:
- upload_documents/...

输出要求:
1. 区分事实、推断和建议。
2. 所有关键判断必须附证据来源。
3. 对信息不足处标记为“待验证”，不要编造。
4. 输出以下产物:
   - research.md
   - scorecard.json
   - decision-memo.md
   - risks.md
   - next-actions.md
5. 给出是否继续投入的建议，但说明置信度和前提条件。
```

### 开源项目专用补充

```text
请重点检查:
- README 和 docs 是否清楚。
- release 是否持续。
- issue/PR 是否有维护者响应。
- license 是否允许预期用途。
- 与同类项目相比的增量。
- 如果要二次开发，最小可行切入点是什么。
```

### 闭源项目专用补充

```text
请重点检查:
- 用户问题是否真实。
- 当前材料中有哪些未验证假设。
- 数据、隐私、合规和交付风险。
- MVP 最小验证实验。
- 哪些功能应先砍掉。
- 是否适合独立产品、内部工具、咨询交付或暂缓。
```

## MVP 范围

### P0：快速价值判断

- 创建调研项目。
- 输入 URL 或上传文档。
- 启动 InfiniSynapse 长任务。
- 展示 SSE 进度。
- 展示 `decision-memo.md` 和 `scorecard.json`。
- 保存任务、评分和报告。

### P1：开源项目尽调

- GitHub URL intake。
- Browser Use 或普通网页研究。
- 生成开源项目评估报告。
- 保存 license、活跃度、技术成熟度、集成建议。
- 支持把确认后的调研任务保存到 RAG，作为未来相似项目参考。

### P2：闭源项目尽调

- 多文件上传。
- 私密材料敏感度标记。
- 生成风险清单和 MVP 验证计划。
- 支持用户补充资料后同一个 `taskId` 多轮修订。
- 支持计划阶段和执行阶段拆分，敏感动作人工确认。

### P3：项目组合管理

- 多个项目评分对比。
- 历史调研版本。
- watchlist。
- 定期复评。
- 与现有项目资产映射。

### P4：项目记忆和多视角重评

- 建立长期项目 RAG。
- 支持保存、移除和启用历史调研作为未来上下文。
- 支持投资、BD、独立开发者、技术引入等多视角重评。
- 支持 ZIP 尽调包导出和受控分享。

## 与 OctoReport 的边界

本地已有 OctoReport，定位是内容聚合、Knowledge/Library 和报告生成。这个新项目不应重复做泛内容聚合平台。

推荐边界：

| 能力 | OctoReport | ProjectValueLab |
| --- | --- | --- |
| 多源内容沉淀 | 强 | 只保存调研相关材料 |
| 通用报告生成 | 强 | 只生成项目价值/尽调报告 |
| 项目价值评分 | 非核心 | 核心 |
| 开源项目引入判断 | 非核心 | 核心 |
| 闭源项目决策备忘录 | 非核心 | 核心 |
| 多项目优先级管理 | 非核心 | 核心 |

ProjectValueLab 可以后续把产物同步到 OctoReport 的 Knowledge/Library，但不应依赖 OctoReport 才能运行。

## 风险与应对

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| 调研幻觉 | Agent 可能把推断写成事实 | 强制事实/推断/建议分区，关键结论必须有 evidence |
| 闭源资料泄露 | 用户上传材料可能敏感 | API Key 服务端保存，文件加密存储，日志脱敏，敏感度标记 |
| 网页访问授权 | 登录态页面可能涉及权限 | 只在用户授权和主动连接 Browser Use 时访问 |
| 评分过度主观 | 项目价值判断天然不确定 | 保存评分维度、权重、证据和置信度 |
| 成本不可控 | 深度调研可能耗时长 | 分 quick/deep 模式，限制 URL 数、文件大小、任务时长 |
| 与现有项目重复 | OctoReport 已有报告能力 | 新项目只做项目价值判断工作台 |
| RAG 污染 | 错误判断进入长期知识库会影响未来评估 | 仅用户确认后的报告进入 RAG，保留移除入口 |
| 公开分享泄露 | 闭源材料和商业计划可能被公开 | 默认关闭分享，分享前敏感信息检查 |
| 数据源泄露 | 直接连接内部数据库风险高 | SaaS 阶段只接脱敏只读数据，敏感场景用私有化部署 |

## 成功指标

- 快速调研完成率。
- 报告产物生成成功率。
- 用户对结论的采纳/修改比例。
- 二次追问次数。
- 调研后创建行动项比例。
- 用户保留的项目 watchlist 数。
- 从 intake 到 decision memo 的平均时间。
- 评分被后续复盘验证的准确率。

## 推荐下一步

1. 新建独立项目，不从 OctoReport fork。
2. 先做 P0 quick research：URL/文件输入 + InfiniSynapse 长任务 + scorecard + decision memo。
3. 只集成 InfiniSynapse Server API，不先做复杂自研爬虫。
4. 第二阶段再加入 Browser Use 状态检查和登录态页面调研。
5. 第三阶段做项目组合、定期复评和与 OctoReport 的可选同步。
6. 第四阶段再做长期 RAG、任务分享、ZIP 导出和多视角重评。
