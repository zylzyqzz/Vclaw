# DeerFlow Bridge Implementation Note

Date: 2026-03-12

## Goal

Add DeerFlow into Vclaw AgentOS as an optional high-capability research engine without disturbing
the existing CLI, memory model, or non-research task paths.

## Scope

- keep existing Vclaw routing and role registry intact
- add an optional DeerFlow bridge behind `agentos`
- route only research-shaped tasks into DeerFlow
- normalize DeerFlow output into the existing Vclaw task contract:
  - `conclusion`
  - `plan`
  - `risks`
  - `acceptance`
- import DeerFlow summaries back into Vclaw memory

## Implemented Shape

### 1. Config

`OrchestratorConfig` now includes `deerflow` with:

- enable flag
- timeout
- execution mode
- route policy
- embedded Python client settings

Defaults are conservative:

- DeerFlow is disabled unless explicitly enabled
- backend path is auto-detected when a local DeerFlow checkout exists
- research, report, and analysis-like tasks are the main activation targets

### 2. Bridge

Added `src/agentos/integration/deerflow-bridge.ts`.

It handles:

- task eligibility detection
- Vclaw-to-DeerFlow prompt shaping
- calling DeerFlow through its embedded Python client
- parsing DeerFlow markdown back into Vclaw contract fields
- graceful unavailable / failed states

### 3. Embedded Runtime Adapter

Added `scripts/deerflow/vclaw_deerflow_bridge.py`.

This script:

- imports `DeerFlowClient` from a DeerFlow backend checkout
- maps Vclaw execution modes onto DeerFlow behavior:
  - `flash`
  - `standard`
  - `pro`
  - `ultra`
- streams DeerFlow execution
- returns compact JSON for Node-side normalization

### 4. Orchestrator Integration

`Orchestrator.run()` now:

- keeps the existing role route
- optionally augments research tasks with DeerFlow
- falls back cleanly if DeerFlow is unavailable
- can still succeed when DeerFlow completes but local role routing has no coverage

### 5. Memory Import

When DeerFlow completes successfully, Vclaw stores:

- a DeerFlow long-term summary
- research sources / artifacts in project-entity memory

## Guardrails

- non-research tasks do not change behavior
- DeerFlow is additive, not a replacement runtime
- failures in DeerFlow do not crash the normal Vclaw route
- no UI or onboarding flow changes were made

## Validation

- targeted TypeScript compile check
- dedicated DeerFlow bridge tests
- orchestrator integration tests
- full AgentOS command-contract regression
