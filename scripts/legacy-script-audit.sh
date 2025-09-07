#!/usr/bin/env bash
# Simple audit script to list legacy JS script tags still referenced in app/index.html
# Usage: ./scripts/legacy-script-audit.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML="$ROOT_DIR/packages/app/index.html"
LEGACY_DIR="$ROOT_DIR/packages/app/js"

if [[ ! -f "$HTML" ]]; then
  echo "index.html not found: $HTML" >&2
  exit 1
fi

echo "Scanning legacy <script> references..." >&2
# Collect all js/*.js script src entries (excluding vite module entry)
script_refs=$(grep -oE '<script[^>]+src="js/[^"]+"' "$HTML" | sed -E 's/.*src="(js\/[^\"]+)"/\1/' | sort -u)

printf "%-45s %-12s %-35s\n" "Script" "Exists" "Action Hint"
printf "%-45s %-12s %-35s\n" "------" "------" "-----------"

while IFS= read -r ref; do
  file="$LEGACY_DIR/${ref#js/}"
  if [[ -f "$file" ]]; then
    action="review"
    # heuristic suggestions
    case "$ref" in
      js/notification-system.js|js/notifications.js|js/notifications-compat.js|js/notifications-init.js)
        action="candidate-remove (migrated)";;
      js/tooltips.js)
        action="replace-with TS (tooltips.ts)";;
      js/github-client.js|js/github-client-new.js)
        action="delete (obsolete)";;
      js/runtime-config.js)
        action="ensure TS global then remove";;
      js/app.js)
        action="decompose";;
    esac
    printf "%-45s %-12s %-35s\n" "$ref" "yes" "$action"
  else
    printf "%-45s %-12s %-35s\n" "$ref" "missing" "(already removed?)"
  fi
done <<< "$script_refs"
