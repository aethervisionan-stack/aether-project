#Requires -Version 5.1
<#
.SYNOPSIS
  Atalho legado — encaminha para start_dev.ps1 (stack unificado).

.DESCRIPTION
  Preferência: .\start_dev.ps1
  Mantido para compatibilidade com start_app.bat e docs antigas.
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartDev = Join-Path $Root "start_dev.ps1"

if (-not (Test-Path $StartDev)) {
    Write-Host "ERROR: start_dev.ps1 não encontrado em $Root" -ForegroundColor Red
    exit 1
}

& $StartDev
exit $LASTEXITCODE
