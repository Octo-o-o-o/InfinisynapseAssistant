# InfiniSynapse Partner SSO Integration Guide


本文面向希望在自己的产品中集成「使用 InfiniSynapse 登录」的第三方开发者。按照本文步骤接入后，你的应用可以：

- 让用户以 InfiniSynapse 账号一键登录你的应用；
- 登录完成后拿到用户的基本信息（ID、昵称、邮箱、头像等），与你自己的账号体系绑定；
- 用户在完成登录的同时，也自动登录了 InfiniSynapse App（`app.infinisynapse.cn`），后续从你的应用跳转到 InfiniSynapse 时无需再次登录。

整个接入只需要你有一个能发 HTTP 请求的服务端，没有 SDK 依赖，任何语言都可以接。

## 1. 它是怎么工作的

先用一段大白话把流程讲清楚。整个登录过程一共 5 步，其中你的服务端只需要发 2 个 HTTP 请求：

```
你的应用                    InfiniSynapse                     用户浏览器
   │                            │                                │
   │ ① 创建登录会话 ────────────▶│                                │
   │ ◀──────── 返回 entryUrl ───│                                │
   │                            │                                │
   │ ② 把用户重定向到 entryUrl ─────────────────────────────────▶│
   │                            │◀── ③ 用户在 app 域完成登录 ────│
   │                            │                                │
   │ ◀───────── ④ 浏览器带一次性 code 跳回你的 returnUrl ────────│
   │                            │                                │
   │ ⑤ 用 code 换取用户信息 ───▶│                                │
   │ ◀──────── 返回用户资料 ────│                                │
```


1.  **创建会话**：用户点击「使用 InfiniSynapse 登录」按钮时，你的服务端调用 InfiniSynapse 接口创建一个登录会话，拿到一个 `entryUrl`（指向 `app.infinisynapse.cn` 的入口页）。
2.  **重定向**：把用户浏览器重定向到这个 `entryUrl`。
3.  **用户登录**：用户在 InfiniSynapse 页面完成登录（扫码、邮箱、手机号等方式均可）。如果用户此前已经登录过 InfiniSynapse，这一步会自动完成，用户几乎无感。
4.  **跳回你的应用**：登录成功后，浏览器自动跳回你预先指定的 `returnUrl`，并附带一个一次性授权码 `code`。
5.  **换取用户信息**：你的服务端用这个 `code` 调用 InfiniSynapse 接口，换取用户资料，然后写入你自己的登录态，完成整个登录。

这个模式与微信、GitHub 等平台的 OAuth 授权码登录基本一致。关键的安全点在于：`code` 只在服务端之间传递兑换、只能用一次、几分钟内就过期，用户信息不会暴露在浏览器地址栏里。

## 2. 准备工作：申请接入凭证

接入前你需要一对凭证：`clientId`（客户端标识）和 `clientSecret`（客户端密钥），用于证明「这个请求确实来自你的应用」。

### 在页面上自助申请（推荐）

1.  用你的 InfiniSynapse 账号登录 <https://app.infinisynapse.cn/tasks>；
2.  点击左下角「设置」齿轮图标，在菜单中选择 **第三方接入**；
3.  点击 **创建接入应用**，填写：
    - **应用名称**：你的应用名，会用于后台展示；
    - **回调域名白名单**：登录完成后允许跳回的域名或 IP 地址，多个用逗号分隔。域名如 `example.com`（会同时放行其子域名如 `app.example.com`）；IP 地址按精确匹配放行（如 `192.168.1.10`），端口不参与校验、无需填写。本地开发调试可以填 `localhost` 或 `127.0.0.1`；
    - **Webhook URL**（可选）：如果你希望登录完成时 InfiniSynapse 主动通知你的服务端，填一个 HTTPS 接口地址（不允许指向内网/私有地址），详见第 5 节。
4.  创建成功后会弹窗展示 `clientId` / `clientSecret`（配置了 Webhook 还会有 `webhookSecret`）。**这些密钥只展示这一次**，请立即妥善保存。

在同一页面还可以查看已创建的应用列表、**编辑应用**（名称、回调域名白名单、Webhook URL 均可随时修改）、启用/禁用应用、重置密钥（旧密钥立即失效）。如果创建时没有配置 Webhook、编辑时才补上，保存后会弹窗展示一次新生成的 `webhookSecret`；把 Webhook URL 清空则该密钥一并作废。每个账号默认最多创建 5 个接入应用。

> `clientSecret` 相当于你应用的密码，只能保存在你的服务端（环境变量、密钥管理系统等），绝对不要写进前端代码、App 客户端或公开仓库。如果怀疑泄露，请立即在页面上重置密钥。

### 通过 API 申请

也可以用你的登录 Token 直接调接口创建（Token 可从浏览器登录后的请求头中获取）：

```
curl -X POST https://api.infinisynapse.cn/api/auth/partner/clients \
  -H "Authorization: Bearer <你的登录Token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的应用",
    "allowedReturnDomains": ["example.com"],
    "webhookUrl": "https://example.com/webhook/infini"
  }'
```


## 3. 接口基础信息

| 项                   | 值                                       |
|----------------------|------------------------------------------|
| API 基础地址（国内） | `https://api.infinisynapse.cn/api`       |
| API 基础地址（海外） | `https://api.infinisynapse.com/api`      |
| 服务端接口鉴权方式   | 请求头 `X-Client-Id` + `X-Client-Secret` |
| 内容类型             | `application/json`                       |

所有接口返回统一信封结构：

```
{
  "code": 200,
  "message": "success",
  "data": { }
}
```


`code === 200` 表示成功，业务数据在 `data` 中；失败时 `message` 为错误说明。下文示例统一以 `.cn` 域名书写，海外环境替换为 `.com` 即可。

## 4. 接入步骤详解

### 第 1 步：服务端创建登录会话

用户点击你页面上的「使用 InfiniSynapse 登录」按钮后，你的**服务端**（不要在前端调，会暴露 secret）发起：

```
POST /api/auth/partner/sessions
X-Client-Id: partner_xxxxxxxx
X-Client-Secret: psk_xxxxxxxx
Content-Type: application/json
```


请求体：

| 字段 | 必填 | 说明 |
|----|----|----|
| `returnUrl` | 是 | 登录成功后浏览器跳回的完整地址，域名必须在你申请时填写的白名单内，例如 `https://example.com/auth/infini/callback` |
| `cancelUrl` | 否 | 用户取消登录时跳回的地址，同样受白名单约束 |
| `state` | 否 | 随机字符串，跳回时会原样带回，用于防 CSRF（强烈建议传，见第 6 节） |
| `externalUserId` | 否 | 你系统里的用户 ID。如果用户在你的应用里已有账号、只是做账号绑定，可以传，回调和 Webhook 里会原样带回 |
| `metadata` | 否 | 任意 JSON 对象，回调时原样带回，可存放你的业务上下文 |

响应示例：

```
{
  "code": 200,
  "message": "success",
  "data": {
    "sessionId": "ps_1549cddc5049bf286f9858ce5ae873b2",
    "entryUrl": "https://app.infinisynapse.cn/auth/entry?session=ps_1549cddc5049bf286f9858ce5ae873b2",
    "expiresIn": 600
  }
}
```


会话默认有效期 10 分钟（`expiresIn`，单位秒），过期后用户需要回到你的页面重新发起登录。

### 第 2 步：把用户重定向到 entryUrl

拿到 `entryUrl` 后，直接让浏览器跳转过去（HTTP 302 或前端 `location.href` 均可）。

用户会看到 InfiniSynapse 的登录页面；如果用户浏览器里已有 InfiniSynapse 登录态，则会跳过登录界面直接进入下一步，整个过程一闪而过。

### 第 3 步：接收回调，校验 state

登录完成后，浏览器会跳回你的 `returnUrl`，并附带两个查询参数：

```
https://example.com/auth/infini/callback?code=ac_xxxxxxxx&state=你传入的state
```


- `code`：一次性授权码，有效期 5 分钟，只能兑换一次；
- `state`：你在第 1 步传入的值，原样返回。

收到回调后请先校验 `state` 与你发起登录时保存的值一致，不一致则拒绝（可能是伪造的回调请求）。

### 第 4 步：服务端用 code 换取用户信息

```
POST /api/auth/partner/token
X-Client-Id: partner_xxxxxxxx
X-Client-Secret: psk_xxxxxxxx
Content-Type: application/json

{
  "code": "ac_xxxxxxxx",
  "grant_type": "authorization_code"
}
```


请求体：

| 字段 | 必填 | 说明 |
|----|----|----|
| `code` | 是 | 回调收到的一次性授权码 |
| `grant_type` | 是 | 固定为 `authorization_code` |
| `withApiKey` | 否 | 传 `true` 时，响应中额外返回一个代该用户签发的 **Partner 专属 API Key**（`sk-` 开头），可用于以该用户身份调用 InfiniSynapse 开放 API（如发起任务），详见第 5 节 |

响应示例：

```
{
  "code": 200,
  "message": "success",
  "data": {
    "user": {
      "id": "68d21916d6802ec254b46975",
      "email": "user@example.com",
      "username": "user@example.com",
      "nickname": "张三",
      "avatar": "https://files.authing.co/avatar/xxx.png",
      "phone": "138****0000"
    },
    "externalUserId": "your-user-123",
    "sessionId": "ps_1549cddc...",
    "metadata": { "source": "your-app" },
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```


`data.user.id` 是用户在 InfiniSynapse 的唯一 ID，**建议用它作为绑定键**存入你的用户表（邮箱、昵称等都可能变化，ID 不会变）。拿到用户信息后，为用户创建/关联你自己的账号，写入你的登录态（Session、JWT 等），登录流程到此完成。

`data.apiKey` 仅在请求传了 `withApiKey: true` 时返回（签发失败时为空，见第 5 节），请存入你的服务端并与该用户绑定。

> 注意：`code` 兑换失败的常见原因是超过 5 分钟有效期、或被重复兑换。这时让用户回到你的登录页重新发起一次即可。

### 顺带完成的事：用户同时登录了 InfiniSynapse App

由于第 3 步的登录发生在 `app.infinisynapse.cn` 域名下，用户在完成你应用的登录时，InfiniSynapse App 的登录态也已经建立。之后你的应用里如果有「打开 InfiniSynapse」之类的入口，用户点过去就是已登录状态，无需再登录一次。

## 5. 可选能力

### Webhook：登录完成主动通知

如果你在创建应用时配置了 `webhookUrl`，每当有用户通过你的应用完成登录，InfiniSynapse 会向该地址 POST 一条消息：

```
{
  "event": "partner.session.completed",
  "sessionId": "ps_xxx",
  "externalUserId": "your-user-123",
  "user": { "id": "...", "email": "...", "nickname": "..." },
  "metadata": { },
  "completedAt": 1751443200000
}
```


请求头携带 HMAC-SHA256 签名，用创建应用时返回的 `webhookSecret` 验签：

```
X-Infini-Signature: <hex(hmac_sha256(webhookSecret, 原始请求体))>
```


Node.js 验签示例：

```
import { createHmac, timingSafeEqual } from 'node:crypto'

function verifySignature(rawBody, signature, webhookSecret) {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return signature.length === expected.length
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```


你的接口返回 HTTP 2xx 即视为投递成功；失败会指数退避重试若干次。Webhook 是异步通知，**不要**把它作为登录完成的唯一依据，主流程仍以 code 兑换为准。

### 轮询会话状态

如果你的场景不方便接收浏览器回调（比如桌面客户端弹出系统浏览器登录），可以在创建会话后轮询状态：

```
GET /api/auth/partner/sessions/{sessionId}
X-Client-Id: partner_xxxxxxxx
X-Client-Secret: psk_xxxxxxxx
```


响应中 `status` 为 `pending`（等待登录）/ `completed`（已完成，此时 `user` 字段携带用户资料）/ `expired`（已过期）。建议轮询间隔 2 秒以上。

### Partner API Key：以用户身份调用 InfiniSynapse 开放 API

如果你的应用不止需要「登录」，还希望**代用户使用 InfiniSynapse 的能力**（比如替用户发起一个数据分析任务），可以在第 4 步兑换 code 时传 `withApiKey: true`，响应中会额外返回一个 `apiKey`（`sk-` 开头）。

这把 key 的特性：

- **归属用户本人**：以它发起的调用、任务和计费都记在该用户账上，而不是你的应用账上；
- **同一用户 + 同一应用固定复用同一把**：用户重复登录不会产生新 key，直接覆盖保存即可；
- **用户可见、可吊销**：它会出现在用户 InfiniSynapse 账号的 API Key 列表中（名称为 `Partner: <你的应用名>`），用户可随时删除；删除后你下次兑换 code 时会自动签发一把新的；
- **可能签发失败**：用户 API Key 数量达到上限（默认 20 个）时 `apiKey` 返回空，请做好降级。

**示例：代用户发起一个任务**

任务等开放 API 在 App 服务域名下（注意与 SSO 接口的 `api.` 域名不同）：国内 `https://app.infinisynapse.cn`，海外 `https://app.infinisynapse.com`。

```
POST https://app.infinisynapse.cn/api/ai/message
Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "type": "newTask",
  "taskId": "c3a2f9d0-你生成的UUID-用于幂等",
  "text": "分析最近 7 天的销售数据，输出图表报告",
  "images": []
}
```


`taskId` 由你的服务端生成（建议 UUID），重复提交同一 `taskId` 不会重复建任务。响应 `data.success` 为 `true` 即创建成功，用户随后在 InfiniSynapse App 的任务列表中就能看到这个任务（来源标记为 API-Key 任务）。

> `apiKey` 等同于该用户的长期凭证，和 `clientSecret` 一样只能保存在你的服务端，绝不能下发到浏览器或客户端。

## 6. 安全须知

1.  **clientSecret 只放服务端**。所有携带 `X-Client-Secret` 的请求都必须从你的服务端发出。
2.  **务必使用并校验 `state`**。发起登录时生成随机字符串存入用户会话，回调时比对，防止跨站请求伪造（CSRF）。
3.  **`code` 是一次性的**，兑换后立即失效；不要把它存下来复用。
4.  **`returnUrl` 白名单**。InfiniSynapse 只允许跳回你登记的域名/IP，如需调整，直接在 **设置 → 第三方接入** 页面编辑应用即可。
5.  **生产环境请全程使用 HTTPS**，Webhook 地址也必须是 HTTPS，且不允许指向内网/私有地址。
6.  **`withApiKey` 获取的 API Key 等同用户的长期凭证**，只能保存在你的服务端；不再需要时请引导用户在 App 的 API Key 列表中删除。
7.  密钥疑似泄露时，第一时间在 **设置 → 第三方接入** 页面重置密钥或禁用应用。

## 7. 接口速查表

| 接口 | 鉴权 | 用途 |
|----|----|----|
| `POST /api/auth/partner/sessions` | `X-Client-Id` + `X-Client-Secret` | 创建登录会话，返回 `entryUrl` |
| `GET /api/auth/partner/sessions/{sessionId}` | 同上 | 轮询会话状态（含用户信息） |
| `POST /api/auth/partner/token` | 同上 | 用一次性 `code` 换取用户资料（可选 `withApiKey` 同时获取 Partner API Key） |
| `POST /api/auth/partner/clients` | 用户 Bearer Token | 自助创建接入应用 |
| `GET /api/auth/partner/clients` | 用户 Bearer Token | 查看自己名下的接入应用 |
| `PATCH /api/auth/partner/clients/{clientId}` | 用户 Bearer Token | 编辑应用（名称/回调域名/Webhook URL），首次配置 Webhook 时返回一次 `webhookSecret` |
| `POST /api/auth/partner/clients/{clientId}/enabled` | 用户 Bearer Token | 启用/禁用应用，body `{"enabled": false}` |
| `POST /api/auth/partner/clients/{clientId}/rotate-secret` | 用户 Bearer Token | 重置 `clientSecret`（旧的立即失效） |

## 8. 完整示例（Node.js + Express）

下面是一个可直接运行的最小示例，包含发起登录、接收回调、兑换用户信息三个环节：

```
import { randomBytes } from 'node:crypto'
import express from 'express'

const PROXY_API = 'https://api.infinisynapse.cn/api'
const CLIENT_ID = process.env.INFINI_CLIENT_ID
const CLIENT_SECRET = process.env.INFINI_CLIENT_SECRET
const SELF_ORIGIN = 'https://example.com'   // 你的应用地址

const app = express()
const partnerHeaders = {
  'Content-Type': 'application/json',
  'X-Client-Id': CLIENT_ID,
  'X-Client-Secret': CLIENT_SECRET,
}

// 1. 用户点击登录：创建会话并重定向
app.get('/login', async (req, res) => {
  const state = randomBytes(16).toString('hex')
  req.session.oauthState = state   // 存入你的会话方案

  const resp = await fetch(`${PROXY_API}/auth/partner/sessions`, {
    method: 'POST',
    headers: partnerHeaders,
    body: JSON.stringify({
      returnUrl: `${SELF_ORIGIN}/auth/infini/callback`,
      state,
    }),
  })
  const json = await resp.json()
  if (json.code !== 200) return res.status(500).send(json.message)
  res.redirect(json.data.entryUrl)
})

// 2. 登录完成跳回：校验 state，用 code 换用户信息
app.get('/auth/infini/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || state !== req.session.oauthState) {
    return res.status(400).send('state 校验失败')
  }
  req.session.oauthState = undefined

  const resp = await fetch(`${PROXY_API}/auth/partner/token`, {
    method: 'POST',
    headers: partnerHeaders,
    body: JSON.stringify({ code, grant_type: 'authorization_code' }),
  })
  const json = await resp.json()
  if (json.code !== 200) return res.status(500).send(json.message)

  const infiniUser = json.data.user
  // 按 infiniUser.id 查找/创建你的本地用户，写入登录态
  req.session.userId = infiniUser.id
  res.redirect('/dashboard')
})
```


## 9. 常见问题

**问：用户已经登录过 InfiniSynapse，还会看到登录页吗？** 不会。入口页检测到已有登录态时会直接完成会话并跳回你的应用，整个过程通常在 1 秒内。

**问：登录会话或 code 过期了怎么办？** 会话默认 10 分钟、code 默认 5 分钟有效。过期后让用户回到你的登录入口重新发起即可，无其他副作用。

**问：能拿到用户的哪些信息？** 用户 ID（稳定唯一）、昵称、用户名、邮箱、头像、手机号。具体字段是否有值取决于用户注册时使用的登录方式，请做好空值兜底，绑定账号请始终以 `user.id` 为准。

**问：一个账号能创建几个接入应用？** 默认每个 InfiniSynapse 账号最多创建 5 个。如有更多需求请联系我们。

**问：创建后想修改回调域名或 Webhook 怎么办？** 在 **设置 → 第三方接入** 页面点击应用的「编辑」即可，名称、回调域名白名单、Webhook URL 都可以修改，无需重建应用。首次补配 Webhook 时会展示一次 `webhookSecret`，请注意保存。

**问：回调地址可以用 IP 吗？** 可以。白名单里直接填 IP（如 `192.168.1.10`）即可，按精确匹配放行，端口不参与校验。注意白名单按 hostname 字面值比对：`localhost` 和 `127.0.0.1` 是两个不同的值，你的 `returnUrl` 里用哪个就填哪个（也可以都填上）。

**问：登录之外，能以用户身份调用 InfiniSynapse 的其他能力吗？** 可以。兑换 code 时传 `withApiKey: true` 获取该用户的 Partner API Key，然后用它调用开放 API（如发起任务），详见第 5 节。

**问：本地开发怎么调试？** 把 `localhost`（或 `127.0.0.1` 等 IP）加入回调域名白名单即可，`returnUrl` 支持 `http://localhost:端口` / `http://127.0.0.1:端口` 形式。
