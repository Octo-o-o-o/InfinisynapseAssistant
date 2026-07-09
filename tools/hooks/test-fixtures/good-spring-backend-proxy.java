// 正例：Java Spring 后端代理直连 InfiniSynapse 是推荐架构（服务端持 Key）。
// Spring 的 @Component 注解不能被当成鸿蒙 ArkTS 客户端特征误伤。
// 期望：exit 0。
package com.example.backend;

import org.springframework.stereotype.Component;

@Component
public class InfiniProxy {
    private final String base = "https://app.infinisynapse.cn";

    public String eventsUrl(String connId) {
        return base + "/api/ai/events?connId=" + connId;
    }
}
