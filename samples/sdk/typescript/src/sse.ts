// 纯函数 SSE 解析器：不做任何 I/O，便于离线单元测试。
// 处理 InfiniSynapse /api/ai/events 的线格式：
//   event: <name>\n
//   data: <json or string>\n
//   \n            <- 空行触发派发
// data 可跨多行，按 SSE 规范用 \n 连接。heartbeat 的 data 是字符串 "ping"。

import type { SseEvent } from "./types.ts";

/** 尝试把 data 解析为 JSON；失败则原样返回字符串（如 "ping"）。 */
export function parseSseData(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  // SSE 里有些实现会给 "ping" 这种裸字符串（heartbeat）。
  if (trimmed[0] !== "{" && trimmed[0] !== "[" && trimmed[0] !== '"') {
    return trimmed;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * 增量 SSE 解析器。喂入任意分片的文本，吐出完整事件。
 * 用法：
 *   const p = new SseParser();
 *   for (const chunk of chunks) for (const ev of p.push(chunk)) handle(ev);
 *   for (const ev of p.flush()) handle(ev); // 流结束时
 */
export class SseParser {
  private buffer = "";
  private eventName = "";
  private dataLines: string[] = [];

  /** 喂入一段文本，返回本次能派发出的完整事件。 */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const out: SseEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      const ev = this.consumeLine(line);
      if (ev) out.push(ev);
    }
    return out;
  }

  /** 流结束时调用，派发缓冲区里最后一个未以空行结尾的事件。 */
  flush(): SseEvent[] {
    const out: SseEvent[] = [];
    if (this.buffer.length > 0) {
      const ev = this.consumeLine(this.buffer);
      this.buffer = "";
      if (ev) out.push(ev);
    }
    const tail = this.dispatch();
    if (tail) out.push(tail);
    return out;
  }

  private consumeLine(line: string): SseEvent | null {
    // 空行 = 事件边界
    if (line === "") return this.dispatch();
    // 注释行（以 : 开头）忽略
    if (line.startsWith(":")) return null;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // 规范：冒号后若有一个空格要去掉
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") {
      this.eventName = value;
    } else if (field === "data") {
      this.dataLines.push(value);
    }
    // id / retry 字段当前不消费
    return null;
  }

  private dispatch(): SseEvent | null {
    if (this.eventName === "" && this.dataLines.length === 0) return null;
    const rawData = this.dataLines.join("\n");
    const ev: SseEvent = {
      event: this.eventName || "message",
      data: parseSseData(rawData),
    };
    this.eventName = "";
    this.dataLines = [];
    return ev;
  }
}

/**
 * 消费一个 fetch ReadableStream（Node 18+ / 浏览器）。
 * onEvent 返回 true 可主动结束（如收到 completion_result）。
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: SseEvent) => boolean | void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const ev of parser.push(text)) {
        if (onEvent(ev) === true) return;
      }
    }
    for (const ev of parser.flush()) {
      if (onEvent(ev) === true) return;
    }
  } finally {
    reader.releaseLock();
  }
}
