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
# Post-run cleanup: mark listings not seen in 3+ days as inactive,
# then remove games that have no remaining active listings.
# ---------------------------------------------------------------------------
log "=== Post-run DB cleanup ==="
python - <<'PYEOF'
import os, psycopg
url = os.environ["DATABASE_URL"]
with psycopg.connect(url) as conn, conn.cursor() as cur:
    cur.execute("""
        UPDATE listings SET is_active = false
        WHERE is_active = true
          AND last_seen_at < NOW() - INTERVAL '3 days'
    """)
    stale = cur.rowcount
    cur.execute("""
        DELETE FROM games
        WHERE id NOT IN (SELECT DISTINCT game_id FROM listings WHERE is_active)
    """)
    orphans = cur.rowcount
    conn.commit()
print(f"marked {stale} listings inactive, removed {orphans} orphaned games")
PYEOF

# ---------------------------------------------------------------------------
# Final status
# ---------------------------------------------------------------------------
if [ -n "$failed_sellers" ]; then
    log "=== COMPLETED WITH FAILURES: $failed_sellers ==="
    exit 1
fi
log "=== GameXS daily scrape completed successfully ==="
