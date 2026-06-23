#!/usr/bin/env bash
# scan-infinisynapse.sh — 扫描 InfiniSynapse 集成代码/配置里的高风险反模式。
#
# 用法：
#   scan-infinisynapse.sh <file>          人类可读输出
#   scan-infinisynapse.sh --json <file>   JSON 数组（CI 友好）
#   scan-infinisynapse.sh --stats <file>  规则计数
#
# 退出码：
#   2  存在 HIGH（应阻塞，让 AI 当场改）
#   1  仅有 MEDIUM / LOW（提醒）
#   0  干净
#
# 规则 ID 稳定（用于 hook / CI / fixtures）：
#   INF-SEC-001 HIGH    硬编码 Bearer token
#   INF-SEC-002 HIGH    前端文件直连 InfiniSynapse（API Key 会暴露）
#   INF-SSE-001 MEDIUM  发 newTask 但本文件未先连 /api/ai/events
#   INF-DL-001  MEDIUM  把下载端点当 JSON 解析
#   INF-ENV-001 HIGH    变量名写成 AUTH_SERVER_URL（应为 AUTHING_SERVER_URL）
#   INF-ENV-002 HIGH    AUTHING_SERVER_URL 指向 127.0.0.1 / localhost（浏览器不可达）
#   INF-ENV-003 MEDIUM  AUTHING_SERVER_URL 路径不是裸 /api（缺 /api 或带尾部斜杠）

set -u

MODE="human"
case "${1:-}" in
  --json) MODE="json"; shift;;
  --stats) MODE="stats"; shift;;
esac

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "usage: scan-infinisynapse.sh [--json|--stats] <file>" >&2
  exit 0
fi

# findings：每条 "RULE\tSEV\tLINE\tMESSAGE"
FINDINGS=()
WORST=0  # 0 clean, 1 medium/low, 2 high

sev_rank() { case "$1" in HIGH) echo 2;; MEDIUM|LOW) echo 1;; *) echo 0;; esac; }

add_finding() {
  local rule="$1" sev="$2" line="$3" msg="$4"
  FINDINGS+=("$rule	$sev	$line	$msg")
  local r; r="$(sev_rank "$sev")"
  [[ "$r" -gt "$WORST" ]] && WORST="$r"
}

is_comment_line() {
  # 传入 grep 行内容（去掉行号后），判断是否注释行
  local c; c="$(printf '%s' "$1" | sed 's/^[[:space:]]*//')"
  case "$c" in
    //*|\#*|\**|/\**) return 0;;
    *) return 1;;
  esac
}

# 把 /* ... */ 块注释（可跨行）刷成空格，保留行结构（行号不变）。
# 避免块注释里的 token / endpoint 被规则误判（单行 // 和 # 注释仍由 is_comment_line 处理）。
scrub_block_comments() {
  awk '
  {
    line=$0; out=""; i=1; n=length(line)
    while (i<=n) {
      two=substr(line,i,2)
      if (inb) { if (two=="*/"){inb=0;out=out"  ";i+=2} else {out=out" ";i++} }
      else { if (two=="/*"){inb=1;out=out"  ";i+=2} else {out=out substr(line,i,1);i++} }
    }
    print out
  }' "$1"
}

# 按正则找行（跳过注释行），命中即 add_finding
find_rule() {
  local rule="$1" sev="$2" msg="$3" pat="$4"
  local m ln content
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    ln="${m%%:*}"
    content="${m#*:}"
    is_comment_line "$content" && continue
    add_finding "$rule" "$sev" "$ln" "$msg"
  done < <(grep -nE "$pat" "$FILE" 2>/dev/null || true)
}

# 整文件包含某模式（任意行，含注释）
file_has() { grep -qE "$1" "$FILE" 2>/dev/null; }
# 仅非注释行包含某模式（注释里的 endpoint 不算数）
code_has() {
  local m content
  while IFS= read -r m; do
    content="${m#*:}"
    is_comment_line "$content" && continue
    return 0
  done < <(grep -nE "$1" "$FILE" 2>/dev/null || true)
  return 1
}
# 非注释命中行号（每行一个）
lines_matching() {
  local m ln content
  while IFS= read -r m; do
    ln="${m%%:*}"; content="${m#*:}"
    is_comment_line "$content" && continue
    echo "$ln"
  done < <(grep -nE "$1" "$FILE" 2>/dev/null || true)
}
# 第一处非注释命中行号（找不到回显 1）
first_line() {
  local m ln content
  while IFS= read -r m; do
    ln="${m%%:*}"; content="${m#*:}"
    is_comment_line "$content" && continue
    echo "$ln"; return
  done < <(grep -nE "$1" "$FILE" 2>/dev/null || true)
  echo 1
}

base="$(basename "$FILE")"
ORIG_FILE="$FILE"   # 保留原始路径用于输出；代码段会把 FILE 临时指向刷白副本
SCRUBBED=""
trap '[[ -n "${SCRUBBED:-}" ]] && rm -f "$SCRUBBED" 2>/dev/null || true' EXIT

# ---------------- 环境/配置规则（.env / compose / yaml / 任意含变量的文件）----------------

# INF-ENV-001：错误变量名
find_rule "INF-ENV-001" "HIGH" "变量名应为 AUTHING_SERVER_URL，不是 AUTH_SERVER_URL" \
  '(^|[^A-Z_])AUTH_SERVER_URL[[:space:]]*[:=]'

# INF-ENV-002 / 003：AUTHING_SERVER_URL 的取值检查
while IFS= read -r m; do
  [[ -z "$m" ]] && continue
  ln="${m%%:*}"; content="${m#*:}"
  is_comment_line "$content" && continue
  # 取等号/冒号后的值
  val="$(printf '%s' "$content" | sed -E 's/.*AUTHING_SERVER_URL[[:space:]]*[:=][[:space:]]*//; s/^["'\'']//; s/["'\'' ]*$//')"
  [[ -z "$val" ]] && continue
  if printf '%s' "$val" | grep -qE '127\.0\.0\.1|localhost'; then
    add_finding "INF-ENV-002" "HIGH" "$ln" "AUTHING_SERVER_URL 必须浏览器可达，不能是 127.0.0.1/localhost"
  fi
  # 路径必须是裸 /api（不带尾部斜杠，且确实含 /api）
  if printf '%s' "$val" | grep -qE '://'; then
    if printf '%s' "$val" | grep -qE '/api/+$|/api/$'; then
      add_finding "INF-ENV-003" "MEDIUM" "$ln" "AUTHING_SERVER_URL 末尾不要带斜杠（应以 /api 结尾）"
    elif ! printf '%s' "$val" | grep -qE '/api($|[^/])'; then
      add_finding "INF-ENV-003" "MEDIUM" "$ln" "AUTHING_SERVER_URL 路径应为 /api"
    fi
  fi
done < <(grep -nE 'AUTHING_SERVER_URL[[:space:]]*[:=]' "$FILE" 2>/dev/null || true)

# ---------------- 代码规则（按扩展名）----------------
case "$base" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.go|*.java|*.kt|*.rb|*.php)
    # 代码段：把块注释刷白后再扫，避免块注释里的 token/endpoint 误判
    SCRUBBED="$(mktemp 2>/dev/null || echo "/tmp/inf-scrub-$$")"
    if scrub_block_comments "$ORIG_FILE" > "$SCRUBBED" 2>/dev/null; then FILE="$SCRUBBED"; fi

    # INF-SEC-001：硬编码 Bearer token（块注释已刷白；跳过明显占位符）
    while IFS= read -r m; do
      [[ -z "$m" ]] && continue
      ln="${m%%:*}"; content="${m#*:}"
      is_comment_line "$content" && continue
      tok="$(printf '%s' "$content" | grep -oE 'Bearer [A-Za-z0-9][A-Za-z0-9._-]{15,}' | head -1 | sed 's/^Bearer //')"
      [[ -z "$tok" ]] && continue
      case "$tok" in *PLACEHOLDER*|*placeholder*|*YOUR_*|*EXAMPLE*|*example*|*XXXX*|*xxxx*) continue;; esac
      printf '%s' "$tok" | grep -qE '^[A-Z0-9_]+$' && continue   # 全大写下划线占位
      add_finding "INF-SEC-001" "HIGH" "$ln" "硬编码 Bearer token；API Key 必须来自服务端环境变量/密钥管理"
    done < <(grep -nE 'Bearer [A-Za-z0-9][A-Za-z0-9._-]{15,}' "$FILE" 2>/dev/null || true)

    # INF-SEC-002：前端文件直连 InfiniSynapse（API Key 暴露风险）
    if code_has 'app\.infinisynapse\.(cn|com)|/api/ai/(events|message)'; then
      if code_has "from[[:space:]]+['\"]react['\"]|from[[:space:]]+['\"]vue['\"]|useState\(|window\.|document\."; then
        ln="$(first_line 'app\.infinisynapse\.(cn|com)|/api/ai/(events|message)')"
        add_finding "INF-SEC-002" "HIGH" "$ln" "前端文件直连 InfiniSynapse：API Key 会进 bundle。改用后端代理路由"
      fi
    fi

    # INF-SSE-001：发 newTask 但本文件没有先连 SSE（注释里的 events 不算真连接）
    if code_has "newTask" && code_has '/api/ai/message'; then
      if ! code_has '/api/ai/events'; then
        ln="$(first_line 'newTask')"
        add_finding "INF-SSE-001" "MEDIUM" "$ln" "发 newTask 前要先建立 GET /api/ai/events（本文件未见 SSE 连接）"
      fi
    fi

    # INF-DL-001：下载端点当 JSON 解析。
    # 邻近判定：json 解析出现在下载调用 3 行内才算（避免大文件里两者无关共现的误报）。
    dl_lines="$(lines_matching 'downloadTaskFile|downloadZip|/storage/download')"
    json_lines="$(lines_matching '\.json\(\)|JSON\.parse|json\.loads')"
    if [[ -n "$dl_lines" && -n "$json_lines" ]]; then
      flagged=""
      for d in $dl_lines; do
        for j in $json_lines; do
          if [[ "$d" -ge "$j" ]]; then diff=$((d - j)); else diff=$((j - d)); fi
          if [[ "$diff" -le 3 ]]; then flagged="$d"; break; fi
        done
        [[ -n "$flagged" ]] && break
      done
      if [[ -n "$flagged" ]]; then
        add_finding "INF-DL-001" "MEDIUM" "$flagged" "下载端点返回二进制流，不要按 JSON 解析（见 api-index.md 二进制清单）"
      fi
    fi
    ;;
esac

# ---------------- 输出 ----------------
rel="${ORIG_FILE#"$PWD"/}"

if [[ "$MODE" == "json" ]]; then
  printf '['
  first=1
  for f in "${FINDINGS[@]:-}"; do
    [[ -z "$f" ]] && continue
    rule="$(printf '%s' "$f" | cut -f1)"
    sev="$(printf '%s' "$f" | cut -f2)"
    line="$(printf '%s' "$f" | cut -f3)"
    msg="$(printf '%s' "$f" | cut -f4)"
    [[ $first -eq 0 ]] && printf ','
    first=0
    printf '{"rule":"%s","severity":"%s","file":"%s","line":%s,"message":"%s"}' \
      "$rule" "$sev" "$rel" "$line" "$msg"
  done
  printf ']\n'
elif [[ "$MODE" == "stats" ]]; then
  if [[ ${#FINDINGS[@]} -eq 0 || -z "${FINDINGS[0]:-}" ]]; then
    echo "clean"
  else
    printf '%s\n' "${FINDINGS[@]}" | cut -f1 | sort | uniq -c | sort -rn
  fi
else
  if [[ ${#FINDINGS[@]} -eq 0 || -z "${FINDINGS[0]:-}" ]]; then
    : # 干净时不输出，避免刷屏
  else
    for f in "${FINDINGS[@]}"; do
      [[ -z "$f" ]] && continue
      rule="$(printf '%s' "$f" | cut -f1)"
      sev="$(printf '%s' "$f" | cut -f2)"
      line="$(printf '%s' "$f" | cut -f3)"
      msg="$(printf '%s' "$f" | cut -f4)"
      printf '%s [%s] %s:%s  %s\n' "$rule" "$sev" "$rel" "$line" "$msg"
    done
  fi
fi

exit "$WORST"
