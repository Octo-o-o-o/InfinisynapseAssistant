---
name: infinisynapse-browser-extension
description: |
  InfiniSynapse Browser Use / Chrome Extension 安装、联调、产品侧连接检查。
  激活条件:
    - 用户提到 Browser Use、Chrome 插件、浏览器自动化、网页采集、表单自动填写
    - 产品需要 AI 操作网页或读取用户浏览器上下文
---

# InfiniSynapse Browser Use

先读:

- `docs/playbooks/browser-use.md`（是否需要 Browser Use + 产品接入流程 + UX）
- `upstream-docs/infinisynapse-site/zh/markdown/chrome-plugin-install.md`
- `upstream-docs/infinisynapse-site/markdown/chrome-plugin-install.md` 作为英文补充参考
- `.agents/skills/infinisynapse-server-api/SKILL.md`

## 能力边界

Browser Use 让 AI 像用户一样操作浏览器，可用于:

- 批量抓取网页信息
- 自动填写重复表单
- 从复杂页面提取内容
- 多步骤网页工作流，例如登录、搜索、点击

## 安装路径

官方文档给了两种方式:

1. 从产品首页 `https://app.infinisynapse.cn/tasks` 点击 Install Browser Extension，下载 CRX 并安装。
2. 从官网 `https://www.infinisynapse.cn/` 下载 Chrome Extension。

本地截图镜像在:

```text
upstream-docs/infinisynapse-site/assets/chromePluginInstall/
```

## 产品安装页要求

当下游产品自己做 Browser Use 安装/连接页时，默认采用:

- 官方商店或 InfiniSynapse 官方安装页作为首选入口。
- 非桌面版 Chrome 时显示友好提示：当前仅支持桌面版 Chrome，提示用户用 Chrome 打开本页后再检测连接。
- 面向 Chrome Web Store 不可访问用户的离线 ZIP fallback，只能放在自家可信域名或官方可信域名。
- 离线包旁展示版本、更新时间、ZIP SHA256（必要时也展示 CRX SHA256），并明确没有商店自动更新、会看到开发者模式提示。
- 下载前说明安装方式差异；点击官方商店、下载 ZIP、CRX 后，原页面要显示对应“下一步”说明，不能只依赖浏览器下载栏。
- ZIP 下一步必须完整写出：下载 ZIP、解压、打开 `chrome://extensions`、开启“开发者模式”、点击“加载已解压的扩展程序”、选择解压目录、确认启用、回到产品页重新检测。
- CRX 只作为原始备用；多数 Chrome 环境推荐 ZIP + 加载已解压目录。
- 前端按钮仍指向自家后端受控跳转路由，由后端 302 到官方商店或可信对象存储 URL，不把上游 API Key 或 Bearer 放进浏览器。

验收时至少检查: 下载前 DOM 文案、点击后状态提示、移动宽度无横向溢出、ZIP/CRX URL 的 HTTP 状态/Content-Type/大小和 SHA256。

## 产品侧接入

需要浏览器上下文的产品，创建任务前检查:

```text
GET /api/ai_browser/session
```

如果未连接:

- 不要直接创建需要浏览器操作的任务。
- 引导用户安装插件并打开目标浏览器页面。
- UI 文案应说明插件只在需要网页操作时使用。

注意: `GET /api/ai_browser/session` 在未连接时可能返回 `null`、空体或缺少 `status` 的对象。产品后端必须先做空值防御，把这些情况当作未连接；不要直接读取 `session.status`。

## 不需要插件的场景

- 表单输入生成报告
- 后端文件分析
- 数据库/RAG 驱动的报告写作
- 纯 Server API SDK 集成
