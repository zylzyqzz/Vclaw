param(
  [string]$Version = "",
  [string]$Bump = "",
  [switch]$DryRun,
  [switch]$NoPublish,
  [switch]$Verbose,
  [switch]$SkipVerify,
  [switch]$Force
)

# WeiClaw Release Script
# Supports: Windows, macOS, Linux
#
# Usage:
#   .\release.ps1 -Version 1.0.0        # Release specific version
#   .\release.ps1 -Bump patch             # Bump patch version
#   .\release.ps1 -Bump minor             # Bump minor version
#   .\release.ps1 -Bump major             # Bump major version
#   .\release.ps1 -DryRun                 # Test without publishing
#   .\release.ps1 -NoPublish              # Commit and tag, but don't push/release
#   .\release.ps1 -Verbose                 # Show detailed output

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$RepoRoot = Split-Path -Parent $PSScriptRoot
$LogDir = "$env:USERPROFILE\.weiclaw\logs"
$LogFile = "$LogDir\release.log"

# Version file
$VersionFile = Join-Path $RepoRoot "VERSION"

# Colors
$RED = "Red"
$YELLOW = "Yellow"
$GREEN = "Green"
$GRAY = "DarkGray"

function Init-Log {
  if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  "# WeiClaw Release Log" | Out-File -FilePath $LogFile -Encoding UTF8
  "# Started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format 'HH:mm:ss'
  "$timestamp $Message" | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

function Write-Step {
  param([string]$Message, [string]$Color = $RED)
  Write-Host $Message -ForegroundColor $Color
  Write-Log "STEP: $Message"
}

function Write-Info {
  param([string]$Message)
  if ($Verbose) {
    Write-Host $Message -ForegroundColor $GRAY
  }
  Write-Log "INFO: $Message"
}

function Write-Success {
  param([string]$Message)
  Write-Host $Message -ForegroundColor $GREEN
  Write-Log "SUCCESS: $Message"
}

function Write-Error {
  param([string]$Message)
  Write-Host "Error: $Message" -ForegroundColor $RED
  Write-Log "ERROR: $Message"
  throw $Message
}

function Run-Command {
  param(
    [string]$Command,
    [string]$Args,
    [switch]$Silent
  )

  $fullCommand = "$Command $Args"
  Write-Info "Running: $fullCommand"

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $Command
  $processInfo.Arguments = $Args
  $processInfo.WorkingDirectory = $RepoRoot
  $processInfo.RedirectStandardOutput = !$Verbose
  $processInfo.RedirectStandardError = !$Verbose
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $processInfo
  $process.Start() | Out-Null
  $process.WaitForExit()

  $exitCode = $process.ExitCode
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()

  if ($Verbose -and $stdout) {
    Write-Host $stdout
  }

  Write-Log "Exit code: $exitCode"

  if ($exitCode -ne 0) {
    throw "Command failed: $fullCommand (exit $exitCode)"
  }

  return @{ exitCode = $exitCode; stdout = $stdout; stderr = $stderr }
}

function Get-CurrentVersion {
  $pkgPath = Join-Path $RepoRoot "package.json"
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  return $pkg.version
}

function Get-NextVersion {
  param([string]$BumpType)

  $current = Get-CurrentVersion
  $parts = $current -split '\.'
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]

  switch ($BumpType.ToLower()) {
    "major" {
      $major++
      $minor = 0
      $patch = 0
    }
    "minor" {
      $minor++
      $patch = 0
    }
    "patch" {
      $patch++
    }
    default {
      throw "Unknown bump type: $BumpType. Use major, minor, or patch."
    }
  }

  return "$major.$minor.$patch"
}

function Update-Version {
  param([string]$NewVersion)

  $pkgPath = Join-Path $RepoRoot "package.json"
  $content = Get-Content $pkgPath -Raw -Encoding UTF8
  # Remove BOM if present
  if ($content.StartsWith("`uFEFF")) {
    $content = $content.Substring(1)
  }
  $pkg = $content | ConvertFrom-Json

  $oldVersion = $pkg.version
  $pkg.version = $NewVersion

  # Write without BOM
  $json = $pkg | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($pkgPath, $json, [System.Text.UTF8Encoding]::new($false))

  Write-Log "Updated version: $oldVersion -> $NewVersion"
  return $oldVersion
}

function Build-RuntimePackage {
  Write-Step "Building runtime package..."

  try {
    Run-Command -Command "node" -Args "scripts/pack-runtime-simple.mjs" -Silent
    $pkgPath = Join-Path $RepoRoot ".artifacts\runtime\weiclaw-runtime.tgz"

    if (!(Test-Path $pkgPath)) {
      throw "Runtime package not found at $pkgPath"
    }

    $size = (Get-Item $pkgPath).Length / 1MB
    Write-Success "Runtime package built: $("{0:N2}" -f $size) MB"
    return $pkgPath
  } catch {
    Write-Error "Failed to build runtime package: $_"
  }
}

function Update-ReleaseNotes {
  param([string]$Version)

  $changelogPath = Join-Path $RepoRoot "CHANGELOG.md"
  $date = Get-Date -Format "yyyy-MM-dd"

  $notes = @"

## [$Version] - $date

### Added
- Automated release system
- Silent installation support
- Bootstrap verification

### Changed
- Runtime packaging process

### Fixed
- Installation flow improvements

"@

  if (Test-Path $changelogPath) {
    $existing = Get-Content $changelogPath -Raw
    $notes + "`n`n" + $existing | Set-Content $changelogPath -Encoding UTF8
  } else {
    $notes | Set-Content $changelogPath -Encoding UTF8
  }

  Write-Log "Release notes updated for $Version"
}

function Commit-Changes {
  param([string]$Version)

  Write-Step "Committing changes..."

  Run-Command -Command "git" -Args "add -A"
  Run-Command -Command "git" -Args "commit -m `"Release v$Version`""

  Write-Success "Committed as v$Version"
}

function Create-Tag {
  param([string]$Version)

  Write-Step "Creating tag v$Version..."

  Run-Command -Command "git" -Args "tag -a v$Version -m `"Release v$Version`""

  Write-Success "Created tag v$Version"
}

function Push-Changes {
  Write-Step "Pushing to remote..."

  Run-Command -Command "git" -Args "push origin main"
  Run-Command -Command "git" -Args "push origin --tags"

  Write-Success "Pushed to remote"
}

function Create-GitHubRelease {
  param(
    [string]$Version,
    [string]$AssetPath
  )

  Write-Step "Creating GitHub Release..."

  $tag = "v$Version"
  $title = "WeiClaw v$Version"

  # Check if gh CLI is available
  $ghExists = Get-Command gh -ErrorAction SilentlyContinue
  if (!$ghExists) {
    Write-Info "gh CLI not found. Creating release without asset upload."
    Run-Command -Command "gh" -Args "release create $tag --title `"$title`" --generate-notes"
  } else {
    Run-Command -Command "gh" -Args "release create $tag `"$title`" --generate-notes --upload-url ."
  }

  # Upload asset if provided
  if ($AssetPath -and (Test-Path $AssetPath)) {
    Write-Step "Uploading runtime package..."
    $assetName = Split-Path $AssetPath -Leaf
    Run-Command -Command "gh" -Args "release upload $tag `"$AssetPath`" --clobber"
    Write-Success "Uploaded $assetName"
  }
}

function Show-ReleaseSummary {
  param(
    [string]$Version,
    [string]$OldVersion
  )

  Write-Host ""
  Write-Host "========================================" -ForegroundColor $GREEN
  Write-Host "  Release v$Version Complete!" -ForegroundColor $GREEN
  Write-Host "========================================" -ForegroundColor $GREEN
  Write-Host ""
  Write-Host "  Previous version: $OldVersion" -ForegroundColor $GRAY
  Write-Host "  New version:     $Version" -ForegroundColor $GREEN
  Write-Host ""
  Write-Host "  Next steps:" -ForegroundColor $YELLOW
  Write-Host "    - GitHub Release will be created"
  Write-Host "    - Runtime package will be uploaded"
  Write-Host "    - Install: iwr -useb ... | iex"
  Write-Host ""
}

# Main
Write-Host ""
Write-Host "========================================" -ForegroundColor $RED
Write-Host "  WeiClaw Release Script" -ForegroundColor $RED
Write-Host "========================================" -ForegroundColor $RED
Write-Host ""

Init-Log
Write-Log "Release started with Version=$Version, Bump=$Bump, DryRun=$DryRun, NoPublish=$NoPublish"

# Determine version
if ($Version -and $Bump) {
  Write-Error "Cannot specify both -Version and -Bump"
}

if (!$Version -and !$Bump) {
  $Version = Get-CurrentVersion
  Write-Info "No version specified, using current: $Version"
}

if ($Bump) {
  $Version = Get-NextVersion -BumpType $Bump
  Write-Info "Bumped version: $Version"
}

Write-Host "Target version: $Version" -ForegroundColor $YELLOW
Write-Host ""

# Dry-run mode
if ($DryRun) {
  Write-Host "[DRY-RUN MODE]" -ForegroundColor $YELLOW
  Write-Host ""
}

# Skip verification if requested
if (!$SkipVerify) {
  Write-Step "Running pre-release verification..."
  try {
    Run-Command -Command "node" -Args "scripts/verify-release.mjs"
    Write-Success "Verification passed!"
  } catch {
    Write-Error "Verification failed. Use -SkipVerify to bypass (not recommended)."
  }
} else {
  Write-Host "[VERIFICATION SKIPPED]" -ForegroundColor $YELLOW
}

# Build runtime package
Write-Host ""
Write-Step "Step 1/6: Building runtime package..."
$runtimePkg = Build-RuntimePackage

# Update version
Write-Host ""
Write-Step "Step 2/6: Updating version..."
$oldVersion = Update-Version -NewVersion $Version

# Update release notes
Write-Host ""
Write-Step "Step 3/6: Updating release notes..."
Update-ReleaseNotes -Version $Version

# Commit and tag (unless dry-run)
if (!$DryRun) {
  Write-Host ""
  Write-Step "Step 4/6: Committing changes..."
  Commit-Changes -Version $Version

  Write-Host ""
  Write-Step "Step 5/6: Creating tag..."
  Create-Tag -Version $Version
}

# Push and release (unless no-publish or dry-run)
if (!$NoPublish -and !$DryRun) {
  Write-Host ""
  Write-Step "Step 6/6: Publishing..."
  Push-Changes
  Create-GitHubRelease -Version $Version -AssetPath $runtimePkg
}

# Summary
Show-ReleaseSummary -Version $Version -OldVersion $oldVersion

if ($DryRun) {
  Write-Host "[DRY-RUN COMPLETE - No changes made]" -ForegroundColor $YELLOW
}

if ($NoPublish) {
  Write-Host "[NO-PUBLISH COMPLETE - Changes committed locally]" -ForegroundColor $YELLOW
}

Write-Host "Log file: $LogFile" -ForegroundColor $GRAY
Write-Log "Release process completed"
