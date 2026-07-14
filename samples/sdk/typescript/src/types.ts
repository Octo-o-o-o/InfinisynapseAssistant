// InfiniSynapse Server API 类型定义。
// 事实来源：upstream-docs/infinisynapse-site/zh/markdown/server-api-reference.md
// 这是参考实现，字段以上游文档为准；文档未覆盖的字段标记为可选 / unknown。

/** 区域：决定 Base URL。私有化部署用 custom + baseUrl。 */
export type Region = "cn" | "com";

export interface ClientConfig {
  /** API Key（Bearer Token）。必须只存在服务端。 */
  apiKey: string;
  /** cn=app.infinisynapse.cn，com=app.infinisynapse.com。默认 cn。 */
  region?: Region;
  /** 私有化部署或自定义网关时直接指定，覆盖 region。不带尾部斜杠。 */
  baseUrl?: string;
  /** 账号/市场 API base，默认 https://api.infinisynapse.<region>/api。 */
  accountBaseUrl?: string;
  /** x-lang 头，默认 zh_CN。 */
  lang?: "zh_CN" | "en" | "ar" | "ja" | "ko" | "ru";
  /** 单次请求超时（毫秒），默认 30000。SSE 不受此限制。 */
  timeoutMs?: number;
  /** SSE 响应头建立前的握手超时（毫秒），默认 30000；连接建立后事件流不受此限制。 */
  sseConnectTimeoutMs?: number;
  /** multipart 上传超时（毫秒），默认 120000。 */
  uploadTimeoutMs?: number;
  /** 二进制下载超时（毫秒），默认 300000。 */
  downloadTimeoutMs?: number;
  /** 注入自定义 fetch（测试或代理用）。默认全局 fetch（Node 18+ / 浏览器）。 */
  fetch?: typeof fetch;
}

/** 统一响应信封。下载类端点不走这个结构。 */
export interface Envelope<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PageMeta {
  itemCount: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  field?: string;
  order?: "asc" | "desc";
}

// ---- SSE 事件 ----

export type SseEventName =
  | "message.add"
  | "message.update"
  | "message.partial"
  | "message.remove"
  | "state.ready"
  | "notification"
  | "heartbeat";

/** Agent 消息（message.add / message.partial 里的 data.message）。 */
export interface AgentMessage {
  type?: "say" | "ask";
  text?: string;
  /** completion_result 等完成信号 */
  say?: string;
  /** completion_result / upload_file_to_sandbox 等 */
  ask?: string;
  ts?: number;
  partial?: boolean;
  [k: string]: unknown;
}

export interface SseEvent {
  event: SseEventName | string;
  /** 解析后的 data。heartbeat 时为字符串 "ping"。 */
  data: unknown;
}

export interface NotificationData {
  type: "info" | "success" | "warning" | "error" | string;
  title?: string;
  message?: string;
  duration?: number;
}

// ---- 发消息 ----

export interface ChatSettings {
  mode?: "act" | "plan";
  [k: string]: unknown;
}

export interface NewTaskInput {
  text: string;
  taskId?: string;
  connId?: string;
  images?: unknown[];
  files?: unknown[];
  autoApprovalSettings?: unknown;
  chatSettings?: ChatSettings;
}

export type MessageType =
  | "newTask"
  | "askResponse"
  | "cancelTask"
  | "clearTask"
  | "optionsResponse"
  | "togglePlanActMode"
  | "autoApprovalSettings"
  | "rollbackToSnapshot"
  | "rollbackAndSendMessage"
  | "editFirstMessageAndResend";

export interface MessageBody {
  type: MessageType;
  [k: string]: unknown;
}

// ---- 任务产物 ----

export interface WorkspaceFile {
  /** 相对 cwd 的路径，传给 downloadTaskFile 的 path。 */
  path?: string;
  name?: string;
  size?: number;
  [k: string]: unknown;
}

export interface TaskWorkspace {
  cwd: string;
  files: WorkspaceFile[];
}

export interface PreviewResult {
  content: string;
  fileType: string;
}

/** 浏览器插件会话状态。 */
export interface BrowserSession {
  uid?: string;
  clientId?: string;
  status?: string;
  connectedAt?: string;
  lastActivityAt?: string;
  browserName?: string;
  version?: string;
  activeSessionCount?: number;
  activeSessionIds?: string[];
  [k: string]: unknown;
}
