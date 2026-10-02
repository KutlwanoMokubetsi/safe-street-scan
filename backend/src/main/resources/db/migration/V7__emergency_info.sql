-- Emergency info card (medical details, emergency contact). Encrypted JSON; shared with friends only
-- during an active SOS, and only with the person's explicit consent (POPIA special personal information).
ALTER TABLE users ADD COLUMN emergency_info TEXT;
ALTER TABLE users ADD COLUMN emergency_consent BOOLEAN NOT NULL DEFAULT FALSE;
