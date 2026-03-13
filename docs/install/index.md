---
summary: "Install Vclaw from GitHub with the simple installer flow, plus manual source setup when you actually need it."
read_when:
  - You want the recommended install command
  - You need a manual source install path
  - You want to understand which command is for install, start, restart, or stop
title: "Install"
---

# Install

The recommended path is now intentionally simple: install from GitHub, run onboarding, install the gateway service, then start it.

## Recommended install commands

<Tabs>
  <Tab title="macOS / Linux">
    ```bash
    curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash
    ```
  </Tab>
  <Tab title="Windows (PowerShell)">
    ```powershell
    powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1)))"
    ```
  </Tab>
</Tabs>

What this does:

- clones or updates the GitHub repo checkout
- installs missing prerequisites when supported installers are available
- runs `pnpm install`
- writes `vclaw`, `agentos`, and `openclaw` wrappers
- runs smoke checks and prints the next commands

## First setup after install

```bash
vclaw onboard
vclaw gateway install
vclaw gateway start
```

## System commands

| What you want | Command |
| --- | --- |
| install | `install.sh` / `install.ps1` |
| first-time setup | `vclaw onboard` |
| start | `vclaw gateway start` |
| restart | `vclaw gateway restart` |
| stop | `vclaw gateway stop` |
| uninstall service | `vclaw gateway uninstall` |
| status | `vclaw gateway status` |
| health | `vclaw health` |
| channel probe | `vclaw channels status --probe` |

Restart always means `stop -> start`.

## Manual source setup

Use this only if you intentionally want to work from a checkout yourself.

```bash
git clone https://github.com/zylzyqzz/Vclaw.git
cd Vclaw
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm install
pnpm vclaw -- help
```

## Compatibility

The default product name is `Vclaw`, but the installer still writes an `openclaw` wrapper so older OpenClaw ecosystem skills and habits do not break.
