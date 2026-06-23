// 反例：InfiniSynapse 统一信封成功码是 200 不是 0（INF-API-001）。
// 真实来源：两个消费项目都曾把成功码写成 code===0。
import type { ApiEnvelope } from "./types";

export async function ping(base: string): Promise<unknown> {
  const res = await fetch(`${base}/api/ai/ping`);
  const envelope = (await res.json()) as ApiEnvelope<unknown>;
  if (envelope.code !== 0) {
    // 错：InfiniSynapse 成功是 code === 200，这里会把每个成功响应当成错误
    throw new Error(`api error ${envelope.code}`);
  }
  return envelope.data;
}
