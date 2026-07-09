// 离线集成测试：用 samples/mock-server 跑通「先连 SSE → newTask → 完成 → 读产物」全链路。
// 与纯函数单测互补：这里走真实 HTTP + SSE 流，覆盖 client + runTask 的组合行为。
// 运行：node --experimental-strip-types --test test/integration-mock.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { startMockServer } from "../../../mock-server/server.mjs";
import { InfiniSynapseClient } from "../src/client.ts";
import { runTask } from "../src/runTask.ts";

function makeClient(url: string): InfiniSynapseClient {
  return new InfiniSynapseClient({ apiKey: "test-key", baseUrl: url });
}

test("集成：默认场景跑通完成态并读回 workspace 产物", async () => {
  const srv = await startMockServer({ stepDelayMs: 5 });
  try {
    const client = makeClient(srv.url);
    const result = await runTask(client, { text: "写一份调研报告" });

    assert.equal(result.status, "completed");
    assert.match(result.finalText, /分析完成/);
    assert.ok(result.workspace, "完成后应能读到 workspace");
    const files = (result.workspace!.files as unknown[]).map(String);
    assert.ok(files.includes("report.md"), `workspace 应含 report.md，实际: ${files.join(",")}`);

    // 产物读取三件套：preview 文本、二进制下载、恢复接口
    const preview = await client.previewFile(result.taskId, "report.md");
    assert.match(preview.content ?? "", /Mock 报告/);

    const bytes = await client.downloadTaskFile(result.taskId, "report.md");
    assert.ok(bytes.byteLength > 0, "下载应返回非空二进制");
    assert.match(new TextDecoder().decode(bytes), /Mock 报告/);

    const ui = (await client.getUiMessageById(result.taskId)) as { messages: Array<{ say?: string }> };
    assert.ok(ui.messages.some((m) => m.say === "completion_result"), "恢复接口应能看到完成信号");
  } finally {
    await srv.close();
  }
});

test("集成：upload 场景经 uploadToSandbox + askResponse 后完成", async () => {
  const srv = await startMockServer({ stepDelayMs: 5 });
  try {
    const client = makeClient(srv.url);
    let uploadAsked = 0;
    const result = await runTask(client, {
      text: "分析我的文件 [mock:upload]",
      onUploadRequest: () => {
        uploadAsked++;
        return { data: new TextEncoder().encode("hello"), filename: "input.txt" };
      },
    });
    assert.equal(uploadAsked, 1, "Agent 请求上传应回调一次");
    assert.equal(result.status, "completed");
    const files = (result.workspace!.files as unknown[]).map(String);
    assert.ok(files.includes("upload_from_sandbox.bin"), "sandbox 上传应进入任务文件");
  } finally {
    await srv.close();
  }
});

test("集成：error 场景标记业务失败", async () => {
  const srv = await startMockServer({ stepDelayMs: 5 });
  try {
    const client = makeClient(srv.url);
    const result = await runTask(client, {
      text: "触发失败 [mock:error]",
      reconnect: { enabled: false },
    });
    assert.equal(result.status, "error");
    assert.match(result.error ?? "", /mock:error|scenario/);
  } finally {
    await srv.close();
  }
});

test("集成：缺 token 走 1101 失效分支", async () => {
  const srv = await startMockServer({ stepDelayMs: 5 });
  try {
    const client = new InfiniSynapseClient({ apiKey: "x", baseUrl: srv.url, fetch: (input, init) => {
      // 移除 Authorization 模拟凭据缺失
      const headers = new Headers(init?.headers as HeadersInit);
      headers.delete("Authorization");
      return fetch(input, { ...init, headers });
    } });
    await assert.rejects(() => client.ping(), (err: Error & { opts?: { tokenInvalid?: boolean } }) => {
      assert.equal(err.opts?.tokenInvalid, true);
      return true;
    });
  } finally {
    await srv.close();
  }
});
