param(
  [string]$Tarball = $(if ($env:WEICLAW_INSTALL_TARBALL) { $env:WEICLAW_INSTALL_TARBALL } else { "" }),
  [switch]$DryRun,
  [switch]$SkipBootstrap,
  [switch]$Verbose = $(if ($env:WEICLAW_VERBOSE -eq "1") { $true } else { $false })
)

# =============================================================================
# WeiClaw Bootstrap Installer (Windows PowerShell)
# =============================================================================
# Runtime download order:
#   1. Official GitHub Release
#   2. ghproxy.net mirror of the GitHub Release
#   3. Source install fallback
# =============================================================================

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$GITHUB_RELEASE_URL = "https://github.com/zylzyqzz/WeiClaw/releases/latest/download/weiclaw-runtime.tgz"
$GHPROXY_URL = "https://ghproxy.net/https://github.com/zylzyqzz/WeiClaw/releases/download/v1.0.1/weiclaw-runtime.tgz"

function Write-Step {
  param([string]$Message)
  if ($Verbose) {
    Write-Host "[VERBOSE] $Message" -ForegroundColor DarkGray
  }
  Write-Host $Message -ForegroundColor Red
}

function Write-Info {
  param([string]$Message)
  Write-Host $Message -ForegroundColor DarkGray
}

function Invoke-Step {
  param([scriptblock]$Action, [string]$Preview)
  if ($DryRun) {
    Write-Host "[dry-run] $Preview"
    return
  }
  & $Action
}

function Show-Logo {
  Write-Host " __  __" -ForegroundColor Red
  Write-Host " \ \/ /" -ForegroundColor Red
  Write-Host "  \  /" -ForegroundColor Red
  Write-Host "   \/" -ForegroundColor Red
  Write-Host " WeiClaw" -ForegroundColor Red
  Write-Host "Minimal private agent" -ForegroundColor DarkGray
  Write-Host ""
}

function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Step "Git ready"
    return
  }
  Write-Step "Installing Git"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Invoke-Step { winget install --id Git.Git --accept-package-agreements --accept-source-agreements } "winget install Git.Git"
    return
  }
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Invoke-Step { choco install git -y } "choco install git -y"
    return
  }
  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    Invoke-Step { scoop install git } "scoop install git"
    return
  }
  throw "Missing git, and no supported installer is available."
}

function Ensure-Node {
  if ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Step "Node ready"
    return
  }
  Write-Step "Installing Node.js"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Invoke-Step { winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements } "winget install OpenJS.NodeJS.LTS"
    return
  }
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Invoke-Step { choco install nodejs-lts -y } "choco install nodejs-lts -y"
    return
  }
  if (Get-Command scoop -ErrorAction SilentlyContinue) {
    Invoke-Step { scoop install nodejs-lts } "scoop install nodejs-lts"
    return
  }
  throw "Missing node/npm, and no supported installer is available."
}

function Test-Url {
  param([string]$Url, [int]$Timeout = 15)
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Head -MaximumRedirection 5 -TimeoutSec $Timeout -UseBasicParsing
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    return $false
  }
}

function Install-FromSource {
  Write-Step "Falling back to source installation"
  Write-Info "Cloning WeiClaw repository..."

  $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("weiclaw-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
  $pushed = $false

  try {
    try {
      Invoke-Step { git clone --depth 1 https://github.com/zylzyqzz/WeiClaw.git $tempDir } "git clone https://github.com/zylzyqzz/WeiClaw.git"
    } catch {
      if (-not $DryRun) {
        Write-Info "GitHub unavailable, trying Gitee mirror..."
        Invoke-Step { git clone --depth 1 https://gitee.com/zylzyqzz/weiclaw.git $tempDir } "git clone https://gitee.com/zylzyqzz/weiclaw.git"
      }
    }

    Push-Location $tempDir
    $pushed = $true

    Write-Info "Installing dependencies..."
    Invoke-Step { npm install --omit=dev } "npm install --omit=dev"

    Write-Info "Building..."
    Invoke-Step { npm run build } "npm run build"

    Write-Info "Installing globally..."
    Invoke-Step { npm link } "npm link"

    return $true
  } catch {
    Write-Step "Source installation failed: $_"
    return $false
  } finally {
    if ($pushed) {
      Pop-Location
    }
    if (Test-Path $tempDir) {
      Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    }
  }
}

function Install-Runtime {
  Write-Step "Preparing runtime package"

  if ($Tarball) {
    Write-Info "Using custom tarball: $Tarball"
    Invoke-Step { npm install -g $Tarball --omit=dev --no-fund --no-audit } "npm install -g $Tarball --omit=dev --no-fund --no-audit"
    return
  }

  $sources = @(
    @{ Name = "github"; Url = $GITHUB_RELEASE_URL; Label = "Trying runtime source 1/3: official GitHub Release" },
    @{ Name = "ghproxy"; Url = $GHPROXY_URL; Label = "Trying runtime source 2/3: ghproxy.net mirror" }
  )

  foreach ($source in $sources) {
    Write-Info $source.Label
    if ($Verbose) {
      Write-Info "Source URL: $($source.Url)"
    }

    if (Test-Url -Url $source.Url -Timeout 15) {
      Write-Info "Runtime source available, installing..."
      Invoke-Step { npm install -g $source.Url --omit=dev --no-fund --no-audit } "npm install -g $($source.Url) --omit=dev --no-fund --no-audit"
      return
    }

    Write-Info "Runtime source unavailable, switching..."
  }

  Write-Step "Runtime sources failed, switching to source install fallback"

  if (Install-FromSource) {
    Write-Step "Source installation succeeded"
    return
  }

  Write-Step "Installation failed"
  throw "All installation sources failed"
}

function Start-Bootstrap {
  # Detect if running in interactive terminal
  $isInteractive = [Console]::IsInputRedirected -eq $false -and [Console]::IsOutputRedirected -eq $false

  if ($SkipBootstrap) {
    Write-Step "Skipping bootstrap"
    Write-Host ""
    Write-Host "To run setup manually, use: weiclaw setup --bootstrap" -ForegroundColor DarkGray
    return
  }

  if ($isInteractive) {
    Write-Step "Starting minimal setup..."
    Invoke-Step { weiclaw setup --bootstrap } "weiclaw setup --bootstrap"
  } else {
    Write-Step "Installation complete"
    Write-Host ""
    Write-Host "To run setup manually, use: weiclaw setup --bootstrap" -ForegroundColor DarkGray
  }
}

Show-Logo
Write-Step "Checking environment"
Ensure-Git
Ensure-Node
Install-Runtime
Invoke-Step { weiclaw --help | Out-Null } "weiclaw --help"
Start-Bootstrap
Write-Step "Done"