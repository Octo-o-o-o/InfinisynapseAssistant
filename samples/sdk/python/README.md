# InfiniSynapse Python SDK（参考实现）

标准库零依赖的 InfiniSynapse Server API 客户端。**仅服务端使用**——不要把带 `api_key` 的代码下发到客户端。

契约对齐 [`docs/reference/api-index.md`](../../../docs/reference/api-index.md) 与 [`task-lifecycle.md`](../../../docs/reference/task-lifecycle.md)。

## 文件

| 文件 | 作用 |
| --- | --- |
| `infinisynapse_client.py` | `InfiniSynapseClient` + 纯函数 `SseParser` + 高阶 `run_task` |
| `example_run_task.py` | 跑一个长任务并读产物 |
| `test_sse.py` | 离线 SSE 解析器单测（不触网） |

## 快速开始

```python
from infinisynapse_client import ClientConfig, InfiniSynapseClient, run_task

client = InfiniSynapseClient(ClientConfig(api_key="<server-only>", region="cn"))
result = run_task(client, "分析最近一个月的销售趋势，输出 PDF 报告",
                  on_text=lambda t: print(t, end=""))

print(result.status)  # completed / error
for f in (result.workspace or {}).get("files", []):
    print("产物:", f.get("path") or f.get("name"))
```

## 验证

```bash
python3 -m unittest test_sse.py     # 离线 SSE 单测
python3 -m py_compile *.py           # 语法检查
```

## 说明

- 严格「先连 SSE 再发 newTask」：`run_task` 先 `open_events_response()`（立即 urlopen 建连），再 `new_task`，最后读流——不是惰性生成器。
- **SSE 重连（默认开启）**：流断开/心跳超时后指数退避重连，`getUiMessageById` 断点续传补回错过消息；`run_task(reconnect=True, max_retries=5, base_delay=0.5, max_delay=10, heartbeat_timeout=30)`，`result.reconnects` 记次数。`reconnect=False` 时断开即判错。
- 防永久阻塞：`run_task(max_seconds=600, read_timeout=5)`，无事件时定期检查死线后退出。
- 用户级 SSE 广播中的其它 `taskId` 会被过滤；旧事件缺少 `taskId` 时兼容放行。任务未完成即退出且已发出 `newTask` 时，`run_task` 默认 best-effort 调用 `cancel_task`；优雅停机/恢复交接传 `cancel_on_exit=False`。
- 流式文本按消息 `ts` 累积（同 ts 覆盖），避免服务端发累积快照时重复拼接。
- 支持两类上传：`upload_to_sandbox`（响应 Agent）/ `task_upload`（主动归档）；`run_task` 可传 `on_upload_request(message) -> (data, filename) | None` 自动应答 `upload_file_to_sandbox`。
- 下载端点返回二进制（`download_task_file` 返回 `bytes`），不要当 JSON。
- `ClientConfig.timeout` 只控制普通 JSON 请求；SSE 建连、multipart 上传、二进制下载分别可用 `sse_connect_timeout`（30s）、`upload_timeout`（120s）、`download_timeout`（300s）独立配置。
- 标准库 `urllib` 是单线程；生产并发/重连建议换 `httpx` + `asyncio` 或线程。市场订阅等端点未穷举，按需照 `api-index.md` 补。
