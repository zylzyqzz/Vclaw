# Vclaw Roadmap

Version: `2026.3.12`

## Current Product Reality

Vclaw already has a useful local-first foundation:

- the CLI boots and is scriptable
- AgentOS storage, registry, session state, and layered memory exist
- demo roles and preset lifecycle exist
- SQLite with file fallback exists
- DeerFlow and Vclaw bridge integrations exist

That foundation is real, but the product is still closer to an orchestration shell than a
fully trustworthy multi-agent work system.

The next roadmap should therefore optimize for product truthfulness and real task completion,
not for adding more surfaces.

## What Is Still Missing

### 1. Real Multi-Agent Execution

The current AgentOS runtime is strong at role registration, routing, and structured contracts, but
the main execution path still does not run role-specific model turns inside AgentOS itself.

Today the product mainly does this:

- choose roles
- explain the route
- emit structured result envelopes
- persist memory records
- optionally augment research through DeerFlow
- optionally call the external `vclaw run` bridge

What is still missing:

- a role executor abstraction that runs each role against a real model/tool runtime
- per-role tool policy enforcement during execution, not only as metadata
- handoff state between planner, builder, reviewer, and commander
- role traces that show what each role actually did
- final synthesis based on real role outputs rather than placeholder text

Product risk:

- users can mistake a polished demo contract for real autonomous delivery
- route quality can look better than execution quality because execution is still shallow

### 2. Useful Memory, Not Just Persisted Memory

The project already stores memory in three layers, but the current implementation is still mostly a
write-a-log system.

What is still missing:

- retrieval ranking for relevant memories
- session-to-session recall with guardrails
- memory compaction and deduplication
- entity linking and project-scoped summaries
- conflict handling for stale or contradictory memory
- retention and pruning policies
- evidence-aware memory writes instead of unconditional capture

Product risk:

- memory volume will grow faster than memory usefulness
- old or low-quality records can pollute future runs

### 3. Session Experience Is Too Thin

The `chat` surface works, but it is currently a loop around repeated `run` calls. Session state also
tracks only the minimal lifecycle fields needed for task status.

What is still missing:

- transcript-aware session history
- resumable conversations with prior turn grounding
- streaming updates and long-running task progress
- cancellation, pause, and resume semantics
- task checkpoints and review gates
- session timelines for debugging and replay

Product risk:

- users will experience AgentOS chat as repeated demos instead of a dependable workspace
- failed runs are hard to replay or inspect in detail

### 4. Routing Needs Evaluation, Not Just Heuristics

The current routing design is intentionally simple and interpretable. That is good for alpha, but it
will not be enough once roles, presets, and task types grow.

What is still missing:

- a routing evaluation corpus
- measurable route-quality metrics
- feedback loops from successful and failed runs
- detection for preset drift and role overlap
- confidence scoring and fallback strategy when no strong route exists
- route-quality tests that cover realistic tasks instead of only happy-path logic

Product risk:

- routing quality will plateau early
- bad routes can still look legitimate because the explanation is deterministic

### 5. Reliability And Operations Gaps

The local-first architecture is the right default, but the runtime still needs more operational
discipline before it becomes trustworthy for regular work.

What is still missing:

- task-level concurrency control
- retry and backoff policy per task class
- timeout governance at role and task level
- structured audit logs for role execution
- health and performance metrics
- failure replay for regression diagnosis
- stronger cross-platform test coverage for bootstrap and storage fallback

Product risk:

- confidence in the system will depend on manual smoke tests
- release quality can regress even when the happy path still runs

### 6. Product Surface And Brand Consistency

The repository still carries a large compatibility burden. Some of that is intentional, but some of
it now hurts product clarity.

Current examples:

- naming drift across metadata, docs, and helper scripts
- encoding drift and mojibake in a few user-facing files and tests
- a very wide repo surface that makes the core promise harder to understand

What is still missing:

- one authoritative product story for install, run, memory, and multi-agent workflows
- aligned naming in package metadata, docs, bootstrap scripts, and tests
- clear separation between compatibility layers and recommended user paths

Product risk:

- operators will not know which surface is canonical
- documentation drift will feel like runtime drift even when code still works

### 7. Packaging And Adoption Focus

The repository already contains far more than the AgentOS core. That breadth is valuable, but it
also dilutes the adoption story.

What is still missing:

- a lean runtime artifact for the main local-first path
- a clearly recommended installation path per platform
- a short first-run workflow that proves value in under ten minutes
- a release checklist tied to user outcomes, not only code status

Product risk:

- new users must understand too much of the repo before getting value
- the project can look more complete than the default experience actually is

## Priority Order

### P0. Honest Alpha Surface

Goal:
Make the product truthful about what is real, what is demo-grade, and what is still compatibility
or bootstrap scaffolding.

Work:

- mark demo-generated outputs clearly when no real role execution happened
- fix visible encoding and mojibake issues
- align README, bootstrap scripts, tests, and help text
- keep known limitations current and explicit

Acceptance:

- a new user can tell the difference between routing, execution, and bridge-based augmentation
- docs and help text no longer overstate the current runtime

### P1. Real Role Execution Core

Goal:
Turn AgentOS from a routing shell into a role-executing runtime.

Work:

- introduce a role executor interface
- run real model/tool calls per role
- persist role traces, tool calls, and structured outputs
- implement commander synthesis from actual upstream role artifacts
- define turn budgets and role handoff rules

Acceptance:

- `run` results include real role outputs
- at least the default four roles can complete a task through actual execution steps

### P2. Memory Recall And Governance

Goal:
Make memory improve future work quality, not only preserve logs.

Work:

- add retrieval APIs and ranking
- add summary compaction for long-term memory
- add entity/project memory indexing
- add freshness, confidence, and retention policy
- expose memory inspection that shows why a record was recalled

Acceptance:

- repeated tasks reuse relevant memory with visible evidence
- memory growth remains bounded and explainable

### P3. Session UX And Observability

Goal:
Make AgentOS feel like a working local copilot rather than a collection of commands.

Work:

- store session transcripts and task timelines
- add streaming progress for long tasks
- add cancel, pause, resume, and replay
- improve human-readable inspection for sessions and role traces
- add machine-readable diagnostics for automation use

Acceptance:

- a user can resume a session, inspect prior work, and understand failures without reading raw DB state

### P4. Route Quality And Evaluation

Goal:
Move routing from static heuristics to measured quality.

Work:

- build a realistic route-eval corpus
- add regression tests for route choices
- add route confidence and fallback behavior
- measure preset effectiveness and overlap
- use post-run signals to tune routing safely

Acceptance:

- route changes can be evaluated before release
- weak or ambiguous routes are detected instead of silently accepted

### P5. Packaging And Release Discipline

Goal:
Make the recommended product path small, stable, and easy to operate.

Work:

- slim the runtime payload around the core local-first path
- publish one recommended bootstrap path per platform
- define release gates for install, run, memory, and recovery
- reduce compatibility burden where it no longer protects real users

Acceptance:

- a fresh operator can install, run, inspect memory, and recover from failure using one documented path

## Guardrails

Do not optimize for these before P1 to P3 are in good shape:

- more channels
- more UI surfaces
- broader compatibility wrappers
- speculative distributed features
- larger preset catalogs

The product will get stronger by doing fewer things more truthfully.
