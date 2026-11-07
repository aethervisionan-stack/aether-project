#!/usr/bin/env python3
"""
Aether Vision — diagnóstico rápido de Bluetooth (Windows desktop).

Verifica se o adaptador local responde e faz um scan BLE de sinais próximos.
Imprime passos claros para confirmar o serviço "Bluetooth Support Service"
via Services.msc quando o headset não aparece para pareamento.

Uso (Windows):
  cd tools\\bluetooth-diagnostic
  python -m venv .venv
  .venv\\Scripts\\activate
  pip install -r requirements.txt
  python diagnostico_bluetooth.py
"""

from __future__ import annotations

import argparse
import asyncio
import platform
import subprocess
import sys
import time
from dataclasses import dataclass


BANNER = r"""
╔══════════════════════════════════════════════════════════════╗
║  Aether Vision — Diagnóstico Bluetooth (headset / Windows)   ║
╚══════════════════════════════════════════════════════════════╝
"""

SERVICES_MSC_GUIDE = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Windows — verificar "Bluetooth Support Service" (Services.msc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1) Pressione Win + R, digite:  services.msc  e Enter.
  2) Na lista, procure:  Bluetooth Support Service
     (nome interno: bthserv).
  3) Estado deve ser:  Em execução (Running).
  4) Tipo de inicialização:  Automático  ou  Manual
     (recomendado: Automático para headsets Aether Vision).
  5) Se estiver Parado:
       → clique com o botão direito → Iniciar
       → Propriedades → Tipo de inicialização → Automático → Aplicar
  6) Também confira estes serviços relacionados (se existirem):
       • Bluetooth User Support Service (bthudserv / BthAvctpSvc)
       • Device Association Service
  7) Depois: Definições → Bluetooth e dispositivos →
       ligue Bluetooth → Adicionar dispositivo → Bluetooth
       e coloque o headset em modo de emparelhamento.

  Atalho PowerShell (opcional, Admin):
    Get-Service bthserv | Format-List *
    Start-Service bthserv
    Set-Service bthserv -StartupType Automatic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def _run(cmd: list[str], timeout: float = 20.0) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError:
        return 127, "", f"comando não encontrado: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def check_windows_bthserv() -> CheckResult:
    """Query Bluetooth Support Service (bthserv) via `sc query`."""
    code, out, err = _run(["sc", "query", "bthserv"])
    blob = f"{out}\n{err}".upper()
    if code != 0 and ("FAILED" in blob or "1060" in blob or not out):
        return CheckResult(
            "Bluetooth Support Service (bthserv)",
            False,
            "serviço não encontrado ou inacessível — abra Services.msc e confirme o nome.",
        )
    running = "RUNNING" in blob
    detail = "RUNNING" if running else "NÃO está em execução (STOPPED / outro estado)"
    # Extract STATE line if present
    for line in out.splitlines():
        if "STATE" in line.upper():
            detail = line.strip()
            break
    return CheckResult("Bluetooth Support Service (bthserv)", running, detail)


def check_windows_radio_pnputil() -> CheckResult:
    """List Bluetooth-class PnP devices via PowerShell."""
    ps = (
        "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | "
        "Select-Object Status,FriendlyName,InstanceId | Format-Table -AutoSize | Out-String -Width 200"
    )
    code, out, err = _run(
        ["powershell", "-NoProfile", "-Command", ps],
        timeout=30.0,
    )
    if code != 0:
        return CheckResult(
            "Dispositivos PnP Bluetooth",
            False,
            err or out or "PowerShell Get-PnpDevice falhou",
        )
    text = out.strip() or "(nenhum dispositivo Bluetooth listado)"
    has_ok = "OK" in text.upper() or "RUNNING" in text.upper()
    # Any row usually means an adapter / radio stack is present
    has_rows = "BLUETOOTH" in text.upper() or "BTH" in text.upper() or len(text.splitlines()) > 3
    return CheckResult(
        "Dispositivos PnP Bluetooth",
        has_ok or has_rows,
        text[:1200],
    )


def check_windows_adapter_radio() -> CheckResult:
    """Best-effort: Bluetooth radio powered via WinRT / registry hints through PowerShell."""
    ps = r"""
$ErrorActionPreference = 'SilentlyContinue'
# Radio API (Win10+)
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  $null = [Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod })[0]
  Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
  }
  $radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
  $bt = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
  if (-not $bt) { 'NO_BT_RADIO'; return }
  $bt | ForEach-Object { "NAME=$($_.Name); STATE=$($_.State)" }
} catch {
  "RADIO_API_UNAVAILABLE: $($_.Exception.Message)"
}
"""
    code, out, err = _run(
        ["powershell", "-NoProfile", "-Command", ps],
        timeout=30.0,
    )
    text = (out or err or "").strip()
    if "NO_BT_RADIO" in text:
        return CheckResult(
            "Rádio Bluetooth (WinRT)",
            False,
            "Nenhum rádio Bluetooth detetado pela API WinRT — driver/adaptador ausente ou desligado.",
        )
    if "RADIO_API_UNAVAILABLE" in text or code != 0:
        return CheckResult(
            "Rádio Bluetooth (WinRT)",
            False,
            f"API de rádio indisponível ({text[:300]}). Use Definições → Bluetooth e Services.msc.",
        )
    on = "STATE=On" in text.replace(" ", "") or "STATE=ON" in text.upper()
    # WinRT State enum prints as On/Off
    on = on or "; STATE=On" in text or text.upper().endswith("ON") or "STATE=On" in text
    if "On" in text and "Off" not in text.split("STATE=")[-1][:6]:
        on = True
    # Simpler parse
    states = []
    for part in text.replace("\r", "").splitlines():
        if "STATE=" in part.upper():
            states.append(part.strip())
            if "ON" in part.upper().split("STATE=")[-1]:
                on = True
    detail = text[:500] if text else "sem saída"
    return CheckResult("Rádio Bluetooth (WinRT)", on or bool(states), detail)


async def bleak_adapter_and_scan(scan_seconds: float) -> tuple[CheckResult, CheckResult, list[str]]:
    """Check Bleak can see a BLE adapter and scan nearby advertisements."""
    lines: list[str] = []
    try:
        from bleak import BleakScanner
    except ImportError:
        msg = (
            "pacote 'bleak' não instalado. "
            "Execute: pip install -r requirements.txt  (nesta pasta tools/bluetooth-diagnostic)"
        )
        fail = CheckResult("Adaptador BLE (bleak)", False, msg)
        return fail, CheckResult("Scan BLE", False, "ignorado"), lines

    # Adapter presence: empty scan that throws often means no radio / powered off
    adapter_ok = True
    adapter_detail = "Bleak importado; a iniciar scan…"
    devices_found: list[str] = []

    def _detection_callback(device: object, advertisement_data: object) -> None:
        name = getattr(device, "name", None) or getattr(advertisement_data, "local_name", None) or "?"
        addr = getattr(device, "address", "?")
        rssi = getattr(advertisement_data, "rssi", None)
        entry = f"{addr}  rssi={rssi}  name={name}"
        if entry not in devices_found:
            devices_found.append(entry)

    try:
        scanner = BleakScanner(detection_callback=_detection_callback)
        await scanner.start()
        await asyncio.sleep(scan_seconds)
        await scanner.stop()
        adapter_detail = f"Scan BLE concluído ({scan_seconds:.0f}s) — adaptador respondeu."
    except Exception as exc:  # noqa: BLE001
        adapter_ok = False
        adapter_detail = (
            f"Falha ao aceder ao adaptador BLE: {type(exc).__name__}: {exc}. "
            "Bluetooth pode estar desligado, sem driver, ou bloqueado pelo SO."
        )
        return (
            CheckResult("Adaptador BLE (bleak)", False, adapter_detail),
            CheckResult("Scan BLE", False, "scan não iniciado"),
            lines,
        )

    for entry in devices_found:
        lines.append(entry)

    scan_ok = True  # adapter responded even if zero devices
    scan_detail = (
        f"{len(devices_found)} anúncio(s) BLE detetado(s)."
        if devices_found
        else (
            "0 anúncios BLE. Normal se só houver headsets Classic (não BLE) "
            "ou se estiverem desligados / fora de modo de emparelhamento."
        )
    )
    return (
        CheckResult("Adaptador BLE (bleak)", adapter_ok, adapter_detail),
        CheckResult("Scan BLE", scan_ok, scan_detail),
        lines,
    )


def print_result(result: CheckResult) -> None:
    mark = "OK " if result.ok else "!! "
    print(f"\n[{mark}] {result.name}")
    for line in result.detail.splitlines() or [result.detail]:
        print(f"      {line}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Diagnóstico Bluetooth Aether Vision (Windows)")
    p.add_argument(
        "--scan-seconds",
        type=float,
        default=8.0,
        help="Duração do scan BLE em segundos (default: 8)",
    )
    p.add_argument(
        "--skip-scan",
        action="store_true",
        help="Só verifica serviços/adaptador; não faz scan BLE",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    print(BANNER)
    system = platform.system()
    print(f"Sistema: {system} | Python: {platform.python_version()} | {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Pasta do script: {__file__}")

    results: list[CheckResult] = []

    if system == "Windows":
        print("\n→ A verificar serviço Windows e rádio local…")
        results.append(check_windows_bthserv())
        results.append(check_windows_adapter_radio())
        results.append(check_windows_radio_pnputil())
    else:
        print(
            f"\nNota: este diagnóstico é otimizado para Windows. "
            f"Em {system} só corre o scan BLE (bleak)."
        )

    scan_lines: list[str] = []
    if args.skip_scan:
        results.append(CheckResult("Scan BLE", True, "ignorado (--skip-scan)"))
    else:
        print(f"\n→ Scan BLE (~{args.scan_seconds:.0f}s) — aproxime o headset emparelhável…")
        adapter_res, scan_res, scan_lines = asyncio.run(bleak_adapter_and_scan(args.scan_seconds))
        results.append(adapter_res)
        results.append(scan_res)

    print("\n──────── Resultados ────────")
    for r in results:
        print_result(r)

    if scan_lines:
        print("\nSinais BLE próximos:")
        for line in scan_lines[:40]:
            print(f"  • {line}")
        if len(scan_lines) > 40:
            print(f"  … +{len(scan_lines) - 40} mais")

    print(SERVICES_MSC_GUIDE)

    # Exit code: 0 if adapter-ish checks mostly ok; 1 if clear failure
    critical_fail = any(
        (not r.ok) and r.name.startswith(("Bluetooth Support", "Adaptador BLE", "Rádio Bluetooth"))
        for r in results
    )
    if critical_fail:
        print(
            "Conclusão: há um problema no adaptador/serviço Bluetooth local. "
            "Siga o guia Services.msc acima e confirme Bluetooth ligado nas Definições Windows "
            "antes de tentar parear o headset Aether Vision.\n"
        )
        return 1

    print(
        "Conclusão: o stack Bluetooth local respondeu. Se o headset ainda não aparece, "
        "ponha-o em modo de emparelhamento, reinicie bthserv, e use "
        "Definições → Bluetooth → Adicionar dispositivo. "
        "Headsets Classic podem não surgir no scan BLE — isso é esperado.\n"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelado.")
        raise SystemExit(130) from None
