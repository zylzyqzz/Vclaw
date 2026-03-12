# WeiClaw Development Path

## Current Stage

WeiClaw is past the "can it run" stage.

The project now has a stable minimal main chain:
- `weiclaw` main CLI
- `openclaw` compatibility alias
- TUI
- Telegram
- setup / onboard / doctor / status / configure
- skills compatibility
- automation / scheduler
- OpenAI-compatible providers

That changes the priority.

The next focus is no longer broad feature addition. The next focus is:
- installation productization
- delivery slimming
- optional capability isolation
- reproducible update and recovery flow
- documentation that matches reality

## Development Principles

1. Keep the main chain stable.
2. Make delivery lighter before making it bigger.
3. Make installation simpler before adding more options.
4. Keep the default surface narrow.
5. Move optional capability behind explicit choice.
6. Keep docs, scripts, and runtime behavior aligned.
7. Do not break TUI, Telegram, skills, automation, or OpenAI-compatible routing while trimming.

## Priority Order

Highest priority now:
- P0 installation productization
- P1 runtime-package delivery slimming
- P2 channel path solidification

Next priority:
- P3 UI compatibility-chain trimming
- P4 update and recovery experience

Later but still required:
- P5 documentation and maintenance system hardening

Do not rush-delete yet:
- `src/gateway/server-browser.ts`
- `src/gateway/server-runtime-config.ts`
- `src/canvas-host/**`
- `vendor/a2ui/**`
- `scripts/build-a2ui.mjs`

These are still compatibility-chain hard points and need reference-driven trimming, not blind deletion.

## P0: Installation Productization

### Goal

Turn WeiClaw into something a normal user can install with one command and understand on first run.

### Task List

- keep one-command bootstrap for macOS / Linux
- keep one-command bootstrap for Windows PowerShell
- keep short bilingual prompts
- keep fixed first-run order:
  - logo
  - model choice
  - channel choice
  - selected channel credentials only
  - TUI choice
- keep recommended model presets small
- keep Telegram / Feishu channel choice explicit
- keep advanced setup out of the first screen

### Dependencies

- stable runtime package
- stable `weiclaw setup --bootstrap`
- stable `npm run start`
- stable TUI launch path

### Risks

- environment auto-install may differ by OS and package manager
- first-run prompts can drift away from actual config fields
- Feishu selection can appear supported before runtime delivery is ready

### Validation

- clean-ish machine can run the bootstrap command
- bootstrap writes minimum working config
- choosing Telegram only asks for bot token
- choosing Feishu only asks for app id and app secret
- choosing `Y` opens TUI
- choosing `N` exits cleanly with setup complete

### Success Standard

A normal user can finish install without touching `configure` or `onboard`.

## P1: Runtime Package And Delivery Slimming

### Goal

Separate the development repository from the runtime delivery artifact.

### Task List

- keep `runtime:pack` as the runtime-package generator
- continue trimming package `files`
- keep production installs on production dependencies only
- keep Feishu outside the default runtime payload unless selected
- measure runtime tarball size against full dev install footprint
- move more delivery-only logic into packaging scripts instead of shipping source bulk

### Dependencies

- stable build output
- plugin install path that works without bundling every extension

### Risks

- trimming too aggressively can remove files required at runtime
- plugin SDK exports may imply files that are no longer in the package
- extension runtime discovery can break if package boundaries are wrong

### Validation

- `npm exec pnpm -- runtime:pack` succeeds
- produced tarball installs globally
- installed runtime still supports `weiclaw --help`, `status`, `doctor`, `configure`
- runtime artifact is materially smaller than a full development checkout

### Success Standard

Normal users install a small runtime artifact, not a full development tree.

## P2: Channel Path Solidification

### Goal

Keep Telegram stable and make Feishu selection explicit and honest.

### Task List

- keep Telegram as the lightest path
- verify `@openclaw/feishu` plugin install works when chosen
- unify channel setup abstraction so bootstrap, configure, and status agree
- keep channel docs and tests aligned with real state
- keep Telegram-only installs free of Feishu runtime weight

### Dependencies

- stable plugin install system
- stable minimal config writes

### Risks

- Feishu plugin resolution may fail on environments with restricted npm access
- Feishu docs can overstate readiness if not tested through bootstrap
- channel configuration fields can diverge between bootstrap and advanced flows

### Validation

- Telegram bootstrap path works with token-only input
- Feishu bootstrap path installs plugin and writes only Feishu config
- `weiclaw status` reports the selected channel correctly
- Telegram-only runtime package does not ship Feishu payload by default

### Success Standard

Telegram is production-light, and Feishu is clearly either working-on-demand or explicitly marked limited.

## P3: UI Compatibility Chain Trimming

### Goal

Keep UI/browser/canvas compatibility code out of the default product surface and continue isolating it until safe physical deletion is possible.

### Task List

- map references for:
  - `src/gateway/server-browser.ts`
  - `src/gateway/server-runtime-config.ts`
  - `src/canvas-host/**`
  - `vendor/a2ui/**`
  - `scripts/build-a2ui.mjs`
- convert remaining default touches into lazy or no-op paths
- remove code that is truly unreachable from the default runtime
- ensure build remains green without UI bundle steps by default

### Dependencies

- current UI-free default build path
- regression tests for TUI and CLI main chain

### Risks

- accidental breakage of gateway startup or config resolution
- accidental reintroduction of UI into logs, help, or docs
- hidden imports from build scripts or copy scripts

### Validation

- `pnpm build` stays green without UI flags
- help/status/start output does not mention dashboard/browser by default
- TUI remains intact
- import graph for removed files is empty or explicitly optional

### Success Standard

UI compatibility remains available only behind explicit paths and no longer shapes the default product.

## P4: Delivery, Update, And Recovery Experience

### Goal

Make install, update, restart, rollback, and recovery predictable across Windows, macOS, and Linux.

### Task List

- stabilize bootstrap scripts across package managers
- add a reliable update script or documented update sequence
- add rollback notes for failed updates
- keep server restart commands aligned with current `start`
- document what `.env.local` is optional for and what is not

### Dependencies

- stable `start`
- stable build
- stable runtime package

### Risks

- OS-specific package-manager differences
- global npm install differences
- service management differences across environments

### Validation

- documented local update path works
- documented server update path works
- `npm run start` remains the real start command
- restart docs do not drift from code

### Success Standard

Users can install, update, and recover without reverse-engineering the repo.

## P5: Documentation And Maintenance System

### Goal

Make the repo understandable and maintainable without expanding the product surface again.

### Task List

- keep README product-oriented
- keep FAQ aligned with actual behavior
- add operator notes for update/recovery
- strengthen regression tests for brand, build, start, and bootstrap
- keep release/runtime packaging docs current
- keep remaining OpenClaw attribution clear but scoped

### Dependencies

- stabilized install and update flow
- regression guardrails

### Risks

- docs drift faster than code
- examples may reintroduce old UI or OpenClaw-first language
- release instructions may assume a dev checkout again

### Validation

- every command shown in README is reproducible
- regression suite catches help/build/start drift
- roadmap tasks map to real files and scripts

### Success Standard

The repo explains exactly what WeiClaw is, how to install it, how to run it, and what remains optional.

## Risk List

### Feishu risk

If Feishu remains plugin-on-demand, the main risks are npm availability, plugin resolution, and plugin/version drift. Do not present Feishu as more integrated than it really is.

### UI trimming risk

`server-browser`, `server-runtime-config`, `canvas-host`, `vendor/a2ui`, and `build-a2ui` still have compatibility-chain value. Delete only after import and runtime checks are explicit.

### Environment auto-install risk

Bootstrap can install common prerequisites, but package-manager coverage differs. Keep failure messages short and clear, and keep manual fallback documented.

### Cross-platform risk

Windows, Linux, and macOS differ in package managers, PATH handling, and service behavior. Validate bootstrap separately on each platform class.

### Main-chain regression risk

Every trimming step must keep these green:
- `pnpm tsgo`
- `pnpm build`
- `npm run start`
- `weiclaw --help`
- `weiclaw status --help`
- TUI entry
- Telegram path
- skills path
- automation path

## Acceptance Checklist By Stage

### P0 accepted when

- bootstrap scripts run
- bootstrap prompts are short and bilingual
- the fixed first-run sequence is preserved
- Telegram and Feishu selection are both explicit

### P1 accepted when

- runtime tarball builds cleanly
- runtime install works without the full development tree
- default runtime payload excludes obvious development bulk

### P2 accepted when

- Telegram path is stable
- Feishu path is either verified working or explicitly marked limited
- channel choice affects payload and config path

### P3 accepted when

- default help and start path remain UI-free
- optional UI code is more isolated than before
- no TUI regressions

### P4 accepted when

- documented update and restart commands are reproducible
- rollback/recovery notes exist

### P5 accepted when

- README, FAQ, and scripts all agree
- regression tests protect the first path

## Final Target

WeiClaw should become lighter, more stable, easier to install, and easier to hand over.

The long-term target is not a larger and more complicated OpenClaw fork. The long-term target is a sharper product:
- lighter by default
- stable on the main chain
- easy to install
- honest about optional capability
- documented like a real deliverable
