/**
 * Subtle Gen-1 Motor de Segurança status chip for the Live HUD.
 */

import { msg } from "../i18n";
import type { GuardrailStatus } from "../types/live";

export class GuardrailIndicator {
  private status: GuardrailStatus = "secure";

  constructor(private readonly el: HTMLElement) {
    this.el.classList.add("guardrail");
    this.render();
  }

  setStatus(status: GuardrailStatus | string | null | undefined): void {
    const next = normalize(status);
    if (!next) {
      return;
    }
    this.status = next;
    this.render();
  }

  getStatus(): GuardrailStatus {
    return this.status;
  }

  reset(): void {
    this.status = "secure";
    this.render();
  }

  applyLocale(): void {
    this.render();
  }

  private render(): void {
    const g = msg().guardrail;
    const label =
      this.status === "secure"
        ? g.secure
        : this.status === "sanitizing"
          ? g.sanitizing
          : g.blocked;
    this.el.dataset.state = this.status;
    this.el.textContent = `${g.prefix}: ${label}`;
    this.el.title =
      this.status === "secure"
        ? g.titleSecure
        : this.status === "sanitizing"
          ? g.titleSanitizing
          : g.titleBlocked;
  }
}

function normalize(status: string | null | undefined): GuardrailStatus | null {
  if (!status) {
    return null;
  }
  const s = status.toLowerCase();
  if (s === "secure" || s === "ok" || s === "clean") {
    return "secure";
  }
  if (s === "sanitizing" || s === "sanitized" || s === "scrubbed") {
    return "sanitizing";
  }
  if (s === "blocked" || s === "dropped" || s === "rejected") {
    return "blocked";
  }
  return null;
}
