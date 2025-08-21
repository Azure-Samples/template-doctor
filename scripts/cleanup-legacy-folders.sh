#!/usr/bin/env bash
# One-time cleanup helper. Safely removes deprecated folders/files that were replaced.
set -euo pipefail
cd "$(dirname "$0")/.."

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

confirm() {
  read -r -p "$1 [y/N]: " ans || true
  case "${ans:-}" in
    y|Y|yes|YES) return 0;;
    *) return 1;;
  esac
}

TARGETS=(
  "src/app"
  "packages/infra/.devcontainer"
)

yellow "This will permanently delete legacy folders that are no longer used:"
for t in "${TARGETS[@]}"; do
  echo " - $t"
done

echo
if ! confirm "Proceed with deletion?"; then
  red "Aborting. No changes made."
  exit 1
fi

declare -i removed=0
for t in "${TARGETS[@]}"; do
  if [ -e "$t" ]; then
    rm -rf "$t"
    green "Removed: $t"
    removed+=1
  else
    yellow "Already gone: $t"
  fi
done

green "Cleanup finished. Removed $removed target(s)."

echo "If git shows deletions, commit them:"
echo "  git add -A && git commit -m 'chore: remove legacy src/app and infra devcontainer'"
