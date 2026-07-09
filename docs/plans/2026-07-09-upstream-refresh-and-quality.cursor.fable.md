# 2026-07-09 上游刷新 + 质量补强方案（调研与思考记录）

> 工作稿性质：本文件是本轮"互联网调研 → 找差距 → 更新规则包"的思考与方案记录，供 review 与实施对照。
> 规则事实以 `docs/reference/` 与 `upstream-docs/` 为准，本文不是规范入口。
> 基线：branch `codex/desktop-native-byok-playbook`（含 main 未合并的 BYOK 提交），`npm test` 65 项全绿。

## 1. 调研结论 TL;DR

1. **官方文档发生了实质变化**：docs 站从 5 页扩到 8 页；Server API Reference 新增整节「Skill 管理」；新增 Partner SSO（第三方登录 + Partner API Key）能力；官方发布了《Existing Product Integration Playbook》和《Vibe Coding Guide》（后者还显式引用了本仓库）。本仓库 `tools/sync-upstream-docs.sh` 只抓旧 5 页，**新页面完全不在快照里**，这是当前最大疏漏。
2. **CLI 生态变化**：`agent_infini` 已开源（`github.com/chaozwn/infinisynapse-cli`，MIT，Go）；官网提供一键安装 `curl -fsSL https://infinisynapse.cn/cli-install/install.sh | bash`（同时安装 CLI + companion skill）；支持 `--update` 自动更新与 `--skill` 输出 AI Agent 规范。CLI skill 需要补这些事实。
3. **仓库自身漂移**：manifest 版本落后（0.3.4 vs 0.3.5）且 guardrails 漏 `INF-API-001`；fixtures README 漏两个 fixture；`PLAN.md` / `PROJECT-ARCHITECTURE.md` 的 playbook 清单滞后；api-index「最后核对 2026-06-23」已过期；本仓库自身没启用 CI（只有模板）。
4. **鸿蒙（HarmonyOS）完全空白**：仓库无任何 ArkTS/鸿蒙内容；`desktop-native-byok.md` 只泛提 iOS/Android。扫描器不识别 `.ets` 文件，鸿蒙客户端直连 InfiniSynapse 不会被拦。
5. **测试/评估是结构性缺口**：SDK 只有离线纯函数单测，无 HTTP 集成测试、无 mock server、无 opt-in 真实 smoke、无「如何测试/评估你基于 InfiniSynapse 做的 app」的 playbook（README 的"当前限制"也承认这点）。

## 2. 官方文档变化清单（已核实）

来源：2026-07-09 运行 `bash tools/sync-upstream-docs.sh` 的 git diff + 逐页在线核对 `https://www.infinisynapse.cn/zh/docs`。

### 2.1 docs 站页面：5 → 8

| 页面 | 状态 | 本仓库现状 |
| --- | --- | --- |
| Chrome Plugin Install | 已有 | 快照正常 |
| InfiniSynapse CLI API Reference | 已有 | 快照正常（本次仅样式 diff） |
| InfiniSynapse Private Deployment Guide | 已有 | 快照正常 |
| InfiniSynapse Server API Reference | 已有，**内容大改** | 快照已更新（本次 sync 拉到） |
| **Connect Data Sources and Knowledge Base** | 新增 | ❌ 不在 sync 脚本 |
| **InfiniSynapse Existing Product Integration Playbook** | 新增（官方版接入 playbook，引用本仓库） | ❌ 不在 sync 脚本 |
| **InfiniSynapse Partner SSO Integration Guide** | 新增 | ❌ 不在 sync 脚本 |
| **InfiniSynapse Vibe Coding Guide** | 新增（官方一页式 SKILL.md 格式指南） | ❌ 不在 sync 脚本 |

### 2.2 Server API Reference 新增内容（zh 快照 diff 已确认）

- 新增第 6 节 **Skill 管理**，原 6-10 节顺延为 7-11：
  - 已安装 Skill 管理（Server API，前缀 `/api/ai_skill`）：`install`、`update`、`uninstall`、`toggleStatus`、`installedVersions`、`list`
  - 本地 Skill 上传：`upload`（zip 内任意层级含 `SKILL.md`）、`editLocal`、`deleteLocal/:id`
  - Skill 市场发现（账号 API `https://api.infinisynapse.cn/api`）：`/skill/public/getSkillList`、`/skill/getSkillTags`、`/skill/downloadSkill`
  - **两类 Skill 边界**：用户级 Skill（`/api/ai_skill/*` 安装，`use_skill` 可复用）vs 单次任务 Skill 上下文（报告快写模式：目录树进 prompt，文件走 `upload_file_to_sandbox` 链路，不进用户 Skill 库）
- 典型调用流程加入「准备 Skill」步骤；组合原则加入「区分两类 Skill」。

### 2.3 Partner SSO Integration Guide（新能力，账号 API）

- OAuth 授权码式流程：`POST /api/auth/partner/sessions`（创建会话拿 `entryUrl`）→ 用户在 app 域登录 → 回调带一次性 `code`（5 分钟）→ `POST /api/auth/partner/token` 换用户资料。
- 服务端鉴权用 `X-Client-Id` + `X-Client-Secret`；接入应用管理 `POST/GET/PATCH /api/auth/partner/clients`、`/enabled`、`/rotate-secret`。
- `withApiKey: true` 可同时签发 **Partner API Key**（`sk-` 开头，归属用户本人、计费记用户账上、用户可吊销、上限 20 个签发可能失败要降级）。
- Webhook `partner.session.completed` + `X-Infini-Signature`（HMAC-SHA256）验签；轮询 `GET /api/auth/partner/sessions/{sessionId}` 适配桌面端。
- 官方示例明确 `newTask` 幂等语义：客户端生成 `taskId`（UUID），重复提交同一 `taskId` 不重复建任务。

### 2.4 CLI 生态

- 开源仓库 `github.com/chaozwn/infinisynapse-cli`（MIT，README 已核对）；官网一键安装脚本同时装 CLI + companion skill；默认安装位置 `~/.infini/bin/agent_infini`；`--update` 走 OSS manifest + SHA256 校验；`--skill` 输出 AI Agent 规范。
- `infini_docker` 仍 404（2026-07-09 `git ls-remote` 复测）。

## 3. 类似项目借鉴评估（精简 borrow-assess）

| # | 对象 | 可借点 | 本仓库现状 | 裁决 | 理由 |
| --- | --- | --- | --- | --- | --- |
| B1 | 官方 Vibe Coding Guide + 3 个新文档页 | 官方事实源 | sync 脚本只抓 5 页 | **A 直接借** | 扩 sync 脚本 + doctor + SOURCE-AUDIT，成本低、事实价值高 |
| B2 | anthropics/skills（Agent Skills 标准） | SKILL.md<500 行、渐进披露、"evals 先行" | skills 偏长但可用；无 evals | **B 改造借** | 不引入 evals 框架；把"黄金任务 + 断言"思路写进测试 playbook；新写的 skill/playbook 遵守短文档规范 |
| B3 | devops-ai-skill 等的多平台安装脚本 | 一键把 skills 装进目标项目 | USAGE-GUIDE 只有手工步骤 | **B 改造借** | 写最小 `tools/install-into.sh`（复制 skills+规则入口到下游项目并打印接线说明），自动化已有约定，不新增概念 |
| B4 | 通用 SDK 项目的 mock server 惯例 | 离线集成测试 | 只有纯函数单测 | **A 直接借** | 零依赖 Node mock（SSE+message+workspace），同时补 TS SDK 集成测试缺口 |
| B5 | anthropics/skills 的 LLM grader / benchmark 框架 | 自动评分 | 无 | **C 不借** | 对规则包投入产出不成比；决策类产品已有 decision-quality-loop 的离线 benchmark 口径 |
| B6 | infinisynapse-cli（MIT）源码 | CLI 事实 | cli skill 缺安装/开源信息 | **A 直接借（只借事实）** | MIT 允许引用；只更新 skill 文字事实，不复制代码 |

红线检查：无 GPL/AGPL 引入；不削弱现有安全边界（新增内容全部沿用"Key 只在可信后端边界"）；不把官方框架/CLI 代码搬进仓库。

## 4. 仓库不足 / 错误 / 疏漏清单（本轮确认）

### 4.1 硬错误 / 漂移（必修）

| # | 问题 | 证据 |
| --- | --- | --- |
| E1 | sync 脚本、doctor、SOURCE-AUDIT 不覆盖 4 个新官方页面 | `tools/sync-upstream-docs.sh` 只列 5 页 |
| E2 | `api-index.md` 缺 Skill 管理 + Partner SSO 端点；核对日期过期 | zh server-api diff、Partner SSO 页 |
| E3 | `.agents/skills/manifest.json` 版本 0.3.4 落后 package.json 0.3.5；guardrails 缺 `INF-API-001` | 两文件对照 |
| E4 | `tools/hooks/test-fixtures/README.md` 漏 `bad-wrong-success-code.ts`、`good-doc-tokens.ts` | 目录清单对照 |
| E5 | `docs/PLAN.md`、`docs/PROJECT-ARCHITECTURE.md` playbook 清单滞后（缺 llm-routing、artifact-archiving、decision-quality-loop、desktop-native-byok 等） | 子代理审计 |
| E6 | 本仓库未启用 CI，push 到 GitHub 无自动验证 | `.github/workflows/` 不存在 |
| E7 | 扫描器对不存在的文件路径 exit 0（CI wrapper 传错路径会假绿） | `scan-infinisynapse.sh` usage 分支 |
| E8 | capabilities.md 引用的 server-api 章节号因上游重编号漂移（§6 文件上传→§7 等） | 上游 diff |

### 4.2 结构性缺口（本轮补）

| # | 缺口 | 对应用户诉求 |
| --- | --- | --- |
| G1 | 无鸿蒙/HarmonyOS 集成指引；扫描器不识别 `.ets` | "让开发者做出来的鸿蒙 app 质量更好" |
| G2 | 无「测试与评估 app」playbook；SDK 无集成测试、无 mock、无真实 smoke | "是否还可以加测试和评估 app 的部分" |
| G3 | 两类 Skill、Partner SSO 这类新能力没有任何派生规则（skills/playbooks/reference 均缺） | "官方文档是否有变化" |
| G4 | 下游接入仍是手工步骤，无一键安装 | "方便开发者" |

### 4.3 已知但本轮不做（防过度设计，列 backlog）

- 拆分超长 playbook（artifact-archiving 等）：churn 大、收益低。
- ArkTS 完整 sample SDK：本仓库无法编译验证 ArkTS，写大段不可验证代码风险高于收益；playbook 内嵌最小参考片段即可。
- TS/Python SDK 封装 Skill 管理、市场、Partner SSO 端点：api-index 先行，封装列 backlog。
- 跨文件 SSE 顺序检测、可观测性/成本控制/多租户深度 playbook：非本轮核心诉求。
- LLM grader / evals 框架（B5 已裁决不借）。

## 5. 实施方案（分阶段，含验收）

### P0 上游事实刷新（E1、E2、E8、部分 G3）

1. `tools/sync-upstream-docs.sh`：新增 4 页 zh/en 抓取与转换；运行一次生成快照。
2. `tools/doctor.sh`：require 新增的 8 个 markdown 快照。
3. `docs/SOURCE-AUDIT.md`：更新为 2026-07-09 审计（8 页清单、CLI 开源仓库可用、infini_docker 仍 404）。
4. `docs/reference/api-index.md`：新增「Skill 管理」「Partner SSO（账号 API）」两节；补 `newTask` 客户端 `taskId` 幂等注记；更新核对日期；**头部"只收录 server-api-reference.md"的收录范围声明改为列出全部上游事实页**。
5. `docs/reference/capabilities.md`：新增 Skill 管理、Partner SSO 能力行；**逐行核对上游重编号后的章节引用（文件上传 §6→§7、存储下载 §7→§8、错误 §8→§9、流程 §9→§10、场景 §10→§11）**；补官方 apps 页参考。
6. `docs/reference/task-lifecycle.md`：标准时序加「（可选）准备 Skill」步骤。
7. `docs/reference/glossary.md`：新增 用户级 Skill / 任务级 Skill 上下文 / Partner API Key / `X-Client-Id·X-Client-Secret` 词条。
8. `docs/playbooks/rag-file-placement.md`：决策表加一行「方法论/SKILL.md 上下文放哪」。
9. `docs/MAINTENANCE.md`：上游同步流程注明现在共 8 页；影响判断表新增「Skill 管理 / Partner SSO 变化」行。
10. skills 更新（唯一源 `.agents/skills/` → sync 镜像）：
   - `infinisynapse-server-api`：Skill 管理端点、两类 Skill 边界、Partner SSO 何时用、章节号更新。
   - `infinisynapse-cli`：官方安装脚本、开源仓库（MIT）、`--update`/`--skill`、安装位置。
   - `infinisynapse-product-patterns`：报告快写 Skill 上下文模式、官方 apps 页、Partner SSO 登录模式一句话入口。

验收：`git diff` 全部可追溯到上游快照；`npm test` 中 api-index 对齐抽样通过并新增 `ai_skill` 抽样。

### P1 鸿蒙 App 支持（G1）

1. 新 playbook `docs/playbooks/harmonyos-app-integration.md`：
   - 架构决策：鸿蒙 app 默认走自有后端代理（Key 不进 app 包）；个人单机 BYOK 的有限例外（用户自己的 Key + Asset Store Kit 安全存储 + 风险边界），对齐 `desktop-native-byok.md` 口径。
   - SSE 消费：`@ohos.net.http` `requestInStream` + `on('dataReceive')` + `util.TextDecoder` 手写 SSE 解析（原生 EventSource 不支持自定义 header/POST）；Remote Communication Kit 流式作为替代；心跳/重连/按 `taskId` 过滤沿用 task-lifecycle。
   - 生命周期：切后台/被杀后的恢复（`getUiMessageById` + `getTaskWorkspace`）；长任务由后端 worker 托管，不依赖 app 常驻。
   - 文件链路：picker → 自有后端 → `taskUpload`；产物二进制流保存/预览。
   - 诚实边界：Browser Use 依赖桌面 Chrome 扩展，鸿蒙 app 端无法提供页内浏览器自动化；若产品需要 Browser Use，插件装在用户桌面 Chrome 上、任务仍可由 app 发起，且建任务前必须查 `/api/ai_browser/session`。
   - 质量清单：弱网重连、partial 合并进度 UI、错误面（1101/422/额度）、取消、`module.json5` 网络权限、不落明文 Key、HTTPS。
   - 内嵌最小 ArkTS SSE 参考片段（镜像已测试的 TS 解析逻辑，标注需 DevEco 验证）。
2. 扫描器：`.ets` 加入扫描/钩子扩展名；INF-SEC-002 前端特征增加 ArkTS 特征（`@ohos.`、`@kit.`、`@Component`、`@Entry`）；新增 fixtures：`bad-harmonyos-direct.ets`（exit 2）、`good-harmonyos-proxy.ets`（exit 0，连自家后端）；test-suite 断言。
3. `desktop-native-byok.md` 移动端小节补一句指向鸿蒙 playbook。

验收：两个新 fixture 退出码断言通过；`npm run scan -- bad-harmonyos-direct.ets` 输出 INF-SEC-002。

### P2 测试与评估（G2、B4）

1. 新 playbook `docs/playbooks/testing-and-evaluation.md`：
   - 测试金字塔：纯函数单测（SSE/信封/累积）→ mock server 集成测试（离线）→ opt-in 真实 API smoke（需 Key）→ production preflight（引用现有）。
   - App 评估：黄金任务集（每产品 3-5 个代表输入）、产物断言（必需文件/schema/引用来源）、评估维度（正确性、完整性、可追溯、时延、成本）、回归时机（上游 sync 后、prompt/模型变更后、发版前）。
   - 与 `decision-quality-loop.md`（线上业务闭环）的分工声明。
2. `samples/mock-server/`：零依赖 Node mock InfiniSynapse（`/api/ai/events` SSE、`/api/ai/message`、`getUiMessageById`、`getTaskWorkspace`、`previewFile`、`downloadTaskFile`、`ping`），场景可配置（正常完成 / 请求上传 / 失败）；README 说明用法与边界（不是官方模拟器，行为以真实 API 为准）。
3. TS SDK 集成测试：`test/integration-mock.test.ts` 用 mock server 跑 `runTask` 全链路（含 upload ask 分支），纳入 `npm test`。
4. `samples/sdk/typescript/examples/live-smoke.ts`：opt-in 真实 smoke（`INFINISYNAPSE_API_KEY` 缺失则提示退出），README 标注会产生真实计费。
5. `docs/QUICK-REFERENCE.md` 加「测试与评估」小节；USAGE-GUIDE 常见任务表加行。

验收：`npm test` 新增 mock 集成测试并全绿；无 Key 环境 live-smoke 不进默认测试路径。

### P3 工程一致性与开发者便利（E3-E7、G4、B3）

1. manifest：版本对齐 0.4.0；guardrails 补 `INF-API-001`；platform.verified_against 更新；**product-patterns 的 primary_doc 锚点 `#10` 改 `#11`（上游重编号）**。
2. fixtures README 补全两个缺失条目。
3. `docs/PLAN.md`（完成项 + 新 backlog）与 `docs/PROJECT-ARCHITECTURE.md`（playbook 全清单）刷新。
4. 启用 CI：模板落地为 `.github/workflows/ci.yml`（doctor + npm test + sync-skills --check）。
5. 扫描器：不存在的文件路径 → stderr 提示 + exit 64；test-suite 加断言。
6. `tools/install-into.sh`：把 `.agents/skills/`、`AGENTS.md` 引用段、扫描器接线说明安装到目标项目（幂等、dry-run 支持）；USAGE-GUIDE、downstream-projects 指向它；test-suite 加最小行为断言（临时目录安装后关键文件存在）。
7. 入口文件同步：AGENTS.md（skills 触发表 + 第 9 节新 playbook 行 + 测试/鸿蒙一句话硬约束入口）、CLAUDE.md、llms.txt、README.md（新页面、能力、验证状态数字、当前限制修订）、`.cursor/rules`、`.github/copilot-instructions.md`（各加 1-2 行，保持短）。
8. CHANGELOG：0.4.0 条目；package.json 0.4.0。
9. `docs/README.md` 导航加两个新 playbook 与本方案文档定位说明。

验收：`bash tools/doctor.sh`、`npm test`、`bash tools/sync-skills.sh --check`、`git diff --check` 全绿；README 验证状态数字与实际输出一致。

## 6. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 新官方页面内容再变，快照与派生文档漂移 | 全部派生内容标注出处页；MAINTENANCE 影响判断表加「Skill/SSO 变化」行 |
| mock server 行为与真实 API 偏差误导开发者 | README/playbook 双处声明"mock 仅覆盖本仓库文档化行为，联调以真实 API 为准" |
| ArkTS 片段无法本地编译验证 | 只给最小片段并标注"需 DevEco Studio 验证"；解析逻辑镜像已测试的 TS 实现 |
| `.ets` 规则误报（后端 harness 用 .ets？几乎不存在） | good fixture 覆盖"连自家后端"场景；INF-SEC-002 仍要求同时命中直连特征 |
| CI 在 GitHub runner 上因网络 WARN 而失败 | doctor 网络检查本就是 WARN 不 fail；CI 模板已验证过这些步骤 |

## 7. Review 记录（方案自查）

- [x] 每条更新可追溯到上游文档或本轮实测证据（第 2 节）。
- [x] 无重复维护官方原文：新 reference 条目只做索引，正文留在快照。
- [x] 「为了做而做」检查：第 4.3 节明确不做清单（evals 框架、ArkTS SDK、SDK 新端点封装、跨文件扫描、可观测性 playbook）。
- [x] 鸿蒙与测试两个新 playbook 都解决"跨章节组合 + 高风险误用"（符合 CONTENT-MODEL 新增特定用法的条件）。
- [x] 安全红线只加强未放松（.ets 扫描是新增拦截面）。
- [x] 验收命令明确（doctor / npm test / sync-skills --check / git diff --check）。

### Review 后的方案修正

1. ~~原考虑给 TS SDK 直接加 Skill 管理方法~~ → 降级为 api-index + skill 文档先行，SDK 封装列 backlog（避免在无真实联调条件下扩 SDK 表面积）。
2. ~~原考虑新增独立 INF-SEC-003 规则~~ → 并入 INF-SEC-002（语义同为"客户端直连"），减少规则 ID 增殖。
3. `install-into.sh` 限定为"复制 + 打印接线说明"，不改目标项目的 package.json（避免侵入下游工程）。
4. mock server 放 `samples/mock-server/`（可复制资产）而非 `tools/`（仓库自用工具），与"samples=可内化骨架"的现有定位一致。

## 8. 实施对账（2026-07-09 实施后回读）

| 阶段 | 状态 | 验证 |
| --- | --- | --- |
| P0 上游事实刷新（10 项） | ✅ 全部完成 | 8 页 zh/en 快照生成；api-index/capabilities/glossary/task-lifecycle/rag-file-placement/MAINTENANCE/3 个 skill 已更新；`npm test` 含 `/api/ai_skill/upload` 对齐抽样 |
| P1 鸿蒙支持 | ✅ 完成 | `harmonyos-app-integration.md`；扫描器 `.ets` + ArkTS 特征；`bad-harmonyos-direct.ets` exit 2 / `good-harmonyos-proxy.ets` exit 0 断言通过 |
| P2 测试与评估 | ✅ 完成 | `testing-and-evaluation.md`；mock server + 4 个集成测试进 `npm test`；`smoke:live` 无 Key 时 exit 2 提示 |
| P3 工程一致性（9 项） | ✅ 完成 | manifest 0.4.0 + INF-API-001；fixtures README 补全；PLAN/ARCHITECTURE 刷新；CI 启用；扫描器缺失文件 exit 64；install-into 幂等断言；入口文件 fan-out；CHANGELOG 0.4.0 |

最终验证（本机实测输出）：

```text
npm test: PASS=80 FAIL=0 SKIP=0（基线 65 → 80）
bash tools/doctor.sh: PASS（仅 infini_docker 缺失、上游 GitHub 不可达两条预期 WARN）
bash tools/sync-skills.sh --check: PASS
git diff --check: 干净
```

实施与方案的偏差：无功能性偏差；实施中额外修正了 CHANGELOG 的 Unreleased 归并（0.3.5 后累积项并入 0.4.0 发布说明）。

## 9. Subagent review 结论与修复（2026-07-09）

code-reviewer 子代理评审 5 个提交：无 BLOCKER，2 MAJOR / 3 MINOR / 3 NIT，已全部修复并回归：

| 级别 | 问题 | 修复 |
| --- | --- | --- |
| MAJOR-1 | `INF-SEC-002` 的 `@Component` 特征未限定 `.ets`，Java/Kotlin Spring 后端代理被误报 HIGH（实测复现） | 装饰器特征仅 `.ets` 生效；`@ohos./@kit.` 保持全扩展名；新增 Angular 前端特征 `from '@angular/` 保住正报面；新增 `good-spring-backend-proxy.java`（exit 0）/`bad-angular-direct.ts`（exit 2）fixtures + 断言 |
| MAJOR-2 | 鸿蒙片段把 `requestInStream` 的 Promise resolve 当"流结束"（Promise 在响应头到达即 resolve） | 完成信号改 `on('dataEnd')`，Promise 只校验响应码；注意事项补充语义说明 |
| MINOR-1 | 下游 CI 扫描示例扩展名缺 `.ets`（及 `.cjs/.kt/.rb/.php`） | 与 post-edit.sh 对齐 |
| MINOR-2 | 鸿蒙 SSE 片段缺 CRLF 归一化，与 sse.ts 口径不符 | buffer 拼接前归一化 `\r\n`/`\r` |
| MINOR-3 | `install-into.sh` 重复安装空行累积 | 删块时吃掉尾部空行；实测 3 次重装 max 连续空行 = 1 |
| NIT-1/2/3 | manifest 未镜像 `.claude/skills`、`grep -c \|\| echo 0` 双行输出、api-index 头部措辞 | 全部修复 |

修复后回归：`npm test PASS=80 FAIL=0`，doctor / sync-skills --check / git diff --check 全绿。

## 10. 第二轮复审与修复（2026-07-09，推送前最终把关）

### 自查修复

- 扫描器示例 `codex-precommit.sh` 与 `.github/instructions` 扩展名列表补 `.ets` 等，对齐 post-edit.sh。
- TS SDK `npm run typecheck` 修为真实可过：补 `@types/node`（含 lockfile）、mock server 补 `server.d.mts` 类型声明、可选依赖 express 的示例从类型检查排除；实测 `tsc --noEmit` exit 0。
- `CONTENT-MODEL.md` 文件放置表补方法论/`SKILL.md` 行；CHANGELOG 折叠段标题层级规范化；TS SDK README 文件表补全。

### Bugbot 全量 diff 复审（5 项，全部修复并实测）

| 级别 | 问题 | 修复与验证 |
| --- | --- | --- |
| HIGH | mock server CLI 入口用 `file://${argv[1]}` 判断主模块，相对路径启动时永不匹配、进程直接退出 | 改 `pathToFileURL(argv[1]).href`；实测 `node samples/mock-server/server.mjs --port 8790` 正常启动并响应 ping |
| HIGH | `install-into.sh` 重装时若 end 标记缺失，awk 会把标记后的原有内容整段删除 | 加护栏：begin 在而 end 缺 → 报错 exit 65 不动文件；实测用户内容保留 |
| MEDIUM | begin 检测用子串（grep -F）而删除用整行精确匹配（awk `$0==`），标记行带尾随空格时旧块删不掉、新块又追加 → 重复托管块 | awk 改 `index()` 子串匹配，与 grep 语义一致；实测尾随空格重装后标记仍唯一 |
| MEDIUM | doctor 漏 require `desktop-native-byok.md`（及 llm-routing/existing-product-integration/artifact-archiving/decision-quality-loop） | 5 个 playbook 全部纳入 require_file |
| MEDIUM | `llms.txt` skills 清单未反映 Skill 管理 / Partner SSO / CLI 开源 | 已更新 |

附带发现：macOS bash 3.2 会把 `$END_MARK）`（全角括号紧邻变量）并入变量名导致 unbound variable，改用 `${END_MARK}` 显式界定。

复审后回归：`npm test PASS=80 FAIL=0`、doctor 全绿、typecheck exit 0、mock CLI 与 install-into 边界均实测通过。
