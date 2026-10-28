CREATE TABLE datasets(owner TEXT PRIMARY KEY, version TEXT NOT NULL, stats TEXT NOT NULL);
CREATE TABLE properties(owner TEXT NOT NULL, version TEXT NOT NULL, id INTEGER NOT NULL, house TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(owner,version,id));
CREATE INDEX property_house ON properties(owner,version,house);
CREATE TABLE uploads(owner TEXT PRIMARY KEY, version TEXT NOT NULL, next_id INTEGER NOT NULL DEFAULT 0);
