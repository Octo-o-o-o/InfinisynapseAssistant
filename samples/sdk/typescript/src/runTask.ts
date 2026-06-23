// 高阶编排：把「先连 SSE → 发 newTask → 驱动到完成 → 读产物」封装成一次调用。
// 这是产品后端最常用的入口。它强制执行长任务铁律的顺序。

import { InfiniSynapseClient, type UploadFile } from "./client.ts";
import { consumeSseStream } from "./sse.ts";
import { TextAccumulator } from "./accumulate.ts";
import type { AgentMessage, NotificationData, SseEvent, TaskWorkspace, ChatSettings } from "./types.ts";

export interface RunTaskOptions {
  text: string;
  /** 不传则自动生成 UUID。建议产品侧自管以便恢复/轮询。 */
  taskId?: string;
  connId?: string;
  chatSettings?: ChatSettings;
  autoApprovalSettings?: unknown;
  /** 等待 state.ready 的超时（毫秒），超时也继续发 newTask。默认 3000。 */
  readyTimeoutMs?: number;
  /** 每个 SSE 事件回调（产品可转成前端进度）。 */
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
  error?: string;
}

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // 极简兜底（非加密强度），仅用于没有 crypto 的环境
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

/**
 * 跑一个完整长任务。返回完成态 + 工作区产物。
 * 失败抛出原因经由 result.status==="error" 表达，不抛异常（除非网络层硬错）。
 */
export async function runTask(client: InfiniSynapseClient, opts: RunTaskOptions): Promise<RunTaskResult> {
  const taskId = opts.taskId ?? uuid();
  const connId = opts.connId ?? uuid();
  const acc = new TextAccumulator();
  const handledAsks = new Set<number>();
  let status: RunTaskResult["status"] = "completed";
  let errorMsg: string | undefined;

  // 1. 先建立 SSE
  const stream = await client.openEvents(connId, opts.signal);

  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  let ready = false;
  let resolveReady!: () => void;
  const readyP = new Promise<void>((r) => (resolveReady = r));

  const handle = (ev: SseEvent): boolean => {
    opts.onEvent?.(ev);
    if (ev.event === "state.ready") {
      if (!ready) {
        ready = true;
        resolveReady();
      }
      return false;
    }
    if (ev.event === "notification") {
      const n = ev.data as NotificationData;
      if (n?.type === "error") {
        status = "error";
        errorMsg = n.message || n.title || "task notification error";
        resolveDone();
        return true;
      }
      return false;
    }
    if (ev.event === "message.add" || ev.event === "message.partial") {
      const wrap = ev.data as { taskId?: string; message?: AgentMessage };
      const m = wrap?.message;
      if (!m) return false;
      if (typeof m.text === "string" && m.text) {
        // 按 ts 累积，避免服务端发累积快照时重复拼接
        acc.add(m.text, typeof m.ts === "number" ? m.ts : undefined);
        opts.onText?.(m.text, m);
      }
      if (isUploadAsk(m)) {
        // 同一上传请求只处理一次（partial 分片会重复到达）
        const key = typeof m.ts === "number" ? m.ts : -1;
        if (!handledAsks.has(key)) {
          handledAsks.add(key);
          void handleUpload(m); // 异步处理上传，不阻塞 SSE 循环
        }
      }
      if (isCompletion(m)) {
        status = status === "error" ? "error" : "completed";
        resolveDone();
        return true;
      }
    }
    return false;
  };

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
      resolveDone();
    }
  }

  // 后台消费 SSE
  const consume = consumeSseStream(stream, handle, opts.signal)
    .catch((e) => {
      if (!opts.signal?.aborted) {
        status = "error";
        errorMsg = errorMsg ?? `sse stream error: ${(e as Error).message}`;
      }
    })
    .finally(() => resolveDone());

  // 2. 等 state.ready 或超时后发 newTask
  const readyTimeout = new Promise<void>((r) => setTimeout(r, opts.readyTimeoutMs ?? 3000));
  await Promise.race([readyP, readyTimeout]);

  if (opts.signal?.aborted) {
    return { taskId, connId, finalText: acc.text(), workspace: null, status: "aborted" };
  }

  // 3. 发 newTask（带同一 connId）
  await client.newTask({
    text: opts.text,
    taskId,
    connId,
    chatSettings: opts.chatSettings ?? { mode: "act" },
    autoApprovalSettings: opts.autoApprovalSettings,
  });

  // 4. 等待完成 / 错误 / 取消
  await done;
  await consume;

  if (opts.signal?.aborted) status = "aborted";

  // 5. 读产物（完成才读）
  let workspace: TaskWorkspace | null = null;
  if (status === "completed") {
    try {
      workspace = await client.getTaskWorkspace(taskId);
    } catch (e) {
      // 产物读取失败不改写任务完成态，只记录
      errorMsg = errorMsg ?? `workspace read failed: ${(e as Error).message}`;
    }
  }

  return { taskId, connId, finalText: acc.text(), workspace, status, error: errorMsg };
}
