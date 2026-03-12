---
summary: "Advanced setup and development workflows for Vclaw"
read_when:
  - Setting up a new machine
  - You want more control than the default wizard path
title: "Setup"
---

# Setup

<Note>
If this is your first install, start with [Getting Started](/start/getting-started).
</Note>

Last updated: 2026.3.12

## TL;DR

- Recommended installation path: run the GitHub bootstrap script from [Getting Started](/start/getting-started).
- Keep runtime code in this repo checkout.
- Keep config, workspace, and state under `~/.vclaw/`.
- Use `pnpm vclaw -- ...` as the source-install operator path.

## Manual source workflow

```bash
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
corepack enable pnpm
pnpm install
pnpm vclaw -- setup
```

## Suggested runtime layout

- Config: `~/.vclaw/vclaw.json`
- Workspace: `~/.vclaw/workspace`
- State and memory: `~/.vclaw/`
- Logs: keep them in one predictable local directory

## Typical commands

```bash
pnpm vclaw -- setup
pnpm vclaw -- channels login
pnpm vclaw -- gateway --port 18789
pnpm vclaw -- dashboard
```

## Development loop

Use the watch workflow when iterating on the Gateway itself:

```bash
pnpm install
pnpm gateway:watch
```

Then verify from another shell:

```bash
pnpm vclaw -- gateway status
pnpm vclaw -- health
```

## Good operating habits

- Keep personal prompts and memory outside the repo checkout.
- Treat the workspace as operator data, not source code.
- Back up the workspace separately from the repo.
- Avoid multiple profiles until you have a clear reason to split environments.

## Linux note

If your Gateway runs as a systemd user service and stops on logout, enable lingering:

```bash
sudo loginctl enable-linger $USER
```

For always-on or multi-user hosts, prefer a system service. See [Gateway runbook](/gateway).

## Related docs

- [Getting Started](/start/getting-started)
- [Gateway runbook](/gateway)
- [Gateway configuration](/gateway/configuration)
- [Personal assistant setup](/start/personal-assistant)
- [macOS app](/platforms/macos)
