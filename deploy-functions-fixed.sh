#!/usr/bin/env bash
set -euo pipefail

echo "This script is deprecated. Use ./scripts/deploy-functions-aca.sh instead." 1>&2
echo "Reason: Consolidated flow creates a prod-only zip reliably and handles az login checks." 1>&2
exit 1
