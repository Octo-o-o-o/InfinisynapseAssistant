# Project Architecture

This workspace follows the same broad idea as `HarmonyOS_DevSpace`: one local repository acts as an AI-readable rule pack, with cross-tool entry files, skills, upstream documentation, and lightweight validation scripts.

It deliberately does not copy HarmonyOS-specific compiler hooks. InfiniSynapse development has different failure modes.

## Layers

| Layer | Directory | Purpose |
| --- | --- | --- |
| Entry rules | `AGENTS.md`, `CLAUDE.md`, `llms.txt` | First files an AI assistant should read |
| Task skills | `.agents/skills/`, `.claude/skills/` | Scenario-specific instructions |
| Tool fan-out | `.cursor/rules/`, `.github/` | Cursor and Copilot compatible instructions |
| Upstream docs | `upstream-docs/` | Official public documentation snapshots |
| Upstream source | `upstream-src/` | Placeholder for `infini_docker` source or offline package |
| Operations docs | `docs/` | Audit, usage, plan, quick reference |
| Scripts | `tools/` | Sync, doctor, and test commands |

## Why this architecture

The HarmonyOS project needs language rules, build hooks, and scanner feedback because AI often writes ArkTS that does not compile.

InfiniSynapse work is more service-oriented. The important constraints are:

- Correct deployment environment variables and network exposure.
- Correct API flow: SSE connection before message dispatch.
- Correct credential boundaries: API Key server-side.
- Correct distinction between sandbox uploads, workspace uploads, preview, and download.
- Correct product pattern selection: not every task needs Browser Use.
- Fast local lookup because public AI training data is thin.

So this workspace focuses on task-triggered skills, endpoint references, and product integration checklists.

