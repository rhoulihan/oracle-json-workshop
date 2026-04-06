-- 05-create-indexes.sql
-- Creates functional, multi-value, and search indexes.

ALTER SESSION SET CONTAINER = FREEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = WORKSHOP_ADMIN;

-- Advisory entities: compound indexes on natural grouping attributes
CREATE INDEX idx_advisor ON advisory_entities (data.advisorId.number());
CREATE INDEX idx_account ON advisory_entities (data.accountId.number());
CREATE INDEX idx_symbol ON advisory_entities (data.symbol.string());

-- Multi-value indexes on array attributes
CREATE MULTIVALUE INDEX idx_tags ON advisory_entities ae
    (ae.data.tags.string());

CREATE MULTIVALUE INDEX idx_sectors ON advisory_entities ae
    (ae.data.sectors.string());

-- Full-text search index on client_interactions
CREATE SEARCH INDEX idx_interactions_search
ON client_interactions (data) FOR JSON;

COMMIT;
