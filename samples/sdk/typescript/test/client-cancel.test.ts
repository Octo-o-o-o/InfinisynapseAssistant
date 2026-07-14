// cancelTask 不触网单测：推荐路径走 /api/ai/message，旧部署才 fallback。
import { test } from "node:test";
import assert from "node:assert/strict";
import { InfiniSynapseClient, InfiniSynapseError } from "../src/client.ts";

test("cancelTask uses message endpoint first", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    },
  });

  await client.cancelTask("task-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.invalid/api/ai/message");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { type: "cancelTask", taskId: "task-1" });
});

test("cancelTask falls back to legacy endpoint only when message endpoint is unavailable", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (calls.length === 1) {
        return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ code: 200, data: { success: true } }), { status: 200 });
    },
  });

  await client.cancelTask("task-1");

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://example.invalid/api/ai/message");
  assert.equal(calls[1].url, "https://example.invalid/api/ai_task/cancelTask?taskId=task-1");
  assert.equal(calls[1].init.method, "GET");
});

test("multipart upload rejects business error envelopes", async () => {
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    fetch: async () => new Response(JSON.stringify({ code: 500, message: "upload denied" }), { status: 200 }),
  });

  await assert.rejects(
    () => client.taskUpload("task-1", { data: new Uint8Array([1]), filename: "a.txt" }),
    (err) => err instanceof InfiniSynapseError && err.opts.code === 500 && err.message === "upload denied",
  );
});

function fetchThatRejectsOnAbort(state: { aborted: boolean }): typeof fetch {
  return async (_url, init) => {
    await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => {
        state.aborted = true;
        reject(new Error("aborted"));
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });
    throw new Error("unreachable");
  };
}

test("SSE 建连超时可配置，且连接建立后不依赖普通 request timeout", async () => {
  const state = { aborted: false };
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    sseConnectTimeoutMs: 10,
    timeoutMs: 1,
    fetch: fetchThatRejectsOnAbort(state),
  });

  await assert.rejects(() => client.openEvents("conn-1"), /aborted/);
  assert.equal(state.aborted, true);
});

test("multipart 上传有独立超时", async () => {
  const state = { aborted: false };
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    uploadTimeoutMs: 10,
    fetch: fetchThatRejectsOnAbort(state),
  });

  await assert.rejects(
    () => client.taskUpload("task-1", { data: new Uint8Array([1]), filename: "a.txt" }),
    /aborted/,
  );
  assert.equal(state.aborted, true);
});

test("二进制下载有独立超时", async () => {
  const state = { aborted: false };
  const client = new InfiniSynapseClient({
    apiKey: "server-only-test-key",
    baseUrl: "https://example.invalid",
    downloadTimeoutMs: 10,
    fetch: fetchThatRejectsOnAbort(state),
  });

  await assert.rejects(() => client.downloadZip("task-1"), /aborted/);
  assert.equal(state.aborted, true);
});
