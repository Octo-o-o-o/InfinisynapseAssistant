# InfiniSynapse Assistant

面向 Codex / Claude Code / Cursor / GitHub Copilot 等 AI 编码助手的 InfiniSynapse 规范助手工作区。

这个仓库不是 InfiniSynapse 本体，也不是业务应用模板。它的作用是把 InfiniSynapse 当前公开的中文 SaaS/API 文档、私有化部署文档、CLI API、Chrome Browser Use 插件文档，以及面向产品开发的调用模式沉淀成一套本地 AI 规则包。后续开发基于 InfiniSynapse 的应用时，让 AI 先读这个仓库，可以显著减少“重新翻文档”“凭训练数据猜接口”“把 API Key 写进前端”“SSE 顺序写错”等问题。

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
├── AGENTS.md                         # 跨工具通用规范入口
├── CLAUDE.md                         # Claude Code 入口
├── llms.txt                          # 给任意 LLM 的项目导航
├── .agents/skills/                   # Codex 项目级 skills
├── .claude/skills/                   # Claude Code skills 镜像
├── .cursor/rules/                    # Cursor 规则
├── .github/                          # Copilot 指令
├── docs/                             # 使用说明、审计、计划、速查
├── samples/templates/                # 可复制的业务集成骨架
├── tools/                            # 同步、体检、测试脚本
├── upstream-docs/infinisynapse-site/ # 官方文档本地镜像
└── upstream-src/                     # 预留上游源码 / 离线包位置
```

这个结构参考了本地 `HarmonyOS_DevSpace` 的成功形态：入口规则、skills、Cursor/Copilot fan-out、上游文档镜像和验证脚本分层组织。不同点是 HarmonyOS 项目重点解决 ArkTS 编译与生态规则问题；本项目重点解决 InfiniSynapse SaaS/API 调用、产品编排、部署和安全边界问题。

## AI 工具入口

| 工具 | 入口 |
| --- | --- |
| Codex / 通用 agents.md 工具 | `AGENTS.md` + `.agents/skills/` |
| Claude Code | `CLAUDE.md` + `.claude/skills/` |
| Cursor | `.cursor/rules/infinisynapse-core.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/` |
| 任意 LLM / RAG | `llms.txt` |

## Skills

| Skill | 触发场景 | 必读文档 |
| --- | --- | --- |
| `infinisynapse-server-api` | 写 SDK、后端 route、SSE、任务、数据源、RAG、上传下载 | `zh/markdown/server-api-reference.md` |
| `infinisynapse-product-patterns` | 设计高考助手、购物比价、报告快写等任务型产品 | Server API 第 10 节 |
| `infinisynapse-deployment` | 私有化部署、`.env`、Docker Compose、登录失败、OOM | `zh/markdown/private-deployment-guide.md` |
| `infinisynapse-cli` | `agent_infini` CLI、CLI 请求映射、二次集成 | `zh/markdown/cli-api-reference.md` |
| `infinisynapse-browser-extension` | Browser Use、Chrome 插件、网页自动化、购物/网页研究 | `zh/markdown/chrome-plugin-install.md` |

## 快速开始

```bash
# 体检当前规则包、上游快照和工具
bash tools/doctor.sh

# 跑轻量一致性测试
npm test

# 同步最新公开文档，包含 zh/en 两套和截图资源
bash tools/sync-upstream-docs.sh
```

当前验证状态：

```text
npm test: PASS
bash tools/doctor.sh: PASS, with expected WARN for missing upstream-src/infini_docker
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
.agents/skills/
docs/QUICK-REFERENCE.md
upstream-docs/infinisynapse-site/zh/markdown/
```

不建议默认把所有 HTML 和 PNG 加入向量库。HTML 用于审计和重新转换，PNG 用于人工查看截图，主要检索源应是 Markdown。

## 开发 InfiniSynapse 应用的默认架构

默认采用服务端代理模式：

```text
Frontend / Mini App
  -> Your Backend
    -> InfiniSynapse Server API
```

不要让前端直接持有 InfiniSynapse API Key。

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
- `docs/USAGE-GUIDE.md`: 使用方式。
- `docs/PROJECT-ARCHITECTURE.md`: 架构说明。
- `docs/SOURCE-AUDIT.md`: 上游文档和源码可用性审计。
- `samples/templates/server-side-agent-flow.md`: 服务端 Agent Flow 骨架。

## 当前限制

- 还没有基于真实私有化部署的 contract tests。
- 还没有 Node.js / Python SDK 封装，只沉淀了 API 规则和调用流程。
- `upstream-src/infini_docker/` 尚未补齐，因为官方 GitHub 仓库当前返回 404。

## License

本仓库当前未声明开源许可证。`upstream-docs/` 中的网页快照和截图来自 InfiniSynapse 官方公开页面，仅作为本地开发辅助资料使用。
