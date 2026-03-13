param(
  [string]$RepoUrl = "https://github.com/zylzyqzz/Vclaw.git",
  [string]$DeerFlowRepoUrl = "https://github.com/bytedance/deer-flow.git",
  [string]$TargetDir = "E:\Vclaw",
  [string]$ArchiveDir = "E:\Vclaw-Go-unfinished",
  [string]$PnpmVersion = "10.23.0",
  [string]$WrapperDir = "$env:USERPROFILE\.local\bin",
  [string]$DeerFlowMode = "ultra",
  [switch]$NoGitUpdate,
  [switch]$NoDeerFlow,
  [switch]$NoOnboard,
  [switch]$KeepDeerFlowConfig,
  [switch]$DryRun,
  [string]$InstallMethod,
  [string]$Tag,
  [string]$GitDir,
  [Alias("h", "?")]
  [switch]$Help,
  [Alias("Verbose")]
  [switch]$VerboseMode,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$BootstrapUrl = "https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/vclaw-bootstrap.ps1"
$ScriptRoot = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { "" }

function Write-Step {
  param([string]$Message)
  Microsoft.PowerShell.Utility\Write-Host $Message -ForegroundColor Red
}

function Write-Info {
  param([string]$Message)
  Microsoft.PowerShell.Utility\Write-Host $Message -ForegroundColor DarkGray
}

function Show-Banner {
  Write-Host ""
  Write-Step "🐜 Vclaw Installer"
  Write-Info "Simple GitHub install. Local-first. Compatible with openclaw skills."
  Write-Host ""
}

function Show-Help {
  @"
Usage: install.ps1 [options]

Recommended:
  powershell -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/zylzyqzz/Vclaw/main/scripts/install.ps1)))"

Modern options:
  -TargetDir <path>            Checkout directory
  -ArchiveDir <path>           Archive directory when target is occupied
  -WrapperDir <path>           Wrapper directory
  -RepoUrl <url>               Override Vclaw repo URL
  -DeerFlowRepoUrl <url>       Override DeerFlow repo URL
  -PnpmVersion <ver>           pnpm version to activate
  -DeerFlowMode <mode>         DeerFlow mode
  -NoGitUpdate                 Skip git pull when checkout already exists
  -NoDeerFlow                  Skip DeerFlow sidecar installation
  -NoOnboard                   Do not suggest onboarding as the next action
  -KeepDeerFlowConfig          Preserve existing DeerFlow config
  -DryRun                      Print actions without changing the machine

Compatibility options accepted but ignored:
  -InstallMethod <value>
  -Tag <value>

Compatibility mapping:
  -GitDir <path>               Same as -TargetDir <path>
"@ | Write-Output
}

function Resolve-BootstrapPath {
  if ($ScriptRoot) {
    $localBootstrap = Join-Path $ScriptRoot "vclaw-bootstrap.ps1"
    if (Test-Path $localBootstrap) {
      return $localBootstrap
    }
  }

  $tempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("vclaw-bootstrap-" + [System.Guid]::NewGuid().ToString("N") + ".ps1")
  Invoke-WebRequest -Uri $BootstrapUrl -UseBasicParsing -OutFile $tempPath
  return $tempPath
}

function Add-Arg {
  param(
    [System.Collections.Generic.List[string]]$ArgsList,
    [string]$Name,
    [string]$Value
  )

  $ArgsList.Add($Name) | Out-Null
  $ArgsList.Add($Value) | Out-Null
}

function Add-Switch {
  param(
    [System.Collections.Generic.List[string]]$ArgsList,
    [string]$Name,
    [bool]$Enabled
  )

  if ($Enabled) {
    $ArgsList.Add($Name) | Out-Null
  }
}

function Invoke-Installer {
  if ($InstallMethod) {
    Write-Info "Ignoring -InstallMethod $InstallMethod. Vclaw always installs from the GitHub checkout flow."
  }

  if ($Tag) {
    Write-Info "Ignoring -Tag $Tag. The installer always pulls the current GitHub bootstrap flow."
  }

  if ($VerboseMode) {
    Write-Info "Ignoring -Verbose. The new installer keeps output intentionally minimal."
  }

  if ($NoPrompt) {
    Write-Info "Ignoring -NoPrompt. The new installer is already non-interactive at the entrypoint."
  }

  if ($GitDir) {
    $script:TargetDir = $GitDir
  } else {
    $script:TargetDir = $TargetDir
  }

  $bootstrapPath = Resolve-BootstrapPath
  $localBootstrapPath = if ($ScriptRoot) { Join-Path $ScriptRoot "vclaw-bootstrap.ps1" } else { $null }
  $cleanupBootstrap = -not ($localBootstrapPath -and (Test-Path $localBootstrapPath))
  $argsList = [System.Collections.Generic.List[string]]::new()

  try {
    Add-Arg -ArgsList $argsList -Name "-RepoUrl" -Value $RepoUrl
    Add-Arg -ArgsList $argsList -Name "-DeerFlowRepoUrl" -Value $DeerFlowRepoUrl
    Add-Arg -ArgsList $argsList -Name "-TargetDir" -Value $script:TargetDir
    Add-Arg -ArgsList $argsList -Name "-LegacyGoArchiveDir" -Value $ArchiveDir
    Add-Arg -ArgsList $argsList -Name "-PnpmVersion" -Value $PnpmVersion
    Add-Arg -ArgsList $argsList -Name "-WrapperDir" -Value $WrapperDir
    Add-Arg -ArgsList $argsList -Name "-DeerFlowMode" -Value $DeerFlowMode
    Add-Switch -ArgsList $argsList -Name "-NoGitUpdate" -Enabled $NoGitUpdate
    Add-Switch -ArgsList $argsList -Name "-NoDeerFlow" -Enabled $NoDeerFlow
    Add-Switch -ArgsList $argsList -Name "-NoOnboard" -Enabled $NoOnboard
    Add-Switch -ArgsList $argsList -Name "-KeepDeerFlowConfig" -Enabled $KeepDeerFlowConfig
    Add-Switch -ArgsList $argsList -Name "-DryRun" -Enabled $DryRun

    Write-Step "Starting Vclaw bootstrap"
    & powershell -ExecutionPolicy Bypass -File $bootstrapPath @argsList
    if ($LASTEXITCODE -ne 0) {
      throw "Bootstrap exited with code $LASTEXITCODE."
    }
  } finally {
    if ($cleanupBootstrap -and (Test-Path $bootstrapPath)) {
      Remove-Item -LiteralPath $bootstrapPath -Force -ErrorAction SilentlyContinue
    }
  }
}

Show-Banner

if ($Help) {
  Show-Help
  exit 0
}

Invoke-Installer
