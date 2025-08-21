#!/bin/bash
set -euo pipefail
# Deprecated wrapper: use the consolidated updater in ./scripts
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "[DEPRECATED] Use ./scripts/update-dashboard-endpoints.sh instead." >&2
exec "$SCRIPT_DIR/scripts/update-dashboard-endpoints.sh" "$@"
#!/bin/bash
echo "This script is deprecated. Use ./scripts/update-all-dashboards.sh instead."
exit 1
