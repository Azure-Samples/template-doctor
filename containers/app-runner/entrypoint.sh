#!/usr/bin/env bash
set -euo pipefail

log() { echo "[app-runner] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*"; }

log "Container starting. ROLE=${CONTAINER_ROLE:-unset} MODE=${APP_MODE:-unset}"

# Try MI login if available; do not fail if not present
if az account show >/dev/null 2>&1; then
  log "Azure CLI already logged in"
else
  if az login --identity >/dev/null 2>&1; then
    log "Logged in with Managed Identity"
  else
    log "Managed Identity not available; continuing without auth"
  fi
fi

# Run app logic in a subshell to capture exit code
/app/app.sh || APP_EXIT=$? || true
APP_EXIT=${APP_EXIT:-0}

if [[ "$APP_EXIT" -ne 0 ]]; then
  log "App exited with code: $APP_EXIT"
  echo "FAILED" > /app/health
  # Keep container alive briefly for log scraping
  sleep 120
  exit "$APP_EXIT"
fi

# If app completes successfully, keep alive for visibility
log "App completed; keeping container healthy"
echo "OK" > /app/health
while true; do
  log "Heartbeat"
  sleep 30
done
