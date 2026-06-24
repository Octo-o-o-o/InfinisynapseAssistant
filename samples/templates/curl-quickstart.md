# curl 快速验证流程

不写代码，纯 curl 跑通一次长任务。用来在接 SDK 之前确认 API Key 和环境可用。

> 所有命令仅在服务端/本机终端执行。`API_KEY` 来自 `https://app.infinisynapse.cn/tasks` 左下角 **API Key Management**。

```bash
export INF="https://app.infinisynapse.cn"     # 海外用 .com；私有化部署用自有地址
export API_KEY="<你的 API Key>"
export CONN_ID="$(uuidgen | tr 'A-Z' 'a-z')"
```

## 0. 心跳确认鉴权可用

```bash
curl -s "$INF/api/ai/ping" -H "Authorization: Bearer $API_KEY"
# 期望：{"code":200,...,"data":{"ok":true}} 或 {"ok":true}
```

## 1. 先连 SSE（单开一个终端，保持运行）

```bash
curl -N "$INF/api/ai/events?connId=$CONN_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: text/event-stream"
# 保持这个连接开着，能看到 event: state.ready / message.partial / heartbeat
```

## 2. 另开终端发任务（带同一个 connId）

```bash
curl -s -X POST "$INF/api/ai/message" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"newTask\",\"text\":\"用一句话介绍你自己\",\"connId\":\"$CONN_ID\",\"chatSettings\":{\"mode\":\"act\"}}"
```

回到第 1 步的终端，应能看到流式 `message.partial`，最终出现 `completion_result`。

## 3. 取任务 ID 与产物

`message.add` 的 data 里带 `taskId`。拿到后：

```bash
export TASK_ID="<上一步得到的 taskId>"

# 枚举工作区产物（不要只读最后一条文本）
curl -s "$INF/api/ai_task/getTaskWorkspace/$TASK_ID" -H "Authorization: Bearer $API_KEY"

# 预览某个文本/Markdown 文件
curl -s -X POST "$INF/api/ai_task/previewFile" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"fileName\":\"report.md\"}"

# 下载二进制产物（注意 path 要 URL 编码；这是二进制流，不要当 JSON）
curl -s "$INF/api/tools/storage/downloadTaskFile/$TASK_ID?path=report.pdf" \
  -H "Authorization: Bearer $API_KEY" -o report.pdf
```

## 4. 多轮追问 / 取消

```bash
# 同一个 taskId 继续对话
curl -s -X POST "$INF/api/ai/message" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"type\":\"askResponse\",\"taskId\":\"$TASK_ID\",\"askResponse\":\"messageResponse\",\"text\":\"再展开第二点\"}"

# 取消
curl -s -X POST "$INF/api/ai/message" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"type\":\"cancelTask\",\"taskId\":\"$TASK_ID\"}"

# 兼容旧部署时可 fallback：
# curl -s "$INF/api/ai_task/cancelTask?taskId=$TASK_ID" -H "Authorization: Bearer $API_KEY"
```

## 常见失败

| 现象 | 排查 |
| --- | --- |
| 第 1 步没有任何输出 | `Authorization` 是否正确；是否先连 SSE 再发任务 |
| `code` 为 `1101`/`1105` | API Key 过期/失效，去 API Key Management 重建 |
| HTTP 422 | 请求体字段错误，看 `message` |
| 下载得到一堆乱码当成报错 | 那是二进制流，用 `-o file` 存盘，别打印 |
