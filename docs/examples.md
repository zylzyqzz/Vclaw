# Vclaw AgentOS Examples

Version: `2026.3.13`

## Recommended Demo Set

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- run --goal "investigate release risks" --task-type review --required-capabilities review --preset "" --json
pnpm vclaw:agentos -- inspect-session --session demo-main --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

This set shows, within a few minutes:

- dynamic role selection instead of hard-coded routing
- explainable route decisions
- replayable session state
- inspectable memory capture

## Sample Tasks

### Release planning

```bash
pnpm vclaw:agentos -- run --goal "finish the v2.1.0 release hardening plan" --preset default-demo
```

Expected:

- `planner` and `commander` produce structured plan output

### Build and review flow

```bash
pnpm vclaw:agentos -- run --goal "implement and review a new CLI route" --roles builder,reviewer
```

Expected:

- `builder` produces an implementation path
- `reviewer` surfaces the risk and acceptance gates

### Dynamic research route

```bash
pnpm vclaw:agentos -- run --goal "investigate an anomaly and propose a repair" --task-type research --required-capabilities research,review --preset ""
```

Expected:

- `selectedRoles` is present
- `selectionReasons` is present
- `memoryContext` and `sessionReplay` are present in JSON mode

### Session continuity

```bash
pnpm vclaw:agentos -- run --goal "plan release hardening" --session local-main --json
pnpm vclaw:agentos -- run --goal "continue release hardening and validate regressions" --session local-main --json
pnpm vclaw:agentos -- inspect-session --session local-main --json
```

Expected:

- the second run includes recalled same-session memory
- `inspect-session` shows both turns and role traces

### JSON smoke test

```bash
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- validate-preset --id default-demo --json
```

Expected:

- a stable top-level envelope with `ok`, `command`, `version`, `result`, `error`, and `metadata`
