-- "Check in by" timer on a location share: friends are alerted if you don't check in on time.
ALTER TABLE location_shares ADD COLUMN checkin_due_at TIMESTAMPTZ;
ALTER TABLE location_shares ADD COLUMN escalated_at TIMESTAMPTZ;
CREATE INDEX idx_shares_checkin_due ON location_shares (checkin_due_at)
  WHERE checkin_due_at IS NOT NULL AND ended_at IS NULL AND escalated_at IS NULL;

-- Alerts near home: home point is encrypted like other location data; radius 0 means off.
ALTER TABLE users ADD COLUMN home_lat TEXT;
ALTER TABLE users ADD COLUMN home_lng TEXT;
ALTER TABLE users ADD COLUMN alert_radius_m INTEGER NOT NULL DEFAULT 0;
