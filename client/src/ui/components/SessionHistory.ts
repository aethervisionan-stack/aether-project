/**
 * Chronological SessionLogs list for the HUD audit panel.
 * Vanilla TS (no React) — returns HTML matching ControlApp render style.
 */

import type { SessionHistoryItem, ToolInvocation } from "../../api/types";
import { escapeHtml, formatMs, formatPercent, formatTimestamp } from "../html";

export interface SessionHistoryViewModel {
  items: SessionHistoryItem[];
  loading: boolean;
  error: string | null;
}

function isToolInvocation(value: unknown): value is ToolInvocation {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as ToolInvocation).name === "string"
  );
}

function toolsHtml(tools: SessionHistoryItem["tools_invoked"]): string {
  const list = Array.isArray(tools) ? tools.filter(isToolInvocation) : [];
  if (!list.length) {
    return `<p class="hint session-history__tools-empty">Sem ferramentas nesta interação.</p>`;
  }
  const rows = list
    .map((t) => {
      const state = !t.approved
        ? `rejeitada${t.blocked_reason ? ` (${escapeHtml(t.blocked_reason)})` : ""}`
        : t.executed
          ? "executada"
          : "aprovada";
      return `<li class="session-history__tool">
        <strong>${escapeHtml(t.name)}</strong>
        <span>${state} · ${formatMs(t.duration_ms)}</span>
      </li>`;
    })
    .join("");
  return `<ul class="session-history__tools">${rows}</ul>`;
}

function itemHtml(item: SessionHistoryItem): string {
  const scorePct = formatPercent(item.consensus_score);
  const scoreClass =
    item.consensus_score >= 0.66
      ? "session-history__score--ok"
      : item.consensus_score > 0
        ? "session-history__score--warn"
        : "session-history__score--bad";

  return `<article class="session-history__item" data-request-id="${escapeHtml(item.request_id)}">
    <header class="session-history__item-head">
      <time datetime="${escapeHtml(item.timestamp ?? "")}">${escapeHtml(
        formatTimestamp(item.timestamp),
      )}</time>
      <span class="session-history__score ${scoreClass}" title="Consenso Alfa">
        Consenso ${escapeHtml(scorePct)}
      </span>
    </header>
    <div class="session-history__turn">
      <div class="block__label">Utilizador</div>
      <p class="block__body">${escapeHtml(item.transcription || "(vazio)")}</p>
    </div>
    <div class="session-history__turn">
      <div class="block__label">Assistente</div>
      <p class="block__body">${escapeHtml(item.agent_response || "(vazio)")}</p>
    </div>
    <div class="session-history__meta">
      <small>
        STT ${formatMs(item.latency_ms.stt)} · agente ${formatMs(item.latency_ms.agent)} ·
        consenso ${formatMs(item.latency_ms.consenso)} · TTS ${formatMs(item.latency_ms.tts)} ·
        total ${formatMs(item.latency_ms.total)}
      </small>
    </div>
    <div class="session-history__tools-block">
      <div class="block__label">Ferramentas</div>
      ${toolsHtml(item.tools_invoked)}
    </div>
  </article>`;
}

/** Render chronological voice interactions (newest first from API). */
export function renderSessionHistory(model: SessionHistoryViewModel): string {
  if (model.loading && !model.items.length) {
    return `<p class="hint">A carregar histórico…</p>`;
  }
  if (model.error) {
    return `<p class="error">${escapeHtml(model.error)}</p>`;
  }
  if (!model.items.length) {
    return `<p class="hint">Ainda sem interações gravadas. Grave um comando com o headset.</p>`;
  }

  // API returns newest first — show chronological (oldest → newest) in the panel.
  const chronological = [...model.items].reverse();
  return `<div class="session-history" role="list">
    <p class="hint session-history__count">${model.items.length} interação(ões)</p>
    ${chronological.map(itemHtml).join("")}
  </div>`;
}
