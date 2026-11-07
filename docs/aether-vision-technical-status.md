# Aether Vision — Relatório técnico de estado (Phase 1)

**Destinatário:** outro modelo/IA (copiar este documento como contexto).  
**Gerado a partir do workspace real** `C:\Users\Next\aether-project`  
**Branch Git:** `cursor/real-providers-adaptive-memory-8812`  
**HEAD (no momento da varredura):** `5a0f913` — `feat: advanced Aether SYSTEM_PROMPT + temperature 0.4`  
**Data da varredura:** 2026-11-07 (máquina Windows local)

> **Aviso de precisão:** este relatório descreve o que existe no disco.  
> **Não há pasta `android/`.** O HUD de voz ativo é **Vite + TypeScript vanilla** em `client/`.  
> **Não inventar** Android/Compose, Gemini, ou apps mobile que não estejam no repo.  
> Há restos de outros scaffolds na raiz (`frontend/` Expo untracked, vestígios Next.js) — **não são o pipeline de voz Phase 1**.

---

## 0) Visão geral do produto (Phase 1)

Pipeline de voz para headsets Bluetooth genéricos:

1. Captura de áudio no browser (mic padrão do SO / headset)  
2. `POST /process-audio` (multipart) → FastAPI  
3. **STT** Gemini multimodal (`gemini-2.5-flash`, ou mock)  
4. **Memória adaptativa** local (ChromaDB / RAG leve)  
5. **Cognitivo** Gemini Flash/Pro (`gemini_gateway` + `/api/cognitive/chat`)  
6. **Consenso Alfa** (validação multi-agente da resposta + gate de tools)  
7. **TTS** Gemini (`gemini-2.5-flash-preview-tts`, voz `Kore`) + fallback WAV/browser  

8. Persistência **SQLite** (`SessionLogs` + `AuditTrail`)  
9. HUD Vite: playback + histórico/métricas

Stubs **Web3/Solana/DePIN** (Pyth, Helius, Jupiter, DePIN) existem mas **não estão ligados** ao caminho de voz.

---

## 1) Árvore de pastas / módulos (relevante)

### 1.1 Raiz do repo (contexto)

Presente na raiz (além de `backend/` e `client/`):

| Caminho | Notas |
|---------|--------|
| `backend/` | **API FastAPI Phase 1 (fonte da verdade da voz)** |
| `client/` | **HUD Vite/TS Phase 1 (fonte da verdade da UI de headset)** |
| `start_app.bat` / `start_app.ps1` | Sobe Uvicorn `:8001` + Vite `:5173` |
| `frontend/` | Untracked; Expo legado — **não** é o HUD atual |
| `app/`, `components/`, `hooks/`, `lib/`, Next configs | Vestígios Next.js na raiz — **fora** do stack de voz ativo |
| `android/` | **Ausente** |

### 1.2 `backend/` (árvore lógica)

```
backend/
  .env / .env.example
  requirements.txt
  pytest.ini
  aether_vision.db          # SQLite SessionLogs/AuditTrail (runtime)
  app/
    main.py                 # FastAPI + lifespan init_db
    config.py               # Settings (pydantic-settings)
    deps.py                 # DI pipeline
    agent/
      tools.py              # ToolRegistry + schemas JSON
    core/
      config.py             # BACKEND_DIR, dotenv absoluto, validação sk-
      memory.py             # AdaptiveMemory (Chroma)
    db/
      models.py             # SessionLog, AuditTrail
      session.py            # engine SQLite
      store.py              # persist + history/metrics queries
    middleware/errors.py
    models/schemas.py       # Pydantic envelopes
    routes/
      health.py             # GET /health
      process_audio.py      # POST /process-audio
      audio.py              # GET /audio/{filename}
    routers/
      history.py            # GET /api/history, /api/metrics (+ aliases)
    services/
      pipeline.py           # Orquestração E2E
      agent_service.py      # Gemini Flash/Pro + SYSTEM_PROMPT + tools
      agent.py              # draft legado (sem tools)
      consenso_alfa/        # orchestrator, agents, protocol, fallback
      stt/                  # mock, gemini multimodal
      tts/                  # mock, gemini AUDIO modality
      web3/                 # stubs: helius, jupiter, pyth
      depin.py              # NullDepinAttestor
      resilience.py
      audio_store.py
  tests/                    # 11 ficheiros de teste
  data/chroma, data/tts_audio
```

### 1.3 `client/` (árvore lógica)

```
client/
  package.json              # vite + typescript; dependencies: {}
  vite.config.ts            # :5173, strictPort, proxy /api → :8001
  index.html
  src/
    main.ts
    api/client.ts, types.ts
    audio/capture.ts, playback.ts
    ui/app.ts               # ControlApp HUD
    ui/html.ts
    ui/components/
      SessionHistory.ts
      MetricsPanel.ts
    styles/main.css
```

**Sem React/JSX no client de voz.** Sem Android.

---

## 2) Backend FastAPI — detalhe

### 2.1 Runtime

- Python **3.11.9** (`backend\.venv`)
- Dependências-chave: FastAPI, Uvicorn, Pydantic v2, google-genai SDK, ChromaDB, SQLAlchemy 2, psutil, pytest

### 2.2 Entrypoint — `app/main.py`

- Carrega `backend/.env` por caminho absoluto **antes** do cache de settings  
- `lifespan` → `init_db()` (cria tabelas SQLite se faltarem)  
- Routers: health, process_audio, audio, history  
- CORS inclui Vite `127.0.0.1:5173` / `localhost:5173`

### 2.3 Endpoints HTTP

| Método | Caminho | Função |
|--------|---------|--------|
| GET | `/health` | Estado + flags (sem segredos) |
| POST | `/process-audio` | Pipeline completo (multipart `audio`) |
| GET | `/audio/{filename}` | Ficheiros TTS gerados |
| GET | `/api/history` e `/history` | SessionLogs recentes |
| GET | `/api/metrics` e `/metrics` | Médias de latência / audit counts |
| GET | `/` | Índice JSON de rotas |

Proxy Vite: browser chama `/api/...` → backend sem o prefixo `/api` (exceto rotas que também existem com `/api/...` no FastAPI para history/metrics).

### 2.4 Pipeline — `services/pipeline.py`

`STT → memória (search + extract prefs) → AgentService → Consenso Alfa → TTS → remember_interaction → persist_process_audio`

Fallbacks seguros em falhas STT/agent/TTS (texto PT + mock TTS quando necessário).

### 2.5 STT — `services/stt/`

- `mock.py` — testes / `USE_MOCK_AUDIO=true`  
- `gemini.py` — Gemini multimodal transcription (`GEMINI_STT_MODEL`)  
- Modelo default: `gemini-2.5-flash`

### 2.6 Cognitivo — `services/gemini_gateway.py` + `agent_service.py`

- Produção: Gemini Flash/Pro via `google-genai`  
- Mock: `AgentService` local (tools Consenso-gated, sem cloud LLM)  
- Chat: `POST /api/cognitive/chat` (`mode` flash|pro + history)

### 2.7 Consenso Alfa — `services/consenso_alfa/`

- `orchestrator.py` — quorum de validadores + `validate_tool_call`  
- `agents.py`, `protocol.py`, `fallback.py`  
- Config: `CONSENSO_ENABLED`, `CONSENSO_MIN_AGENTS`, `CONSENSO_AGREEMENT_THRESHOLD`, `CONSENSO_TIMEOUT_MS`

### 2.8 TTS — `services/tts/`

- Default real: Gemini **`gemini-2.5-flash-preview-tts`**, voz **`Kore`**  
- Fallback: mock WAV local; HUD `speechSynthesis` se áudio vazio

### 2.9 Memória — `core/memory.py`

- ChromaDB persistente em `data/chroma`  
- Collections: `user_preferences`, `past_interactions`  
- Tags semânticas: `rotina`, `preferência`, `tarefa`

### 2.10 SQLite — `db/`

Ficheiro: `backend/aether_vision.db`

- **session_logs:** transcription, agent_response, tools_invoked JSON, latências STT/agent/consenso/tts/total, consensus_score, tokens_*  
- **audit_trail:** approve/reject por tool call

### 2.11 Web3 / DePIN (stubs — Phase 2+)

| Módulo | Papel |
|--------|--------|
| `services/web3/pyth_oracle.py` | Stub oráculo Pyth |
| `services/web3/helius_client.py` | Stub cliente Helius RPC |
| `services/web3/jupiter_swap.py` | Stub quotes/swaps Jupiter |
| `services/depin.py` | `NullDepinAttestor` — sempre `None` |

**Não importados** pelo caminho STT/agent/TTS. Health: `depin_ready`, `web3_rpc_configured` (nesta máquina: ambos `false`).

### 2.12 Pytest

Última corrida na varredura: **41 passed** (Python 3.11.9 venv).

Ficheiros: `test_process_audio`, `test_agent_tools`, `test_consenso_*`, `test_mock_audio_and_fallback`, `test_real_providers_fallback`, `test_session_persistence`, `test_dotenv_health_key`, `test_cors_and_config`, `test_web3_stubs`.

---

## 3) Frontend — stack real

### 3.1 Stack

- **Vite 6** + **TypeScript 5.7**  
- **Sem React** no HUD de voz (`client/`)  
- UI: DOM string rendering em `ControlApp` (`src/ui/app.ts`)  
- Áudio: `MediaRecorder` / getUserMedia (`capture.ts`), playback URL/base64 (`playback.ts`)  
- API client: `fetch` + FormData para `/process-audio`; `history()` / `metrics()`

### 3.2 HUD funcional

- Fluxo PT: Pronto → A escutar → Validando Consenso Alfa → A responder  
- Badges: API online, `has_valid_gemini_key`, STT/TTS/Consenso  
- Painel **Sessão & métricas**: tabs Histórico / Métricas; refresh após `/process-audio` OK  
- URL local: `http://127.0.0.1:5173/`

### 3.3 O que NÃO é este frontend

- Sem `android/`, sem Jetpack Compose, sem app nativo  
- Pasta `frontend/` (Expo) untracked ≠ HUD Phase 1  
- Vestígios Next.js na raiz ≠ cliente de voz

---

## 4) Estado live (varredura)

| Serviço | Porto | Estado |
|---------|-------|--------|
| Uvicorn FastAPI | `127.0.0.1:8001` | **UP** (`GET /health` → 200) |
| Vite client | `127.0.0.1:5173` | **UP** (200) |

### 4.1 Campos de `GET /health` (sem segredos)

Valores observados nesta máquina:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "pipeline_mode": "production",
  "use_mock_audio": false,
  "stt_provider": "gemini",
  "tts_provider": "gemini",
  "consenso_enabled": true,
  "depin_ready": false,
  "web3_rpc_configured": false,
  "gemini_api_key_configured": true,
  "has_valid_gemini_key": true,
  "env_file": "C:\\Users\\Next\\aether-project\\backend\\.env",
  "api_port": 8001
}
```

**Nunca logar/imprimir o valor de `GEMINI_API_KEY`.**

### 4.2 Variáveis de ambiente — **apenas NOMES**

Documentadas em `backend/.env.example` (e presentes como chaves em `backend/.env`):

`HOST`, `PORT`, `LOG_LEVEL`, `CORS_ORIGINS`, `USE_MOCK_AUDIO`, `PIPELINE_MODE`, `STT_PROVIDER`, `TTS_PROVIDER`, `GEMINI_API_KEY`, `COGNITIVE_PROVIDER`, `GEMINI_MODEL`, `GEMINI_MODE`, `GEMINI_STT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`, `DEFAULT_LANGUAGE`, `CONSENSO_ENABLED`, `CONSENSO_MIN_AGENTS`, `CONSENSO_AGREEMENT_THRESHOLD`, `CONSENSO_TIMEOUT_MS`, `TTS_SAMPLE_RATE`, `TTS_AUDIO_DIR`, `MEMORY_ENABLED`, `CHROMA_PERSIST_DIR`, `REQUEST_TIMEOUT_MS`, `MAX_AUDIO_BYTES`, `RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`, `DEPLOYMENT_NETWORK`, `HELIUS_RPC_URL`, `HELIUS_API_KEY`, `SOLANA_RPC_URL`, `PYTH_HERMES_URL`, `JUPITER_QUOTE_API_URL`, `AETHER_AGENT_WALLET`

Chaves adicionais vistas no `.env` local (legado / fora do example):  
`VISION_TOKEN_MINT`, `TREASURY_PUBLIC_KEY`, `EXPO_WEB_URL`, `EMERGENT_LLM_KEY`

Cliente: `VITE_API_BASE_URL` (vazio = proxy `/api`).

---

## 5) Como arrancar (Windows)

```text
# Preferido para demos locais:
start_app.bat
# ou, em shells de agente (sem janelas externas):
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
cd ..\client
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir: `http://127.0.0.1:5173/`  
Health: `http://127.0.0.1:8001/health`

---

## 6) Lacunas conhecidas (honestas)

- Tokens em SessionLogs ainda best-effort (muitas vezes 0)  
- Web3/DePIN só stubs  
- PR GitHub por vezes bloqueado (`must be a collaborator`)  
- Raiz do repo tem scaffolds paralelos (Next/Expo) — ignorar para o produto de voz Phase 1  
- Sem app Android neste branch  

---

## 7) Instruções para outra IA

Ao continuar trabalho neste repo:

1. Tratar **`backend/` + `client/`** como o produto Phase 1.  
2. Não assumir Android/Gemini/Compose.  
3. Não ecoar segredos de `.env`.  
4. Manter suite pytest verde (**41** testes no momento desta varredura).  
5. Fluxo crítico: `POST /process-audio` + Consenso + tools + SQLite + HUD history/metrics.  
6. Branch: `cursor/real-providers-adaptive-memory-8812`.

---

*Fim do relatório técnico.*
