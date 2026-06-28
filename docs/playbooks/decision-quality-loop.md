# 决策质量闭环 Playbook

> 特定用法总结：面向项目尽调、供应商评估、开源采用、Build-vs-Buy、投研初筛等证据驱动决策产品，说明如何把 InfiniSynapse 长任务产物沉淀为可回访、可重评、可离线评测的决策资产。
> 端点事实仍以 `docs/reference/api-index.md`、`docs/reference/task-lifecycle.md` 和上游 Server API 文档为准；本文只写业务后端应承担的治理层。

## 一句话规则

不要把 InfiniSynapse 的输出只当一次性报告。决策型产品应在业务后端保存结构化 scorecard 版本、Outcome 回访、Watchlist delta 和离线 benchmark，让每次判断之后都能回答三个问题：

- 当初的结论后来是否成立？
- 哪些确定性外部信号变化可能改变结论？
- 这个决策包是否比通用深度研究更容易支持人类决策？

## 适用范围

适合：

- 输出 GO / VALIDATE / WATCH / PAUSE / DROP 等建议的项目评估。
- 有 scorecard、evidence ledger、source map、risk/gates、decision memo 的报告包。
- 需要长期跟踪开源库、供应商、市场项目或内部项目变化的业务系统。
- 需要向团队证明决策质量，而不只是展示漂亮报告的产品。

不适合：

- 一次性摘要、改写、翻译、分类、字段抽取。
- 没有结构化评分、结论或后续行动的普通报告。
- 未经用户确认可长期保存的闭源材料、失败草稿或未审结论。

## InfiniSynapse 与业务后端边界

InfiniSynapse 负责长任务执行、工具使用、Browser Use、workspace 产物和报告生成。决策质量闭环属于业务产品层，默认由自有后端持久化和计算：

| 能力 | 归属 | 说明 |
| --- | --- | --- |
| 长任务研究、workspace 产物 | InfiniSynapse | 仍按先 SSE 后 `newTask`、完成后读 workspace 的流程 |
| scorecard / evidence / source map 校验 | 业务后端 | 从 workspace 归档后用 schema 和质量门校验 |
| scorecard version | 业务后端 | 每次正式收集、人工修订、watchlist delta 都追加版本 |
| Outcome 回访 | 业务后端 | 绑定当时的 recommendation 和 scorecard version |
| Watchlist delta | 业务后端 | 由确定性 connector 快照对比触发，不默认重跑完整 Agent |
| benchmark / 盲测 | 离线工具 | 用已归档产物评估，不进入产品运行链路 |

## 最小数据模型

决策型产品至少保存这些业务对象；字段名可按项目调整：

| 对象 | 最小字段 |
| --- | --- |
| decision run | `businessRunId`、`providerTaskId`、`providerConnId`、`status`、`inputHash`、`workspaceSnapshot`、`finalArtifactIds` |
| scorecard version | `id`、`runId`、`versionNumber`、`source`、`scorecardJson`、`recommendation`、`adjustedScore`、`confidence`、`createdAt` |
| outcome | `runId`、`scorecardVersionId`、`decisionAtRecommendation`、`dueAt`、`status`、`actualOutcome`、`recordedAt` |
| watchlist item | `runId`、`targets`、`baselineSnapshot`、`lastCheckedAt` |
| connector snapshot | `connector`、`target`、`sourceUrl`、`fetchedAt`、`summaryJson`、`contentHash`、`status`、`warning` |
| derived artifact | `source=derived`、`derivationType`、`derivedFromRunId`、`storageKey/path`、`contentHash` |

`scorecard version` 是关键锚点。Outcome 不能只绑定当前 run 的最新分数，否则后续修订会污染“当初这个判断是否成立”的统计。

## Outcome 回访

completed run 通过 schema 校验并归档 scorecard 后，应幂等创建一个 pending Outcome：

1. 只为 `completed` 且有有效 scorecard version 的 run 创建。
2. 保存当时的 recommendation、scorecardVersionId 和 dueAt。
3. dueAt 可按业务类型和 recommendation 设置，例如 GO 更短、DROP 更长；这是产品策略，不是 InfiniSynapse API。
4. 到期提醒要有独立的 due/notification 幂等状态，不复用 completed/failed 通知状态。
5. 记录结果时使用受控枚举，例如“GO 成功”“GO 失败”“验证后继续”“验证后放弃”“放弃正确”“放弃错误”“未决策”。
6. 人工 note 要限长、脱敏并写审计日志。

校准视图先做描述性统计：

- recommendation 命中率。
- GO 决策证伪率。
- 各维度分数在正向/负向结局中的均值差。
- pending / recorded / skipped 数量。

样本不足前不要自动调整评分权重，也不要让 Agent 根据少量 outcome 自行改评分公式。权重调整应是人工 review 后的版本化方法论变更。

## Watchlist Delta

Watchlist 用来回答“外部确定性信号变化后，原结论是否仍然站得住”。默认从窄版、手动触发开始：

1. baseline 只保存确定性 connector 快照摘要和 content hash，例如安全告警、许可证、发布/registry 信号。
2. recheck 时强制重新抓取当前 connector 快照，与 baseline 比较。
3. 无变化时只更新 `lastCheckedAt`，不生成新 scorecard version，不通知用户。
4. 有变化时生成 private derived artifact，例如 `delta-memo.md`，并追加 `source=watchlist_delta` 的 scorecard version。
5. delta scorecard 只重评受影响模块，不能伪装成完整报告重跑。
6. 只有 recommendation 可能改变、hard gate 命中、critical delta 或分数显著变化时才通知。
7. connector 失败、目标不支持、只读浏览器上下文缺失等都写成 evidence gap 或 warning，不作为正向证据。

窄版 Watchlist 不应一开始引入后台调度、队列、BI 看板、完整报告重写或 Browser Use 页面抓取。需要网页价格、商店页面、登录态后台等非确定性浏览器信号时，先按 Browser Use playbook 做用户授权、session 检查和人工确认；没有只读、可审计上下文时跳过并记录缺口。

## Benchmark 与盲测

决策质量 benchmark 应作为离线脚手架和数据集，不进入生产请求链路。

推荐数据集结构：

- case 覆盖主要 lens / 场景和反例。
- 每个 case 写明输入、expected key facts、contradictions、hard gates。
- archived run 只引用已归档的 scorecard、claims、evidence links、sources、成本、耗时和 repair 次数。
- blind comparison 只保存匿名后的两个产物路径和人工标注，不保存原始私密材料。

推荐指标：

- key fact recall。
- citation precision。
- contradiction recall。
- hard-gate recall。
- cost / duration / repair count。
- 盲测中的 decision ease 和 next-step clarity 人工胜负统计。

盲测 harness 只存和汇总人工标注，不自动判定哪个系统更好，不自动校准权重，也不读取 private/confidential 原文。需要对比通用深度研究时，先生成脱敏副本或 synthetic case。

## 常见反模式

- 只保存最终 Markdown，不保存 scorecard version、source map、evidence links 和当时 recommendation。
- Outcome 直接绑定 run 当前最新分数，导致后续修订污染历史命中率。
- 样本很少就自动调权重，或让 Agent 根据 outcome 自行改变评分公式。
- Watchlist 一有任意变化就重跑完整长任务、重写报告或重复通知。
- connector 缺口被当成“没有风险”的正向证据。
- 用 Browser Use 抓登录态页面做后台 watchlist，但没有用户授权、session 检查和人工确认。
- benchmark 进入线上请求链路，增加用户延迟和隐私风险。
- benchmark 或盲测读取未脱敏上传材料、客户资料、API Key、cookie 或内部链接。

## 检查清单

- completed run 是否持久化 scorecard version，而不是只保存当前 run 字段？
- Outcome 是否绑定当时的 scorecardVersionId、recommendation 和 dueAt？
- Outcome reminder 是否和任务完成/失败通知分开幂等？
- 校准统计是否仍是描述性视图，没有自动改权重？
- Watchlist baseline/current 是否来自确定性 connector 快照并带 hash？
- 无变化 recheck 是否避免生成新版本和通知？
- delta memo 是否声明边界：不是完整 rerun，只影响特定模块？
- connector failure / unsupported target 是否写成 evidence gap？
- benchmark 是否只跑离线归档产物和脱敏样本？
- 盲测是否保留人工标注来源，并避免自动裁决或自动训练？
