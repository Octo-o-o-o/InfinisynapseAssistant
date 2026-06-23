# 内容模型

本仓库不是单纯的官方文档镜像，而是面向 AI 助手和人类开发者的 InfiniSynapse 开发规则包。内容按两个维度维护：

1. **阅读对象维度**：AI 友好 / 人类友好。
2. **来源形态维度**：官方文档内容 / 特定用法内容。

一份持久化内容可以同时属于多个类型。例如 `docs/reference/api-index.md` 既是 AI 友好的端点索引，也是从官方文档提炼出的事实基准；`docs/QUICK-REFERENCE.md` 既是人类友好的速查，也是特定用法总结。

## 四类内容

| 类型 | 目标 | 典型文件 |
| --- | --- | --- |
| AI 友好内容 | 给 AI 明确入口、读取顺序、硬约束和任务分流 | `AGENTS.md`, `CLAUDE.md`, `llms.txt`, `.agents/skills/`, `docs/reference/`, `samples/sdk/` |
| 人类友好内容 | 给开发者快速理解项目价值、架构、使用方式和方案 | `README.md`, `docs/USAGE-GUIDE.md`, `docs/QUICK-REFERENCE.md`, `docs/proposals/` |
| 官方文档内容 | 保存或提炼 InfiniSynapse 官方公开文档中的事实 | `upstream-docs/`, `docs/reference/api-index.md`, `docs/reference/task-lifecycle.md` |
| 特定用法内容 | 基于官方事实，对核心场景给出决策、顺序、边界和默认做法 | `.agents/skills/`, `docs/QUICK-REFERENCE.md`, `samples/templates/`, `docs/proposals/` |

## 维护原则

- **官方事实优先**：endpoint、method、字段、认证、返回类型等事实以 `upstream-docs/` 和 `docs/reference/` 为准。
- **特定用法不重复官方原文**：如果官方文档已经明确说明，特定用法内容只引用或指向它，不再改写一遍。
- **特定用法负责决策**：当官方文档只列出多个能力，未直接回答“产品里应该怎么选”时，可以沉淀特定用法。
- **特定用法必须可追溯**：每条关键用法应能回到官方端点或章节，不允许凭经验编造。
- **AI 入口保持短而硬**：`AGENTS.md` 和 `CLAUDE.md` 写规则、顺序和红线，不写长篇解释。
- **人类文档负责解释**：复杂背景、方案、取舍和产品建议放在 `docs/`。

## RAG 与文件放置规则

这条规则属于“特定用法内容”：它不是单个 endpoint 的复述，而是把官方的 RAG、任务工作区、上传和下载接口合并后得到的产品判断。

一句话：

> 短期任务资料放 `task workspace/upload_documents`；长期知识库资料放 InfiniSynapse 可访问的 RAG 文档目录或 OSS/S3；本机目录不是 SaaS RAG 的可访问位置。

具体区分：

| 场景 | 文件应放哪里 | 主要接口 |
| --- | --- | --- |
| 单次报告、调研、求职分析的输入资料 | 当前任务工作区，建议 `upload_documents` 子目录 | `POST /api/tools/taskUpload/:taskId?subdir=upload_documents&naming=original` |
| Agent 在执行中主动要求补文件 | 当前任务 sandbox | `POST /api/ai/upload?taskId=`，随后 `POST /api/ai/message` 回 `askResponse` |
| 长期 RAG 知识库资料 | InfiniSynapse 可访问的 RAG `docDir`，或 OSS/S3/file 后端 | `/api/ai_rag_sdk/create`, `/api/ai_rag_sdk/enabled`, `/api/ai_rag_sdk/fileTree` |
| 结构化数据或表格资料 | 任务工作区临时分析，或作为数据源/数据库文件 | `/api/tools/taskUpload/:taskId`, `/api/ai_database/upload/:databaseId` |
| 任务生成的最终产物 | 任务工作区 | `getTaskWorkspace`, `previewFile`, `downloadTaskFile`, `downloadZip` |

SaaS 版本下，`docDir: "/path/to/docs"` 不能理解为开发者本机路径。InfiniSynapse SaaS 无法读取你的本地 `/Users/...` 目录。长期 RAG 文件必须位于 InfiniSynapse 服务端可访问的位置，通常是平台可访问的文件系统、OSS/S3，或已经订阅/创建好的知识库资源。

## 何时新增“特定用法”

满足以下任一条件时，可以新增到 skills、quick reference、templates 或 proposals：

- 官方文档列出多个接口，但没有说明产品中该选哪一个。
- 一个能力需要跨多个章节组合，例如 SSE + taskUpload + workspace + RAG。
- 存在高风险误用，例如 API Key 进前端、下载端点当 JSON、SaaS RAG 误用本机路径。
- 核心场景反复出现，例如报告快写、项目尽调、求职分析、网页研究。

不满足这些条件时，优先保留在官方文档快照中，不额外写特定用法，避免规则包膨胀和漂移。
