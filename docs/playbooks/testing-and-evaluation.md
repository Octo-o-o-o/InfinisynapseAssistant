# 测试与评估 Playbook

> 特定用法总结：如何测试 InfiniSynapse 集成代码，以及如何评估你基于 InfiniSynapse 做出来的 app 的输出质量。
> 端点与时序事实以 `docs/reference/` 为准；线上决策类产品的持续质量闭环（Outcome 回访、Watchlist、生产 benchmark 治理）另见 `decision-quality-loop.md`，本文聚焦**开发与发版阶段**。

## 一句话规则

集成正确性用离线测试兜底（纯函数单测 + mock 集成测试），链路真实性用 opt-in 真实冒烟验证（花小钱），输出质量用固定的黄金任务集 + 产物断言做回归——三层缺一层，就会分别漏掉逻辑退化、环境/契约漂移和 prompt/模型退化。

## 测试金字塔

| 层 | 测什么 | 怎么跑 | 频率 |
| --- | --- | --- | --- |
| 1. 纯函数单测 | SSE 解析、partial 按 ts 合并、重连退避、信封解包、错误分类 | 离线，无网络；参考 `samples/sdk/typescript/test/`、`samples/sdk/python/test_sse.py` | 每次提交 |
| 2. mock 集成测试 | 完整链路组合行为：先 SSE 再 `newTask`、upload ask 分支、错误分支、恢复接口、二进制下载 | `samples/mock-server/` 模拟器 + 真实 HTTP；参考 `test/integration-mock.test.ts` | 每次提交 / CI |
| 3. 真实 API 冒烟 | 账号/Key、真实 SSE 时序、真实产物、余额与限流等环境事实 | opt-in：`INFINISYNAPSE_API_KEY=sk-xxx npm run smoke:live`（会计费） | 拿到 Key 后、上游 sync 后、发版前 |
| 4. production preflight | 生产依赖探针：InfiniSynapse auth、队列/worker、对象存储、feature flag | 见 `existing-product-integration.md` | 每次生产开闸前 |

分层理由：

- mock 只覆盖**本仓库文档化的行为子集**，测的是"你的代码是否按契约组合"；它证明不了真实环境可用，所以第 3 层必须存在。
- 真实冒烟会产生计费和真实任务（出现在 `/tasks` 的 ALL TASKS），所以默认 opt-in，不进 `npm test`；冒烟任务要用最小 prompt（禁联网、只写一个小文件）。
- 单元测试抓不到"先发 newTask 后连 SSE"这类**组合顺序**错误，mock 集成测试可以；扫描器（`npm run scan`）在编辑时兜同一类错误的静态面。

## 集成正确性 checklist（写测试时逐条对应）

来自 `task-lifecycle.md` 健壮性清单，每条都应有至少一个测试或扫描规则兜住：

- [ ] 先连 SSE 再发 `newTask`（mock 集成测试默认路径）
- [ ] `message.partial` 按 `taskId + ts` 覆盖合并，不重复拼接（accumulate 单测）
- [ ] 完成判定同时覆盖 `message.say==='completion_result'` 和 `message.ask==='completion_result'`
- [ ] `notification.type==='error'` / `api_req_failed` → 业务失败落库（mock `[mock:error]` 场景）
- [ ] `upload_file_to_sandbox` → 上传 → `askResponse` 链路（mock `[mock:upload]` 场景）
- [ ] 断线重连 + `getUiMessageById` 补消息（reconnect 单测 + fake client）
- [ ] 下载端点按二进制流处理，不按 JSON 信封解析（集成测试 + `INF-DL-001`）
- [ ] Key 失效（1101/1105）走可解释错误分支（mock 缺 token 用例）
- [ ] 取消后业务状态一致（cancel 单测）
- [ ] 前端/客户端（含鸿蒙 `.ets`）不出现直连与硬编码 Key（`INF-SEC-001/002`）

## 评估 app 输出质量（黄金任务集）

集成正确 ≠ 产品好用。发版前和 prompt/模型变更后，用固定输入集评估输出：

### 1. 建黄金任务集

- 每个产品场景选 **3-5 个代表性输入**（如高考助手：不同分数段/省份/选科组合；报告快写：不同资料量与结构要求），存进仓库（如 `evals/golden-tasks.json`），输入必须可重放、不含真实用户隐私。
- 至少包含 1 个边界用例（资料缺失、约束冲突、超长输入）。

### 2. 产物断言（自动化）

任务完成后不要只看最后一条文本，按业务 schema 断言 workspace 产物：

- 必需文件存在（如 `final/report.md`、`scorecard.json`）且非空、schema 可解析。
- 引用/来源要求：要求带来源的产品，断言正文引用数 ≥ N 且来源可回连（对齐 `decision-quality-loop.md` 的 evidence 口径）。
- 硬门槛：包含被禁止内容（编造端点、泄露输入原文、空推荐结论）直接判失败。

### 3. 人工评分维度（每任务 1-5 分）

| 维度 | 看什么 |
| --- | --- |
| 正确性 | 关键事实/数字/结论对不对 |
| 完整性 | 是否覆盖输入要求的全部要素 |
| 可追溯 | 关键判断是否有来源和置信度 |
| 可用性 | 产物能否直接交付（格式、结构、语言） |
| 时延与成本 | 总耗时、任务额度消耗是否在产品预算内（业务侧计时计数，prompt 里的软目标不算数） |

### 4. 回归时机

- `bash tools/sync-upstream-docs.sh` 发现上游 API/行为变化后。
- 修改 prompt 模板、切换模型/计算资源、调整 `autoApprovalSettings` 后。
- 发版前跑全量黄金任务集；日常提交只跑第 1-2 层测试。

记录每轮评估的：输入版本、prompt 版本、日期、逐维度得分、失败样例链接。分数下降先查 prompt/上游变化，再查集成代码。

### 边界

- 黄金任务集是**离线脚手架**，不进生产请求链路；线上运行期的质量闭环（用户结局回访、自动重评）见 `decision-quality-loop.md`。
- 不要为规则包/早期产品引入 LLM 自动评分框架；人工评分 + 产物断言在小样本量下更可信。样本量大到人工评不过来时再考虑升级。

## 客户端（Web / 鸿蒙 / 桌面）验收补充

- 弱网/断线/切后台恢复：断 SSE 后 UI 能恢复到正确任务状态（鸿蒙细则见 `harmonyos-app-integration.md` 质量清单）。
- 错误面：Key 失效、参数 422、余额不足、任务失败各有用户可懂文案，不是裸 JSON。
- 安装包审计：全包搜不到 API Key 与 InfiniSynapse 直连；`npm run scan` 对客户端源码无 HIGH。

## 常见反模式

- 只有纯函数单测，上线才发现 SSE 顺序或信封解包错误——缺第 2 层。
- 把 mock 通过当成"接入完成"，没跑过一次真实冒烟——缺第 3 层。
- 冒烟任务用生产级大 prompt，每次回归烧真实额度——冒烟要最小化。
- 黄金任务集里放真实用户数据——评估输入必须脱敏可入库。
- 评估只看聊天文本，不断言 workspace 产物——违反"产物读工作区"铁律。
