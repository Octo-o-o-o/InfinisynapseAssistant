# 下游项目接入与反哺 Playbook

> 特定用法总结：业务项目如何把本仓库作为 InfiniSynapse 规则包使用，并在开发中把通用经验反哺回来。

## 一句话规则

下游项目不要把本仓库当 npm 运行时依赖；应把它当 AI 规则包、扫描器和 SDK 参考。每次提交前检查是否有通用经验值得反哺，只有跨项目可复用的内容才进入本仓库。

## 下游项目应固定的内容

业务项目自己的 `AGENTS.md` / `CLAUDE.md` 至少要写清：

- InfiniSynapse 规则包路径，例如 `/Users/wangyixiao/WorkSpace/InfinisynapseAssistant`。
- 处理 Server API、SSE、workspace、RAG、Browser Use、数据源、私有化部署时，先读本仓库的 `AGENTS.md` 和对应 skill。
- API Key 只在服务端，前端只连自有后端。
- 先连 SSE，再创建 `newTask`。
- 短期资料放 task workspace 的 `upload_documents`；长期 RAG 资料放 InfiniSynapse 可访问目录或 OSS/S3。
- 默认 plan-first，高风险动作人工确认后再切 `act`。
- commit 前执行反哺检查。

## 推荐脚本

下游项目可以提供这些 npm scripts 或等价脚本：

```json
{
  "scripts": {
    "infini:scan": "bash scripts/infini-scan.sh",
    "infini:doctor": "bash ${INFINISYNAPSE_ASSISTANT_HOME:-/Users/wangyixiao/WorkSpace/InfinisynapseAssistant}/tools/doctor.sh",
    "feedback:check": "bash scripts/feedback-check.sh",
    "production:preflight": "bash scripts/production-preflight.sh",
    "precommit:check": "npm run check && npm test && npm run infini:scan && npm run feedback:check"
  }
}
```

其中 `INFINISYNAPSE_ASSISTANT_HOME` 可覆盖规则包位置；默认可以指向本机固定路径。

如果下游项目的 `infini:scan` 是“遍历全仓再逐文件调用
`tools/hooks/lib/scan-infinisynapse.sh`”，wrapper 必须先排除生成目录和依赖目录，
至少包括 `.next/`、`node_modules/`、`dist/`、`coverage/`、`test-results/`。
这些目录里的 bundle 会把服务端/前端代码重新打包到同一个文件，扫描器会按源码文件
语义误判，也会让 precommit 时间膨胀。扫描器本体仍保持逐文件严格检查；排除生成物
应由下游 wrapper 或 CI 文件列表负责。

## 反哺决策表

| 下游发现 | 是否反哺 | 放哪里 |
| --- | --- | --- |
| 新 endpoint、字段、错误码、SSE 事件、上传/下载细节 | 是 | `docs/reference/` 或 `upstream-docs/` 同步后派生 |
| 可复用的后端代理、SSE、上传、RAG、Browser Use、审批流程 | 是 | `docs/playbooks/`、`samples/sdk/`、skill |
| 扫描器可识别的新反模式 | 是 | `tools/hooks/lib/scan-infinisynapse.sh` + fixtures |
| 官方文档缺口或纠错 | 是 | `docs/SOURCE-AUDIT.md`、`docs/reference/`、相关 playbook |
| 某个业务项目的私有 prompt、用户数据、行业私有规则 | 否 | 留在业务项目 |
| 未验证的一次性实验 | 否 | 留在业务项目 proposal 或草稿 |

## 可复用编排口径示例

- OSS 采用度、技术选型或项目尽调可以由业务后端先抓取 deps.dev、OSV、GitHub、npm/PyPI registry 等确定性快照，再把摘要作为证据输入 Agent；connector 失败只写 evidence gap，不让 Agent 伪造高质量证据。
- connector 抓取要做“逐个包/子请求级降级”：单个 package 或子请求失败只记 evidence gap 并保留其它成功结果，不要用一个会整体 reject 的 `Promise.all` 让单点异常拖垮整个 connector 源、丢掉本可用的证据；短 TTL 缓存只缓存完全成功的结果，避免短暂故障被缓存粘住。
- 审计与质量门要区分“正常缺口”和“真失败”：非目标生态仓库没有 registry 包、没有漏洞目标等是正常 gap，只要有任一成功快照就算 success（缺口写进 warnings detail），不要整体标 failed 污染审计与命中率统计；warning/部分快照产出的证据要按比例下调 confidence/quality/credibility，避免质量门把缺口当满分证据。后端 connector 证据覆盖 Agent 同名 claim 时应记录被覆盖项，保留审计痕迹。
- PyPI 下载量应取 pypistats recent endpoint；不要使用 PyPI JSON 中已废弃且常见为 `-1` 的 `info.downloads` 作为采用度证据。
- CHAOSS 类指标必须写清计算口径。Change Request Closure Ratio 用 closed pull requests / total pull requests，merged PR 已包含在 closed 中，不得重复计数；Release Frequency 优先用 registry release timestamp，缺失时再回退 GitHub release。
- 决策型产品的 Outcome 回访、校准统计、Watchlist delta 和离线 benchmark 已沉淀为 `docs/playbooks/decision-quality-loop.md`。下游项目反哺这类内容时，优先更新该 playbook；不要把项目私有 prompt、用户样本或行业私有评分方法写进规则包主线。
- 面向生产的长任务能力要有独立 production preflight，而不是只跑 precommit。preflight 至少检查 feature flag、InfiniSynapse auth/config、队列/worker 在线、对象存储 PUT/GET/DELETE 探针、必要密钥和生产下载 fail-closed 语义；失败时不要打开用户入口或继续部署。
- 列表页和轮询 API 不要默认返回 artifact `previewText`、消息全文或大 JSON；只返回 metadata 和 `hasPreview`，正文走单独 preview/detail/download 接口，避免性能和隐私问题。

## 反哺流程

1. 在下游项目提交前运行 `npm run feedback:check` 或人工过一遍反哺清单。
2. 如果有通用内容，切到本仓库做最小可验证修改。
3. 根据内容类型更新 reference、playbook、skill、SDK、扫描器或测试。
4. 运行：

```bash
bash tools/doctor.sh
npm test
```

5. review 本仓库 diff，确认没有混入下游私有业务内容或敏感信息。
6. 提交并推送本仓库完整更新。
7. 回到下游项目继续提交业务改动。

## 常见反模式

- 只在下游项目文档里写“要反哺”，但没有脚本或提交前检查入口。
- 把下游项目私有业务方案、用户数据或未验证 prompt 写进本规则包主线。
- 下游项目复制了旧 SDK 后长期漂移，不再跑本仓库扫描器。
- 发现 API 细节后只改业务代码，不更新本仓库 reference/playbook，导致下个项目继续踩坑。

## 检查清单

- 下游项目的 `AGENTS.md` / `CLAUDE.md` 是否固定引用本规则包？
- 下游项目是否能运行本仓库扫描器？
- 是否有 commit 前反哺检查？
- 反哺内容是否跨项目可复用？
- 本仓库更新后是否跑过 `doctor` 和 `npm test`？
