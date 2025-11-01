<#
Script: start-backend.ps1
Purpose: create/activate Python venv, install requirements and start uvicorn for backend.
Usage: .\scripts\start-backend.ps1
#>
param(
    [string]$BackendDir = $null
)

if (-not $BackendDir) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $repoRoot = Split-Path -Parent $scriptRoot
    $BackendDir = Join-Path $repoRoot 'backend'
}

Write-Host "[INFO] Starting backend from: $BackendDir"

if (-not (Test-Path $BackendDir)) {
    Write-Host "[ERROR] Backend folder not found: $BackendDir" -ForegroundColor Red
    exit 1
}

Push-Location $BackendDir

if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Write-Host "[INFO] Virtual environment not found. Creating .venv using py -3.11 if available..."
    if (Get-Command py -ErrorAction SilentlyContinue) {
        py -3.11 -m venv .venv
    } else {
        python -m venv .venv
    }
}

Write-Host "[INFO] Activating venv and installing requirements (if needed)"
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
}

Write-Host "[INFO] Starting uvicorn as a background process..."
$proc = Start-Process -FilePath .\.venv\Scripts\python.exe -ArgumentList '-m','uvicorn','server:app','--host','0.0.0.0','--port','8000' -PassThru
$proc.Id | Out-File -FilePath "..\scripts\backend.pid" -Encoding ascii
Write-Host "[INFO] Backend started. PID: $($proc.Id). PID saved to scripts\backend.pid"

Pop-Location
