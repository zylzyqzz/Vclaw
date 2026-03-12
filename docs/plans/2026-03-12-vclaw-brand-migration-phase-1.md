# Vclaw Brand Migration Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand the safe, user-visible WeiClaw-AgentOS surfaces to Vclaw without regressing the multi-agent, memory, skills, or terminal-execution core.

**Architecture:** Keep the AgentOS/OpenClaw internals as compatibility layers where needed, but switch primary CLI naming, default local runtime paths, onboarding docs, and top-level branding to Vclaw. New installs should prefer Vclaw names and paths, while existing `.weiclaw-agentos` state and legacy config files continue to load automatically.

**Tech Stack:** TypeScript, Node.js 22+, pnpm, Vitest

---

### Task 1: Freeze the safe rebrand boundary

**Files:**
- Modify: `package.json`
- Modify: `openclaw.mjs`
- Modify: `src/cli/agentos.ts`
- Modify: `src/cli/cli-name.ts`
- Modify: `src/cli/banner.ts`
- Modify: `src/cli/tagline.ts`

**Step 1: Identify primary user-facing entry points**

Focus on:
- package/bin/scripts aliases
- bootstrap error messages
- CLI banner/name replacement logic
- AgentOS help and chat strings

**Step 2: Keep compatibility aliases**

Preserve:
- `openclaw`
- `weiclaw`
- `agentos`

Add or recommend:
- `vclaw`
- `vclaw:agentos`

**Step 3: Update only visible branding text**

Do not rename:
- internal `src/agentos/*` module paths
- package SDK export paths
- OpenClaw environment-variable compatibility

**Step 4: Verify behavior still routes through the same runtime**

Run:

```bash
pnpm agentos -- help
pnpm agentos -- demo --json
```

Expected:
- same commands still work
- new Vclaw branding appears in help or documentation paths

### Task 2: Prefer Vclaw state paths without breaking legacy data

**Files:**
- Modify: `src/agentos/config/loader.ts`
- Modify: `src/agentos/config/store.ts`
- Modify: `src/agentos/repository/agentos-repository.ts`
- Test: `test/agentos/repository-consistency.test.ts`
- Test: `test/agentos/config-loader.test.ts`

**Step 1: Introduce preferred and legacy path helpers**

Preferred:
- `.vclaw`
- `.vclaw-agentos.json`

Legacy compatibility:
- `.weiclaw-agentos`
- `.weiclaw-agentos.json`

**Step 2: Make new installs use Vclaw paths**

For fresh workspaces:
- storage path should point at `.vclaw/...`
- project name should be `Vclaw`

**Step 3: Keep old workspaces readable**

If `.vclaw` is absent but `.weiclaw-agentos` exists:
- continue using the legacy state directory

If only the legacy JSON config exists:
- migrate it into storage as before

**Step 4: Add tests**

Verify:
- fresh config resolves to `.vclaw`
- legacy config file still migrates
- current `.vclaw-agentos.json` compatibility file is also accepted

### Task 3: Rewrite the broken README and align architecture docs

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/roadmap.md`

**Step 1: Replace mojibake README with UTF-8 Vclaw overview**

Include:
- project positioning
- preserved core capabilities
- quick start
- compatibility notes

**Step 2: Align architecture and roadmap vocabulary**

Use:
- `Vclaw`
- `Vclaw runtime`
- `legacy compatibility`

Keep:
- agent orchestration model
- memory model
- storage behavior

**Step 3: Cross-check commands**

Docs should match actual runnable commands from this phase:
- `pnpm agentos -- ...`
- `pnpm vclaw:agentos -- ...`

### Task 4: Update tests for the new brand surface

**Files:**
- Modify: `test/agentos/cli-help-demo.test.ts`
- Modify: `test/agentos/readme-smoke.test.ts`
- Modify: `src/cli/banner.test.ts`
- Modify: `src/cli/tagline.test.ts`
- Create: `src/cli/cli-name.test.ts`

**Step 1: Update string expectations**

Check:
- Vclaw banner text
- Vclaw tagline
- help output references

**Step 2: Fix broken README smoke content**

Replace the mojibake goal string with a valid UTF-8 sample.

**Step 3: Add CLI alias regression tests**

Cover:
- `vclaw` as default displayed name
- `weiclaw` and `openclaw` still mapping to the same command replacement behavior

### Task 5: Run focused verification

**Files:**
- No code changes expected

**Step 1: Run focused tests**

```bash
pnpm exec vitest run test/agentos/cli-help-demo.test.ts test/agentos/cli-json-exit.test.ts test/agentos/readme-smoke.test.ts test/agentos/repository-consistency.test.ts test/agentos/config-loader.test.ts src/cli/banner.test.ts src/cli/tagline.test.ts src/cli/cli-name.test.ts
```

Expected:
- all targeted branding and compatibility tests pass

**Step 2: Run CLI smoke**

```bash
pnpm agentos -- help
pnpm agentos -- demo --json
pnpm agentos -- inspect-memory --session demo-main --json
```

Expected:
- command contract remains stable
- JSON payloads still parse cleanly

**Step 3: Record residual risk**

If npm package name or deep OpenClaw SDK self-references remain unresolved, keep them explicitly listed as Phase 2 compatibility work instead of changing them blindly.
