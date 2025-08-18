#!/bin/bash
set -euo pipefail
exec 2>&1  # redirect stderr to stdout

echo "===== ACA AZD Job Starting ====="
echo "[INFO] REPO_URL=${TEMPLATE_REPO_URL:-undefined} TEMPLATE_NAME=${AZD_TEMPLATE_NAME:-undefined}"
echo "[INFO] TD_RUN_ID=${TD_RUN_ID:-undefined}"
echo "[INFO] Start time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================"

echo "[INFO] Versions:"
azd version || true
az version || true
git --version || true

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

# Prepare azd workspace from either a repository URL or a template name
if [[ -n "${TEMPLATE_REPO_URL:-}" ]]; then
    echo "[INFO] Cloning repository $TEMPLATE_REPO_URL..."
    git clone --depth 1 "$TEMPLATE_REPO_URL" "$WORKDIR" 2>&1 | while IFS= read -r line; do
        echo "[GIT] $line"
    done
    cd "$WORKDIR"
    echo "[INIT] Skipping azd init (using cloned repository)"
elif [[ -n "${AZD_TEMPLATE_NAME:-}" ]]; then
    echo "[INIT] Starting azd init -t ${AZD_TEMPLATE_NAME}"
    cd "$WORKDIR"
    run_cmd azd init -t "$AZD_TEMPLATE_NAME"
    echo "[INIT] Completed azd init"
else
    echo "[ERROR] Neither TEMPLATE_REPO_URL nor AZD_TEMPLATE_NAME is set."
    exit 3
fi

# Determine AZD environment
AZD_ENV_NAME="${AZD_ENV_NAME:-aca-${RANDOM}}"
echo "[INFO] Using AZD environment: $AZD_ENV_NAME"

# Always execute full init/up/down sequence
echo "[UP] Starting azd up (env=$AZD_ENV_NAME)" 
run_cmd azd up --no-prompt --output json --environment "$AZD_ENV_NAME" || {
    echo "[WARN] azd up failed, attempting cleanup..."
    echo "[DOWN] Starting azd down (cleanup)"
    run_cmd azd down --no-prompt --output json --environment "$AZD_ENV_NAME" || echo "[WARN] Cleanup failed"
    exit 1
}
echo "[UP] Completed azd up"
echo "[DOWN] Starting azd down"
run_cmd azd down --no-prompt --output json --environment "$AZD_ENV_NAME" || echo "[WARN] azd down failed"
echo "[DOWN] Completed azd down"

echo "===== ACA AZD Job Completed Successfully ====="
echo "[INFO] End time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
