#!/bin/bash
set -euo pipefail
exec 2>&1  # redirect stderr to stdout

echo "===== ACA AZD Job Starting ====="
echo "[INFO] ACTION=${AZD_ACTION:-undefined}, REPO=${TEMPLATE_REPO_URL:-undefined}"
echo "[INFO] Start time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================"

# Login using Managed Identity
echo "[INFO] Logging in with Managed Identity..."
if az login --identity; then
    echo "[INFO] Successfully logged in."
else
    echo "[ERROR] Managed Identity login failed."
    exit 1
fi

WORKDIR=/workspace
echo "[INFO] Setting up workspace at $WORKDIR"
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR"
echo "[INFO] Workspace ready."

# Clone repository
if [[ -z "${TEMPLATE_REPO_URL}" ]]; then
    echo "[ERROR] TEMPLATE_REPO_URL not set, cannot clone repo."
    exit 1
fi

echo "[INFO] Cloning repository $TEMPLATE_REPO_URL..."
git clone --depth 1 "$TEMPLATE_REPO_URL" "$WORKDIR" 2>&1 | while IFS= read -r line; do
    echo "[GIT] $line"
done
cd "$WORKDIR"

# Determine AZD environment
AZD_ENV_NAME="${AZD_ENV_NAME:-aca-${RANDOM}}"
echo "[INFO] Using AZD environment: $AZD_ENV_NAME"

# Helper to run commands and log output line by line
run_cmd() {
    local cmd="$*"
    echo "[CMD] Running: $cmd"
    eval "$cmd" 2>&1 | while IFS= read -r line; do
        echo "[CMD] $line"
    done
    local status=${PIPESTATUS[0]}
    if [ $status -ne 0 ]; then
        echo "[ERROR] Command failed ($status): $cmd"
        return $status
    fi
    return 0
}

# Execute action
case "${AZD_ACTION}" in
    updown)
        run_cmd azd up --no-prompt --output json --environment "$AZD_ENV_NAME" || {
            echo "[WARN] azd up failed, attempting cleanup..."
            run_cmd azd down --no-prompt --output json --environment "$AZD_ENV_NAME" || echo "[WARN] Cleanup failed"
            exit 1
        }
        run_cmd azd down --no-prompt --output json --environment "$AZD_ENV_NAME" || echo "[WARN] azd down failed"
        ;;
    up)
        run_cmd azd up --no-prompt --output json --environment "$AZD_ENV_NAME"
        ;;
    down)
        run_cmd azd down --no-prompt --output json --environment "$AZD_ENV_NAME"
        ;;
    *)
        echo "[ERROR] Invalid AZD_ACTION: $AZD_ACTION"
        exit 2
        ;;
esac

echo "===== ACA AZD Job Completed Successfully ====="
echo "[INFO] End time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
