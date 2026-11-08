import type { CaptureFailureRecord } from "../../audio/capture";
import {
  assessBluetoothCapture,
  type AudioDeviceInspection,
} from "../../audio/diagnostics";
import { escapeHtml } from "../html";

export interface AudioDiagnosticsModel {
  devices: AudioDeviceInspection[];
  contextState: string;
  busy: boolean;
  disabled: boolean;
  note: string | null;
  logs: CaptureFailureRecord[];
  activeDeviceId: string | null;
}

function kindLabel(kind: MediaDeviceKind): string {
  if (kind === "audioinput") return "Entrada";
  if (kind === "audiooutput") return "Saída";
  return kind;
}

function endpointLabel(endpoint: AudioDeviceInspection["endpoint"]): string {
  if (endpoint === "default") return "Padrão do SO";
  if (endpoint === "communications") return "Comunicações (Windows)";
  return "Físico";
}

function shortenId(value: string): string {
  if (!value) return "—";
  if (value === "default" || value === "communications") return value;
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function formatWhen(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function renderAudioDiagnosticsPanel(model: AudioDiagnosticsModel): string {
  const assessment = assessBluetoothCapture(model.devices);
  const rows = model.devices
    .map((device) => {
      const label = device.labelHidden
        ? "(label oculto — conceda permissão de microfone)"
        : device.label;
      const active =
        model.activeDeviceId && device.deviceId === model.activeDeviceId ? " is-active" : "";
      const group = device.groupId ? shortenId(device.groupId) : "—";
      return `<tr class="audio-diag__row audio-diag__row--${device.profile}${active}">
        <td>
          <span class="diag-badge diag-badge--${device.profile}">${escapeHtml(device.profileLabel)}</span>
        </td>
        <td>
          ${escapeHtml(kindLabel(device.kind))}
          <small class="audio-diag__meta">${escapeHtml(endpointLabel(device.endpoint))}</small>
        </td>
        <td>${escapeHtml(label)}</td>
        <td class="audio-diag__id" title="${escapeHtml(device.deviceId || "—")}">${escapeHtml(
          shortenId(device.deviceId),
        )}</td>
        <td class="audio-diag__id" title="${escapeHtml(device.groupId || "—")}">${escapeHtml(group)}</td>
      </tr>`;
    })
    .join("");

  const logs = model.logs
    .map((entry) => {
      const constraint = entry.constraint
        ? `<div class="audio-diag__log-meta">constraint: ${escapeHtml(entry.constraint)}</div>`
        : "";
      const browser =
        entry.browserMessage && entry.browserMessage !== entry.message
          ? `<div class="audio-diag__log-meta">browser: ${escapeHtml(entry.browserMessage)}</div>`
          : "";
      return `<li class="audio-diag__log-item">
        <div class="audio-diag__log-head">
          <time datetime="${escapeHtml(entry.at)}">${escapeHtml(formatWhen(entry.at))}</time>
          <code>${escapeHtml(entry.domName)}</code>
          <span>${escapeHtml(entry.kind)}</span>
        </div>
        <p>${escapeHtml(entry.reason)}</p>
        ${constraint}
        ${browser}
      </li>`;
    })
    .join("");

  return `
    <div class="audio-diag">
      <div class="audio-diag__head">
        <h2 id="audio-diag-title">Diagnóstico de áudio</h2>
        <p class="hint">
          Lista de <code>enumerateDevices()</code>. O mesmo fone Bluetooth aparece
          como <strong>Hands-Free / AG Audio (HFP/HSP)</strong> — único perfil com
          microfone — e como <strong>A2DP Stereo</strong>, que só reproduz.
          Entrada e saída do mesmo aparelho partilham o <code>groupId</code>.
        </p>
      </div>
      <p class="audio-diag__verdict audio-diag__verdict--${assessment.level}" role="status">
        ${escapeHtml(assessment.text)}
      </p>
      <div class="audio-diag__toolbar">
        <button
          type="button"
          class="btn-ghost"
          data-action="audio-reset"
          ${model.disabled || model.busy ? "disabled" : ""}
        >
          ${model.busy ? "A repor áudio..." : "Forçar Re-enumeração / Reset Audio Context"}
        </button>
        <span class="audio-diag__context">
          AudioContext: <code>${escapeHtml(model.contextState)}</code>
        </span>
      </div>
      ${model.note ? `<p class="hint">${escapeHtml(model.note)}</p>` : ""}
      <div class="audio-diag__scroll">
        <table class="audio-diag__table">
          <thead>
            <tr>
              <th>Perfil</th>
              <th>Direção</th>
              <th>label</th>
              <th>deviceId</th>
              <th>groupId</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              `<tr><td colspan="5" class="audio-diag__empty">Nenhum dispositivo de áudio enumerado.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="audio-diag__guide">
        <p class="hint">
          Se a captura falhar: confirme uma entrada Hands-Free (não só A2DP);
          feche Teams, Discord ou Zoom se o log mostrar <code>NotReadableError</code>;
          use o botão acima quando o contexto ficar <code>suspended</code> ou
          <code>interrupted</code> depois de o Bluetooth cair.
          Guia: <code>docs/bluetooth-headset.md</code>
          · terminal: <code>tools/bluetooth-diagnostic</code>.
        </p>
      </div>
      <div class="audio-diag__logs">
        <h3>Falhas de getUserMedia nesta sessão</h3>
        ${
          logs
            ? `<ul class="audio-diag__log">${logs}</ul>`
            : `<p class="hint">Sem recusas de captura nesta sessão.</p>`
        }
      </div>
    </div>
  `;
}
