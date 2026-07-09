# 来源审计

审计日期：2026-07-09，Asia/Shanghai（上一次：2026-06-23）。

## 已拉取的公开文档

官方 docs 站已从 5 页扩展到 8 页（2026-07-09 核对）。中文 SaaS/API 页面是主要来源，已拉取到 `upstream-docs/infinisynapse-site/zh/html/`，并转换为 `upstream-docs/infinisynapse-site/zh/markdown/` 下的 Markdown。

| 页面 | 本地文件 | 状态 |
| --- | --- | --- |
| `https://www.infinisynapse.cn/zh/docs` | `zh/markdown/docs-index.md` | 持续同步 |
| `https://www.infinisynapse.cn/zh/docs/Chrome%20Plugin%20Install` | `zh/markdown/chrome-plugin-install.md` | 持续同步 |
| `https://www.infinisynapse.cn/zh/docs/Connect%20Data%20Sources%20and%20Knowledge%20Base` | `zh/markdown/connect-data-and-knowledge-base.md` | 2026-07-09 新增 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20CLI%20API%20Reference` | `zh/markdown/cli-api-reference.md` | 持续同步 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Existing%20Product%20Integration%20Playbook` | `zh/markdown/existing-product-integration-playbook.md` | 2026-07-09 新增 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Partner%20SSO%20Integration%20Guide` | `zh/markdown/partner-sso-integration-guide.md` | 2026-07-09 新增 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Private%20Deployment%20Guide` | `zh/markdown/private-deployment-guide.md` | 持续同步 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Server%20API%20Reference` | `zh/markdown/server-api-reference.md` | 持续同步；2026-07-09 上游新增「Skill 管理」章节 |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Vibe%20Coding%20Guide` | `zh/markdown/vibe-coding-guide.md` | 2026-07-09 新增 |

英文页面保留为补充参考，位于 `upstream-docs/infinisynapse-site/html/` 和 `upstream-docs/infinisynapse-site/markdown/`，文件名与中文一一对应。注意：截至 2026-07-09，英文 Server API Reference 尚未包含中文版新增的「Skill 管理」章节，以中文为准。

Chrome Plugin Install 图片已拉取到 `upstream-docs/infinisynapse-site/assets/chromePluginInstall/`。

中文 Server API SaaS 截图已拉取到 `upstream-docs/infinisynapse-site/assets/docs/server-api/`。

## 2026-07-09 上游变化摘要

- Server API Reference 新增第 6 节「Skill 管理」（`/api/ai_skill/*`、Skill 市场、本地 Skill 上传、报告快写 Skill 上下文模式），原 6-10 节顺延为 7-11。
- 新增 Partner SSO 能力：`/api/auth/partner/*`（账号 API），支持第三方登录与 Partner API Key 签发。
- 官方发布《Existing Product Integration Playbook》（内容与本仓库 `docs/playbooks/existing-product-integration.md` 同源，并引用了本仓库）与《Vibe Coding Guide》（官方一页式 SKILL.md 格式指南）。
- 官网首页新增 CLI 一键安装入口：`curl -fsSL https://infinisynapse.cn/cli-install/install.sh | bash`（安装 CLI + companion skill）。

## GitHub 仓库状态

### infinisynapse-cli（CLI 源码，已开源）

2026-07-09 核对：`https://github.com/chaozwn/infinisynapse-cli` 公开可用，MIT License，Go 实现。README 覆盖构建、`agent_infini init`、`--update` 自动更新（OSS manifest + SHA256 校验）、`--skill` 输出 AI Agent 规范、配置文件 `~/.agent_infini/config.txt` 与凭证加载链。CLI 相关规则见 `.agents/skills/infinisynapse-cli/SKILL.md`。

### infini_docker（私有化部署源码，仍不可用）

私有化部署文档中给出的命令是：

```bash
git clone https://github.com/chaozwn/infini_docker.git
```

2026-07-09 复测结果（与 2026-06-23 一致）：

```text
git ls-remote https://github.com/chaozwn/infini_docker.git
remote: Repository not found.
fatal: repository 'https://github.com/chaozwn/infini_docker.git/' not found
```

本工作区保留 `upstream-src/` 作为未来 clone 或放置离线交付包的位置。

## 飞书文档链接状态

私有化部署文档中包含这个飞书链接：

`https://uelng8wukz.feishu.cn/wiki/Z6tnwknQaia13ykXCn5cT5mpnnd?fromScene=spaceOverview`

2026-06-23 本地执行 `curl -I -L` 返回 HTTP 404。除非通过已登录浏览器能打开，或后续拿到导出的文档，否则按不可用处理。

## 维护说明

- 需要依赖“最新”文档前，重新执行 `bash tools/sync-upstream-docs.sh`。
- 官方 docs 站新增页面时，同步更新 `tools/sync-upstream-docs.sh` 的 `PAGES` 清单、`tools/doctor.sh` 的 require 列表和本审计。
- 如果 `infini_docker` 仓库恢复可用，把它 clone 到 `upstream-src/infini_docker/`，并更新本审计。
- 如果拿到离线交付包，解压到 `upstream-src/infini_docker/`，并在这里记录校验和。
