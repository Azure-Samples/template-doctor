#!/bin/bash

# Consolidated location for dashboard endpoint updater
# Use this script from repo root.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"

bash "$REPO_ROOT/update-all-dashboards.sh"
