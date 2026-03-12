#!/usr/bin/env bash
set -euo pipefail

./scripts/ios-configure-signing.sh
cd apps/ios
xcodegen generate
open OpenClaw.xcodeproj
