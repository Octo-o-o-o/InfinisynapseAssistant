# 安全接入 Playbook

> 特定用法总结：把"基于 InfiniSynapse 开发产品时如何不泄露 API Key、如何托管状态、如何设计恢复"合并成一套默认决策与清单。
> 硬约束原文见 `AGENTS.md` 第 3 节；可跑骨架见 `samples/templates/server-side-agent-flow.md` 与 `samples/sdk/`；端点见 `docs/reference/api-index.md`。

## 一句话规则

API Key 只在服务端；前端只和你的后端通信，由后端持有 Key 并代理 InfiniSynapse。前端永远拿不到 InfiniSynapse 的 Key。

## 默认架构

```text
前端 / mini-app  →  你的后端（持有 API Key、组装 prompt、转发文件、读产物）  →  InfiniSynapse Server API
```

不要让前端、移动端、桌面端直接调 `app.infinisynapse.cn/api/...`——那等于把 Key 打进可被用户拿到的产物。对应扫描规则 `INF-SEC-001`（硬编码 Bearer）、`INF-SEC-002`（前端直连）。

## API Key 生命周期

| 阶段 | 做法 |
| --- | --- |
| 创建 | 在 `https://app.infinisynapse.cn/tasks` 左下角设置 → **API Key Management** → Create |
| 存储 | 放服务端环境变量或密钥管理系统（KMS / Secrets Manager / Vault），不进代码仓库、不进前端 bundle、不进日志 |
| 使用 | 仅服务端请求带 `Authorization: Bearer <key>`；前端调你自己的业务路由 |
| 轮换 | 定期在 API Key Management 新建并切换；旧 Key 停用 |
| 泄露处理 | 立即在 API Key Management 删除旧 Key 并重建；排查泄露路径（前端/日志/仓库/截图） |

## 服务端必须托管的状态

后端至少落库（不要只放内存，刷新/重启会丢）：

- 业务用户 ID、`taskId`、`connId`
- 用户输入、上传文件映射（本地文件 ↔ sandbox/workspace 路径）
- 当前状态、最终 workspace 产物路径、错误信息

这样刷新页面后能用 `getUiMessageById` + `getTaskWorkspace` 恢复（见 `docs/reference/task-lifecycle.md` 恢复设计）。

## 决策表：什么放服务端，什么能给前端

![安全接入信任边界图：前端只持业务数据，后端持有 API Key 并代理，前端直连 InfiniSynapse 是反模式](assets/secure-integration-trust-boundary.svg)

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| InfiniSynapse API Key | 仅服务端 | 绝不下发 |
| `taskId` / `connId` | 服务端落库；可映射成你自己的业务 ID 给前端 | 前端用业务 ID 调你的路由，不直接拿去调 InfiniSynapse |
| SSE 进度 | 服务端消费后转发给前端 | 便于鉴权、限流、审计、恢复 |
| workspace 产物 | 服务端下载后按需透传 | 下载是二进制，别当 JSON（`INF-DL-001`） |
| 业务结论/展示文本 | 可给前端 | 这是产品输出 |

## 推荐流程（最小安全骨架）

1. 前端把业务表单提交到**你的后端路由**（带你自己的鉴权）。
2. 后端生成 `connId`（需恢复/轮询时也生成 `taskId`），落一条 pending 业务记录。
3. 后端**先连** `GET /api/ai/events?connId=`，**再发** `POST /api/ai/message`(`newTask`)。
4. 后端把 SSE 转成前端可见的进度/结构化结果（不透传原始 Key 相关信息）。
5. Agent 请求上传时，后端 `POST /api/ai/upload?taskId=`，再 `askResponse` 回传。
6. 完成后后端读 `getTaskWorkspace` + `downloadTaskFile`，落库产物路径，按需透传给前端。
7. 用户中止 → `cancelTask`，并在业务库标记状态。

可直接抄 `samples/sdk/typescript/examples/express-proxy.ts`（含上述全部）。

## 常见反模式

- 前端 `fetch("https://app.infinisynapse.cn/api/ai/message", { headers:{ Authorization:`Bearer ${KEY}` }})`——Key 进 bundle。
- 把 Key 写进 `NEXT_PUBLIC_*` / 移动端配置 / 客户端可读的任何位置。
- 在日志/错误上报里打印完整 token。
- 只在内存存 `taskId`/`connId`，重启或多实例后无法恢复。
- 私有化部署把 `AUTHING_SERVER_URL` 配错导致登录失败（见 `troubleshooting.md`、`INF-ENV-*`）。

## 检查清单

- API Key 是否只在服务端、且来自密钥管理而非硬编码？
- 前端是否只和你自己的后端通信，从不直连 InfiniSynapse？
- `taskId`/`connId`/上传映射/产物路径是否落库（可恢复）？
- 是否先连 SSE 再发 `newTask`？
- 下载是否按二进制处理？
- 日志是否屏蔽了 token / 数据库密码 / Mongo URI / Redis 密码 / JWT secret？
- 跑过 `npm run scan -- <file>`，无 `INF-SEC-*` 命中？
