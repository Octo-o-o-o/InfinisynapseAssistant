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
3. **未连接** → UI 引导用户安装插件（两条安装路径见 skill）并打开目标页面；**不要**创建需要网页操作的任务。
4. **已连接** → 创建任务（`chatSettings.mode` 用 `act`），用 SSE 实时展示候选/风险/建议。
5. 任务执行中插件断开 → 提示用户重连；用户换商品/换目标 → `cancelTask`。

## session 返回字段

通常返回 `{ uid, clientId, status, connectedAt, lastActivityAt, browserName, version, activeSessionCount, activeSessionIds }`。`status` 与 `activeSessionCount` 是判断"在线/可用"的主要依据。

实测集成注意：未连接时该接口可能返回 `null`、空体或缺少 `status` 的对象。产品后端要先做空值防御，把这些情况映射为"Browser Use 未连接"，不要直接读取 `session.status`，也不要因此创建需要浏览器上下文的任务。

## UX 文案建议

- 明确告诉用户：插件**只在需要网页操作时使用**，AI 会操作你**当前浏览器**。
- 安装入口只在需要 Browser Use 的功能旁出现，不要全局强推。
- 给出"为什么需要"的一句话理由（如"用于读取你正在浏览的商品页做比价"）。

## 常见反模式

- 不查 `session` 直接创建网页任务，结果 Agent 无浏览器可操作、任务空转。
- 假设 `session` 一定是对象，未连接时直接读取 `session.status` 导致 500。
- 给本不需要浏览器的产品（表单报告、后端分析）接 Browser Use。
- 插件断连后不提示用户，任务静默失败。

## 检查清单

- 这个功能真的需要操作用户浏览器吗？（能用 Server API / 上传文件解决就别用插件）
- 建任务前是否查了 `/api/ai_browser/session`？
- 未连接时是否引导安装、而不是直接建任务？
- 是否向用户说明了插件用途与权限边界？
