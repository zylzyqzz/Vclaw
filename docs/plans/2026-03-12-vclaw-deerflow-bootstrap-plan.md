# Vclaw DeerFlow Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a fresh Vclaw installation also provision a callable DeerFlow backend so Vclaw can use DeerFlow immediately after bootstrap.

**Architecture:** Keep Vclaw as the primary runtime and install DeerFlow as a local sidecar under `.vclaw/deerflow`. Extend the bootstrap scripts to provision `uv`, Python 3.12, a DeerFlow checkout, backend dependencies, and a local runtime metadata file that AgentOS can auto-detect without extra manual configuration.

**Tech Stack:** PowerShell, Bash, Node.js, TypeScript, uv, Python 3.12, Vitest

---

### Task 1: Define the local DeerFlow runtime metadata contract

**Files:**
- Modify: `E:/Vclaw/src/agentos/config/loader.ts`
- Test: `E:/Vclaw/test/agentos/config-loader.test.ts`

**Step 1: Write the failing test**

Add a config-loader assertion for a persisted DeerFlow runtime metadata file in `.vclaw/deerflow/runtime.json`.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/agentos/config-loader.test.ts`

**Step 3: Write minimal implementation**

Teach the loader to read runtime metadata and auto-enable DeerFlow when the install metadata is present.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/agentos/config-loader.test.ts`

### Task 2: Add DeerFlow install helpers to the Windows bootstrap

**Files:**
- Modify: `E:/Vclaw/scripts/vclaw-bootstrap.ps1`
- Test: `E:/Vclaw/test/agentos/vclaw-bootstrap.contract.test.ts`

**Step 1: Write the failing test**

Add contract expectations for DeerFlow repo URL, `uv`, Python 3.12, and runtime metadata generation.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/agentos/vclaw-bootstrap.contract.test.ts`

**Step 3: Write minimal implementation**

Add PowerShell helpers to install `uv`, provision Python 3.12, clone/update DeerFlow, `uv sync` the backend, write config/runtime metadata, and extend smoke checks.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/agentos/vclaw-bootstrap.contract.test.ts`

### Task 3: Add DeerFlow install helpers to the macOS/Linux bootstrap

**Files:**
- Modify: `E:/Vclaw/scripts/vclaw-bootstrap.sh`
- Test: `E:/Vclaw/test/agentos/vclaw-bootstrap-shell.contract.test.ts`

**Step 1: Write the failing test**

Add Unix bootstrap contract assertions for DeerFlow install and metadata generation.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/agentos/vclaw-bootstrap-shell.contract.test.ts`

**Step 3: Write minimal implementation**

Install `curl`, `uv`, managed Python 3.12, DeerFlow checkout/backend dependencies, and write runtime metadata for AgentOS detection.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/agentos/vclaw-bootstrap-shell.contract.test.ts`

### Task 4: Make AgentOS auto-detect installed DeerFlow

**Files:**
- Modify: `E:/Vclaw/src/agentos/config/loader.ts`
- Test: `E:/Vclaw/test/agentos/deerflow-bridge.test.ts`
- Test: `E:/Vclaw/test/agentos/orchestrator-deerflow.test.ts`

**Step 1: Write the failing test**

Ensure an installed runtime metadata file causes DeerFlow to be enabled and usable without passing extra CLI flags.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/agentos/deerflow-bridge.test.ts test/agentos/orchestrator-deerflow.test.ts`

**Step 3: Write minimal implementation**

Merge runtime metadata into the default DeerFlow config and keep graceful fallback when the install is incomplete.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/agentos/deerflow-bridge.test.ts test/agentos/orchestrator-deerflow.test.ts`

### Task 5: Document the new one-command install story

**Files:**
- Modify: `E:/Vclaw/README.md`
- Modify: `E:/Vclaw/docs/install/installer.md`
- Test: `E:/Vclaw/test/agentos/readme-smoke.test.ts`

**Step 1: Write the failing test**

Add README contract checks for DeerFlow-inclusive bootstrap language.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/agentos/readme-smoke.test.ts`

**Step 3: Write minimal implementation**

Explain that bootstrap provisions DeerFlow backend sidecar, note model/API-key detection behavior, and show the resulting research command path.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/agentos/readme-smoke.test.ts`

### Task 6: Run the integrated verification set

**Files:**
- No code changes

**Step 1: Run type check**

Run: `pnpm exec tsc -p tsconfig.json --noEmit`

**Step 2: Run focused install/integration tests**

Run: `pnpm exec vitest run test/agentos/config-loader.test.ts test/agentos/deerflow-bridge.test.ts test/agentos/orchestrator-deerflow.test.ts test/agentos/vclaw-bootstrap.contract.test.ts test/agentos/vclaw-bootstrap-shell.contract.test.ts test/agentos/readme-smoke.test.ts`

**Step 3: Run full AgentOS regression**

Run: `pnpm exec vitest run test/agentos`

**Step 4: Run CLI smoke**

Run: `pnpm vclaw:agentos -- run --goal "research competitive landscape" --task-type research --json`
