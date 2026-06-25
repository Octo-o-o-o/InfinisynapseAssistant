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
