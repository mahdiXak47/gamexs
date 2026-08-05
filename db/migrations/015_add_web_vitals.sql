-- Migration 015: self-hosted Core Web Vitals sink table.
-- One row per metric submitted by the frontend's /api/web-vitals route.
--
-- Run against an existing volume: psql -U gamexs -d gamexs -f 015_add_web_vitals.sql
--
-- Safe to re-run: uses IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS web_vitals (
    id BIGSERIAL PRIMARY KEY,
    metric_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    delta DOUBLE PRECISION,
    rating TEXT,
    navigation_type TEXT,
    path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at ON web_vitals (created_at);
CREATE INDEX IF NOT EXISTS idx_web_vitals_name ON web_vitals (name);
