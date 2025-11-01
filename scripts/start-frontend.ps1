<#
Script: start-frontend.ps1
Purpose: ensure Node/Yarn, install frontend deps and start CRA dev server (uses yarn.cmd on Windows)
Usage: .\scripts\start-frontend.ps1
#>
param(
    [string]$FrontendDir = $null
)

# If FrontendDir not provided, derive it from the repository layout (scripts/ -> ../frontend)
if (-not $FrontendDir) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $repoRoot = Split-Path -Parent $scriptRoot
    $FrontendDir = Join-Path $repoRoot 'frontend'
}

function Write-Info($msg) { Write-Host "[INFO] $msg" }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Info "Node.js not found. Installing Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS -e --source winget
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install Node.js via winget. Please install Node.js manually and retry."
        exit 1
    }
}

Write-Info "Node version: $(node --version)"
Write-Info "npm version: $(npm --version)"

if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Info "yarn not found. Installing globally via npm..."
    npm install -g yarn
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install yarn globally. Please install it manually."
        exit 1
    }
}

Write-Info "yarn version: $(yarn --version)"

if (-not (Test-Path $FrontendDir)) {
    Write-Err "Папка frontend не найдена по пути: $FrontendDir"
    exit 1
}

Push-Location $FrontendDir
try {
    Write-Info "Installing dependencies (yarn install)... This may take a while."
    yarn install
} catch {
    Write-Err "yarn install failed. Try running manually: 'cd $FrontendDir; yarn install'"
    Pop-Location
    exit 1
}

Write-Info "Starting frontend dev server (yarn start) in a separate process..."
# Set env var for this session run
$env:REACT_APP_BACKEND_URL = 'http://localhost:8000'

# Robust Windows detection and use yarn.cmd on Windows to avoid opening the yarn.ps1 wrapper in an editor
$runningOnWindows = $false
if ($env:OS -and $env:OS -eq 'Windows_NT') { $runningOnWindows = $true }
if ($runningOnWindows) {
    $yarnExe = 'yarn.cmd'
} else {
    $yarnExe = 'yarn'
}

Start-Process -FilePath $yarnExe -ArgumentList 'start' -WorkingDirectory $FrontendDir
Write-Info "Frontend start command issued. Open http://localhost:3000"

Pop-Location
