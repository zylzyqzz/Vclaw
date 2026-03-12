# Vclaw AgentOS Release Checklist

## Pre-release Quality Gate

1. Type check

```bash
pnpm tsgo
```

2. AgentOS test suite

```bash
pnpm exec vitest run test/agentos/*.test.ts
```

3. CLI smoke

```bash
pnpm vclaw:agentos -- help
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace --json
pnpm vclaw:agentos -- demo
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- run --goal "release smoke" --preset default-demo --json
pnpm vclaw:agentos -- inspect-memory --session demo-main --json
pnpm vclaw:agentos -- inspect-session --session demo-main --json
```

4. Docs consistency

- README commands are runnable
- `docs/cli-schema.md` matches actual JSON output
- `docs/architecture.md` and `docs/roadmap.md` contain no stale statements

5. Compatibility boundary check

- `.weiclaw-agentos.json` is documented as deprecated compatibility-only
- no new runtime write path depends on legacy file
- `openclaw/plugin-sdk` compatibility is unchanged or explicitly documented

## Release Artifacts

- release notes updated (`docs/release-notes-v2.1.0.md`)
- known limitations updated (`docs/known-limitations.md`)
- final version status in README updated
