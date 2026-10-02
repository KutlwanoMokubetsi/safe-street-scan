package za.co.crimespot.common;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Tiny cache for data everyone reads (stats, recent reports, hotspots). When 1,000 apps re-fetch after
 * a change, only the first request hits the database. Entries are tagged and cleared by RealtimeHub
 * after the change commits, and also expire after a short TTL as a safety net.
 */
@Component
public class ReadCache {

    private record Entry(Object value, long expiresAt, String tag) {}

    private static final long TTL_MS = 60_000;
    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    // ReentrantLock, not synchronized: a virtual thread blocked on the database inside synchronized would pin its carrier.
    private final Map<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    @SuppressWarnings("unchecked")
    public <T> T get(String key, String tag, Supplier<T> loader) {
        Entry e = entries.get(key);
        if (e != null && e.expiresAt() > System.currentTimeMillis()) return (T) e.value();
        // One loader per key at a time: concurrent requests wait for it instead of all querying.
        ReentrantLock lock = locks.computeIfAbsent(key, k -> new ReentrantLock());
        lock.lock();
        try {
            e = entries.get(key);
            if (e != null && e.expiresAt() > System.currentTimeMillis()) return (T) e.value();
            T value = loader.get();
            entries.put(key, new Entry(value, System.currentTimeMillis() + TTL_MS, tag));
            return value;
        } finally {
            lock.unlock();
        }
    }

    public void invalidate(String tag) {
        entries.values().removeIf(e -> e.tag().equals(tag));
    }
}
