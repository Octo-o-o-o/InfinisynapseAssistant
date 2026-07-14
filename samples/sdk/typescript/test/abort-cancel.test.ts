// 未完成任务的退出止血：超时/主动 abort 后 best-effort cancelTask；正常完成不误取消。
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTask } from "../src/runTask.ts";

function hangingStream(signal?: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("event: heartbeat\ndata: ping\n\n"));
      signal?.addEventListener("abort", () => {
        try {
          controller.error(new Error("aborted"));
        } catch {
          // stream 已经结束时忽略
        }
      }, { once: true });
    },
  });
}

test("外部 abort：已发出的平台任务会 best-effort cancelTask", async () => {
  const calls: string[] = [];
  const abort = new AbortController();
  const fake = {
    async openEvents(_connId?: string, signal?: AbortSignal) {
      return hangingStream(signal);
    },
    async newTask() { calls.push("newTask"); return { success: true }; },
    async cancelTask(taskId: string) { calls.push(`cancelTask:${taskId}`); return {}; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };

  const timer = setTimeout(() => abort.abort(), 20);
  const result = await runTask(fake as never, {
    text: "long task",
    taskId: "task-abort",
    signal: abort.signal,
    reconnect: { heartbeatTimeoutMs: 5_000, maxRetries: 0 },
  });
  clearTimeout(timer);

  assert.equal(result.status, "aborted");
  assert.deepEqual(calls, ["newTask", "cancelTask:task-abort"]);
  assert.equal(result.workspace, null);
});

test("正常完成：不发送 cancelTask", async () => {
  const calls: string[] = [];
  const fake = {
    async openEvents() {
      const data = JSON.stringify({ taskId: "task-ok", message: { ts: 1, say: "completion_result", text: "done" } });
      const encoder = new TextEncoder();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`event: message.add\ndata: ${data}\n\n`));
          controller.close();
        },
      });
    },
    async newTask() { return { success: true }; },
    async cancelTask() { calls.push("cancelTask"); return {}; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };

  const result = await runTask(fake as never, { text: "short task", taskId: "task-ok" });
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, []);
});

test("恢复交接：cancelOnExit=false 时保留平台任务", async () => {
  const calls: string[] = [];
  const abort = new AbortController();
  const fake = {
    async openEvents(_connId?: string, signal?: AbortSignal) { return hangingStream(signal); },
    async newTask() { return { success: true }; },
    async cancelTask() { calls.push("cancelTask"); return {}; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };
  const timer = setTimeout(() => abort.abort(), 20);
  const result = await runTask(fake as never, {
    text: "handoff task",
    taskId: "task-handoff",
    signal: abort.signal,
    cancelOnExit: false,
    reconnect: { heartbeatTimeoutMs: 5_000, maxRetries: 0 },
  });
  clearTimeout(timer);

  assert.equal(result.status, "aborted");
  assert.deepEqual(calls, []);
});
