#!/usr/bin/env bash
# Scrape-and-load cycle for all sellers, SCRAPER_PARALLEL sellers at a time.
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
# Run sellers SCRAPER_PARALLEL at a time. Every seller is a different site, so
# each site still gets one request per second; the cycle takes about as long as
# the slowest seller instead of the sum of all of them. DB loads stay one at a
# time (seller_runner.load_lock). Memory: ~60–120 MB per seller (runner + scrape)
# on a 500 MB pod, so 3 at a time.
# A failure in one seller does not stop the others.
# ---------------------------------------------------------------------------
SCRAPER_PARALLEL=${SCRAPER_PARALLEL:-3}
failed_file=$(mktemp)

run_sellers() {
    local seller
    for seller in "$@"; do
        while [ "$(jobs -rp | wc -l)" -ge "$SCRAPER_PARALLEL" ]; do sleep 1; done
        { run_seller "$seller" || echo "$seller" >> "$failed_file"; } &
    done
    wait
}

# ---------------------------------------------------------------------------
# Main. Sellers slowest first, so the long crawls start right away and the
# short ones fill the gaps (measured 2026-10-29, docs/PRODUCTION_SCRAPER_ARCHITECTURE.md
# "Cycle time"). Upera Game runs its own crawler (crawl_uperagame.py) behind
# the same seller-runner health contract.
# ---------------------------------------------------------------------------
log "=== GameXS daily scrape started ==="
SELLERS="pspro gameplayshop nakhlmarket cdkeyshare fillgame persianconsole yungcenter \
    uperagame gameaccess gamario gamestore technolife clockstore1 digikala xgamesstore \
    parsconsole gamecenter gpgaming psnacctm gamepulse gameonestore"
GAMEXS_PIPELINE_RUN_ID=$(pipeline start $SELLERS installments igdb psstore s3 cleanup trailers || true)
export GAMEXS_PIPELINE_RUN_ID

log "=== Sellers ($SCRAPER_PARALLEL at a time) ==="
run_sellers $SELLERS

failed_sellers=$(tr '\n' ' ' < "$failed_file")
rm -f "$failed_file"

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

# Trailers last: each 720p transcode takes 10+ minutes on the pod's quarter
# core (130 of them took 29 h on 2026-10-27), so each pass gets a time budget
# and the backlog carries over to the next cycle.
log "=== Game trailers (PS Store → 720p → S3) ==="
# Featured trailer for the next games in popularity order, then every official
# trailer (Trailer 1/2, launch …) for the 25 most popular games.
step trailers sh -c 'python fetch_trailers.py --limit "${TRAILERS_PER_RUN:-60}" --max-minutes "${TRAILERS_MAX_MINUTES:-60}"; python fetch_trailers.py --all-trailers --limit "${ALL_TRAILERS_TOP:-25}" --max-minutes "${TRAILERS_MAX_MINUTES:-60}"' 2>&1 | sed 's/^/[trailers] /' || \
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
