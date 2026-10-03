-- Per-user language for notifications and server messages.
ALTER TABLE users ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'af', 'zu', 'xh'));

-- "Seen it too": one confirmation per person per report.
CREATE TABLE report_confirmations (
  report_id   UUID NOT NULL REFERENCES crime_reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);
CREATE INDEX idx_confirmations_report ON report_confirmations (report_id);

-- Time-aware hotspots: weekday vs weekend pattern.
ALTER TABLE crime_hotspots ADD COLUMN peak_days VARCHAR(10);

-- "Walk with me": a friend virtually escorts you.
ALTER TABLE location_shares DROP CONSTRAINT IF EXISTS location_shares_reason_check;
ALTER TABLE location_shares ADD CONSTRAINT location_shares_reason_check CHECK (reason IN ('MANUAL', 'PANIC', 'ESCORT'));
CREATE TABLE escort_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  walker_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escort_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             VARCHAR(10) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ACTIVE', 'ENDED', 'DECLINED')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  anchor_lat         TEXT,
  anchor_lng         TEXT,
  last_moved_at      TIMESTAMPTZ,
  stationary_alerted BOOLEAN NOT NULL DEFAULT FALSE,
  lost_alerted       BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_escort_active ON escort_sessions (status) WHERE status IN ('REQUESTED', 'ACTIVE');

-- Neighbourhood watch / estate / CPF groups. plan is FREE for now; a paid ESTATE tier comes later.
CREATE TABLE watch_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(80) NOT NULL,
  description   VARCHAR(500),
  kind          VARCHAR(10) NOT NULL DEFAULT 'WATCH' CHECK (kind IN ('WATCH', 'ESTATE', 'CPF')),
  plan          VARCHAR(10) NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'ESTATE')),
  invite_code   VARCHAR(12) NOT NULL UNIQUE,
  area_lat      DOUBLE PRECISION,
  area_lng      DOUBLE PRECISION,
  area_radius_m INTEGER NOT NULL DEFAULT 2000,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE watch_group_members (
  group_id   UUID NOT NULL REFERENCES watch_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  sos_share  BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON watch_group_members (user_id);
CREATE TABLE watch_group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES watch_groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_alert    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_posts ON watch_group_posts (group_id, created_at DESC);

-- Community-reported power outages. Positions are rounded to ~200 m; reporters are never shown.
CREATE TABLE outage_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at  TIMESTAMPTZ
);
CREATE INDEX idx_outages_open ON outage_reports (created_at) WHERE restored_at IS NULL;
