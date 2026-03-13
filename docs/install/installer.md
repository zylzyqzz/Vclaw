---
summary: "How the Vclaw installer entrypoints work, which flags matter, and how they delegate to the GitHub bootstrap flow."
read_when:
  - You want to understand `scripts/install.sh` or `scripts/install.ps1`
  - You need a dry run or a custom target path
  - You want the shortest explanation of the installer behavior
title: "Installer Internals"
---

# Installer Internals

Vclaw now has two user-facing installer entrypoints:

- `scripts/install.sh`
- `scripts/install.ps1`

Both are intentionally thin wrappers around the bootstrap scripts:

- `scripts/vclaw-bootstrap.sh`
- `scripts/vclaw-bootstrap.ps1`

That means the user-facing install command stays short, while the real machine setup logic stays in the bootstrap layer.

## Recommended commands

<Tabs>
  <Tab title="macOS / Linux">
    ```bash
    curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash
    ```
  </Tab>
  <Tab title="Windows (PowerShell)">
    ```powershell
    powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1)))"
    ```
  </Tab>
</Tabs>

## What the installer actually does

1. Shows the minimal red-ant `🐜` installer banner.
2. Resolves the local bootstrap script if it exists, otherwise downloads it from GitHub.
3. Passes modern install arguments through to the bootstrap layer.
4. Accepts common legacy compatibility flags so older habits do not fail immediately.

## Modern options

| Option | Meaning |
| --- | --- |
| `--target-dir` / `-TargetDir` | Checkout directory |
| `--archive-dir` / `-ArchiveDir` | Archive path when target is occupied |
| `--wrapper-dir` / `-WrapperDir` | Wrapper directory |
| `--repo-url` / `-RepoUrl` | Override Vclaw repo URL |
| `--deerflow-repo-url` / `-DeerFlowRepoUrl` | Override DeerFlow repo URL |
| `--pnpm-version` / `-PnpmVersion` | pnpm version to activate |
| `--deerflow-mode` / `-DeerFlowMode` | DeerFlow mode |
| `--no-git-update` / `-NoGitUpdate` | Skip `git pull` when a checkout already exists |
| `--no-deerflow` / `-NoDeerFlow` | Skip DeerFlow sidecar installation |
| `--no-onboard` / `-NoOnboard` | Do not suggest onboarding as the next action |
| `--keep-deerflow-config` / `-KeepDeerFlowConfig` | Preserve existing DeerFlow config |
| `--dry-run` / `-DryRun` | Print actions without changing the machine |

## Compatibility behavior

The product docs now lead with `vclaw`, but install compatibility is still preserved:

- the bootstrap writes `vclaw`, `agentos`, and `openclaw` wrappers
- `--install-method`, `--method`, `-InstallMethod`, `--beta`, and `-Tag` are accepted as compatibility inputs and ignored
- `--git-dir` and `-GitDir` are mapped to the checkout target path

## Example commands

<Tabs>
  <Tab title="Dry run">
    ```bash
    curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash -s -- --dry-run
    ```
  </Tab>
  <Tab title="Custom target">
    ```bash
    curl -fsSL https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.sh | bash -s -- --target-dir /opt/Vclaw --wrapper-dir /opt/Vclaw/bin
    ```
  </Tab>
  <Tab title="Windows dry run">
    ```powershell
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1))) -DryRun
    ```
  </Tab>
</Tabs>

## After install

```bash
vclaw onboard
vclaw gateway install
vclaw gateway start
```

If you want the shortest user-facing guide instead of internals, go back to [Install](/install) or [Getting Started](/start/getting-started).
