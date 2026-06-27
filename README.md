# InfiniSynapse Assistant

面向 Codex / Claude Code / Cursor / GitHub Copilot 等 AI 编码助手的 InfiniSynapse 规范助手工作区。

这个仓库不是 InfiniSynapse 本体，也不是业务应用模板。它的作用是把 InfiniSynapse 当前公开的中文 SaaS/API 文档、私有化部署文档、CLI API、Chrome Browser Use 插件文档，以及面向产品开发的调用模式沉淀成一套本地 AI 规则包。后续开发基于 InfiniSynapse 的应用时，让 AI 先读这个仓库，可以显著减少“重新翻文档”“凭训练数据猜接口”“把 API Key 写进前端”“SSE 顺序写错”等问题。

## 官方链接

- 官网：<https://www.infinisynapse.cn/>
- 中文文档：<https://www.infinisynapse.cn/zh/docs>
- 国内 SaaS 控制台：<https://app.infinisynapse.cn/tasks>
- 海外 SaaS：<https://app.infinisynapse.com>

## 为什么需要这个项目

InfiniSynapse 目前在公开训练语料里覆盖较少，AI 助手很容易在以下地方出错：

- 把 Server API endpoint、上传路径、下载路径写错。
- 不了解 SaaS API Key 在 `https://app.infinisynapse.cn/tasks` 的 **API Key Management** 里创建。
- 不知道 `/tasks` 同时也是开发者后台，API 创建的任务会出现在 **ALL TASKS**。
- 忘记先建立 `GET /api/ai/events?connId=...` SSE，再发送 `POST /api/ai/message`。
- 把 InfiniSynapse API Key 暴露在浏览器、移动端或公开仓库。
- 只读取 SSE 文本，忽略 `getTaskWorkspace`、`previewFile`、`downloadTaskFile` 里的最终产物。
- 混淆 `/api/ai/upload?taskId=` 和 `/api/tools/taskUpload/:taskId` 两类上传。
- 私有化部署时把 `AUTHING_SERVER_URL` 写成容器内地址、`127.0.0.1` 或错误变量名。

本仓库的目标就是让这些规则成为 AI 助手的默认上下文。

## 项目沉淀出的实际回报

从当前 `main` 的提交历史看，这个仓库不是一次性的文档抓取，而是围绕真实 InfiniSynapse 开发风险持续沉淀出的规则包：先建立官方资料快照、AI 入口和读取顺序，再补齐 TypeScript / Python 参考 SDK、SSE 重连、扫描器和回归测试，随后把 RAG、Browser Use、任务分享、安全接入、成熟产品接入、产物归档、人工审批和下游反哺流程整理成可复用 playbook。

对开发者来说，它的价值不是“多一份文档”，而是把容易出错的 InfiniSynapse 集成经验变成可执行、可验证、可迁移的开发上下文：

| 回报 | 对人类开发者 | 对 AI 助手 |
| --- | --- | --- |
| 降低接口幻觉 | 用 `docs/reference/api-index.md` 和 `upstream-docs/` 快速核对 endpoint、method、body 和产物接口 | 先读 `AGENTS.md`、skill、reference，再写代码；没有文档依据时不要编造接口 |
| 降低安全事故 | 默认服务端代理，API Key 不进浏览器、移动端、截图或公开仓库 | 扫描器识别硬编码 Bearer token、前端直连 InfiniSynapse、错误 `AUTHING_SERVER_URL` |
| 降低长任务失败率 | 按标准链路实现 `events -> newTask -> askResponse -> workspace`，避免只读 SSE 文本 | 生成代码时必须先连 SSE，再发 `newTask`，完成后读取 `getTaskWorkspace` / `previewFile` / `downloadTaskFile` |
| 缩短接入时间 | 直接内化 `samples/sdk/`、`curl-quickstart`、`server-side-agent-flow` 到业务后端 | 复用现有 SDK、模板和 playbook，不从零手写 SSE、上传、下载和代理逻辑 |
| 支撑成熟产品接入 | 老项目可以按灰度、恢复、取消、runtime guard、人工审批、产物归档逐步接入 | 先判断轻量 LLM 直连还是 InfiniSynapse 长任务，不替换已有用户、权限、计费、队列等核心系统 |
| 保持多工具一致 | Codex、Claude Code、Cursor、GitHub Copilot、通用 RAG 都有对应入口或规则 fan-out | 不同 AI 工具读取同一套硬约束，减少团队协作时的规则漂移 |
| 持续反哺 | 下游项目把新 endpoint、反模式、运行经验回写到 reference、playbook、SDK、扫描器和测试 | 后续任务复用前一次真实项目经验，避免同类项目重复踩坑 |

AI 读取提示：本节用于判断项目价值和使用边界，不替代 API 事实。真正写 InfiniSynapse 集成代码时，仍按 `AGENTS.md -> 对应 skill -> docs/reference/ -> upstream-docs/` 的顺序确认细节。

## 相比直接保存原始文档的优势

如果只是把官网文档下载到本地，它仍然是“被动参考资料”：AI 需要自己判断该读哪一页、哪些规则更重要、哪些路径适合当前任务。这个仓库在原始文档之上增加了一层面向 AI 协作的工程化结构：

- **有明确入口**：`AGENTS.md`、`CLAUDE.md`、`llms.txt` 告诉 AI 先读什么、按什么优先级读，避免每次从一堆 Markdown 里自行猜上下文。
- **有任务分流**：`.agents/skills/` 把部署、Server API、CLI、产品模式、浏览器插件拆成独立 skill，AI 会按任务读取更小、更相关的规则。
- **有强约束规则**：把“API Key 必须在服务端”“先连 SSE 再发任务”“结果要读 workspace”“`AUTHING_SERVER_URL` 不能写错”等高风险点从文档描述提升为默认开发约束。
- **有产品编排模式**：不仅保存 endpoint，还整理了高考助手、购物比价、报告快写等应用级调用流程，方便从“单接口调用”推进到“可落地产品设计”。
- **有可跑的参考 SDK**：`samples/sdk/` 提供零依赖的 TypeScript / Python 客户端（SSE 解析、`runTask` 长任务编排、后端代理、二进制下载、两类上传），并带离线单测，AI 可以直接复制而不必现写易错的 SSE/代理。
- **有实时护栏**：`tools/hooks/` 的扫描器在每次 Edit/Write 后自动检查「API Key 进前端、SSE 顺序、二进制当 JSON、`AUTHING_SERVER_URL` 写错」等风险点；命中高危（`INF-SEC-*`/`INF-ENV-001/002`）会阻塞要求当场修，`INF-SSE-001`/`INF-DL-001` 等为提醒。
- **有跨工具 fan-out**：同一套规则同步给 Codex、Claude Code、Cursor、Copilot 和通用 LLM/RAG 使用；`.claude/skills/` 由 `.agents/skills/` 单向镜像，`tools/sync-skills.sh --check` 防漂移。
- **有真回归测试**：`tools/test-suite.sh` 断言扫描器 fixtures 退出码、跑 SDK 离线单测、校验 skill 镜像一致和 api-index 与上游端点对齐，改规则会被测出退化。
- **有同步机制**：`tools/sync-upstream-docs.sh` 可以重新抓取 zh/en 两套官方文档和截图，方便后续跟进官网更新。
- **有来源审计**：`docs/SOURCE-AUDIT.md` 记录哪些上游可用、哪些不可用，例如当前 `infini_docker` GitHub 仓库返回 404。

换句话说，原始文档解决“资料在本地”的问题；这个项目解决“AI 如何稳定、按正确顺序、带着安全边界使用这些资料开发应用”的问题。

## 文档优先级

开发产品时优先读中文 SaaS/API 文档，英文文档只作为补充。

1. `upstream-docs/infinisynapse-site/zh/markdown/`
2. `upstream-docs/infinisynapse-site/markdown/`
3. `upstream-src/infini_docker/`，仅当上游源码或离线包补齐后使用
4. 官方网页 `https://www.infinisynapse.cn/zh/docs`

中文 Server API 文档额外包含这些关键 SaaS 信息：

- SaaS API Key 获取路径。
- `/tasks` 开发者后台能力。
- `public-engine` 与独占计算资源说明。
- `/api/ai_browser/session` 浏览器插件连接状态。
- 高考助手、购物比价、报告快写等已落地 App 的 API 组合模式。

## 项目结构

```text
.
├── AGENTS.md                         # 跨工具通用规范入口（单一真源）
├── CLAUDE.md                         # Claude Code 入口 + 硬约束速览
├── llms.txt                          # 给任意 LLM 的项目导航
├── CHANGELOG.md  CONTRIBUTING.md      # 变更记录 / 贡献指南
├── docs/
│   ├── README.md                     # 文档导航：人类入口、目录分层和维护边界
│   ├── CONTENT-MODEL.md              # AI/人类友好 × 官方/特定用法的内容维护模型
│   ├── MAINTENANCE.md                # 上游同步、派生文档更新与发布前检查
│   ├── reference/                    # 事实基准：api-index / capabilities / task-lifecycle / glossary
│   ├── playbooks/                    # 特定用法：LLM 路由 / 安全接入 / 成熟产品接入 / RAG / 市场订阅 / Browser Use / 任务分享 / 排查（+ assets/ 图）
│   ├── proposals/                    # 产品方案草案（外围，不进规则主线）
│   └── ...                           # 使用说明、架构、审计、计划、速查、许可说明
├── samples/
│   ├── sdk/typescript/               # 零依赖 TS client + SSE 解析 + 重连 runTask + 代理 + 离线单测
│   ├── sdk/python/                   # 标准库 Python client + 重连 + 离线单测
│   └── templates/                    # curl 速查、后端 Agent Flow 骨架
├── tools/
│   ├── hooks/                        # PostToolUse 扫描器 + fixtures + 复用示例
│   ├── sync-skills.sh                # .agents/skills → .claude/skills 镜像
│   ├── doctor.sh / test-suite.sh / sync-upstream-docs.sh
├── .agents/skills/                   # skills 唯一源（Codex）+ manifest.json
├── .claude/                          # settings.json 接线 PostToolUse 钩子 + skills/ 镜像
├── .cursor/rules/  .github/          # Cursor / Copilot fan-out
├── upstream-docs/infinisynapse-site/ # 官方文档本地镜像
└── upstream-src/                     # 预留上游源码 / 离线包位置
```

这个结构把原始文档、任务型规则、AI 工具入口和验证脚本分层组织。原始文档保留事实来源，skills 负责把事实转成开发约束，脚本负责保证本地镜像和规则包没有缺关键文件。

## AI 工具入口

| 工具 | 入口 |
| --- | --- |
| Codex / 通用 agents.md 工具 | `AGENTS.md` + `.agents/skills/` |
| Claude Code | `CLAUDE.md` + `.claude/skills/` |
| Cursor | `.cursor/rules/infinisynapse-core.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/` |
| 任意 LLM / RAG | `llms.txt` |

## 推荐接入方式

这个仓库的主使用方式是**AI 规则包 / skills**，不是 npm 运行时依赖。`npm test`、`npm run scan` 用于验证和护栏；业务项目真正接入时，通常有三种方式：

- 临时使用：在业务项目里让 AI 读取 `/Users/wangyixiao/WorkSpace/InfinisynapseAssistant/AGENTS.md` 和相关 skill。
- 长期使用：把本仓库作为 `vendor/` 或 git submodule，并在业务项目自己的 `AGENTS.md` / `CLAUDE.md` 固定引用。
- 代码使用：把 `samples/sdk/` 内化到业务后端；不要把带 API Key 的代码放进前端。

新项目和老项目的具体开发流程见 `docs/USAGE-GUIDE.md`。
下游业务项目如何固定引用本规则包、调用扫描器并在提交前反哺，见 `docs/playbooks/downstream-projects.md`。

## 技能（Skills）

| Skill | 触发场景 | 必读文档 |
| --- | --- | --- |
| `infinisynapse-server-api` | 写 SDK、后端 route、SSE、任务、数据源、RAG、上传下载 | `zh/markdown/server-api-reference.md` |
| `infinisynapse-product-patterns` | 设计高考助手、购物比价、报告快写、LLM 路由等任务型产品 | Server API 第 10 节 |
| `infinisynapse-deployment` | 私有化部署、`.env`、Docker Compose、登录失败、OOM | `zh/markdown/private-deployment-guide.md` |
| `infinisynapse-cli` | `agent_infini` CLI、CLI 请求映射、二次集成 | `zh/markdown/cli-api-reference.md` |
| `infinisynapse-browser-extension` | Browser Use、Chrome 插件、网页自动化、购物/网页研究 | `zh/markdown/chrome-plugin-install.md` |

## 快速开始

```bash
# 体检当前规则包、上游快照、SDK、钩子和镜像一致性
bash tools/doctor.sh

# 跑回归：扫描器 fixtures + SDK 离线单测 + skill 镜像一致 + 文档对齐
npm test

# 手动扫描某个文件的 InfiniSynapse 反模式
npm run scan -- path/to/file.ts

# 改了 skill 后把唯一源镜像到 Claude
bash tools/sync-skills.sh

# 同步最新公开文档，包含 zh/en 两套和截图资源
bash tools/sync-upstream-docs.sh
```

当前验证状态：

```text
npm test: PASS（65 项，0 失败）
bash tools/doctor.sh: PASS，仅 upstream-src/infini_docker 缺失、GitHub source repository currently unreachable 为预期 WARN
```

`infini_docker` 上游源码仓库当前不可 clone，详见 `docs/SOURCE-AUDIT.md`。

## 后续如何使用

### 方式一：把本仓库作为 AI 规则工作区

适合你正在设计新产品、写方案、写 SDK 或做接口集成时使用。

在 Codex / Claude 中直接打开这个仓库，然后这样提问：

```text
请先阅读 AGENTS.md，并根据任务使用相关 skill。
我要基于 InfiniSynapse Server API 做一个报告快写应用，前端上传资料，后端创建任务，实时返回进度，最后下载 PDF。
请先给我后端 API 设计和调用流程，再实现代码。
```

AI 应该读取：

- `AGENTS.md`
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- `.agents/skills/infinisynapse-product-patterns/SKILL.md`
- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md`

### 方式二：在业务项目中引用这个规则包

适合你已经有一个实际 Web / SaaS / mini-app 项目。

推荐提示词：

```text
你现在要开发的业务项目依赖 InfiniSynapse。请把
/Users/wangyixiao/WorkSpace/InfinisynapseAssistant
作为外部规则包读取。

先读它的 AGENTS.md，再读与当前任务相关的 skill 和中文 SaaS 文档。
除非文档里有明确 endpoint，否则不要编造 API。
```

如果 AI 工具不能跨目录稳定读取，可以把本仓库作为 git submodule 或复制 `AGENTS.md`、`llms.txt`、`.agents/skills/` 到业务项目中。

### 方式三：作为 RAG / 知识库源

把这些目录加入你的 AI 工具知识库：

```text
AGENTS.md
llms.txt
docs/README.md
docs/CONTENT-MODEL.md
.agents/skills/
docs/QUICK-REFERENCE.md
docs/playbooks/
upstream-docs/infinisynapse-site/zh/markdown/
```

不建议默认把所有 HTML 和 PNG 加入向量库。HTML 用于审计和重新转换，PNG 用于人工查看截图，主要检索源应是 Markdown。

## 开发 InfiniSynapse 应用的默认架构

默认采用服务端代理模式：

```text
Frontend / Mini App
  -> Your Backend
    -> LlmGateway              # 非 agentic 轻量调用
    -> InfiniSynapse Server API # agentic 长任务和 workspace 产物
```

默认按工作负载分流：一问一答、摘要、改写、分类、抽取、轻量评分等非 agentic 调用走后端直连 LLM；深度调研、长任务、工具使用、Browser Use 和报告/PDF/表格等 workspace 产物走 InfiniSynapse。不要让前端直接持有 LLM provider key 或 InfiniSynapse API Key。

服务端至少保存：

- 业务用户 ID
- `taskId`
- `connId`
- 用户输入
- 上传文件映射
- 当前状态
- 最终 workspace 文件路径
- 错误信息

## 长任务标准流程

1. 后端生成 `connId`，需要恢复或轮询时同时生成 `taskId`。
2. 后端先建立 `GET /api/ai/events?connId=<uuid>`。
3. 后端调用 `POST /api/ai/message`，`type=newTask`，带同一个 `connId`。
4. 后端消费 SSE 的 `message.partial`、`message.add`、`notification`、`heartbeat`。
5. 如果收到 `message.ask=upload_file_to_sandbox`，先上传文件，再用 `askResponse` 回传上传结果。
6. 收到 `completion_result` 后，用 `getTaskWorkspace` 枚举产物。
7. 用 `previewFile` 预览文本/Markdown。
8. 用 `downloadTaskFile` 下载 PDF、Word、图片、图表等最终文件。

## 三类典型产品模式

### 高考助手

- 输入：分数、省份、选科、偏好、约束。
- 不需要浏览器插件。
- 结果通常是 Markdown / PDF 报告。
- 恢复使用 `getUiMessageById`，结果读取使用 `getTaskWorkspace`。

### 购物比价助手

- 通常需要 Browser Use。
- 创建任务前先检查 `GET /api/ai_browser/session`。
- 用 SSE 实时展示候选商品、风险提示和购买建议。
- 用户换商品或预算时调用 `cancelTask`。

### 报告快写

- 用户资料建议用 `/api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` 归档。
- 数据源和 RAG 需要在 `newTask` 前列出并启用。
- 多轮修订继续同一个 `taskId`，不要每次新建任务。

## 私有化部署检查重点

- `AUTHING_SERVER_URL` 变量名不能写错。
- `AUTHING_SERVER_URL` 必须是浏览器可访问的 IP 或域名，不能是容器名或 `127.0.0.1`。
- 默认端口是 `3000`，路径是 `/api`，不要带尾部 `/`。
- 对外开放 `8088`、`80`、`3000`。
- `infini-synapse-mysql-migrate` 显示 `Exited (0)` 是正常。
- 16 GB 内存机器需要降低 InfiniSQL 内存参数。

## 维护上游文档

当你觉得官网文档可能变化时：

```bash
bash tools/sync-upstream-docs.sh
npm test
git diff -- upstream-docs/
```

如果 `infini_docker` 仓库恢复公开或你拿到离线包：

```bash
git clone https://github.com/chaozwn/infini_docker.git upstream-src/infini_docker
# 或把离线包解压到 upstream-src/infini_docker/
```

然后更新 `docs/SOURCE-AUDIT.md`。

## 重要文件

- `docs/QUICK-REFERENCE.md`: 高信号速查。
- `docs/CONTENT-MODEL.md`: 内容类型、维护边界和 RAG/文件放置规则。
- `docs/MAINTENANCE.md`: 上游同步、派生文档更新和发布前检查。
- `docs/USAGE-GUIDE.md`: 使用方式。
- `docs/PROJECT-ARCHITECTURE.md`: 架构说明。
- `docs/SOURCE-AUDIT.md`: 上游文档和源码可用性审计。
- `samples/templates/server-side-agent-flow.md`: 服务端 Agent Flow 骨架。

## 当前限制

- SDK 是**参考实现**，不连真实 API；离线只能验证 SSE 解析、语法和调用契约，端到端要自己拿 Key 跑。
- 还没有基于真实私有化部署 / 真实 Key 的 contract tests。
- 扫描器是 grep 级启发式：高精度但非语义分析，跨文件的 SSE 顺序（A 文件连 SSE、B 文件发任务）不会判为违规。
- `upstream-src/infini_docker/` 尚未补齐，因为官方 GitHub 仓库当前返回 404。

## 许可证

本仓库当前未声明开源许可证。`upstream-docs/` 中的网页快照和截图来自 InfiniSynapse 官方公开页面，仅作为本地开发辅助资料使用。
