<#
Script: run-frontend-window.ps1
Purpose: open a new PowerShell window and run frontend dev server there (visible logs). Uses yarn.cmd on Windows.
Usage: .\scripts\run-frontend-window.ps1
#>
param(
    [string]$FrontendDir = $null
)

# Derive frontend dir if not provided
if (-not $FrontendDir) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $repoRoot = Split-Path -Parent $scriptRoot
    $FrontendDir = Join-Path $repoRoot 'frontend'
}

Write-Host "[INFO] Opening new PowerShell window and starting frontend in: $FrontendDir"

if (-not (Test-Path $FrontendDir)) {
    Write-Host "[ERROR] frontend folder not found at: $FrontendDir" -ForegroundColor Red
    exit 1
}

# Build command to run in new window. Detect Windows robustly and use yarn.cmd there to avoid the PS1 wrapper opening in an editor.
$runningOnWindows = $false
if ($env:OS -and $env:OS -eq 'Windows_NT') { $runningOnWindows = $true }
if ($runningOnWindows) {
    $cmd = "cd '$FrontendDir'; `$env:REACT_APP_BACKEND_URL='http://localhost:8000'; yarn.cmd start"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd
} else {
    $cmd = "cd '$FrontendDir' && REACT_APP_BACKEND_URL='http://localhost:8000' yarn start"
    Start-Process -FilePath "/bin/sh" -ArgumentList "-c", $cmd
}

Write-Host "[INFO] Frontend start issued in new window."
 
