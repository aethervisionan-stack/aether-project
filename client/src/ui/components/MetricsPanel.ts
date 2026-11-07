/**
 * Consolidated latency + interaction metrics cards/bars for the HUD.
 * Vanilla TS — no chart library.
 */

import type { MetricsResponse } from "../../api/types";
import { escapeHtml, formatMs, formatPercent } from "../html";

export interface MetricsPanelViewModel {
  metrics: MetricsResponse | null;
  loading: boolean;
  error: string | null;
}

interface LatencyBar {
  key: string;
  label: string;
  ms: number;
}

function latencyBars(metrics: MetricsResponse): LatencyBar[] {
  return [
    { key: "stt", label: "STT", ms: metrics.latency_ms.avg_stt },
    { key: "agent", label: "Agent", ms: metrics.latency_ms.avg_agent },
    { key: "consenso", label: "Consenso", ms: metrics.latency_ms.avg_consenso },
    { key: "tts", label: "TTS", ms: metrics.latency_ms.avg_tts },
  ];
}

function barRowHtml(bar: LatencyBar, maxMs: number): string {
  const pct = maxMs > 0 ? Math.min(100, Math.round((bar.ms / maxMs) * 100)) : 0;
  return `<div class="metrics-bar" data-stage="${escapeHtml(bar.key)}">
    <div class="metrics-bar__label">
      <span>${escapeHtml(bar.label)}</span>
      <strong>${escapeHtml(formatMs(bar.ms))}</strong>
    </div>
    <div class="metrics-bar__track" aria-hidden="true">
      <span class="metrics-bar__fill" style="width:${pct}%"></span>
    </div>
  </div>`;
}

export function renderMetricsPanel(model: MetricsPanelViewModel): string {
  if (model.loading && !model.metrics) {
    return `<p class="hint">A carregar métricas…</p>`;
  }
  if (model.error) {
    return `<p class="error">${escapeHtml(model.error)}</p>`;
  }
  const m = model.metrics;
  if (!m || m.session_count === 0) {
    return `<p class="hint">Sem dados ainda. As médias aparecem após o primeiro /process-audio.</p>`;
  }

  const bars = latencyBars(m);
  const maxMs = Math.max(...bars.map((b) => b.ms), m.latency_ms.avg_total, 1);

  return `<div class="metrics-panel">
    <div class="metrics-cards" role="list">
      <div class="metrics-card" role="listitem">
        <div class="block__label">Interações</div>
        <p class="metrics-card__value">${m.session_count}</p>
      </div>
      <div class="metrics-card" role="listitem">
        <div class="block__label">Latência média total</div>
        <p class="metrics-card__value">${escapeHtml(formatMs(m.latency_ms.avg_total))}</p>
      </div>
      <div class="metrics-card" role="listitem">
        <div class="block__label">Consenso médio</div>
        <p class="metrics-card__value">${escapeHtml(formatPercent(m.consensus.avg_score))}</p>
      </div>
      <div class="metrics-card" role="listitem">
        <div class="block__label">Tools approve / reject</div>
        <p class="metrics-card__value">${m.audit.approve} / ${m.audit.reject}</p>
      </div>
    </div>

    <div class="metrics-chart">
      <div class="block__label">Latência média por estágio</div>
      ${bars.map((b) => barRowHtml(b, maxMs)).join("")}
    </div>

    ${
      m.tokens.tracked
        ? `<p class="hint">Tokens: prompt ${m.tokens.total_prompt} · completion ${m.tokens.total_completion} · total ${m.tokens.total}</p>`
        : `<p class="hint">Tokens: ainda não reportados pelos providers (best-effort).</p>`
    }
  </div>`;
}
