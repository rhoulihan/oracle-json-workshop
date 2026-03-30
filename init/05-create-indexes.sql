-- 05-create-indexes.sql
-- Creates functional, multi-value, and search indexes.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

-- Single-table design: primary access pattern (pk + sk)
CREATE INDEX idx_pk_sk ON advisory_entities (
    data.pk.string(),
    data.sk.string()
);

-- Single-table design: GSI equivalent
CREATE INDEX idx_gsi1 ON advisory_entities (
    data.gsi1pk.string(),
    data.gsi1sk.string()
);

-- Multi-value index on tags array
CREATE MULTIVALUE INDEX idx_tags ON advisory_entities ae
    (ae.data.data.tags.string());

-- Multi-value index on sectors array
CREATE MULTIVALUE INDEX idx_sectors ON advisory_entities ae
    (ae.data.data.sectors.string());

-- Full-text search index on client_interactions
CREATE SEARCH INDEX idx_interactions_search
ON client_interactions (data) FOR JSON;

COMMIT;
