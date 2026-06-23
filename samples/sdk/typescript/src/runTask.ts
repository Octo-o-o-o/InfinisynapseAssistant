// 高阶编排：把「先连 SSE → 发 newTask → 驱动到完成 → 读产物」封装成一次调用，
// 并内置 SSE 重连（指数退避 + 心跳看门狗 + getUiMessageById 断点续传）。

import { InfiniSynapseClient, type UploadFile } from "./client.ts";
import { consumeSseStream } from "./sse.ts";
import { TextAccumulator } from "./accumulate.ts";
import {
  DEFAULT_RECONNECT,
  nextBackoffMs,
  selectMissedMessages,
  type ReconnectOptions,
} from "./reconnect.ts";
import type { AgentMessage, NotificationData, SseEvent, TaskWorkspace, ChatSettings } from "./types.ts";

export interface RunTaskOptions {
  text: string;
  /** 不传则自动生成 UUID。建议产品侧自管以便恢复/轮询。 */
  taskId?: string;
  connId?: string;
  chatSettings?: ChatSettings;
  autoApprovalSettings?: unknown;
  /** SSE 重连配置；默认开启。传 { enabled: false } 关闭。 */
  reconnect?: ReconnectOptions;
  /** 每个 SSE 事件回调（产品可转成前端进度）。重连时会额外收到 { event: "reconnect" }。 */
  onEvent?: (ev: SseEvent) => void;
  /** 累积文本片段回调。 */
  onText?: (text: string, message: AgentMessage) => void;
  /**
   * Agent 请求上传文件时调用。返回要上传的文件；返回 null 表示无文件可传。
   * 内部会自动 uploadToSandbox + askResponse 回传结果。
   */
  onUploadRequest?: (message: AgentMessage) => Promise<UploadFile | null> | UploadFile | null;
  /** 外部取消。 */
  signal?: AbortSignal;
}

export interface RunTaskResult {
  taskId: string;
  connId: string;
  /** 完成时累积的全文（仅文本，产物仍需读 workspace）。 */
  finalText: string;
  /** 完成后枚举的工作区产物。 */
  workspace: TaskWorkspace | null;
  status: "completed" | "error" | "aborted";
  /** 经历的 SSE 重连次数。 */
  reconnects: number;
  error?: string;
}

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isCompletion(m: AgentMessage): boolean {
  return m.say === "completion_result" || m.ask === "completion_result";
}
function isUploadAsk(m: AgentMessage): boolean {
  return m.type === "ask" && m.ask === "upload_file_to_sandbox";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * 跑一个完整长任务，内置 SSE 重连。返回完成态 + 工作区产物。
 * 失败经由 result.status 表达，不抛异常（除非首次连接的硬网络错且重连耗尽）。
 */
export async function runTask(client: InfiniSynapseClient, opts: RunTaskOptions): Promise<RunTaskResult> {
  const taskId = opts.taskId ?? uuid();
  const connId = opts.connId ?? uuid();
  const rc = { ...DEFAULT_RECONNECT, ...opts.reconnect };

  const acc = new TextAccumulator();
  const handledAsks = new Set<number>();
  const seenTs = new Set<number>();
  let status: RunTaskResult["status"] = "completed";
  let errorMsg: string | undefined;
  let done = false;
  let taskSent = false;
  let attempt = 0; // 连续失败计数；收到任意事件即清零
  let reconnects = 0;

  async function handleUpload(m: AgentMessage): Promise<void> {
    try {
      const file = opts.onUploadRequest ? await opts.onUploadRequest(m) : null;
      if (file) {
        const uploaded = await client.uploadToSandbox(taskId, file);
        await client.askResponse({ taskId, connId, text: JSON.stringify(uploaded) });
      } else {
        await client.askResponse({ taskId, connId, text: "{}" });
      }
    } catch (e) {
      status = "error";
      errorMsg = `upload handling failed: ${(e as Error).message}`;
      done = true;
    }
  }

  function handleMessage(m: AgentMessage): void {
    if (typeof m.ts === "number") seenTs.add(m.ts);
    if (typeof m.text === "string" && m.text) {
      acc.add(m.text, typeof m.ts === "number" ? m.ts : undefined);
      opts.onText?.(m.text, m);
    }
    if (isUploadAsk(m)) {
      const key = typeof m.ts === "number" ? m.ts : -1;
      if (!handledAsks.has(key)) {
        handledAsks.add(key);
        void handleUpload(m); // 异步处理，不阻塞 SSE 循环
      }
    }
    if (isCompletion(m)) done = true;
  }

  const handleEvent = (ev: SseEvent): boolean => {
    attempt = 0; // 有任何事件就说明连接是活的
    opts.onEvent?.(ev);
    if (ev.event === "notification") {
      const n = ev.data as NotificationData;
      if (n?.type === "error") {
        status = "error";
        errorMsg = n.message || n.title || "task notification error";
        done = true;
        return true;
      }
      return false;
    }
    if (ev.event === "message.add" || ev.event === "message.partial") {
      const m = (ev.data as { message?: AgentMessage })?.message;
      if (m) handleMessage(m);
    }
    return done;
  };

  // 重连循环
  while (!done) {
    if (opts.signal?.aborted) { status = "aborted"; break; }

    const ctrl = new AbortController();
    const onExternalAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onExternalAbort);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let watchdogFired = false;
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => { watchdogFired = true; ctrl.abort(); }, rc.heartbeatTimeoutMs);
    };

    try {
      // 1. 先连 SSE（openEvents 在 HTTP 响应建立后才 resolve，此时 connId 已被服务端订阅）
      const stream = await client.openEvents(connId, ctrl.signal);
      arm();
      // 2. 仅首次：再发 newTask
      if (!taskSent) {
        taskSent = true;
        try {
          await client.newTask({
            text: opts.text,
            taskId,
            connId,
            chatSettings: opts.chatSettings ?? { mode: "act" },
            autoApprovalSettings: opts.autoApprovalSettings,
          });
        } catch (e) {
          status = "error";
          errorMsg = `newTask failed: ${(e as Error).message}`;
          break; // finally 会清理
        }
      }
      // 3. 消费，每个事件重置看门狗
      await consumeSseStream(stream, (ev) => { arm(); return handleEvent(ev); }, ctrl.signal);
    } catch {
      // 连接/流错误 → 落到下面的重连判定
    } finally {
      if (watchdog) clearTimeout(watchdog);
      opts.signal?.removeEventListener("abort", onExternalAbort);
    }

    if (done) break;
    if (opts.signal?.aborted) { status = "aborted"; break; }

    // 流意外结束（关闭 / 看门狗 / 错误）→ 决定是否重连
    if (!rc.enabled) {
      status = "error";
      errorMsg = errorMsg ?? "SSE stream ended before completion (reconnect disabled)";
      break;
    }
    attempt++;
    if (attempt > rc.maxRetries) {
      status = "error";
      errorMsg = errorMsg ?? `SSE reconnect exhausted after ${rc.maxRetries} retries`;
      break;
    }
    reconnects++;
    opts.onEvent?.({ event: "reconnect", data: { attempt, reconnects, reason: watchdogFired ? "heartbeat-timeout" : "stream-ended" } });
    await sleep(nextBackoffMs(attempt, { baseMs: rc.baseDelayMs, maxMs: rc.maxDelayMs }), opts.signal);
    if (opts.signal?.aborted) { status = "aborted"; break; }

    // 4. 断点续传：拉回断线期间错过的消息（按 ts 去重），可顺便发现已完成
    try {
      const ui = await client.getUiMessageById(taskId);
      for (const m of selectMissedMessages(ui, seenTs)) {
        handleMessage(m);
        if (done) break;
      }
    } catch {
      // best effort，拉不到就靠下一次重连继续
    }
  }

  // 5. 读产物（完成才读）
  let workspace: TaskWorkspace | null = null;
  if (status === "completed") {
    try {
      workspace = await client.getTaskWorkspace(taskId);
    } catch (e) {
      errorMsg = errorMsg ?? `workspace read failed: ${(e as Error).message}`;
    }
  }

  return { taskId, connId, finalText: acc.text(), workspace, status, reconnects, error: errorMsg };
}
