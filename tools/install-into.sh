#!/usr/bin/env bash
# install-into.sh — 把 InfiniSynapse 规则包安装到下游业务项目（幂等）。
#
# 做三件事：
#   1. 复制 .agents/skills/（唯一源）到 <target>/.agents/skills/，并镜像到 <target>/.claude/skills/
#   2. 在 <target>/AGENTS.md 写入/更新一段带标记的规则包引用块（重复运行只更新，不重复追加）
#   3. 打印扫描器 / doctor 的 npm scripts 接线建议（不改动目标项目 package.json）
#
# 用法：
#   bash tools/install-into.sh <target-project-dir> [--dry-run]
#
# 详细接入与反哺流程见 docs/playbooks/downstream-projects.md。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-}"
DRY_RUN=0
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ -z "$TARGET" ]]; then
  echo "usage: install-into.sh <target-project-dir> [--dry-run]" >&2
  exit 64
fi
if [[ ! -d "$TARGET" ]]; then
  echo "install-into.sh: target dir not found: $TARGET" >&2
  exit 64
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$ROOT" ]]; then
  echo "install-into.sh: target 不能是规则包自身" >&2
  exit 64
fi

say() { printf '%s\n' "$1"; }
run() { [[ $DRY_RUN -eq 1 ]] && say "[dry-run] $*" || "$@"; }

# 1. 复制 skills（唯一源 + manifest），镜像给 Claude Code
say "==> 安装 skills 到 $TARGET/.agents/skills/ 和 .claude/skills/"
run mkdir -p "$TARGET/.agents/skills" "$TARGET/.claude/skills"
for d in "$ROOT"/.agents/skills/infinisynapse-*; do
  name="$(basename "$d")"
  run rm -rf "$TARGET/.agents/skills/$name" "$TARGET/.claude/skills/$name"
  run cp -R "$d" "$TARGET/.agents/skills/$name"
  run cp -R "$d" "$TARGET/.claude/skills/$name"
done
run cp "$ROOT/.agents/skills/manifest.json" "$TARGET/.agents/skills/manifest.json"
run cp "$ROOT/.agents/skills/manifest.json" "$TARGET/.claude/skills/manifest.json"

# 2. 幂等写入 AGENTS.md 引用块
BEGIN_MARK="<!-- infinisynapse-assistant:begin (managed by tools/install-into.sh) -->"
END_MARK="<!-- infinisynapse-assistant:end -->"
BLOCK="$BEGIN_MARK
## InfiniSynapse 集成规则（引用规则包）

本项目依赖 InfiniSynapse。涉及 Server API、SSE、workspace、RAG、Skill、Browser Use、
文件上传下载、私有化部署或任务分享时，先读取本项目 .agents/skills/infinisynapse-*，
需要完整 reference / playbooks / 上游文档快照时读取规则包：
$ROOT

硬约束速览：
- API Key 只在可信后端边界；前端/客户端（含鸿蒙 app）只调用自己的后端。
- 非 agentic 轻量调用直连 LLM；agentic 长任务 / Browser Use / workspace 产物走 InfiniSynapse。
- 先 GET /api/ai/events 连 SSE，再 POST /api/ai/message 发 newTask。
- 产物读 getTaskWorkspace / previewFile / downloadTaskFile；下载端点是二进制流。
- 两类上传分清：/api/ai/upload（响应 Agent）vs /api/tools/taskUpload（主动归档）。
- 不编造端点；先搜规则包 upstream-docs/infinisynapse-site/zh/markdown/。
$END_MARK"

AGENTS_FILE="$TARGET/AGENTS.md"
say "==> 更新 $AGENTS_FILE 引用块"
if [[ $DRY_RUN -eq 1 ]]; then
  say "[dry-run] 会写入/替换标记块到 $AGENTS_FILE"
else
  if [[ -f "$AGENTS_FILE" ]] && grep -qF "$BEGIN_MARK" "$AGENTS_FILE"; then
    # 先删旧块（BSD/GNU awk 兼容：-v 值必须单行，块正文单独追加），
    # 并吃掉尾部空行，避免重复安装时分隔空行累积
    awk -v begin="$BEGIN_MARK" -v end="$END_MARK" '
      $0 == begin { inblock=1; next }
      $0 == end { inblock=0; next }
      inblock { next }
      NF { for (i = 0; i < blank; i++) print ""; blank = 0; print; next }
      { blank++ }
    ' "$AGENTS_FILE" > "$AGENTS_FILE.tmp" && mv "$AGENTS_FILE.tmp" "$AGENTS_FILE"
  fi
  { [[ -s "$AGENTS_FILE" ]] && printf '\n'; printf '%s\n' "$BLOCK"; } >> "$AGENTS_FILE"
fi

# 3. 接线建议（只打印，不改 package.json）
cat <<EOF

==> 完成。建议在目标项目 package.json 手动加上（按需）：

  "scripts": {
    "infini:scan": "bash $ROOT/tools/hooks/lib/scan-infinisynapse.sh",
    "infini:doctor": "bash $ROOT/tools/doctor.sh"
  }

CI 中扫描改动文件的示例见 $ROOT/tools/hooks/examples/github-action-scan.yml。
接入流程与反哺规范见 $ROOT/docs/playbooks/downstream-projects.md。
EOF
