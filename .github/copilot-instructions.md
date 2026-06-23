# Copilot Instructions

This repository is an InfiniSynapse AI workspace. Before suggesting InfiniSynapse code:

- Follow `AGENTS.md`.
- Search `upstream-docs/infinisynapse-site/zh/markdown/` for endpoint names; English docs are supplemental only.
- Keep InfiniSynapse API Keys on the server side.
- Use SSE before sending `newTask`: `GET /api/ai/events?connId=...` then `POST /api/ai/message`.
- Use task workspace APIs for generated artifacts.
- For private deployment, validate `AUTHING_SERVER_URL`.
