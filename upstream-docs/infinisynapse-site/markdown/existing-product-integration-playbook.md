# InfiniSynapse Existing Product Integration Playbook


> A focused integration guide for SaaS products and legacy systems that already have users, databases, permissions, queues, business state, or in-house AI capabilities. This playbook explains where InfiniSynapse should sit, what it should not replace, and how to handle multi-tenancy and long-running task side effects. Endpoint details should follow the InfiniSynapse Server API Reference and InfiniSynapse CLI API Reference.

## One-Sentence Rule

Do not treat InfiniSynapse as a reason to rewrite a mature product. Connect it as a controlled long-running Agent layer. Your product should continue to own users, permissions, core data, billing, deterministic business state, and low-latency capabilities. InfiniSynapse should handle multi-step research, report generation, workspace artifacts, optional Browser Use, and optional RAG or data-source collaboration.

## When This Applies

- The product already has a business database, user system, permission boundaries, subscriptions, usage tracking, or an admin console.
- The product already has short-path LLM calls, structured extraction, matching, scoring, RAG, or rules engines where latency and control matter.
- The new capability is a multi-step, long-running Agent task that should persist deliverables, such as deep research, report packages, material synthesis, strategy generation, or batch analysis.
- InfiniSynapse outputs need to become part of your own business workflow rather than being used manually from the InfiniSynapse console.

This does not apply to a one-off script or demo, where the smallest SDK-style long-task skeleton is usually enough. If browser automation is involved, first confirm that Browser Use is actually required and that the job cannot be completed through backend APIs, file upload, or database queries.

## Responsibility Boundary

| Keep in your product | Delegate to InfiniSynapse |
|----|----|
| Users, organizations, permissions, audit, billing, usage, risk control | Long-running Agent execution, SSE progress, task workspace |
| Business master data, state machines, delivery/order/project records | Multi-step research, report writing, candidate generation |
| Low-latency structured LLM calls, cacheable scoring, deterministic rules | Exploratory, synthetic, writing-heavy, artifact-producing tasks |
| Existing business knowledge systems with row-level permissions and evidence | RAG / data sources only after isolation and reuse boundaries are clear |
| Business-side file permissions and sensitive-data minimization | Current task workspace, final reports, and attachments |

Use this test: if a capability must strictly follow a business state machine, return quickly, be verified field by field, or obey row-level permissions, keep it in your own product by default. If it is long-running, requires synthesis across materials, and produces Markdown, PDF, spreadsheets, or attachments, InfiniSynapse is a better fit.

## Recommended Integration Layer

A mature product should add a backend adapter layer instead of calling InfiniSynapse directly from business code everywhere:

```
Frontend -> Product API -> AgentTaskService / InfiniSynapseAdapter -> InfiniSynapse Server API
                         -> Product DB / Queue / Artifact Store
```


The adapter layer should:

- Centralize the base URL, API key, request envelope, binary downloads, and error normalization.
- Generate and persist `taskId`, `connId`, the business input snapshot, upload mappings, workspace file indexes, and error summaries.
- Connect SSE first, then send `newTask`.
- Convert InfiniSynapse SSE events into your product's task status and frontend progress.
- After completion, read `getTaskWorkspace`, `previewFile`, or `downloadTaskFile`, then save an artifact index in your own product.

## Use InfiniSynapse Assistant As An AI Integration Guardrail

If your team uses Codex, Claude Code, Cursor, GitHub Copilot, or another AI coding assistant during integration work, use [Octo-o-o-o/InfinisynapseAssistant](https://github.com/Octo-o-o-o/InfinisynapseAssistant) as pre-integration material. This repository is not InfiniSynapse itself, and it is not a business application template. It packages the public Chinese SaaS and API docs, private deployment docs, CLI docs, Chrome Browser Use docs, and product calling patterns into AI-readable rules, skills, SDK examples, and scanners.

It fits into a mature product integration process as a development guardrail:

- Before solution design, ask the AI assistant to read the repository's `AGENTS.md`, then the relevant `.agents/skills/infinisynapse-*` skill and Chinese SaaS docs. This reduces guessed endpoints, request bodies, and SSE ordering mistakes.
- For long-running projects, add the repository as `vendor/InfinisynapseAssistant` or as a git submodule, then reference it from your product's own `AGENTS.md` or `CLAUDE.md`. If your AI tool supports skills, copy or sync the `infinisynapse-*` skills.
- When you need code scaffolding, internalize only the TypeScript / Python client, SSE parsing, `runTask`, upload/download, and backend proxy examples from `samples/sdk/` into your own backend. Do not put API keys or direct InfiniSynapse calls in the frontend.
- Call its scanner from pre-commit or CI to catch common anti-patterns such as hardcoded Bearer tokens, frontend code calling InfiniSynapse directly, sending `newTask` before connecting SSE, parsing binary downloads as JSON, or misspelling private-deployment environment variables.
- When integration work reveals reusable endpoints, error codes, upload/download details, Browser Use patterns, or security anti-patterns, decide whether they are reusable across projects before contributing them back to the rules package, playbooks, SDK, or scanner. Do not put private prompts, user data, or business-specific rules into the shared rules package.

Recommended business-project rule:

```
This project depends on InfiniSynapse. For Server API, SSE, workspace, RAG,
Browser Use, file upload/download, private deployment, or task sharing work,
read vendor/InfinisynapseAssistant/AGENTS.md first, then the relevant skill
and Chinese SaaS docs.
Do not invent APIs unless an endpoint is explicitly documented.
API keys must stay on the server; the frontend may call only this project's backend.
```


## Phased Rollout

### P0: One Low-Risk Closed Loop

Start with a small user group, one business flow, and a long-running task that can be manually reviewed, such as "generate a deep report" or "analyze a material package":

1.  Pin the InfiniSynapse Assistant rules entry in the business project, so AI-assisted integration work reads the rules package and relevant skills first.
2.  Keep the backend feature flag off by default, and fail closed when the API key is missing.
3.  Create your own `AgentTask` table with `taskId`, `connId`, input hash, status, workspace snapshot, and error fields.
4.  Let the API route create the business task and enqueue work only; do not run the full long task in the request thread.
5.  Let the worker establish SSE first, send `newTask`, and persist progress continuously.
6.  After completion, read the workspace and create business-facing artifact records.
7.  Show only your own business task ID in the frontend. Do not let users call InfiniSynapse endpoints directly.

### P1: Recovery, Reuse, and Cancellation

- Use `input_hash` to deduplicate repeated requests from the same user: completed tasks can be reused, and in-progress tasks can return the existing record.
- Support `cancelTask` and mark the record as `cancelled` in your own database.
- After a worker crash, query `getUiMessageById` and `getTaskWorkspace` before resending `newTask`.
- Version or snapshot artifacts so later tasks do not overwrite what the business UI is displaying.

### P2: RAG, Data Sources, Sharing, and Browser Use

Add these only after P0 and P1 are stable:

- RAG / data sources: list and enable them before `newTask`; do not put private materials into shared long-term RAG by default.
- Task sharing: confirm public exposure on the business side before calling `setShare`; never make sensitive tasks public by default.
- Browser Use: enable it only when the task clearly requires operating a user's browser; check `/api/ai_browser/session` before task creation.
- ZIP / file downloads: treat download endpoints as binary streams, not JSON envelopes.

## Multi-Tenancy and Single API Key Boundary

In SaaS mode, one InfiniSynapse API key usually maps to one InfiniSynapse account and console view. It lets your backend safely proxy requests, but it does not create a physically isolated InfiniSynapse tenant for every business user.

Default constraints:

- Your product must enforce business task and artifact access through its own user and organization permissions.
- Do not treat an InfiniSynapse `taskId` as a frontend authorization token. The frontend should call your backend with your own `agentTaskId`.
- For ordinary multi-tenant SaaS, assume business-side logical isolation only. High-sensitivity scenarios should evaluate private deployment, per-tenant API keys, or separate environments. Exclusive compute resources improve stability and execution boundaries, but they do not replace business tenant isolation.
- Do not put private files from multiple users, such as resumes, contracts, or customer materials, into one shared long-term RAG by default.
- Browser Use sessions may be tied to the InfiniSynapse account or browser extension connection. Do not open browser automation to all tenant users until per-user session isolation is clear.

## Long-Running Workers and Idempotency

`newTask` is an external side effect. Queue retries should not treat it like a pure function.

Recommended practices:

- Pre-generate `taskId` and `connId` before enqueueing and write them to your own database.
- Use your own task ID as the queue `jobId` to avoid duplicate enqueueing.
- Do not let a worker blindly resend `newTask` forever after a crash. On recovery, first inspect `getUiMessageById`, `getTaskWorkspace`, and local status.
- If retry is required, first decide whether the same `taskId` already has messages or workspace artifacts. Then continue listening, mark it for manual handling, or explicitly create a new task.
- Long SSE workers need a long enough lock, heartbeat or lock renewal, graceful shutdown, and timeout strategy.
- Store only redacted error summaries in error objects and logs. Do not store full API keys, full sensitive inputs, or downloaded file contents.

## Input Snapshots and Privacy

The business database needs enough information to recover, but it should not preserve sensitive raw text without limits.

Recommended fields:

- Business object ID, version ID, input summary, content hash, prompt version, and user instructions.
- Mappings after files are uploaded into the task workspace, plus filename, size, and type.
- Workspace artifact path, artifact type, generation time, and display summary.

Be careful with:

- Full resumes, contracts, chat logs, customer materials, contact details, identity numbers, and other sensitive raw text.
- Full Agent intermediate messages. If audit requires them, apply redaction, retention limits, and access controls.

## Coexisting with Existing AI / RAG Systems

Mature products often already have in-house extraction, matching, scoring, or knowledge systems. Do not replace all of them just because you are integrating InfiniSynapse.

Common reasons to keep existing capabilities:

- They already have structured schemas, caches, test cases, and regression metrics.
- They already provide source evidence, human review, row-level permissions, or business rules.
- The user interaction needs second-level latency instead of a long-running task.
- Downstream state machines depend on deterministic fields.

InfiniSynapse is better at strengthening:

- Combining multiple existing results into a deliverable report.
- Deep research and reasoning over one complex object.
- Generating downloadable, shareable, traceable artifacts.
- Saving stable outputs, after user confirmation, for reuse in later tasks.

## Things Not To Do By Default

- Do not convert every business flow into an InfiniSynapse long-running task.
- Do not use Browser Use for work that backend APIs, file upload, or database queries can complete.
- Do not mix multiple users' private long-term RAG content under one public SaaS API key by default.
- Do not assume an unpublished native mini-app or plugin marketplace API exists. Unless upstream documentation explicitly adds such an API, integrate through your own backend plus the Server API.
- Do not automatically execute external write actions such as applications, payments, publishing, deletion, or sending messages. High-risk actions require planning and approval.

## Checklist

- Have you decided which capabilities stay in your product and which go to InfiniSynapse?
- Is the API key server-side only, and does the frontend call only your own backend?
- Are `taskId`, `connId`, input hash, upload mappings, workspace snapshot, and errors persisted?
- Does the worker connect SSE before `newTask`, and does it avoid blind retries of external side effects?
- Are single-key multi-tenant boundaries covered by business permissions and artifact access control?
- Are RAG and Browser Use added only when needed, instead of enabled by default in P0?
- Do you have a feature flag, usage limits, cancellation, recovery, and redacted logs?
- Is InfiniSynapse Assistant pinned in the business project as an AI rules package, SDK reference, or scanner source?
