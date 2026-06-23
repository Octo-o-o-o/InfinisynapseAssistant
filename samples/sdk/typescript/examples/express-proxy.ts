// 服务端代理路由示例（后端代理架构的最小骨架）。
// 前端只和本后端通信；本后端持有 API Key 并代理 InfiniSynapse。
//
// 运行：npm i express && node --experimental-strip-types examples/express-proxy.ts
// 环境变量：INFINISYNAPSE_API_KEY=<server-only key>
//
// 这是教学骨架：生产里请把内存 Map 换成数据库，并加鉴权/限流/审计。

import express from "express";
import { InfiniSynapseClient, runTask } from "../src/index.ts";
import type { RunTaskResult, SseEvent } from "../src/index.ts";

const apiKey = process.env.INFINISYNAPSE_API_KEY;
if (!apiKey) throw new Error("set INFINISYNAPSE_API_KEY (server-side only)");

const client = new InfiniSynapseClient({ apiKey, region: "cn" });
const app = express();
app.use(express.json());

// 业务任务表（生产换成 DB）：保存 taskId/connId/状态/产物路径。
interface BizTask {
  businessTaskId: string;
  taskId?: string;
  connId?: string;
  status: "pending" | "running" | "completed" | "error" | "aborted";
  userInput: string;
  events: SseEvent[]; // 简化：缓存事件供前端 SSE 拉取
  result?: RunTaskResult;
  error?: string;
}
const tasks = new Map<string, BizTask>();
let seq = 0;

// 1) 前端提交业务表单 → 后端建任务（异步驱动）
app.post("/api/my-feature/start", async (req, res) => {
  const businessTaskId = `biz-${++seq}`;
  const userInput = String(req.body?.text ?? "");
  const row: BizTask = { businessTaskId, status: "running", userInput, events: [] };
  tasks.set(businessTaskId, row);

  // 不阻塞 HTTP 响应：后台跑长任务
  void runTask(client, {
    text: userInput,
    onEvent: (ev) => row.events.push(ev),
  })
    .then((result) => {
      row.taskId = result.taskId;
      row.connId = result.connId;
      row.status = result.status;
      row.result = result;
      row.error = result.error;
    })
    .catch((e) => {
      row.status = "error";
      row.error = (e as Error).message;
    });

  res.json({ businessTaskId });
});

// 2) 前端用 SSE 拉取进度（后端把缓存事件转发给前端；生产建议直接桥接 client.openEvents）
app.get("/api/my-feature/:id/events", (req, res) => {
  const row = tasks.get(req.params.id);
  if (!row) return res.status(404).end();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  let i = 0;
  const timer = setInterval(() => {
    while (i < row.events.length) {
      const ev = row.events[i++];
      res.write(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`);
    }
    if (row.status !== "running") {
      res.write(`event: done\ndata: ${JSON.stringify({ status: row.status })}\n\n`);
      clearInterval(timer);
      res.end();
    }
  }, 300);
  req.on("close", () => clearInterval(timer));
});

// 3) 前端读最终产物（来自 task workspace，不是只读最后一条文本）
app.get("/api/my-feature/:id/result", async (req, res) => {
  const row = tasks.get(req.params.id);
  if (!row) return res.status(404).end();
  res.json({
    status: row.status,
    finalText: row.result?.finalText ?? "",
    workspace: row.result?.workspace ?? null,
    error: row.error,
  });
});

// 4) 下载某个产物（二进制透传，不当 JSON）
app.get("/api/my-feature/:id/file", async (req, res) => {
  const row = tasks.get(req.params.id);
  if (!row?.taskId) return res.status(404).end();
  const path = String(req.query.path ?? "");
  const bytes = await client.downloadTaskFile(row.taskId, path, true);
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(Buffer.from(bytes));
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`proxy listening on :${port}`));
