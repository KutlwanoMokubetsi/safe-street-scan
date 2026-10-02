package za.co.crimespot.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Arrays;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeHub hub;
    private final String[] origins;

    public WebSocketConfig(RealtimeHub hub, @Value("${app.cors.allowed-origins}") String origins) {
        this.hub = hub;
        this.origins = Arrays.stream(origins.split(",")).map(String::trim).toArray(String[]::new);
    }

    /** Small per-socket buffers (events are tiny) and an idle timeout well above the 25 s client ping. */
    @org.springframework.context.annotation.Bean
    public org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean createWebSocketContainer() {
        var c = new org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean();
        c.setMaxTextMessageBufferSize(8 * 1024);
        c.setMaxBinaryMessageBufferSize(1024);
        c.setMaxSessionIdleTimeout(120_000L);
        return c;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Only our web app may open a socket; authentication happens in the first message.
        registry.addHandler(hub, "/ws").setAllowedOrigins(origins);
    }
}
