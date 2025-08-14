#!/bin/bash
set -euo pipefail
exec 2>&1

# If both environment variables are set, run the job
if [[ -n "${AZD_ACTION:-}" && -n "${TEMPLATE_REPO_URL:-}" ]]; then
    echo "[INFO] Environment variables detected, running azd job..."
    exec /usr/local/bin/start-azd-job.sh
else
    echo "[INFO] AZD_ACTION or TEMPLATE_REPO_URL not set."
    echo "[INFO] Starting interactive shell. Ready for devcontainer use."
    exec /bin/bash
fi
