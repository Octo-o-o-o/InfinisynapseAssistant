# 使用指南

## 应该用 npm 还是添加 skill

结论：这个仓库的主使用方式是**AI 规则包 / skills**，不是 npm 依赖。

| 方式 | 适合什么 | 是否推荐 |
| --- | --- | --- |
| 让 AI 读取 `AGENTS.md` + 对应 skill | 日常开发、方案设计、老项目接入、新项目起步 | 推荐，默认方式 |
| 把 `.agents/skills/infinisynapse-*` 加到 AI 工具的 skills 目录 | 需要 AI 自动按任务触发 InfiniSynapse 规则 | 推荐，长期使用时最稳 |
| 把本仓库作为 git submodule / vendor 目录 | 团队项目、长期业务项目、多人协作 | 推荐 |
| 复制 `samples/sdk/` 到业务后端 | 需要可跑 TS/Python 参考实现 | 推荐，但要内化为自己的服务端代码 |
| `npm install` 本仓库 | 把它当运行时 SDK 包 | 不推荐；当前未发布为 npm SDK |

`npm` 在本仓库里的作用是维护和验证：

```bash
npm test
npm run scan -- path/to/file
```

它不是业务项目集成 InfiniSynapse 的主要入口。业务项目需要代码时，优先复制或改造 `samples/sdk/typescript/`、`samples/sdk/python/`；业务项目需要规则时，优先让 AI 读取本仓库或安装/copy skills。

## 首次检查

```bash
bash tools/doctor.sh
npm test
```

如果本地安装了 `pandoc`，可以刷新公开文档镜像：

```bash
bash tools/sync-upstream-docs.sh
```

## 让 AI 助手基于 InfiniSynapse 开发

推荐提示词：

```text
请把这个工作区当作 InfiniSynapse 规则包使用。先读 AGENTS.md，再根据任务读取相关 skill。
我要实现一个服务端 route：创建长任务报告、把进度流式返回给前端、按需上传资料，并下载最终 PDF。
```

AI 应该读取：

- `AGENTS.md`
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- `.agents/skills/infinisynapse-product-patterns/SKILL.md`
- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md`

## 三种接入形态

### 1. 临时外部规则包

适合一次性方案、快速接入、还不想改业务仓库结构时使用。

在业务项目里对 AI 说：

```text
当前业务项目要接入 InfiniSynapse。请把
/Users/wangyixiao/WorkSpace/InfinisynapseAssistant
作为外部规则包。

先读它的 AGENTS.md、docs/USAGE-GUIDE.md，再按任务读取相关 skill。
除非 docs/reference 或 upstream-docs 里有明确 endpoint，否则不要编造 API。
```

优点是无侵入；缺点是每次都要提醒 AI 读取外部路径。

### 2. 长期放进业务项目

适合老项目或团队项目。推荐把本仓库作为子模块或 vendor 目录，例如：

```text
vendor/InfinisynapseAssistant/
```

然后在业务项目自己的 `AGENTS.md` 或 `CLAUDE.md` 加一段固定规则：

```text
本项目依赖 InfiniSynapse。涉及 InfiniSynapse API、SSE、RAG、Browser Use、
文件上传下载、私有化部署时，先读 vendor/InfinisynapseAssistant/AGENTS.md，
再读对应 skill 和中文 SaaS 文档。
```

如果 AI 工具支持 skills，把 `vendor/InfinisynapseAssistant/.agents/skills/infinisynapse-*` 复制或同步到该工具的 skills 目录。这样 AI 可以按“Server API / 产品模式 / 部署 / CLI / Browser Use”自动触发更小的规则集。

### 2.1 具体怎么添加 skill

按使用范围选择一种即可：

| 范围 | 做法 | 适合 |
| --- | --- | --- |
| 只在本仓库开发 | 直接打开本仓库，使用 `.agents/skills/` | 维护规则包、写方案 |
| 所有项目都可用 | 复制 `infinisynapse-*` 到全局 skills 目录 | 个人长期使用 |
| 某个业务项目可用 | 复制到业务项目自己的 `.agents/skills/` | 团队项目、随仓库分发 |
| Claude Code | 先用 `tools/sync-skills.sh` 生成 `.claude/skills/`，再复制对应目录 | Claude Code 项目 |

示例：

```bash
# 全局安装到当前用户的 agents skills
mkdir -p ~/.agents/skills
cp -R /Users/wangyixiao/WorkSpace/InfinisynapseAssistant/.agents/skills/infinisynapse-* ~/.agents/skills/

# 安装到某个业务项目
mkdir -p /path/to/your-app/.agents/skills
cp -R /Users/wangyixiao/WorkSpace/InfinisynapseAssistant/.agents/skills/infinisynapse-* /path/to/your-app/.agents/skills/

# Claude Code 项目
cd /Users/wangyixiao/WorkSpace/InfinisynapseAssistant
bash tools/sync-skills.sh
mkdir -p /path/to/your-app/.claude/skills
cp -R .claude/skills/infinisynapse-* /path/to/your-app/.claude/skills/
```

复制 skill 之后，业务项目仍应在自己的 `AGENTS.md` 或 `CLAUDE.md` 写明：遇到 InfiniSynapse 相关任务时，先读本规则包或已复制的 skill，再查中文 SaaS 文档。

### 3. 只拿 SDK / 扫描器

适合已经有清晰规则，只缺可跑参考代码或护栏时使用。

- TypeScript 后端：复制 `samples/sdk/typescript/` 中的 client、SSE、runTask 和代理示例。
- Python 后端：复制 `samples/sdk/python/`。
- 代码扫描：在业务项目 pre-commit 或 CI 中调用本仓库的 `tools/hooks/lib/scan-infinisynapse.sh`。
- 反哺检查：在业务项目增加 `feedback:check` / `precommit:check`，提交前判断是否有通用经验需要回写本仓库。

扫描器可以直接跨项目调用：

```bash
bash /Users/wangyixiao/WorkSpace/InfinisynapseAssistant/tools/hooks/lib/scan-infinisynapse.sh path/to/your/file.ts
```

不要把这些代码直接放到前端。InfiniSynapse API Key 必须只在服务端。

下游项目的固定规则、脚本和反哺流程见 `docs/playbooks/downstream-projects.md`。

## 新项目开发流程

新项目应先决定 InfiniSynapse 的角色，再写代码。默认流程：

1. **定义产品类型**：报告生成、网页研究、RAG 问答、数据分析、任务分享，或混合模式。
2. **先做 LLM 路由**：非 agentic 的一问一答、摘要、改写、分类、抽取、轻量评分默认直连 LLM；agentic 的深度调研、长任务、工具使用、Browser Use 和 workspace 产物默认走 InfiniSynapse。即使新项目还没有自有大模型调用层，也建议先做最小 server-side `LlmGateway`（见 `docs/playbooks/llm-routing.md`）。
3. **选择 InfiniSynapse 能力**：先读 `docs/reference/capabilities.md`，判断需要长任务、Browser Use、RAG、数据源、市场订阅、任务分享中的哪些。
4. **确定接入形态**：临时外部规则包、子模块/vendor、还是复制 SDK。
5. **设计后端代理**：前端只调用自家后端；后端持有 LLM provider key 和 InfiniSynapse API Key，保存 `taskId`、`connId`、上传映射、workspace 产物路径。
6. **先跑 curl spike**：用 `samples/templates/curl-quickstart.md` 验证 Key、SSE 和任务产物读取。
7. **内化 SDK 骨架**：把 `samples/sdk/` 改造成业务后端服务，不让前端直连 InfiniSynapse。
8. **实现最小长任务闭环**：建业务任务行 → 先连 SSE → `newTask` → 处理 `askResponse` → `completion_result` → 读取 workspace。
9. **按需接 playbook**：LLM 路由、安全接入、RAG 文件放置、Browser Use、市场订阅、任务分享、排查。
10. **加护栏**：运行 `npm run scan -- <file>`，或把扫描器接入业务项目 pre-commit/CI。
11. **再做产品增强**：恢复、取消、ZIP 导出、分享、RAG 保存、多版本回滚。

如果你说“做 InfiniSynapse 上的应用”，当前公开文档里可依赖的是 Server API、SSE、任务工作区、Browser Use、RAG/数据源和分享能力；不要假设存在未公开的插件打包或应用商店发布 API。除非上游文档新增明确接口，否则仍按“自有后端 + InfiniSynapse Server API”的产品架构实现。

## 老项目接入流程

老项目不要一上来重写。推荐按风险从外到内接入：

1. **先加规则入口**：在老项目提示 AI 读取本仓库，或把本仓库放入 `vendor/` 并在老项目 `AGENTS.md` 里固定引用。
2. **做接入审计**：查是否有前端直连 `app.infinisynapse.*`、硬编码 Bearer、下载当 JSON、先发任务后连 SSE。
3. **加后端适配层**：新增 `InfiniSynapseService` / `AgentTaskService`，统一封装 Base URL、鉴权、SSE、上传、下载、错误处理。
4. **映射现有模型**：把老项目的业务任务、用户、文件、报告、状态映射到 `taskId`、`connId`、workspace 文件和业务状态。
5. **先接一个低风险功能**：例如“单次报告生成”或“单岗位分析”，不要先迁移所有流程。
6. **迁移文件策略**：单次资料走 task workspace；长期知识走 RAG 可访问目录或 OSS/S3；SaaS 不读本机路径。
7. **按需接 Browser Use**：只有网页操作/用户浏览器上下文场景才接，不要给普通报告功能强加插件。
8. **补恢复和取消**：老项目最容易漏的是刷新恢复、任务取消、产物重新读取。
9. **加扫描器到 CI**：把 `tools/hooks/examples/github-action-scan.yml` 或 `codex-precommit.sh` 接入老项目。
10. **逐步替换旧逻辑**：确认一个业务流稳定后，再扩到 RAG、分享、ZIP、多轮修订。

老项目里最值得优先修的是安全和时序：API Key 服务端化、先连 SSE 再发 `newTask`、二进制下载按流处理、完成后读 workspace。

如果老项目已经有用户体系、权限、队列、会员/计费、业务 RAG 或自研短链路 AI，先读 `docs/playbooks/existing-product-integration.md` 和 `docs/playbooks/llm-routing.md`。默认不要替换这些核心系统，而是把 InfiniSynapse 接成可灰度、可恢复、可取消、可审计的长任务 Agent 层。

## 相比直接引用原始文档的优势

原始文档适合人工查阅，但对 AI 来说缺少任务入口、优先级和安全边界。本项目把这些内容整理成 AI 能直接执行的规则：

- `AGENTS.md`、`CLAUDE.md`、`llms.txt` 负责告诉 AI 从哪里开始读。
- skills 负责把部署、Server API、CLI、产品模式、浏览器插件分流。
- 规则文件把 API Key、SSE 顺序、workspace 产物、上传方式等高风险点前置。
- `docs/QUICK-REFERENCE.md` 提供高信号速查，减少每次全量翻文档。
- `tools/doctor.sh` 和 `npm test` 可以验证规则包是否完整。

因此，使用这个项目时，AI 不只是“看到了文档”，而是能按约束和流程使用文档。

## 常见任务

| 任务 | 优先读取 |
| --- | --- |
| 了解平台能做什么 | `docs/reference/capabilities.md` |
| 写 SDK 或后端 route | `infinisynapse-server-api` skill + `samples/sdk/` |
| 判断轻量调用直连 LLM 还是走 InfiniSynapse | `docs/playbooks/llm-routing.md` |
| 安全接入 / 不泄露 API Key | `docs/playbooks/secure-integration.md` |
| 成熟 SaaS / 老项目接入边界 | `docs/playbooks/existing-product-integration.md` |
| 决策包质量闭环 / Outcome 回访 / Watchlist delta / benchmark | `docs/playbooks/decision-quality-loop.md` |
| RAG 资料 / 文件放哪里 | `docs/playbooks/rag-file-placement.md` |
| 订阅共享数据源 / 知识库 | `docs/playbooks/market-subscriptions.md` |
| 浏览器自动化或购物比价 | `docs/playbooks/browser-use.md` + `infinisynapse-browser-extension` skill |
| 分享 / 公开只读结果页 | `docs/playbooks/task-sharing.md` |
| 做报告写作类产品 | `infinisynapse-product-patterns` skill |
| 使用 CLI endpoint | `infinisynapse-cli` skill |
| 私有化部署 | `infinisynapse-deployment` skill |
| 排查报错 / 部署登录失败 | `docs/playbooks/troubleshooting.md` |

## 开发姿态

- 优先使用 `upstream-docs/infinisynapse-site/zh/markdown/` 下的中文 SaaS 文档，再考虑网页搜索。
- 英文文档只作为中文文档未覆盖细节时的补充。
- 不要猜 endpoint 名称。
- API Key 必须保留在服务端。
- 发送 `newTask` 前先连接 SSE。
- 在业务数据库中保存 `taskId`、`connId`、上传映射和最终 workspace 路径。
- 二进制下载接口不要当作 JSON envelope 处理。
