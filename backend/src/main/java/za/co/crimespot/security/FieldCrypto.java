package za.co.crimespot.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for sensitive columns (phone, names, locations, SOS messages, push keys).
 * The key comes from DATA_ENCRYPTION_KEY and never touches the database, so a leaked database
 * or backup does not reveal these values.
 *
 * Stored format: "enc1:" + base64(12-byte IV || ciphertext+tag). Values without the prefix are
 * treated as legacy plaintext and get encrypted by {@link LegacyEncryptionMigrator}.
 */
@Component
public class FieldCrypto {

    static final String PREFIX = "enc1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile SecretKeySpec key;

    public FieldCrypto(@Value("${app.crypto.key:}") String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalStateException(
                    "DATA_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
        }
        byte[] raw = Base64.getDecoder().decode(base64Key.trim());
        if (raw.length != 32) throw new IllegalStateException("DATA_ENCRYPTION_KEY must be 32 bytes (base64)");
        key = new SecretKeySpec(raw, "AES");
    }

    public static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public static String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, requireKey(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public static String decrypt(String stored) {
        if (stored == null) return null;
        if (!isEncrypted(stored)) return stored; // legacy plaintext, migrated at startup
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(c.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Wrong key or tampered value: fail loudly rather than return garbage.
            throw new IllegalStateException("Decryption failed (wrong DATA_ENCRYPTION_KEY or tampered data)", e);
        }
    }

    private static SecretKeySpec requireKey() {
        if (key == null) throw new IllegalStateException("FieldCrypto not initialised");
        return key;
    }
}
