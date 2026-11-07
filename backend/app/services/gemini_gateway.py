"""
Gemini cognitive engine — modular draft generator for the voice + chat paths.

Uses the official `google-genai` async client (`Client.aio`).
Modes: flash → gemini-2.5-flash | pro → gemini-2.5-pro.
Missing/invalid GEMINI_API_KEY → RecoverableProviderError (safe path).
Never log the API key value.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Literal

from app.config import Settings
from app.core.config import is_valid_gemini_api_key, normalize_secret
from app.models.schemas import ToolInvocation
from app.services.resilience import RecoverableProviderError, classify_provider_failure

logger = logging.getLogger("aether.gemini")

GeminiMode = Literal["flash", "pro"]

GEMINI_MODE_MODELS: dict[GeminiMode, str] = {
    "flash": "gemini-2.5-flash",
    "pro": "gemini-2.5-pro",
}
DEFAULT_GEMINI_MODEL = GEMINI_MODE_MODELS["flash"]
DEFAULT_MODE: GeminiMode = "flash"

AETHER_GEMINI_SYSTEM = (
    "Você é o Aether — copiloto técnico avançado, articulado e direto, "
    "para headsets Bluetooth genéricos e consola web. "
    "Responda no idioma do utilizador (padrão: português pt-BR). "
    "Em modo voz, preferencialmente UMA frase falável (baixa latência TTS). "
    "Em modo chat, pode usar Markdown curto (listas, código, negrito) quando ajudar. "
    "Sem clichês de assistente genérico («como IA», «fico feliz em ajudar», "
    "«é uma ótima pergunta», etc.). Não narre o raciocínio. "
    "\n\n"
    "Arquitetura real deste produto (cite só o que for verdade): "
    "STT Gemini multimodal → motor cognitivo Gemini "
    "(gemini-2.5-flash ou gemini-2.5-pro) → Consenso Alfa → "
    "TTS Gemini (com fallback local/browser); "
    "memória adaptativa local (Chroma/RAG); auditoria SQLite "
    "(SessionLogs + latências STT·Agent·Consenso·TTS). "
    "Ferramentas locais (Function Calling) disponíveis: "
    "query_session_logs, query_metrics, store_context_note, list_context_notes "
    "— leem/escrevem apenas aether_vision.db (sem SQL arbitrário). "
    "Não invente notas/tarefas a partir de falas comuns; "
    "só chame store_context_note com pedido explícito salvar/anotar/lembrar. "
    "Nunca invente segredos nem peça ações destrutivas. "
    "Use o histórico estruturado da conversa para continuidade, "
    "sem repetir respostas anteriores verbatim."
)


@dataclass
class ChatMessage:
    role: Literal["user", "model"]
    content: str

    def as_gemini_role(self) -> Literal["user", "model"]:
        return "model" if self.role == "model" else "user"


@dataclass
class GeminiTurnResult:
    text: str
    duration_ms: int
    provider: str = DEFAULT_GEMINI_MODEL
    mode: GeminiMode = DEFAULT_MODE
    tools: list[ToolInvocation] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


def resolve_gemini_mode(raw: str | None) -> GeminiMode:
    key = (raw or DEFAULT_MODE).strip().lower()
    if key in ("pro", "gemini-2.5-pro", "2.5-pro"):
        return "pro"
    return "flash"


def resolve_gemini_model(mode: GeminiMode | str | None = None, *, override: str | None = None) -> str:
    if override and override.strip():
        return override.strip()
    resolved = resolve_gemini_mode(mode if isinstance(mode, str) or mode is None else mode)
    return GEMINI_MODE_MODELS[resolved]


def normalize_history(raw: list[dict[str, Any]] | list[ChatMessage] | None) -> list[ChatMessage]:
    if not raw:
        return []
    out: list[ChatMessage] = []
    for item in raw:
        if isinstance(item, ChatMessage):
            content = item.content.strip()
            if content:
                out.append(ChatMessage(role=item.as_gemini_role(), content=content))
            continue
        role_raw = str(item.get("role") or "user").strip().lower()
        content = str(item.get("content") or item.get("text") or "").strip()
        if not content:
            continue
        role: Literal["user", "model"] = (
            "model" if role_raw in ("model", "assistant", "aether") else "user"
        )
        out.append(ChatMessage(role=role, content=content))
    # Cap history to keep prompts lean
    return out[-24:]


class GeminiGateway:
    """Async Gemini draft generator (Consenso Alfa runs downstream)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def available(self) -> bool:
        return self._settings.has_valid_gemini_key()

    def default_model(self) -> str:
        return (self._settings.gemini_model or DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL

    async def generate(
        self,
        transcript: str,
        *,
        locale: str = "pt-BR",
        memory_context: str = "",
        sqlite_context: str = "",
        client_id: str = "default",
        request_id: str | None = None,
        system_instruction: str | None = None,
        mode: GeminiMode | str | None = None,
        history: list[dict[str, Any]] | list[ChatMessage] | None = None,
    ) -> GeminiTurnResult:
        """Voice / single-turn path with optional structured history."""
        return await self.chat(
            query=transcript,
            history=history,
            mode=mode,
            locale=locale,
            memory_context=memory_context,
            sqlite_context=sqlite_context,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system_instruction,
            max_output_tokens=400,
            speakable=True,
        )

    async def chat(
        self,
        *,
        query: str,
        history: list[dict[str, Any]] | list[ChatMessage] | None = None,
        mode: GeminiMode | str | None = None,
        locale: str = "pt-BR",
        memory_context: str = "",
        sqlite_context: str = "",
        client_id: str = "default",
        request_id: str | None = None,
        system_instruction: str | None = None,
        max_output_tokens: int = 1024,
        speakable: bool = False,
        enable_tools: bool = True,
        sqlite_url: str = "",
    ) -> GeminiTurnResult:
        started = time.perf_counter()
        cleaned = " ".join((query or "").split())
        resolved_mode = resolve_gemini_mode(mode)
        model = resolve_gemini_model(resolved_mode)

        if not cleaned:
            return GeminiTurnResult(
                text="Envie uma pergunta ou fale perto do microfone Bluetooth.",
                duration_ms=0,
                provider=f"{model}-empty",
                mode=resolved_mode,
            )

        key = normalize_secret(self._settings.gemini_api_key)
        if not is_valid_gemini_api_key(key):
            raise RecoverableProviderError(
                "agent",
                "missing_gemini_api_key: set GEMINI_API_KEY in backend/.env",
                provider=model,
            )

        messages = normalize_history(history)
        # Append current user turn
        messages.append(ChatMessage(role="user", content=cleaned))

        preamble_parts: list[str] = []
        if memory_context.strip():
            preamble_parts.append(memory_context.strip())
        if sqlite_context.strip():
            preamble_parts.append(sqlite_context.strip())
        preamble_parts.append(f"Locale: {locale}")
        preamble_parts.append(f"client_id: {client_id}")
        preamble_parts.append(f"mode: {resolved_mode} ({model})")
        if speakable:
            preamble_parts.append("Resposta preferencialmente falável (1 frase curta).")
        if enable_tools:
            preamble_parts.append(
                "Pode usar Function Calling nas tools SQLite locais quando útil."
            )
        preamble = "\n".join(preamble_parts)

        system = (system_instruction or AETHER_GEMINI_SYSTEM).strip()
        # Inject preamble into system so multi-turn contents stay clean roles
        system_full = f"{system}\n\n[Session]\n{preamble}"

        try:
            text, tools_log, raw_meta = await self._call_gemini(
                api_key=key,
                model=model,
                system=system_full,
                messages=messages,
                max_output_tokens=max_output_tokens,
                temperature=0.35 if resolved_mode == "pro" else 0.4,
                enable_tools=enable_tools and not speakable,
                client_id=client_id,
                request_id=request_id,
                sqlite_url=sqlite_url,
            )
        except RecoverableProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("agent", model, exc) from exc

        if not text.strip():
            text = (
                "Aether online. Recebi o pedido via Gemini, "
                "mas a resposta veio vazia. Pode repetir?"
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gemini.chat.done model=%s mode=%s chars=%s history=%s tools=%s duration_ms=%s request_id=%s",
            model,
            resolved_mode,
            len(text),
            len(messages),
            len(tools_log),
            elapsed,
            request_id,
        )
        return GeminiTurnResult(
            text=text.strip(),
            duration_ms=elapsed,
            provider=model,
            mode=resolved_mode,
            tools=tools_log,
            raw=raw_meta,
        )

    async def _call_gemini(
        self,
        *,
        api_key: str,
        model: str,
        system: str,
        messages: list[ChatMessage],
        max_output_tokens: int,
        temperature: float,
        enable_tools: bool = False,
        client_id: str = "default",
        request_id: str | None = None,
        sqlite_url: str = "",
    ) -> tuple[str, list[ToolInvocation], dict[str, Any]]:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "agent",
                f"google_genai_package_missing: {exc}",
                provider=model,
            ) from exc

        from app.services.gemini_tools import (
            MAX_TOOL_ROUNDS,
            build_genai_tool,
            execute_gemini_tool,
            extract_function_calls,
            invocation_from_handler,
        )

        client = genai.Client(api_key=api_key)
        tools_cfg = [build_genai_tool(types)] if enable_tools else None
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            tools=tools_cfg,
        )

        contents: list[Any] = []
        for msg in messages:
            contents.append(
                types.Content(
                    role=msg.as_gemini_role(),
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        tools_log: list[ToolInvocation] = []
        timeout_s = max(5.0, self._settings.request_timeout_ms / 1000.0)
        text = ""
        rounds = 0

        try:
            for _round in range(MAX_TOOL_ROUNDS if enable_tools else 1):
                rounds = _round + 1

                async def _once() -> Any:
                    return await client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config,
                    )

                try:
                    response = await asyncio.wait_for(_once(), timeout=timeout_s)
                except TimeoutError as exc:
                    raise RecoverableProviderError(
                        "agent",
                        "gemini_timeout",
                        provider=model,
                    ) from exc

                calls = extract_function_calls(response) if enable_tools else []
                if not calls:
                    text = _extract_text(response)
                    break

                # Append model turn (with function_call parts) then function responses
                model_content = None
                try:
                    cands = getattr(response, "candidates", None) or []
                    if cands:
                        model_content = getattr(cands[0], "content", None)
                except Exception:  # noqa: BLE001
                    model_content = None
                if model_content is not None:
                    contents.append(model_content)
                else:
                    # Reconstruct minimal function_call content
                    fc_parts = []
                    for name, args, _fc in calls:
                        fc_parts.append(
                            types.Part.from_function_call(name=name, args=args)
                        )
                    contents.append(types.Content(role="model", parts=fc_parts))

                response_parts = []
                for name, args, fc in calls:
                    result = execute_gemini_tool(
                        name,
                        args,
                        client_id=client_id,
                        request_id=request_id,
                        sqlite_url=sqlite_url,
                    )
                    tools_log.append(invocation_from_handler(name, args, result))
                    response_parts.append(
                        types.Part.from_function_response(
                            name=name,
                            response=result.payload,
                        )
                    )

                contents.append(types.Content(role="user", parts=response_parts))
            else:
                # Exhausted tool rounds without plain text — one last text-only nudge
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(
                                text=(
                                    "Responda agora ao utilizador em texto final, "
                                    "usando os resultados das tools já obtidos."
                                )
                            )
                        ],
                    )
                )
                config_no_tools = types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                )

                async def _final() -> Any:
                    return await client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config_no_tools,
                    )

                try:
                    response = await asyncio.wait_for(_final(), timeout=timeout_s)
                    text = _extract_text(response)
                except TimeoutError as exc:
                    raise RecoverableProviderError(
                        "agent",
                        "gemini_timeout",
                        provider=model,
                    ) from exc
        finally:
            try:
                await client.aio.aclose()
            except Exception:  # noqa: BLE001
                pass

        meta = {
            "model": model,
            "has_text": bool(text),
            "turns": len(messages),
            "tool_rounds": rounds,
            "tools_executed": sum(1 for t in tools_log if t.executed),
        }
        return text, tools_log, meta


def _extract_text(response: Any) -> str:
    text = (getattr(response, "text", None) or "").strip()
    if text:
        return text
    try:
        cands = getattr(response, "candidates", None) or []
        for cand in cands:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                piece = getattr(part, "text", None)
                if piece:
                    text += str(piece)
    except Exception:  # noqa: BLE001
        pass
    return text.strip()


def build_sqlite_context(
    *,
    client_id: str = "default",
    limit: int = 5,
) -> str:
    """Optional recent SessionLogs block for Gemini (best-effort)."""
    try:
        from app.db.store import list_recent_sessions

        items = list_recent_sessions(limit=limit, client_id=client_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug("sqlite context unavailable: %s", exc)
        return ""
    if not items:
        return ""
    lines = ["[Recent session history — SQLite SessionLogs]"]
    for item in reversed(items):
        t = (item.get("transcription") or "")[:120]
        a = (item.get("agent_response") or "")[:160]
        if t or a:
            lines.append(f"- User: {t}")
            lines.append(f"  Aether: {a}")
    return "\n".join(lines) if len(lines) > 1 else ""
