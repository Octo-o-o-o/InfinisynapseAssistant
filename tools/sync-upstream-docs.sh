#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="https://www.infinisynapse.cn"
HTML_DIR="$ROOT/upstream-docs/infinisynapse-site/html"
MD_DIR="$ROOT/upstream-docs/infinisynapse-site/markdown"
ZH_HTML_DIR="$ROOT/upstream-docs/infinisynapse-site/zh/html"
ZH_MD_DIR="$ROOT/upstream-docs/infinisynapse-site/zh/markdown"
ASSET_DIR="$ROOT/upstream-docs/infinisynapse-site/assets"

mkdir -p "$HTML_DIR" "$MD_DIR" "$ZH_HTML_DIR" "$ZH_MD_DIR" "$ASSET_DIR/chromePluginInstall" "$ASSET_DIR/docs/server-api"

fetch() {
  local url="$1"
  local out="$2"
  echo "fetch $url"
  curl -fsSL "$url" -o "$out"
}

convert() {
  local html="$1"
  local md="$2"
  local asset_prefix="$3"
  if command -v pandoc >/dev/null 2>&1; then
    pandoc -f html -t gfm-raw_html --wrap=none "$html" -o "$md"
    perl -0pi -e 's/^!\[\]\(data:image\/svg\+xml;base64,[^)]+\).*\n//mg; s/^Copy\n//mg; s/^(Navigation|导航)\n\n(?:- \[[^\n]+\]\([^\n]+\)\n)+\n//m; s/^\[(Home|首页)\]\(\/\)\/\[(Documentation|文档)\]\(\/(en|zh)\/docs\)\n\n//m' "$md"
    perl -0pi -e "s#\\(/chromePluginInstall/#(${asset_prefix}/chromePluginInstall/#g; s#\\(/docs/server-api/#(${asset_prefix}/docs/server-api/#g" "$md"
  else
    echo "pandoc not found; kept HTML only for $html" >&2
  fi
}

# 官方 docs 站页面清单（新增页面时同步更新：doctor.sh、docs/SOURCE-AUDIT.md、docs/MAINTENANCE.md）
# 格式：URL 路径段|本地文件名（不含扩展名）
PAGES=(
  "Chrome%20Plugin%20Install|chrome-plugin-install"
  "Connect%20Data%20Sources%20and%20Knowledge%20Base|connect-data-and-knowledge-base"
  "InfiniSynapse%20CLI%20API%20Reference|cli-api-reference"
  "InfiniSynapse%20Existing%20Product%20Integration%20Playbook|existing-product-integration-playbook"
  "InfiniSynapse%20Partner%20SSO%20Integration%20Guide|partner-sso-integration-guide"
  "InfiniSynapse%20Private%20Deployment%20Guide|private-deployment-guide"
  "InfiniSynapse%20Server%20API%20Reference|server-api-reference"
  "InfiniSynapse%20Vibe%20Coding%20Guide|vibe-coding-guide"
)

fetch "$BASE/zh/docs" "$ZH_HTML_DIR/docs-index.html"
fetch "$BASE/en/docs" "$HTML_DIR/docs-index.html"
for page in "${PAGES[@]}"; do
  slug="${page%%|*}"
  name="${page##*|}"
  fetch "$BASE/zh/docs/$slug" "$ZH_HTML_DIR/$name.html"
  fetch "$BASE/en/docs/$slug" "$HTML_DIR/$name.html"
done

convert "$ZH_HTML_DIR/docs-index.html" "$ZH_MD_DIR/docs-index.md" "../../assets"
convert "$HTML_DIR/docs-index.html" "$MD_DIR/docs-index.md" "../assets"
for page in "${PAGES[@]}"; do
  name="${page##*|}"
  convert "$ZH_HTML_DIR/$name.html" "$ZH_MD_DIR/$name.md" "../../assets"
  convert "$HTML_DIR/$name.html" "$MD_DIR/$name.md" "../assets"
done

for i in $(seq 1 14); do
  fetch "$BASE/chromePluginInstall/$i.png" "$ASSET_DIR/chromePluginInstall/$i.png"
done
fetch "$BASE/docs/server-api/api-key-management-entry.png" "$ASSET_DIR/docs/server-api/api-key-management-entry.png"
fetch "$BASE/docs/server-api/api-key-management-page.png" "$ASSET_DIR/docs/server-api/api-key-management-page.png"
fetch "$BASE/docs/server-api/compute-resource-selector.png" "$ASSET_DIR/docs/server-api/compute-resource-selector.png"
fetch "$BASE/logo.png" "$ASSET_DIR/logo.png"

echo "synced InfiniSynapse public docs into $ROOT/upstream-docs/infinisynapse-site"
