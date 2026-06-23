# 钩子复用示例

`lib/scan-infinisynapse.sh` 不止给 Claude Code 用，也能接到 git / CI。

| 文件 | 用途 |
| --- | --- |
| `codex-precommit.sh` | git pre-commit：对暂存文件扫描，命中 HIGH 阻止提交 |
| `github-action-scan.yml` | PR CI：对改动文件扫描，命中 HIGH 让流水线失败 |

Claude Code 的实时钩子由仓库根 `.claude/settings.json` 的 PostToolUse 接线，调用 `tools/hooks/post-edit.sh`。
