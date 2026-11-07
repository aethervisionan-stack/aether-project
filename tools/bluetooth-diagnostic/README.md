# Diagnóstico Bluetooth (Windows)

Script rápido para quando o headset **não aparece** no pareamento Windows.

| Ficheiro | Função |
| --- | --- |
| `diagnostico_bluetooth.py` | Checks do adaptador + scan BLE + guia `Services.msc` |
| `requirements.txt` | Só `bleak` — **não** misturar com `backend/requirements.txt` |

## Windows (PowerShell ou cmd)

```bat
cd tools\bluetooth-diagnostic
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python diagnostico_bluetooth.py
```

Opções:

```bat
python diagnostico_bluetooth.py --scan-seconds 12
python diagnostico_bluetooth.py --skip-scan
```

O script imprime no ecrã os passos para verificar **Bluetooth Support Service** em `services.msc`.
