# InfiniSynapse Partner SSO Integration Guide


This guide is for third-party developers who want to add "Sign in with InfiniSynapse" to their own product. After completing the integration, your application can:

- Let users sign in to your app with their InfiniSynapse account in one click;
- Receive the user's basic profile (ID, nickname, email, avatar, etc.) after login and link it to your own account system;
- Have the user signed in to the InfiniSynapse App (`app.infinisynapse.cn`) at the same time, so later jumps from your app to InfiniSynapse require no extra login.

All you need is a backend that can make HTTP requests. There is no SDK dependency — any language works.

## 1. How it works

In plain terms, the whole login takes 5 steps, and your backend only needs to make 2 HTTP requests:

```
Your app                    InfiniSynapse                     User's browser
   │                            │                                │
   │ ① Create login session ──▶│                                │
   │ ◀──────── entryUrl ───────│                                │
   │                            │                                │
   │ ② Redirect user to entryUrl ──────────────────────────────▶│
   │                            │◀── ③ User signs in on app ────│
   │                            │                                │
   │ ◀──────── ④ Browser returns to your returnUrl with code ──│
   │                            │                                │
   │ ⑤ Exchange code ─────────▶│                                │
   │ ◀──────── user profile ───│                                │
```


1.  **Create a session**: when the user clicks your "Sign in with InfiniSynapse" button, your backend calls the InfiniSynapse API to create a login session and receives an `entryUrl` (a page on `app.infinisynapse.cn`).
2.  **Redirect**: redirect the user's browser to that `entryUrl`.
3.  **User signs in**: the user completes login on the InfiniSynapse page (QR code, email, phone, etc.). If the user is already signed in to InfiniSynapse, this step completes automatically and is almost invisible.
4.  **Return to your app**: after login, the browser is redirected back to your pre-registered `returnUrl` with a single-use authorization `code`.
5.  **Exchange for the profile**: your backend exchanges the `code` for the user profile, then establishes your own login state.

This is essentially the same authorization-code flow used by GitHub, Google, and other OAuth providers. The key security property: the `code` is exchanged server-to-server, can be used only once, and expires within minutes — the user profile never appears in the browser address bar.

## 2. Prerequisites: get your credentials

You need a `clientId` / `clientSecret` pair that proves requests really come from your application.

### Self-service in the console (recommended)

1.  Sign in to <https://app.infinisynapse.cn/tasks> with your InfiniSynapse account;
2.  Click the gear icon at the bottom-left and choose **Integrations** from the menu;
3.  Click **Create Integration App** and fill in:
    - **App Name**: your application's name, shown in the console;
    - **Allowed Return Domains**: domains or IP addresses the browser may be redirected back to after login, comma separated. Domains like `example.com` also allow subdomains such as `app.example.com`; IP addresses (e.g. `192.168.1.10`) are matched exactly — ports are not part of the check and need not be entered. Use `localhost` or `127.0.0.1` for local development;
    - **Webhook URL** (optional): an HTTPS endpoint if you want InfiniSynapse to actively notify your backend when a login completes (private/internal addresses are not allowed) — see section 5.
4.  A dialog shows your `clientId` / `clientSecret` (plus `webhookSecret` if a webhook was configured). **These secrets are shown only once** — save them immediately.

The same page lets you list your apps, **edit them** (name, allowed return domains, and webhook URL can all be changed at any time), enable/disable them, and rotate secrets (the old secret becomes invalid immediately). If you add a webhook URL later via editing, the newly generated `webhookSecret` is shown once on save; clearing the webhook URL also invalidates that secret. Each account can create up to 5 integration apps by default.

> Treat `clientSecret` like a password for your app. Keep it on your backend only (environment variables, a secrets manager, etc.). Never put it in frontend code, mobile clients, or public repositories. If you suspect a leak, rotate the secret right away.

### Via API

You can also create an app with your login token directly:

```
curl -X POST https://api.infinisynapse.com/api/auth/partner/clients \
  -H "Authorization: Bearer <your login token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "allowedReturnDomains": ["example.com"],
    "webhookUrl": "https://example.com/webhook/infini"
  }'
```


## 3. API basics

| Item                  | Value                                     |
|-----------------------|-------------------------------------------|
| API base URL (China)  | `https://api.infinisynapse.cn/api`        |
| API base URL (Global) | `https://api.infinisynapse.com/api`       |
| Server-side auth      | Headers `X-Client-Id` + `X-Client-Secret` |
| Content type          | `application/json`                        |

All endpoints return a unified envelope:

```
{
  "code": 200,
  "message": "success",
  "data": { }
}
```


`code === 200` means success and the payload is in `data`; on failure `message` describes the error. Examples below use the `.com` domain; use `.cn` for the China region.

## 4. Step-by-step integration

### Step 1: create a login session (server side)

When the user clicks your "Sign in with InfiniSynapse" button, your **backend** (never the frontend — it would expose the secret) calls:

```
POST /api/auth/partner/sessions
X-Client-Id: partner_xxxxxxxx
X-Client-Secret: psk_xxxxxxxx
Content-Type: application/json
```


Request body:

| Field | Required | Description |
|----|----|----|
| `returnUrl` | Yes | Full URL the browser returns to after login. Its domain must be in your allowed-domain list, e.g. `https://example.com/auth/infini/callback` |
| `cancelUrl` | No | URL to return to if the user cancels; also restricted by the domain allowlist |
| `state` | No | Random string echoed back on the callback, used against CSRF (strongly recommended — see section 6) |
| `externalUserId` | No | Your own user ID, useful for account linking; echoed back in the callback and webhook |
| `metadata` | No | Arbitrary JSON object, echoed back as-is |

Response example:

```
{
  "code": 200,
  "message": "success",
  "data": {
    "sessionId": "ps_1549cddc5049bf286f9858ce5ae873b2",
    "entryUrl": "https://app.infinisynapse.com/auth/entry?session=ps_1549cddc5049bf286f9858ce5ae873b2",
    "expiresIn": 600
  }
}
```


Sessions are valid for 10 minutes by default (`expiresIn`, seconds). After expiry the user must start over from your login page.

### Step 2: redirect the user to entryUrl

Simply redirect the browser (HTTP 302 or `location.href`).

The user sees the InfiniSynapse login page; if they already have an InfiniSynapse session in the browser, the page skips straight through and the whole step is nearly instant.

### Step 3: receive the callback and verify state

After login the browser returns to your `returnUrl` with two query parameters:

```
https://example.com/auth/infini/callback?code=ac_xxxxxxxx&state=your-state
```


- `code`: single-use authorization code, valid for 5 minutes, redeemable once;
- `state`: the value you passed in step 1, returned unchanged.

Verify that `state` matches the value you stored when initiating login; reject the request otherwise (it may be forged).

### Step 4: exchange the code for the user profile (server side)

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


Request body:

| Field | Required | Description |
|----|----|----|
| `code` | Yes | The single-use authorization code from the callback |
| `grant_type` | Yes | Fixed value `authorization_code` |
| `withApiKey` | No | Pass `true` to additionally receive a **partner-scoped API key** (`sk-` prefixed) issued on the user's behalf, usable to call InfiniSynapse open APIs (e.g. creating tasks) as that user — see section 5 |

Response example:

```
{
  "code": 200,
  "message": "success",
  "data": {
    "user": {
      "id": "68d21916d6802ec254b46975",
      "email": "user@example.com",
      "username": "user@example.com",
      "nickname": "Alice",
      "avatar": "https://files.authing.co/avatar/xxx.png",
      "phone": "+1 555 ****"
    },
    "externalUserId": "your-user-123",
    "sessionId": "ps_1549cddc...",
    "metadata": { "source": "your-app" },
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```


`data.user.id` is the user's stable, unique InfiniSynapse ID — **use it as the linking key** in your user table (email and nickname can change; the ID never does). Create or match your local account, establish your own session/JWT, and the login is complete.

`data.apiKey` is only present when the request included `withApiKey: true` (and may be empty if issuance failed — see section 5). Store it on your backend, linked to that user.

> The most common reasons a code exchange fails: the 5-minute validity elapsed, or the code was already redeemed. Just let the user start the login again.

### A side effect you get for free: the user is also signed in to InfiniSynapse App

Because step 3 happens on the `app.infinisynapse.cn` domain, the InfiniSynapse App session is established at the same time. Any "Open InfiniSynapse" link in your product will land the user already signed in.

## 5. Optional capabilities

### Webhook: push notification on login completion

If you configured a `webhookUrl`, InfiniSynapse POSTs a message to it each time a user completes login through your app:

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


The request carries an HMAC-SHA256 signature computed with the `webhookSecret` returned at app creation:

```
X-Infini-Signature: <hex(hmac_sha256(webhookSecret, raw request body))>
```


Node.js verification example:

```
import { createHmac, timingSafeEqual } from 'node:crypto'

function verifySignature(rawBody, signature, webhookSecret) {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return signature.length === expected.length
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```


Any HTTP 2xx response counts as delivered; failures are retried with exponential backoff. The webhook is asynchronous — do **not** rely on it as the sole signal of login completion; the code exchange remains the primary flow.

### Polling the session status

If receiving a browser callback is inconvenient (e.g. a desktop client opening the system browser), poll the session after creating it:

```
GET /api/auth/partner/sessions/{sessionId}
X-Client-Id: partner_xxxxxxxx
X-Client-Secret: psk_xxxxxxxx
```


`status` is one of `pending` (waiting for login), `completed` (done — the `user` field carries the profile), or `expired`. Poll no more often than every 2 seconds.

### Partner API key: call InfiniSynapse open APIs as the user

If your application needs more than sign-in — for example, **using InfiniSynapse capabilities on the user's behalf** (such as starting a data-analysis task for them) — pass `withApiKey: true` when exchanging the code in step 4. The response then includes an `apiKey` (`sk-` prefixed).

Properties of this key:

- **It belongs to the user**: calls, tasks, and billing made with it are attributed to that user's account, not to your application;
- **One key per user per app, reused**: repeated logins return the same key — just overwrite what you have stored;
- **Visible and revocable by the user**: it appears in the user's InfiniSynapse API key list (named `Partner: <your app name>`) and can be deleted at any time; after deletion, the next code exchange automatically issues a new one;
- **Issuance can fail**: if the user has reached the API key limit (20 by default), `apiKey` comes back empty — degrade gracefully.

**Example: create a task on the user's behalf**

Open APIs such as tasks live on the App service domain (note this differs from the `api.` domain used by the SSO endpoints): `https://app.infinisynapse.com` (Global) / `https://app.infinisynapse.cn` (China).

```
POST https://app.infinisynapse.com/api/ai/message
Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "type": "newTask",
  "taskId": "c3a2f9d0-your-generated-uuid-for-idempotency",
  "text": "Analyze the last 7 days of sales data and produce a chart report",
  "images": []
}
```


Generate `taskId` on your backend (a UUID is recommended); resubmitting the same `taskId` will not create a duplicate task. `data.success === true` means the task was created — the user will see it in their InfiniSynapse App task list (marked as an API-key task).

> The `apiKey` is effectively a long-lived credential for that user. Like `clientSecret`, it must stay on your backend and never be shipped to browsers or clients.

## 6. Security checklist

1.  **Keep `clientSecret` server-side only.** Every request carrying `X-Client-Secret` must originate from your backend.
2.  **Always use and verify `state`.** Generate a random string per login attempt, store it in the user's session, and compare on callback to prevent CSRF.
3.  **The `code` is single-use** and invalidated on redemption; never store it for reuse.
4.  **`returnUrl` is allowlisted.** InfiniSynapse only redirects to the domains/IPs you registered. To adjust the list, simply edit the app under **Settings → Integrations**.
5.  **Use HTTPS everywhere in production**, including the webhook endpoint; webhook URLs must not point to private/internal addresses.
6.  **The API key obtained via `withApiKey` is a long-lived user credential** — keep it on your backend only, and guide the user to delete it from their API key list when no longer needed.
7.  If a secret may have leaked, rotate it or disable the app immediately under **Settings → Integrations**.

## 7. API quick reference

| Endpoint | Auth | Purpose |
|----|----|----|
| `POST /api/auth/partner/sessions` | `X-Client-Id` + `X-Client-Secret` | Create a login session, returns `entryUrl` |
| `GET /api/auth/partner/sessions/{sessionId}` | Same | Poll session status (includes user profile) |
| `POST /api/auth/partner/token` | Same | Exchange the single-use `code` for the user profile (optional `withApiKey` also returns a partner API key) |
| `POST /api/auth/partner/clients` | User Bearer token | Create an integration app (self-service) |
| `GET /api/auth/partner/clients` | User Bearer token | List your integration apps |
| `PATCH /api/auth/partner/clients/{clientId}` | User Bearer token | Edit an app (name / return domains / webhook URL); returns `webhookSecret` once when a webhook is first configured |
| `POST /api/auth/partner/clients/{clientId}/enabled` | User Bearer token | Enable/disable an app, body `{"enabled": false}` |
| `POST /api/auth/partner/clients/{clientId}/rotate-secret` | User Bearer token | Rotate `clientSecret` (old one becomes invalid) |

## 8. Complete example (Node.js + Express)

A minimal runnable example covering login initiation, the callback, and the code exchange:

```
import { randomBytes } from 'node:crypto'
import express from 'express'

const PROXY_API = 'https://api.infinisynapse.com/api'
const CLIENT_ID = process.env.INFINI_CLIENT_ID
const CLIENT_SECRET = process.env.INFINI_CLIENT_SECRET
const SELF_ORIGIN = 'https://example.com'   // your app's origin

const app = express()
const partnerHeaders = {
  'Content-Type': 'application/json',
  'X-Client-Id': CLIENT_ID,
  'X-Client-Secret': CLIENT_SECRET,
}

// 1. User clicks login: create a session and redirect
app.get('/login', async (req, res) => {
  const state = randomBytes(16).toString('hex')
  req.session.oauthState = state   // store with your session solution

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

// 2. Callback: verify state, exchange the code
app.get('/auth/infini/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code || state !== req.session.oauthState) {
    return res.status(400).send('state mismatch')
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
  // Look up / create your local user by infiniUser.id, then set your login state
  req.session.userId = infiniUser.id
  res.redirect('/dashboard')
})
```


## 9. FAQ

**Q: Will users who are already signed in to InfiniSynapse see a login page?** No. The entry page detects an existing session, completes the flow, and redirects back to your app — usually within a second.

**Q: What happens when a session or code expires?** Sessions last 10 minutes and codes 5 minutes by default. Simply let the user restart the login; there are no other side effects.

**Q: Which profile fields are available?** User ID (stable and unique), nickname, username, email, avatar, and phone. Availability depends on how the user registered, so handle missing values gracefully and always link accounts by `user.id`.

**Q: How many integration apps can one account create?** Up to 5 per InfiniSynapse account by default. Contact us if you need more.

**Q: How do I change the return domains or webhook after creation?** Click "Edit" on the app under **Settings → Integrations**. Name, allowed return domains, and webhook URL can all be changed without recreating the app. When a webhook is configured for the first time, the `webhookSecret` is shown once — save it.

**Q: Can the return URL use an IP address?** Yes. Put the IP (e.g. `192.168.1.10`) in the allowlist; it is matched exactly and ports are ignored. Note the allowlist compares hostnames literally: `localhost` and `127.0.0.1` are two different values — register whichever your `returnUrl` actually uses (or both).

**Q: Beyond sign-in, can I call other InfiniSynapse capabilities as the user?** Yes. Pass `withApiKey: true` during the code exchange to obtain the user's partner API key, then use it to call open APIs such as task creation — see section 5.

**Q: How do I test locally?** Add `localhost` (or an IP such as `127.0.0.1`) to the allowed return domains; `returnUrl` accepts `http://localhost:<port>` / `http://127.0.0.1:<port>`.
