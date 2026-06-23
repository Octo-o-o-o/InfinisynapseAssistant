# 计划

## 初始搭建已完成

- 已把中文 SaaS/API 文档拉取到 `upstream-docs/infinisynapse-site/zh/html/`。
- 已把中文 SaaS/API 文档转换为 `upstream-docs/infinisynapse-site/zh/markdown/` 下的 Markdown。
- 已把英文补充文档拉取到 `upstream-docs/infinisynapse-site/html/`。
- 已把英文补充文档转换为 Markdown。
- 已下载 Chrome 插件图片。
- 已下载中文 Server API 文档里的 SaaS 截图，包括 API Key Management 和计算资源选择。
- 已验证官方文档中引用的 GitHub 源码仓库当前返回 404。
- 已创建跨工具规则入口：`AGENTS.md`、`CLAUDE.md`、`llms.txt`。
- 已创建任务型 skills：部署、Server API、CLI API、产品模式、Browser Use。
- 已添加同步、体检和测试脚本。

## 后续改进

1. 等 `infini_docker` 可用后，补充基于源码的规则。
2. 增加 Node.js 和 Python 服务端集成 SDK 示例。
3. 增加 SSE 解析示例，覆盖重连、超时和取消。
4. 增加生产 Linux 主机的私有化部署验收清单。
5. 基于 `upstream-docs/` 增加适合 RAG 的索引或 embedding 流程。
6. 拿到真实私有化部署凭据和地址后，增加 contract tests。
