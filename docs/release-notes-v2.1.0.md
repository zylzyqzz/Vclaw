# Vclaw AgentOS v2.1.0 Release Notes (Draft)

## Highlights

- Dynamic roles architecture based on `RoleTemplate` + `RuntimeAgent`
- Preset lifecycle and validation workflow
- Config-driven orchestrator routing with explainable decisions
- Durable three-layer memory with inspectability
- Unified machine-readable CLI envelope (`--json`) for integration
- Local-first persistence source-of-truth with controlled compatibility migration

## CLI and Integration

- Added stable route fields in JSON: `routeSummary`, `selectedRoles`, `selectionReasons`
- Unified error object and exit code conventions
- Added `demo` command for first-run showcase
- Added Vclaw-first CLI wrappers and help surfaces while keeping legacy aliases working

## Documentation

- Refined README for public-repo onboarding
- Added focused docs: getting-started, cli-usage, examples, extension-guide
- Added schema and release operation docs

## Notes

- `.weiclaw-agentos.json` is deprecated compatibility input only.
- `openclaw/plugin-sdk` remains as an internal compatibility shim for the plugin ecosystem.
- Use `--json` for automation or external integrations.
