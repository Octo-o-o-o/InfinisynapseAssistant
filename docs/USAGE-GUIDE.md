# Usage Guide

## First run

```bash
bash tools/doctor.sh
npm test
```

If `pandoc` is installed, you can refresh the public documentation mirror:

```bash
bash tools/sync-upstream-docs.sh
```

## Asking an AI assistant to build on InfiniSynapse

Good prompt shape:

```text
Use this workspace as the InfiniSynapse rule pack. Read AGENTS.md, then use the relevant skill.
Build a server-side route that starts a long-running report task, streams progress to my frontend, uploads source files when needed, and downloads the final PDF.
```

The assistant should then load:

- `AGENTS.md`
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- `.agents/skills/infinisynapse-product-patterns/SKILL.md`
- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md`

## Common tasks

| Task | Read first |
| --- | --- |
| Deploy privately | `infinisynapse-deployment` skill |
| Debug blank page / 401 after deployment | `private-deployment-guide.md` section 8 |
| Build an SDK or backend route | `infinisynapse-server-api` skill |
| Build a report-writing product | `infinisynapse-product-patterns` skill |
| Use CLI endpoints | `infinisynapse-cli` skill |
| Browser automation or shopping comparison | `infinisynapse-browser-extension` skill |

## Development posture

- Use the Chinese SaaS docs in `upstream-docs/infinisynapse-site/zh/markdown/` before web search.
- Use the English docs only as supplemental context when Chinese docs do not cover a detail.
- Do not guess endpoint names.
- Keep API Key server-side.
- Connect SSE before sending `newTask`.
- Store `taskId`, `connId`, upload mappings, and final workspace paths in your own database.
- Treat binary download endpoints as non-envelope responses.
