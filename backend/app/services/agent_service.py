"""
OpenAI function-calling agent loop for voice intents.

Flow: transcript → gpt-4o-mini (+ tools) → Consenso Alfa tool-safety gate →
execute approved tools → final speakable text (TTS happens in the pipeline).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.agent.tools import ToolRegistry, get_openai_tool_schemas, known_tool_names
from app.config import Settings
from app.core.memory import AdaptiveMemory
from app.models.schemas import ToolInvocation
from app.services.consenso_alfa import ConsensoAlfa
from app.services.resilience import RecoverableProviderError, classify_provider_failure

logger = logging.getLogger("aether.agent_service")

MAX_TOOL_ROUNDS = 3


@dataclass
class AgentTurnResult:
    text: str
    duration_ms: int
    provider: str
    tools: list[ToolInvocation] = field(default_factory=list)


class AgentService:
    """Voice intent → optional tools (Consenso-gated) → final reply text."""

    def __init__(
        self,
        settings: Settings,
        consenso: ConsensoAlfa,
        tools: ToolRegistry | None = None,
        memory: AdaptiveMemory | None = None,
    ) -> None:
        self._settings = settings
        self._consenso = consenso
        self._tools = tools or ToolRegistry(settings=settings, memory=memory)

    async def run(
        self,
        transcript: str,
        *,
        locale: str = "pt-BR",
        memory_context: str = "",
        client_id: str = "default",
        request_id: str | None = None,
    ) -> AgentTurnResult:
        started = time.perf_counter()
        cleaned = " ".join(transcript.split())

        if not cleaned:
            return AgentTurnResult(
                text=(
                    "Não capturei áudio claro do seu headset. "
                    "Fale novamente perto do microfone Bluetooth."
                ),
                duration_ms=0,
                provider="agent-empty",
                tools=[],
            )

        if self._settings.use_mock_audio:
            return await self._mock_turn(
                cleaned,
                locale=locale,
                client_id=client_id,
                request_id=request_id,
                started=started,
            )

        if not self._settings.has_valid_openai_key():
            raise RecoverableProviderError(
                "agent",
                "invalid_api_key: OPENAI_API_KEY missing/invalid — paste sk-… in backend/.env",
                provider="gpt-4o-mini",
            )

        try:
            from openai import AsyncOpenAI
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "agent",
                f"openai_package_missing: {exc}",
                provider="gpt-4o-mini",
            ) from exc

        client = AsyncOpenAI(api_key=self._settings.openai_api_key)
        system = (
            "You are Aether Vision — a direct, concise, smart voice assistant for Bluetooth headsets. "
            "Reply in the user's language (default Portuguese pt-BR). "
            "Speakable answers only: ideally ONE short sentence after any tools (minimize TTS latency). "
            "Be helpful and precise; do not ramble or narrate your reasoning. "
            "Do NOT auto-categorize ordinary utterances as tarefa, nota, rotina, or preferência. "
            "Call memory_write_note ONLY when the user explicitly asks to save/remember/store something. "
            "Call memory_read_notes ONLY when the conversation needs previously saved notes or preferences. "
            "Honor [Learned preferences] context when it is already provided — do not re-tag it. "
            "Use other tools when useful: env status, CPU/RAM (get_system_metrics), process list, "
            "open_browser_url (allowlisted https only), project dirs/logs. "
            "Never invent secrets. Never request destructive OS actions."
        )
        user_parts = []
        if memory_context.strip():
            user_parts.append(memory_context.strip())
        user_parts.append(f"Locale: {locale}")
        user_parts.append(f"client_id: {client_id}")
        user_parts.append(f"User said: {cleaned}")

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system},
            {"role": "user", "content": "\n\n".join(user_parts)},
        ]
        tools_log: list[ToolInvocation] = []
        schemas = get_openai_tool_schemas()

        try:
            for _round in range(MAX_TOOL_ROUNDS):
                completion = await client.chat.completions.create(
                    model=self._settings.openai_agent_model,
                    messages=messages,
                    tools=schemas,
                    tool_choice="auto",
                    temperature=0.3,
                    max_tokens=400,
                )
                msg = completion.choices[0].message
                tool_calls = msg.tool_calls or []

                if not tool_calls:
                    text = (msg.content or "").strip()
                    if not text:
                        text = (
                            "Aether Vision online. Recebi o pedido, "
                            "mas não formulei uma resposta clara. Pode repetir?"
                        )
                    if any(t.executed and t.approved for t in tools_log):
                        text = _concise_spoken_summary(text, tools_log)
                    elapsed = int((time.perf_counter() - started) * 1000)
                    return AgentTurnResult(
                        text=text,
                        duration_ms=elapsed,
                        provider="gpt-4o-mini",
                        tools=tools_log,
                    )

                # Append assistant message with tool_calls for the API loop
                messages.append(
                    {
                        "role": "assistant",
                        "content": msg.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments or "{}",
                                },
                            }
                            for tc in tool_calls
                        ],
                    }
                )

                for tc in tool_calls:
                    name = tc.function.name
                    try:
                        arguments = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        arguments = {}
                    if not isinstance(arguments, dict):
                        arguments = {}

                    # Inject client_id for memory tools when omitted
                    if name.startswith("memory_") and "client_id" not in arguments:
                        arguments["client_id"] = client_id

                    inv = await self._gated_execute(
                        name=name,
                        arguments=arguments,
                        user_transcript=cleaned,
                        locale=locale,
                        request_id=request_id,
                    )
                    tools_log.append(inv)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps(
                                {
                                    "ok": inv.executed and inv.approved,
                                    "blocked": not inv.approved,
                                    "reason": inv.blocked_reason,
                                    "result": inv.result_preview or "",
                                },
                                ensure_ascii=False,
                            ),
                        }
                    )

            # Exhausted rounds — ask for a plain short summary (TTS latency)
            completion = await client.chat.completions.create(
                model=self._settings.openai_agent_model,
                messages=[
                    *messages,
                    {
                        "role": "user",
                        "content": (
                            "Reply in ONE short spoken sentence summarizing the tool results. "
                            "No lists, no preamble."
                        ),
                    },
                ],
                temperature=0.2,
                max_tokens=80,
            )
            text = (completion.choices[0].message.content or "").strip() or (
                "Pronto."
            )
            text = _concise_spoken_summary(text, tools_log)
        except RecoverableProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("agent", "gpt-4o-mini", exc) from exc

        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentTurnResult(
            text=text,
            duration_ms=elapsed,
            provider="gpt-4o-mini",
            tools=tools_log,
        )

    async def _gated_execute(
        self,
        *,
        name: str,
        arguments: dict[str, Any],
        user_transcript: str,
        locale: str,
        request_id: str | None,
    ) -> ToolInvocation:
        started = time.perf_counter()
        if name not in known_tool_names():
            return ToolInvocation(
                name=name,
                arguments=arguments,
                approved=False,
                executed=False,
                blocked_reason="unknown_tool",
                result_preview=None,
                duration_ms=int((time.perf_counter() - started) * 1000),
            )

        safety = await self._consenso.validate_tool_call(
            tool_name=name,
            arguments=arguments,
            user_transcript=user_transcript,
            locale=locale,
            request_id=request_id,
        )
        if not safety.approved:
            logger.warning(
                "tool blocked by consenso name=%s reason=%s",
                name,
                safety.reason,
            )
            return ToolInvocation(
                name=name,
                arguments=arguments,
                approved=False,
                executed=False,
                blocked_reason=safety.reason,
                result_preview=None,
                duration_ms=int((time.perf_counter() - started) * 1000),
            )

        result = await self._tools.execute(name, arguments)
        preview = result.output[:500]
        return ToolInvocation(
            name=name,
            arguments=arguments,
            approved=True,
            executed=result.ok or bool(result.output),
            blocked_reason=None if result.ok else result.output[:200],
            result_preview=preview,
            duration_ms=int((time.perf_counter() - started) * 1000),
        )

    async def _mock_turn(
        self,
        cleaned: str,
        *,
        locale: str,
        client_id: str,
        request_id: str | None,
        started: float,
    ) -> AgentTurnResult:
        """Deterministic tool path for USE_MOCK_AUDIO=true (unit tests / offline)."""
        _ = locale
        await asyncio.sleep(0.02)
        lower = cleaned.lower()
        tools_log: list[ToolInvocation] = []

        want_status = any(k in lower for k in ("status", "ambiente", "env")) and "cpu" not in lower
        want_metrics = any(k in lower for k in ("cpu", "ram", "memória", "memoria", "métrica", "metrica"))
        want_procs = any(k in lower for k in ("processo", "processos", "processes"))
        want_browser = any(k in lower for k in ("abre o browser", "abrir o navegador", "open browser", "abre https"))
        want_dirs = any(k in lower for k in ("pasta", "diretório", "diretorio", "folders", "dirs"))
        # Explicit save/remember only — never treat bare "nota"/"tarefa" as a write.
        want_save = any(
            k in lower
            for k in (
                "lembra que",
                "lembra disso",
                "lembra isso",
                "lembra esta",
                "lembra este",
                "guarde",
                "guarda isso",
                "guarda que",
                "salva isso",
                "salva que",
                "salva esta",
                "salve",
                "anota que",
                "anota isso",
                "anote",
                "remember that",
                "remember this",
                "save this",
                "save that",
                "store this",
            )
        )
        want_shell = any(k in lower for k in ("apaga tudo", "formatar disco", "rm -rf", "shutdown"))

        if want_shell:
            inv = await self._gated_execute(
                name="run_allowlisted_command",
                arguments={"command_key": "rm_rf_root"},  # not allowlisted — consenso/tools block
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            # Force consenso-style block if somehow slipped
            if inv.approved:
                inv = ToolInvocation(
                    name=inv.name,
                    arguments=inv.arguments,
                    approved=False,
                    executed=False,
                    blocked_reason="dangerous_intent",
                    result_preview=None,
                    duration_ms=inv.duration_ms,
                )
            tools_log.append(inv)
            text = (
                "Consenso Alfa bloqueou a ação pedida — "
                "não executo comandos destrutivos no sistema."
            )
        elif want_metrics:
            inv = await self._gated_execute(
                name="get_system_metrics",
                arguments={},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = _mock_metrics_speech(inv.result_preview)
        elif want_procs:
            inv = await self._gated_execute(
                name="list_active_processes",
                arguments={"limit": 8},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Listei os processos ativos."
        elif want_browser:
            inv = await self._gated_execute(
                name="open_browser_url",
                arguments={"url": "https://www.google.com"},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Abri o navegador."
        elif want_status:
            inv = await self._gated_execute(
                name="get_env_status",
                arguments={},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Ambiente Aether Vision consultado."
        elif want_dirs:
            inv = await self._gated_execute(
                name="list_project_dirs",
                arguments={"relative_path": "."},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Pastas do projeto listadas."
        elif want_save:
            from app.core.memory import infer_semantic_tag

            tag = infer_semantic_tag(cleaned)
            inv = await self._gated_execute(
                name="memory_write_note",
                arguments={
                    "text": cleaned[:180],
                    "key": "voice_note",
                    "tag": tag,
                    "client_id": client_id,
                },
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = f"Nota {tag} guardada."
        else:
            text = (
                "Aether Vision online. Ouvi: "
                f"«{cleaned[:220]}». "
                "Consenso Alfa está validando a resposta antes da síntese de voz."
            )

        if tools_log and any(t.executed and t.approved for t in tools_log):
            text = _concise_spoken_summary(text, tools_log)

        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentTurnResult(
            text=text,
            duration_ms=elapsed,
            provider="aether-mvp-agent",
            tools=tools_log,
        )


def _concise_spoken_summary(text: str, tools: list[ToolInvocation]) -> str:
    """Keep headset TTS short after successful tools."""
    cleaned = " ".join((text or "").split())
    if not cleaned:
        names = ", ".join(t.name for t in tools if t.executed) or "ação"
        return f"Pronto: {names}."
    # Soft cap ~180 chars / ~1–2 sentences for TTS latency
    if len(cleaned) <= 180:
        return cleaned
    cut = cleaned[:177]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "."


def _mock_metrics_speech(preview: str | None) -> str:
    if not preview:
        return "Métricas do sistema lidas."
    try:
        data = json.loads(preview)
        cpu = data.get("cpu_percent")
        ram = data.get("ram_percent")
        if cpu is not None and ram is not None:
            return f"CPU {cpu}% e RAM {ram}%."
    except (json.JSONDecodeError, TypeError):
        pass
    return "Métricas do sistema lidas."
