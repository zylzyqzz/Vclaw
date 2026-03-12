# Vclaw Architecture

Version: `2026.3.12`

## Overview

Vclaw is a local-first runtime with a Vclaw-first user surface, a Gateway-centric control plane,
and an AgentOS runtime that stays inspectable from the filesystem and CLI.

In practice:

- the visible brand is `Vclaw`
- the primary CLI entry is `vclaw`
- the AgentOS entry is `agentos`
- the repo defaults to Vclaw-native paths and config files

## Core Runtime Areas

### Gateway and CLI

Primary user entrypoints live in:

- `src/cli/`
- `vclaw.mjs`
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

## Runtime Paths

The Vclaw runtime uses Vclaw-native paths by default:

- `.vclaw`
- `.vclaw-agentos.json`

## Design Principle

The product should feel singular:

- one visible brand
- one primary CLI
- one documented local-first path
- one inspectable AgentOS runtime
