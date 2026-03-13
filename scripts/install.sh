#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_URL_ROOT="${VCLAW_INSTALL_ROOT:-https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts}"
BOOTSTRAP_URL="${BOOTSTRAP_URL_ROOT}/vclaw-bootstrap.sh"

RED='\033[38;5;196m'
DIM='\033[2m'
NC='\033[0m'

BOOTSTRAP_ARGS=()
TMPFILES=()

cleanup() {
  local file
  for file in "${TMPFILES[@]:-}"; do
    rm -f "$file" 2>/dev/null || true
  done
}
trap cleanup EXIT

print_banner() {
  printf '\n%b🐜 Vclaw Installer%b\n' "$RED" "$NC"
  printf '%bSimple GitHub install. Local-first. Compatible with openclaw skills.%b\n\n' "$DIM" "$NC"
}

log_step() {
  printf '%b%s%b\n' "$RED" "$1" "$NC"
}

log_info() {
  printf '%b%s%b\n' "$DIM" "$1" "$NC"
}

die() {
  printf '%b%s%b\n' "$RED" "$1" "$NC" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

download_bootstrap() {
  local tmp
  tmp="$(mktemp)"
  TMPFILES+=("$tmp")

  if have curl; then
    curl -fsSL "$BOOTSTRAP_URL" -o "$tmp"
  elif have wget; then
    wget -qO "$tmp" "$BOOTSTRAP_URL"
  else
    die "curl or wget is required to fetch the Vclaw bootstrap script."
  fi

  printf '%s\n' "$tmp"
}

print_help() {
  cat <<'EOF'
Usage: install.sh [options]

Recommended:
  curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash

Modern options:
  --target-dir <path>          Checkout directory
  --archive-dir <path>         Archive directory when target is occupied
  --wrapper-dir <path>         Wrapper directory
  --repo-url <url>             Override Vclaw repo URL
  --deerflow-repo-url <url>    Override DeerFlow repo URL
  --pnpm-version <ver>         pnpm version to activate
  --deerflow-mode <mode>       DeerFlow mode
  --no-git-update              Skip git pull when checkout already exists
  --no-deerflow                Skip DeerFlow sidecar installation
  --no-onboard                 Do not suggest onboarding as the next action
  --keep-deerflow-config       Preserve existing DeerFlow config
  --dry-run                    Print actions without changing the machine
  --help, -h                   Show this help

Compatibility options accepted but ignored:
  --install-method <value>
  --method <value>
  --beta
  --tag <value>
  --verbose
  --no-prompt

Compatibility mapping:
  --git-dir <path>             Same as --target-dir <path>
EOF
}

consume_compat_flag() {
  local flag="$1"
  local value="${2:-}"
  if [[ -n "$value" ]]; then
    log_info "Ignoring compatibility option ${flag} ${value}. Vclaw always installs from the GitHub checkout flow."
  else
    log_info "Ignoring compatibility option ${flag}. Vclaw always installs from the GitHub checkout flow."
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url|--deerflow-repo-url|--target-dir|--archive-dir|--pnpm-version|--wrapper-dir|--deerflow-mode)
        [[ $# -ge 2 ]] || die "Missing value for $1"
        BOOTSTRAP_ARGS+=("$1" "$2")
        shift 2
        ;;
      --git-dir)
        [[ $# -ge 2 ]] || die "Missing value for $1"
        BOOTSTRAP_ARGS+=("--target-dir" "$2")
        shift 2
        ;;
      --install-method|--method|--tag)
        [[ $# -ge 2 ]] || die "Missing value for $1"
        consume_compat_flag "$1" "$2"
        shift 2
        ;;
      --beta|--verbose|--no-prompt)
        consume_compat_flag "$1"
        shift
        ;;
      --no-git-update|--no-deerflow|--no-onboard|--keep-deerflow-config|--dry-run)
        BOOTSTRAP_ARGS+=("$1")
        shift
        ;;
      --help|-h)
        print_help
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

run_bootstrap() {
  local local_script
  local_script=""

  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    local candidate
    candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vclaw-bootstrap.sh"
    if [[ -f "$candidate" ]]; then
      local_script="$candidate"
    fi
  fi

  if [[ -n "$local_script" ]]; then
    log_step "Using local bootstrap script"
    /usr/bin/env bash "$local_script" "${BOOTSTRAP_ARGS[@]}"
    return
  fi

  log_step "Fetching bootstrap script from GitHub"
  local downloaded
  downloaded="$(download_bootstrap)"
  /usr/bin/env bash "$downloaded" "${BOOTSTRAP_ARGS[@]}"
}

main() {
  print_banner
  parse_args "$@"
  run_bootstrap
}

main "$@"
