# 计划/执行模式与人工审批 Playbook

> 特定用法总结：把 InfiniSynapse 的 plan/act 模式、`autoApprovalSettings` 和人工确认设计成"可审阅的 Agent 工作流"，而不是黑盒直接执行。
> 端点见 `docs/reference/api-index.md`（`chatSettings`、`togglePlanActMode`、`autoApprovalSettings`）。
> 来源：`docs/proposals/` 的求职招聘与项目调研方案都独立收敛出这套两段式审批流程。

## 一句话规则

默认让 Agent 先进"计划阶段"说清要访问哪些网页/文件、要产出什么；用户确认后再进"执行阶段"。**低风险只读 + 生成**可自动审批，**登录 / 表单 / 外部提交 / 投递 / 公开分享 / 连敏感数据源**必须人工确认。

## 为什么

长任务里有些动作只读、低风险（读已上传文件、生成报告），有些涉及登录态、表单、外部写入、隐私、付费。直接 `act` 执行不可审阅、风险高。两段式把 InfiniSynapse 从"黑盒执行器"变成"可审阅工作流引擎"。

## 两段式流程

1. **计划阶段**：建任务前先收紧 `autoApprovalSettings`（关闭 web/browser/native tool 等执行能力），再建任务并带 `chatSettings: { "mode": "plan" }`。prompt 要求 Agent 先列出"将访问的 URL、将读取的文件、拟产出文件、风险点"，**不实际执行**。
2. **用户确认**：前端展示计划，用户 approve / reject / 修改。
3. **执行阶段**：approve 后先确认 SSE consumer 已连接，再放宽低风险只读/生成动作的 `autoApprovalSettings`，`POST /api/ai/message` `type=togglePlanActMode` 切到 act（或后续消息带 `chatSettings.mode="act"`），随后 `askResponse` 发送执行 prompt，Agent 才实际执行。

> 实测注意：`newTask.chatSettings.mode="plan"` 和随 `newTask` 携带的 `autoApprovalSettings` 在部分环境里不一定反映到可见运行状态。更稳的做法是先单独发送 `type=autoApprovalSettings`，计划 prompt 中明确"若系统要求工具，唯一允许 `plan_mode_response` 提交计划，且必须填写非空 `response`"，并把非空 `message.ask==="plan_mode_response"` 或符合固定结构的计划正文视为"等待人工审批"信号。不要把 prompt 回显、空 `response` 或工具重试片段当作计划完成。

> 严格 schema 产物经验：执行 prompt 若要求 Agent 写 JSON，并且下游会做 schema 校验，必须列出逐字字段名和禁止别名。真实消费项目里，模型容易把 `id/label/score0To5/status/reason/title/probability/mitigation` 写成 `name/score/passed/detail/description` 等自然字段；后端应继续严格校验，prompt 负责减少重试。

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
- 计划阶段收到 `plan_mode_response` 后仍继续等待 `completion_result`，导致业务任务卡在 planning。
- 把空 `plan_mode_response` 或回显的原始 prompt 当成计划完成，导致过早 approve。
- 只描述 JSON schema 的语义，不写逐字字段名，导致 Agent 输出字段别名而 schema 校验失败。
- approve 后没有重新建立/确认 SSE，导致 act 阶段实际运行但业务后端收不到产物完成事件。

## 检查清单

- 高风险动作（登录 / 表单 / 提交 / 分享 / 敏感数据源）是否都需人工确认？
- 用户能否在执行**前**看到 Agent 的计划？
- `autoApprovalSettings` 是否只放宽了低风险的只读 / 生成动作？
- 计划阶段是否真的"只说不做"？
- 是否把 `plan_mode_response` 和 success notification 纳入状态机？
- approve 后是否在 `togglePlanActMode`/`askResponse` 前确认 SSE 已连接？
