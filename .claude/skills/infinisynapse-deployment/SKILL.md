---
name: infinisynapse-deployment
description: |
  InfiniSynapse 私有化部署、Docker Compose、环境变量、初始化管理员、备份升级、登录失败、OOM、端口冲突排查。
  激活条件:
    - 用户提到 private deployment / Docker Compose / .env / init-admin / infini-sql / OOM
    - 用户遇到登录失败、API 401、空白页、端口冲突
    - 用户要写部署文档、部署脚本、验收 checklist
---

# InfiniSynapse Private Deployment

先读:

- `upstream-docs/infinisynapse-site/zh/markdown/private-deployment-guide.md`
- `upstream-docs/infinisynapse-site/markdown/private-deployment-guide.md` 作为英文补充参考
- `docs/QUICK-REFERENCE.md`
- `docs/playbooks/troubleshooting.md`（部署登录失败 / OOM / 端口冲突排查）
- `docs/SOURCE-AUDIT.md`

## 核心 checklist

- 主机推荐 8 cores / 32 GB RAM / 100 GB disk；16 GB RAM 需要降低 InfiniSQL 内存。
- Ubuntu 22.04 LTS 推荐。
- Docker >= 24，Docker Compose plugin >= 2.20。
- 网络要能访问 Docker Hub、官方 npm/pip registry、`infinisynapse.oss-cn-shanghai.aliyuncs.com`。
- 对外端口: `8088` 主应用、`80` 管理台、`3000` auth API。
- 持久化路径: `__data/`、`persist/`、`datas/`、`upload/`。

## AUTHING_SERVER_URL 是第一排查点

必须同时满足:

- 变量名是 `AUTHING_SERVER_URL`，不是 `AUTH_SERVER_URL`。
- 浏览器可访问，不能是容器名或 `127.0.0.1`。
- 默认端口 `3000`，路径 `/api`。
- 不带尾部 `/`。

示例:

```bash
AUTHING_SERVER_URL=http://192.168.1.10:3000/api
```

如果 HTTPS 反代:

```bash
AUTHING_SERVER_URL=https://<domain>/api
```

并把 `/api` 路由到 `infini-proxy-server:3000`。

## 常见故障

| Symptom | Action |
| --- | --- |
| Login fails / 401 / blank page | 在浏览器 DevTools Network 检查请求是否走 `http://<server>:3000/api/...` |
| `infini-sql` OOM | 降低 `INFINI_SQL_SPARK_DRIVER_MEMORY`、`INFINI_SQL_MEM_LIMIT`、`INFINI_SQL_MEMSWAP_LIMIT` |
| Port conflicts | 改 `.env` 里的 `APP_PORT`、`PROXY_ADMIN_PORT` 等 |
| migrate exited | `infini-synapse-mysql-migrate` 为 `Exited (0)` 是正常 |

## 不要做

- 不要把文档示例密码用于生产。
- 不要把 `AUTHING_SERVER_URL` 指向容器内部地址。
- 不要承诺 GitHub 仓库一定可 clone。当前本地审计显示 404，见 `docs/SOURCE-AUDIT.md`。
