<#
Script: start-mongo.ps1
Purpose: pull and run local MongoDB container for development (skipay-mongo)
Usage: .\scripts\start-mongo.ps1
#>
param(
    [string]$ContainerName = "skipay-mongo",
    [int]$Port = 27017,
    [string]$RootUser = "admin",
    [string]$RootPass = "pass"
)

function Check-Docker {
    try {
        docker version | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (-not (Check-Docker)) {
    Write-Error "Docker does not appear to be installed or running. Please install/start Docker Desktop and retry."
    exit 1
}

# Check if container already exists
$existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
if ($existing -eq $ContainerName) {
    Write-Host "Container '$ContainerName' already exists. Starting it..."
    docker start $ContainerName | Out-Null
    Write-Host "Container started. MongoDB should be available on port $Port"
    exit 0
}

Write-Host "Pulling latest mongo image and starting container '$ContainerName' on port $Port..."
docker run -d --name "${ContainerName}" -p "${Port}:27017" -e "MONGO_INITDB_ROOT_USERNAME=${RootUser}" -e "MONGO_INITDB_ROOT_PASSWORD=${RootPass}" mongo:6 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start MongoDB container. Check Docker logs for details."
    exit 1
}

Write-Host "MongoDB container '$ContainerName' started. Connection string: mongodb://${RootUser}:${RootPass}@localhost:${Port}"
