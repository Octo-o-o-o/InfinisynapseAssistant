# Plan

## Completed in initial scaffold

- Fetched Chinese SaaS/API docs into `upstream-docs/infinisynapse-site/zh/html/`.
- Converted Chinese SaaS/API docs into Markdown under `upstream-docs/infinisynapse-site/zh/markdown/`.
- Fetched English supplemental docs into `upstream-docs/infinisynapse-site/html/`.
- Converted English supplemental docs into Markdown.
- Downloaded Chrome plugin images.
- Downloaded Chinese Server API SaaS screenshots for API Key Management and compute resource selection.
- Verified that the GitHub source repository referenced by the docs currently returns 404.
- Created cross-tool rules: `AGENTS.md`, `CLAUDE.md`, `llms.txt`.
- Created task skills for deployment, Server API, CLI API, product patterns, and Browser Use.
- Added sync, doctor, and test scripts.

## Next improvements

1. Add source-aware rules after `infini_docker` becomes available.
2. Create SDK examples for Node.js and Python server-side integrations.
3. Add an SSE parser sample with reconnection, timeout, and cancellation behavior.
4. Add deployment acceptance checklist for production Linux hosts.
5. Add a RAG-ready index or embedding pipeline over `upstream-docs/`.
6. Add contract tests against a real private deployment when credentials and host are available.
