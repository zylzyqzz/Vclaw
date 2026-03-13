---
summary: "Vclaw is a local-first multi-agent runtime and gateway that runs on any OS."
read_when:
  - Introducing Vclaw to newcomers
title: "Vclaw"
---

# Vclaw

<p align="center">
  <strong>Local-first multi-agent runtime and gateway across WhatsApp, Telegram, Discord, iMessage, and more.</strong><br />
  Keep durable memory, extensible skills, code execution, and gateway workflows under one Vclaw brand.
</p>

<Note>
Current workspace release: <strong>2026.3.13</strong>
</Note>

<Columns>
  <Card title="Get Started" href="/start/getting-started" icon="rocket">
    Install Vclaw and bring up the Gateway in minutes.
  </Card>
  <Card title="Run the Wizard" href="/start/wizard" icon="sparkles">
    Guided setup with `vclaw onboard` and pairing flows.
  </Card>
  <Card title="Open the Control UI" href="/web/control-ui" icon="layout-dashboard">
    Launch the browser dashboard for chat, config, and sessions.
  </Card>
</Columns>

## What is Vclaw?

Vclaw is a **local-first multi-agent runtime** with gateway capabilities. It keeps the strong parts of the legacy claw runtime baseline, but presents them under a single Vclaw brand with durable memory, extensible skills, and task execution workflows.

**Who is it for?** Developers and power users who want a personal AI assistant they can message from anywhere without giving up control of their data.

**What makes it different?**

- **Local-first**: runs on your hardware, your rules
- **Multi-channel**: one Gateway serves WhatsApp, Telegram, Discord, and more
- **Agent-native**: built for coding agents with tool use, sessions, memory, and multi-agent routing
- **Workspace-native**: keeps prompts, memory, sessions, and tools in one operating surface

## How it works

```mermaid
flowchart LR
  A["Chat apps + plugins"] --> B["Gateway"]
  B --> C["Agent runtime"]
  B --> D["CLI"]
  B --> E["Web Control UI"]
  B --> F["Mobile and desktop nodes"]
```

The Gateway remains the single source of truth for sessions, routing, and channel connections.

## Quick Start

<Steps>
  <Step title="Run the GitHub installer">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows">
        ```powershell
        powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1)))"
        ```
      </Tab>
    </Tabs>
  </Step>
  <Step title="Run onboarding">
    ```bash
    vclaw onboard
    ```
  </Step>
  <Step title="Pair channels and start the Gateway">
    ```bash
    vclaw channels login
    vclaw gateway --port 18789
    ```
  </Step>
</Steps>

Need the full install and dev setup? See [Quick start](/start/quickstart).

## Configuration

Recommended runtime home:

- config: `~/.vclaw/vclaw.json`
- workspace: `~/.vclaw/workspace`
- runtime state: `~/.vclaw/`

- If you do nothing, Vclaw uses the bundled runtime with per-sender sessions.
- If you want to lock it down, start with `allowFrom` rules and explicit mention patterns.

Example:

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
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } }
    }
  },
  messages: {
    groupChat: { mentionPatterns: ["@vclaw"] }
  }
}
```

## Start Here

<Columns>
  <Card title="Docs hubs" href="/start/hubs" icon="book-open">
    All docs and guides, organized by use case.
  </Card>
  <Card title="Configuration" href="/gateway/configuration" icon="settings">
    Core Gateway settings, tokens, and provider config.
  </Card>
  <Card title="Remote access" href="/gateway/remote" icon="globe">
    SSH and tailnet access patterns.
  </Card>
  <Card title="Channels" href="/channels/telegram" icon="message-square">
    Channel-specific setup for WhatsApp, Telegram, Discord, and more.
  </Card>
  <Card title="Nodes" href="/nodes" icon="smartphone">
    iOS and Android nodes with pairing, Canvas, camera/screen, and device actions.
  </Card>
  <Card title="Help" href="/help" icon="life-buoy">
    Common fixes and troubleshooting entry point.
  </Card>
</Columns>
