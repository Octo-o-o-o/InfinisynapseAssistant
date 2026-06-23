# AGENTS.md · InfiniSynapse 开发助手通用规范

本文件是所有 AI 编码助手在本工作区里的单一通用入口。写 InfiniSynapse 相关代码、部署脚本、SDK、后端业务路由、mini-app、CLI 集成或故障排查时，先读本文件，再按场景读取对应 skill。

## 内容模型

本仓库同时服务 AI 和人类，也同时保存官方事实和特定用法。维护时按两个维度判断内容归属：

- **AI 友好内容**：入口、读取顺序、硬约束、skills、API 索引、SDK 示例。
- **人类友好内容**：README、使用指南、速查、方案、审计和解释性文档。
- **官方文档内容**：`upstream-docs/` 原始快照，以及从官方文档提炼的 `docs/reference/`。
- **特定用法内容**：基于官方事实，对核心场景给出的决策、顺序、边界和默认做法。

一份文件可以属于多个类型。新增规则前先判断：如果官方文档已经清楚回答，就引用官方/`docs/reference/`；只有当核心场景需要跨章节总结、默认选择或风险边界时，才新增特定用法。完整维护规则见 `docs/CONTENT-MODEL.md`，文档导航见 `docs/README.md`。

## 0. Skills 触发索引

Codex 默认读 `.agents/skills/`，Claude Code 默认读 `.claude/skills/`。触发规则:

| 用户场景 | skill | 必读上游文档 |
| --- | --- | --- |
| 私有化部署、Docker Compose、`.env`、登录失败、OOM、端口冲突 | `infinisynapse-deployment` | `zh/markdown/private-deployment-guide.md` |
| 直接调 HTTP API、写 SDK、SSE、任务、数据源、RAG、文件上传/下载 | `infinisynapse-server-api` | `zh/markdown/server-api-reference.md` |
| 使用或复刻 `agent_infini` CLI、排查 CLI 网络请求 | `infinisynapse-cli` | `zh/markdown/cli-api-reference.md` |
| 设计高考助手、购物比价、报告写作等任务型产品 | `infinisynapse-product-patterns` | `zh/markdown/server-api-reference.md` 第 10 节 |
| Browser Use / Chrome 插件安装、购物或网页自动化产品 | `infinisynapse-browser-extension` | `zh/markdown/chrome-plugin-install.md` |

## 1. 文档优先级

1. `docs/reference/api-index.md`（端点总目录）、`docs/reference/task-lifecycle.md`（SSE/任务时序）— 从上游提炼的单一事实基准，先看这两份定位
2. `upstream-docs/infinisynapse-site/zh/markdown/` 的中文 SaaS 文档快照 — 详细原文
3. `upstream-docs/infinisynapse-site/markdown/` 的英文补充快照
4. `docs/playbooks/` — RAG/文件放置等核心场景的特定用法
5. `upstream-src/infini_docker/`，仅当源码成功补齐后可用
6. 官方网页: `https://www.infinisynapse.cn/zh/docs`
7. 网络搜索，仅用于确认官方内容是否更新

写集成代码时，可直接参考/复制 `samples/sdk/`（TypeScript / Python 零依赖参考实现）和 `samples/templates/curl-quickstart.md`。

如果用户问“最新”“现在”“今天”，先运行或建议运行 `bash tools/sync-upstream-docs.sh`，再基于本地快照作答。

## 2. 不要编造接口

- 不确定 endpoint、method、body 字段时，必须先 `rg` 搜本地 Markdown。
- 当前 Server API 的全局路径前缀是 `/api`。
- 默认中国大陆 Base URL 是 `https://app.infinisynapse.cn`，海外是 `https://app.infinisynapse.com`。
- 私有化部署时 Base URL 替换为自有服务地址。
- 业务接口默认需要 `Authorization: Bearer <API Key>`。
- 主应用请求可带 `x-lang`，默认 `zh_CN`。
- SaaS API Key 在 `https://app.infinisynapse.cn/tasks` 左下角设置菜单的 **API Key Management** 里创建和查看。
- `https://app.infinisynapse.cn/tasks` 也是开发者后台: Server API 创建的任务会出现在 **ALL TASKS**，可回看状态、消息、执行过程和工作区产物。
- 默认计算资源是 `public-engine`；需要稳定配额、隔离或独占环境时，使用右上角资源菜单创建并切换独占计算资源。

## 3. 安全硬约束

- 不要把 API Key 写进浏览器、前端 bundle、移动端包或截图。
- 产品集成优先做 server-side business route: 前端只调自家后端，自家后端持有 API Key 并代理 InfiniSynapse。
- SaaS API Key 泄露后，应在 **API Key Management** 删除旧 Key 并重新创建。
- 日志里不要输出完整 token、数据库密码、Mongo URI、Redis 密码、JWT secret。
- 文档里的示例密码只能用于识别字段，不能作为生产默认值。

## 4. Server API 长任务铁律

开发长任务产品时，默认流程是:

1. 生成 `connId`，需要恢复或轮询时同时预生成 `taskId`。
2. 先建立 `GET /api/ai/events?connId=<uuid>` SSE 连接。
3. 再调用 `POST /api/ai/message`，`type=newTask`，带同一个 `connId`。
4. 从 SSE 的 `message.partial` / `message.add` / `notification` 推进状态。
5. 若收到 `message.ask=upload_file_to_sandbox`，先上传文件，再用 `type=askResponse` 继续。
6. 结束后通过 `getTaskWorkspace`、`previewFile`、`downloadTaskFile` 读取产物，不要只依赖最后一条文本。

## 5. 文件上传和产物下载

- `/api/ai/upload?taskId=`: 响应 Agent 的 sandbox 文件请求。
- `/api/tools/taskUpload/:taskId?subdir=...&naming=...`: 产品主动把资料归档到 task workspace。
- `/api/ai_task/getTaskWorkspace/:id`: 枚举 workspace 文件。
- `/api/ai_task/previewFile`: 预览可读文件。
- `/api/tools/storage/downloadTaskFile/:taskId?path=`: 下载 task 文件。需要浏览器内联显示图片/PDF 时可用 `inline=1`。

### RAG 与文件放置

这属于特定用法总结，来源是 Server API 的任务工作区、文件上传、RAG 和数据源章节：

- 短期任务资料放当前任务 workspace，推荐 `POST /api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original`。
- Agent 主动请求文件时，才用 `/api/ai/upload?taskId=` 上传到 sandbox，并用 `askResponse` 继续。
- 长期 RAG 资料放 InfiniSynapse 可访问的 RAG `docDir`，或 OSS/S3/file 后端；SaaS 不能读取开发者本机 `/Users/...` 路径。
- 结构化表格/数据可临时放 task workspace，也可通过 `/api/ai_database/upload/:databaseId` 进入数据源。
- RAG / 数据源必须在 `newTask` 前 list + enabled，否则 Agent 看不到。

详细决策表见 `docs/playbooks/rag-file-placement.md`。

## 6. 私有化部署铁律

- `AUTHING_SERVER_URL` 变量名必须完整，不能写成 `AUTH_SERVER_URL`。
- `AUTHING_SERVER_URL` 必须浏览器可访问，不能使用容器名或 `127.0.0.1`。
- 默认端口是 `3000`，路径是 `/api`，不要带尾部 `/`。
- 对外端口要覆盖 `8088` 主应用、`80` 管理台、`3000` auth API。
- `infini-synapse-mysql-migrate` 显示 `Exited (0)` 是正常的一次性迁移任务。
- 低于 32 GB 内存的主机要主动降低 InfiniSQL 内存配置。

## 7. 浏览器插件

Browser Use 不是所有产品都需要。表单生成报告、后端批量分析通常不需要 Chrome 插件；购物比价、网页调研、需要 AI 操作用户浏览器的产品才需要检查 `/api/ai_browser/session` 并引导安装插件。

## 8. 实时护栏（扫描器）

仓库自带 InfiniSynapse 专属反模式扫描器 `tools/hooks/lib/scan-infinisynapse.sh`，Claude Code 通过 `.claude/settings.json` 的 PostToolUse 钩子在每次 Edit/Write 后自动运行；也可手动 `npm run scan -- <file>`。

命中 HIGH 级（退出码 2）说明改动有高风险，应当场修：

| 规则 | 级别 | 含义 |
| --- | --- | --- |
| `INF-SEC-001` | HIGH | 硬编码 Bearer token |
| `INF-SEC-002` | HIGH | 前端文件直连 InfiniSynapse（API Key 会进 bundle） |
| `INF-SSE-001` | MEDIUM | 发 `newTask` 但本文件未先连 `/api/ai/events` |
| `INF-DL-001` | MEDIUM | 把下载端点当 JSON 解析 |
| `INF-ENV-001/002/003` | HIGH/MEDIUM | `AUTHING_SERVER_URL` 变量名/取值/路径错误 |

扫描结果也会写到 `.claude/.infinisynapse-last-scan.txt`，下一轮可读。

## 9. 可跑 SDK 与参考

| 需求 | 看这里 |
| --- | --- |
| 平台能做什么（能力→端点） | `docs/reference/capabilities.md` |
| 端点/方法/字段定位 | `docs/reference/api-index.md` |
| SSE 事件 / 消息类型 / 完整时序 / 恢复 | `docs/reference/task-lifecycle.md` |
| RAG / 文件放哪里 | `docs/playbooks/rag-file-placement.md` |
| 报错 / 部署登录失败排查 | `docs/playbooks/troubleshooting.md` |
| TypeScript 集成（client + SSE + runTask + 代理） | `samples/sdk/typescript/` |
| Python 集成 | `samples/sdk/python/` |
| 不写代码先 curl 验证 | `samples/templates/curl-quickstart.md` |

## 10. 改完后验证

```bash
bash tools/doctor.sh
npm test               # 扫描器 fixtures + SDK 离线单测 + skill 镜像一致
```

改了 skill（唯一源是 `.agents/skills/`）后同步镜像:

```bash
bash tools/sync-skills.sh          # .agents/skills → .claude/skills
bash tools/sync-skills.sh --check  # 校验一致
```

如果涉及上游文档更新:

```bash
bash tools/sync-upstream-docs.sh
git diff -- upstream-docs/
```
