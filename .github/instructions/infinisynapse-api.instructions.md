---
applyTo: "**/*.{ts,tsx,js,py,md}"
---

# InfiniSynapse API Instructions

Use Chinese SaaS docs in `upstream-docs/infinisynapse-site/zh/markdown/` before writing endpoint calls. Do not expose API Keys in frontend code. Route non-agentic lightweight calls through a server-side LLM gateway; route agentic long tasks and workspace artifacts through InfiniSynapse. For long tasks, connect SSE before sending `newTask`.
