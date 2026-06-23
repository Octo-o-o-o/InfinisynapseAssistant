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

## 后续改进

1. 等 `infini_docker` 可用后，补充基于源码的部署规则与校验。
2. 私有化部署验收清单（生产 Linux 主机）+ 基于真实部署的 contract tests。
3. SDK 增强：SSE 重连/超时/取消的完整实现与单测；补齐数据源/RAG/分享端点封装。
4. 扫描器增强：把 api-index.md 的端点清单做成数据源，自动校验 SDK/文档不引用未知端点。
5. 拿到真实 Key 后，增加一个可选的端到端 smoke（不入 CI，需手动提供凭据）。
6. 基于 `upstream-docs/` 增加适合 RAG 的索引或 embedding 流程。
