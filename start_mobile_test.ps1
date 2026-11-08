#Requires -Version 5.1
<#
.SYNOPSIS
  Arranca API + HUD Vite em 0.0.0.0 e abre um túnel HTTPS temporário para teste no telemóvel.

.DESCRIPTION
  Pré-requisitos (iguais a start_dev.ps1):
    - backend\.venv  (Python 3.11+)
    - backend\.env com GEMINI_API_KEY preenchida (valor nunca é impresso)
    - client\ com dependências npm
    - Node.js / npx (localtunnel) — ou ngrok no PATH

  Serviços:
    1) FastAPI/Uvicorn  → http://127.0.0.1:8001  (só local; proxy Vite)
    2) Vite HUD         → http://0.0.0.0:5173    (LAN Wi-Fi)
    3) Túnel HTTPS      → localtunnel (preferido) ou ngrok → porta 5173

  No telemóvel use o URL HTTPS do túnel (getUserMedia exige contexto seguro).
  Em Wi-Fi local, http://<ip-lan>:5173 NÃO permite microfone (exceto localhost).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\start_mobile_test.ps1
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$ApiHost = "127.0.0.1"
$ApiPort = 8001
$ViteBind = "0.0.0.0"
$VitePort = 5173
$ApiBase = "http://${ApiHost}:${ApiPort}"
$ViteLoopback = "http://127.0.0.1:${VitePort}"

$VenvPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
$BackendDir = Join-Path $Root "backend"
$BackendEnv = Join-Path $BackendDir ".env"
$ClientDir = Join-Path $Root "client"
$TunnelLog = Join-Path $env:TEMP "aether-mobile-tunnel-$VitePort.log"

function Test-TcpListen {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Get-ListenAddresses {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return @() }
    return @($conns | Select-Object -ExpandProperty LocalAddress -Unique)
}

function Test-ViteLanReady {
    $addrs = Get-ListenAddresses -Port $VitePort
    if (-not $addrs) { return $false }
    # 0.0.0.0 / :: accept LAN; 127.0.0.1 alone is desktop-only
    foreach ($a in $addrs) {
        if ($a -eq "0.0.0.0" -or $a -eq "::") { return $true }
        if ($a -ne "127.0.0.1" -and $a -ne "::1") { return $true }
    }
    return $false
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

function Get-LanIPv4 {
    try {
        $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -notlike "127.*" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.PrefixOrigin -ne "WellKnown"
            } |
            Sort-Object -Property InterfaceMetric, PrefixLength
        if ($candidates) {
            return $candidates[0].IPAddress
        }
    } catch { }
    try {
        $entry = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName())
        $ipv4 = $entry.AddressList |
            Where-Object { $_.AddressFamily -eq "InterNetwork" -and $_.ToString() -notlike "127.*" } |
            Select-Object -First 1
        if ($ipv4) { return $ipv4.ToString() }
    } catch { }
    return $null
}

function Test-GeminiApiKeyInEnvFile {
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
        return $false
    }

    $raw = ($match -split '=', 2)[1]
    if ($null -eq $raw) { $raw = "" }
    $value = $raw.Trim().Trim('"').Trim("'")

    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "ERROR: GEMINI_API_KEY está vazia em backend\.env." -ForegroundColor Red
        Write-Host "  Preencha GEMINI_API_KEY=... (valor nunca é exibido por este script)." -ForegroundColor Yellow
        return $false
    }

    Write-Host "GEMINI_API_KEY: configurada (valor oculto)" -ForegroundColor Green
    return $true
}

function Find-NgrokCommand {
    $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $local = Join-Path $Root "tools\ngrok.exe"
    if (Test-Path $local) { return $local }
    return $null
}

function Start-LocalTunnelWindow {
    param([int]$Port, [string]$LogPath)

    if (Test-Path $LogPath) { Remove-Item $LogPath -Force -ErrorAction SilentlyContinue }

    $ngrok = Find-NgrokCommand
    if ($ngrok) {
        Write-Host "Túnel: ngrok encontrado — a expor :$Port ..." -ForegroundColor Cyan
        $tunnelCmd = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$Root'
Write-Host 'Aether Vision túnel ngrok — porta $Port (Ctrl+C para parar)' -ForegroundColor Cyan
& '$ngrok' http $Port --log=stdout 2>&1 | Tee-Object -FilePath '$LogPath'
"@
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $tunnelCmd
        ) | Out-Null
        return "ngrok"
    }

    Write-Host "Túnel: localtunnel via npx — a expor :$Port ..." -ForegroundColor Cyan
    $tunnelCmd = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$Root'
Write-Host 'Aether Vision túnel localtunnel — porta $Port (Ctrl+C para parar)' -ForegroundColor Cyan
npx --yes localtunnel --port $Port 2>&1 | Tee-Object -FilePath '$LogPath'
"@
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $tunnelCmd
    ) | Out-Null
    return "localtunnel"
}

function Wait-TunnelHttpsUrl {
    param(
        [string]$LogPath,
        [string]$Tool,
        [int]$TimeoutSec = 75
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $LogPath) {
            $text = Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue
            if ($text) {
                if ($Tool -eq "ngrok") {
                    # ngrok v3 log: url=https://....ngrok-free.app
                    if ($text -match 'url=(https://[a-zA-Z0-9.-]+\.ngrok[^\s"'']*)') {
                        return $Matches[1].TrimEnd("/", ",", '"', "'")
                    }
                    if ($text -match '(https://[a-zA-Z0-9-]+\.ngrok-free\.app)') {
                        return $Matches[1]
                    }
                    if ($text -match '(https://[a-zA-Z0-9-]+\.ngrok\.io)') {
                        return $Matches[1]
                    }
                } else {
                    # localtunnel: "your url is: https://....loca.lt"
                    if ($text -match '(https://[a-zA-Z0-9-]+\.loca\.lt)') {
                        return $Matches[1]
                    }
                    if ($text -match 'your url is:\s*(https://\S+)') {
                        return $Matches[1].Trim()
                    }
                }
            }
        }
        Start-Sleep -Milliseconds 800
    }
    return $null
}

# --- Pré-checagens -----------------------------------------------------------

Write-Host ""
Write-Host "Aether Vision — teste mobile (LAN + túnel HTTPS)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: backend\.venv não encontrado. Crie com Python 3.11+ primeiro:" -ForegroundColor Red
    Write-Host "  py -3.11 -m venv backend\.venv"
    Write-Host "  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
    exit 1
}

if (-not (Test-GeminiApiKeyInEnvFile -EnvPath $BackendEnv)) {
    exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $node -or -not $npx) {
    Write-Host "ERROR: Node.js / npx necessários para Vite e localtunnel." -ForegroundColor Red
    Write-Host "  Instale Node LTS e reabra o terminal." -ForegroundColor Yellow
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

# --- Backend :8001 (loopback — Vite faz proxy /api) --------------------------
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

# --- Vite :5173 em 0.0.0.0 ---------------------------------------------------
$viteLanReady = $false
if ((Test-HttpOk -Url "$ViteLoopback/" -TimeoutSec 2) -and (Test-ViteLanReady)) {
    Write-Host "Reutilizando Vite já em LAN ($ViteBind :$VitePort)" -ForegroundColor Green
    $viteLanReady = $true
} else {
    if (Test-TcpListen -Port $VitePort) {
        Write-Host "Vite em :$VitePort não está em 0.0.0.0 (ou UI falhou) — reiniciando para LAN." -ForegroundColor Yellow
        Stop-ListenersOnPort -Port $VitePort
    }
    Write-Host "Iniciando Vite (HUD) em ${ViteBind}:${VitePort} numa nova janela..." -ForegroundColor Green
    $clientCmd = @"
Set-Location '$ClientDir'
Write-Host 'Aether Vision HUD — http://0.0.0.0:$VitePort (LAN)  (Ctrl+C para parar)' -ForegroundColor Cyan
npm run dev -- --host $ViteBind --port $VitePort --strictPort
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
$viteReady = Wait-HttpOk -Url "$ViteLoopback/" -Label "Vite HUD" -TimeoutSec 60

if (-not ($apiReady -and $viteReady)) {
    Write-Host ""
    Write-Host "Stack não ficou totalmente pronto. Veja as janelas dos serviços." -ForegroundColor Red
    exit 1
}

if (-not (Test-ViteLanReady)) {
    Write-Host "AVISO: Vite pode não estar a escutar em 0.0.0.0 — confira a janela do Vite." -ForegroundColor Yellow
}

$lanIp = Get-LanIPv4
$lanUrl = if ($lanIp) { "http://${lanIp}:${VitePort}" } else { "(IP LAN não detetado):${VitePort}" }

# --- Túnel HTTPS -------------------------------------------------------------
$tunnelTool = Start-LocalTunnelWindow -Port $VitePort -LogPath $TunnelLog
Write-Host "Aguardando URL HTTPS do túnel ($tunnelTool)..." -ForegroundColor Yellow
$tunnelUrl = Wait-TunnelHttpsUrl -LogPath $TunnelLog -Tool $tunnelTool -TimeoutSec 90

Write-Host ""
Write-Host "Pronto para telemóvel:" -ForegroundColor Green
Write-Host "  API (PC)     $ApiBase/health"
Write-Host "  HUD loopback $ViteLoopback/"
Write-Host "  HUD LAN      $lanUrl"
if ($tunnelUrl) {
    Write-Host "  Túnel HTTPS  $tunnelUrl/" -ForegroundColor Green
} else {
    Write-Host "  Túnel HTTPS  (ainda não detetado — veja a janela do túnel / $TunnelLog)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Microfone no telemóvel:" -ForegroundColor Cyan
Write-Host "  Use o URL HTTPS do túnel (getUserMedia exige HTTPS ou localhost)."
Write-Host "  O URL LAN http://... NÃO abre o microfone no browser do telemóvel."
if ($tunnelTool -eq "localtunnel") {
    Write-Host "  Nota localtunnel: a página de password pede o IP público do PC (não o IP LAN)."
}
Write-Host "  API no telemóvel vai por /api no Vite (proxy → 127.0.0.1:8001) — sem CORS no telemóvel."
Write-Host ""
Write-Host "Uso:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File .\start_mobile_test.ps1"
Write-Host "Feche as janelas API / Vite / túnel para parar o stack."
exit 0
