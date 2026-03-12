# Vclaw Roadmap

## Current Goal

Complete the Vclaw-first migration without regressing the foundations that matter:

- stable task execution
- smooth skills
- normal communication and operator feedback
- durable memory
- strong multi-agent behavior

## Current Baseline

Already preserved in the current codebase:

- local-first runtime behavior
- Gateway and node-host workflows
- multi-agent orchestration
- layered memory
- structured CLI and JSON contracts
- compatibility aliases and legacy integration edges

## Phase 1

Safe user-visible migration:

- switch help text and examples to `vclaw`
- move docs and onboarding language to Vclaw-first wording
- keep compatibility aliases working
- clean visible encoding and mojibake issues

## Phase 2

Careful compatibility reduction:

- reduce remaining visible `WeiClaw` and `OpenClaw` mentions
- tighten doc consistency across CLI, onboarding, and status output
- keep legacy runtime hooks only where they are still needed for stability

## Phase 3

Lean core hardening:

- keep only the features that support the main runtime promise
- avoid unnecessary side systems
- continue strengthening diagnostics, recovery paths, and regression coverage

## Explicit Non-Goals

This repo is not trying to do a risky all-at-once rename of every internal symbol.
Where a rename would threaten compatibility, the boundary stays in place until a safe migration
path exists.

## Ongoing Acceptance Standard

The migration is only considered successful when these remain true:

- the runtime still executes tasks reliably
- skills still load and run cleanly
- memory remains complete and inspectable
- multi-agent flows remain strong
- CLI and docs feel like Vclaw, not a half-renamed fork
