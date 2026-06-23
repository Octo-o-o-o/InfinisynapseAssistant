# Quick Reference

## Deployment

- Recommended host: 8 cores, 32 GB RAM, 100 GB disk.
- Minimum RAM: 16 GB, but lower InfiniSQL memory settings.
- OS: Ubuntu 22.04 LTS recommended.
- Docker: Docker >= 24, Compose plugin >= 2.20.
- Exposed ports: `8088` main app, `80` admin console, `3000` auth API.
- `AUTHING_SERVER_URL` must be browser-reachable, usually `http://<server>:3000/api`.

## Base URLs

| Environment | Base URL |
| --- | --- |
| Mainland China | `https://app.infinisynapse.cn` |
| Overseas | `https://app.infinisynapse.com` |
| Private deployment | Your own service URL |

All Server API endpoints start with `/api`.

## SaaS Console

- API Key: open `https://app.infinisynapse.cn/tasks`, click lower-left settings, then **API Key Management**.
- Tasks created by your Server API integrations appear in **ALL TASKS**.
- `public-engine` is the default shared compute resource.
- Use **Create Exclusive Compute Resource** when a product needs more stable quota, resource isolation, or exclusive execution.

## Headers

```http
Authorization: Bearer <API Key>
Content-Type: application/json
x-lang: zh_CN
```

Uploads use `multipart/form-data`.

## Long task flow

1. `GET /api/ai/events?connId=<uuid>`
2. `POST /api/ai/message` with `type=newTask`
3. Consume SSE `message.partial`, `message.add`, `notification`, `heartbeat`
4. Continue with `type=askResponse`
5. Inspect artifacts with `GET /api/ai_task/getTaskWorkspace/:id`
6. Preview with `POST /api/ai_task/previewFile`
7. Download with `GET /api/tools/storage/downloadTaskFile/:taskId?path=`

## Upload modes

| Endpoint | Use |
| --- | --- |
| `/api/ai/upload?taskId=` | Respond to Agent sandbox upload request |
| `/api/tools/taskUpload/:taskId?subdir=&naming=` | Proactively archive product files into workspace |
| `/api/upload/:directory` | Generic directory upload |

## Common errors

| Symptom | First check |
| --- | --- |
| `1101` / `1105` | API Key expired or invalid |
| HTTP `422` | Request validation error |
| HTTP `400` | Business validation error |
| HTTP `404` | Resource missing or inaccessible |
| No SSE data | Authorization and whether SSE connected before sending message |
| Login fails / blank page after private deploy | `AUTHING_SERVER_URL` |
| `infini-sql` OOM | Lower InfiniSQL memory env vars |
