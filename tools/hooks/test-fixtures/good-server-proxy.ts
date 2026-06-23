// 正例：后端代理。API Key 来自环境变量；先连 SSE 再发任务；端点写法正确。
import { InfiniSynapseClient } from "infinisynapse-sdk-reference";

const ENDPOINTS = { events: "/api/ai/events", message: "/api/ai/message" };
const client = new InfiniSynapseClient({
  apiKey: process.env.INFINISYNAPSE_API_KEY!,
  region: "cn",
});

export async function start(text: string, connId: string) {
  const stream = await client.openEvents(connId); // 1. 先连 SSE (ENDPOINTS.events)
  await client.newTask({ text, connId }); // 2. 再发任务 (ENDPOINTS.message)
  return stream;
}
