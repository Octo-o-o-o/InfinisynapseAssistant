# 项目架构

这个仓库的定位是 InfiniSynapse 的 AI 规则工作区。它不是简单的文档镜像，而是在官方文档之上增加了任务分流、开发约束、跨工具入口和验证脚本，让 AI 助手能更稳定地开发基于 InfiniSynapse 的应用。

## 分层结构

| 层级 | 目录 / 文件 | 作用 |
| --- | --- | --- |
| 入口规则 | `AGENTS.md`, `CLAUDE.md`, `llms.txt` | AI 启动后优先读取的导航和通用约束 |
| 规范参考 | `docs/reference/`（api-index, capabilities, task-lifecycle, glossary） | 从上游提炼的端点/能力/SSE 时序/术语，事实基准 |
| 特定用法 playbooks | `docs/playbooks/` | 跨章节组合的核心场景做法：安全接入、成熟产品接入、RAG/文件、市场订阅、Browser Use、任务分享、排查 |
| 任务 skills | `.agents/skills/`（唯一源）, `.claude/skills/`（镜像） | 按部署、Server API、CLI、产品模式、浏览器插件分流 |
| 可跑参考 | `samples/sdk/`, `samples/templates/` | TS/Python 零依赖 client、runTask、代理、curl 速查 |
| 实时护栏 | `tools/hooks/` | PostToolUse 扫描器 + fixtures，拦截高风险反模式 |
| 工具适配 | `.cursor/rules/`, `.github/` | Cursor 和 GitHub Copilot 可读取的规则（fan-out） |
| 上游文档 | `upstream-docs/` | 官方公开文档和截图的本地快照 |
| 上游源码 | `upstream-src/` | 预留 `infini_docker` 源码或离线包位置 |
| 项目文档 | `docs/` | 使用说明、来源审计、速查、许可说明、后续计划 |
| 脚本 | `tools/` | 文档/技能同步、项目体检、回归测试 |

## 设计原则

- **中文 SaaS 文档优先**：开发产品时优先读 `upstream-docs/infinisynapse-site/zh/markdown/`。
- **英文文档兜底**：当中文文档没有覆盖细节时，再读英文补充快照。
- **事实和规则分离**：`upstream-docs/` 保存上游事实，`AGENTS.md` 和 skills 把事实转成开发规则。
- **任务触发而不是全量灌入**：AI 不应每次读完整文档，而应按当前任务读取相关 skill 和对应文档。
- **服务端优先**：所有产品集成默认采用服务端代理模式，API Key 不进入前端。
- **长任务优先按流程实现**：先连 SSE，再发 `newTask`，完成后读取 workspace 产物。
- **同步后必须验证**：更新文档后运行 `npm test`，确认关键内容没有丢失。

## 相比原始文档镜像多了什么

原始文档镜像只解决“资料可离线查看”。本项目额外提供：

- AI 启动入口和阅读顺序。
- 按任务拆分的 skills。
- 高风险开发规则和安全边界。
- 面向产品落地的 API 编排模式。
- 多 AI 工具可读取的规则 fan-out。
- 本地同步、体检和测试脚本。
- 上游源码和文档可用性的审计记录。

因此，它更像一个“可执行的开发规范包”，而不是资料归档目录。

## 关键风险边界

- API Key 只能放在服务端或密钥管理系统中。
- 不能在文档没有依据时编造 endpoint、method 或 body 字段。
- 长任务必须先建立 `/api/ai/events`，再调用 `/api/ai/message`。
- 上传要区分 Agent sandbox 上传和产品主动归档上传。
- 最终交付物优先从 task workspace 读取。
- 私有化部署排查时优先检查 `AUTHING_SERVER_URL`。
