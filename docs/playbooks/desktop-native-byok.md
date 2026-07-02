# 桌面 / 原生 BYOK 接入 Playbook

> 特定用法总结：单用户桌面端、Tauri、Electron、原生移动或原生桌面应用如何在不泄露 InfiniSynapse API Key 的前提下，让用户填自己的 Key 使用云端 Agent。
> 多租户 SaaS、团队版或企业统一 Key 仍优先采用 `secure-integration.md` 的服务端业务路由。

## 一句话规则

"服务端持 Key"的本质是"可信后端边界持 Key"。在单用户 BYOK 桌面 / 原生应用里，这个可信边界可以是 Electron main process、Tauri command、macOS Keychain 背后的 native service、Windows Credential Manager、Android Keystore 或 iOS Keychain 原生层；renderer、WebView、网页前端和 JS bundle 永远不能持有 API Key。

## 默认架构

```text
Renderer / WebView / UI
  -> 受控 IPC / Native bridge / App service API
    -> 主进程或原生层（Keychain/Keystore 持 Key、托管 connId/taskId/SSE）
      -> InfiniSynapse Server API
```

这不是多租户产品后端的替代品。只要存在团队共享 Key、管理员统一配额、服务端审计、跨设备恢复、后台通知或企业合规要求，就应把可信边界放到业务后端。

## 适用范围

| 场景 | 是否适用 | 说明 |
| --- | --- | --- |
| 单用户桌面应用，用户手动填自己的 InfiniSynapse Key | 适用 | Key 存系统密钥链，主进程托管请求 |
| Electron / Tauri 应用，本地 renderer 只是 UI | 适用 | renderer 只走受控 IPC，不直连 InfiniSynapse |
| 原生 iOS / Android 应用，Key 存 Keychain / Keystore | 有条件适用 | WebView 或 JS runtime 不得读取 Key |
| 多租户 Web SaaS，平台替用户统一调用 | 不适用 | 必须走服务端业务路由 |
| 企业统一 Key、计费、审计、权限隔离 | 不适用 | Key 和 SSE consumer 应在企业后端 |

## 信任边界

| 内容 | 允许位置 | 禁止位置 |
| --- | --- | --- |
| API Key | 系统 Keychain / Keystore / Credential Manager / 主进程加密凭据存储 | renderer state、localStorage、sessionStorage、IndexedDB、明文 SQLite、日志、截图、crash report |
| `Authorization` header | 主进程 / 原生层 HTTP client | renderer `fetch`、preload 任意 header 代理、WebView 注入脚本 |
| Base URL | 受控设置项，可允许私有化部署地址 | WebView 任意传入 URL 后直接请求 |
| `taskId` / `connId` | 主进程 / 原生层生成并持久化；UI 只拿业务 ID 或只读状态 | UI 自行拼 InfiniSynapse 请求 |
| SSE | 主进程 / 原生层消费并转换成产品事件 | renderer 直接带 Key 连接 `/api/ai/events` |
| 本地文件 | 用户选择后登记映射，再由主进程上传 | Agent 或 renderer 传任意本机路径给上传 API |

## 推荐 Bridge 形态

暴露产品语义方法，而不是 HTTP 代理：

```ts
interface InfiniSynapseBridge {
  getConfig(): Promise<{ enabled: boolean; baseUrl: string; hasApiKey: boolean }>;
  saveConfig(input: { enabled: boolean; baseUrl: string; apiKey?: string }): Promise<void>;
  deleteApiKey(): Promise<void>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  startTask(input: { prompt: string; attachments?: RegisteredAttachment[] }): Promise<{ localTaskId: string }>;
  cancelTask(input: { localTaskId: string }): Promise<void>;
  getWorkspace(input: { localTaskId: string }): Promise<WorkspaceSnapshot>;
  previewFile(input: { localTaskId: string; path: string }): Promise<FilePreview>;
}
```

不要暴露这些能力：

- `getApiKey()`、`getAuthorizationHeader()` 或返回完整 token 的配置接口。
- 任意 URL + method + headers 的通用代理。
- renderer 可控的本机文件路径上传。
- WebView 可控的 native class、系统命令、请求头或下载目标路径。
- 原始 provider 错误对象直出给 UI；错误展示前要脱敏。

## 长任务流程

1. 主进程 / 原生层生成 `connId`；需要恢复、取消或并发控制时同时生成本地业务任务 ID 和 InfiniSynapse `taskId`。
2. 先建立 `GET /api/ai/events?connId=<uuid>` SSE 连接。
3. 再调用 `POST /api/ai/message`，`type=newTask`，带同一个 `connId`，必要时带预生成的 `taskId`。
4. SSE consumer 只处理当前任务事件，并把 `message.partial`、`message.add`、`notification` 映射成产品状态。
5. 收到 `message.ask=upload_file_to_sandbox` 时，只能上传用户已登记的文件映射；缺映射时 fail closed 并提示用户重新选择文件。
6. 完成信号优先识别 `message.say=completion_result` 或 `message.ask=completion_result`；同时可把成功通知作为兜底。
7. 结束后读取 `getTaskWorkspace`、`previewFile`、`downloadTaskFile`，不要只依赖最后一条文本。
8. 取消优先走 `POST /api/ai/message`，`type=cancelTask`；`/api/ai_task/cancelTask?taskId=` 仅作为 legacy fallback。

## 持久化与恢复

本机至少保存：

- 本地业务任务 ID、InfiniSynapse `taskId`、`connId`。
- 输入摘要或 hash，便于去重和审计。
- 用户选择文件到可上传文件句柄 / 安全书签 / sandbox copy 的映射。
- 最新任务状态、错误摘要、workspace snapshot。
- 已归档到本机或自有对象存储的产物索引。

应用重启后，可以先恢复本地任务记录，再用 `getUiMessageById`、`getTaskWorkspace` 或业务自己的轮询状态重建 UI。不要把恢复能力建立在 renderer 内存或单个 SSE 连接上。

## 设置页 UX

- 保存时只允许写入新 Key，不回显旧 Key。
- 用 `hasApiKey` 表示是否已配置，不返回明文。
- 支持删除 Key 和禁用云端 Agent。
- Base URL 默认 `https://app.infinisynapse.cn`，私有化部署用户可修改；保存前做 URL 格式和 `/api` 前缀约束检查。
- 连接测试只返回 `ok`、脱敏错误码和可行动提示。

## 测试清单

- renderer / WebView 搜索不到 `Authorization: Bearer`、API Key、`/api/ai/message` 直连代码。
- preload / bridge 没有 `getApiKey`、任意 HTTP proxy、任意本机路径上传。
- API Key 写入系统密钥链或等价安全存储，日志和 crash report 中脱敏。
- SSE 单测覆盖分片、心跳、完成、错误、malformed JSON。
- 客户端单测覆盖 envelope `code===200`、`1101` / `1105` 失效 Key、二进制下载不按 JSON 解析。
- 长任务单测覆盖先连 SSE 再发 `newTask`、`cancelTask` 优先级、workspace files 为 string 或 object 两种形态。
- 上传请求只能使用登记文件映射；缺失文件映射时 fail closed。
- 私有化 baseUrl 覆盖 SaaS baseUrl 时不允许 renderer 注入任意 URL。

## 常见反模式

- Electron renderer 直接 `fetch("https://app.infinisynapse.cn/api/ai/message")` 并带 `Authorization`。
- preload 暴露 `getApiKey()` 或任意 headers 代理。
- 把用户 Key 存在 localStorage、IndexedDB、明文 SQLite 或 JSON 配置文件。
- 让 WebView 决定上传任意本机路径。
- 只在 renderer 内存里保存 `taskId` / `connId`，应用重启后无法取消或恢复。
- 多租户 SaaS 借用"桌面 BYOK"理由绕过服务端审计、限流和权限隔离。
