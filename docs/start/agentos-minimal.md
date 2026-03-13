# AgentOS Minimal Setup

Version: `2026.3.13`

This is the shortest reliable path to a local-first multi-agent setup.

## 1. Seed the workspace

```bash
pnpm vclaw:agentos -- setup-workspace --workspace .vclaw/workspace
```

This creates the prompt-control files AgentOS expects:

- `AGENTS.md` for global rules and hard boundaries
- `SOUL.md` for persona and tone
- `IDENTITY.md` for visible agent name and style
- `USER.md` for operator preferences and assumptions
- `TOOLS.md` for local machine notes
- `BOOTSTRAP.md` for first-run guidance

## 2. Edit the minimum prompt surface

If you only touch three files, start with these:

- `AGENTS.md`
  Put non-negotiable rules here: allowed scope, forbidden actions, delivery format.
- `SOUL.md`
  Put collaboration style here: concise, direct, cautious, reviewer-first, builder-first.
- `IDENTITY.md`
  Put name and outward style here so the surface feels coherent.

Keep them short. If a rule belongs everywhere, put it in `AGENTS.md` instead of duplicating it.

## 3. Run the first validation

```bash
pnpm vclaw:agentos -- demo --json
pnpm vclaw:agentos -- inspect-session --session demo-main --json
```

The demo validates:

- routing
- role execution
- memory capture
- session replay

## 4. Run a real task

```bash
pnpm vclaw:agentos -- run --goal "plan a release hardening pass" --preset default-demo --json
```

## 5. Keep the flow smooth

Use these commands as the default operator loop:

```bash
pnpm vclaw:agentos -- chat --preset default-demo
pnpm vclaw:agentos -- inspect-session --session local-main --json
pnpm vclaw:agentos -- inspect-memory --session local-main --json
```

`inspect-session` tells you what the system remembers as the recent execution path.

## Prompt configuration model

The multi-agent prompt surface is layered on purpose:

1. `AGENTS.md` controls global behavior.
2. `SOUL.md` controls style.
3. `IDENTITY.md` controls presentation.
4. `USER.md` controls operator context.
5. `TOOLS.md` controls local execution notes.

Inside AgentOS itself, role prompts are built from:

- role template goals
- role policy and tool constraints
- task goal and constraints
- recent session replay
- recalled same-session memory
- prior role outputs in the current run

That means you should keep the workspace files focused on stable behavior, not per-task details.
