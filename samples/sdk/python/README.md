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

- 标准库 `urllib` 是单线程；`run_task` 用「先建连接、发任务、再读流」的简化策略。生产并发/重连建议换 `httpx` + `asyncio` 或线程。
- 下载端点返回二进制（`download_task_file` 返回 `bytes`），不要当 JSON。
- 区分两类上传见 `api-index.md` 第 5 节（本参考实现聚焦最常用路径，未穷举所有端点）。
