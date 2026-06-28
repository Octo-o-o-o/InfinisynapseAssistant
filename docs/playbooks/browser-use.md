# Browser Use Playbook

> 特定用法总结：帮产品**决定是否需要 Browser Use**，以及如何在建任务前检查插件、引导安装、处理断连。
> 安装步骤与能力边界见 `infinisynapse-browser-extension` skill 与 `upstream-docs/.../chrome-plugin-install.md`，本文不复述安装细节。

## 一句话规则

只有"需要 AI 操作用户浏览器"的产品才用 Browser Use；建任务前**先查** `GET /api/ai_browser/session`，没连接就引导装插件，别盲目创建网页任务。

## 决策：我的产品需要吗？

| 需要 Browser Use | 不需要 |
| --- | --- |
| 购物比价（看用户正在浏览的商品/搜索页） | 表单输入生成报告（高考助手等） |
| 网页调研 / 多页对比 | 后端文件分析 |
| 自动填写重复表单 | 数据库 / RAG 驱动的报告写作 |
| 从复杂页面提取内容 | 纯 Server API / SDK 集成 |
| 多步网页工作流（登录→搜索→点击） | |

不需要时**不要**强加插件依赖——会平白增加用户安装成本和权限顾虑。

## 产品接入流程

1. 仅当产品需要浏览器上下文时，建任务前调 `GET /api/ai_browser/session`。
2. 看返回的 `status` / `activeSessionCount` 判断插件是否在线；如果返回 `null`、空体或缺字段，统一当作未连接处理。
3. 产品侧要求用户确认：已经在自己的 Chrome 打开并登录目标页面；本次只授权 Agent **只读查看**目标页面/同域必要页面；不得输入第三方账号、密码、验证码、Cookie 或 token。
4. 产品后端保存最小授权快照：`targetUrl`、解析出的 `targetDomain`、`currentPageConfirmed=true`、`readOnlyAcknowledged=true`。不要保存密码、Cookie、localStorage、session token 或截图里的敏感凭据。
5. **未连接** → UI 引导用户安装/启用插件并打开目标页面；**不要**创建需要网页操作的任务。
6. **已连接** → 创建任务（`chatSettings.mode` 用 `act`，或 plan/act 场景先出计划再审批），用 SSE 实时展示候选/风险/建议。
7. 任务执行中插件断开 → 提示用户重连；用户换商品/换目标 → `cancelTask`。

### 自有后端产品的安全入口

前端仍然只调用自家后端。不要在前端直接调用 InfiniSynapse API，也不要把 API Key、Bearer、`/api/ai_browser/session` 直连逻辑放进浏览器 bundle。

如果需要给用户一个"安装/启用插件"入口，优先做成自家后端的受控跳转或帮助页，例如:

```text
Frontend -> GET /v1/browser/extension -> 302 到 InfiniSynapse 控制台/安装页
```

这样前端代码不需要硬编码上游 API 地址或任何密钥相关逻辑，扫描器也能稳定识别为"前端只访问自家后端"。

### 安装入口与离线 fallback

如果产品需要把 Browser Use 作为正式用户路径，安装入口要按“官方优先、离线兜底、可验证来源”设计：

1. **官方商店优先**：首选 Chrome Web Store 或 InfiniSynapse 官方安装页。文案说明“自动更新、来源可验证”，并在新标签页打开，保留当前连接指引页。
2. **非 Chrome 友好提示**：如果当前浏览器不是桌面版 Chrome，明确提示“当前仅支持桌面版 Chrome，请用 Chrome 打开本页安装后再回来检测”，不要让用户误以为产品坏了。
3. **离线 ZIP 只作 fallback**：面向 Chrome Web Store 不可访问的用户，可以在自家可信域名提供官方离线 ZIP；不要从第三方站点、临时对象存储或用户上传链接分发扩展包。
4. **必须可校验**：离线包旁必须展示扩展版本、更新时间、ZIP SHA256（必要时也展示 CRX SHA256）和“没有 Chrome Web Store 自动更新”的提示。更新扩展时同步更新这些元数据。
5. **下载前后都有说明**：下载前就写清 ZIP 方案的限制；点击“下载 ZIP / 打开官方商店 / CRX 原始文件”后，在原页面用 `aria-live` 或等价状态提示显示下一步，不依赖浏览器下载栏。
6. **步骤要完整**：离线 ZIP 的下一步至少包括：下载 ZIP → 解压 → 打开 `chrome://extensions` → 开启“开发者模式” → 点击“加载已解压的扩展程序” → 选择解压目录 → 确认扩展启用 → 回到产品页重新检测。
7. **CRX 只作原始备用**：多数 Chrome 环境会限制直接拖入 CRX 安装；产品文案应推荐 ZIP + 加载已解压目录，CRX 仅给高级用户或排障使用。
8. **下载链接也走自家后端**：前端按钮仍然指向自家后端路由，例如 `/v1/browser/extension`、`/v1/browser/extension/local`、`/v1/browser/extension/crx`，由后端 302 到官方商店或可信对象存储 URL。

离线 fallback 的代价要明说：没有商店自动更新，用户会看到开发者模式提示，安全信任成本更高。因此它只适合“官方域名 + 可校验元数据 + 完整安装说明”的场景。

浏览器验收建议：

- DOM 检查下载前是否可见：官方商店、离线 ZIP、版本、更新时间、SHA256、Chrome-only 提示、安全/隐私边界。
- 逐个点击入口后检查原页面是否出现对应“下一步”说明，尤其是 ZIP 解压和 `chrome://extensions` 步骤。
- 移动宽度检查按钮、SHA 文本和步骤列表不横向溢出。
- 自家后端安装入口可能只实现 `GET`；不要只用 `HEAD` 返回判断成故障。先用 `GET -D - -o /dev/null` 检查鉴权状态、`Location` 或下载响应，再对最终 ZIP/CRX 对象 URL 用 `curl -I -L` 或等价请求确认 HTTP 200、Content-Type、文件大小，并用本地 hash 校验 SHA256。浏览器自动化环境不一定能可靠暴露 download 事件。

部署后浏览器验收建议：

- 用新标签页或无缓存会话打开线上地址，确认 HTML 引用的是本次发布的新 JS/CSS hash；不要只在旧 SPA tab 里点页面，旧内存状态可能掩盖 bundle 或路由问题。
- 分别验证公开入口、登录页、需要 Browser Use 的入口页和安装页；对鉴权页，未登录时应明确跳登录或展示加载/未授权状态，不能只剩导航栏空白。
- 如果产品提供 `/browser`、`/browser/setup` 等别名或 fallback，逐个直接访问，确认 SPA route、后端静态 fallback 和鉴权重定向一致。
- 记录浏览器控制台 error、关键网络状态和当前 URL；Browser Use 真实任务无法无登录态执行时，要把“未验证登录后插件连接/真实网页任务”的边界写清楚。

### Prompt 边界建议

plan 阶段仍然不要调用浏览器。计划文本只说明需要 Browser Use 的原因、目标 URL/域名、登录态风险和不执行的动作。

act 阶段 prompt 应明确:

- 仅可只读查看用户已授权的目标页面和同域必要页面。
- 禁止登录、提交表单、修改、删除、购买、签约、授权、邀请成员、发送消息、公开分享或任何外部写入。
- 遇到二次登录、权限升级、支付/删除/提交/授权弹窗，或跳转到未授权域名，立即停止相关网页操作并写入 limitations。

### 多域名边界

默认授权模型是一个明确的 `targetUrl` / `targetDomain`。不要因为任务里有多个参考链接、竞品链接或证据链接，就默认 Browser Use 可以读取所有域名。

如果产品确实需要跨多个域名做网页研究，先把它当作更高风险流程处理:

1. 在 plan 阶段列出每个拟访问域名、访问目的、是否需要登录态、只读边界和失败兜底。
2. 让用户逐项确认授权；未确认的域名只能通过普通 web/search 或用户上传材料处理。
3. 执行中跳到未授权域名时立即停止 Browser Use，并把该项写入 limitations。
4. 先做小规模 spike 验证 provider 行为、插件状态、跳转和恢复，再把多域名能力作为公开产品承诺。

对大多数报告和尽调产品，P0/P1 应保持单域名 Browser Use；能用 Server API、上传文件、RAG 或普通 web 证据解决时，不要升级为跨域浏览器操作。

## session 返回字段

通常返回 `{ uid, clientId, status, connectedAt, lastActivityAt, browserName, version, activeSessionCount, activeSessionIds }`。`status` 与 `activeSessionCount` 是判断"在线/可用"的主要依据。

实测集成注意：未连接时该接口可能返回 `null`、空体或缺少 `status` 的对象。产品后端要先做空值防御，把这些情况映射为"Browser Use 未连接"，不要直接读取 `session.status`。`status` 为空、`offline`、`disconnected`、`closed`，或 `activeSessionCount` 缺失 / 非数字 / `0` 时，也应 fail-closed，不要创建需要浏览器上下文的任务。

## UX 文案建议

- 明确告诉用户：插件**只在需要网页操作时使用**，AI 会操作你**当前浏览器**。
- 安装入口只在需要 Browser Use 的功能旁出现，不要全局强推。
- 给出"为什么需要"的一句话理由（如"用于读取你正在浏览的商品页做比价"）。
- 展示目标域名和连接状态，让用户知道本次授权范围。
- 把"只读查看"作为独立确认项，不要把它藏在长段说明里。
- 安装页要同时覆盖下载前和下载后：点击官方商店、离线 ZIP、CRX 后，原页面都应给出明确下一步。
- 本地离线包必须展示版本、更新时间和 SHA256；不要只给一个裸下载按钮。

## 常见反模式

- 不查 `session` 直接创建网页任务，结果 Agent 无浏览器可操作、任务空转。
- 假设 `session` 一定是对象，未连接时直接读取 `session.status` 导致 500。
- 给本不需要浏览器的产品（表单报告、后端分析）接 Browser Use。
- 把参考链接、竞品链接或搜索结果都当成已授权浏览器域名。
- 插件断连后不提示用户，任务静默失败。
- 让用户在产品表单里输入第三方网站密码、验证码、Cookie 或 token。
- 在前端 bundle 中硬编码 InfiniSynapse API 地址、API Key、Bearer 或浏览器 session 直连逻辑。
- 面向大陆用户只给 Chrome Web Store 链接，没有官方离线 fallback 或友好解释。
- 提供离线 ZIP/CRX 但不展示版本、更新时间、SHA256、更新限制和开发者模式提示。
- 点击下载后页面没有任何“接下来怎么安装/怎么回到产品检测”的反馈。
- 只用 `HEAD` 检查自家安装入口，忽略该入口只支持 `GET` 或需要登录，误判成扩展下载坏了。
- 部署后只在旧 SPA tab 里验证，没有 fresh tab 检查新 bundle hash 和直达路由，导致 `/browser`、`/browser/setup` 这类入口空白没有被发现。

## 检查清单

- 这个功能真的需要操作用户浏览器吗？（能用 Server API / 上传文件解决就别用插件）
- 建任务前是否查了 `/api/ai_browser/session`？
- 是否保存了最小授权快照（目标 URL/域名 + 只读确认），且没有保存第三方凭据？
- 未连接时是否引导安装、而不是直接建任务？
- 是否向用户说明了插件用途与权限边界？
- 非 Chrome 用户是否看到友好提示，而不是静默失败？
- 离线 fallback 是否只来自官方可信域名，并展示版本、更新时间和 SHA256？
- 下载前后是否都有完整安装步骤，且点击后原页面仍提示如何继续？
- 自家安装入口的 `GET`、重定向、鉴权状态和最终文件 URL 是否都验证过？
- 部署后是否用 fresh tab 验证新 bundle hash、公开页、登录页、Browser Use 入口和未登录重定向？
- plan/act prompt 是否明确只读边界和禁止外部写入？
