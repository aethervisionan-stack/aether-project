/**
 * Local unlock panel: Tool Registry catalog + test routines (HTTP, no payment gate).
 */

import {
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

  private renderShell(): void {
    this.mount.innerHTML = `
      <div class="devtools-panel" data-role="devtools-root">
        <div class="devtools-head">
          <h3 class="devtools-title">Tool Registry</h3>
          <button type="button" class="secondary" data-action="reload-tools" data-keep-enabled="true">Refresh</button>
        </div>
        <p class="devtools-lede">Local unlock — all registered tools invocable without payment approval.</p>
        <ul class="devtools-list" data-role="tool-list"></ul>
        <div class="mobility-row" data-role="test-row">
          ${TEST_ROUTINES.map(
            (r) =>
              `<button type="button" class="secondary" data-action="test-routine" data-routine="${r}" data-keep-enabled="true">${r}</button>`,
          ).join("")}
        </div>
        <p class="devtools-status" data-role="devtools-status">Loading catalog…</p>
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
    this.statusEl.textContent = "Loading catalog…";
    try {
      this.catalog = await fetchToolCatalog();
      this.renderList(this.catalog.names);
      this.statusEl.textContent = `${this.catalog.names.length} tools · /tools/catalog`;
      this.notify?.("ok", `Tool catalog: ${this.catalog.names.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.renderList(localToolSchemas().map((s) => s.name));
      this.statusEl.textContent = `Catalog offline — local schemas shown (${message})`;
      this.notify?.("warn", `Tool catalog: ${message}`);
    }
  }

  private async runRoutine(routine: string): Promise<void> {
    const name = (TEST_ROUTINES as readonly string[]).includes(routine)
      ? (routine as TestRoutine)
      : "health";
    this.statusEl.textContent = `Running ${name}…`;
    try {
      const res = await invokeToolHttp("run_test_routine", { routine: name });
      this.statusEl.textContent = res.ok
        ? `Test ${name}: ok (${Math.round(res.elapsed_ms ?? 0)}ms)`
        : `Test ${name}: ${res.error ?? "fail"}`;
      this.notify?.(res.ok ? "ok" : "warn", this.statusEl.textContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.statusEl.textContent = `Test failed: ${message}`;
      this.notify?.("danger", message);
    }
  }

  private async invokeNamed(name: string): Promise<void> {
    if (!name) return;
    this.statusEl.textContent = `Invoke ${name}…`;
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
      } else {
        this.statusEl.textContent = `Unknown tool: ${name}`;
        return;
      }
      const label = name as ToolName;
      this.statusEl.textContent = res.ok
        ? `${label}: ok (${Math.round(res.elapsed_ms ?? 0)}ms)`
        : `${label}: ${res.error ?? "fail"}`;
      this.notify?.(res.ok ? "ok" : "warn", this.statusEl.textContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.statusEl.textContent = `Invoke failed: ${message}`;
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
