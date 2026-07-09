// InfiniSynapse mock server（零依赖，Node 18+）。
// 用途：让业务集成代码 / SDK 在没有真实 API Key 的环境（本地、CI）跑通
// 「先连 SSE → newTask → 消费事件 → 读 workspace 产物」的完整链路集成测试。
//
// 边界声明：这不是官方模拟器。它只覆盖本仓库 docs/reference/ 已文档化的行为子集，
// 事件时序做了简化（无真实 Agent、无扣费、无沙箱）。联调与验收以真实 API 为准。
//
// 场景（通过 newTask 的 text 选择）：
//   默认              → partial 流式文本 → 写 report.md → completion_result
//   含 "[mock:upload]" → 先发 ask=upload_file_to_sandbox，收到 askResponse 后再走完成流程
//   含 "[mock:error]"  → notification type=error
//
// 用法：
//   CLI：node server.mjs --port 8787
//   程序化：const srv = await startMockServer({ port: 0 }); ...; await srv.close();

import http from "node:http";
import { URL } from "node:url";

const enc = new TextEncoder();

function envelope(data, code = 200, message = "success") {
  return JSON.stringify({ code, message, data });
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

export async function startMockServer(options = {}) {
  const heartbeatMs = options.heartbeatMs ?? 15000;
  const stepDelayMs = options.stepDelayMs ?? 25;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** connId -> ServerResponse（SSE 连接） */
  const conns = new Map();
  /** taskId -> { connId, ts, messages: [], files: Map<name, Buffer>, status, awaitingUpload } */
  const tasks = new Map();

  function sseSend(connId, event, data) {
    const res = conns.get(connId);
    if (!res || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function pushMessage(task, message, event = "message.add") {
    task.messages.push(message);
    sseSend(task.connId, event, { taskId: task.taskId, message });
  }

  async function runCompletion(task) {
    await sleep(stepDelayMs);
    const partial = { type: "say", say: "text", text: "正在分析（mock）…", ts: ++task.ts, partial: true };
    sseSend(task.connId, "message.partial", { taskId: task.taskId, message: partial });
    await sleep(stepDelayMs);
    pushMessage(task, { type: "say", say: "text", text: "分析完成（mock）。产物已写入工作区。", ts: ++task.ts });
    task.files.set("report.md", Buffer.from("# Mock 报告\n\n这是 mock server 生成的产物，用于离线集成测试。\n"));
    await sleep(stepDelayMs);
    pushMessage(task, { type: "say", say: "completion_result", text: "任务完成（mock）", ts: ++task.ts });
    task.status = "completed";
  }

  async function handleNewTask(body) {
    const taskId = body.taskId || `mock-task-${Date.now()}`;
    const task = {
      taskId,
      connId: body.connId,
      ts: 0,
      messages: [],
      files: new Map(),
      status: "running",
      awaitingUpload: false,
    };
    tasks.set(taskId, task);
    sseSend(task.connId, "state.ready", { taskId });

    const text = String(body.text ?? "");
    if (text.includes("[mock:error]")) {
      await sleep(stepDelayMs);
      sseSend(task.connId, "notification", { type: "error", title: "mock error", message: "scenario [mock:error] failed" });
      task.status = "error";
      return taskId;
    }
    if (text.includes("[mock:upload]")) {
      await sleep(stepDelayMs);
      task.awaitingUpload = true;
      pushMessage(task, { type: "ask", ask: "upload_file_to_sandbox", text: JSON.stringify({ files: ["input.txt"] }), ts: ++task.ts });
      return taskId; // 等 askResponse 再继续
    }
    void runCompletion(task);
    return taskId;
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    const path = u.pathname;

    if (!req.headers.authorization?.startsWith("Bearer ")) {
      sendJson(res, envelope(null, 1101, "missing or invalid token"), 401);
      return;
    }

    // ---- SSE ----
    if (req.method === "GET" && path === "/api/ai/events") {
      const connId = u.searchParams.get("connId") || `conn-${Date.now()}`;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      conns.set(connId, res);
      const hb = setInterval(() => {
        if (!res.writableEnded) res.write(`event: heartbeat\ndata: "ping"\n\n`);
      }, heartbeatMs);
      req.on("close", () => {
        clearInterval(hb);
        if (conns.get(connId) === res) conns.delete(connId);
      });
      return;
    }

    if (req.method === "POST" && path === "/api/ai/message") {
      let body;
      try {
        body = JSON.parse((await readBody(req)).toString("utf-8"));
      } catch {
        sendJson(res, envelope(null, 422, "invalid json"), 422);
        return;
      }
      if (body.type === "newTask") {
        const taskId = await handleNewTask(body);
        sendJson(res, envelope({ success: true, taskId }));
        return;
      }
      if (body.type === "askResponse") {
        const task = tasks.get(body.taskId);
        if (!task) {
          sendJson(res, envelope(null, 404, "task not found"), 404);
          return;
        }
        if (task.awaitingUpload) {
          task.awaitingUpload = false;
          void runCompletion(task);
        }
        sendJson(res, envelope({ success: true }));
        return;
      }
      if (body.type === "cancelTask") {
        const task = tasks.get(body.taskId);
        if (task) {
          task.status = "cancelled";
          sseSend(task.connId, "notification", { type: "success", title: "cancelled", message: "task cancelled" });
        }
        sendJson(res, envelope({ success: true }));
        return;
      }
      sendJson(res, envelope({ success: true }));
      return;
    }

    if (req.method === "GET" && path === "/api/ai/ping") {
      sendJson(res, envelope({ ok: true }));
      return;
    }

    // ---- 任务查询 / 产物 ----
    if (req.method === "GET" && path === "/api/ai_task/getUiMessageById") {
      const task = tasks.get(u.searchParams.get("id"));
      sendJson(res, envelope({ messages: task ? task.messages : [] }));
      return;
    }

    const wsMatch = path.match(/^\/api\/ai_task\/getTaskWorkspace\/(.+)$/);
    if (req.method === "GET" && wsMatch) {
      const task = tasks.get(decodeURIComponent(wsMatch[1]));
      if (!task) {
        sendJson(res, envelope(null, 404, "task not found"), 404);
        return;
      }
      sendJson(res, envelope({ cwd: `/workspace/${task.taskId}`, files: [...task.files.keys()] }));
      return;
    }

    if (req.method === "POST" && path === "/api/ai_task/previewFile") {
      const body = JSON.parse((await readBody(req)).toString("utf-8"));
      const task = tasks.get(body.taskId);
      const file = task?.files.get(body.fileName);
      if (!file) {
        sendJson(res, envelope(null, 404, "file not found"), 404);
        return;
      }
      sendJson(res, envelope({ content: file.toString("utf-8"), fileType: "text" }));
      return;
    }

    // 下载端点：二进制流，不走 JSON 信封
    const dlMatch = path.match(/^\/api\/tools\/storage\/downloadTaskFile\/(.+)$/);
    if (req.method === "GET" && dlMatch) {
      const task = tasks.get(decodeURIComponent(dlMatch[1]));
      const file = task?.files.get(u.searchParams.get("path"));
      if (!file) {
        sendJson(res, envelope(null, 404, "file not found"), 404);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": file.length });
      res.end(file);
      return;
    }

    // ---- 上传（不真正解析 multipart，回显文件名占位） ----
    if (req.method === "POST" && path === "/api/ai/upload") {
      await readBody(req);
      const taskId = u.searchParams.get("taskId");
      const task = tasks.get(taskId);
      if (task) task.files.set("upload_from_sandbox.bin", Buffer.from(enc.encode("mock-upload")));
      sendJson(res, envelope({ filename: "upload_from_sandbox.bin" }));
      return;
    }
    const tuMatch = path.match(/^\/api\/tools\/taskUpload\/(.+)$/);
    if (req.method === "POST" && tuMatch) {
      await readBody(req);
      const task = tasks.get(decodeURIComponent(tuMatch[1]));
      const subdir = u.searchParams.get("subdir") || "upload_documents";
      const name = `${subdir}/uploaded.bin`;
      if (task) task.files.set(name, Buffer.from(enc.encode("mock-task-upload")));
      sendJson(res, envelope({ filename: "uploaded.bin", logicalPath: name, size: 15 }));
      return;
    }

    sendJson(res, envelope(null, 404, `no mock route for ${req.method} ${path}`), 404);
  });

  const port = await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve(server.address().port));
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    tasks,
    close: () =>
      new Promise((resolve) => {
        for (const res of conns.values()) res.end();
        conns.clear();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const portArg = process.argv.indexOf("--port");
  const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 8787;
  const srv = await startMockServer({ port });
  console.log(`InfiniSynapse mock server: ${srv.url}`);
  console.log(`SSE:  GET  ${srv.url}/api/ai/events?connId=<uuid>`);
  console.log(`任务: POST ${srv.url}/api/ai/message  (场景标记: [mock:upload] / [mock:error])`);
}
