/**
 * Local unlock panel: Tool Registry catalog + test routines (HTTP, no payment gate).
 */

import { msg, t } from "../i18n";
import { playSuccessBeep } from "../os/SuccessBeep";
import {
  confirmToolHttp,
  fetchToolCatalog,
  invokeToolHttp,
  localToolSchemas,
  type ToolCatalogResponse,
} from "../services/ToolClient";
import type { TestRoutine, ToolName } from "../types/tools";

export type DevToolsNotify = (kind: "ok" | "warn" | "info" | "danger", text: string) => void;

const TEST_ROUTINES: readonly TestRoutine[] = ["health", "memory_snapshot", "latency_targets"];

export class DevToolsPanel {
  private catalog: ToolCatalogResponse | null = null;
  private notify: DevToolsNotify | null = null;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;

  constructor(private readonly mount: HTMLElement) {
    this.renderShell();
    void this.reload();
  }

  setNotify(fn: DevToolsNotify): void {
    this.notify = fn;
  }

  applyLocale(): void {
    const d = msg().devtools;
    const title = this.mount.querySelector(".devtools-title");
    const lede = this.mount.querySelector(".devtools-lede");
    const refresh = this.mount.querySelector("[data-action=reload-tools]");
    if (title) title.textContent = d.title;
    if (lede) lede.textContent = d.lede;
    if (refresh) refresh.textContent = d.refresh;
    if (this.catalog) {
      this.statusEl.textContent = t(d.toolsCount, { count: this.catalog.names.length });
    }
  }

  private renderShell(): void {
    const d = msg().devtools;
    this.mount.innerHTML = `
      <div class="devtools-panel" data-role="devtools-root">
        <div class="devtools-head">
          <h3 class="devtools-title">${escapeHtml(d.title)}</h3>
          <button type="button" class="secondary" data-action="reload-tools" data-keep-enabled="true">${escapeHtml(d.refresh)}</button>
        </div>
        <p class="devtools-lede">${escapeHtml(d.lede)}</p>
        <ul class="devtools-list" data-role="tool-list"></ul>
        <div class="mobility-row" data-role="test-row">
          ${TEST_ROUTINES.map(
            (r) =>
              `<button type="button" class="secondary" data-action="test-routine" data-routine="${r}" data-keep-enabled="true">${r}</button>`,
          ).join("")}
        </div>
        <p class="devtools-status" data-role="devtools-status">${escapeHtml(d.loading)}</p>
      </div>
    `;
    this.statusEl = this.mount.querySelector("[data-role=devtools-status]")!;
    this.listEl = this.mount.querySelector("[data-role=tool-list]")!;
    this.mount.querySelector("[data-action=reload-tools]")!.addEventListener("click", () => void this.reload());
    this.mount.querySelectorAll<HTMLButtonElement>("[data-action=test-routine]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const routine = btn.dataset.routine || "latency_probe";
        void this.runRoutine(routine);
      });
    });
    this.renderList(localToolSchemas().map((s) => s.name));
  }

  private renderList(names: string[]): void {
    this.listEl.innerHTML = names
      .map(
        (n) =>
          `<li><button type="button" class="secondary" data-action="invoke-tool" data-tool="${escapeAttr(n)}" data-keep-enabled="true">${escapeHtml(n)}</button></li>`,
      )
      .join("");
    this.listEl.querySelectorAll<HTMLButtonElement>("[data-action=invoke-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.tool || "";
        void this.invokeNamed(name);
      });
    });
  }

  private async reload(): Promise<void> {
    const d = msg().devtools;
    this.statusEl.textContent = d.loading;
    try {
      this.catalog = await fetchToolCatalog();
      this.renderList(this.catalog.names);
      this.statusEl.textContent = t(d.toolsCount, { count: this.catalog.names.length });
      this.notify?.("ok", t(d.catalogOk, { count: this.catalog.names.length }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.renderList(localToolSchemas().map((s) => s.name));
      this.statusEl.textContent = t(d.catalogOffline, { message });
      this.notify?.("warn", t(d.catalogWarn, { message }));
    }
  }

  private async runRoutine(routine: string): Promise<void> {
    const d = msg().devtools;
    const name = (TEST_ROUTINES as readonly string[]).includes(routine)
      ? (routine as TestRoutine)
      : "health";
    this.statusEl.textContent = t(d.running, { name });
    try {
      const res = await invokeToolHttp("run_test_routine", { routine: name });
      this.statusEl.textContent = res.ok
        ? t(d.testOk, { name, ms: Math.round(res.elapsed_ms ?? 0) })
        : t(d.testFail, { name, error: res.error ?? "fail" });
      this.notify?.(res.ok ? "ok" : "warn", this.statusEl.textContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.statusEl.textContent = t(d.testFailed, { message });
      this.notify?.("danger", message);
    }
  }

  private async invokeNamed(name: string): Promise<void> {
    if (!name) return;
    const d = msg().devtools;
    this.statusEl.textContent = t(d.invoke, { name });
    try {
      let res;
      if (name === "run_test_routine") {
        res = await invokeToolHttp("run_test_routine", { routine: "health" });
      } else if (name === "memory_payload") {
        res = await invokeToolHttp("memory_payload", { action: "get" });
      } else if (name === "onchain_lookup") {
        res = await invokeToolHttp("onchain_lookup", {
          address: "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa",
          method: "getBalance",
        });
      } else if (name === "solana_treasury_query") {
        res = await invokeToolHttp("solana_treasury_query", {});
      } else if (name === "messaging_tool") {
        res = await invokeToolHttp("messaging_tool", {
          action: "send",
          app: "whatsapp",
          contact: "Carlos",
          text: "Chego em 10 minutos.",
        });
      } else if (name === "email_calendar_tool") {
        res = await invokeToolHttp("email_calendar_tool", {
          action: "schedule",
          title: "Sync with Ana",
          when: "tomorrow 14:00",
          duration_min: 30,
        });
      } else if (name === "telephony_tool") {
        res = await invokeToolHttp("telephony_tool", { action: "incoming" });
      } else if (name === "system_control_tool") {
        res = await invokeToolHttp("system_control_tool", { action: "battery" });
      } else if (name === "system_help_tool") {
        res = await invokeToolHttp("system_help_tool", {
          action: "get_system_capabilities",
        });
      } else {
        this.statusEl.textContent = t(d.unknownTool, { name });
        return;
      }

      const label = name as ToolName;
      const status = String((res.result as { status?: string } | undefined)?.status || "");
      if (status === "pending_confirmation") {
        const pendingId = String(
          (res.result as { pending_id?: string } | undefined)?.pending_id || "",
        );
        const speak = String((res.result as { speak?: string } | undefined)?.speak || "");
        this.statusEl.textContent = speak || `Pending confirm ${pendingId}`;
        this.notify?.("info", this.statusEl.textContent);
        // Auto-complete confirm in local unlock harness so catalog demos stay one-click.
        const confirmed = await confirmToolHttp({
          pending_id: pendingId || undefined,
          utterance: "Sim",
        });
        if (confirmed.success_beep || confirmed.ok) {
          void playSuccessBeep();
        }
        this.statusEl.textContent = confirmed.speak || `Confirmed ${label}`;
        this.notify?.(confirmed.ok ? "ok" : "warn", this.statusEl.textContent);
        return;
      }

      this.statusEl.textContent = res.ok
        ? t(d.invokeOk, { name: label, ms: Math.round(res.elapsed_ms ?? 0) })
        : t(d.invokeFail, { name: label, error: res.error ?? "fail" });
      this.notify?.(res.ok ? "ok" : "warn", this.statusEl.textContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.statusEl.textContent = t(d.invokeFailed, { message });
      this.notify?.("danger", message);
    }
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
