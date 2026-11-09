/**
 * Lightweight non-blocking toast host for Gen-1 HUD (offline / reconnect / RPC).
 */

export type ToastKind = "info" | "ok" | "warn" | "danger";

export interface ToastOptions {
  kind?: ToastKind;
  ttlMs?: number;
}

export class ToastHost {
  private readonly root: HTMLElement;
  private seq = 0;

  constructor(parent: HTMLElement = document.body) {
    let el = parent.querySelector<HTMLElement>("[data-role=toast-host]");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast-host";
      el.dataset.role = "toast-host";
      el.setAttribute("aria-live", "polite");
      parent.appendChild(el);
    }
    this.root = el;
  }

  show(message: string, options: ToastOptions = {}): void {
    const kind = options.kind ?? "info";
    const ttl = options.ttlMs ?? 3200;
    const id = `t${++this.seq}`;
    const node = document.createElement("div");
    node.className = `toast toast-${kind}`;
    node.dataset.id = id;
    node.textContent = message;
    this.root.appendChild(node);
    // Enter animation
    requestAnimationFrame(() => node.classList.add("toast-in"));

    window.setTimeout(() => {
      node.classList.remove("toast-in");
      node.classList.add("toast-out");
      window.setTimeout(() => node.remove(), 280);
    }, ttl);
  }

  info(message: string, ttlMs?: number): void {
    this.show(message, { kind: "info", ttlMs });
  }

  ok(message: string, ttlMs?: number): void {
    this.show(message, { kind: "ok", ttlMs });
  }

  warn(message: string, ttlMs?: number): void {
    this.show(message, { kind: "warn", ttlMs });
  }

  danger(message: string, ttlMs?: number): void {
    this.show(message, { kind: "danger", ttlMs });
  }
}
