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
