/**
 * Discreet floating control to switch classic vs advanced-mesh orbit visuals.
 */

import type { OrbitVisualMode } from "../components/orbitMode";
import { msg, onLocaleChange } from "../i18n";

export type OrbitModeChangeHandler = (mode: OrbitVisualMode) => void;

export class OrbitModeToggle {
  private unsub: (() => void) | null = null;
  private mode: OrbitVisualMode;
  private onChange: OrbitModeChangeHandler;

  constructor(
    private readonly mount: HTMLElement,
    mode: OrbitVisualMode,
    onChange: OrbitModeChangeHandler,
  ) {
    this.mode = mode;
    this.onChange = onChange;
    this.render();
    this.unsub = onLocaleChange(() => this.render());
  }

  setMode(mode: OrbitVisualMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.render();
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.mount.replaceChildren();
  }

  private render(): void {
    const m = msg().orbitMode;
    this.mount.classList.add("orbit-mode-toggle");
    this.mount.innerHTML = `
      <div class="orbit-mode-toggle-inner" role="group" aria-label="${escapeAttr(m.label)}">
        <span class="orbit-mode-toggle-label">${escapeHtml(m.label)}</span>
        <div class="orbit-mode-toggle-options">
          <button
            type="button"
            class="orbit-mode-option${this.mode === "classic" ? " is-active" : ""}"
            data-orbit-mode="classic"
            aria-pressed="${this.mode === "classic" ? "true" : "false"}"
            title="${escapeAttr(m.classicTitle)}"
          >${escapeHtml(m.classic)}</button>
          <button
            type="button"
            class="orbit-mode-option${this.mode === "advanced-mesh" ? " is-active" : ""}"
            data-orbit-mode="advanced-mesh"
            aria-pressed="${this.mode === "advanced-mesh" ? "true" : "false"}"
            title="${escapeAttr(m.advancedTitle)}"
          >${escapeHtml(m.advanced)}</button>
        </div>
      </div>
    `;
    this.mount.querySelectorAll<HTMLButtonElement>("[data-orbit-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.orbitMode as OrbitVisualMode;
        if (next === this.mode) return;
        this.mode = next;
        this.render();
        this.onChange(next);
      });
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
