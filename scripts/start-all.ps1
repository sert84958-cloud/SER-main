# Start all services helper
# Usage: run from repository root: .\scripts\start-all.ps1
Write-Host "[INFO] Starting all services: MongoDB -> Backend -> Frontend"

Write-Host "[INFO] Starting MongoDB (Docker)..."
& "$PSScriptRoot\start-mongo.ps1"

Write-Host "[INFO] Starting backend..."
& "$PSScriptRoot\start-backend.ps1"

Write-Host "[INFO] Opening frontend in a new PowerShell window..."
Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File', "$PSScriptRoot\\run-frontend-window.ps1"

Write-Host "[INFO] All start commands issued. Check frontend at http://localhost:3000 and backend at http://localhost:8000/docs"
