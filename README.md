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
cp .env.example .env               # PIPELINE_MODE=mock por padrão
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Confira: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) e docs em [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Client de controle

Em outro terminal:

```bash
cd client
npm install
cp .env.example .env               # VITE_API_BASE_URL vazio → proxy /api → :8000
npm run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173).

### 3. Teste com o headset

1. Pareie o fone Bluetooth no sistema e defina-o como dispositivo de **entrada** e **saída** padrão.
2. No client, clique em **Listar microfones** e confirme que o headset aparece (o browser pedirá permissão).
3. Clique em **Gravar com o headset**, fale um comando curto (ex.: “Aether, status do assistente”).
4. Clique em **Parar e enviar**.
5. O client chama `POST /process-audio`; a resposta validada pelo Consenso Alfa toca nos fones (tom WAV em mock).

### 4. Modo com Whisper / TTS reais (opcional)

Edite `backend/.env`:

```env
PIPELINE_MODE=hybrid          # ou production
STT_PROVIDER=openai           # ou local (pip install openai-whisper + ffmpeg)
TTS_PROVIDER=openai           # ou elevenlabs | mock
OPENAI_API_KEY=sk-...
# ELEVENLABS_API_KEY=...      # se TTS_PROVIDER=elevenlabs
# ELEVENLABS_VOICE_ID=...
```

Reinicie o uvicorn. `STT_PROVIDER=local` exige `openai-whisper` e `ffmpeg` no PATH.

Durante o Consenso Alfa, o backend emite logs JSON estruturados
(`consenso.agent.start` / `consenso.agent.done` / `consenso.done`) com latência por sub-agente
(grounding, safety_tone, consistency). Se o quórum rejeitar, a TTS usa o fallback seguro —
nunca o rascunho não validado.

### Variáveis de ambiente principais

| Variável | Default | Descrição |
| --- | --- | --- |
| `PIPELINE_MODE` | `mock` | `mock` \| `hybrid` \| `production` |
| `STT_PROVIDER` | `mock` | `mock` \| `openai` \| `local` |
| `TTS_PROVIDER` | `mock` | `mock` \| `openai` \| `elevenlabs` |
| `OPENAI_API_KEY` | — | OpenAI Whisper STT + OpenAI TTS |
| `ELEVENLABS_API_KEY` | — | ElevenLabs TTS (`TTS_PROVIDER=elevenlabs`) |
| `ELEVENLABS_VOICE_ID` | Rachel default | Voice id ElevenLabs |
| `WHISPER_MODEL` | `base` | Modelo local Whisper |
| `WHISPER_LANGUAGE` | `pt` | Idioma STT |
| `CONSENSO_ENABLED` | `true` | Liga Consenso Alfa |
| `CONSENSO_AGREEMENT_THRESHOLD` | `0.66` | Fração mínima de votos |
| `CONSENSO_TIMEOUT_MS` | `2500` | Timeout por agente |
| `REQUEST_TIMEOUT_MS` | `30000` | Timeout do pipeline |
| `MAX_AUDIO_BYTES` | `10485760` | Limite do upload |
| `CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Vite client (sempre mesclado) |

Lista completa: `backend/.env.example`.

### Testes automatizados (backend)

```bash
cd backend
source .venv/bin/activate
pytest -q
```

---

## Landing Next.js (existente)

```bash
npm install
npm run dev
```

Não misture com o client Vite — portas e pastas distintas.
