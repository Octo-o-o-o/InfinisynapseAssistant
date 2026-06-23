# Source Audit

Audit date: 2026-06-23, Asia/Shanghai.

## Public documentation pulled locally

The Chinese SaaS/API pages are the primary source. They were fetched into `upstream-docs/infinisynapse-site/zh/html/` and converted into Markdown under `upstream-docs/infinisynapse-site/zh/markdown/`.

| Page | Local file |
| --- | --- |
| `https://www.infinisynapse.cn/zh/docs` | `zh/markdown/docs-index.md` |
| `https://www.infinisynapse.cn/zh/docs/Chrome%20Plugin%20Install` | `zh/markdown/chrome-plugin-install.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20CLI%20API%20Reference` | `zh/markdown/cli-api-reference.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Private%20Deployment%20Guide` | `zh/markdown/private-deployment-guide.md` |
| `https://www.infinisynapse.cn/zh/docs/InfiniSynapse%20Server%20API%20Reference` | `zh/markdown/server-api-reference.md` |

The English pages are retained as supplemental references in `upstream-docs/infinisynapse-site/html/` and `upstream-docs/infinisynapse-site/markdown/`.

| Page | Local file |
| --- | --- |
| `https://www.infinisynapse.cn/en/docs` | `docs-index.md` |
| `https://www.infinisynapse.cn/en/docs/Chrome%20Plugin%20Install` | `chrome-plugin-install.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20CLI%20API%20Reference` | `cli-api-reference.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20Private%20Deployment%20Guide` | `private-deployment-guide.md` |
| `https://www.infinisynapse.cn/en/docs/InfiniSynapse%20Server%20API%20Reference` | `server-api-reference.md` |

Chrome Plugin Install images were fetched into `upstream-docs/infinisynapse-site/assets/chromePluginInstall/`.

Chinese Server API SaaS screenshots were fetched into `upstream-docs/infinisynapse-site/assets/docs/server-api/`.

## GitHub repository status

The private deployment guide instructs:

```bash
git clone https://github.com/chaozwn/infini_docker.git
```

Local verification on 2026-06-23:

```text
git clone https://github.com/chaozwn/infini_docker.git upstream/infini_docker
remote: Repository not found.
fatal: repository 'https://github.com/chaozwn/infini_docker.git/' not found

git ls-remote https://github.com/chaozwn/infini_docker.git
remote: Repository not found.
fatal: repository 'https://github.com/chaozwn/infini_docker.git/' not found
```

Additional checks:

- `https://github.com/chaozwn/infini_docker`: HTTP 404 from local shell.
- `https://raw.githubusercontent.com/chaozwn/infini_docker/main/README.md`: HTTP 404.
- `https://codeload.github.com/chaozwn/infini_docker/zip/refs/heads/main`: HTTP 404.

The workspace keeps `upstream-src/` as the target location for a future clone or offline delivery package.

## Feishu docs link status

The deployment guide links to:

`https://uelng8wukz.feishu.cn/wiki/Z6tnwknQaia13ykXCn5cT5mpnnd?fromScene=spaceOverview`

Local `curl -I -L` returned HTTP 404 on 2026-06-23. Treat this as unavailable unless opened through an authenticated browser session or replaced by an exported document.

## Maintenance notes

- Re-run `bash tools/sync-upstream-docs.sh` before relying on “latest” documentation.
- If the GitHub repository becomes available, clone it into `upstream-src/infini_docker/` and update this audit.
- If an offline delivery archive is provided, unpack it under `upstream-src/infini_docker/` and record its checksum here.
