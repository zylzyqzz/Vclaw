# Vclaw

Version: `2026.3.12`

Vclaw is a local-first multi-agent runtime with a Gateway control plane, an inspectable AgentOS
runtime, layered memory, and a Vclaw-first CLI surface.

This repository is optimized for one thing first:

- make the system runnable on a single machine
- keep execution and memory observable
- keep multi-agent orchestration explicit
- keep the operator surface honest

## What Vclaw Is

Vclaw is not a thin demo wrapper.

The repository includes:

- a Gateway that exposes a long-lived runtime surface
- an AgentOS runtime for role routing, session state, memory, and execution contracts
- CLI entrypoints for task execution, chat, diagnostics, and memory inspection
- a local workspace model for agent instructions and operator control
- optional DeerFlow sidecar support for research-heavy tasks

## Current Architecture

### 1. Gateway

The Gateway is the runtime-facing control plane.

- one long-lived connection surface
- WebSocket API, default port `18789`
- supports multiple clients such as CLI, desktop apps, and web surfaces

### 2. AgentOS Runtime

Core AgentOS code lives in `src/agentos/`:

- `config/` - runtime configuration
- `session/` - session lifecycle and state
- `memory/` - short-term, long-term, and project/entity memory
- `orchestrator/` - route selection and multi-role task flow
- `runtime/` - bootstrap and runtime assembly
- `execution/` - role execution pipeline
- `storage/` - SQLite and file fallback

### 3. Agent Workspace

Vclaw uses a single agent workspace with these control files:

- `AGENTS.md` - operating instructions and long-lived guidance
- `SOUL.md` - role, tone, and behavioral boundary
- `TOOLS.md` - tool usage rules
- `BOOTSTRAP.md` - first-run bootstrap ritual, removed after completion
- `IDENTITY.md` - name and style
- `USER.md` - user-specific preferences

### 4. DeerFlow Sidecar

DeerFlow is optional.

- it is not bundled as a direct package dependency
- it is used as an external sidecar for research-style tasks
- AgentOS can call it when a task is explicitly research-heavy or when forced by flags

## Project Layout

The directories that matter most for day-to-day work are:

- `src/cli/` - Vclaw and AgentOS CLI surfaces
- `src/agentos/` - AgentOS runtime core
- `src/commands/` - main Vclaw command implementations
- `docs/` - architecture, roadmap, release, usage, and troubleshooting docs
- `scripts/` - bootstrap, packaging, testing, and maintenance scripts
- `test/agentos/` - AgentOS regression coverage

## Install

### Recommended on Windows

```powershell
powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.ps1)))"
```

What the bootstrap does:

- checks `git`, Node.js `22.12+`, Corepack, and `pnpm`
- installs missing prerequisites when supported installers are available
- archives an occupied `E:\Vclaw` folder to `E:\Vclaw-Go-unfinished` when needed
- syncs the repo into `E:\Vclaw`
- runs `pnpm install`
- creates `vclaw.cmd` and `agentos.cmd` wrappers
- runs smoke verification
- prints the next commands you should run, including `vclaw onboard`

### Recommended on macOS and Linux

```bash
curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.sh | bash
```

What the bootstrap does:

- clones or updates `https://github.com/zylzyqzz/Vclaw.git` into `~/Vclaw`
- installs missing prerequisites when the machine has a supported package manager
- runs `pnpm install`
- creates `vclaw` and `agentos` wrappers in `~/.local/bin`
- appends the wrapper directory to shell startup files when needed
- runs smoke verification and prints the next commands

### Wrapper locations after install

- Windows: `%USERPROFILE%\.local\bin`
- macOS/Linux: `~/.local/bin`

Reopen the terminal after bootstrap if `vclaw` or `agentos` is not found on the first try.

## Manual Source Setup

```bash
node -v
git --version
corepack enable
corepack prepare pnpm@10.23.0 --activate
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
pnpm install
pnpm vclaw -- help
pnpm vclaw:agentos -- help
```

Use the manual source path only if you intentionally want to work from a checkout. For normal installation, use the GitHub bootstrap scripts above.

## Configure

### 1. Finish onboarding

After bootstrap, run:

```bash
vclaw onboard
```

If the wrapper command is not available yet, run it from the checkout:

```bash
cd ~/Vclaw
pnpm vclaw -- onboard
```

On Windows, the default checkout is `E:\Vclaw`.

### 2. Create the runtime home

Recommended paths:

- Windows config: `E:\Vclaw\.vclaw\vclaw.json`
- macOS/Linux config: `~/.vclaw/vclaw.json`
- workspace: `~/.vclaw/workspace` or `E:\Vclaw\.vclaw\workspace`

### 3. Write a minimal config

```json5
{
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: {
      token: "replace-with-a-long-random-token"
    }
  },
  agent: {
    workspace: "~/.vclaw/workspace"
  },
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"]
    }
  }
}
```

If you are on Windows, replace the workspace path with `E:\\Vclaw\\.vclaw\\workspace`.

### 4. Start and verify

```bash
vclaw --help
agentos --help
vclaw gateway status
vclaw dashboard
agentos demo --json
```

If wrapper commands are still unavailable, use the repo-local fallback:

```bash
cd ~/Vclaw
pnpm vclaw -- help
pnpm vclaw:agentos -- demo --json
```

On Windows, replace `~/Vclaw` with `E:\Vclaw`.

## Quick Start

### 1. Main CLI

```bash
pnpm vclaw -- help
pnpm vclaw status
pnpm vclaw doctor
```

### 2. AgentOS Demo

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace --json
pnpm vclaw:agentos -- demo --json
```

### 3. Run a Task

```bash
pnpm vclaw:agentos -- run --goal "generate a release checklist" --preset default-demo --json
```

### 4. Inspect Memory

```bash
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

### 5. Inspect Session Replay

```bash
pnpm vclaw:agentos -- inspect-session --session demo-main --json
```

### 6. Use a Real Vclaw Role Executor

```bash
pnpm vclaw:agentos -- run --goal "implement release hardening" --executor vclaw --json
```

If `--executor vclaw` cannot complete, AgentOS now falls back explicitly and records that fallback
in the task result instead of pretending the role executed remotely.

## AgentOS Commands

Minimum core commands:

- `run`
- `chat`
- `inspect-memory`
- `inspect-session`
- `setup-workspace`
- `list-roles`
- `list-presets`

Useful examples:

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace --json
pnpm vclaw:agentos -- list-roles --json
pnpm vclaw:agentos -- list-presets --json
pnpm vclaw:agentos -- chat --preset default-demo
pnpm vclaw:agentos -- run --goal "assess release risk" --task-type review --json
pnpm vclaw:agentos -- inspect-session --session local-main --json
pnpm vclaw:agentos -- run --goal "research competitors" --task-type research --deerflow true --json
```

## Minimal Multi-Agent Prompt Config

If you want the smallest reliable AgentOS setup, start here:

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace
```

The generated files are the prompt surface:

- `AGENTS.md` sets global operating rules and hard boundaries
- `SOUL.md` sets tone, persona, and collaboration style
- `IDENTITY.md` sets the visible agent name and presentation
- `USER.md` stores operator preferences and default assumptions
- `TOOLS.md` stores machine-specific notes and tool guidance
- `BOOTSTRAP.md` handles first-run onboarding and is removed after completion

The smoothest first flow is:

1. Run `setup-workspace`
2. Edit `AGENTS.md`, `SOUL.md`, and `IDENTITY.md`
3. Run `pnpm vclaw:agentos -- demo --json`
4. Run a real task with `pnpm vclaw:agentos -- run --goal "..." --json`
5. Inspect continuity with `pnpm vclaw:agentos -- inspect-session --session local-main --json`

## Memory Model

AgentOS keeps three memory layers:

- short-term session memory
- long-term summarized memory
- project/entity memory

Storage strategy:

- SQLite first
- file fallback when SQLite cannot initialize

The runtime is local-first and inspectable, so memory is not hidden behind opaque services.

## Current Runtime Truth

The Vclaw surface is now singular, but the runtime is still evolving.

What is already solid:

- Vclaw-first CLI entrypoints
- AgentOS storage, registry, and routing
- layered memory persistence
- session replay, metadata, and timeline capture
- setup-workspace scaffolding for prompt configuration
- optional DeerFlow research augmentation

What still needs further hardening:

- deeper route evaluation
- broader cross-session memory recall and compaction policy
- further cleanup of old internal naming in deep platform-specific code

## Version Policy

Vclaw now uses date-based versions for the primary product surface.

- current version: `2026.3.12`
- rule: the version tracks the development date of the release surface

This applies to:

- package version
- AgentOS CLI version envelope
- default AgentOS role/preset versions
- top-level docs that describe the current system state

## Key Docs

- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/known-limitations.md`
- `docs/release-checklist.md`
- `docs/start/agentos-minimal.md`

## Development Notes

Useful commands while working locally:

```bash
pnpm build
pnpm check
pnpm exec vitest run test/agentos
pnpm vclaw:agentos -- demo --json
```

## License

MIT
