// 离线测试：流式文本按 ts 累积，不重复拼接。
// 运行：node --experimental-strip-types --test test/accumulate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TextAccumulator } from "../src/accumulate.ts";

test("同 ts 累积快照只保留最新，不重复拼接", () => {
  const a = new TextAccumulator();
  a.add("你", 100);
  a.add("你好", 100);
  a.add("你好世界", 100); // 服务端发的是累积快照
  assert.equal(a.text(), "你好世界");
});

test("不同 ts 的多段消息顺序拼接", () => {
  const a = new TextAccumulator();
  a.add("第一段", 100);
  a.add("第二段", 200);
  assert.equal(a.text(), "第一段第二段");
});

test("混合：每段各自覆盖后拼接", () => {
  const a = new TextAccumulator();
  a.add("A", 1);
  a.add("AB", 1);
  a.add("C", 2);
  a.add("CD", 2);
  assert.equal(a.text(), "ABCD");
});

test("无 ts 退化为追加", () => {
  const a = new TextAccumulator();
  a.add("x", undefined);
  a.add("y", undefined);
  assert.equal(a.text(), "xy");
});

test("空文本忽略", () => {
  const a = new TextAccumulator();
  a.add("", 1);
  a.add(undefined, 1);
  assert.equal(a.text(), "");
});
