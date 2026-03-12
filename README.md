# Vclaw

Vclaw is a local-first multi-agent runtime that keeps the execution core, memory system, and tool
surface stable while presenting a Vclaw-first CLI, docs, and onboarding experience.

This repository is being migrated conservatively:

- user-facing branding moves to `Vclaw`
- core execution behavior stays stable
- multi-agent orchestration remains intact
- durable memory remains intact
- skills and tool invocation remain intact
- compatibility edges stay in place where changing them would risk breakage

## Project Positioning

Vclaw is designed for operators who want:

- local-first execution instead of a cloud-only control plane
- a strong multi-agent workflow instead of a single monolithic agent
- inspectable memory instead of opaque hidden state
- structured CLI and JSON output instead of ad hoc terminal text
- stable skills and tool execution instead of fragile prompt-only behavior

The current codebase already preserves the foundations that matter:

- task execution stability
- multi-agent routing and presets
- short-term, long-term, and project/entity memory
- Gateway and node-host workflows
- CLI and machine-readable JSON contracts
- compatibility with legacy OpenClaw and WeiClaw surfaces where needed

## Core Capabilities

### 1. Multi-Agent Orchestration

The AgentOS surface ships with role-based orchestration and a demo route that uses:

- `commander`
- `planner`
- `builder`
- `reviewer`

Structured task results follow the same contract across the orchestration flow:

- `conclusion`
- `plan`
- `risks`
- `acceptance`

### 2. Durable Memory

The runtime preserves three memory layers:

- short-term session memory
- long-term summarized memory
- project/entity memory

Memory is inspectable from the CLI rather than hidden behind an opaque service boundary.

### 3. Gateway and Tool Surface

The repository includes a large CLI and Gateway runtime surface for:

- status and diagnostics
- onboarding and configuration
- skills
- approvals
- browser control
- node management
- channels and delivery flows
- memory inspection

### 4. Local-First Storage

Storage remains local-first:

- SQLite is preferred when available
- file-based fallback is preserved for resilience

## Current Branding Strategy

This migration is intentionally not a risky "rename everything at once" exercise.

What is already Vclaw-first:

- CLI examples and help text
- onboarding language
- status and QR flows
- README and top-level docs
- AgentOS default state paths

What remains intentionally compatible:

- published npm package name: `openclaw`
- CLI aliases: `openclaw`, `weiclaw`, `agentos`
- legacy environment variables such as `OPENCLAW_*`
- selected historical paths and app/service boundaries that could still be referenced by existing installs

## Requirements

- Node.js `>= 22.12.0`
- `pnpm`

Recommended:

- a local shell with file system access
- macOS/Linux/WSL2 for the broader Gateway tooling surface

## Quick Start

Install dependencies:

```bash
pnpm install
```

Run the AgentOS demo:

```bash
pnpm vclaw:agentos -- demo
```

List demo roles and presets:

```bash
pnpm vclaw:agentos -- list-roles
pnpm vclaw:agentos -- list-presets
```

Run a structured goal:

```bash
pnpm vclaw:agentos -- run --goal "generate release checklist" --preset default-demo --json
```

Inspect memory:

```bash
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

Open the main Vclaw CLI help:

```bash
pnpm vclaw -- help
```

Compatibility entrypoints still work:

```bash
pnpm agentos -- demo
pnpm openclaw -- help
pnpm weiclaw -- help
```

## AgentOS Commands

Primary AgentOS commands:

```bash
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- run --goal "assess release risk" --preset default-demo
pnpm vclaw:agentos -- chat --preset default-demo
pnpm vclaw:agentos -- list-roles
pnpm vclaw:agentos -- inspect-memory --session demo-main
```

Expected behavior:

- role selection remains deterministic and inspectable
- JSON output remains stable for automation
- memory writes happen across the three preserved layers

## Main Vclaw CLI Surface

The repository also exposes the broader runtime CLI:

```bash
pnpm vclaw -- help
pnpm vclaw status
pnpm vclaw gateway status
pnpm vclaw memory status
pnpm vclaw skills list
pnpm vclaw doctor
```

These commands are part of the compatibility-preserving runtime surface, not a separate toy shell.

## Memory Model

The memory system is designed around durable operator visibility.

### Short-Term Session Memory

Used for active session context and recent task continuity.

### Long-Term Summarized Memory

Used for preserving durable summaries across repeated task execution.

### Project / Entity Memory

Used for higher-level facts and delivery state that should survive beyond a single request.

## State and Compatibility Paths

AgentOS now prefers:

- `.vclaw`
- `.vclaw-agentos.json`

It still reads legacy compatibility state automatically:

- `.weiclaw-agentos`
- `.weiclaw-agentos.json`

This lets fresh workspaces adopt Vclaw-first defaults without breaking older local state.

## Repository Structure

High-value areas in the repository:

- `src/cli/`
  CLI entrypoints, user-facing commands, help, onboarding, diagnostics
- `src/commands/`
  Runtime command logic, onboarding flows, status, doctor, auth, memory operations
- `src/agentos/`
  AgentOS config, registry, orchestrator, session, memory, runtime, storage
- `src/agents/`
  Agent definitions, routing logic, prompts, model behavior
- `src/memory/`
  Memory search, indexing, plugin integration, status formatting
- `src/storage/`
  Persistence abstractions and backing stores
- `docs/architecture.md`
  Architecture summary and compatibility strategy
- `docs/roadmap.md`
  Migration roadmap and acceptance standard

## Development Workflow

### Type Check

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

### Focused Regression Checks

```bash
pnpm exec vitest run test/agentos
pnpm exec vitest run src/cli/completion-cli.defaults.test.ts src/cli/update-cli.test.ts src/cli/skills-cli.test.ts src/cli/program/help.test.ts src/cli/qr-cli.test.ts
```

### Useful Smoke Commands

```bash
pnpm agentos -- help
pnpm agentos -- demo --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
pnpm vclaw -- help
```

## Documentation

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)

## Current Acceptance Standard

The Vclaw migration is only acceptable if these remain true:

- task execution stays stable
- multi-agent routing stays strong
- skills continue to load and execute cleanly
- memory stays complete and inspectable
- user-facing CLI surfaces feel like Vclaw, not a half-renamed fork

## Notes for Operators

- If you are starting fresh, prefer `vclaw` and `pnpm vclaw:agentos -- ...`
- If you already depend on `openclaw`, `weiclaw`, or `OPENCLAW_*`, those compatibility paths are still preserved
- If you are validating the migration, use both smoke commands and JSON-mode checks rather than relying only on help text
