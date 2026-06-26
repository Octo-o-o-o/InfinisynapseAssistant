# 产物归档 Playbook

> 特定用法总结：把 InfiniSynapse workspace 产物同步到自有对象存储、文件服务或 R2/S3 兼容存储，并形成可恢复、可下载、可分析的产物包。
> 端点事实以 `docs/reference/api-index.md`、`docs/reference/task-lifecycle.md` 和上游 Server API 文档为准。

## 一句话规则

InfiniSynapse workspace 是执行侧存储；成熟产品的历史下载、权限控制、合规留存和后续分析应以自有 artifact store 为准，provider path 只作为来源索引和恢复线索。

## 什么时候需要

需要以下任一能力时，应做自有归档：

- 用户离开页面后还能长期下载结果。
- 产品承诺下载 SLA、删除策略、权限隔离或审计。
- 后续要分析任务质量、产物完整度、prompt/schema 版本和失败原因。
- 需要把同一个业务任务的 Markdown、PDF、JSON、图片、ZIP、消息摘要打成一致包。
- 需要在 provider workspace 不可用、任务超时或 worker 重启后做恢复/补偿。

一次性脚本、内部临时验证或本地 smoke 可以只保留 workspace path；面向用户的正式功能不应只依赖 provider workspace。

## 归档级别

| 级别 | 保存内容 | 适用场景 | 主要接口 |
| --- | --- | --- | --- |
| `minimal_final` | 业务必需的最终 Markdown/JSON/PDF/DOCX/图片等 | P0 用户交付、低成本报告 | `getTaskWorkspace`, `previewFile`, `downloadTaskFile` |
| `durable_package` | 最终产物 + `manifest.json` + 可选 `workspace.zip` | 成熟 SaaS、长期下载、客服恢复 | `getTaskWorkspace`, `downloadTaskFile`, `downloadZip` |
| `forensic_private` | 完整 workspace zip、脱敏消息摘要、runtime guard、错误与校验记录 | 审计、质量分析、故障复盘 | `downloadZip`, `getUiMessageById`, 自有日志 |

默认建议从 `minimal_final` 开始；如果产品里已经有任务历史页、下载页或管理员审计页，直接按 `durable_package` 设计。

## 标准时序

1. 任务完成信号以 `message.say === "completion_result" || message.ask === "completion_result"` 为准；超时、取消或 worker 恢复时也应进入 salvage 流程。
2. 调 `GET /api/ai_task/getTaskWorkspace/:id` 枚举 workspace 文件。
3. 按业务任务类型选择必需与推荐产物，优先收集 `final/` 下的 canonical artifacts；老任务可兼容根目录产物。
4. 文本文件可用 `POST /api/ai_task/previewFile` 预览；PDF/DOCX/ZIP/图片等必须用 `GET /api/tools/storage/downloadTaskFile/:taskId?path=` 按二进制流下载。
5. 对下载内容计算 `sha256`、`size`、`contentType`，上传到自有对象存储或文件服务。
6. 写入 artifact 表和 `manifest.json`，保存 provider path、storage key、校验和、可见性、归档状态和错误摘要。
7. 只有必需产物归档完成后，才把业务任务标记为可下载的 `completed`；非必需产物失败可标记 `partial` 并进入后台补偿。
8. 用户下载优先读自有 artifact store；provider workspace 只用于内部恢复、补偿和 backfill。

## Manifest 最小结构

```json
{
  "schemaVersion": 1,
  "businessTaskId": "agent-task_123",
  "providerTaskId": "00000000-0000-0000-0000-000000000000",
  "providerConnId": "11111111-1111-1111-1111-111111111111",
  "kind": "report",
  "promptVersion": "job-analysis/v3",
  "inputHash": "sha256:...",
  "archiveStatus": "complete",
  "workspace": {
    "cwd": "/",
    "files": [
      {
        "providerPath": "final/report.md",
        "size": 1234,
        "modifiedAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  },
  "artifacts": [
    {
      "providerPath": "final/report.md",
      "storageKey": "agent-tasks/agent-task_123/final/report.md",
      "fileName": "report.md",
      "contentType": "text/markdown",
      "size": 1234,
      "sha256": "sha256:...",
      "isFinal": true,
      "isRequired": true,
      "visibility": "private",
      "archiveStatus": "complete",
      "archivedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "messages": {
    "uiMessagesKey": "agent-tasks/agent-task_123/private/ui-messages.redacted.json",
    "redacted": true
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`manifest.json` 可以放在自有对象存储，也可以同时在数据库保存摘要字段。不要把 API Key、完整敏感输入、未脱敏消息或私密上传原文写进面向分析或公开下载的 manifest。

## 推荐落库字段

业务任务表建议保存：

- `business_task_id`、`task_kind`、`user_id` / `org_id`。
- `provider_task_id`、`provider_conn_id`。
- `status`、`archive_status`、`archive_error`。
- `input_hash`、`prompt_version`、`schema_version`。
- `workspace_snapshot`、`archive_manifest_key`、`workspace_zip_key`。
- `last_provider_message_at`、`completed_at`、`archived_at`。

产物表建议保存：

- `provider_path`、`storage_key`、`file_name`。
- `content_type`、`size`、`sha256`。
- `is_final`、`is_required`、`artifact_kind`。
- `visibility`：`private`、`approved_for_export`、`public_redacted` 等业务枚举。
- `archive_status`、`archive_error`、`archived_at`。

## 最终产物选择

InfiniSynapse 不原生理解 `working/` 与 `final/`；这是产品约定。报告类产品建议 prompt 要求：

- `working/` 放草稿、来源摘录、中间矩阵和 repair 临时文件。
- `final/` 放正式交付物，例如 `report.md`、`scorecard.json`、`source-map.json`、`evidence-ledger.json`、`summary.pdf`。
- 业务侧按任务类型维护必需/推荐产物清单，不按 basename 全局扫描。
- 不把 `working/report.md`、草稿、工具日志或内部错误片段当作用户最终下载。

如果 Agent 只能输出根目录文件，归档服务可以兼容根目录 canonical 文件，但应把这视为 legacy fallback，而不是标准路径。

## 归档失败策略

开发环境或 smoke 可以 fail-open：任务完成但归档失败时保留 provider path，方便调试。

生产环境应按产品承诺配置：

- 必需产物归档失败：不要标记为用户可下载的 `completed`；可进入 `archive_failed`、`needs_retry` 或 `needs_review`。
- 非必需产物归档失败：可标记 `partial`，用户看到主结果，后台继续补偿。
- provider fallback 只用于内部恢复和 backfill，不作为长期下载 SLA。
- 归档失败日志只保存脱敏错误、provider path、storage key 和校验摘要，不保存完整 API Key 或敏感内容。

触发 runtime guard、取消或超时后，也要尝试 `getTaskWorkspace`。如果必需产物已经完整且 schema 校验通过，可以进入 `validating` / `needs_review`，不必直接丢弃。

## 下载策略

- 前端只拿自有业务 artifact ID，不直接提交任意 workspace path。
- 后端从数据库或 manifest 查 provider path / storage key，做用户/组织权限校验。
- 默认从自有 artifact store 读取。
- 只有内部补偿、客服恢复或 backfill 才回源 `downloadTaskFile` / `downloadZip`。
- 二进制下载不按 `{code,message,data}` 信封解析；要按流转发、落盘或上传对象存储。

## 分析与隐私

把“完整原始归档”和“可分析数据集”分开：

- 原始 workspace ZIP、上传材料、消息全文放 private package，访问受限，有保留期限。
- 质量分析优先使用 manifest、产物大小、checksum、schema 校验结果、错误类型、耗时、review 状态和脱敏摘要。
- 不要把简历、合同、客户资料、联系方式、证件号、API Key、cookie 或内部链接直接写入分析表。
- 公开分享应生成 `public_redacted` 包，不能直接公开原始 task ZIP 或 private package。

## Backfill

老任务如果只有 `provider_path` 没有 `storage_key`，可做后台补偿：

1. 查本地任务记录，确认用户/组织权限和保留策略。
2. 调 `getTaskWorkspace` 确认 provider workspace 仍可用。
3. 逐个下载、校验、上传自有 store。
4. 生成或更新 manifest，记录 `complete` / `partial` / `missing`。
5. 不可恢复的任务保留 provider path 和缺失原因，不伪造成已归档。

## 检查清单

- 是否枚举 workspace，而不是只保存最后一条 SSE 文本？
- 是否定义了每种任务的必需/推荐产物？
- 正式产物是否优先来自 `final/` 或明确 canonical path？
- PDF/DOCX/ZIP/图片是否按二进制流处理？
- 是否保存 provider path、storage key、content type、size、checksum 和 visibility？
- 用户下载是否优先走自有 artifact store？
- 归档失败是否有 production 策略，而不是永远 fail-open？
- 原始/private 包和可分析/公开包是否分离？
- 是否避免把敏感输入、API Key、cookie 和未脱敏消息写进 manifest 或分析表？
