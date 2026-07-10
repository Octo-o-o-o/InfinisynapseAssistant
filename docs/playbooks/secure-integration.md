# 安全接入 Playbook

> 特定用法总结：把"基于 InfiniSynapse 开发产品时如何不泄露 API Key、如何托管状态、如何设计恢复"合并成一套默认决策与清单。
> 硬约束原文见 `AGENTS.md` 第 3 节；可跑骨架见 `samples/templates/server-side-agent-flow.md` 与 `samples/sdk/`；端点见 `docs/reference/api-index.md`。

## 一句话规则

API Key 只在可信后端边界；前端只和你的后端通信，由后端持有 Key 并代理 InfiniSynapse。前端永远拿不到 InfiniSynapse 的 Key。

如果产品同时直连 LLM 做轻量调用（见 [llm-routing.md](llm-routing.md)），LLM provider key 也必须只在服务端。直连 LLM 指业务后端直连，不是前端直连。

单用户桌面 / 原生 BYOK 可以把 Electron main process、Tauri command 或 native layer 作为本机可信后端，但 renderer / WebView 仍然不能拿 Key 或直连 InfiniSynapse。完整边界见 [desktop-native-byok.md](desktop-native-byok.md)。

## 默认架构

```text
前端 / mini-app  →  你的后端（持有 API Key、组装 prompt、转发文件、读产物）  →  InfiniSynapse Server API
```

不要让网页前端、renderer、WebView 或移动端 JS 直接调 `app.infinisynapse.cn/api/...`——那等于把 Key 打进可被用户拿到的产物。对应扫描规则 `INF-SEC-001`（硬编码 Bearer）、`INF-SEC-002`（前端直连）。

桌面 / 原生 BYOK 的等价架构是：

```text
Renderer / WebView / UI  →  受控 IPC / Native bridge  →  主进程或原生层（持 Key）  →  InfiniSynapse Server API
```

这个 bridge 只暴露产品语义方法（如 `startTask`、`cancelTask`、`getWorkspace`），不暴露任意 URL / headers 代理，也不返回 `getApiKey()`。

## API Key 生命周期

| 阶段 | 做法 |
| --- | --- |
| 创建 | 在 `https://app.infinisynapse.cn/tasks` 左下角设置 → **API Key Management** → Create |
| 存储 | 放服务端环境变量或密钥管理系统（KMS / Secrets Manager / Vault），不进代码仓库、不进前端 bundle、不进日志 |
| 使用 | 仅服务端请求带 `Authorization: Bearer <key>`；前端调你自己的业务路由 |
| 轮换 | 定期在 API Key Management 新建并切换；旧 Key 停用 |
| 泄露处理 | 立即在 API Key Management 删除旧 Key 并重建；排查泄露路径（前端/日志/仓库/截图） |

## 多租户上游隔离：每工作区/租户独立 InfiniSynapse 凭据

默认单一平台 Key 足够。但当产品面向企业、要求"我的任务数据不与别的租户共用一个上游账号"时，需要**每工作区（或每租户）绑定独立 InfiniSynapse 凭据**。这套模式从多个下游多租户产品收敛而来，可直接照搬：

- **加密存储**：租户提供的上游 API Key 用 AES-256-GCM 静态加密落库（密钥由服务端独立 secret 经 KDF 派生，**不复用**平台 Key）。envelope 建议带版本号、定长校验 salt/iv/tag（固定 `authTagLength:16`，拒截断 tag 把 GCM 完整性降级），并把归属（tenant/workspace id）作为 **AAD** 绑定——数据文件内跨记录互换密文会 GCM 校验失败。KDF 用**异步**版本（如 `scrypt` 的 promisify），别在请求线程跑同步 KDF；并对并发冷缓存解析合并到同一个 in-flight Promise，避免 cache stampede 打满线程池。
- **只暴露指纹**：任何读路径（API 响应、审计 `detailsJson`、DB 快照、前端）只回 `keyFingerprint`（如 sha256 前 12 hex），**绝不回明文 Key 或密文 envelope**。绑定端点是全系统唯一合法接收上游 Key 的入口，应绕开会记录 body 的通用中间件（idempotency 存储 / 请求日志 / payload 守卫）。
- **调用路由 = 创建时快照（pin）**：任务创建时把当时生效的凭据**槽位主键**记进任务记录（如 `upstream_credential_id`），之后该任务的全部上游调用（SSE / newTask / askResponse / 取消 / 产物下载 / 文件上传 / 恢复 / 子任务）都按此快照路由。上游 task 存活在创建时所用凭据的账号下，事后换绑**不迁移**既有 task。
- **吊销 fail-closed**：凭据吊销后，pin 到它的任务的**业务**上游调用必须硬失败（**绝不静默回落**共享默认凭据——那会把企业租户的任务数据错发进共享账号，是隔离红线）；新任务回落默认凭据。唯一例外是**清理路径**（取消 / 超时止损）：可用已吊销凭据做最后一次 best-effort `cancelTask`（止损失控任务），彻底不可达时降级本地取消并审计记 `upstreamSkipped`，否则任务会永久卡在 active。
- **自定义 Base URL（私有化部署）的 SSRF 防线**：允许租户填自定义 Base URL 时，**主控是运维 origin allowlist**（按 scheme+host+**port** 精确匹配，默认空 = 只允许平台默认 origin），它关闭"任意注册用户在自建工作区绑定任意域名 → 解析到内网"的整条链，也杜绝同 host 换端口把 Bearer 发到旁路服务；allowlist 要在**绑定时和每次出站解析时都复核**（运维撤下 host 后存量凭据 fail-closed）。上游 client 所有请求设 `redirect: "error"`（防 allowlist 内 host 的 open-redirect 转投 Key）。结构级过滤（https-only、拒内网/环回/元数据/组播/site-local/IPv4-mapped/ULA/CGNAT 字面量）作为纵深第二道，不是唯一控制。
- **敏感场景解锁**：未绑定独立凭据的工作区，敏感任务（如把任务数据送第三方对抗复核）应保持受限；绑定自有凭据后可解锁——上游隔离已由租户自有账号提供。
- **审计**：绑定 / 轮换 / 吊销都落审计（只记指纹与元数据）。

## 服务端必须托管的状态

后端至少落库（不要只放内存，刷新/重启会丢）。下面是一张可直接照搬的"业务任务 ↔ InfiniSynapse 任务"映射表——`docs/proposals/` 的两个产品（求职、项目调研）独立收敛出几乎一致的结构：

| 字段 | 说明 |
| --- | --- |
| `id` | 自有业务任务 ID（主键） |
| `user_id` | 业务用户 ID |
| `task_kind` | 业务任务类型（如 `job_analysis` / `deep_research`） |
| `infini_task_id` | InfiniSynapse `taskId` |
| `infini_conn_id` | InfiniSynapse `connId` |
| `upstream_credential_id` | 多租户隔离时：创建时 pin 的工作区凭据槽（缺省=平台默认 Key；吊销后 fail-closed，见"多租户上游隔离"节） |
| `status` | `queued`/`planning`/`waiting_user`/`running`/`completed`/`failed`/`cancelled` |
| `input_json` / `input_hash` | 用户输入快照 + 去重/复用哈希 |
| `uploaded_files` | 本地文件 ↔ sandbox/workspace 路径映射 |
| `workspace_snapshot` | 完成时的 workspace 文件索引 |
| `final_artifacts` | 最终产物路径；成熟产品建议同时保存 provider path、自有 storage key、checksum，以及可选 archive manifest key |
| `plan_audit` | plan/act 审批场景的计划文本、`plan_requested_at`、`plan_approved_at`、`act_sent_at` 或等价字段 |
| `export_status` | `private`/`approved_for_export`/`exported`；业务产品默认发布脱敏副本，不直接公开原始 task（见 [task-sharing.md](task-sharing.md)） |
| `saved_to_rag` | 是否经用户或 Reviewer 批准后 `saveToRag` |
| `error_message` | 错误信息 |

这样刷新页面后能用 `getUiMessageById` + `getTaskWorkspace` 恢复（见 `docs/reference/task-lifecycle.md` 恢复设计）。`samples/templates/server-side-agent-flow.md` 是同一映射的最小骨架版。

## 决策表：什么放服务端，什么能给前端

![安全接入信任边界图：前端只持业务数据，后端持有 API Key 并代理，前端直连 InfiniSynapse 是反模式](assets/secure-integration-trust-boundary.svg)

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| InfiniSynapse API Key | 仅服务端 | 绝不下发 |
| LLM provider API Key | 仅服务端 | 只给轻量 `LlmGateway` 使用，不进前端 bundle |
| `taskId` / `connId` | 服务端落库；可映射成你自己的业务 ID 给前端 | 前端用业务 ID 调你的路由，不直接拿去调 InfiniSynapse |
| SSE 进度 | 服务端消费后转发给前端 | 便于鉴权、限流、审计、恢复 |
| workspace 产物 | 服务端下载后按需透传；关键交付物可归档到自有 artifact store | 下载是二进制，别当 JSON（`INF-DL-001`） |
| 业务结论/展示文本 | 可给前端 | 这是产品输出 |

单用户桌面 / 原生 BYOK 可把表中的"服务端"替换为"本机可信主进程 / 原生层"；多租户、团队共享 Key、企业审计和后台通知场景不能替换。

## 推荐流程（最小安全骨架）

1. 前端把业务表单提交到**你的后端路由**（带你自己的鉴权）。
2. 后端生成 `connId`（需恢复/轮询时也生成 `taskId`），落一条 pending 业务记录。
3. 后端**先连** `GET /api/ai/events?connId=`，**再发** `POST /api/ai/message`(`newTask`)。
4. 后端把 SSE 转成前端可见的进度/结构化结果（不透传原始 Key 相关信息）。
5. Agent 请求上传时，后端 `POST /api/ai/upload?taskId=`，再 `askResponse` 回传。
6. 完成后后端读 `getTaskWorkspace` + `downloadTaskFile`，落库产物路径；正式产品的关键交付物复制到自有 artifact store，成熟产品可写入 archive manifest 后再按权限透传给前端（见 [artifact-archiving.md](artifact-archiving.md)）。
7. 用户中止 → 后端调用 `/api/ai/message` `type=cancelTask`，并在业务库标记状态。
8. 后端设置业务总超时/调用预算；超时或失败时先 `cancelTask`，再尝试用 `getTaskWorkspace` 恢复已有产物并按 schema 校验，避免任务继续消耗或丢失可用结果。

两段式审批场景里，后端在 plan 完成后可以暂停消费进入 `waiting_user`；用户 approve 后、发送 `togglePlanActMode`/`askResponse` 前，需要重新建立或确认 SSE consumer，继续由后端消费 act 阶段事件。

可直接抄 `samples/sdk/typescript/examples/express-proxy.ts`（含上述全部）。

## 常见反模式

- 前端 `fetch("https://app.infinisynapse.cn/api/ai/message", { headers:{ Authorization:`Bearer ${KEY}` }})`——Key 进 bundle。
- Electron renderer / WebView 直连 InfiniSynapse，或 preload 暴露 `getApiKey()`。
- 把 Key 写进 `NEXT_PUBLIC_*` / 移动端配置 / 客户端可读的任何位置。
- 在日志/错误上报里打印完整 token。
- 只在内存存 `taskId`/`connId`，重启或多实例后无法恢复。
- 没有业务总超时和取消策略，Agent 在长文件截断/补写循环里持续消耗调用。
- 含上传材料的业务任务直接 `setShare` 公开；如果只想公开部分报告，应走自有脱敏导出。
- 只把最终文件留在 provider workspace，不做自有归档，却把它当成产品历史下载和合规留存的唯一来源。
- 私有化部署把 `AUTHING_SERVER_URL` 配错导致登录失败（见 `troubleshooting.md`、`INF-ENV-*`）。

## 检查清单

- API Key 是否只在服务端、且来自密钥管理而非硬编码？
- 前端是否只和你自己的后端通信，从不直连 InfiniSynapse？
- `taskId`/`connId`/上传映射/产物路径是否落库（可恢复）？
- plan/act 场景下 `waiting_user` 是否落库并参与并发限制、取消和恢复？
- 是否先连 SSE 再发 `newTask`？
- 下载是否按二进制处理？
- 关键交付物是否已按业务权限归档到自有 artifact store？
- 分享状态是否区分"原始 task public"和"自有脱敏 export"？
- 日志是否屏蔽了 token / 数据库密码 / Mongo URI / Redis 密码 / JWT secret？
- 跑过 `npm run scan -- <file>`，无 `INF-SEC-*` 命中？
