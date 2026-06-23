# Server-side Agent Flow Template

Use this pattern when building a product feature on top of InfiniSynapse.

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
  8. On completion, read workspace and persist artifact paths.

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
- `finalArtifactPath`
- `error`

