package za.co.crimespot.moderation;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks user text (comments and report descriptions) before it's saved.
 *
 * Reasons are message keys (see i18n.Messages), translated for the user.
 *
 *  BLOCK  personal information (phone numbers, emails, SA ID numbers, vehicle registrations),
 *         threats / calls for vigilante violence, and hate slurs. The user is told why and can rephrase.
 *  MASK   profanity (English and common South African terms) is replaced with •••, the rest is kept.
 *
 * Matching tolerates common evasions: letter repeats ("fuuuck"), separators ("f.u.c.k"), and look-alike
 * characters ("sh1t", "@ss").
 */
@Component
public class ContentFilter {

    public enum Action { ALLOW, MASK, BLOCK }

    public record Result(Action action, String text, String reason) {
        public boolean blocked() { return action == Action.BLOCK; }
    }

    // ---- personal information ----
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+?27|0)[\\s-]?\\(?[1-8]\\d\\)?(?:[\\s-]?\\d){7}(?!\\d)");
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}");
    private static final Pattern SA_ID = Pattern.compile("(?<!\\d)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{7}(?!\\d)");
    /** e.g. "CA 123-456", "ND 123456", "ABC 123 GP", "BC 12 DE GP", "123 ABC L" */
    private static final Pattern PLATE = Pattern.compile(
            "\\b(?:C[A-Z]{1,2}\\s?\\d{3}[\\s-]?\\d{3}|N[A-Z]{1,2}\\s?\\d{3}[\\s-]?\\d{3}"
            + "|[A-Z]{2,3}\\s?\\d{2,3}\\s?[A-Z]{0,3}\\s?(?:GP|ZN|EC|WC|NC|NW|FS|MP|L)"
            + "|\\d{3}\\s?[A-Z]{3}\\s?(?:GP|ZN|EC|WC|NC|NW|FS|MP|L))\\b");

    // ---- threats and incitement (vigilante "mob justice" is a real risk on community crime apps) ----
    private static final List<Pattern> THREATS = List.of(
            Pattern.compile("\\b(kill|shoot|stab|burn|necklace|hang|lynch|beat|moer|donner)\\s+(him|her|them|that|this|the\\s+(guy|man|woman|thief|suspect|boy))\\b"),
            Pattern.compile("\\bmob\\s+justice\\b"),
            Pattern.compile("\\b(we|i)\\s+(will|gonna|going\\s+to)\\s+(find|get|catch|deal\\s+with)\\s+(you|him|her|them)\\b"),
            Pattern.compile("\\btake\\s+the\\s+law\\s+into\\s+(our|your|their)\\s+own\\s+hands\\b"),
            Pattern.compile("\\bdeserves?\\s+to\\s+die\\b"));

    // ---- hate slurs: blocked outright. Extend from moderation experience. ----
    private static final List<Pattern> SLURS = terms("kaffir", "k4ffir", "nigger", "nigga", "coolie", "boesman");

    // ---- profanity: masked ----
    private static final List<Pattern> PROFANITY = terms(
            "fuck", "fck", "fuk", "shit", "bitch", "asshole", "arsehole", "bastard", "cunt", "dickhead", "motherfucker", "wanker",
            "poes", "naai", "doos", "kak", "fokof", "voetsek", "msunu", "masepa");

    public Result check(String raw) {
        if (raw == null) return new Result(Action.ALLOW, null, null);
        String text = raw.strip();

        if (PHONE.matcher(text).find()) return block("err.filter.phone");
        if (EMAIL.matcher(text).find()) return block("err.filter.email");
        if (SA_ID.matcher(text).find()) return block("err.filter.id");
        if (PLATE.matcher(text.toUpperCase(Locale.ROOT)).find()) {
            return block("err.filter.plate");
        }

        String norm = normalise(text);
        for (Pattern p : THREATS) if (p.matcher(norm).find()) {
            return block("err.filter.threat");
        }
        for (Pattern p : SLURS) if (p.matcher(norm).find()) return block("err.filter.hate");

        // Mask profanity in the original text, matching through the same evasion-tolerant patterns.
        String masked = text;
        boolean changed = false;
        for (Pattern p : PROFANITY) {
            Matcher m = p.matcher(normaliseKeepLength(masked));
            StringBuilder sb = new StringBuilder(masked);
            boolean any = false;
            while (m.find()) { for (int i = m.start(); i < m.end(); i++) sb.setCharAt(i, '•'); any = true; }
            if (any) { masked = collapseMask(sb.toString()); changed = true; }
        }
        return changed ? new Result(Action.MASK, masked, "err.filter.masked") : new Result(Action.ALLOW, text, null);
    }

    private static Result block(String reason) { return new Result(Action.BLOCK, null, reason); }

    /** Lower-case, look-alikes to letters; same length as the input so match positions line up. */
    static String normaliseKeepLength(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char c : s.toLowerCase(Locale.ROOT).toCharArray()) {
            b.append(switch (c) {
                case '0' -> 'o'; case '1', '!', '|' -> 'i'; case '3' -> 'e'; case '4', '@' -> 'a';
                case '5', '$' -> 's'; case '7', '+' -> 't'; case '8' -> 'b';
                default -> c;
            });
        }
        return b.toString();
    }

    /** For phrase rules: also squash punctuation to spaces and collapse whitespace. */
    static String normalise(String s) {
        return normaliseKeepLength(s).replaceAll("[^a-z\\s]", " ").replaceAll("\\s+", " ");
    }

    /** Each letter may repeat, and letters may be split by dots, dashes, spaces or underscores. Whole words only. */
    private static List<Pattern> terms(String... words) {
        return java.util.Arrays.stream(words).map(w -> {
            StringBuilder re = new StringBuilder("(?<![a-z])");
            for (int i = 0; i < w.length(); i++) {
                re.append(Pattern.quote(String.valueOf(w.charAt(i)))).append('+');
                if (i < w.length() - 1) re.append("[\\s._*-]{0,2}");
            }
            re.append("(?![a-z])");
            return Pattern.compile(re.toString());
        }).toList();
    }

    private static String collapseMask(String s) { return s.replaceAll("•{4,}", "•••"); }
}
