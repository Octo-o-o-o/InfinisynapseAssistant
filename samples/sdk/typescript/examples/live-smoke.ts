// 真实 API 冒烟（opt-in，不进 npm test）。
// 用途：拿到真实 API Key 后验证账号、SSE、长任务链路和 workspace 产物读取端到端可用。
// 会创建一个真实任务并产生真实计费/额度消耗；任务会出现在 https://app.infinisynapse.cn/tasks 的 ALL TASKS。
//
// 运行：
//   INFINISYNAPSE_API_KEY=sk-xxx node --experimental-strip-types examples/live-smoke.ts
// 可选：
//   INFINISYNAPSE_BASE_URL=https://app.infinisynapse.com   # 海外或私有化部署地址
//   SMOKE_PROMPT="..."                                     # 自定义冒烟任务（默认极小任务）
//   SMOKE_TIMEOUT_MS=300000                                # 业务总超时（默认 5 分钟）

import { InfiniSynapseClient } from "../src/client.ts";
import { runTask } from "../src/runTask.ts";

const apiKey = process.env.INFINISYNAPSE_API_KEY;
if (!apiKey) {
  console.error("缺少 INFINISYNAPSE_API_KEY。live smoke 是 opt-in 的真实调用（会计费），离线测试请用 npm test。");
  process.exit(2);
}

const client = new InfiniSynapseClient({
  apiKey,
  baseUrl: process.env.INFINISYNAPSE_BASE_URL,
});

const prompt =
  process.env.SMOKE_PROMPT ??
  "这是一次接入冒烟测试。请不要联网搜索，直接在任务工作区创建 smoke.txt（内容为 ok），然后简短回复完成。";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 300000);

const started = Date.now();
console.log("1/4 ping…");
console.log("    ", await client.ping());

console.log("2/4 运行最小长任务（先连 SSE 再 newTask，由 runTask 编排）…");
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), timeoutMs);
const result = await runTask(client, {
  text: prompt,
  signal: abort.signal,
  onEvent: (ev) => {
    if (ev.event === "reconnect") console.log("     [reconnect]", ev.data);
  },
  onText: (t) => process.stdout.write(`     ${t.slice(0, 80).replaceAll("\n", " ")}\r`),
});
clearTimeout(timer);
process.stdout.write("\n");

console.log(`    status=${result.status} reconnects=${result.reconnects} elapsed=${Math.round((Date.now() - started) / 1000)}s`);
if (result.status !== "completed") {
  console.error(`    失败: ${result.error ?? "unknown"}`);
  process.exit(1);
}

console.log("3/4 读取 workspace 产物…");
const files = (result.workspace?.files ?? []).map((f) =>
  typeof f === "string" ? f : ((f as { path?: string; name?: string }).path ?? (f as { name?: string }).name ?? String(f)),
);
console.log("    ", files.length ? files.join(", ") : "(空)");

console.log("4/4 预览 + 二进制下载抽样…");
const target = files.find((f) => f.endsWith("smoke.txt")) ?? files[0];
if (target) {
  const preview = await client.previewFile(result.taskId, target);
  console.log(`     preview ${target}: ${String(preview.content ?? "").slice(0, 60)}`);
  const bytes = await client.downloadTaskFile(result.taskId, target);
  console.log(`     download ${target}: ${bytes.byteLength} bytes（二进制流按字节处理，未按 JSON 解析）`);
} else {
  console.warn("     workspace 无文件可抽样；请到 /tasks 控制台人工检查该任务");
}

console.log(`smoke 通过。taskId=${result.taskId}（可在 /tasks 的 ALL TASKS 回看）`);
