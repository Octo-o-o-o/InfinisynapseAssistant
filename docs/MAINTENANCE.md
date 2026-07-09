# 维护手册

本文件说明如何维护这个 InfiniSynapse AI 规则包。它不保存新的官方事实，也不替代 `upstream-docs/`；它负责把“同步上游、判断影响、更新派生文档、验证结果”标准化。

## 什么时候读

- 官网文档、SaaS API、私有化部署说明、CLI 或 Browser Use 文档可能更新时。
- 新增、删除或修改 endpoint、SSE 事件、请求字段、返回类型时。
- 新增 playbook、skill、SDK 方法、扫描规则或测试 fixture 时。
- 发现 README、docs、skills、samples 与上游事实不一致时。

## 来源优先级

| 来源 | 用途 | 规则 |
| --- | --- | --- |
| `upstream-docs/infinisynapse-site/zh/markdown/` | 中文 SaaS/API 主事实源 | 优先使用 |
| `upstream-docs/infinisynapse-site/markdown/` | 英文补充 | 只在中文未覆盖时使用 |
| `docs/reference/` | 从官方文档提炼的事实基准 | 必须可回溯到上游 |
| `docs/playbooks/` | 核心场景默认做法 | 只沉淀跨章节判断，不复制官方原文 |
| `AGENTS.md` / `CLAUDE.md` / `llms.txt` | AI 入口和硬约束 | 保持短、硬、可执行 |
| `samples/` / `tools/` | 可跑参考和验证 | 改规则时尽量补测试 |

官方网页入口：

- 官网：`https://www.infinisynapse.cn/`
- 中文文档：`https://www.infinisynapse.cn/zh/docs`
- 国内 SaaS 控制台：`https://app.infinisynapse.cn/tasks`
- 海外 SaaS：`https://app.infinisynapse.com`

## 上游同步流程

1. 确认工作树边界：

   ```bash
   git status -sb
   ```

2. 同步官方公开文档（当前共 8 页 zh/en，清单维护在脚本内 `PAGES` 数组；官方新增页面时先更新该数组和 `tools/doctor.sh`）：

   ```bash
   bash tools/sync-upstream-docs.sh
   ```

3. 审查上游差异：

   ```bash
   git diff -- upstream-docs/
   rg "/api/|AUTHING_SERVER_URL|Browser Use|API Key|RAG|taskUpload" upstream-docs/infinisynapse-site/zh/markdown/
   ```

4. 按“影响判断表”更新派生内容。
5. 跑验证：

   ```bash
   bash tools/sync-skills.sh --check
   bash tools/doctor.sh
   npm test
   git diff --check
   ```

如果改了 `.agents/skills/`，先运行 `bash tools/sync-skills.sh` 同步 `.claude/skills/`，再跑 `--check`。

## 影响判断表

| 上游变化 | 必改 | 视情况改 |
| --- | --- | --- |
| 新增/删除/改名 endpoint | `docs/reference/api-index.md` | SDK client、samples、skills、playbooks、test-suite 抽样 |
| SSE event / message 字段变化 | `docs/reference/task-lifecycle.md` | TS/Python SSE 测试、runTask、AGENTS 硬约束 |
| 下载/上传返回类型变化 | `api-index.md` 二进制清单 | 扫描器 `INF-DL-*`、SDK、curl 模板 |
| API Key / 鉴权 / 控制台路径变化 | `README.md`、`QUICK-REFERENCE.md`、`secure-integration.md` | `AGENTS.md`、`CLAUDE.md`、扫描器 |
| RAG / 数据源 / 市场订阅变化 | `api-index.md`、`capabilities.md` | `rag-file-placement.md`、`market-subscriptions.md`、SDK |
| Skill 管理 / Partner SSO 变化 | `api-index.md`、`capabilities.md`、`glossary.md` | `rag-file-placement.md`（Skill 上下文行）、server-api skill、`secure-integration.md` |
| 官方 docs 站新增/删除页面 | `tools/sync-upstream-docs.sh` 的 `PAGES`、`tools/doctor.sh`、`SOURCE-AUDIT.md` | `MAINTENANCE.md` 本表、README |
| Browser Use 安装或 session 字段变化 | `browser-use.md` | browser-extension skill、assets、README |
| 私有化部署变量、端口、资源要求变化 | `QUICK-REFERENCE.md`、`troubleshooting.md` | deployment skill、扫描器 `INF-ENV-*`、doctor |
| 新能力或新产品组合模式 | `capabilities.md` | 新 playbook 或 product-pattern skill |
| 术语反复混淆 | `glossary.md` | QUICK-REFERENCE、AGENTS |

## 写作规范

- `docs/reference/` 只写事实，不写产品建议。
- `docs/playbooks/` 只写“怎么选、按什么顺序做、边界是什么”，并指向 reference 或上游文档。
- `AGENTS.md`、`CLAUDE.md`、`llms.txt` 不放长解释，只放入口、硬约束和读取顺序。
- `README.md` 面向第一次进入仓库的人，解释价值、结构、快速开始和入口链接。
- 大段官方原文留在 `upstream-docs/`，派生文档只摘要和链接。
- 示例里的密钥、密码、token、个人路径都必须是占位符。
- 本地业务方案草稿不进入规则主线；已确认的产品草稿用 `.gitignore` 精确文件忽略，Codex 复盘工作稿用 `docs/proposals/*.codex.md` 忽略。

## 发布前检查清单

- 是否能从每条新增事实追溯到上游文档或 `docs/reference/`？
- 是否避免了重复维护官方原文？
- 如果新增特定用法，是否确实解决跨章节组合、默认选择或高风险误用？
- 是否更新了 `docs/README.md` 导航？
- 是否需要更新 `AGENTS.md` / `CLAUDE.md` / `llms.txt` 的入口和读取顺序？
- 是否需要更新 skill manifest 或同步 `.claude/skills/`？
- 是否需要新增扫描器 fixture 或 SDK 离线测试？
- `bash tools/doctor.sh`、`npm test`、`git diff --check` 是否通过？
