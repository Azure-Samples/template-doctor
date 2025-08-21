#!/usr/bin/env bash
set -euo pipefail

log() { echo "[healthy-runner] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*"; }

log "Container starting. Subscription hint: ${AZURE_SUBSCRIPTION_ID:-unset}"

# Try MI login if available; don't fail the container if it doesn't exist
if az account show >/dev/null 2>&1; then
  log "Already logged in to Azure CLI"
else
  if az login --identity >/dev/null 2>&1; then
    log "Logged in to Azure with Managed Identity"
  else
    log "Managed Identity login not available; continuing unauthenticated"
  fi
fi

# Main loop: update health file and print heartbeat
COUNTER=0
while true; do
  echo "OK" > /app/health
  log "Heartbeat #$COUNTER (role=$CONTAINER_ROLE)"
  COUNTER=$((COUNTER+1))
  sleep 15
done
