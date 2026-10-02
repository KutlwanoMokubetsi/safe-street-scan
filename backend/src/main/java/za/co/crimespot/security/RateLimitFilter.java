package za.co.crimespot.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import za.co.crimespot.auth.AuthUser;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window rate limits per signed-in user (or per IP when anonymous).
 * SOS is never limited: an emergency must always get through.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String name, int limit, long windowMs) {}

    private static final Rule READS = new Rule("read", 300, 60_000);          // 300 / minute
    private static final Rule WRITES = new Rule("write", 60, 60_000);          // 60 / minute
    private static final Rule FRIEND_REQ = new Rule("friend", 20, 3_600_000);  // 20 / hour: stops code guessing
    private static final Rule ANON = new Rule("anon", 60, 60_000);

    private record Window(long start, AtomicInteger count) {}
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        String method = req.getMethod();
        if (!path.startsWith("/api/") || "OPTIONS".equals(method) || path.startsWith("/api/panic")) {
            chain.doFilter(req, res);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String who = auth != null && auth.getPrincipal() instanceof AuthUser u ? "u:" + u.id() : "ip:" + req.getRemoteAddr();
        Rule rule = who.startsWith("ip:") ? ANON
                : path.startsWith("/api/friends/requests") && "POST".equals(method) ? FRIEND_REQ
                : "GET".equals(method) ? READS : WRITES;

        if (!allow(who + "|" + rule.name(), rule)) {
            res.setStatus(429);
            res.setHeader("Retry-After", String.valueOf(rule.windowMs() / 1000));
            res.setContentType("application/problem+json");
            res.getWriter().write("{\"status\":429,\"detail\":\"Too many requests. Wait a moment and try again.\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private boolean allow(String key, Rule rule) {
        long now = System.currentTimeMillis();
        Window w = windows.compute(key, (k, old) ->
                old == null || now - old.start() >= rule.windowMs() ? new Window(now, new AtomicInteger()) : old);
        return w.count().incrementAndGet() <= rule.limit();
    }

    @Scheduled(fixedDelay = 600_000)
    void cleanup() {
        long now = System.currentTimeMillis();
        windows.values().removeIf(w -> now - w.start() > 3_600_000);
    }
}
