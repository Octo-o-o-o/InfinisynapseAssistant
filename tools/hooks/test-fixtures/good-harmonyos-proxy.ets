// 正例：鸿蒙 ArkTS 页面只连自有后端，不出现 InfiniSynapse 直连。
// 期望：exit 0。
import { http } from '@kit.NetworkKit';

@Entry
@Component
struct ChatPage {
  build() {
  }

  startTask(sessionToken: string): void {
    const req = http.createHttp();
    req.requestInStream('https://api.example.com/v1/agent-tasks/123/events', {
      method: http.RequestMethod.GET,
      header: { 'Authorization': `Bearer ${sessionToken}` },
    });
  }
}
