#!/bin/bash
set -euo pipefail
exec 2>&1

# Set default action if not provided (backwards compatibility)
if [[ -z "${AZD_ACTION:-}" ]]; then
    export AZD_ACTION="init"
    echo "[ENTRYPOINT] No AZD_ACTION provided, defaulting to 'init'"
fi

echo "[ENTRYPOINT] TEMPLATE_REPO_URL='${TEMPLATE_REPO_URL:-}' AZD_TEMPLATE_NAME='${AZD_TEMPLATE_NAME:-}' AZD_ACTION='${AZD_ACTION}' TD_RUN_ID='${TD_RUN_ID:-}'"

# Run job if either TEMPLATE_REPO_URL or AZD_TEMPLATE_NAME is set
if [[ -n "${TEMPLATE_REPO_URL:-}" || -n "${AZD_TEMPLATE_NAME:-}" ]]; then
    echo "[ENTRYPOINT] Detected job inputs. Launching azd job script..."
    exec /usr/local/bin/start-azd-job.sh
else
    echo "[ENTRYPOINT] No template specified. Container will stay ready for job triggers."
    # Always keep the container alive to wait for job triggers
    echo "[ENTRYPOINT] Keeping container alive and ready for job triggers."
    trap 'echo "[ENTRYPOINT] Received termination signal, exiting."; exit 0' TERM INT
    while true; do sleep 3600; done
fi
