# InfiniSynapse Private Deployment Guide


基于 Docker Compose 的一键部署，按以下步骤操作即可完成上线。

## 1. 环境要求

- **硬件**：推荐 8 Core / 32 GB 内存 / 100 GB 磁盘（最低 16 GB 内存，需调低 InfiniSQL 内存参数）
- **系统**：Linux（Ubuntu 22.04 LTS 推荐）
- **软件**：Docker ≥ 24，Docker Compose Plugin ≥ 2.20（命令为 `docker compose`）
- **网络**：能访问 Docker Hub、npm/pip 官方源，以及 `infinisynapse.oss-cn-shanghai.aliyuncs.com`
- **需对外开放的端口**：`8088`（主应用）、`80`（管理后台）、`3000`（鉴权 API，浏览器直连）

未安装 Docker 时可执行：

```
curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```


重新登录后通过 `docker --version` / `docker compose version` 验证。

## 2. 获取代码

```
git clone https://github.com/chaozwn/infini_docker.git
cd infini_docker
```


> 离线交付场景下，直接解压收到的压缩包并进入目录即可。

## 3. 配置 `.env`

```
mkdir -p __data/mysql __data/mongo __data/redis
mkdir -p datas persist auto-coder upload tasks
cp .env.example .env
```


打开 `.env`，**至少**修改以下几项：

```
# 数据库与缓存密码（生产强烈建议修改）
DB_PASSWORD=infinisynapse@123
REDIS_PASSWORD=ChangeMeRedisPassword!
MONGO_PASSWORD=infinisynapse2025
# URI 编码后的 Mongo 密码；不含 @ : / ? # & = 等特殊字符时与 MONGO_PASSWORD 填同一个值即可
MONGO_PASSWORD_URIENC=infinisynapse2025

# JWT 密钥（必改，长度 ≥ 32）
JWT_SECRET=ChangeMeJwtSecretAtLeast32Chars

# 鉴权地址（必改！见下方说明）
AUTHING_SERVER_URL=http://<服务器IP或域名>:3000/api
```


### ⚠️ `AUTHING_SERVER_URL` 填写规则（最容易踩坑）

- 变量名是 `AUTHING_SERVER_URL`，**不是** `AUTH_SERVER_URL`。
- 必须填**浏览器能访问的**服务器 IP 或域名，**不能**写容器名或 `127.0.0.1`。
- 端口固定为 `3000`，路径固定为 `/api`，末尾不加 `/`。
- 启用 HTTPS 反代时改为 `https://<域名>/api`，由反代把 `/api` 路由到 `infini-proxy-server:3000`。

示例（服务器 IP 为 `192.168.1.10`）：

```
AUTHING_SERVER_URL=http://192.168.1.10:3000/api
```


## 4. 启动服务

```
docker compose up -d --build
```


首次启动会构建镜像并自动跑 MySQL 迁移，约需 **10–30 分钟**。完成后检查状态：

```
docker compose ps
```


除 `infini-synapse-mysql-migrate` 显示 `Exited (0)`（一次性任务，正常）外，其余容器应均为 `running`。

## 5. 初始化管理员

```
bash deploy/init-admin.sh
```


默认创建 `admin / 123456`。自定义密码或用户名：

```
ADMIN_USERNAME='your_admin' ADMIN_PASSWORD='YourStrongPassword' bash deploy/init-admin.sh
```


该脚本按用户名 upsert，后续重置密码重复执行即可。

## 6. 访问系统

假设服务器 IP 为 `192.168.1.10`：

- 主应用：<http://192.168.1.10:8088>
- 管理后台：<http://192.168.1.10/>

使用第 5 步创建的账号登录。

## 7. 常用运维命令

```
# 查看日志
docker compose logs -f infini-synapse

# 重启某个服务
docker compose restart infini-synapse

# 停止 / 启动全部
docker compose stop
docker compose start

# 备份持久化数据
tar czvf infini-backup-$(date +%F).tgz __data persist datas upload

# 升级
git pull && docker compose up -d --build
```


持久化数据目录：`__data/`（MySQL/Mongo/Redis）、`persist/`（主应用）、`datas/`、`upload/`。

## 8. 常见问题

### 登录失败 / 接口 401 / 页面空白

**99% 是 `AUTHING_SERVER_URL` 配置错误。** 打开浏览器 DevTools → Network 查看失败请求的目标地址，应该是 `http://<服务器IP或域名>:3000/api/...`；如果不是，对照第 3 节修正后重启：

```
docker compose up -d infini-synapse
```


另外确认宿主机 `3000` 端口已对外开放。

### `infini-sql` 启动失败或 OOM

InfiniSQL 默认占用较多内存。若服务器内存小于 32 GB，在 `.env` 中下调参数（16 GB 机器示例）：

```
INFINI_SQL_SPARK_DRIVER_MEMORY=6g
INFINI_SQL_MEM_LIMIT=8g
INFINI_SQL_MEMSWAP_LIMIT=10g
```


```
docker compose up -d infini-sql
```


### 端口冲突

在 `.env` 修改 `APP_PORT` / `PROXY_ADMIN_PORT` 等端口后 `docker compose up -d` 重启。

## 9. 获取帮助

- 官方文档：<https://uelng8wukz.feishu.cn/wiki/Z6tnwknQaia13ykXCn5cT5mpnnd?fromScene=spaceOverview>
- 官方微信群：见项目根目录 `images/wechat.jpg`
- 提交 Issue 时请附带 `docker compose ps` 与 `docker compose logs --tail=200` 的输出。
