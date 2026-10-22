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

# Admin-panel bookkeeping (gamexs_scraper/pipeline.py). Best-effort: if the DB
# is unreachable the run id is empty and `step` just runs the command.
pipeline() { python -m gamexs_scraper.pipeline "$@"; }
step() { local name=$1; shift; pipeline step "$name" -- "$@"; }

# ---------------------------------------------------------------------------
# Scrape, validate, load, and retry one seller; return non-zero on failure.
# ---------------------------------------------------------------------------
run_seller() {
    local seller=$1
    log "START scraping $seller"
    if step "$seller" python -m gamexs_scraper.seller_runner "$seller" \
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
GAMEXS_PIPELINE_RUN_ID=$(pipeline start \
    pspro digikala gamario gameonestore gamecenter gameplayshop xgamesstore \
    nakhlmarket parsconsole cdkeyshare persianconsole yungcenter technolife psnacctm fillgame \
    uperagame installments igdb psstore s3 cleanup trailers || true)
export GAMEXS_PIPELINE_RUN_ID

failed_sellers=""

run_pair pspro       digikala     || failed_sellers+=" pspro/digikala"
run_pair gamario     gameonestore || failed_sellers+=" gamario/gameonestore"
run_pair gamecenter  gameplayshop || failed_sellers+=" gamecenter/gameplayshop"
run_pair xgamesstore nakhlmarket  || failed_sellers+=" xgamesstore/nakhlmarket"
run_pair parsconsole cdkeyshare   || failed_sellers+=" parsconsole/cdkeyshare"
run_pair persianconsole yungcenter|| failed_sellers+=" persianconsole/yungcenter"
run_pair technolife    psnacctm   || failed_sellers+=" technolife/psnacctm"
run_pair fillgame                  || failed_sellers+=" fillgame"

# Upera Game has its own crawler (crawl_uperagame.py: plain HTTP, parses the
# WooCommerce variation JSON page by page so memory stays flat) behind the same
# seller-runner health contract, with its cache isolated per attempt.
log "=== Upera Game scrape ==="
if ! run_seller uperagame; then
    log "FAIL  scraping and loading uperagame"
    failed_sellers+=" uperagame"
fi

log "=== Installment options (خرید اقساطی) per seller ==="
step installments python detect_installments.py 2>&1 | sed 's/^/[installments] /' || \
    log "WARN  installment detection failed — sellers keep their last result"

# ---------------------------------------------------------------------------
# Repair/enrich legacy catalog rows that already exist without IGDB metadata.
# New seller titles are deliberately not inserted by the price loader; they
# must pass an IGDB-first import before their prices can be loaded.
# ---------------------------------------------------------------------------
log "=== IGDB enrichment ==="
step igdb python -m gamexs_scraper.enrich_metadata 2>&1 | sed 's/^/[igdb] /' || \
    log "WARN  IGDB enrichment failed — unresolved catalog rows remain blocked"

# ---------------------------------------------------------------------------
# Refresh official PS Store pricing (US/TR) for every ps5_games row with an
# igdb_id. Runs after enrichment so newly-matched games from this run are
# included. Soft-fails like enrichment — a PS Store hiccup shouldn't fail the
# whole nightly scrape.
# ---------------------------------------------------------------------------
log "=== PS Store price fetch ==="
step psstore python fetch_psstore_prices.py --db-url "$DATABASE_URL" 2>&1 | sed 's/^/[psstore] /' || \
    log "WARN  PS Store price fetch failed — ps5_store_info will be stale but prices are unaffected"

# ---------------------------------------------------------------------------
# Upload newly downloaded IGDB covers/screenshots to object storage and
# write the S3 URLs back into ps5_games.cover_url / ps5_games.screenshot_ids.
# The script is idempotent — files already in the bucket are skipped.
# Requires: S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET env vars.
# ---------------------------------------------------------------------------

log "=== S3 cover upload ==="
step s3 python upload_to_s3.py --db-url "$DATABASE_URL" 2>&1 | sed 's/^/[s3] /' || \
    log "WARN  S3 upload failed — covers will fall back to IGDB CDN"

# ---------------------------------------------------------------------------
# Post-run cleanup: mark listings not seen in 3+ days as inactive (games are
# never deleted, see maintenance.py). Runs even when a seller failed: a shop that has been
# failing for 3+ days is exactly when its old prices must stop showing as
# current, and the 3-day window already absorbs a transient outage.
# ---------------------------------------------------------------------------
log "=== Post-run DB cleanup ==="
step cleanup python -m gamexs_scraper.maintenance 2>&1 | sed 's/^/[cleanup] /' || {
    log "WARN  DB cleanup failed — stale listings stay visible"
    failed_sellers+=" maintenance"
}

# Trailers last: each 720p transcode takes minutes on the pod's CPU quota, so
# they must not delay the S3 upload and stale-listing cleanup above.
log "=== Game trailers (PS Store → 720p → S3) ==="
step trailers python fetch_trailers.py --limit "${TRAILERS_PER_RUN:-60}" 2>&1 | sed 's/^/[trailers] /' || \
    log "WARN  trailer fetch failed — games keep their existing trailers"

# ---------------------------------------------------------------------------
# Final status
# ---------------------------------------------------------------------------
if [ -n "$failed_sellers" ]; then
    log "=== COMPLETED WITH FAILURES: $failed_sellers ==="
    pipeline finish failed "$failed_sellers"
    exit 1
fi
pipeline finish succeeded
log "=== GameXS daily scrape completed successfully ==="
