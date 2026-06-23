# 使用指南

## 首次检查

```bash
bash tools/doctor.sh
npm test
```

如果本地安装了 `pandoc`，可以刷新公开文档镜像：

```bash
bash tools/sync-upstream-docs.sh
```

## 让 AI 助手基于 InfiniSynapse 开发

推荐提示词：

```text
请把这个工作区当作 InfiniSynapse 规则包使用。先读 AGENTS.md，再根据任务读取相关 skill。
我要实现一个服务端 route：创建长任务报告、把进度流式返回给前端、按需上传资料，并下载最终 PDF。
```

AI 应该读取：

- `AGENTS.md`
- `.agents/skills/infinisynapse-server-api/SKILL.md`
- `.agents/skills/infinisynapse-product-patterns/SKILL.md`
- `upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md`

## 相比直接引用原始文档的优势

原始文档适合人工查阅，但对 AI 来说缺少任务入口、优先级和安全边界。本项目把这些内容整理成 AI 能直接执行的规则：

- `AGENTS.md`、`CLAUDE.md`、`llms.txt` 负责告诉 AI 从哪里开始读。
- skills 负责把部署、Server API、CLI、产品模式、浏览器插件分流。
- 规则文件把 API Key、SSE 顺序、workspace 产物、上传方式等高风险点前置。
- `docs/QUICK-REFERENCE.md` 提供高信号速查，减少每次全量翻文档。
- `tools/doctor.sh` 和 `npm test` 可以验证规则包是否完整。

因此，使用这个项目时，AI 不只是“看到了文档”，而是能按约束和流程使用文档。

## 常见任务

| 任务 | 优先读取 |
| --- | --- |
| 私有化部署 | `infinisynapse-deployment` skill |
| 排查部署后空白页 / 401 | `private-deployment-guide.md` 第 8 节 |
| 写 SDK 或后端 route | `infinisynapse-server-api` skill |
| 做报告写作类产品 | `infinisynapse-product-patterns` skill |
| 使用 CLI endpoint | `infinisynapse-cli` skill |
| 浏览器自动化或购物比价 | `infinisynapse-browser-extension` skill |

## 开发姿态

- 优先使用 `upstream-docs/infinisynapse-site/zh/markdown/` 下的中文 SaaS 文档，再考虑网页搜索。
- 英文文档只作为中文文档未覆盖细节时的补充。
- 不要猜 endpoint 名称。
- API Key 必须保留在服务端。
- 发送 `newTask` 前先连接 SSE。
- 在业务数据库中保存 `taskId`、`connId`、上传映射和最终 workspace 路径。
- 二进制下载接口不要当作 JSON envelope 处理。
