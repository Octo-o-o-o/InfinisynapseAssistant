// 反例：直接发任务，没先连 SSE（INF-SSE-001）。
import { post } from "./http";

export async function start(text: string) {
  // 应该先 GET /api/ai/events 再发，这里漏了
  return post("/api/ai/message", { type: "newTask", text });
}
