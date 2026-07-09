// 反例：Angular 前端组件直连 InfiniSynapse —— API Key 会进 bundle。
// 期望：INF-SEC-002 (HIGH)，exit 2。
import { Component } from '@angular/core';

@Component({
  selector: 'app-chat',
  template: '<div>chat</div>',
})
export class ChatComponent {
  start(apiKey: string): void {
    const es = new EventSource('https://app.infinisynapse.cn/api/ai/events?connId=abc');
    void es;
    void apiKey;
  }
}
