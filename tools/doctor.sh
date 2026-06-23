#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

pass() { printf 'PASS %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; status=1; }

require_file() {
  local file="$1"
  if [ -s "$ROOT/$file" ]; then
    pass "$file exists"
  else
    fail "$file missing or empty"
  fi
}

require_file "AGENTS.md"
require_file "CLAUDE.md"
require_file "llms.txt"
require_file "docs/README.md"
require_file "docs/CONTENT-MODEL.md"
require_file "docs/MAINTENANCE.md"
require_file "docs/playbooks/rag-file-placement.md"
require_file "upstream-docs/infinisynapse-site/zh/markdown/private-deployment-guide.md"
require_file "upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md"
require_file "upstream-docs/infinisynapse-site/zh/markdown/cli-api-reference.md"
require_file "upstream-docs/infinisynapse-site/zh/markdown/chrome-plugin-install.md"
require_file "upstream-docs/infinisynapse-site/markdown/private-deployment-guide.md"
require_file "upstream-docs/infinisynapse-site/markdown/server-api-reference.md"
require_file "upstream-docs/infinisynapse-site/markdown/cli-api-reference.md"
require_file "upstream-docs/infinisynapse-site/markdown/chrome-plugin-install.md"
require_file "upstream-docs/infinisynapse-site/assets/docs/server-api/api-key-management-entry.png"
require_file "upstream-docs/infinisynapse-site/assets/docs/server-api/api-key-management-page.png"
require_file "upstream-docs/infinisynapse-site/assets/docs/server-api/compute-resource-selector.png"

# 规范参考与 playbooks
require_file "docs/reference/api-index.md"
require_file "docs/reference/task-lifecycle.md"
require_file "docs/reference/capabilities.md"
require_file "docs/reference/glossary.md"
require_file "docs/playbooks/troubleshooting.md"
require_file "docs/playbooks/secure-integration.md"
require_file "docs/playbooks/market-subscriptions.md"
require_file "docs/playbooks/browser-use.md"
require_file "docs/playbooks/task-sharing.md"
require_file "docs/playbooks/plan-act-approval.md"
require_file "docs/playbooks/assets/secure-integration-trust-boundary.svg"

# 钩子与扫描器
require_file "tools/hooks/post-edit.sh"
require_file "tools/hooks/lib/scan-infinisynapse.sh"
require_file "tools/hooks/lib/parse-hook-input.sh"
require_file ".claude/settings.json"

# SDK 参考实现
require_file "samples/sdk/typescript/src/client.ts"
require_file "samples/sdk/typescript/src/sse.ts"
require_file "samples/sdk/python/infinisynapse_client.py"

# skill 源与镜像
require_file ".agents/skills/manifest.json"
require_file "tools/sync-skills.sh"

# 扫描器自检：good fixture 必须干净，bad fixture 必须触发
if bash "$ROOT/tools/hooks/lib/scan-infinisynapse.sh" "$ROOT/tools/hooks/test-fixtures/good-server-proxy.ts" >/dev/null 2>&1; then
  pass "scanner clean on good fixture"
else
  fail "scanner flagged a good fixture"
fi
if bash "$ROOT/tools/hooks/lib/scan-infinisynapse.sh" "$ROOT/tools/hooks/test-fixtures/bad-hardcoded-key.ts" >/dev/null 2>&1; then
  fail "scanner did not flag a bad fixture"
else
  pass "scanner flags bad fixture"
fi

# skill 镜像一致
if bash "$ROOT/tools/sync-skills.sh" --check >/dev/null 2>&1; then
  pass ".claude/skills mirror in sync"
else
  warn ".claude/skills drift; run bash tools/sync-skills.sh"
fi

if command -v curl >/dev/null 2>&1; then
  pass "curl available"
else
  fail "curl not found"
fi

if command -v pandoc >/dev/null 2>&1; then
  pass "pandoc available"
else
  warn "pandoc not found; sync script can fetch HTML but not regenerate Markdown"
fi

if [ -d "$ROOT/upstream-src/infini_docker/.git" ]; then
  pass "upstream source repo present"
else
  warn "upstream-src/infini_docker not present; see docs/SOURCE-AUDIT.md"
fi

if git ls-remote https://github.com/chaozwn/infini_docker.git >/tmp/infinisynapse-ls-remote.out 2>/tmp/infinisynapse-ls-remote.err; then
  pass "GitHub source repository currently reachable"
else
  warn "GitHub source repository currently unreachable via git ls-remote"
fi

exit "$status"
