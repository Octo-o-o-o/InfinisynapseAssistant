# Server-side Agent Flow Template

Use this pattern when building a product feature on top of InfiniSynapse.

Do not use this long-task flow for every AI call. Non-agentic Q&A, summaries, rewrites, classification, extraction, and lightweight scoring should go through your server-side lightweight LLM route or gateway; use this template for agentic long tasks and workspace artifacts.

```text
Frontend
  POST /api/my-feature/start
    form fields, optional file metadata

Your backend
  1. Authenticate your user.
  2. Generate connId and taskId.
  3. Store pending business task row.
  4. Connect GET {INF_URL}/api/ai/events?connId=<connId>.
  5. POST {INF_URL}/api/ai/message with type=newTask.
  6. Stream/transform SSE to frontend.
  7. Upload files if Agent asks for upload_file_to_sandbox.
  8. On completion, read workspace and select required final artifacts.
  9. Download artifacts as text/binary, calculate checksum, and upload to your artifact store.
  10. Write artifact rows; durable products can also write an archive manifest and private workspace ZIP key.
  11. Serve product downloads from your own artifact store; use provider workspace only for recovery/backfill.

Frontend
  GET /api/my-feature/:id/events
  GET /api/my-feature/:id/result
```

Minimum server-owned fields:

- `businessTaskId`
- `taskId`
- `connId`
- `status`
- `userInput`
- `uploadedFiles`
- `workspaceFiles`
- `finalArtifacts`
- `error`

Optional mature-product fields:

- `archiveManifestKey`
- `workspaceZipKey`
- `artifactStoreKeys`
- `archiveStatus`

Recommended artifact row fields:

- `providerPath`
- `storageKey`
- `contentType`
- `size`
- `sha256`
- `isFinal`
- `isRequired`
- `visibility`
- `archiveStatus`
