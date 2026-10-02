package za.co.crimespot.suggestions;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.news.NewsService;
import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.CrimeReportRepository;
import za.co.crimespot.report.CrimeType;
import za.co.crimespot.report.ReportService;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns local news into report SUGGESTIONS for moderators. Nothing here creates a public report on its own.
 *
 * For each recent headline in an area people are viewing:
 *  1. Fresh only: published in the last 72 hours.
 *  2. Not about courts, sentencing, statistics or politics (hard rule + classifier's NON_INCIDENT class).
 *  3. Classified into a crime type by a Naive Bayes model, with probability ≥ 0.45.
 *  4. Names a specific place that geocodes to an area under ~6 km across. City-wide stories are skipped.
 *  5. Not already reported: no matching report of the same type within 500 m and 48 hours.
 *  6. The same event from another outlet adds a corroborating source instead of a second suggestion.
 * A moderator then accepts (optionally correcting it) or dismisses; both outcomes retrain the model.
 */
@Service
public class SuggestionService {

    private static final Logger log = LoggerFactory.getLogger(SuggestionService.class);
    private static final double MIN_CONFIDENCE = 0.45;
    private static final Duration MAX_AGE = Duration.ofHours(72);
    private static final Pattern NOT_NEW_INCIDENT = Pattern.compile(
            "(?i)\\b(court|sentenc\\w*|bail|trial|convict\\w*|acquit\\w*|guilty|inquest|statistic\\w*|stats|parliament|minister|budget|anniversary|years? ago)\\b");
    /** "in Braamfontein", "on William Nicol Drive", "near Park Station", "along the N1" */
    private static final Pattern PLACE = Pattern.compile(
            "\\b(?i:in|at|near|outside|on|along|off)\\s+(?i:the\\s+)?((?:[A-Z][\\w'’-]+|N\\d{1,2}|M\\d{1,2}|R\\d{2,3})(?:\\s+(?:[A-Z][\\w'’-]+|Road|Rd|Street|St|Drive|Avenue|Ave|Highway|Station|Mall|Square))*)");
    private static final Set<String> TOO_BROAD = Set.of(
            "south africa", "sa", "gauteng", "western cape", "kwazulu-natal", "kzn", "eastern cape", "limpopo", "mpumalanga",
            "north west", "free state", "northern cape", "court", "parliament", "saps", "police", "monday", "tuesday", "wednesday",
            "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august",
            "september", "october", "november", "december");

    public record SuggestionDto(UUID id, String title, String url, String sourceDomain, Instant publishedAt, String area,
                                CrimeType crimeType, double confidence, String placeName, double latitude, double longitude,
                                int precisionM, int corroborations, List<String> otherSources, String status) {}

    public record Accept(CrimeType crimeType, String placeName, Double latitude, Double longitude) {}

    private final NewsService news;
    private final NewsSuggestionRepository suggestions;
    private final CrimeReportRepository reports;
    private final ReportService reportService;
    private final ReentrantLock running = new ReentrantLock();
    private volatile TextClassifier model = TextClassifier.seeded();
    private volatile long modelBuiltAt = 0;
    private volatile boolean modelStale = true;

    public SuggestionService(NewsService news, NewsSuggestionRepository suggestions,
                             CrimeReportRepository reports, ReportService reportService) {
        this.news = news;
        this.suggestions = suggestions;
        this.reports = reports;
        this.reportService = reportService;
    }

    // ---------- pipeline ----------

    @Scheduled(initialDelay = 120_000, fixedDelay = 30 * 60_000)
    public void run() {
        if (!running.tryLock()) return;
        try {
            retrainIfNeeded();
            int created = 0, corroborated = 0, seen = 0;
            for (String area : news.recentAreas(24, 15)) {
                for (NewsService.Item item : news.headlinesFor(area)) {
                    seen++;
                    switch (consider(area, item)) {
                        case CREATED -> created++;
                        case CORROBORATED -> corroborated++;
                        default -> { }
                    }
                }
            }
            log.info("News suggestions: {} headlines checked, {} new, {} corroborated (model trained on {} examples)",
                    seen, created, corroborated, model.size());
        } catch (Exception e) {
            log.warn("News suggestion run failed: {}", e.getMessage());
        } finally {
            running.unlock();
        }
    }

    enum Outcome { SKIPPED, CREATED, CORROBORATED }

    // No @Transactional: called from run() in this class, so a proxy wouldn't apply. Each repository call is atomic.
    Outcome consider(String area, NewsService.Item item) {
        if (item.publishedAt() == null || item.publishedAt().isBefore(Instant.now().minus(MAX_AGE))) return Outcome.SKIPPED;
        String hash = sha256(item.url());
        if (suggestions.existsByUrlHash(hash)) return Outcome.SKIPPED;
        if (NOT_NEW_INCIDENT.matcher(item.title()).find()) return Outcome.SKIPPED;

        TextClassifier.Prediction p = model.predict(item.title());
        if (p.label().equals(TextClassifier.NON_INCIDENT) || p.probability() < MIN_CONFIDENCE) return Outcome.SKIPPED;
        CrimeType type = CrimeType.valueOf(p.label());

        // Try the place phrase, then shorter versions ("Soweto Tavern Shooting" → "Soweto Tavern" → "Soweto").
        String place = null;
        Optional<NewsService.Place> geo = Optional.empty();
        int lookups = 0;
        for (String candidate : placeCandidates(item.title(), area)) {
            if (lookups++ >= 3) break; // respect Nominatim's rate limit
            geo = news.geocode(candidate, area);
            if (geo.isPresent()) { place = candidate; break; }
        }
        if (place == null) return Outcome.SKIPPED;
        double lat = geo.get().lat(), lng = geo.get().lng();

        // Already on the map (from a user or an earlier suggestion)?
        double dLat = 0.0045, dLng = 0.0045 / Math.cos(Math.toRadians(lat)); // ~500 m
        Instant at = item.publishedAt();
        if (reports.countSimilar(type, lat - dLat, lat + dLat, lng - dLng, lng + dLng,
                at.minus(Duration.ofHours(48)), at.plus(Duration.ofHours(6))) > 0) return Outcome.SKIPPED;

        // The same event from another outlet: add it as a corroborating source.
        List<NewsSuggestion> same = suggestions.similar(type, lat - dLat * 2, lat + dLat * 2, lng - dLng * 2, lng + dLng * 2,
                at.minus(Duration.ofHours(48)));
        if (!same.isEmpty()) {
            NewsSuggestion s = same.get(0);
            if (!Objects.equals(s.getSourceDomain(), item.source()) && (s.getOtherSources() == null || !s.getOtherSources().contains(item.url()))) {
                s.setCorroborations(s.getCorroborations() + 1);
                s.setOtherSources((s.getOtherSources() == null ? "" : s.getOtherSources() + "\n") + item.url());
                suggestions.save(s);
                return Outcome.CORROBORATED;
            }
            return Outcome.SKIPPED;
        }

        NewsSuggestion s = new NewsSuggestion();
        s.setUrlHash(hash);
        s.setUrl(item.url());
        s.setTitle(item.title());
        s.setSourceDomain(item.source());
        s.setPublishedAt(at);
        s.setArea(area);
        s.setCrimeType(type);
        s.setConfidence(Math.round(p.probability() * 100) / 100.0);
        s.setPlaceName(place);
        s.setLatitude(lat);
        s.setLongitude(lng);
        s.setPrecisionM(geo.get().precisionMeters());
        suggestions.save(s);
        return Outcome.CREATED;
    }

    /** Place phrases after "in/at/near/on…", each followed by shorter versions of itself. */
    static List<String> placeCandidates(String title, String area) {
        List<String> out = new ArrayList<>();
        Matcher m = PLACE.matcher(title);
        while (m.find()) {
            String[] words = m.group(1).trim().split("\\s+");
            for (int n = Math.min(words.length, 4); n >= 1; n--) {
                String c = String.join(" ", Arrays.copyOfRange(words, 0, n));
                String low = c.toLowerCase(Locale.ROOT);
                if (c.length() < 3 || TOO_BROAD.contains(low) || low.equals(area.toLowerCase(Locale.ROOT)) || out.contains(c)) continue;
                out.add(c);
            }
        }
        return out;
    }

    /** Rebuild the model hourly, or right after a moderator decision, from verified data. */
    private void retrainIfNeeded() {
        if (!modelStale && System.currentTimeMillis() - modelBuiltAt < 3_600_000) return;
        TextClassifier m = TextClassifier.seeded();
        for (Object[] row : reports.verifiedTrainingData(PageRequest.of(0, 5_000))) {
            m.train((String) row[0], ((CrimeType) row[1]).name());
        }
        for (NewsSuggestion s : suggestions.findByStatusIn(
                List.of(NewsSuggestion.Status.ACCEPTED, NewsSuggestion.Status.DISMISSED), PageRequest.of(0, 5_000))) {
            m.train(s.getTitle(), s.getStatus() == NewsSuggestion.Status.ACCEPTED ? s.getCrimeType().name() : TextClassifier.NON_INCIDENT);
        }
        model = m;
        modelBuiltAt = System.currentTimeMillis();
        modelStale = false;
    }

    // ---------- moderator actions ----------

    public List<SuggestionDto> pending() {
        return suggestions.findByStatusOrderByCreatedAtDesc(NewsSuggestion.Status.PENDING, PageRequest.of(0, 100))
                .stream().map(SuggestionService::dto).toList();
    }

    @Transactional
    public SuggestionDto accept(AuthUser me, UUID id, Accept body) {
        NewsSuggestion s = load(id);
        if (body != null) {
            if (body.crimeType() != null) s.setCrimeType(body.crimeType());
            if (body.placeName() != null && !body.placeName().isBlank()) s.setPlaceName(body.placeName().trim());
            if (body.latitude() != null && body.longitude() != null) { s.setLatitude(body.latitude()); s.setLongitude(body.longitude()); }
        }
        CrimeReport r = reportService.createFromNews(me, s.getCrimeType(), s.getTitle(), s.getPlaceName(), s.getLatitude(),
                s.getLongitude(), s.getPublishedAt() != null ? s.getPublishedAt() : Instant.now(), s.getUrl(), s.getSourceDomain());
        s.setStatus(NewsSuggestion.Status.ACCEPTED);
        s.setReportId(r.getId());
        review(me, s);
        return dto(s);
    }

    @Transactional
    public void dismiss(AuthUser me, UUID id) {
        NewsSuggestion s = load(id);
        s.setStatus(NewsSuggestion.Status.DISMISSED);
        review(me, s);
    }

    private void review(AuthUser me, NewsSuggestion s) {
        s.setReviewedBy(me.id());
        s.setReviewedAt(Instant.now());
        suggestions.save(s);
        modelStale = true; // learn from this decision on the next run
    }

    private NewsSuggestion load(UUID id) {
        NewsSuggestion s = suggestions.findById(id).orElseThrow(() -> new NotFoundException("Suggestion not found"));
        if (s.getStatus() != NewsSuggestion.Status.PENDING) throw new BadRequestException("This suggestion was already reviewed.");
        return s;
    }

    private static SuggestionDto dto(NewsSuggestion s) {
        List<String> others = s.getOtherSources() == null ? List.of()
                : Arrays.stream(s.getOtherSources().split("\n")).filter(u -> !u.isBlank()).toList();
        return new SuggestionDto(s.getId(), s.getTitle(), s.getUrl(), s.getSourceDomain(), s.getPublishedAt(), s.getArea(),
                s.getCrimeType(), s.getConfidence(), s.getPlaceName(), s.getLatitude(), s.getLongitude(), s.getPrecisionM(),
                s.getCorroborations(), others, s.getStatus().name());
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }
}
