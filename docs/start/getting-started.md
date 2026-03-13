---
summary: "Install Vclaw from GitHub, run onboarding, and start the gateway in the shortest path possible."
read_when:
  - First time setup from zero
  - You want the fastest path to a working Vclaw runtime
title: "Getting Started"
---

# Getting Started

Goal: install Vclaw, finish onboarding, and get a running gateway with as little friction as possible.

<Note>
Current documented workspace release: <strong>2026.3.13</strong>
</Note>

## 1. Install

<Tabs>
  <Tab title="macOS/Linux">
    ```bash
    curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash
    ```
    <img
      src="/assets/install-script.svg"
      alt="Vclaw install flow"
      className="rounded-lg"
    />
  </Tab>
  <Tab title="Windows (PowerShell)">
    ```powershell
    powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1)))"
    ```
  </Tab>
</Tabs>

The installer:

- pulls from GitHub, not from a local source path
- installs missing prerequisites when supported installers are available
- writes `vclaw`, `agentos`, and `openclaw` wrappers
- keeps the simple "install first, configure second" flow

## 2. Run onboarding

```bash
vclaw onboard
```

If the wrapper command is not available yet, reopen the terminal once. If that still fails, run from the repo checkout:

```bash
cd ~/Vclaw
pnpm vclaw -- onboard
```

On Windows, replace `~/Vclaw` with `E:\Vclaw`.

## 3. Install and start the gateway service

```bash
vclaw gateway install
vclaw gateway start
```

Restart behavior is always `stop -> start`, and the normal operating path is to keep the gateway running unless you explicitly stop it.

## 4. Check the system

```bash
vclaw gateway status
vclaw health
vclaw channels status --probe
```

## 5. Open the control surface

```bash
vclaw dashboard
```

Open `http://127.0.0.1:18789/` on the gateway host if the dashboard does not launch automatically.

## Daily commands

| What you want | Command |
| --- | --- |
| start | `vclaw gateway start` |
| restart | `vclaw gateway restart` |
| stop | `vclaw gateway stop` |
| status | `vclaw gateway status` |
| health | `vclaw health` |
| doctor | `vclaw doctor` |
| telegram logs | `vclaw channels logs --channel telegram` |

## Compatibility

Docs now use `vclaw` by default, but the installer still writes the `openclaw` wrapper so existing ecosystem skills continue to work.
