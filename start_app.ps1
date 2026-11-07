#Requires -Version 5.1
<#
.SYNOPSIS
  Start Aether Vision voice stack for local Bluetooth tests (Windows).

.DESCRIPTION
  1) FastAPI/Uvicorn on http://127.0.0.1:8000  (backend\.venv, Python 3.11.9)
  2) Vite client on http://127.0.0.1:5173
  3) Opens the control UI in the default browser

  Each service runs in its own PowerShell window so both stay up.
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$VenvPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
$BackendDir = Join-Path $Root "backend"
$ClientDir = Join-Path $Root "client"

if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: backend\.venv not found. Create it with Python 3.11.9 first:" -ForegroundColor Red
    Write-Host "  py -3.11 -m venv backend\.venv"
    Write-Host "  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
    exit 1
}

$pyVer = & $VenvPython --version 2>&1
Write-Host "Using $pyVer ($VenvPython)" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $ClientDir "package.json"))) {
    Write-Host "ERROR: client\package.json missing." -ForegroundColor Red
    exit 1
}

# Ensure npm deps once (idempotent)
Push-Location $ClientDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing client npm dependencies..." -ForegroundColor Yellow
        npm install
    }
} finally {
    Pop-Location
}

Write-Host "Starting Uvicorn (backend) in a new window..." -ForegroundColor Green
$backendCmd = @"
Set-Location '$BackendDir'
Write-Host 'Aether Vision API — http://127.0.0.1:8000  (Ctrl+C to stop)' -ForegroundColor Cyan
& '$VenvPython' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"@
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $backendCmd
)

Start-Sleep -Seconds 1

Write-Host "Starting Vite (client) in a new window..." -ForegroundColor Green
$clientCmd = @"
Set-Location '$ClientDir'
Write-Host 'Aether Vision Client — http://127.0.0.1:5173  (Ctrl+C to stop)' -ForegroundColor Cyan
npm run dev
"@
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $clientCmd
)

Write-Host "Waiting for Vite, then opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5173/"

Write-Host ""
Write-Host "Ready:" -ForegroundColor Green
Write-Host "  API     http://127.0.0.1:8000/health"
Write-Host "  Client  http://127.0.0.1:5173/"
Write-Host "  Fill OPENAI_API_KEY in backend\.env for real Whisper / gpt-4o-mini / TTS."
Write-Host "Close the two service windows to stop the stack."
