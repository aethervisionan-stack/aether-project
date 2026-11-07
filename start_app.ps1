#Requires -Version 5.1
<#
.SYNOPSIS
  Start Aether Vision voice stack for local Bluetooth tests (Windows).

.DESCRIPTION
  1) FastAPI/Uvicorn on http://127.0.0.1:8001  (backend\.venv, Python 3.11.9)
  2) Vite client on http://127.0.0.1:5173 (strictPort — no silent hop)
  3) Opens the control UI once both endpoints respond

  Reuses healthy listeners already on :8001 / :5173 instead of spawning duplicates.
  Each newly started service runs in its own PowerShell window.
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$ApiHost = "127.0.0.1"
$ApiPort = 8001
$VitePort = 5173
$ApiBase = "http://${ApiHost}:${ApiPort}"
$ViteBase = "http://${ApiHost}:${VitePort}"

$VenvPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
$BackendDir = Join-Path $Root "backend"
$ClientDir = Join-Path $Root "client"

function Test-TcpListen {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 2
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Test-ApiStackHealthy {
    # Require current Phase-1 surface (health + session history), not a stale Uvicorn.
    if (-not (Test-HttpOk -Url "$ApiBase/health" -TimeoutSec 2)) {
        return $false
    }
    if (Test-HttpOk -Url "$ApiBase/api/history?limit=1" -TimeoutSec 2) {
        return $true
    }
    if (Test-HttpOk -Url "$ApiBase/history?limit=1" -TimeoutSec 2) {
        return $true
    }
    return $false
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSec = 45
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url $Url -TimeoutSec 2) {
            Write-Host "  OK  $Label" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 700
    }
    Write-Host "  FAIL  $Label did not become ready ($Url)" -ForegroundColor Red
    return $false
}

function Stop-ListenersOnPort {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return }
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "Stopping PID $procId ($($proc.ProcessName)) on port $Port..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Host "Could not stop PID $procId on port ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 1
}

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
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: npm install failed." -ForegroundColor Red
            exit 1
        }
    }
} finally {
    Pop-Location
}

# --- Backend :8001 ---
$apiHealthy = Test-ApiStackHealthy
if ($apiHealthy) {
    Write-Host "Reusing current API stack already on $ApiBase" -ForegroundColor Green
} else {
    if (Test-TcpListen -Port $ApiPort) {
        Write-Host "Port $ApiPort is occupied by a stale/foreign process — freeing it." -ForegroundColor Yellow
        Stop-ListenersOnPort -Port $ApiPort
    }
    Write-Host "Starting Uvicorn (backend) in a new window..." -ForegroundColor Green
    $backendCmd = @"
Set-Location '$BackendDir'
Write-Host 'Aether Vision API — $ApiBase  (Ctrl+C to stop)' -ForegroundColor Cyan
& '$VenvPython' -m uvicorn app.main:app --reload --host $ApiHost --port $ApiPort
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $backendCmd
    )
}

# --- Vite :5173 ---
$viteHealthy = Test-HttpOk -Url "$ViteBase/" -TimeoutSec 2
if ($viteHealthy) {
    Write-Host "Reusing healthy Vite already on $ViteBase" -ForegroundColor Green
} else {
    if (Test-TcpListen -Port $VitePort) {
        Write-Host "Port $VitePort is occupied but UI failed — freeing it." -ForegroundColor Yellow
        Stop-ListenersOnPort -Port $VitePort
    }
    Write-Host "Starting Vite (client) in a new window..." -ForegroundColor Green
    $clientCmd = @"
Set-Location '$ClientDir'
Write-Host 'Aether Vision Client — $ViteBase  (Ctrl+C to stop)' -ForegroundColor Cyan
npm run dev -- --host $ApiHost --port $VitePort --strictPort
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $clientCmd
    )
}

Write-Host "Waiting for API + Vite..." -ForegroundColor Yellow
$apiDeadline = (Get-Date).AddSeconds(60)
$apiReady = $false
while ((Get-Date) -lt $apiDeadline) {
    if (Test-ApiStackHealthy) {
        Write-Host "  OK  API /health + /api/history" -ForegroundColor Green
        $apiReady = $true
        break
    }
    Start-Sleep -Milliseconds 700
}
if (-not $apiReady) {
    Write-Host "  FAIL  API stack (need /health and /api/history)" -ForegroundColor Red
}
$viteReady = Wait-HttpOk -Url "$ViteBase/" -Label "Vite UI" -TimeoutSec 60

if (-not ($apiReady -and $viteReady)) {
    Write-Host ""
    Write-Host "Stack did not become fully ready. Check the service windows for errors." -ForegroundColor Red
    exit 1
}

Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "$ViteBase/"

Write-Host ""
Write-Host "Ready:" -ForegroundColor Green
Write-Host "  API      $ApiBase/health"
Write-Host "  History  $ApiBase/api/history"
Write-Host "  Metrics  $ApiBase/api/metrics"
Write-Host "  Client   $ViteBase/"
Write-Host "  Fill OPENAI_API_KEY in backend\.env for real Whisper / gpt-4o-mini / TTS."
Write-Host "Close the service windows (or re-run this script) to manage the stack."
exit 0
