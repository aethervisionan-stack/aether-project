# Aether Vision

Repositório monólito da **Aether Vision**: landing Next.js (raiz) + **Phase 1 MVP** do assistente de voz para headsets Bluetooth genéricos.

| Pasta | Função |
| --- | --- |
| `app/`, `components/`, `lib/` | Landing / pré-venda Next.js (já existente) |
| `backend/` | API FastAPI — STT (Whisper), Consenso Alfa, TTS |
| `client/` | UI de controle TypeScript (captura + playback no headset) |

## Arquitetura do pipeline de voz (Phase 1)

```
Headset BT mic → client/ (MediaRecorder)
               → POST /process-audio
               → STT (Whisper pluggable / mock)
               → ResponseAgent (rascunho)
               → Consenso Alfa (quórum multi-agente)
               → TTS (alta fidelidade / mock WAV)
               → áudio base64 → client/ → fones BT
```

**Consenso Alfa** valida o rascunho *antes* da síntese de voz, reduzindo alucinações com agentes de grounding, segurança/tom e consistência. Interfaces (`ValidatorAgent`) permitem trocar heurísticas por LLMs / atestações DePIN depois, sem acoplar crypto nesta fase.

Seams futuros (env declaradas, não usadas): `SOLANA_RPC_URL`, `AETHER_AGENT_WALLET`, `DEPLOYMENT_NETWORK` e `meta.depin_attestation` na resposta.

---

## Teste local integrado com headset Bluetooth

Guia passo a passo (modo **mock** — sem modelos pesados nem chaves pagas).

### 0. Pré-requisitos

- Python **3.11+**
- Node.js **20+** (o client Vite; a landing usa 26.x)
- Headset Bluetooth genérico pareado no SO como microfone **e** saída de áudio
- Navegador Chromium/Chrome ou Edge (MediaRecorder + `getUserMedia`)

### 1. Backend FastAPI

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # USE_MOCK_AUDIO=true por padrão
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Confira: [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health) e docs em [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs).

### 2. Client de controle

Em outro terminal:

```bash
cd client
npm install
cp .env.example .env               # VITE_API_BASE_URL vazio → proxy /api → :8001
npm run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173).

### 3. Teste com o headset

1. Pareie o fone Bluetooth no sistema e defina-o como dispositivo de **entrada** e **saída** padrão.
2. No client, clique em **Listar microfones** e confirme que o headset aparece (o browser pedirá permissão).
3. Clique em **Gravar com o headset**, fale um comando curto (ex.: “Aether, status do assistente”).
4. Clique em **Parar e enviar**.
5. O client chama `POST /process-audio`; a resposta validada pelo Consenso Alfa toca nos fones (tom WAV em mock).

### 4. Modo Gemini real (opcional)

Edite `backend/.env`:

```env
USE_MOCK_AUDIO=false
GEMINI_API_KEY=...
STT_PROVIDER=gemini
TTS_PROVIDER=gemini
COGNITIVE_PROVIDER=gemini
GEMINI_MODE=flash
```

Reinicie o uvicorn. Se a API Gemini falhar (quota / chave inválida), o backend regista
erro JSON (`audio.provider.error`) e devolve áudio de **fallback seguro** (WAV local) —
o Uvicorn não cai. O HUD também usa `speechSynthesis` se o TTS vier vazio.

Durante o Consenso Alfa, o backend emite logs JSON com `duration_ms` por sub-agente
(Grounding, Safety/Tone, Consistency) e espelha esses valores em
`consenso.agent_latencies` + `latency.consenso_*_ms` na resposta HTTP.

Web3 (stubs desacoplados em `backend/app/services/web3/`): `HELIUS_RPC_URL`,
`PYTH_HERMES_URL`, `JUPITER_QUOTE_API_URL` — não entram no `/process-audio`.

### Variáveis de ambiente principais

| Variável | Default | Descrição |
| --- | --- | --- |
| `USE_MOCK_AUDIO` | `true` | `true` = mock local; `false` = Gemini STT/TTS/cognitive |
| `STT_PROVIDER` | `mock` | `mock` \| `gemini` |
| `TTS_PROVIDER` | `mock` | `mock` \| `gemini` |
| `GEMINI_API_KEY` | — | Gemini STT + Flash/Pro cognitive + TTS |
| `GEMINI_MODE` | `flash` | `flash` \| `pro` |
| `HELIUS_RPC_URL` | — | Solana RPC via Helius (stub) |
| `HELIUS_API_KEY` | — | Chave Helius (stub) |
| `PYTH_HERMES_URL` | hermes.pyth.network | Oracle Pyth (stub) |
| `JUPITER_QUOTE_API_URL` | quote-api.jup.ag/v6 | Jupiter quotes (stub) |
| `CONSENSO_ENABLED` | `true` | Liga Consenso Alfa |
| `CORS_ORIGINS` | Vite 5173 | Sempre mesclado com localhost + 127.0.0.1 |

Lista completa: `backend/.env.example`.

### Testes automatizados (backend)

```bash
cd backend
source .venv/bin/activate
pytest -q
```

---

## Diagnóstico Bluetooth (Windows — headset não aparece)

Pasta dedicada (deps próprias, **não** usa `backend/requirements.txt`):

`tools/bluetooth-diagnostic/`

```bat
cd tools\bluetooth-diagnostic
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python diagnostico_bluetooth.py
```

Ver `tools/bluetooth-diagnostic/README.md`.

## Landing Next.js (existente)

```bash
npm install
npm run dev
```

Não misture com o client Vite — portas e pastas distintas.
