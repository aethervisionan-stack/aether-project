# Guia rápido — fone Bluetooth (M100 / Hands-Free)

Use isto quando o Aether Vision não encontra o microfone do fone, ou quando o áudio morre depois de o Bluetooth desconectar.

O Windows publica o **mesmo** fone como dois endpoints:

| Perfil | Label típico | Serve para |
| --- | --- | --- |
| Hands-Free / AG Audio (HFP/HSP) | `Headset (M100 Hands-Free AG Audio)` | Microfone. É o único que `getUserMedia` consegue abrir. Mono, faixa estreita. |
| A2DP Stereo | `Headphones (M100 Stereo)` | Só reprodução. Não tem microfone. |

Se o painel de diagnóstico mostrar saída A2DP e nenhuma entrada Hands-Free, o browser vai recusar a captura.

## HUD

1. Abra o client em `localhost` (contexto seguro) ou no telemóvel via `.\start_mobile_test.ps1` (túnel HTTPS + QR; prefere cloudflared).
2. No painel **Diagnóstico de áudio**, confira `label`, `deviceId`, `groupId` e o perfil.
3. A entrada e a saída do mesmo fone partilham o `groupId`. A linha que interessa para gravar é **Entrada** + **Hands-Free / AG Audio (HFP/HSP)**.
4. Labels vazios significam que o site ainda não tem permissão de microfone. Conceda e volte a enumerar.
5. **Forçar Re-enumeração / Reset Audio Context** fecha um `AudioContext` em `suspended` ou `interrupted` (comum depois de o fone cair) e chama `enumerateDevices()` de novo.
6. A lista **Falhas de getUserMedia** e o console (`[aether:audio]`) mostram o `DOMException` exato.

## Terminal (adaptador não aparece no pareamento)

```bat
cd tools\bluetooth-diagnostic
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python diagnostico_bluetooth.py
```

O script verifica o adaptador e imprime os passos do `services.msc` para o **Bluetooth Support Service** (`bthserv`). Atalho, em PowerShell como administrador:

```powershell
Get-Service bthserv | Format-List Status,StartType,Name
Start-Service bthserv
Set-Service bthserv -StartupType Automatic
```

## Windows (fone pareado, mas o browser não captura)

1. **Definições → Bluetooth e dispositivos**: M100 com estado ligado.
2. **Painel de Controlo → Som → Gravação**: o endpoint Hands-Free do M100 como dispositivo de comunicação predefinido. Botão direito → **Propriedades → Avançado** → desmarcar *Permitir que as aplicações assumam o controlo exclusivo deste dispositivo*.
3. **Reprodução**: deixe o **Stereo (A2DP)** para ouvir a resposta em alta qualidade. O Hands-Free também reproduz, mas em banda estreita — use-o só se quiser o mesmo perfil na ida e na volta.
4. Se o perfil ficar preso: desconectar o fone, **Remover dispositivo**, parear de novo, e carregar no reset do AudioContext no HUD.
5. Feche Teams, Discord e Zoom antes do teste. Eles seguram o HFP em exclusivo e o Chrome devolve `NotReadableError` (`Could not start audio source`).

## Browser

- Microfone só funciona em `http://localhost` ou HTTPS (use o túnel do `start_mobile_test.ps1` no telemóvel; `http://IP-LAN` não basta).
- Cadeado da barra de endereço → Microfone → Permitir.
- Chrome: `chrome://settings/content/microphone` — o site não pode estar em bloqueio, e o dispositivo predefinido não deve ser um endpoint só de saída.
- Depois de mudar o dispositivo no SO, use **Reconectar / Retry** ou o botão de re-enumeração. Não é preciso recarregar a página; se a permissão foi negada, o HUD cai para Safe Mode (Web Speech).

## O que cada recusa significa

| `DOMException` | O SO / browser está a dizer | O que fazer |
| --- | --- | --- |
| `NotFoundError`, `DevicesNotFoundError` | Não há `audioinput` que satisfaça o pedido. O M100 está só em A2DP, desligado, ou sem permissão (lista vazia). | Parear, ligar o perfil Hands-Free, re-enumerar. |
| `NotReadableError` | O dispositivo existe, mas o driver recusou abrir (exclusivo, perfil morto, outro processo). | Fechar apps de voz, desligar modo exclusivo, re-parear, reset do AudioContext. |
| `OverconstrainedError` | `deviceId` exact, `channelCount` ou o processamento (AEC/NS/AGC) não cabem neste HFP. O client tenta outra vez sem `deviceId` exact. | Se repetir, o id Bluetooth expirou — re-enumerar e gravar de novo. |
| `NotAllowedError` | Permissão negada ou dismiss do prompt. | Permitir o site, ou usar Safe Mode. |
