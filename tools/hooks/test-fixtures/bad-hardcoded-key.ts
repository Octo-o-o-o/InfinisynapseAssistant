// 反例：硬编码 Bearer token（INF-SEC-001）。API Key 必须来自服务端环境变量。
const headers = {
  Authorization: "Bearer sk-inf-9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c",
};

export async function ping() {
  return fetch("https://app.infinisynapse.cn/api/ai/ping", { headers });
}
