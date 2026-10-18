-- Migration 033: live pipeline progress for the admin panel.
-- One pipeline_runs row per scrape_all.sh cycle; one pipeline_steps row per
-- seller/task in it, updated while the step runs (progress, heartbeat, log tail).

BEGIN;

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id           BIGSERIAL PRIMARY KEY,
    status       TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'abandoned')),
    summary      TEXT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_steps (
    id              BIGSERIAL PRIMARY KEY,
    pipeline_run_id BIGINT NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'abandoned')),
    progress_done   INT CHECK (progress_done >= 0),
    progress_total  INT CHECK (progress_total >= 0),
    message         TEXT,
    log_tail        TEXT,
    exit_code       INT,
    started_at      TIMESTAMPTZ,
    heartbeat_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    UNIQUE (pipeline_run_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_steps_name_completed ON pipeline_steps (name, completed_at DESC);

COMMIT;
