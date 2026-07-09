// server.mjs 的类型声明（供 TS SDK 的 typecheck / 下游 TS 项目使用）。
export interface MockServerOptions {
  /** 监听端口；0 或缺省 = 随机端口。 */
  port?: number;
  /** SSE 心跳间隔毫秒，默认 15000。 */
  heartbeatMs?: number;
  /** 场景事件之间的延迟毫秒，默认 25；测试可调小。 */
  stepDelayMs?: number;
}

export interface MockTask {
  taskId: string;
  connId?: string;
  ts: number;
  messages: Array<Record<string, unknown>>;
  files: Map<string, Buffer>;
  status: "running" | "completed" | "error" | "cancelled";
  awaitingUpload: boolean;
}

export interface MockServerHandle {
  port: number;
  url: string;
  tasks: Map<string, MockTask>;
  close(): Promise<void>;
}

export function startMockServer(options?: MockServerOptions): Promise<MockServerHandle>;
