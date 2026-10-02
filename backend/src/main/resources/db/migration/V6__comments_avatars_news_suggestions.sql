-- Reports can come from verified news (moderator-approved suggestions), with the source kept for transparency.
ALTER TABLE crime_reports ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (source IN ('USER', 'NEWS'));
ALTER TABLE crime_reports ADD COLUMN source_url TEXT;
ALTER TABLE crime_reports ADD COLUMN source_name VARCHAR(120);

-- News → report suggestions. Never shown publicly; a moderator must accept one to create a report.
CREATE TABLE news_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash        VARCHAR(64) NOT NULL UNIQUE,
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  source_domain   VARCHAR(120),
  published_at    TIMESTAMPTZ,
  area            VARCHAR(120),
  crime_type      VARCHAR(30) NOT NULL,
  confidence      DOUBLE PRECISION NOT NULL,
  place_name      VARCHAR(200) NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  precision_m     INTEGER NOT NULL,
  corroborations  INTEGER NOT NULL DEFAULT 1,
  other_sources   TEXT,
  status          VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DISMISSED')),
  report_id       UUID REFERENCES crime_reports(id) ON DELETE SET NULL,
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suggestions_status ON news_suggestions (status, created_at);

-- Profile pictures: re-encoded 256x256 JPEG (metadata stripped), served by an unguessable token.
ALTER TABLE users ADD COLUMN avatar BYTEA;
ALTER TABLE users ADD COLUMN avatar_token VARCHAR(40) UNIQUE;

-- Comments on reports, with community flagging.
CREATE TABLE report_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES crime_reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE', 'HIDDEN')),
  flags       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_report ON report_comments (report_id, created_at);
CREATE INDEX idx_comments_user_time ON report_comments (user_id, created_at);

CREATE TABLE comment_flags (
  comment_id  UUID NOT NULL REFERENCES report_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
