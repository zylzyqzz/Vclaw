# Vclaw AgentOS CLI Usage

Version: `2026.3.12`

## Preferred Entry Point

```bash
pnpm vclaw:agentos -- <command>
```

Compatibility alias:

```bash
pnpm agentos -- <command>
```

## Command Groups

### Runtime

- `demo [--goal <text>] [--preset <id>] [--session <id>]`
- `run --goal <text> [--roles a,b] [--preset <id>] [--task-type <type>] [--required-capabilities a,b] [--preferred-roles a,b] [--excluded-roles a,b]`
- `chat [--roles a,b] [--preset <id>] [--executor local|vclaw|auto]`
- `inspect-memory [--session <id>] [--layer short-term|long-term|project-entity]`
- `inspect-session [--session <id>] [--limit <number>]`
- `setup-workspace [--workspace <dir>]`
- `vclaw-run --task <text> [--allow-write true|false] [--vclaw-bin <path>] [--vclaw-config <path>] [--timeout-ms <number>]`

### Roles

- `list-roles`
- `inspect-role --id <roleId>`
- `create-role --id <roleId> ...`
- `update-role --id <roleId> ...`
- `enable-role --id <roleId>`
- `disable-role --id <roleId>`
- `delete-role --id <roleId>`
- `export-role --id <roleId> --file <path.json>`
- `import-role --file <path.json> [--overwrite true|false]`
- `validate-role --id <roleId> | --file <path.json>`

### Presets

- `list-presets`
- `inspect-preset --id <presetId>`
- `create-preset --id <presetId> --roles a,b --order a,b`
- `update-preset --id <presetId> ...`
- `delete-preset --id <presetId>`
- `export-preset --id <presetId> --file <path.json>`
- `import-preset --file <path.json> [--overwrite true|false]`
- `validate-preset --id <presetId> | --file <path.json>`

Compatibility alias:

- `list-agents` still works, but new scripts should use `list-roles`

## Common Flows

### Seed the minimal workspace

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace
```

### Force specific roles

```bash
pnpm vclaw:agentos -- run --goal "review the current release risks" --roles planner,reviewer
```

### Use a preset

```bash
pnpm vclaw:agentos -- run --goal "finish the release hardening pass" --preset default-demo
```

### Use dynamic routing

```bash
pnpm vclaw:agentos -- run --goal "investigate the bottleneck" --task-type research --required-capabilities research --preset ""
```

### Machine-readable mode

```bash
pnpm vclaw:agentos -- run --goal "return the structured contract" --preset default-demo --json
```

### Inspect session continuity

```bash
pnpm vclaw:agentos -- demo --session demo-main
pnpm vclaw:agentos -- inspect-session --session demo-main --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
```

One successful `run` writes layered memory into:

- `short-term`
- `long-term`
- `project-entity`

## Exit Codes

- `0` success
- `1` bad request, unknown command, or unexpected error
- `2` validation failed
- `3` not found or conflict

See [docs/cli-schema.md](/E:/Vclaw/docs/cli-schema.md) for the structured JSON contract.
