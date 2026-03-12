# DeerFlow x Vclaw Integration Design

Date: 2026-03-12

## Problem

We want to know whether the open-source DeerFlow project can be combined with Vclaw in a way that
meaningfully upgrades Vclaw without damaging the foundations that must remain stable:

- task execution stability
- smooth skill invocation
- normal conversation quality
- complete long-lived memory
- strong multi-agent behavior

## Short Answer

Yes, DeerFlow can be combined with Vclaw, but not as a naive codebase merge.

The best path is:

- keep Vclaw as the local-first runtime, memory, delivery, and orchestration backbone
- bring DeerFlow in as a specialized deep-research and report-generation engine
- connect the two through a stable bridge layer instead of mixing both internals directly

## Current Read Of Both Systems

### DeerFlow

From the public repository and docs, DeerFlow 2.0 is centered around:

- LangGraph-based workflow orchestration
- deep research and report generation
- human-in-the-loop checkpoints
- MCP tool integration
- an app layer with backend, frontend, and generated reports

This makes DeerFlow strong at structured research execution, multi-step reasoning flows, and
producing polished output artifacts.

### Vclaw

Vclaw already provides:

- a large local-first CLI and Gateway runtime
- durable three-layer memory
- agent registry, orchestrator, session, and runtime modules
- skills and tool surfaces
- broader operational channels, diagnostics, and node-host workflows

This makes Vclaw strong as the stable operating substrate.

## Architectural Recommendation

Recommendation: adopt a sidecar integration, not a hard merge.

That means:

1. Vclaw remains the primary operator-facing runtime.
2. DeerFlow becomes an optional high-capability research subsystem.
3. Vclaw routes eligible tasks to DeerFlow.
4. DeerFlow returns structured artifacts and reasoning outputs.
5. Vclaw normalizes the result into its own task, memory, and delivery contracts.

## Integration Options

### Option A. Sidecar / bridge integration

How it works:

- run DeerFlow as a separate service or managed subprocess
- add a Vclaw tool or agent adapter such as `deerflow_research`
- pass goal, constraints, and context from Vclaw into DeerFlow
- collect DeerFlow outputs back into Vclaw memory and final response contracts

Benefits:

- fastest path to value
- lowest regression risk
- preserves Vclaw foundations
- allows DeerFlow to evolve independently

Trade-offs:

- cross-runtime operational complexity
- result normalization layer required
- two observability surfaces to manage

### Option B. Partial capability transplant

How it works:

- study DeerFlow workflows
- recreate the useful graph patterns inside Vclaw's own agent runtime
- reuse Vclaw memory, tools, and CLI contracts

Benefits:

- cleaner long-term product cohesion
- single runtime surface
- tighter control over memory and execution guarantees

Trade-offs:

- slower to ship
- higher implementation cost
- risk of re-building DeerFlow badly instead of leveraging it

### Option C. Full repository merge

How it works:

- vendor DeerFlow into the Vclaw monorepo
- try to unify backend, frontend, prompts, tools, and workflows directly

Benefits:

- maximum theoretical feature exposure

Trade-offs:

- highest risk by far
- mixed stack and lifecycle complexity
- likely to destabilize Vclaw foundations
- very difficult upgrade path from upstream DeerFlow

Conclusion: do not choose this path first.

## Recommended First Feature Slice

The first combined feature should be:

- `Vclaw Deep Research`

Behavior:

- user gives Vclaw a research-heavy objective
- Vclaw classifier decides the task is DeerFlow-eligible
- Vclaw invokes DeerFlow through a bridge
- DeerFlow performs research, synthesis, and artifact generation
- Vclaw stores summaries and entities into its own memory layers
- Vclaw delivers the final structured response and optional report file path

## Performance And System Weight

Will the combined system become slower and heavier?

Short answer:

- yes, if we wire DeerFlow into every task path
- no, if we keep DeerFlow off the hot path and invoke it only for research-heavy jobs

### What makes DeerFlow heavier

Based on the public DeerFlow runtime shape, it adds:

- a Python runtime
- LangGraph workflow orchestration
- optional frontend and gateway services
- sandbox execution
- multi-step planning and sub-agent fan-out
- web search, crawling, and report generation steps

This means DeerFlow is naturally more expensive than a normal single-turn Vclaw task.

### Where the latency comes from

The slow parts are not just "one more process".

The real latency cost comes from:

- extra model calls during planning
- iterative research loops
- sub-agent parallel work
- crawling and retrieval
- report synthesis
- sandbox startup in some modes

For the wrong task class, this would feel heavy.

### How to keep Vclaw fast

The safe rule is:

- keep normal chat, command, routing, memory, and skill tasks inside native Vclaw
- use DeerFlow only for high-value deep research, long-form synthesis, or artifact-generation tasks

In other words:

- Vclaw remains the fast control plane
- DeerFlow becomes the slow-but-powerful specialist engine

### Recommended operating modes

#### Mode 1. On-demand sidecar

Default recommendation.

- DeerFlow process is started only when a DeerFlow-eligible task is routed
- best for keeping idle overhead low
- slightly slower first-task startup

#### Mode 2. Warm sidecar

- DeerFlow service stays running locally
- better for repeated research tasks
- higher constant memory and CPU footprint

#### Mode 3. Full always-on merge

- not recommended for phase 1
- highest idle cost
- highest operational complexity

### Product rule

The integration should classify tasks before invoking DeerFlow.

Good DeerFlow candidates:

- market research
- competitive analysis
- long-form report generation
- multi-source synthesis
- crawl-heavy and artifact-heavy tasks

Bad DeerFlow candidates:

- quick chat replies
- simple CLI assistance
- short memory lookups
- routine skill execution
- low-latency operator interactions

### Final performance judgment

If we integrate it correctly, Vclaw does not become generally slow.

Instead:

- the baseline Vclaw experience stays fast
- a new "deep mode" becomes heavier by design
- users pay the latency cost only when they ask for work that actually benefits from it

## Proposed System Boundaries

### Keep in Vclaw

- CLI entrypoints
- local profiles and config
- session lifecycle
- long-lived memory
- skills policy
- task routing
- output contracts
- delivery channels

### Let DeerFlow own

- deep research workflow graph
- research sub-agent choreography
- report drafting / artifact generation
- optional human approval nodes inside the research flow

## Data Contract Between Systems

Minimum bridge request:

- task id
- goal
- context summary
- optional attachments or URLs
- requested output type
- time budget

Minimum bridge response:

- status
- executive summary
- findings
- citations or source list
- generated artifacts
- machine-readable structured payload

Vclaw should then map the result into:

- `conclusion`
- `plan`
- `risks`
- `acceptance`

## Major Risks

### 1. Stack mismatch

DeerFlow is not the same runtime shape as Vclaw. A direct internal merge would create operational
drag and upgrade pain.

### 2. Memory split

If DeerFlow keeps its own durable context and Vclaw keeps a separate durable context, the user will
experience fragmented memory unless Vclaw is the system of record.

### 3. Tool-policy divergence

DeerFlow's tool execution model and Vclaw's skills / plugin boundaries must be aligned carefully or
we risk inconsistent safety and capability rules.

### 4. Upstream drift

If we fork DeerFlow too deeply, every future upstream update becomes expensive.

## Risk Controls

- make Vclaw the system of record for durable memory
- keep DeerFlow behind a narrow adapter interface
- treat DeerFlow artifacts as imported outputs, not canonical state
- start with one bounded task class: research and reporting
- avoid modifying DeerFlow internals during phase 1

## Phase Plan

### Phase 1. Feasibility spike

- inspect DeerFlow runtime boundaries in detail
- identify callable entrypoints or service APIs
- create a Vclaw adapter interface
- prove one end-to-end research task

### Phase 2. Bridge MVP

- add a DeerFlow bridge command or internal tool
- normalize DeerFlow output into Vclaw task contracts
- write memory import rules
- add smoke tests

### Phase 3. Productize

- expose DeerFlow-backed research as a first-class Vclaw mode
- add status, diagnostics, and failure reporting
- optionally add a report artifact browser in UI / CLI

## Final Recommendation

Yes, we should combine them.

But the winning move is:

- not "merge DeerFlow into Vclaw everywhere"
- not "replace Vclaw with DeerFlow"
- instead "plug DeerFlow into Vclaw as a high-end research engine"

That gives us the fast upside without sacrificing the foundations that Vclaw already protects.

## References

- DeerFlow GitHub repository: https://github.com/bytedance/DeerFlow
- DeerFlow docs: https://deer-flow.tech/docs/deer-flow/
- Vclaw architecture: `docs/architecture.md`
