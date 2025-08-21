#!/bin/bash
set -euo pipefail
# Deprecated wrapper. The canonical script lives under ./scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "[DEPRECATED] Use ./scripts/update-dashboard-endpoints.sh instead." >&2
exec "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh" "$@"
#!/bin/bash
# This shim calls the consolidated script under ./scripts

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
bash "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh"
