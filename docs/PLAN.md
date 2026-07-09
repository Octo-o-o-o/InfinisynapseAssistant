# 计划

## 初始搭建已完成（0.1.0）

- 中文/英文 SaaS/API 文档拉取并转 Markdown；下载 Chrome 插件图与 Server API 截图。
- 验证 `infini_docker` GitHub 仓库当前 404。
- 跨工具入口 `AGENTS.md`/`CLAUDE.md`/`llms.txt`；5 个任务型 skills；同步/体检/测试脚本。

## 成熟化已完成（0.2.0）

- ✅ Node.js / Python 服务端集成 SDK 示例（`samples/sdk/`，零依赖 + 离线单测）。
- ✅ SSE 解析示例，覆盖分片、多行、心跳、完成判定（纯函数 + TS/Python 双实现单测）。
- ✅ 规范参考文档：`docs/reference/api-index.md`、`task-lifecycle.md`。
- ✅ 实时护栏：`tools/hooks/` 扫描器（INF-SEC/SSE/DL/ENV）+ PostToolUse 钩子 + fixtures。
- ✅ 真回归测试：fixture 退出码、SDK 单测、镜像一致、端点对齐。
- ✅ 防漂移：`tools/sync-skills.sh` + 升级版 `manifest.json`。
- ✅ 治理：`CHANGELOG.md`、`CONTRIBUTING.md`、`docs/LICENSE-NOTES.md`、CI 模板。

## 文档与 SDK 增强已完成（0.3.x）

- ✅ SSE 重连：指数退避 + 心跳看门狗 + `getUiMessageById` 断点续传（TS/Python，含单测）。
- ✅ 参考扩充：`docs/reference/capabilities.md`（能力总览）、`glossary.md`（术语）。
- ✅ Playbooks：LLM 路由、安全接入、桌面/原生 BYOK、成熟产品接入、RAG/文件放置、市场订阅、Browser Use、任务分享、计划/执行审批、产物归档、决策质量闭环、下游项目反哺、排查；安全接入含信任边界 SVG。
- ✅ 扫描器健壮性：块注释刷白 + 占位符跳过，消除 token 误报 HIGH；新增 `INF-API-001`（信封成功码）。
- ✅ 维护规范：`docs/MAINTENANCE.md`，覆盖上游同步、影响判断、派生文档更新和发布前检查。

## 上游刷新与质量补强已完成（0.4.0，2026-07-09）

- ✅ 上游同步扩到 8 页（新增 Connect Data、官方 Existing Product Integration Playbook、Partner SSO、Vibe Coding Guide），`sync-upstream-docs.sh` 页面清单数组化。
- ✅ 事实基准补齐：api-index 新增 Skill 管理（`/api/ai_skill/*` + Skill 市场）与 Partner SSO（`/api/auth/partner/*`）；capabilities/glossary/task-lifecycle/MAINTENANCE 同步。
- ✅ 鸿蒙支持：`harmonyos-app-integration.md` playbook（后端代理默认、ArkTS SSE 消费、Asset Store Kit、恢复、Browser Use 边界）；扫描器识别 `.ets` + ArkTS 客户端直连（INF-SEC-002）+ 双 fixtures。
- ✅ 测试与评估：`testing-and-evaluation.md` playbook（测试金字塔 + 黄金任务集评估）；`samples/mock-server/` 零依赖模拟器；TS SDK mock 集成测试进 `npm test`；opt-in 真实冒烟 `npm run smoke:live`（完成原第 5 条 backlog）。
- ✅ 工程一致性：本仓库启用 GitHub Actions CI；manifest 版本/规则 ID 对齐；扫描器对缺失文件退出 64；`tools/install-into.sh` 一键安装规则包到下游项目。
- ✅ CLI 事实更新：官方一键安装脚本、开源仓库（MIT）、`--update`/`--skill`。

## 后续改进

1. 等 `infini_docker` 可用后，补充基于源码的部署规则与校验。
2. 私有化部署验收清单（生产 Linux 主机）+ 基于真实部署的 contract tests。
3. SDK 增强：在 client 里补齐 Skill 管理、数据源/RAG/Skill 市场订阅、任务分享、Partner SSO 端点封装（api-index 已收录、SDK 方法未覆盖；建议拿到真实 Key 联调后再封装）。
4. 扫描器增强：把 api-index.md 的端点清单做成数据源，自动校验 SDK/文档不引用未知端点；评估跨文件 SSE 顺序检测。
5. 基于 `upstream-docs/` 增加适合 RAG 的索引或 embedding 流程。
6. 视需求补可观测性 / 成本配额 / 多租户深度 playbook（当前由 existing-product-integration 部分覆盖）。
