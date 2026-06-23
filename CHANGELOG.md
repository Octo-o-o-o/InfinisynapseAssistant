# Changelog

本项目变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。
版本对应规则包成熟度，不对应 InfiniSynapse 官方版本。

## [Unreleased]

### Added
- `docs/MAINTENANCE.md`：上游同步、影响判断、派生文档更新、发布前检查的维护手册。
- README 增加 InfiniSynapse 官网、中文文档、国内 SaaS 控制台和海外 SaaS 链接。
- `docs/playbooks/plan-act-approval.md`：计划/执行模式 + 高风险动作人工审批（来自 InfiJob/InfiProject 两个消费项目方案的收敛）。
- 扫描器规则 `INF-API-001`（MEDIUM）：InfiniSynapse 集成文件里把信封成功码写成 `code===0`/`!==0` 时提示应为 `200`——反哺自两个真实消费项目都曾犯此错；含 `bad-wrong-success-code.ts` fixture。

### Changed
- `docs/USAGE-GUIDE.md` 补充新项目/老项目接入流程，明确本仓库主入口是 AI 规则包 / skills，npm 仅用于验证和扫描。
- `docs/README.md`、`AGENTS.md`、`CLAUDE.md`、`llms.txt`、`CONTRIBUTING.md` 接入维护手册。
- `docs/playbooks/secure-integration.md` 的"服务端必须托管的状态"升级为可直接照搬的 `agent_tasks` 映射表（两个产品独立收敛）。
- `docs/README.md`、`AGENTS.md`、`llms.txt`、`tools/doctor.sh` 接入 plan-act-approval playbook；AGENTS §8 规则表加入 `INF-API-001`。
- `tools/doctor.sh` / `tools/test-suite.sh` 将维护手册、官网链接、npm 使用边界、skill 添加方式和老项目流程纳入验证。

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
