---
name: infinisynapse-product-patterns
description: |
  基于 InfiniSynapse 设计任务型产品，包括高考咨询、购物比价、报告写作、通用长任务 Agent 应用。
  激活条件:
    - 用户问“基于这个项目开发产品”
    - 用户设计 mini-app、SaaS 功能、报告生成、购物/网页任务、高考助手
    - 用户需要 API 编排而不是单个 endpoint
---

# InfiniSynapse Product Patterns

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md` 第 10 节
- `docs/reference/task-lifecycle.md`（含三类产品与 API 的对应表）
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
7. 任务完成后读取 workspace 产物并保存业务结果记录。
8. 用户停止时调用 `GET /api/ai_task/cancelTask?taskId=...`。

## Product patterns

### Form + PDF report

适合高考咨询、投研报告、合同/文档分析。

- 创建任务: 表单字段拼成清晰 prompt。
- 可选上传: `/api/ai/upload?taskId=`
- 恢复: `/api/ai_task/getUiMessageById?id=`
- 产物: `getTaskWorkspace` + `previewFile` + `downloadTaskFile`
- 分享: `setShare` + public task endpoints

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

## Design principles

- 先设计恢复: 刷新页面后能用 `taskId` 读回进度和产物。
- 区分消息流和文件产物: SSE 适合进度，workspace 适合交付物。
- 不需要浏览器上下文时，不要强依赖 Chrome 插件。
- 用户上传的原始文件、Agent 请求的临时文件、最终产物要分目录管理。
