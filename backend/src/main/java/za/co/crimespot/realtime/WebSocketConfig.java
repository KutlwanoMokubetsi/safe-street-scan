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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Only our web app may open a socket; authentication happens in the first message.
        registry.addHandler(hub, "/ws").setAllowedOrigins(origins);
    }
}
