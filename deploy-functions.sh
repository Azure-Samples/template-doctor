#!/usr/bin/env bash
set -euo pipefail

echo "This script is deprecated. Use ./scripts/deploy-functions-aca.sh instead." 1>&2
echo "Reason: We now package prod-only deps and zip-deploy to avoid copying node_modules." 1>&2
exit 1
