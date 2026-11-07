# Consenso Alfa

Camada multi-agente que valida o rascunho do assistente **antes** do TTS.

## Fluxo

1. Gemini (ou agente local em mock) gera `draft_response` a partir da transcrição STT.
2. `ConsensoAlfa` despacha o mesmo `ValidationContext` em paralelo para N `ValidatorAgent`.
3. Quórum: `approvals >= CONSENSO_MIN_AGENTS` e `agreement_ratio >= CONSENSO_AGREEMENT_THRESHOLD`.
4. Se rejeitado, a resposta falada é um fallback seguro (sem alucinação inventada).
5. Só então o texto final segue para TTS.

## Agentes Phase 1

| ID | Papel | Critério |
| --- | --- | --- |
| `alfa-grounding` | factual_grounding | Âncora no pedido do usuário; evita disclaimers genéricos de LLM |
| `alfa-safety` | safety_tone | Bloqueia phrasing inseguro; tom corporativo |
| `alfa-consistency` | consistency | Transcript/resposta coerentes; sem ruído degenerado |

## Extensão

Implemente `ValidatorAgent` (`protocol.py`) e injete a lista em `ConsensoAlfa(settings, agents=[...])`.  
Em fases DePIN, agentes podem anexar atestações via `app.services.depin` sem mudar `POST /process-audio`.
