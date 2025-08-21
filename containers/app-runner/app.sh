#!/usr/bin/env bash
set -euo pipefail

log() { echo "[app] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*"; }

# Surface useful context for correlation
log "BOOT CONTEXT: APP_MODE=${APP_MODE:-unset} AZD_ACTION=${AZD_ACTION:-unset} \ 
  TEMPLATE_REPO_URL='${TEMPLATE_REPO_URL:-}' AZD_TEMPLATE_NAME='${AZD_TEMPLATE_NAME:-}' TEMPLATE_NAME='${TEMPLATE_NAME:-}' \ 
  TD_RUN_ID='${TD_RUN_ID:-}' EXECUTION_ID='${EXECUTION_ID:-}' TD_EXECUTION_NAME='${TD_EXECUTION_NAME:-}'"

# Normalize execution/run id
TD_RUN_ID=${TD_EXECUTION_NAME:-${EXECUTION_ID:-${TD_RUN_ID:-td-$(date +%s)}}}

# Map AZD_ACTION to APP_MODE if APP_MODE not explicitly set
if [[ -z "${APP_MODE:-}" && -n "${AZD_ACTION:-}" ]]; then
  case "${AZD_ACTION}" in
    up) APP_MODE="azd" ;;
    down) APP_MODE="azd-down" ;;
    init|*) APP_MODE="list" ;;
  esac
fi

# If TEMPLATE_NAME is provided (from Function), infer azd template and repo URL if missing
if [[ -n "${TEMPLATE_NAME:-}" ]]; then
  if [[ -z "${AZD_TEMPLATE_NAME:-}" ]]; then AZD_TEMPLATE_NAME="$TEMPLATE_NAME"; fi
  if [[ -z "${TEMPLATE_REPO_URL:-}" ]]; then TEMPLATE_REPO_URL="https://github.com/${TEMPLATE_NAME}.git"; fi
fi

log "NORMALIZED: APP_MODE=${APP_MODE:-unset} AZD_TEMPLATE_NAME='${AZD_TEMPLATE_NAME:-}' TEMPLATE_REPO_URL='${TEMPLATE_REPO_URL:-}' TD_RUN_ID='${TD_RUN_ID:-}'"

# Basic parameter validation (we can work with either a repo URL or an azd template name)
if [[ -z "${TEMPLATE_REPO_URL:-}" && -z "${AZD_TEMPLATE_NAME:-}" ]]; then
  log "No template inputs provided; nothing to do."
  exit 0
fi

WORKDIR=/workspace
rm -rf "$WORKDIR" && mkdir -p "$WORKDIR"
cd "$WORKDIR"

# Fetch workspace (clone or azd init)
if [[ -n "${TEMPLATE_REPO_URL:-}" ]]; then
  log "Cloning repo: $TEMPLATE_REPO_URL"
  if ! git clone --depth 1 "$TEMPLATE_REPO_URL" .; then
    log "Clone failed"
    exit 1
  fi
elif [[ -n "${AZD_TEMPLATE_NAME:-}" ]]; then
  log "Initializing template via azd: $AZD_TEMPLATE_NAME"
  azd init -t "$AZD_TEMPLATE_NAME"
fi

# Utility: simple analyzer in bash (no Node dependency)
analyze_repo() {
  local out_json="${1:-/workspace/analysis.json}"
  local issues=()
  local compliant=()

  # Required files/folders
  for f in README.md azure.yaml LICENSE; do
    if [[ -f "$f" ]]; then
      compliant+=("Required file found: $f")
    else
      issues+=("Missing required file: $f")
    fi
  done
  for d in infra .github; do
    if compgen -G "$d/*" > /dev/null; then
      compliant+=("Required folder found: $d/")
    else
      issues+=("Missing required folder: $d/")
    fi
  done

  # Workflow check
  if ls .github/workflows 2>/dev/null | grep -Eqi '^azure-dev\.ya?ml$'; then
    compliant+=("Required workflow file found: .github/workflows/azure-dev.yml")
  else
    issues+=("Missing required GitHub workflow: azure-dev.yml")
  fi

  # Bicep files
  local bicep_count
  bicep_count=$(find infra -type f -name '*.bicep' 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  if [[ "$bicep_count" -gt 0 ]]; then
    compliant+=("Bicep files found in infra/: $bicep_count files")
  else
    issues+=("No Bicep files found in infra/")
  fi

  # README checks
  if [[ -f README.md ]]; then
    if ! grep -Eqi '^##\s+Prerequisites' README.md; then
      issues+=("README.md is missing required h2 heading: Prerequisites")
    else
      compliant+=("README contains required h2: Prerequisites")
    fi
    if grep -Eqi '^##\s+Architecture' README.md; then
      if grep -A3 -Ei '^##\s+Architecture' README.md | grep -Eq '!\[.*\]\(.*\)'; then
        compliant+=("Architecture section contains an image")
      else
        issues+=("Architecture section present but missing an image")
      fi
    else
      issues+=("README.md is missing required h2 heading: Architecture")
    fi
  fi

  local total_checks=$(( ${#issues[@]} + ${#compliant[@]} ))
  local percentage=0
  if [[ $total_checks -gt 0 ]]; then
    percentage=$(( (${#compliant[@]} * 100) / total_checks ))
  fi

  # Emit logs and write JSON
  log "Analysis summary: ${percentage}% compliant | issues=${#issues[@]} compliant=${#compliant[@]}"
  for i in "${issues[@]}"; do log "[issue] $i"; done
  for c in "${compliant[@]}"; do log "[ok] $c"; done

  cat > "$out_json" <<JSON
{
  "tdRunId": "${TD_RUN_ID}",
  "repoUrl": "${TEMPLATE_REPO_URL:-}",
  "azdTemplate": "${AZD_TEMPLATE_NAME:-}",
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "summary": {
    "issues": ${#issues[@]},
    "compliant": ${#compliant[@]},
    "percentage": ${percentage}
  },
  "issues": [
$(printf '    "%s"%s\n' "${issues[@]}" | sed '$ s/,$//')
  ],
  "compliant": [
$(printf '    "%s"%s\n' "${compliant[@]}" | sed '$ s/,$//')
  ]
}
JSON
  log "Wrote analysis to $out_json"
}

# Flow selection
case "${APP_MODE:-list}" in
  list)
    log "Listing workspace contents:"
    ls -la
    ;;
  analyze)
    log "Running lightweight analyzer"
    analyze_repo "/workspace/analysis.json"
    ;;
  azd)
    ENV_NAME=${AZD_ENV_NAME:-app-${RANDOM}}

    # 1) Ensure we have a workspace initialized by azd if a template name is provided
    if [[ -n "${AZD_TEMPLATE_NAME:-}" ]]; then
      log "Initializing workspace via azd init -t ${AZD_TEMPLATE_NAME}"
      if ! azd init -t "$AZD_TEMPLATE_NAME"; then
        log "azd init failed"
        exit 1
      fi
    fi

    # 2) Read devcontainer.json and install required dependencies (best-effort)
    install_from_devcontainer() {
      local dc_path=""
      if [[ -f devcontainer.json ]]; then dc_path="devcontainer.json"; fi
      if [[ -z "$dc_path" && -f .devcontainer/devcontainer.json ]]; then dc_path=".devcontainer/devcontainer.json"; fi
      if [[ -z "$dc_path" ]]; then
        log "No devcontainer.json found; skipping dependency install"
        return 0
      fi

      log "Found devcontainer at $dc_path; analyzing features for dependencies"
      # Extract features keys
      local features_keys
      features_keys=$(jq -r '(.features // {}) | keys[]?' "$dc_path" || true)

      # Helper installers (best-effort on Azure Linux via tdnf)
      install_node() {
        local v="$1"; log "Installing Node.js (requested: ${v:-any})"
        tdnf install -y nodejs npm || {
          log "Node install via tdnf failed"; return 1; }
        node -v || true; npm -v || true
      }
      install_python() {
        local v="$1"; log "Installing Python (requested: ${v:-any})"
        tdnf install -y python3 python3-pip || { log "Python install failed"; return 1; }
        python3 --version || true; pip3 --version || true
      }
      install_java() {
        local v="$1"; log "Installing Java (requested: ${v:-any})"
        tdnf install -y java-17-openjdk || { log "Java install failed"; return 1; }
        java -version || true
      }

      # Node version from feature value if present
      local node_version python_version java_version
      node_version=$(jq -r '(.features // {}) | to_entries[]? | select(.key | test("node"; "i")) | .value.version? // empty' "$dc_path" 2>/dev/null || true)
      python_version=$(jq -r '(.features // {}) | to_entries[]? | select(.key | test("python"; "i")) | .value.version? // empty' "$dc_path" 2>/dev/null || true)
      java_version=$(jq -r '(.features // {}) | to_entries[]? | select(.key | test("java"; "i")) | .value.version? // empty' "$dc_path" 2>/dev/null || true)

      # Decide what to install based on feature keys
      local need_node need_python need_java
      need_node=$(echo "$features_keys" | grep -Ei 'node' || true)
      need_python=$(echo "$features_keys" | grep -Ei 'python' || true)
      need_java=$(echo "$features_keys" | grep -Ei 'java' || true)

      if [[ -n "$need_node" ]]; then install_node "$node_version" || true; fi
      if [[ -n "$need_python" ]]; then install_python "$python_version" || true; fi
      if [[ -n "$need_java" ]]; then install_java "$java_version" || true; fi
    }

    install_from_devcontainer

    # 3) Run azd up
    log "Running azd up (env=$ENV_NAME)"
    if ! azd up --no-prompt --output json --environment "$ENV_NAME"; then
      log "azd up failed; attempting cleanup (down --purge)"
      azd down --no-prompt --output json --environment "$ENV_NAME" --purge || true
      exit 1
    fi

    # 4) Run azd down --purge
    log "Running azd down --purge (env=$ENV_NAME)"
    azd down --no-prompt --output json --environment "$ENV_NAME" --purge || true
    ;;
  azd-down)
    ENV_NAME=${AZD_ENV_NAME:-app-${RANDOM}}
    log "Running azd down only (env=$ENV_NAME)"
    azd down --no-prompt --output json --environment "$ENV_NAME" || true
    ;;
  *)
    log "Unknown APP_MODE='${APP_MODE}'. Supported: list|analyze|azd|azd-down"
    exit 1
    ;;
esac

log "App logic complete"
exit 0
