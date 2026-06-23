# 许可与来源说明

本仓库当前**未声明开源许可证**。它混合了两类内容，性质不同，需要分别看待：

## 1. 上游文档快照（第三方版权）

`upstream-docs/infinisynapse-site/` 下的 HTML、Markdown、PNG 是 InfiniSynapse 官方公开页面的本地镜像，版权归 InfiniSynapse 所有，仅作本地开发辅助。

- 不要把这些快照当作本仓库可自由再许可的内容。
- 对外分发本仓库前，确认上游文档的再分发条款；必要时只保留 `tools/sync-upstream-docs.sh`，让使用者自行抓取。
- 抓取脚本与来源见 `docs/SOURCE-AUDIT.md`。

## 2. 本仓库自有内容（规则、SDK、脚本）

`AGENTS.md`、`docs/`（除上游快照）、`.agents/`、`.claude/`、`.cursor/`、`.github/`、`samples/`、`tools/` 下的规则、参考实现和脚本是本仓库原创。

- `samples/sdk/` 是**参考实现**，不是官方 SDK，按现状提供，不连真实 API。
- 接真实环境的安全责任在使用者：API Key 放服务端密钥管理，遵守 `AGENTS.md` 的安全硬约束。

## 3. 选许可证时

如果之后要开源，建议：

- 自有内容（`samples/`、`tools/`、规则文档）用 MIT 或 Apache-2.0。
- 上游快照单独说明为第三方内容、不在本仓库许可范围内（放进 `NOTICE` 或本文件）。

在没有明确决定前，`package.json` 保持 `"license": "UNLICENSED"` 且 `"private": true`，避免误以为已开源。
