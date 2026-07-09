#!/usr/bin/env bash
# test-suite.sh — InfiniSynapse 规则包回归测试。
# 覆盖：扫描器 fixture 退出码、SDK 离线测试、语法检查、skill 镜像一致、manifest 合法、上游文档关键内容。
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0; SKIP=0
ok()   { printf 'PASS %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf 'FAIL %s\n' "$1" >&2; FAIL=$((FAIL+1)); }
skip() { printf 'SKIP %s\n' "$1"; SKIP=$((SKIP+1)); }

# ---- 1. 扫描器 fixture 退出码 ----
SCANNER="tools/hooks/lib/scan-infinisynapse.sh"
assert_exit() {
  local file="$1" want="$2"
  bash "$SCANNER" "$file" >/dev/null 2>&1; local rc=$?
  if [ "$rc" = "$want" ]; then ok "scan $(basename "$file") exit=$want"; else bad "scan $(basename "$file") exit=$rc want=$want"; fi
}
assert_contains_rule() {
  local file="$1" rule="$2"
  if bash "$SCANNER" "$file" 2>/dev/null | grep -q "$rule"; then ok "scan $(basename "$file") hits $rule"; else bad "scan $(basename "$file") missing $rule"; fi
}
if [ -f "$SCANNER" ]; then
  assert_exit "tools/hooks/test-fixtures/bad-hardcoded-key.ts" 2
  assert_contains_rule "tools/hooks/test-fixtures/bad-hardcoded-key.ts" "INF-SEC-001"
  assert_exit "tools/hooks/test-fixtures/bad-frontend-direct.tsx" 2
  assert_contains_rule "tools/hooks/test-fixtures/bad-frontend-direct.tsx" "INF-SEC-002"
  assert_exit "tools/hooks/test-fixtures/bad-authing.env" 2
  assert_contains_rule "tools/hooks/test-fixtures/bad-authing.env" "INF-ENV-001"
  assert_contains_rule "tools/hooks/test-fixtures/bad-authing.env" "INF-ENV-002"
  assert_contains_rule "tools/hooks/test-fixtures/bad-authing.env" "INF-ENV-003"
  assert_exit "tools/hooks/test-fixtures/bad-authing-path.env" 1
  assert_contains_rule "tools/hooks/test-fixtures/bad-authing-path.env" "INF-ENV-003"
  assert_exit "tools/hooks/test-fixtures/bad-newtask-no-sse.ts" 1
  assert_contains_rule "tools/hooks/test-fixtures/bad-newtask-no-sse.ts" "INF-SSE-001"
  assert_exit "tools/hooks/test-fixtures/bad-download-as-json.ts" 1
  assert_contains_rule "tools/hooks/test-fixtures/bad-download-as-json.ts" "INF-DL-001"
  assert_exit "tools/hooks/test-fixtures/bad-wrong-success-code.ts" 1
  assert_contains_rule "tools/hooks/test-fixtures/bad-wrong-success-code.ts" "INF-API-001"
  assert_exit "tools/hooks/test-fixtures/bad-harmonyos-direct.ets" 2
  assert_contains_rule "tools/hooks/test-fixtures/bad-harmonyos-direct.ets" "INF-SEC-002"
  assert_exit "tools/hooks/test-fixtures/bad-angular-direct.ts" 2
  assert_contains_rule "tools/hooks/test-fixtures/bad-angular-direct.ts" "INF-SEC-002"
  assert_exit "tools/hooks/test-fixtures/good-spring-backend-proxy.java" 0
  assert_exit "tools/hooks/test-fixtures/good-server-proxy.ts" 0
  assert_exit "tools/hooks/test-fixtures/good-deploy.env" 0
  assert_exit "tools/hooks/test-fixtures/good-doc-tokens.ts" 0
  assert_exit "tools/hooks/test-fixtures/good-harmonyos-proxy.ets" 0
  assert_exit "tools/hooks/test-fixtures/does-not-exist.ts" 64
  # --json 必须合法
  if bash "$SCANNER" --json "tools/hooks/test-fixtures/bad-authing.env" | python3 -m json.tool >/dev/null 2>&1; then
    ok "scanner --json 输出合法 JSON"
  elif command -v python3 >/dev/null 2>&1; then
    bad "scanner --json 输出非法 JSON"
  else
    skip "scanner --json 校验需要 python3"
  fi
  # 自检：自家 SDK / 样例 / mock server 不能被误报（exit 0）
  selfclean=1
  for f in $(find samples -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' -o -name '*.mjs' -o -name '*.ets' \)); do
    bash "$SCANNER" "$f" >/dev/null 2>&1 || { selfclean=0; echo "  误报: $f" >&2; }
  done
  [ "$selfclean" -eq 1 ] && ok "扫描器不误报自家 samples/" || bad "扫描器误报了 samples/ 下文件"
else
  bad "scanner 不存在: $SCANNER"
fi

# ---- 2. SDK 离线测试 ----
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".").map(Number)[0]')"
  NODE_MINOR="$(node -p 'process.versions.node.split(".").map(Number)[1]')"
  if [ "$NODE_MAJOR" -gt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 6 ]; }; then
    if ( cd samples/sdk/typescript && node --experimental-strip-types --test test/*.test.ts ) >/tmp/inf-ts-test.out 2>&1; then
      ok "TS SDK 离线 SSE 单测"
    else
      bad "TS SDK 离线 SSE 单测 (见 /tmp/inf-ts-test.out)"
    fi
    for f in samples/sdk/typescript/src/*.ts; do
      node --experimental-strip-types --check "$f" >/dev/null 2>&1 && ok "TS 语法 $(basename "$f")" || bad "TS 语法 $(basename "$f")"
    done
  else
    skip "TS SDK 测试需要 Node >= 22.6（当前 $NODE_MAJOR.$NODE_MINOR）"
  fi
else
  skip "TS SDK 测试需要 node"
fi

if command -v python3 >/dev/null 2>&1; then
  if ( cd samples/sdk/python && python3 -m unittest test_sse.py ) >/tmp/inf-py-test.out 2>&1; then
    ok "Python SDK 离线 SSE 单测"
  else
    bad "Python SDK 离线 SSE 单测 (见 /tmp/inf-py-test.out)"
  fi
  for f in samples/sdk/python/*.py; do
    python3 -m py_compile "$f" >/dev/null 2>&1 && ok "Python 语法 $(basename "$f")" || bad "Python 语法 $(basename "$f")"
  done
else
  skip "Python SDK 测试需要 python3"
fi

# ---- 3. skill 镜像一致 ----
if bash tools/sync-skills.sh --check >/dev/null 2>&1; then
  ok ".claude/skills 与 .agents/skills 一致"
else
  bad ".claude/skills 与 .agents/skills 漂移（运行 bash tools/sync-skills.sh）"
fi

# ---- 4. manifest 合法且引用的 SKILL.md 都在 ----
if command -v jq >/dev/null 2>&1; then
  if jq -e . .agents/skills/manifest.json >/dev/null 2>&1; then
    ok "manifest.json 合法 JSON"
    miss=0
    while IFS= read -r p; do
      [ -f ".agents/skills/$p" ] || { bad "manifest 引用缺失: $p"; miss=1; }
    done < <(jq -r '.skills[].path' .agents/skills/manifest.json)
    [ "$miss" -eq 0 ] && ok "manifest 引用的 SKILL.md 都存在"
  else
    bad "manifest.json 非法 JSON"
  fi
else
  skip "manifest 校验需要 jq"
fi

# ---- 5. 入口文件硬约束在位 ----
grep -q "AUTHING_SERVER_URL" AGENTS.md && ok "AGENTS 含 AUTHING_SERVER_URL 规则" || bad "AGENTS 缺 AUTHING_SERVER_URL"
grep -qE "先.*SSE|先连 SSE|先建立.*SSE" AGENTS.md && ok "AGENTS 含先连 SSE 规则" || bad "AGENTS 缺先连 SSE 规则"
grep -q "upload_documents" docs/playbooks/rag-file-placement.md && ok "RAG playbook 含 upload_documents 规则" || bad "RAG playbook 缺 upload_documents"
grep -q "SaaS" docs/playbooks/rag-file-placement.md && ok "RAG playbook 含 SaaS 边界" || bad "RAG playbook 缺 SaaS 边界"
grep -q "影响判断表" docs/MAINTENANCE.md && ok "维护手册含影响判断表" || bad "维护手册缺影响判断表"
grep -q "https://www.infinisynapse.cn/" README.md && ok "README 含 InfiniSynapse 官网链接" || bad "README 缺官网链接"
grep -q "不是 npm 依赖" docs/USAGE-GUIDE.md && ok "使用指南说明 npm 不是主入口" || bad "使用指南缺 npm 使用边界"
grep -q "具体怎么添加 skill" docs/USAGE-GUIDE.md && ok "使用指南含 skill 添加方式" || bad "使用指南缺 skill 添加方式"
grep -q "老项目接入流程" docs/USAGE-GUIDE.md && ok "使用指南含老项目接入流程" || bad "使用指南缺老项目接入流程"
test -s docs/playbooks/downstream-projects.md && ok "下游项目反哺 playbook 存在" || bad "缺下游项目反哺 playbook"
grep -q "downstream-projects.md" docs/USAGE-GUIDE.md && ok "使用指南指向下游项目反哺 playbook" || bad "使用指南缺下游项目反哺入口"
grep -q "feedback:check" docs/playbooks/downstream-projects.md && ok "下游项目 playbook 含 feedback:check" || bad "下游项目 playbook 缺 feedback:check"
grep -q "precommit:check" docs/playbooks/downstream-projects.md && ok "下游项目 playbook 含 precommit:check" || bad "下游项目 playbook 缺 precommit:check"
grep -q "Runtime guard 和预算" docs/playbooks/existing-product-integration.md && ok "成熟产品 playbook 含 runtime guard" || bad "成熟产品 playbook 缺 runtime guard"
grep -q "final/" docs/playbooks/existing-product-integration.md && ok "成熟产品 playbook 含 final/ 归档规则" || bad "成熟产品 playbook 缺 final/ 归档规则"
grep -q "后台通知不是 provider webhook" docs/reference/task-lifecycle.md && ok "任务生命周期含后台通知边界" || bad "任务生命周期缺后台通知边界"
grep -q "成熟产品守卫" docs/QUICK-REFERENCE.md && ok "速查含成熟产品守卫" || bad "速查缺成熟产品守卫"
grep -q "Asset Store Kit" docs/playbooks/harmonyos-app-integration.md && ok "鸿蒙 playbook 含 Asset Store Kit 存 Key 规则" || bad "鸿蒙 playbook 缺 Asset Store Kit 规则"
grep -q "requestInStream" docs/playbooks/harmonyos-app-integration.md && ok "鸿蒙 playbook 含 SSE 消费方案" || bad "鸿蒙 playbook 缺 SSE 消费方案"
grep -q "黄金任务" docs/playbooks/testing-and-evaluation.md && ok "测试评估 playbook 含黄金任务集" || bad "测试评估 playbook 缺黄金任务集"
grep -q "mock-server" docs/playbooks/testing-and-evaluation.md && ok "测试评估 playbook 指向 mock server" || bad "测试评估 playbook 缺 mock server 入口"
grep -q "/api/ai_skill" docs/reference/api-index.md && ok "api-index 含 Skill 管理端点" || bad "api-index 缺 Skill 管理端点"
grep -q "/api/auth/partner" docs/reference/api-index.md && ok "api-index 含 Partner SSO 端点" || bad "api-index 缺 Partner SSO 端点"

# ---- 5c. install-into.sh 行为（幂等 + 产物齐全）----
INSTALL_T="$(mktemp -d)"
printf '# existing agents file\n' > "$INSTALL_T/AGENTS.md"
if bash tools/install-into.sh "$INSTALL_T" >/dev/null 2>&1 && bash tools/install-into.sh "$INSTALL_T" >/dev/null 2>&1; then
  marks="$(grep -c 'infinisynapse-assistant:begin' "$INSTALL_T/AGENTS.md" 2>/dev/null || true)"
  if [ "$marks" = "1" ] && [ -f "$INSTALL_T/.agents/skills/infinisynapse-server-api/SKILL.md" ] && [ -f "$INSTALL_T/.claude/skills/infinisynapse-server-api/SKILL.md" ]; then
    ok "install-into.sh 幂等且 skills 安装齐全"
  else
    bad "install-into.sh 产物不完整或标记块重复 (markers=$marks)"
  fi
else
  bad "install-into.sh 执行失败"
fi
rm -rf "$INSTALL_T"

# ---- 5b. 本地方案草稿不应进入仓库主线 ----
for p in \
  "docs/proposals/job-recruitment-infinisynapse-product-plan.md" \
  "docs/proposals/project-value-research-infinisynapse-product-plan.md" \
  "docs/proposals/artifact-archiving-deep-review.codex.md"; do
  if git ls-files --error-unmatch "$p" >/dev/null 2>&1; then
    bad "本地方案草稿不应被 Git 跟踪: $p"
  else
    ok "本地方案草稿未被 Git 跟踪: $p"
  fi
done

# ---- 6. 上游文档关键内容 ----
ZH="upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md"
grep -q "SaaS API Key" "$ZH" && ok "上游文档含 SaaS API Key" || bad "上游文档缺 SaaS API Key"
grep -q "/api/ai/message" "$ZH" && ok "上游文档含 /api/ai/message" || bad "上游文档缺 /api/ai/message"
grep -q "/api/tools/taskUpload" "$ZH" && ok "上游文档含 taskUpload" || bad "上游文档缺 taskUpload"
grep -q "AUTHING_SERVER_URL" "upstream-docs/infinisynapse-site/zh/markdown/private-deployment-guide.md" && ok "部署文档含 AUTHING_SERVER_URL" || bad "部署文档缺 AUTHING_SERVER_URL"

# ---- 7. 参考文档与上游端点对齐（抽样）----
API_INDEX="docs/reference/api-index.md"
for ep in "/api/ai/events" "/api/ai/message" "/api/ai_task/getTaskWorkspace" "/api/tools/storage/downloadTaskFile" "/api/ai_skill/upload"; do
  if grep -q "$ep" "$API_INDEX" && grep -q "$ep" "$ZH"; then
    ok "api-index 与上游均含 $ep"
  else
    bad "api-index/上游 端点不一致: $ep"
  fi
done

# ---- 8. markdown 不含残留 copy 图标 ----
if grep -R "data:image/svg" "upstream-docs/infinisynapse-site/markdown" "upstream-docs/infinisynapse-site/zh/markdown" >/dev/null 2>&1; then
  bad "markdown 仍含内联 SVG copy 图标"
else
  ok "markdown copy 图标已清理"
fi

echo ""
echo "==== PASS=$PASS FAIL=$FAIL SKIP=$SKIP ===="
[ "$FAIL" -eq 0 ]
