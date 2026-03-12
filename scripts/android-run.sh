#!/usr/bin/env bash
set -euo pipefail

cd apps/android
./gradlew :app:installDebug
adb shell am start -n ai.openclaw.android/.MainActivity
