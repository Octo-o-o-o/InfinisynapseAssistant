// 反例：前端组件直连 InfiniSynapse（INF-SEC-002）。API Key 会进 bundle，必须走后端代理。
import { useState } from "react";

export function Chat() {
  const [text, setText] = useState("");
  async function send() {
    await fetch("https://app.infinisynapse.cn/api/ai/message", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_KEY}` },
      body: JSON.stringify({ type: "newTask", text }),
    });
  }
  return null;
}
