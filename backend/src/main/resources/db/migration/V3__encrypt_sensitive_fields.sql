-- Sensitive values are now stored encrypted (AES-256-GCM, "enc1:..." strings), so they become text.
-- Existing plaintext values are encrypted by the application at startup (LegacyEncryptionMigrator).
ALTER TABLE users
  ALTER COLUMN full_name TYPE TEXT,
  ALTER COLUMN phone TYPE TEXT;

ALTER TABLE user_locations
  ALTER COLUMN latitude TYPE TEXT USING latitude::text,
  ALTER COLUMN longitude TYPE TEXT USING longitude::text,
  ALTER COLUMN accuracy_m TYPE TEXT USING accuracy_m::text;

ALTER TABLE panic_alerts
  ALTER COLUMN latitude TYPE TEXT USING latitude::text,
  ALTER COLUMN longitude TYPE TEXT USING longitude::text,
  ALTER COLUMN accuracy_m TYPE TEXT USING accuracy_m::text,
  ALTER COLUMN message TYPE TEXT;

ALTER TABLE push_subscriptions
  ALTER COLUMN p256dh TYPE TEXT,
  ALTER COLUMN auth TYPE TEXT;
