# CLAUDE.md · InfiniSynapse AI Workspace

通用规范以 `AGENTS.md` 为准（冲突时以 AGENTS.md 优先）。本文件补充 Claude Code 专属入口与硬约束速览。

## 内容定位

本仓库按两个维度维护内容：

- AI 友好 / 人类友好。
- 官方文档内容 / 特定用法内容。

Claude 写规则或方案时，先判断内容属于哪类：官方事实放 `upstream-docs/` 或 `docs/reference/`；核心场景里的默认选择、顺序、风险边界才写入 skills、quick reference、templates 或 playbooks。完整模型见 `docs/CONTENT-MODEL.md`，文档导航见 `docs/README.md`。

## 0. 硬约束速览（最高优先级）

写 InfiniSynapse 相关代码/配置时默认遵守，违反这些是高风险：

- **API Key 只在服务端**：不进前端 bundle、移动端、截图、公开仓库。产品默认后端代理架构。
- **先做 LLM 路由**：非 agentic 的一问一答、摘要、改写、分类、抽取、轻量评分默认直连 LLM；agentic 长任务、工具使用、Browser Use 和 workspace 产物默认走 InfiniSynapse。
- **先连 SSE 再发任务**：先 `GET /api/ai/events?connId=`，再 `POST /api/ai/message`（`newTask`）。
- **产物读工作区**：完成后用 `getTaskWorkspace` / `previewFile` / `downloadTaskFile`，不要只读最后一条文本。
- **下载是二进制**：`downloadTaskFile` / `downloadZip` / `storage/download` 返回流，不要按 `{code,message,data}` 解析。
- **区分两类上传**：`/api/ai/upload`（响应 Agent）vs `/api/tools/taskUpload`（主动归档）。
- **RAG 文件别放本机路径**：短期资料放 `task workspace/upload_documents`；长期 RAG 资料放 InfiniSynapse 可访问的 RAG `docDir` 或 OSS/S3。SaaS 不能读取本机 `/Users/...`。
- **不编造端点**：不在 `docs/reference/api-index.md` 或上游文档里的端点，先 `rg` 搜 `upstream-docs/infinisynapse-site/zh/markdown/`。
- **私有化部署**：`AUTHING_SERVER_URL` 变量名/浏览器可达/裸 `/api`/无尾斜杠 四条都要满足。

## 启动后先读

1. `AGENTS.md`
2. `docs/CONTENT-MODEL.md`（判断内容应放在官方事实还是特定用法）
3. `docs/README.md`（定位人类文档、reference、playbooks）
4. 涉及文档维护或上游同步时读 `docs/MAINTENANCE.md`
5. `docs/reference/`：`capabilities.md`（能力总览）、`api-index.md`（端点）、`task-lifecycle.md`（SSE 时序）、`glossary.md`（术语）
6. 用户任务对应的 `.claude/skills/*/SKILL.md`
7. 对应场景读 `docs/playbooks/`：LLM 调用路由、安全接入、RAG/文件放置、市场订阅、Browser Use、任务分享、排查

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
- 写产品 AI 调用方案时，默认按工作负载分流：轻量非 agentic 调用走自有后端 `LlmGateway`，agentic 长任务走 InfiniSynapse。直连 LLM 仍然必须服务端持有 provider key。
- 写长任务代码时，默认先连 SSE，再发 `newTask`。
- 写 RAG / 文件方案时，必须区分 task workspace、sandbox、RAG `docDir`、OSS/S3、数据源上传，不能把 SaaS RAG 写成本机目录；详细规则见 `docs/playbooks/rag-file-placement.md`。
- 写私有化部署说明时，必须检查 `AUTHING_SERVER_URL` 的四条规则。
- 维护文档、同步上游或新增 playbook/reference 时，按 `docs/MAINTENANCE.md` 的影响判断表更新。
- 改完跑 `bash tools/doctor.sh` 和 `npm test`；改了 skill 跑 `bash tools/sync-skills.sh`。
