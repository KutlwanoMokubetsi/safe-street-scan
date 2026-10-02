package za.co.crimespot.user;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import za.co.crimespot.common.BadRequestException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Semaphore;

/**
 * Profile pictures. Every upload is decoded and re-encoded as a 256x256 JPEG, which strips EXIF metadata
 * (including GPS position) and anything hidden in the file. Dimensions are checked before decoding so a
 * huge image can't exhaust memory, and at most two images are processed at once.
 */
@Service
public class AvatarService {

    public static final int MAX_BYTES = 3 * 1024 * 1024;
    private static final int MAX_SIDE = 4096, OUT = 256;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Semaphore slots = new Semaphore(2);
    private final JdbcTemplate jdbc;

    public AvatarService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public String save(UUID userId, byte[] data) {
        byte[] jpeg = process(data);
        byte[] t = new byte[16];
        RANDOM.nextBytes(t);
        String token = HexFormat.of().formatHex(t); // new token each time: old URLs stop working, caches refresh
        jdbc.update("UPDATE users SET avatar = ?, avatar_token = ? WHERE id = ?", jpeg, token, userId);
        return token;
    }

    public void remove(UUID userId) {
        jdbc.update("UPDATE users SET avatar = NULL, avatar_token = NULL WHERE id = ?", userId);
    }

    public byte[] load(String token) {
        if (token == null || !token.matches("[0-9a-f]{32}")) return null;
        List<byte[]> rows = jdbc.query("SELECT avatar FROM users WHERE avatar_token = ?", (rs, i) -> rs.getBytes(1), token);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private byte[] process(byte[] data) {
        if (data == null || data.length == 0) throw new BadRequestException("Choose a picture.");
        if (data.length > MAX_BYTES) throw new BadRequestException("That picture is too large. Choose one under 3 MB.");
        if (!slots.tryAcquire()) throw new BadRequestException("Busy processing pictures. Try again in a moment.");
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw new BadRequestException("Use a JPEG or PNG picture.");
            ImageReader reader = readers.next();
            String fmt = reader.getFormatName().toLowerCase();
            if (!fmt.equals("jpeg") && !fmt.equals("png")) throw new BadRequestException("Use a JPEG or PNG picture.");
            reader.setInput(in, true, true);
            int w = reader.getWidth(0), h = reader.getHeight(0);
            if (w > MAX_SIDE || h > MAX_SIDE || w < 32 || h < 32) throw new BadRequestException("Use a picture between 32 and 4096 pixels wide.");
            BufferedImage src = reader.read(0);
            reader.dispose();

            int side = Math.min(w, h);
            BufferedImage out = new BufferedImage(OUT, OUT, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, OUT, OUT); // transparent PNGs get a white background
            g.drawImage(src, 0, 0, OUT, OUT, (w - side) / 2, (h - side) / 2, (w - side) / 2 + side, (h - side) / 2 + side, null);
            g.dispose();

            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            ImageWriteParam p = writer.getDefaultWriteParam();
            p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            p.setCompressionQuality(0.85f);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (MemoryCacheImageOutputStream mos = new MemoryCacheImageOutputStream(bytes)) {
                writer.setOutput(mos);
                writer.write(null, new javax.imageio.IIOImage(out, null, null), p);
            }
            writer.dispose();
            return bytes.toByteArray();
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("That file couldn't be read as a picture.");
        } finally {
            slots.release();
        }
    }
}
