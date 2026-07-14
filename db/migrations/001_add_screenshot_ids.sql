-- Migration 001: add screenshot_ids column to games
-- Run against any existing DB that was created before this schema change.
--
--   docker exec -it gamexs-postgres psql -U gamexs -d gamexs -f /dev/stdin < db/migrations/001_add_screenshot_ids.sql
--   # or for production:
--   kubectl exec -it <postgres-pod> -- psql -U postgres -d gamexs -c "ALTER TABLE games ADD COLUMN IF NOT EXISTS screenshot_ids TEXT[];"

ALTER TABLE games ADD COLUMN IF NOT EXISTS screenshot_ids TEXT[];
