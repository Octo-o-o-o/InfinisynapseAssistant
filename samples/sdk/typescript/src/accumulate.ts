// 按消息 ts 累积流式文本（纯函数，可离线测试）。
//
// InfiniSynapse 的 message.partial 同一 ts 是"覆盖"语义（流式快照逐步变长），
// 直接对所有片段 += 会在服务端发累积快照时把同一段文本重复拼接。
// 这里：同 ts 用最新文本覆盖、不同 ts 顺序拼接、无 ts 退化为追加。

export class TextAccumulator {
  private order: number[] = [];
  private seg = new Map<number, string>();
  private fallback = "";

  add(text: string | undefined, ts: number | undefined): void {
    if (!text) return;
    if (typeof ts !== "number") {
      this.fallback += text;
      return;
    }
    if (!this.seg.has(ts)) this.order.push(ts);
    this.seg.set(ts, text);
  }

  text(): string {
    return this.order.map((t) => this.seg.get(t) ?? "").join("") + this.fallback;
  }
}
