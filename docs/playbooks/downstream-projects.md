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
- PyPI 下载量应取 pypistats recent endpoint；不要使用 PyPI JSON 中已废弃且常见为 `-1` 的 `info.downloads` 作为采用度证据。
- CHAOSS 类指标必须写清计算口径。Change Request Closure Ratio 用 closed pull requests / total pull requests，merged PR 已包含在 closed 中，不得重复计数；Release Frequency 优先用 registry release timestamp，缺失时再回退 GitHub release。
- 决策型产品应在 completed run 后创建 Outcome 回访占位，把原 recommendation、scorecard version、dueAt 和真实结局绑定起来；到期提醒应有独立 due/幂等状态，不复用 run completed/failed 通知状态。
- Calibration 视图先做描述性统计，例如 recommendation 命中率、go 决策证伪率、dimension 与结局的样本均值差；样本不足前不要自动调整评分权重。
- Watchlist delta 重评应以“手动触发 + connector baseline/current 比对 + 只重评受影响模块”为默认边界。baseline 只保存确定性快照摘要和 content hash；recheck 强制重抓当前 connector 快照，比较安全告警、许可证、发布/registry 等窄目标。无变化时只更新 `lastCheckedAt`，不生成新 scorecard version、不通知；有变化时产出 delta memo，追加 `watchlist_delta` scorecard version，并且只在结论可能改变、hard gate 命中或分数显著变化时通知。不要为窄版 watchlist 引入后台调度、队列、BI 看板或完整报告重写；pricing page / Browser Use 类目标缺少只读浏览器会话时应跳过并记录 evidence gap。
- 决策质量 benchmark 应作为离线脚手架和数据集，而不是产品运行链路。案例应覆盖主要 lens 和反例，并为每例写清 expected key facts、contradictions、hard gates；脚本可对已归档 run 产物计算 fact recall、citation precision、contradiction recall、hard-gate recall、成本、耗时和 repair 次数。盲测 harness 只存 ProjectValueLab 决策包与通用报告的并排路径和人工标注，不自动判定优劣，不自动校准权重，也不读取私有原始材料。

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
