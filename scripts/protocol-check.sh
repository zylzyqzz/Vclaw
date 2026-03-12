#!/usr/bin/env bash
set -euo pipefail

pnpm protocol:gen
pnpm protocol:gen:swift
git diff --exit-code -- dist/protocol.schema.json apps/macos/Sources/OpenClawProtocol/GatewayModels.swift
