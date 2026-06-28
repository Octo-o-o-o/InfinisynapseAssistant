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

## 不适用和收缩原则

不要为了“接入 InfiniSynapse”而默认建设完整归档系统：

- 非 agentic 的问答、摘要、分类、改写、轻量抽取和短文本评分，优先走自有后端的轻量 LLM 路由或网关，不创建 task/workspace/artifact store。
- 没有长期下载、跨页面恢复、审计或合规承诺的内部工具，可以先保存 provider path 和业务结果摘要。
- P0 用户功能通常只需要归档必需最终产物和 artifact rows；`manifest.json`、完整 `workspace.zip`、消息快照、公开脱敏包和 backfill worker 都是按需升级项。
- 状态机至少要分清“provider 已完成”和“用户可下载”，但不要求所有产品都实现完整的 `validating` / `archiving` / `needs_review` 状态集合。

## 归档级别

| 级别 | 保存内容 | 适用场景 | 主要接口 |
| --- | --- | --- | --- |
| `minimal_final` | 业务必需的最终 Markdown/JSON/PDF/DOCX/图片等 | P0 用户交付、低成本报告 | `getTaskWorkspace`, `previewFile`, `downloadTaskFile` |
| `durable_package` | 最终产物 + `manifest.json` + 可选 `workspace.zip` | 成熟 SaaS、长期下载、客服恢复 | `getTaskWorkspace`, `downloadTaskFile`, `downloadZip` |
| `forensic_private` | 完整 workspace zip、脱敏消息摘要、runtime guard、错误与校验记录 | 审计、质量分析、故障复盘 | `downloadZip`, `getUiMessageById`, 自有日志 |

默认建议从 `minimal_final` 开始；如果产品里已经有任务历史页、下载页或管理员审计页，直接按 `durable_package` 设计。

这些级别是产品策略，不是 InfiniSynapse API，也不是实现清单。不要在 P0 同时实现三个层级；先让必需产物可恢复、可校验、可按权限下载，再升级完整包和审计包。

## 标准时序

1. 任务完成信号以 `message.say === "completion_result" || message.ask === "completion_result"` 为准；worker 崩溃、SSE idle、业务总超时和恢复任务应进入 salvage 流程。用户主动取消通常表示放弃交付，应先按产品退款/释放资源处理，除非产品明确承诺“取消后仍交付已有结果”，否则不要自动 salvage 给用户。
2. 调 `GET /api/ai_task/getTaskWorkspace/:id` 枚举 workspace 文件。
3. 按业务任务类型选择必需与推荐产物，优先收集 `final/` 下的 canonical artifacts；老任务可兼容根目录产物。
4. 对必需产物做轻量完整性校验：JSON 用 schema，Markdown 至少检查非空、标题/关键段落和已知错误片段，二进制检查类型和大小。
5. `previewFile` 只用于文本预览和轻量校验；归档的真实字节以 `downloadTaskFile` / `downloadZip` 返回的流为准。
6. 对下载内容计算 `sha256`、`size`、`contentType`，上传到自有对象存储或文件服务。下载前优先检查 `Content-Length`，没有长度时边读边累计，超过单文件或单任务预算立即 abort；不要先把未知大小的二进制完整读进内存再判断。
7. 写入 artifact 表；成熟产品可同时写入 `manifest.json`，保存 provider path、storage key、校验和、可见性、归档状态和错误摘要。
8. 只有必需产物归档完成后，才把业务任务标记为用户可下载的 `completed`；非必需产物失败可标记 `partial` 并进入后台补偿。
9. 用户下载优先读自有 artifact store；provider workspace 只用于内部恢复、补偿和 backfill。

## Manifest 示例结构

下面是 durable package 的推荐示例，不是所有产品必须照抄的强制 schema。P0 可以只在数据库 artifact rows 中保存同等信息；需要跨系统导出、人工排障或离线分析时，再生成单独 `manifest.json`。

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
      "checksum": "sha256:...",
      "isFinal": true,
      "isRequired": true,
      "visibility": "private",
      "archiveStatus": "archived",
      "archivedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

`manifest.json` 可以放在自有对象存储，也可以同时在数据库保存摘要字段。不要把 API Key、完整敏感输入、未脱敏消息或私密上传原文写进面向分析或公开下载的 manifest。

如果保存消息索引，只保存脱敏摘要或受限私有包的 key；不要默认保存消息全文。`workspace.zip` 也应视为高风险 private artifact，有明确用途、访问控制和保留期限时再保存。

## 推荐落库字段

业务任务表最低建议保存：

- `business_task_id`、`task_kind`、`user_id` / `org_id`。
- `provider_task_id`、`provider_conn_id`。
- `status`、`archive_status`、`archive_error`。
- `workspace_snapshot`、`final_artifacts`。
- `completed_at`、`archived_at`。

成熟产品可扩展保存：

- `input_hash`、`prompt_version`、`schema_version`。
- `archive_manifest_key`、`workspace_zip_key`。
- `last_provider_message_at`、`retention_policy`。

产物表建议保存：

- `provider_path`、`storage_key`、`file_name`。
- `content_type`、`size`、`checksum`。
- `is_final`、`is_required`、`artifact_kind`。
- `visibility`：`private`、`approved_for_export`、`public_redacted` 等业务枚举。
- `archive_status`、`archive_error`、`archived_at`。

### 状态语义建议

把“任务/包级状态”和“单个 artifact 的归档状态”分开，避免把不存在的产物伪造成一条 artifact row：

- 任务或 manifest 包级 `archive_status` 可表达 `complete`、`partial`、`archive_failed`、`needs_review` 等交付状态。
- 单个 artifact 行只描述已经发现的 provider 文件如何下载，建议收敛为小枚举，例如 `archived`（已有自有 storage key）、`provider_only`（仅保留 provider path，可临时回源/后台补偿）、`oversized`（超过单文件预算，需特殊处理）。
- 必需产物缺失不是 artifact 行状态；用任务/包级 `missingRequired`、`missingRecommended`、`archive_error` 或 failureCode 表达。不要创建 `archive_status="missing"` 的空 artifact row。
- 下载页面或 API 可以暴露 artifact 归档状态，让用户/客服分清长期可下载、自有归档和临时 provider fallback；不要另造与 `archive_status` 含义重复的 `downloadSource` 字段，除非下载响应需要用 header 标识本次实际来源。

## 最终产物选择

InfiniSynapse 不原生理解 `working/` 与 `final/`；这是产品约定。报告类产品建议 prompt 要求：

- `working/` 放草稿、来源摘录、中间矩阵和 repair 临时文件。
- `final/` 放正式交付物，例如 `report.md`、`scorecard.json`、`source-map.json`、`evidence-ledger.json`、`summary.pdf`。
- 业务侧按任务类型维护必需/推荐产物清单，不按 basename 全局扫描。
- 不把 `working/report.md`、草稿、工具日志或内部错误片段当作用户最终下载。

如果 Agent 只能输出根目录文件，归档服务可以兼容根目录 canonical 文件，但应把这视为 legacy fallback，而不是标准路径。

## 幂等、并发和对象 key

归档 worker 必须能被完成事件、恢复流程和人工 backfill 重复触发而不产生重复副作用：

- 正常完成、异常中断 salvage、恢复 cron 和人工 backfill 应复用同一个 finalization writer；不要在三处复制“删旧产物、写 artifact row、更新任务终态、退款/通知”的逻辑。
- 下载前用 `business_task_id + provider_path` 或等价唯一键抢占归档；下载后用 checksum、size 和 storage key 更新记录。
- 对象存储 key 优先由内部 ID、任务 ID 和 canonical filename 生成，不直接拼接未清洗的用户输入或原始文件名。
- 防止 path traversal：忽略 `../`、绝对路径、控制字符和会改变对象层级的特殊片段。
- 上传成功但数据库写失败时，如果使用随机对象 key，应 best-effort 删除本次新上传对象；如果使用确定性 key，可保留并记录可对账线索。数据库成功但上传失败时，将已有 provider 文件标记为 `provider_only` 或在任务级记录 `archive_failed`，不要把缺失输出写成 artifact-level `missing`，也不要让下载端返回空内容。
- 重归档替换已有 artifact rows 时，先在数据库事务内收集旧 `storage_key`，事务提交成功后再 best-effort 删除旧对象；事务提交前不要删除旧对象，否则回滚会留下“数据库仍引用但对象已删”的破坏性状态。
- 多进程恢复或 cron 抢救同一任务时，先用条件状态转移或等价原子 claim（例如 `status='RECOVERING' -> 'SYNCING'` 且检查影响行数）认领，再调用共享 finalization writer。不要仅依赖内存锁或同进程队列假设。
- 大文件用流式下载、流式 hash 和流式上传，设置单文件和单任务总字节预算。
- 对象存储读取也要保留大小保护；用户下载接口不要把对象二次复制成完整 ArrayBuffer 后再返回，优先用 stream 或框架支持的低拷贝响应体。
- 归档完成后的邮件、站内信、webhook 或额度补偿必须幂等，避免恢复任务时重复通知或重复退款。

## 成本收缩

默认不要保存所有东西：

- `workspace.zip`：只在客服恢复、审计或迁移有明确收益时保存；它可能包含上传材料、中间草稿和私密日志。
- 消息快照：只保存脱敏摘要；确需全文审计时放受限 private package，并设置保留期限。
- 公开包：早期可以不开放；开放时先做人工审核或 DLP/PII/secret 检查。
- Backfill：只有已有历史任务或迁移需求时再做，不是 P0 必需。
- Manifest：如果数据库 artifact rows 已满足下载和恢复，可以暂不生成单独 JSON 文件。

## 归档失败策略

开发环境或 smoke 可以 fail-open：任务完成但归档失败时保留 provider path，方便调试。

生产环境应按产品承诺配置：

- 必需产物归档失败：不要标记为用户可下载的 `completed`；可进入 `archive_failed`、`needs_retry` 或 `needs_review`。
- 非必需产物归档失败：可标记 `partial`，用户看到主结果，后台继续补偿。
- provider fallback 只用于内部恢复和 backfill，不作为长期下载 SLA。
- 面向用户的生产下载缺 `storage_key`、自有对象不存在或对象超限时，应返回可解释错误并触发补偿/告警；不要无限期回源 provider workspace，让用户体验依赖执行侧临时存储。
- 归档失败日志只保存脱敏错误、provider path、storage key 和校验摘要，不保存完整 API Key 或敏感内容。

触发 runtime guard、worker 重启、SSE 异常或业务总超时后，也要尝试 `getTaskWorkspace`。如果必需产物已经完整且 schema 校验通过，可以进入 `validating` / `needs_review`，不必直接丢弃。用户主动取消是例外：默认不做面向用户的 salvage，避免违背用户放弃意图和重复触发通知/退款；只有产品事先承诺“取消后可取已有结果”时才单独设计。

## 下载策略

- 前端只拿自有业务 artifact ID，不直接提交任意 workspace path。
- 后端从数据库或 manifest 查 provider path / storage key，做用户/组织权限校验。
- 默认从自有 artifact store 读取。
- 只有内部补偿、客服恢复或 backfill 才回源 `downloadTaskFile` / `downloadZip`。
- 二进制下载不按 `{code,message,data}` 信封解析；要按流转发、落盘或上传对象存储。
- 下载 client 要设置独立 timeout；不要把 SSE 长连接 timeout 复用于文件下载，也不要让文件下载无限等待 provider 或对象存储。

## 分析与隐私

把“完整原始归档”和“可分析数据集”分开：

- 原始 workspace ZIP、上传材料、消息全文放 private package，访问受限，有保留期限。
- 质量分析优先使用 manifest、产物大小、checksum、schema 校验结果、错误类型、耗时、review 状态和脱敏摘要。
- 不要把简历、合同、客户资料、联系方式、证件号、API Key、cookie 或内部链接直接写入分析表。
- 公开分享应生成 `public_redacted` 包，不能直接公开原始 task ZIP 或 private package。
- 删除和保留策略以自有 artifact store 和业务索引为准；provider workspace 的删除能力不要在未经验证前写成产品承诺。

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
- 归档字节是否来自 `downloadTaskFile` / `downloadZip`，而不是把 `previewFile` 当长期存储来源？
- PDF/DOCX/ZIP/图片是否按二进制流处理？
- 是否保存 provider path、storage key、content type、size、checksum 和 visibility？
- 是否把缺失必需产物表达在任务/包级，而不是伪造 artifact-level `missing`？
- storage key 是否避免 PII、未清洗文件名和 path traversal？
- 归档 worker 是否幂等，能用共享 finalization writer 处理重复完成事件、恢复、salvage 和 backfill？
- 重归档和事务失败是否都有对象清理策略，且不会在事务提交前删除旧对象？
- 用户下载是否优先走自有 artifact store？
- 归档失败是否有 production 策略，而不是永远 fail-open？
- 原始/private 包和可分析/公开包是否分离？
- 是否避免把敏感输入、API Key、cookie 和未脱敏消息写进 manifest 或分析表？
