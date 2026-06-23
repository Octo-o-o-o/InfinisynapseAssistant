# Changelog

本项目变更记录，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。
版本对应规则包成熟度，不对应 InfiniSynapse 官方版本。

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
