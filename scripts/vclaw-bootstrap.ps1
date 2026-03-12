param(
  [string]$RepoUrl = "https://github.com/zylzyqzz/Vclaw.git",
  [string]$TargetDir = "E:\Vclaw",
  [string]$LegacyGoArchiveDir = "E:\Vclaw(Go语言未完成）",
  [string]$PnpmVersion = "10.23.0",
  [string]$WrapperDir = "$env:USERPROFILE\.local\bin",
  [switch]$NoGitUpdate,
  [switch]$NoOnboard,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$script:TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
$script:LegacyGoArchiveDir = [System.IO.Path]::GetFullPath($LegacyGoArchiveDir)
$script:WrapperDir = [System.IO.Path]::GetFullPath($WrapperDir)
$script:NodeMinMajor = 22
$script:NodeMinMinor = 12

function Write-Step {
  param([string]$Message)
  Microsoft.PowerShell.Utility\Write-Host "[vclaw-bootstrap] $Message" -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Message)
  Microsoft.PowerShell.Utility\Write-Host $Message -ForegroundColor DarkGray
}

function Write-WarnLine {
  param([string]$Message)
  Microsoft.PowerShell.Utility\Write-Host $Message -ForegroundColor Yellow
}

function Invoke-Step {
  param(
    [string]$Preview,
    [scriptblock]$Action
  )

  if ($DryRun) {
    Write-Info "[dry-run] $Preview"
    return
  }

  & $Action
}

function Test-VclawCheckout {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $false
  }

  return (
    (Test-Path (Join-Path $Path ".git")) -or
    (
      (Test-Path (Join-Path $Path "package.json")) -and
      (Test-Path (Join-Path $Path "openclaw.mjs")) -and
      (Test-Path (Join-Path $Path "scripts\run-node.mjs"))
    )
  )
}

function Get-NodeVersion {
  try {
    $raw = node --version 2>$null
    if (-not $raw) {
      return $null
    }
    return ($raw -replace "^v", "").Trim()
  } catch {
    return $null
  }
}

function Test-NodeVersionSupported {
  param([string]$Version)

  if (-not $Version) {
    return $false
  }

  $parts = $Version.Split(".")
  if ($parts.Length -lt 2) {
    return $false
  }

  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  return ($major -gt $script:NodeMinMajor) -or ($major -eq $script:NodeMinMajor -and $minor -ge $script:NodeMinMinor)
}

function Refresh-Path {
  $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = @($machinePath, $userPath) -join ";"
}

function Ensure-ExecutionPolicy {
  try {
    $policy = Get-ExecutionPolicy
  } catch {
    return
  }

  if ($policy -in @("Restricted", "AllSigned")) {
    Invoke-Step "Set execution policy to RemoteSigned for current process" {
      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
    }
  }
}

function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Step "Git ready"
    return
  }

  Write-Step "Installing Git"

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Invoke-Step "winget install Git.Git" {
      winget install --id Git.Git --accept-package-agreements --accept-source-agreements | Out-Null
      Refresh-Path
    }
    return
  }

  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Invoke-Step "choco install git -y" {
      choco install git -y | Out-Null
      Refresh-Path
    }
    return
  }

  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    Invoke-Step "scoop install git" {
      scoop install git | Out-Null
      Refresh-Path
    }
    return
  }

  throw "Git is required but no supported installer is available."
}

function Ensure-Node {
  $nodeVersion = Get-NodeVersion
  if (Test-NodeVersionSupported $nodeVersion) {
    Write-Step "Node.js v$nodeVersion ready"
    return
  }

  if ($nodeVersion) {
    Write-WarnLine "Node.js v$nodeVersion found, but Vclaw needs v22.12+"
  } else {
    Write-Step "Node.js not found"
  }

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Invoke-Step "winget install OpenJS.NodeJS.LTS" {
      winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements | Out-Null
      Refresh-Path
    }
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Invoke-Step "choco install nodejs-lts -y" {
      choco install nodejs-lts -y | Out-Null
      Refresh-Path
    }
  } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
    Invoke-Step "scoop install nodejs-lts" {
      scoop install nodejs-lts | Out-Null
      Refresh-Path
    }
  } else {
    throw "Node.js 22.12+ is required but no supported installer is available."
  }

  $installedVersion = Get-NodeVersion
  if (-not (Test-NodeVersionSupported $installedVersion)) {
    throw "Node.js install did not produce a supported runtime."
  }

  Write-Step "Node.js v$installedVersion ready"
}

function Ensure-CorepackAndPnpm {
  Write-Step "Preparing Corepack and pnpm@$PnpmVersion"

  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Invoke-Step "corepack enable" {
      corepack enable
    }

    Invoke-Step "corepack prepare pnpm@$PnpmVersion --activate" {
      corepack prepare "pnpm@$PnpmVersion" --activate
      Refresh-Path
    }
  } else {
    Write-WarnLine "corepack not found; falling back to npm install -g pnpm@$PnpmVersion"
    Invoke-Step "npm install -g pnpm@$PnpmVersion" {
      npm install -g "pnpm@$PnpmVersion" --no-fund --no-audit | Out-Null
      Refresh-Path
    }
  }

  if ($DryRun) {
    return
  }

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm was not found after bootstrap activation."
  }
}

function Ensure-ArchiveSlot {
  if (-not (Test-Path $script:TargetDir)) {
    return
  }

  if (Test-VclawCheckout $script:TargetDir) {
    Write-Step "Target repo directory already looks like a Vclaw checkout"
    return
  }

  if (Test-Path $script:LegacyGoArchiveDir) {
    throw "Target $script:TargetDir is occupied, and archive path $script:LegacyGoArchiveDir already exists."
  }

  Write-Step "Archiving existing E:\Vclaw folder"
  Invoke-Step "Rename $script:TargetDir -> $script:LegacyGoArchiveDir" {
    Rename-Item -LiteralPath $script:TargetDir -NewName ([System.IO.Path]::GetFileName($script:LegacyGoArchiveDir))
  }
}

function Ensure-RepoCheckout {
  if (Test-VclawCheckout $script:TargetDir) {
    Write-Step "Vclaw checkout ready at $script:TargetDir"

    if (-not $NoGitUpdate -and (Test-Path (Join-Path $script:TargetDir ".git"))) {
      $status = git -C $script:TargetDir status --porcelain 2>$null
      if (-not $status) {
        Write-Step "Updating repository"
        Invoke-Step "git -C $script:TargetDir pull --rebase" {
          git -C $script:TargetDir pull --rebase
        }
      } else {
        Write-WarnLine "Local repository has changes; skipping git pull"
      }
    }
    return
  }

  $parent = Split-Path -Parent $script:TargetDir
  if (-not (Test-Path $parent)) {
    Invoke-Step "Create parent directory $parent" {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
  }

  Write-Step "Cloning Vclaw repository"
  Invoke-Step "git clone $RepoUrl $script:TargetDir" {
    git clone $RepoUrl $script:TargetDir
  }
}

function Write-CmdWrapper {
  param(
    [string]$Path,
    [string]$Content
  )

  Invoke-Step "Write wrapper $Path" {
    Set-Content -LiteralPath $Path -Encoding ASCII -Value $Content
  }
}

function Ensure-WrapperDirOnPath {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $entries = @()
  if ($userPath) {
    $entries = $userPath.Split(";") | Where-Object { $_ -and $_.Trim().Length -gt 0 }
  }

  if ($entries -contains $script:WrapperDir) {
    Refresh-Path
    return
  }

  Invoke-Step "Add $script:WrapperDir to user PATH" {
    $updated = @($entries + $script:WrapperDir) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $updated, "User")
    Refresh-Path
  }
}

function Ensure-Wrappers {
  if (-not (Test-Path $script:WrapperDir)) {
    Invoke-Step "Create wrapper directory $script:WrapperDir" {
      New-Item -ItemType Directory -Path $script:WrapperDir -Force | Out-Null
    }
  }

  $vclawWrapper = Join-Path $script:WrapperDir "vclaw.cmd"
  $agentosWrapper = Join-Path $script:WrapperDir "agentos.cmd"

  $vclawContent = @"
@echo off
setlocal
pushd "$script:TargetDir" >nul
node scripts\run-node.mjs %*
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%
"@

  $agentosContent = @"
@echo off
setlocal
pushd "$script:TargetDir" >nul
node --import tsx src\cli\agentos.ts %*
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%
"@

  Write-CmdWrapper -Path $vclawWrapper -Content $vclawContent
  Write-CmdWrapper -Path $agentosWrapper -Content $agentosContent
  Ensure-WrapperDirOnPath
}

function Install-WorkspaceDependencies {
  Write-Step "Installing workspace dependencies"
  Invoke-Step "pnpm install" {
    Push-Location $script:TargetDir
    try {
      pnpm install
    } finally {
      Pop-Location
    }
  }
}

function Invoke-SmokeVerification {
  Write-Step "Running smoke verification"
  Invoke-Step "pnpm vclaw -- help" {
    Push-Location $script:TargetDir
    try {
      pnpm vclaw -- help | Out-Null
    } finally {
      Pop-Location
    }
  }

  Invoke-Step "pnpm vclaw:agentos -- demo --json" {
    Push-Location $script:TargetDir
    try {
      pnpm vclaw:agentos -- demo --json | Out-Null
    } finally {
      Pop-Location
    }
  }
}

function Show-Summary {
  Write-Host ""
  Write-Host "Vclaw bootstrap complete." -ForegroundColor Green
  Write-Host "Repo: $script:TargetDir" -ForegroundColor DarkGray
  Write-Host "Wrappers: $script:WrapperDir" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "Ready commands:" -ForegroundColor Cyan
  Write-Host "  vclaw --help" -ForegroundColor DarkGray
  Write-Host "  agentos demo" -ForegroundColor DarkGray
  if (-not $NoOnboard) {
    Write-Host "  vclaw onboard" -ForegroundColor DarkGray
  }
}

function Main {
  Write-Step "Checking environment"
  Ensure-ExecutionPolicy
  Ensure-Git
  Ensure-Node
  Ensure-CorepackAndPnpm

  Write-Step "Preparing repository layout"
  Ensure-ArchiveSlot
  Ensure-RepoCheckout

  Write-Step "Installing Vclaw"
  Install-WorkspaceDependencies
  Ensure-Wrappers
  Invoke-SmokeVerification

  Show-Summary
}

Main
