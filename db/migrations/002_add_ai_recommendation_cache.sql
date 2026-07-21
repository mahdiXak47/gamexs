-- Migration 002: cache table for AI-generated "similar games" recommendations.
CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
    game_id INT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    prompt_version SMALLINT NOT NULL,
    recommendations JSONB NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, prompt_version)
);
