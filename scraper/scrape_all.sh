#!/usr/bin/env bash
# Daily scrape-and-load for all sellers, running two sellers in parallel per round.
# Designed to run inside the scraper image, either through runner.py or as a
# one-shot command for an external scheduler.
#
# Required env vars (injected from a k8s Secret):
#   DATABASE_URL   — e.g. postgresql://gamexs:gamexs@gamexs-db.mahdixak-gamexs.svc:5432/gamexs
#   HTTPS_PROXY    — e.g. http://user:pass@proxy.host:port
#
# Output files are written to /tmp (ephemeral per pod run — no volume needed).

set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# Scrape, validate, load, and retry one seller; return non-zero on failure.
# ---------------------------------------------------------------------------
run_seller() {
    local seller=$1
    log "START scraping $seller"
    if python -m gamexs_scraper.seller_runner "$seller" \
            --output-dir /tmp 2>&1 | sed "s/^/[$seller] /"; then
        log "DONE  scraping and loading $seller"
    else
        log "FAIL  scraping and loading $seller"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Run a pair of sellers sequentially. Each seller owns its scrape/load retries;
# sequential execution preserves the low-contention DB load policy.
# A failure in one scraper does not abort the other or the overall script.
# ---------------------------------------------------------------------------
run_pair() {
    local s1=$1
    local s2=${2:-}

    # Collect exit codes without aborting on failure.
    local ok=true
    run_seller "$s1" || ok=false
    [ -n "$s2" ] && { run_seller "$s2" || ok=false; }

    $ok
}

# ---------------------------------------------------------------------------
# Main: seller groups retained from the previous daily pipeline.
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

# Upera Game uses Crawl4AI because its WooCommerce variation catalog is more
# reliably captured through the shared Crawl4AI fetcher than the legacy adapter
# interface. The shared Python seller runner applies the same health contract
# and isolates its cache per attempt.
log "=== Upera Game Crawl4AI scrape ==="
if ! run_seller uperagame; then
    log "FAIL  scraping and loading uperagame"
    failed_sellers+=" uperagame"
fi

# ---------------------------------------------------------------------------
# Repair/enrich legacy catalog rows that already exist without IGDB metadata.
# New seller titles are deliberately not inserted by the price loader; they
# must pass an IGDB-first import before their prices can be loaded.
# ---------------------------------------------------------------------------
log "=== IGDB enrichment ==="
python -m gamexs_scraper.enrich_metadata 2>&1 | sed 's/^/[igdb] /' || \
    log "WARN  IGDB enrichment failed — unresolved catalog rows remain blocked"

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
# write the S3 URLs back into ps5_games.cover_url / ps5_games.screenshot_ids.
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
if [ -n "$failed_sellers" ]; then
    log "SKIP  DB cleanup — seller health failures detected:$failed_sellers"
else
    python -m gamexs_scraper.maintenance 2>&1 | sed 's/^/[cleanup] /' || {
        log "WARN  DB cleanup failed — stale listings and orphaned games will remain"
        failed_sellers+=" maintenance"
    }
fi

# ---------------------------------------------------------------------------
# Final status
# ---------------------------------------------------------------------------
if [ -n "$failed_sellers" ]; then
    log "=== COMPLETED WITH FAILURES: $failed_sellers ==="
    exit 1
fi
log "=== GameXS daily scrape completed successfully ==="
