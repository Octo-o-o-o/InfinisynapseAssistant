// 离线 SSE 解析器单测，不触网。
// 运行：node --experimental-strip-types --test test/sse.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SseParser, parseSseData } from "../src/sse.ts";

function collect(chunks: string[]): ReturnType<SseParser["push"]> {
  const p = new SseParser();
  const out: ReturnType<SseParser["push"]> = [];
  for (const c of chunks) out.push(...p.push(c));
  out.push(...p.flush());
  return out;
}

test("解析单个完整事件", () => {
  const evs = collect(['event: state.ready\ndata: {"taskId":"t1"}\n\n']);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].event, "state.ready");
  assert.deepEqual(evs[0].data, { taskId: "t1" });
});

test("分片跨越行边界也能拼回", () => {
  const evs = collect(["event: message.par", "tial\nda", 'ta: {"taskId":"t1","mess', 'age":{"text":"hi"}}\n\n']);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].event, "message.partial");
  assert.deepEqual(evs[0].data, { taskId: "t1", message: { text: "hi" } });
});

test("一次 push 含多个事件", () => {
  const evs = collect(['event: message.add\ndata: {"a":1}\n\nevent: message.add\ndata: {"a":2}\n\n']);
  assert.equal(evs.length, 2);
  assert.deepEqual(evs[0].data, { a: 1 });
  assert.deepEqual(evs[1].data, { a: 2 });
});

test("heartbeat 的 ping 是字符串", () => {
  const evs = collect(["event: heartbeat\ndata: ping\n\n"]);
  assert.equal(evs[0].event, "heartbeat");
  assert.equal(evs[0].data, "ping");
});

test("多行 data 用换行连接后再解析", () => {
  const evs = collect(['event: notification\ndata: {"type":"error",\ndata: "message":"boom"}\n\n']);
  assert.equal(evs[0].event, "notification");
  assert.deepEqual(evs[0].data, { type: "error", message: "boom" });
});

test("CRLF 与注释行处理", () => {
  const evs = collect([": this is a comment\r\nevent: message.add\r\ndata: {\"x\":true}\r\n\r\n"]);
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0].data, { x: true });
});

test("flush 派发结尾未带空行的事件", () => {
  const p = new SseParser();
  assert.equal(p.push('event: message.add\ndata: {"end":1}\n').length, 0);
  const tail = p.flush();
  assert.equal(tail.length, 1);
  assert.deepEqual(tail[0].data, { end: 1 });
});

test("completion_result 可从 say 或 ask 字段识别", () => {
  const evs = collect([
    'event: message.add\ndata: {"taskId":"t","message":{"say":"completion_result"}}\n\n',
    'event: message.add\ndata: {"taskId":"t","message":{"type":"ask","ask":"completion_result"}}\n\n',
  ]);
  const isCompletion = (m: { say?: string; ask?: string }) =>
    m.say === "completion_result" || m.ask === "completion_result";
  assert.equal(isCompletion((evs[0].data as { message: { say?: string } }).message), true);
  assert.equal(isCompletion((evs[1].data as { message: { ask?: string } }).message), true);
});

test("parseSseData 非 JSON 原样返回", () => {
  assert.equal(parseSseData("ping"), "ping");
  assert.equal(parseSseData(""), "");
  assert.deepEqual(parseSseData('{"a":1}'), { a: 1 });
});
