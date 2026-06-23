#!/usr/bin/env bash
# post-edit.sh — Claude Code PostToolUse 钩子入口（也可被 Codex / git pre-commit / 手动调用）。
#
# 触发：Edit / Write / MultiEdit 写完文件后，Claude Code 通过 stdin 传 JSON。
# 行为：把 InfiniSynapse 集成代码 / 部署配置交给 lib/scan-infinisynapse.sh 扫反模式。
# 反馈：
#   - stderr 打印结构化违规（Claude Code 默认注入下一轮上下文）
#   - 写入 .claude/.infinisynapse-last-scan.txt（AI 下一轮可读）
#   - HIGH → exit 2（阻塞，AI 当场改）；MEDIUM/LOW/无 → exit 0
# 非阻塞模式：INFINISYNAPSE_HOOK_NONBLOCKING=1 时永远 exit 0。

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/parse-hook-input.sh
source "$HERE/lib/parse-hook-input.sh"

if [[ -z "${HOOK_FILE_PATH:-}" || ! -f "$HOOK_FILE_PATH" ]]; then
  exit 0
fi

SCANNER="$HERE/lib/scan-infinisynapse.sh"
[[ -f "$SCANNER" ]] || exit 0

base="$(basename "$HOOK_FILE_PATH")"
relevant=0
case "$base" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.java|*.kt|*.rb|*.php) relevant=1;;
  .env|.env.*|*.env) relevant=1;;
  *.yml|*.yaml) relevant=1;;
  *compose*|*.tf|*.toml) relevant=1;;
esac
# 含关键变量的任意文件也扫
if [[ $relevant -eq 0 ]] && grep -qE 'AUTHING_SERVER_URL|AUTH_SERVER_URL|/api/ai/(events|message)' "$HOOK_FILE_PATH" 2>/dev/null; then
  relevant=1
fi
[[ $relevant -eq 1 ]] || exit 0

TMP_ERR="$(mktemp)"
trap 'rm -f "$TMP_ERR"' EXIT

worst=0
if command -v timeout >/dev/null 2>&1; then
  timeout 10 bash "$SCANNER" "$HOOK_FILE_PATH" >"$TMP_ERR" 2>&1; worst=$?
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout 10 bash "$SCANNER" "$HOOK_FILE_PATH" >"$TMP_ERR" 2>&1; worst=$?
else
  bash "$SCANNER" "$HOOK_FILE_PATH" >"$TMP_ERR" 2>&1; worst=$?
fi
[[ $worst -eq 124 ]] && { echo "[hook-timeout] scanner 超过 10s" >>"$TMP_ERR"; worst=0; }

RESULT_FILE="$HOOK_PROJECT_DIR/.claude/.infinisynapse-last-scan.txt"
mkdir -p "$(dirname "$RESULT_FILE")"
{
  echo "# InfiniSynapse post-edit scan"
  echo "# file : ${HOOK_FILE_PATH#"$HOOK_PROJECT_DIR"/}"
  echo "# tool : $HOOK_TOOL_NAME"
  echo
  if [[ -s "$TMP_ERR" ]]; then cat "$TMP_ERR"; else echo "[clean] 未发现已知反模式"; fi
} > "$RESULT_FILE"

if [[ -s "$TMP_ERR" ]]; then
  cat "$TMP_ERR" >&2
fi

if [[ "${INFINISYNAPSE_HOOK_NONBLOCKING:-0}" == "1" ]]; then
  exit 0
fi

# Claude Code PostToolUse 退出码语义：exit 2 = 阻塞 + stderr 反馈给 AI；其余=通过。
case "$worst" in
  2) exit 2 ;;
  *) exit 0 ;;
esac
