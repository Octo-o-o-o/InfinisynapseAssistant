# Samples

可复制/可跑的 InfiniSynapse 集成骨架。代码示例不连真实 API，演示**正确的调用契约**；接真实环境时把 API Key 放进服务端密钥管理。

## SDK 参考实现

| 目录 | 语言 | 内容 | 可验证 |
| --- | --- | --- | --- |
| `sdk/typescript/` | TypeScript (Node 18+) | 零依赖 client + 纯函数 SSE 解析 + 高阶 `runTask` + Express 代理 | `npm test`（离线 SSE 单测） |
| `sdk/python/` | Python 3 | 标准库 client + `SseParser` + `run_task` | `python3 -m unittest test_sse.py` |

## 模板

| 文件 | 内容 |
| --- | --- |
| `templates/server-side-agent-flow.md` | 后端代理架构的字段与时序总览 |
| `templates/curl-quickstart.md` | 不写代码、纯 curl 跑通一次长任务 |

## 默认架构

```text
前端 / mini-app  →  你的后端（持有 API Key）  →  InfiniSynapse Server API
```

先读 `AGENTS.md` 与 `docs/reference/`，再按语言进对应 SDK 目录。
