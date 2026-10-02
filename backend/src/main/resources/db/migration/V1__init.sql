CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120),
  phone         VARCHAR(30),
  role          VARCHAR(20)  NOT NULL DEFAULT 'USER'
                CHECK (role IN ('USER', 'MODERATOR', 'ADMIN')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE crime_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crime_type    VARCHAR(30) NOT NULL
                CHECK (crime_type IN ('THEFT','ASSAULT','VANDALISM','BURGLARY','ROBBERY',
                                      'HIJACKING','DRUG_RELATED','FRAUD','SUSPICIOUS_ACTIVITY','OTHER')),
  description   TEXT NOT NULL,
  location_name VARCHAR(200),
  latitude      DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude     DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  occurred_at   TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','VERIFIED','REJECTED')),
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_location    ON crime_reports (latitude, longitude);
CREATE INDEX idx_reports_occurred_at ON crime_reports (occurred_at);
CREATE INDEX idx_reports_status      ON crime_reports (status);
CREATE INDEX idx_reports_user        ON crime_reports (user_id);

CREATE TABLE crime_hotspots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(200) NOT NULL,
  center_latitude  DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_meters    INTEGER NOT NULL,
  intensity_score  DOUBLE PRECISION NOT NULL CHECK (intensity_score BETWEEN 0 AND 1),
  crime_count      INTEGER NOT NULL DEFAULT 0,
  top_crime_type   VARCHAR(30),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_hotspots_valid_until ON crime_hotspots (valid_until);
