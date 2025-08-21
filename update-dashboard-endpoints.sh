#!/bin/bash
# This shim calls the consolidated script under ./scripts

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
bash "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh"
