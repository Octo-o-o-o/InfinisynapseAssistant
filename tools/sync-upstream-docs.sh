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

fetch "$BASE/zh/docs" "$ZH_HTML_DIR/docs-index.html"
fetch "$BASE/zh/docs/Chrome%20Plugin%20Install" "$ZH_HTML_DIR/chrome-plugin-install.html"
fetch "$BASE/zh/docs/InfiniSynapse%20CLI%20API%20Reference" "$ZH_HTML_DIR/cli-api-reference.html"
fetch "$BASE/zh/docs/InfiniSynapse%20Private%20Deployment%20Guide" "$ZH_HTML_DIR/private-deployment-guide.html"
fetch "$BASE/zh/docs/InfiniSynapse%20Server%20API%20Reference" "$ZH_HTML_DIR/server-api-reference.html"

fetch "$BASE/en/docs" "$HTML_DIR/docs-index.html"
fetch "$BASE/en/docs/Chrome%20Plugin%20Install" "$HTML_DIR/chrome-plugin-install.html"
fetch "$BASE/en/docs/InfiniSynapse%20CLI%20API%20Reference" "$HTML_DIR/cli-api-reference.html"
fetch "$BASE/en/docs/InfiniSynapse%20Private%20Deployment%20Guide" "$HTML_DIR/private-deployment-guide.html"
fetch "$BASE/en/docs/InfiniSynapse%20Server%20API%20Reference" "$HTML_DIR/server-api-reference.html"

convert "$ZH_HTML_DIR/docs-index.html" "$ZH_MD_DIR/docs-index.md" "../../assets"
convert "$ZH_HTML_DIR/chrome-plugin-install.html" "$ZH_MD_DIR/chrome-plugin-install.md" "../../assets"
convert "$ZH_HTML_DIR/cli-api-reference.html" "$ZH_MD_DIR/cli-api-reference.md" "../../assets"
convert "$ZH_HTML_DIR/private-deployment-guide.html" "$ZH_MD_DIR/private-deployment-guide.md" "../../assets"
convert "$ZH_HTML_DIR/server-api-reference.html" "$ZH_MD_DIR/server-api-reference.md" "../../assets"

convert "$HTML_DIR/docs-index.html" "$MD_DIR/docs-index.md" "../assets"
convert "$HTML_DIR/chrome-plugin-install.html" "$MD_DIR/chrome-plugin-install.md" "../assets"
convert "$HTML_DIR/cli-api-reference.html" "$MD_DIR/cli-api-reference.md" "../assets"
convert "$HTML_DIR/private-deployment-guide.html" "$MD_DIR/private-deployment-guide.md" "../assets"
convert "$HTML_DIR/server-api-reference.html" "$MD_DIR/server-api-reference.md" "../assets"

for i in $(seq 1 14); do
  fetch "$BASE/chromePluginInstall/$i.png" "$ASSET_DIR/chromePluginInstall/$i.png"
done
fetch "$BASE/docs/server-api/api-key-management-entry.png" "$ASSET_DIR/docs/server-api/api-key-management-entry.png"
fetch "$BASE/docs/server-api/api-key-management-page.png" "$ASSET_DIR/docs/server-api/api-key-management-page.png"
fetch "$BASE/docs/server-api/compute-resource-selector.png" "$ASSET_DIR/docs/server-api/compute-resource-selector.png"
fetch "$BASE/logo.png" "$ASSET_DIR/logo.png"

echo "synced InfiniSynapse public docs into $ROOT/upstream-docs/infinisynapse-site"
