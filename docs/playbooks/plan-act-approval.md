# 计划/执行模式与人工审批 Playbook

> 特定用法总结：把 InfiniSynapse 的 plan/act 模式、`autoApprovalSettings` 和人工确认设计成"可审阅的 Agent 工作流"，而不是黑盒直接执行。
> 端点见 `docs/reference/api-index.md`（`chatSettings`、`togglePlanActMode`、`autoApprovalSettings`）。
> 来源：`docs/proposals/` 的求职招聘与项目调研方案都独立收敛出这套两段式审批流程。

## 一句话规则

默认让 Agent 先进"计划阶段"说清要访问哪些网页/文件、要产出什么；用户确认后再进"执行阶段"。**低风险只读 + 生成**可自动审批，**登录 / 表单 / 外部提交 / 投递 / 公开分享 / 连敏感数据源**必须人工确认。

## 为什么

长任务里有些动作只读、低风险（读已上传文件、生成报告），有些涉及登录态、表单、外部写入、隐私、付费。直接 `act` 执行不可审阅、风险高。两段式把 InfiniSynapse 从"黑盒执行器"变成"可审阅工作流引擎"。

## 两段式流程

1. **计划阶段**：建任务时 `chatSettings: { "mode": "plan" }`，prompt 要求 Agent 先列出"将访问的 URL、将读取的文件、拟产出文件、风险点"，**不实际执行**。
2. **用户确认**：前端展示计划，用户 approve / reject / 修改。
3. **执行阶段**：`POST /api/ai/message` `type=togglePlanActMode` 切到 act（或后续消息带 `chatSettings.mode="act"`），Agent 才实际执行。

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
| `POST /api/ai/message` `{type:"autoApprovalSettings", autoApprovalSettings}` | 更新自动审批配置 |

## 常见反模式

- 默认 `act` 直接执行高风险动作，不给用户计划预览。
- 把登录 / 投递 / 公开分享也设成自动审批。
- "计划阶段"就实际访问了网页或提交了表单（计划应只读、不产生副作用）。
- 自动审批放得过宽，等于回到黑盒执行。

## 检查清单

- 高风险动作（登录 / 表单 / 提交 / 分享 / 敏感数据源）是否都需人工确认？
- 用户能否在执行**前**看到 Agent 的计划？
- `autoApprovalSettings` 是否只放宽了低风险的只读 / 生成动作？
- 计划阶段是否真的"只说不做"？
