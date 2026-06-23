# 贡献指南

这个仓库是给 AI 编码助手用的 InfiniSynapse 规则包。贡献的目标是让 AI 更稳定地基于 InfiniSynapse 开发产品，不是堆资料。

## 改之前先读

1. `AGENTS.md`（单一通用入口）
2. `docs/reference/api-index.md`、`task-lifecycle.md`（事实基准）
3. `docs/MAINTENANCE.md`（同步上游、更新派生文档、发布前检查）
4. 对应 skill 的 `SKILL.md`

## 唯一源与镜像

- **`.agents/skills/` 是 skill 的唯一源**。Claude Code 用的 `.claude/skills/` 是镜像。
- 改完 skill 跑 `bash tools/sync-skills.sh` 同步，`bash tools/sync-skills.sh --check` 校验。
- 不要手改 `.claude/skills/`，会被下次同步覆盖。

## 改完必须验证

```bash
bash tools/doctor.sh
npm test
```

两者必须全绿（SKIP 可接受，FAIL 不行）。

## 优先合并

- ✅ 基于真实调用验证过的端点/字段修正（附上游文档出处）。
- ✅ 新的扫描规则 `INF-*` + 至少一个 fixture（触发的 + 必要时不触发的对照）。
- ✅ AI 训练数据缺失的本土化坑（SaaS 控制台路径、私有化部署变量、二进制端点等）。
- ✅ 新的可跑 SDK 片段或产品模式，且能离线验证（如纯函数 + 单测）。

## 谨慎 / 需先讨论

- ⚠️ 改 `AGENTS.md` 核心硬约束：先开 issue，给出依据。
- ⚠️ 删现有规则或 fixture：要给「为何过时」的证据。

## 不接受

- ❌ 大段复制上游文档：链到 `upstream-docs/` + 轻量摘要即可。
- ❌ 编造端点：不在 `docs/reference/api-index.md` / 上游文档里的端点不要写进规则或 SDK；先 `rg` 确认。
- ❌ 任何真实 API Key、Bearer token、数据库密码、私有地址、个人路径。示例值只能是占位符。
- ❌ 让前端直接持有 API Key 的示例。

## 规则 ID 约定

- 安全：`INF-SEC-*`；SSE/任务流：`INF-SSE-*`；下载/上传：`INF-DL-*`；部署/环境：`INF-ENV-*`。
- ID 一旦发布保持稳定（被 hook / CI / fixtures 引用）。
- 严重度：`HIGH`（exit 2，应阻塞）/ `MEDIUM` / `LOW`（exit 1，提醒）。

## 提交信息

简体中文，简洁说明「做了什么 + 为什么」。
