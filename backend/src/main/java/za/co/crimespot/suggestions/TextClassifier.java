package za.co.crimespot.suggestions;

import java.util.*;

/**
 * Multinomial Naive Bayes text classifier with Laplace smoothing.
 *
 * Labels are crime types plus NON_INCIDENT (court cases, statistics, politics, opinion: news that mentions
 * crime but isn't a new incident at a place). Trained from:
 *   - a small seed set of example phrases (so it works from day one),
 *   - verified user reports (description → type, labelled by moderators' verification),
 *   - news suggestions moderators accepted (headline → final type) or dismissed (→ NON_INCIDENT).
 * So every moderation decision makes it more accurate for this community.
 */
public final class TextClassifier {

    public static final String NON_INCIDENT = "NON_INCIDENT";
    public record Prediction(String label, double probability) {}

    private static final Set<String> STOP = Set.of(
            "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "with", "by", "from", "as", "is", "are",
            "was", "were", "be", "been", "it", "its", "this", "that", "after", "over", "into", "near", "his", "her",
            "their", "they", "he", "she", "has", "have", "had", "who", "while", "s");

    private final Map<String, Map<String, Integer>> counts = new HashMap<>();
    private final Map<String, Integer> totals = new HashMap<>();
    private final Map<String, Integer> docs = new HashMap<>();
    private final Set<String> vocab = new HashSet<>();
    private int nDocs;

    public void train(String text, String label) {
        List<String> tokens = tokenize(text);
        if (tokens.isEmpty()) return;
        Map<String, Integer> c = counts.computeIfAbsent(label, k -> new HashMap<>());
        for (String t : tokens) {
            c.merge(t, 1, Integer::sum);
            totals.merge(label, 1, Integer::sum);
            vocab.add(t);
        }
        docs.merge(label, 1, Integer::sum);
        nDocs++;
    }

    public Prediction predict(String text) {
        List<String> tokens = tokenize(text);
        if (tokens.isEmpty() || nDocs == 0) return new Prediction(NON_INCIDENT, 0);
        int v = vocab.size();
        Map<String, Double> logp = new HashMap<>();
        for (String label : docs.keySet()) {
            double lp = Math.log(docs.get(label) / (double) nDocs);
            Map<String, Integer> c = counts.get(label);
            int total = totals.getOrDefault(label, 0);
            for (String t : tokens) {
                if (!vocab.contains(t)) continue; // unseen words carry no evidence
                lp += Math.log((c.getOrDefault(t, 0) + 1.0) / (total + v));
            }
            logp.put(label, lp);
        }
        // Normalise with log-sum-exp to get a real probability for the best label.
        double max = Collections.max(logp.values());
        double sum = logp.values().stream().mapToDouble(x -> Math.exp(x - max)).sum();
        Map.Entry<String, Double> best = Collections.max(logp.entrySet(), Map.Entry.comparingByValue());
        return new Prediction(best.getKey(), 1.0 / sum);
    }

    public int size() { return nDocs; }

    static List<String> tokenize(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String w : text.toLowerCase(Locale.ROOT).replace("-", " ").split("[^a-z]+")) {
            if (w.length() < 2 || STOP.contains(w)) continue;
            out.add(stem(w));
        }
        return out;
    }

    /** Light suffix stripping so "hijacked", "hijacking", "hijackers" share evidence. */
    static String stem(String w) {
        for (String suf : new String[] { "ings", "ing", "ers", "er", "ed", "es", "s" }) {
            if (w.length() > suf.length() + 3 && w.endsWith(suf)) return w.substring(0, w.length() - suf.length());
        }
        return w;
    }

    /** Starter examples so suggestions work before the community has labelled data. */
    public static TextClassifier seeded() {
        TextClassifier c = new TextClassifier();
        Map<String, String[]> seed = new LinkedHashMap<>();
        seed.put("ROBBERY", new String[] { "armed robbery at shop", "robbers held up store at gunpoint", "cash in transit heist",
                "business robbed at gunpoint", "tavern patrons robbed by gunmen", "armed men rob supermarket", "spaza shop robbery",
                "gunmen rob petrol station", "customers robbed during holdup", "jewellery store robbery" });
        seed.put("HIJACKING", new String[] { "motorist hijacked", "car hijacking", "vehicle hijacked at gunpoint", "hijackers took bakkie",
                "hijacked driver kidnapped", "truck hijacking on highway", "hijacking in driveway", "e-hailing driver hijacked",
                "woman hijacked at traffic light" });
        seed.put("ASSAULT", new String[] { "man stabbed", "woman assaulted", "shooting leaves one dead", "man shot dead", "attacked and injured",
                "murdered in his home", "body found with stab wounds", "gunman opens fire killing three", "pedestrian beaten", "mass shooting at tavern",
                "teen stabbed outside school", "woman stabbed in street" });
        seed.put("BURGLARY", new String[] { "house break in", "home invasion", "burglars broke into house", "school burgled", "residents tied up during house robbery",
                "break in at church", "office burglary laptops stolen", "intruders broke into home", "shop broken into overnight" });
        seed.put("THEFT", new String[] { "cable theft", "copper cable stolen", "car stolen from parking lot", "pickpocket", "phone snatched from woman",
                "bag snatching", "stock theft cattle stolen", "vehicle theft", "shoplifting", "fuel theft from pipeline", "stolen goods", "thieves stole cable", "thieves caught stealing" });
        seed.put("DRUG_RELATED", new String[] { "drug bust", "drugs seized", "dagga plantation found", "mandrax tablets confiscated", "drug lab raided",
                "cocaine worth millions seized", "nyaope dealers arrested", "drug dealer arrested with tik" });
        seed.put("FRAUD", new String[] { "scam", "fraud", "con artists target pensioners", "atm card swap scam", "online scam victims", "fake police officers",
                "bank fraud syndicate", "phishing scam", "tender fraud" });
        seed.put("VANDALISM", new String[] { "vandalised", "infrastructure vandalism", "torched", "set alight by protesters", "damage to property", "graffiti",
                "substation vandalised", "train set on fire", "clinic vandalised" });
        seed.put("SUSPICIOUS_ACTIVITY", new String[] { "suspicious vehicle spotted", "residents warned of suspicious men", "loitering suspects",
                "warning to residents about criminals", "community warned to be alert" });
        seed.put(NON_INCIDENT, new String[] { "sentenced to life imprisonment", "appears in court", "court postpones case", "crime statistics released",
                "minister says crime", "police commissioner", "police budget", "parliament debates crime", "opinion crime", "convicted of murder",
                "bail application", "murder trial", "years after murder", "anniversary of", "election", "awareness campaign",
                "national crime stats", "how to protect yourself", "accused granted bail", "case withdrawn", "inquest", "found guilty",
                "acquitted", "sentencing", "policy on crime", "crime prevention summit", "police station opened", "interview", "column" });
        seed.forEach((label, examples) -> { for (String e : examples) c.train(e, label); });
        return c;
    }
}
