#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

run() {
  echo "> $*"
  (cd "$ROOT" && "$@")
}

run_agentos() {
  echo "> (agentos-cwd=$TMP) $*"
  (cd "$TMP" && "$@")
}

run pnpm tsgo
run pnpm exec vitest run test/agentos/*.test.ts
run_agentos node --import "$ROOT/node_modules/tsx/dist/loader.mjs" "$ROOT/src/cli/agentos.ts" demo --session smoke-main
run_agentos node --import "$ROOT/node_modules/tsx/dist/loader.mjs" "$ROOT/src/cli/agentos.ts" demo --session smoke-main --json
run_agentos node --import "$ROOT/node_modules/tsx/dist/loader.mjs" "$ROOT/src/cli/agentos.ts" run --goal "smoke release path" --preset default-demo --json
run_agentos node --import "$ROOT/node_modules/tsx/dist/loader.mjs" "$ROOT/src/cli/agentos.ts" inspect-memory --session smoke-main --json

echo "agentos smoke passed"
