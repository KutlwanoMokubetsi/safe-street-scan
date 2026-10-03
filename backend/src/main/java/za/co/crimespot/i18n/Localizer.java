package za.co.crimespot.i18n;

import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Knows each user's language, for notifications sent to them, and the current request's language. */
@Component
public class Localizer {

    private final JdbcTemplate jdbc;
    private final Map<UUID, String> cache = new ConcurrentHashMap<>();

    public Localizer(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public String langOf(UUID userId) {
        return cache.computeIfAbsent(userId, id -> {
            List<String> r = jdbc.queryForList("SELECT lang FROM users WHERE id = ?", String.class, id);
            return r.isEmpty() ? "en" : r.get(0);
        });
    }

    public Map<String, List<UUID>> byLang(Collection<UUID> users) {
        Map<String, List<UUID>> out = new HashMap<>();
        for (UUID u : new HashSet<>(users)) out.computeIfAbsent(langOf(u), k -> new ArrayList<>()).add(u);
        return out;
    }

    public void forget(UUID userId) { cache.remove(userId); }

    /** Language of the current HTTP request (Accept-Language sent by the web app). */
    public static String requestLang() {
        String l = LocaleContextHolder.getLocale().getLanguage();
        return Messages.LANGS.contains(l) ? l : "en";
    }
}
