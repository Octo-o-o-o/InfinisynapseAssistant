# Changelog

本项目变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。
版本对应规则包成熟度，不对应 InfiniSynapse 官方版本。

## [Unreleased]

### Added（下游反哺 · 鼹鼠/yanshu）
- `docs/playbooks/partner-sso-account-billing.md`：Partner SSO 账号整合与计费归属特定用法——「计费身份 = 平台资源命名空间」铁律（数据源/RAG/任务账号私有，开发者 key vs 用户 key 必须按资源集创建时定死，任务全链路同一把 key）、Partner API Key 服务端加密落库与 20 把上限降级、SSO 邮箱冲突不自动合并（防接管）、解绑语义、双 key 任务列表验证计费归属的自查法。基于 partner-sso-integration-guide 实接验证（entryUrl 会话创建 + withApiKey 兑换真实跑通）。
- `docs/README.md` 阅读路径、`llms.txt` playbooks 行、product-patterns skill 的 Partner SSO 节补充指向新 playbook（skill 镜像已同步）。

## [0.4.0] - 2026-07-09

上游刷新（官方 docs 站 5→8 页）+ 鸿蒙支持 + 测试评估能力 + 工程一致性修复。调研与方案见 `docs/plans/2026-07-09-upstream-refresh-and-quality.cursor.fable.md`。

### Added（上游事实）
- 上游快照新增 4 页（zh/en）：Connect Data Sources and Knowledge Base、官方 Existing Product Integration Playbook、Partner SSO Integration Guide、Vibe Coding Guide；`sync-upstream-docs.sh` 页面清单数组化，`doctor.sh`、`SOURCE-AUDIT.md` 同步。
- `api-index.md` 新增 §5 Skill 管理（`/api/ai_skill/*` + Skill 市场）与 §8 Partner SSO（`/api/auth/partner/*`，`X-Client-Id`/`X-Client-Secret`、Partner API Key、Webhook 验签）；`newTask` 补客户端 `taskId` 幂等注记。
- `capabilities.md` 新增 Skill 管理、Partner SSO 能力行与官方 apps 页参考；`glossary.md` 新增用户级 Skill / 任务级 Skill 上下文 / Partner SSO / Partner API Key 词条；`task-lifecycle.md` 标准时序加"准备 Skill"步骤；`rag-file-placement.md` 决策表加方法论/`SKILL.md` 放置行。
- server-api / product-patterns / cli 三个 skill 更新：Skill 管理与两类 Skill 边界、Partner SSO 使用时机、报告快写 Skill 上下文模式、CLI 官方一键安装脚本与开源仓库（`chaozwn/infinisynapse-cli`，MIT）、`--update`/`--skill`。

### Added（鸿蒙 App）
- `docs/playbooks/harmonyos-app-integration.md`：后端代理默认架构、BYOK 例外（Asset Store Kit 存 Key）、ArkTS `requestInStream` SSE 消费参考、生命周期恢复、文件链路、Browser Use 诚实边界、质量清单。
- 扫描器识别 `.ets`：`INF-SEC-002` 增加 ArkTS 客户端特征（`@ohos.`/`@kit.`/`@Entry`/`@Component`），新增 `bad-harmonyos-direct.ets`（exit 2）/`good-harmonyos-proxy.ets`（exit 0）fixtures；post-edit 钩子与 Cursor 规则纳入 `.ets`。

### Added（测试与评估）
- `docs/playbooks/testing-and-evaluation.md`：测试金字塔（单测 → mock 集成 → opt-in 真实冒烟 → production preflight）+ 黄金任务集评估方法（产物断言 + 人工评分维度 + 回归时机）。
- `samples/mock-server/`：零依赖 Node 模拟器（SSE/message/workspace/preview/下载/两类上传，`[mock:upload]`/`[mock:error]` 场景），无 Key 离线跑全链路。
- TS SDK 新增 `test/integration-mock.test.ts`（4 用例，进 `npm test`）与 `examples/live-smoke.ts`（`npm run smoke:live`，opt-in 真实计费冒烟，完成 PLAN 原第 5 条 backlog）。

### Added（工程与开发者便利）
- 本仓库启用 GitHub Actions CI（`.github/workflows/ci.yml`：doctor + npm test + skill 镜像检查）。
- `tools/install-into.sh`：一键把 skills + AGENTS 引用块（幂等标记块）装进下游项目，并打印扫描器接线建议；test-suite 含幂等行为断言。

### Changed
- `manifest.json`：版本对齐 0.4.0、guardrails 补 `INF-API-001`、product-patterns 主文档锚点随上游重编号改为 §11、verified_against 更新为 2026-07-09。
- TS SDK `npm run typecheck` 修为可真实通过：devDependencies 补 `@types/node`（附 lockfile）、mock server 提供 `server.d.mts` 类型声明、依赖可选 express 的 `examples/express-proxy.ts` 从类型检查排除（`npm run check` 语法检查仍覆盖）。
- 扫描器示例（`github-action-scan.yml`、`codex-precommit.sh`）与 `.github/instructions` 的扩展名列表对齐 post-edit.sh（补 `.ets` 等）；`CONTENT-MODEL.md` 文件放置表补方法论/`SKILL.md` 行。
- `capabilities.md` 章节引用随上游重编号修正（文件上传 §7、存储下载 §8）；`AGENTS.md`/`CLAUDE.md`/`llms.txt`/`README.md`/`.cursor/rules`/`copilot-instructions` 同步新 playbook、mock server、install-into 入口。
- `MAINTENANCE.md`：上游同步注明 8 页与 `PAGES` 数组，影响判断表新增 Skill/Partner SSO 行与 docs 站新增页面行。
- `docs/PLAN.md`、`docs/PROJECT-ARCHITECTURE.md` 索引刷新（补 0.3.x 后新增 playbooks 与 0.4.0 完成项）。
- `tools/hooks/test-fixtures/README.md` 补全 `bad-wrong-success-code.ts`、`good-doc-tokens.ts` 缺失条目。

### Fixed
- 扫描器对不存在的文件路径由静默 exit 0 改为 stderr 提示 + exit 64，防止 CI wrapper 传错路径假绿；test-suite 加断言。
- mock server CLI 入口改用 `pathToFileURL` 判断主模块，修复相对路径启动（`node samples/mock-server/server.mjs`）时进程直接退出的问题。
- `install-into.sh` 托管块处理加固：end 标记缺失时报错退出（65）而不是截断下游 AGENTS.md；标记匹配改子串语义，标记行带尾随空格也能正确替换旧块，不再产生重复托管段。
- `doctor.sh` 补齐 5 个漏检 playbook（llm-routing / desktop-native-byok / existing-product-integration / artifact-archiving / decision-quality-loop）；`llms.txt` skills 清单同步 Skill 管理 / Partner SSO / CLI 开源事实。

### 以下为 0.3.5 之后累积、随 0.4.0 一并发布的变更

#### Added
- `docs/MAINTENANCE.md`：上游同步、影响判断、派生文档更新、发布前检查的维护手册。
- README 增加 InfiniSynapse 官网、中文文档、国内 SaaS 控制台和海外 SaaS 链接。
- `docs/playbooks/plan-act-approval.md`：计划/执行模式 + 高风险动作人工审批（来自 InfiJob/InfiProject 两个消费项目方案的收敛）。
- 扫描器规则 `INF-API-001`（MEDIUM）：InfiniSynapse 集成文件里把信封成功码写成 `code===0`/`!==0` 时提示应为 `200`——反哺自两个真实消费项目都曾犯此错；含 `bad-wrong-success-code.ts` fixture。

#### Changed
- `docs/USAGE-GUIDE.md` 补充新项目/老项目接入流程，明确本仓库主入口是 AI 规则包 / skills，npm 仅用于验证和扫描。
- `docs/README.md`、`AGENTS.md`、`CLAUDE.md`、`llms.txt`、`CONTRIBUTING.md` 接入维护手册。
- `docs/playbooks/secure-integration.md` 的"服务端必须托管的状态"升级为可直接照搬的 `agent_tasks` 映射表（两个产品独立收敛）。
- `docs/README.md`、`AGENTS.md`、`llms.txt`、`tools/doctor.sh` 接入 plan-act-approval playbook；AGENTS §8 规则表加入 `INF-API-001`。
- `tools/doctor.sh` / `tools/test-suite.sh` 将维护手册、官网链接、npm 使用边界、skill 添加方式和老项目流程纳入验证。
- 反哺真实消费项目 smoke：补充 plan/act 下 `plan_mode_response`、success notification 完成信号、`api_req_failed` 失败信号、按 `taskId` 过滤 SSE、approve 前恢复 SSE、`cancelTask` 优先走 `/api/ai/message` 的接入建议。
- 反哺 InfiProject 端到端 smoke：补充 `getTaskWorkspace.files` 字符串/对象两种形态、空 `plan_mode_response`/prompt 回显不能触发审批、严格 JSON schema prompt 要列逐字字段名并禁止别名。
- 反哺真实 smoke 长文件循环：明确 bounded artifacts、业务总超时、失败取消、usage 记录和 workspace 恢复策略，避免把 smoke 当完整报告生成导致截断/补写循环。
- 反哺 ProjectValueLab Browser Use 安装页：补充 Chrome-only 友好提示、官方商店优先、官方可信域离线 ZIP fallback、版本/更新时间/SHA256、下载后下一步说明和浏览器验收清单。
- 反哺 ProjectValueLab 线上 review：补充 plan/act payload 级回归审查（默认值、`togglePlanActMode`、非 approve 路径）和 Browser Use 部署后 fresh-tab 验收（新 bundle hash、鉴权路由、GET 安装入口）。

#### Fixed
- TS/Python SDK multipart 上传现在和普通请求一致处理业务信封：`code !== 200`、token 失效码和 HTTP 错误都会抛 `InfiniSynapseError`，避免 HTTP 200 的上传业务错误被误当成功。
- 扫描器 `INF-ENV-003` 收紧 `AUTHING_SERVER_URL` 路径判断：只接受裸 `/api`，`/api/`、`/apix` 或其它路径都会提示。
- 清理 `docs/playbooks/downstream-projects.md` EOF 多余空行，保证 `git diff --check` 通过。
- 反哺 ProjectValueLab 市场调研真实任务：排查表新增 Agent 内部并行子任务（delegation）因账户级配额报 `Exceeded maximum API request limit (0)` 的症状——Agent 会自动回退主任务串行执行、产物不受影响；需要真正并行时应由业务后端自发多个 `newTask`。

## [0.3.5] - 2026-06-24

全项目审查（两路独立 agent + 自查）后修复真实代码 bug 与文档陈旧。

### Fixed（代码）
- **TS（高危）** `runTask` 上传与完成竞态：upload-ask 用 `void handleUpload` fire-and-forget，任务 promise 会先于上传 resolve（请求泄漏）且错误被吞——改为收集 `pendingUploads`，返回前 `await Promise.allSettled`。
- **扫描器（高危）** 块注释里的 token 与纯 ASCII 占位符被误判为硬编码 → `exit 2` 阻塞编辑——新增 `/* */` 块注释刷白 + 占位符跳过；加 `good-doc-tokens.ts` fixture 锁定。
- **TS/Python** 漏处理 SSE `message.update` 事件（文档列为"更新已有消息"）——两端纳入 `message.add`/`partial`/`update` 一并处理。
- **Python** `_multipart` 的 `json.loads` 无 try/except（非 JSON 上传响应会崩）；`download_task_file` 不处理 `HTTPError`——补齐，与 TS 一致抛 `InfiniSynapseError`。
- **TS/Python** 上传失败处理对齐：统一为"回 `{}` 不终止任务"，Python `_handle_upload` 改为 `except Exception` 兜底。

### Fixed（文档陈旧）
- README 测试计数 `37 → 44`；"高危"措辞改准确（仅 SEC/ENV 阻塞，SSE/DL 提醒）；项目结构树补 CHANGELOG/CONTRIBUTING/proposals 与 reference/playbooks 实际内容；`.claude/` 钩子位置说明纠正。
- `.agents/skills/manifest.json` 版本 `0.2.0 → 0.3.4`（并同步镜像）。
- `CLAUDE.md` 启动清单补 capabilities/glossary/playbooks；`docs/USAGE-GUIDE.md` 常见任务表补全新 playbook；`docs/PROJECT-ARCHITECTURE.md` 补 playbooks 分层；`docs/PLAN.md` 把已完成的 SSE 重连移出待办。

### Changed（测试）
- test-suite 补 `INF-DL-001` 规则断言与 `good-doc-tokens` 干净断言；reconnect 测试补 `message.update` 与上传 await 两个用例（TS 测试 22 项 / Python 15 项）。

## [0.3.4] - 2026-06-23

### Added
- `docs/playbooks/task-sharing.md`：任务分享 / 公开只读结果页。重点是安全：`setShare`/`shareStatus` 需所有者鉴权，但 `publicTask`/`publicMessagePayload`/`publicTaskFileTree`/`publicPreviewFile`/`publicDownloadTaskFile`/`publicDownloadZip` **无鉴权**——公开=任何拿到 taskId 的人都能读全部数据。含决策、流程、撤销、反模式、清单；端点经上游核对。

### Changed
- 接入 `docs/README.md` 导航、`AGENTS.md §9`、`llms.txt`、`tools/doctor.sh`。

## [0.3.3] - 2026-06-23

安全接入图示化；补市场订阅与 Browser Use 两份 playbook。

### Added
- `docs/playbooks/assets/secure-integration-trust-boundary.svg`：信任边界图（前端只持业务数据、后端持 Key 代理、前端直连为反模式），嵌入 `secure-integration.md` 决策表上方；自包含浅色背景，GitHub 明暗主题下均可读。
- `docs/playbooks/market-subscriptions.md`：共享数据源/知识库市场订阅（账号 API base、发现→只订免费→回 Server API enable 的往返、反模式与清单）。
- `docs/playbooks/browser-use.md`：是否需要 Browser Use 的决策 + 产品接入流程（建任务前查 session、引导安装、断连处理、UX 文案）。

### Changed
- `docs/README.md` 导航、`AGENTS.md §9`、`llms.txt` 接入两份新 playbook；`infinisynapse-browser-extension` skill 先读加入 browser-use playbook。
- `tools/doctor.sh` 检查新 playbook 与 SVG。
- 市场端点字段（`database_market_id`/`ragMarketId`/`subscribeSource`）经上游文档核对。

## [0.3.2] - 2026-06-23

按标准文档规范补齐 docs 缺口（安全、术语），并补全导航。

### Added
- `docs/playbooks/secure-integration.md`：安全接入 playbook——后端代理架构、API Key 生命周期、服务端必须托管的状态、决策表、推荐流程、反模式与检查清单（综合 AGENTS §3 + 模板 + 产品模式，链接不复述）。这是本项目的头号场景（防 Key 泄露），此前 docs 无专门页。
- `docs/reference/glossary.md`：易混术语速查（connId/taskId、sandbox vs workspace、两类上传、public-engine vs 独占、AUTHING_SERVER_URL、docDir、say/ask、completion_result 等），每条一句话 + 指向权威文档。

### Changed
- `docs/README.md` 导航补全：新增"安全接入""私有化部署""速查术语"阅读路径；目录分层补上此前漏列的 `docs/PLAN.md` 与 `docs/proposals/`。
- `AGENTS.md` 参考表、`llms.txt`、`infinisynapse-product-patterns` skill 接入两份新文档。
- `tools/doctor.sh` 检查新文档存在。

## [0.3.1] - 2026-06-23

按内容模型沉淀文档；对齐 `docs/playbooks/` 结构。

### Added
- `docs/reference/capabilities.md`：InfiniSynapse 能力总览（能力→端点的事实索引，补 api-index 的"端点视角"所缺的"能力视角"），端点经上游文档逐条核对。
- `docs/playbooks/troubleshooting.md`：跨 Server API / 私有化部署 / CLI 的症状→原因→处理排查表（此前散落各处）。

### Changed
- `docs/README.md` 导航、`AGENTS.md` 参考表、`llms.txt` 阅读顺序接入两份新文档。
- `infinisynapse-server-api` skill 先读加入 capabilities；`infinisynapse-deployment` skill 先读加入 troubleshooting。
- `tools/doctor.sh` 检查新文档存在。
- 结构判断：当前 `docs/` 分层（reference 事实 / playbooks 特定用法 / proposals 方案 + README 导航）已最合理，未重构，新文档对齐落位。

## [0.3.0] - 2026-06-23

SSE 重连完整实现，并修复 SDK 在 Node strip-types 下无法 import 的可移植性 bug。

### Added
- **SSE 重连（TS + Python，默认开启）**：指数退避（`nextBackoffMs`/`next_backoff_seconds`，封顶）+ 心跳看门狗（`heartbeatTimeoutMs` 内无任何事件即重连）+ `getUiMessageById` 断点续传（`selectMissedMessages` 按 ts 去重补回错过消息）。`runTask` 结果新增 `reconnects` 计数；`reconnect: { enabled: false }` 可关闭。
- TS `src/reconnect.ts` 纯函数 + `test/reconnect.test.ts`：3 项纯函数测试 + 4 项用 fake-client 真实走"断开→重连→完成 / catch-up 补回 / 关闭重连即判错"的离线集成测试。
- Python `next_backoff_seconds` / `select_missed_messages` + 单测。

### Fixed
- **可移植性（高危）** `InfiniSynapseError` 用了 TS 构造函数参数属性（`readonly opts`），Node `--experimental-strip-types` strip-only 模式不支持，导致 `client.ts` 及整条依赖链**实际无法被 import**（之前只做了 `--check` 语法检查，没 import 过 client，未暴露）。改为显式字段赋值。重连集成测试 import 全链路时发现。

## [0.2.1] - 2026-06-23

提交后完整复查发现并修复参考 SDK 的真实正确性问题（独立审查 + 自检）。

### Fixed
- **Python（高危）** `run_task` 因 `open_events` 是惰性生成器，实际"先发 newTask 后连 SSE"，违反本项目核心铁律——改为 `open_events_response()` 立即 urlopen 建连，严格先连后发。
- **Python（高危）** `run_task` 无超时会永久阻塞——加 `max_seconds` 死线 + `read_timeout` 周期检查。
- **两端** 流式 `message.partial` 文本无脑 `+=`，服务端发累积快照时会重复拼接——改为按消息 `ts` 覆盖累积（新增纯函数 `TextAccumulator` + 离线单测）。
- **TypeScript** `upload_file_to_sandbox` 在 partial 分片上重复触发多次上传——按 `ts` 去重。
- **两端** 信封解包未校验 `code===200`，HTTP 200 + 业务错误码会被当成功——非 200 业务码改为抛错。
- **TypeScript** `runTask.ts` `status = status === "error" ? "error" : "error"` 死代码清理。

### Added
- Python 客户端补 `upload_to_sandbox` / `task_upload`（标准库 multipart），`run_task` 支持 `on_upload_request` 回调，与 TS 版能力对齐。
- `TextAccumulator` 累积器（TS `src/accumulate.ts` + Python）+ 4~5 项离线单测；test-suite 自动覆盖。

## [0.2.0] - 2026-06-23

把规则包从「文档 + 规则」升级为「文档 + 规则 + 可跑 SDK + 实时护栏 + 真回归」。

### Added
- **可跑的 SDK 参考实现**
  - `samples/sdk/typescript/`：零依赖 `InfiniSynapseClient`、纯函数 `SseParser`、高阶 `runTask`、Express 后端代理示例、离线 SSE 单测（Node 22 `--experimental-strip-types`）。
  - `samples/sdk/python/`：标准库 `InfiniSynapseClient` + `SseParser` + `run_task` + 离线 unittest。
  - `samples/templates/curl-quickstart.md`：纯 curl 跑通一次长任务。
  - `samples/README.md`：样例索引。
- **PostToolUse 护栏**
  - `tools/hooks/lib/scan-infinisynapse.sh`：7 条规则 `INF-SEC-001/002`、`INF-SSE-001`、`INF-DL-001`、`INF-ENV-001/002/003`，分级退出码（HIGH→2 / MEDIUM→1 / clean→0），支持 `--json`/`--stats`。
  - `tools/hooks/post-edit.sh` + `lib/parse-hook-input.sh`：钩子入口，写 `.claude/.infinisynapse-last-scan.txt`。
  - `.claude/settings.json`：接线 PostToolUse。
  - `tools/hooks/test-fixtures/`：7 个 good/bad fixture。
  - `tools/hooks/examples/`：git pre-commit、GitHub Action 复用示例。
- **规范参考文档**
  - `docs/reference/api-index.md`：端点总目录（单一事实基准，标注二进制端点）。
  - `docs/reference/task-lifecycle.md`：SSE 事件、消息字段、完整时序、恢复、取消。
- **防漂移机制**
  - `tools/sync-skills.sh`：`.agents/skills`（唯一源）→ `.claude/skills` 单向镜像 + `--check`。
  - `.agents/skills/manifest.json` 升级：`triggers`/`criticality`/`fanout`/`references`/`guardrails`。
- **治理**：本 CHANGELOG、`CONTRIBUTING.md`、`docs/LICENSE-NOTES.md`、`.github/workflows-templates/ci.yml.template`。

### Changed
- `tools/test-suite.sh` 重写为真回归：fixture 退出码断言、SDK 离线测试、TS/Python 语法检查、skill 镜像一致、manifest 合法性、api-index 与上游端点抽样对齐。
- `tools/doctor.sh` 增加对钩子、扫描器、SDK、参考文档、镜像一致性的检查，并对 good/bad fixture 做扫描器自检。
- `AGENTS.md` / `CLAUDE.md` / `llms.txt` / `README.md`：加入护栏、SDK、参考文档入口。
- `package.json`：新增 `sync:skills`、`scan` 脚本；版本 0.2.0。
- 各 skill `先读` 区指向 `docs/reference/` 与 `samples/sdk/`。

## [0.1.0] - 2026-06-23

### Added
- 中文 SaaS/API 文档快照（Server API、私有化部署、CLI、Chrome 插件）+ 英文补充 + 截图。
- 跨工具入口 `AGENTS.md`/`CLAUDE.md`/`llms.txt`；5 个 skill；`.cursor`/`.github` fan-out。
- `tools/sync-upstream-docs.sh`、`doctor.sh`、`test-suite.sh`；`docs/` 审计/速查/架构/计划。
