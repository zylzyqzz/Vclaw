#!/usr/bin/env bash
set -euo pipefail

# WeiClaw Release Script
# Supports: macOS, Linux
#
# Usage:
#   ./release.sh                      # Release with current version
#   ./release.sh -v 1.0.0             # Release specific version
#   ./release.sh -b patch             # Bump patch version
#   ./release.sh -b minor            # Bump minor version
#   ./release.sh -b major             # Bump major version
#   ./release.sh --dry-run            # Test without publishing
#   ./release.sh --no-publish         # Commit and tag, but don't push/release
#   ./release.sh --verbose            # Show detailed output
#   ./release.sh --skip-verify        # Skip pre-release verification

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${WEICLAW_LOG_DIR:-$HOME/.weiclaw/logs}"
LOG_FILE="$LOG_DIR/release.log"

RED='\033[38;5;196m'
YELLOW='\033[38;5;226m'
GREEN='\033[38;5;46m'
GRAY='\033[90m'
NC='\033[0m'

VERSION=""
BUMP=""
DRY_RUN=0
NO_PUBLISH=0
VERBOSE=0
SKIP_VERIFY=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--version) VERSION="$2"; shift 2 ;;
    -b|--bump) BUMP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-publish) NO_PUBLISH=1; shift ;;
    --verbose) VERBOSE=1; shift ;;
    --skip-verify) SKIP_VERIFY=1; shift ;;
    --force) FORCE=1; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

init_log() {
  mkdir -p "$LOG_DIR"
  echo "# WeiClaw Release Log" > "$LOG_FILE"
  echo "# Started $(date)" >> "$LOG_FILE"
}

log_step() { printf "%b%s%b\n" "$RED" "$1" "$NC"; }
log_info() {" == "1 [[ "$VERBOSE" ]] && printf "%b%s%b\n" "$GRAY" "$1" "$NC" || true; }
log_succ() { printf "%b%s%b\n" "$GREEN" "$1" "$NC"; }
log_err() { printf "%bError: %s%b\n" "$RED" "$1" "$NC"; exit 1; }

run_cmd() { log_info "Running: $*"; "$@" || log_err "Failed: $*"; }

get_ver() { grep -oP '"version":\s*"\K[^"]+' "$REPO_ROOT/package.json"; }

next_ver() {
  local cur=$1 typ=$2
  IFS='.' read -ra P <<< "$cur"
  case $typ in
    major) echo "$((${P[0]}+1)).0.0" ;;
    minor) echo "${P[0]}.$((${P[1]}+1)).0" ;;
    patch) echo "${P[0]}.${P[1]}.$((${P[2]}+1))" ;;
  esac
}

upd_ver() {
  local new=$1 f="$REPO_ROOT/package.json"
  local old
  old=$(grep -oP '"version":\s*"\K[^"]+' "$f")
  node -e "const fs=require('fs');let p=JSON.parse(fs.readFileSync('$f'));p.version='$new';fs.writeFileSync('$f',JSON.stringify(p,null,2)+'\n')"
  echo "$old"
}

build_pkg() {
  log_step "Building runtime..."
  node "$REPO_ROOT/scripts/pack-runtime-simple.mjs" || log_err "Build failed"
  [[ -f "$REPO_ROOT/.artifacts/runtime/weiclaw-runtime.tgz" ]] || log_err "Package missing"
  echo "$REPO_ROOT/.artifacts/runtime/weiclaw-runtime.tgz"
}

upd_notes() {
  local v=$1 d=$(date +%Y-%m-%d)
  local n="
## [$v] - $d
### Added
- Automated release system
- Silent install
### Changed
- Runtime packaging
"
  [[ -f "$REPO_ROOT/CHANGELOG.md" ]] && { echo "$n"; cat "$REPO_ROOT/CHANGELOG.md"; } > "$REPO_ROOT/CHANGELOG.tmp" && mv "$REPO_ROOT/CHANGELOG.tmp" "$REPO_ROOT/CHANGELOG.md" || echo "$n" > "$REPO_ROOT/CHANGELOG.md"
}

git_commit() { git add -A && git commit -m "Release v$1"; }
git_tag() { git tag -a "v$1" -m "Release v$1"; }
git_push() { git push origin main && git push origin --tags; }

gh_release() {
  local v=$1 p=$2
  command -v gh >/dev/null 2>&1 || { log_info "gh not found"; return; }
  gh release create "v$v" --title "WeiClaw v$v" --generate-notes 2>/dev/null || true
  [[ -n "$p" && -f "$p" ]] && gh release upload "v$v" "$p" --clobber 2>/dev/null || true
}

echo ""
echo "========================================"
echo "  WeiClaw Release Script"
echo "========================================"
echo ""

init_log

[[ -n "$VERSION" && -n "$BUMP" ]] && log_err "Cannot use -v and -b together"

[[ -z "$VERSION" && -z "$BUMP" ]] && VERSION=$(get_ver)

[[ -n "$BUMP" ]] && VERSION=$(next_ver "$(get_ver)" "$BUMP")

echo "Target version: $VERSION"
echo ""

[[ "$DRY_RUN" == "1" ]] && echo "[DRY-RUN]"
echo ""

if [[ "$SKIP_VERIFY" == "0" ]]; then
  log_step "Verify..."
  node "$REPO_ROOT/scripts/verify-release.mjs" || log_err "Verify failed"
else
  echo "[SKIP VERIFY]"
fi

echo ""
log_step "Build..."
pkg=$(build_pkg)

echo ""
log_step "Update version..."
old=$(upd_ver "$VERSION")

echo ""
log_step "Release notes..."
upd_notes "$VERSION"

[[ "$DRY_RUN" == "0" ]] && { git_commit "$VERSION"; echo ""; log_step "Tag..."; git_tag "$VERSION"; }

[[ "$NO_PUBLISH" == "0" && "$DRY_RUN" == "0" ]] && { echo ""; log_step "Push..."; git_push; echo ""; log_step "Release..."; gh_release "$VERSION" "$pkg"; }

echo ""
echo "========================================"
echo "  Release v$VERSION Done!"
echo "========================================"
echo "  Old: $old -> New: $VERSION"
echo "  Package: $pkg"
echo ""
