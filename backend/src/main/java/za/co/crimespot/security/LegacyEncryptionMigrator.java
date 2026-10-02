package za.co.crimespot.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/** Encrypts values stored before field encryption existed. Idempotent: skips anything already encrypted. */
@Component
public class LegacyEncryptionMigrator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyEncryptionMigrator.class);

    private record Target(String table, String idColumn, List<String> columns) {}

    private static final List<Target> TARGETS = List.of(
            new Target("users", "id", List.of("full_name", "phone")),
            new Target("user_locations", "user_id", List.of("latitude", "longitude", "accuracy_m")),
            new Target("panic_alerts", "id", List.of("latitude", "longitude", "accuracy_m", "message")),
            new Target("push_subscriptions", "id", List.of("p256dh", "auth")));

    private final JdbcTemplate jdbc;

    // FieldCrypto is injected only so its key is loaded before this runs.
    public LegacyEncryptionMigrator(JdbcTemplate jdbc, FieldCrypto crypto) { this.jdbc = jdbc; }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int total = 0;
        for (Target t : TARGETS) {
            for (String col : t.columns()) {
                // Table and column names are fixed constants above, never user input.
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT " + t.idColumn() + " AS id, " + col + " AS v FROM " + t.table()
                        + " WHERE " + col + " IS NOT NULL AND " + col + " NOT LIKE 'enc1:%'");
                for (Map<String, Object> r : rows) {
                    jdbc.update("UPDATE " + t.table() + " SET " + col + " = ? WHERE " + t.idColumn() + " = ?",
                            FieldCrypto.encrypt(String.valueOf(r.get("v"))), r.get("id"));
                }
                total += rows.size();
            }
        }
        log.info("Field encryption: {} legacy values encrypted", total);
    }
}
