# Samples

可复制/可跑的 InfiniSynapse 集成骨架。代码示例默认不连真实 API，演示**正确的调用契约**；接真实环境时把 API Key 放进服务端密钥管理。

## SDK 参考实现

| 目录 | 语言 | 内容 | 可验证 |
| --- | --- | --- | --- |
| `sdk/typescript/` | TypeScript (Node ≥22.6 跑测试；client 本身 Node 18+/浏览器可用) | 零依赖 client + 纯函数 SSE 解析 + 高阶 `runTask` + Express 代理 + mock 集成测试 + opt-in 真实冒烟 | `npm test`（离线单测 + mock 集成测试）；`npm run smoke:live`（需真实 Key，会计费） |
| `sdk/python/` | Python 3 | 标准库 client + `SseParser` + `run_task` | `python3 -m unittest test_sse.py` |

## Mock Server

`mock-server/`：零依赖 Node 模拟器，无 Key 跑通「SSE → newTask → 产物」离线集成测试（本地/CI）。行为边界见其 README；联调以真实 API 为准。测试方法论见 `docs/playbooks/testing-and-evaluation.md`。

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
