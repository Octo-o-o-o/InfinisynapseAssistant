#!/usr/bin/env bash
# parse-hook-input.sh — 兼容多种 AI 助手的 hook stdin JSON。
# 用 `source` 加载，导出：
#   HOOK_TOOL_NAME    触发工具名（Edit / Write / MultiEdit / unknown）
#   HOOK_FILE_PATH    被改动文件的绝对路径
#   HOOK_PROJECT_DIR  项目根（CLAUDE_PROJECT_DIR 优先 → git → PWD）
#   HOOK_RAW_INPUT    原始 stdin（调试用）
#
# 兼容：Claude Code（stdin JSON）/ Codex 或手动调用（命令行 $1=file_path）。

set -u

HOOK_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-}}"
if [[ -z "$HOOK_PROJECT_DIR" ]]; then
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    HOOK_PROJECT_DIR="$(git rev-parse --show-toplevel)"
  else
    HOOK_PROJECT_DIR="$PWD"
  fi
fi
export HOOK_PROJECT_DIR

HOOK_RAW_INPUT=""
if [[ ! -t 0 ]]; then
  HOOK_RAW_INPUT="$(cat || true)"
fi
export HOOK_RAW_INPUT

HOOK_TOOL_NAME="${HOOK_TOOL_NAME:-unknown}"
HOOK_FILE_PATH=""

parse_with_jq() {
  command -v jq >/dev/null 2>&1 || return 1
  local tn fp
  tn="$(printf '%s' "$HOOK_RAW_INPUT" | jq -r '.tool_name // empty' 2>/dev/null)"
  fp="$(printf '%s' "$HOOK_RAW_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .file_path // empty' 2>/dev/null)"
  [[ -n "$tn" ]] && HOOK_TOOL_NAME="$tn"
  [[ -n "$fp" ]] && HOOK_FILE_PATH="$fp"
}

parse_with_sed() {
  local tn fp
  tn="$(printf '%s' "$HOOK_RAW_INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  fp="$(printf '%s' "$HOOK_RAW_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  [[ -z "$fp" ]] && fp="$(printf '%s' "$HOOK_RAW_INPUT" | sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  [[ -n "$tn" ]] && HOOK_TOOL_NAME="$tn"
  [[ -n "$fp" ]] && HOOK_FILE_PATH="$fp"
}

if [[ -n "$HOOK_RAW_INPUT" ]]; then
  parse_with_jq || parse_with_sed
fi

if [[ -z "$HOOK_FILE_PATH" && $# -gt 0 ]]; then
  HOOK_FILE_PATH="$1"
fi

if [[ -n "$HOOK_FILE_PATH" && "$HOOK_FILE_PATH" != /* ]]; then
  HOOK_FILE_PATH="$HOOK_PROJECT_DIR/$HOOK_FILE_PATH"
fi

export HOOK_TOOL_NAME HOOK_FILE_PATH

if [[ "${HOOK_DEBUG:-0}" == "1" ]]; then
  {
    echo "─── parse-hook-input ───"
    echo "  HOOK_PROJECT_DIR : $HOOK_PROJECT_DIR"
    echo "  HOOK_TOOL_NAME   : $HOOK_TOOL_NAME"
    echo "  HOOK_FILE_PATH   : $HOOK_FILE_PATH"
    echo "────────────────────────"
  } >&2
fi
