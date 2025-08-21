#!/bin/bash
set -euo pipefail
# Deprecated wrapper. Use the consolidated deploy script under ./scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "[DEPRECATED] Use ./scripts/deploy-functions-aca.sh instead." >&2
exec "$SCRIPT_DIR/scripts/deploy-functions-aca.sh" "$@"
#!/usr/bin/env bash
set -euo pipefail

echo "This script is deprecated. Use ./scripts/deploy-functions-aca.sh instead." 1>&2
echo "Reason: We now package prod-only deps and zip-deploy to avoid copying node_modules." 1>&2
exit 1
