#!/usr/bin/env bash
set -euo pipefail
exec 2>&1

# Print key env upfront for sanity
echo "[BOOT] time=$(date -u +%FT%TZ)"
echo "[BOOT] AZD_ACTION=${AZD_ACTION:-} TEMPLATE_REPO_URL=${TEMPLATE_REPO_URL:-} AZD_TEMPLATE_NAME=${AZD_TEMPLATE_NAME:-} TD_RUN_ID=${TD_RUN_ID:-}"

# If a command was provided, run it and keep container alive after to allow logs fetching
if [[ $# -gt 0 ]]; then
  echo "[BOOT] executing: $*"
  set +e
  "$@"
  code=$?
  set -e
  echo "[BOOT] command exit=$code"
fi

# Idle loop so the container never crashes
trap 'echo "[BOOT] termination signal, exiting cleanly"; exit 0' TERM INT
while true; do
  echo "[HEALTH] OK $(date -u +%T)" > /health
  sleep 60
done
