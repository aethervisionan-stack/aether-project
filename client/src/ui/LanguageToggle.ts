/**
 * Compact PT / EN / ES control for the Gen-1 HUD.
 */

import { getLocale, msg, onLocaleChange, setLocale, type Locale } from "../i18n";

const OPTIONS: readonly Locale[] = ["pt", "en", "es"];

export class LanguageToggle {
  private unsub: (() => void) | null = null;

  constructor(private readonly mount: HTMLElement) {
    this.render();
    this.unsub = onLocaleChange(() => this.render());
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
  }

  private render(): void {
    const m = msg().lang;
    const locale = getLocale();
    this.mount.classList.add("lang-toggle");
    this.mount.innerHTML = `
      <div class="lang-toggle-inner" role="group" aria-label="${escapeAttr(m.label)}">
        <span class="lang-toggle-label">${escapeHtml(m.label)}</span>
        <div class="lang-toggle-options">
          ${OPTIONS.map(
            (id) => `
              <button
                type="button"
                class="lang-option${id === locale ? " is-active" : ""}"
                data-locale="${id}"
                aria-pressed="${id === locale ? "true" : "false"}"
              >${escapeHtml(m[id])}</button>
            `,
          ).join("")}
        </div>
      </div>
    `;
    this.mount.querySelectorAll<HTMLButtonElement>("[data-locale]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.locale as Locale;
        setLocale(next);
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
