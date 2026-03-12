# Vclaw Architecture

## Overview

Vclaw is a local-first runtime with a Vclaw-first user surface and a compatibility-aware core.
The repo still keeps important internal module paths and runtime contracts stable where renaming
them would risk breaking existing systems.

In practice:

- the visible brand is `Vclaw`
- the CLI is moving to `vclaw` examples and help text
- compatibility aliases and internal legacy paths remain where needed

## Core Runtime Areas

### Gateway and CLI

Primary user entrypoints live in:

- `src/cli/`
- `openclaw.mjs`
- `scripts/run-node.mjs`

The CLI surface handles:

- gateway lifecycle
- channels
- skills
- approvals
- memory inspection
- node management
- status and diagnostics

### AgentOS Runtime

The local multi-agent demo and orchestration stack lives in:

- `src/agentos/config/`
- `src/agentos/storage/`
- `src/agentos/repository/`
- `src/agentos/registry/`
- `src/agentos/session/`
- `src/agentos/memory/`
- `src/agentos/orchestrator/`
- `src/agentos/runtime/`

Key concepts include:

- role templates
- runtime agents
- presets
- orchestrator routing
- session state
- layered memory

### Agent and Tool Surface

Agent-facing behavior is composed from:

- `src/agents/`
- `src/commands/`
- `src/memory/`
- `src/storage/`

This layer is responsible for:

- tool policy
- system prompt construction
- message delivery
- memory search and indexing
- model and auth workflows

## Data and Storage

### Preferred Storage Strategy

The storage model stays local-first:

- SQLite when available
- file fallback when SQLite cannot initialize

### Memory Layers

The runtime preserves three memory layers:

- short-term session memory
- long-term summarized memory
- project or entity memory

### Session Data

Session state and transcripts remain observable and debuggable through CLI inspection commands
instead of hidden behind opaque services.

## Compatibility Strategy

The migration deliberately separates visible branding from risky internals.

Safe to change first:

- help text
- docs
- onboarding language
- banner and tagline text
- example commands

Preserved for stability:

- legacy env vars such as `OPENCLAW_*`
- package name and compatibility exports
- legacy runtime module names where external code may depend on them

AgentOS-specific compatibility already prefers:

- `.vclaw`
- `.vclaw-agentos.json`

while still reading:

- `.weiclaw-agentos`
- `.weiclaw-agentos.json`

## Design Principle

The repo is not trying to win by a risky rename.
It wins by keeping execution, skills, memory, and orchestration stable while progressively
replacing old brand surfaces with `Vclaw`.
