#!/usr/bin/env bash
# sync-skills.sh — 把 .agents/skills/（唯一源）镜像到 .claude/skills/。
# Codex 读 .agents/skills/，Claude Code 读 .claude/skills/；本脚本保证两者一致，避免漂移。
#
# 用法：
#   sync-skills.sh           执行镜像（.agents → .claude）
#   sync-skills.sh --check   只校验是否一致；不一致 exit 1（CI / doctor 用）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/.agents/skills"
DST="$ROOT/.claude/skills"

if [[ ! -d "$SRC" ]]; then
  echo "FAIL source $SRC not found" >&2
  exit 1
fi

if [[ "${1:-}" == "--check" ]]; then
  if [[ ! -d "$DST" ]]; then
    echo "DRIFT .claude/skills missing; run: bash tools/sync-skills.sh" >&2
    exit 1
  fi
  if diff -r "$SRC" "$DST" >/tmp/infinisynapse-skill-drift.txt 2>&1; then
    echo "PASS .claude/skills 与 .agents/skills 一致"
    exit 0
  else
    echo "DRIFT .claude/skills 与 .agents/skills 不一致：" >&2
    cat /tmp/infinisynapse-skill-drift.txt >&2
    echo "运行: bash tools/sync-skills.sh" >&2
    exit 1
  fi
fi

# 执行镜像
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC/" "$DST/"
else
  rm -rf "$DST"
  mkdir -p "$DST"
  cp -R "$SRC/." "$DST/"
fi
echo "synced .agents/skills → .claude/skills"
