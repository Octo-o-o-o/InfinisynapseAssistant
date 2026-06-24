// InfiniSynapse Server API 客户端（参考实现，零运行时依赖，Node 18+/浏览器）。
// 所有端点对齐 docs/reference/api-index.md。仅服务端使用——不要把本类带 apiKey 打进前端 bundle。

import type {
  ClientConfig,
  Envelope,
  Region,
  NewTaskInput,
  MessageBody,
  Paged,
  PageQuery,
  TaskWorkspace,
  PreviewResult,
  BrowserSession,
} from "./types.ts";

const REGION_BASE: Record<Region, string> = {
  cn: "https://app.infinisynapse.cn",
  com: "https://app.infinisynapse.com",
};
const REGION_ACCOUNT: Record<Region, string> = {
  cn: "https://api.infinisynapse.cn/api",
  com: "https://api.infinisynapse.com/api",
};

/** Token 失效码（文档第 8 节）。 */
export const TOKEN_INVALID_CODES = [1101, 1105];

export interface InfiniSynapseErrorOpts {
  httpStatus?: number;
  code?: number;
  tokenInvalid?: boolean;
  body?: unknown;
}

export class InfiniSynapseError extends Error {
  // 注意：不用构造函数参数属性（Node --experimental-strip-types 不支持），显式赋值。
  readonly opts: InfiniSynapseErrorOpts;
  constructor(message: string, opts: InfiniSynapseErrorOpts = {}) {
    super(message);
    this.name = "InfiniSynapseError";
    this.opts = opts;
  }
}

/** 上传文件的两种传法：直接 Blob，或 { data, filename }。 */
export type UploadFile =
  | Blob
  | { data: BufferSource; filename: string; type?: string };

function toBlobParts(file: UploadFile): { blob: Blob; filename: string } {
  if (file instanceof Blob) {
    const filename = (file as File).name || "file";
    return { blob: file, filename };
  }
  return {
    blob: new Blob([file.data], { type: file.type || "application/octet-stream" }),
    filename: file.filename,
  };
}

export class InfiniSynapseClient {
  readonly baseUrl: string;
  readonly accountBaseUrl: string;
  private readonly apiKey: string;
  private readonly lang: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ClientConfig) {
    if (!config.apiKey) throw new Error("apiKey is required");
    const region: Region = config.region ?? "cn";
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? REGION_BASE[region]).replace(/\/+$/, "");
    this.accountBaseUrl = (config.accountBaseUrl ?? REGION_ACCOUNT[region]).replace(/\/+$/, "");
    this.lang = config.lang ?? "zh_CN";
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) throw new Error("global fetch not found; pass config.fetch (Node 18+ required)");
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, "x-lang": this.lang, ...extra };
  }

  private url(path: string, query?: Record<string, unknown>, account = false): string {
    const base = account ? this.accountBaseUrl : this.baseUrl;
    const u = new URL(base + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  /** 发请求并解包统一信封；抛出 InfiniSynapseError。 */
  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; json?: unknown; account?: boolean } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path, opts.query, opts.account), {
        method,
        headers: this.authHeaders(opts.json !== undefined ? { "Content-Type": "application/json" } : {}),
        body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new InfiniSynapseError(`Non-JSON response from ${path} (HTTP ${res.status})`, {
        httpStatus: res.status,
        body: text.slice(0, 500),
      });
    }

    const env = parsed as Partial<Envelope<T>>;
    const code = env?.code;
    if (typeof code === "number" && TOKEN_INVALID_CODES.includes(code)) {
      throw new InfiniSynapseError(`API Key expired or invalid (code ${code})`, {
        httpStatus: res.status,
        code,
        tokenInvalid: true,
        body: parsed,
      });
    }
    if (!res.ok) {
      const msg = (env?.message as string) || `HTTP ${res.status} from ${path}`;
      throw new InfiniSynapseError(msg, { httpStatus: res.status, code, body: parsed });
    }
    // 文档：仅 code===200 为成功。出现其它业务码（HTTP 仍 200）视为错误，不吞掉。
    if (typeof code === "number" && code !== 200) {
      throw new InfiniSynapseError((env?.message as string) || `business error code ${code}`, {
        httpStatus: res.status,
        code,
        body: parsed,
      });
    }
    // 有信封就解包；某些 /api/ai/message 直接返回 { success: true }（无 code 字段）
    if (env && "data" in env && code === 200) return env.data as T;
    return parsed as T;
  }

  // ---------- AI 对话 ----------

  /**
   * 建立 SSE 连接。返回原始 body 流，交给 consumeSseStream 消费。
   * 注意：必须在 newTask 之前调用。
   */
  async openEvents(connId?: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const res = await this.fetchImpl(this.url("/api/ai/events", connId ? { connId } : undefined), {
      method: "GET",
      headers: this.authHeaders({ Accept: "text/event-stream" }),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new InfiniSynapseError(`Failed to open SSE (HTTP ${res.status})`, { httpStatus: res.status });
    }
    return res.body;
  }

  sendMessage(body: MessageBody): Promise<{ success?: boolean; [k: string]: unknown }> {
    return this.request("POST", "/api/ai/message", { json: body });
  }

  newTask(input: NewTaskInput): Promise<{ success?: boolean; state?: unknown; [k: string]: unknown }> {
    return this.sendMessage({ type: "newTask", ...input });
  }

  askResponse(args: {
    taskId: string;
    text?: string;
    connId?: string;
    askResponse?: string;
    images?: unknown[];
    files?: unknown[];
  }): Promise<{ success?: boolean }> {
    return this.sendMessage({ askResponse: "messageResponse", ...args, type: "askResponse" });
  }

  /** 取消任务。优先走 /api/ai/message；旧部署不可用时再回退到旧 Query 入口。 */
  async cancelTask(taskId: string): Promise<unknown> {
    try {
      return await this.sendMessage({ type: "cancelTask", taskId });
    } catch (error) {
      const status = error instanceof InfiniSynapseError ? error.opts.httpStatus : undefined;
      if (status === 404 || status === 405 || status === 501) {
        return this.request("GET", "/api/ai_task/cancelTask", { query: { taskId } });
      }
      throw error;
    }
  }

  getState(taskId?: string): Promise<unknown> {
    return this.request("GET", "/api/ai/state", { query: taskId ? { taskId } : undefined });
  }

  ping(): Promise<{ ok: boolean }> {
    return this.request("GET", "/api/ai/ping");
  }

  /** 浏览器插件会话状态；购物/网页研究类产品在建任务前检查。 */
  browserSession(): Promise<BrowserSession> {
    return this.request("GET", "/api/ai_browser/session");
  }

  // ---------- 任务管理 ----------

  listTasks(query: PageQuery & Record<string, unknown> = {}): Promise<Paged<unknown>> {
    return this.request("GET", "/api/ai_task/list", { query });
  }

  getTask(taskId: string): Promise<unknown> {
    return this.request("GET", "/api/ai_task/tasks", { query: { taskId } });
  }

  /** 恢复进度首选：瘦身后的 UI 消息列表。 */
  getUiMessageById(id: string): Promise<unknown> {
    return this.request("GET", "/api/ai_task/getUiMessageById", { query: { id } });
  }

  /** 发现产物首选：工作目录 + 文件列表。 */
  getTaskWorkspace(taskId: string): Promise<TaskWorkspace> {
    return this.request("GET", `/api/ai_task/getTaskWorkspace/${encodeURIComponent(taskId)}`);
  }

  previewFile(taskId: string, fileName: string): Promise<PreviewResult> {
    return this.request("POST", "/api/ai_task/previewFile", { json: { taskId, fileName } });
  }

  // ---------- 数据源 / RAG（任务前启用）----------

  listDatabases(query: PageQuery & Record<string, unknown> = {}): Promise<Paged<unknown>> {
    return this.request("GET", "/api/ai_database/list", { query });
  }

  setDatabasesEnabled(ids: number[], enabled: 0 | 1): Promise<unknown> {
    return this.request("POST", "/api/ai_database/enabled", { json: { ids, enabled } });
  }

  listRags(query: PageQuery & Record<string, unknown> = {}): Promise<Paged<unknown>> {
    return this.request("GET", "/api/ai_rag_sdk", { query });
  }

  setRagsEnabled(ids: Array<string | number>, enabled: 0 | 1): Promise<unknown> {
    return this.request("POST", "/api/ai_rag_sdk/enabled", { json: { ids, enabled } });
  }

  // ---------- 上传（区分两类）----------

  /** 被动：响应 Agent 的 upload_file_to_sandbox 请求。 */
  async uploadToSandbox(taskId: string, file: UploadFile): Promise<unknown> {
    return this.multipart("/api/ai/upload", file, { query: { taskId } });
  }

  /** 主动：把资料归档到任务工作区固定子目录。 */
  async taskUpload(
    taskId: string,
    file: UploadFile,
    opts: { subdir?: string; naming?: "original" | "hash" } = {},
  ): Promise<{ filename: string; assetId?: string; logicalPath?: string; name?: string; size?: number }> {
    return this.multipart(`/api/tools/taskUpload/${encodeURIComponent(taskId)}`, file, {
      query: { subdir: opts.subdir ?? "upload_documents", naming: opts.naming ?? "original" },
    });
  }

  /** 通用目录上传。 */
  async upload(directory: string, file: UploadFile): Promise<{ filename: string }> {
    return this.multipart(`/api/upload/${encodeURIComponent(directory)}`, file);
  }

  private async multipart<T>(
    path: string,
    file: UploadFile,
    opts: { query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const { blob, filename } = toBlobParts(file);
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await this.fetchImpl(this.url(path, opts.query), {
      method: "POST",
      headers: this.authHeaders(), // 不设 Content-Type，让 fetch 自带 boundary
      body: form,
    });
    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new InfiniSynapseError(`Non-JSON upload response (HTTP ${res.status})`, { httpStatus: res.status });
    }
    const env = parsed as Partial<Envelope<T>>;
    if (!res.ok) {
      throw new InfiniSynapseError((env?.message as string) || `Upload failed HTTP ${res.status}`, {
        httpStatus: res.status,
        code: env?.code,
        body: parsed,
      });
    }
    return (env && "data" in env ? env.data : parsed) as T;
  }

  // ---------- 下载（二进制，不走信封）----------

  /** 下载任务工作目录中的文件，返回原始字节。inline 仅影响响应头。 */
  async downloadTaskFile(taskId: string, path: string, inline = false): Promise<Uint8Array> {
    return this.downloadBinary(`/api/tools/storage/downloadTaskFile/${encodeURIComponent(taskId)}`, {
      path,
      ...(inline ? { inline: 1 } : {}),
    });
  }

  /** 下载整个任务目录 ZIP。 */
  async downloadZip(taskId: string): Promise<Uint8Array> {
    return this.downloadBinary("/api/ai_task/downloadZip", { taskId });
  }

  private async downloadBinary(path: string, query?: Record<string, unknown>): Promise<Uint8Array> {
    const res = await this.fetchImpl(this.url(path, query), {
      method: "GET",
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new InfiniSynapseError(`Download failed HTTP ${res.status} from ${path}`, { httpStatus: res.status });
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
