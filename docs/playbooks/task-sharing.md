# 任务分享 Playbook

> 特定用法总结：把任务设为公开只读后，`public*` 系列接口**无需鉴权**即可读该任务的消息、文件、产物。本文给"该不该公开、公开什么、怎么公开、怎么撤销"的决策与清单。
> 端点事实见 `docs/reference/api-index.md` 任务分享一节（对应上游 server-api §3.6）。

## 一句话规则

公开 = **任何拿到 `taskId` 的人都能无鉴权读到该任务的全部消息和文件**。只公开你愿意完全公开的任务；分享前先确认产物和消息里没有敏感信息。

## 关键安全事实（先读）

- `setShare` / `shareStatus` 需**所有者鉴权**——只有你能改公开状态、查状态。
- `publicTask` / `publicMessagePayload` / `publicTaskFileTree` / `publicPreviewFile` / `publicDownloadTaskFile` / `publicDownloadZip` 全部**无鉴权**：只要任务 `isPublic` 且知道 `taskId`，任何人都能读。
- `taskId` 是 UUID，但**别把"难猜"当访问控制**——它会出现在分享链接里，等于公开。

## 端点

| 端点 | 鉴权 | 用途 |
| --- | --- | --- |
| `POST /api/ai_task/setShare` `{taskId, isPublic}` | 需所有者 | 设公开/私有 |
| `GET /api/ai_task/shareStatus?taskId=` | 需所有者 | 查分享状态 |
| `GET /api/ai_task/publicTask?taskId=` | 无 | 公开读任务数据 |
| `GET /api/ai_task/publicMessagePayload?taskId=&messageTs=` | 无 | 公开读单条消息完整内容 |
| `GET /api/ai_task/publicTaskFileTree/:taskId` | 无 | 公开读文件树 |
| `POST /api/ai_task/publicPreviewFile` | 无 | 公开读预览文件 |
| `GET /api/ai_task/publicDownloadTaskFile/:taskId?path=` | 无 | 公开下载文件（二进制；`inline=1` 可内联图片/PDF） |
| `GET /api/ai_task/publicDownloadZip?taskId=` | 无 | 公开下载任务 ZIP（二进制） |

## 决策：该公开吗

| 适合公开 | 不要公开 |
| --- | --- |
| 公开 demo、可分享的报告样例 | 含用户隐私 / 个人信息的任务 |
| 营销/展示用结果页 | 含内部数据、上传的敏感资料 |
| 给无账号用户看的只读结果 | 输出里可能带密钥/凭据/内部链接 |

## 推荐流程

1. 任务完成后，**先自查**：用 `getTaskWorkspace` + `previewFile` 确认产物和消息没有敏感信息。
2. `POST /api/ai_task/setShare` `{taskId, isPublic:true}`（所有者鉴权）。
3. 你的前端公开页用 `publicTask` + `publicPreviewFile` + `publicDownloadTaskFile`（`inline=1`）渲染报告/图表。
4. 撤销分享：`setShare` `{isPublic:false}`；用 `shareStatus` 核对。

## 公开页也建议走后端代理

即使是公开结果页，建议仍由**你的后端代理** `public*` 读取，而不是把 InfiniSynapse 的 public 端点直接暴露给浏览器：

- 便于加访问日志、限流、二次脱敏。
- 避免把 InfiniSynapse 域名 + `taskId` 直接暴露在前端，绕过你的审计。
- 但请记住 `public*` 本身无鉴权——**代理与否都不要公开未脱敏的敏感任务**。

## 常见反模式

- 把含上传隐私资料 / 内部数据的任务设为 `public`。
- 以为 `taskId` 难猜就安全（它在分享链接里）。
- 公开后不给用户撤销入口。
- 公开页直接暴露 InfiniSynapse 域名 + `taskId`，绕过你的后端审计。

## 检查清单

- 这个任务的**全部**消息和文件都可以对公众可见吗？
- 分享前是否检查了 workspace 产物和消息无敏感信息？
- 是否提供了撤销分享（`isPublic:false`）的入口？
- 公开读是否经过你的后端（便于日志 / 限流 / 脱敏）？
