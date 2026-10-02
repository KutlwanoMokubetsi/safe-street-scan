-- Authentication moves to Keycloak: no local passwords any more.
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users ADD COLUMN keycloak_id VARCHAR(64) UNIQUE;
ALTER TABLE users ADD COLUMN friend_code VARCHAR(12) UNIQUE;
UPDATE users SET friend_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE friend_code IS NULL;
ALTER TABLE users ALTER COLUMN friend_code SET NOT NULL;

CREATE TABLE friendships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  CONSTRAINT friendship_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendship_unique UNIQUE (requester_id, addressee_id)
);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id);

-- Only the latest position is kept, and only while the person is sharing.
CREATE TABLE user_locations (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy_m  DOUBLE PRECISION,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE location_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      VARCHAR(20) NOT NULL CHECK (reason IN ('MANUAL', 'PANIC')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ
);
CREATE INDEX idx_location_shares_user ON location_shares (user_id) WHERE ended_at IS NULL;

CREATE TABLE location_share_viewers (
  share_id   UUID NOT NULL REFERENCES location_shares(id) ON DELETE CASCADE,
  viewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (share_id, viewer_id)
);
CREATE INDEX idx_share_viewers_viewer ON location_share_viewers (viewer_id);

CREATE TABLE panic_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  accuracy_m   DOUBLE PRECISION,
  message      VARCHAR(280),
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX idx_panic_user_status ON panic_alerts (user_id, status);

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      VARCHAR(255) NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_user ON push_subscriptions (user_id);
