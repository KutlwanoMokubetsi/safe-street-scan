package za.co.crimespot.comments;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import za.co.crimespot.auth.AuthUser;
import za.co.crimespot.common.BadRequestException;
import za.co.crimespot.common.NotFoundException;
import za.co.crimespot.moderation.ContentFilter;
import za.co.crimespot.push.NotificationService;
import za.co.crimespot.report.CrimeReport;
import za.co.crimespot.report.CrimeReportRepository;
import za.co.crimespot.report.ReportStatus;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class CommentService {

    private static final int HIDE_AFTER_FLAGS = 3;
    private static final int MAX_PER_10_MIN = 10;

    public record CommentDto(UUID id, String author, String role, String body, Instant createdAt,
                             boolean mine, boolean flaggedByMe, boolean hidden) {}

    public record PostResult(CommentDto comment, String notice) {}

    private final CommentRepository comments;
    private final CrimeReportRepository reports;
    private final ContentFilter filter;
    private final NotificationService notifications;
    private final byte[] pseudonymKey;

    public CommentService(CommentRepository comments, CrimeReportRepository reports, ContentFilter filter,
                          NotificationService notifications, @Value("${app.crypto.key:}") String key) {
        this.comments = comments;
        this.reports = reports;
        this.filter = filter;
        this.notifications = notifications;
        this.pseudonymKey = ("crimespot-pseudonym|" + key).getBytes(StandardCharsets.UTF_8);
    }

    public List<CommentDto> list(AuthUser me, UUID reportId) {
        CrimeReport r = visibleReport(me, reportId);
        List<Comment> list = comments.findByReportIdOrderByCreatedAtAsc(reportId, PageRequest.of(0, 200));
        List<UUID> ids = list.stream().map(Comment::getId).toList();
        Set<UUID> flagged = ids.isEmpty() ? Set.of() : new HashSet<>(comments.flaggedAmong(me.id(), ids));
        return list.stream()
                .filter(c -> c.getStatus() == Comment.Status.VISIBLE || me.canModerate() || c.getUserId().equals(me.id()))
                .map(c -> dto(me, r, c, flagged.contains(c.getId()))).toList();
    }

    @Transactional
    public PostResult post(AuthUser me, UUID reportId, String body) {
        CrimeReport r = visibleReport(me, reportId);
        if (r.getStatus() == ReportStatus.REJECTED) throw new BadRequestException("This report isn't open for comments.");
        if (body == null || body.isBlank()) throw new BadRequestException("err.comment.empty");
        if (body.length() > 1000) throw new BadRequestException("err.comment.long");
        if (comments.countByUserIdAndCreatedAtAfter(me.id(), Instant.now().minus(Duration.ofMinutes(10))) >= MAX_PER_10_MIN) {
            throw new BadRequestException("err.comment.rate");
        }
        ContentFilter.Result check = filter.check(body);
        if (check.blocked()) throw new BadRequestException(check.reason());

        Comment c = new Comment();
        c.setReportId(reportId);
        c.setUserId(me.id());
        c.setBody(check.text());
        comments.save(c);

        if (!r.getUserId().equals(me.id())) {
            String previewText = preview(check.text());
            notifications.sendLocalized(List.of(r.getUserId()),
                    lang -> new String[] { za.co.crimespot.i18n.Messages.t(lang, "push.comment.title"), previewText }, "/reports/" + reportId, false);
        }
        String notice = check.reason() == null ? null
                : za.co.crimespot.i18n.Messages.t(za.co.crimespot.i18n.Localizer.requestLang(), check.reason());
        return new PostResult(dto(me, r, c, false), notice);
    }

    /** Community moderation: each person can flag once; enough flags hide the comment until a moderator looks. */
    @Transactional
    public void flag(AuthUser me, UUID commentId) {
        Comment c = comments.findById(commentId).orElseThrow(() -> new NotFoundException("Comment not found"));
        if (c.getUserId().equals(me.id())) throw new BadRequestException("You can't flag your own comment.");
        if (comments.addFlag(commentId, me.id()) == 0) return; // already flagged
        c.setFlags(c.getFlags() + 1);
        if (c.getFlags() >= HIDE_AFTER_FLAGS) c.setStatus(Comment.Status.HIDDEN);
        comments.save(c);
    }

    @Transactional
    public void delete(AuthUser me, UUID commentId) {
        Comment c = comments.findById(commentId).orElseThrow(() -> new NotFoundException("Comment not found"));
        if (!c.getUserId().equals(me.id()) && !me.canModerate()) throw new AccessDeniedException("Not your comment");
        comments.delete(c);
    }

    @Transactional
    public void setStatus(AuthUser me, UUID commentId, Comment.Status status) {
        if (!me.canModerate()) throw new AccessDeniedException("Moderators only");
        Comment c = comments.findById(commentId).orElseThrow(() -> new NotFoundException("Comment not found"));
        c.setStatus(status);
        if (status == Comment.Status.VISIBLE) c.setFlags(0);
        comments.save(c);
    }

    public List<Map<String, Object>> hidden() {
        return comments.findByStatusOrderByCreatedAtDesc(Comment.Status.HIDDEN, PageRequest.of(0, 100)).stream()
                .map(c -> Map.<String, Object>of("id", c.getId(), "reportId", c.getReportId(), "body", c.getBody(),
                        "flags", c.getFlags(), "createdAt", c.getCreatedAt())).toList();
    }

    private CrimeReport visibleReport(AuthUser me, UUID reportId) {
        CrimeReport r = reports.findById(reportId).orElseThrow(() -> new NotFoundException("Report not found"));
        if (r.getStatus() == ReportStatus.REJECTED && !me.canModerate() && !r.getUserId().equals(me.id())) {
            throw new NotFoundException("Report not found");
        }
        return r;
    }

    /**
     * Commenters stay anonymous: a short code that's stable within one report but different on every report,
     * derived with a server-side key so it can't be reversed or linked across reports.
     */
    private CommentDto dto(AuthUser me, CrimeReport r, Comment c, boolean flaggedByMe) {
        boolean mine = c.getUserId().equals(me.id());
        String role = c.getUserId().equals(r.getUserId()) ? "REPORTER" : null;
        String author = mine ? "You" : role != null ? "Reporter" : "Neighbour " + pseudonym(r.getId(), c.getUserId());
        return new CommentDto(c.getId(), author, role, c.getBody(), c.getCreatedAt(), mine, flaggedByMe,
                c.getStatus() == Comment.Status.HIDDEN);
    }

    private String pseudonym(UUID reportId, UUID userId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pseudonymKey, "HmacSHA256"));
            byte[] h = mac.doFinal((reportId + "|" + userId).getBytes(StandardCharsets.UTF_8));
            return String.format("%02X%02X", h[0], h[1]);
        } catch (Exception e) {
            return "";
        }
    }

    private static String preview(String s) { return s.length() > 90 ? s.substring(0, 87) + "…" : s; }
}
