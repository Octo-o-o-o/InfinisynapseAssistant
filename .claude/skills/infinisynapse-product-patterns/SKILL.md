---
name: infinisynapse-product-patterns
description: |
  基于 InfiniSynapse 设计任务型产品，包括高考咨询、购物比价、报告写作、证据驱动决策包、通用长任务 Agent 应用。
  激活条件:
    - 用户问“基于这个项目开发产品”
    - 用户设计 mini-app、SaaS 功能、报告生成、尽调/决策包、购物/网页任务、高考助手
    - 用户需要 API 编排而不是单个 endpoint
    - 用户比较轻量直连 LLM 与 InfiniSynapse 长任务的边界
---

# InfiniSynapse Product Patterns

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` 第 11 节（已落地 App 的 API 组合；官方在线示例见 `https://infinisynapse.cn/apps`）
- `docs/reference/task-lifecycle.md`（含三类产品与 API 的对应表）
- `docs/playbooks/llm-routing.md`（轻量直连 LLM vs agentic 长任务走 InfiniSynapse）
- `docs/playbooks/secure-integration.md`（后端代理 + API Key 安全 + 状态托管）
- `docs/playbooks/existing-product-integration.md`（成熟 SaaS / 老项目接入边界、worker 幂等、多租户风险）
- `docs/playbooks/artifact-archiving.md`（workspace 产物、自有对象存储、manifest 和下载策略）
- `docs/playbooks/decision-quality-loop.md`（证据驱动决策包的 Outcome 回访、Watchlist delta 和 benchmark）
- `docs/playbooks/task-sharing.md`（公开分享边界；原始 task public 会公开全部消息和文件）
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- 可复制骨架: `samples/sdk/`、`samples/templates/`

## 架构默认值

```text
Frontend -> Your Backend -> LlmGateway / InfiniSynapse Server API
```

理由:

- API Key 必须留在服务端。
- 非 agentic 的一问一答、摘要、改写、分类、抽取、轻量评分默认直连 LLM，保持低延迟、低成本和低状态复杂度。
- agentic 的深度调研、长任务、工具使用、Browser Use、workspace 产物默认走 InfiniSynapse。
- `taskId`、`connId`、上传映射、结果路径需要落自家数据库。
- SSE 可以由自家后端转发给前端，便于鉴权、限流、恢复和审计。

## LLM routing defaults

- 按工作负载分流，不按项目新旧分流。
- 新项目即使还没有自有大模型调用层，也建议先做最小 server-side `LlmGateway`，不要把轻量非 agentic 调用都包装成 InfiniSynapse 任务。
- 已有产品保留原有短链路 LLM / RAG / 规则能力；InfiniSynapse 默认补强多步骤、异步、产物型 Agent 任务。
- 边界不清时问：没有 `taskId`、SSE、workspace 和恢复，这个调用是否仍能稳定交付？能则直连 LLM；不能则走 InfiniSynapse。

## Common Agent task skeleton

1. 前端提交业务表单到自家后端。
2. 后端生成 `connId` 和可选 `taskId`。
3. 后端先连 `GET /api/ai/events?connId=...`。
4. 后端发 `POST /api/ai/message`，`type=newTask`。
5. 后端把 SSE 转为产品状态、进度、结构化结果。
6. 如果 Agent 请求上传，后端先上传文件，再发 `askResponse`。
7. 任务完成后读取 workspace 产物；正式产品至少把必需产物归档到自有对象存储，成熟产品可再写 manifest 和私有 workspace ZIP，并保存业务结果记录。
8. 用户停止时调用 `POST /api/ai/message`，`type=cancelTask`；旧部署才 fallback `GET /api/ai_task/cancelTask?taskId=...`。

## Runtime guard and background delivery

- Prompt 中的"最多搜索 N 次/最多引用 N 个来源"是软目标，不是 InfiniSynapse 的硬预算 API。真正的成本边界要由业务后端实现：总耗时、SSE idle 次数、可识别工具事件计数、child task 数、repair 轮数和手动/自动 `cancelTask`。
- 超时或取消后不要直接丢弃任务。先用 `getTaskWorkspace` 枚举已有产物，校验必需文件和 schema；产物完整时可进入业务侧 validating/needs_review，产物不完整才保留 failed/cancelled。
- 如果产品承诺"用户离开页面后继续运行并通知"，不能依赖浏览器页面持有 SSE。后端 worker 必须托管 SSE 生命周期；断线或进程重启后用 `getUiMessageById` + `getTaskWorkspace` 恢复状态。
- 部署滚动、SIGTERM 或 worker shutdown 不是用户取消。先 pause/停止接新任务，把 active 业务任务标记为 recovering/needs_recovery，后续恢复进程重接 SSE 或查 workspace；不要在普通停机 catch 里调用 `cancelTask`，否则会把仍在 provider 侧运行的任务错误终止。
- 按当前公开 Server API，不要假设有面向业务后端的完成 webhook。邮件、站内信、Slack/webhook 等用户通知都应由业务系统在归档和 DLP 之后幂等发送，避免恢复任务时重复通知。
- 长任务入口、approve 执行、恢复 cron 和 backfill 都要在发外部副作用前做数据库条件 claim；高成本入口入队前还要做 per-user/per-org rate limit、active task 并发限制和 feature flag fail-closed。
- 生产打开长任务能力前要跑 production preflight：检查 InfiniSynapse auth/config、队列/worker、对象存储 PUT/GET/DELETE、关键 feature flag 和 worker 是否在线。preflight 失败时不要开启面向用户的长任务入口。

## Product patterns

### Form + PDF report

适合高考咨询、投研报告、合同/文档分析。

- 创建任务: 表单字段拼成清晰 prompt。
- 可选上传: `/api/ai/upload?taskId=`
- 恢复: `/api/ai_task/getUiMessageById?id=`
- 产物: `getTaskWorkspace` + `previewFile` + `downloadTaskFile`
- 分享: 只有原始任务全部可公开时才用 `setShare` + public task endpoints；含上传材料或隐私时发布业务侧脱敏副本

### Shopping comparison / web research

适合需要浏览器上下文的任务。

- 先检查 `/api/ai_browser/session`。
- 若未连接，引导安装 Chrome 插件；`null` / 空响应 / 缺 `status`、`status` 为空或离线、`activeSessionCount` 缺失或为 `0` 都按未连接 fail-closed。
- prompt 包含预算、链接、偏好、对比维度。
- 用 SSE 实时展示候选商品、风险和建议。

### Report writer

适合持续生成 Markdown、图表、PDF、Word 的产品。

- 用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 归档资料。
- 先列出并启用需要的 DB/RAG 资源。
- prompt 明确报告目标、受众、结构和引用要求。
- 多轮修订使用同一 `taskId` 的 `askResponse`。
- 支持用户带方法论/写作规范：单次任务用「Skill 上下文模式」（`SKILL.md` 目录树写进 prompt，文件走 `upload_file_to_sandbox` 链路，见上游 server-api §6.4）；跨任务复用才安装用户级 Skill（`/api/ai_skill/upload`）。
- 对长报告，推荐区分 `working/` 和 `final/`：Agent 可在 `working/` 写草稿、来源摘录和中间矩阵；业务系统只把 `final/` 下的 canonical artifacts 当作正式交付物。
- `working/` 中避免使用 `report.md`、`scorecard.json`、`decision-memo.md` 等正式文件名，防止业务侧按 basename 收集时误把草稿当最终产物。

### Evidence-backed decision package

适合项目尽调、供应商评估、Build-vs-Buy、开源引入、投研初筛等高价值判断。

- 高成本任务在 `newTask(plan)` 前可先做 1-2 个轻量澄清问题，确认主评估对象、Lens、约束和成功标准；不要把澄清本身做成新的长任务。
- 不要只要求"写一篇报告"；prompt 要求输出 decision memo、scorecard、evidence ledger、risk/gates 和 validation plan。
- 事实、推断、假设、建议分开写；关键判断必须带来源、置信度和"什么事实会改变结论"。
- SSE 用于展示研究进度，最终判断和结构化评分从 workspace 产物读取，不只依赖最后一条消息。
- 多 URL 输入要区分"主评估对象"和"参考/竞品/证据链接": 主对象可空但最多一个；无主对象时按方向/想法判断，不要把参考链接误认为被评分项目。Browser Use 授权只绑定一个明确目标 URL/域名，不默认覆盖全部参考链接。
- 统一来源台账 schema，优先使用一个 `source-map.json` 承载来源、用途、可信度、覆盖 claim、最后访问时间等字段；不要为不同深度报告维护多个近似来源文件名。证据台账里的每条 evidence 应有稳定 `sourceId`，能回连到 `source-map.json` 的来源记录；轻量任务如果暂不产 source map，也要把缺口作为 warning/limitations，而不是伪装成已审计来源。
- 评分卡应把正向吸引力维度和风险/硬门槛分开：dimensions 只表达正向驱动项，风险进入 risk penalty、risks 或 hard gates；如果总分可由维度权重推导，prompt 与后端校验要使用同一公式，failed/unresolved hard gate 要显式限制推荐结论，不能悄悄给出 go。
- 开源采用、供应商安全、依赖健康等确定性信号优先由业务后端 connector 抓取并保存不可变 raw snapshot（source URL、fetchedAt、raw JSON、hash），再把摘要喂给 InfiniSynapse task 解释；Agent 产物收集后由后端二次校验/补充 metric evidence。connector token 只能在服务端 env/KMS；deps.dev、OSV、GitHub 等源失败时产 `connectorWarning`/`evidenceGap`，不要把失败或缺口伪装成高质量 evidence。connector 内部按逐个包/子请求降级（单点失败不拖垮整源、只缓存完全成功结果），并区分正常缺口与真失败——有任一成功快照即算 success、缺口只写 warning，warning/部分快照的证据要按比例降质。
- 标准/深度报告可让 Agent 先在 `working/` 分阶段整理 source discovery、evidence extraction、comparison、risk review，再在 `final/` 重新 synthesis；最终报告不能机械拼接，要去重、回应冲突证据并统一评分口径。
- 多 agent / 多 task 对抗流程不是 InfiniSynapse 原生 parent-child 能力。业务后端必须自己保存 parent run、child `taskId`/`connId`、输入、workspace snapshot、预算和恢复状态；repair loop 必须有硬上限。
- 长期 RAG 只保存用户或 Reviewer 确认过的报告、评分卡或证据摘要；失败任务、草稿和未审结论不要自动 `saveToRag`。
- 决策型产品不要止步于一次性报告；完成后应把 scorecard version、Outcome 回访、Watchlist delta 和离线 benchmark 作为业务后端治理层设计，详见 `docs/playbooks/decision-quality-loop.md`。
- 对外分享默认发布脱敏 export；不要把含闭源材料、客户数据或上传文件的原始 task 直接 `setShare`。

### Existing SaaS / mature product extension

适合已经有用户、权限、业务数据库、队列、会员/计费或自研 AI 的产品。

- 不要把 InfiniSynapse 当作重写业务系统的理由；它默认是长任务 Agent 层。
- 自有产品保留用户、权限、计费、确定性业务状态、低延迟结构化 LLM 和已有带权限的 RAG。
- 先接一个低风险闭环：API route 创建自有任务并入队，worker 先 SSE 后 `newTask`，完成后同步 workspace artifact。
- `newTask` 是外部副作用；预生成 `taskId`/`connId`，用输入 hash 去重，worker 恢复时先查消息和 workspace，不要盲目自动重发。
- 部署停机不等于用户取消；worker shutdown 应进入 recovering，不能把 provider task 当失败路径自动 cancel。
- plan/act 审批要有业务状态机；计划完成的 `waiting_user` 仍算活跃任务，approve 前先确认 SSE，切 act 后再发执行 `askResponse`。
- 不是所有任务都需要 plan 审批：按次付费/全自动任务可按 kind 声明 direct-act（`newTask` 直接 `chatSettings:{mode:"act"}` + autoApprovalSettings 全开），跳过 `WAITING_APPROVAL` 状态位；质量兜底交给完成后的 required artifacts schema 校验（缺核心产物即业务失败并触发退款/补偿）。注意 direct-act 任务在恢复路径（recovery/`waitingForApproval` 判定）也要豁免审批停靠，否则重启后会卡死在不存在的审批位。
- `waiting_user` / `WAITING_APPROVAL` 要有 TTL；超时后条件认领，按需 `cancelTask`，再尝试 workspace salvage，最后释放并发占位并做幂等退款/用量补偿。不要让待审批任务永久占用用户额度或 active slot。
- 产品历史、下载和合规审计不要只依赖 provider workspace；完成后把最终 PDF/DOCX/ZIP/JSON/Markdown 等产物复制到自有 artifact store，并保留 provider path、storage key、checksum 和可选 manifest 作为来源索引（见 `docs/playbooks/artifact-archiving.md`）。
- 用户下载走自有 artifact store；生产缺 archived object 或对象超限时返回可解释错误并触发补偿，不要把 provider workspace fallback 作为长期下载能力。
- AgentTask / artifact 列表默认只返回 metadata 和 `hasPreview`，不下发完整 `previewText`、消息全文或大 JSON；正文通过单独 preview/detail/download 接口按权限读取。
- 如果接入自有计费/用量，退款或补偿必须幂等：先原子 claim，再执行 refund/credit，成功后 finalize；不能在外部退款成功但落库失败时释放 claim。
- 邮件、站内信、Slack/webhook、CRM 写入等外部触达也要用 claim：provider 明确失败时可重试，provider 已接受后即使本地 finalize 失败也不要释放 claim，避免恢复任务重复通知。
- SaaS 单 API Key 不等于每个业务用户都有物理隔离租户；多租户产品必须由自有后端做用户/组织权限和产物访问控制。
- P0 不默认接 Browser Use 或长期 RAG；确认 per-user session、RAG 隔离和用户授权后再开放。

### Sign in with InfiniSynapse（Partner SSO）

适合希望复用 InfiniSynapse 账号体系、或代用户发起任务并把计费记在用户账上的产品。流程与端点见 `docs/reference/api-index.md` §8 和上游 `partner-sso-integration-guide.md`；`clientSecret` 与 Partner API Key 都只能放服务端。自有账号 + 自持 API Key 的常规产品不需要接。

接 `withApiKey:true` 用户计费时的账号模型、key 存储与资源边界默认做法（计费身份 = 资源命名空间：key 按资源集创建时定死、任务全链路同一把 key、SSO 邮箱冲突不自动合并、20 把上限降级、双 key 任务列表验证计费归属）见 `docs/playbooks/partner-sso-account-billing.md`。

## Design principles

- 先设计恢复: 刷新页面后能用 `taskId` 读回进度和产物。
- 区分消息流和文件产物: SSE 适合进度，workspace 适合交付物。
- 不需要浏览器上下文时，不要强依赖 Chrome 插件。
- 用户上传的原始文件、Agent 请求的临时文件、最终产物要分目录管理。
- 成熟产品优先把 InfiniSynapse 接成一个可灰度、可取消、可恢复、可审计的后端能力，而不是一次性替换原有业务流。
- 报告/尽调类产品要把 evidence、scorecard、decision memo 当作业务对象保存；不要只保存一段文本答案。
