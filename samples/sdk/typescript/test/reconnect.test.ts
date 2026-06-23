// 离线测试 SSE 重连：纯函数 + 用 fake client 真实走一遍"断开→重连→完成"。
// 运行：node --experimental-strip-types --test test/reconnect.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBackoffMs, selectMissedMessages, extractUiMessages } from "../src/reconnect.ts";
import { runTask } from "../src/runTask.ts";

// ---- 纯函数 ----

test("nextBackoffMs 指数退避封顶", () => {
  assert.equal(nextBackoffMs(0, { baseMs: 500, maxMs: 10000 }), 0);
  assert.equal(nextBackoffMs(1, { baseMs: 500, maxMs: 10000 }), 500);
  assert.equal(nextBackoffMs(2, { baseMs: 500, maxMs: 10000 }), 1000);
  assert.equal(nextBackoffMs(3, { baseMs: 500, maxMs: 10000 }), 2000);
  assert.equal(nextBackoffMs(10, { baseMs: 500, maxMs: 10000 }), 10000); // 封顶
});

test("extractUiMessages 容错多种形状", () => {
  const msgs = [{ ts: 1 }, { ts: 2 }];
  assert.deepEqual(extractUiMessages(msgs), msgs);
  assert.deepEqual(extractUiMessages({ messages: msgs }), msgs);
  assert.deepEqual(extractUiMessages({ data: { messages: msgs } }), msgs);
  assert.deepEqual(extractUiMessages(null), []);
});

test("selectMissedMessages 跳过已见 ts 并按 ts 升序", () => {
  const ui = { messages: [{ ts: 3, text: "c" }, { ts: 1, text: "a" }, { ts: 2, text: "b" }] };
  const seen = new Set([1]);
  const missed = selectMissedMessages(ui, seen);
  assert.deepEqual(missed.map((m) => m.ts), [2, 3]);
});

// ---- 用 fake client 真实走重连 ----

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i < chunks.length) ctrl.enqueue(enc.encode(chunks[i++]));
      else ctrl.close();
    },
  });
}

test("第一条流未完成就断开 → 重连 → 第二条流完成，文本跨重连累积", async () => {
  let opens = 0;
  let newTasks = 0;
  const fake = {
    async openEvents() {
      opens++;
      if (opens === 1) {
        // 发一条 ts=1 文本后就关闭（模拟断线，无 completion）
        return streamFrom(['event: message.add\ndata: {"taskId":"t","message":{"ts":1,"text":"你好"}}\n\n']);
      }
      // 重连后第二条流给出 completion
      return streamFrom([
        'event: message.add\ndata: {"taskId":"t","message":{"ts":2,"say":"completion_result","text":"世界"}}\n\n',
      ]);
    },
    async newTask() { newTasks++; return { success: true }; },
    async getUiMessageById() { return { messages: [] }; },
    async getTaskWorkspace() { return { cwd: "/w", files: [{ path: "report.md" }] }; },
  };

  const res = await runTask(fake as never, {
    text: "hi",
    reconnect: { baseDelayMs: 1, maxDelayMs: 2, heartbeatTimeoutMs: 5000, maxRetries: 5 },
  });

  assert.equal(res.status, "completed");
  assert.equal(res.finalText, "你好世界"); // 跨重连累积
  assert.equal(res.reconnects, 1); // 重连了一次
  assert.equal(opens, 2); // 连了两次
  assert.equal(newTasks, 1); // newTask 只发一次
  assert.equal(res.workspace?.files?.[0]?.path, "report.md");
});

test("断开期间的消息通过 getUiMessageById 补回", async () => {
  let opens = 0;
  const fake = {
    async openEvents() {
      opens++;
      if (opens === 1) return streamFrom(['event: message.add\ndata: {"taskId":"t","message":{"ts":1,"text":"A"}}\n\n']);
      // 第二条流直接 completion，但不带断线期间的 ts=2 文本
      return streamFrom(['event: message.add\ndata: {"taskId":"t","message":{"ts":3,"ask":"completion_result"}}\n\n']);
    },
    async newTask() { return { success: true }; },
    // catch-up 补回断线期间错过的 ts=2
    async getUiMessageById() { return { messages: [{ ts: 2, text: "B" }] }; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };

  const res = await runTask(fake as never, {
    text: "hi",
    reconnect: { baseDelayMs: 1, maxDelayMs: 2, maxRetries: 5 },
  });

  assert.equal(res.status, "completed");
  assert.equal(res.finalText, "AB"); // A（流1）+ B（catch-up 补回）
});

test("reconnect.enabled=false 时流断开即判错", async () => {
  const fake = {
    async openEvents() { return streamFrom(['event: message.add\ndata: {"taskId":"t","message":{"ts":1,"text":"x"}}\n\n']); },
    async newTask() { return { success: true }; },
    async getUiMessageById() { return { messages: [] }; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };
  const res = await runTask(fake as never, { text: "hi", reconnect: { enabled: false } });
  assert.equal(res.status, "error");
  assert.equal(res.reconnects, 0);
});

test("message.update 事件也被处理（文本累积 + 完成判定）", async () => {
  const fake = {
    async openEvents() {
      return streamFrom([
        'event: message.update\ndata: {"taskId":"t","message":{"ts":1,"text":"经更新"}}\n\n',
        'event: message.update\ndata: {"taskId":"t","message":{"ts":2,"say":"completion_result"}}\n\n',
      ]);
    },
    async newTask() { return { success: true }; },
    async getUiMessageById() { return { messages: [] }; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };
  const res = await runTask(fake as never, { text: "hi", reconnect: { enabled: false } });
  assert.equal(res.status, "completed");
  assert.equal(res.finalText, "经更新");
});

test("upload_file_to_sandbox：上传与 askResponse 在 runTask 返回前已完成（不泄漏）", async () => {
  const calls: string[] = [];
  const fake = {
    async openEvents() {
      return streamFrom([
        'event: message.add\ndata: {"taskId":"t","message":{"ts":1,"type":"ask","ask":"upload_file_to_sandbox"}}\n\n',
        'event: message.add\ndata: {"taskId":"t","message":{"ts":2,"say":"completion_result"}}\n\n',
      ]);
    },
    async newTask() { return { success: true }; },
    async uploadToSandbox() { calls.push("upload"); return { filename: "f" }; },
    async askResponse() { calls.push("ask"); return { success: true }; },
    async getUiMessageById() { return { messages: [] }; },
    async getTaskWorkspace() { return { cwd: "/w", files: [] }; },
  };
  const res = await runTask(fake as never, {
    text: "hi",
    reconnect: { enabled: false },
    onUploadRequest: () => ({ data: new Uint8Array([1]), filename: "a.txt" }),
  });
  assert.equal(res.status, "completed");
  assert.deepEqual(calls, ["upload", "ask"]); // 返回前已 await 完
});
