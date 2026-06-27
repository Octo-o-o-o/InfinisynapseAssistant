# 计划/执行模式与人工审批 Playbook

> 特定用法总结：把 InfiniSynapse 的 plan/act 模式、`autoApprovalSettings` 和人工确认设计成"可审阅的 Agent 工作流"，而不是黑盒直接执行。
> 端点见 `docs/reference/api-index.md`（`chatSettings`、`togglePlanActMode`、`autoApprovalSettings`）。
> 来源：`docs/proposals/` 的求职招聘与项目调研方案都独立收敛出这套两段式审批流程。

## 一句话规则

默认让 Agent 先进"计划阶段"说清要访问哪些网页/文件、要产出什么；用户确认后再进"执行阶段"。**低风险只读 + 生成**可自动审批，**登录 / 表单 / 外部提交 / 投递 / 公开分享 / 连敏感数据源**必须人工确认。

## 为什么

长任务里有些动作只读、低风险（读已上传文件、生成报告），有些涉及登录态、表单、外部写入、隐私、付费。直接 `act` 执行不可审阅、风险高。两段式把 InfiniSynapse 从"黑盒执行器"变成"可审阅工作流引擎"。

## 审批粒度

不是所有任务都要手动 plan/approve。低风险表单生成、只读分析、小型报告和固定 workspace 产物可以直接 `act` 或启用窄范围自动审批；人工审批应保留给 Browser Use、外部写入、公开分享、付费动作、登录态页面和生产敏感数据源。

Browser Use 的自动审批只适合用户已明确指定的只读 URL/域名。它不能替产品选择目标 URL、放宽速率限制、扩大授权范围，或批准提交表单、发送消息、投递、购买、删除等写入动作。

## 两段式流程

1. **计划阶段**：建任务前先收紧 `autoApprovalSettings`（关闭 web/browser/native tool 等执行能力），再建任务并带 `chatSettings: { "mode": "plan" }`。prompt 要求 Agent 先列出"将访问的 URL、将读取的文件、拟产出文件、风险点"，**不实际执行**。
2. **用户确认**：前端展示计划，用户 approve / reject / 修改。
3. **执行阶段**：approve 后先确认 SSE consumer 已连接，再放宽低风险只读/生成动作的 `autoApprovalSettings`，`POST /api/ai/message` `type=togglePlanActMode` 切到 act（或后续消息带 `chatSettings.mode="act"`），随后 `askResponse` 发送执行 prompt，Agent 才实际执行。

> 实测注意：`newTask.chatSettings.mode="plan"` 和随 `newTask` 携带的 `autoApprovalSettings` 在部分环境里不一定反映到可见运行状态。更稳的做法是先单独发送 `type=autoApprovalSettings`，计划 prompt 中明确"若系统要求工具，唯一允许 `plan_mode_response` 提交计划，且必须填写非空 `response`"，并把非空 `message.ask==="plan_mode_response"` 或符合固定结构的计划正文视为"等待人工审批"信号。不要把 prompt 回显、空 `response` 或工具重试片段当作计划完成。

> 严格 schema 产物经验：执行 prompt 若要求 Agent 写 JSON，并且下游会做 schema 校验，必须列出逐字字段名和禁止别名。真实消费项目里，模型容易把 `id/label/score0To5/status/reason/title/probability/mitigation` 写成 `name/score/passed/detail/description` 等自然字段；后端应继续严格校验，prompt 负责减少重试。

> approve 后执行 prompt 经验：产品侧已经完成人工审批并切到 act 后，执行 prompt 要明确"不要再调用 `plan` / `switch_mode` / `plan_mode_response` / `update_plan` 或模式切换工具，直接执行已批准计划"。真实 smoke 中，若 act prompt 被上游当作新请求，Agent 可能先尝试内部计划工具；参数不完整时会进入工具重试循环并触发 `notification.type=error`。

> 回归 review 经验：不要只检查 prompt 是否写了"先计划"。代码 review 和 smoke 必须同时检查出站 payload 与默认值：计划入口实际发送 `chatSettings.mode="plan"`；通用 client/runner 默认值没有悄悄改成 `act`；approve 路径在 `askResponse` 前发送 `togglePlanActMode` 切到 `act`；追加指令、拒绝、取消等非 approve 路径不会切到 `act`。如果 diff 改到 `chatSettings`、`mode`、`togglePlanActMode`、自动审批或 plan/act 测试 fixture，要按高风险变更审。

## 成熟产品状态机

把 plan/act 接入已有产品时，不要只靠内存或前端按钮状态。业务库至少要能区分 `planning`、`waiting_user`、`running`、`completed`、`failed`、`cancelled`，并保存 `plan_requested_at`、`plan_received_at`、`plan_approved_at`、`act_sent_at` 或等价审计字段。

`waiting_user` 仍是活跃任务：它要参与同用户并发限制、取消、超时、恢复和用量展示。用户 approve 时，后端应重新建立或确认 SSE，再发送 `togglePlanActMode` 与执行 `askResponse`。如果队列 `jobId` 使用自有业务任务 ID，而计划阶段 worker 已经完成退出，approve 重入时要删除/替换已完成 job，或使用 plan/act 分阶段 `jobId`，避免队列返回旧完成 job 导致 act 阶段没有运行。

## 真实 smoke 与 bounded artifacts

真实集成 smoke 的目标是验证"先 SSE → plan → 人工审批 → act → workspace 产物 → schema 校验 → 私密下载"闭环，不是生成完整业务报告。默认 smoke 应选择小型公开目标，关闭 Browser/RAG/数据源，使用短 prompt 和固定小产物。

执行 prompt 要写清硬上限：固定文件名、每个 Markdown 的字符上限、JSON 记录条数上限、schema 字段逐字匹配、先写固定产物再 completion。否则 Agent 容易在 `write_to_file` / `replace_in_file` 中反复修补长文件，出现截断、缺参数或补写循环，导致 smoke 拖到超时并持续消耗调用。

后端 smoke runner 也要有工程护栏：业务总超时、失败/超时后 `cancelTask`、usage ledger、脱敏事件样本、以及 timeout/failure 后先 `getTaskWorkspace` 恢复已有产物并做 schema 校验。已有必需产物全部有效时可以归档为成功；产物不完整时标记失败并保留安全错误。

## 风险动作分级（决策表）

| 动作 | 风险 | 审批 |
| --- | --- | --- |
| 读已上传文件 / 生成报告 / 读公开网页 | 低 | 可自动审批 |
| Browser Use 读取用户浏览器页面 | 中 | 建议确认（涉及用户浏览器上下文） |
| 浏览器登录 / 自动填写表单 | 高 | 必须人工 |
| 外部提交 / 投递 / 写入 | 高 | 必须人工 |
| `setShare` 公开分享 | 高 | 必须人工（见 [task-sharing.md](task-sharing.md)） |
| 连接生产 / 敏感数据源 | 高 | 必须人工，或走私有化部署 |

## 端点

| 端点 | 用途 |
| --- | --- |
| `POST /api/ai/message` `{type:"newTask", chatSettings:{mode:"plan"\|"act"}}` | 建任务时指定模式 |
| `POST /api/ai/message` `{type:"togglePlanActMode", chatSettings, taskId?}` | 计划↔执行切换 |
| `POST /api/ai/message` `{type:"autoApprovalSettings", autoApprovalSettings, taskId?, connId?}` | 更新自动审批配置 |

## 常见反模式

- 默认 `act` 直接执行高风险动作，不给用户计划预览。
- 把登录 / 投递 / 公开分享也设成自动审批。
- "计划阶段"就实际访问了网页或提交了表单（计划应只读、不产生副作用）。
- 自动审批放得过宽，等于回到黑盒执行。
- 让自动审批替用户选择浏览器目标、扩大 URL/域名授权或批准写入动作。
- 计划阶段收到 `plan_mode_response` 后仍继续等待 `completion_result`，导致业务任务卡在 planning。
- 把空 `plan_mode_response` 或回显的原始 prompt 当成计划完成，导致过早 approve。
- 只描述 JSON schema 的语义，不写逐字字段名，导致 Agent 输出字段别名而 schema 校验失败。
- 把真实 smoke 当完整报告生成，让 Agent 写长 Markdown/JSON，触发截断补写循环和额外消耗。
- 只看文案或 prompt，没看实际出站 payload，导致计划任务的 SDK 默认值、runner 默认值或测试 fixture 被改成 `act` 后仍通过 review。
- approve 后没有重新建立/确认 SSE，导致 act 阶段实际运行但业务后端收不到产物完成事件。
- approve 后直接 `askResponse` 执行 prompt，但没有先发送 `togglePlanActMode` 或等价的 `chatSettings.mode="act"`，导致上游仍按计划阶段处理。
- approve 后的执行 prompt 没有禁止 `plan` / `switch_mode` / `plan_mode_response` 等模式工具，导致 Agent 回到计划工具循环而不是直接执行已批准计划。
- `waiting_user` 不计入活跃任务，导致同一用户在计划待审期间继续创建多个高成本任务。
- 队列复用同一个已完成 job，approve 后没有真正启动 act worker。

## 检查清单

- 高风险动作（登录 / 表单 / 提交 / 分享 / 敏感数据源）是否都需人工确认？
- 用户能否在执行**前**看到 Agent 的计划？
- `autoApprovalSettings` 是否只放宽了低风险的只读 / 生成动作？
- 计划阶段是否真的"只说不做"？
- 是否有测试或日志证据证明计划入口的实际 payload 是 `chatSettings.mode="plan"`？
- 是否把 `plan_mode_response` 和 success notification 纳入状态机？
- approve 后是否在 `togglePlanActMode`/`askResponse` 前确认 SSE 已连接？
- approve 路径是否先切到 `act` 再发送执行 prompt，且追加指令/拒绝/取消不会误切 `act`？
- review 是否覆盖 client、runner、mock/fake、fixture 和默认参数，而不只覆盖 UI 按钮或 prompt 文案？
- `waiting_user` 是否参与并发限制、取消、超时、恢复和用量展示？
- approve 重入时队列是否能真正启动 act 阶段，而不是命中旧完成 job？
- 真实 smoke 是否设置了小产物硬上限、总超时、失败取消和 workspace 恢复？
