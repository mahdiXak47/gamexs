-- Migration 032: persist per-seller scrape attempts and health outcomes.

BEGIN;

CREATE TABLE IF NOT EXISTS scrape_runs (
    id BIGSERIAL PRIMARY KEY,
    seller_id INT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    observed_games INT CHECK (observed_games >= 0),
    loaded_games INT CHECK (loaded_games >= 0),
    loaded_listings INT CHECK (loaded_listings >= 0),
    failure_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_seller_started
    ON scrape_runs (seller_id, started_at DESC);

CREATE TABLE IF NOT EXISTS scrape_run_attempts (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL REFERENCES scrape_runs (id) ON DELETE CASCADE,
    attempt_no INT NOT NULL CHECK (attempt_no > 0),
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'suspicious')),
    observed_games INT CHECK (observed_games >= 0),
    loaded_games INT CHECK (loaded_games >= 0),
    loaded_listings INT CHECK (loaded_listings >= 0),
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE (run_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_scrape_run_attempts_run_id
    ON scrape_run_attempts (run_id, attempt_no);

COMMIT;
