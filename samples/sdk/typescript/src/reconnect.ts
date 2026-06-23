// SSE 重连的纯函数部分（退避计算 + 断点续传的消息挑选），无 I/O，可离线测试。
// 编排（真正的重连循环）在 runTask.ts，使用这里的纯函数。

import type { AgentMessage } from "./types.ts";

export interface ReconnectOptions {
  /** 是否启用重连，默认 true。 */
  enabled?: boolean;
  /** 连续失败多少次后放弃，默认 5。收到任意事件会把计数清零。 */
  maxRetries?: number;
  /** 退避基数（毫秒），默认 500。 */
  baseDelayMs?: number;
  /** 退避上限（毫秒），默认 10000。 */
  maxDelayMs?: number;
  /** 多久没有任何事件（含 heartbeat）就判定连接死亡并重连，默认 30000。 */
  heartbeatTimeoutMs?: number;
}

export const DEFAULT_RECONNECT: Required<ReconnectOptions> = {
  enabled: true,
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  heartbeatTimeoutMs: 30000,
};

/** 指数退避（封顶），确定性，便于测试；生产可在外面再加 jitter。 */
export function nextBackoffMs(attempt: number, opts?: { baseMs?: number; maxMs?: number }): number {
  const base = opts?.baseMs ?? DEFAULT_RECONNECT.baseDelayMs;
  const max = opts?.maxMs ?? DEFAULT_RECONNECT.maxDelayMs;
  if (attempt <= 0) return 0;
  const exp = base * 2 ** (attempt - 1);
  return Math.min(max, Math.floor(exp));
}

/** 从 getUiMessageById 的各种可能形状里提取消息数组（容错）。 */
export function extractUiMessages(ui: unknown): AgentMessage[] {
  const pick = (v: unknown): unknown =>
    Array.isArray(v)
      ? v
      : v && typeof v === "object"
        ? ((v as Record<string, unknown>).messages ??
           (v as Record<string, unknown>).uiMessages ??
           (v as Record<string, unknown>).data)
        : undefined;
  let arr = pick(ui);
  if (!Array.isArray(arr)) arr = pick(arr); // 再剥一层 { data: { messages } }
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[]).filter((m): m is AgentMessage => !!m && typeof m === "object");
}

/**
 * 断点续传：从 catch-up 拉回的 UI 消息里，挑出 ts 尚未见过的新消息，按 ts 升序。
 * 已见过的 ts 跳过（最终交付物以 workspace 为准，不追求 finalText 逐字精确）。
 */
export function selectMissedMessages(ui: unknown, seenTs: Set<number>): AgentMessage[] {
  return extractUiMessages(ui)
    .filter((m) => typeof m.ts === "number" && !seenTs.has(m.ts as number))
    .sort((a, b) => (a.ts as number) - (b.ts as number));
}
