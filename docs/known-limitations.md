# Vclaw Known Limitations

Version: `2026.3.12`

## Scope

- Vclaw is local-first and single-machine by default.
- The primary operator surface is CLI-first.
- AgentOS is now Vclaw-native in naming and config paths.

## AgentOS Runtime

- Role routing and execution are inspectable, but route quality still depends on role metadata and task framing.
- The default role executor is local and deterministic unless `--executor vclaw` or `--executor auto` is used.
- DeerFlow is an optional sidecar for research-style tasks, not the default execution engine.

## Memory

- Memory is layered and persisted, but recall quality still depends on future retrieval and compaction work.
- Session, long-term, and project/entity records are visible through CLI inspection, but not all memory policies are automated yet.

## Sessions

- Chat mode is useful for local operation, but advanced pause/resume and full replay ergonomics still have room to improve.
- Session timelines are retained in runtime metadata, but there is not yet a dedicated session-inspection command.

## Packaging

- The public surface is Vclaw-first, but some deep repo internals and platform-specific assets still need further cleanup over time.
