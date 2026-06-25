---
name: infinisynapse-product-patterns
description: |
  基于 InfiniSynapse 设计任务型产品，包括高考咨询、购物比价、报告写作、证据驱动决策包、通用长任务 Agent 应用。
  激活条件:
    - 用户问“基于这个项目开发产品”
    - 用户设计 mini-app、SaaS 功能、报告生成、尽调/决策包、购物/网页任务、高考助手
    - 用户需要 API 编排而不是单个 endpoint
---

# InfiniSynapse Product Patterns

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` 第 10 节
- `docs/reference/task-lifecycle.md`（含三类产品与 API 的对应表）
- `docs/playbooks/secure-integration.md`（后端代理 + API Key 安全 + 状态托管）
- `docs/playbooks/existing-product-integration.md`（成熟 SaaS / 老项目接入边界、worker 幂等、多租户风险）
- `docs/playbooks/task-sharing.md`（公开分享边界；原始 task public 会公开全部消息和文件）
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- 可复制骨架: `samples/sdk/`、`samples/templates/`

## 架构默认值

```text
Frontend -> Your Backend -> InfiniSynapse Server API
```

理由:

- API Key 必须留在服务端。
- `taskId`、`connId`、上传映射、结果路径需要落自家数据库。
- SSE 可以由自家后端转发给前端，便于鉴权、限流、恢复和审计。

## Common Agent task skeleton

1. 前端提交业务表单到自家后端。
2. 后端生成 `connId` 和可选 `taskId`。
3. 后端先连 `GET /api/ai/events?connId=...`。
4. 后端发 `POST /api/ai/message`，`type=newTask`。
5. 后端把 SSE 转为产品状态、进度、结构化结果。
6. 如果 Agent 请求上传，后端先上传文件，再发 `askResponse`。
7. 任务完成后读取 workspace 产物，必要时归档到自有对象存储，并保存业务结果记录。
8. 用户停止时调用 `POST /api/ai/message`，`type=cancelTask`；旧部署才 fallback `GET /api/ai_task/cancelTask?taskId=...`。

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
- 若未连接，引导安装 Chrome 插件。
- prompt 包含预算、链接、偏好、对比维度。
- 用 SSE 实时展示候选商品、风险和建议。

### Report writer

适合持续生成 Markdown、图表、PDF、Word 的产品。

- 用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 归档资料。
- 先列出并启用需要的 DB/RAG 资源。
- prompt 明确报告目标、受众、结构和引用要求。
- 多轮修订使用同一 `taskId` 的 `askResponse`。

### Evidence-backed decision package

适合项目尽调、供应商评估、Build-vs-Buy、开源引入、投研初筛等高价值判断。

- 不要只要求"写一篇报告"；prompt 要求输出 decision memo、scorecard、evidence ledger、risk/gates 和 validation plan。
- 事实、推断、假设、建议分开写；关键判断必须带来源、置信度和"什么事实会改变结论"。
- SSE 用于展示研究进度，最终判断和结构化评分从 workspace 产物读取，不只依赖最后一条消息。
- 多 URL 输入要区分"主评估对象"和"参考/竞品/证据链接": 主对象可空但最多一个；无主对象时按方向/想法判断，不要把参考链接误认为被评分项目。Browser Use 授权只绑定一个明确目标 URL/域名，不默认覆盖全部参考链接。
- 长期 RAG 只保存用户或 Reviewer 确认过的报告、评分卡或证据摘要；失败任务、草稿和未审结论不要自动 `saveToRag`。
- 对外分享默认发布脱敏 export；不要把含闭源材料、客户数据或上传文件的原始 task 直接 `setShare`。

### Existing SaaS / mature product extension

适合已经有用户、权限、业务数据库、队列、会员/计费或自研 AI 的产品。

- 不要把 InfiniSynapse 当作重写业务系统的理由；它默认是长任务 Agent 层。
- 自有产品保留用户、权限、计费、确定性业务状态、低延迟结构化 LLM 和已有带权限的 RAG。
- 先接一个低风险闭环：API route 创建自有任务并入队，worker 先 SSE 后 `newTask`，完成后同步 workspace artifact。
- `newTask` 是外部副作用；预生成 `taskId`/`connId`，用输入 hash 去重，worker 恢复时先查消息和 workspace，不要盲目自动重发。
- plan/act 审批要有业务状态机；计划完成的 `waiting_user` 仍算活跃任务，approve 前先确认 SSE，切 act 后再发执行 `askResponse`。
- 产品历史、下载和合规审计不要只依赖 provider workspace；完成后把最终 PDF/DOCX/ZIP/JSON/Markdown 等产物复制到自有 artifact store，并保留 provider path 作为来源索引。
- 如果接入自有计费/用量，退款或补偿必须幂等：先原子 claim，再执行 refund/credit，成功后 finalize；不能在外部退款成功但落库失败时释放 claim。
- SaaS 单 API Key 不等于每个业务用户都有物理隔离租户；多租户产品必须由自有后端做用户/组织权限和产物访问控制。
- P0 不默认接 Browser Use 或长期 RAG；确认 per-user session、RAG 隔离和用户授权后再开放。

## Design principles

- 先设计恢复: 刷新页面后能用 `taskId` 读回进度和产物。
- 区分消息流和文件产物: SSE 适合进度，workspace 适合交付物。
- 不需要浏览器上下文时，不要强依赖 Chrome 插件。
- 用户上传的原始文件、Agent 请求的临时文件、最终产物要分目录管理。
- 成熟产品优先把 InfiniSynapse 接成一个可灰度、可取消、可恢复、可审计的后端能力，而不是一次性替换原有业务流。
- 报告/尽调类产品要把 evidence、scorecard、decision memo 当作业务对象保存；不要只保存一段文本答案。
