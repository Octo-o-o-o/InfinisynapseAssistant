#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check() {
  local description="$1"
  shift
  if "$@"; then
    printf 'PASS %s\n' "$description"
  else
    printf 'FAIL %s\n' "$description" >&2
    exit 1
  fi
}

check "AGENTS has AUTHING_SERVER_URL rule" grep -q "AUTHING_SERVER_URL" "$ROOT/AGENTS.md"
check "AGENTS has SSE-before-message rule" grep -q "先建立.*SSE" "$ROOT/AGENTS.md"
check "Chinese Server docs include SaaS API Key section" grep -q "SaaS API Key" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md"
check "Chinese Server docs include ai message endpoint" grep -q "/api/ai/message" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md"
check "Chinese Server docs include task upload endpoint" grep -q "/api/tools/taskUpload" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md"
check "Chinese Deployment docs include AUTHING_SERVER_URL" grep -q "AUTHING_SERVER_URL" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown/private-deployment-guide.md"
check "Chinese CLI docs include agent_infini" grep -q "agent_infini" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown/cli-api-reference.md"
check "Chrome plugin images downloaded" test -s "$ROOT/upstream-docs/infinisynapse-site/assets/chromePluginInstall/14.png"
check "SaaS API Key screenshot downloaded" test -s "$ROOT/upstream-docs/infinisynapse-site/assets/docs/server-api/api-key-management-entry.png"
check "Deployment skill exists" test -s "$ROOT/.agents/skills/infinisynapse-deployment/SKILL.md"
check "Server API skill exists" test -s "$ROOT/.agents/skills/infinisynapse-server-api/SKILL.md"
check "Product patterns skill exists" test -s "$ROOT/.agents/skills/infinisynapse-product-patterns/SKILL.md"

if grep -R "data:image/svg" "$ROOT/upstream-docs/infinisynapse-site/markdown" "$ROOT/upstream-docs/infinisynapse-site/zh/markdown" >/tmp/infinisynapse-doc-grep.out; then
  printf 'FAIL markdown still contains inline SVG copy icons\n' >&2
  exit 1
else
  printf 'PASS markdown copy icons removed\n'
fi
