# CLAUDE.md · InfiniSynapse AI Workspace

通用规范以 `AGENTS.md` 为准（冲突时以 AGENTS.md 优先）。本文件补充 Claude Code 专属入口与硬约束速览。

## 0. 硬约束速览（最高优先级）

写 InfiniSynapse 相关代码/配置时默认遵守，违反这些是高风险：

- **API Key 只在服务端**：不进前端 bundle、移动端、截图、公开仓库。产品默认后端代理架构。
- **先连 SSE 再发任务**：先 `GET /api/ai/events?connId=`，再 `POST /api/ai/message`（`newTask`）。
- **产物读工作区**：完成后用 `getTaskWorkspace` / `previewFile` / `downloadTaskFile`，不要只读最后一条文本。
- **下载是二进制**：`downloadTaskFile` / `downloadZip` / `storage/download` 返回流，不要按 `{code,message,data}` 解析。
- **区分两类上传**：`/api/ai/upload`（响应 Agent）vs `/api/tools/taskUpload`（主动归档）。
- **不编造端点**：不在 `docs/reference/api-index.md` 或上游文档里的端点，先 `rg` 搜 `upstream-docs/infinisynapse-site/zh/markdown/`。
- **私有化部署**：`AUTHING_SERVER_URL` 变量名/浏览器可达/裸 `/api`/无尾斜杠 四条都要满足。

## 启动后先读

1. `AGENTS.md`
2. `docs/reference/api-index.md` + `docs/reference/task-lifecycle.md`（定位端点与时序）
3. 用户任务对应的 `.claude/skills/*/SKILL.md`

## Skills

`.claude/skills/` 是 `.agents/skills/`（唯一源）的镜像，由 `tools/sync-skills.sh` 同步:

- `infinisynapse-server-api`
- `infinisynapse-product-patterns`
- `infinisynapse-deployment`
- `infinisynapse-cli`
- `infinisynapse-browser-extension`

## 实时护栏（PostToolUse 钩子）

`.claude/settings.json` 已接线：每次 Edit/Write 后自动跑 `tools/hooks/post-edit.sh` → `scan-infinisynapse.sh`，检测上面的硬约束。

- 命中 **HIGH**（退出码 2）会把违规反馈回来，应当场修。
- 结果写到 `.claude/.infinisynapse-last-scan.txt`，可主动读。
- 规则 ID：`INF-SEC-001/002`、`INF-SSE-001`、`INF-DL-001`、`INF-ENV-001/002/003`（详见 AGENTS.md 第 8 节）。

## 可跑参考

- TypeScript / Python SDK：`samples/sdk/`
- 纯 curl 验证：`samples/templates/curl-quickstart.md`

## 工作规则

- 回答 InfiniSynapse API 相关问题前，先 `rg` 搜 `upstream-docs/infinisynapse-site/zh/markdown/`，英文快照只作补充。
- 写产品集成方案时，默认采用后端代理 API Key 的架构。
- 写长任务代码时，默认先连 SSE，再发 `newTask`。
- 写私有化部署说明时，必须检查 `AUTHING_SERVER_URL` 的四条规则。
- 改完跑 `bash tools/doctor.sh` 和 `npm test`；改了 skill 跑 `bash tools/sync-skills.sh`。
