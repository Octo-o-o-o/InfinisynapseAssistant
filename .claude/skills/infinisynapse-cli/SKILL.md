---
name: infinisynapse-cli
description: |
  agent_infini CLI API 映射、CLI 网络请求排查、CLI 与 Server/Console 服务关系。
  激活条件:
    - 用户提到 agent_infini、CLI、task new、task ask、db ls、rag ls
    - 用户要复刻 CLI 行为或排查 CLI 网络问题
---

# InfiniSynapse CLI API

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/cli-api-reference.md`
- `upstream-docs/infinisynapse-site/markdown/cli-api-reference.md` 作为英文补充参考

## 服务关系

`agent_infini` 使用两类服务:

| Service | Default address | Role |
| --- | --- | --- |
| Server | `https://app.infinisynapse.cn` | 任务、数据库、RAG、workspace 文件 |
| Console | `https://api.infinisynapse.cn/api` | 校验 API Key 并获取 `userId` |

两者可在 `~/.agent_infini/config.txt` 覆盖。

## CLI endpoint map

| CLI command | Endpoint(s) |
| --- | --- |
| `init` | `GET {console}/user/profile` |
| `task new` | `GET /api/ai/events`, `POST /api/ai/message` with `newTask` |
| `task ask` | `GET /api/ai/events`, `POST /api/ai/message` with `askResponse` |
| `task cancel` | `POST /api/ai/message` with `cancelTask` |
| `task ls` | `GET /api/ai_task/list` |
| `task show` | `getTaskInfo`, `getUiMessageById`, `getTaskWorkspace` |
| `task preview` | `POST /api/ai_task/previewFile` |
| `task download` | `GET /api/tools/storage/downloadTaskFile/{taskId}` |
| `db ls` | `GET /api/ai_database/list` |
| `db enable/disable` | `POST /api/ai_database/enabled` |
| `rag ls` | `GET /api/ai_rag_sdk` |
| `rag enable/disable` | `POST /api/ai_rag_sdk/enabled` |

## Troubleshooting

- `1101` / `1105`: API Key expired or invalid. Re-run `agent_infini init` or update config.
- Service unreachable: check `server` and `console` addresses.
- Task not found: run `task ls`.
- No available resources: run `task context`, then enable DB/RAG resources.
