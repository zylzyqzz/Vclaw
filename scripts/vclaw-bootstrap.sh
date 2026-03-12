#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_URL="https://github.com/zylzyqzz/Vclaw.git"
DEFAULT_DEERFLOW_REPO_URL="https://github.com/bytedance/deer-flow.git"
DEFAULT_TARGET_DIR="${HOME}/Vclaw"
DEFAULT_ARCHIVE_DIR="${HOME}/Vclaw-go-unfinished"
DEFAULT_PNPM_VERSION="10.23.0"
DEFAULT_WRAPPER_DIR="${HOME}/.local/bin"
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=12

REPO_URL="${VCLAW_REPO_URL:-$DEFAULT_REPO_URL}"
DEERFLOW_REPO_URL="${VCLAW_DEERFLOW_REPO_URL:-$DEFAULT_DEERFLOW_REPO_URL}"
TARGET_DIR="${VCLAW_TARGET_DIR:-$DEFAULT_TARGET_DIR}"
LEGACY_GO_ARCHIVE_DIR="${VCLAW_ARCHIVE_DIR:-$DEFAULT_ARCHIVE_DIR}"
PNPM_VERSION="${VCLAW_PNPM_VERSION:-$DEFAULT_PNPM_VERSION}"
WRAPPER_DIR="${VCLAW_WRAPPER_DIR:-$DEFAULT_WRAPPER_DIR}"
DEERFLOW_MODE="${VCLAW_DEERFLOW_MODE:-ultra}"
NO_GIT_UPDATE="${VCLAW_NO_GIT_UPDATE:-0}"
NO_DEERFLOW="${VCLAW_NO_DEERFLOW:-0}"
NO_ONBOARD="${VCLAW_NO_ONBOARD:-0}"
KEEP_DEERFLOW_CONFIG="${VCLAW_KEEP_DEERFLOW_CONFIG:-0}"
DRY_RUN="${VCLAW_DRY_RUN:-0}"
OS_KIND=""
DEERFLOW_DIR=""
DEERFLOW_RUNTIME_PATH=""

log_step() {
  printf '[vclaw-bootstrap] %s\n' "$1"
}

log_info() {
  printf '%s\n' "$1"
}

log_warn() {
  printf '[warn] %s\n' "$1" >&2
}

die() {
  printf '[error] %s\n' "$1" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

preview_or_run() {
  local preview="$1"
  shift
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] $preview"
    return 0
  fi
  "$@"
}

refresh_common_paths() {
  local candidate
  for candidate in "$WRAPPER_DIR" "$HOME/.local/bin" "/opt/homebrew/bin" "/usr/local/bin"; do
    if [[ -d "$candidate" && ":$PATH:" != *":$candidate:"* ]]; then
      PATH="$candidate:$PATH"
    fi
  done
  export PATH
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url)
        REPO_URL="$2"
        shift 2
        ;;
      --deerflow-repo-url)
        DEERFLOW_REPO_URL="$2"
        shift 2
        ;;
      --target-dir)
        TARGET_DIR="$2"
        shift 2
        ;;
      --archive-dir)
        LEGACY_GO_ARCHIVE_DIR="$2"
        shift 2
        ;;
      --pnpm-version)
        PNPM_VERSION="$2"
        shift 2
        ;;
      --wrapper-dir)
        WRAPPER_DIR="$2"
        shift 2
        ;;
      --deerflow-mode)
        DEERFLOW_MODE="$2"
        shift 2
        ;;
      --no-git-update)
        NO_GIT_UPDATE="1"
        shift
        ;;
      --no-deerflow)
        NO_DEERFLOW="1"
        shift
        ;;
      --no-onboard)
        NO_ONBOARD="1"
        shift
        ;;
      --keep-deerflow-config)
        KEEP_DEERFLOW_CONFIG="1"
        shift
        ;;
      --dry-run)
        DRY_RUN="1"
        shift
        ;;
      --help|-h)
        cat <<'EOF'
Usage: vclaw-bootstrap.sh [options]

Options:
  --repo-url <url>             Git repo to clone or update
  --deerflow-repo-url <url>    DeerFlow repo to clone or update
  --target-dir <path>          Checkout directory (default: ~/Vclaw)
  --archive-dir <path>         Archive path when target is occupied
  --pnpm-version <ver>         pnpm version to activate (default: 10.23.0)
  --wrapper-dir <path>         Directory for vclaw and agentos wrappers
  --deerflow-mode <mode>       DeerFlow execution mode (flash|standard|pro|ultra)
  --no-git-update              Skip git pull when target checkout already exists
  --no-deerflow                Skip DeerFlow sidecar installation
  --no-onboard                 Preserve current onboarding behavior and do not launch it
  --keep-deerflow-config       Keep an existing DeerFlow config.yaml untouched
  --dry-run                    Print actions without changing the machine
  --help, -h                   Show this help
EOF
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

detect_os() {
  case "$(uname -s)" in
    Darwin)
      OS_KIND="macos"
      ;;
    Linux)
      OS_KIND="linux"
      ;;
    *)
      die "Unsupported OS. This bootstrap currently supports macOS and Linux."
      ;;
  esac
}

detect_package_manager() {
  if [[ "$OS_KIND" == "macos" ]]; then
    printf 'brew'
    return 0
  fi
  if have apt-get; then
    printf 'apt'
    return 0
  fi
  if have dnf; then
    printf 'dnf'
    return 0
  fi
  if have yum; then
    printf 'yum'
    return 0
  fi
  if have pacman; then
    printf 'pacman'
    return 0
  fi
  if have zypper; then
    printf 'zypper'
    return 0
  fi
  if have apk; then
    printf 'apk'
    return 0
  fi
  printf ''
}

ensure_homebrew() {
  if have brew; then
    refresh_common_paths
    return 0
  fi

  log_step "Installing Homebrew"
  preview_or_run \
    'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' \
    /bin/bash -lc 'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  refresh_common_paths
}

get_node_version() {
  if ! have node; then
    return 1
  fi
  node -p "process.versions.node"
}

node_version_supported() {
  local version="$1"
  local major minor
  IFS='.' read -r major minor _ <<<"$version"
  [[ -n "${major:-}" && -n "${minor:-}" ]] || return 1

  if (( major > NODE_MIN_MAJOR )); then
    return 0
  fi
  if (( major == NODE_MIN_MAJOR && minor >= NODE_MIN_MINOR )); then
    return 0
  fi
  return 1
}

ensure_git() {
  local pm
  if have git; then
    log_step "Git ready"
    return 0
  fi

  pm="$(detect_package_manager)"
  [[ -n "$pm" ]] || die "Git is required but no supported package manager was found."

  log_step "Installing Git"
  case "$pm" in
    brew)
      ensure_homebrew
      preview_or_run "brew install git" brew install git
      ;;
    apt)
      preview_or_run "sudo apt-get update" sudo apt-get update
      preview_or_run "sudo apt-get install -y git curl ca-certificates" sudo apt-get install -y git curl ca-certificates
      ;;
    dnf)
      preview_or_run "sudo dnf install -y git curl ca-certificates" sudo dnf install -y git curl ca-certificates
      ;;
    yum)
      preview_or_run "sudo yum install -y git curl ca-certificates" sudo yum install -y git curl ca-certificates
      ;;
    pacman)
      preview_or_run "sudo pacman -Sy --noconfirm git curl ca-certificates" sudo pacman -Sy --noconfirm git curl ca-certificates
      ;;
    zypper)
      preview_or_run "sudo zypper install -y git curl ca-certificates" sudo zypper install -y git curl ca-certificates
      ;;
    apk)
      preview_or_run "sudo apk add git curl ca-certificates" sudo apk add git curl ca-certificates
      ;;
  esac

  refresh_common_paths
  [[ "$DRY_RUN" == "1" ]] || have git || die "Git install did not produce a usable git command."
}

ensure_curl() {
  local pm
  if have curl; then
    return 0
  fi

  pm="$(detect_package_manager)"
  [[ -n "$pm" ]] || die "curl is required but no supported package manager was found."

  log_step "Installing curl"
  case "$pm" in
    brew)
      preview_or_run "brew install curl" brew install curl
      ;;
    apt)
      preview_or_run "sudo apt-get update" sudo apt-get update
      preview_or_run "sudo apt-get install -y curl ca-certificates" sudo apt-get install -y curl ca-certificates
      ;;
    dnf)
      preview_or_run "sudo dnf install -y curl ca-certificates" sudo dnf install -y curl ca-certificates
      ;;
    yum)
      preview_or_run "sudo yum install -y curl ca-certificates" sudo yum install -y curl ca-certificates
      ;;
    pacman)
      preview_or_run "sudo pacman -Sy --noconfirm curl ca-certificates" sudo pacman -Sy --noconfirm curl ca-certificates
      ;;
    zypper)
      preview_or_run "sudo zypper install -y curl ca-certificates" sudo zypper install -y curl ca-certificates
      ;;
    apk)
      preview_or_run "sudo apk add curl ca-certificates" sudo apk add curl ca-certificates
      ;;
  esac

  refresh_common_paths
  [[ "$DRY_RUN" == "1" ]] || have curl || die "curl install did not produce a usable curl command."
}

install_node() {
  local pm
  pm="$(detect_package_manager)"
  [[ -n "$pm" ]] || die "Node.js 22.12+ is required but no supported package manager was found."

  case "$pm" in
    brew)
      ensure_homebrew
      preview_or_run "brew install node@22" brew install node@22
      preview_or_run "brew link --overwrite node@22 --force" brew link --overwrite node@22 --force
      ;;
    apt)
      ensure_curl
      preview_or_run \
        "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -" \
        /bin/bash -lc "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
      preview_or_run "sudo apt-get install -y nodejs" sudo apt-get install -y nodejs
      ;;
    dnf)
      ensure_curl
      preview_or_run \
        "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -" \
        /bin/bash -lc "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
      preview_or_run "sudo dnf install -y nodejs" sudo dnf install -y nodejs
      ;;
    yum)
      ensure_curl
      preview_or_run \
        "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -" \
        /bin/bash -lc "curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
      preview_or_run "sudo yum install -y nodejs" sudo yum install -y nodejs
      ;;
    pacman)
      preview_or_run "sudo pacman -Sy --noconfirm nodejs npm" sudo pacman -Sy --noconfirm nodejs npm
      ;;
    zypper)
      preview_or_run \
        "bash -lc 'sudo zypper install -y nodejs22 npm22 || sudo zypper install -y nodejs npm'" \
        /bin/bash -lc 'sudo zypper install -y nodejs22 npm22 || sudo zypper install -y nodejs npm'
      ;;
    apk)
      preview_or_run "sudo apk add nodejs npm" sudo apk add nodejs npm
      ;;
  esac

  refresh_common_paths
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi

  local installed_version
  installed_version="$(get_node_version || true)"
  [[ -n "$installed_version" ]] || die "Node.js install did not produce a node executable."
  node_version_supported "$installed_version" || die "Node.js v$installed_version is too old. Vclaw needs v22.12+."
}

ensure_node() {
  local version
  version="$(get_node_version || true)"
  if [[ -n "$version" ]] && node_version_supported "$version"; then
    log_step "Node.js v$version ready"
    return 0
  fi

  if [[ -n "$version" ]]; then
    log_warn "Node.js v$version found, but Vclaw needs v22.12+"
  else
    log_step "Node.js not found"
  fi

  install_node

  if [[ "$DRY_RUN" == "0" ]]; then
    version="$(get_node_version || true)"
    log_step "Node.js v$version ready"
  fi
}

ensure_corepack_and_pnpm() {
  log_step "Preparing Corepack and pnpm@$PNPM_VERSION"

  if have corepack; then
    if ! preview_or_run "corepack enable" corepack enable; then
      log_warn "corepack enable failed; falling back to npm install -g pnpm@$PNPM_VERSION"
      preview_or_run "npm install -g pnpm@$PNPM_VERSION --no-fund --no-audit" npm install -g "pnpm@$PNPM_VERSION" --no-fund --no-audit
    elif ! preview_or_run "corepack prepare pnpm@$PNPM_VERSION --activate" corepack prepare "pnpm@$PNPM_VERSION" --activate; then
      log_warn "corepack prepare failed; falling back to npm install -g pnpm@$PNPM_VERSION"
      preview_or_run "npm install -g pnpm@$PNPM_VERSION --no-fund --no-audit" npm install -g "pnpm@$PNPM_VERSION" --no-fund --no-audit
    fi
  else
    log_warn "corepack not found; falling back to npm install -g pnpm@$PNPM_VERSION"
    preview_or_run "npm install -g pnpm@$PNPM_VERSION --no-fund --no-audit" npm install -g "pnpm@$PNPM_VERSION" --no-fund --no-audit
  fi

  refresh_common_paths
  [[ "$DRY_RUN" == "1" ]] || have pnpm || die "pnpm was not found after bootstrap activation."
}

ensure_uv() {
  if have uv; then
    log_step "uv ready"
    return 0
  fi

  ensure_curl
  log_step "Installing uv"
  preview_or_run \
    "curl -LsSf https://astral.sh/uv/install.sh | sh" \
    /bin/bash -lc "curl -LsSf https://astral.sh/uv/install.sh | sh"
  refresh_common_paths
  [[ "$DRY_RUN" == "1" ]] || have uv || die "uv was not found after installation."
}

ensure_deerflow_python() {
  log_step "Preparing Python 3.12 for DeerFlow"
  preview_or_run "uv python install 3.12" uv python install 3.12

  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'python\n'
    return 0
  fi

  local python_bin
  python_bin="$(uv python find 3.12)"
  [[ -n "$python_bin" ]] || die "uv python find 3.12 did not return a Python runtime."
  printf '%s\n' "$python_bin"
}

test_vclaw_checkout() {
  local candidate="$1"
  [[ -d "$candidate" ]] || return 1

  if [[ -d "$candidate/.git" ]]; then
    return 0
  fi

  [[ -f "$candidate/package.json" ]] &&
    [[ -f "$candidate/vclaw.mjs" ]] &&
    [[ -f "$candidate/scripts/run-node.mjs" ]]
}

test_deerflow_checkout() {
  local candidate="$1"
  [[ -d "$candidate" ]] || return 1

  if [[ -d "$candidate/.git" ]]; then
    return 0
  fi

  [[ -f "$candidate/backend/pyproject.toml" ]] &&
    [[ -f "$candidate/backend/src/client.py" ]]
}

is_loopback_proxy_value() {
  local value="${1:-}"
  [[ -n "$value" ]] || return 1
  [[ "$value" == *127.0.0.1* || "$value" == *localhost* ]]
}

proxy_hints() {
  {
    git config --global --get http.proxy 2>/dev/null || true
    git config --global --get https.proxy 2>/dev/null || true
    printf '%s\n' \
      "${HTTP_PROXY:-}" \
      "${HTTPS_PROXY:-}" \
      "${ALL_PROXY:-}" \
      "${http_proxy:-}" \
      "${https_proxy:-}" \
      "${all_proxy:-}"
  } | awk 'NF && !seen[$0]++'
}

remove_path_if_present() {
  local target="$1"
  [[ -e "$target" ]] || return 0
  rm -rf "$target"
}

clone_with_retry() {
  local repo_url="$1"
  local destination="$2"
  local label="$3"
  local validator="$4"

  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] git clone \"$repo_url\" \"$destination\""
    return 0
  fi

  if git clone "$repo_url" "$destination" && "$validator" "$destination"; then
    return 0
  fi

  local hints
  hints="$(
    proxy_hints | while IFS= read -r line; do
      if is_loopback_proxy_value "$line"; then
        printf '%s\n' "$line"
      fi
    done
  )"

  if [[ -z "$hints" ]]; then
    die "$label clone failed."
  fi

  log_warn "$label clone failed while a local proxy is configured. Retrying without proxy."
  log_info "Proxy hints: $(printf '%s\n' "$hints" | paste -sd ', ' -)"

  remove_path_if_present "$destination"

  if ! (
    unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
    git -c http.proxy= -c https.proxy= clone "$repo_url" "$destination"
  ); then
    die "$label clone failed after retrying without proxy."
  fi

  "$validator" "$destination" || die "$label checkout is incomplete after retry."
}

ensure_archive_slot() {
  local archive_target
  if [[ ! -e "$TARGET_DIR" ]]; then
    return 0
  fi

  if test_vclaw_checkout "$TARGET_DIR"; then
    log_step "Target repo directory already looks like a Vclaw checkout"
    return 0
  fi

  archive_target="$LEGACY_GO_ARCHIVE_DIR"
  if [[ -e "$archive_target" ]]; then
    archive_target="${LEGACY_GO_ARCHIVE_DIR}-$(date +%Y%m%d%H%M%S)"
  fi

  log_step "Archiving existing target directory"
  preview_or_run "mv \"$TARGET_DIR\" \"$archive_target\"" mv "$TARGET_DIR" "$archive_target"
}

ensure_repo_checkout() {
  if test_vclaw_checkout "$TARGET_DIR"; then
    log_step "Vclaw checkout ready at $TARGET_DIR"

    if [[ "$NO_GIT_UPDATE" != "1" && -d "$TARGET_DIR/.git" ]]; then
      local status_output
      status_output="$(git -C "$TARGET_DIR" status --porcelain 2>/dev/null || true)"
      if [[ -z "$status_output" ]]; then
        log_step "Updating repository"
        preview_or_run "git -C \"$TARGET_DIR\" pull --rebase" git -C "$TARGET_DIR" pull --rebase
      else
        log_warn "Local repository has changes; skipping git pull"
      fi
    fi
    return 0
  fi

  preview_or_run "mkdir -p \"$(dirname "$TARGET_DIR")\"" mkdir -p "$(dirname "$TARGET_DIR")"
  log_step "Cloning Vclaw repository"
  preview_or_run "git clone \"$REPO_URL\" \"$TARGET_DIR\"" clone_with_retry "$REPO_URL" "$TARGET_DIR" "Vclaw repository" test_vclaw_checkout
}

ensure_deerflow_checkout() {
  local parent_dir stale_dir
  parent_dir="$(dirname "$DEERFLOW_DIR")"
  preview_or_run "mkdir -p \"$parent_dir\"" mkdir -p "$parent_dir"

  if [[ -e "$DEERFLOW_DIR" ]] && ! test_deerflow_checkout "$DEERFLOW_DIR"; then
    stale_dir="${DEERFLOW_DIR}.stale-$(date +%Y%m%d%H%M%S)"
    log_warn "Existing DeerFlow directory is not a valid checkout; moving it to $stale_dir"
    preview_or_run "mv \"$DEERFLOW_DIR\" \"$stale_dir\"" mv "$DEERFLOW_DIR" "$stale_dir"
  fi

  if test_deerflow_checkout "$DEERFLOW_DIR"; then
    log_step "DeerFlow checkout ready at $DEERFLOW_DIR"
    if [[ "$NO_GIT_UPDATE" != "1" && -d "$DEERFLOW_DIR/.git" ]]; then
      local status_output
      status_output="$(git -C "$DEERFLOW_DIR" status --porcelain 2>/dev/null || true)"
      if [[ -z "$status_output" ]]; then
        log_step "Updating DeerFlow repository"
        preview_or_run "git -C \"$DEERFLOW_DIR\" pull --rebase" git -C "$DEERFLOW_DIR" pull --rebase
      else
        log_warn "Local DeerFlow checkout has changes; skipping git pull"
      fi
    fi
    return 0
  fi

  log_step "Cloning DeerFlow repository"
  preview_or_run "git clone \"$DEERFLOW_REPO_URL\" \"$DEERFLOW_DIR\"" clone_with_retry "$DEERFLOW_REPO_URL" "$DEERFLOW_DIR" "DeerFlow repository" test_deerflow_checkout

  test_deerflow_checkout "$DEERFLOW_DIR" || die "DeerFlow checkout is missing or incomplete after clone."
}

write_vclaw_wrapper() {
  local wrapper_path="${WRAPPER_DIR}/vclaw"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] write ${WRAPPER_DIR}/vclaw"
    return 0
  fi

  cat >"$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$TARGET_DIR"
exec node scripts/run-node.mjs "\$@"
EOF
  chmod +x "$wrapper_path"
}

write_openclaw_wrapper() {
  local wrapper_path="${WRAPPER_DIR}/openclaw"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] write ${WRAPPER_DIR}/openclaw"
    return 0
  fi

  cat >"$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$TARGET_DIR"
exec node openclaw.mjs "\$@"
EOF
  chmod +x "$wrapper_path"
}

write_agentos_wrapper() {
  local wrapper_path="${WRAPPER_DIR}/agentos"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] write ${WRAPPER_DIR}/agentos"
    return 0
  fi

  cat >"$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$TARGET_DIR"
exec node --import tsx src/cli/agentos.ts "\$@"
EOF
  chmod +x "$wrapper_path"
}

append_path_export_if_missing() {
  local shell_rc="$1"
  local export_line
  export_line="export PATH=\"$WRAPPER_DIR:\$PATH\""

  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] ensure $shell_rc contains PATH export for $WRAPPER_DIR"
    return 0
  fi

  mkdir -p "$(dirname "$shell_rc")"
  touch "$shell_rc"
  if ! grep -Fqs "$export_line" "$shell_rc"; then
    {
      printf '\n# Added by Vclaw bootstrap\n'
      printf '%s\n' "$export_line"
    } >>"$shell_rc"
  fi
}

ensure_wrapper_dir_on_path() {
  if [[ ":$PATH:" != *":$WRAPPER_DIR:"* ]]; then
    PATH="$WRAPPER_DIR:$PATH"
    export PATH
  fi

  append_path_export_if_missing "${HOME}/.profile"
  append_path_export_if_missing "${HOME}/.bashrc"
  append_path_export_if_missing "${HOME}/.zshrc"
}

ensure_wrappers() {
  preview_or_run "mkdir -p \"$WRAPPER_DIR\"" mkdir -p "$WRAPPER_DIR"
  write_vclaw_wrapper
  write_openclaw_wrapper
  write_agentos_wrapper
  ensure_wrapper_dir_on_path
}

install_workspace_dependencies() {
  log_step "Installing workspace dependencies"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] (cd \"$TARGET_DIR\" && pnpm install)"
    return 0
  fi

  (
    cd "$TARGET_DIR"
    pnpm install
  )
}

install_deerflow_dependencies() {
  local python_bin="$1"
  test_deerflow_checkout "$DEERFLOW_DIR" || die "DeerFlow checkout is not ready. Dependency installation was stopped before entering backend."
  [[ -d "$DEERFLOW_DIR/backend" ]] || die "DeerFlow backend directory is missing: $DEERFLOW_DIR/backend"
  log_step "Installing DeerFlow backend dependencies"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] (cd \"$DEERFLOW_DIR/backend\" && uv sync --python \"$python_bin\")"
    return 0
  fi

  (
    cd "$DEERFLOW_DIR/backend"
    uv sync --python "$python_bin"
  )
}

configure_deerflow_runtime() {
  local python_bin="$1"
  local args=(
    "scripts/bootstrap/configure-deerflow.mjs"
    "--vclaw-root" "$TARGET_DIR"
    "--deerflow-root" "$DEERFLOW_DIR"
    "--python-bin" "$python_bin"
    "--mode" "$DEERFLOW_MODE"
  )
  if [[ "$KEEP_DEERFLOW_CONFIG" == "1" ]]; then
    args+=("--keep-config")
  fi

  log_step "Configuring DeerFlow runtime metadata at $DEERFLOW_RUNTIME_PATH"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] (cd \"$TARGET_DIR\" && node ${args[*]})"
    return 0
  fi

  (
    cd "$TARGET_DIR"
    node "${args[@]}" >/dev/null
  )
}

invoke_smoke_verification() {
  log_step "Running smoke verification"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_info "[dry-run] (cd \"$TARGET_DIR\" && pnpm vclaw -- help >/dev/null)"
    log_info "[dry-run] (cd \"$TARGET_DIR\" && pnpm vclaw:agentos -- demo --json >/dev/null)"
    if [[ "$NO_DEERFLOW" != "1" ]]; then
      log_info "[dry-run] (cd \"$TARGET_DIR\" && pnpm vclaw:agentos -- run --goal \"research competitive landscape\" --task-type research --json >/dev/null)"
    fi
    return 0
  fi

  (
    cd "$TARGET_DIR"
    pnpm vclaw -- help >/dev/null
    pnpm vclaw:agentos -- demo --json >/dev/null
    if [[ "$NO_DEERFLOW" != "1" ]]; then
      pnpm vclaw:agentos -- run --goal "research competitive landscape" --task-type research --json >/dev/null
    fi
  )
}

show_summary() {
  printf '\n'
  printf 'Vclaw bootstrap complete.\n'
  printf 'Repo: %s\n' "$TARGET_DIR"
  printf 'Wrappers: %s\n' "$WRAPPER_DIR"
  if [[ "$NO_DEERFLOW" != "1" ]]; then
    printf 'DeerFlow: %s\n' "$DEERFLOW_DIR"
  fi
  printf '\nReady commands:\n'
  printf '  vclaw --help\n'
  printf '  agentos demo\n'
  if [[ "$NO_DEERFLOW" != "1" ]]; then
    printf '  agentos run --goal "research competitive landscape" --task-type research --json\n'
  fi
  if [[ "$NO_ONBOARD" != "1" ]]; then
    printf '  vclaw onboard\n'
  fi
  printf '\n'
}

main() {
  parse_args "$@"
  detect_os
  refresh_common_paths
  DEERFLOW_DIR="${TARGET_DIR}/.vclaw/deerflow"
  DEERFLOW_RUNTIME_PATH="${DEERFLOW_DIR}/runtime.json"

  log_step "Checking environment"
  ensure_git
  ensure_node
  ensure_corepack_and_pnpm

  log_step "Preparing repository layout"
  ensure_archive_slot
  ensure_repo_checkout

  log_step "Installing Vclaw"
  install_workspace_dependencies
  ensure_wrappers

  if [[ "$NO_DEERFLOW" != "1" ]]; then
    log_step "Installing DeerFlow sidecar"
    ensure_uv
    local python_bin
    python_bin="$(ensure_deerflow_python)"
    ensure_deerflow_checkout
    install_deerflow_dependencies "$python_bin"
    configure_deerflow_runtime "$python_bin"
  fi

  invoke_smoke_verification
  show_summary
}

main "$@"
