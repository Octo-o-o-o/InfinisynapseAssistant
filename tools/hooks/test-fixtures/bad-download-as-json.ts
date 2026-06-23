// 反例：把下载端点当 JSON 解析（INF-DL-001）。下载返回二进制流。
export async function getFile(base: string, taskId: string, path: string) {
  const res = await fetch(`${base}/api/tools/storage/downloadTaskFile/${taskId}?path=${path}`);
  const data = await res.json(); // 错误：应当读 arrayBuffer / blob
  return data;
}
