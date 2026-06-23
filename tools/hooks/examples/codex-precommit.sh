#!/usr/bin/env bash
# 示例：git pre-commit 里复用 InfiniSynapse 扫描器。
# 安装：cp tools/hooks/examples/codex-precommit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# 对暂存的代码/配置文件运行扫描器；命中 HIGH（exit 2）则阻止提交。

set -u
ROOT="$(git rev-parse --show-toplevel)"
SCANNER="$ROOT/tools/hooks/lib/scan-infinisynapse.sh"
[[ -f "$SCANNER" ]] || exit 0

worst=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.java|*.kt|*.rb|*.php|.env|.env.*|*.env|*.yml|*.yaml|*compose*) ;;
    *) continue;;
  esac
  [[ -f "$ROOT/$f" ]] || continue
  bash "$SCANNER" "$ROOT/$f"; rc=$?
  [[ $rc -gt $worst ]] && worst=$rc
done < <(git diff --cached --name-only --diff-filter=ACM)

if [[ $worst -eq 2 ]]; then
  echo "提交被阻止：存在 HIGH 级 InfiniSynapse 反模式（见上）。修复或用 git commit --no-verify 跳过。" >&2
  exit 1
fi
exit 0
