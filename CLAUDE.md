# CLAUDE.md · InfiniSynapse AI Workspace

通用规范以 `AGENTS.md` 为准。本文件只补充 Claude Code 的使用入口。

## 启动后先读

1. `AGENTS.md`
2. `llms.txt`
3. 用户任务对应的 `.claude/skills/*/SKILL.md`

## Skills

`.claude/skills/` 是 `.agents/skills/` 的镜像:

- `infinisynapse-deployment`
- `infinisynapse-server-api`
- `infinisynapse-cli`
- `infinisynapse-product-patterns`
- `infinisynapse-browser-extension`

## 工作规则

- 回答 InfiniSynapse API 相关问题前，先 `rg` 搜 `upstream-docs/infinisynapse-site/zh/markdown/`，英文快照只作补充。
- 写产品集成方案时，默认采用后端代理 API Key 的架构。
- 写长任务代码时，默认先连 SSE，再发 `newTask`。
- 写私有化部署说明时，必须检查 `AUTHING_SERVER_URL` 的四条规则。
