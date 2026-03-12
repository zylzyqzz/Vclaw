param(
  [string]$RepoUrl = "https://github.com/zylzyqzz/Vclaw.git",
  [string]$DeerFlowRepoUrl = "https://github.com/bytedance/deer-flow.git",
  [string]$TargetDir = "E:\Vclaw",
  [string]$LegacyGoArchiveDir = "E:\Vclaw-Go-unfinished",
  [string]$PnpmVersion = "10.23.0",
  [string]$WrapperDir = "$env:USERPROFILE\.local\bin",
  [string]$DeerFlowMode = "ultra",
  [switch]$NoGitUpdate,
  [switch]$NoDeerFlow,
  [switch]$NoOnboard,
  [switch]$KeepDeerFlowConfig,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$script:TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
$script:LegacyGoArchiveDir = [System.IO.Path]::GetFullPath($LegacyGoArchiveDir)
$script:WrapperDir = [System.IO.Path]::GetFullPath($WrapperDir)
$script:DeerFlowDir = Join-Path $script:TargetDir ".vclaw\deerflow"
$script:DeerFlowRuntimePath = Join-Path $script:DeerFlowDir "runtime.json"
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

function Refresh-Path {
  $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $candidates = @(
    $machinePath,
    $userPath,
    (Join-Path $env:USERPROFILE ".local\bin"),
    $script:WrapperDir
  ) | Where-Object { $_ -and $_.Trim().Length -gt 0 }
  $env:Path = ($candidates -join ";")
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
          (Test-Path (Join-Path $Path "vclaw.mjs")) -and
          (Test-Path (Join-Path $Path "scripts\run-node.mjs"))
        )
      )
}

function Test-DeerFlowCheckout {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $false
  }

  return (
    (Test-Path (Join-Path $Path ".git")) -or
    (
      (Test-Path (Join-Path $Path "backend\pyproject.toml")) -and
      (Test-Path (Join-Path $Path "backend\src\client.py"))
    )
  )
}

function Test-LoopbackProxyValue {
  param([string]$Value)

  if (-not $Value) {
    return $false
  }

  return $Value -match "127\.0\.0\.1" -or $Value -match "localhost"
}

function Get-ProxyHints {
  $values = @()

  try {
    $globalHttp = (git config --global --get http.proxy 2>$null)
    if ($globalHttp) {
      $values += $globalHttp.Trim()
    }
  } catch {
  }

  try {
    $globalHttps = (git config --global --get https.proxy 2>$null)
    if ($globalHttps) {
      $values += $globalHttps.Trim()
    }
  } catch {
  }

  foreach ($name in @("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")) {
    $value = [System.Environment]::GetEnvironmentVariable($name)
    if ($value) {
      $values += $value.Trim()
    }
  }

  return $values | Where-Object { $_ -and $_.Length -gt 0 } | Select-Object -Unique
}

function Remove-PathIfPresent {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Remove-Item -LiteralPath $Path -Recurse -Force
}

function Invoke-GitCloneWithRetry {
  param(
    [string]$RepoUrl,
    [string]$Destination,
    [string]$Label,
    [scriptblock]$CheckoutValidator
  )

  if ($DryRun) {
    Write-Info "[dry-run] git clone $RepoUrl $Destination"
    return
  }

  & git clone $RepoUrl $Destination
  $firstExit = $LASTEXITCODE
  if ($firstExit -eq 0 -and (& $CheckoutValidator $Destination)) {
    return
  }

  $loopbackProxyHints = @(Get-ProxyHints | Where-Object { Test-LoopbackProxyValue $_ })
  if ($loopbackProxyHints.Count -eq 0) {
    throw "$Label clone failed with exit code $firstExit."
  }

  Write-WarnLine "$Label clone failed while a local proxy is configured. Retrying without proxy."
  Write-Info ("Proxy hints: " + ($loopbackProxyHints -join ", "))

  Remove-PathIfPresent $Destination

  $savedEnv = @{
    HttpProxyUpper = $env:HTTP_PROXY
    HttpsProxyUpper = $env:HTTPS_PROXY
    AllProxyUpper = $env:ALL_PROXY
    HttpProxyLower = $env:http_proxy
    HttpsProxyLower = $env:https_proxy
    AllProxyLower = $env:all_proxy
  }

  try {
    $env:HTTP_PROXY = $null
    $env:HTTPS_PROXY = $null
    $env:ALL_PROXY = $null
    $env:http_proxy = $null
    $env:https_proxy = $null
    $env:all_proxy = $null

    & git -c http.proxy= -c https.proxy= clone $RepoUrl $Destination
    $retryExit = $LASTEXITCODE
    if ($retryExit -ne 0 -or -not (& $CheckoutValidator $Destination)) {
      throw "$Label clone failed after retrying without proxy."
    }
  } finally {
    $env:HTTP_PROXY = $savedEnv.HttpProxyUpper
    $env:HTTPS_PROXY = $savedEnv.HttpsProxyUpper
    $env:ALL_PROXY = $savedEnv.AllProxyUpper
    $env:http_proxy = $savedEnv.HttpProxyLower
    $env:https_proxy = $savedEnv.HttpsProxyLower
    $env:all_proxy = $savedEnv.AllProxyLower
  }
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

function Ensure-Uv {
  if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Step "uv ready"
    return
  }

  Write-Step "Installing uv"
  Invoke-Step "Install uv via Astral installer" {
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    Refresh-Path
  }

  if (-not $DryRun -and -not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv was not found after installation."
  }
}

function Ensure-DeerFlowPython {
  Write-Step "Preparing Python 3.12 for DeerFlow"
  Invoke-Step "uv python install 3.12" {
    uv python install 3.12
  }

  if ($DryRun) {
    return "python"
  }

  $pythonBin = (uv python find 3.12).Trim()
  if (-not $pythonBin) {
    throw "uv python find 3.12 did not return a Python runtime."
  }

  return $pythonBin
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
    Invoke-GitCloneWithRetry -RepoUrl $RepoUrl -Destination $script:TargetDir -Label "Vclaw repository" -CheckoutValidator {
      param($Path)
      Test-VclawCheckout $Path
    }
  }
}

function Ensure-DeerFlowCheckout {
  $parent = Split-Path -Parent $script:DeerFlowDir
  if (-not (Test-Path $parent)) {
    Invoke-Step "Create DeerFlow parent directory $parent" {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
  }

  if ((Test-Path $script:DeerFlowDir) -and -not (Test-DeerFlowCheckout $script:DeerFlowDir)) {
    $archive = "$script:DeerFlowDir.stale-$(Get-Date -Format yyyyMMddHHmmss)"
    Write-WarnLine "Existing DeerFlow directory is not a valid checkout; moving it to $archive"
    Invoke-Step "Move stale DeerFlow directory to $archive" {
      Move-Item -LiteralPath $script:DeerFlowDir -Destination $archive
    }
  }

  if (Test-DeerFlowCheckout $script:DeerFlowDir) {
    Write-Step "DeerFlow checkout ready at $script:DeerFlowDir"
    if (-not $NoGitUpdate -and (Test-Path (Join-Path $script:DeerFlowDir ".git"))) {
      $status = git -C $script:DeerFlowDir status --porcelain 2>$null
      if (-not $status) {
        Write-Step "Updating DeerFlow repository"
        Invoke-Step "git -C $script:DeerFlowDir pull --rebase" {
          git -C $script:DeerFlowDir pull --rebase
        }
      } else {
        Write-WarnLine "Local DeerFlow checkout has changes; skipping git pull"
      }
    }
    return
  }

  Write-Step "Cloning DeerFlow repository"
  Invoke-Step "git clone $DeerFlowRepoUrl $script:DeerFlowDir" {
    Invoke-GitCloneWithRetry -RepoUrl $DeerFlowRepoUrl -Destination $script:DeerFlowDir -Label "DeerFlow repository" -CheckoutValidator {
      param($Path)
      Test-DeerFlowCheckout $Path
    }
  }

  if (-not (Test-DeerFlowCheckout $script:DeerFlowDir)) {
    throw "DeerFlow checkout is missing or incomplete after clone."
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
  $openclawWrapper = Join-Path $script:WrapperDir "openclaw.cmd"
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

  $openclawContent = @"
@echo off
setlocal
pushd "$script:TargetDir" >nul
node openclaw.mjs %*
set "EXITCODE=%ERRORLEVEL%"
popd >nul
exit /b %EXITCODE%
"@

  Write-CmdWrapper -Path $vclawWrapper -Content $vclawContent
  Write-CmdWrapper -Path $openclawWrapper -Content $openclawContent
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

function Install-DeerFlowDependencies {
  param([string]$PythonBin)

  if (-not (Test-DeerFlowCheckout $script:DeerFlowDir)) {
    throw "DeerFlow checkout is not ready. Dependency installation was stopped before entering backend."
  }

  Write-Step "Installing DeerFlow backend dependencies"
  Invoke-Step "uv sync --python $PythonBin" {
    Push-Location (Join-Path $script:DeerFlowDir "backend")
    try {
      uv sync --python $PythonBin
    } finally {
      Pop-Location
    }
  }

  Write-Step "Configuring DeerFlow runtime metadata ($script:DeerFlowRuntimePath)"
  Invoke-Step "node scripts\\bootstrap\\configure-deerflow.mjs" {
    Push-Location $script:TargetDir
    try {
      $args = @(
        "scripts\bootstrap\configure-deerflow.mjs",
        "--vclaw-root", $script:TargetDir,
        "--deerflow-root", $script:DeerFlowDir,
        "--python-bin", $PythonBin,
        "--mode", $DeerFlowMode
      )
      if ($KeepDeerFlowConfig) {
        $args += "--keep-config"
      }
      node @args | Out-Null
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

  if (-not $NoDeerFlow) {
    Invoke-Step "pnpm vclaw:agentos -- run --goal `"research competitive landscape`" --task-type research --json" {
      Push-Location $script:TargetDir
      try {
        pnpm vclaw:agentos -- run --goal "research competitive landscape" --task-type research --json | Out-Null
      } finally {
        Pop-Location
      }
    }
  }
}

function Show-Summary {
  Write-Host ""
  Write-Host "Vclaw bootstrap complete." -ForegroundColor Green
  Write-Host "Repo: $script:TargetDir" -ForegroundColor DarkGray
  Write-Host "Wrappers: $script:WrapperDir" -ForegroundColor DarkGray
  if (-not $NoDeerFlow) {
    Write-Host "DeerFlow: $script:DeerFlowDir" -ForegroundColor DarkGray
  }
  Write-Host ""
  Write-Host "Ready commands:" -ForegroundColor Cyan
  Write-Host "  vclaw --help" -ForegroundColor DarkGray
  Write-Host "  agentos demo" -ForegroundColor DarkGray
  if (-not $NoDeerFlow) {
    Write-Host "  agentos run --goal `"research competitive landscape`" --task-type research --json" -ForegroundColor DarkGray
  }
  if (-not $NoOnboard) {
    Write-Host "  vclaw onboard" -ForegroundColor DarkGray
  }
}

function Main {
  Write-Step "Checking environment"
  Ensure-ExecutionPolicy
  Refresh-Path
  Ensure-Git
  Ensure-Node
  Ensure-CorepackAndPnpm

  Write-Step "Preparing repository layout"
  Ensure-ArchiveSlot
  Ensure-RepoCheckout

  Write-Step "Installing Vclaw"
  Install-WorkspaceDependencies
  Ensure-Wrappers

  if (-not $NoDeerFlow) {
    Write-Step "Installing DeerFlow sidecar"
    Ensure-Uv
    $pythonBin = Ensure-DeerFlowPython
    Ensure-DeerFlowCheckout
    Install-DeerFlowDependencies -PythonBin $pythonBin
  }

  Invoke-SmokeVerification
  Show-Summary
}

Main
