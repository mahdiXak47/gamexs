-- Anonymous first-party pageview analytics for existing databases.
CREATE TABLE IF NOT EXISTS site_page_views (
    id BIGSERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_page_views_created_at
    ON site_page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_page_views_path_created_at
    ON site_page_views (path, created_at DESC);
