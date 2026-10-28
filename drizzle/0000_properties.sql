-- Historical owner/version-scoped storage schema, mirrored for migration tooling.
-- Current hosted lookups use the generated Worker dataset; browser uploads are disabled.
-- Keep the two migration copies aligned; this documentation does not apply a migration.
-- datasets holds active source metadata, properties indexes records by house, and
-- uploads tracks ingestion progress for the earlier upload path.
CREATE TABLE datasets(owner TEXT PRIMARY KEY, version TEXT NOT NULL, stats TEXT NOT NULL);
CREATE TABLE properties(owner TEXT NOT NULL, version TEXT NOT NULL, id INTEGER NOT NULL, house TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(owner,version,id));
CREATE INDEX property_house ON properties(owner,version,house);
CREATE TABLE uploads(owner TEXT PRIMARY KEY, version TEXT NOT NULL, next_id INTEGER NOT NULL DEFAULT 0);
