#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# WeiClaw Bootstrap Installer
# =============================================================================
# Runtime download order:
#   1. Official GitHub Release
#   2. ghproxy.net mirror of the GitHub Release
#   3. Source install fallback
# =============================================================================

WEICLAW_INSTALL_TARBALL="${WEICLAW_INSTALL_TARBALL:-}"
WEICLAW_DRY_RUN="${WEICLAW_DRY_RUN:-0}"
WEICLAW_SKIP_BOOTSTRAP="${WEICLAW_SKIP_BOOTSTRAP:-0}"
WEICLAW_VERBOSE="${WEICLAW_VERBOSE:-0}"

GITHUB_RELEASE_URL="https://github.com/zylzyqzz/WeiClaw/releases/latest/download/weiclaw-runtime.tgz"
GHPROXY_URL="https://ghproxy.net/https://github.com/zylzyqzz/WeiClaw/releases/download/v1.0.1/weiclaw-runtime.tgz"

RED='\033[38;5;196m'
DIM='\033[2m'
NC='\033[0m'

print_logo() {
  cat <<'EOF'
 __  __
 \ \/ /
  \  /
   \/
 WeiClaw
EOF
  printf "%b%s%b\n\n" "$DIM" "Minimal private agent" "$NC"
}

log() {
  if [[ "$WEICLAW_VERBOSE" == "1" ]]; then
    printf "[VERBOSE] %b%s%b\n" "$DIM" "$1" "$NC"
  else
    printf "%b%s%b\n" "$RED" "$1" "$NC"
  fi
}

log_info() {
  printf "%b%s%b\n" "$DIM" "$1" "$NC"
}

run_cmd() {
  if [[ "$WEICLAW_DRY_RUN" == "1" ]]; then
    printf "[dry-run] %s\n" "$*"
    return 0
  fi
  "$@"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

detect_pm() {
  if have brew; then echo "brew"; return; fi
  if have apt-get; then echo "apt"; return; fi
  if have dnf; then echo "dnf"; return; fi
  if have yum; then echo "yum"; return; fi
  if have pacman; then echo "pacman"; return; fi
  if have zypper; then echo "zypper"; return; fi
  if have apk; then echo "apk"; return; fi
  echo ""
}

install_git() {
  local pm
  pm="$(detect_pm)"
  case "$pm" in
    brew) run_cmd brew install git ;;
    apt) run_cmd sudo apt-get update; run_cmd sudo apt-get install -y git curl ca-certificates ;;
    dnf) run_cmd sudo dnf install -y git curl ca-certificates ;;
    yum) run_cmd sudo yum install -y git curl ca-certificates ;;
    pacman) run_cmd sudo pacman -Sy --noconfirm git curl ca-certificates ;;
    zypper) run_cmd sudo zypper install -y git curl ca-certificates ;;
    apk) run_cmd sudo apk add git curl ca-certificates ;;
    *) printf "Missing git, and no supported package manager was found.\n" >&2; exit 1 ;;
  esac
}

install_node() {
  local pm
  pm="$(detect_pm)"
  case "$pm" in
    brew)
      run_cmd brew install node@22
      ;;
    apt)
      run_cmd bash -lc "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
      run_cmd sudo apt-get install -y nodejs
      ;;
    dnf)
      run_cmd bash -lc "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
      run_cmd sudo dnf install -y nodejs
      ;;
    yum)
      run_cmd bash -lc "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
      run_cmd sudo yum install -y nodejs
      ;;
    pacman)
      run_cmd sudo pacman -Sy --noconfirm nodejs npm
      ;;
    zypper)
      run_cmd sudo zypper install -y nodejs22 npm22 || run_cmd sudo zypper install -y nodejs npm
      ;;
    apk)
      run_cmd sudo apk add nodejs npm
      ;;
    *)
      printf "Missing node/npm, and no supported package manager was found.\n" >&2
      exit 1
      ;;
  esac
}

ensure_git() {
  if have git; then
    log "Git ready"
    return
  fi
  log "Installing Git"
  install_git
}

ensure_node() {
  if have node && have npm; then
    log "Node ready"
    return
  fi
  log "Installing Node.js"
  install_node
}

test_url() {
  local url="$1"
  local timeout="${2:-10}"

  if curl --location --silent --head --fail --max-time "$timeout" "$url" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

install_from_source() {
  log "Falling back to source installation"
  log_info "Cloning WeiClaw repository..."

  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT

  run_cmd git clone --depth 1 https://github.com/zylzyqzz/WeiClaw.git "$temp_dir" || {
    log_info "GitHub unavailable, trying Gitee mirror..."
    run_cmd git clone --depth 1 https://gitee.com/zylzyqzz/weiclaw.git "$temp_dir" || {
      log "Source clone failed"
      return 1
    }
  }

  cd "$temp_dir"

  log_info "Installing dependencies..."
  run_cmd npm install --omit=dev || run_cmd pnpm install --omit=dev || run_cmd yarn install --production

  log_info "Building..."
  run_cmd npm run build || run_cmd pnpm build || run_cmd yarn build

  log_info "Installing globally..."
  run_cmd npm link || run_cmd pnpm link || run_cmd yarn link
}

install_runtime() {
  log "Preparing runtime package"

  if [[ -n "$WEICLAW_INSTALL_TARBALL" ]]; then
    log_info "Using custom tarball: $WEICLAW_INSTALL_TARBALL"
    run_cmd npm install -g "$WEICLAW_INSTALL_TARBALL" --omit=dev --no-fund --no-audit
    return
  fi

  local sources=()
  sources+=("github|$GITHUB_RELEASE_URL")
  sources+=("ghproxy|$GHPROXY_URL")

  for source in "${sources[@]}"; do
    local name="${source%%|*}"
    local url="${source#*|}"

    case "$name" in
      github) log_info "Trying runtime source 1/3: official GitHub Release" ;;
      ghproxy) log_info "Trying runtime source 2/3: ghproxy.net mirror" ;;
    esac

    [[ "$WEICLAW_VERBOSE" == "1" ]] && log_info "Source URL: $url"

    if test_url "$url" 15; then
      log_info "Runtime source available, installing..."
      run_cmd npm install -g "$url" --omit=dev --no-fund --no-audit
      return
    fi

    log_info "Runtime source unavailable, switching..."
  done

  log "Runtime sources failed, switching to source install fallback"

  if install_from_source; then
    log "Source installation succeeded"
    return
  fi

  log "Installation failed"
  return 1
}

# Detect if running in interactive terminal
is_interactive() {
  [[ -t 0 ]] && [[ -t 1 ]]
}

run_bootstrap() {
  if [[ "$WEICLAW_SKIP_BOOTSTRAP" == "1" ]]; then
    log "Skipping bootstrap"
    log ""
    log "To run setup manually, use: weiclaw setup --bootstrap"
    return
  fi

  if is_interactive; then
    log "Starting minimal setup..."
    run_cmd weiclaw setup --bootstrap
  else
    log "Installation complete"
    log ""
    log "To run setup manually, use: weiclaw setup --bootstrap"
  fi
}

main() {
  print_logo
  log "Checking environment"
  ensure_git
  ensure_node
  install_runtime
  run_cmd weiclaw --help >/dev/null
  run_bootstrap
  log "Done"
}

main "$@"