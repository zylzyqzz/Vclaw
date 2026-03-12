#!/usr/bin/env bash
set -euo pipefail

swiftformat --lint --config .swiftformat apps/macos/Sources apps/ios/Sources apps/shared/OpenClawKit/Sources
