# InfiniSynapse Private Deployment Guide


One-click deployment with Docker Compose. Follow the steps below to go live.

## 1. Requirements

- **Hardware**: Recommended 8 cores / 32 GB RAM / 100 GB disk (minimum 16 GB RAM; lower InfiniSQL memory settings if needed)
- **OS**: Linux (Ubuntu 22.04 LTS recommended)
- **Software**: Docker ≥ 24, Docker Compose plugin ≥ 2.20 (use the `docker compose` command)
- **Network**: Access to Docker Hub, official npm/pip registries, and `infinisynapse.oss-cn-shanghai.aliyuncs.com`
- **Ports to expose externally**: `8088` (main app), `80` (admin console), `3000` (auth API, browser-accessible)

If Docker is not installed, run:

```
curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```


Log in again, then verify with `docker --version` and `docker compose version`.

## 2. Get the code

```
git clone https://github.com/chaozwn/infini_docker.git
cd infini_docker
```


> For offline delivery, unpack the archive you received and enter that directory.

## 3. Configure `.env`

```
mkdir -p __data/mysql __data/mongo __data/redis
mkdir -p datas persist auto-coder upload tasks
cp .env.example .env
```


Open `.env` and **at minimum** adjust:

```
# Database and cache passwords (strongly change in production)
DB_PASSWORD=infinisynapse@123
REDIS_PASSWORD=ChangeMeRedisPassword!
MONGO_PASSWORD=infinisynapse2025
# URI-encoded Mongo password; if it has no @ : / ? # & = etc., same as MONGO_PASSWORD
MONGO_PASSWORD_URIENC=infinisynapse2025

# JWT secret (required, length ≥ 32)
JWT_SECRET=ChangeMeJwtSecretAtLeast32Chars

# Auth endpoint (required — see notes below)
AUTHING_SERVER_URL=http://<SERVER_IP_OR_DOMAIN>:3000/api
```


### ⚠️ `AUTHING_SERVER_URL` rules (most common pitfall)

- The variable name is `AUTHING_SERVER_URL`, **not** `AUTH_SERVER_URL`.
- Must be reachable **by the browser** — use the server IP or domain, **not** a container name or `127.0.0.1`.
- Port is always `3000`, path always `/api`, no trailing `/`.
- With HTTPS reverse proxy, use `https://<domain>/api` and route `/api` to `infini-proxy-server:3000`.

Example (server IP `192.168.1.10`):

```
AUTHING_SERVER_URL=http://192.168.1.10:3000/api
```


## 4. Start services

```
docker compose up -d --build
```


The first run builds images and runs MySQL migrations; expect **10–30 minutes**. Then check status:

```
docker compose ps
```


Except `infini-synapse-mysql-migrate` showing `Exited (0)` (one-off job, normal), all other containers should be `running`.

## 5. Initialize admin

```
bash deploy/init-admin.sh
```


By default this creates `admin / 123456`. Custom username or password:

```
ADMIN_USERNAME='your_admin' ADMIN_PASSWORD='YourStrongPassword' bash deploy/init-admin.sh
```


The script upserts by username; run again to reset the password.

## 6. Access the system

Assuming server IP `192.168.1.10`:

- Main app: <http://192.168.1.10:8088>
- Admin console: <http://192.168.1.10/>

Sign in with the account from step 5.

## 7. Common operations

```
# Logs
docker compose logs -f infini-synapse

# Restart one service
docker compose restart infini-synapse

# Stop / start all
docker compose stop
docker compose start

# Backup persistent data
tar czvf infini-backup-$(date +%F).tgz __data persist datas upload

# Upgrade
git pull && docker compose up -d --build
```


Persistent paths: `__data/` (MySQL/Mongo/Redis), `persist/` (main app), `datas/`, `upload/`.

## 8. Troubleshooting

### Login fails / API 401 / blank page

**In most cases `AUTHING_SERVER_URL` is wrong.** In the browser DevTools → Network, check the failing request URL; it should be `http://<SERVER_IP_OR_DOMAIN>:3000/api/...`. If not, fix per section 3 and restart:

```
docker compose up -d infini-synapse
```


Also confirm host port `3000` is open externally.

### `infini-sql` fails or OOM

InfiniSQL uses a lot of RAM by default. On hosts with less than 32 GB RAM, lower settings in `.env` (example for 16 GB):

```
INFINI_SQL_SPARK_DRIVER_MEMORY=6g
INFINI_SQL_MEM_LIMIT=8g
INFINI_SQL_MEMSWAP_LIMIT=10g
```


```
docker compose up -d infini-sql
```


### Port conflicts

Change `APP_PORT`, `PROXY_ADMIN_PORT`, etc. in `.env`, then run `docker compose up -d`.

## 9. Get help

- Docs: <https://uelng8wukz.feishu.cn/wiki/Z6tnwknQaia13ykXCn5cT5mpnnd?fromScene=spaceOverview>
- WeChat group: see `images/wechat.jpg` in the project root
- When opening an Issue, include output of `docker compose ps` and `docker compose logs --tail=200`
