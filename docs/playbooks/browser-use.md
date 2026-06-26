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

实测集成注意：未连接时该接口可能返回 `null`、空体或缺少 `status` 的对象。产品后端要先做空值防御，把这些情况映射为"Browser Use 未连接"，不要直接读取 `session.status`，也不要因此创建需要浏览器上下文的任务。

## UX 文案建议

- 明确告诉用户：插件**只在需要网页操作时使用**，AI 会操作你**当前浏览器**。
- 安装入口只在需要 Browser Use 的功能旁出现，不要全局强推。
- 给出"为什么需要"的一句话理由（如"用于读取你正在浏览的商品页做比价"）。
- 展示目标域名和连接状态，让用户知道本次授权范围。
- 把"只读查看"作为独立确认项，不要把它藏在长段说明里。

## 常见反模式

- 不查 `session` 直接创建网页任务，结果 Agent 无浏览器可操作、任务空转。
- 假设 `session` 一定是对象，未连接时直接读取 `session.status` 导致 500。
- 给本不需要浏览器的产品（表单报告、后端分析）接 Browser Use。
- 把参考链接、竞品链接或搜索结果都当成已授权浏览器域名。
- 插件断连后不提示用户，任务静默失败。
- 让用户在产品表单里输入第三方网站密码、验证码、Cookie 或 token。
- 在前端 bundle 中硬编码 InfiniSynapse API 地址、API Key、Bearer 或浏览器 session 直连逻辑。

## 检查清单

- 这个功能真的需要操作用户浏览器吗？（能用 Server API / 上传文件解决就别用插件）
- 建任务前是否查了 `/api/ai_browser/session`？
- 是否保存了最小授权快照（目标 URL/域名 + 只读确认），且没有保存第三方凭据？
- 未连接时是否引导安装、而不是直接建任务？
- 是否向用户说明了插件用途与权限边界？
- plan/act prompt 是否明确只读边界和禁止外部写入？
