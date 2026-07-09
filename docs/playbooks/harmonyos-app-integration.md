# 鸿蒙（HarmonyOS）App 集成 Playbook

> 特定用法总结：HarmonyOS NEXT / ArkTS 应用如何安全、稳定地接入 InfiniSynapse 长任务能力。
> InfiniSynapse 端点与时序事实以 `docs/reference/api-index.md`、`docs/reference/task-lifecycle.md` 为准；鸿蒙 API 以华为开发者官网（Network Kit、Remote Communication Kit、Asset Store Kit）为准，本文标注的鸿蒙 API 行为需在 DevEco Studio 实际工程中验证。

## 一句话规则

鸿蒙 app 与 Web 前端同级：**默认不持 InfiniSynapse API Key、不直连 InfiniSynapse**，只调用自有后端；SSE 进度由自有后端转发，长任务生命周期由后端 worker 托管，app 只负责展示、恢复和用户交互。

## 架构决策

| 产品形态 | 架构 | 说明 |
| --- | --- | --- |
| 面向多用户的鸿蒙 app（默认） | app → 自有后端（持 Key）→ InfiniSynapse | 与 `secure-integration.md` 完全一致；Key 进 app 包 = 泄露 |
| 单用户个人工具、用户填自己的 Key（BYOK） | app 内可信原生层持 Key，UI 层不可读 | 有条件适用；Key 必须存 **Asset Store Kit**（`@ohos.security.asset`，鸿蒙的 Keychain 等价物），不能放 Preferences、明文文件、AppStorage 或硬编码。边界判断复用 `desktop-native-byok.md` |
| 企业分发、团队共享 Key、需要计费/审计 | 必须走服务端业务路由 | 不适用 BYOK |

判断方法：把 `desktop-native-byok.md` 的"信任边界"表里 renderer/WebView 替换成 ArkUI 页面与 ArkWeb，结论不变。

## SSE 进度消费（app ↔ 自有后端）

自有后端按 `task-lifecycle.md` 的标准时序对接 InfiniSynapse（先 SSE 再 `newTask`），再把进度以 SSE 或轮询暴露给 app。鸿蒙侧消费 SSE 的可用方式：

- **`@ohos.net.http` 的 `requestInStream`**（基础方案）：`on('headersReceive')` + `on('dataReceive')` 收 `ArrayBuffer` 分块，用 `util.TextDecoder` 解码后按 SSE 协议逐行解析。原生 `EventSource` 风格 API 不支持自定义 header / POST，聊天类产品普遍用该方式自行封装。
- **Remote Communication Kit（`rcp`）**：`session.downloadToStream` 提供 `WriteStream` 回调式流式下载，可作为替代；需要请求跟踪、打点时优先考虑。
- **降级方案**：弱网或旧 API 版本可退化为轮询自有后端的任务状态接口（后端从 `getUiMessageById` 归一化）。

解析与状态推进规则与 Web 端相同（见 `task-lifecycle.md`）：按 `taskId` 过滤事件、`message.partial` 按 `ts` 覆盖合并、`heartbeat` 仅保活、`notification.type==='error'` 即失败、完成判 `message.say/ask==='completion_result'`。

### 最小 ArkTS SSE 客户端参考（需 DevEco 验证）

解析逻辑与 `samples/sdk/typescript/src/sse.ts`（已有离线单测）一致，只是把网络层换成鸿蒙 API：

```typescript
// SseClient.ets —— 消费自有后端转发的 SSE（不要直连 InfiniSynapse）
import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';

export interface SseEvent { event: string; data: string; }

export class SseClient {
  private httpRequest = http.createHttp();
  private buffer = '';
  private decoder = util.TextDecoder.create('utf-8');

  connect(url: string, token: string, onEvent: (ev: SseEvent) => void,
          onError: (err: Error) => void, onComplete: () => void): void {
    this.httpRequest.on('dataReceive', (chunk: ArrayBuffer) => {
      this.buffer += this.decoder.decodeToString(new Uint8Array(chunk), { stream: true });
      this.drain(onEvent);
    });
    this.httpRequest.requestInStream(url, {
      method: http.RequestMethod.GET,
      header: {
        // token 是自有后端的业务会话凭证，不是 InfiniSynapse API Key
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      readTimeout: 0, // SSE 长连接不设读超时；死连接靠心跳看门狗判定
    }).then(() => onComplete()).catch((err: Error) => onError(err));
  }

  private drain(onEvent: (ev: SseEvent) => void): void {
    let idx = this.buffer.indexOf('\n\n');
    while (idx >= 0) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length) onEvent({ event, data: dataLines.join('\n') });
      idx = this.buffer.indexOf('\n\n');
    }
  }

  close(): void { this.httpRequest.destroy(); }
}
```

注意事项：

- `module.json5` 需声明 `ohos.permission.INTERNET`；生产必须 HTTPS。
- 多行 `data:` 要拼接（上例已处理）；不要只解析 `data:` 而丢 `event:`。
- 断线重连带同一业务任务 ID，重连后由后端用 `getUiMessageById` 补齐错过的消息（对齐 `task-lifecycle.md` 的健壮性清单）。

## 生命周期与恢复（鸿蒙特有约束）

- **切后台/被系统回收不等于任务失败**。长任务在 InfiniSynapse + 自有后端 worker 侧继续运行；app 回到前台或冷启动后，用业务任务 ID 向自有后端恢复（后端读 `getUiMessageById` + `getTaskWorkspace`）。
- 不要为了"保住 SSE"申请长时后台任务（continuous task）；进度推送产品化时用后端 + Push Kit 通知，而不是 app 常驻连接。
- 页面 `aboutToDisappear` / abilities 销毁时 `httpRequest.destroy()` 释放连接，避免泄漏。
- 用户主动取消：app 调自有后端 → 后端 `POST /api/ai/message` `type=cancelTask`，并在业务库标记状态。

## 文件上传与产物下载

- 上传：`@ohos.file.picker` 选文件 → multipart 上传到**自有后端** → 后端按场景转发 `taskUpload`（主动归档）或 `/api/ai/upload`（响应 Agent 的 `upload_file_to_sandbox`）。两类上传的区分见 `rag-file-placement.md`。
- 下载/预览：后端从 `downloadTaskFile` 拿到的是**二进制流**，转发给 app 后用 `@ohos.file.fs` 保存，PDF/图片可交给系统预览能力；不要在任何一层按 `{code,message,data}` 解析下载响应。
- 大文件用流式写入（`rcp` `downloadToStream` 或分块写 fd），并设字节预算，避免整包读进内存。

## Browser Use 边界（诚实声明）

Browser Use 依赖**桌面 Chrome 扩展**，鸿蒙 app 内没有页内浏览器自动化能力。若产品需要购物比价等浏览器任务：插件装在用户桌面 Chrome 上，任务可由 app 发起，但建任务前必须由后端查 `GET /api/ai_browser/session`，未连接时 fail-closed 并引导用户到桌面端安装（见 `browser-use.md`）。不要向鸿蒙用户承诺"手机上 AI 替你逛淘宝"这类当前实现不了的体验。

## 质量清单（发版前逐项过）

- [ ] 全包搜不到 InfiniSynapse API Key、`app.infinisynapse.cn` 直连（BYOK 形态除外，且 Key 只在 Asset Store Kit）
- [ ] 先连 SSE 再发任务的顺序由后端保证；app 不参与该时序
- [ ] `message.partial` 按 `ts` 覆盖合并，打字机 UI 不重复拼接
- [ ] 断网/切后台/杀进程三种场景都能恢复到正确任务状态
- [ ] 错误面完整：Key 失效（1101/1105）、参数 422、余额不足、SSE 断线各有用户可懂的提示
- [ ] 取消可用且业务库状态一致
- [ ] 产物下载按二进制处理，大文件不整包进内存
- [ ] 弱网下轮询降级可用
- [ ] 扫描器通过：`npm run scan -- <file>.ets` 无 HIGH（`INF-SEC-002` 已覆盖 ArkTS 直连检测）

app 整体功能验证与评估方法见 `testing-and-evaluation.md`。

## 常见反模式

- 把 API Key 写进 ArkTS 源码、`rawfile`、Preferences 或 AppStorage（会进 hap 包）。
- app 直连 `app.infinisynapse.cn`：Key 泄露 + 无法做业务鉴权/限流/恢复。
- 用原生 `EventSource` 试图带自定义 header 或发 POST（不支持，需 `requestInStream` 封装）。
- 靠 app 常驻后台保住 SSE 连接来"完成"长任务。
- 只解析 `data:` 行、丢 `event:` 类型，把 `heartbeat` 当业务消息。
- 向用户承诺鸿蒙端页内 Browser Use。
