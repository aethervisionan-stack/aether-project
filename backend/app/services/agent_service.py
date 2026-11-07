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

        if not self._settings.openai_api_key.strip():
            raise RecoverableProviderError(
                "agent",
                "invalid_api_key: OPENAI_API_KEY missing — fill backend/.env (no silent mock)",
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
            "You are Aether Vision, a concise voice assistant for Bluetooth headsets. "
            "Reply in the user's language (default Portuguese pt-BR). "
            "Keep answers short and speakable (1–3 sentences). "
            "Use tools when the user asks for system status, project folders, logs, "
            "or to save/recall preferences. Prefer get_env_status / list_project_dirs / "
            "memory_* over shell. Never invent secrets. Never request destructive OS actions."
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

            # Exhausted rounds — ask for a plain summary
            completion = await client.chat.completions.create(
                model=self._settings.openai_agent_model,
                messages=[
                    *messages,
                    {
                        "role": "user",
                        "content": "Summarize tool results in one short spoken reply.",
                    },
                ],
                temperature=0.3,
                max_tokens=220,
            )
            text = (completion.choices[0].message.content or "").strip() or (
                "Concluí as ações disponíveis. Posso ajudar com mais alguma coisa?"
            )
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

        want_status = any(k in lower for k in ("status", "ambiente", "env", "sistema"))
        want_dirs = any(k in lower for k in ("pasta", "diretório", "diretorio", "folders", "dirs"))
        want_save = any(k in lower for k in ("lembra", "prefer", "nota", "guarde", "salva"))
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
        elif want_status:
            inv = await self._gated_execute(
                name="get_env_status",
                arguments={},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = (
                "Consultei o estado do ambiente Aether Vision. "
                "API e pipeline estão reportados no painel de ferramentas."
            )
        elif want_dirs:
            inv = await self._gated_execute(
                name="list_project_dirs",
                arguments={"relative_path": "."},
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Listei as pastas do projeto. Detalhes estão no HUD de ferramentas."
        elif want_save:
            inv = await self._gated_execute(
                name="memory_write_note",
                arguments={
                    "text": f"Preferência capturada da voz: {cleaned[:180]}",
                    "key": "voice_note",
                    "client_id": client_id,
                },
                user_transcript=cleaned,
                locale=locale,
                request_id=request_id,
            )
            tools_log.append(inv)
            text = "Guardei a sua preferência na memória adaptativa."
        else:
            text = (
                "Aether Vision online. Ouvi: "
                f"«{cleaned[:220]}». "
                "Consenso Alfa está validando a resposta antes da síntese de voz."
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentTurnResult(
            text=text,
            duration_ms=elapsed,
            provider="aether-mvp-agent",
            tools=tools_log,
        )
