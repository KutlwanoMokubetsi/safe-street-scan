-- DBSCAN hotspots carry pattern insights: busiest 4-hour window and 7-day trend.
ALTER TABLE crime_hotspots ADD COLUMN peak_hours VARCHAR(20);
ALTER TABLE crime_hotspots ADD COLUMN trend VARCHAR(10);
