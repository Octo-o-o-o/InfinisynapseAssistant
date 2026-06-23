# 来源审计

审计日期：2026-06-23，Asia/Shanghai。

## 已拉取的公开文档

中文 SaaS/API 页面是主要来源，已拉取到 `upstream-docs/infinisynapse-site/zh/html/`，并转换为 `upstream-docs/infinisynapse-site/zh/markdown/` 下的 Markdown。

| 页面 | 本地文件 |
| --- | --- |
| `https://www.infinisynapse.cn/zh/docs` | `zh/markdown/docs-index.md` |
| `https://www.infinisynapse.cn/zh/docs/Chrome%20Plugin%20Install` | `zh/markdown/chrome-plugin-install.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20CLI%20API%20Reference` | `zh/markdown/cli-api-reference.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Private%20Deployment%20Guide` | `zh/markdown/private-deployment-guide.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Server%20API%20Reference` | `zh/markdown/server-api-reference.md` |

英文页面保留为补充参考，位于 `upstream-docs/infinisynapse-site/html/` 和 `upstream-docs/infinisynapse-site/markdown/`。

| 页面 | 本地文件 |
| --- | --- |
| `https://www.infinisynapse.cn/en/docs` | `docs-index.md` |
| `https://www.infinisynapse.cn/en/docs/Chrome%20Plugin%20Install` | `chrome-plugin-install.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20CLI%20API%20Reference` | `cli-api-reference.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20Private%20Deployment%20Guide` | `private-deployment-guide.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20Server%20API%20Reference` | `server-api-reference.md` |

Chrome Plugin Install 图片已拉取到 `upstream-docs/infinisynapse-site/assets/chromePluginInstall/`。

中文 Server API SaaS 截图已拉取到 `upstream-docs/infinisynapse-site/assets/docs/server-api/`。

## GitHub 仓库状态

私有化部署文档中给出的命令是：

```bash
git clone https://github.com/chaozwn/infini_docker.git
```

2026-06-23 本地验证结果：

```text
git clone https://github.com/chaozwn/infini_docker.git upstream/infini_docker
remote: Repository not found.
fatal: repository 'https://github.com/chaozwn/infini_docker.git/' not found

git ls-remote https://github.com/chaozwn/infini_docker.git
remote: Repository not found.
fatal: repository 'https://github.com/chaozwn/infini_docker.git/' not found
```

补充检查：

- `https://github.com/chaozwn/infini_docker`：本地 shell 返回 HTTP 404。
- `https://raw.githubusercontent.com/chaozwn/infini_docker/main/README.md`：HTTP 404。
- `https://codeload.github.com/chaozwn/infini_docker/zip/refs/heads/main`：HTTP 404。

本工作区保留 `upstream-src/` 作为未来 clone 或放置离线交付包的位置。

## 飞书文档链接状态

私有化部署文档中包含这个飞书链接：

`https://uelng8wukz.feishu.cn/wiki/Z6tnwknQaia13ykXCn5cT5mpnnd?fromScene=spaceOverview`

2026-06-23 本地执行 `curl -I -L` 返回 HTTP 404。除非通过已登录浏览器能打开，或后续拿到导出的文档，否则按不可用处理。

## 维护说明

- 需要依赖“最新”文档前，重新执行 `bash tools/sync-upstream-docs.sh`。
- 如果 GitHub 仓库恢复可用，把它 clone 到 `upstream-src/infini_docker/`，并更新本审计。
- 如果拿到离线交付包，解压到 `upstream-src/infini_docker/`，并在这里记录校验和。
