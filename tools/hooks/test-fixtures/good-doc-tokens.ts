// 正例：文档/占位符里的 token 不应被误判为硬编码（防 INF-SEC-001 误报）。
/*
  文档示例（不要真这样写）：
    const headers = { Authorization: "Bearer sk-inf-9f8a7b6c5d4e3f2a1b0c9d8e" };
  ↑ 块注释里的 token 不算硬编码
*/
// 占位符不算硬编码：
const examplePlaceholder = "Bearer YOUR_API_KEY_HERE_PLACEHOLDER";

export const ok = examplePlaceholder.length > 0;
