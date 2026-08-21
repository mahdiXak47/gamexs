#!/usr/bin/env bash
# Daily scrape-and-load for all sellers, running two sellers in parallel per round.
# Designed to run inside the k8s CronJob container.
#
# Required env vars (injected from a k8s Secret):
#   DATABASE_URL   — e.g. postgresql://gamexs:gamexs@gamexs-db.mahdixak-gamexs.svc:5432/gamexs
#   HTTPS_PROXY    — e.g. http://user:pass@proxy.host:port
#
# Output files are written to /tmp (ephemeral per pod run — no volume needed).

set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# Scrape one seller into /tmp/<seller>.jsonl, return non-zero on failure.
# ---------------------------------------------------------------------------
scrape_seller() {
    local seller=$1
    log "START scraping $seller"
    if python -m gamexs_scraper.export_csv "$seller" \
            -o "/tmp/${seller}.csv" \
            --cache "/tmp/${seller}.jsonl" 2>&1 | sed "s/^/[$seller] /"; then
        log "DONE  scraping $seller"
    else
        log "FAIL  scraping $seller (exit $?)"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Load one seller's JSONL into the DB, return non-zero on failure.
# ---------------------------------------------------------------------------
load_seller() {
    local seller=$1
    if [ ! -f "/tmp/${seller}.jsonl" ]; then
        log "SKIP  loading $seller — no JSONL (scrape failed?)"
        return 1
    fi
    log "START loading $seller"
    if python -m gamexs_scraper.load_to_postgres "$seller" \
            --cache "/tmp/${seller}.jsonl" 2>&1 | sed "s/^/[$seller] /"; then
        log "DONE  loading $seller"
    else
        log "FAIL  loading $seller (exit $?)"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Run a pair of sellers: scrape both in parallel, then load sequentially.
# A failure in one scraper does not abort the other or the overall script.
# ---------------------------------------------------------------------------
run_pair() {
    local s1=$1
    local s2=${2:-}

    # Scrape in parallel
    scrape_seller "$s1" &
    local pid1=$!
    local pid2=""
    if [ -n "$s2" ]; then
        scrape_seller "$s2" &
        pid2=$!
    fi

    # Wait for both — collect exit codes without aborting on failure
    local ok=true
    wait "$pid1" || ok=false
    if [ -n "$pid2" ]; then
        wait "$pid2" || ok=false
    fi

    # Load sequentially (so DB writes don't contend)
    load_seller "$s1" || ok=false
    [ -n "$s2" ] && { load_seller "$s2" || ok=false; }

    $ok
}

# ---------------------------------------------------------------------------
# Main: pairs chosen to balance scrape time (heavy sellers separated).
# ---------------------------------------------------------------------------
log "=== GameXS daily scrape started ==="

failed_sellers=""

run_pair pspro       digikala     || failed_sellers+=" pspro/digikala"
run_pair gamario     gameonestore || failed_sellers+=" gamario/gameonestore"
run_pair gamecenter  gameplayshop || failed_sellers+=" gamecenter/gameplayshop"
run_pair xgamesstore nakhlmarket  || failed_sellers+=" xgamesstore/nakhlmarket"
run_pair parsconsole cdkeyshare   || failed_sellers+=" parsconsole/cdkeyshare"
run_pair persianconsole yungcenter|| failed_sellers+=" persianconsole/yungcenter"
run_pair technolife               || failed_sellers+=" technolife"

# ---------------------------------------------------------------------------
# Enrich new/unmatched games with IGDB metadata (cover, genre, publisher, year).
# Runs after all sellers are loaded so new slugs from this run are included.
# ---------------------------------------------------------------------------
log "=== IGDB enrichment ==="
python -m gamexs_scraper.enrich_metadata 2>&1 | sed 's/^/[igdb] /' || \
    log "WARN  IGDB enrichment failed — new games will lack metadata but prices are unaffected"

# ---------------------------------------------------------------------------
# Refresh official PS Store pricing (US/TR) for every ps5_games row with an
# igdb_id. Runs after enrichment so newly-matched games from this run are
# included. Soft-fails like enrichment — a PS Store hiccup shouldn't fail the
# whole nightly scrape.
# ---------------------------------------------------------------------------
log "=== PS Store price fetch ==="
python fetch_psstore_prices.py --db-url "$DATABASE_URL" 2>&1 | sed 's/^/[psstore] /' || \
    log "WARN  PS Store price fetch failed — ps5_store_info will be stale but prices are unaffected"

# ---------------------------------------------------------------------------
# Upload newly downloaded IGDB covers/screenshots to object storage and
# write the S3 URLs back into games.cover_url / games.screenshot_ids.
# The script is idempotent — files already in the bucket are skipped.
# Requires: S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET env vars.
# ---------------------------------------------------------------------------
log "=== S3 cover upload ==="
python upload_to_s3.py --db-url "$DATABASE_URL" 2>&1 | sed 's/^/[s3] /' || \
    log "WARN  S3 upload failed — covers will fall back to IGDB CDN"

# ---------------------------------------------------------------------------
# Post-run cleanup: mark listings not seen in 3+ days as inactive,
# then remove games that have no remaining active listings.
# ---------------------------------------------------------------------------
log "=== Post-run DB cleanup ==="
python -m gamexs_scraper.maintenance 2>&1 | sed 's/^/[cleanup] /' || \
    log "WARN  DB cleanup failed — stale listings and orphaned games will remain"

# ---------------------------------------------------------------------------
# Optional: Telegram channel price feeds (e.g. @PlayBox_Account). Requires
# TELEGRAM_API_ID / TELEGRAM_API_HASH env vars and a pre-authenticated session
# file (see scraper/gamexs_scraper/adapters/telegram_channel.py). Soft-fails like every
# other step so a Telegram hiccup doesn't fail the whole run.
# ---------------------------------------------------------------------------
if [ -n "${TELEGRAM_API_ID:-}" ] && [ -n "${TELEGRAM_API_HASH:-}" ]; then
    log "=== Telegram channel scrape ==="
    if python -m gamexs_scraper.adapters.telegram_channel playbox \
            --cache "/tmp/playbox_offers.jsonl" 2>&1 | sed 's/^/[telegram] /' \
        && [ -f "/tmp/playbox_offers.jsonl" ]; then
        python -m gamexs_scraper.load_to_postgres playbox \
            --cache "/tmp/playbox_offers.jsonl" 2>&1 | sed 's/^/[telegram-load] /' || \
            log "WARN  Telegram channel load failed — playbox prices will be stale"
    else
        log "WARN  Telegram channel scrape failed — playbox prices will be stale"
    fi
else
    log "SKIP  Telegram channel scrape — TELEGRAM_API_ID/HASH not set"
fi

# ---------------------------------------------------------------------------
# Final status
# ---------------------------------------------------------------------------
if [ -n "$failed_sellers" ]; then
    log "=== COMPLETED WITH FAILURES: $failed_sellers ==="
    exit 1
fi
log "=== GameXS daily scrape completed successfully ==="
