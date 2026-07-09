// 反例：鸿蒙 ArkTS 页面直连 InfiniSynapse —— API Key 会进 hap 安装包。
// 期望：INF-SEC-002 (HIGH)，exit 2。
import { http } from '@kit.NetworkKit';

@Entry
@Component
struct ChatPage {
  build() {
  }

  startTask(apiKey: string): void {
    const req = http.createHttp();
    req.requestInStream('https://app.infinisynapse.cn/api/ai/events?connId=abc', {
      method: http.RequestMethod.GET,
      header: { 'Authorization': `Bearer ${apiKey}` },
    });
  }
}
