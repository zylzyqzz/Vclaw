# Vclaw Bootstrap Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver single-command Vclaw bootstrap flows for Windows, macOS, and Linux that check the environment, install missing dependencies, update or clone the repo into the platform-default target path, preserve the current onboarding UI, and leave the system ready to run.

**Architecture:** Reuse the existing installer/runtime entrypoints where they are already stable, then add thin bootstrap layers per platform that own machine prep, directory migration, wrapper creation, and smoke verification. Keep Vclaw as the operator-facing name while avoiding risky changes to the current onboarding experience.

**Tech Stack:** PowerShell, Bash, Node.js 22, pnpm/Corepack, existing Vclaw CLI scripts, Git

---

### Task 1: Define the bootstrap contract

**Files:**
- Create: `docs/plans/2026-03-12-vclaw-bootstrap-install-plan.md`
- Modify: `README.md`
- Modify: `docs/install/installer.md`

**Step 1: Document the required machine state**

Capture the target bootstrap behavior:

- rename existing `E:\Vclaw` to `E:\Vclaw(Go语言未完成）` when present
- move the current repo to `E:\Vclaw`
- ensure `git`, Node.js 22+, Corepack, and pnpm are available
- install dependencies and verify CLI boot
- expose a stable command entrypoint for future runs

**Step 2: Decide the operator command**

Use one Windows-first command:

```powershell
powershell -ExecutionPolicy Bypass -File E:\Vclaw\scripts\vclaw-bootstrap.ps1
```

**Step 3: Keep onboarding unchanged**

Do not modify the current onboarding or guide UI flows. The bootstrap script may print follow-up
commands, but must not redesign the existing user guidance experience.

### Task 2: Implement the Windows bootstrap script

**Files:**
- Create: `scripts/vclaw-bootstrap.ps1`
- Modify: `scripts/install.ps1`

**Step 1: Add a bootstrap script with clear phases**

Phases:

1. execution policy check
2. directory migration
3. toolchain install
4. repo sync
5. dependency install
6. wrapper creation
7. smoke verification

**Step 2: Implement directory migration**

Rules:

- if `E:\Vclaw` exists and `E:\Vclaw(Go语言未完成）` does not, rename it
- if the current repo lives at `E:\WeiClaw-AgentOS`, move it to `E:\Vclaw`
- if already at `E:\Vclaw`, do nothing

**Step 3: Implement environment preparation**

Ensure:

- `git`
- Node.js `>= 22.12.0`
- Corepack enabled
- `pnpm@10.23.0`

**Step 4: Implement repo sync and install**

Behavior:

- if repo exists in target path, `git pull --rebase` when safe
- if repo is missing, clone from `https://github.com/zylzyqzz/Vclaw.git`
- run `pnpm install`

**Step 5: Create command wrappers**

Install wrappers into `%USERPROFILE%\.local\bin`:

- `vclaw.cmd`
- `agentos.cmd`

Wrappers should dispatch to the repo checkout.

### Task 3: Add verification and idempotency

**Files:**
- Modify: `scripts/vclaw-bootstrap.ps1`
- Create: `test/agentos/vclaw-bootstrap.contract.test.ts`

**Step 1: Make repeated runs safe**

Bootstrap must not fail on second run if:

- target folder already exists
- wrapper already exists
- PATH already contains wrapper dir
- dependencies are already installed

**Step 2: Add focused contract coverage**

Verify that the bootstrap script content includes:

- target path constants
- repo URL
- wrapper generation
- smoke verification commands

**Step 3: Verify runtime success**

Smoke commands:

```bash
pnpm exec vitest run test/agentos/vclaw-bootstrap.contract.test.ts test/agentos/readme-smoke.test.ts
pnpm vclaw -- help
pnpm vclaw:agentos -- demo
```

### Task 4: Update docs for the one-command workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/install/installer.md`

**Step 1: Document the new Windows-first bootstrap command**

Explain exactly what the command does:

- checks environment
- installs dependencies
- updates repo
- creates wrappers
- verifies installation

**Step 2: Document the final ready state**

After bootstrap succeeds, the operator should be able to run:

```powershell
vclaw --help
agentos demo
```

### Task 5: Implement the macOS/Linux bootstrap script

**Files:**
- Create: `scripts/vclaw-bootstrap.sh`
- Create: `test/agentos/vclaw-bootstrap-shell.contract.test.ts`
- Modify: `README.md`
- Modify: `docs/install/installer.md`

**Step 1: Define the Unix contract**

Bootstrap command:

```bash
bash ./scripts/vclaw-bootstrap.sh
```

Default paths:

- target checkout: `~/Vclaw`
- archive folder: `~/Vclaw-go-unfinished`
- wrapper dir: `~/.local/bin`

**Step 2: Implement environment preparation**

Ensure:

- `git`
- Node.js `>= 22.12.0`
- Corepack enabled when available
- `pnpm@10.23.0`

**Step 3: Implement repo sync and wrapper creation**

Behavior:

- archive an occupied non-repo target directory
- clone or update `https://github.com/zylzyqzz/Vclaw.git`
- run `pnpm install`
- create `vclaw` and `agentos` shell wrappers
- add the wrapper directory to the shell rc files when needed

**Step 4: Add focused contract coverage**

Verify that the script content includes:

- repo URL
- target path constants
- wrapper generation
- smoke verification commands

### Task 6: Execute the folder migration and final validation

**Files:**
- Modify: filesystem directories on `E:\`

**Step 1: Rename directories**

Apply:

- `E:\Vclaw` -> `E:\Vclaw(Go语言未完成）`
- `E:\WeiClaw-AgentOS` -> `E:\Vclaw`

**Step 2: Run final verification from the new path**

Run:

```powershell
pnpm exec vitest run test/agentos/vclaw-bootstrap.contract.test.ts test/agentos/vclaw-bootstrap-shell.contract.test.ts test/agentos/readme-smoke.test.ts
pnpm vclaw -- help
pnpm vclaw:agentos -- demo
```

**Step 3: Commit and push if network allows**

Use non-interactive git commands only.
