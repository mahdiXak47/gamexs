#!/usr/bin/env bash
# Runs inside the xray pod (via kubectl exec from the CronJob).
# Xray keeps serving during the speed test — only goes down for the
# 2-3 seconds it takes to restart on the new config.
set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [refresh] $*"; }

log "Speed test started — Xray still serving on old config …"
python3 /app/find-fastest.py "$SUBSCRIPTION_URL" > /tmp/xray-config-new.json

log "Speed test done — swapping config and restarting Xray …"
mv /tmp/xray-config-new.json /tmp/xray-config.json
pkill -f "xray run" || true

log "Done — supervisor will restart Xray with new config in ~2s"
