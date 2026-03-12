# Vclaw

Vclaw is a local-first multi-agent runtime with durable memory, structured CLI contracts, and a
compatibility-preserving migration path from earlier OpenClaw and WeiClaw surfaces.

The goal of this repository is straightforward:

- keep execution stable
- keep multi-agent routing strong
- keep long-lived memory complete and inspectable
- keep skills and tool invocation smooth
- move the user-facing experience to `Vclaw` without breaking working installs

## Start Here

If you are on Windows and want the closest thing to "one command, everything done", use:

```powershell
powershell -ExecutionPolicy Bypass -File E:\Vclaw\scripts\vclaw-bootstrap.ps1
```

What that command does:

- checks `git`, Node.js 22+, Corepack, and `pnpm`
- installs missing tools when supported installers are available
- keeps `E:\Vclaw(Go语言未完成）` as the archived Go workspace if needed
- syncs the repo into `E:\Vclaw`
- runs `pnpm install`
- creates `vclaw.cmd` and `agentos.cmd` wrappers in `%USERPROFILE%\.local\bin`
- verifies installation with CLI smoke commands

If you are on macOS or Linux and want the same one-command bootstrap flow, run this from the
repository root:

```bash
bash ./scripts/vclaw-bootstrap.sh
```

What that command does:

- checks `git`, Node.js 22+, Corepack, and `pnpm`
- installs missing tools through `brew` or the detected Linux package manager when possible
- keeps `~/Vclaw-go-unfinished` as the archive target if `~/Vclaw` is occupied by a non-repo folder
- updates or clones the repo into `~/Vclaw`
- runs `pnpm install`
- creates `vclaw` and `agentos` wrappers in `~/.local/bin`
- verifies installation with CLI smoke commands

If you prefer the manual source-install path, do this:

1. Install Node 22 and `git`
2. Enable `pnpm` through Corepack
3. Clone the repository
4. Run `pnpm install`
5. Verify the CLI with `pnpm vclaw -- help`
6. Run the AgentOS demo with `pnpm vclaw:agentos -- demo`

The full copy-paste instructions are below.

## Installation

This README documents the safest installation path for most operators:

- use the Windows bootstrap script if you want machine setup and install in one command
- run Vclaw directly from the source checkout
- use repo-local `pnpm` commands first
- verify the runtime before exploring packaging, deployment, or platform-specific flows

This is the most reliable path because it always matches the exact code in your checkout.

### Recommended on Windows

```powershell
powershell -ExecutionPolicy Bypass -File E:\Vclaw\scripts\vclaw-bootstrap.ps1
```

After it finishes successfully, you should be able to run:

```powershell
vclaw --help
agentos demo
```

### Recommended on macOS and Linux

Run from the repository root if you already have the source checkout:

```bash
bash ./scripts/vclaw-bootstrap.sh
```

The Unix bootstrap targets `~/Vclaw` by default. If that path already contains a non-repo folder,
the script moves it aside to `~/Vclaw-go-unfinished` and then installs or updates the current
Vclaw checkout.

After it finishes successfully, you should be able to run:

```bash
vclaw --help
agentos demo
```

### Step 1. Install prerequisites

Required:

- Node.js `>= 22.12.0`
- `git`

Recommended:

- PowerShell on Windows, or a standard shell on macOS/Linux
- internet access for dependency installation

Check what is already installed:

```bash
node -v
git --version
```

If Node is missing or too old, install Node 22 first.

Common install options:

- Windows: [nodejs.org](https://nodejs.org/) or `winget install OpenJS.NodeJS.LTS`
- macOS: [nodejs.org](https://nodejs.org/) or `brew install node`
- Linux: Node 22 from your package manager, `fnm`, or `nvm`

### Step 2. Enable pnpm

This repository uses `pnpm@10.23.0`.

Run:

```bash
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm -v
```

If `pnpm -v` prints a version number, you are ready for the next step.

### Step 3. Clone the repository

```bash
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
```

You should now be in the repository root, where `package.json` and `README.md` are visible.

### Step 4. Install dependencies

```bash
pnpm install
```

What this does:

- installs workspace dependencies
- prepares the local CLI entrypoints
- makes the repo-ready `pnpm vclaw ...` and `pnpm vclaw:agentos ...` commands available

### Step 5. Verify the CLI boots

Run both of these:

```bash
pnpm vclaw -- help
pnpm vclaw:agentos -- help
```

If both commands print help output, the local installation is working.

### Step 6. Run the first multi-agent demo

```bash
pnpm vclaw:agentos -- demo
```

Expected outcome:

- the command exits successfully
- the output includes routing details such as `routeSummary:`
- the built-in multi-agent demo path completes without startup errors

### Step 7. Run a structured task

```bash
pnpm vclaw:agentos -- run --goal "generate release checklist" --preset default-demo --json
```

This confirms three important things at once:

- orchestration is working
- JSON output is working
- the preserved task contract is working

### Step 8. Inspect memory

```bash
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

This confirms the local memory system is active and inspectable.

### One copy-paste setup block

If you want the shortest fresh-machine setup flow, use this exact sequence:

```bash
node -v
corepack enable
corepack prepare pnpm@10.23.0 --activate
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
pnpm install
pnpm vclaw -- help
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

If you prefer the bootstrap route instead of the manual steps:

```bash
# macOS / Linux
bash ./scripts/vclaw-bootstrap.sh

# Windows
powershell -ExecutionPolicy Bypass -File E:\Vclaw\scripts\vclaw-bootstrap.ps1
```

## First Commands To Know

Use these repo-local commands first:

```bash
pnpm vclaw -- help
pnpm vclaw status
pnpm vclaw skills list
pnpm vclaw doctor
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- list-roles
pnpm vclaw:agentos -- list-presets
pnpm vclaw:agentos -- run --goal "assess release risk" --preset default-demo --json
pnpm vclaw:agentos -- chat --preset default-demo
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

Why the README uses `pnpm ...` commands instead of a global `vclaw` install:

- it works immediately from a source checkout
- it avoids a second installation step
- it guarantees the command matches the checked-out code

## Compatibility Entry Points

Vclaw is the preferred brand and CLI surface, but compatibility remains in place.

These entrypoints still work:

```bash
pnpm agentos -- demo
pnpm openclaw -- help
pnpm weiclaw -- help
```

What remains intentionally compatible today:

- published npm package name: `openclaw`
- CLI aliases: `vclaw`, `agentos`, `openclaw`, `weiclaw`
- selected legacy environment variables such as `OPENCLAW_*`
- selected historical paths and app/service boundaries where hard renames would risk breakage

## Project Positioning

Vclaw is designed for operators who want:

- local-first execution instead of a cloud-only control plane
- a strong multi-agent workflow instead of a single monolithic agent
- inspectable memory instead of opaque hidden state
- structured CLI and JSON output instead of ad hoc terminal text
- stable skills and tool execution instead of fragile prompt-only behavior

The current codebase preserves the foundations that matter:

- task execution stability
- multi-agent routing and presets
- short-term, long-term, and project/entity memory
- Gateway and node-host workflows
- CLI and machine-readable JSON contracts
- compatibility with legacy OpenClaw and WeiClaw surfaces where needed

## Core Capabilities

### Multi-agent orchestration

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

### Durable memory

The runtime preserves three memory layers:

- short-term session memory
- long-term summarized memory
- project/entity memory

Memory is inspectable from the CLI rather than hidden behind an opaque service boundary.

### Gateway and tool surface

The repository includes a broad runtime CLI and Gateway surface for:

- status and diagnostics
- onboarding and configuration
- skills
- approvals
- browser control
- node management
- channels and delivery flows
- memory inspection

### Local-first storage

Storage remains local-first:

- SQLite is preferred when available
- file-based fallback is preserved for resilience

## Memory Model

### Short-term session memory

Used for active session context and recent task continuity.

### Long-term summarized memory

Used for preserving durable summaries across repeated task execution.

### Project / entity memory

Used for higher-level facts and delivery state that should survive beyond a single request.

## State And Compatibility Paths

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

### Type check

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

### Focused regression checks

```bash
pnpm exec vitest run test/agentos
pnpm exec vitest run src/cli/completion-cli.defaults.test.ts src/cli/update-cli.test.ts src/cli/skills-cli.test.ts src/cli/program/help.test.ts src/cli/qr-cli.test.ts
```

### Useful smoke commands

```bash
pnpm agentos -- help
pnpm agentos -- demo --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
pnpm vclaw -- help
```

## Documentation

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Node setup details](docs/install/node.md)
- [Getting started docs](docs/start/getting-started.md)

## Troubleshooting

### You want full machine bootstrap in one command

Use:

```powershell
powershell -ExecutionPolicy Bypass -File E:\Vclaw\scripts\vclaw-bootstrap.ps1
```

That is the Windows-first path that:

- checks the environment
- installs missing prerequisites
- updates or clones the repo
- installs dependencies
- creates wrappers
- runs smoke verification

### `pnpm` is not recognized

Run:

```bash
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm -v
```

### Node version is too old

Run:

```bash
node -v
```

If the version is lower than `22.12.0`, upgrade Node first, then rerun `pnpm install`.

### You want the shortest path to a successful first run

Use:

```bash
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm install
pnpm vclaw:agentos -- demo
```

### You see legacy names such as `openclaw`

That is expected. The repository is Vclaw-first at the user surface, but it still preserves
compatibility in specific package names, aliases, and environment boundaries.

### Help output shows old config warnings

If this machine already had an older OpenClaw or WeiClaw setup, Vclaw may report compatibility
warnings from existing local config under paths such as `~/.openclaw`.

For a fresh installation check, the most reliable validation is:

- clone the repository into a clean directory
- run `pnpm install`
- run `pnpm vclaw:agentos -- demo`

Fresh checkouts without older local state should be much easier to reason about.

## Current Acceptance Standard

The Vclaw migration is only acceptable if these remain true:

- task execution stays stable
- multi-agent routing stays strong
- skills continue to load and execute cleanly
- memory stays complete and inspectable
- user-facing CLI surfaces feel like Vclaw, not a half-renamed fork

## Notes For Operators

- If you are starting fresh, prefer `vclaw` and `pnpm vclaw:agentos -- ...`
- If you already depend on `openclaw`, `weiclaw`, or `OPENCLAW_*`, those compatibility paths are still preserved
- If you are validating the migration, use both smoke commands and JSON-mode checks rather than relying only on help text
