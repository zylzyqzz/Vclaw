---
summary: "Runbook for the Gateway service, lifecycle, and operations"
read_when:
  - Running or debugging the gateway process
title: "Gateway Runbook"
---

# Gateway runbook

Use this page for day-1 startup and day-2 operations of the Gateway service.

<Note>
Current documented workspace release: <strong>2026.3.12</strong>
</Note>

<CardGroup cols={2}>
  <Card title="Troubleshooting" icon="siren" href="/gateway/troubleshooting">
    Symptom-first diagnostics and recovery steps.
  </Card>
  <Card title="Configuration" icon="sliders" href="/gateway/configuration">
    Runtime setup guide and configuration reference.
  </Card>
  <Card title="Authentication" icon="shield-check" href="/gateway/authentication">
    Tokens, passwords, and pairing trust boundaries.
  </Card>
  <Card title="Remote access" icon="globe" href="/gateway/remote">
    Tailscale, SSH tunnels, and remote operator flows.
  </Card>
</CardGroup>

## 5-minute local startup

<Steps>
  <Step title="Start the Gateway">

```bash
pnpm vclaw -- gateway --port 18789
pnpm vclaw -- gateway --port 18789 --verbose
pnpm vclaw -- gateway --force
```

  </Step>

  <Step title="Verify service health">

```bash
pnpm vclaw -- gateway status
pnpm vclaw -- status
pnpm vclaw -- logs --follow
```

Healthy baseline: `Runtime: running` and `RPC probe: ok`.

  </Step>

  <Step title="Validate channel readiness">

```bash
pnpm vclaw -- channels status --probe
```

  </Step>
</Steps>

## Runtime model

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed surface for WebSocket control, HTTP APIs, Control UI, and hooks.
- Loopback-first by default.
- Auth should be enabled whenever you expose the Gateway beyond loopback.

## Operator command set

```bash
pnpm vclaw -- gateway status
pnpm vclaw -- gateway status --deep
pnpm vclaw -- gateway status --json
pnpm vclaw -- gateway install
pnpm vclaw -- gateway restart
pnpm vclaw -- gateway stop
pnpm vclaw -- secrets reload
pnpm vclaw -- logs --follow
pnpm vclaw -- doctor
```

## Remote access

Preferred: Tailscale or another private network.

Fallback: SSH tunnel.

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Then connect clients to `ws://127.0.0.1:18789` locally.

## Service lifecycle

### macOS

```bash
pnpm vclaw -- gateway install
pnpm vclaw -- gateway status
pnpm vclaw -- gateway restart
pnpm vclaw -- gateway stop
```

### Linux user service

```bash
pnpm vclaw -- gateway install
systemctl --user enable --now vclaw-gateway[-<profile>].service
pnpm vclaw -- gateway status
```

### Linux system service

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vclaw-gateway[-<profile>].service
```

## Multiple gateways on one host

Most setups should run one Gateway. If you run more than one, give each instance:

- a unique port
- a unique config path
- a unique state path
- a unique workspace

## Dev profile quick path

```bash
pnpm vclaw -- --dev setup
pnpm vclaw -- --dev gateway --allow-unconfigured
pnpm vclaw -- --dev status
```

## Operational checks

```bash
pnpm vclaw -- gateway status
pnpm vclaw -- channels status --probe
pnpm vclaw -- health
```

## Common failure signatures

| Signature                                | Likely issue                  |
| ---------------------------------------- | ----------------------------- |
| `refusing to bind gateway ... without auth` | non-loopback bind without auth |
| `EADDRINUSE`                             | port conflict                 |
| `Gateway start blocked`                  | invalid or remote-mode config |
| `unauthorized`                           | auth mismatch                 |

## Related

- [Troubleshooting](/gateway/troubleshooting)
- [Configuration](/gateway/configuration)
- [Health](/gateway/health)
- [Doctor](/gateway/doctor)
