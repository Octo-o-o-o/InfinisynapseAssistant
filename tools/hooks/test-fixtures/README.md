# 扫描器测试 fixtures

`tools/test-suite.sh` 用这些样本断言 `lib/scan-infinisynapse.sh` 的退出码，防止正则调整时悄悄退化。

| fixture | 期望 exit | 命中规则 |
| --- | --- | --- |
| `bad-hardcoded-key.ts` | 2 | INF-SEC-001（硬编码 Bearer） |
| `bad-frontend-direct.tsx` | 2 | INF-SEC-002（前端直连）+ INF-SSE-001 |
| `bad-harmonyos-direct.ets` | 2 | INF-SEC-002（鸿蒙 ArkTS 客户端直连） |
| `bad-authing.env` | 2 | INF-ENV-001/002/003 |
| `bad-authing-path.env` | 1 | INF-ENV-003（AUTHING_SERVER_URL 路径不是裸 /api） |
| `bad-newtask-no-sse.ts` | 1 | INF-SSE-001（newTask 未先连 SSE） |
| `bad-download-as-json.ts` | 1 | INF-DL-001（下载当 JSON） |
| `bad-wrong-success-code.ts` | 1 | INF-API-001（信封成功码写成 0） |
| `good-server-proxy.ts` | 0 | 干净（后端代理 + 先连 SSE） |
| `good-deploy.env` | 0 | 干净（AUTHING_SERVER_URL 正确） |
| `good-doc-tokens.ts` | 0 | 干净（注释/占位 token 不误报） |
| `good-harmonyos-proxy.ets` | 0 | 干净（鸿蒙 app 只连自有后端） |

退出码语义：`2`=存在 HIGH（应阻塞），`1`=仅 MEDIUM/LOW（提醒），`0`=干净，`64`=用法错误（文件不存在等，CI wrapper 不要吞掉）。

新增规则时，至少加一个对应 fixture（一个触发、必要时一个不触发的对照）。
