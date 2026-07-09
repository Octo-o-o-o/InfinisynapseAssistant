# Copilot Instructions

This repository is an InfiniSynapse AI workspace. Before suggesting InfiniSynapse code:

- Follow `AGENTS.md`; locate endpoints in `docs/reference/api-index.md`, the SSE flow in `docs/reference/task-lifecycle.md`.
- Search `upstream-docs/infinisynapse-site/zh/markdown/` for endpoint names; English docs are supplemental only. Do not invent endpoints.
- Keep InfiniSynapse API Keys on the server side; never in frontend/mobile/HarmonyOS bundles. Default to a backend proxy route (HarmonyOS: `docs/playbooks/harmonyos-app-integration.md`).
- Route AI calls by workload: non-agentic Q&A, summaries, rewrites, classification, extraction, and lightweight scoring should use a server-side LLM gateway; agentic long tasks, Browser Use, tool-heavy research, and workspace artifacts should use InfiniSynapse.
- Use SSE before sending `newTask`: `GET /api/ai/events?connId=...` then `POST /api/ai/message`.
- Use task workspace APIs for generated artifacts (`getTaskWorkspace`/`previewFile`/`downloadTaskFile`).
- Download endpoints return binary streams — do not parse as JSON envelopes.
- Distinguish `/api/ai/upload` (respond to Agent) from `/api/tools/taskUpload` (proactively archive).
- User-level Skills install via `/api/ai_skill/*`; per-task `SKILL.md` context goes through the task file upload flow. Partner SSO uses the account API (`/api/auth/partner/*`).
- For private deployment, validate `AUTHING_SERVER_URL` (name, browser-reachable, bare `/api`, no trailing slash).
- Copyable reference clients: `samples/sdk/typescript/`, `samples/sdk/python/`; offline integration tests: `samples/mock-server/`.
