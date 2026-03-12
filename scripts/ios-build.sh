#!/usr/bin/env bash
set -euo pipefail

./scripts/ios-configure-signing.sh
cd apps/ios
xcodegen generate
xcodebuild -project OpenClaw.xcodeproj -scheme OpenClaw -destination "${IOS_DEST:-platform=iOS Simulator,name=iPhone 17}" -configuration Debug build
