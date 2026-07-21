#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

[ -z "${SUBSCRIPTION_URL:-}" ] && { log "ERROR: SUBSCRIPTION_URL env var is required"; exit 1; }

log "=== Xray proxy starting — initial speed test ==="
python3 /app/find-fastest.py "$SUBSCRIPTION_URL" > /tmp/xray-config.json

log "Speed test complete — entering supervisor loop on port 10809"

# Supervisor loop: restart Xray whenever it exits (config refresh kills it intentionally).
while true; do
    xray run -c /tmp/xray-config.json || true
    log "Xray stopped — restarting in 2s …"
    sleep 2
done
