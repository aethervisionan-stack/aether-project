/**
 * Subtle Gen-1 Motor de Segurança status chip for the Live HUD.
 */

import type { GuardrailStatus } from "../types/live";

const LABELS: Record<GuardrailStatus, string> = {
  secure: "SECURE",
  sanitizing: "SANITIZING",
  blocked: "BLOCKED",
};

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

  private render(): void {
    this.el.dataset.state = this.status;
    this.el.textContent = `GUARDRAIL: ${LABELS[this.status]}`;
    this.el.title =
      this.status === "secure"
        ? "Motor de Segurança — output clean"
        : this.status === "sanitizing"
          ? "Motor de Segurança — text cleaned before HUD"
          : "Motor de Segurança — fragment blocked";
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
