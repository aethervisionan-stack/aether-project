#Requires -Version 5.1
<#
.SYNOPSIS
  Arranca o stack local Aether Vision (API + HUD Vite) num só comando.

.DESCRIPTION
  Pré-requisitos:
    - backend\.venv  (Python 3.11+)
    - backend\.env com GEMINI_API_KEY preenchida (valor nunca é impresso)
    - client\ com dependências npm

  Serviços:
    1) FastAPI/Uvicorn  → http://127.0.0.1:8001
    2) Vite HUD         → http://127.0.0.1:5173  (strictPort)
    3) Abre o HUD no browser padrão

  Reutiliza listeners saudáveis em :8001 / :5173; libera portas ocupadas por
  processos stale/foreign. Cada serviço novo abre numa janela PowerShell própria.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\start_dev.ps1

.EXAMPLE
  .\start_dev.ps1
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
$BackendEnv = Join-Path $BackendDir ".env"
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
    Write-Host "  FAIL  $Label não ficou pronto ($Url)" -ForegroundColor Red
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
            Write-Host "Parando PID $procId ($($proc.ProcessName)) na porta $Port..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            Write-Host "Não foi possível parar PID $procId na porta ${Port}: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 1
}

function Test-GeminiApiKeyInEnvFile {
    <#
      Lê backend\.env e confirma que GEMINI_API_KEY existe e não está vazia.
      Nunca imprime o valor da chave.
    #>
    param([string]$EnvPath)

    if (-not (Test-Path $EnvPath)) {
        Write-Host "ERROR: backend\.env não encontrado." -ForegroundColor Red
        Write-Host "  Copie o exemplo e preencha a chave:" -ForegroundColor Yellow
        Write-Host "    Copy-Item backend\.env.example backend\.env"
        Write-Host "    # edite backend\.env → GEMINI_API_KEY=..."
        return $false
    }

    $match = Get-Content -Path $EnvPath -ErrorAction Stop |
        Where-Object { $_ -match '^\s*GEMINI_API_KEY\s*=' } |
        Select-Object -First 1

    if (-not $match) {
        Write-Host "ERROR: GEMINI_API_KEY ausente em backend\.env." -ForegroundColor Red
        Write-Host "  Adicione uma linha: GEMINI_API_KEY=sua_chave  (sem aspas)." -ForegroundColor Yellow
        Write-Host "  Obtenha em https://aistudio.google.com/apikey" -ForegroundColor Yellow
        return $false
    }

    $raw = ($match -split '=', 2)[1]
    if ($null -eq $raw) { $raw = "" }
    $value = $raw.Trim().Trim('"').Trim("'")

    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "ERROR: GEMINI_API_KEY está vazia em backend\.env." -ForegroundColor Red
        Write-Host "  Preencha GEMINI_API_KEY=... (valor nunca é exibido por este script)." -ForegroundColor Yellow
        Write-Host "  Obtenha em https://aistudio.google.com/apikey" -ForegroundColor Yellow
        return $false
    }

    Write-Host "GEMINI_API_KEY: configurada (valor oculto)" -ForegroundColor Green
    return $true
}

# --- Pré-checagens -----------------------------------------------------------

if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: backend\.venv não encontrado. Crie com Python 3.11+ primeiro:" -ForegroundColor Red
    Write-Host "  py -3.11 -m venv backend\.venv"
    Write-Host "  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
    exit 1
}

if (-not (Test-GeminiApiKeyInEnvFile -EnvPath $BackendEnv)) {
    exit 1
}

$pyVer = & $VenvPython --version 2>&1
Write-Host "Usando $pyVer ($VenvPython)" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $ClientDir "package.json"))) {
    Write-Host "ERROR: client\package.json ausente." -ForegroundColor Red
    exit 1
}

Push-Location $ClientDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Instalando dependências npm do client..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: npm install falhou." -ForegroundColor Red
            exit 1
        }
    }
} finally {
    Pop-Location
}

# --- Backend :8001 -----------------------------------------------------------
$apiHealthy = Test-ApiStackHealthy
if ($apiHealthy) {
    Write-Host "Reutilizando API já saudável em $ApiBase" -ForegroundColor Green
} else {
    if (Test-TcpListen -Port $ApiPort) {
        Write-Host "Porta $ApiPort ocupada por processo stale/foreign — liberando." -ForegroundColor Yellow
        Stop-ListenersOnPort -Port $ApiPort
    }
    Write-Host "Iniciando Uvicorn (backend) numa nova janela..." -ForegroundColor Green
    $backendCmd = @"
Set-Location '$BackendDir'
Write-Host 'Aether Vision API — $ApiBase  (Ctrl+C para parar)' -ForegroundColor Cyan
& '$VenvPython' -m uvicorn app.main:app --reload --host $ApiHost --port $ApiPort
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $backendCmd
    )
}

# --- Vite :5173 --------------------------------------------------------------
$viteHealthy = Test-HttpOk -Url "$ViteBase/" -TimeoutSec 2
if ($viteHealthy) {
    Write-Host "Reutilizando Vite saudável em $ViteBase" -ForegroundColor Green
} else {
    if (Test-TcpListen -Port $VitePort) {
        Write-Host "Porta $VitePort ocupada mas UI falhou — liberando." -ForegroundColor Yellow
        Stop-ListenersOnPort -Port $VitePort
    }
    Write-Host "Iniciando Vite (client/HUD) numa nova janela..." -ForegroundColor Green
    $clientCmd = @"
Set-Location '$ClientDir'
Write-Host 'Aether Vision HUD — $ViteBase  (Ctrl+C para parar)' -ForegroundColor Cyan
npm run dev -- --host $ApiHost --port $VitePort --strictPort
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", $clientCmd
    )
}

Write-Host "Aguardando API + Vite..." -ForegroundColor Yellow
$apiDeadline = (Get-Date).AddSeconds(60)
$apiReady = $false
while ((Get-Date) -lt $apiDeadline) {
    if (Test-ApiStackHealthy) {
        Write-Host "  OK  API /health + history" -ForegroundColor Green
        $apiReady = $true
        break
    }
    Start-Sleep -Milliseconds 700
}
if (-not $apiReady) {
    Write-Host "  FAIL  API (precisa /health e /api/history ou /history)" -ForegroundColor Red
}
$viteReady = Wait-HttpOk -Url "$ViteBase/" -Label "Vite HUD" -TimeoutSec 60

if (-not ($apiReady -and $viteReady)) {
    Write-Host ""
    Write-Host "Stack não ficou totalmente pronto. Veja as janelas dos serviços." -ForegroundColor Red
    exit 1
}

Write-Host "Abrindo HUD no browser..." -ForegroundColor Yellow
Start-Process "$ViteBase/"

Write-Host ""
Write-Host "Pronto:" -ForegroundColor Green
Write-Host "  API      $ApiBase/health"
Write-Host "  History  $ApiBase/api/history"
Write-Host "  Metrics  $ApiBase/api/metrics"
Write-Host "  HUD      $ViteBase/"
Write-Host ""
Write-Host "Uso:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\start_dev.ps1"
Write-Host "  (atalho legado: .\start_app.ps1 / start_app.bat → este mesmo fluxo)"
Write-Host "Feche as janelas dos serviços (ou rode de novo) para gerir o stack."
exit 0
