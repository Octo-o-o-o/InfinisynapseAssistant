# 文档导航

本目录保存面向开发者阅读的说明、从官方文档提炼出的事实索引，以及围绕核心场景沉淀的特定用法。原始官方快照不放在这里，而是保存在 `upstream-docs/`。

## 推荐阅读路径

| 目标 | 先读 | 再读 |
| --- | --- | --- |
| 快速理解项目 | `README.md` | `docs/USAGE-GUIDE.md`, `docs/PROJECT-ARCHITECTURE.md` |
| 新项目 / 老项目如何接入 InfiniSynapse | `docs/USAGE-GUIDE.md` | `docs/playbooks/secure-integration.md`, `samples/sdk/` |
| 下游业务项目如何使用并反哺本规则包 | `docs/playbooks/downstream-projects.md` | `docs/USAGE-GUIDE.md`, `tools/hooks/lib/scan-infinisynapse.sh` |
| 了解平台能做什么 | `docs/reference/capabilities.md` | `docs/reference/api-index.md`, `docs/reference/task-lifecycle.md` |
| 快速查接口和红线 | `docs/QUICK-REFERENCE.md` | `docs/reference/api-index.md`, `docs/reference/task-lifecycle.md` |
| 安全接入产品 / 不泄露 API Key | `docs/playbooks/secure-integration.md` | `samples/templates/server-side-agent-flow.md`, `samples/sdk/` |
| 让 AI 助手接手开发 | `AGENTS.md`, `llms.txt` | 对应 `.agents/skills/*/SKILL.md` |
| 判断内容应该放哪里 | `docs/CONTENT-MODEL.md` | 本文件的“维护边界” |
| 维护 / 同步官方文档 / 发布前检查 | `docs/MAINTENANCE.md` | `docs/SOURCE-AUDIT.md`, `CONTRIBUTING.md` |
| 处理 RAG 和文件放置 | `docs/playbooks/rag-file-placement.md` | `docs/reference/api-index.md` 中 RAG/上传/下载端点 |
| 接入共享数据源 / 知识库（市场订阅） | `docs/playbooks/market-subscriptions.md` | `docs/reference/api-index.md` 中市场端点 |
| 让 AI 操作浏览器（购物比价 / 网页） | `docs/playbooks/browser-use.md` | `infinisynapse-browser-extension` skill |
| 分享 / 公开只读结果页 | `docs/playbooks/task-sharing.md` | `docs/reference/api-index.md` 任务分享端点 |
| 计划/执行模式 + 高风险动作审批 | `docs/playbooks/plan-act-approval.md` | `docs/reference/api-index.md` 的 togglePlanActMode/autoApprovalSettings |
| 排查报错 / 部署登录失败 | `docs/playbooks/troubleshooting.md` | `infinisynapse-deployment` skill |
| 私有化部署 | `docs/QUICK-REFERENCE.md` | `infinisynapse-deployment` skill, `upstream-docs/.../private-deployment-guide.md` |
| 速查易混术语 | `docs/reference/glossary.md` | 词条指向的 `reference/` 与 `playbooks/` |
| 核对官方来源 | `docs/SOURCE-AUDIT.md` | `upstream-docs/infinisynapse-site/zh/markdown/` |

## 目录分层

| 目录或文件 | 定位 | 内容类型 |
| --- | --- | --- |
| `docs/reference/` | 从官方文档提炼出的事实基准 | AI 友好 + 官方文档内容 |
| `docs/playbooks/` | 基于官方事实总结的核心场景做法 | AI/人类友好 + 特定用法内容 |
| `docs/CONTENT-MODEL.md` | 说明内容分类和维护边界 | 人类友好 + 特定用法内容 |
| `docs/MAINTENANCE.md` | 上游同步、派生文档更新与发布前检查 | 人类友好 + 特定用法内容 |
| `docs/QUICK-REFERENCE.md` | 高频规则和接口速查 | AI/人类友好 + 特定用法内容 |
| `docs/USAGE-GUIDE.md` | 如何把本仓库接入 AI 工具和业务项目 | 人类友好 |
| `docs/PROJECT-ARCHITECTURE.md` | 仓库结构和规则包设计 | 人类友好 |
| `docs/SOURCE-AUDIT.md` | 上游来源、同步状态和不可用来源说明 | 人类友好 + 官方文档内容 |
| `docs/LICENSE-NOTES.md` | 第三方文档快照和仓库许可说明 | 人类友好 |
| `docs/PLAN.md` | 已完成项与后续改进路线图 | 人类友好 |
| `docs/proposals/` | 基于 InfiniSynapse 的产品方案草案（外围，不进规则主线） | 人类友好 + 特定用法内容 |

## 维护边界

- `docs/reference/` 只放可追溯到官方文档的事实，不写产品建议。
- `docs/playbooks/` 只放跨多个官方章节组合出的核心场景做法，不复制大段官方原文。
- `AGENTS.md`、`CLAUDE.md` 和 `llms.txt` 只保留入口、读取顺序和硬约束，长解释放回 `docs/`。
- 新增特定用法前，先确认官方文档或 `docs/reference/` 是否已经清楚回答；已经清楚回答的内容只链接，不重复维护。
- 未定稿的业务方案不默认进入规则包主线，避免把一次性方案误当作通用规范。
