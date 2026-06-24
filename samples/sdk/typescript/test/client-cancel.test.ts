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
