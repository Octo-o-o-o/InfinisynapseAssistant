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

## 反哺决策表

| 下游发现 | 是否反哺 | 放哪里 |
| --- | --- | --- |
| 新 endpoint、字段、错误码、SSE 事件、上传/下载细节 | 是 | `docs/reference/` 或 `upstream-docs/` 同步后派生 |
| 可复用的后端代理、SSE、上传、RAG、Browser Use、审批流程 | 是 | `docs/playbooks/`、`samples/sdk/`、skill |
| 扫描器可识别的新反模式 | 是 | `tools/hooks/lib/scan-infinisynapse.sh` + fixtures |
| 官方文档缺口或纠错 | 是 | `docs/SOURCE-AUDIT.md`、`docs/reference/`、相关 playbook |
| 某个业务项目的私有 prompt、用户数据、行业私有规则 | 否 | 留在业务项目 |
| 未验证的一次性实验 | 否 | 留在业务项目 proposal 或草稿 |

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
