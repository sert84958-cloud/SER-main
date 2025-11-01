<#
Script: stop-backend.ps1
Purpose: stop backend process by PID saved in scripts/backend.pid
Usage: .\scripts\stop-backend.ps1
#>
param(
    [string]$PidFile = $null
)

if (-not $PidFile) {
    $PidFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) 'backend.pid'
}

if (-not (Test-Path $PidFile)) {
    Write-Host "[ERROR] PID file not found: $PidFile" -ForegroundColor Red
    exit 1
}

$procId = Get-Content $PidFile | Select-Object -First 1
if (-not $procId) {
    Write-Host "[ERROR] Could not read PID from $PidFile" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Stopping backend process PID: $procId"
try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    Write-Host "[INFO] Backend stopped"
} catch {
    Write-Host "[ERROR] Failed to stop process $procId: $($_)" -ForegroundColor Red
    exit 1
}
