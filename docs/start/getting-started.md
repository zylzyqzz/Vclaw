---
summary: "Get Vclaw installed and run your first chat in minutes."
read_when:
  - First time setup from zero
  - You want the fastest path to a working chat
title: "Getting Started"
---

# Getting Started

Goal: go from zero to a first working chat with minimal setup.

<Info>
Fastest chat: open the Control UI (no channel setup needed). Run `pnpm vclaw -- dashboard`
and chat in the browser, or open `http://127.0.0.1:18789/` on the
<Tooltip headline="Gateway host" tip="The machine running the Vclaw gateway service.">gateway host</Tooltip>.
Docs: [Dashboard](/web/dashboard) and [Control UI](/web/control-ui).
</Info>

<Note>
Current documented workspace release: <strong>2026.3.12</strong>
</Note>

## Prereqs

- Node 22 or newer

<Tip>
Check your Node version with `node --version` if you are unsure.
</Tip>

## Quick setup (CLI)

<Steps>
  <Step title="Run the GitHub bootstrap script">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.sh | bash
        ```
        <img
  src="/assets/install-script.svg"
  alt="Install Script Process"
  className="rounded-lg"
/>
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.ps1)))"
        ```
      </Tab>
    </Tabs>

    <Note>
    The bootstrap clones the repo from GitHub, installs prerequisites, creates wrappers, and prints the next commands.
    </Note>

  </Step>
  <Step title="Run the onboarding wizard">
    ```bash
    vclaw onboard
    ```

    The wizard configures auth, gateway settings, and optional channels.
    See [Onboarding Wizard](/start/wizard) for details.

  </Step>
  <Step title="Create a minimal config">
    Use `~/.vclaw/vclaw.json` on macOS/Linux or `E:\Vclaw\.vclaw\vclaw.json` on Windows.

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
      }
    }
    ```
  </Step>
  <Step title="Check the Gateway">
    If you installed the service, it should already be running:

    ```bash
    vclaw gateway status
    ```

  </Step>
  <Step title="Open the Control UI">
    ```bash
    vclaw dashboard
    ```
  </Step>
</Steps>

<Check>
If the Control UI loads, your Gateway is ready for use.
</Check>

## Optional checks and extras

<AccordionGroup>
  <Accordion title="Run the Gateway in the foreground">
    Useful for quick tests or troubleshooting.

    ```bash
    vclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Send a test message">
    Requires a configured channel.

    ```bash
    vclaw message send --target +15555550123 --message "Hello from Vclaw"
    ```

  </Accordion>
  <Accordion title="Wrapper command not found">
    If your shell has not reloaded the wrapper path yet, use the repo-local fallback.

    ```bash
    cd ~/Vclaw
    pnpm vclaw -- help
    ```

    On Windows, use `cd E:\Vclaw` instead.

  </Accordion>
</AccordionGroup>

## Useful environment variables

If you run Vclaw as a service account or want custom config/state locations:

- keep config, workspace, and memory under one runtime home
- use explicit config and state locations for isolated installs
- prefer one Gateway per machine until you intentionally need isolation

Full environment variable reference: [Environment vars](/help/environment).

## Go deeper

<Columns>
  <Card title="Onboarding Wizard (details)" href="/start/wizard">
    Full CLI wizard reference and advanced options.
  </Card>
  <Card title="macOS app onboarding" href="/start/onboarding">
    First run flow for the macOS app.
  </Card>
</Columns>

## What you will have

- A running Gateway
- Auth configured
- Control UI access or a connected channel

## Next steps

- DM safety and approvals: [Pairing](/channels/pairing)
- Connect more channels: [Channels](/channels)
- Advanced workflows and from source: [Setup](/start/setup)
